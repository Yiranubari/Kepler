import '../../src/config/env';
import request from 'supertest';

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout')) {
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}&connect_timeout=30`;
}
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createApp, getLimiter } from '../../src/app';
import { getLogger } from '../../src/services/logger';

describe('ScenarioController (Integration with real App and Prisma)', () => {
  jest.setTimeout(30000);
  let app: Express;
  let prisma: PrismaClient;
  let createdScenarioId: string;

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
    const logger = getLogger('test-scenario-controller');
    const limiter = getLimiter();
    app = createApp(limiter, logger, prisma);
  }, 30000);

  afterAll(async () => {
    try {
      if (createdScenarioId) {
        await prisma.scenario.deleteMany({
          where: { id: createdScenarioId }
        });
      }
      await prisma.$disconnect();
    } catch {
      return;
    }
  });

  it('POST / with a valid Lightning target returns 201', async () => {
    const res = await request(app)
      .post('/api/scenarios')
      .send({
        target: {
          kind: 'Lightning',
          payload: {
            invoice: 'lnbc1u1ptestinvoice'
          }
        }
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('Pending');
    expect(res.body.target.kind).toBe('Lightning');
    expect(res.body.target.payload.invoice).toBe('lnbc1u1ptestinvoice');

    createdScenarioId = res.body.id;
  });

  it('POST / with an empty invoice returns 400 with VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/scenarios')
      .send({
        target: {
          kind: 'Lightning',
          payload: {
            invoice: ''
          }
        }
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /:id for unknown returns 404', async () => {
    const res = await request(app).get('/api/scenarios/non_existent_unknown_id');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('SCENARIO_NOT_FOUND');
  });

  it('PATCH /:id/status with an invalid transition returns 409', async () => {
    expect(createdScenarioId).toBeDefined();

    const res = await request(app)
      .patch(`/api/scenarios/${createdScenarioId}/status`)
      .send({
        status: 'Executed'
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('SCENARIO_STATE_ERROR');
    expect(res.body.error.context).toHaveProperty('currentStatus', 'Pending');
    expect(res.body.error.context).toHaveProperty('attemptedTransition', 'Executed');
  });

  it('DELETE /:id returns 204', async () => {
    expect(createdScenarioId).toBeDefined();

    const res = await request(app).delete(`/api/scenarios/${createdScenarioId}`);

    expect(res.status).toBe(204);

    const check = await request(app).get(`/api/scenarios/${createdScenarioId}`);
    expect(check.status).toBe(404);
  });

  it('GET / returns the list', async () => {
    const res = await request(app).get('/api/scenarios?limit=10&offset=0');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
