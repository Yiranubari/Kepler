export interface KeplerErrorJSON {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  readonly context: Record<string, unknown>;
}

export abstract class KeplerError extends Error {
  public abstract readonly code: string;
  public readonly context: Record<string, unknown>;
  public override readonly cause?: Error;

  constructor(message: string, context: Record<string, unknown> = {}, cause?: Error) {
    super(message, cause ? { cause } : undefined);
    this.context = context;
    this.cause = cause;
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): KeplerErrorJSON {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context
    };
  }
}
