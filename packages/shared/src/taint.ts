export type ProtocolType = 'BITCOIN' | 'LIGHTNING' | 'NOSTR' | 'CASHU';

export enum TaintNodeType {
  Address = 'Address',
  Txid = 'Txid',
  Invoice = 'Invoice',
  PaymentHash = 'PaymentHash',
  Preimage = 'Preimage',
  Npub = 'Npub',
  EventId = 'EventId',
  Mint = 'Mint',
  Relay = 'Relay',
  CashuToken = 'CashuToken'
}

export type EvidenceItemKind = 'RawData' | 'VerificationStep' | 'Correlation';

export interface EvidenceItemJSON {
  readonly kind: EvidenceItemKind;
  readonly ref: string;
  readonly description: string;
  readonly data?: unknown;
}

export class EvidenceItem {
  public readonly kind: EvidenceItemKind;
  public readonly ref: string;
  public readonly description: string;
  public readonly data?: unknown;

  constructor(params: {
    kind: EvidenceItemKind;
    ref: string;
    description: string;
    data?: unknown;
  }) {
    if (!params.ref || params.ref.trim().length === 0) {
      throw new Error('EvidenceItem ref cannot be empty');
    }
    if (!params.description || params.description.trim().length === 0) {
      throw new Error('EvidenceItem description cannot be empty');
    }
    this.kind = params.kind;
    this.ref = params.ref;
    this.description = params.description;
    this.data = params.data;
    Object.freeze(this);
  }

  public toJSON(): EvidenceItemJSON {
    return {
      kind: this.kind,
      ref: this.ref,
      description: this.description,
      ...(this.data !== undefined ? { data: this.data } : {})
    };
  }

  public static fromJSON(json: EvidenceItemJSON): EvidenceItem {
    return new EvidenceItem({
      kind: json.kind,
      ref: json.ref,
      description: json.description,
      data: json.data
    });
  }
}

export interface TaintNodeJSON {
  readonly id: string;
  readonly type: TaintNodeType;
  readonly value: string;
  readonly metadata: Record<string, unknown>;
}

export class TaintNode {
  public readonly id: string;
  public readonly type: TaintNodeType;
  public readonly value: string;
  public readonly metadata: Record<string, unknown>;

  constructor(params: {
    id: string;
    type: TaintNodeType;
    value: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!params.id || params.id.trim().length === 0) {
      throw new Error('TaintNode id cannot be empty');
    }
    if (!params.value || params.value.trim().length === 0) {
      throw new Error('TaintNode value cannot be empty');
    }
    this.id = params.id;
    this.type = params.type;
    this.value = params.value;
    this.metadata = params.metadata ? Object.freeze({ ...params.metadata }) : Object.freeze({});
    Object.freeze(this);
  }

  public toJSON(): TaintNodeJSON {
    return {
      id: this.id,
      type: this.type,
      value: this.value,
      metadata: this.metadata
    };
  }

  public static fromJSON(json: TaintNodeJSON): TaintNode {
    return new TaintNode({
      id: json.id,
      type: json.type,
      value: json.value,
      metadata: json.metadata
    });
  }
}

export interface TaintEdgeJSON {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly relationship: string;
  readonly confidence: number;
  readonly evidence: readonly EvidenceItemJSON[];
}

export class TaintEdge {
  public readonly id: string;
  public readonly from: string;
  public readonly to: string;
  public readonly relationship: string;
  public readonly confidence: number;
  public readonly evidence: readonly EvidenceItem[];

  constructor(params: {
    id: string;
    from: string;
    to: string;
    relationship: string;
    confidence: number;
    evidence: EvidenceItem[];
  }) {
    if (!params.id || params.id.trim().length === 0) {
      throw new Error('TaintEdge id cannot be empty');
    }
    if (!params.from || params.from.trim().length === 0) {
      throw new Error('TaintEdge from cannot be empty');
    }
    if (!params.to || params.to.trim().length === 0) {
      throw new Error('TaintEdge to cannot be empty');
    }
    if (!params.relationship || params.relationship.trim().length === 0) {
      throw new Error('TaintEdge relationship cannot be empty');
    }
    if (params.confidence < 0 || params.confidence > 1) {
      throw new Error('TaintEdge confidence must be between 0 and 1');
    }
    this.id = params.id;
    this.from = params.from;
    this.to = params.to;
    this.relationship = params.relationship;
    this.confidence = params.confidence;
    this.evidence = Object.freeze([...params.evidence]);
    Object.freeze(this);
  }

  public toJSON(): TaintEdgeJSON {
    return {
      id: this.id,
      from: this.from,
      to: this.to,
      relationship: this.relationship,
      confidence: this.confidence,
      evidence: this.evidence.map((item) => item.toJSON())
    };
  }

  public static fromJSON(json: TaintEdgeJSON): TaintEdge {
    return new TaintEdge({
      id: json.id,
      from: json.from,
      to: json.to,
      relationship: json.relationship,
      confidence: json.confidence,
      evidence: json.evidence.map((item) => EvidenceItem.fromJSON(item))
    });
  }
}

export interface EvidencePathJSON {
  readonly nodes: readonly string[];
  readonly edges: readonly string[];
  readonly overallConfidence: number;
}

export class EvidencePath {
  public readonly nodes: readonly string[];
  public readonly edges: readonly string[];
  public readonly overallConfidence: number;

  constructor(params: {
    nodes: string[];
    edges: string[];
    overallConfidence: number;
  }) {
    if (params.overallConfidence < 0 || params.overallConfidence > 1) {
      throw new Error('EvidencePath overallConfidence must be between 0 and 1');
    }
    this.nodes = Object.freeze([...params.nodes]);
    this.edges = Object.freeze([...params.edges]);
    this.overallConfidence = params.overallConfidence;
    Object.freeze(this);
  }

  public toJSON(): EvidencePathJSON {
    return {
      nodes: this.nodes,
      edges: this.edges,
      overallConfidence: this.overallConfidence
    };
  }

  public static fromJSON(json: EvidencePathJSON): EvidencePath {
    return new EvidencePath({
      nodes: [...json.nodes],
      edges: [...json.edges],
      overallConfidence: json.overallConfidence
    });
  }
}

export interface TaintGraphJSON {
  readonly id: string;
  readonly scenarioId: string;
  readonly nodes: readonly TaintNodeJSON[];
  readonly edges: readonly TaintEdgeJSON[];
  readonly paths: readonly EvidencePathJSON[];
  readonly createdAt: string;
}

export class TaintGraph {
  public readonly id: string;
  public readonly scenarioId: string;
  private readonly nodesMap: Map<string, TaintNode>;
  private readonly edgesMap: Map<string, TaintEdge>;
  private readonly pathsList: EvidencePath[];
  public readonly createdAt: Date;

  constructor(params: {
    id: string;
    scenarioId: string;
    nodes?: TaintNode[];
    edges?: TaintEdge[];
    paths?: EvidencePath[];
    createdAt?: Date;
  }) {
    if (!params.id || params.id.trim().length === 0) {
      throw new Error('TaintGraph id cannot be empty');
    }
    if (!params.scenarioId || params.scenarioId.trim().length === 0) {
      throw new Error('TaintGraph scenarioId cannot be empty');
    }
    this.id = params.id;
    this.scenarioId = params.scenarioId;
    this.createdAt = params.createdAt ?? new Date();
    this.nodesMap = new Map();
    this.edgesMap = new Map();
    this.pathsList = [];

    if (params.nodes) {
      for (const node of params.nodes) {
        this.addNode(node);
      }
    }
    if (params.edges) {
      for (const edge of params.edges) {
        this.addEdge(edge);
      }
    }
    if (params.paths) {
      for (const path of params.paths) {
        this.addPath(path);
      }
    }
  }

  public get nodes(): readonly TaintNode[] {
    return Array.from(this.nodesMap.values());
  }

  public get edges(): readonly TaintEdge[] {
    return Array.from(this.edgesMap.values());
  }

  public get paths(): readonly EvidencePath[] {
    return Object.freeze([...this.pathsList]);
  }

  public addNode(node: TaintNode): void {
    this.nodesMap.set(node.id, node);
  }

  public addEdge(edge: TaintEdge): void {
    if (!this.nodesMap.has(edge.from)) {
      throw new Error(`Source node ${edge.from} does not exist in graph`);
    }
    if (!this.nodesMap.has(edge.to)) {
      throw new Error(`Target node ${edge.to} does not exist in graph`);
    }
    this.edgesMap.set(edge.id, edge);
  }

  public addPath(path: EvidencePath): void {
    this.pathsList.push(path);
  }

  public getNode(id: string): TaintNode | undefined {
    return this.nodesMap.get(id);
  }

  public getEdge(id: string): TaintEdge | undefined {
    return this.edgesMap.get(id);
  }

  public neighbors(nodeId: string): TaintNode[] {
    if (!this.nodesMap.has(nodeId)) {
      return [];
    }
    const neighborSet = new Set<string>();
    for (const edge of this.edgesMap.values()) {
      if (edge.from === nodeId) {
        neighborSet.add(edge.to);
      } else if (edge.to === nodeId) {
        neighborSet.add(edge.from);
      }
    }
    const neighborNodes: TaintNode[] = [];
    for (const id of neighborSet) {
      const node = this.nodesMap.get(id);
      if (node) {
        neighborNodes.push(node);
      }
    }
    return neighborNodes;
  }

  public toJSON(): TaintGraphJSON {
    return {
      id: this.id,
      scenarioId: this.scenarioId,
      nodes: this.nodes.map((node) => node.toJSON()),
      edges: this.edges.map((edge) => edge.toJSON()),
      paths: this.paths.map((path) => path.toJSON()),
      createdAt: this.createdAt.toISOString()
    };
  }

  public static fromJSON(json: TaintGraphJSON): TaintGraph {
    const nodes = json.nodes.map((n) => TaintNode.fromJSON(n));
    const edges = json.edges.map((e) => TaintEdge.fromJSON(e));
    const paths = json.paths.map((p) => EvidencePath.fromJSON(p));
    return new TaintGraph({
      id: json.id,
      scenarioId: json.scenarioId,
      nodes,
      edges,
      paths,
      createdAt: new Date(json.createdAt)
    });
  }

  public serialize(): string {
    const sortedNodes = [...this.nodesMap.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((node) => node.toJSON());

    const sortedEdges = [...this.edgesMap.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((edge) => edge.toJSON());

    const sortedPaths = [...this.pathsList]
      .sort((a, b) => (a.nodes.join('|') + '::' + a.edges.join('|')).localeCompare(b.nodes.join('|') + '::' + b.edges.join('|')))
      .map((path) => path.toJSON());

    const canonicalShape = {
      id: this.id,
      scenarioId: this.scenarioId,
      nodes: sortedNodes,
      edges: sortedEdges,
      paths: sortedPaths,
      createdAt: this.createdAt.toISOString()
    };

    return JSON.stringify(canonicalShape);
  }
}
