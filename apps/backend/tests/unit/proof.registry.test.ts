import { ClaimType } from '@kepler/shared';
import { ClaimRegistry } from '../../src/modules/proof/claims/registry';
import {
  TaintCorrelationClaimBuilder,
  TaintCorrelationClaimVerifier
} from '../../src/modules/proof/claims/taintCorrelation.claim';
import {
  ExecutionClaimBuilder,
  ExecutionClaimVerifier
} from '../../src/modules/proof/claims/execution.claim';
import { ProofUnsupportedClaimError } from '../../src/modules/proof/proof.errors';

describe('ClaimRegistry', () => {
  it('creates default registry with Privacy and Transaction handlers', () => {
    const registry = ClaimRegistry.createDefault();

    const privacyBuilder = registry.getBuilder(ClaimType.Privacy);
    const privacyVerifier = registry.getVerifier(ClaimType.Privacy);
    expect(privacyBuilder).toBeInstanceOf(TaintCorrelationClaimBuilder);
    expect(privacyVerifier).toBeInstanceOf(TaintCorrelationClaimVerifier);

    const txBuilder = registry.getBuilder(ClaimType.Transaction);
    const txVerifier = registry.getVerifier(ClaimType.Transaction);
    expect(txBuilder).toBeInstanceOf(ExecutionClaimBuilder);
    expect(txVerifier).toBeInstanceOf(ExecutionClaimVerifier);
  });

  it('throws ProofUnsupportedClaimError when retrieving unregistered builder', () => {
    const registry = new ClaimRegistry();
    expect(() => {
      registry.getBuilder(ClaimType.Cashu);
    }).toThrow(ProofUnsupportedClaimError);

    try {
      registry.getBuilder(ClaimType.Cashu);
    } catch (err) {
      expect(err).toBeInstanceOf(ProofUnsupportedClaimError);
      expect((err as ProofUnsupportedClaimError).context).toEqual({
        claimType: ClaimType.Cashu
      });
    }
  });

  it('throws ProofUnsupportedClaimError when retrieving unregistered verifier', () => {
    const registry = new ClaimRegistry();
    expect(() => {
      registry.getVerifier(ClaimType.Lightning);
    }).toThrow(ProofUnsupportedClaimError);

    try {
      registry.getVerifier(ClaimType.Lightning);
    } catch (err) {
      expect(err).toBeInstanceOf(ProofUnsupportedClaimError);
      expect((err as ProofUnsupportedClaimError).context).toEqual({
        claimType: ClaimType.Lightning
      });
    }
  });

  it('throws ProofUnsupportedClaimError on duplicate registration', () => {
    const registry = new ClaimRegistry();
    registry.register(
      new TaintCorrelationClaimBuilder(),
      new TaintCorrelationClaimVerifier()
    );

    expect(() => {
      registry.register(
        new TaintCorrelationClaimBuilder(),
        new TaintCorrelationClaimVerifier()
      );
    }).toThrow(ProofUnsupportedClaimError);
  });

  it('throws ProofUnsupportedClaimError when builder and verifier supports mismatch', () => {
    const registry = new ClaimRegistry();
    expect(() => {
      registry.register(
        new TaintCorrelationClaimBuilder(),
        new ExecutionClaimVerifier() as never
      );
    }).toThrow(ProofUnsupportedClaimError);
  });
});
