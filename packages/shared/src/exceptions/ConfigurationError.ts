import { KeplerError } from './KeplerError';

export class ConfigurationError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: Record<string, unknown> = {}, cause?: Error) {
    super(message, context, cause);
    this.code = 'CONFIGURATION_ERROR';
  }
}
