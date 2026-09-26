import { Router } from 'express';
import { ProofController } from './proof.controller';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';

export function createProofRoutes(
  controller: ProofController,
  limiter: RateLimiter
): Router {
  const router = Router();

  router.post('/build', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.build(req, res, next);
  });

  router.post('/verify', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.verify(req, res, next);
  });

  router.get(
    '/scenario/:scenarioId',
    rateLimit(limiter, 'read'),
    (req, res, next) => {
      controller.listByScenario(req, res, next);
    }
  );

  router.get(
    '/:bundleHash',
    rateLimit(limiter, 'read'),
    (req, res, next) => {
      controller.getByHash(req, res, next);
    }
  );

  return router;
}
