import { z } from 'zod';
import { BitcoinConfigError } from './errors';

export type BitcoinNetwork = 'mainnet' | 'testnet' | 'regtest';

export interface BitcoinConfigParams {
  readonly primaryUrl: string;
  readonly fallbackUrl: string;
  readonly network: BitcoinNetwork;
}

export class BitcoinConfig {
  private static readonly URL_SCHEMA = z.string()
    .trim()
    .min(1)
    .url()
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    });

  private static readonly NETWORK_SCHEMA = z.enum(['mainnet', 'testnet', 'regtest']);

  private readonly _primaryUrl: string;
  private readonly _fallbackUrl: string;
  private readonly _network: BitcoinNetwork;

  constructor(params: BitcoinConfigParams) {
    const primaryUrlResult = BitcoinConfig.URL_SCHEMA.safeParse(params.primaryUrl);
    if (!primaryUrlResult.success) {
      throw new BitcoinConfigError('Invalid ESPLORA_URL: must be a non-empty http or https URL', {
        variable: 'ESPLORA_URL',
        reason: primaryUrlResult.error.message
      });
    }

    const fallbackUrlResult = BitcoinConfig.URL_SCHEMA.safeParse(params.fallbackUrl);
    if (!fallbackUrlResult.success) {
      throw new BitcoinConfigError('Invalid ESPLORA_FALLBACK_URL: must be a non-empty http or https URL', {
        variable: 'ESPLORA_FALLBACK_URL',
        reason: fallbackUrlResult.error.message
      });
    }

    const networkResult = BitcoinConfig.NETWORK_SCHEMA.safeParse(params.network);
    if (!networkResult.success) {
      throw new BitcoinConfigError('Invalid BITCOIN_NETWORK: must be mainnet, testnet, or regtest', {
        variable: 'BITCOIN_NETWORK',
        reason: networkResult.error.message
      });
    }

    this._primaryUrl = primaryUrlResult.data;
    this._fallbackUrl = fallbackUrlResult.data;
    this._network = networkResult.data;
  }

  public get primaryUrl(): string {
    return this._primaryUrl;
  }

  public get fallbackUrl(): string {
    return this._fallbackUrl;
  }

  public get network(): BitcoinNetwork {
    return this._network;
  }

  public static fromEnv(env: Record<string, string | undefined> = process.env): BitcoinConfig {
    const primaryRaw = env['ESPLORA_URL'];
    const primaryResult = BitcoinConfig.URL_SCHEMA.safeParse(primaryRaw);
    if (!primaryResult.success) {
      throw new BitcoinConfigError('Invalid or missing ESPLORA_URL: must be a non-empty http or https URL', {
        variable: 'ESPLORA_URL',
        reason: primaryResult.error.message
      });
    }

    const fallbackRaw = env['ESPLORA_FALLBACK_URL'];
    const fallbackResult = BitcoinConfig.URL_SCHEMA.safeParse(fallbackRaw);
    if (!fallbackResult.success) {
      throw new BitcoinConfigError('Invalid or missing ESPLORA_FALLBACK_URL: must be a non-empty http or https URL', {
        variable: 'ESPLORA_FALLBACK_URL',
        reason: fallbackResult.error.message
      });
    }

    const networkRaw = env['BITCOIN_NETWORK'];
    const networkResult = BitcoinConfig.NETWORK_SCHEMA.safeParse(networkRaw);
    if (!networkResult.success) {
      throw new BitcoinConfigError('Invalid or missing BITCOIN_NETWORK: must be mainnet, testnet, or regtest', {
        variable: 'BITCOIN_NETWORK',
        reason: networkResult.error.message
      });
    }

    return new BitcoinConfig({
      primaryUrl: primaryResult.data,
      fallbackUrl: fallbackResult.data,
      network: networkResult.data
    });
  }
}
