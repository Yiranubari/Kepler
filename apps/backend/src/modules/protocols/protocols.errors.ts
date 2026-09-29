import { KeplerError } from '@kepler/shared';

export class ProtocolOperationError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: { protocol: string; operation: string; reason: string } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'PROTOCOL_OPERATION_ERROR';
  }
}

export class ProtocolUnsupportedError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: { protocol: string; operation: string } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'PROTOCOL_UNSUPPORTED';
  }
}
