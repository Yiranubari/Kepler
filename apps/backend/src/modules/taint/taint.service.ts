import { TaintGraph, EvidencePath, KeplerLogger } from '@kepler/shared';
import {
  TaintConfig,
  TaintIngestPayload,
  TaintAnalysisResult,
  TaintRepository
} from './taint.types';
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

    try {
      await this.repository.saveGraph(trimmedScenarioId, result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
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
      if (typeof this.repository.getGraph === 'function') {
        const graph = await this.repository.getGraph(trimmed);
        return graph ?? null;
      }
      if (
        typeof (
          this.repository as {
            getLatestGraphByScenarioId?: (id: string) => Promise<TaintGraph | null>;
          }
        ).getLatestGraphByScenarioId === 'function'
      ) {
        const graph = await (
          this.repository as {
            getLatestGraphByScenarioId: (id: string) => Promise<TaintGraph | null>;
          }
        ).getLatestGraphByScenarioId(trimmed);
        return graph ?? null;
      }
      return null;
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
    const graph = await this.getGraph(trimmedScenarioId);
    if (!graph) {
      throw new TaintEngineError('Graph not found for scenario', {
        scenarioId: trimmedScenarioId,
        reason: 'GRAPH_NOT_FOUND'
      });
    }

    const engine = new TaintEngine(graph, this.config, this.scorer);
    const resolvedMaxPaths = maxPaths !== undefined ? maxPaths : 5;
    return engine.findPaths(fromNodeId, toNodeId, resolvedMaxPaths);
  }
}
