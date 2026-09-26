import '../../src/config/env';
import { PrismaClient } from '@prisma/client';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}
import {
  PaymentTarget,
  PaymentTargetKind,
  ScenarioStatus
} from '@kepler/shared';
import { ScenarioRepository } from '../../src/modules/scenario/scenario.repository';

describe('ScenarioRepository', () => {
  jest.setTimeout(30000);
  let prisma: PrismaClient;
  let repository: ScenarioRepository;

  const testScenarioId1 = 'test_scenario_repo_1';
  const testScenarioId2 = 'test_scenario_repo_2';
  const testScenarioId3 = 'test_scenario_repo_3';

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
    repository = new ScenarioRepository(prisma);

    await prisma.scenario.deleteMany({
      where: {
        id: { in: [testScenarioId1, testScenarioId2, testScenarioId3] }
      }
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.scenario.deleteMany({
        where: {
          id: { in: [testScenarioId1, testScenarioId2, testScenarioId3] }
        }
      });
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  it('Create → get by id round-trips', async () => {
    const target = new PaymentTarget({
      kind: PaymentTargetKind.Lightning,
      payload: { invoice: 'lnbc100u1testinvoicerepo' }
    });

    const scenario = await repository.create({
      id: testScenarioId1,
      target
    });

    expect(scenario.id).toBe(testScenarioId1);
    expect(scenario.status).toBe(ScenarioStatus.Pending);
    expect(scenario.target.kind).toBe(PaymentTargetKind.Lightning);
    expect(scenario.target.payload).toEqual({ invoice: 'lnbc100u1testinvoicerepo' });

    const fetched = await repository.getById(testScenarioId1);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(testScenarioId1);
    expect(fetched?.status).toBe(ScenarioStatus.Pending);
    expect(fetched?.target.kind).toBe(PaymentTargetKind.Lightning);
    expect(fetched?.target.payload).toEqual({ invoice: 'lnbc100u1testinvoicerepo' });
  });

  it('Get by unknown id returns null', async () => {
    const absent = await repository.getById('non_existent_scenario_id_999999');
    expect(absent).toBeNull();
  });

  it('List returns newest first, respects limit/offset', async () => {
    const target2 = new PaymentTarget({
      kind: PaymentTargetKind.Cashu,
      payload: { request: 'cashu-token-repo-test' }
    });

    await repository.create({
      id: testScenarioId2,
      target: target2
    });

    const target3 = new PaymentTarget({
      kind: PaymentTargetKind.Bitcoin,
      payload: {
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        amountSats: 1000
      }
    });

    await repository.create({
      id: testScenarioId3,
      target: target3
    });

    const list = await repository.list(10, 0);
    expect(list.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < list.length - 1; i++) {
      expect(list[i].createdAt.getTime()).toBeGreaterThanOrEqual(list[i + 1].createdAt.getTime());
    }

    const capped = await repository.list(1, 0);
    expect(capped).toHaveLength(1);

    const offsetList = await repository.list(1, 1);
    expect(offsetList).toHaveLength(1);
    expect(offsetList[0].id).not.toBe(capped[0].id);
    expect(capped[0].createdAt.getTime()).toBeGreaterThanOrEqual(offsetList[0].createdAt.getTime());
  });

  it('Update status persists', async () => {
    const updated = await repository.updateStatus(testScenarioId1, ScenarioStatus.Analyzed);
    expect(updated.id).toBe(testScenarioId1);
    expect(updated.status).toBe(ScenarioStatus.Analyzed);

    const refetched = await repository.getById(testScenarioId1);
    expect(refetched?.status).toBe(ScenarioStatus.Analyzed);
  });

  it('Delete removes', async () => {
    await repository.delete(testScenarioId1);
    const check1 = await repository.getById(testScenarioId1);
    expect(check1).toBeNull();

    await repository.delete(testScenarioId2);
    await repository.delete(testScenarioId3);

    expect(await repository.getById(testScenarioId2)).toBeNull();
    expect(await repository.getById(testScenarioId3)).toBeNull();
  });
});
