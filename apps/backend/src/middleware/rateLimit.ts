import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RateLimiter } from '../services/rateLimiter';
import { RateLimitScope, RATE_LIMIT_WINDOWS_MS } from '../config/constants';
import { RateLimitError } from '@kepler/shared';

function defaultKeyExtractor(req: Request): string {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && typeof apiKey === 'string' && apiKey.length > 0) {
    return `apiKey:${apiKey}`;
  }
  return req.ip ?? 'unknown';
}

export function rateLimit(
  limiter: RateLimiter,
  scope: RateLimitScope,
  keyExtractor?: (req: Request) => string
): RequestHandler {
  const getKey = keyExtractor ?? defaultKeyExtractor;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = getKey(req);
    const decision = limiter.check(scope, key);

    res.setHeader('RateLimit-Limit', String(decision.limit));
    res.setHeader('RateLimit-Remaining', String(decision.remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));

    if (!decision.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(decision.retryAfterMs / 1000)));
      throw new RateLimitError('Rate limit exceeded', {
        scope,
        limit: decision.limit,
        windowMs: RATE_LIMIT_WINDOWS_MS[scope],
        retryAfterMs: decision.retryAfterMs
      });
    }

    next();
  };
}
