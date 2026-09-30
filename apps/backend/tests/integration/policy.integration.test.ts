import '../../src/config/env';
import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { getLogger } from '../../src/services/logger';
import { PolicyScope } from '@kepler/shared';
import { createApp, getLimiter } from '../../src/app';
import { PolicyRepository } from '../../src/modules/policy/policy.repository';
import { PolicyService } from '../../src/modules/policy/policy.service';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}

describe('Policy Integration Tests (Real database, no mocks)', () => {
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

    await prisma.policyRecord.deleteMany({
      where: { id: 'default' }
    });

    const logger = getLogger('test-policy-integration');
    const limiter = getLimiter();
    app = createApp(limiter, logger, prisma);
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

  it('Boot the app, call initialize, verify the default row exists', async () => {
    const logger = getLogger('test-policy-integration-init');
    const repository = new PolicyRepository(prisma);
    const service = new PolicyService(repository, logger);

    await service.initialize();

    const record = await prisma.policyRecord.findUnique({
      where: { id: 'default' }
    });

    expect(record).not.toBeNull();
    expect(Number(record?.dailyBudgetSats)).toBe(100000);
    expect(Number(record?.perTxBudgetSats)).toBe(50000);
    expect(record?.scopes).toEqual([PolicyScope.Read, PolicyScope.Propose]);
    expect(record?.allowedMints).toEqual([]);
    expect(record?.allowedRelays).toEqual([]);
    expect(record?.allowedEsplora).toEqual([]);

    const res = await request(app).get('/api/policy');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('default');
    expect(res.body.dailyBudgetSats).toBe('100000');
    expect(res.body.perTxBudgetSats).toBe('50000');
    expect(res.body.scopes).toEqual([PolicyScope.Read, PolicyScope.Propose]);
  });

  it('Update the policy, verify the change persists across a service reconstruction', async () => {
    const updatePayload = {
      dailyBudgetSats: '350000',
      perTxBudgetSats: '70000',
      scopes: [PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send, PolicyScope.Publish],
      allowedMints: ['https://mint.example.com'],
      allowedRelays: ['wss://relay.example.com'],
      allowedEsplora: ['https://mempool.space/api']
    };

    const putRes = await request(app)
      .put('/api/policy')
      .send(updatePayload);

    expect(putRes.status).toBe(200);
    expect(putRes.body.dailyBudgetSats).toBe('350000');
    expect(putRes.body.perTxBudgetSats).toBe('70000');

    const freshLogger = getLogger('test-policy-integration-reconstructed');
    const freshRepository = new PolicyRepository(prisma);
    const freshService = new PolicyService(freshRepository, freshLogger);

    const reconstructedPolicy = await freshService.get();
    expect(reconstructedPolicy.id).toBe('default');
    expect(reconstructedPolicy.dailyBudgetSats).toBe(350000);
    expect(reconstructedPolicy.perTxBudgetSats).toBe(70000);
    expect(reconstructedPolicy.canRead()).toBe(true);
    expect(reconstructedPolicy.canPropose()).toBe(true);
    expect(reconstructedPolicy.canSend(1000, 0)).toBe(true);
    expect(reconstructedPolicy.canPublish()).toBe(true);
    expect(reconstructedPolicy.isMintAllowed('https://mint.example.com')).toBe(true);
    expect(reconstructedPolicy.isRelayAllowed('wss://relay.example.com')).toBe(true);
    expect(reconstructedPolicy.isEsploraAllowed('https://mempool.space/api')).toBe(true);

    const checkRes = await freshService.check({
      kind: 'send',
      amountSats: '5000',
      protocol: 'Bitcoin'
    });
    expect(checkRes.allowed).toBe(true);
    expect(checkRes.limits.perTxLimitSats).toBe('70000');
    expect(checkRes.limits.dailyRemainingSats).toBe('350000');
  });
});
