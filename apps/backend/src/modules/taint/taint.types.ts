import { z } from 'zod';
import { TaintGraph } from '@kepler/shared';
import { TaintEngineError } from './taint.errors';

export interface TaintConfigParams {
  readonly temporalWindowSeconds?: number;
  readonly minEdgeConfidence?: number;
  readonly maxPathDepth?: number;
  readonly coOccurrenceThreshold?: number;
  readonly maxNodesPerGraph?: number;
  readonly maxEdgesPerGraph?: number;
}

const taintEnvSchema = z.object({
  TAINT_TEMPORAL_WINDOW_SECONDS: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (val.trim().length === 0) return false;
        const num = Number(val);
        return Number.isInteger(num) && num > 0;
      },
      { message: 'Must be a positive integer' }
    ),
  TAINT_MIN_EDGE_CONFIDENCE: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (val.trim().length === 0) return false;
        const num = Number(val);
        return !Number.isNaN(num) && num >= 0 && num <= 1;
      },
      { message: 'Must be a number between 0 and 1' }
    ),
  TAINT_MAX_PATH_DEPTH: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (val.trim().length === 0) return false;
        const num = Number(val);
        return Number.isInteger(num) && num >= 1;
      },
      { message: 'Must be an integer greater than or equal to 1' }
    ),
  TAINT_CO_OCCURRENCE_THRESHOLD: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (val.trim().length === 0) return false;
        const num = Number(val);
        return Number.isInteger(num) && num >= 1;
      },
      { message: 'Must be an integer greater than or equal to 1' }
    ),
  TAINT_MAX_NODES_PER_GRAPH: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (val.trim().length === 0) return false;
        const num = Number(val);
        return Number.isInteger(num) && num >= 1;
      },
      { message: 'Must be an integer greater than or equal to 1' }
    ),
  TAINT_MAX_EDGES_PER_GRAPH: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (val.trim().length === 0) return false;
        const num = Number(val);
        return Number.isInteger(num) && num >= 1;
      },
      { message: 'Must be an integer greater than or equal to 1' }
    )
});

export class TaintConfig {
  public readonly temporalWindowSeconds: number;
  public readonly minEdgeConfidence: number;
  public readonly maxPathDepth: number;
  public readonly coOccurrenceThreshold: number;
  public readonly maxNodesPerGraph: number;
  public readonly maxEdgesPerGraph: number;

  constructor(
    paramsOrTemporal?: TaintConfigParams | number,
    minEdgeConfidence?: number,
    maxPathDepth?: number,
    coOccurrenceThreshold?: number,
    maxNodesPerGraph?: number,
    maxEdgesPerGraph?: number
  ) {
    let resolvedParams: TaintConfigParams = {};
    if (typeof paramsOrTemporal === 'number') {
      resolvedParams = {
        temporalWindowSeconds: paramsOrTemporal,
        minEdgeConfidence,
        maxPathDepth,
        coOccurrenceThreshold,
        maxNodesPerGraph,
        maxEdgesPerGraph
      };
    } else if (paramsOrTemporal && typeof paramsOrTemporal === 'object') {
      resolvedParams = paramsOrTemporal;
    }

    const temporalWindowSeconds = resolvedParams.temporalWindowSeconds ?? 3600;
    const resolvedMinEdgeConfidence = resolvedParams.minEdgeConfidence ?? 0.3;
    const resolvedMaxPathDepth = resolvedParams.maxPathDepth ?? 5;
    const resolvedCoOccurrenceThreshold = resolvedParams.coOccurrenceThreshold ?? 3;
    const resolvedMaxNodesPerGraph = resolvedParams.maxNodesPerGraph ?? 10000;
    const resolvedMaxEdgesPerGraph = resolvedParams.maxEdgesPerGraph ?? 50000;

    if (
      typeof temporalWindowSeconds !== 'number' ||
      Number.isNaN(temporalWindowSeconds) ||
      !Number.isInteger(temporalWindowSeconds) ||
      temporalWindowSeconds <= 0
    ) {
      throw new TaintEngineError('Invalid temporalWindowSeconds configuration', {
        field: 'temporalWindowSeconds',
        reason: 'Must be a positive integer'
      });
    }

    if (
      typeof resolvedMinEdgeConfidence !== 'number' ||
      Number.isNaN(resolvedMinEdgeConfidence) ||
      resolvedMinEdgeConfidence < 0 ||
      resolvedMinEdgeConfidence > 1
    ) {
      throw new TaintEngineError('Invalid minEdgeConfidence configuration', {
        field: 'minEdgeConfidence',
        reason: 'Must be a number between 0 and 1'
      });
    }

    if (
      typeof resolvedMaxPathDepth !== 'number' ||
      Number.isNaN(resolvedMaxPathDepth) ||
      !Number.isInteger(resolvedMaxPathDepth) ||
      resolvedMaxPathDepth < 1
    ) {
      throw new TaintEngineError('Invalid maxPathDepth configuration', {
        field: 'maxPathDepth',
        reason: 'Must be an integer greater than or equal to 1'
      });
    }

    if (
      typeof resolvedCoOccurrenceThreshold !== 'number' ||
      Number.isNaN(resolvedCoOccurrenceThreshold) ||
      !Number.isInteger(resolvedCoOccurrenceThreshold) ||
      resolvedCoOccurrenceThreshold < 1
    ) {
      throw new TaintEngineError('Invalid coOccurrenceThreshold configuration', {
        field: 'coOccurrenceThreshold',
        reason: 'Must be an integer greater than or equal to 1'
      });
    }

    if (
      typeof resolvedMaxNodesPerGraph !== 'number' ||
      Number.isNaN(resolvedMaxNodesPerGraph) ||
      !Number.isInteger(resolvedMaxNodesPerGraph) ||
      resolvedMaxNodesPerGraph < 1
    ) {
      throw new TaintEngineError('Invalid maxNodesPerGraph configuration', {
        field: 'maxNodesPerGraph',
        reason: 'Must be an integer greater than or equal to 1'
      });
    }

    if (
      typeof resolvedMaxEdgesPerGraph !== 'number' ||
      Number.isNaN(resolvedMaxEdgesPerGraph) ||
      !Number.isInteger(resolvedMaxEdgesPerGraph) ||
      resolvedMaxEdgesPerGraph < 1
    ) {
      throw new TaintEngineError('Invalid maxEdgesPerGraph configuration', {
        field: 'maxEdgesPerGraph',
        reason: 'Must be an integer greater than or equal to 1'
      });
    }

    this.temporalWindowSeconds = temporalWindowSeconds;
    this.minEdgeConfidence = resolvedMinEdgeConfidence;
    this.maxPathDepth = resolvedMaxPathDepth;
    this.coOccurrenceThreshold = resolvedCoOccurrenceThreshold;
    this.maxNodesPerGraph = resolvedMaxNodesPerGraph;
    this.maxEdgesPerGraph = resolvedMaxEdgesPerGraph;

    Object.freeze(this);
  }

  public static fromEnv(env: Record<string, string | undefined> = process.env): TaintConfig {
    const result = taintEnvSchema.safeParse(env);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue && issue.path.length > 0 ? String(issue.path[0]) : 'unknown';
      const reason = issue ? issue.message : 'Invalid environment variable value';
      throw new TaintEngineError(`Invalid ${field} configuration`, {
        field,
        reason
      });
    }

    const configParams: {
      temporalWindowSeconds?: number;
      minEdgeConfidence?: number;
      maxPathDepth?: number;
      coOccurrenceThreshold?: number;
      maxNodesPerGraph?: number;
      maxEdgesPerGraph?: number;
    } = {};

    if (result.data.TAINT_TEMPORAL_WINDOW_SECONDS !== undefined) {
      configParams.temporalWindowSeconds = Number(result.data.TAINT_TEMPORAL_WINDOW_SECONDS);
    }
    if (result.data.TAINT_MIN_EDGE_CONFIDENCE !== undefined) {
      configParams.minEdgeConfidence = Number(result.data.TAINT_MIN_EDGE_CONFIDENCE);
    }
    if (result.data.TAINT_MAX_PATH_DEPTH !== undefined) {
      configParams.maxPathDepth = Number(result.data.TAINT_MAX_PATH_DEPTH);
    }
    if (result.data.TAINT_CO_OCCURRENCE_THRESHOLD !== undefined) {
      configParams.coOccurrenceThreshold = Number(result.data.TAINT_CO_OCCURRENCE_THRESHOLD);
    }
    if (result.data.TAINT_MAX_NODES_PER_GRAPH !== undefined) {
      configParams.maxNodesPerGraph = Number(result.data.TAINT_MAX_NODES_PER_GRAPH);
    }
    if (result.data.TAINT_MAX_EDGES_PER_GRAPH !== undefined) {
      configParams.maxEdgesPerGraph = Number(result.data.TAINT_MAX_EDGES_PER_GRAPH);
    }

    return new TaintConfig(configParams);
  }
}

export interface BitcoinIngestData {
  transactions: Array<{
    txid: string;
    blockHeight: number | null;
    blockTime: number | null;
    inputs: Array<{ txid: string; vout: number; address: string | null }>;
    outputs: Array<{ address: string | null; value: bigint }>;
  }>;
  addresses: Array<{ address: string }>;
}

export interface LightningIngestData {
  invoices: Array<{
    bolt11: string;
    paymentHash: string;
    preimage: string | null;
    amountMsat: bigint;
    createdAt: number;
    expiresAt: number;
    payeePubkey: string;
  }>;
}

export interface NostrIngestData {
  events: Array<{
    id: string;
    pubkey: string;
    kind: number;
    tags: string[][];
    content: string;
    createdAt: number;
  }>;
}

export interface CashuIngestData {
  mints: Array<{ url: string; name: string }>;
  tokens: Array<{
    mint: string;
    unit: string;
    proofs: Array<{ id: string; amount: bigint; secret: string; C: string }>;
    memo: string | null;
  }>;
  quotes: Array<{
    quote: string;
    type: 'mint' | 'melt';
    amount: bigint;
    request: string;
    state: string;
  }>;
}

export interface TaintAnalysisResult {
  graph: TaintGraph;
  scenarioId: string;
  analyzedAt: string;
  ruleCount: number;
  nodeCount: number;
  edgeCount: number;
  pathCount: number;
}

export interface TaintIngestPayload {
  bitcoin?: BitcoinIngestData;
  lightning?: LightningIngestData;
  nostr?: NostrIngestData;
  cashu?: CashuIngestData;
}

export interface TaintRepository {
  saveGraph(scenarioId: string, result: TaintAnalysisResult): Promise<unknown>;
  getGraph(scenarioId: string): Promise<TaintGraph | null>;
  deleteGraph?(scenarioId: string): Promise<void>;
  getLatestGraphByScenarioId?(scenarioId: string): Promise<TaintGraph | null>;
}


