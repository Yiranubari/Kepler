import { Router } from 'express';
import { ScenarioController } from './scenario.controller';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';

export function createScenarioRoutes(
  controller: ScenarioController,
  limiter: RateLimiter
): Router {
  const router = Router();

  router.post('/', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.create(req, res, next);
  });

  router.get('/', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.list(req, res, next);
  });

  router.get('/:id', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.getById(req, res, next);
  });

  router.patch('/:id/status', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.updateStatus(req, res, next);
  });

  router.delete('/:id', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.delete(req, res, next);
  });

  return router;
}
