import type { KeplerLogger } from '@kepler/shared';
import { SimplePool, getPublicKey, finalizeEvent, nip04, type Event } from 'nostr-tools';
import {
  LightningClient,
  LightningConfig,
  Bolt11,
  LightningConnectionError,
  LightningTimeoutError,
  LightningNetworkError,
  LightningInvoiceError,
  LightningPaymentError,
  LightningParseError
} from '../../src';

class TestLogger implements KeplerLogger {
  public readonly debugLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly infoLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly warnLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly errorLogs: Array<{ message: string; error?: unknown; context?: Record<string, unknown> }> = [];
  public readonly fatalLogs: Array<{ message: string; error: unknown; context?: Record<string, unknown> }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.debugLogs.push({ message, context });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.infoLogs.push({ message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.warnLogs.push({ message, context });
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.errorLogs.push({ message, error, context });
  }

  public fatal(message: string, error: unknown, context?: Record<string, unknown>): void {
    this.fatalLogs.push({ message, error, context });
  }
}

describe('LightningClient', () => {
  const walletSecretHex = '1111111111111111111111111111111111111111111111111111111111111111';
  const walletSecretBytes = Uint8Array.from(Buffer.from(walletSecretHex, 'hex'));
  const walletPubkey = getPublicKey(walletSecretBytes);

  const clientSecretHex = '2222222222222222222222222222222222222222222222222222222222222222';
  const clientSecretBytes = Uint8Array.from(Buffer.from(clientSecretHex, 'hex'));
  const clientPubkey = getPublicKey(clientSecretBytes);

  const relayUrl = 'wss://relay.getalby.com';
  const connectionString = `nostr+walletconnect://${walletPubkey}?relay=${relayUrl}&secret=${clientSecretHex}`;

  let logger: TestLogger;
  let config: LightningConfig;
  let pool: SimplePool;
  let client: LightningClient;
  let responseHandler: (requestMethod: string, requestParams: Record<string, unknown>) => Promise<unknown>;

  beforeEach(() => {
    logger = new TestLogger();
    config = new LightningConfig({
      connectionString,
      requestTimeoutMs: 2000
    });
    pool = new SimplePool();

    jest.spyOn(pool, 'ensureRelay').mockImplementation(async () => {
      return {} as unknown as Awaited<ReturnType<SimplePool['ensureRelay']>>;
    });

    jest.spyOn(pool, 'close').mockImplementation(() => {});

    jest.spyOn(pool, 'publish').mockImplementation((_relays: string[], event: Event) => {
      return [
        (async () => {
          try {
            const dec = await nip04.decrypt(walletSecretBytes, clientPubkey, event.content);
            const req = JSON.parse(dec);
            const resData = await responseHandler(req.method, req.params);

            const encRes = await nip04.encrypt(walletSecretBytes, clientPubkey, JSON.stringify(resData));
            const resEvent = finalizeEvent({
              kind: 23195,
              created_at: Math.floor(Date.now() / 1000),
              tags: [['p', clientPubkey], ['e', event.id]],
              content: encRes
            }, walletSecretBytes);

            setTimeout(() => {
              if (activeSubscriber) {
                activeSubscriber(resEvent);
              }
            }, 10);
          } catch {
          }
          return 'ok';
        })()
      ];
    });

    let activeSubscriber: ((event: Event) => void) | null = null;
    jest.spyOn(pool, 'subscribeMany').mockImplementation((_relays: string[], _filter: unknown, params: { onevent?: (event: Event) => void }) => {
      activeSubscriber = params.onevent ?? null;
      return {
        close: () => {
          activeSubscriber = null;
        }
      };
    });

    client = new LightningClient(config, logger, pool);
  });

  afterEach(async () => {
    await client.disconnect();
    jest.restoreAllMocks();
  });

  describe('connect and disconnect', () => {
    it('connects to relay, verifies get_info, logs info line, and marks connected', async () => {
      responseHandler = async (method) => {
        if (method === 'get_info') {
          return {
            result_type: 'get_info',
            result: {
              alias: 'Test Alby Hub',
              color: '#ff9900',
              pubkey: walletPubkey,
              network: 'mainnet',
              block_height: 850000,
              block_hash: '00000000000000000001',
              methods: ['get_info', 'pay_invoice', 'make_invoice']
            }
          };
        }
        return { result_type: method, result: {} };
      };

      await client.connect();
      expect(client.isConnected).toBe(true);

      const infoLog = logger.infoLogs.find((l) => l.message === 'Connected to Lightning wallet');
      expect(infoLog).toBeDefined();
      expect(infoLog?.context?.['alias']).toBe('Test Alby Hub');
      expect(infoLog?.context?.['network']).toBe('mainnet');
      expect(infoLog?.context?.['blockHeight']).toBe(850000);
    });

    it('throws LightningConnectionError if ensureRelay fails', async () => {
      jest.spyOn(pool, 'ensureRelay').mockRejectedValueOnce(new Error('Connection refused'));

      await expect(client.connect()).rejects.toThrow(LightningConnectionError);
      expect(client.isConnected).toBe(false);

      const errLog = logger.errorLogs.find((l) => l.context?.['code'] === 'LIGHTNING_CONNECTION_ERROR');
      expect(errLog).toBeDefined();
    });

    it('throws LightningTimeoutError with method get_info on connect timeout using jest fake timers', async () => {
      jest.useFakeTimers();
      jest.spyOn(pool, 'publish').mockImplementation(() => {
        return [Promise.resolve('ok')];
      });

      let caughtError: unknown;
      const connectPromise = client.connect().catch((err: unknown) => {
        caughtError = err;
      });

      await jest.advanceTimersByTimeAsync(config.requestTimeoutMs + 100);
      await connectPromise;

      expect(caughtError).toBeInstanceOf(LightningTimeoutError);
      const timeoutErr = caughtError as LightningTimeoutError;
      expect(timeoutErr.code).toBe('LIGHTNING_TIMEOUT_ERROR');
      expect(timeoutErr.context['method']).toBe('get_info');
      expect(client.isConnected).toBe(false);

      jest.useRealTimers();
    });

    it('disconnect is idempotent and does not throw if never opened', async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
      await expect(client.disconnect()).resolves.toBeUndefined();
      expect(client.isConnected).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('returns parsed wallet info and logs debug line', async () => {
      responseHandler = async () => ({
        result_type: 'get_info',
        result: {
          alias: 'Kepler Node',
          color: '#123456',
          pubkey: walletPubkey,
          network: 'mainnet',
          block_height: 840000,
          block_hash: '0000001',
          methods: ['get_info']
        }
      });

      const info = await client.getInfo();
      expect(info.alias).toBe('Kepler Node');
      expect(info.color).toBe('#123456');
      expect(info.network).toBe('mainnet');
      expect(info.blockHeight).toBe(840000);

      const debugLog = logger.debugLogs.find((l) => l.context?.['method'] === 'get_info');
      expect(debugLog).toBeDefined();
      expect(typeof debugLog?.context?.['durationMs']).toBe('number');
    });

    it('throws LightningInvoiceError on invalid response shape', async () => {
      responseHandler = async () => ({
        result_type: 'get_info',
        result: {
          alias: 123,
          pubkey: ''
        }
      });

      await expect(client.getInfo()).rejects.toThrow(LightningInvoiceError);
    });
  });

  describe('createInvoice', () => {
    const validPaymentHash = '0001020304050607080900010203040506070809000102030405060708090102';
    const validInvoice =
      'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372';

    it('returns invoice and paymentHash after validating hash match with Bolt11.decode', async () => {
      responseHandler = async (method, params) => {
        expect(params['amount']).toBe(2500000000);
        expect(params['description']).toBe('coffee beans');
        expect(params['expiry']).toBe(3600);
        return {
          result_type: 'make_invoice',
          result: {
            type: 'incoming',
            invoice: validInvoice,
            payment_hash: validPaymentHash
          }
        };
      };

      const result = await client.createInvoice(2500000000n, 'coffee beans', 3600);
      expect(result.invoice).toBe(validInvoice);
      expect(result.paymentHash).toBe(validPaymentHash);
    });

    it('throws LightningInvoiceError with HASH_MISMATCH on payment hash discrepancy', async () => {
      responseHandler = async () => ({
        result_type: 'make_invoice',
        result: {
          type: 'incoming',
          invoice: validInvoice,
          payment_hash: '9999999999999999999999999999999999999999999999999999999999999999'
        }
      });

      try {
        await client.createInvoice(2500000000n, 'coffee beans');
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningInvoiceError);
        const invoiceErr = err as LightningInvoiceError;
        expect(invoiceErr.context['reason']).toBe('HASH_MISMATCH');
        expect(invoiceErr.context['returned']).toBe('9999999999999999999999999999999999999999999999999999999999999999');
        expect(invoiceErr.context['decoded']).toBe(validPaymentHash);
      }
    });

    it('throws LightningInvoiceError if returned invoice cannot be decoded', async () => {
      responseHandler = async () => ({
        result_type: 'make_invoice',
        result: {
          type: 'incoming',
          invoice: 'not-a-valid-invoice',
          payment_hash: validPaymentHash
        }
      });

      await expect(client.createInvoice(1000n, 'test')).rejects.toThrow(LightningInvoiceError);
    });
  });

  describe('payInvoice', () => {
    const validPaymentHash = '0001020304050607080900010203040506070809000102030405060708090102';
    const validInvoice =
      'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372';

    it('pays invoice using decoded amount and validates hash match', async () => {
      responseHandler = async (method, params) => {
        expect(params['invoice']).toBe(validInvoice);
        expect(params['amount']).toBe(2500000000);
        return {
          result_type: 'pay_invoice',
          result: {
            preimage: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
            fees_paid: 1500,
            payment_hash: validPaymentHash
          }
        };
      };

      const result = await client.payInvoice(validInvoice);
      expect(result.paymentHash).toBe(validPaymentHash);
      expect(result.preimage).toBe('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
      expect(result.feeMsat).toBe(1500n);
    });

    it('pays invoice with explicit amount override', async () => {
      responseHandler = async (method, params) => {
        expect(params['amount']).toBe(5000000000);
        return {
          result_type: 'pay_invoice',
          result: {
            preimage: 'preimage123',
            fees_paid: 2000
          }
        };
      };

      const result = await client.payInvoice(validInvoice, 5000000000n);
      expect(result.feeMsat).toBe(2000n);
    });

    it('throws LightningPaymentError on payment hash mismatch', async () => {
      responseHandler = async () => ({
        result_type: 'pay_invoice',
        result: {
          preimage: 'preimage123',
          fees_paid: 1000,
          payment_hash: 'wrong-payment-hash'
        }
      });

      try {
        await client.payInvoice(validInvoice);
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningPaymentError);
        const payErr = err as LightningPaymentError;
        expect(payErr.context['reason']).toBe('HASH_MISMATCH');
      }
    });

    it('throws LightningParseError if invoice is invalid before network call', async () => {
      const publishSpy = jest.spyOn(pool, 'publish');
      await expect(client.payInvoice('invalid-invoice')).rejects.toThrow(LightningParseError);
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('throws LightningPaymentError when wallet returns error', async () => {
      responseHandler = async () => ({
        result_type: 'pay_invoice',
        error: {
          code: 'PAYMENT_FAILED',
          message: 'Insufficient balance'
        }
      });

      await expect(client.payInvoice(validInvoice)).rejects.toThrow(LightningPaymentError);
    });
  });

  describe('lookupInvoice', () => {
    const validPaymentHash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

    it('looks up invoice and returns LightningPayment with bigint amounts', async () => {
      responseHandler = async (method, params) => {
        expect(params['payment_hash']).toBe(validPaymentHash);
        return {
          result_type: 'lookup_invoice',
          result: {
            type: 'incoming',
            state: 'settled',
            payment_hash: validPaymentHash,
            preimage: 'preimage123',
            amount: 100000,
            fees_paid: 50,
            created_at: 1700000000,
            description: 'Order 123'
          }
        };
      };

      const payment = await client.lookupInvoice(validPaymentHash);
      expect(payment.paymentHash).toBe(validPaymentHash);
      expect(payment.preimage).toBe('preimage123');
      expect(payment.amountMsat).toBe(100000n);
      expect(payment.feeMsat).toBe(50n);
      expect(payment.status).toBe('succeeded');
      expect(payment.createdAt).toBe(1700000000);
      expect(payment.description).toBe('Order 123');
    });

    it('throws LightningParseError if paymentHash is not 64 lowercase hex characters', async () => {
      const publishSpy = jest.spyOn(pool, 'publish');
      await expect(client.lookupInvoice('not-64-hex')).rejects.toThrow(LightningParseError);
      await expect(client.lookupInvoice(validPaymentHash.toUpperCase())).rejects.toThrow(LightningParseError);
      await expect(client.lookupInvoice(`${validPaymentHash}aa`)).rejects.toThrow(LightningParseError);
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('listTransactions', () => {
    it('sends list_transactions and returns transactions with bigint amounts', async () => {
      responseHandler = async (method, params) => {
        expect(params['limit']).toBe(5);
        expect(params['type']).toBe('incoming');
        return {
          result_type: 'list_transactions',
          result: {
            transactions: [
              {
                type: 'incoming',
                state: 'settled',
                invoice: 'lnbc1...',
                payment_hash: 'hash1',
                amount: 50000,
                fees_paid: 0,
                created_at: 1700000000,
                description: 'Tip'
              },
              {
                type: 'outgoing',
                state: 'failed',
                invoice: 'lnbc2...',
                payment_hash: 'hash2',
                amount: 25000,
                fees_paid: 100,
                created_at: 1700000050,
                description: 'Failed payout'
              }
            ],
            total_count: 2
          }
        };
      };

      const txs = await client.listTransactions({ limit: 5, type: 'incoming' });
      expect(txs).toHaveLength(2);

      expect(txs[0].type).toBe('incoming');
      expect(txs[0].amountMsat).toBe(50000n);
      expect(txs[0].feeMsat).toBe(0n);
      expect(txs[0].status).toBe('succeeded');

      expect(txs[1].type).toBe('outgoing');
      expect(txs[1].amountMsat).toBe(25000n);
      expect(txs[1].feeMsat).toBe(100n);
      expect(txs[1].status).toBe('failed');
    });
  });
});
