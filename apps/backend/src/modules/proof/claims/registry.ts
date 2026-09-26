import { ClaimType } from '@kepler/shared';
import { ClaimBuilder, ClaimVerifier } from './claim.interface';
import {
  TaintCorrelationClaimBuilder,
  TaintCorrelationClaimVerifier
} from './taintCorrelation.claim';
import {
  ExecutionClaimBuilder,
  ExecutionClaimVerifier
} from './execution.claim';
import { ProofUnsupportedClaimError } from '../proof.errors';

export class ClaimRegistry {
  private readonly builders = new Map<ClaimType, ClaimBuilder>();
  private readonly verifiers = new Map<ClaimType, ClaimVerifier>();

  public register(builder: ClaimBuilder, verifier: ClaimVerifier): void {
    if (this.builders.has(builder.supports) || this.verifiers.has(verifier.supports)) {
      throw new ProofUnsupportedClaimError(
        `Claim handler for type ${builder.supports} already registered`,
        { claimType: builder.supports }
      );
    }

    if (builder.supports !== verifier.supports) {
      throw new ProofUnsupportedClaimError(
        `Builder claim type ${builder.supports} does not match verifier claim type ${verifier.supports}`,
        { claimType: builder.supports }
      );
    }

    this.builders.set(builder.supports, builder);
    this.verifiers.set(verifier.supports, verifier);
  }

  public getBuilder(type: ClaimType): ClaimBuilder {
    const builder = this.builders.get(type);
    if (!builder) {
      throw new ProofUnsupportedClaimError(
        `No builder registered for claim type ${type}`,
        { claimType: type }
      );
    }
    return builder;
  }

  public getVerifier(type: ClaimType): ClaimVerifier {
    const verifier = this.verifiers.get(type);
    if (!verifier) {
      throw new ProofUnsupportedClaimError(
        `No verifier registered for claim type ${type}`,
        { claimType: type }
      );
    }
    return verifier;
  }

  public static createDefault(): ClaimRegistry {
    const registry = new ClaimRegistry();
    registry.register(
      new TaintCorrelationClaimBuilder(),
      new TaintCorrelationClaimVerifier()
    );
    registry.register(
      new ExecutionClaimBuilder(),
      new ExecutionClaimVerifier()
    );
    return registry;
  }
}
