import { z } from 'zod';
import { getPublicKey, nip19 } from 'nostr-tools';
import { NostrConfigError } from './errors';

export interface NostrConfigParams {
  readonly privateKey: string;
  readonly relays: readonly string[] | string;
  readonly timeoutMs?: number;
  readonly publishTimeoutMs?: number;
  readonly subscriptionLimit?: number;
}

export class NostrConfig {
  public static readonly DEFAULT_TIMEOUT_MS: number = 15_000;
  public static readonly DEFAULT_PUBLISH_TIMEOUT_MS: number = 5_000;
  public static readonly DEFAULT_SUBSCRIPTION_LIMIT: number = 500;

  private static readonly PRIVATE_KEY_SCHEMA = z.string()
    .trim()
    .regex(/^[0-9a-fA-F]{64}$/, {
      message: 'Private key must be a 64-character hexadecimal string'
    });

  private static readonly RELAY_URL_SCHEMA = z.string()
    .trim()
    .min(1)
    .url()
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'wss:';
      } catch {
        return false;
      }
    }, {
      message: 'Relay URL must use the wss:// protocol'
    });

  private static readonly RELAYS_ARRAY_SCHEMA = z.array(NostrConfig.RELAY_URL_SCHEMA).min(1, {
    message: 'At least one valid wss:// relay URL is required'
  });

  private static readonly POSITIVE_INT_SCHEMA = z.number().int().positive();

  private readonly _privateKey: string;
  private readonly _publicKey: string;
  private readonly _npub: string;
  private readonly _relays: readonly string[];
  private readonly _timeoutMs: number;
  private readonly _publishTimeoutMs: number;
  private readonly _subscriptionLimit: number;

  constructor(params: NostrConfigParams) {
    const keyResult = NostrConfig.PRIVATE_KEY_SCHEMA.safeParse(params.privateKey);
    if (!keyResult.success) {
      throw new NostrConfigError('Invalid or missing private key: must be a 64-character hexadecimal string', {
        field: 'privateKey',
        reason: keyResult.error.message
      });
    }

    const privateKey = keyResult.data.toLowerCase();

    let derivedPublicKey = '';
    let derivedNpub = '';
    try {
      const secretKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'hex'));
      derivedPublicKey = getPublicKey(secretKeyBytes);
      derivedNpub = nip19.npubEncode(derivedPublicKey);
    } catch (err: unknown) {
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new NostrConfigError('Failed to derive public key from private key', {
        field: 'privateKey',
        reason: cause.message
      }, cause);
    }

    let parsedRelays: string[];
    if (typeof params.relays === 'string') {
      const trimmed = params.relays.trim();
      if (trimmed === '') {
        throw new NostrConfigError('Invalid or missing relays: must provide at least one wss:// URL', {
          field: 'relays',
          reason: 'Relays string is empty'
        });
      }
      parsedRelays = trimmed.split(',').map((r) => r.trim()).filter((r) => r.length > 0);
    } else if (Array.isArray(params.relays)) {
      parsedRelays = params.relays.map((r) => typeof r === 'string' ? r.trim() : r);
    } else {
      throw new NostrConfigError('Invalid relays: must be an array or comma-separated string of wss:// URLs', {
        field: 'relays',
        reason: 'Relays must be an array or comma-separated string'
      });
    }

    const relaysResult = NostrConfig.RELAYS_ARRAY_SCHEMA.safeParse(parsedRelays);
    if (!relaysResult.success) {
      throw new NostrConfigError('Invalid relays: must be a list containing at least one valid wss:// URL', {
        field: 'relays',
        reason: relaysResult.error.message
      });
    }

    let timeoutMs = NostrConfig.DEFAULT_TIMEOUT_MS;
    if (params.timeoutMs !== undefined) {
      const timeoutResult = NostrConfig.POSITIVE_INT_SCHEMA.safeParse(params.timeoutMs);
      if (!timeoutResult.success) {
        throw new NostrConfigError('Invalid timeoutMs: must be a positive integer', {
          field: 'timeoutMs',
          reason: timeoutResult.error.message
        });
      }
      timeoutMs = timeoutResult.data;
    }

    let publishTimeoutMs = NostrConfig.DEFAULT_PUBLISH_TIMEOUT_MS;
    if (params.publishTimeoutMs !== undefined) {
      const publishTimeoutResult = NostrConfig.POSITIVE_INT_SCHEMA.safeParse(params.publishTimeoutMs);
      if (!publishTimeoutResult.success) {
        throw new NostrConfigError('Invalid publishTimeoutMs: must be a positive integer', {
          field: 'publishTimeoutMs',
          reason: publishTimeoutResult.error.message
        });
      }
      publishTimeoutMs = publishTimeoutResult.data;
    }

    let subscriptionLimit = NostrConfig.DEFAULT_SUBSCRIPTION_LIMIT;
    if (params.subscriptionLimit !== undefined) {
      const subscriptionLimitResult = NostrConfig.POSITIVE_INT_SCHEMA.safeParse(params.subscriptionLimit);
      if (!subscriptionLimitResult.success) {
        throw new NostrConfigError('Invalid subscriptionLimit: must be a positive integer', {
          field: 'subscriptionLimit',
          reason: subscriptionLimitResult.error.message
        });
      }
      subscriptionLimit = subscriptionLimitResult.data;
    }

    this._privateKey = privateKey;
    this._publicKey = derivedPublicKey;
    this._npub = derivedNpub;
    this._relays = Object.freeze(relaysResult.data);
    this._timeoutMs = timeoutMs;
    this._publishTimeoutMs = publishTimeoutMs;
    this._subscriptionLimit = subscriptionLimit;
  }

  public get privateKey(): string {
    return this._privateKey;
  }

  public get publicKey(): string {
    return this._publicKey;
  }

  public get npub(): string {
    return this._npub;
  }

  public get relays(): string[] {
    return [...this._relays];
  }

  public get timeoutMs(): number {
    return this._timeoutMs;
  }

  public get publishTimeoutMs(): number {
    return this._publishTimeoutMs;
  }

  public get subscriptionLimit(): number {
    return this._subscriptionLimit;
  }

  public toJSON(): Record<string, unknown> {
    return {
      publicKey: this._publicKey,
      npub: this._npub,
      relays: [...this._relays],
      timeoutMs: this._timeoutMs,
      publishTimeoutMs: this._publishTimeoutMs,
      subscriptionLimit: this._subscriptionLimit
    };
  }

  public [Symbol.for('nodejs.util.inspect.custom')](): Record<string, unknown> {
    return {
      privateKey: '[REDACTED]',
      publicKey: this._publicKey,
      npub: this._npub,
      relays: [...this._relays],
      timeoutMs: this._timeoutMs,
      publishTimeoutMs: this._publishTimeoutMs,
      subscriptionLimit: this._subscriptionLimit
    };
  }

  public static fromEnv(env: Record<string, string | undefined> = process.env): NostrConfig {
    const rawPrivateKey = env['NOSTR_PRIVATE_KEY'];
    const keyResult = NostrConfig.PRIVATE_KEY_SCHEMA.safeParse(rawPrivateKey);
    if (!keyResult.success) {
      throw new NostrConfigError('Invalid or missing NOSTR_PRIVATE_KEY: must be a 64-character hexadecimal string', {
        variable: 'NOSTR_PRIVATE_KEY',
        field: 'NOSTR_PRIVATE_KEY',
        reason: keyResult.error.message
      });
    }

    const rawRelays = env['NOSTR_RELAYS'];
    if (!rawRelays || rawRelays.trim() === '') {
      throw new NostrConfigError('Invalid or missing NOSTR_RELAYS: must be a comma-separated list of wss:// URLs', {
        variable: 'NOSTR_RELAYS',
        field: 'NOSTR_RELAYS',
        reason: 'Missing or empty NOSTR_RELAYS environment variable'
      });
    }

    const relayList = rawRelays.split(',').map((r) => r.trim()).filter((r) => r.length > 0);
    const relaysResult = NostrConfig.RELAYS_ARRAY_SCHEMA.safeParse(relayList);
    if (!relaysResult.success) {
      throw new NostrConfigError('Invalid or missing NOSTR_RELAYS: must contain at least one valid wss:// URL', {
        variable: 'NOSTR_RELAYS',
        field: 'NOSTR_RELAYS',
        reason: relaysResult.error.message
      });
    }

    let timeoutMs: number | undefined;
    const rawTimeout = env['NOSTR_TIMEOUT_MS'];
    if (rawTimeout !== undefined && rawTimeout.trim() !== '') {
      const parsedTimeout = Number(rawTimeout);
      const timeoutResult = NostrConfig.POSITIVE_INT_SCHEMA.safeParse(parsedTimeout);
      if (!timeoutResult.success) {
        throw new NostrConfigError('Invalid NOSTR_TIMEOUT_MS: must be a positive integer', {
          variable: 'NOSTR_TIMEOUT_MS',
          field: 'NOSTR_TIMEOUT_MS',
          reason: timeoutResult.error.message
        });
      }
      timeoutMs = timeoutResult.data;
    }

    let publishTimeoutMs: number | undefined;
    const rawPublishTimeout = env['NOSTR_PUBLISH_TIMEOUT_MS'];
    if (rawPublishTimeout !== undefined && rawPublishTimeout.trim() !== '') {
      const parsedPublishTimeout = Number(rawPublishTimeout);
      const publishTimeoutResult = NostrConfig.POSITIVE_INT_SCHEMA.safeParse(parsedPublishTimeout);
      if (!publishTimeoutResult.success) {
        throw new NostrConfigError('Invalid NOSTR_PUBLISH_TIMEOUT_MS: must be a positive integer', {
          variable: 'NOSTR_PUBLISH_TIMEOUT_MS',
          field: 'NOSTR_PUBLISH_TIMEOUT_MS',
          reason: publishTimeoutResult.error.message
        });
      }
      publishTimeoutMs = publishTimeoutResult.data;
    }

    let subscriptionLimit: number | undefined;
    const rawSubscriptionLimit = env['NOSTR_SUBSCRIPTION_LIMIT'];
    if (rawSubscriptionLimit !== undefined && rawSubscriptionLimit.trim() !== '') {
      const parsedSubscriptionLimit = Number(rawSubscriptionLimit);
      const subscriptionLimitResult = NostrConfig.POSITIVE_INT_SCHEMA.safeParse(parsedSubscriptionLimit);
      if (!subscriptionLimitResult.success) {
        throw new NostrConfigError('Invalid NOSTR_SUBSCRIPTION_LIMIT: must be a positive integer', {
          variable: 'NOSTR_SUBSCRIPTION_LIMIT',
          field: 'NOSTR_SUBSCRIPTION_LIMIT',
          reason: subscriptionLimitResult.error.message
        });
      }
      subscriptionLimit = subscriptionLimitResult.data;
    }

    try {
      return new NostrConfig({
        privateKey: keyResult.data,
        relays: relaysResult.data,
        timeoutMs,
        publishTimeoutMs,
        subscriptionLimit
      });
    } catch (err: unknown) {
      if (err instanceof NostrConfigError) {
        const variableName = NostrConfig.resolveVariableName(err.context['field']);
        if (variableName) {
          throw new NostrConfigError(err.message, {
            ...err.context,
            variable: variableName
          }, err.cause instanceof Error ? err.cause : undefined);
        }
      }
      throw err;
    }
  }

  private static resolveVariableName(field: unknown): string | undefined {
    switch (field) {
      case 'privateKey':
        return 'NOSTR_PRIVATE_KEY';
      case 'relays':
        return 'NOSTR_RELAYS';
      case 'timeoutMs':
        return 'NOSTR_TIMEOUT_MS';
      case 'publishTimeoutMs':
        return 'NOSTR_PUBLISH_TIMEOUT_MS';
      case 'subscriptionLimit':
        return 'NOSTR_SUBSCRIPTION_LIMIT';
      default:
        return undefined;
    }
  }
}
