import '../../src/config/env';
import { PrismaClient } from '@prisma/client';
import { ConfigRepository } from '../../src/modules/config/config.repository';
import { ConfigNotFoundError } from '../../src/modules/config/config.errors';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}

describe('ConfigRepository', () => {
  jest.setTimeout(30000);
  let prisma: PrismaClient;
  let repository: ConfigRepository;
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

  it('ensureDefault creates record if absent and is idempotent', async () => {
    const config1 = await repository.ensureDefault('testnet4');
    expect(config1.id).toBe('default');
    expect(config1.network).toBeDefined();

    const config2 = await repository.ensureDefault('regtest');
    expect(config2.id).toBe('default');
    expect(config2.network).toBe(config1.network);
  });

  it('get returns existing config or throws ConfigNotFoundError', async () => {
    const config = await repository.get();
    expect(config.id).toBe('default');
    expect(config.network).toBeDefined();
    expect(config.updatedAt).toBeInstanceOf(Date);
  });

  it('updateNetwork updates network successfully', async () => {
    const updated = await repository.updateNetwork('regtest');
    expect(updated.network).toBe('regtest');

    const fetched = await repository.get();
    expect(fetched.network).toBe('regtest');

    const reverted = await repository.updateNetwork('mainnet');
    expect(reverted.network).toBe('mainnet');
  });

  it('throws ConfigNotFoundError when row is absent', async () => {
    const mockPrisma = {
      appConfigRecord: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    } as unknown as PrismaClient;

    const mockRepo = new ConfigRepository(mockPrisma);
    await expect(mockRepo.get()).rejects.toThrow(ConfigNotFoundError);
  });
});
