import '../../src/config/env';
import { PrismaClient } from '@prisma/client';
import { Policy, PolicyScope, KeplerLogger } from '@kepler/shared';
import { PolicyRepository } from '../../src/modules/policy/policy.repository';
import { PolicyService } from '../../src/modules/policy/policy.service';
import {
  PolicyScopeError,
  PolicyBudgetError,
  PolicyAllowlistError,
  PolicyInputError,
  PolicyNotFoundError
} from '../../src/modules/policy/policy.errors';

class TestTrackingLogger implements KeplerLogger {
  public infoLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];

  public debug(): void {}
  public info(message: string, context?: Record<string, unknown>): void {
    this.infoLogs.push({ message, context });
  }
  public warn(): void {}
  public error(): void {}
  public fatal(): void {}
}

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

describe('PolicyService (Real Prisma and ExecutionLog, no stubs)', () => {
  jest.setTimeout(30000);

  let prisma: PrismaClient;
  let repository: PolicyRepository;
  let logger: TestTrackingLogger;
  let service: PolicyService;

  const testPolicyId = 'test_policy_service_isolated';
  const testScenarioId = 'test_policy_service_scenario';

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
    logger = new TestTrackingLogger();
    service = new PolicyService(repository, logger);

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
        targetData: { invoice: 'lnbc100u1testservice' },
        status: 'ACTIVE'
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
    logger.infoLogs = [];
    await service.initialize();
  });

  describe('scope checks', () => {
    it('check({ kind: "read" }) passes when the scope is set, throws PolicyScopeError when it is not', async () => {
      const allowedRes = await service.check({ kind: 'read' });
      expect(allowedRes.allowed).toBe(true);

      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Propose],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      });

      await expect(service.check({ kind: 'read' })).rejects.toThrow(PolicyScopeError);
      try {
        await service.check({ kind: 'read' });
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyScopeError);
        const scopeErr = err as PolicyScopeError;
        expect(scopeErr.code).toBe('POLICY_SCOPE_VIOLATION');
        expect(scopeErr.context.scope).toBe('read');
      }
    });

    it('check({ kind: "propose" }) passes when the scope is set, throws PolicyScopeError when it is not', async () => {
      const allowedRes = await service.check({ kind: 'propose' });
      expect(allowedRes.allowed).toBe(true);

      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      });

      await expect(service.check({ kind: 'propose' })).rejects.toThrow(PolicyScopeError);
      try {
        await service.check({ kind: 'propose' });
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyScopeError);
        const scopeErr = err as PolicyScopeError;
        expect(scopeErr.code).toBe('POLICY_SCOPE_VIOLATION');
        expect(scopeErr.context.scope).toBe('propose');
      }
    });

    it('check({ kind: "publish" }) passes when the scope is set, throws PolicyScopeError when it is not', async () => {
      await expect(service.check({ kind: 'publish' })).rejects.toThrow(PolicyScopeError);

      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Publish],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      });

      const allowedRes = await service.check({ kind: 'publish' });
      expect(allowedRes.allowed).toBe(true);
    });
  });

  describe('budget checks', () => {
    it('check({ kind: "send", amountSats: "1000" }) passes when both per-tx and daily limits are met', async () => {
      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      });

      const res = await service.check({
        kind: 'send',
        amountSats: '1000',
        protocol: 'Bitcoin'
      });

      expect(res.allowed).toBe(true);
      expect(res.limits.dailyRemainingSats).toBe('100000');
      expect(res.limits.perTxLimitSats).toBe('50000');
    });

    it('check with amountSats above perTxBudgetSats throws PolicyBudgetError with limitType: "perTx"', async () => {
      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      });

      await expect(
        service.check({
          kind: 'send',
          amountSats: '60000',
          protocol: 'Lightning'
        })
      ).rejects.toThrow(PolicyBudgetError);

      try {
        await service.check({
          kind: 'send',
          amountSats: '60000',
          protocol: 'Lightning'
        });
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyBudgetError);
        const budgetErr = err as PolicyBudgetError;
        expect(budgetErr.code).toBe('POLICY_BUDGET_VIOLATION');
        expect(budgetErr.context.limitType).toBe('perTx');
        expect(Number(budgetErr.context.limitSats)).toBe(50000);
        expect(Number(budgetErr.context.requestedSats)).toBe(60000);
      }
    });

    it('check with amountSats within per-tx but over the daily budget throws PolicyBudgetError with limitType: "daily"', async () => {
      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      });

      await prisma.executionLog.create({
        data: {
          scenarioId: testScenarioId,
          protocol: 'Bitcoin',
          status: 'succeeded',
          detail: { amountSats: '80000' }
        }
      });

      await expect(
        service.check({
          kind: 'send',
          amountSats: '30000',
          protocol: 'Bitcoin'
        })
      ).rejects.toThrow(PolicyBudgetError);

      try {
        await service.check({
          kind: 'send',
          amountSats: '30000',
          protocol: 'Bitcoin'
        });
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyBudgetError);
        const budgetErr = err as PolicyBudgetError;
        expect(budgetErr.code).toBe('POLICY_BUDGET_VIOLATION');
        expect(budgetErr.context.limitType).toBe('daily');
        expect(Number(budgetErr.context.spentSats)).toBe(80000);
        expect(Number(budgetErr.context.requestedSats)).toBe(30000);
      }
    });

    it('Daily budget is computed from ExecutionLog rows within the current UTC day. Seed three successful executions and one failed one. Assert the sum matches only the successful ones', async () => {
      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      });

      await prisma.executionLog.createMany({
        data: [
          {
            scenarioId: testScenarioId,
            protocol: 'Bitcoin',
            status: 'succeeded',
            detail: { amountSats: '20000' }
          },
          {
            scenarioId: testScenarioId,
            protocol: 'Lightning',
            status: 'succeeded',
            detail: { amountSats: '30000' }
          },
          {
            scenarioId: testScenarioId,
            protocol: 'Cashu',
            status: 'succeeded',
            detail: { amountSats: '10000' }
          },
          {
            scenarioId: testScenarioId,
            protocol: 'Bitcoin',
            status: 'failed',
            detail: { amountSats: '50000' }
          }
        ]
      });

      const allowedRes = await service.check({
        kind: 'send',
        amountSats: '30000',
        protocol: 'Bitcoin'
      });
      expect(allowedRes.allowed).toBe(true);
      expect(allowedRes.limits.dailyRemainingSats).toBe('40000');

      await expect(
        service.check({
          kind: 'send',
          amountSats: '45000',
          protocol: 'Bitcoin'
        })
      ).rejects.toThrow(PolicyBudgetError);

      try {
        await service.check({
          kind: 'send',
          amountSats: '45000',
          protocol: 'Bitcoin'
        });
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyBudgetError);
        const budgetErr = err as PolicyBudgetError;
        expect(budgetErr.context.limitType).toBe('daily');
        expect(Number(budgetErr.context.spentSats)).toBe(60000);
      }
    });
  });

  describe('allowlist checks', () => {
    it('check with a Cashu send and a disallowed mint throws PolicyAllowlistError', async () => {
      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: ['https://trusted.mint.org'],
        allowedRelays: [],
        allowedEsplora: []
      });

      await expect(
        service.check({
          kind: 'send',
          amountSats: '5000',
          protocol: 'Cashu',
          mint: 'https://evil.mint.org'
        })
      ).rejects.toThrow(PolicyAllowlistError);

      try {
        await service.check({
          kind: 'send',
          amountSats: '5000',
          protocol: 'Cashu',
          mint: 'https://evil.mint.org'
        });
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyAllowlistError);
        const allowErr = err as PolicyAllowlistError;
        expect(allowErr.code).toBe('POLICY_ALLOWLIST_VIOLATION');
        expect(allowErr.context.kind).toBe('mint');
        expect(allowErr.context.value).toBe('https://evil.mint.org');
      }
    });

    it('check with a Cashu send and an allowed mint passes', async () => {
      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: ['https://trusted.mint.org'],
        allowedRelays: [],
        allowedEsplora: []
      });

      const res = await service.check({
        kind: 'send',
        amountSats: '5000',
        protocol: 'Cashu',
        mint: 'https://trusted.mint.org'
      });

      expect(res.allowed).toBe(true);
    });
  });

  describe('logging confidentiality', () => {
    it('No log call at info level includes a budget value or an allowlist value', async () => {
      await service.update({
        dailyBudgetSats: '250000',
        perTxBudgetSats: '60000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: ['https://secret.mint'],
        allowedRelays: ['wss://secret.relay'],
        allowedEsplora: ['https://secret.esplora/api']
      });

      expect(logger.infoLogs.length).toBeGreaterThan(0);
      for (const log of logger.infoLogs) {
        if (log.context) {
          expect(log.context).not.toHaveProperty('dailyBudgetSats');
          expect(log.context).not.toHaveProperty('perTxBudgetSats');
          expect(log.context).not.toHaveProperty('limitSats');
          expect(log.context).not.toHaveProperty('spentSats');
          expect(log.context).not.toHaveProperty('allowedMints');
          expect(log.context).not.toHaveProperty('allowedRelays');
          expect(log.context).not.toHaveProperty('allowedEsplora');
          expect(log.context).not.toHaveProperty('mint');
          expect(log.context).not.toHaveProperty('relay');
          expect(log.context).not.toHaveProperty('esplora');
        }
      }
    });
  });

  describe('Budget proof', () => {
    it('seed an execution log row with amountSats: 90000 and a policy with dailyBudgetSats: 100000. Attempt a send of 20000. Assert the error context contains spentSats: 90000, limitSats: 100000, requestedSats: 20000', async () => {
      await service.update({
        dailyBudgetSats: '100000',
        perTxBudgetSats: '50000',
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: []
      });

      await prisma.executionLog.create({
        data: {
          scenarioId: testScenarioId,
          protocol: 'Lightning',
          status: 'succeeded',
          detail: { amountSats: '90000' }
        }
      });

      let caughtError: PolicyBudgetError | undefined;
      try {
        await service.check({
          kind: 'send',
          amountSats: '20000',
          protocol: 'Lightning'
        });
      } catch (err) {
        if (err instanceof PolicyBudgetError) {
          caughtError = err;
        }
      }

      expect(caughtError).toBeDefined();
      expect(caughtError?.code).toBe('POLICY_BUDGET_VIOLATION');
      expect(caughtError?.context.limitType).toBe('daily');
      expect(Number(caughtError?.context.spentSats)).toBe(90000);
      expect(Number(caughtError?.context.limitSats)).toBe(100000);
      expect(Number(caughtError?.context.requestedSats)).toBe(20000);
    });
  });
});
