import { PolicyScope } from '@kepler/shared';
import {
  IdentifierString,
  CheckRequestSchema,
  UpdatePolicyRequestSchema,
  PolicyResponseSchema,
  CheckResponseSchema
} from '../../src/modules/policy/policy.validators';

describe('Policy Validators', () => {
  describe('IdentifierString', () => {
    it('accepts valid string within limits', () => {
      const parsed = IdentifierString.parse('valid-identifier-123');
      expect(parsed).toBe('valid-identifier-123');
    });

    it('rejects empty string', () => {
      const result = IdentifierString.safeParse('');
      expect(result.success).toBe(false);
    });

    it('rejects string exceeding 256 characters', () => {
      const longStr = 'a'.repeat(257);
      const result = IdentifierString.safeParse(longStr);
      expect(result.success).toBe(false);
    });

    it('rejects control characters', () => {
      const resultNull = IdentifierString.safeParse('test\u0000val');
      expect(resultNull.success).toBe(false);

      const resultNewline = IdentifierString.safeParse('test\nval');
      expect(resultNewline.success).toBe(false);

      const resultCarriage = IdentifierString.safeParse('test\rval');
      expect(resultCarriage.success).toBe(false);
    });
  });

  describe('CheckRequestSchema', () => {
    it('accepts valid read request', () => {
      const parsed = CheckRequestSchema.parse({ kind: 'read' });
      expect(parsed.kind).toBe('read');
    });

    it('rejects read request with unexpected keys', () => {
      const result = CheckRequestSchema.safeParse({ kind: 'read', extraKey: 'bad' });
      expect(result.success).toBe(false);
    });

    it('accepts valid propose request', () => {
      const parsed = CheckRequestSchema.parse({ kind: 'propose' });
      expect(parsed.kind).toBe('propose');
    });

    it('rejects propose request with unexpected keys', () => {
      const result = CheckRequestSchema.safeParse({ kind: 'propose', extraKey: 'bad' });
      expect(result.success).toBe(false);
    });

    it('accepts valid publish request', () => {
      const parsed = CheckRequestSchema.parse({ kind: 'publish' });
      expect(parsed.kind).toBe('publish');
    });

    it('rejects publish request with unexpected keys', () => {
      const result = CheckRequestSchema.safeParse({ kind: 'publish', extraKey: 'bad' });
      expect(result.success).toBe(false);
    });

    it('accepts valid send request for each protocol', () => {
      const parsedBtc = CheckRequestSchema.parse({
        kind: 'send',
        amountSats: '1000',
        protocol: 'Bitcoin'
      });
      expect(parsedBtc.kind).toBe('send');

      const parsedLnd = CheckRequestSchema.parse({
        kind: 'send',
        amountSats: '500',
        protocol: 'Lightning'
      });
      expect(parsedLnd.kind).toBe('send');

      const parsedCashu = CheckRequestSchema.parse({
        kind: 'send',
        amountSats: '250',
        protocol: 'Cashu'
      });
      expect(parsedCashu.kind).toBe('send');
    });

    it('rejects send request with zero amount', () => {
      const result = CheckRequestSchema.safeParse({
        kind: 'send',
        amountSats: '0',
        protocol: 'Bitcoin'
      });
      expect(result.success).toBe(false);
    });

    it('rejects send request with negative or non-digit amount', () => {
      const resultNegative = CheckRequestSchema.safeParse({
        kind: 'send',
        amountSats: '-100',
        protocol: 'Bitcoin'
      });
      expect(resultNegative.success).toBe(false);

      const resultAlpha = CheckRequestSchema.safeParse({
        kind: 'send',
        amountSats: 'one_hundred',
        protocol: 'Bitcoin'
      });
      expect(resultAlpha.success).toBe(false);
    });

    it('rejects send request with unsupported protocol', () => {
      const result = CheckRequestSchema.safeParse({
        kind: 'send',
        amountSats: '1000',
        protocol: 'Liquid'
      });
      expect(result.success).toBe(false);
    });

    it('rejects send request with unknown keys', () => {
      const result = CheckRequestSchema.safeParse({
        kind: 'send',
        amountSats: '1000',
        protocol: 'Bitcoin',
        memo: 'unexpected'
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid kind discriminator', () => {
      const result = CheckRequestSchema.safeParse({ kind: 'unknown' });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdatePolicyRequestSchema', () => {
    const validPayload = {
      dailyBudgetSats: '100000',
      perTxBudgetSats: '50000',
      scopes: [PolicyScope.Read, PolicyScope.Propose],
      allowedMints: ['https://mint.example.com'],
      allowedRelays: ['wss://relay.example.com'],
      allowedEsplora: ['https://mempool.space/api']
    };

    it('accepts valid update request', () => {
      const parsed = UpdatePolicyRequestSchema.parse(validPayload);
      expect(parsed.dailyBudgetSats).toBe('100000');
      expect(parsed.scopes).toEqual([PolicyScope.Read, PolicyScope.Propose]);
    });

    it('rejects missing fields', () => {
      const { dailyBudgetSats, ...missingField } = validPayload;
      const result = UpdatePolicyRequestSchema.safeParse(missingField);
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric budget strings', () => {
      const result = UpdatePolicyRequestSchema.safeParse({
        ...validPayload,
        dailyBudgetSats: 'not_a_number'
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty scopes list', () => {
      const result = UpdatePolicyRequestSchema.safeParse({
        ...validPayload,
        scopes: []
      });
      expect(result.success).toBe(false);
    });

    it('rejects duplicate scopes', () => {
      const result = UpdatePolicyRequestSchema.safeParse({
        ...validPayload,
        scopes: [PolicyScope.Read, PolicyScope.Read]
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid scope string', () => {
      const result = UpdatePolicyRequestSchema.safeParse({
        ...validPayload,
        scopes: ['InvalidScope']
      });
      expect(result.success).toBe(false);
    });

    it('rejects allowlists with empty strings or control characters', () => {
      const resultEmpty = UpdatePolicyRequestSchema.safeParse({
        ...validPayload,
        allowedMints: ['']
      });
      expect(resultEmpty.success).toBe(false);

      const resultControl = UpdatePolicyRequestSchema.safeParse({
        ...validPayload,
        allowedRelays: ['wss://relay\u0000.com']
      });
      expect(resultControl.success).toBe(false);
    });

    it('rejects unknown properties with strict', () => {
      const result = UpdatePolicyRequestSchema.safeParse({
        ...validPayload,
        extraConfig: true
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PolicyResponseSchema', () => {
    const validResponse = {
      id: 'default',
      dailyBudgetSats: '100000',
      perTxBudgetSats: '50000',
      scopes: [PolicyScope.Read, PolicyScope.Propose],
      allowedMints: ['https://mint.example.com'],
      allowedRelays: ['wss://relay.example.com'],
      allowedEsplora: ['https://mempool.space/api'],
      updatedAt: '2026-09-30T12:00:00.000Z'
    };

    it('accepts valid response payload', () => {
      const parsed = PolicyResponseSchema.parse(validResponse);
      expect(parsed.id).toBe('default');
      expect(parsed.dailyBudgetSats).toBe('100000');
    });

    it('rejects missing properties', () => {
      const { updatedAt, ...missingField } = validResponse;
      const result = PolicyResponseSchema.safeParse(missingField);
      expect(result.success).toBe(false);
    });

    it('rejects unknown properties with strict', () => {
      const result = PolicyResponseSchema.safeParse({
        ...validResponse,
        unknownField: 'bad'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CheckResponseSchema', () => {
    it('accepts valid check response', () => {
      const parsed = CheckResponseSchema.parse({
        allowed: true,
        limits: {
          dailyRemainingSats: '50000',
          perTxLimitSats: '25000'
        }
      });
      expect(parsed.allowed).toBe(true);
      expect(parsed.limits.dailyRemainingSats).toBe('50000');
    });

    it('rejects allowed = false', () => {
      const result = CheckResponseSchema.safeParse({
        allowed: false,
        limits: {
          dailyRemainingSats: '50000',
          perTxLimitSats: '25000'
        }
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown keys with strict', () => {
      const result = CheckResponseSchema.safeParse({
        allowed: true,
        limits: {
          dailyRemainingSats: '50000',
          perTxLimitSats: '25000'
        },
        extraKey: 123
      });
      expect(result.success).toBe(false);
    });
  });
});
