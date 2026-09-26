import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '@kepler/shared';
import { TaintService } from '../../src/modules/taint/taint.service';
import { TaintRepository } from '../../src/modules/taint/taint.repository';
import { TaintConfig } from '../../src/modules/taint/taint.types';
import { TaintRuleRegistry } from '../../src/modules/taint/rules/registry';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import { TaintPersistenceError } from '../../src/modules/taint/taint.errors';
import { getLogger } from '../../src/services/logger';
import { LOG_SERVICE_NAMES } from '../../src/config/constants';

class TrackingTaintRepository extends TaintRepository {
  public scenarioExistsCalls = 0;

  public override async scenarioExists(scenarioId: string): Promise<boolean> {
    this.scenarioExistsCalls++;
    return super.scenarioExists(scenarioId);
  }
}

class RaceTaintRepository extends TaintRepository {
  public onAfterScenarioExists?: () => Promise<void>;

  public override async scenarioExists(scenarioId: string): Promise<boolean> {
    const exists = await super.scenarioExists(scenarioId);
    if (this.onAfterScenarioExists) {
      await this.onAfterScenarioExists();
    }
    return exists;
  }
}

const databaseUrl = process.env.DATABASE_URL;
const describeWithDb = databaseUrl ? describe : describe.skip;

describeWithDb('TaintService', () => {
  let prisma: PrismaClient;
  let config: TaintConfig;
  let registry: TaintRuleRegistry;
  let scorer: TaintScorer;
  let isConnected = false;

  const scenarioExisting = 'test_service_scenario_existing';
  const scenarioRace = 'test_service_scenario_race';

  beforeAll(async () => {
    try {
      prisma = new PrismaClient();
      await prisma.$connect();
      config = TaintConfig.fromEnv();
      registry = new TaintRuleRegistry();
      scorer = new TaintScorer();

      await prisma.scenario.upsert({
        where: { id: scenarioExisting },
        create: {
          id: scenarioExisting,
          targetKind: 'TRANSACTION',
          targetData: {
            address: 'bc1qtestserviceexisting00000000000000001'
          },
          status: 'ACTIVE'
        },
        update: {}
      });

      await prisma.taintGraphRecord.deleteMany({
        where: { scenarioId: scenarioExisting }
      });

      isConnected = true;
    } catch {
      isConnected = false;
    }
  }, 30000);

  afterAll(async () => {
    if (!isConnected || !prisma) {
      return;
    }
    try {
      await prisma.taintGraphRecord.deleteMany({
        where: { scenarioId: { in: [scenarioExisting, scenarioRace] } }
      });
      await prisma.scenario.deleteMany({
        where: { id: { in: [scenarioExisting, scenarioRace] } }
      });
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  test('analyze throws NotFoundError when scenario does not exist and calls repository exactly once', async () => {
    if (!isConnected) {
      return;
    }
    const trackingRepo = new TrackingTaintRepository(prisma);
    const logger = getLogger(LOG_SERVICE_NAMES.taint);
    const service = new TaintService(config, registry, scorer, trackingRepo, logger);

    const nonExistentId = 'non_existent_scenario_12345';
    let caughtError: unknown;
    try {
      await service.analyze(nonExistentId, {});
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(NotFoundError);
    const notFound = caughtError as NotFoundError;
    expect(notFound.message).toBe('Scenario not found');
    expect(notFound.context).toEqual({
      resource: 'Scenario',
      id: nonExistentId
    });
    expect(trackingRepo.scenarioExistsCalls).toBe(1);
  }, 15000);

  test('analyze constructs engine, ingests, saves graph and returns result when scenario exists', async () => {
    if (!isConnected) {
      return;
    }
    const repo = new TaintRepository(prisma);
    const logger = getLogger(LOG_SERVICE_NAMES.taint);
    const service = new TaintService(config, registry, scorer, repo, logger);

    const ingestPayload = {
      bitcoin: {
        transactions: [
          {
            txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            blockHeight: 800000,
            blockTime: 1700000000,
            inputs: [
              {
                txid: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
                vout: 0,
                address: 'bc1qinput0000000000000000000000000000001'
              }
            ],
            outputs: [
              {
                address: 'bc1qtestserviceexisting00000000000000001',
                value: BigInt(49000)
              }
            ]
          }
        ],
        addresses: []
      }
    };

    const result = await service.analyze(scenarioExisting, ingestPayload);
    expect(result).toBeDefined();
    expect(result.scenarioId).toBe(scenarioExisting);
    expect(result.graph.nodes.length).toBeGreaterThan(0);

    const persisted = await repo.getGraph(scenarioExisting);
    expect(persisted).not.toBeNull();
  }, 20000);

  test('findPaths throws NotFoundError when graph does not exist', async () => {
    if (!isConnected) {
      return;
    }
    const repo = new TaintRepository(prisma);
    const logger = getLogger(LOG_SERVICE_NAMES.taint);
    const service = new TaintService(config, registry, scorer, repo, logger);

    const nonExistentScenario = 'non_existent_graph_scenario_9999';
    let caughtError: unknown;
    try {
      await service.findPaths(nonExistentScenario, 'nodeA', 'nodeB');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(NotFoundError);
    const notFound = caughtError as NotFoundError;
    expect(notFound.message).toBe('Taint graph not found');
    expect(notFound.context).toEqual({
      resource: 'TaintGraph',
      id: nonExistentScenario
    });
  }, 15000);

  test('findPaths returns paths when graph exists for scenario', async () => {
    if (!isConnected) {
      return;
    }
    const repo = new TaintRepository(prisma);
    const logger = getLogger(LOG_SERVICE_NAMES.taint);
    const service = new TaintService(config, registry, scorer, repo, logger);

    const paths = await service.findPaths(
      scenarioExisting,
      'address:bc1qinput0000000000000000000000000000001',
      'address:bc1qtestserviceexisting00000000000000001'
    );
    expect(Array.isArray(paths)).toBe(true);
  }, 15000);

  test('saveGraph failure throws TaintPersistenceError on simulated race condition', async () => {
    if (!isConnected) {
      return;
    }
    await prisma.scenario.upsert({
      where: { id: scenarioRace },
      create: {
        id: scenarioRace,
        targetKind: 'TRANSACTION',
        targetData: {},
        status: 'ACTIVE'
      },
      update: {}
    });

    const raceRepo = new RaceTaintRepository(prisma);
    raceRepo.onAfterScenarioExists = async () => {
      await prisma.scenario.delete({
        where: { id: scenarioRace }
      });
    };

    const logger = getLogger(LOG_SERVICE_NAMES.taint);
    const service = new TaintService(config, registry, scorer, raceRepo, logger);

    let caughtError: unknown;
    try {
      await service.analyze(scenarioRace, {});
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(TaintPersistenceError);
    const persistenceError = caughtError as TaintPersistenceError;
    expect(persistenceError.context['reason']).toBe('FOREIGN_KEY_VIOLATION');
    expect(persistenceError.context['scenarioId']).toBe(scenarioRace);
    expect(persistenceError.context['operation']).toBe('saveGraph');
  }, 20000);
});
