import { ClaimType, EvidenceBundle, ClaimVerificationResult } from '@kepler/shared';

export interface ClaimBuildContext {
  readonly now: number;
  readonly scenarioId: string;
}

export interface BuiltClaim {
  readonly bundle: EvidenceBundle;
}

export interface ClaimVerifierContext {
  readonly bundle: EvidenceBundle;
}

export interface ClaimVerifier {
  readonly supports: ClaimType;
  readonly name: string;
  verify(context: ClaimVerifierContext): ClaimVerificationResult;
}

export interface ClaimBuilder {
  readonly supports: ClaimType;
  readonly name: string;
  build(context: ClaimBuildContext, input: unknown): BuiltClaim;
}
