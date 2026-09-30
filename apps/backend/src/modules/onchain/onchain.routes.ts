import { Router } from 'express';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';
import { OnchainController } from './onchain.controller';

export function createOnchainRoutes(controller: OnchainController, limiter: RateLimiter): Router {
  const router = Router();

  router.post('/derive', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.derive(req, res, next).catch(next);
  });

  router.post('/utxos', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.utxos(req, res, next).catch(next);
  });

  router.post('/fees', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.fees(req, res, next).catch(next);
  });

  router.post('/psbt/build', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.buildPsbt(req, res, next).catch(next);
  });

  router.post('/psbt/broadcast', rateLimit(limiter, 'send'), (req, res, next) => {
    controller.broadcast(req, res, next).catch(next);
  });

  return router;
}
