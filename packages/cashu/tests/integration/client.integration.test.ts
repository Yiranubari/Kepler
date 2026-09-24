import * as fs from 'node:fs';
import * as path from 'node:path';
import type { KeplerLogger } from '@kepler/shared';
import { CashuClient, CashuConfig, CashuToken, CashuTokenCodec } from '../../src';

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
  public debug(_message: string, _context?: Record<string, unknown>): void {}
  public info(_message: string, _context?: Record<string, unknown>): void {}
  public warn(_message: string, _context?: Record<string, unknown>): void {}
  public error(_message: string, _error?: unknown, _context?: Record<string, unknown>): void {}
  public fatal(_message: string, _error: unknown, _context?: Record<string, unknown>): void {}
}

const isConfigured = Boolean(process.env['CASHU_MINT_URL']);
const describeIntegration = isConfigured ? describe : describe.skip;
const testToken = process.env['CASHU_TEST_TOKEN'];
const itWithTestToken = testToken ? it : it.skip;

describeIntegration('CashuClient Integration', () => {
  let client: CashuClient;
  let config: CashuConfig;
  let logger: IntegrationTestLogger;

  beforeAll(() => {
    logger = new IntegrationTestLogger();
    config = CashuConfig.fromEnv(process.env);
    client = new CashuClient(config, logger);
  });

  let activeQuote = '';

  it('getMintInfo() returns a real CashuMintInfo and asserts supportsMint === true', async () => {
    const info = await client.getMintInfo();
    expect(info.url).toBe(config.mintUrl);
    expect(info.name).toBeTruthy();
    expect(info.version).toBeTruthy();
    expect(info.supportsMint).toBe(true);
  }, 20_000);

  it('mint(100n) returns a quote and asserts request is a valid bolt11 invoice string starting with lnbc', async () => {
    const mintResult = await client.mint(100n, 'Kepler integration test');
    expect(mintResult.quote).toBeTruthy();
    expect(typeof mintResult.quote).toBe('string');
    expect(mintResult.request).toBeTruthy();
    expect(mintResult.request?.toLowerCase().startsWith('lnbc')).toBe(true);
    expect(mintResult.token.proofs).toHaveLength(0);
    activeQuote = mintResult.quote;
  }, 20_000);

  it('checkMintQuote() checks the quote state on the real mint', async () => {
    expect(activeQuote).toBeTruthy();
    const checkResult = await client.checkMintQuote(activeQuote);
    expect(checkResult.quote).toBe(activeQuote);
    expect(checkResult.state).toBe('unpaid');
    expect(checkResult.amount).toBe(100n);
  }, 20_000);

  it('balance on a hand-constructed test token asserts correct sum', () => {
    const handConstructedToken: CashuToken = {
      mint: config.mintUrl,
      unit: 'sat',
      proofs: [
        {
          id: '009a1f293253e41e',
          amount: 21n,
          secret: 'integration-test-secret-1',
          C: '02' + '00'.repeat(32),
          witness: null
        },
        {
          id: '009a1f293253e41e',
          amount: 42n,
          secret: 'integration-test-secret-2',
          C: '02' + '00'.repeat(32),
          witness: null
        }
      ],
      memo: 'integration test token'
    };
    const total = client.balance(handConstructedToken);
    expect(total).toBe(63n);
    expect(typeof total).toBe('bigint');
  });

  itWithTestToken('CashuTokenCodec.decode on a real public test token from CASHU_TEST_TOKEN', () => {
    const decoded = CashuTokenCodec.decode(testToken!);
    expect(decoded.mint).toBeTruthy();
    expect(decoded.proofs.length).toBeGreaterThan(0);
    expect(typeof decoded.proofs[0]?.amount).toBe('bigint');
  });
});
