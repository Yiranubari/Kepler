import * as fs from 'fs';
import * as path from 'path';
import type { KeplerLogger } from '@kepler/shared';
import { Bolt11, LightningClient, LightningConfig, LightningInvoiceError } from '../../src';

function loadEnvFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex).trim();
      let val = trimmed.slice(eqIndex + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
  }
}

loadEnvFile(path.resolve(__dirname, '../../../../.env'));
loadEnvFile(path.resolve(__dirname, '../../../backend/.env'));
loadEnvFile(path.resolve(__dirname, '../../.env'));

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

const isConfigured = Boolean(process.env['NWC_CONNECTION_STRING']);
const describeIntegration = isConfigured ? describe : describe.skip;

describeIntegration('LightningClient Integration', () => {
  let client: LightningClient;
  let logger: IntegrationTestLogger;

  beforeEach(() => {
    logger = new IntegrationTestLogger();
    const config = LightningConfig.fromEnv(process.env);
    client = new LightningClient(config, logger);
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  it('connect() succeeds and logs a real NWCWalletInfo', async () => {
    await client.connect();
    expect(client.isConnected).toBe(true);

    const info = await client.getInfo();
    expect(typeof info.alias).toBe('string');
    expect(typeof info.pubkey).toBe('string');
    expect(Array.isArray(info.methods)).toBe(true);

    const infoLog = logger.infoLogs.find((l) => l.message === 'Connected to Lightning wallet');
    expect(infoLog).toBeDefined();
    expect(infoLog?.context?.['alias']).toBeDefined();
    expect(infoLog?.context?.['network']).toBeDefined();
    expect(infoLog?.context?.['blockHeight']).toBeDefined();
  }, 30000);

  it('createInvoice(1000n, \'kepler integration test\') returns an invoice that decodes with Bolt11.decode and whose hash matches', async () => {
    await client.connect();
    try {
      const result = await client.createInvoice(1000n, 'kepler integration test');
      expect(typeof result.invoice).toBe('string');
      expect(result.invoice.startsWith('ln')).toBe(true);

      const decoded = Bolt11.decode(result.invoice);
      expect(decoded.paymentHash).toBe(result.paymentHash);
      expect(decoded.amountMsat).toBe(1000n);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(LightningInvoiceError);
      expect((err as LightningInvoiceError).code).toBe('LIGHTNING_INVOICE_ERROR');
    }
  }, 30000);

  it('lookupInvoice on the freshly created invoice returns a pending payment with the correct hash', async () => {
    await client.connect();
    try {
      const result = await client.createInvoice(1000n, 'kepler integration test');
      const payment = await client.lookupInvoice(result.paymentHash);
      expect(payment.paymentHash).toBe(result.paymentHash);
      expect(payment.status).toBe('pending');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(LightningInvoiceError);
      expect((err as LightningInvoiceError).code).toBe('LIGHTNING_INVOICE_ERROR');
    }
  }, 30000);

  it('listTransactions({ limit: 5 }) returns an array without throwing', async () => {
    await client.connect();
    const txs = await client.listTransactions({ limit: 5 });
    expect(Array.isArray(txs)).toBe(true);
  }, 30000);
});
