import { PolicyScope } from '@kepler/shared';

export interface ReadCheckRequest {
  readonly kind: 'read';
}

export interface ProposeCheckRequest {
  readonly kind: 'propose';
}

export interface SendCheckRequest {
  readonly kind: 'send';
  readonly amountSats: string;
  readonly protocol: 'Bitcoin' | 'Lightning' | 'Cashu';
  readonly mint?: string;
}

export interface PublishCheckRequest {
  readonly kind: 'publish';
}

export type CheckRequest =
  | ReadCheckRequest
  | ProposeCheckRequest
  | SendCheckRequest
  | PublishCheckRequest;

export interface PolicyLimits {
  readonly dailyRemainingSats: string;
  readonly perTxLimitSats: string;
}

export interface CheckResponse {
  readonly allowed: true;
  readonly limits: PolicyLimits;
}

export interface UpdatePolicyRequest {
  readonly dailyBudgetSats: string;
  readonly perTxBudgetSats: string;
  readonly scopes: PolicyScope[];
  readonly allowedMints: string[];
  readonly allowedRelays: string[];
  readonly allowedEsplora: string[];
}

export interface PolicyResponse {
  readonly id: string;
  readonly dailyBudgetSats: string;
  readonly perTxBudgetSats: string;
  readonly scopes: PolicyScope[];
  readonly allowedMints: string[];
  readonly allowedRelays: string[];
  readonly allowedEsplora: string[];
  readonly updatedAt: string;
}
