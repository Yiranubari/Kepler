import net from 'node:net';
import { performance } from 'node:perf_hooks';

if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}
import { z } from 'zod';
import {
  KeplerLogger,
  KeplerError,
  NotFoundError,
  NetworkError,
  ValidationError
} from '@kepler/shared';
import {
  BitcoinClient,
  BitcoinConfigError,
  BitcoinNotFoundError,
  BitcoinNetworkError,
  BitcoinParseError,
  BitcoinInvalidResponseError,
  BitcoinTransaction,
  BitcoinAddressInfo,
  BitcoinBlockTip
} from '@kepler/bitcoin';
import {
  LightningClient,
  Bolt11,
  LightningConfigError,
  LightningTimeoutError,
  LightningNetworkError,
  LightningConnectionError,
  LightningParseError,
  LightningInvoiceError,
  LightningPaymentError,
  LightningInvoice,
  LightningPayment,
  LightningTransaction,
  InvoiceCreationResult
} from '@kepler/lightning';
import {
  NostrClient,
  NostrTimeoutError,
  NostrNetworkError,
  NostrConnectionError,
  NostrParseError,
  NostrEvent
} from '@kepler/nostr';
import {
  CashuClient,
  CashuConfigError,
  CashuNetworkError,
  CashuParseError,
  CashuMintInfo,
  CashuTokenCodec,
  CashuTokenError
} from '@kepler/cashu';
import {
  ProtocolsConfig,
  ProtocolBalanceResult,
  ProtocolsBalanceResult
} from './protocols.types';
import { ProtocolOperationError } from './protocols.errors';
import {
  BitcoinTxRequestSchema,
  BitcoinAddressRequestSchema,
  LightningDecodeRequestSchema,
  LightningLookupRequestSchema,
  LightningListRequestSchema,
  LightningCreateRequestSchema,
  NostrEventRequestSchema,
  NostrAuthorRequestSchema,
  CashuMintRequestSchema,
  ProtocolsBalanceRequestSchema,
  ProtocolsBalanceRequest
} from './protocols.validators';

export class ProtocolsService {
  private readonly bitcoinClient: BitcoinClient;
  private readonly lightningClient: LightningClient;
  private readonly nostrClient: NostrClient;
  private readonly cashuClient: CashuClient;
  private readonly logger: KeplerLogger;

  constructor(config: ProtocolsConfig, logger: KeplerLogger) {
    this.bitcoinClient = config.bitcoinClient;
    this.lightningClient = config.lightningClient;
    this.nostrClient = config.nostrClient;
    this.cashuClient = config.cashuClient;
    this.logger = logger;
  }

  private truncateHash(value: string): string {
    if (typeof value !== 'string') {
      return '';
    }
    if (value.length <= 16) {
      return value;
    }
    return `${value.slice(0, 8)}…${value.slice(-8)}`;
  }

  private createValidationError(
    protocol: 'bitcoin' | 'lightning' | 'nostr' | 'cashu',
    operation: string,
    error: z.ZodError
  ): ValidationError {
    const reason = error.issues.map((issue) => issue.message).join('; ');
    const validationError = new ValidationError(`Validation failed for ${operation}: ${reason}`, {
      protocol,
      operation,
      reason
    });
    this.logger.error(`Validation failed before protocol call: ${operation}`, validationError, {
      protocol,
      operation
    });
    return validationError;
  }

  private mapError(
    err: unknown,
    protocol: 'bitcoin' | 'lightning' | 'nostr' | 'cashu',
    operation: string,
    resourceInfo?: { resource: string; id: string }
  ): KeplerError {
    if (err instanceof KeplerError) {
      if (
        err instanceof NotFoundError ||
        err instanceof NetworkError ||
        err instanceof ValidationError ||
        err instanceof ProtocolOperationError
      ) {
        return err;
      }
    }

    const errName = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : String(err);
    const contextReason = typeof (err as { context?: { reason?: unknown } })?.context?.reason === 'string'
      ? (err as { context?: { reason?: string } }).context!.reason
      : undefined;
    const reason = contextReason ?? message;

    const isTimeout =
      err instanceof LightningTimeoutError ||
      err instanceof NostrTimeoutError ||
      errName.endsWith('TimeoutError') ||
      (err instanceof Error && err.message.toUpperCase().includes('TIMEOUT'));

    if (isTimeout) {
      return new NetworkError(message || 'Operation timed out', {
        protocol,
        operation,
        reason: 'TIMEOUT'
      }, err instanceof Error ? err : undefined);
    }

    if (err instanceof BitcoinNetworkError && (err.context?.['status'] === 400 || (typeof err.message === 'string' && err.message.includes('400')))) {
      return new ValidationError(message || 'Invalid Bitcoin parameter', {
        protocol,
        operation,
        reason: 'INVALID_PARAMETER'
      }, err instanceof Error ? err : undefined);
    }

    const isNotFound =
      err instanceof BitcoinNotFoundError ||
      errName.endsWith('NotFoundError') ||
      (err instanceof LightningInvoiceError &&
        (err.context?.['code'] === 'NOT_FOUND' ||
          err.context?.['code'] === 'INVOICE_NOT_FOUND' ||
          (typeof err.message === 'string' && err.message.toLowerCase().includes('not found'))));

    if (isNotFound) {
      return new NotFoundError(message || 'Resource not found', {
        resource: resourceInfo?.resource ?? 'Unknown',
        id: resourceInfo?.id ?? 'unknown'
      }, err instanceof Error ? err : undefined);
    }

    const isNetwork =
      err instanceof BitcoinNetworkError ||
      err instanceof LightningNetworkError ||
      err instanceof LightningConnectionError ||
      err instanceof NostrNetworkError ||
      err instanceof NostrConnectionError ||
      err instanceof CashuNetworkError ||
      errName.endsWith('NetworkError') ||
      errName.endsWith('ConnectionError');

    if (isNetwork) {
      return new NetworkError(message || 'Network error occurred', {
        protocol,
        operation
      }, err instanceof Error ? err : undefined);
    }

    const isParse =
      err instanceof BitcoinParseError ||
      err instanceof BitcoinInvalidResponseError ||
      err instanceof LightningParseError ||
      err instanceof NostrParseError ||
      err instanceof CashuParseError ||
      errName.endsWith('ParseError') ||
      errName.endsWith('ValidationError');

    if (isParse) {
      return new ValidationError(message || 'Validation or parse error', {
        protocol,
        operation,
        reason
      }, err instanceof Error ? err : undefined);
    }

    return new ProtocolOperationError(message || 'Protocol operation failed', {
      protocol,
      operation,
      reason
    }, err instanceof Error ? err : undefined);
  }

  private async execute<T>(
    protocol: 'bitcoin' | 'lightning' | 'nostr' | 'cashu',
    operation: string,
    resourceInfo: { resource: string; id: string } | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      this.logger.debug(`Protocol operation completed: ${operation}`, {
        protocol,
        operation,
        durationMs,
        ...(resourceInfo ? { resource: resourceInfo.resource, id: this.truncateHash(resourceInfo.id) } : {})
      });
      return result;
    } catch (err: unknown) {
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      const mapped = this.mapError(err, protocol, operation, resourceInfo);
      if (
        mapped instanceof NotFoundError ||
        (mapped instanceof NetworkError && mapped.context['reason'] === 'TIMEOUT')
      ) {
        this.logger.warn(`Protocol operation not found or timed out: ${operation}`, {
          protocol,
          operation,
          durationMs,
          ...(resourceInfo ? { resource: resourceInfo.resource, id: this.truncateHash(resourceInfo.id) } : {})
        });
      } else {
        this.logger.error(`Protocol operation failed: ${operation}`, mapped, {
          protocol,
          operation,
          durationMs,
          ...(resourceInfo ? { resource: resourceInfo.resource, id: this.truncateHash(resourceInfo.id) } : {})
        });
      }
      throw mapped;
    }
  }

  public async fetchBitcoinTransaction(txid: string): Promise<BitcoinTransaction> {
    const validation = BitcoinTxRequestSchema.safeParse({ txid });
    if (!validation.success) {
      throw this.createValidationError('bitcoin', 'fetchBitcoinTransaction', validation.error);
    }
    const normalizedTxid = txid.toLowerCase().trim();
    return this.execute('bitcoin', 'fetchBitcoinTransaction', { resource: 'BitcoinTransaction', id: normalizedTxid }, async () => {
      return this.bitcoinClient.getTransaction(normalizedTxid);
    });
  }

  public async fetchBitcoinAddress(address: string): Promise<BitcoinAddressInfo> {
    const validation = BitcoinAddressRequestSchema.safeParse({ address });
    if (!validation.success) {
      throw this.createValidationError('bitcoin', 'fetchBitcoinAddress', validation.error);
    }
    const normalizedAddress = address.trim();
    return this.execute('bitcoin', 'fetchBitcoinAddress', { resource: 'BitcoinAddress', id: normalizedAddress }, async () => {
      return this.bitcoinClient.getAddressInfo(normalizedAddress);
    });
  }

  public async fetchBitcoinTip(): Promise<BitcoinBlockTip> {
    return this.execute('bitcoin', 'fetchBitcoinTip', undefined, async () => {
      return this.bitcoinClient.getBlockTip();
    });
  }

  public async decodeLightningInvoice(invoice: string): Promise<LightningInvoice> {
    const validation = LightningDecodeRequestSchema.safeParse({ invoice });
    if (!validation.success) {
      throw this.createValidationError('lightning', 'decodeLightningInvoice', validation.error);
    }
    const normalizedInvoice = invoice.trim();
    return this.execute('lightning', 'decodeLightningInvoice', { resource: 'LightningInvoice', id: normalizedInvoice }, async () => {
      return Bolt11.decode(normalizedInvoice);
    });
  }

  public async lookupLightningInvoice(paymentHash: string): Promise<LightningPayment> {
    const validation = LightningLookupRequestSchema.safeParse({ paymentHash });
    if (!validation.success) {
      throw this.createValidationError('lightning', 'lookupLightningInvoice', validation.error);
    }
    const normalizedPaymentHash = paymentHash.toLowerCase().trim();
    return this.execute('lightning', 'lookupLightningInvoice', { resource: 'LightningPayment', id: normalizedPaymentHash }, async () => {
      return this.lightningClient.lookupInvoice(normalizedPaymentHash);
    });
  }

  public async listLightningTransactions(limit: number): Promise<LightningTransaction[]> {
    const validation = LightningListRequestSchema.safeParse({ limit });
    if (!validation.success) {
      throw this.createValidationError('lightning', 'listLightningTransactions', validation.error);
    }
    return this.execute('lightning', 'listLightningTransactions', undefined, async () => {
      return this.lightningClient.listTransactions({ limit: validation.data.limit });
    });
  }

  public async createLightningInvoice(amountSats: number, memo?: string): Promise<InvoiceCreationResult> {
    const validation = LightningCreateRequestSchema.safeParse({ amountSats, memo });
    if (!validation.success) {
      throw this.createValidationError('lightning', 'createLightningInvoice', validation.error);
    }
    const description = validation.data.memo ?? 'Kepler testnet funding';
    const amountMsat = BigInt(validation.data.amountSats) * 1000n;
    return this.execute('lightning', 'createLightningInvoice', undefined, async () => {
      return this.lightningClient.createInvoice(amountMsat, description);
    });
  }

  public async fetchNostrEvent(eventId: string): Promise<NostrEvent | null> {
    const validation = NostrEventRequestSchema.safeParse({ eventId });
    if (!validation.success) {
      throw this.createValidationError('nostr', 'fetchNostrEvent', validation.error);
    }
    const normalizedEventId = eventId.toLowerCase().trim();
    const startTime = performance.now();
    try {
      if (!this.nostrClient.isConnected) {
        await this.nostrClient.connect();
      }
      const verifiedEvent = await this.nostrClient.fetchEventById(normalizedEventId);
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      if (verifiedEvent === null) {
        this.logger.warn('Protocol operation not found: fetchNostrEvent', {
          protocol: 'nostr',
          operation: 'fetchNostrEvent',
          durationMs,
          resource: 'NostrEvent',
          id: this.truncateHash(normalizedEventId)
        });
        return null;
      }
      this.logger.debug('Protocol operation completed: fetchNostrEvent', {
        protocol: 'nostr',
        operation: 'fetchNostrEvent',
        durationMs,
        resource: 'NostrEvent',
        id: this.truncateHash(normalizedEventId)
      });
      return verifiedEvent.event;
    } catch (err: unknown) {
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      const mapped = this.mapError(err, 'nostr', 'fetchNostrEvent', {
        resource: 'NostrEvent',
        id: normalizedEventId
      });
      if (mapped instanceof NotFoundError) {
        this.logger.warn('Protocol operation not found: fetchNostrEvent', {
          protocol: 'nostr',
          operation: 'fetchNostrEvent',
          durationMs,
          resource: 'NostrEvent',
          id: this.truncateHash(normalizedEventId)
        });
        return null;
      }
      if (mapped instanceof NetworkError && mapped.context['reason'] === 'TIMEOUT') {
        this.logger.warn('Protocol operation timed out: fetchNostrEvent', {
          protocol: 'nostr',
          operation: 'fetchNostrEvent',
          durationMs,
          resource: 'NostrEvent',
          id: this.truncateHash(normalizedEventId)
        });
        throw mapped;
      }
      this.logger.error('Protocol operation failed: fetchNostrEvent', mapped, {
        protocol: 'nostr',
        operation: 'fetchNostrEvent',
        durationMs,
        resource: 'NostrEvent',
        id: this.truncateHash(normalizedEventId)
      });
      throw mapped;
    }
  }

  public async fetchNostrEventsByAuthor(pubkey: string, limit: number): Promise<NostrEvent[]> {
    const validation = NostrAuthorRequestSchema.safeParse({ pubkey, limit });
    if (!validation.success) {
      throw this.createValidationError('nostr', 'fetchNostrEventsByAuthor', validation.error);
    }
    const normalizedPubkey = pubkey.toLowerCase().trim();
    return this.execute('nostr', 'fetchNostrEventsByAuthor', { resource: 'NostrAuthor', id: normalizedPubkey }, async () => {
      if (!this.nostrClient.isConnected) {
        await this.nostrClient.connect();
      }
      const verifiedEvents = await this.nostrClient.fetchEventsByAuthor(normalizedPubkey, { limit: validation.data.limit });
      return verifiedEvents.map((verified) => verified.event);
    });
  }

  public async fetchCashuMintInfo(url: string): Promise<CashuMintInfo> {
    const validation = CashuMintRequestSchema.safeParse({ url });
    if (!validation.success) {
      throw this.createValidationError('cashu', 'fetchCashuMintInfo', validation.error);
    }
    const normalizedUrl = url.trim().replace(/\/+$/, '');
    return this.execute('cashu', 'fetchCashuMintInfo', { resource: 'CashuMintInfo', id: normalizedUrl }, async () => {
      return this.cashuClient.getMintInfo(normalizedUrl);
    });
  }

  private async safeBalance(
    fn: () => Promise<string | null>,
    protocol?: 'bitcoin' | 'lightning' | 'cashu'
  ): Promise<ProtocolBalanceResult> {
    try {
      const balanceSats = await fn();
      return {
        connected: true,
        balanceSats,
        error: null
      };
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : '';
      const isTimeout =
        err instanceof LightningTimeoutError ||
        errName.endsWith('TimeoutError') ||
        (err instanceof Error && err.message.toUpperCase().includes('TIMEOUT'));

      if (isTimeout) {
        return {
          connected: true,
          balanceSats: null,
          error: 'TIMEOUT'
        };
      }

      const isConfig =
        err instanceof LightningConfigError ||
        err instanceof BitcoinConfigError ||
        err instanceof CashuConfigError ||
        errName.endsWith('ConfigError');

      if (isConfig) {
        return {
          connected: false,
          balanceSats: null,
          error: 'NOT_CONFIGURED'
        };
      }

      const isNotFound =
        err instanceof BitcoinNotFoundError ||
        errName === 'LightningNotFoundError' ||
        errName.endsWith('NotFoundError') ||
        (err instanceof LightningInvoiceError &&
          (err.context?.['code'] === 'NOT_FOUND' ||
            err.context?.['code'] === 'INVOICE_NOT_FOUND' ||
            (typeof err.message === 'string' && err.message.toLowerCase().includes('not found'))));

      if (isNotFound) {
        return {
          connected: true,
          balanceSats: null,
          error: null
        };
      }

      const isNetwork =
        err instanceof BitcoinNetworkError ||
        err instanceof LightningNetworkError ||
        err instanceof LightningConnectionError ||
        err instanceof CashuNetworkError ||
        err instanceof NetworkError ||
        errName.endsWith('NetworkError') ||
        errName.endsWith('ConnectionError');

      if (isNetwork) {
        return {
          connected: true,
          balanceSats: null,
          error: 'NETWORK_ERROR'
        };
      }

      const isInvalidOrParse =
        err instanceof BitcoinInvalidResponseError ||
        err instanceof BitcoinParseError ||
        err instanceof CashuParseError ||
        err instanceof CashuTokenError ||
        errName.endsWith('ParseError') ||
        errName.endsWith('InvalidResponseError');

      if (isInvalidOrParse) {
        return {
          connected: true,
          balanceSats: null,
          error: 'NETWORK_ERROR'
        };
      }

      const isUnsupported =
        (err instanceof LightningInvoiceError && (
          err.context?.['code'] === 'NOT_IMPLEMENTED' ||
          err.context?.['code'] === 'UNSUPPORTED' ||
          err.context?.['code'] === 'NOT_SUPPORTED'
        )) ||
        (err instanceof Error && (
          err.message.toLowerCase().includes('not supported') ||
          err.message.toLowerCase().includes('not implemented') ||
          err.message.toLowerCase().includes('unsupported')
        ));

      if (isUnsupported) {
        return {
          connected: true,
          balanceSats: null,
          error: 'UNSUPPORTED'
        };
      }

      const detectedProtocol =
        protocol ??
        (errName.toLowerCase().includes('bitcoin')
          ? 'bitcoin'
          : errName.toLowerCase().includes('lightning')
          ? 'lightning'
          : errName.toLowerCase().includes('cashu')
          ? 'cashu'
          : 'unknown');

      this.logger.warn('Protocol balance failed', {
        protocol: detectedProtocol,
        code: 'NETWORK_ERROR'
      });

      return {
        connected: false,
        balanceSats: null,
        error: 'NETWORK_ERROR'
      };
    }
  }

  private async getBitcoinBalance(address: string): Promise<string> {
    const startTime = performance.now();
    const mempoolBaseUrl =
      (this.bitcoinClient as unknown as { _config?: { mempoolBaseUrl?: string } })._config?.mempoolBaseUrl ??
      'https://mempool.space/api';
    const utxos = await this.bitcoinClient.getUtxos(address.trim());
    const totalSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0n);
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    this.logger.debug('Bitcoin balance fetched', {
      protocol: 'bitcoin',
      connected: true,
      url: mempoolBaseUrl,
      durationMs
    });
    return totalSats.toString();
  }

  private async getLightningBalance(): Promise<string> {
    const startTime = performance.now();
    if (!this.lightningClient.config.isConfigured) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }
    const result = await this.lightningClient.getBalance();
    const balanceSats = (result.balanceMsat / 1000n).toString();
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    this.logger.debug('Lightning balance fetched', {
      protocol: 'lightning',
      connected: true,
      durationMs
    });
    return balanceSats;
  }

  private async getCashuBalance(token: string): Promise<string> {
    const startTime = performance.now();
    const decoded = CashuTokenCodec.decode(token.trim());
    const totalSats = decoded.proofs.reduce((sum, proof) => sum + proof.amount, 0n);
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    this.logger.debug('Cashu balance fetched', {
      protocol: 'cashu',
      connected: true,
      durationMs
    });
    return totalSats.toString();
  }

  public async getBalance(request: ProtocolsBalanceRequest): Promise<ProtocolsBalanceResult> {
    const validation = ProtocolsBalanceRequestSchema.safeParse(request);
    if (!validation.success) {
      throw this.createValidationError('bitcoin', 'getBalance', validation.error);
    }

    const bitcoinPromise = validation.data.bitcoinAddress
      ? this.safeBalance(() => this.getBitcoinBalance(validation.data.bitcoinAddress!), 'bitcoin')
      : Promise.resolve<ProtocolBalanceResult>({
          connected: false,
          balanceSats: null,
          error: 'NOT_CONFIGURED'
        });

    const lightningPromise = this.safeBalance(
      () => this.getLightningBalance(),
      'lightning'
    );

    const cashuPromise = validation.data.cashuToken
      ? this.safeBalance(() => this.getCashuBalance(validation.data.cashuToken!), 'cashu')
      : Promise.resolve<ProtocolBalanceResult>({
          connected: false,
          balanceSats: null,
          error: 'NOT_CONFIGURED'
        });

    const [bitcoin, lightning, cashu] = await Promise.all([
      bitcoinPromise,
      lightningPromise,
      cashuPromise
    ]);

    return { bitcoin, lightning, cashu };
  }

  public async fetchBalance(request: ProtocolsBalanceRequest): Promise<ProtocolsBalanceResult> {
    return this.getBalance(request);
  }
}
