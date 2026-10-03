import { PrismaClient } from '@prisma/client';
import { AppConfig, SupportedNetwork } from './config.types';
import { ConfigNotFoundError } from './config.errors';

export class ConfigRepository {
  private readonly prisma: PrismaClient;

  public constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async get(): Promise<AppConfig> {
    const record = await this.prisma.appConfigRecord.findUnique({
      where: { id: 'default' }
    });

    if (!record) {
      throw new ConfigNotFoundError('We could not find your app configuration. Check the system status and try again.', {
        id: 'default'
      });
    }

    return this.mapRecord(record);
  }

  public async ensureDefault(initialNetwork: SupportedNetwork): Promise<AppConfig> {
    const existing = await this.prisma.appConfigRecord.findUnique({
      where: { id: 'default' }
    });

    if (existing) {
      return this.mapRecord(existing);
    }

    const created = await this.prisma.appConfigRecord.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        network: initialNetwork
      }
    });

    return this.mapRecord(created);
  }

  public async updateNetwork(network: SupportedNetwork): Promise<AppConfig> {
    const record = await this.prisma.appConfigRecord.upsert({
      where: { id: 'default' },
      update: { network },
      create: {
        id: 'default',
        network
      }
    });

    return this.mapRecord(record);
  }

  private mapRecord(record: { id: string; network: string; updatedAt: Date }): AppConfig {
    return {
      id: record.id,
      network: record.network as SupportedNetwork,
      updatedAt: record.updatedAt
    };
  }
}
