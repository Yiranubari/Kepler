import {
  Scenario,
  ScenarioStatus,
  KeplerLogger
} from '@kepler/shared';
import { ScenarioRepository } from './scenario.repository';
import { CreateScenarioInput } from './scenario.types';
import { ScenarioNotFoundError, ScenarioStateError } from './scenario.errors';

export class ScenarioService {
  private readonly repository: ScenarioRepository;
  private readonly logger: KeplerLogger;

  constructor(repository: ScenarioRepository, logger: KeplerLogger) {
    this.repository = repository;
    this.logger = logger;
  }

  public async create(input: CreateScenarioInput): Promise<Scenario> {
    const scenario = await this.repository.create(input);
    this.logger.info('Scenario created', {
      scenarioId: scenario.id,
      targetKind: scenario.target.kind
    });
    return scenario;
  }

  public async getById(id: string): Promise<Scenario> {
    const scenario = await this.repository.getById(id);
    if (!scenario) {
      throw new ScenarioNotFoundError(`Scenario ${id} not found`, { id });
    }
    return scenario;
  }

  public async list(limit?: number, offset?: number): Promise<Scenario[]> {
    return this.repository.list(limit, offset);
  }

  public async updateStatus(id: string, next: ScenarioStatus): Promise<Scenario> {
    const current = await this.getById(id);

    this.validateTransition(current, next);

    return this.repository.updateStatus(id, next);
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new ScenarioNotFoundError(`Scenario ${id} not found`, { id });
    }
    await this.repository.delete(id);
  }

  private validateTransition(current: Scenario, next: ScenarioStatus): void {
    const currentStatus = current.status;

    if (currentStatus === ScenarioStatus.Executed || currentStatus === ScenarioStatus.Failed) {
      throw new ScenarioStateError(
        `Cannot transition from terminal state ${currentStatus}`,
        {
          id: current.id,
          currentStatus,
          attemptedTransition: next
        }
      );
    }

    try {
      if (next === ScenarioStatus.Analyzed) {
        current.markAnalyzed();
      } else if (next === ScenarioStatus.Decided) {
        current.markDecided();
      } else if (next === ScenarioStatus.Executed) {
        current.markExecuted();
      } else if (next === ScenarioStatus.Failed) {
        current.markFailed();
      } else {
        throw new ScenarioStateError(
          `Invalid status transition from ${currentStatus} to ${next}`,
          {
            id: current.id,
            currentStatus,
            attemptedTransition: next
          }
        );
      }
    } catch (error) {
      if (error instanceof ScenarioStateError) {
        throw error;
      }
      throw new ScenarioStateError(
        `Cannot transition scenario ${current.id} from ${currentStatus} to ${next}`,
        {
          id: current.id,
          currentStatus,
          attemptedTransition: next
        },
        error instanceof Error ? error : undefined
      );
    }
  }
}
