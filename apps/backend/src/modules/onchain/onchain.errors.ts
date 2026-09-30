import { KeplerError } from '@kepler/shared';

export interface OnchainDerivationErrorContext {
  readonly reason: string;
  readonly [key: string]: unknown;
}

export class OnchainDerivationError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OnchainDerivationErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ONCHAIN_DERIVATION_ERROR';
  }
}

export interface OnchainPsbtBuildErrorContext {
  readonly reason: string;
  readonly step: string;
  readonly [key: string]: unknown;
}

export class OnchainPsbtBuildError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OnchainPsbtBuildErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ONCHAIN_PSBT_BUILD_ERROR';
  }
}

export interface OnchainInsufficientFundsErrorContext {
  readonly availableSats: number;
  readonly requiredSats: number;
  readonly feeSats: number;
  readonly [key: string]: unknown;
}

export class OnchainInsufficientFundsError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OnchainInsufficientFundsErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ONCHAIN_INSUFFICIENT_FUNDS';
  }
}

export interface OnchainBroadcastErrorContext {
  readonly reason: string;
  readonly [key: string]: unknown;
}

export class OnchainBroadcastError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OnchainBroadcastErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ONCHAIN_BROADCAST_ERROR';
  }
}

export interface OnchainUnsupportedNetworkErrorContext {
  readonly network: string;
  readonly [key: string]: unknown;
}

export class OnchainUnsupportedNetworkError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: OnchainUnsupportedNetworkErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'ONCHAIN_UNSUPPORTED_NETWORK';
  }
}
