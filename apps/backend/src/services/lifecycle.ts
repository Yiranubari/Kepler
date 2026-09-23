import { KeplerLogger } from './logger';
import { STARTUP_TIMEOUT_MS, SHUTDOWN_TIMEOUT_MS } from '../config/constants';

export type LifecycleState = 'starting' | 'ready' | 'shuttingDown' | 'stopped';

export interface LifecycleHook {
  readonly name: string;
  readonly hook: () => Promise<void>;
}

export interface LifecycleOptions {
  readonly exitFn?: (code: number) => void;
  readonly startupTimeoutMs?: number;
  readonly shutdownTimeoutMs?: number;
}

export class Lifecycle {
  private state: LifecycleState;
  private readonly logger: KeplerLogger;
  private readonly startupHooks: LifecycleHook[];
  private readonly shutdownHooks: LifecycleHook[];
  private readonly exitFn: (code: number) => void;
  private readonly startupTimeoutMs: number;
  private readonly shutdownTimeoutMs: number;
  private signalHandlersAttached: boolean;
  private stopPromise?: Promise<void>;

  constructor(logger: KeplerLogger, options?: LifecycleOptions) {
    this.state = 'starting';
    this.logger = logger;
    this.startupHooks = [];
    this.shutdownHooks = [];
    this.exitFn = options?.exitFn ?? ((code: number) => process.exit(code));
    this.startupTimeoutMs = options?.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;
    this.shutdownTimeoutMs = options?.shutdownTimeoutMs ?? SHUTDOWN_TIMEOUT_MS;
    this.signalHandlersAttached = false;
  }

  public getState(): LifecycleState {
    return this.state;
  }

  public registerStartupHook(name: string, hook: () => Promise<void>): void {
    this.startupHooks.push({ name, hook });
  }

  public registerShutdownHook(name: string, hook: () => Promise<void>): void {
    this.shutdownHooks.push({ name, hook });
  }

  public async start(): Promise<void> {
    for (const { name, hook } of this.startupHooks) {
      const startTime = Date.now();
      this.logger.info(`Starting hook: ${name}`, { hook: name });

      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Startup hook ${name} timed out after ${this.startupTimeoutMs}ms`));
        }, this.startupTimeoutMs);
        timer.unref?.();
      });

      try {
        await Promise.race([hook(), timeoutPromise]);
        if (timer) {
          clearTimeout(timer);
        }
        const durationMs = Date.now() - startTime;
        this.logger.info(`Startup hook completed: ${name}`, { hook: name, durationMs });
      } catch (error) {
        if (timer) {
          clearTimeout(timer);
        }
        const durationMs = Date.now() - startTime;
        this.logger.fatal(`Startup hook failed: ${name}`, error, { hook: name, durationMs });
        this.exitFn(1);
        throw error;
      }
    }

    this.state = 'ready';
    this.logger.info('lifecycle_ready');
  }

  public async stop(reason: string): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.stopPromise = (async () => {
      if (this.state === 'stopped') {
        return;
      }

      this.state = 'shuttingDown';
      this.logger.info('lifecycle_stopping', { reason });

      const reversedHooks = [...this.shutdownHooks].reverse();
      for (const { name, hook } of reversedHooks) {
        const startTime = Date.now();
        this.logger.info(`Stopping hook: ${name}`, { hook: name });

        let timer: NodeJS.Timeout | undefined;
        let timedOut = false;
        const timeoutPromise = new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            timedOut = true;
            this.logger.warn(`Shutdown hook timed out: ${name}`, { hook: name, timeoutMs: this.shutdownTimeoutMs });
            resolve();
          }, this.shutdownTimeoutMs);
          timer.unref?.();
        });

        try {
          await Promise.race([
            hook().then(() => {
              if (timer) {
                clearTimeout(timer);
              }
            }),
            timeoutPromise
          ]);
          if (!timedOut) {
            const durationMs = Date.now() - startTime;
            this.logger.info(`Shutdown hook completed: ${name}`, { hook: name, durationMs });
          }
        } catch (error) {
          if (timer) {
            clearTimeout(timer);
          }
          const durationMs = Date.now() - startTime;
          this.logger.warn(`Shutdown hook failed: ${name}`, {
            hook: name,
            durationMs,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      this.state = 'stopped';
      this.logger.info('lifecycle_stopped', { reason });
    })();

    return this.stopPromise;
  }

  public attachSignalHandlers(logger?: KeplerLogger): void {
    if (this.signalHandlersAttached) {
      return;
    }
    this.signalHandlersAttached = true;
    const log = logger ?? this.logger;

    const handleSignal = async (signal: string): Promise<void> => {
      try {
        await this.stop(signal);
        this.exitFn(0);
      } catch (err) {
        log.fatal(`Error during ${signal} shutdown`, err);
        this.exitFn(1);
      }
    };

    process.once('SIGINT', () => {
      handleSignal('SIGINT');
    });

    process.once('SIGTERM', () => {
      handleSignal('SIGTERM');
    });

    process.once('uncaughtException', async (error: Error) => {
      try {
        log.fatal('uncaughtException', error);
        await this.stop('uncaughtException');
      } finally {
        this.exitFn(1);
      }
    });

    process.once('unhandledRejection', async (reason: unknown) => {
      try {
        log.fatal('unhandledRejection', reason);
        await this.stop('unhandledRejection');
      } finally {
        this.exitFn(1);
      }
    });
  }
}
