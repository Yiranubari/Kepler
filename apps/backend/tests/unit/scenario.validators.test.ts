import {
  PaymentTargetKind,
  PaymentTarget,
  ScenarioStatus,
  Scenario
} from '@kepler/shared';
import {
  PaymentTargetSchema,
  CreateScenarioRequestSchema,
  ScenarioIdParamSchema,
  UpdateStatusRequestSchema,
  ScenarioResponseSchema,
  ListScenariosResponseSchema
} from '../../src/modules/scenario/scenario.validators';

describe('Scenario Validators', () => {
  describe('PaymentTargetSchema', () => {
    it('validates Lightning target with valid lnbc invoice', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Lightning',
        payload: { invoice: 'lnbc100u1testinvoice' }
      });
      expect(result.success).toBe(true);
    });

    it('validates Lightning target with lntb and lnbcrt invoices', () => {
      const testnet = PaymentTargetSchema.safeParse({
        kind: 'Lightning',
        payload: { invoice: 'lntb100u1testinvoice' }
      });
      expect(testnet.success).toBe(true);

      const regtest = PaymentTargetSchema.safeParse({
        kind: 'Lightning',
        payload: { invoice: 'lnbcrt100u1testinvoice' }
      });
      expect(regtest.success).toBe(true);
    });

    it('rejects Lightning target with empty invoice', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Lightning',
        payload: { invoice: '' }
      });
      expect(result.success).toBe(false);
    });

    it('rejects Lightning target with invalid invoice prefix', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Lightning',
        payload: { invoice: 'invalid_invoice_string' }
      });
      expect(result.success).toBe(false);
    });

    it('validates Bitcoin target with valid bech32 address and numeric amountSats', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Bitcoin',
        payload: {
          address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
          amountSats: '50000'
        }
      });
      expect(result.success).toBe(true);
    });

    it('validates Bitcoin target with legacy and P2SH address prefixes', () => {
      const legacy = PaymentTargetSchema.safeParse({
        kind: 'Bitcoin',
        payload: {
          address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          amountSats: '1000'
        }
      });
      expect(legacy.success).toBe(true);

      const p2sh = PaymentTargetSchema.safeParse({
        kind: 'Bitcoin',
        payload: {
          address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
          amountSats: '2500'
        }
      });
      expect(p2sh.success).toBe(true);
    });

    it('rejects Bitcoin target with non-numeric amountSats', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Bitcoin',
        payload: {
          address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
          amountSats: 'not_a_number'
        }
      });
      expect(result.success).toBe(false);
    });

    it('rejects Bitcoin target with negative amountSats', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Bitcoin',
        payload: {
          address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
          amountSats: '-500'
        }
      });
      expect(result.success).toBe(false);
    });

    it('rejects Bitcoin target with invalid address prefix', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Bitcoin',
        payload: {
          address: 'invalid_address_prefix_123',
          amountSats: '1000'
        }
      });
      expect(result.success).toBe(false);
    });

    it('validates Cashu target with non-empty request', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Cashu',
        payload: { request: 'cashuAeyJob25...' }
      });
      expect(result.success).toBe(true);
    });

    it('rejects Cashu target with empty request', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Cashu',
        payload: { request: '' }
      });
      expect(result.success).toBe(false);
    });

    it('rejects unsupported target kind', () => {
      const result = PaymentTargetSchema.safeParse({
        kind: 'Ethereum',
        payload: { address: '0x123' }
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateScenarioRequestSchema', () => {
    it('validates request containing target', () => {
      const result = CreateScenarioRequestSchema.safeParse({
        target: {
          kind: 'Lightning',
          payload: { invoice: 'lnbc100u1valid' }
        }
      });
      expect(result.success).toBe(true);
    });

    it('rejects request missing target', () => {
      const result = CreateScenarioRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('ScenarioIdParamSchema', () => {
    it('validates valid scenario ID', () => {
      const result = ScenarioIdParamSchema.safeParse({
        id: 'scenario-valid-id-123'
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty scenario ID', () => {
      const result = ScenarioIdParamSchema.safeParse({
        id: ''
      });
      expect(result.success).toBe(false);
    });

    it('rejects scenario ID containing control characters', () => {
      const result = ScenarioIdParamSchema.safeParse({
        id: 'scenario\u0000id'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateStatusRequestSchema', () => {
    it('validates every ScenarioStatus enum value', () => {
      const statuses = [
        ScenarioStatus.Pending,
        ScenarioStatus.Analyzed,
        ScenarioStatus.Decided,
        ScenarioStatus.Executed,
        ScenarioStatus.Failed
      ];
      for (const status of statuses) {
        const result = UpdateStatusRequestSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      const result = UpdateStatusRequestSchema.safeParse({
        status: 'NonExistentStatus'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ScenarioResponseSchema', () => {
    it('validates shared Scenario class toJSON output', () => {
      const scenario = new Scenario({
        id: 'scenario-test-response-1',
        target: new PaymentTarget({
          kind: PaymentTargetKind.Lightning,
          payload: { invoice: 'lnbc100u1test' }
        }),
        status: ScenarioStatus.Pending,
        createdAt: new Date('2026-09-26T12:00:00.000Z'),
        updatedAt: new Date('2026-09-26T12:00:00.000Z')
      });

      const json = scenario.toJSON();
      const result = ScenarioResponseSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    it('validates Bitcoin scenario response shape', () => {
      const scenario = new Scenario({
        id: 'scenario-test-response-2',
        target: new PaymentTarget({
          kind: PaymentTargetKind.Bitcoin,
          payload: {
            address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
            amountSats: 100000
          }
        }),
        status: ScenarioStatus.Analyzed
      });

      const json = scenario.toJSON();
      const result = ScenarioResponseSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    it('rejects response missing required fields', () => {
      const result = ScenarioResponseSchema.safeParse({
        id: 'scenario-1'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListScenariosResponseSchema', () => {
    it('validates array of scenario responses', () => {
      const scenario = new Scenario({
        id: 'scenario-list-1',
        target: new PaymentTarget({
          kind: PaymentTargetKind.Cashu,
          payload: { request: 'cashu-req-123' }
        })
      });

      const result = ListScenariosResponseSchema.safeParse([scenario.toJSON()]);
      expect(result.success).toBe(true);
    });

    it('rejects non-array input', () => {
      const result = ListScenariosResponseSchema.safeParse({ not: 'an array' });
      expect(result.success).toBe(false);
    });
  });
});
