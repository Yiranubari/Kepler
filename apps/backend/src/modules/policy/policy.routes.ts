import { Router } from 'express';
import { PolicyController } from './policy.controller';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';

export function createPolicyRoutes(
  controller: PolicyController,
  limiter: RateLimiter
): Router {
  const router = Router();

  router.get('/', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.get(req, res, next);
  });

  router.put('/', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.update(req, res, next);
  });

  router.post('/check', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.check(req, res, next);
  });

  return router;
}
