import type { KeplerLogger } from '@kepler/shared';
import { BitcoinClient, BitcoinConfig, BitcoinNotFoundError } from '../../src';

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

const isConfigured = Boolean(process.env['ESPLORA_URL']);
const describeIntegration = isConfigured ? describe : describe.skip;

describeIntegration('BitcoinClient Integration', () => {
  const primaryUrl = process.env['ESPLORA_URL'] ?? 'https://blockstream.info/api';
  const fallbackUrl = process.env['ESPLORA_FALLBACK_URL'] ?? primaryUrl;
  const network = (process.env['BITCOIN_NETWORK'] ?? 'mainnet') as 'mainnet' | 'testnet' | 'regtest';

  let client: BitcoinClient;
  let logger: IntegrationTestLogger;

  beforeEach(() => {
    logger = new IntegrationTestLogger();
    const config = new BitcoinConfig({
      primaryUrl,
      fallbackUrl,
      network
    });
    client = new BitcoinClient(config, logger);
  });

  it('fetches the current block tip and asserts height > 800000', async () => {
    const tip = await client.getBlockTip();
    expect(tip.height).toBeGreaterThan(800000);
    expect(typeof tip.hash).toBe('string');
    expect(tip.hash).toHaveLength(64);
    expect(tip.timestamp).toBeGreaterThan(1700000000);
  }, 30000);

  it('fetches a real transaction via the block tip path', async () => {
    const tip = await client.getBlockTip();
    const response = await fetch(`${primaryUrl}/block/${tip.hash}/txids`);
    if (!response.ok) {
      throw new Error(`Failed to fetch block txids: ${response.statusText}`);
    }
    const rawTxids: unknown = await response.json();
    if (!Array.isArray(rawTxids) || rawTxids.length === 0) {
      throw new Error('Block txids response is empty or not an array');
    }
    const firstTxid = String(rawTxids[0]);
    const tx = await client.getTransaction(firstTxid);
    expect(tx.txid).toBe(firstTxid);
  }, 30000);

  it('fetches a txid of 64 zeros and expects BitcoinNotFoundError', async () => {
    const zeroTxid = '0'.repeat(64);
    await expect(client.getTransaction(zeroTxid)).rejects.toThrow(BitcoinNotFoundError);
  }, 30000);

  it('fetches via fallback URL when primary is unreachable and restores env', async () => {
    const originalPrimary = process.env['ESPLORA_URL'];
    const originalFallback = process.env['ESPLORA_FALLBACK_URL'];
    const originalNetwork = process.env['BITCOIN_NETWORK'];

    try {
      process.env['ESPLORA_URL'] = 'http://127.0.0.1:9';
      process.env['ESPLORA_FALLBACK_URL'] = fallbackUrl;
      process.env['BITCOIN_NETWORK'] = network;

      const fallbackConfig = BitcoinConfig.fromEnv();
      const fallbackLogger = new IntegrationTestLogger();
      const fallbackClient = new BitcoinClient(fallbackConfig, fallbackLogger);

      const tip = await fallbackClient.getBlockTip();
      expect(tip.height).toBeGreaterThan(800000);
      expect(fallbackLogger.warnLogs.length).toBeGreaterThan(0);
      expect(fallbackLogger.warnLogs[0]?.context?.['primaryError']).toBeDefined();
      expect(fallbackLogger.debugLogs.length).toBeGreaterThan(0);
      expect(fallbackLogger.debugLogs[0]?.context?.['source']).toBe('fallback');
    } finally {
      if (originalPrimary !== undefined) {
        process.env['ESPLORA_URL'] = originalPrimary;
      } else {
        delete process.env['ESPLORA_URL'];
      }
      if (originalFallback !== undefined) {
        process.env['ESPLORA_FALLBACK_URL'] = originalFallback;
      } else {
        delete process.env['ESPLORA_FALLBACK_URL'];
      }
      if (originalNetwork !== undefined) {
        process.env['BITCOIN_NETWORK'] = originalNetwork;
      } else {
        delete process.env['BITCOIN_NETWORK'];
      }
    }
  }, 30000);
});
