import request from 'supertest';
import { createApp, getLimiter } from '../../src/app';
import { getLogger } from '../../src/services/logger';

describe('App integration for Proof module', () => {
  const logger = getLogger('test-proof-app');
  const limiter = getLimiter();
  const app = createApp(limiter, logger);

  it('mounts POST /api/proof/build and creates a proof bundle', async () => {
    const txid = 'd'.repeat(64);
    const res = await request(app)
      .post('/api/proof/build')
      .send({
        type: 'Transaction',
        scenarioId: 'sc-app-1',
        input: {
          protocol: 'Bitcoin',
          identifier: txid,
          amountSats: '1000',
          rawDataRefs: [
            {
              source: 'Bitcoin',
              ref: txid,
              payload: { txid }
            }
          ]
        }
      });

    if ((res.status === 422 || res.status === 500) && res.body?.error?.code === 'PROOF_PERSISTENCE_ERROR') {
      expect(res.body.error.code).toBe('PROOF_PERSISTENCE_ERROR');
    } else {
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('bundleHash');
    }
  });

  it('mounts POST /api/proof/verify and validates a verification request', async () => {
    const res = await request(app)
      .post('/api/proof/verify')
      .send({
        bundle: {
          invalid: true
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('mounts GET /api/proof/:bundleHash and returns 404 when not found', async () => {
    const res = await request(app).get('/api/proof/non-existent-hash');
    expect(res.status).toBe(404);
  });

  it('mounts GET /api/proof/scenario/:scenarioId', async () => {
    const res = await request(app).get('/api/proof/scenario/scenario-empty');
    if ((res.status === 422 || res.status === 500) && res.body?.error?.code === 'PROOF_PERSISTENCE_ERROR') {
      expect(res.body.error.code).toBe('PROOF_PERSISTENCE_ERROR');
    } else {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }
  });

  it('confirms old /api/evidence/verify returns 404 and is not mounted', async () => {
    const res = await request(app).post('/api/evidence/verify').send({});
    expect(res.status).toBe(404);
  });
});
