import { Request, Response, NextFunction } from 'express';
import {
  Claim,
  ClaimType,
  ClaimVerificationResult,
  EvidenceBundle,
  NotFoundError,
  RawDataRef,
  ValidationError,
  VerificationStep
} from '@kepler/shared';
import { ProofController } from '../../src/modules/proof/proof.controller';
import { ProofService } from '../../src/modules/proof/proof.service';
import { RateLimiter } from '../../src/services/rateLimiter';
import { createProofRoutes } from '../../src/modules/proof/proof.routes';

describe('ProofController and Routes', () => {
  let mockService: {
    build: jest.Mock;
    verify: jest.Mock;
    getByHash: jest.Mock;
    listByScenario: jest.Mock;
  };
  let controller: ProofController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  const sampleBundle = new EvidenceBundle({
    id: 'bundle-ctrl-1',
    claim: new Claim({ text: 'Sample claim', type: ClaimType.Transaction }),
    rawDataRefs: [
      new RawDataRef({
        source: 'Bitcoin',
        ref: 'txid-1',
        payload: { txid: 'txid-1' },
        fetchedAt: new Date('2026-01-01T00:00:00Z')
      })
    ],
    verificationSteps: [
      new VerificationStep({
        name: 'execution:identifier',
        endpoint: '/api/evidence/verify',
        input: { identifier: 'txid-1' },
        expected: 'txid-1'
      })
    ],
    confidence: 1.0,
    riskScore: null as unknown as number,
    createdAt: new Date('2026-01-01T00:00:00Z')
  });

  beforeEach(() => {
    mockService = {
      build: jest.fn(),
      verify: jest.fn(),
      getByHash: jest.fn(),
      listByScenario: jest.fn()
    };
    controller = new ProofController(mockService as unknown as ProofService);

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFn = jest.fn();
  });

  describe('build', () => {
    it('parses body and returns 200 with built bundle', async () => {
      mockService.build.mockResolvedValue(sampleBundle);
      mockReq = {
        body: {
          type: 'Transaction',
          scenarioId: 'sc-1',
          input: {
            protocol: 'Bitcoin',
            identifier: 'txid-1',
            amountSats: '1000',
            rawDataRefs: [{ source: 'Bitcoin', ref: 'txid-1', payload: {} }]
          }
        }
      };

      await controller.build(mockReq as Request, mockRes as Response, nextFn);

      expect(mockService.build).toHaveBeenCalledWith(
        ClaimType.Transaction,
        mockReq.body.input,
        { scenarioId: 'sc-1' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(sampleBundle.toJSON());
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('passes ValidationError to next on invalid body', async () => {
      mockReq = {
        body: {
          type: 'InvalidType',
          scenarioId: ''
        }
      };

      await controller.build(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('parses body and returns 200 with verification result', async () => {
      const verificationResult = new ClaimVerificationResult({
        valid: true,
        reason: 'Verified'
      });
      mockService.verify.mockResolvedValue(verificationResult);

      mockReq = {
        body: {
          bundle: sampleBundle.toJSON()
        }
      };

      await controller.verify(mockReq as Request, mockRes as Response, nextFn);

      expect(mockService.verify).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(verificationResult.toJSON());
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('passes ValidationError to next on invalid verify body', async () => {
      mockReq = {
        body: {
          bundle: { invalid: 'bundle' }
        }
      };

      await controller.verify(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('getByHash', () => {
    it('returns 200 with bundle when found', async () => {
      mockService.getByHash.mockResolvedValue(sampleBundle);
      mockReq = {
        params: {
          bundleHash: sampleBundle.bundleHash
        }
      };

      await controller.getByHash(mockReq as Request, mockRes as Response, nextFn);

      expect(mockService.getByHash).toHaveBeenCalledWith(sampleBundle.bundleHash);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(sampleBundle.toJSON());
    });

    it('passes NotFoundError to next when bundle is not found', async () => {
      mockService.getByHash.mockResolvedValue(null);
      mockReq = {
        params: {
          bundleHash: 'non-existent'
        }
      };

      await controller.getByHash(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('listByScenario', () => {
    it('returns 200 with list of bundles for scenario', async () => {
      mockService.listByScenario.mockResolvedValue([sampleBundle]);
      mockReq = {
        params: {
          scenarioId: 'sc-1'
        }
      };

      await controller.listByScenario(mockReq as Request, mockRes as Response, nextFn);

      expect(mockService.listByScenario).toHaveBeenCalledWith('sc-1');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([sampleBundle.toJSON()]);
    });
  });

  describe('createProofRoutes', () => {
    it('creates an Express router with proof endpoints', () => {
      const limiter = {
        check: jest.fn().mockResolvedValue(undefined)
      } as unknown as RateLimiter;

      const router = createProofRoutes(controller, limiter);
      expect(router).toBeDefined();

      const routes = router.stack.map((layer) => ({
        path: layer.route?.path,
        methods: (layer.route as { methods?: Record<string, boolean> })?.methods
      }));

      expect(routes).toContainEqual(
        expect.objectContaining({ path: '/build', methods: expect.objectContaining({ post: true }) })
      );
      expect(routes).toContainEqual(
        expect.objectContaining({ path: '/verify', methods: expect.objectContaining({ post: true }) })
      );
      expect(routes).toContainEqual(
        expect.objectContaining({ path: '/scenario/:scenarioId', methods: expect.objectContaining({ get: true }) })
      );
      expect(routes).toContainEqual(
        expect.objectContaining({ path: '/:bundleHash', methods: expect.objectContaining({ get: true }) })
      );
    });
  });
});
