import { Router } from 'express';
import { AIController } from './ai.controller';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';

export function createAIRoutes(
  controller: AIController,
  limiter: RateLimiter
): Router {
  const router = Router();

  router.post('/explain', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.explain(req, res, next);
  });

  router.post('/summarize', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.summarize(req, res, next);
  });

  router.post('/suggest', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.suggest(req, res, next);
  });

  return router;
}
