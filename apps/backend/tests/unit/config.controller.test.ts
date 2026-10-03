import '../../src/config/env';
import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createApp, getLimiter } from '../../src/app';
import { getLogger } from '../../src/services/logger';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}

describe('ConfigController (supertest against real app)', () => {
  jest.setTimeout(30000);

  let prisma: PrismaClient;
  let app: Express;
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

    const existing = await prisma.appConfigRecord.findUnique({
      where: { id: 'default' }
    });
    if (existing) {
      initialConfigBackup = { network: existing.network };
    }

    const logger = getLogger('test-config-controller');
    const limiter = getLimiter();
    app = createApp(limiter, logger, prisma);
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

  it('GET /api/config returns 200 with current config', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('network');
    expect(res.body).toHaveProperty('updatedAt');
  });

  it('PUT /api/config/network with valid network updates and returns 200', async () => {
    const res = await request(app)
      .put('/api/config/network')
      .send({ network: 'testnet4' });

    expect(res.status).toBe(200);
    expect(res.body.network).toBe('testnet4');
    expect(res.body).toHaveProperty('updatedAt');

    const verifyRes = await request(app).get('/api/config');
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.network).toBe('testnet4');
  });

  it('PUT /api/config/network with invalid network returns 400 and CONFIG_NETWORK_INVALID', async () => {
    const res = await request(app)
      .put('/api/config/network')
      .send({ network: 'unsupported_network' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CONFIG_NETWORK_INVALID');
  });
});
