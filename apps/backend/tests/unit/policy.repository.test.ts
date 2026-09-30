import '../../src/config/env';
import { PrismaClient } from '@prisma/client';
import { Policy, PolicyScope, InternalError } from '@kepler/shared';
import { PolicyRepository } from '../../src/modules/policy/policy.repository';
import { PolicyNotFoundError } from '../../src/modules/policy/policy.errors';

if (!('toJSON' in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value(): string {
      return this.toString();
    },
    configurable: true,
    writable: true
  });
}

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}

describe('PolicyRepository', () => {
  jest.setTimeout(30000);
  let prisma: PrismaClient;
  let repository: PolicyRepository;

  const testPolicyId = 'test_policy_repo_isolated';
  const testScenarioId = 'test_policy_repo_scenario';

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
    repository = new PolicyRepository(prisma, testPolicyId);

    await prisma.executionLog.deleteMany({
      where: { scenarioId: testScenarioId }
    });
    await prisma.scenario.deleteMany({
      where: { id: testScenarioId }
    });
    await prisma.policyRecord.deleteMany({
      where: { id: testPolicyId }
    });

    await prisma.scenario.create({
      data: {
        id: testScenarioId,
        targetKind: 'Lightning',
        targetData: { invoice: 'lnbc100u1testrepo' },
        status: 'Pending'
      }
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.executionLog.deleteMany({
        where: { scenarioId: testScenarioId }
      });
      await prisma.scenario.deleteMany({
        where: { id: testScenarioId }
      });
      await prisma.policyRecord.deleteMany({
        where: { id: testPolicyId }
      });
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  beforeEach(async () => {
    await prisma.policyRecord.deleteMany({
      where: { id: testPolicyId }
    });
    await prisma.executionLog.deleteMany({
      where: { scenarioId: testScenarioId }
    });
  });

  describe('ensureDefault creates the row with the documented defaults', () => {
    it('creates row with default bootstrapping values when absent', async () => {
      await repository.ensureDefault();

      const record = await prisma.policyRecord.findUnique({
        where: { id: testPolicyId }
      });
      expect(record).not.toBeNull();
      expect(Number(record?.dailyBudgetSats)).toBe(100000);
      expect(Number(record?.perTxBudgetSats)).toBe(50000);
      expect(record?.scopes).toEqual([PolicyScope.Read, PolicyScope.Propose]);
      expect(record?.allowedMints).toEqual([]);
      expect(record?.allowedRelays).toEqual([]);
      expect(record?.allowedEsplora).toEqual([]);

      const policy = await repository.get();
      expect(policy.canRead()).toBe(true);
      expect(policy.canPropose()).toBe(true);
      expect(policy.canSend(100, 0)).toBe(false);
      expect(policy.canPublish()).toBe(false);
    });
  });

  describe('ensureDefault is idempotent', () => {
    it('does not overwrite existing record if already present', async () => {
      await prisma.policyRecord.create({
        data: {
          id: testPolicyId,
          dailyBudgetSats: 999999n,
          perTxBudgetSats: 88888n,
          scopes: [PolicyScope.Send, PolicyScope.Publish],
          allowedMints: ['https://custom.mint'],
          allowedRelays: [],
          allowedEsplora: []
        }
      });

      await repository.ensureDefault();

      const policy = await repository.get();
      expect(policy.dailyBudgetSats).toBe(999999);
      expect(policy.perTxBudgetSats).toBe(88888);
      expect(policy.canSend(100, 0)).toBe(true);
      expect(policy.canPublish()).toBe(true);
      expect(policy.canRead()).toBe(false);
    });
  });

  describe('get returns the row', () => {
    it('returns Policy instance when record exists', async () => {
      await prisma.policyRecord.create({
        data: {
          id: testPolicyId,
          dailyBudgetSats: 200000n,
          perTxBudgetSats: 50000n,
          scopes: [PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send],
          allowedMints: ['https://mint.example.com'],
          allowedRelays: ['wss://relay.example.com'],
          allowedEsplora: ['https://mempool.space/api']
        }
      });

      const policy = await repository.get();
      expect(policy).toBeInstanceOf(Policy);
      expect(policy.id).toBe(testPolicyId);
      expect(policy.dailyBudgetSats).toBe(200000);
      expect(policy.perTxBudgetSats).toBe(50000);
      expect(policy.canRead()).toBe(true);
      expect(policy.canPropose()).toBe(true);
      expect(policy.canSend(10000, 0)).toBe(true);
      expect(policy.canPublish()).toBe(false);
      expect(policy.isMintAllowed('https://mint.example.com')).toBe(true);
      expect(policy.isRelayAllowed('wss://relay.example.com')).toBe(true);
      expect(policy.isEsploraAllowed('https://mempool.space/api')).toBe(true);
    });
  });

  describe('get with no row throws PolicyNotFoundError', () => {
    it('throws PolicyNotFoundError when row is absent', async () => {
      await expect(repository.get()).rejects.toThrow(PolicyNotFoundError);
      try {
        await repository.get();
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyNotFoundError);
        const policyErr = err as PolicyNotFoundError;
        expect(policyErr.code).toBe('POLICY_NOT_FOUND');
        expect(policyErr.context).toEqual({ id: testPolicyId });
      }
    });
  });

  describe('upsert writes and reads back correctly', () => {
    it('creates row when absent', async () => {
      const policy = new Policy({
        id: testPolicyId,
        dailyBudgetSats: 150000,
        perTxBudgetSats: 30000,
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: ['https://upsert.mint'],
        allowedRelays: ['wss://upsert.relay'],
        allowedEsplora: ['https://mempool.space/api']
      });

      await repository.upsert(policy);

      const record = await prisma.policyRecord.findUnique({
        where: { id: testPolicyId }
      });
      expect(record).not.toBeNull();
      expect(Number(record?.dailyBudgetSats)).toBe(150000);
      expect(Number(record?.perTxBudgetSats)).toBe(30000);
      expect(record?.scopes).toEqual([PolicyScope.Read, PolicyScope.Send]);

      const readBack = await repository.get();
      expect(readBack.dailyBudgetSats).toBe(150000);
      expect(readBack.perTxBudgetSats).toBe(30000);
      expect(readBack.canRead()).toBe(true);
      expect(readBack.canSend(1000, 0)).toBe(true);
    });

    it('updates existing row', async () => {
      await repository.ensureDefault();

      const updatedPolicy = new Policy({
        id: testPolicyId,
        dailyBudgetSats: 500000,
        perTxBudgetSats: 100000,
        scopes: [PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send, PolicyScope.Publish],
        allowedMints: ['https://updated.mint'],
        allowedRelays: ['wss://updated.relay'],
        allowedEsplora: ['https://blockstream.info/api']
      });

      await repository.upsert(updatedPolicy);

      const fetched = await repository.get();
      expect(fetched.dailyBudgetSats).toBe(500000);
      expect(fetched.perTxBudgetSats).toBe(100000);
      expect(fetched.canPublish()).toBe(true);
      expect(fetched.isMintAllowed('https://updated.mint')).toBe(true);
    });
  });

  describe('sumSpentSince returns 0n when no executions exist', () => {
    it('returns 0n when no executions exist', async () => {
      const spent = await repository.sumSpentSince(new Date(Date.now() - 3600000));
      expect(spent).toBe(0n);
    });
  });

  describe('sumSpentSince sums amounts from successful executions after the given date', () => {
    it('sums amounts from successful executions after the given date', async () => {
      const since = new Date(Date.now() - 60000);

      await prisma.executionLog.createMany({
        data: [
          {
            scenarioId: testScenarioId,
            protocol: 'Lightning',
            status: 'succeeded',
            detail: { amountSats: '15000', feeSats: '10' },
            createdAt: new Date(Date.now() - 30000)
          },
          {
            scenarioId: testScenarioId,
            protocol: 'Bitcoin',
            status: 'succeeded',
            detail: { amountSats: '25000' },
            createdAt: new Date(Date.now() - 20000)
          },
          {
            scenarioId: testScenarioId,
            protocol: 'Cashu',
            status: 'failed',
            detail: { amountSats: '100000' },
            createdAt: new Date(Date.now() - 10000)
          },
          {
            scenarioId: testScenarioId,
            protocol: 'Lightning',
            status: 'succeeded',
            detail: { amountSats: '50000' },
            createdAt: new Date(Date.now() - 120000)
          }
        ]
      });

      const spent = await repository.sumSpentSince(since);
      expect(spent).toBe(40000n);
    });

    it('throws InternalError when succeeded log detail misses amountSats', async () => {
      const since = new Date(Date.now() - 60000);

      await prisma.executionLog.create({
        data: {
          scenarioId: testScenarioId,
          protocol: 'Lightning',
          status: 'succeeded',
          detail: { recipient: 'invalid-no-amount' },
          createdAt: new Date()
        }
      });

      await expect(repository.sumSpentSince(since)).rejects.toThrow(InternalError);
      try {
        await repository.sumSpentSince(since);
      } catch (err) {
        expect(err).toBeInstanceOf(InternalError);
        const internalErr = err as InternalError;
        expect(internalErr.context.reason).toBe('MISSING_AMOUNT_FIELD');
      }
    });
  });
});
