import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

export class ScenarioNetworkBackfill {
  private readonly prismaClient: PrismaClient;
  private readonly targetNetwork: string;

  public constructor(prismaClient?: PrismaClient, targetNetwork?: string) {
    this.prismaClient = prismaClient ?? new PrismaClient();
    this.targetNetwork = targetNetwork ?? process.env['BITCOIN_NETWORK'] ?? 'mainnet';
  }

  public async execute(): Promise<number> {
    const updateResult = await this.prismaClient.scenario.updateMany({
      data: {
        network: this.targetNetwork
      }
    });

    return updateResult.count;
  }

  public async close(): Promise<void> {
    await this.prismaClient.$disconnect();
  }
}

export class ScenarioNetworkBackfillRunner {
  public static async run(): Promise<void> {
    const backfill = new ScenarioNetworkBackfill();
    try {
      await backfill.execute();
    } finally {
      await backfill.close();
    }
  }
}

void ScenarioNetworkBackfillRunner.run();
