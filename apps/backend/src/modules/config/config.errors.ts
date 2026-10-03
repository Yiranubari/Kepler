import { NotFoundError, ValidationError } from '@kepler/shared';

export interface ConfigNotFoundErrorContext {
  readonly id: string;
  readonly [key: string]: unknown;
}

export class ConfigNotFoundError extends NotFoundError {
  public override readonly code: string;

  public constructor(
    message: string,
    context: ConfigNotFoundErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'CONFIG_NOT_FOUND';
  }
}

export interface ConfigNetworkInvalidErrorContext {
  readonly value: string;
  readonly allowed: readonly string[];
  readonly [key: string]: unknown;
}

export class ConfigNetworkInvalidError extends ValidationError {
  public override readonly code: string;

  public constructor(
    message: string,
    context: ConfigNetworkInvalidErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'CONFIG_NETWORK_INVALID';
  }
}
