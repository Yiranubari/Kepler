import * as crypto from 'crypto';
import {
  TaintGraph,
  TaintNode,
  TaintEdge,
  EvidencePath,
  EvidenceItem,
  TaintNodeType,
  KeplerLogger
} from '@kepler/shared';
import {
  TaintConfig,
  BitcoinIngestData,
  LightningIngestData,
  NostrIngestData,
  CashuIngestData,
  TaintAnalysisResult
} from './taint.types';
import { TaintRuleRegistry } from './rules/registry';
import { TaintScorer } from './taint.scorer';
import {
  TaintEngineError,
  TaintIngestError,
  TaintRuleError,
  TaintPathError
} from './taint.errors';
import {
  bitcoinIngestSchema,
  lightningIngestSchema,
  nostrIngestSchema,
  cashuIngestSchema
} from './taint.validators';

interface EdgeHop {
  readonly neighborNodeId: string;
  readonly edge: TaintEdge;
}

interface PathQueueItem {
  readonly currentNodeId: string;
  readonly nodes: readonly string[];
  readonly edges: readonly TaintEdge[];
}

class DefaultNoopLogger implements KeplerLogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public fatal(): void {}
}

export class TaintEngine {
  private graph: TaintGraph;
  private scenarioId: string | null;
  private readonly ingested: Set<string>;
  private readonly config: TaintConfig;
  private readonly registry: TaintRuleRegistry;
  private readonly scorer: TaintScorer;
  private readonly logger: KeplerLogger;

  constructor(
    config?: TaintConfig,
    registry?: TaintRuleRegistry,
    scorer?: TaintScorer,
    logger?: KeplerLogger,
    graph?: TaintGraph
  ) {
    this.config = config ?? new TaintConfig();
    this.registry = registry ?? new TaintRuleRegistry();
    this.scorer = scorer ?? new TaintScorer();
    this.logger = logger ?? new DefaultNoopLogger();
    if (graph) {
      this.graph = graph;
      this.scenarioId = graph.scenarioId;
    } else {
      this.scenarioId = null;
      this.graph = new TaintGraph({
        id: 'graph_default',
        scenarioId: 'default',
        createdAt: new Date(0)
      });
    }
    this.ingested = new Set<string>();
  }

  public getScenarioId(): string | null {
    return this.scenarioId;
  }

  public setScenarioId(scenarioId: string): void {
    const trimmed = scenarioId.trim();
    if (trimmed.length === 0) {
      throw new TaintEngineError('ScenarioId cannot be empty', {
        field: 'scenarioId',
        reason: 'Empty scenarioId'
      });
    }
    this.scenarioId = trimmed;
    this.graph = new TaintGraph({
      id: `graph_${this.scenarioId}`,
      scenarioId: this.scenarioId,
      nodes: [...this.graph.nodes],
      edges: [...this.graph.edges],
      paths: [...this.graph.paths],
      createdAt: this.graph.createdAt
    });
  }

  public getGraph(): TaintGraph {
    return this.graph;
  }

  public reset(): void {
    this.scenarioId = null;
    this.ingested.clear();
    this.graph = new TaintGraph({
      id: 'graph_default',
      scenarioId: 'default',
      createdAt: new Date(0)
    });
  }

  public ingestBitcoin(data: BitcoinIngestData): void {
    const parseResult = bitcoinIngestSchema.safeParse(data);
    if (!parseResult.success) {
      throw new TaintIngestError('Invalid Bitcoin ingest data', {
        protocol: 'BITCOIN',
        reason: parseResult.error.message
      });
    }
    this.ensureScenarioId(data);

    for (const tx of data.transactions) {
      const recordHash = this.hashRecord('BITCOIN:TX', tx);
      if (this.ingested.has(recordHash)) {
        continue;
      }

      const txNode = this.createNode(
        TaintNodeType.Txid,
        tx.txid,
        {
          blockHeight: tx.blockHeight,
          blockTime: tx.blockTime
        },
        'BITCOIN'
      );
      this.addOrMergeNode(txNode, 'BITCOIN');

      for (const input of tx.inputs) {
        if (input.txid && input.txid.trim().length > 0) {
          const inputTxNode = this.createNode(
            TaintNodeType.Txid,
            input.txid,
            {},
            'BITCOIN'
          );
          this.addOrMergeNode(inputTxNode, 'BITCOIN');
        }
        if (input.address && input.address.trim().length > 0) {
          const inputAddrNode = this.createNode(
            TaintNodeType.Address,
            input.address,
            {},
            'BITCOIN'
          );
          this.addOrMergeNode(inputAddrNode, 'BITCOIN');
        }
      }

      for (const output of tx.outputs) {
        if (output.address && output.address.trim().length > 0) {
          const outputAddrNode = this.createNode(
            TaintNodeType.Address,
            output.address,
            {},
            'BITCOIN'
          );
          this.addOrMergeNode(outputAddrNode, 'BITCOIN');
        }
      }

      this.ingested.add(recordHash);
    }

    for (const item of data.addresses) {
      const recordHash = this.hashRecord('BITCOIN:ADDR', item);
      if (this.ingested.has(recordHash)) {
        continue;
      }
      if (item.address && item.address.trim().length > 0) {
        const addrNode = this.createNode(
          TaintNodeType.Address,
          item.address,
          {},
          'BITCOIN'
        );
        this.addOrMergeNode(addrNode, 'BITCOIN');
      }
      this.ingested.add(recordHash);
    }
  }

  public ingestLightning(data: LightningIngestData): void {
    const parseResult = lightningIngestSchema.safeParse(data);
    if (!parseResult.success) {
      throw new TaintIngestError('Invalid Lightning ingest data', {
        protocol: 'LIGHTNING',
        reason: parseResult.error.message
      });
    }
    this.ensureScenarioId(data);

    for (const invoice of data.invoices) {
      const recordHash = this.hashRecord('LIGHTNING:INVOICE', invoice);
      if (this.ingested.has(recordHash)) {
        continue;
      }

      const invoiceNode = this.createNode(
        TaintNodeType.Invoice,
        invoice.bolt11,
        {
          paymentHash: invoice.paymentHash,
          amountMsat: invoice.amountMsat.toString(),
          createdAt: invoice.createdAt,
          expiresAt: invoice.expiresAt,
          payeePubkey: invoice.payeePubkey
        },
        'LIGHTNING'
      );
      this.addOrMergeNode(invoiceNode, 'LIGHTNING');

      const paymentHashNode = this.createNode(
        TaintNodeType.PaymentHash,
        invoice.paymentHash,
        {
          bolt11: invoice.bolt11,
          payeePubkey: invoice.payeePubkey
        },
        'LIGHTNING'
      );
      this.addOrMergeNode(paymentHashNode, 'LIGHTNING');

      if (invoice.preimage && invoice.preimage.trim().length > 0) {
        const preimageNode = this.createNode(
          TaintNodeType.Preimage,
          invoice.preimage,
          {
            paymentHash: invoice.paymentHash
          },
          'LIGHTNING'
        );
        this.addOrMergeNode(preimageNode, 'LIGHTNING');
      }

      this.ingested.add(recordHash);
    }
  }

  public ingestNostr(data: NostrIngestData): void {
    const parseResult = nostrIngestSchema.safeParse(data);
    if (!parseResult.success) {
      throw new TaintIngestError('Invalid Nostr ingest data', {
        protocol: 'NOSTR',
        reason: parseResult.error.message
      });
    }
    this.ensureScenarioId(data);

    for (const event of data.events) {
      const recordHash = this.hashRecord('NOSTR:EVENT', event);
      if (this.ingested.has(recordHash)) {
        continue;
      }

      const eventNode = this.createNode(
        TaintNodeType.EventId,
        event.id,
        {
          pubkey: event.pubkey,
          kind: event.kind,
          tags: event.tags,
          content: event.content,
          createdAt: event.createdAt
        },
        'NOSTR'
      );
      this.addOrMergeNode(eventNode, 'NOSTR');

      const npubNode = this.createNode(
        TaintNodeType.Npub,
        event.pubkey,
        {},
        'NOSTR'
      );
      this.addOrMergeNode(npubNode, 'NOSTR');

      for (const tag of event.tags) {
        if (!tag || tag.length < 2) {
          continue;
        }
        const tagType = tag[0];
        const tagValue = tag[1];
        if (!tagValue || tagValue.trim().length === 0) {
          continue;
        }
        if (tagType === 'p') {
          const taggedNpubNode = this.createNode(
            TaintNodeType.Npub,
            tagValue,
            {},
            'NOSTR'
          );
          this.addOrMergeNode(taggedNpubNode, 'NOSTR');
        } else if (tagType === 'e') {
          const taggedEventNode = this.createNode(
            TaintNodeType.EventId,
            tagValue,
            {},
            'NOSTR'
          );
          this.addOrMergeNode(taggedEventNode, 'NOSTR');
        } else if (tagType === 'r') {
          const taggedRelayNode = this.createNode(
            TaintNodeType.Relay,
            tagValue,
            {},
            'NOSTR'
          );
          this.addOrMergeNode(taggedRelayNode, 'NOSTR');
        }
      }

      this.ingested.add(recordHash);
    }
  }

  public ingestCashu(data: CashuIngestData): void {
    const parseResult = cashuIngestSchema.safeParse(data);
    if (!parseResult.success) {
      throw new TaintIngestError('Invalid Cashu ingest data', {
        protocol: 'CASHU',
        reason: parseResult.error.message
      });
    }
    this.ensureScenarioId(data);

    for (const mint of data.mints) {
      const recordHash = this.hashRecord('CASHU:MINT', mint);
      if (this.ingested.has(recordHash)) {
        continue;
      }
      const mintNode = this.createNode(
        TaintNodeType.Mint,
        mint.url,
        { name: mint.name },
        'CASHU'
      );
      this.addOrMergeNode(mintNode, 'CASHU');
      this.ingested.add(recordHash);
    }

    for (const token of data.tokens) {
      const recordHash = this.hashRecord('CASHU:TOKEN', token);
      if (this.ingested.has(recordHash)) {
        continue;
      }

      const mintNode = this.createNode(
        TaintNodeType.Mint,
        token.mint,
        { unit: token.unit },
        'CASHU'
      );
      this.addOrMergeNode(mintNode, 'CASHU');

      for (const proof of token.proofs) {
        const tokenNode = this.createNode(
          TaintNodeType.CashuToken,
          proof.secret,
          {
            id: proof.id,
            amount: proof.amount.toString(),
            C: proof.C,
            mint: token.mint,
            unit: token.unit,
            memo: token.memo
          },
          'CASHU'
        );
        this.addOrMergeNode(tokenNode, 'CASHU');
      }

      this.ingested.add(recordHash);
    }

    for (const quote of data.quotes) {
      const recordHash = this.hashRecord('CASHU:QUOTE', quote);
      if (this.ingested.has(recordHash)) {
        continue;
      }

      if (quote.request && quote.request.trim().length > 0) {
        const invoiceNode = this.createNode(
          TaintNodeType.Invoice,
          quote.request,
          {
            quote: quote.quote,
            type: quote.type,
            amount: quote.amount.toString(),
            state: quote.state
          },
          'CASHU'
        );
        this.addOrMergeNode(invoiceNode, 'CASHU');
      }

      this.ingested.add(recordHash);
    }
  }

  public analyze(overrideNow?: number): TaintAnalysisResult {
    const now = overrideNow ?? Date.now();
    this.graph = new TaintGraph({
      id: this.graph.id,
      scenarioId: this.graph.scenarioId,
      nodes: [...this.graph.nodes],
      edges: [...this.graph.edges],
      paths: [...this.graph.paths],
      createdAt: new Date(now)
    });
    const rules = this.registry.getRules();

    for (const rule of rules) {
      const result = rule.apply({
        graph: this.graph,
        config: this.config,
        now
      });

      for (const edge of result.edges) {
        if (!this.graph.getNode(edge.from) || !this.graph.getNode(edge.to)) {
          continue;
        }

        const clampedConfidence = Math.min(edge.confidence, rule.maxConfidence);
        if (!this.scorer.aboveThreshold(clampedConfidence, this.config)) {
          continue;
        }

        const edgeId = crypto
          .createHash('sha256')
          .update(`${rule.name}:${edge.from}:${edge.to}:${edge.relationship}`)
          .digest('hex');

        let existingEdge = this.graph.getEdge(edgeId);
        if (!existingEdge) {
          existingEdge = this.graph.edges.find(
            (e) =>
              e.from === edge.from &&
              e.to === edge.to &&
              e.relationship === edge.relationship
          );
        }
        if (existingEdge) {
          const higherConfidence = Math.max(existingEdge.confidence, clampedConfidence);
          const mergedEvidence = this.mergeEvidence(existingEdge.evidence, edge.evidence);
          const mergedEdge = new TaintEdge({
            id: existingEdge.id,
            from: existingEdge.from,
            to: existingEdge.to,
            relationship: existingEdge.relationship,
            confidence: higherConfidence,
            evidence: mergedEvidence
          });
          this.graph.addEdge(mergedEdge);
        } else {
          if (this.graph.edges.length >= this.config.maxEdgesPerGraph) {
            throw new TaintRuleError('Maximum edges per graph exceeded', {
              rule: 'aggregate',
              reason: 'MAX_EDGES_EXCEEDED',
              count: this.graph.edges.length + 1
            });
          }
          const newEdge = new TaintEdge({
            id: edgeId,
            from: edge.from,
            to: edge.to,
            relationship: edge.relationship,
            confidence: clampedConfidence,
            evidence: [...edge.evidence]
          });
          this.graph.addEdge(newEdge);
        }
      }
    }

    const scenarioId = this.scenarioId ?? this.graph.scenarioId;
    return {
      graph: this.graph,
      scenarioId,
      analyzedAt: new Date(now).toISOString(),
      ruleCount: rules.length,
      nodeCount: this.graph.nodes.length,
      edgeCount: this.graph.edges.length,
      pathCount: this.graph.paths.length
    };
  }

  public findPaths(
    fromNodeId: string,
    toNodeId: string,
    maxPaths: number = 5
  ): EvidencePath[] {
    if (!this.graph.getNode(fromNodeId) || !this.graph.getNode(toNodeId)) {
      throw new TaintPathError('Node not found in graph', {
        from: fromNodeId,
        to: toNodeId,
        reason: 'NODE_NOT_FOUND'
      });
    }

    if (maxPaths <= 0) {
      return [];
    }

    if (fromNodeId === toNodeId) {
      return [
        new EvidencePath({
          nodes: [fromNodeId],
          edges: [],
          overallConfidence: 1.0
        })
      ].slice(0, maxPaths);
    }

    const adjacency = new Map<string, EdgeHop[]>();
    for (const edge of this.graph.edges) {
      if (this.scorer.aboveThreshold(edge.confidence, this.config)) {
        const fromHops = adjacency.get(edge.from) ?? [];
        fromHops.push({ neighborNodeId: edge.to, edge });
        adjacency.set(edge.from, fromHops);

        const toHops = adjacency.get(edge.to) ?? [];
        toHops.push({ neighborNodeId: edge.from, edge });
        adjacency.set(edge.to, toHops);
      }
    }

    let currentLevel: PathQueueItem[] = [
      {
        currentNodeId: fromNodeId,
        nodes: [fromNodeId],
        edges: []
      }
    ];

    const collectedPaths: EvidencePath[] = [];

    for (let depth = 1; depth <= this.config.maxPathDepth; depth++) {
      const nextLevel: PathQueueItem[] = [];

      for (const item of currentLevel) {
        const hops = adjacency.get(item.currentNodeId) ?? [];
        for (const hop of hops) {
          if (item.nodes.includes(hop.neighborNodeId)) {
            continue;
          }

          const nextNodes = [...item.nodes, hop.neighborNodeId];
          const nextEdges = [...item.edges, hop.edge];

          if (hop.neighborNodeId === toNodeId) {
            const overallConfidence = this.scorer.scorePath(nextEdges);
            collectedPaths.push(
              new EvidencePath({
                nodes: nextNodes,
                edges: nextEdges.map((e) => e.id),
                overallConfidence
              })
            );
          } else {
            nextLevel.push({
              currentNodeId: hop.neighborNodeId,
              nodes: nextNodes,
              edges: nextEdges
            });
          }
        }
      }

      if (collectedPaths.length >= maxPaths) {
        break;
      }

      currentLevel = nextLevel;
      if (currentLevel.length === 0) {
        break;
      }
    }

    collectedPaths.sort((a, b) => {
      if (a.edges.length !== b.edges.length) {
        return a.edges.length - b.edges.length;
      }
      if (b.overallConfidence !== a.overallConfidence) {
        return b.overallConfidence - a.overallConfidence;
      }
      const keyA = a.nodes.join('|') + '::' + a.edges.join('|');
      const keyB = b.nodes.join('|') + '::' + b.edges.join('|');
      return keyA.localeCompare(keyB);
    });

    return collectedPaths.slice(0, maxPaths);
  }

  private ensureScenarioId(data?: unknown): void {
    if (this.scenarioId === null) {
      let candidate = '';
      if (
        data &&
        typeof data === 'object' &&
        'scenarioId' in data &&
        typeof (data as Record<string, unknown>).scenarioId === 'string'
      ) {
        candidate = ((data as Record<string, unknown>).scenarioId as string).trim();
      }
      this.scenarioId = candidate.length > 0 ? candidate : 'default';
      this.graph = new TaintGraph({
        id: `graph_${this.scenarioId}`,
        scenarioId: this.scenarioId,
        nodes: [...this.graph.nodes],
        edges: [...this.graph.edges],
        paths: [...this.graph.paths],
        createdAt: this.graph.createdAt
      });
    }
  }

  private addOrMergeNode(node: TaintNode, protocol: string): void {
    const existing = this.graph.getNode(node.id);
    if (existing) {
      const mergedMetadata: Record<string, unknown> = {
        ...node.metadata,
        ...existing.metadata
      };
      const updated = new TaintNode({
        id: existing.id,
        type: existing.type,
        value: existing.value,
        metadata: mergedMetadata
      });
      this.graph.addNode(updated);
      return;
    }
    if (this.graph.nodes.length >= this.config.maxNodesPerGraph) {
      throw new TaintIngestError('Maximum nodes per graph exceeded', {
        protocol,
        reason: 'MAX_NODES_EXCEEDED',
        count: this.graph.nodes.length + 1
      });
    }
    this.graph.addNode(node);
  }

  private mergeEvidence(
    first: readonly EvidenceItem[],
    second: readonly EvidenceItem[]
  ): EvidenceItem[] {
    const map = new Map<string, EvidenceItem>();
    for (const item of first) {
      const key = `${item.kind}:${item.ref}:${item.description}`;
      map.set(key, item);
    }
    for (const item of second) {
      const key = `${item.kind}:${item.ref}:${item.description}`;
      map.set(key, item);
    }
    return Array.from(map.values()).sort((a, b) => {
      const keyA = `${a.kind}:${a.ref}:${a.description}`;
      const keyB = `${b.kind}:${b.ref}:${b.description}`;
      return keyA.localeCompare(keyB);
    });
  }

  private hashRecord(protocol: string, record: unknown): string {
    const serialized = this.canonicalSerialize(record);
    return crypto
      .createHash('sha256')
      .update(`${protocol}:${serialized}`)
      .digest('hex');
  }

  private canonicalSerialize(value: unknown): string {
    if (value === null || value === undefined) {
      return String(value);
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map((item) => this.canonicalSerialize(item)).join(',') + ']';
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      '{' +
      keys
        .map((key) => JSON.stringify(key) + ':' + this.canonicalSerialize(obj[key]))
        .join(',') +
      '}'
    );
  }

  private normalizeNodeValue(
    type: TaintNodeType,
    rawValue: string,
    protocol: string
  ): string {
    const trimmed = rawValue.trim();
    if (trimmed.length === 0) {
      throw new TaintIngestError('Node value cannot be empty', {
        protocol,
        reason: 'Empty node value'
      });
    }
    switch (type) {
      case TaintNodeType.Txid:
      case TaintNodeType.PaymentHash:
      case TaintNodeType.Preimage:
      case TaintNodeType.EventId:
        return trimmed.toLowerCase();
      case TaintNodeType.Mint:
      case TaintNodeType.Relay:
        return trimmed.replace(/\/+$/, '');
      case TaintNodeType.Address: {
        const lower = trimmed.toLowerCase();
        if (
          lower.startsWith('bc1') ||
          lower.startsWith('tb1') ||
          lower.startsWith('bcrt1')
        ) {
          return lower;
        }
        return trimmed;
      }
      case TaintNodeType.Invoice:
        return trimmed.toLowerCase();
      case TaintNodeType.Npub:
      case TaintNodeType.CashuToken:
        return trimmed;
      default:
        return trimmed;
    }
  }

  private getNodeTypePrefix(type: TaintNodeType): string {
    switch (type) {
      case TaintNodeType.Address:
        return 'address';
      case TaintNodeType.Txid:
        return 'txid';
      case TaintNodeType.Invoice:
        return 'invoice';
      case TaintNodeType.PaymentHash:
        return 'payment_hash';
      case TaintNodeType.Preimage:
        return 'preimage';
      case TaintNodeType.Npub:
        return 'npub';
      case TaintNodeType.EventId:
        return 'event_id';
      case TaintNodeType.Mint:
        return 'mint';
      case TaintNodeType.Relay:
        return 'relay';
      case TaintNodeType.CashuToken:
        return 'cashu_token';
      default:
        return String(type).toLowerCase();
    }
  }

  private createNode(
    type: TaintNodeType,
    rawValue: string,
    metadata: Record<string, unknown>,
    protocol: string
  ): TaintNode {
    const normalizedValue = this.normalizeNodeValue(type, rawValue, protocol);
    const prefix = this.getNodeTypePrefix(type);
    const id = `${prefix}:${normalizedValue}`;
    return new TaintNode({
      id,
      type,
      value: normalizedValue,
      metadata
    });
  }
}
