import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigurationError, ValidationError } from '@kepler/shared';
import { Logger } from '../../src/services/logger';

describe('Logger', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-logger-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('creates the folder when constructed with a missing log dir', () => {
    const missingDir = path.join(tempDir, 'nested', 'logs');
    expect(fs.existsSync(missingDir)).toBe(false);

    new Logger({
      logDir: missingDir,
      serviceName: 'test-service',
      environment: 'development'
    });

    expect(fs.existsSync(missingDir)).toBe(true);
  });

  it('throws ConfigurationError with path in context when log dir is unwritable', () => {
    const unwritableDir = path.join(tempDir, 'unwritable');
    fs.mkdirSync(unwritableDir);
    fs.chmodSync(unwritableDir, 0o444);

    try {
      expect(() => {
        new Logger({
          logDir: path.join(unwritableDir, 'logs'),
          serviceName: 'test-service',
          environment: 'development'
        });
      }).toThrow(ConfigurationError);

      try {
        new Logger({
          logDir: path.join(unwritableDir, 'logs'),
          serviceName: 'test-service',
          environment: 'development'
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigurationError);
        const configErr = err as ConfigurationError;
        expect(configErr.context['path']).toBeDefined();
      }
    } finally {
      fs.chmodSync(unwritableDir, 0o777);
    }
  });

  it('returns the same child instance on repeated calls to getLogger', () => {
    const logger = new Logger({
      logDir: tempDir,
      serviceName: 'root',
      environment: 'development'
    });

    const httpLogger1 = logger.getLogger('http');
    const httpLogger2 = logger.getLogger('http');

    expect(httpLogger1).toBe(httpLogger2);
  });

  it('returns distinct children for different service names', () => {
    const logger = new Logger({
      logDir: tempDir,
      serviceName: 'root',
      environment: 'development'
    });

    const httpLogger = logger.getLogger('http');
    const taintLogger = logger.getLogger('taint');

    expect(httpLogger).not.toBe(taintLogger);
    expect(httpLogger.serviceName).toBe('http');
    expect(taintLogger.serviceName).toBe('taint');
  });

  it('extracts message and stack when logging a native Error', async () => {
    const logger = new Logger({
      logDir: tempDir,
      serviceName: 'test',
      environment: 'development'
    });

    const nativeError = new Error('database connection failed');
    logger.error('failed_operation', nativeError);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.log'));
    expect(files.length).toBeGreaterThan(0);

    const logContent = fs.readFileSync(path.join(tempDir, files[0]), 'utf8');
    const lines = logContent.trim().split('\n').filter(Boolean);
    const parsed = lines.map((l) => JSON.parse(l));

    const found = parsed.find((p) => p.message === 'failed_operation');
    expect(found).toBeDefined();
    expect(found.context.message).toBe('database connection failed');
    expect(found.context.stack).toBeDefined();
  });

  it('extracts code and context when logging a KeplerError', async () => {
    const logger = new Logger({
      logDir: tempDir,
      serviceName: 'test',
      environment: 'development'
    });

    const keplerError = new ValidationError('invalid parameter', { field: 'txid', value: '123' });
    logger.error('validation_failed', keplerError);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.log'));
    expect(files.length).toBeGreaterThan(0);

    const logContent = fs.readFileSync(path.join(tempDir, files[0]), 'utf8');
    const lines = logContent.trim().split('\n').filter(Boolean);
    const parsed = lines.map((l) => JSON.parse(l));

    const found = parsed.find((p) => p.message === 'validation_failed');
    expect(found).toBeDefined();
    expect(found.context.code).toBe('VALIDATION_ERROR');
    expect(found.context.errorContext).toEqual({ field: 'txid', value: '123' });
  });
});
