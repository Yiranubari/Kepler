import { PrismaClient } from '@prisma/client';
import { Policy, PolicyScope, InternalError } from '@kepler/shared';
import { PolicyNotFoundError } from './policy.errors';

export class PolicyRepository {
  private readonly prisma: PrismaClient;
  private readonly policyId: string;

  constructor(prisma: PrismaClient, policyId: string = 'default') {
    this.prisma = prisma;
    this.policyId = policyId;
  }

  private mapScope(scope: string): PolicyScope {
    switch (scope) {
      case PolicyScope.Read:
        return PolicyScope.Read;
      case PolicyScope.Propose:
        return PolicyScope.Propose;
      case PolicyScope.Send:
        return PolicyScope.Send;
      case PolicyScope.Publish:
        return PolicyScope.Publish;
      default:
        throw new InternalError(`Unknown policy scope: ${scope}`, { scope });
    }
  }

  public async get(): Promise<Policy> {
    const record = await this.prisma.policyRecord.findUnique({
      where: { id: this.policyId }
    });

    if (!record) {
      throw new PolicyNotFoundError('Default policy not found', { id: this.policyId });
    }

    return new Policy({
      id: record.id,
      dailyBudgetSats: Number(record.dailyBudgetSats),
      perTxBudgetSats: Number(record.perTxBudgetSats),
      scopes: record.scopes.map((s) => this.mapScope(s)),
      allowedMints: record.allowedMints,
      allowedRelays: record.allowedRelays,
      allowedEsplora: record.allowedEsplora,
      updatedAt: record.updatedAt
    });
  }

  public async upsert(policy: Policy): Promise<void> {
    await this.prisma.policyRecord.upsert({
      where: { id: this.policyId },
      create: {
        id: this.policyId,
        dailyBudgetSats: BigInt(policy.dailyBudgetSats),
        perTxBudgetSats: BigInt(policy.perTxBudgetSats),
        scopes: [...policy.scopes],
        allowedMints: [...policy.allowedMints],
        allowedRelays: [...policy.allowedRelays],
        allowedEsplora: [...policy.allowedEsplora],
        updatedAt: policy.updatedAt
      },
      update: {
        dailyBudgetSats: BigInt(policy.dailyBudgetSats),
        perTxBudgetSats: BigInt(policy.perTxBudgetSats),
        scopes: [...policy.scopes],
        allowedMints: [...policy.allowedMints],
        allowedRelays: [...policy.allowedRelays],
        allowedEsplora: [...policy.allowedEsplora],
        updatedAt: policy.updatedAt
      }
    });
  }

  public async ensureDefault(): Promise<void> {
    try {
      const existing = await this.prisma.policyRecord.findUnique({
        where: { id: this.policyId }
      });

      if (existing) {
        return;
      }

      await this.prisma.policyRecord.create({
        data: {
          id: this.policyId,
          dailyBudgetSats: 100000n,
          perTxBudgetSats: 50000n,
          scopes: [PolicyScope.Read, PolicyScope.Propose],
          allowedMints: [],
          allowedRelays: [],
          allowedEsplora: []
        }
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
      ) {
        return;
      }
      throw err;
    }
  }

  public async sumSpentSince(since: Date): Promise<bigint> {
    const logs = await this.prisma.executionLog.findMany({
      where: {
        createdAt: {
          gte: since
        },
        status: 'succeeded'
      },
      select: {
        id: true,
        detail: true
      }
    });

    if (logs.length === 0) {
      return 0n;
    }

    let total = 0n;
    for (const log of logs) {
      if (
        typeof log.detail !== 'object' ||
        log.detail === null ||
        !('amountSats' in log.detail)
      ) {
        throw new InternalError('Execution log detail missing amountSats field', {
          reason: 'MISSING_AMOUNT_FIELD',
          id: log.id
        });
      }

      const detailObj = log.detail as Record<string, unknown>;
      const amountVal = detailObj['amountSats'];

      if (
        amountVal === undefined ||
        amountVal === null ||
        (typeof amountVal !== 'string' &&
          typeof amountVal !== 'number' &&
          typeof amountVal !== 'bigint') ||
        (typeof amountVal === 'string' && !/^[0-9]+$/.test(amountVal))
      ) {
        throw new InternalError('Execution log detail missing amountSats field', {
          reason: 'MISSING_AMOUNT_FIELD',
          id: log.id
        });
      }

      total += BigInt(amountVal);
    }

    return total;
  }
}
