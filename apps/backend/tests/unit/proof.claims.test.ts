import { ClaimType } from '@kepler/shared';
import {
  TaintCorrelationClaimBuilder,
  TaintCorrelationClaimVerifier
} from '../../src/modules/proof/claims/taintCorrelation.claim';
import {
  ExecutionClaimBuilder,
  ExecutionClaimVerifier
} from '../../src/modules/proof/claims/execution.claim';
import { ProofBuildError } from '../../src/modules/proof/proof.errors';

describe('Part C Claim Builders and Verifiers', () => {
  const context = {
    now: 1700000000000,
    scenarioId: 'test-scenario-1'
  };

  describe('TaintCorrelationClaimBuilder and Verifier', () => {
    const builder = new TaintCorrelationClaimBuilder();
    const verifier = new TaintCorrelationClaimVerifier();

    it('verifies SAME_PAYMENT_HASH in content', () => {
      const paymentHash = 'a'.repeat(64);
      const input = {
        fromNodeId: `payment_hash:${paymentHash}`,
        toNodeId: 'event:nostr-event-1',
        relationship: 'SAME_PAYMENT_HASH',
        confidence: 0.9,
        edgeEvidence: [
          {
            kind: 'RawData',
            ref: 'nostr-event-1',
            description: 'hash match',
            data: { field: 'content' }
          }
        ],
        rawDataRefs: [
          {
            source: 'Lightning' as const,
            ref: `payment_hash:${paymentHash}`,
            payload: { paymentHash }
          },
          {
            source: 'Nostr' as const,
            ref: 'nostr-event-1',
            payload: {
              id: 'nostr-event-1',
              pubkey: 'b'.repeat(64),
              content: `Here is payment hash ${paymentHash}`,
              tags: []
            }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      expect(bundle.claim.type).toBe(ClaimType.Privacy);
      expect(bundle.confidence).toBe(0.9);
      expect(bundle.claim.text).toBe(
        `${input.fromNodeId} and ${input.toNodeId} are correlated via SAME_PAYMENT_HASH with confidence 0.9.`
      );

      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('verifies SAME_PAYMENT_HASH in tags case-insensitively', () => {
      const paymentHash = 'a1b2c3d4e5f6'.padEnd(64, '0');
      const input = {
        fromNodeId: 'nodeA',
        toNodeId: 'nodeB',
        relationship: 'SAME_PAYMENT_HASH',
        confidence: 0.85,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Lightning' as const,
            ref: 'ln-ref',
            payload: { paymentHash }
          },
          {
            source: 'Nostr' as const,
            ref: 'nostr-ref',
            payload: {
              content: 'hello',
              tags: [['p', paymentHash.toUpperCase()]]
            }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('fails SAME_PAYMENT_HASH when payment hash is absent', () => {
      const input = {
        fromNodeId: 'nodeA',
        toNodeId: 'nodeB',
        relationship: 'SAME_PAYMENT_HASH',
        confidence: 0.8,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Lightning' as const,
            ref: 'ln-ref',
            payload: { paymentHash: '1'.repeat(64) }
          },
          {
            source: 'Nostr' as const,
            ref: 'nostr-ref',
            payload: {
              content: 'completely unrelated text',
              tags: []
            }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STEP_FAILED');
      expect(result.failedStep).toBe('SAME_PAYMENT_HASH:recompute');
    });

    it('returns MISSING_RAW_DATA when Nostr ref is absent for SAME_PAYMENT_HASH', () => {
      const input = {
        fromNodeId: 'nodeA',
        toNodeId: 'nodeB',
        relationship: 'SAME_PAYMENT_HASH',
        confidence: 0.8,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Lightning' as const,
            ref: 'ln-ref',
            payload: { paymentHash: '1'.repeat(64) }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('MISSING_RAW_DATA');
    });

    it('verifies SAME_PREIMAGE in Nostr event', () => {
      const preimage = 'f'.repeat(64);
      const input = {
        fromNodeId: 'nodeA',
        toNodeId: 'nodeB',
        relationship: 'SAME_PREIMAGE',
        confidence: 1.0,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Lightning' as const,
            ref: 'ln-ref',
            payload: { preimage }
          },
          {
            source: 'Nostr' as const,
            ref: 'nostr-ref',
            payload: {
              content: `payment preimage was ${preimage}`,
              tags: []
            }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('verifies PUBLISHED_BY when Nostr event pubkey matches', () => {
      const pubkey = 'c'.repeat(64);
      const input = {
        fromNodeId: 'event:1',
        toNodeId: `pubkey:${pubkey}`,
        relationship: 'PUBLISHED_BY',
        confidence: 1.0,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Nostr' as const,
            ref: 'event:1',
            payload: {
              id: 'event:1',
              pubkey,
              content: 'test',
              tags: []
            }
          },
          {
            source: 'Nostr' as const,
            ref: `pubkey:${pubkey}`,
            payload: { pubkey }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('fails PUBLISHED_BY when pubkey does not match', () => {
      const input = {
        fromNodeId: 'event:1',
        toNodeId: 'pubkey:expected',
        relationship: 'PUBLISHED_BY',
        confidence: 1.0,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Nostr' as const,
            ref: 'event:1',
            payload: {
              id: 'event:1',
              pubkey: 'd'.repeat(64),
              content: 'test',
              tags: []
            }
          },
          {
            source: 'Nostr' as const,
            ref: `pubkey:${'e'.repeat(64)}`,
            payload: { pubkey: 'e'.repeat(64) }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STEP_FAILED');
    });

    it('verifies SHARED_MINT case-sensitively', () => {
      const mintUrl = 'https://mint.example.com';
      const input = {
        fromNodeId: `mint:${mintUrl}`,
        toNodeId: 'event:nostr-1',
        relationship: 'SHARED_MINT',
        confidence: 0.6,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Cashu' as const,
            ref: `mint:${mintUrl}`,
            payload: { mint: mintUrl }
          },
          {
            source: 'Nostr' as const,
            ref: 'event:nostr-1',
            payload: {
              content: `I love this mint: ${mintUrl}`,
              tags: []
            }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('fails SHARED_MINT when case does not match', () => {
      const mintUrl = 'https://Mint.Example.Com';
      const input = {
        fromNodeId: 'mint-node',
        toNodeId: 'event-node',
        relationship: 'SHARED_MINT',
        confidence: 0.6,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Cashu' as const,
            ref: 'mint-ref',
            payload: { mint: mintUrl }
          },
          {
            source: 'Nostr' as const,
            ref: 'nostr-ref',
            payload: {
              content: 'https://mint.example.com lowercase only',
              tags: []
            }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STEP_FAILED');
    });

    it('verifies CASHU_QUOTE_INVOICE when quote request contains payment hash', () => {
      const paymentHash = '9'.repeat(64);
      const input = {
        fromNodeId: 'mint-1',
        toNodeId: `payment_hash:${paymentHash}`,
        relationship: 'CASHU_QUOTE_INVOICE',
        confidence: 1.0,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Lightning' as const,
            ref: `payment_hash:${paymentHash}`,
            payload: { paymentHash }
          },
          {
            source: 'Cashu' as const,
            ref: 'quote-1',
            payload: {
              quote: 'q123',
              request: `lnbc100u1p...${paymentHash}...`
            }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('verifies TEMPORAL_WINDOW when timestamps are within window', () => {
      const input = {
        fromNodeId: 'tx:1',
        toNodeId: 'invoice:1',
        relationship: 'TEMPORAL_WINDOW',
        confidence: 0.5,
        edgeEvidence: [
          {
            kind: 'RawData',
            ref: 'tx:1',
            description: 'time A',
            data: { match: 1000, windowSeconds: 300 }
          },
          {
            kind: 'RawData',
            ref: 'invoice:1',
            description: 'time B',
            data: { match: 1200, windowSeconds: 300 }
          }
        ],
        rawDataRefs: [
          {
            source: 'Bitcoin' as const,
            ref: 'tx:1',
            payload: { blockTime: 1000 }
          },
          {
            source: 'Lightning' as const,
            ref: 'invoice:1',
            payload: { createdAt: 1200 }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('fails TEMPORAL_WINDOW when timestamps exceed window', () => {
      const input = {
        fromNodeId: 'tx:1',
        toNodeId: 'invoice:1',
        relationship: 'TEMPORAL_WINDOW',
        confidence: 0.5,
        edgeEvidence: [
          {
            kind: 'RawData',
            ref: 'tx:1',
            description: 'time A',
            data: { match: 1000, windowSeconds: 100 }
          },
          {
            kind: 'RawData',
            ref: 'invoice:1',
            description: 'time B',
            data: { match: 1500, windowSeconds: 100 }
          }
        ],
        rawDataRefs: [
          {
            source: 'Bitcoin' as const,
            ref: 'tx:1',
            payload: { blockTime: 1000 }
          },
          {
            source: 'Lightning' as const,
            ref: 'invoice:1',
            payload: { createdAt: 1500 }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STEP_FAILED');
    });

    it('detects HASH_MISMATCH when bundle hash is altered', () => {
      const paymentHash = 'a'.repeat(64);
      const input = {
        fromNodeId: 'nodeA',
        toNodeId: 'nodeB',
        relationship: 'SAME_PAYMENT_HASH',
        confidence: 1.0,
        edgeEvidence: [],
        rawDataRefs: [
          {
            source: 'Lightning' as const,
            ref: 'ln-ref',
            payload: { paymentHash }
          },
          {
            source: 'Nostr' as const,
            ref: 'nostr-ref',
            payload: {
              content: paymentHash,
              tags: []
            }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const tamperedBundle = Object.create(bundle, {
        bundleHash: { value: 'tampered-hash-value' }
      });

      const result = verifier.verify({ bundle: tamperedBundle });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('HASH_MISMATCH');
      expect(result.failedStep).toBe('bundleHash');
    });

    it('throws ProofBuildError on invalid input', () => {
      expect(() => {
        builder.build(context, { fromNodeId: '' });
      }).toThrow(ProofBuildError);
    });
  });

  describe('ExecutionClaimBuilder and Verifier', () => {
    const builder = new ExecutionClaimBuilder();
    const verifier = new ExecutionClaimVerifier();

    it('builds and verifies a Bitcoin execution claim', () => {
      const txid = '3'.repeat(64);
      const input = {
        protocol: 'Bitcoin' as const,
        identifier: txid,
        amountSats: '50000',
        rawDataRefs: [
          {
            source: 'Bitcoin' as const,
            ref: txid,
            payload: { txid, confirmed: true }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      expect(bundle.claim.type).toBe(ClaimType.Transaction);
      expect(bundle.confidence).toBe(1.0);
      expect(bundle.verificationSteps[0].name).toBe('execution:identifier');

      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('builds and verifies a Lightning execution claim', () => {
      const paymentHash = '4'.repeat(64);
      const input = {
        protocol: 'Lightning' as const,
        identifier: paymentHash,
        amountSats: '1000',
        rawDataRefs: [
          {
            source: 'Lightning' as const,
            ref: `ln:${paymentHash}`,
            payload: { paymentHash, settled: true }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('builds and verifies a Cashu execution claim', () => {
      const quoteId = 'cashu-quote-abc';
      const input = {
        protocol: 'Cashu' as const,
        identifier: quoteId,
        amountSats: '250',
        rawDataRefs: [
          {
            source: 'Cashu' as const,
            ref: quoteId,
            payload: { quote: quoteId, state: 'paid' }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(true);
    });

    it('fails when identifier is absent from payload', () => {
      const input = {
        protocol: 'Bitcoin' as const,
        identifier: 'expected-txid',
        amountSats: '1000',
        rawDataRefs: [
          {
            source: 'Bitcoin' as const,
            ref: 'wrong-ref',
            payload: { txid: 'another-txid' }
          }
        ]
      };

      const { bundle } = builder.build(context, input);
      const result = verifier.verify({ bundle });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('IDENTIFIER_MISSING');
      expect(result.failedStep).toBe('execution:identifier');
    });

    it('throws ProofBuildError on invalid execution input', () => {
      expect(() => {
        builder.build(context, { protocol: 'Unknown' });
      }).toThrow(ProofBuildError);
    });
  });
});
