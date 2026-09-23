import express, { Express } from 'express';
import { env } from './config/env';
import { RATE_LIMIT_WINDOWS_MS } from './config/constants';
import { RateLimiter } from './services/rateLimiter';
import { KeplerLogger } from './services/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorMiddleware } from './middleware/error';

const defaultLimiterInstance = new RateLimiter({
  read: { limit: env.RATE_LIMIT_READ_PER_MINUTE, windowMs: RATE_LIMIT_WINDOWS_MS.read },
  propose: { limit: env.RATE_LIMIT_PROPOSE_PER_MINUTE, windowMs: RATE_LIMIT_WINDOWS_MS.propose },
  send: { limit: env.RATE_LIMIT_SEND_PER_HOUR, windowMs: RATE_LIMIT_WINDOWS_MS.send },
  publish: { limit: env.RATE_LIMIT_PUBLISH_PER_HOUR, windowMs: RATE_LIMIT_WINDOWS_MS.publish }
});

export function getLimiter(): RateLimiter {
  return defaultLimiterInstance;
}

export function createApp(limiter: RateLimiter, logger: KeplerLogger): Express {
  const app = express();

  app.use(requestLogger(logger));
  app.use(express.json());
  app.use(errorMiddleware);

  return app;
}
