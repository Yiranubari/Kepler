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
  const testScenarioIdTestnet4 = 'test_scenario_repo_testnet4';
  const testScenarioIdMainnet = 'test_scenario_repo_mainnet';

  const allTestIds = [
    testScenarioId1,
    testScenarioId2,
    testScenarioId3,
    testScenarioIdTestnet4,
    testScenarioIdMainnet
  ];

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
        id: { in: allTestIds }
      }
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.scenario.deleteMany({
        where: {
          id: { in: allTestIds }
        }
      });
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  it('Create and get by id round-trips', async () => {
    const target = new PaymentTarget({
      kind: PaymentTargetKind.Lightning,
      payload: { invoice: 'lnbc100u1testinvoicerepo' }
    });

    const scenario = await repository.create({
      id: testScenarioId1,
      target,
      network: 'mainnet'
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
    expect((fetched?.toJSON() as { network?: string })?.network).toBe('mainnet');
  });

  it('Get by unknown id returns null', async () => {
    const absent = await repository.getById('non_existent_scenario_id_999999');
    expect(absent).toBeNull();
  });

  it('A scenario created on testnet4 is not returned by a list({ network: \'mainnet\' }) query', async () => {
    const target = new PaymentTarget({
      kind: PaymentTargetKind.Cashu,
      payload: { request: 'cashu-token-testnet4' }
    });

    await repository.create({
      id: testScenarioIdTestnet4,
      target,
      network: 'testnet4'
    });

    const mainnetList = await repository.list({ network: 'mainnet' });
    expect(mainnetList.some((s) => s.id === testScenarioIdTestnet4)).toBe(false);
  });

  it('A scenario created on mainnet is returned by a list({ network: \'mainnet\' }) query', async () => {
    const target = new PaymentTarget({
      kind: PaymentTargetKind.Bitcoin,
      payload: {
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        amountSats: 2500
      }
    });

    await repository.create({
      id: testScenarioIdMainnet,
      target,
      network: 'mainnet'
    });

    const mainnetList = await repository.list({ network: 'mainnet' });
    expect(mainnetList.some((s) => s.id === testScenarioIdMainnet)).toBe(true);
  });

  it('list without a network filter returns all scenarios', async () => {
    const allScenarios = await repository.list();
    expect(allScenarios.some((s) => s.id === testScenarioIdTestnet4)).toBe(true);
    expect(allScenarios.some((s) => s.id === testScenarioIdMainnet)).toBe(true);
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

    await repository.delete(testScenarioIdTestnet4);
    await repository.delete(testScenarioIdMainnet);

    expect(await repository.getById(testScenarioIdTestnet4)).toBeNull();
    expect(await repository.getById(testScenarioIdMainnet)).toBeNull();
  });
});
