import { KeplerError } from '@kepler/shared';

export interface AIProviderErrorContext {
  readonly provider: string;
  readonly status?: number;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export class AIProviderError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: AIProviderErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'AI_PROVIDER_ERROR';
  }
}

export interface AITimeoutErrorContext {
  readonly provider: string;
  readonly timeoutMs: number;
  readonly [key: string]: unknown;
}

export class AITimeoutError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: AITimeoutErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'AI_TIMEOUT_ERROR';
  }
}

export interface AINoProviderErrorContext {
  readonly attempted: readonly string[];
  readonly [key: string]: unknown;
}

export class AINoProviderError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: AINoProviderErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'AI_NO_PROVIDER';
  }
}

export interface AIInputTooLargeErrorContext {
  readonly size: number;
  readonly max: number;
  readonly [key: string]: unknown;
}

export class AIInputTooLargeError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: AIInputTooLargeErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'AI_INPUT_TOO_LARGE';
  }
}

export interface AINotFoundErrorContext {
  readonly resource: string;
  readonly id: string;
  readonly [key: string]: unknown;
}

export class AINotFoundError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: AINotFoundErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'AI_NOT_FOUND';
  }
}
