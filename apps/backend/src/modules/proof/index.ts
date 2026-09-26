export { ProofService } from './proof.service';
export { ProofRepository } from './proof.repository';
export { ProofController } from './proof.controller';
export { createProofRoutes } from './proof.routes';

export {
  ProofBuildError,
  ProofVerificationError,
  ProofPersistenceError,
  ProofNotFoundError,
  ProofUnsupportedClaimError
} from './proof.errors';

export type {
  ClaimBuildContext,
  BuiltClaim,
  ClaimVerifierContext,
  ClaimVerifier,
  ClaimBuilder
} from './claims/claim.interface';

export { ClaimRegistry } from './claims/registry';

export {
  TaintCorrelationClaimBuilder,
  TaintCorrelationClaimVerifier
} from './claims/taintCorrelation.claim';
export type { TaintCorrelationClaimInput } from './claims/taintCorrelation.claim';

export {
  ExecutionClaimBuilder,
  ExecutionClaimVerifier
} from './claims/execution.claim';
export type { ExecutionClaimInput } from './claims/execution.claim';

export {
  RawDataRefSchema,
  VerificationStepSchema,
  ClaimSchema,
  EvidenceBundleSchema,
  BuildClaimRequestSchema,
  BuildClaimResponseSchema,
  VerifyClaimRequestSchema,
  VerifyClaimResponseSchema,
  GetClaimResponseSchema,
  ListClaimsResponseSchema
} from './proof.validators';

export type {
  BuildClaimRequest,
  BuildClaimResponse,
  VerifyClaimRequest,
  VerifyClaimResponse,
  GetClaimResponse,
  ListClaimsResponse
} from './proof.validators';
