import { ClaimType } from '@kepler/shared';
import { ExecutionClaimBuilder } from '../../src/modules/proof/claims/execution.claim';
import { ProofBuildError } from '../../src/modules/proof/proof.errors';

describe('Execution Claim Build', () => {
  const builder = new ExecutionClaimBuilder();
  const context = {
    now: 1710000000000,
    scenarioId: 'scenario-exec-build'
  };

  it('builds an execution claim with a Lightning payment hash asserting bundle is correct', () => {
    const paymentHash = 'c'.repeat(64);
    const input = {
      protocol: 'Lightning' as const,
      identifier: paymentHash,
      amountSats: '2500',
      rawDataRefs: [
        {
          source: 'Lightning' as const,
          ref: `ln:${paymentHash}`,
          payload: { paymentHash, settled: true }
        }
      ]
    };

    const { bundle } = builder.build(context, input);

    expect(bundle.bundleHash).toBeDefined();
    expect(bundle.claim.type).toBe(ClaimType.Transaction);
    expect(bundle.confidence).toBe(1.0);
    expect(bundle.claim.text).toBe(
      `A payment of 2500 sats was executed via protocol Lightning with identifier ${paymentHash}.`
    );
    expect(bundle.rawDataRefs).toHaveLength(1);
    expect(bundle.rawDataRefs[0].source).toBe('Lightning');
    expect(bundle.rawDataRefs[0].ref).toBe(`ln:${paymentHash}`);

    expect(bundle.verificationSteps).toHaveLength(1);
    expect(bundle.verificationSteps[0].name).toBe('execution:identifier');
    expect(bundle.verificationSteps[0].endpoint).toBe('/api/proof/verify');
    expect(bundle.verificationSteps[0].expected).toBe(paymentHash);
  });

  it('builds with an invalid protocol expecting ProofBuildError', () => {
    const invalidInput = {
      protocol: 'InvalidProtocol',
      identifier: 'xyz',
      amountSats: '100',
      rawDataRefs: []
    };

    expect(() => {
      builder.build(context, invalidInput);
    }).toThrow(ProofBuildError);

    try {
      builder.build(context, invalidInput);
    } catch (error) {
      expect(error).toBeInstanceOf(ProofBuildError);
      expect((error as ProofBuildError).code).toBe('PROOF_BUILD_ERROR');
      expect((error as ProofBuildError).context).toHaveProperty('claimType', ClaimType.Transaction);
    }
  });
});
