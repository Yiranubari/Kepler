import { KeplerError } from './KeplerError';

export class ProofError extends KeplerError {
  public readonly code: string;

  constructor(message: string, context: Record<string, unknown> = {}, cause?: Error) {
    super(message, context, cause);
    this.code = 'PROOF_ERROR';
  }
}
