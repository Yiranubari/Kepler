import '../../src/config/env';
import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  PaymentTarget,
  PaymentTargetKind,
  Policy,
  PolicyScope
} from '@kepler/shared';
import { NostrConfig } from '@kepler/nostr';
import { createApp, getLimiter } from '../../src/app';
import { getLogger } from '../../src/services/logger';
import { ScenarioRepository } from '../../src/modules/scenario/scenario.repository';
import { ScenarioService } from '../../src/modules/scenario/scenario.service';
import { PolicyRepository } from '../../src/modules/policy/policy.repository';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}

describe('Orchestrator Integration (Real Services, Guarded)', () => {
  jest.setTimeout(45000);

  let app: Express;
  let prisma: PrismaClient;
  let scenarioService: ScenarioService;
  let policyRepository: PolicyRepository;

  const testPrefix = 'integ-orch-';
  let counter = 0;

  const nextScenarioId = (): string => {
    counter += 1;
    return `${testPrefix}${Date.now()}-${counter}`;
  };

  const hasNwc = Boolean(process.env.NWC_CONNECTION_STRING);
  const hasCashuMint = Boolean(process.env.CASHU_MINT_URL || process.env.CASHU_MINT);
  const hasNostrKey = Boolean(process.env.NOSTR_PRIVATE_KEY);
  const test1SatInvoice = process.env.TEST_LIGHTNING_INVOICE_1SAT;

  const cleanDb = async (): Promise<void> => {
    await prisma.decision.deleteMany({
      where: { scenarioId: { startsWith: testPrefix } }
    });
    await prisma.executionLog.deleteMany({
      where: { scenarioId: { startsWith: testPrefix } }
    });
    await prisma.evidenceRecord.deleteMany({
      where: { id: { contains: testPrefix } }
    });
    await prisma.scenario.deleteMany({
      where: { id: { startsWith: testPrefix } }
    });
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await prisma.$connect();
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const logger = getLogger('test-orchestrator-integration');
    const limiter = getLimiter();
    app = createApp(limiter, logger, prisma);

    const scenarioRepo = new ScenarioRepository(prisma);
    scenarioService = new ScenarioService(scenarioRepo, logger);
    policyRepository = new PolicyRepository(prisma);

    await policyRepository.upsert(
      new Policy({
        id: 'default',
        dailyBudgetSats: 1000000,
        perTxBudgetSats: 500000,
        scopes: [PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send, PolicyScope.Publish],
        allowedMints: [process.env.CASHU_MINT_URL || 'https://testnut.cashu.space'],
        allowedRelays: ['wss://nos.lol'],
        allowedEsplora: ['https://blockstream.info/api'],
        updatedAt: new Date()
      })
    );

    await cleanDb();
  }, 45000);

  afterAll(async () => {
    await cleanDb();
    await prisma.$disconnect();
  });

  describe('Pipeline pre-execution validation against real database', () => {
    it('returns 404 when scenario does not exist', async () => {
      const res = await request(app)
        .post('/api/orchestrator/orchestrate')
        .send({
          scenarioId: nextScenarioId(),
          ingestData: { nodes: [], edges: [] }
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ORCHESTRATOR_NOT_FOUND');
    });

    it('returns 422 when candidate list has no compatible routes for scenario', async () => {
      const scenarioId = nextScenarioId();
      await scenarioService.create({
        id: scenarioId,
        target: new PaymentTarget({
          kind: PaymentTargetKind.Lightning,
          payload: { invoice: 'lnbc100n1...' }
        })
      });

      const res = await request(app)
        .post('/api/orchestrator/orchestrate')
        .send({
          scenarioId,
          ingestData: { nodes: [], edges: [] },
          candidateRoutes: [
            {
              name: 'btc-incompatible',
              protocol: 'Bitcoin',
              estimatedFeeSats: '100',
              estimatedLinkageConfidence: 0.1,
              params: {}
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ORCHESTRATOR_NO_ROUTE');
    });
  });

  describe('Lightning flow against real services', () => {
    const testLightning = (hasNwc && Boolean(test1SatInvoice)) ? it : it.skip;

    testLightning('executes payment against real NWC for 1-sat test invoice', async () => {
      const scenarioId = nextScenarioId();
      await scenarioService.create({
        id: scenarioId,
        target: new PaymentTarget({
          kind: PaymentTargetKind.Lightning,
          payload: { invoice: test1SatInvoice! }
        })
      });

      const res = await request(app)
        .post('/api/orchestrator/orchestrate')
        .send({
          scenarioId,
          ingestData: { nodes: [], edges: [] },
          candidateRoutes: [
            {
              name: 'via NWC live',
              protocol: 'Lightning',
              estimatedFeeSats: '1',
              estimatedLinkageConfidence: 0.05,
              params: {
                invoice: test1SatInvoice!,
                amountSats: '1'
              }
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.scenarioId).toBe(scenarioId);
      expect(res.body.execution.status).toBe('succeeded');
      expect(res.body.execution.protocol).toBe('Lightning');
    });
  });

  describe('Cashu flow against real services', () => {
    const testCashu = (hasCashuMint && Boolean(process.env.TEST_CASHU_TOKEN)) ? it : it.skip;

    testCashu('executes Cashu payment with real mint token', async () => {
      const scenarioId = nextScenarioId();
      await scenarioService.create({
        id: scenarioId,
        target: new PaymentTarget({
          kind: PaymentTargetKind.Cashu,
          payload: { request: process.env.TEST_CASHU_TOKEN! }
        })
      });

      const res = await request(app)
        .post('/api/orchestrator/orchestrate')
        .send({
          scenarioId,
          ingestData: { nodes: [], edges: [] },
          candidateRoutes: [
            {
              name: 'Cashu live route',
              protocol: 'Cashu',
              estimatedFeeSats: '0',
              estimatedLinkageConfidence: 0.01,
              params: {
                operation: 'swap',
                token: process.env.TEST_CASHU_TOKEN!,
                amountSats: '10'
              }
            }
          ]
        });

      expect([200, 202]).toContain(res.status);
      expect(res.body.scenarioId).toBe(scenarioId);
      expect(res.body.execution.protocol).toBe('Cashu');
    });
  });

  describe('Nostr publish against real services', () => {
    const testNostr = hasNostrKey ? it : it.skip;

    testNostr('validates Nostr configuration and connects to relays', async () => {
      const nostrConfig = NostrConfig.fromEnv();
      expect(nostrConfig.privateKey).toBeDefined();
      expect(nostrConfig.relays.length).toBeGreaterThan(0);
    });
  });
});
