import crypto from 'node:crypto';
import type { KeplerLogger } from '@kepler/shared';
import { CashuMint, CashuWallet, type Proof, type MeltQuoteResponse } from '@cashu/cashu-ts';
import { CashuConfig } from './config';
import {
  CashuConfigError,
  CashuNetworkError,
  CashuMintError,
  CashuMeltError,
  CashuSwapError,
  CashuTokenError,
  CashuParseError
} from './errors';
import {
  CashuMintInfo,
  CashuProof,
  CashuToken,
  CashuMintQuote,
  CashuMeltQuote,
  CashuMintResult,
  CashuMeltResult,
  CashuSwapResult,
  CashuWireMintInfoSchema,
  CashuMintInfoSchema,
  CashuWireMintQuoteSchema,
  CashuMintQuoteSchema,
  CashuMintQuoteStateSchema
} from './types';

export class CashuClient {
  private readonly _config: CashuConfig;
  private readonly _logger: KeplerLogger;
  private _mint: CashuMint | null = null;
  private _wallet: CashuWallet | null = null;

  constructor(config: CashuConfig, logger: KeplerLogger) {
    this._config = config;
    this._logger = logger;
  }

  private getMint(url?: string): CashuMint {
    if (url && url !== this._config.mintUrl) {
      return new CashuMint(url);
    }
    if (!this._mint) {
      this._mint = new CashuMint(this._config.mintUrl);
    }
    return this._mint;
  }

  private getWallet(): CashuWallet {
    if (!this._wallet) {
      const mint = this.getMint();
      this._wallet = new CashuWallet(mint, { unit: this._config.unit });
    }
    return this._wallet;
  }

  private async withTimeout<T>(
    operationName: string,
    url: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const timeoutMs = this._config.requestTimeoutMs;
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new CashuNetworkError(`Operation ${operationName} timed out after ${timeoutMs}ms`, {
            method: operationName,
            url,
            timeoutMs
          })
        );
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      return result;
    } catch (err: unknown) {
      if (
        err instanceof CashuNetworkError ||
        err instanceof CashuMintError ||
        err instanceof CashuMeltError ||
        err instanceof CashuSwapError ||
        err instanceof CashuTokenError ||
        err instanceof CashuParseError ||
        err instanceof CashuConfigError
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('aborted')) {
        throw new CashuNetworkError(`Operation ${operationName} timed out after ${timeoutMs}ms`, {
          method: operationName,
          url,
          timeoutMs
        }, err instanceof Error ? err : undefined);
      }
      if (message.toLowerCase().includes('fetch failed') || message.toLowerCase().includes('econnrefused') || message.toLowerCase().includes('network')) {
        throw new CashuNetworkError(`Network transport failure during ${operationName}: ${message}`, {
          method: operationName,
          url,
          reason: message
        }, err instanceof Error ? err : undefined);
      }
      throw err;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  public async getMintInfo(url?: string): Promise<CashuMintInfo> {
    const targetUrl = url ?? this._config.mintUrl;
    const start = Date.now();
    const mint = this.getMint(targetUrl);

    let rawInfo: unknown;
    try {
      rawInfo = await this.withTimeout('getMintInfo', targetUrl, () => mint.getInfo());
    } catch (err: unknown) {
      if (err instanceof CashuNetworkError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuNetworkError(`Failed to fetch mint info from ${targetUrl}: ${cause.message}`, {
        method: 'getMintInfo',
        url: targetUrl,
        reason: cause.message
      }, cause);
    }

    const wireResult = CashuWireMintInfoSchema.safeParse(rawInfo);
    if (!wireResult.success) {
      throw new CashuParseError(`Invalid mint info response shape: ${wireResult.error.message}`, {
        url: targetUrl,
        reason: wireResult.error.message
      });
    }

    const wireData = wireResult.data;
    const rawNuts = wireData.nuts as Record<string, unknown>;
    const hasNut = (key: string): boolean => {
      return key in rawNuts || `nut${key}` in rawNuts || `nut-${key}` in rawNuts || `0${key}` in rawNuts;
    };

    const supportsMint = hasNut('4');
    const supportsMelt = hasNut('5');
    const supportsSwap = hasNut('3');
    const supportsRestore = hasNut('9');

    const mintInfoCandidate: CashuMintInfo = {
      url: targetUrl,
      name: wireData.name,
      version: wireData.version,
      nuts: rawNuts,
      supportsMint,
      supportsMelt,
      supportsSwap,
      supportsRestore
    };

    const schemaResult = CashuMintInfoSchema.safeParse(mintInfoCandidate);
    if (!schemaResult.success) {
      throw new CashuParseError(`Constructed mint info failed validation: ${schemaResult.error.message}`, {
        url: targetUrl,
        reason: schemaResult.error.message
      });
    }

    const durationMs = Date.now() - start;
    this._logger.debug('Fetched mint info', {
      url: targetUrl,
      name: mintInfoCandidate.name,
      version: mintInfoCandidate.version,
      durationMs
    });

    return schemaResult.data;
  }

  public async mint(amountSats: bigint, memo?: string): Promise<CashuMintResult> {
    if (amountSats <= 0n) {
      throw new CashuMintError('Mint amount must be greater than zero', {
        amountSats
      });
    }

    if (amountSats > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new CashuMintError('Mint amount exceeds maximum safe integer', {
        amountSats
      });
    }

    const amountNumber = Number(amountSats);
    const wallet = this.getWallet();

    let quoteRes: {
      quote: string;
      request: string;
      amount?: number;
      unit?: string;
      state?: string;
      expiry?: number;
    };

    try {
      quoteRes = await this.withTimeout('mint', this._config.mintUrl, () =>
        wallet.createMintQuote(amountNumber, memo)
      );
    } catch (err: unknown) {
      if (err instanceof CashuNetworkError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuMintError(`Failed to create mint quote: ${cause.message}`, {
        method: 'mint',
        reason: cause.message
      }, cause);
    }

    return {
      quote: quoteRes.quote,
      request: quoteRes.request,
      token: {
        mint: this._config.mintUrl,
        unit: this._config.unit,
        proofs: [],
        memo: memo ?? null
      }
    };
  }

  public async checkMintQuote(quote: string): Promise<CashuMintQuote> {
    if (typeof quote !== 'string' || quote.trim() === '') {
      throw new CashuParseError('Quote ID must be a non-empty string', {
        reason: 'Empty quote ID'
      });
    }

    const wallet = this.getWallet();
    let rawCheck: {
      quote: string;
      request: string;
      amount?: number;
      unit?: string;
      state?: string;
      expiry?: number;
    };

    try {
      rawCheck = await this.withTimeout('checkMintQuote', this._config.mintUrl, () =>
        wallet.checkMintQuote(quote)
      );
    } catch (err: unknown) {
      if (err instanceof CashuNetworkError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuMintError(`Failed to check mint quote: ${cause.message}`, {
        method: 'checkMintQuote',
        quote,
        reason: cause.message
      }, cause);
    }

    const wireValidation = CashuWireMintQuoteSchema.safeParse(rawCheck);
    if (!wireValidation.success) {
      throw new CashuParseError(`Invalid mint quote response: ${wireValidation.error.message}`, {
        reason: wireValidation.error.message
      });
    }

    const rawState = (rawCheck.state ?? 'unpaid').toLowerCase();
    const stateValidation = CashuMintQuoteStateSchema.safeParse(rawState);
    if (!stateValidation.success) {
      throw new CashuParseError(`Invalid mint quote state returned by mint: ${rawCheck.state}`, {
        reason: stateValidation.error.message
      });
    }

    const candidate: CashuMintQuote = {
      quote: rawCheck.quote,
      request: rawCheck.request,
      amount: BigInt(rawCheck.amount ?? 0),
      unit: rawCheck.unit ?? this._config.unit,
      state: stateValidation.data,
      expiry: rawCheck.expiry ?? null
    };

    const schemaResult = CashuMintQuoteSchema.safeParse(candidate);
    if (!schemaResult.success) {
      throw new CashuParseError(`Constructed mint quote failed validation: ${schemaResult.error.message}`, {
        reason: schemaResult.error.message
      });
    }

    return schemaResult.data;
  }

  public async mintTokens(quote: string, amountSats: bigint): Promise<CashuMintResult> {
    if (typeof quote !== 'string' || quote.trim() === '') {
      throw new CashuMintError('Quote ID must be a non-empty string', {
        quote,
        reason: 'Empty quote ID'
      });
    }

    if (amountSats <= 0n) {
      throw new CashuMintError('Amount must be greater than zero', {
        quote,
        amountSats,
        reason: 'Amount must be positive'
      });
    }

    const amountNumber = Number(amountSats);
    const wallet = this.getWallet();

    let sdkProofs: Proof[];
    try {
      sdkProofs = await this.withTimeout('mintTokens', this._config.mintUrl, () =>
        wallet.mintProofs(amountNumber, quote)
      );
    } catch (err: unknown) {
      if (err instanceof CashuNetworkError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuMintError(`Mint rejected quote: ${cause.message}`, {
        quote,
        reason: cause.message
      }, cause);
    }

    if (!Array.isArray(sdkProofs) || sdkProofs.length === 0) {
      throw new CashuMintError('Mint returned no proofs for quote', {
        quote,
        reason: 'Empty proofs returned'
      });
    }

    const cashuProofs: CashuProof[] = sdkProofs.map((p: Proof) => ({
      id: p.id,
      amount: BigInt(p.amount),
      secret: p.secret,
      C: p.C,
      witness: typeof p.witness === 'string' ? p.witness : null
    }));

    const token: CashuToken = {
      mint: this._config.mintUrl,
      unit: this._config.unit,
      proofs: cashuProofs,
      memo: null
    };

    this._logger.info('Minted Cashu tokens', {
      quote,
      amountSats,
      proofCount: cashuProofs.length
    });

    return {
      quote,
      token
    };
  }

  public async melt(
    bolt11: string,
    amountSats?: bigint,
    proofsInput?: CashuProof[] | CashuToken
  ): Promise<CashuMeltResult> {
    if (typeof bolt11 !== 'string' || bolt11.trim() === '') {
      throw new CashuParseError('bolt11 invoice must be a non-empty string', {
        input: bolt11,
        reason: 'Empty bolt11 string'
      });
    }

    const wallet = this.getWallet();
    let meltQuote: MeltQuoteResponse;

    try {
      meltQuote = await this.withTimeout('melt:quote', this._config.mintUrl, () =>
        wallet.createMeltQuote(bolt11)
      );
    } catch (err: unknown) {
      if (err instanceof CashuNetworkError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuMeltError(`Failed to create melt quote: ${cause.message}`, {
        reason: cause.message
      }, cause);
    }

    let proofList: CashuProof[] = [];
    if (proofsInput) {
      if ('proofs' in proofsInput && Array.isArray(proofsInput.proofs)) {
        proofList = proofsInput.proofs;
      } else if (Array.isArray(proofsInput)) {
        proofList = proofsInput;
      }
    }

    const sdkProofs: Proof[] = proofList.map((p: CashuProof) => ({
      id: p.id,
      amount: Number(p.amount),
      secret: p.secret,
      C: p.C,
      ...(p.witness ? { witness: p.witness } : {})
    }));

    let preimage: string | null = null;
    let feePaid = 0n;

    try {
      if (sdkProofs.length > 0) {
        const meltRes = await this.withTimeout('melt:pay', this._config.mintUrl, () =>
          wallet.meltProofs(meltQuote, sdkProofs)
        );
        preimage = meltRes.quote.payment_preimage;
        const rawFee = (meltRes.quote as unknown as Record<string, unknown>)['fee_paid'];
        feePaid = BigInt(typeof rawFee === 'number' ? rawFee : 0);
      } else {
        const mint = this.getMint();
        const meltRes = await this.withTimeout('melt:pay', this._config.mintUrl, () =>
          mint.melt({ quote: meltQuote.quote, inputs: [], outputs: [] })
        );
        preimage = meltRes.payment_preimage;
        const rawFee = (meltRes as unknown as Record<string, unknown>)['fee_paid'];
        feePaid = BigInt(typeof rawFee === 'number' ? rawFee : 0);
      }
    } catch (err: unknown) {
      if (err instanceof CashuNetworkError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuMeltError(`Melt execution failed: ${cause.message}`, {
        quote: meltQuote.quote,
        reason: cause.message
      }, cause);
    }

    const quoteRecord = meltQuote as unknown as Record<string, unknown>;
    const reportedPaymentHash =
      typeof quoteRecord['payment_hash'] === 'string'
        ? (quoteRecord['payment_hash'] as string)
        : typeof quoteRecord['paymentHash'] === 'string'
          ? (quoteRecord['paymentHash'] as string)
          : undefined;

    if (preimage) {
      if (reportedPaymentHash) {
        const computedHash = crypto
          .createHash('sha256')
          .update(Buffer.from(preimage, 'hex'))
          .digest('hex');
        if (computedHash.toLowerCase() !== reportedPaymentHash.toLowerCase()) {
          throw new CashuMeltError('Preimage does not match reported payment hash', {
            reason: 'PREIMAGE_MISMATCH',
            quote: meltQuote.quote
          });
        }
      } else {
        this._logger.warn('Mint did not report payment hash for melt quote; skipping preimage verification', {
          quote: meltQuote.quote
        });
      }
    }

    const amount = amountSats ?? BigInt(meltQuote.amount);

    this._logger.info('Melted Cashu tokens', {
      quote: meltQuote.quote,
      amountSats: amount,
      feePaidSats: feePaid
    });

    return {
      quote: meltQuote.quote,
      amount,
      feePaid,
      paymentPreimage: preimage
    };
  }

  public async swap(token: CashuToken, amountSats: bigint): Promise<CashuSwapResult> {
    if (!token || !Array.isArray(token.proofs) || token.proofs.length === 0) {
      throw new CashuSwapError('Cannot swap token with empty proofs', {
        reason: 'Empty proofs'
      });
    }

    if (amountSats <= 0n) {
      throw new CashuSwapError('Swap amount must be greater than zero', {
        reason: 'Non-positive swap amount'
      });
    }

    const amountNumber = Number(amountSats);
    const sdkProofs: Proof[] = token.proofs.map((p: CashuProof) => ({
      id: p.id,
      amount: Number(p.amount),
      secret: p.secret,
      C: p.C,
      ...(p.witness ? { witness: p.witness } : {})
    }));

    const wallet = this.getWallet();
    let swapResult: { keep: Proof[]; send: Proof[] };

    try {
      swapResult = await this.withTimeout('swap', token.mint, () =>
        wallet.swap(amountNumber, sdkProofs)
      );
    } catch (err: unknown) {
      if (err instanceof CashuNetworkError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuSwapError(`Swap operation failed: ${cause.message}`, {
        reason: cause.message
      }, cause);
    }

    const newProofs: CashuProof[] = swapResult.send.map((p: Proof) => ({
      id: p.id,
      amount: BigInt(p.amount),
      secret: p.secret,
      C: p.C,
      witness: typeof p.witness === 'string' ? p.witness : null
    }));

    const newToken: CashuToken = {
      mint: token.mint,
      unit: token.unit,
      proofs: newProofs,
      memo: token.memo
    };

    return {
      token: newToken
    };
  }

  public async restore(blindedMessages: string[]): Promise<CashuProof[]> {
    const mint = this.getMint();
    const outputs = blindedMessages.map((msg: string) => {
      try {
        const parsed = JSON.parse(msg) as Record<string, unknown>;
        if (typeof parsed === 'object' && parsed !== null && 'B_' in parsed) {
          return {
            B_: String(parsed['B_']),
            amount: Number(parsed['amount'] ?? 0),
            id: String(parsed['id'] ?? '')
          };
        }
      } catch {
      }
      return { B_: msg, amount: 0, id: '' };
    });

    let restoreRes: {
      outputs?: Array<{ B_: string; amount: number; id: string }>;
      signatures?: Array<{
        id?: string;
        amount?: number;
        C_?: string;
        C?: string;
        secret?: string;
        witness?: string;
      }>;
    };

    try {
      restoreRes = await this.withTimeout('restore', this._config.mintUrl, () =>
        mint.restore({ outputs })
      );
    } catch (err: unknown) {
      if (err instanceof CashuNetworkError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new CashuMintError(`Restore operation failed: ${cause.message}`, {
        reason: cause.message
      }, cause);
    }

    const recoveredProofs: CashuProof[] = (restoreRes.signatures ?? []).map((sig) => ({
      id: sig.id ?? '',
      amount: BigInt(sig.amount ?? 0),
      secret: sig.secret ?? '',
      C: sig.C_ ?? sig.C ?? '',
      witness: typeof sig.witness === 'string' ? sig.witness : null
    }));

    return recoveredProofs;
  }

  public balance(token: CashuToken): bigint {
    if (!token || !Array.isArray(token.proofs)) {
      return 0n;
    }
    return token.proofs.reduce((acc, proof) => acc + proof.amount, 0n);
  }

  public mergeTokens(tokens: CashuToken[]): CashuToken {
    if (!tokens || tokens.length === 0) {
      throw new CashuTokenError('Cannot merge an empty list of tokens', {
        reason: 'Empty token list'
      });
    }

    const first = tokens[0]!;
    for (let i = 1; i < tokens.length; i++) {
      const current = tokens[i]!;
      if (current.mint !== first.mint) {
        throw new CashuTokenError(
          `Cannot merge tokens from different mints: ${first.mint} vs ${current.mint}`,
          {
            mint: first.mint,
            otherMint: current.mint,
            reason: 'Mint mismatch'
          }
        );
      }
      if (current.unit !== first.unit) {
        throw new CashuTokenError(
          `Cannot merge tokens with different units: ${first.unit} vs ${current.unit}`,
          {
            unit: first.unit,
            otherUnit: current.unit,
            reason: 'Unit mismatch'
          }
        );
      }
    }

    const allProofs: CashuProof[] = tokens.flatMap((t) => t.proofs);
    return {
      mint: first.mint,
      unit: first.unit,
      proofs: allProofs,
      memo: first.memo
    };
  }
}
