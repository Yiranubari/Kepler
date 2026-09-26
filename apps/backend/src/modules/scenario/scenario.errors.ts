import { KeplerError, NotFoundError } from '@kepler/shared';

export class ScenarioNotFoundError extends NotFoundError {
  public override readonly code: string;

  constructor(
    message: string,
    context: { id: string } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'SCENARIO_NOT_FOUND';
  }
}

export class ScenarioStateError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: {
      id: string;
      currentStatus: string;
      attemptedTransition: string;
    } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'SCENARIO_STATE_ERROR';
  }
}
