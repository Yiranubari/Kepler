import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { ConfigurationError, KeplerError } from '@kepler/shared';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type Environment = 'development' | 'test' | 'production';

export interface LoggerConfig {
  readonly level?: LogLevel | string;
  readonly logDir: string;
  readonly serviceName: string;
  readonly environment: Environment | string;
}

const customLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

const customColors = {
  fatal: 'red bold',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

winston.addColors(customColors);

export class KeplerLogger {
  public readonly serviceName: string;
  protected readonly winstonLogger: winston.Logger;

  constructor(serviceName: string, winstonLogger: winston.Logger) {
    this.serviceName = serviceName;
    this.winstonLogger = winstonLogger;
  }

  private extractErrorContext(error?: unknown, context?: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = context ? { ...context } : {};

    if (error === undefined || error === null) {
      return result;
    }

    if (error instanceof KeplerError) {
      result.error = {
        name: error.name,
        code: error.code,
        message: error.message,
        context: error.context,
        stack: error.stack
      };
      result.code = error.code;
      result.message = error.message;
      result.stack = error.stack;
      result.errorContext = error.context;
    } else if (error instanceof Error) {
      result.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
      result.name = error.name;
      result.message = error.message;
      result.stack = error.stack;
    } else {
      result.raw = typeof error === 'object' ? JSON.stringify(error) : String(error);
    }

    return result;
  }

  private fallbackWriteToStderr(level: string, message: string, context?: Record<string, unknown>): void {
    try {
      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        service: this.serviceName,
        message,
        context: context ?? {}
      });
      process.stderr.write(`${line}\n`);
    } catch {
      process.stderr.write(`${message}\n`);
    }
  }

  private writeLog(level: string, message: string, context?: Record<string, unknown>): void {
    try {
      this.winstonLogger.log({
        level,
        message,
        service: this.serviceName,
        context: context ?? {}
      });
    } catch {
      this.fallbackWriteToStderr(level, message, context);
    }
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.writeLog('debug', message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.writeLog('info', message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.writeLog('warn', message, context);
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const merged = this.extractErrorContext(error, context);
    this.writeLog('error', message, merged);
  }

  public fatal(message: string, error: unknown, context?: Record<string, unknown>): void {
    const merged = this.extractErrorContext(error, context);
    this.writeLog('fatal', message, merged);
  }
}

let rootLoggerInstance: Logger | undefined;

export class Logger extends KeplerLogger {
  private readonly childLoggers: Map<string, KeplerLogger>;

  constructor(config: LoggerConfig) {
    const targetDir = config.environment === 'test'
      ? (config.logDir.endsWith('/test') || config.logDir.endsWith('\\test')
          ? config.logDir
          : path.join(config.logDir, 'test'))
      : config.logDir;

    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (cause) {
      throw new ConfigurationError('Failed to create log directory', { path: targetDir }, cause instanceof Error ? cause : undefined);
    }

    try {
      fs.accessSync(targetDir, fs.constants.W_OK);
    } catch (cause) {
      throw new ConfigurationError('Log directory is not writable', { path: targetDir }, cause instanceof Error ? cause : undefined);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const logFileName = `kepler-${dateStr}-${process.pid}.log`;
    const logFilePath = path.join(targetDir, logFileName);

    const consoleFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => {
        const ctx = info['context'] as Record<string, unknown> | undefined;
        const ctxStr = ctx && Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : '';
        return `${info.timestamp} [${info.level}] [${info['service'] ?? config.serviceName}]: ${info.message}${ctxStr}`;
      })
    );

    const fileFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        return JSON.stringify({
          timestamp: info.timestamp,
          level: info.level,
          service: info['service'] ?? config.serviceName,
          message: info.message,
          context: info['context'] ?? {}
        });
      })
    );

    const consoleTransport = new winston.transports.Console({
      format: consoleFormat,
      stderrLevels: ['fatal', 'error', 'warn']
    });

    const fileTransport = new winston.transports.File({
      filename: logFilePath,
      format: fileFormat
    });

    const effectiveLevel = config.level ?? process.env.LOG_LEVEL ?? 'info';
    const winstonLogger = winston.createLogger({
      levels: customLevels,
      level: effectiveLevel,
      transports: [consoleTransport, fileTransport]
    });

    super(config.serviceName, winstonLogger);
    this.childLoggers = new Map<string, KeplerLogger>();
    if (!rootLoggerInstance) {
      rootLoggerInstance = this;
    }
  }

  public getLogger(serviceName: string): KeplerLogger {
    const existing = this.childLoggers.get(serviceName);
    if (existing) {
      return existing;
    }
    const child = new KeplerLogger(serviceName, this.winstonLogger);
    this.childLoggers.set(serviceName, child);
    return child;
  }
}

export function setRootLogger(logger: Logger): void {
  rootLoggerInstance = logger;
}

export function getLogger(serviceName: string): KeplerLogger {
  if (!rootLoggerInstance) {
    const logDir = process.env.LOG_DIR || 'logs';
    const level = process.env.LOG_LEVEL || 'info';
    const environment = process.env.NODE_ENV || 'test';
    rootLoggerInstance = new Logger({
      level,
      logDir,
      serviceName: 'kepler',
      environment
    });
  }
  return rootLoggerInstance.getLogger(serviceName);
}
