import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp, getLimiter } from '../../src/app';
import { getLogger } from '../../src/services/logger';

describe('GET /api/health', () => {
  const logger = getLogger('test-health');
  const limiter = getLimiter();
  const app = createApp(limiter, logger);

  it('returns 200 with body { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 200 when the database is unreachable', async () => {
    const unreachablePrisma = {
      $connect: async (): Promise<void> => {
        throw new Error('database unreachable');
      }
    } as unknown as PrismaClient;
    const appWithoutDatabase = createApp(limiter, logger, unreachablePrisma);
    const res = await request(appWithoutDatabase).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
