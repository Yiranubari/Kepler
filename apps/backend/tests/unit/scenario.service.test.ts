import '../../src/config/env';
import { PrismaClient } from '@prisma/client';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}
import {
  PaymentTarget,
  PaymentTargetKind,
  ScenarioStatus,
  KeplerLogger
} from '@kepler/shared';
import { ScenarioRepository } from '../../src/modules/scenario/scenario.repository';
import { ScenarioService } from '../../src/modules/scenario/scenario.service';
import {
  ScenarioNotFoundError,
  ScenarioStateError
} from '../../src/modules/scenario/scenario.errors';

class TestLogger implements KeplerLogger {
  public loggedMessages: Array<{
    level: string;
    message: string;
    context?: Record<string, unknown>;
  }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'debug', message, context });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'info', message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'warn', message, context });
  }

  public error(message: string, _error?: unknown, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'error', message, context });
  }

  public fatal(message: string, _error: unknown, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'fatal', message, context });
  }
}

describe('ScenarioService', () => {
  jest.setTimeout(30000);
  let prisma: PrismaClient;
  let repository: ScenarioRepository;
  let logger: TestLogger;
  let service: ScenarioService;

  const testId1 = 'test_service_scenario_1';
  const testId2 = 'test_service_scenario_2';
  const testId3 = 'test_service_scenario_3';

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
    logger = new TestLogger();
    service = new ScenarioService(repository, logger);

    await prisma.scenario.deleteMany({
      where: { id: { in: [testId1, testId2, testId3] } }
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.scenario.deleteMany({
        where: { id: { in: [testId1, testId2, testId3] } }
      });
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  it('Create returns a Scenario with status Pending', async () => {
    const target = new PaymentTarget({
      kind: PaymentTargetKind.Lightning,
      payload: { invoice: 'lnbc100u1testserviceinvoice' }
    });

    const scenario = await service.create({
      id: testId1,
      target
    });

    expect(scenario.id).toBe(testId1);
    expect(scenario.status).toBe(ScenarioStatus.Pending);
    expect(scenario.target.kind).toBe(PaymentTargetKind.Lightning);
  });

  it('Get by unknown id throws ScenarioNotFoundError', async () => {
    await expect(service.getById('non_existent_id_12345')).rejects.toThrow(
      ScenarioNotFoundError
    );
  });

  it('Update Pending → Analyzed succeeds', async () => {
    const updated = await service.updateStatus(testId1, ScenarioStatus.Analyzed);
    expect(updated.status).toBe(ScenarioStatus.Analyzed);
  });

  it('Update Pending → Executed throws ScenarioStateError with the correct context', async () => {
    const target = new PaymentTarget({
      kind: PaymentTargetKind.Cashu,
      payload: { request: 'cashu-req-pending-test' }
    });

    await service.create({
      id: testId2,
      target
    });

    try {
      await service.updateStatus(testId2, ScenarioStatus.Executed);
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioStateError);
      const stateError = error as ScenarioStateError;
      expect(stateError.context.id).toBe(testId2);
      expect(stateError.context.currentStatus).toBe(ScenarioStatus.Pending);
      expect(stateError.context.attemptedTransition).toBe(ScenarioStatus.Executed);
    }
  });

  it('Update Executed → Analyzed throws ScenarioStateError', async () => {
    const updatedDecided = await service.updateStatus(testId1, ScenarioStatus.Decided);
    expect(updatedDecided.status).toBe(ScenarioStatus.Decided);

    const updatedExecuted = await service.updateStatus(testId1, ScenarioStatus.Executed);
    expect(updatedExecuted.status).toBe(ScenarioStatus.Executed);

    await expect(
      service.updateStatus(testId1, ScenarioStatus.Analyzed)
    ).rejects.toThrow(ScenarioStateError);
  });

  it('Update any state → Failed succeeds', async () => {
    const target = new PaymentTarget({
      kind: PaymentTargetKind.Bitcoin,
      payload: {
        address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        amountSats: 5000
      }
    });

    await service.create({
      id: testId3,
      target
    });

    const failedFromPending = await service.updateStatus(testId2, ScenarioStatus.Failed);
    expect(failedFromPending.status).toBe(ScenarioStatus.Failed);

    const analyzed = await service.updateStatus(testId3, ScenarioStatus.Analyzed);
    expect(analyzed.status).toBe(ScenarioStatus.Analyzed);

    const failedFromAnalyzed = await service.updateStatus(testId3, ScenarioStatus.Failed);
    expect(failedFromAnalyzed.status).toBe(ScenarioStatus.Failed);
  });

  it('Delete removes and subsequent get throws', async () => {
    await service.delete(testId1);
    await expect(service.getById(testId1)).rejects.toThrow(
      ScenarioNotFoundError
    );

    await service.delete(testId2);
    await expect(service.getById(testId2)).rejects.toThrow(
      ScenarioNotFoundError
    );

    await service.delete(testId3);
    await expect(service.getById(testId3)).rejects.toThrow(
      ScenarioNotFoundError
    );
  });
});
