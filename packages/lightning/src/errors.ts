import { ProtocolError } from '@kepler/shared';

export interface LightningConfigErrorContext {
  readonly [key: string]: unknown;
}

export interface LightningNetworkErrorContext {
  readonly relayUrl?: string;
  readonly url?: string;
  readonly status?: number;
  readonly [key: string]: unknown;
}

export interface LightningConnectionErrorContext {
  readonly relayUrl?: string;
  readonly pubkey?: string;
  readonly [key: string]: unknown;
}

export interface LightningTimeoutErrorContext {
  readonly operation?: string;
  readonly timeoutMs?: number;
  readonly [key: string]: unknown;
}

export interface LightningInvoiceErrorContext {
  readonly invoice?: string;
  readonly paymentHash?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface LightningPaymentErrorContext {
  readonly paymentHash?: string;
  readonly preimage?: string;
  readonly [key: string]: unknown;
}

export interface LightningParseErrorContext {
  readonly input?: unknown;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export class LightningConfigError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: LightningConfigErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'lightning' }, cause);
    this.code = 'LIGHTNING_CONFIG_ERROR';
  }
}

export class LightningNetworkError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: LightningNetworkErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'lightning' }, cause);
    this.code = 'LIGHTNING_NETWORK_ERROR';
  }
}

export class LightningConnectionError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: LightningConnectionErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'lightning' }, cause);
    this.code = 'LIGHTNING_CONNECTION_ERROR';
  }
}

export class LightningTimeoutError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: LightningTimeoutErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'lightning' }, cause);
    this.code = 'LIGHTNING_TIMEOUT_ERROR';
  }
}

export class LightningInvoiceError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: LightningInvoiceErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'lightning' }, cause);
    this.code = 'LIGHTNING_INVOICE_ERROR';
  }
}

export class LightningPaymentError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: LightningPaymentErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'lightning' }, cause);
    this.code = 'LIGHTNING_PAYMENT_ERROR';
  }
}

export class LightningParseError extends ProtocolError {
  public override readonly code: string;
  public static readonly MAX_INPUT_LENGTH: number = 128;

  private static truncateInput(input: unknown): unknown {
    if (typeof input === 'string') {
      if (input.length > LightningParseError.MAX_INPUT_LENGTH) {
        return `${input.slice(0, LightningParseError.MAX_INPUT_LENGTH)}...`;
      }
      return input;
    }
    if (input instanceof Uint8Array) {
      const hex = Buffer.from(input).toString('hex');
      if (hex.length > LightningParseError.MAX_INPUT_LENGTH) {
        return `${hex.slice(0, LightningParseError.MAX_INPUT_LENGTH)}...`;
      }
      return hex;
    }
    return input;
  }

  constructor(message: string, context: LightningParseErrorContext = {}, cause?: Error) {
    const sanitizedContext: Record<string, unknown> = {
      ...context,
      protocol: 'lightning'
    };
    if (context.input !== undefined) {
      sanitizedContext.input = LightningParseError.truncateInput(context.input);
    }
    super(message, sanitizedContext, cause);
    this.code = 'LIGHTNING_PARSE_ERROR';
  }
}
