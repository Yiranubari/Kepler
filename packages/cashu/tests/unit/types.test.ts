import {
  CashuProofSchema,
  CashuTokenSchema,
  CashuMintInfoSchema,
  CashuMintQuoteSchema,
  CashuMeltQuoteSchema,
  CashuMintResultSchema,
  CashuMeltResultSchema,
  CashuSwapResultSchema,
  CashuBalanceSchema,
  CashuWireProofSchema,
  CashuWireTokenSchema,
  CashuWireMintInfoSchema,
  CashuWireMintQuoteSchema,
  CashuWireMeltQuoteSchema,
  CashuProof,
  CashuToken,
  CashuMintInfo,
  CashuMintQuote,
  CashuMeltQuote,
  CashuBalance
} from '../../src';

describe('Cashu Types and Schemas', () => {
  const validMintUrl = 'https://testnut.cashu.space';
  const validC = '02' + '00'.repeat(32);

  const sampleProof: CashuProof = {
    id: '009a1f293253e41e',
    amount: 64n,
    secret: 'test-secret-42',
    C: validC,
    witness: null
  };

  const sampleToken: CashuToken = {
    mint: validMintUrl,
    unit: 'sat',
    proofs: [sampleProof],
    memo: null
  };

  describe('CashuProofSchema', () => {
    it('validates a correct CashuProof', () => {
      const result = CashuProofSchema.safeParse(sampleProof);
      expect(result.success).toBe(true);
    });

    it('accepts a non-null witness', () => {
      const proofWithWitness: CashuProof = {
        ...sampleProof,
        witness: '{"signatures":["sig1"]}'
      };
      const result = CashuProofSchema.safeParse(proofWithWitness);
      expect(result.success).toBe(true);
    });

    it('rejects negative amount', () => {
      const invalidProof = {
        ...sampleProof,
        amount: -1n
      };
      const result = CashuProofSchema.safeParse(invalidProof);
      expect(result.success).toBe(false);
    });

    it('rejects number amount', () => {
      const invalidProof = {
        ...sampleProof,
        amount: 64
      };
      const result = CashuProofSchema.safeParse(invalidProof);
      expect(result.success).toBe(false);
    });

    it('rejects empty id or secret or C', () => {
      expect(CashuProofSchema.safeParse({ ...sampleProof, id: '' }).success).toBe(false);
      expect(CashuProofSchema.safeParse({ ...sampleProof, secret: '' }).success).toBe(false);
      expect(CashuProofSchema.safeParse({ ...sampleProof, C: '' }).success).toBe(false);
    });
  });

  describe('CashuTokenSchema', () => {
    it('validates a correct CashuToken', () => {
      const result = CashuTokenSchema.safeParse(sampleToken);
      expect(result.success).toBe(true);
    });

    it('accepts a non-null memo', () => {
      const tokenWithMemo: CashuToken = {
        ...sampleToken,
        memo: 'For coffee'
      };
      const result = CashuTokenSchema.safeParse(tokenWithMemo);
      expect(result.success).toBe(true);
    });

    it('accepts an empty proofs array for pending tokens', () => {
      const emptyToken = {
        ...sampleToken,
        proofs: []
      };
      const result = CashuTokenSchema.safeParse(emptyToken);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid mint URL', () => {
      const invalidToken = {
        ...sampleToken,
        mint: 'not-a-url'
      };
      const result = CashuTokenSchema.safeParse(invalidToken);
      expect(result.success).toBe(false);
    });
  });

  describe('CashuMintInfoSchema', () => {
    const validMintInfo: CashuMintInfo = {
      url: validMintUrl,
      name: 'Testnut Mint',
      version: '0.15.0',
      nuts: { '4': { methods: ['bolt11'] } },
      supportsMint: true,
      supportsMelt: true,
      supportsSwap: true,
      supportsRestore: true
    };

    it('validates correct mint info', () => {
      const result = CashuMintInfoSchema.safeParse(validMintInfo);
      expect(result.success).toBe(true);
    });

    it('rejects non-url mint URL', () => {
      const invalid = { ...validMintInfo, url: 'invalid' };
      expect(CashuMintInfoSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('CashuMintQuoteSchema', () => {
    const validQuote: CashuMintQuote = {
      quote: 'quote-xyz',
      request: 'lnbc100n1...',
      amount: 1000n,
      unit: 'sat',
      state: 'unpaid',
      expiry: 1727164800
    };

    it('validates correct mint quote across all valid states', () => {
      for (const state of ['unpaid', 'paid', 'issued', 'expired'] as const) {
        const quote = { ...validQuote, state };
        expect(CashuMintQuoteSchema.safeParse(quote).success).toBe(true);
      }
    });

    it('accepts null expiry', () => {
      const quote = { ...validQuote, expiry: null };
      expect(CashuMintQuoteSchema.safeParse(quote).success).toBe(true);
    });

    it('rejects invalid state', () => {
      const quote = { ...validQuote, state: 'unknown' as unknown as 'unpaid' };
      expect(CashuMintQuoteSchema.safeParse(quote).success).toBe(false);
    });

    it('rejects number amount', () => {
      const quote = { ...validQuote, amount: 1000 as unknown as bigint };
      expect(CashuMintQuoteSchema.safeParse(quote).success).toBe(false);
    });
  });

  describe('CashuMeltQuoteSchema', () => {
    const validMeltQuote: CashuMeltQuote = {
      quote: 'melt-quote-123',
      request: 'lnbc500n1...',
      amount: 50000n,
      feeReserve: 100n,
      state: 'pending',
      expiry: 1727164800,
      paymentPreimage: null
    };

    it('validates correct melt quote across all valid states', () => {
      for (const state of ['unpaid', 'paid', 'pending', 'expired'] as const) {
        const quote = { ...validMeltQuote, state };
        expect(CashuMeltQuoteSchema.safeParse(quote).success).toBe(true);
      }
    });

    it('accepts non-null paymentPreimage', () => {
      const quote = {
        ...validMeltQuote,
        paymentPreimage: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
      };
      expect(CashuMeltQuoteSchema.safeParse(quote).success).toBe(true);
    });

    it('rejects negative feeReserve', () => {
      const quote = { ...validMeltQuote, feeReserve: -1n };
      expect(CashuMeltQuoteSchema.safeParse(quote).success).toBe(false);
    });
  });

  describe('CashuMintResultSchema and CashuMeltResultSchema and CashuSwapResultSchema', () => {
    it('validates CashuMintResult', () => {
      const mintResult = {
        quote: 'quote-1',
        token: sampleToken
      };
      expect(CashuMintResultSchema.safeParse(mintResult).success).toBe(true);
    });

    it('validates CashuMeltResult', () => {
      const meltResult = {
        quote: 'melt-quote-1',
        amount: 25000n,
        feePaid: 50n,
        paymentPreimage: 'preimage-abc'
      };
      expect(CashuMeltResultSchema.safeParse(meltResult).success).toBe(true);
    });

    it('validates CashuSwapResult', () => {
      const swapResult = {
        token: sampleToken
      };
      expect(CashuSwapResultSchema.safeParse(swapResult).success).toBe(true);
    });
  });

  describe('CashuBalanceSchema', () => {
    it('validates correct balance', () => {
      const balance: CashuBalance = {
        total: 1000n,
        byMint: {
          'https://testnut.cashu.space': 1000n
        }
      };
      expect(CashuBalanceSchema.safeParse(balance).success).toBe(true);
    });

    it('rejects negative total', () => {
      const balance = {
        total: -5n,
        byMint: {}
      };
      expect(CashuBalanceSchema.safeParse(balance).success).toBe(false);
    });
  });

  describe('Wire schemas', () => {
    it('validates wire proof with number amount', () => {
      const wireProof = {
        id: '009a1f293253e41e',
        amount: 32,
        secret: 'sec-1',
        C: validC
      };
      expect(CashuWireProofSchema.safeParse(wireProof).success).toBe(true);
    });

    it('validates wire token', () => {
      const wireToken = {
        mint: validMintUrl,
        proofs: [
          {
            id: '009a1f293253e41e',
            amount: 32,
            secret: 'sec-1',
            C: validC
          }
        ],
        unit: 'sat'
      };
      expect(CashuWireTokenSchema.safeParse(wireToken).success).toBe(true);
    });

    it('validates wire mint info with default fallback values', () => {
      const parsed = CashuWireMintInfoSchema.parse({});
      expect(parsed.name).toBe('');
      expect(parsed.version).toBe('');
      expect(parsed.nuts).toEqual({});
    });

    it('validates wire mint quote', () => {
      const quote = {
        quote: 'q1',
        request: 'req1',
        amount: 100,
        unit: 'sat'
      };
      expect(CashuWireMintQuoteSchema.safeParse(quote).success).toBe(true);
    });

    it('validates wire melt quote', () => {
      const quote = {
        quote: 'q2',
        request: 'req2',
        amount: '500',
        fee_reserve: 10
      };
      expect(CashuWireMeltQuoteSchema.safeParse(quote).success).toBe(true);
    });
  });
});
