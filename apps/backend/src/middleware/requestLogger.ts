import crypto from 'node:crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { KeplerLogger } from '../services/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveRequestId(headerValue?: string | string[]): string {
  if (typeof headerValue === 'string' && UUID_REGEX.test(headerValue)) {
    return headerValue;
  }
  return crypto.randomUUID();
}

export function requestLogger(logger: KeplerLogger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = resolveRequestId(req.headers['x-request-id']);

    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const context: Record<string, unknown> = {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs,
        requestId,
        ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
        userAgent: req.get('user-agent') ?? 'unknown'
      };

      if (res.statusCode >= 500) {
        const capturedError = res.locals.error;
        logger.error('request_completed', capturedError, context);
      } else if (res.statusCode >= 400) {
        logger.warn('request_completed', context);
      } else {
        logger.info('request_completed', context);
      }
    });

    next();
  };
}
