import { z } from 'zod';
import { nip47 } from 'nostr-tools';
import { LightningConfigError } from './errors';

export interface LightningConfigParams {
  readonly connectionString: string;
  readonly requestTimeoutMs?: number;
}

export class LightningConfig {
  public static readonly DEFAULT_REQUEST_TIMEOUT_MS: number = 30_000;
  private static readonly SCHEME_PREFIX: string = 'nostr+walletconnect://';

  private static readonly CONNECTION_STRING_SCHEMA = z.string()
    .trim()
    .min(1)
    .refine((val) => val.startsWith(LightningConfig.SCHEME_PREFIX), {
      message: 'Connection string must start with nostr+walletconnect://'
    });

  private static readonly TIMEOUT_SCHEMA = z.number().int().positive();

  private readonly _connectionString: string;
  private readonly _walletPubkey: string;
  private readonly _relayUrl: string;
  private readonly _secret: string;
  private readonly _requestTimeoutMs: number;

  constructor(params: LightningConfigParams) {
    const stringResult = LightningConfig.CONNECTION_STRING_SCHEMA.safeParse(params.connectionString);
    if (!stringResult.success) {
      throw new LightningConfigError('Invalid or missing NWC_CONNECTION_STRING: must be a non-empty string starting with nostr+walletconnect://', {
        variable: 'NWC_CONNECTION_STRING',
        field: 'connectionString',
        reason: stringResult.error.message
      });
    }

    const connectionString = stringResult.data;
    let parsedPubkey = '';
    let parsedRelay = '';
    let parsedSecret = '';

    try {
      const parsed = nip47.parseConnectionString(connectionString);
      parsedPubkey = parsed.pubkey;
      parsedRelay = parsed.relay;
      parsedSecret = parsed.secret;
    } catch (parseErr: unknown) {
      const cause = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      const diagnosis = LightningConfig.diagnoseOffendingField(connectionString);
      throw new LightningConfigError(`Failed to parse NWC connection string: ${diagnosis.reason}`, {
        variable: 'NWC_CONNECTION_STRING',
        field: diagnosis.field,
        reason: diagnosis.reason
      }, cause);
    }

    if (!parsedPubkey) {
      throw new LightningConfigError('Failed to parse NWC connection string: missing pubkey', {
        variable: 'NWC_CONNECTION_STRING',
        field: 'pubkey',
        reason: 'Missing wallet pubkey'
      });
    }

    if (!parsedRelay) {
      throw new LightningConfigError('Failed to parse NWC connection string: missing relay', {
        variable: 'NWC_CONNECTION_STRING',
        field: 'relay',
        reason: 'Missing relay URL'
      });
    }

    if (!parsedSecret) {
      throw new LightningConfigError('Failed to parse NWC connection string: missing secret', {
        variable: 'NWC_CONNECTION_STRING',
        field: 'secret',
        reason: 'Missing secret'
      });
    }

    let timeoutMs = LightningConfig.DEFAULT_REQUEST_TIMEOUT_MS;
    if (params.requestTimeoutMs !== undefined) {
      const timeoutResult = LightningConfig.TIMEOUT_SCHEMA.safeParse(params.requestTimeoutMs);
      if (!timeoutResult.success) {
        throw new LightningConfigError('Invalid requestTimeoutMs: must be a positive integer', {
          variable: 'NWC_TIMEOUT_MS',
          field: 'requestTimeoutMs',
          reason: timeoutResult.error.message
        });
      }
      timeoutMs = timeoutResult.data;
    }

    this._connectionString = connectionString;
    this._walletPubkey = parsedPubkey;
    this._relayUrl = parsedRelay;
    this._secret = parsedSecret;
    this._requestTimeoutMs = timeoutMs;
  }

  public get connectionString(): string {
    return this._connectionString;
  }

  public get walletPubkey(): string {
    return this._walletPubkey;
  }

  public get relayUrl(): string {
    return this._relayUrl;
  }

  public get secret(): string {
    return this._secret;
  }

  public get requestTimeoutMs(): number {
    return this._requestTimeoutMs;
  }

  private static diagnoseOffendingField(connectionString: string): { field: string; reason: string } {
    try {
      const parsedUrl = new URL(connectionString);
      const pubkey = parsedUrl.pathname.replace(/^\/+/, '') || parsedUrl.host;
      if (!pubkey) {
        return { field: 'pubkey', reason: 'Missing wallet pubkey in connection string' };
      }
      const relays = parsedUrl.searchParams.getAll('relay');
      if (relays.length === 0 || !relays[0]) {
        return { field: 'relay', reason: 'Missing relay query parameter in connection string' };
      }
      const secret = parsedUrl.searchParams.get('secret');
      if (!secret) {
        return { field: 'secret', reason: 'Missing secret query parameter in connection string' };
      }
      return { field: 'connectionString', reason: 'Invalid connection string' };
    } catch {
      return { field: 'connectionString', reason: 'Invalid connection string URL structure' };
    }
  }

  public static fromEnv(env: Record<string, string | undefined> = process.env): LightningConfig {
    const rawConnectionString = env['NWC_CONNECTION_STRING'];
    const connectionStringResult = LightningConfig.CONNECTION_STRING_SCHEMA.safeParse(rawConnectionString);
    if (!connectionStringResult.success) {
      throw new LightningConfigError('Invalid or missing NWC_CONNECTION_STRING: must be a non-empty string starting with nostr+walletconnect://', {
        variable: 'NWC_CONNECTION_STRING',
        field: 'connectionString',
        reason: connectionStringResult.error.message
      });
    }

    let timeoutMs: number | undefined;
    const rawTimeout = env['NWC_TIMEOUT_MS'];
    if (rawTimeout !== undefined && rawTimeout.trim() !== '') {
      const parsedTimeout = Number(rawTimeout);
      const timeoutResult = LightningConfig.TIMEOUT_SCHEMA.safeParse(parsedTimeout);
      if (!timeoutResult.success) {
        throw new LightningConfigError('Invalid NWC_TIMEOUT_MS: must be a positive integer', {
          variable: 'NWC_TIMEOUT_MS',
          field: 'requestTimeoutMs',
          reason: timeoutResult.error.message
        });
      }
      timeoutMs = timeoutResult.data;
    }

    return new LightningConfig({
      connectionString: connectionStringResult.data,
      requestTimeoutMs: timeoutMs
    });
  }
}
