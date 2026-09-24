import { KeplerError } from '@kepler/shared';

export class TaintEngineError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: Record<string, unknown> = {}, cause?: Error) {
    super(message, context, cause);
    this.code = 'TAINT_ENGINE_ERROR';
  }
}

export class TaintIngestError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: { protocol: string; reason: string } & Record<string, unknown>, cause?: Error) {
    super(message, context, cause);
    this.code = 'TAINT_INGEST_ERROR';
  }
}

export class TaintRuleError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: { rule: string; reason: string } & Record<string, unknown>, cause?: Error) {
    super(message, context, cause);
    this.code = 'TAINT_RULE_ERROR';
  }
}

export class TaintScoringError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: { edgeId: string; reason: string } & Record<string, unknown>, cause?: Error) {
    super(message, context, cause);
    this.code = 'TAINT_SCORING_ERROR';
  }
}

export class TaintPathError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: { from: string; to: string; reason: string } & Record<string, unknown>, cause?: Error) {
    super(message, context, cause);
    this.code = 'TAINT_PATH_ERROR';
  }
}

export class TaintPersistenceError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: { scenarioId: string; operation: string; reason: string } & Record<string, unknown>, cause?: Error) {
    super(message, context, cause);
    this.code = 'TAINT_PERSISTENCE_ERROR';
  }
}
