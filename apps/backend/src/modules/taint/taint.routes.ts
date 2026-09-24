import { Router } from 'express';
import { TaintController } from './taint.controller';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';

export function createTaintRoutes(
  controller: TaintController,
  limiter: RateLimiter
): Router {
  const router = Router();

  router.post('/analyze', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.analyze(req, res, next);
  });

  router.get(
    '/graph/:id',
    rateLimit(limiter, 'read'),
    (req, res, next) => {
      controller.getGraph(req, res, next);
    }
  );

  router.post('/paths', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.findPaths(req, res, next);
  });

  return router;
}
