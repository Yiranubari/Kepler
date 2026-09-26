import { Scenario } from '@prisma/client';
import {
  TaintGraph,
  EvidencePath,
  KeplerLogger,
  NotFoundError,
  TaintNodeType,
  PaymentTargetKind
} from '@kepler/shared';
import {
  TaintConfig,
  TaintIngestPayload,
  TaintAnalysisResult
} from './taint.types';
import { TaintRepository } from './taint.repository';
import { TaintRuleRegistry } from './rules/registry';
import { TaintScorer } from './taint.scorer';
import { TaintEngine } from './taint.engine';
import { TaintEngineError, TaintPersistenceError } from './taint.errors';

export class TaintService {
  private readonly config: TaintConfig;
  private readonly registry: TaintRuleRegistry;
  private readonly scorer: TaintScorer;
  private readonly repository: TaintRepository;
  private readonly logger: KeplerLogger;

  constructor(
    config: TaintConfig,
    registry: TaintRuleRegistry,
    scorer: TaintScorer,
    repository: TaintRepository,
    logger: KeplerLogger
  ) {
    this.config = config;
    this.registry = registry;
    this.scorer = scorer;
    this.repository = repository;
    this.logger = logger;
  }

  public async analyze(
    scenarioId: string,
    ingestData: TaintIngestPayload
  ): Promise<TaintAnalysisResult> {
    if (!scenarioId || scenarioId.trim().length === 0) {
      throw new TaintEngineError('ScenarioId cannot be empty', {
        field: 'scenarioId',
        reason: 'Empty scenarioId'
      });
    }

    const trimmedScenarioId = scenarioId.trim();
    const exists = await this.repository.scenarioExists(trimmedScenarioId);
    if (!exists) {
      throw new NotFoundError('Scenario not found', {
        resource: 'Scenario',
        id: trimmedScenarioId
      });
    }

    const engine = new TaintEngine(
      this.config,
      this.registry,
      this.scorer,
      this.logger
    );
    engine.setScenarioId(trimmedScenarioId);

    if (ingestData.bitcoin) {
      engine.ingestBitcoin(ingestData.bitcoin);
    }
    if (ingestData.lightning) {
      engine.ingestLightning(ingestData.lightning);
    }
    if (ingestData.nostr) {
      engine.ingestNostr(ingestData.nostr);
    }
    if (ingestData.cashu) {
      engine.ingestCashu(ingestData.cashu);
    }

    const result = engine.analyze();

    const scenario = await this.repository.getScenario(trimmedScenarioId);
    if (scenario && scenario.targetData) {
      const topPaths = this.computeTopPaths(engine, scenario);
      for (const path of topPaths) {
        result.graph.addPath(path);
      }
      result.pathCount = result.graph.paths.length;
    }

    try {
      await this.repository.saveGraph(trimmedScenarioId, result);
    } catch (error) {
      const prismaCode =
        (error as { code?: unknown })?.code ??
        ((error as { cause?: unknown })?.cause as { code?: unknown })?.code;
      const contextReason = (
        error as { context?: { reason?: unknown } }
      )?.context?.reason;
      const isForeignKey =
        prismaCode === 'P2003' ||
        contextReason === 'FOREIGN_KEY_VIOLATION' ||
        (typeof contextReason === 'string' &&
          contextReason.includes('Foreign key constraint')) ||
        (error instanceof Error &&
          error.message.includes('Foreign key constraint'));
      const reason = isForeignKey
        ? 'FOREIGN_KEY_VIOLATION'
        : error instanceof Error
          ? error.message
          : String(error);
      throw new TaintPersistenceError(
        'Failed to persist taint graph',
        {
          scenarioId: trimmedScenarioId,
          operation: 'saveGraph',
          reason
        },
        error instanceof Error ? error : undefined
      );
    }

    return result;
  }

  public async getGraph(scenarioId: string): Promise<TaintGraph | null> {
    if (!scenarioId || scenarioId.trim().length === 0) {
      return null;
    }
    const trimmed = scenarioId.trim();
    try {
      const graph = await this.repository.getGraph(trimmed);
      return graph ?? null;
    } catch {
      return null;
    }
  }

  public async findPaths(
    scenarioId: string,
    fromNodeId: string,
    toNodeId: string,
    maxPaths?: number
  ): Promise<EvidencePath[]> {
    if (!scenarioId || scenarioId.trim().length === 0) {
      throw new TaintEngineError('ScenarioId cannot be empty', {
        field: 'scenarioId',
        reason: 'Empty scenarioId'
      });
    }

    const trimmedScenarioId = scenarioId.trim();
    const graph = await this.repository.getGraph(trimmedScenarioId);
    if (!graph) {
      throw new NotFoundError('Taint graph not found', {
        resource: 'TaintGraph',
        id: trimmedScenarioId
      });
    }

    const engine = new TaintEngine(
      this.config,
      this.registry,
      this.scorer,
      this.logger,
      graph
    );
    const resolvedMaxPaths = maxPaths !== undefined ? maxPaths : 5;
    return engine.findPaths(fromNodeId, toNodeId, resolvedMaxPaths);
  }

  private computeTopPaths(
    engine: TaintEngine,
    scenario: Scenario
  ): EvidencePath[] {
    if (
      !scenario.targetData ||
      typeof scenario.targetData !== 'object' ||
      Array.isArray(scenario.targetData)
    ) {
      return [];
    }

    const targetData = scenario.targetData as Record<string, unknown>;
    const startNodeId = this.resolveStartNodeId(
      engine.getGraph(),
      scenario.targetKind,
      targetData
    );

    if (!startNodeId) {
      return [];
    }

    return engine.findTopPaths(startNodeId, 5, 5);
  }

  private resolveStartNodeId(
    graph: TaintGraph,
    kind: string,
    targetData: Record<string, unknown>
  ): string | null {
    switch (kind.toUpperCase()) {
      case PaymentTargetKind.Lightning.toUpperCase():
        return this.resolveLightningStartNode(graph, targetData);
      case PaymentTargetKind.Bitcoin.toUpperCase():
        return this.resolveBitcoinStartNode(graph, targetData);
      case PaymentTargetKind.Cashu.toUpperCase():
        return this.resolveCashuStartNode(graph, targetData);
      default:
        return null;
    }
  }

  private resolveLightningStartNode(
    graph: TaintGraph,
    targetData: Record<string, unknown>
  ): string | null {
    if (
      typeof targetData['invoice'] === 'string' &&
      targetData['invoice'].trim().length > 0
    ) {
      const inv = targetData['invoice'].trim().toLowerCase();
      const invoiceNode = graph.getNode(`invoice:${inv}`);
      if (invoiceNode) {
        return invoiceNode.id;
      }
      const matchingPaymentHashNode = graph.nodes.find(
        (n) =>
          n.type === TaintNodeType.PaymentHash &&
          typeof n.metadata['bolt11'] === 'string' &&
          n.metadata['bolt11'].trim().toLowerCase() === inv
      );
      if (matchingPaymentHashNode) {
        return matchingPaymentHashNode.id;
      }
    }
    if (
      typeof targetData['paymentHash'] === 'string' &&
      targetData['paymentHash'].trim().length > 0
    ) {
      const hash = targetData['paymentHash'].trim().toLowerCase();
      const paymentHashNode = graph.getNode(`payment_hash:${hash}`);
      if (paymentHashNode) {
        return paymentHashNode.id;
      }
    }
    return null;
  }

  private resolveBitcoinStartNode(
    graph: TaintGraph,
    targetData: Record<string, unknown>
  ): string | null {
    if (
      typeof targetData['address'] === 'string' &&
      targetData['address'].trim().length > 0
    ) {
      const addr = targetData['address'].trim();
      const lower = addr.toLowerCase();
      const normalized =
        lower.startsWith('bc1') ||
        lower.startsWith('tb1') ||
        lower.startsWith('bcrt1')
          ? lower
          : addr;
      const addrNode = graph.getNode(`address:${normalized}`);
      if (addrNode) {
        return addrNode.id;
      }
    }
    return null;
  }

  private resolveCashuStartNode(
    graph: TaintGraph,
    targetData: Record<string, unknown>
  ): string | null {
    if (
      typeof targetData['request'] === 'string' &&
      targetData['request'].trim().length > 0
    ) {
      const req = targetData['request'].trim().toLowerCase();
      const invoiceNode = graph.getNode(`invoice:${req}`);
      if (invoiceNode) {
        return invoiceNode.id;
      }
    }
    return null;
  }
}
