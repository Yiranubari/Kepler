import { SimplePool, nip04, finalizeEvent, getPublicKey } from 'nostr-tools';
import type { KeplerLogger, ProtocolError } from '@kepler/shared';
import { LightningConfig } from './config';
import { Bolt11 } from './bolt11';
import {
  LightningConfigError,
  LightningConnectionError,
  LightningTimeoutError,
  LightningNetworkError,
  LightningInvoiceError,
  LightningPaymentError,
  LightningParseError
} from './errors';
import {
  LightningInvoice,
  LightningPayment,
  LightningPaymentStatus,
  LightningTransaction,
  NWCWalletInfo,
  NWCNetwork,
  InvoiceCreationResult,
  PaymentResult,
  NWCResponsePayloadSchema,
  NWCPayInvoiceResultSchema,
  NWCMakeInvoiceResultSchema,
  NWCLookupInvoiceResultSchema,
  NWCGetInfoResultSchema,
  NWCGetBalanceResultSchema,
  NWCListTransactionsResultSchema
} from './types';

export class LightningClient {
  private readonly _config: LightningConfig;
  private readonly _logger: KeplerLogger;
  private readonly _pool: SimplePool;
  private readonly _secretBytes: Uint8Array | null;
  private readonly _clientPubkey: string | null;
  private _connected: boolean = false;

  constructor(config: LightningConfig, logger: KeplerLogger, pool?: SimplePool) {
    this._config = config;
    this._logger = logger;
    this._pool = pool ?? new SimplePool();
    if (this._config.isConfigured && this._config.secretBytes) {
      this._secretBytes = this._config.secretBytes;
      this._clientPubkey = getPublicKey(this._secretBytes);
    } else {
      this._secretBytes = null;
      this._clientPubkey = null;
    }
  }

  public get config(): LightningConfig {
    return this._config;
  }

  public get isConnected(): boolean {
    return this._connected;
  }

  private logAndThrow(err: ProtocolError, method: string): never {
    this._logger.error(`NWC request failed for ${method}`, err, {
      method,
      code: err.code
    });
    throw err;
  }

  public async connect(): Promise<void> {
    if (!this._config.isConfigured) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }

    const relayUrl = this._config.relayUrl!;
    const walletPubkey = this._config.walletPubkey!;

    try {
      try {
        await this._pool.ensureRelay(relayUrl, {
          connectionTimeout: this._config.requestTimeoutMs
        });
      } catch (relayErr: unknown) {
        const connErr = new LightningConnectionError('Failed to connect to NWC relay', {
          relayUrl,
          pubkey: walletPubkey,
          reason: relayErr instanceof Error ? relayErr.message : String(relayErr)
        }, relayErr instanceof Error ? relayErr : undefined);
        this.logAndThrow(connErr, 'connect');
      }

      let info: NWCWalletInfo;
      try {
        info = await this.getInfo();
      } catch (infoErr: unknown) {
        if (infoErr instanceof LightningTimeoutError) {
          this.logAndThrow(infoErr, 'get_info');
        }
        const connErr = new LightningConnectionError('Failed to reach Lightning wallet via NWC', {
          relayUrl,
          pubkey: walletPubkey,
          reason: infoErr instanceof Error ? infoErr.message : String(infoErr)
        }, infoErr instanceof Error ? infoErr : undefined);
        this.logAndThrow(connErr, 'connect');
      }

      this._connected = true;
      this._logger.info('Connected to Lightning wallet', {
        alias: info.alias,
        network: info.network,
        blockHeight: info.blockHeight
      });
    } catch (err: unknown) {
      if (
        err instanceof LightningConfigError ||
        err instanceof LightningConnectionError ||
        err instanceof LightningTimeoutError ||
        err instanceof LightningNetworkError ||
        err instanceof LightningInvoiceError ||
        err instanceof LightningPaymentError ||
        err instanceof LightningParseError
      ) {
        throw err;
      }
      const connErr = new LightningConnectionError('Unexpected connection failure', {
        relayUrl,
        reason: err instanceof Error ? err.message : String(err)
      }, err instanceof Error ? err : undefined);
      this.logAndThrow(connErr, 'connect');
    }
  }

  public async disconnect(): Promise<void> {
    if (!this._config.isConfigured || !this._connected) {
      return;
    }
    try {
      if (this._config.relayUrl) {
        this._pool.close([this._config.relayUrl]);
      }
    } catch {
    }
    this._connected = false;
  }

  public async getInfo(): Promise<NWCWalletInfo> {
    if (!this._config.isConfigured) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }
    const result = await this.executeRequest('get_info', {});
    const validation = NWCGetInfoResultSchema.safeParse(result);
    if (!validation.success) {
      const err = new LightningInvoiceError('Malformed get_info response payload', {
        method: 'get_info',
        reason: validation.error.message
      });
      this.logAndThrow(err, 'get_info');
    }

    const data = validation.data;
    let network: NWCNetwork = 'mainnet';
    if (data.network === 'testnet' || data.network === 'regtest') {
      network = data.network;
    }

    return {
      alias: data.alias,
      color: data.color,
      pubkey: data.pubkey,
      network,
      blockHeight: data.block_height,
      blockHash: data.block_hash,
      methods: data.methods
    };
  }

  public async getBalance(): Promise<{ balanceMsat: bigint }> {
    if (!this._config.isConfigured) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }
    const result = await this.executeRequest('get_balance', {}, 5000);
    const validation = NWCGetBalanceResultSchema.safeParse(result);
    if (!validation.success) {
      const err = new LightningInvoiceError('Malformed get_balance response payload', {
        method: 'get_balance',
        reason: validation.error.message
      });
      this.logAndThrow(err, 'get_balance');
    }

    return {
      balanceMsat: BigInt(validation.data.balance)
    };
  }

  public async createInvoice(
    amountMsat: bigint,
    description: string,
    expirySeconds?: number
  ): Promise<InvoiceCreationResult> {
    if (!this._config.isConfigured) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }

    const params: Record<string, unknown> = {
      amount: Number(amountMsat),
      description
    };
    if (expirySeconds !== undefined) {
      params['expiry'] = expirySeconds;
    }

    const result = await this.executeRequest('make_invoice', params);
    const validation = NWCMakeInvoiceResultSchema.safeParse(result);
    if (!validation.success) {
      const err = new LightningInvoiceError('Malformed make_invoice response payload', {
        method: 'make_invoice',
        reason: validation.error.message
      });
      this.logAndThrow(err, 'make_invoice');
    }

    const returnedInvoice = validation.data.invoice;
    const returnedPaymentHash = validation.data.payment_hash;

    let decoded: LightningInvoice;
    try {
      decoded = Bolt11.decode(returnedInvoice);
    } catch (decodeErr: unknown) {
      const err = new LightningInvoiceError('Returned invoice failed BOLT11 decoding', {
        method: 'make_invoice',
        reason: decodeErr instanceof Error ? decodeErr.message : String(decodeErr),
        invoice: returnedInvoice
      });
      this.logAndThrow(err, 'make_invoice');
    }

    if (decoded.paymentHash !== returnedPaymentHash) {
      const err = new LightningInvoiceError('Payment hash mismatch between invoice and make_invoice response', {
        method: 'make_invoice',
        reason: 'HASH_MISMATCH',
        invoice: returnedInvoice,
        returned: returnedPaymentHash,
        decoded: decoded.paymentHash
      });
      this.logAndThrow(err, 'make_invoice');
    }

    return {
      invoice: returnedInvoice,
      paymentHash: returnedPaymentHash
    };
  }

  public async payInvoice(invoice: string, amountMsat?: bigint): Promise<PaymentResult> {
    if (!this._config.isConfigured) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }

    let decoded: LightningInvoice;
    try {
      decoded = Bolt11.decode(invoice);
    } catch (decodeErr: unknown) {
      const err = new LightningParseError('Failed to decode invoice for payment', {
        input: invoice,
        reason: decodeErr instanceof Error ? decodeErr.message : String(decodeErr)
      });
      this.logAndThrow(err, 'pay_invoice');
    }

    const payAmount = amountMsat !== undefined ? amountMsat : decoded.amountMsat;
    const params: Record<string, unknown> = {
      invoice
    };
    if (payAmount > 0n) {
      params['amount'] = Number(payAmount);
    }

    const result = await this.executeRequest('pay_invoice', params);
    const validation = NWCPayInvoiceResultSchema.safeParse(result);
    if (!validation.success) {
      const err = new LightningPaymentError('Malformed pay_invoice response payload', {
        method: 'pay_invoice',
        reason: validation.error.message
      });
      this.logAndThrow(err, 'pay_invoice');
    }

    const preimage = validation.data.preimage;
    const feeMsat = BigInt(validation.data.fees_paid ?? 0);
    const returnedPaymentHash = validation.data.payment_hash ?? decoded.paymentHash;

    if (returnedPaymentHash !== decoded.paymentHash) {
      const err = new LightningPaymentError('Payment hash mismatch in pay_invoice response', {
        method: 'pay_invoice',
        reason: 'HASH_MISMATCH',
        returned: returnedPaymentHash,
        decoded: decoded.paymentHash
      });
      this.logAndThrow(err, 'pay_invoice');
    }

    return {
      paymentHash: decoded.paymentHash,
      preimage,
      feeMsat
    };
  }

  public async lookupInvoice(paymentHash: string): Promise<LightningPayment> {
    if (!this._config.isConfigured) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }

    const hexRegex = /^[0-9a-f]{64}$/;
    if (!hexRegex.test(paymentHash)) {
      const err = new LightningParseError('Invalid payment hash format for lookup', {
        input: paymentHash,
        reason: 'Payment hash must be a 64-character lowercase hex string'
      });
      this.logAndThrow(err, 'lookup_invoice');
    }

    const result = await this.executeRequest('lookup_invoice', { payment_hash: paymentHash });
    const validation = NWCLookupInvoiceResultSchema.safeParse(result);
    if (!validation.success) {
      const err = new LightningInvoiceError('Malformed lookup_invoice response payload', {
        method: 'lookup_invoice',
        reason: validation.error.message
      });
      this.logAndThrow(err, 'lookup_invoice');
    }

    const data = validation.data;
    let status: LightningPaymentStatus = 'pending';
    if (data.state === 'settled' || data.state === 'succeeded') {
      status = 'succeeded';
    } else if (data.state === 'failed' || data.state === 'expired') {
      status = 'failed';
    }

    return {
      paymentHash: data.payment_hash,
      preimage: data.preimage ?? '',
      amountMsat: BigInt(data.amount),
      feeMsat: BigInt(data.fees_paid ?? 0),
      status,
      createdAt: data.created_at,
      description: data.description ?? ''
    };
  }

  public async listTransactions(options?: {
    from?: number;
    until?: number;
    limit?: number;
    offset?: number;
    unpaid?: boolean;
    type?: 'incoming' | 'outgoing';
  }): Promise<LightningTransaction[]> {
    if (!this._config.isConfigured) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }

    const params: Record<string, unknown> = {};
    if (options?.from !== undefined) params['from'] = options.from;
    if (options?.until !== undefined) params['until'] = options.until;
    if (options?.limit !== undefined) params['limit'] = options.limit;
    if (options?.offset !== undefined) params['offset'] = options.offset;
    if (options?.unpaid !== undefined) params['unpaid'] = options.unpaid;
    if (options?.type !== undefined) params['type'] = options.type;

    const result = await this.executeRequest('list_transactions', params);
    const validation = NWCListTransactionsResultSchema.safeParse(result);
    if (!validation.success) {
      const err = new LightningInvoiceError('Malformed list_transactions response payload', {
        method: 'list_transactions',
        reason: validation.error.message
      });
      this.logAndThrow(err, 'list_transactions');
    }

    return validation.data.transactions.map((tx) => {
      let status: LightningPaymentStatus = 'pending';
      if (tx.state === 'settled' || tx.state === 'succeeded') {
        status = 'succeeded';
      } else if (tx.state === 'failed' || tx.state === 'expired') {
        status = 'failed';
      }

      return {
        type: tx.type,
        invoice: tx.invoice ?? '',
        paymentHash: tx.payment_hash,
        preimage: tx.preimage ?? null,
        amountMsat: BigInt(tx.amount),
        feeMsat: BigInt(tx.fees_paid ?? 0),
        status,
        createdAt: tx.created_at,
        settledAt: tx.settled_at ?? null,
        description: tx.description ?? ''
      };
    });
  }

  private async executeRequest(method: string, params: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    if (!this._config.isConfigured || !this._secretBytes || !this._config.walletPubkey || !this._config.relayUrl || !this._clientPubkey) {
      throw new LightningConfigError('NWC is not configured', {
        variable: 'NWC_CONNECTION_STRING',
        reason: 'NOT_CONFIGURED'
      });
    }
    const secretBytes = this._secretBytes;
    const walletPubkey = this._config.walletPubkey;
    const relayUrl = this._config.relayUrl;
    const clientPubkey = this._clientPubkey;
    const effectiveTimeoutMs = timeoutMs ?? this._config.requestTimeoutMs;

    const startTime = Date.now();
    let subCloser: { close: () => void } | undefined;
    let timer: NodeJS.Timeout | undefined;

    try {
      const payloadString = JSON.stringify({ method, params });
      let encryptedContent: string;
      try {
        encryptedContent = await nip04.encrypt(secretBytes, walletPubkey, payloadString);
      } catch (encErr: unknown) {
        throw new LightningNetworkError('Failed to encrypt NWC request payload', {
          method,
          relayUrl,
          reason: encErr instanceof Error ? encErr.message : String(encErr)
        }, encErr instanceof Error ? encErr : undefined);
      }

      const requestEvent = finalizeEvent({
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', walletPubkey]],
        content: encryptedContent
      }, secretBytes);

      const responsePromise = new Promise<unknown>((resolve, reject) => {
        timer = setTimeout(() => {
          if (subCloser) {
            subCloser.close();
          }
          reject(new LightningTimeoutError(`NWC request ${method} timed out after ${effectiveTimeoutMs}ms`, {
            method,
            timeoutMs: effectiveTimeoutMs
          }));
        }, effectiveTimeoutMs);

        try {
          subCloser = this._pool.subscribeMany(
            [relayUrl],
            {
              kinds: [23195],
              '#p': [clientPubkey],
              '#e': [requestEvent.id]
            },
            {
              onevent: async (event) => {
                if (timer) {
                  clearTimeout(timer);
                }
                if (subCloser) {
                  subCloser.close();
                }

                try {
                  const decrypted = await nip04.decrypt(secretBytes, walletPubkey, event.content);
                  let parsedJson: unknown;
                  try {
                    parsedJson = JSON.parse(decrypted);
                  } catch (jsonErr: unknown) {
                    reject(new LightningInvoiceError('Failed to parse decrypted NWC JSON response', {
                      method,
                      reason: jsonErr instanceof Error ? jsonErr.message : String(jsonErr)
                    }));
                    return;
                  }

                  const validation = NWCResponsePayloadSchema.safeParse(parsedJson);
                  if (!validation.success) {
                    reject(new LightningInvoiceError('Malformed NWC response envelope', {
                      method,
                      reason: validation.error.message
                    }));
                    return;
                  }

                  if (validation.data.error) {
                    const errPayload = validation.data.error;
                    if (method === 'pay_invoice') {
                      reject(new LightningPaymentError(errPayload.message, {
                        method,
                        code: errPayload.code,
                        reason: errPayload.message
                      }));
                    } else {
                      reject(new LightningInvoiceError(errPayload.message, {
                        method,
                        code: errPayload.code,
                        reason: errPayload.message
                      }));
                    }
                    return;
                  }

                  resolve(validation.data.result);
                } catch (decErr: unknown) {
                  reject(new LightningNetworkError('Failed to decrypt NWC response event', {
                    method,
                    relayUrl,
                    reason: decErr instanceof Error ? decErr.message : String(decErr)
                  }, decErr instanceof Error ? decErr : undefined));
                }
              }
            }
          );
        } catch (subErr: unknown) {
          if (timer) {
            clearTimeout(timer);
          }
          reject(new LightningNetworkError('Failed to subscribe for NWC response on relay', {
            method,
            relayUrl,
            reason: subErr instanceof Error ? subErr.message : String(subErr)
          }, subErr instanceof Error ? subErr : undefined));
        }
      });

      try {
        await Promise.all(this._pool.publish([relayUrl], requestEvent));
      } catch (pubErr: unknown) {
        if (timer) {
          clearTimeout(timer);
        }
        if (subCloser) {
          subCloser.close();
        }
        throw new LightningNetworkError('Failed to publish NWC request event to relay', {
          method,
          relayUrl,
          reason: pubErr instanceof Error ? pubErr.message : String(pubErr)
        }, pubErr instanceof Error ? pubErr : undefined);
      }

      const result = await responsePromise;
      const durationMs = Date.now() - startTime;
      this._logger.debug('NWC method call succeeded', { method, durationMs });
      return result;
    } catch (err: unknown) {
      if (
        err instanceof LightningConfigError ||
        err instanceof LightningConnectionError ||
        err instanceof LightningTimeoutError ||
        err instanceof LightningNetworkError ||
        err instanceof LightningInvoiceError ||
        err instanceof LightningPaymentError ||
        err instanceof LightningParseError
      ) {
        this.logAndThrow(err, method);
      }
      const genericErr = new LightningNetworkError('Unexpected NWC communication error', {
        method,
        relayUrl,
        reason: err instanceof Error ? err.message : String(err)
      }, err instanceof Error ? err : undefined);
      this.logAndThrow(genericErr, method);
    }
  }
}
