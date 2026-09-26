import {
  IdentifierString,
  AnalyzeRequestSchema,
  FindPathsRequestSchema,
  bitcoinIngestSchema,
  lightningIngestSchema,
  nostrIngestSchema,
  cashuIngestSchema
} from '../../src/modules/taint/taint.validators';

describe('taint.validators', () => {
  describe('IdentifierString', () => {
    test('accepts valid identifier strings', () => {
      expect(IdentifierString.parse('scenario-123')).toBe('scenario-123');
      expect(IdentifierString.parse('valid_identifier')).toBe('valid_identifier');
      expect(IdentifierString.parse('4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff')).toBe(
        '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff'
      );
    });

    test('rejects empty string', () => {
      const result = IdentifierString.safeParse('');
      expect(result.success).toBe(false);
    });

    test('rejects string exceeding 256 characters', () => {
      const longString = 'a'.repeat(257);
      const result = IdentifierString.safeParse(longString);
      expect(result.success).toBe(false);
    });

    test('rejects string containing null byte', () => {
      const result = IdentifierString.safeParse('scenario\u0000id');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Identifier must not contain control characters'
        );
      }
    });

    test('rejects string containing newline or carriage return', () => {
      const resultNewline = IdentifierString.safeParse('scenario\nid');
      expect(resultNewline.success).toBe(false);
      if (!resultNewline.success) {
        expect(resultNewline.error.issues[0].message).toBe(
          'Identifier must not contain control characters'
        );
      }

      const resultCR = IdentifierString.safeParse('scenario\rid');
      expect(resultCR.success).toBe(false);
      if (!resultCR.success) {
        expect(resultCR.error.issues[0].message).toBe(
          'Identifier must not contain control characters'
        );
      }
    });

    test('rejects string containing tab or DEL character', () => {
      const resultTab = IdentifierString.safeParse('scenario\tid');
      expect(resultTab.success).toBe(false);
      if (!resultTab.success) {
        expect(resultTab.error.issues[0].message).toBe(
          'Identifier must not contain control characters'
        );
      }

      const resultDel = IdentifierString.safeParse('scenario\u007Fid');
      expect(resultDel.success).toBe(false);
      if (!resultDel.success) {
        expect(resultDel.error.issues[0].message).toBe(
          'Identifier must not contain control characters'
        );
      }
    });
  });

  describe('AnalyzeRequestSchema', () => {
    test('accepts valid analyze request', () => {
      const result = AnalyzeRequestSchema.safeParse({
        scenarioId: 'valid-scenario-id'
      });
      expect(result.success).toBe(true);
    });

    test('rejects analyze request with null byte in scenarioId', () => {
      const result = AnalyzeRequestSchema.safeParse({
        scenarioId: 'bad\u0000id'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Identifier must not contain control characters'
        );
      }
    });
  });

  describe('FindPathsRequestSchema', () => {
    test('accepts valid find paths request', () => {
      const result = FindPathsRequestSchema.safeParse({
        scenarioId: 'scenario-1',
        fromNodeId: 'payment_hash:123',
        toNodeId: 'pubkey:456'
      });
      expect(result.success).toBe(true);
    });

    test('rejects find paths request with control character in fromNodeId or toNodeId', () => {
      const resultFrom = FindPathsRequestSchema.safeParse({
        scenarioId: 'scenario-1',
        fromNodeId: 'node\u0000from',
        toNodeId: 'pubkey:456'
      });
      expect(resultFrom.success).toBe(false);

      const resultTo = FindPathsRequestSchema.safeParse({
        scenarioId: 'scenario-1',
        fromNodeId: 'payment_hash:123',
        toNodeId: 'node\u0000to'
      });
      expect(resultTo.success).toBe(false);
    });
  });

  describe('Protocol schemas with IdentifierString', () => {
    test('bitcoinIngestSchema rejects txid containing control characters', () => {
      const result = bitcoinIngestSchema.safeParse({
        transactions: [
          {
            txid: 'bad\u0000txid',
            blockHeight: 800000,
            blockTime: 1700000000,
            inputs: [],
            outputs: []
          }
        ],
        addresses: []
      });
      expect(result.success).toBe(false);
    });

    test('lightningIngestSchema rejects paymentHash containing control characters', () => {
      const result = lightningIngestSchema.safeParse({
        invoices: [
          {
            bolt11: 'lnbc10u1...',
            paymentHash: 'bad\u0000hash',
            preimage: null,
            amountMsat: BigInt(1000),
            createdAt: 1700000000,
            expiresAt: 1700003600,
            payeePubkey: '020000000000000000000000000000000000000000000000000000000000000001'
          }
        ]
      });
      expect(result.success).toBe(false);
    });

    test('nostrIngestSchema rejects pubkey containing control characters', () => {
      const result = nostrIngestSchema.safeParse({
        events: [
          {
            id: 'event-1',
            pubkey: 'bad\u0000pubkey',
            kind: 1,
            tags: [],
            content: 'hello',
            createdAt: 1700000000
          }
        ]
      });
      expect(result.success).toBe(false);
    });

    test('cashuIngestSchema rejects mint url containing control characters', () => {
      const result = cashuIngestSchema.safeParse({
        mints: [
          {
            url: 'https://mint.kepler.internal/\u0000',
            name: 'mint'
          }
        ],
        tokens: [],
        quotes: []
      });
      expect(result.success).toBe(false);
    });
  });
});
