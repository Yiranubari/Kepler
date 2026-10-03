import type { KeplerLogger } from '@kepler/shared';
import { BitcoinClient, BitcoinConfig, BitcoinBroadcastError } from '../../src';

class IntegrationTestLogger implements KeplerLogger {
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
const hasEsplora = Boolean(process.env['ESPLORA_URL']?.trim());
const describeIntegration = hasEsplora ? describe : describe.skip;

describeIntegration('BitcoinClient On-Chain Integration', () => {
  const configuredNetwork = (process.env['BITCOIN_NETWORK'] ?? 'mainnet') as 'mainnet' | 'testnet' | 'testnet4' | 'regtest';
  const isTestnet4 = configuredNetwork === 'testnet4';
  const itTestnet4 = isTestnet4 ? it : it.skip;

  let client: BitcoinClient;
  let logger: IntegrationTestLogger;

  beforeEach(() => {
    logger = new IntegrationTestLogger();
    const primaryUrl = process.env['ESPLORA_URL'] ?? 'https://mempool.space/api';
    const fallbackUrl = process.env['ESPLORA_FALLBACK_URL'] ?? primaryUrl;
    const config = new BitcoinConfig({
      primaryUrl,
      fallbackUrl,
      network: configuredNetwork
    });
    client = new BitcoinClient(config, logger);
  });

  itTestnet4('fetches UTXOs on a known testnet4 address with funds', async () => {
    const address = process.env['TESTNET4_FUNDED_ADDRESS'] ?? 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
    const utxos = await client.getUtxos(address);
    expect(Array.isArray(utxos)).toBe(true);
    if (utxos.length > 0) {
      expect(typeof utxos[0]?.value).toBe('bigint');
      expect(utxos[0]?.value).toBeGreaterThan(0n);
      expect(typeof utxos[0]?.txid).toBe('string');
      expect(utxos[0]?.txid).toHaveLength(64);
      expect(typeof utxos[0]?.vout).toBe('number');
    }
  }, 30000);

  it('fetches recommended fees and asserts positive fee rates', async () => {
    const fees = await client.getRecommendedFees();
    expect(fees.fastestFee).toBeGreaterThan(0);
    expect(fees.halfHourFee).toBeGreaterThan(0);
    expect(fees.hourFee).toBeGreaterThan(0);
    expect(fees.minimumFee).toBeGreaterThan(0);
    expect(typeof fees.fastestFee).toBe('number');
  }, 30000);

  it('broadcasts an invalid tx hex, returns 400 from mempool, and throws BitcoinBroadcastError', async () => {
    await expect(client.broadcastTransaction('deadbeef')).rejects.toThrow(BitcoinBroadcastError);
    try {
      await client.broadcastTransaction('deadbeef');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BitcoinBroadcastError);
      const broadcastError = err as BitcoinBroadcastError;
      expect(broadcastError.code).toBe('BITCOIN_BROADCAST_ERROR');
      expect(broadcastError.context['reason']).toBeDefined();
      expect(broadcastError.context['txHex']).toBe('deadbeef');
    }
  }, 30000);
});
