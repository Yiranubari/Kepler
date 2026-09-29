import type { KeplerLogger } from '@kepler/shared';
import {
  BitcoinClient,
  BitcoinConfig,
  BitcoinConfigError,
  BitcoinNetworkError,
  BitcoinInvalidResponseError,
  BitcoinParseError,
  BitcoinBroadcastError,
  BitcoinFeeError
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

describe('BitcoinClient On-Chain Operations', () => {
  const originalFetch = globalThis.fetch;
  let fetchHandler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  let logger: TestLogger;
  let config: BitcoinConfig;
  let client: BitcoinClient;

  const validAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
  const validTxHex = '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000';
  const expectedTxid = 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16';

  beforeEach(() => {
    logger = new TestLogger();
    config = new BitcoinConfig({
      primaryUrl: 'https://primary.kepler.network/api',
      fallbackUrl: 'https://fallback.kepler.network/api',
      network: 'mainnet'
    });
    client = new BitcoinClient(config, logger);
    globalThis.fetch = jest.fn((input: string | URL | Request, init?: RequestInit) => fetchHandler(input, init));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getUtxos', () => {
    it('returns parsed UTXOs with bigint values for a valid address', async () => {
      fetchHandler = async (input: string | URL | Request) => {
        expect(String(input)).toBe(`https://mempool.space/api/address/${validAddress}/utxo`);
        const payload = [
          {
            txid: expectedTxid,
            vout: 1,
            status: {
              confirmed: true,
              block_height: 800000,
              block_time: 1700000000
            },
            value: 125000
          }
        ];
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const utxos = await client.getUtxos(validAddress);
      expect(utxos).toHaveLength(1);
      const first = utxos[0];
      expect(first).toBeDefined();
      expect(first?.txid).toBe(expectedTxid);
      expect(first?.vout).toBe(1);
      expect(first?.value).toBe(125000n);
      expect(typeof first?.value).toBe('bigint');
      expect(first?.status).toEqual({
        confirmed: true,
        blockHeight: 800000,
        blockTime: 1700000000
      });
      expect(logger.debugLogs.length).toBe(1);
      expect(logger.debugLogs[0]?.context?.['count']).toBe(1);
    });

    it('returns empty array on 404 response without throwing', async () => {
      fetchHandler = async () => new Response('Not Found', { status: 404 });

      const utxos = await client.getUtxos(validAddress);
      expect(utxos).toEqual([]);
      expect(logger.debugLogs.length).toBe(1);
      expect(logger.debugLogs[0]?.context?.['count']).toBe(0);
    });

    it('throws BitcoinInvalidResponseError on malformed response', async () => {
      fetchHandler = async () => new Response(JSON.stringify({ notAnArray: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      await expect(client.getUtxos(validAddress)).rejects.toThrow(BitcoinInvalidResponseError);
    });

    it('throws BitcoinNetworkError on transport error', async () => {
      fetchHandler = async () => {
        throw new Error('Connection refused');
      };

      await expect(client.getUtxos(validAddress)).rejects.toThrow(BitcoinNetworkError);
    });
  });

  describe('getRecommendedFees', () => {
    it('returns parsed fees', async () => {
      fetchHandler = async (input: string | URL | Request) => {
        expect(String(input)).toBe('https://mempool.space/api/v1/fees/recommended');
        const payload = {
          fastestFee: 25,
          halfHourFee: 18,
          hourFee: 12,
          economyFee: 8,
          minimumFee: 3
        };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const fees = await client.getRecommendedFees();
      expect(fees).toEqual({
        fastestFee: 25,
        halfHourFee: 18,
        hourFee: 12,
        economyFee: 8,
        minimumFee: 3
      });
      expect(logger.debugLogs.length).toBe(1);
      expect(logger.debugLogs[0]?.context?.['fastestFee']).toBe(25);
    });

    it('throws BitcoinFeeError on malformed response', async () => {
      fetchHandler = async () => new Response(JSON.stringify({ fastestFee: 'not_a_number' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      await expect(client.getRecommendedFees()).rejects.toThrow(BitcoinFeeError);
    });
  });

  describe('broadcastTransaction', () => {
    it('returns the txid on valid hex and 200 response', async () => {
      fetchHandler = async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe('https://mempool.space/api/tx');
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(validTxHex);
        return new Response(expectedTxid, { status: 200 });
      };

      const result = await client.broadcastTransaction(validTxHex);
      expect(result).toEqual({ txid: expectedTxid });
      expect(logger.infoLogs.length).toBe(1);
      expect(logger.infoLogs[0]?.context?.['txid']).toBeDefined();
    });

    it('throws BitcoinBroadcastError with response body in context on 400 response', async () => {
      const responseReason = 'sendrawtransaction RPC error: {"code":-27,"message":"Transaction already in block chain"}';
      fetchHandler = async () => new Response(responseReason, { status: 400 });

      try {
        await client.broadcastTransaction(validTxHex);
        fail('Expected BitcoinBroadcastError to be thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(BitcoinBroadcastError);
        const broadcastError = err as BitcoinBroadcastError;
        expect(broadcastError.code).toBe('BITCOIN_BROADCAST_ERROR');
        expect(broadcastError.context['reason']).toBe(responseReason);
        expect(broadcastError.context['txHex']).toBeDefined();
      }
    });

    it('truncates txHex in BitcoinBroadcastError context when it exceeds 256 characters', async () => {
      const longTxHex = '00'.repeat(200);
      const responseReason = 'sendrawtransaction RPC error: {"code":-22,"message":"TX decode failed"}';
      fetchHandler = async () => new Response(responseReason, { status: 400 });

      try {
        await client.broadcastTransaction(longTxHex);
        fail('Expected BitcoinBroadcastError to be thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(BitcoinBroadcastError);
        const broadcastError = err as BitcoinBroadcastError;
        expect(broadcastError.context['txHex']).toBe(`${'00'.repeat(128)}...`);
      }
    });

    it('throws BitcoinNetworkError on 500 response', async () => {
      fetchHandler = async () => new Response('Internal Server Error', { status: 500 });

      await expect(client.broadcastTransaction(validTxHex)).rejects.toThrow(BitcoinNetworkError);
    });

    it('throws BitcoinParseError with empty hex before any network call', async () => {
      const fetchSpy = jest.fn();
      globalThis.fetch = fetchSpy;

      await expect(client.broadcastTransaction('')).rejects.toThrow(BitcoinParseError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('never logs the raw hex string', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const debugSpy = jest.spyOn(logger, 'debug');
      const warnSpy = jest.spyOn(logger, 'warn');
      const errorSpy = jest.spyOn(logger, 'error');

      fetchHandler = async () => new Response(expectedTxid, { status: 200 });
      await client.broadcastTransaction(validTxHex);

      const allLoggedStrings: string[] = [
        ...infoSpy.mock.calls.map((call) => JSON.stringify(call)),
        ...debugSpy.mock.calls.map((call) => JSON.stringify(call)),
        ...warnSpy.mock.calls.map((call) => JSON.stringify(call)),
        ...errorSpy.mock.calls.map((call) => JSON.stringify(call))
      ];

      for (const logged of allLoggedStrings) {
        expect(logged.includes(validTxHex)).toBe(false);
      }
    });
  });

  describe('BitcoinConfig mempoolBaseUrl derivation', () => {
    it('returns correct URLs for mainnet, testnet, and testnet4', () => {
      const mainnetConfig = new BitcoinConfig({
        primaryUrl: 'https://primary.kepler.network/api',
        fallbackUrl: 'https://fallback.kepler.network/api',
        network: 'mainnet'
      });
      expect(mainnetConfig.mempoolBaseUrl).toBe('https://mempool.space/api');

      const testnetConfig = new BitcoinConfig({
        primaryUrl: 'https://primary.kepler.network/api',
        fallbackUrl: 'https://fallback.kepler.network/api',
        network: 'testnet'
      });
      expect(testnetConfig.mempoolBaseUrl).toBe('https://mempool.space/testnet/api');

      const testnet4Config = new BitcoinConfig({
        primaryUrl: 'https://primary.kepler.network/api',
        fallbackUrl: 'https://fallback.kepler.network/api',
        network: 'testnet4'
      });
      expect(testnet4Config.mempoolBaseUrl).toBe('https://mempool.space/testnet4/api');
    });

    it('throws BitcoinConfigError when accessing mempoolBaseUrl on unsupported regtest', () => {
      const regtestConfig = new BitcoinConfig({
        primaryUrl: 'http://localhost:3000',
        fallbackUrl: 'http://localhost:3002',
        network: 'regtest'
      });
      expect(() => regtestConfig.mempoolBaseUrl).toThrow(BitcoinConfigError);
    });
  });
});
