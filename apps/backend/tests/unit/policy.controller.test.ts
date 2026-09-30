import '../../src/config/env';
import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { PolicyScope } from '@kepler/shared';
import { createApp, getLimiter } from '../../src/app';
import { getLogger } from '../../src/services/logger';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}

describe('PolicyController (supertest against real app)', () => {
  jest.setTimeout(30000);

  let prisma: PrismaClient;
  let app: Express;

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

    const logger = getLogger('test-policy-controller');
    const limiter = getLimiter();
    app = createApp(limiter, logger, prisma);

    await prisma.policyRecord.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        dailyBudgetSats: 100000n,
        perTxBudgetSats: 50000n,
        scopes: [PolicyScope.Read, PolicyScope.Propose],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      },
      update: {
        dailyBudgetSats: 100000n,
        perTxBudgetSats: 50000n,
        scopes: [PolicyScope.Read, PolicyScope.Propose],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      }
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.policyRecord.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          dailyBudgetSats: 100000n,
          perTxBudgetSats: 50000n,
          scopes: [PolicyScope.Read, PolicyScope.Propose],
          allowedMints: [],
          allowedRelays: [],
          allowedEsplora: []
        },
        update: {
          dailyBudgetSats: 100000n,
          perTxBudgetSats: 50000n,
          scopes: [PolicyScope.Read, PolicyScope.Propose],
          allowedMints: [],
          allowedRelays: [],
          allowedEsplora: []
        }
      });
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  beforeEach(async () => {
    await prisma.policyRecord.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        dailyBudgetSats: 100000n,
        perTxBudgetSats: 50000n,
        scopes: [PolicyScope.Read, PolicyScope.Propose],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      },
      update: {
        dailyBudgetSats: 100000n,
        perTxBudgetSats: 50000n,
        scopes: [PolicyScope.Read, PolicyScope.Propose],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      }
    });
  });

  describe('GET /api/policy', () => {
    it('returns the policy', async () => {
      const res = await request(app).get('/api/policy');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('default');
      expect(res.body.dailyBudgetSats).toBe('100000');
      expect(res.body.perTxBudgetSats).toBe('50000');
      expect(res.body.scopes).toEqual([PolicyScope.Read, PolicyScope.Propose]);
      expect(Array.isArray(res.body.allowedMints)).toBe(true);
      expect(Array.isArray(res.body.allowedRelays)).toBe(true);
      expect(Array.isArray(res.body.allowedEsplora)).toBe(true);
      expect(typeof res.body.updatedAt).toBe('string');
    });
  });

  describe('PUT /api/policy', () => {
    it('with a valid body updates and returns', async () => {
      const updatePayload = {
        dailyBudgetSats: '300000',
        perTxBudgetSats: '60000',
        scopes: [PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send],
        allowedMints: ['https://mint.example.com'],
        allowedRelays: ['wss://relay.example.com'],
        allowedEsplora: ['https://mempool.space/api']
      };

      const res = await request(app)
        .put('/api/policy')
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.dailyBudgetSats).toBe('300000');
      expect(res.body.perTxBudgetSats).toBe('60000');
      expect(res.body.scopes).toEqual([PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send]);
      expect(res.body.allowedMints).toEqual(['https://mint.example.com']);
      expect(res.body.allowedRelays).toEqual(['wss://relay.example.com']);
      expect(res.body.allowedEsplora).toEqual(['https://mempool.space/api']);
    });

    it('with an empty scope array returns 400', async () => {
      const res = await request(app)
        .put('/api/policy')
        .send({
          dailyBudgetSats: '100000',
          perTxBudgetSats: '50000',
          scopes: [],
          allowedMints: [],
          allowedRelays: [],
          allowedEsplora: []
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('POLICY_INPUT_ERROR');
    });
  });

  describe('POST /api/policy/check', () => {
    it('with { kind: "read" } returns 200', async () => {
      const res = await request(app)
        .post('/api/policy/check')
        .send({ kind: 'read' });

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
      expect(typeof res.body.limits.dailyRemainingSats).toBe('string');
      expect(typeof res.body.limits.perTxLimitSats).toBe('string');
    });

    it('with { kind: "send", amountSats: "999999999" } returns 403 with POLICY_BUDGET_VIOLATION', async () => {
      await request(app)
        .put('/api/policy')
        .send({
          dailyBudgetSats: '100000',
          perTxBudgetSats: '50000',
          scopes: [PolicyScope.Read, PolicyScope.Send],
          allowedMints: [],
          allowedRelays: [],
          allowedEsplora: []
        });

      const res = await request(app)
        .post('/api/policy/check')
        .send({
          kind: 'send',
          amountSats: '999999999',
          protocol: 'Bitcoin'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('POLICY_BUDGET_VIOLATION');
      expect(res.body.error.context.limitType).toBe('perTx');
      expect(res.body.error.context.requestedSats).toBe('999999999');
    });

    it('with { kind: "bogus" } returns 400', async () => {
      const res = await request(app)
        .post('/api/policy/check')
        .send({ kind: 'bogus' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('POLICY_INPUT_ERROR');
    });
  });
});
