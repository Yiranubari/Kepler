import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Logger } from '../../src/services/logger';
import { Lifecycle } from '../../src/services/lifecycle';

describe('Lifecycle', () => {
  let tempDir: string;
  let logger: Logger;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-lifecycle-test-'));
    logger = new Logger({
      logDir: tempDir,
      serviceName: 'lifecycle-test',
      environment: 'development'
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('runs startup hooks in registration order', async () => {
    const lifecycle = new Lifecycle(logger);
    const executionOrder: string[] = [];

    lifecycle.registerStartupHook('first', async () => {
      executionOrder.push('first');
    });

    lifecycle.registerStartupHook('second', async () => {
      executionOrder.push('second');
    });

    await lifecycle.start();

    expect(executionOrder).toEqual(['first', 'second']);
    expect(lifecycle.getState()).toBe('ready');
  });

  it('runs shutdown hooks in reverse registration order', async () => {
    const lifecycle = new Lifecycle(logger);
    const shutdownOrder: string[] = [];

    lifecycle.registerShutdownHook('hookA', async () => {
      shutdownOrder.push('hookA');
    });

    lifecycle.registerShutdownHook('hookB', async () => {
      shutdownOrder.push('hookB');
    });

    await lifecycle.stop('testing');

    expect(shutdownOrder).toEqual(['hookB', 'hookA']);
    expect(lifecycle.getState()).toBe('stopped');
  });

  it('causes start to reject and keeps state as starting when a startup hook throws', async () => {
    const exitCalls: number[] = [];
    const lifecycle = new Lifecycle(logger, {
      exitFn: (code) => {
        exitCalls.push(code);
      }
    });

    lifecycle.registerStartupHook('failing-hook', async () => {
      throw new Error('database connection failed');
    });

    await expect(lifecycle.start()).rejects.toThrow('database connection failed');
    expect(lifecycle.getState()).toBe('starting');
    expect(exitCalls).toEqual([1]);
  });

  it('logs and skips a shutdown hook that times out and continues shutdown', async () => {
    const lifecycle = new Lifecycle(logger, { shutdownTimeoutMs: 50 });
    const executed: string[] = [];

    lifecycle.registerShutdownHook('hanging-hook', async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      executed.push('hanging-hook');
    });

    lifecycle.registerShutdownHook('fast-hook', async () => {
      executed.push('fast-hook');
    });

    await lifecycle.stop('timeout-test');

    expect(executed).toContain('fast-hook');
    expect(lifecycle.getState()).toBe('stopped');
  });

  it('is idempotent when calling stop multiple times', async () => {
    const lifecycle = new Lifecycle(logger);
    let hookExecutionCount = 0;

    lifecycle.registerShutdownHook('counted-hook', async () => {
      hookExecutionCount += 1;
    });

    await lifecycle.stop('first');
    await lifecycle.stop('second');
    await lifecycle.stop('third');

    expect(hookExecutionCount).toBe(1);
    expect(lifecycle.getState()).toBe('stopped');
  });

  it('registers signal handlers exactly once', () => {
    const lifecycle = new Lifecycle(logger);
    const initialSigintCount = process.listenerCount('SIGINT');

    lifecycle.attachSignalHandlers(logger);
    expect(process.listenerCount('SIGINT')).toBe(initialSigintCount + 1);

    lifecycle.attachSignalHandlers(logger);
    expect(process.listenerCount('SIGINT')).toBe(initialSigintCount + 1);

    process.removeAllListeners('SIGINT');
  });
});
