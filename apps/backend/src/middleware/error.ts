import { Request, Response, NextFunction } from 'express';
import {
  KeplerError,
  ConfigurationError,
  ValidationError,
  NotFoundError,
  NetworkError,
  RateLimitError,
  PolicyError,
  TaintError,
  ProofError,
  AIError,
  ProtocolError,
  InternalError
} from '@kepler/shared';

function statusForError(err: KeplerError): number {
  if (err instanceof ConfigurationError) return 500;
  if (err instanceof InternalError) return 500;
  if (err instanceof ValidationError) return 400;
  if (err instanceof NotFoundError) return 404;
  if (err instanceof NetworkError) return 502;
  if (err instanceof RateLimitError) return 429;
  if (err instanceof PolicyError) return 403;
  if (err instanceof TaintError) return 422;
  if (err instanceof ProofError) return 422;
  if (err instanceof AIError) return 502;
  if (err instanceof ProtocolError) return 502;
  return 500;
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof KeplerError) {
    const status = statusForError(err);
    if (err instanceof RateLimitError) {
      const retryAfterMs = typeof err.context['retryAfterMs'] === 'number' ? err.context['retryAfterMs'] : 0;
      res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    }
    const serialized = err.toJSON();
    res.status(status).json({
      error: {
        code: serialized.code,
        message: serialized.message,
        context: serialized.context
      }
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      context: {}
    }
  });
}
