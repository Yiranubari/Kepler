import { KeplerError } from './KeplerError';

export abstract class ProtocolError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: Record<string, unknown> = {}, cause?: Error) {
    if (new.target === ProtocolError) {
      throw new Error('ProtocolError cannot be instantiated directly');
    }
    super(message, context, cause);
    this.code = 'PROTOCOL_ERROR';
  }
}
