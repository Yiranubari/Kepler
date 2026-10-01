import { Router } from 'express';
import { OrchestratorController } from './orchestrator.controller';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';

export function createOrchestratorRoutes(
  controller: OrchestratorController,
  limiter: RateLimiter
): Router {
  const router = Router();

  router.post('/orchestrate', rateLimit(limiter, 'send'), (req, res, next) => {
    controller.orchestrate(req, res, next).catch(next);
  });

  return router;
}
