import { z } from 'zod';
import { CashuConfigError } from './errors';

export type CashuUnit = 'sat' | 'msat';

export interface CashuConfigParams {
  readonly mintUrl: string;
  readonly fallbackMintUrl?: string | null;
  readonly unit?: CashuUnit;
  readonly requestTimeoutMs?: number;
}

export class CashuConfig {
  public static readonly DEFAULT_REQUEST_TIMEOUT_MS: number = 15_000;
  public static readonly DEFAULT_UNIT: CashuUnit = 'sat';

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
    }, {
      message: 'Mint URL must use http or https protocol'
    });

  private static readonly UNIT_SCHEMA = z.enum(['sat', 'msat']);

  private static readonly TIMEOUT_SCHEMA = z.number().int().positive();

  private readonly _mintUrl: string;
  private readonly _fallbackMintUrl: string | null;
  private readonly _unit: CashuUnit;
  private readonly _requestTimeoutMs: number;

  constructor(params: CashuConfigParams) {
    const mintUrlResult = CashuConfig.URL_SCHEMA.safeParse(params.mintUrl);
    if (!mintUrlResult.success) {
      throw new CashuConfigError('Invalid mintUrl: must be a valid http or https URL', {
        variable: 'CASHU_MINT_URL',
        field: 'mintUrl',
        reason: mintUrlResult.error.message
      });
    }

    let fallbackMintUrl: string | null = null;
    if (params.fallbackMintUrl !== undefined && params.fallbackMintUrl !== null) {
      const fallbackResult = CashuConfig.URL_SCHEMA.safeParse(params.fallbackMintUrl);
      if (!fallbackResult.success) {
        throw new CashuConfigError('Invalid fallbackMintUrl: must be a valid http or https URL', {
          variable: 'CASHU_MINT_URL_FALLBACK',
          field: 'fallbackMintUrl',
          reason: fallbackResult.error.message
        });
      }
      fallbackMintUrl = fallbackResult.data;
    }

    let unit: CashuUnit = CashuConfig.DEFAULT_UNIT;
    if (params.unit !== undefined) {
      const unitResult = CashuConfig.UNIT_SCHEMA.safeParse(params.unit);
      if (!unitResult.success) {
        throw new CashuConfigError('Invalid unit: must be sat or msat', {
          variable: 'CASHU_UNIT',
          field: 'unit',
          reason: unitResult.error.message
        });
      }
      unit = unitResult.data;
    }

    let requestTimeoutMs: number = CashuConfig.DEFAULT_REQUEST_TIMEOUT_MS;
    if (params.requestTimeoutMs !== undefined) {
      const timeoutResult = CashuConfig.TIMEOUT_SCHEMA.safeParse(params.requestTimeoutMs);
      if (!timeoutResult.success) {
        throw new CashuConfigError('Invalid requestTimeoutMs: must be a positive integer', {
          variable: 'CASHU_REQUEST_TIMEOUT_MS',
          field: 'requestTimeoutMs',
          reason: timeoutResult.error.message
        });
      }
      requestTimeoutMs = timeoutResult.data;
    }

    this._mintUrl = mintUrlResult.data;
    this._fallbackMintUrl = fallbackMintUrl;
    this._unit = unit;
    this._requestTimeoutMs = requestTimeoutMs;
  }

  public get mintUrl(): string {
    return this._mintUrl;
  }

  public get fallbackMintUrl(): string | null {
    return this._fallbackMintUrl;
  }

  public get unit(): CashuUnit {
    return this._unit;
  }

  public get requestTimeoutMs(): number {
    return this._requestTimeoutMs;
  }

  public static fromEnv(env: Record<string, string | undefined> = process.env): CashuConfig {
    const rawMintUrl = env['CASHU_MINT_URL'];
    if (!rawMintUrl || rawMintUrl.trim() === '') {
      throw new CashuConfigError('Invalid or missing CASHU_MINT_URL: must be a non-empty http or https URL', {
        variable: 'CASHU_MINT_URL',
        field: 'CASHU_MINT_URL',
        reason: 'Missing required environment variable CASHU_MINT_URL'
      });
    }

    const mintUrlResult = CashuConfig.URL_SCHEMA.safeParse(rawMintUrl);
    if (!mintUrlResult.success) {
      throw new CashuConfigError('Invalid CASHU_MINT_URL: must be a valid http or https URL', {
        variable: 'CASHU_MINT_URL',
        field: 'mintUrl',
        reason: mintUrlResult.error.message
      });
    }

    const rawFallbackUrl = env['CASHU_MINT_URL_FALLBACK'];
    let fallbackMintUrl: string | null = null;
    if (rawFallbackUrl !== undefined && rawFallbackUrl.trim() !== '') {
      const fallbackResult = CashuConfig.URL_SCHEMA.safeParse(rawFallbackUrl);
      if (!fallbackResult.success) {
        throw new CashuConfigError('Invalid CASHU_MINT_URL_FALLBACK: must be a valid http or https URL', {
          variable: 'CASHU_MINT_URL_FALLBACK',
          field: 'fallbackMintUrl',
          reason: fallbackResult.error.message
        });
      }
      fallbackMintUrl = fallbackResult.data;
    }

    let unit: CashuUnit = CashuConfig.DEFAULT_UNIT;
    const rawUnit = env['CASHU_UNIT'];
    if (rawUnit !== undefined) {
      const unitResult = CashuConfig.UNIT_SCHEMA.safeParse(rawUnit);
      if (!unitResult.success) {
        throw new CashuConfigError('Invalid CASHU_UNIT: must be sat or msat', {
          variable: 'CASHU_UNIT',
          field: 'unit',
          reason: unitResult.error.message
        });
      }
      unit = unitResult.data;
    }

    let requestTimeoutMs: number = CashuConfig.DEFAULT_REQUEST_TIMEOUT_MS;
    const rawTimeout = env['CASHU_REQUEST_TIMEOUT_MS'];
    if (rawTimeout !== undefined) {
      const trimmed = rawTimeout.trim();
      if (trimmed === '') {
        throw new CashuConfigError('Invalid CASHU_REQUEST_TIMEOUT_MS: must be a positive integer', {
          variable: 'CASHU_REQUEST_TIMEOUT_MS',
          field: 'requestTimeoutMs',
          reason: 'Empty string is not a valid number'
        });
      }
      const parsedTimeout = Number(trimmed);
      const timeoutResult = CashuConfig.TIMEOUT_SCHEMA.safeParse(parsedTimeout);
      if (!timeoutResult.success) {
        throw new CashuConfigError('Invalid CASHU_REQUEST_TIMEOUT_MS: must be a positive integer', {
          variable: 'CASHU_REQUEST_TIMEOUT_MS',
          field: 'requestTimeoutMs',
          reason: timeoutResult.error.message
        });
      }
      requestTimeoutMs = timeoutResult.data;
    }

    return new CashuConfig({
      mintUrl: mintUrlResult.data,
      fallbackMintUrl,
      unit,
      requestTimeoutMs
    });
  }
}
