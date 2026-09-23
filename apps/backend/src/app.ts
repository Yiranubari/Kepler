import express from 'express';
import { env } from './config/env';
import { RATE_LIMIT_WINDOWS_MS } from './config/constants';
import { RateLimiter } from './services/rateLimiter';
import { errorMiddleware } from './middleware/error';

const app = express();

app.use(express.json());

const limiterInstance = new RateLimiter({
  read: { limit: env.RATE_LIMIT_READ_PER_MINUTE, windowMs: RATE_LIMIT_WINDOWS_MS.read },
  propose: { limit: env.RATE_LIMIT_PROPOSE_PER_MINUTE, windowMs: RATE_LIMIT_WINDOWS_MS.propose },
  send: { limit: env.RATE_LIMIT_SEND_PER_HOUR, windowMs: RATE_LIMIT_WINDOWS_MS.send },
  publish: { limit: env.RATE_LIMIT_PUBLISH_PER_HOUR, windowMs: RATE_LIMIT_WINDOWS_MS.publish }
});

export function getLimiter(): RateLimiter {
  return limiterInstance;
}

app.use(errorMiddleware);

export { app };
