import {
  IdentifierString,
  RouteCandidateSchema,
  OrchestrateRequestSchema,
  DecisionSummarySchema,
  ExecutionSummarySchema,
  OrchestrateResponseSchema
} from '../../src/modules/orchestrator/orchestrator.validators';

describe('Orchestrator Validators', () => {
  describe('IdentifierString', () => {
    it('accepts valid identifier strings', () => {
      const valid = 'scenario-123_abc';
      expect(IdentifierString.parse(valid)).toBe(valid);
    });

    it('rejects empty strings', () => {
      expect(() => IdentifierString.parse('')).toThrow();
    });

    it('rejects strings longer than 256 characters', () => {
      const longString = 'a'.repeat(257);
      expect(() => IdentifierString.parse(longString)).toThrow();
    });

    it('rejects control characters', () => {
      expect(() => IdentifierString.parse('invalid\u0000id')).toThrow();
      expect(() => IdentifierString.parse('invalid\nid')).toThrow();
    });
  });

  describe('RouteCandidateSchema', () => {
    const validCandidate = {
      name: 'candidate-1',
      protocol: 'Lightning' as const,
      estimatedFeeSats: '150',
      estimatedLinkageConfidence: 0.25,
      mint: 'mint-1',
      params: { maxHops: 3 }
    };

    it('validates a correct route candidate', () => {
      const parsed = RouteCandidateSchema.parse(validCandidate);
      expect(parsed).toEqual(validCandidate);
    });

    it('rejects unsupported protocol', () => {
      expect(() =>
        RouteCandidateSchema.parse({
          ...validCandidate,
          protocol: 'Unsupported'
        })
      ).toThrow();
    });

    it('rejects non-digit estimatedFeeSats', () => {
      expect(() =>
        RouteCandidateSchema.parse({
          ...validCandidate,
          estimatedFeeSats: '-10'
        })
      ).toThrow();

      expect(() =>
        RouteCandidateSchema.parse({
          ...validCandidate,
          estimatedFeeSats: '10.5'
        })
      ).toThrow();

      expect(() =>
        RouteCandidateSchema.parse({
          ...validCandidate,
          estimatedFeeSats: 'abc'
        })
      ).toThrow();
    });

    it('rejects confidence below 0 or above 1', () => {
      expect(() =>
        RouteCandidateSchema.parse({
          ...validCandidate,
          estimatedLinkageConfidence: -0.1
        })
      ).toThrow();

      expect(() =>
        RouteCandidateSchema.parse({
          ...validCandidate,
          estimatedLinkageConfidence: 1.1
        })
      ).toThrow();
    });

    it('rejects unknown keys due to strict validation', () => {
      expect(() =>
        RouteCandidateSchema.parse({
          ...validCandidate,
          unexpectedExtraKey: 'value'
        })
      ).toThrow();
    });
  });

  describe('OrchestrateRequestSchema', () => {
    const validRequest = {
      scenarioId: 'scenario-456',
      ingestData: {
        lightning: {
          invoices: [
            {
              bolt11: 'lnbc100n1...',
              paymentHash: 'hash-123',
              preimage: null,
              amountMsat: BigInt(100000),
              createdAt: 1700000000,
              expiresAt: 1700003600,
              payeePubkey: '02abcdef...'
            }
          ]
        }
      },
      candidateRoutes: [
        {
          name: 'lightning-route',
          protocol: 'Lightning' as const,
          estimatedFeeSats: '10',
          estimatedLinkageConfidence: 0.1,
          params: {}
        }
      ]
    };

    it('validates a correct request', () => {
      const parsed = OrchestrateRequestSchema.parse(validRequest);
      expect(parsed.scenarioId).toBe('scenario-456');
      expect(parsed.candidateRoutes?.length).toBe(1);
    });

    it('accepts request without candidateRoutes', () => {
      const { candidateRoutes, ...requestWithoutRoutes } = validRequest;
      const parsed = OrchestrateRequestSchema.parse(requestWithoutRoutes);
      expect(parsed.candidateRoutes).toBeUndefined();
    });

    it('rejects unknown keys on request object', () => {
      expect(() =>
        OrchestrateRequestSchema.parse({
          ...validRequest,
          extraField: 'not-allowed'
        })
      ).toThrow();
    });
  });

  describe('DecisionSummarySchema', () => {
    const validDecision = {
      routeName: 'optimal-cashu',
      protocol: 'Cashu',
      evidenceBundleHash: 'hash-abc-789',
      reason: 'Lowest linkage confidence score'
    };

    it('validates a correct decision summary', () => {
      const parsed = DecisionSummarySchema.parse(validDecision);
      expect(parsed).toEqual(validDecision);
    });

    it('rejects unknown keys', () => {
      expect(() =>
        DecisionSummarySchema.parse({
          ...validDecision,
          extra: true
        })
      ).toThrow();
    });
  });

  describe('ExecutionSummarySchema', () => {
    const validExecution = {
      status: 'succeeded' as const,
      amountSats: '5000',
      feeSats: '25',
      identifier: 'txid-999',
      protocol: 'Bitcoin'
    };

    it('validates a correct execution summary', () => {
      const parsed = ExecutionSummarySchema.parse(validExecution);
      expect(parsed).toEqual(validExecution);
    });

    it('rejects non-numeric amountSats or feeSats', () => {
      expect(() =>
        ExecutionSummarySchema.parse({
          ...validExecution,
          amountSats: '5000sats'
        })
      ).toThrow();

      expect(() =>
        ExecutionSummarySchema.parse({
          ...validExecution,
          feeSats: 'fee'
        })
      ).toThrow();
    });

    it('rejects invalid status', () => {
      expect(() =>
        ExecutionSummarySchema.parse({
          ...validExecution,
          status: 'pending'
        })
      ).toThrow();
    });

    it('rejects unknown keys', () => {
      expect(() =>
        ExecutionSummarySchema.parse({
          ...validExecution,
          unknownKey: 'data'
        })
      ).toThrow();
    });
  });

  describe('OrchestrateResponseSchema', () => {
    const validResponse = {
      scenarioId: 'scenario-001',
      decision: {
        routeName: 'route-alpha',
        protocol: 'Lightning',
        evidenceBundleHash: 'bundle-hash-1',
        reason: 'Selected by linkage score'
      },
      execution: {
        status: 'succeeded' as const,
        amountSats: '1000',
        feeSats: '5',
        identifier: 'payment-id-1',
        protocol: 'Lightning'
      },
      nostrEventId: 'nostr-event-123'
    };

    it('validates a correct response with string nostrEventId', () => {
      const parsed = OrchestrateResponseSchema.parse(validResponse);
      expect(parsed.nostrEventId).toBe('nostr-event-123');
    });

    it('validates a correct response with null nostrEventId', () => {
      const parsed = OrchestrateResponseSchema.parse({
        ...validResponse,
        nostrEventId: null
      });
      expect(parsed.nostrEventId).toBeNull();
    });

    it('rejects unknown keys on response object', () => {
      expect(() =>
        OrchestrateResponseSchema.parse({
          ...validResponse,
          extraField: 'reject me'
        })
      ).toThrow();
    });
  });
});
