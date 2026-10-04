import '../../src/config/env';
import { PrismaClient } from '@prisma/client';
import { BitcoinConfig, BitcoinConfigError } from '@kepler/bitcoin';
import type { KeplerLogger } from '@kepler/shared';
import { ConfigService } from '../../src/modules/config/config.service';
import { ConfigRepository } from '../../src/modules/config/config.repository';
import { ConfigNetworkInvalidError } from '../../src/modules/config/config.errors';
import { AppConfig, SupportedNetwork } from '../../src/modules/config/config.types';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}

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

describe('ConfigService', () => {
  jest.setTimeout(30000);
  let prisma: PrismaClient;
  let repository: ConfigRepository;
  let bitcoinConfig: BitcoinConfig;
  let logger: TestLogger;
  let service: ConfigService;
  let initialConfigBackup: { network: string } | null = null;

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
    repository = new ConfigRepository(prisma);

    const existing = await prisma.appConfigRecord.findUnique({
      where: { id: 'default' }
    });
    if (existing) {
      initialConfigBackup = { network: existing.network };
    }
  }, 30000);

  afterAll(async () => {
    try {
      if (initialConfigBackup) {
        await prisma.appConfigRecord.upsert({
          where: { id: 'default' },
          update: { network: initialConfigBackup.network },
          create: { id: 'default', network: initialConfigBackup.network }
        });
      }
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  beforeEach(async () => {
    bitcoinConfig = new BitcoinConfig({
      primaryUrl: 'https://blockstream.info/api',
      fallbackUrl: 'https://mempool.space/api',
      network: 'mainnet'
    });
    logger = new TestLogger();
    service = new ConfigService(repository, bitcoinConfig, logger);
  });

  it('initialize reads the DB and syncs bitcoinConfig.network to the stored value', async () => {
    await repository.updateNetwork('testnet4');

    const freshBitcoinConfig = new BitcoinConfig({
      primaryUrl: 'https://blockstream.info/api',
      fallbackUrl: 'https://mempool.space/api',
      network: 'mainnet'
    });
    expect(freshBitcoinConfig.network).toBe('mainnet');

    const freshService = new ConfigService(repository, freshBitcoinConfig, logger);
    await freshService.initialize();

    expect(freshBitcoinConfig.network).toBe('testnet4');
  });

  it('setNetwork with a valid value updates both the DB and bitcoinConfig.network', async () => {
    const updated = await service.setNetwork('regtest');
    expect(updated.network).toBe('regtest');
    expect(bitcoinConfig.network).toBe('regtest');

    const persisted = await repository.get();
    expect(persisted.network).toBe('regtest');
  });

  it('setNetwork with an invalid value throws ConfigNetworkInvalidError', async () => {
    await expect(
      service.setNetwork('invalid_network' as SupportedNetwork)
    ).rejects.toThrow(ConfigNetworkInvalidError);

    expect(bitcoinConfig.network).toBe('mainnet');
  });

  it('setNetwork with a value the bitcoin package rejects throws BitcoinConfigError and leaves both the DB and bitcoinConfig.network unchanged', async () => {
    await repository.updateNetwork('mainnet');
    expect(bitcoinConfig.network).toBe('mainnet');

    class RejectingBitcoinConfig extends BitcoinConfig {
      public override setNetwork(_network: SupportedNetwork): void {
        throw new BitcoinConfigError('Invalid BITCOIN_NETWORK: rejected by bitcoin package', {
          variable: 'BITCOIN_NETWORK'
        });
      }
    }

    const rejectingConfig = new RejectingBitcoinConfig({
      primaryUrl: 'https://blockstream.info/api',
      fallbackUrl: 'https://mempool.space/api',
      network: 'mainnet'
    });
    const rejectingService = new ConfigService(repository, rejectingConfig, logger);

    await expect(rejectingService.setNetwork('testnet4')).rejects.toThrow(BitcoinConfigError);

    expect(rejectingConfig.network).toBe('mainnet');
    const persisted = await repository.get();
    expect(persisted.network).toBe('mainnet');
  });

  it('setNetwork when the DB write fails rolls back bitcoinConfig.network to its previous value', async () => {
    await repository.updateNetwork('mainnet');
    expect(bitcoinConfig.network).toBe('mainnet');

    class FailingConfigRepository extends ConfigRepository {
      public override async updateNetwork(_network: SupportedNetwork): Promise<AppConfig> {
        throw new Error('Database write failure');
      }
    }

    const failingRepo = new FailingConfigRepository(prisma);
    const failingService = new ConfigService(failingRepo, bitcoinConfig, logger);

    await expect(failingService.setNetwork('testnet4')).rejects.toThrow('Database write failure');

    expect(bitcoinConfig.network).toBe('mainnet');
    const persisted = await repository.get();
    expect(persisted.network).toBe('mainnet');
  });

  it('Logging does not include any secret', async () => {
    await service.setNetwork('testnet4');
    logger.loggedMessages = [];

    await service.setNetwork('mainnet');

    expect(logger.loggedMessages.length).toBeGreaterThan(0);
    const infoLog = logger.loggedMessages.find((entry) => entry.level === 'info');
    expect(infoLog).toBeDefined();
    expect(infoLog?.message).toBe('Network configuration changed');
    expect(infoLog?.context).toEqual({
      from: 'testnet4',
      to: 'mainnet'
    });

    const sensitivePatterns = [/secret/i, /private/i, /seed/i, /password/i, /xprv/i];
    for (const entry of logger.loggedMessages) {
      const serialized = JSON.stringify(entry);
      for (const pattern of sensitivePatterns) {
        expect(pattern.test(serialized)).toBe(false);
      }
    }
  });
});
