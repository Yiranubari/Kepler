import { BitcoinConfig, BitcoinClient } from '@kepler/bitcoin';
import type { KeplerLogger } from '@kepler/shared';

class TestLogger implements KeplerLogger {
  public loggedMessages: Array<{
    level: string;
    message: string;
    context?: Record<string, unknown>;
  }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'debug', message, context });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'info', message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'warn', message, context });
  }

  public error(message: string, _error?: unknown, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'error', message, context });
  }

  public fatal(message: string, _error: unknown, context?: Record<string, unknown>): void {
    this.loggedMessages.push({ level: 'fatal', message, context });
  }
}

describe('BitcoinConfig runtime mutability and BitcoinClient dynamic binding', () => {
  let config: BitcoinConfig;
  let logger: TestLogger;

  beforeEach(() => {
    config = new BitcoinConfig({
      primaryUrl: 'https://blockstream.info/api',
      fallbackUrl: 'https://mempool.space/api',
      network: 'mainnet'
    });
    logger = new TestLogger();
  });

  it('After setNetwork(\'mainnet\'), mempoolBaseUrl returns the mainnet URL', () => {
    config.setNetwork('testnet4');
    expect(config.mempoolBaseUrl).toBe('https://mempool.space/testnet4/api');

    config.setNetwork('mainnet');
    expect(config.mempoolBaseUrl).toBe('https://mempool.space/api');
  });

  it('After setNetwork(\'testnet4\'), it returns the testnet4 URL', () => {
    config.setNetwork('mainnet');
    expect(config.mempoolBaseUrl).toBe('https://mempool.space/api');

    config.setNetwork('testnet4');
    expect(config.mempoolBaseUrl).toBe('https://mempool.space/testnet4/api');
  });

  it('A BitcoinClient constructed once against the config sees the new network after setNetwork', () => {
    const client = new BitcoinClient(config, logger);
    const p2wpkhScript = '0014751e76e8199196d454941c45d1b3a323f1433bd6';

    config.setNetwork('mainnet');
    const mainnetParsed = client.parseOutputScript(p2wpkhScript);
    expect(mainnetParsed.address).not.toBeNull();
    expect(mainnetParsed.address?.startsWith('bc1')).toBe(true);

    config.setNetwork('testnet4');
    const testnet4Parsed = client.parseOutputScript(p2wpkhScript);
    expect(testnet4Parsed.address).not.toBeNull();
    expect(testnet4Parsed.address?.startsWith('tb1')).toBe(true);

    config.setNetwork('regtest');
    const regtestParsed = client.parseOutputScript(p2wpkhScript);
    expect(regtestParsed.address).not.toBeNull();
    expect(regtestParsed.address?.startsWith('bcrt1')).toBe(true);
  });
});
