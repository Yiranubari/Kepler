import { ProofError, NotFoundError } from '@kepler/shared';

export class ProofBuildError extends ProofError {
  public override readonly code: string;

  constructor(
    message: string,
    context: { claimType: string; reason: string } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'PROOF_BUILD_ERROR';
  }
}

export class ProofVerificationError extends ProofError {
  public override readonly code: string;

  constructor(
    message: string,
    context: { bundleId: string; step: string; reason: string } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'PROOF_VERIFICATION_ERROR';
  }
}

export class ProofPersistenceError extends ProofError {
  public override readonly code: string;

  constructor(
    message: string,
    context: { bundleId: string; operation: string; reason: string } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'PROOF_PERSISTENCE_ERROR';
  }
}

export class ProofNotFoundError extends NotFoundError {
  public override readonly code: string;

  constructor(
    message: string,
    context: { bundleHash: string } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'PROOF_NOT_FOUND';
  }
}

export class ProofUnsupportedClaimError extends ProofError {
  public override readonly code: string;

  constructor(
    message: string,
    context: { claimType: string } & Record<string, unknown>,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'PROOF_UNSUPPORTED_CLAIM';
  }
}

