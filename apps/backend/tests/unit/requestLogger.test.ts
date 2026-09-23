import express, { Express } from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Logger } from '../../src/services/logger';
import { requestLogger } from '../../src/middleware/requestLogger';

describe('requestLogger middleware', () => {
  let tempDir: string;
  let logger: Logger;
  let app: Express;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-request-test-'));
    logger = new Logger({
      logDir: tempDir,
      serviceName: 'http-test',
      environment: 'development'
    });

    app = express();
    app.use(requestLogger(logger));

    app.get('/test-ok', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    app.get('/test-warn', (_req, res) => {
      res.status(404).json({ error: 'not found' });
    });

    app.get('/test-error', (_req, res) => {
      res.locals.error = new Error('server failed');
      res.status(500).json({ error: 'internal error' });
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('echoes generated request id in the response header', async () => {
    const res = await request(app).get('/test-ok');

    expect(res.status).toBe(200);
    const requestId = res.headers['x-request-id'];
    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)).toBe(true);
  });

  it('preserves an existing valid x-request-id header', async () => {
    const customId = '12345678-1234-4234-8234-123456789abc';
    const res = await request(app)
      .get('/test-ok')
      .set('x-request-id', customId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('logs once on finish event with the correct fields', async () => {
    const infoCalls: Array<{ message: string; context?: Record<string, unknown> }> = [];
    const originalInfo = logger.info.bind(logger);
    logger.info = (message: string, context?: Record<string, unknown>) => {
      infoCalls.push({ message, context });
      originalInfo(message, context);
    };

    const res = await request(app)
      .get('/test-ok')
      .set('User-Agent', 'KeplerTestAgent/1.0');

    expect(res.status).toBe(200);
    expect(infoCalls.length).toBe(1);

    const { message, context } = infoCalls[0];
    expect(message).toBe('request_completed');
    expect(context).toBeDefined();
    expect(context?.method).toBe('GET');
    expect(context?.path).toBe('/test-ok');
    expect(context?.status).toBe(200);
    expect(typeof context?.durationMs).toBe('number');
    expect(context?.requestId).toBe(res.headers['x-request-id']);
    expect(context?.userAgent).toBe('KeplerTestAgent/1.0');
    expect(context?.ip).toBeDefined();
  });

  it('logs warn on 4xx responses', async () => {
    const warnCalls: Array<{ message: string; context?: Record<string, unknown> }> = [];
    const originalWarn = logger.warn.bind(logger);
    logger.warn = (message: string, context?: Record<string, unknown>) => {
      warnCalls.push({ message, context });
      originalWarn(message, context);
    };

    const res = await request(app).get('/test-warn');

    expect(res.status).toBe(404);
    expect(warnCalls.length).toBe(1);
    const { message, context } = warnCalls[0];
    expect(message).toBe('request_completed');
    expect(context?.status).toBe(404);
  });

  it('logs error with captured error on 5xx responses', async () => {
    const errorCalls: Array<{ message: string; capturedError?: unknown; context?: Record<string, unknown> }> = [];
    const originalError = logger.error.bind(logger);
    logger.error = (message: string, capturedError?: unknown, context?: Record<string, unknown>) => {
      errorCalls.push({ message, capturedError, context });
      originalError(message, capturedError, context);
    };

    const res = await request(app).get('/test-error');

    expect(res.status).toBe(500);
    expect(errorCalls.length).toBe(1);
    const { message, capturedError, context } = errorCalls[0];
    expect(message).toBe('request_completed');
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe('server failed');
    expect(context?.status).toBe(500);
  });
});
