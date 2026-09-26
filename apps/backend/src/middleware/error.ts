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
import { getLogger } from '../services/logger';
import { LOG_SERVICE_NAMES } from '../config/constants';

interface BodyParserError extends Error {
  type: string;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return err instanceof Error && typeof (err as { type?: unknown }).type === 'string';
}

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

const httpLogger = getLogger(LOG_SERVICE_NAMES.http);

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let processedError: unknown = err;

  if (err instanceof SyntaxError && isBodyParserError(err) && err.type === 'entity.parse.failed') {
    processedError = new ValidationError('Request body is not valid JSON', {
      field: 'body',
      reason: 'INVALID_JSON'
    });
  } else if (isBodyParserError(err)) {
    if (err.type === 'entity.too.large') {
      processedError = new ValidationError('Request entity too large', {
        field: 'body',
        reason: 'ENTITY_TOO_LARGE'
      });
    } else if (err.type === 'encoding.unsupported') {
      processedError = new ValidationError('Unsupported content encoding', {
        field: 'body',
        reason: 'ENCODING_UNSUPPORTED'
      });
    } else if (err.type === 'charset.unsupported') {
      processedError = new ValidationError('Unsupported charset', {
        field: 'body',
        reason: 'CHARSET_UNSUPPORTED'
      });
    }
  }

  res.locals.error = processedError;

  if (processedError instanceof KeplerError) {
    const status = statusForError(processedError);
    if (processedError instanceof RateLimitError) {
      const retryAfterMs = typeof processedError.context['retryAfterMs'] === 'number' ? processedError.context['retryAfterMs'] : 0;
      res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    }
    const serialized = processedError.toJSON();
    httpLogger.error(processedError.message, processedError, serialized.context);
    res.status(status).json({
      error: {
        code: serialized.code,
        message: serialized.message,
        context: serialized.context
      }
    });
    return;
  }

  const message = processedError instanceof Error ? processedError.message : 'An unexpected error occurred';
  httpLogger.error(message, processedError);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      context: {}
    }
  });
}

