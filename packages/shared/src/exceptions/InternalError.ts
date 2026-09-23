import { KeplerError } from './KeplerError';

export class InternalError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: Record<string, unknown> = {}, cause?: Error) {
    super(message, context, cause);
    this.code = 'INTERNAL_ERROR';
  }
}
