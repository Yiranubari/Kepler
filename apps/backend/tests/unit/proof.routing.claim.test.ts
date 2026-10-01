import { ClaimType, EvidenceBundle, VerificationStep } from '@kepler/shared';
import {
  RoutingClaimBuilder,
  RoutingClaimVerifier,
  RoutingClaimInput
} from '../../src/modules/proof/claims/routing.claim';
import { ProofBuildError } from '../../src/modules/proof/proof.errors';

describe('RoutingClaimBuilder and RoutingClaimVerifier', () => {
  const builder = new RoutingClaimBuilder();
  const verifier = new RoutingClaimVerifier();
  const fixedNow = 1700000000000;
  const context = { now: fixedNow, scenarioId: 'scenario-routing-1' };

  const candidateA = {
    name: 'route-lightning-fast',
    protocol: 'Lightning' as const,
    estimatedFeeSats: '25',
    estimatedLinkageConfidence: 0.45,
    params: {}
  };

  const candidateB = {
    name: 'route-lightning-private',
    protocol: 'Lightning' as const,
    estimatedFeeSats: '50',
    estimatedLinkageConfidence: 0.125,
    params: {}
  };

  const validInput: RoutingClaimInput = {
    targetKind: 'Lightning',
    selectedRouteName: 'route-lightning-private',
    candidates: [candidateA, candidateB],
    rawDataRefs: [
      {
        source: 'Lightning',
        ref: 'route-ref-001',
        payload: { channel: '123x456x789' }
      }
    ]
  };

  it('builds a routing claim where winning route name and 4-decimal confidence are included in text', () => {
    const { bundle } = builder.build(context, validInput);

    expect(bundle.claim.type).toBe(ClaimType.Routing);
    expect(bundle.claim.text).toContain('route-lightning-private');
    expect(bundle.claim.text).toContain('0.1250');
    expect(bundle.claim.text).toBe(
      'Route route-lightning-private via Lightning was selected over 1 other candidates because it has the lowest estimated linkage confidence (0.1250).'
    );
    expect(bundle.confidence).toBe(1.0);
    expect(bundle.riskScore).toBe(0.125);
    expect(bundle.verificationSteps.length).toBe(2);
    expect(bundle.verificationSteps[0].name).toBe('routing:selection');
    expect(bundle.verificationSteps[1].name).toBe('routing:deterministic');
  });

  it('throws ProofBuildError with SELECTION_MISMATCH when selectedRouteName does not match winner', () => {
    const mismatchInput: RoutingClaimInput = {
      ...validInput,
      selectedRouteName: 'route-lightning-fast'
    };

    expect(() => {
      builder.build(context, mismatchInput);
    }).toThrow(ProofBuildError);

    try {
      builder.build(context, mismatchInput);
    } catch (error) {
      expect(error).toBeInstanceOf(ProofBuildError);
      const pbe = error as ProofBuildError;
      expect(pbe.context['reason']).toBe('SELECTION_MISMATCH');
      expect(pbe.context['claimType']).toBe(ClaimType.Routing);
    }
  });

  it('verifies a valid evidence bundle', () => {
    const { bundle } = builder.build(context, validInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(true);
    expect(result.reason).toBe('All verification steps passed and bundle hash verified');
  });

  it('fails verification with STEP_FAILED and failedStep routing:selection when candidates in step.input are tampered and hash is recomputed', () => {
    const { bundle } = builder.build(context, validInput);

    const tamperedCandidates = [
      candidateA,
      candidateB,
      {
        name: 'route-tampered-winner',
        protocol: 'Lightning' as const,
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.05,
        params: {}
      }
    ];

    const tamperedStep = new VerificationStep({
      name: 'routing:selection',
      endpoint: '/api/proof/verify',
      input: {
        targetKind: 'Lightning',
        candidates: tamperedCandidates
      },
      expected: 'route-lightning-private'
    });

    const tamperedBundle = new EvidenceBundle({
      id: bundle.id,
      claim: bundle.claim,
      rawDataRefs: [...bundle.rawDataRefs],
      verificationSteps: [tamperedStep, bundle.verificationSteps[1]],
      confidence: bundle.confidence,
      riskScore: bundle.riskScore,
      createdAt: bundle.createdAt
    });

    const result = verifier.verify({ bundle: tamperedBundle });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('routing:selection');
    expect(result.expected).toBe('route-lightning-private');
    expect(result.actual).toBe('route-tampered-winner');
  });

  it('fails verification with HASH_MISMATCH when candidates in step.input are tampered without recomputing hash', () => {
    const { bundle } = builder.build(context, validInput);

    const tamperedCandidates = [
      candidateA,
      candidateB,
      {
        name: 'route-tampered-winner',
        protocol: 'Lightning' as const,
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.05,
        params: {}
      }
    ];

    const tamperedStep = new VerificationStep({
      name: 'routing:selection',
      endpoint: '/api/proof/verify',
      input: {
        targetKind: 'Lightning',
        candidates: tamperedCandidates
      },
      expected: 'route-lightning-private'
    });

    const tamperedBundle = new EvidenceBundle({
      id: bundle.id,
      claim: bundle.claim,
      rawDataRefs: [...bundle.rawDataRefs],
      verificationSteps: [tamperedStep, bundle.verificationSteps[1]],
      confidence: bundle.confidence,
      riskScore: bundle.riskScore,
      bundleHash: bundle.bundleHash,
      createdAt: bundle.createdAt
    });

    const result = verifier.verify({ bundle: tamperedBundle });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('HASH_MISMATCH');
    expect(result.failedStep).toBe('bundleHash');
    expect(result.expected).toBe(bundle.bundleHash);
    expect(result.actual).toBe(tamperedBundle.computeHash());
  });

  it('fails verification with HASH_MISMATCH when bundle hash only is tampered', () => {
    const { bundle } = builder.build(context, validInput);

    const tamperedBundle = new EvidenceBundle({
      id: bundle.id,
      claim: bundle.claim,
      rawDataRefs: [...bundle.rawDataRefs],
      verificationSteps: [...bundle.verificationSteps],
      confidence: bundle.confidence,
      riskScore: bundle.riskScore,
      bundleHash: '0000000000000000000000000000000000000000000000000000000000000000',
      createdAt: bundle.createdAt
    });

    const result = verifier.verify({ bundle: tamperedBundle });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('HASH_MISMATCH');
    expect(result.failedStep).toBe('bundleHash');
    expect(result.expected).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(result.actual).toBe(bundle.bundleHash);
  });

  it('determinism: building twice with identical now produces identical bundleHash', () => {
    const buildOne = builder.build(context, validInput);
    const buildTwo = builder.build(context, validInput);

    expect(buildOne.bundle.bundleHash).toBe(buildTwo.bundle.bundleHash);
  });
});
