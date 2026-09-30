import { createHash } from 'node:crypto';
import { CanonicalJson } from '@kepler/shared';
import { AICompletionResponse } from './providers/provider.interface';

export interface AICacheEntry {
  readonly value: AICompletionResponse;
  readonly expiresAt: number;
}

export class AICache {
  private readonly entries: Map<string, AICacheEntry>;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.entries = new Map<string, AICacheEntry>();
  }

  public get(key: string): AICompletionResponse | null {
    this.evictExpired();
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    return entry.value;
  }

  public set(key: string, value: AICompletionResponse): void {
    this.evictExpired();

    if (this.maxEntries <= 0) {
      return;
    }

    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else {
      while (this.entries.size >= this.maxEntries) {
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        this.entries.delete(oldestKey);
      }
    }

    const now = Date.now();
    this.entries.set(key, {
      value,
      expiresAt: now + this.ttlMs
    });
  }

  public static keyFromRequest(endpoint: string, payload: unknown): string {
    const serialized = CanonicalJson.stringify(payload);
    return createHash('sha256')
      .update(`${endpoint}:${serialized}`)
      .digest('hex');
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now >= entry.expiresAt) {
        this.entries.delete(key);
      }
    }
  }
}
