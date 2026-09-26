import {
  TaintGraph,
  EvidencePath,
  KeplerLogger,
  NotFoundError
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
}
