import { Router } from 'express';
import { ConfigController } from './config.controller';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';

export function createConfigRoutes(
  controller: ConfigController,
  limiter: RateLimiter
): Router {
  const router = Router();

  router.get('/', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.get(req, res, next);
  });

  router.put('/network', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.setNetwork(req, res, next);
  });

  return router;
}
