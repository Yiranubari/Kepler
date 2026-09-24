import {
  CashuTokenCodec,
  CashuToken,
  CashuProof,
  CashuTokenError,
  CashuParseError
} from '../../src';

describe('CashuTokenCodec', () => {
  const validMintUrl = 'https://testnut.cashu.space';
  const validC = '02' + '00'.repeat(32);

  const sampleProof1: CashuProof = {
    id: '009a1f293253e41e',
    amount: 1n,
    secret: 'secret-a',
    C: validC,
    witness: null
  };

  const sampleProof2: CashuProof = {
    id: '009a1f293253e41e',
    amount: 2n,
    secret: 'secret-b',
    C: validC,
    witness: null
  };

  const sampleToken: CashuToken = {
    mint: validMintUrl,
    unit: 'sat',
    proofs: [sampleProof1, sampleProof2],
    memo: 'Coffee payment'
  };

  describe('encode', () => {
    it('encodes a CashuToken into a V4 string starting with cashuB', () => {
      const encoded = CashuTokenCodec.encode(sampleToken);
      expect(typeof encoded).toBe('string');
      expect(encoded.startsWith('cashuB')).toBe(true);
    });

    it('encodes a CashuToken with null memo', () => {
      const tokenWithoutMemo: CashuToken = {
        ...sampleToken,
        memo: null
      };
      const encoded = CashuTokenCodec.encode(tokenWithoutMemo);
      expect(encoded.startsWith('cashuB')).toBe(true);
    });

    it('throws CashuTokenError on invalid token structure', () => {
      const invalidToken = {
        ...sampleToken,
        mint: 'not-a-valid-url'
      };
      expect(() => CashuTokenCodec.encode(invalidToken)).toThrow(CashuTokenError);
    });

    it('throws CashuTokenError when proofs array is empty', () => {
      const invalidToken: CashuToken = {
        ...sampleToken,
        proofs: []
      };
      expect(() => CashuTokenCodec.encode(invalidToken)).toThrow(CashuTokenError);
    });

    it('throws CashuTokenError when proof amount is zero or negative', () => {
      const zeroAmountToken: CashuToken = {
        ...sampleToken,
        proofs: [{ ...sampleProof1, amount: 0n }]
      };
      expect(() => CashuTokenCodec.encode(zeroAmountToken)).toThrow(CashuTokenError);

      const negativeAmountToken: CashuToken = {
        ...sampleToken,
        proofs: [{ ...sampleProof1, amount: -5n }]
      };
      expect(() => CashuTokenCodec.encode(negativeAmountToken)).toThrow(CashuTokenError);
    });

    it('throws CashuTokenError when proof amount exceeds Number.MAX_SAFE_INTEGER', () => {
      const excessiveAmountToken: CashuToken = {
        ...sampleToken,
        proofs: [{ ...sampleProof1, amount: BigInt(Number.MAX_SAFE_INTEGER) + 100n }]
      };
      expect(() => CashuTokenCodec.encode(excessiveAmountToken)).toThrow(CashuTokenError);
    });
  });

  describe('decode', () => {
    it('round-trips encode and decode on a hand-constructed token with three proofs', () => {
      const p1: CashuProof = {
        id: '009a1f293253e41e',
        amount: 1n,
        secret: 'secret-p1',
        C: validC,
        witness: null
      };
      const p2: CashuProof = {
        id: '009a1f293253e41e',
        amount: 2n,
        secret: 'secret-p2',
        C: validC,
        witness: null
      };
      const p3: CashuProof = {
        id: '009a1f293253e41e',
        amount: 4n,
        secret: 'secret-p3',
        C: validC,
        witness: null
      };
      const threeProofToken: CashuToken = {
        mint: validMintUrl,
        unit: 'sat',
        proofs: [p1, p2, p3],
        memo: 'three proofs roundtrip'
      };

      const encoded = CashuTokenCodec.encode(threeProofToken);
      const decoded = CashuTokenCodec.decode(encoded);

      expect(decoded.mint).toBe(threeProofToken.mint);
      expect(decoded.unit).toBe(threeProofToken.unit);
      expect(decoded.memo).toBe('three proofs roundtrip');
      expect(decoded.proofs).toHaveLength(3);
      expect(decoded.proofs[0]?.amount).toBe(1n);
      expect(decoded.proofs[1]?.amount).toBe(2n);
      expect(decoded.proofs[2]?.amount).toBe(4n);
      expect(typeof decoded.proofs[0]?.amount).toBe('bigint');
      expect(typeof decoded.proofs[1]?.amount).toBe('bigint');
      expect(typeof decoded.proofs[2]?.amount).toBe('bigint');
      expect(decoded.proofs[0]?.secret).toBe('secret-p1');
      expect(decoded.proofs[1]?.secret).toBe('secret-p2');
      expect(decoded.proofs[2]?.secret).toBe('secret-p3');
      expect(decoded.proofs[0]?.C).toBe(validC);
      expect(decoded.proofs[1]?.C).toBe(validC);
      expect(decoded.proofs[2]?.C).toBe(validC);
    });

    it('decodes a V4 token encoded by the codec', () => {
      const encoded = CashuTokenCodec.encode(sampleToken);
      const decoded = CashuTokenCodec.decode(encoded);

      expect(decoded.mint).toBe(sampleToken.mint);
      expect(decoded.unit).toBe(sampleToken.unit);
      expect(decoded.memo).toBe(sampleToken.memo);
      expect(decoded.proofs).toHaveLength(2);
      expect(decoded.proofs[0]?.amount).toBe(1n);
      expect(decoded.proofs[1]?.amount).toBe(2n);
      expect(typeof decoded.proofs[0]?.amount).toBe('bigint');
      expect(decoded.proofs[0]?.secret).toBe('secret-a');
      expect(decoded.proofs[0]?.C).toBe(validC);
      expect(decoded.proofs[0]?.witness).toBeNull();
    });

    it('decodes a token with null memo', () => {
      const tokenWithoutMemo: CashuToken = {
        ...sampleToken,
        memo: null
      };
      const encoded = CashuTokenCodec.encode(tokenWithoutMemo);
      const decoded = CashuTokenCodec.decode(encoded);
      expect(decoded.memo).toBeNull();
    });

    it('decodes a V3 format token (cashuA...)', () => {
      const v3Payload = {
        token: [
          {
            mint: validMintUrl,
            proofs: [
              {
                id: '009a1f293253e41e',
                amount: 8,
                secret: 'v3-secret',
                C: validC
              }
            ]
          }
        ],
        unit: 'sat',
        memo: 'v3 token'
      };
      const v3String = `cashuA${Buffer.from(JSON.stringify(v3Payload)).toString('base64')}`;
      const decoded = CashuTokenCodec.decode(v3String);

      expect(decoded.mint).toBe(validMintUrl);
      expect(decoded.unit).toBe('sat');
      expect(decoded.memo).toBe('v3 token');
      expect(decoded.proofs).toHaveLength(1);
      expect(decoded.proofs[0]?.amount).toBe(8n);
      expect(typeof decoded.proofs[0]?.amount).toBe('bigint');
      expect(decoded.proofs[0]?.secret).toBe('v3-secret');
    });

    it('accepts tokens prefixed with cashu://', () => {
      const encoded = CashuTokenCodec.encode(sampleToken);
      const uriToken = `cashu://${encoded}`;
      const decoded = CashuTokenCodec.decode(uriToken);
      expect(decoded.mint).toBe(sampleToken.mint);
    });

    it('throws CashuParseError on empty or non-string input', () => {
      expect(() => CashuTokenCodec.decode('')).toThrow(CashuParseError);
      expect(() => CashuTokenCodec.decode('   ')).toThrow(CashuParseError);
      expect(() => CashuTokenCodec.decode(null as unknown as string)).toThrow(CashuParseError);
    });

    it('throws CashuParseError on unsupported token prefix', () => {
      expect(() => CashuTokenCodec.decode('cashuC12345')).toThrow(CashuParseError);
      expect(() => CashuTokenCodec.decode('invalid_token')).toThrow(CashuParseError);
    });

    it('throws CashuParseError and truncates long corrupt input to 128 chars', () => {
      const longCorruptToken = `cashuB${'x'.repeat(300)}`;
      try {
        CashuTokenCodec.decode(longCorruptToken);
        fail('Expected CashuParseError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuParseError);
        const parseError = err as CashuParseError;
        expect(parseError.code).toBe('CASHU_PARSE_ERROR');
        expect(typeof parseError.context['input']).toBe('string');
        expect((parseError.context['input'] as string).length).toBeLessThanOrEqual(131);
        expect((parseError.context['input'] as string).endsWith('...')).toBe(true);
      }
    });
  });

  describe('toTokenReference', () => {
    it('formats a token reference showing only first 8 and last 8 chars', () => {
      const sampleEncoded = 'cashuBo2FteBtodHRwczovL3Rlc3RudXQuY2FzaHUuc3BhY2VhdWNzYXRhdIGiYWlIAJofKTJT5B5hcIGjYWEBYXNkc2VjMWFjWCECAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const ref = CashuTokenCodec.toTokenReference(sampleEncoded);
      expect(ref).toBe('tokenId: cashuBo2…AAAAAAAA');
      expect(ref).not.toContain('testnut');
    });

    it('handles short strings without throwing', () => {
      const short = 'cashuB123';
      const ref = CashuTokenCodec.toTokenReference(short);
      expect(ref).toBe('tokenId: cashuB123');
    });
  });
});
