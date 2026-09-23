import { ValidationError } from '@kepler/shared';
import { RateLimitScope } from '../config/constants';

export interface RateLimiterConfig {
  readonly read: { limit: number; windowMs: number };
  readonly propose: { limit: number; windowMs: number };
  readonly send: { limit: number; windowMs: number };
  readonly publish: { limit: number; windowMs: number };
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  readonly retryAfterMs: number;
  readonly resetAt: number;
}

export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly buckets: Map<string, number[]>;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.buckets = new Map();
  }

  public check(scope: RateLimitScope | string, key: string): RateLimitDecision {
    const scopeConfig = this.config[scope as RateLimitScope];
    if (!scopeConfig) {
      throw new ValidationError(`Unknown rate limit scope: ${scope}`, { field: 'scope', receivedValue: scope });
    }
    const { limit, windowMs } = scopeConfig;
    const bucketKey = `${scope}:${key}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    const existing = this.buckets.get(bucketKey) ?? [];
    const active = existing.filter((ts) => ts > cutoff);

    if (active.length >= limit) {
      const oldestInWindow = active[0];
      const retryAfterMs = oldestInWindow + windowMs - now;
      const resetAt = oldestInWindow + windowMs;
      this.buckets.set(bucketKey, active);
      return {
        allowed: false,
        remaining: 0,
        limit,
        retryAfterMs: Math.max(0, retryAfterMs),
        resetAt
      };
    }

    active.push(now);
    this.buckets.set(bucketKey, active);

    const resetAt = active[0] + windowMs;
    return {
      allowed: true,
      remaining: limit - active.length,
      limit,
      retryAfterMs: 0,
      resetAt
    };
  }

  public reset(scope: RateLimitScope | string, key: string): void {
    const bucketKey = `${scope}:${key}`;
    this.buckets.delete(bucketKey);
  }

  public snapshot(): Record<string, { count: number; windowMs: number }> {
    const now = Date.now();
    const result: Record<string, { count: number; windowMs: number }> = {};
    for (const [bucketKey, timestamps] of this.buckets.entries()) {
      const scopeName = bucketKey.split(':')[0] as RateLimitScope;
      const scopeConfig = this.config[scopeName];
      if (!scopeConfig) {
        continue;
      }
      const cutoff = now - scopeConfig.windowMs;
      const active = timestamps.filter((ts) => ts > cutoff);
      result[bucketKey] = { count: active.length, windowMs: scopeConfig.windowMs };
    }
    return result;
  }
}
