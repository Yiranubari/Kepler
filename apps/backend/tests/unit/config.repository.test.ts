import '../../src/config/env';
import { PrismaClient } from '@prisma/client';
import { ConfigRepository } from '../../src/modules/config/config.repository';

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

  it('ensureDefault creates the row', async () => {
    await prisma.appConfigRecord.deleteMany({
      where: { id: 'default' }
    });

    const created = await repository.ensureDefault('mainnet');
    expect(created.id).toBe('default');
    expect(created.network).toBe('mainnet');

    const inDb = await prisma.appConfigRecord.findUnique({
      where: { id: 'default' }
    });
    expect(inDb).not.toBeNull();
    expect(inDb?.network).toBe('mainnet');
  });

  it('ensureDefault is idempotent', async () => {
    const secondCall = await repository.ensureDefault('testnet4');
    expect(secondCall.id).toBe('default');
    expect(secondCall.network).toBe('mainnet');

    const inDb = await prisma.appConfigRecord.findUnique({
      where: { id: 'default' }
    });
    expect(inDb?.network).toBe('mainnet');
  });

  it('updateNetwork changes the stored value and returns the updated record', async () => {
    const updated = await repository.updateNetwork('testnet4');
    expect(updated.id).toBe('default');
    expect(updated.network).toBe('testnet4');

    const fetched = await repository.get();
    expect(fetched.network).toBe('testnet4');

    const reverted = await repository.updateNetwork('mainnet');
    expect(reverted.network).toBe('mainnet');
  });
});
