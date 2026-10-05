import { Router } from 'express';
import { RateLimiter } from '../../services/rateLimiter';
import { rateLimit } from '../../middleware/rateLimit';
import { ProtocolsController } from './protocols.controller';

export function createProtocolsRoutes(controller: ProtocolsController, limiter: RateLimiter): Router {
  const router = Router();

  router.post('/bitcoin/transaction', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.fetchBitcoinTransaction(req, res, next).catch(next);
  });

  router.post('/bitcoin/address', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.fetchBitcoinAddress(req, res, next).catch(next);
  });

  router.post('/bitcoin/tip', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.fetchBitcoinTip(req, res, next).catch(next);
  });

  router.post('/lightning/decode', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.decodeLightningInvoice(req, res, next).catch(next);
  });

  router.post('/lightning/lookup', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.lookupLightningInvoice(req, res, next).catch(next);
  });

  router.post('/lightning/transactions', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.listLightningTransactions(req, res, next).catch(next);
  });

  router.post('/lightning/create', rateLimit(limiter, 'propose'), (req, res, next) => {
    controller.createLightningInvoice(req, res, next).catch(next);
  });

  router.post('/nostr/event', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.fetchNostrEvent(req, res, next).catch(next);
  });

  router.post('/nostr/author', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.fetchNostrEventsByAuthor(req, res, next).catch(next);
  });

  router.post('/cashu/mint', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.fetchCashuMintInfo(req, res, next).catch(next);
  });

  router.post('/balance', rateLimit(limiter, 'read'), (req, res, next) => {
    controller.fetchBalance(req, res, next).catch(next);
  });

  return router;
}
