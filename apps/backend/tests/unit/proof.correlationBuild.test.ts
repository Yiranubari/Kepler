import { ClaimType } from '@kepler/shared';
import { TaintCorrelationClaimBuilder } from '../../src/modules/proof/claims/taintCorrelation.claim';
import { ProofBuildError } from '../../src/modules/proof/proof.errors';

describe('Taint Correlation Build', () => {
  const builder = new TaintCorrelationClaimBuilder();
  const context = {
    now: 1710000000000,
    scenarioId: 'scenario-corr-build'
  };

  const paymentHash = 'e'.repeat(64);
  const validInput = {
    fromNodeId: `payment_hash:${paymentHash}`,
    toNodeId: 'event:nostr-1',
    relationship: 'SAME_PAYMENT_HASH',
    confidence: 0.95,
    edgeEvidence: [
      {
        kind: 'RawData',
        ref: 'nostr-1',
        description: 'Payment hash in Nostr event',
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
        ref: 'nostr-1',
        payload: {
          id: 'nostr-1',
          pubkey: 'f'.repeat(64),
          content: `payment: ${paymentHash}`,
          tags: []
        }
      }
    ]
  };

  it('builds a SAME_PAYMENT_HASH claim with valid input', () => {
    const { bundle } = builder.build(context, validInput);

    expect(bundle.bundleHash).toBeDefined();
    expect(typeof bundle.bundleHash).toBe('string');
    expect(bundle.bundleHash.length).toBe(64);

    expect(bundle.claim.type).toBe(ClaimType.Privacy);

    const expectedText = `${validInput.fromNodeId} and ${validInput.toNodeId} are correlated via SAME_PAYMENT_HASH with confidence 0.95.`;
    expect(bundle.claim.text).toBe(expectedText);

    expect(bundle.rawDataRefs).toHaveLength(2);
    expect(bundle.rawDataRefs[0].source).toBe('Lightning');
    expect(bundle.rawDataRefs[0].ref).toBe(`payment_hash:${paymentHash}`);
    expect(bundle.rawDataRefs[1].source).toBe('Nostr');
    expect(bundle.rawDataRefs[1].ref).toBe('nostr-1');

    expect(bundle.verificationSteps).toHaveLength(1);
    expect(bundle.verificationSteps[0].name).toBe('SAME_PAYMENT_HASH:recompute');
    expect(bundle.verificationSteps[0].endpoint).toBe('/api/proof/verify');
  });

  it('builds twice with identical input and identical now asserting identical bundleHash', () => {
    const build1 = builder.build(context, validInput);
    const build2 = builder.build(context, validInput);

    expect(build1.bundle.bundleHash).toBe(build2.bundle.bundleHash);
  });

  it('builds with a malformed input missing fromNodeId throwing ProofBuildError', () => {
    const malformedInput = {
      toNodeId: 'event:nostr-1',
      relationship: 'SAME_PAYMENT_HASH',
      confidence: 0.95,
      edgeEvidence: [],
      rawDataRefs: []
    };

    expect(() => {
      builder.build(context, malformedInput);
    }).toThrow(ProofBuildError);

    try {
      builder.build(context, malformedInput);
    } catch (error) {
      expect(error).toBeInstanceOf(ProofBuildError);
      expect((error as ProofBuildError).code).toBe('PROOF_BUILD_ERROR');
      expect((error as ProofBuildError).context).toHaveProperty('claimType', ClaimType.Privacy);
    }
  });
});
