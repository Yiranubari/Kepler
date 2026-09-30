import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@kepler/shared';
import { OnchainController } from '../../src/modules/onchain/onchain.controller';
import { OnchainService } from '../../src/modules/onchain/onchain.service';
import {
  OnchainDerivationError,
  OnchainInsufficientFundsError,
  OnchainBroadcastError
} from '../../src/modules/onchain/onchain.errors';

describe('OnchainController', () => {
  let mockService: {
    derive: jest.Mock;
    utxos: jest.Mock;
    fees: jest.Mock;
    buildPsbt: jest.Mock;
    broadcast: jest.Mock;
  };
  let controller: OnchainController;
  let mockReq: Partial<Request>;
  let mockRes: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let nextFn: NextFunction;

  const validMainnetXpub = 'xpub661MyMwAqRbcEtUEgdXRTY6dJQG9fRgs7C5QomqETKMYBJVtSGpRqyHSmhWy8snovPd5oWZgQ14zUquxbxu7Z1umuXbN5VDpUL1QobD5xUY';
  const validAddress = 'bc1qnskw4kf6qevrcyjjd7cnn39uemz9j2cnhqxx8z';
  const validChangeAddress = 'bc1q9e2h3d9sgsuwjdqt4fdjev9yz5gv67vmqaawl0';
  const validTxid = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const validPsbtBase64 = 'cHNidP8BAFICAAAAAZqN2v/94P+K6HjF48kK8gH8tA0h5w+sC8qW1aFz5l01AAAAAAD/////AfScAgAAAAAAFgAUWf981u3L28oNn4FmE3jDfs1d6+YAAAAAAA==';

  beforeEach(() => {
    mockService = {
      derive: jest.fn(),
      utxos: jest.fn(),
      fees: jest.fn(),
      buildPsbt: jest.fn(),
      broadcast: jest.fn()
    };
    controller = new OnchainController(mockService as unknown as OnchainService);

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFn = jest.fn();
  });

  describe('derive', () => {
    it('returns 200 with derived addresses for valid request', async () => {
      const serviceResponse = {
        addresses: [validAddress],
        changeAddress: validChangeAddress
      };
      mockService.derive.mockResolvedValue(serviceResponse);

      mockReq = {
        body: {
          xpub: validMainnetXpub,
          network: 'mainnet',
          count: 1
        }
      };

      await controller.derive(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.derive).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(serviceResponse);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('passes ValidationError to next on invalid request body', async () => {
      mockReq = {
        body: {
          xpub: 'invalid-xpub',
          network: 'mainnet',
          count: 101
        }
      };

      await controller.derive(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.derive).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('passes service errors to next', async () => {
      const error = new OnchainDerivationError('Derivation failed', { reason: 'Derivation failed' });
      mockService.derive.mockRejectedValue(error);

      mockReq = {
        body: {
          xpub: validMainnetXpub,
          network: 'mainnet',
          count: 1
        }
      };

      await controller.derive(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(error);
    });
  });

  describe('utxos', () => {
    it('returns 200 with utxos for valid request', async () => {
      const serviceResponse = {
        utxos: [
          {
            txid: validTxid,
            vout: 0,
            valueSats: '50000',
            address: validAddress,
            confirmed: true
          }
        ],
        totalSats: '50000'
      };
      mockService.utxos.mockResolvedValue(serviceResponse);

      mockReq = {
        body: {
          addresses: [validAddress],
          network: 'mainnet'
        }
      };

      await controller.utxos(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.utxos).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(serviceResponse);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('passes ValidationError to next when addresses array is empty', async () => {
      mockReq = {
        body: {
          addresses: [],
          network: 'mainnet'
        }
      };

      await controller.utxos(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.utxos).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('passes service errors to next', async () => {
      const error = new Error('Upstream error');
      mockService.utxos.mockRejectedValue(error);

      mockReq = {
        body: {
          addresses: [validAddress],
          network: 'mainnet'
        }
      };

      await controller.utxos(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(error);
    });
  });

  describe('fees', () => {
    it('returns 200 with fee rates for valid request', async () => {
      const serviceResponse = {
        fastest: 25,
        halfHour: 20,
        hour: 15,
        economy: 10,
        minimum: 5
      };
      mockService.fees.mockResolvedValue(serviceResponse);

      mockReq = {
        body: {
          network: 'mainnet'
        }
      };

      await controller.fees(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.fees).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(serviceResponse);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('passes ValidationError to next when network is missing or invalid', async () => {
      mockReq = {
        body: {
          network: 'invalidnet'
        }
      };

      await controller.fees(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.fees).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('passes service errors to next', async () => {
      const error = new Error('Fee fetch failed');
      mockService.fees.mockRejectedValue(error);

      mockReq = {
        body: {
          network: 'mainnet'
        }
      };

      await controller.fees(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(error);
    });
  });

  describe('buildPsbt', () => {
    it('returns 200 with built psbt for valid request', async () => {
      const serviceResponse = {
        psbt: validPsbtBase64,
        feeSats: '1500',
        inputCount: 1,
        outputCount: 2
      };
      mockService.buildPsbt.mockResolvedValue(serviceResponse);

      mockReq = {
        body: {
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress: validAddress,
          amountSats: '50000',
          feeRate: 10
        }
      };

      await controller.buildPsbt(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.buildPsbt).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(serviceResponse);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('passes ValidationError to next on invalid amountSats', async () => {
      mockReq = {
        body: {
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress: validAddress,
          amountSats: '0',
          feeRate: 10
        }
      };

      await controller.buildPsbt(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.buildPsbt).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('passes OnchainInsufficientFundsError to next', async () => {
      const error = new OnchainInsufficientFundsError('Insufficient funds', {
        requiredSats: 60000,
        availableSats: 50000,
        feeSats: 1000
      });
      mockService.buildPsbt.mockRejectedValue(error);

      mockReq = {
        body: {
          xpub: validMainnetXpub,
          network: 'mainnet',
          toAddress: validAddress,
          amountSats: '50000',
          feeRate: 10
        }
      };

      await controller.buildPsbt(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(error);
    });
  });

  describe('broadcast', () => {
    it('returns 200 with txid on successful broadcast', async () => {
      const serviceResponse = {
        txid: validTxid
      };
      mockService.broadcast.mockResolvedValue(serviceResponse);

      mockReq = {
        body: {
          signedPsbt: validPsbtBase64,
          network: 'mainnet'
        }
      };

      await controller.broadcast(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.broadcast).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(serviceResponse);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('passes ValidationError to next on invalid signedPsbt format', async () => {
      mockReq = {
        body: {
          signedPsbt: 'not-base64-!',
          network: 'mainnet'
        }
      };

      await controller.broadcast(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(mockService.broadcast).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('passes OnchainBroadcastError to next', async () => {
      const error = new OnchainBroadcastError('Finalization failed', { reason: 'MISSING_SIGNATURES' });
      mockService.broadcast.mockRejectedValue(error);

      mockReq = {
        body: {
          signedPsbt: validPsbtBase64,
          network: 'mainnet'
        }
      };

      await controller.broadcast(mockReq as Request, mockRes as unknown as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(error);
    });
  });
});
