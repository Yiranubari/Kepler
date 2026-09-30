import { KeplerError, KeplerErrorJSON, NotFoundError, ValidationError, PolicyScope } from '@kepler/shared';

export interface PolicyNotFoundErrorContext {
  readonly id: string;
  readonly [key: string]: unknown;
}

export class PolicyNotFoundError extends NotFoundError {
  public override readonly code: string;

  constructor(
    message: string,
    context: PolicyNotFoundErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'POLICY_NOT_FOUND';
  }
}

export interface PolicyScopeErrorContext {
  readonly scope: PolicyScope | string;
  readonly operation: string;
  readonly [key: string]: unknown;
}

export class PolicyScopeError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: PolicyScopeErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'POLICY_SCOPE_VIOLATION';
  }
}

export interface PolicyBudgetErrorContext {
  readonly limitType: 'perTx' | 'daily';
  readonly limitSats: string | number | bigint;
  readonly spentSats: string | number | bigint;
  readonly requestedSats: string | number | bigint;
  readonly [key: string]: unknown;
}

export class PolicyBudgetError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: PolicyBudgetErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'POLICY_BUDGET_VIOLATION';
  }

  public override toJSON(): KeplerErrorJSON {
    const sanitizedContext: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.context)) {
      if (typeof value === 'bigint') {
        sanitizedContext[key] = value.toString();
      } else {
        sanitizedContext[key] = value;
      }
    }
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: sanitizedContext
    };
  }
}

export interface PolicyAllowlistErrorContext {
  readonly kind: 'mint' | 'relay' | 'esplora';
  readonly value: string;
  readonly allowed: readonly string[] | string[];
  readonly [key: string]: unknown;
}

export class PolicyAllowlistError extends KeplerError {
  public override readonly code: string;

  constructor(
    message: string,
    context: PolicyAllowlistErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'POLICY_ALLOWLIST_VIOLATION';
  }
}

export interface PolicyInputErrorContext {
  readonly field: string;
  readonly reason: string;
  readonly [key: string]: unknown;
}

export class PolicyInputError extends ValidationError {
  public override readonly code: string;

  constructor(
    message: string,
    context: PolicyInputErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.code = 'POLICY_INPUT_ERROR';
  }
}
