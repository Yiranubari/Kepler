import {
  Scenario,
  ScenarioStatus,
  KeplerLogger
} from '@kepler/shared';
import { PrismaClient } from '@prisma/client';
import { BitcoinConfig } from '@kepler/bitcoin';
import { ScenarioRepository } from './scenario.repository';
import { CreateScenarioInput, SupportedNetwork } from './scenario.types';
import { ScenarioNotFoundError, ScenarioStateError } from './scenario.errors';
import { ConfigService } from '../config/config.service';
import { ConfigRepository } from '../config/config.repository';

export class ScenarioService {
  private readonly repository: ScenarioRepository;
  private readonly configService: ConfigService;
  private readonly logger: KeplerLogger;

  constructor(
    repository: ScenarioRepository,
    configServiceOrLogger: ConfigService | KeplerLogger,
    maybeLogger?: KeplerLogger
  ) {
    this.repository = repository;
    if (configServiceOrLogger instanceof ConfigService) {
      this.configService = configServiceOrLogger;
      this.logger = maybeLogger!;
    } else {
      this.logger = configServiceOrLogger;
      const candidatePrisma = (repository as unknown as { prisma?: PrismaClient }).prisma;
      const fallbackBitcoinConfig = BitcoinConfig.fromEnv({
        ...process.env,
        BITCOIN_NETWORK: process.env.BITCOIN_NETWORK || 'mainnet'
      });
      if (candidatePrisma) {
        this.configService = new ConfigService(
          new ConfigRepository(candidatePrisma),
          fallbackBitcoinConfig,
          this.logger
        );
      } else {
        this.configService = new ConfigService(
          {
            get: async () => ({
              id: 'default',
              network: fallbackBitcoinConfig.network as SupportedNetwork,
              updatedAt: new Date()
            })
          } as unknown as ConfigRepository,
          fallbackBitcoinConfig,
          this.logger
        );
      }
    }
  }

  public async create(input: Omit<CreateScenarioInput, 'network'>): Promise<Scenario> {
    const config = await this.configService.get();
    const scenario = await this.repository.create({
      ...input,
      network: config.network
    });
    this.logger.info('Scenario created', {
      scenarioId: scenario.id,
      targetKind: scenario.target.kind,
      network: config.network
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

  public async list(limit?: number, offset?: number, network?: SupportedNetwork): Promise<Scenario[]> {
    return this.repository.list(limit, offset, network);
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
