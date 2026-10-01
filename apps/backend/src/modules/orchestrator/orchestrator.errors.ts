import { KeplerError, NotFoundError } from '@kepler/shared';

export interface OrchestratorNotFoundErrorContext {
  readonly resource: string;
  readonly id: string;
  readonly [key: string]: unknown;
}

export class OrchestratorNotFoundError extends NotFoundError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OrchestratorNotFoundErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ORCHESTRATOR_NOT_FOUND';
  }
}

export interface OrchestratorStateErrorContext {
  readonly scenarioId: string;
  readonly currentStatus: string;
  readonly expectedStatus: string;
  readonly [key: string]: unknown;
}

export class OrchestratorStateError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OrchestratorStateErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ORCHESTRATOR_STATE_ERROR';
  }
}

export interface OrchestratorRouteErrorContext {
  readonly scenarioId: string;
  readonly reason: string;
  readonly [key: string]: unknown;
}

export class OrchestratorRouteError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OrchestratorRouteErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ORCHESTRATOR_ROUTE_ERROR';
  }
}

export interface OrchestratorExecutionErrorContext {
  readonly scenarioId: string;
  readonly protocol: string;
  readonly reason: string;
  readonly [key: string]: unknown;
}

export class OrchestratorExecutionError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OrchestratorExecutionErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ORCHESTRATOR_EXECUTION_ERROR';
  }
}

export interface OrchestratorNoRouteErrorContext {
  readonly scenarioId: string;
  readonly candidateCount: number;
  readonly [key: string]: unknown;
}

export class OrchestratorNoRouteError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OrchestratorNoRouteErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ORCHESTRATOR_NO_ROUTE';
  }
}
