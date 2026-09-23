import { KeplerError } from './KeplerError';

export class ValidationError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: Record<string, unknown> = {}, cause?: Error) {
    super(message, context, cause);
    this.code = 'VALIDATION_ERROR';
  }
}
