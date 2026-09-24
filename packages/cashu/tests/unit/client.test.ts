import crypto from 'node:crypto';
import type { KeplerLogger } from '@kepler/shared';
import { CashuMint, CashuWallet, type MeltQuoteResponse, type Proof } from '@cashu/cashu-ts';
import {
  CashuClient,
  CashuConfig,
  CashuToken,
  CashuProof,
  CashuMintError,
  CashuMeltError,
  CashuSwapError,
  CashuTokenError,
  CashuParseError,
  CashuNetworkError
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

describe('CashuClient', () => {
  const validMintUrl = 'https://testnut.cashu.space';
  const validC = '02' + '00'.repeat(32);

  let logger: TestLogger;
  let config: CashuConfig;
  let client: CashuClient;

  const sampleProof1: CashuProof = {
    id: '009a1f293253e41e',
    amount: 10n,
    secret: 'sec-1',
    C: validC,
    witness: null
  };

  const sampleProof2: CashuProof = {
    id: '009a1f293253e41e',
    amount: 20n,
    secret: 'sec-2',
    C: validC,
    witness: null
  };

  const sampleToken: CashuToken = {
    mint: validMintUrl,
    unit: 'sat',
    proofs: [sampleProof1, sampleProof2],
    memo: 'test-token'
  };

  beforeEach(() => {
    logger = new TestLogger();
    config = new CashuConfig({
      mintUrl: validMintUrl,
      fallbackMintUrl: null,
      unit: 'sat',
      requestTimeoutMs: 1500
    });
    client = new CashuClient(config, logger);
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('balance', () => {
    it('sums proof amounts as bigint', () => {
      const total = client.balance(sampleToken);
      expect(total).toBe(30n);
      expect(typeof total).toBe('bigint');
    });

    it('sums three proofs and asserts bigint result', () => {
      const p1: CashuProof = { id: '001', amount: 5n, secret: 's1', C: validC, witness: null };
      const p2: CashuProof = { id: '001', amount: 15n, secret: 's2', C: validC, witness: null };
      const p3: CashuProof = { id: '001', amount: 25n, secret: 's3', C: validC, witness: null };
      const threeProofToken: CashuToken = {
        mint: validMintUrl,
        unit: 'sat',
        proofs: [p1, p2, p3],
        memo: null
      };
      const total = client.balance(threeProofToken);
      expect(total).toBe(45n);
      expect(typeof total).toBe('bigint');
    });

    it('returns 0n for empty proofs', () => {
      const emptyToken: CashuToken = {
        ...sampleToken,
        proofs: []
      };
      expect(client.balance(emptyToken)).toBe(0n);
    });
  });

  describe('mergeTokens', () => {
    it('merges multiple tokens sharing the same mint and unit', () => {
      const tokenA: CashuToken = {
        mint: validMintUrl,
        unit: 'sat',
        proofs: [sampleProof1],
        memo: 'memoA'
      };
      const tokenB: CashuToken = {
        mint: validMintUrl,
        unit: 'sat',
        proofs: [sampleProof2],
        memo: 'memoB'
      };

      const merged = client.mergeTokens([tokenA, tokenB]);
      expect(merged.mint).toBe(validMintUrl);
      expect(merged.unit).toBe('sat');
      expect(merged.proofs).toHaveLength(2);
      expect(merged.proofs[0]?.amount).toBe(10n);
      expect(merged.proofs[1]?.amount).toBe(20n);
    });

    it('returns single token unchanged', () => {
      const merged = client.mergeTokens([sampleToken]);
      expect(merged.proofs).toHaveLength(2);
    });

    it('throws CashuTokenError on empty tokens array', () => {
      expect(() => client.mergeTokens([])).toThrow(CashuTokenError);
    });

    it('throws CashuTokenError on mint mismatch', () => {
      const otherMintToken: CashuToken = {
        ...sampleToken,
        mint: 'https://mint2.cashu.space'
      };
      expect(() => client.mergeTokens([sampleToken, otherMintToken])).toThrow(CashuTokenError);
    });

    it('throws CashuTokenError on unit mismatch', () => {
      const otherUnitToken: CashuToken = {
        ...sampleToken,
        unit: 'msat'
      };
      expect(() => client.mergeTokens([sampleToken, otherUnitToken])).toThrow(CashuTokenError);
    });
  });

  describe('getMintInfo', () => {
    it('fetches mint info, derives capability flags, and logs debug', async () => {
      const mockInfo = {
        name: 'Testnut Mint',
        version: '0.17.0',
        nuts: {
          '4': { methods: ['bolt11'] },
          '5': { methods: ['bolt11'] },
          '3': { supported: true },
          '9': { supported: true }
        }
      };

      jest.spyOn(CashuMint.prototype, 'getInfo').mockResolvedValue(mockInfo as never);

      const info = await client.getMintInfo();
      expect(info.name).toBe('Testnut Mint');
      expect(info.version).toBe('0.17.0');
      expect(info.supportsMint).toBe(true);
      expect(info.supportsMelt).toBe(true);
      expect(info.supportsSwap).toBe(true);
      expect(info.supportsRestore).toBe(true);

      expect(logger.debugLogs).toHaveLength(1);
      expect(logger.debugLogs[0]?.message).toBe('Fetched mint info');
      expect(logger.debugLogs[0]?.context?.['url']).toBe(validMintUrl);
      expect(logger.debugLogs[0]?.context?.['name']).toBe('Testnut Mint');
    });

    it('derives false flags when NUTs are absent', async () => {
      const mockInfo = {
        name: 'Minimal Mint',
        version: '1.0.0',
        nuts: {}
      };

      jest.spyOn(CashuMint.prototype, 'getInfo').mockResolvedValue(mockInfo as never);

      const info = await client.getMintInfo('https://minimal.cashu.space');
      expect(info.supportsMint).toBe(false);
      expect(info.supportsMelt).toBe(false);
      expect(info.supportsSwap).toBe(false);
      expect(info.supportsRestore).toBe(false);
    });

    it('throws CashuNetworkError on transport failure', async () => {
      jest.spyOn(CashuMint.prototype, 'getInfo').mockRejectedValue(new Error('Connection refused'));

      try {
        await client.getMintInfo();
        fail('Expected CashuNetworkError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuNetworkError);
        const networkError = err as CashuNetworkError;
        expect(networkError.code).toBe('CASHU_NETWORK_ERROR');
        expect(networkError.context['url']).toBe(validMintUrl);
      }
    });

    it('throws CashuParseError on malformed mint info', async () => {
      jest.spyOn(CashuMint.prototype, 'getInfo').mockResolvedValue(null as never);

      try {
        await client.getMintInfo();
        fail('Expected CashuParseError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuParseError);
        const parseError = err as CashuParseError;
        expect(parseError.code).toBe('CASHU_PARSE_ERROR');
      }
    });
  });

  describe('mint', () => {
    it('throws CashuMintError when amountSats = 0n before any network call', async () => {
      const spy = jest.spyOn(CashuWallet.prototype, 'createMintQuote');
      await expect(client.mint(0n)).rejects.toThrow(CashuMintError);
      expect(spy).not.toHaveBeenCalled();
    });

    it('throws CashuMintError when amount is negative before any network call', async () => {
      const spy = jest.spyOn(CashuWallet.prototype, 'createMintQuote');
      await expect(client.mint(-10n)).rejects.toThrow(CashuMintError);
      expect(spy).not.toHaveBeenCalled();
    });

    it('creates a mint quote and returns pending token with empty proofs', async () => {
      const mockQuote = {
        quote: 'quote-abc',
        request: 'lnbc100n1...',
        amount: 100,
        unit: 'sat',
        state: 'UNPAID',
        expiry: 1727164800
      };

      jest.spyOn(CashuWallet.prototype, 'createMintQuote').mockResolvedValue(mockQuote as never);

      const result = await client.mint(100n, 'Test memo');
      expect(result.quote).toBe('quote-abc');
      expect(result.request).toBe('lnbc100n1...');
      expect(result.token.mint).toBe(validMintUrl);
      expect(result.token.unit).toBe('sat');
      expect(result.token.proofs).toEqual([]);
      expect(result.token.memo).toBe('Test memo');
    });

    it('wraps SDK errors in CashuMintError', async () => {
      jest.spyOn(CashuWallet.prototype, 'createMintQuote').mockRejectedValue(new Error('Mint disabled'));

      await expect(client.mint(50n)).rejects.toThrow(CashuMintError);
    });
  });

  describe('checkMintQuote', () => {
    it('throws CashuParseError on empty quote ID', async () => {
      await expect(client.checkMintQuote('')).rejects.toThrow(CashuParseError);
      await expect(client.checkMintQuote('   ')).rejects.toThrow(CashuParseError);
    });

    it('returns normalized quote with lowercase state', async () => {
      const mockCheck = {
        quote: 'quote-xyz',
        request: 'lnbc50n1...',
        amount: 50,
        unit: 'sat',
        state: 'PAID',
        expiry: 1727164800
      };

      jest.spyOn(CashuWallet.prototype, 'checkMintQuote').mockResolvedValue(mockCheck as never);

      const quote = await client.checkMintQuote('quote-xyz');
      expect(quote.quote).toBe('quote-xyz');
      expect(quote.amount).toBe(50n);
      expect(quote.state).toBe('paid');
      expect(quote.unit).toBe('sat');
    });

    it('throws CashuParseError on invalid quote state', async () => {
      const mockCheck = {
        quote: 'quote-xyz',
        request: 'lnbc50n1...',
        amount: 50,
        unit: 'sat',
        state: 'UNKNOWN_STATE',
        expiry: 1727164800
      };

      jest.spyOn(CashuWallet.prototype, 'checkMintQuote').mockResolvedValue(mockCheck as never);

      await expect(client.checkMintQuote('quote-xyz')).rejects.toThrow(CashuParseError);
    });
  });

  describe('mintTokens', () => {
    it('throws CashuMintError on empty quote or non-positive amount', async () => {
      await expect(client.mintTokens('', 50n)).rejects.toThrow(CashuMintError);
      await expect(client.mintTokens('quote-1', 0n)).rejects.toThrow(CashuMintError);
      await expect(client.mintTokens('quote-1', -1n)).rejects.toThrow(CashuMintError);
    });

    it('mints proofs, wraps them in CashuToken, and logs info line', async () => {
      const sdkProofs: Proof[] = [
        {
          id: '009a1f293253e41e',
          amount: 64,
          secret: 'secret-64',
          C: validC
        }
      ];

      jest.spyOn(CashuWallet.prototype, 'mintProofs').mockResolvedValue(sdkProofs);

      const result = await client.mintTokens('quote-paid-1', 64n);
      expect(result.quote).toBe('quote-paid-1');
      expect(result.token.mint).toBe(validMintUrl);
      expect(result.token.proofs).toHaveLength(1);
      expect(result.token.proofs[0]?.amount).toBe(64n);
      expect(typeof result.token.proofs[0]?.amount).toBe('bigint');

      expect(logger.infoLogs).toHaveLength(1);
      expect(logger.infoLogs[0]?.message).toBe('Minted Cashu tokens');
      expect(logger.infoLogs[0]?.context?.['quote']).toBe('quote-paid-1');
      expect(logger.infoLogs[0]?.context?.['amountSats']).toBe(64n);
      expect(logger.infoLogs[0]?.context?.['proofCount']).toBe(1);
    });

    it('throws CashuMintError if mint rejects quote', async () => {
      jest.spyOn(CashuWallet.prototype, 'mintProofs').mockRejectedValue(new Error('Quote not paid'));

      try {
        await client.mintTokens('quote-unpaid', 50n);
        fail('Expected CashuMintError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuMintError);
        const mintError = err as CashuMintError;
        expect(mintError.context['quote']).toBe('quote-unpaid');
        expect(mintError.context['reason']).toContain('Quote not paid');
      }
    });

    it('throws CashuMintError when mint returns empty proofs', async () => {
      jest.spyOn(CashuWallet.prototype, 'mintProofs').mockResolvedValue([]);

      await expect(client.mintTokens('quote-empty', 50n)).rejects.toThrow(CashuMintError);
    });
  });

  describe('melt', () => {
    const validPreimage = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    const expectedPaymentHash = crypto
      .createHash('sha256')
      .update(Buffer.from(validPreimage, 'hex'))
      .digest('hex');

    it('throws CashuParseError when bolt11 is empty before any network call', async () => {
      const spyQuote = jest.spyOn(CashuWallet.prototype, 'createMeltQuote');
      const spyMelt = jest.spyOn(CashuWallet.prototype, 'meltProofs');
      await expect(client.melt('')).rejects.toThrow(CashuParseError);
      await expect(client.melt('   ')).rejects.toThrow(CashuParseError);
      expect(spyQuote).not.toHaveBeenCalled();
      expect(spyMelt).not.toHaveBeenCalled();
    });

    it('melts proofs, verifies preimage hash against reported payment hash, and logs info', async () => {
      const mockQuote: MeltQuoteResponse = {
        quote: 'melt-quote-1',
        amount: 1000,
        fee_reserve: 20,
        state: 'UNPAID' as never,
        expiry: 1727164800,
        payment_preimage: null,
        request: 'lnbc1000n1...',
        unit: 'sat'
      };
      (mockQuote as Record<string, unknown>)['payment_hash'] = expectedPaymentHash;

      jest.spyOn(CashuWallet.prototype, 'createMeltQuote').mockResolvedValue(mockQuote);
      jest.spyOn(CashuWallet.prototype, 'meltProofs').mockResolvedValue({
        quote: {
          ...mockQuote,
          payment_preimage: validPreimage,
          fee_paid: 5
        } as never,
        change: []
      });

      const result = await client.melt('lnbc1000n1...', 1000n, [sampleProof1]);
      expect(result.quote).toBe('melt-quote-1');
      expect(result.amount).toBe(1000n);
      expect(result.feePaid).toBe(5n);
      expect(result.paymentPreimage).toBe(validPreimage);

      expect(logger.infoLogs).toHaveLength(1);
      expect(logger.infoLogs[0]?.message).toBe('Melted Cashu tokens');
      expect(logger.infoLogs[0]?.context?.['quote']).toBe('melt-quote-1');
      expect(logger.infoLogs[0]?.context?.['feePaidSats']).toBe(5n);
    });

    it('throws CashuMeltError with PREIMAGE_MISMATCH on hash mismatch', async () => {
      const mockQuote: MeltQuoteResponse = {
        quote: 'melt-quote-bad',
        amount: 1000,
        fee_reserve: 20,
        state: 'UNPAID' as never,
        expiry: 1727164800,
        payment_preimage: null,
        request: 'lnbc1000n1...',
        unit: 'sat'
      };
      (mockQuote as Record<string, unknown>)['payment_hash'] = 'different_payment_hash_12345';

      jest.spyOn(CashuWallet.prototype, 'createMeltQuote').mockResolvedValue(mockQuote);
      jest.spyOn(CashuWallet.prototype, 'meltProofs').mockResolvedValue({
        quote: {
          ...mockQuote,
          payment_preimage: validPreimage,
          fee_paid: 5
        } as never,
        change: []
      });

      try {
        await client.melt('lnbc1000n1...', 1000n, [sampleProof1]);
        fail('Expected CashuMeltError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuMeltError);
        const meltError = err as CashuMeltError;
        expect(meltError.context['reason']).toBe('PREIMAGE_MISMATCH');
        expect(meltError.context['quote']).toBe('melt-quote-bad');
      }
    });

    it('skips preimage verification and logs warn when mint reports no payment hash', async () => {
      const mockQuote: MeltQuoteResponse = {
        quote: 'melt-quote-nohash',
        amount: 500,
        fee_reserve: 10,
        state: 'UNPAID' as never,
        expiry: 1727164800,
        payment_preimage: null,
        request: 'lnbc500n1...',
        unit: 'sat'
      };

      jest.spyOn(CashuWallet.prototype, 'createMeltQuote').mockResolvedValue(mockQuote);
      jest.spyOn(CashuWallet.prototype, 'meltProofs').mockResolvedValue({
        quote: {
          ...mockQuote,
          payment_preimage: validPreimage,
          fee_paid: 2
        } as never,
        change: []
      });

      const result = await client.melt('lnbc500n1...', 500n, [sampleProof1]);
      expect(result.paymentPreimage).toBe(validPreimage);

      expect(logger.warnLogs).toHaveLength(1);
      expect(logger.warnLogs[0]?.message).toContain('skipping preimage verification');
    });
  });

  describe('swap', () => {
    it('throws CashuSwapError on empty proofs or non-positive amount', async () => {
      const emptyToken: CashuToken = { ...sampleToken, proofs: [] };
      await expect(client.swap(emptyToken, 10n)).rejects.toThrow(CashuSwapError);
      await expect(client.swap(sampleToken, 0n)).rejects.toThrow(CashuSwapError);
      await expect(client.swap(sampleToken, -5n)).rejects.toThrow(CashuSwapError);
    });

    it('swaps proofs and returns new CashuToken', async () => {
      const newSdkProof: Proof = {
        id: '009a1f293253e41e',
        amount: 15,
        secret: 'new-secret',
        C: validC
      };

      jest.spyOn(CashuWallet.prototype, 'swap').mockResolvedValue({
        keep: [],
        send: [newSdkProof]
      });

      const result = await client.swap(sampleToken, 15n);
      expect(result.token.mint).toBe(validMintUrl);
      expect(result.token.proofs).toHaveLength(1);
      expect(result.token.proofs[0]?.amount).toBe(15n);
      expect(result.token.proofs[0]?.secret).toBe('new-secret');
    });

    it('throws CashuSwapError on swap failure', async () => {
      jest.spyOn(CashuWallet.prototype, 'swap').mockRejectedValue(new Error('Already spent proofs'));

      try {
        await client.swap(sampleToken, 10n);
        fail('Expected CashuSwapError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuSwapError);
        const swapError = err as CashuSwapError;
        expect(swapError.context['reason']).toContain('Already spent proofs');
      }
    });
  });

  describe('restore', () => {
    it('sends restore payload and returns recovered proofs', async () => {
      const mockRestoreRes = {
        outputs: [],
        signatures: [
          {
            id: 'keyset-1',
            amount: 8,
            C_: validC,
            secret: 'restored-sec'
          }
        ]
      };

      jest.spyOn(CashuMint.prototype, 'restore').mockResolvedValue(mockRestoreRes as never);

      const recovered = await client.restore(['blinded-msg-1']);
      expect(recovered).toHaveLength(1);
      expect(recovered[0]?.id).toBe('keyset-1');
      expect(recovered[0]?.amount).toBe(8n);
      expect(recovered[0]?.C).toBe(validC);
      expect(recovered[0]?.secret).toBe('restored-sec');
    });

    it('throws CashuMintError on restore failure', async () => {
      jest.spyOn(CashuMint.prototype, 'restore').mockRejectedValue(new Error('Restore failed'));

      await expect(client.restore(['msg1'])).rejects.toThrow(CashuMintError);
    });
  });

  describe('timeout handling', () => {
    it('throws CashuNetworkError when operation exceeds timeout', async () => {
      const shortTimeoutConfig = new CashuConfig({
        mintUrl: validMintUrl,
        requestTimeoutMs: 50
      });
      const timeoutClient = new CashuClient(shortTimeoutConfig, logger);

      jest.spyOn(CashuMint.prototype, 'getInfo').mockImplementation(() => {
        return new Promise((resolve) => setTimeout(() => resolve({} as never), 200));
      });

      try {
        await timeoutClient.getMintInfo();
        fail('Expected CashuNetworkError on timeout');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuNetworkError);
        const networkError = err as CashuNetworkError;
        expect(networkError.code).toBe('CASHU_NETWORK_ERROR');
        expect(networkError.context['method']).toBe('getMintInfo');
        expect(networkError.context['timeoutMs']).toBe(50);
      }
    });
  });

  describe('security audit for logger calls', () => {
    it('confirms no log call includes a proof secret, C value, or full token string across all operations', async () => {
      const sensitiveSecret1 = 'super_sensitive_secret_alpha_12345';
      const sensitiveSecret2 = 'super_sensitive_secret_beta_67890';
      const sensitiveC = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
      const sensitivePreimage = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const mockInfo = {
        name: 'Audit Mint',
        version: '1.0.0',
        nuts: { '4': {}, '5': {}, '3': {}, '9': {} }
      };
      jest.spyOn(CashuMint.prototype, 'getInfo').mockResolvedValue(mockInfo as never);
      await client.getMintInfo();

      const mockMintQuote = {
        quote: 'audit-mint-quote',
        request: 'lnbc100n1audit...',
        amount: 100,
        unit: 'sat',
        state: 'UNPAID',
        expiry: 1727164800
      };
      jest.spyOn(CashuWallet.prototype, 'createMintQuote').mockResolvedValue(mockMintQuote as never);
      await client.mint(100n, 'audit-memo');

      const mockCheckQuote = {
        quote: 'audit-mint-quote',
        request: 'lnbc100n1audit...',
        amount: 100,
        unit: 'sat',
        state: 'PAID',
        expiry: 1727164800
      };
      jest.spyOn(CashuWallet.prototype, 'checkMintQuote').mockResolvedValue(mockCheckQuote as never);
      await client.checkMintQuote('audit-mint-quote');

      const auditSdkProofs: Proof[] = [
        {
          id: '009a1f293253e41e',
          amount: 100,
          secret: sensitiveSecret1,
          C: sensitiveC
        }
      ];
      jest.spyOn(CashuWallet.prototype, 'mintProofs').mockResolvedValue(auditSdkProofs);
      await client.mintTokens('audit-mint-quote', 100n);

      const auditPaymentHash = crypto
        .createHash('sha256')
        .update(Buffer.from(sensitivePreimage, 'hex'))
        .digest('hex');

      const mockMeltQuote: MeltQuoteResponse = {
        quote: 'audit-melt-quote',
        amount: 50,
        fee_reserve: 2,
        state: 'UNPAID' as never,
        expiry: 1727164800,
        payment_preimage: null,
        request: 'lnbc50n1audit...',
        unit: 'sat'
      };
      (mockMeltQuote as Record<string, unknown>)['payment_hash'] = auditPaymentHash;

      jest.spyOn(CashuWallet.prototype, 'createMeltQuote').mockResolvedValue(mockMeltQuote);
      jest.spyOn(CashuWallet.prototype, 'meltProofs').mockResolvedValue({
        quote: {
          ...mockMeltQuote,
          payment_preimage: sensitivePreimage,
          fee_paid: 1
        } as never,
        change: []
      });

      const auditProofForMelt: CashuProof = {
        id: '009a1f293253e41e',
        amount: 50n,
        secret: sensitiveSecret2,
        C: sensitiveC,
        witness: null
      };
      await client.melt('lnbc50n1audit...', 50n, [auditProofForMelt]);

      const auditTokenToSwap: CashuToken = {
        mint: validMintUrl,
        unit: 'sat',
        proofs: [auditProofForMelt],
        memo: null
      };
      jest.spyOn(CashuWallet.prototype, 'swap').mockResolvedValue({
        keep: [],
        send: auditSdkProofs
      });
      await client.swap(auditTokenToSwap, 50n);

      const allLogged = [
        ...logger.debugLogs,
        ...logger.infoLogs,
        ...logger.warnLogs,
        ...logger.errorLogs,
        ...logger.fatalLogs
      ];
      const serializedLogs = JSON.stringify(allLogged, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      );

      expect(serializedLogs).not.toContain(sensitiveSecret1);
      expect(serializedLogs).not.toContain(sensitiveSecret2);
      expect(serializedLogs).not.toContain(sensitiveC);
      expect(serializedLogs).not.toMatch(/cashu[AB][a-zA-Z0-9_-]{20,}/);
    });
  });
});
