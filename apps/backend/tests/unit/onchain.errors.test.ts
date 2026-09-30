import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { KeplerError } from '@kepler/shared';
import { errorMiddleware } from '../../src/middleware/error';
import {
  OnchainDerivationError,
  OnchainPsbtBuildError,
  OnchainInsufficientFundsError,
  OnchainBroadcastError,
  OnchainUnsupportedNetworkError
} from '../../src/modules/onchain/onchain.errors';

describe('Onchain Errors', () => {
  describe('OnchainDerivationError', () => {
    it('initializes with correct code and context', () => {
      const err = new OnchainDerivationError('Failed to derive address', {
        reason: 'Invalid xpub key'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ONCHAIN_DERIVATION_ERROR');
      expect(err.message).toBe('Failed to derive address');
      expect(err.context).toEqual({ reason: 'Invalid xpub key' });
      expect(err.name).toBe('OnchainDerivationError');
    });

    it('attaches optional cause and extra context', () => {
      const cause = new Error('Low level derivation failure');
      const err = new OnchainDerivationError(
        'Failed to derive address',
        { reason: 'Underlying failure', index: 5 },
        cause
      );
      expect(err.cause).toBe(cause);
      expect(err.context).toEqual({ reason: 'Underlying failure', index: 5 });
    });

    it('serializes to JSON correctly', () => {
      const err = new OnchainDerivationError('Failed to derive address', {
        reason: 'Invalid checksum'
      });
      expect(err.toJSON()).toEqual({
        name: 'OnchainDerivationError',
        code: 'ONCHAIN_DERIVATION_ERROR',
        message: 'Failed to derive address',
        context: { reason: 'Invalid checksum' }
      });
    });
  });

  describe('OnchainPsbtBuildError', () => {
    it('initializes with correct code and context', () => {
      const err = new OnchainPsbtBuildError('PSBT construction failed', {
        reason: 'No inputs found',
        step: 'input_selection'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ONCHAIN_PSBT_BUILD_ERROR');
      expect(err.message).toBe('PSBT construction failed');
      expect(err.context).toEqual({
        reason: 'No inputs found',
        step: 'input_selection'
      });
      expect(err.name).toBe('OnchainPsbtBuildError');
    });

    it('attaches optional cause', () => {
      const cause = new Error('Builder exception');
      const err = new OnchainPsbtBuildError(
        'PSBT construction failed',
        { reason: 'Builder crashed', step: 'add_output' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new OnchainPsbtBuildError('PSBT construction failed', {
        reason: 'Invalid fee rate',
        step: 'fee_calculation'
      });
      expect(err.toJSON()).toEqual({
        name: 'OnchainPsbtBuildError',
        code: 'ONCHAIN_PSBT_BUILD_ERROR',
        message: 'PSBT construction failed',
        context: {
          reason: 'Invalid fee rate',
          step: 'fee_calculation'
        }
      });
    });
  });

  describe('OnchainInsufficientFundsError', () => {
    it('initializes with correct code and context', () => {
      const err = new OnchainInsufficientFundsError('Insufficient balance', {
        availableSats: 5000,
        requiredSats: 10000,
        feeSats: 500
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ONCHAIN_INSUFFICIENT_FUNDS');
      expect(err.message).toBe('Insufficient balance');
      expect(err.context).toEqual({
        availableSats: 5000,
        requiredSats: 10000,
        feeSats: 500
      });
      expect(err.name).toBe('OnchainInsufficientFundsError');
    });

    it('attaches optional cause', () => {
      const cause = new Error('UTXO exhaustion');
      const err = new OnchainInsufficientFundsError(
        'Insufficient balance',
        { availableSats: 0, requiredSats: 1000, feeSats: 200 },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new OnchainInsufficientFundsError('Insufficient balance', {
        availableSats: 2000,
        requiredSats: 3000,
        feeSats: 150
      });
      expect(err.toJSON()).toEqual({
        name: 'OnchainInsufficientFundsError',
        code: 'ONCHAIN_INSUFFICIENT_FUNDS',
        message: 'Insufficient balance',
        context: {
          availableSats: 2000,
          requiredSats: 3000,
          feeSats: 150
        }
      });
    });
  });

  describe('OnchainBroadcastError', () => {
    it('initializes with correct code and context', () => {
      const err = new OnchainBroadcastError('Transaction broadcast failed', {
        reason: 'mempool min fee not met'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ONCHAIN_BROADCAST_ERROR');
      expect(err.message).toBe('Transaction broadcast failed');
      expect(err.context).toEqual({ reason: 'mempool min fee not met' });
      expect(err.name).toBe('OnchainBroadcastError');
    });

    it('attaches optional cause', () => {
      const cause = new Error('HTTP 500 from mempool');
      const err = new OnchainBroadcastError(
        'Transaction broadcast failed',
        { reason: 'mempool error' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new OnchainBroadcastError('Transaction broadcast failed', {
        reason: 'txn-mempool-conflict'
      });
      expect(err.toJSON()).toEqual({
        name: 'OnchainBroadcastError',
        code: 'ONCHAIN_BROADCAST_ERROR',
        message: 'Transaction broadcast failed',
        context: { reason: 'txn-mempool-conflict' }
      });
    });
  });

  describe('OnchainUnsupportedNetworkError', () => {
    it('initializes with correct code and context', () => {
      const err = new OnchainUnsupportedNetworkError('Unsupported bitcoin network', {
        network: 'regtest'
      });
      expect(err).toBeInstanceOf(KeplerError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('ONCHAIN_UNSUPPORTED_NETWORK');
      expect(err.message).toBe('Unsupported bitcoin network');
      expect(err.context).toEqual({ network: 'regtest' });
      expect(err.name).toBe('OnchainUnsupportedNetworkError');
    });

    it('attaches optional cause', () => {
      const cause = new Error('Network config error');
      const err = new OnchainUnsupportedNetworkError(
        'Unsupported bitcoin network',
        { network: 'invalid-net' },
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it('serializes to JSON correctly', () => {
      const err = new OnchainUnsupportedNetworkError('Unsupported bitcoin network', {
        network: 'unknown-net'
      });
      expect(err.toJSON()).toEqual({
        name: 'OnchainUnsupportedNetworkError',
        code: 'ONCHAIN_UNSUPPORTED_NETWORK',
        message: 'Unsupported bitcoin network',
        context: { network: 'unknown-net' }
      });
    });
  });

  describe('HTTP status mapping in errorMiddleware', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      app.get('/test-derivation', (_req: Request, _res: Response, next: NextFunction) => {
        next(new OnchainDerivationError('Derivation failed', { reason: 'bad xpub' }));
      });

      app.get('/test-build', (_req: Request, _res: Response, next: NextFunction) => {
        next(new OnchainPsbtBuildError('PSBT build failed', { reason: 'no inputs', step: 'select_utxos' }));
      });

      app.get('/test-insufficient-funds', (_req: Request, _res: Response, next: NextFunction) => {
        next(new OnchainInsufficientFundsError('Insufficient funds', {
          availableSats: 1000,
          requiredSats: 2000,
          feeSats: 100
        }));
      });

      app.get('/test-broadcast', (_req: Request, _res: Response, next: NextFunction) => {
        next(new OnchainBroadcastError('Broadcast failed', { reason: 'mempool rejected' }));
      });

      app.get('/test-unsupported-network', (_req: Request, _res: Response, next: NextFunction) => {
        next(new OnchainUnsupportedNetworkError('Unsupported network', { network: 'testnet4' }));
      });

      app.use(errorMiddleware);
    });

    it('maps OnchainDerivationError to HTTP 400', async () => {
      const response = await request(app).get('/test-derivation');
      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: 'ONCHAIN_DERIVATION_ERROR',
        message: 'Derivation failed',
        context: { reason: 'bad xpub' }
      });
    });

    it('maps OnchainPsbtBuildError to HTTP 400', async () => {
      const response = await request(app).get('/test-build');
      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: 'ONCHAIN_PSBT_BUILD_ERROR',
        message: 'PSBT build failed',
        context: { reason: 'no inputs', step: 'select_utxos' }
      });
    });

    it('maps OnchainInsufficientFundsError to HTTP 400', async () => {
      const response = await request(app).get('/test-insufficient-funds');
      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: 'ONCHAIN_INSUFFICIENT_FUNDS',
        message: 'Insufficient funds',
        context: {
          availableSats: 1000,
          requiredSats: 2000,
          feeSats: 100
        }
      });
    });

    it('maps OnchainBroadcastError to HTTP 502', async () => {
      const response = await request(app).get('/test-broadcast');
      expect(response.status).toBe(502);
      expect(response.body.error).toEqual({
        code: 'ONCHAIN_BROADCAST_ERROR',
        message: 'Broadcast failed',
        context: { reason: 'mempool rejected' }
      });
    });

    it('maps OnchainUnsupportedNetworkError to HTTP 400', async () => {
      const response = await request(app).get('/test-unsupported-network');
      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: 'ONCHAIN_UNSUPPORTED_NETWORK',
        message: 'Unsupported network',
        context: { network: 'testnet4' }
      });
    });
  });
});
