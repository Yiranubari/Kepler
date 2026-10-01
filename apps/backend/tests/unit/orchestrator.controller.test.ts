import '../../src/config/env';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { KeplerLogger } from '@kepler/shared';
import { BitcoinClient, BitcoinConfig } from '@kepler/bitcoin';
import { LightningClient, LightningConfig } from '@kepler/lightning';
import { CashuClient, CashuConfig } from '@kepler/cashu';
import { NostrClient, NostrConfig } from '@kepler/nostr';
import { RateLimiter } from '../../src/services/rateLimiter';
import { errorMiddleware } from '../../src/middleware/error';
import { ScenarioRepository } from '../../src/modules/scenario/scenario.repository';
import { ScenarioService } from '../../src/modules/scenario/scenario.service';
import { TaintRepository } from '../../src/modules/taint/taint.repository';
import { TaintConfig } from '../../src/modules/taint/taint.types';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import { createDefaultRuleRegistry } from '../../src/modules/taint/rules/registry';
import { TaintService } from '../../src/modules/taint/taint.service';
import { ProofRepository } from '../../src/modules/proof/proof.repository';
import { ClaimRegistry } from '../../src/modules/proof/claims/registry';
import { ProofService } from '../../src/modules/proof/proof.service';
import { PolicyRepository } from '../../src/modules/policy/policy.repository';
import { PolicyService } from '../../src/modules/policy/policy.service';
import { OnchainService } from '../../src/modules/onchain/onchain.service';
import { OrchestratorService } from '../../src/modules/orchestrator/orchestrator.service';
import { OrchestratorController } from '../../src/modules/orchestrator/orchestrator.controller';
import { createOrchestratorRoutes } from '../../src/modules/orchestrator/orchestrator.routes';
import {
  OrchestrateRequest,
  OrchestrateResponse
} from '../../src/modules/orchestrator/orchestrator.types';
import {
  OrchestratorNotFoundError,
  OrchestratorStateError,
  OrchestratorNoRouteError,
  OrchestratorRouteError,
  OrchestratorExecutionError
} from '../../src/modules/orchestrator/orchestrator.errors';

class TestLogger implements KeplerLogger {
  public messages: Array<{ level: string; message: string; context?: Record<string, unknown> }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'debug', message, context });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'info', message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'warn', message, context });
  }

  public error(message: string, _error?: unknown, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'error', message, context });
  }

  public fatal(message: string, _error: unknown, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'fatal', message, context });
  }
}

class TestOrchestratorService extends OrchestratorService {
  public resultToReturn?: OrchestrateResponse;
  public errorToThrow?: Error;

  constructor(logger: KeplerLogger) {
    const prisma = new PrismaClient();
    const scenarioRepo = new ScenarioRepository(prisma);
    const scenarioService = new ScenarioService(scenarioRepo, logger);
    const taintConfig = TaintConfig.fromEnv();
    const taintRegistry = createDefaultRuleRegistry();
    const taintScorer = new TaintScorer();
    const taintRepo = new TaintRepository(prisma);
    const taintService = new TaintService(taintConfig, taintRegistry, taintScorer, taintRepo, logger);
    const proofRepo = new ProofRepository(prisma);
    const proofRegistry = ClaimRegistry.createDefault();
    const proofService = new ProofService(proofRegistry, proofRepo, logger);
    const policyRepo = new PolicyRepository(prisma);
    const policyService = new PolicyService(policyRepo, logger);
    const bitcoinConfig = BitcoinConfig.fromEnv({ ...process.env, BITCOIN_NETWORK: 'regtest' });
    const bitcoinClient = new BitcoinClient(bitcoinConfig, logger);
    const onchainService = new OnchainService(bitcoinClient, logger);
    const nostrConfig = new NostrConfig({
      relays: ['wss://nos.lol'],
      privateKey: '0000000000000000000000000000000000000000000000000000000000000001'
    });
    const nostrClient = new NostrClient(nostrConfig, logger);
    const lightningConfig = new LightningConfig({
      connectionString:
        'nostr+walletconnect://0000000000000000000000000000000000000000000000000000000000000001?relay=wss://relay.damus.io&secret=0000000000000000000000000000000000000000000000000000000000000002'
    });
    const lightningClient = new LightningClient(lightningConfig, logger);
    const cashuConfig = CashuConfig.fromEnv();
    const cashuClient = new CashuClient(cashuConfig, logger);

    super({
      scenarioService,
      taintService,
      proofService,
      policyService,
      onchainService,
      nostrClient,
      lightningClient,
      cashuClient,
      bitcoinClient,
      prisma,
      logger
    });
  }

  public override async orchestrate(request: OrchestrateRequest): Promise<OrchestrateResponse> {
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    if (this.resultToReturn) {
      return this.resultToReturn;
    }
    return super.orchestrate(request);
  }
}

describe('OrchestratorController and Routes', () => {
  let app: Express;
  let service: TestOrchestratorService;
  let controller: OrchestratorController;
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger();
    service = new TestOrchestratorService(logger);
    controller = new OrchestratorController(service);

    const limiter = new RateLimiter({
      read: { limit: 1000, windowMs: 60000 },
      propose: { limit: 1000, windowMs: 60000 },
      send: { limit: 1000, windowMs: 60000 },
      publish: { limit: 1000, windowMs: 60000 }
    });

    app = express();
    app.use(express.json());
    app.use('/api/orchestrator', createOrchestratorRoutes(controller, limiter));
    app.use(errorMiddleware);
  });

  it('responds with 200 on successful payment orchestration', async () => {
    const successResponse: OrchestrateResponse = {
      scenarioId: 'sc-success',
      decision: {
        routeName: 'Lightning Direct',
        protocol: 'Lightning',
        evidenceBundleHash: 'bundle-hash-1',
        reason: 'Selected Lightning route with lowest linkage.'
      },
      execution: {
        status: 'succeeded',
        amountSats: '5000',
        feeSats: '5',
        identifier: 'payment-hash-1',
        protocol: 'Lightning'
      },
      nostrEventId: 'nostr-event-1'
    };
    service.resultToReturn = successResponse;

    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-success',
        ingestData: {
          nodes: [{ id: 'n1', label: 'tx', address: 'addr1' }],
          edges: []
        }
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(successResponse);
  });

  it('responds with 202 when payment execution fails', async () => {
    const failedResponse: OrchestrateResponse = {
      scenarioId: 'sc-failed',
      decision: {
        routeName: 'Cashu Melt',
        protocol: 'Cashu',
        evidenceBundleHash: 'bundle-hash-2',
        reason: 'Selected Cashu route.'
      },
      execution: {
        status: 'failed',
        amountSats: '2000',
        feeSats: '0',
        identifier: '',
        protocol: 'Cashu'
      },
      nostrEventId: null
    };
    service.resultToReturn = failedResponse;

    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-failed',
        ingestData: {
          nodes: [{ id: 'n1', label: 'tx', address: 'addr1' }],
          edges: []
        }
      });

    expect(res.status).toBe(202);
    expect(res.body).toEqual(failedResponse);
  });

  it('responds with 400 on invalid body missing scenarioId', async () => {
    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        ingestData: {
          nodes: [],
          edges: []
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responds with 400 on unknown keys due to strict schema', async () => {
    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-valid',
        ingestData: {
          nodes: [],
          edges: []
        },
        unexpectedKey: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responds with 400 on control characters in scenarioId', async () => {
    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-\u0000-invalid',
        ingestData: {
          nodes: [],
          edges: []
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responds with 404 when OrchestratorNotFoundError is thrown', async () => {
    service.errorToThrow = new OrchestratorNotFoundError('Scenario not found', {
      resource: 'Scenario',
      id: 'sc-missing'
    });

    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-missing',
        ingestData: {
          nodes: [],
          edges: []
        }
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORCHESTRATOR_NOT_FOUND');
  });

  it('responds with 409 when OrchestratorStateError is thrown', async () => {
    service.errorToThrow = new OrchestratorStateError('Invalid state', {
      scenarioId: 'sc-terminal',
      currentStatus: 'Failed',
      expectedStatus: 'Pending'
    });

    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-terminal',
        ingestData: {
          nodes: [],
          edges: []
        }
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORCHESTRATOR_STATE_ERROR');
  });

  it('responds with 422 when OrchestratorNoRouteError is thrown', async () => {
    service.errorToThrow = new OrchestratorNoRouteError('No route', {
      scenarioId: 'sc-no-route',
      candidateCount: 0
    });

    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-no-route',
        ingestData: {
          nodes: [],
          edges: []
        }
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORCHESTRATOR_NO_ROUTE');
  });

  it('responds with 422 when OrchestratorRouteError is thrown', async () => {
    service.errorToThrow = new OrchestratorRouteError('Invalid route parameter', {
      scenarioId: 'sc-route-err',
      reason: 'MISSING_INVOICE'
    });

    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-route-err',
        ingestData: {
          nodes: [],
          edges: []
        }
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORCHESTRATOR_ROUTE_ERROR');
  });

  it('responds with 502 when OrchestratorExecutionError is thrown', async () => {
    service.errorToThrow = new OrchestratorExecutionError('Execution failed', {
      scenarioId: 'sc-exec-err',
      protocol: 'Bitcoin',
      reason: 'Broadcast rejected'
    });

    const res = await request(app)
      .post('/api/orchestrator/orchestrate')
      .send({
        scenarioId: 'sc-exec-err',
        ingestData: {
          nodes: [],
          edges: []
        }
      });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ORCHESTRATOR_EXECUTION_ERROR');
  });
});
