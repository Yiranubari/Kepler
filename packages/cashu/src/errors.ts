import { ProtocolError } from '@kepler/shared';

export interface CashuConfigErrorContext {
  readonly variable?: string;
  readonly field?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface CashuNetworkErrorContext {
  readonly url?: string;
  readonly status?: number;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface CashuMintErrorContext {
  readonly mintUrl?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface CashuMeltErrorContext {
  readonly mintUrl?: string;
  readonly quoteId?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface CashuSwapErrorContext {
  readonly mintUrl?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface CashuTokenErrorContext {
  readonly token?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface CashuParseErrorContext {
  readonly input?: unknown;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export class CashuConfigError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: CashuConfigErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'cashu' }, cause);
    this.code = 'CASHU_CONFIG_ERROR';
  }
}

export class CashuNetworkError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: CashuNetworkErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'cashu' }, cause);
    this.code = 'CASHU_NETWORK_ERROR';
  }
}

export class CashuMintError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: CashuMintErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'cashu' }, cause);
    this.code = 'CASHU_MINT_ERROR';
  }
}

export class CashuMeltError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: CashuMeltErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'cashu' }, cause);
    this.code = 'CASHU_MELT_ERROR';
  }
}

export class CashuSwapError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: CashuSwapErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'cashu' }, cause);
    this.code = 'CASHU_SWAP_ERROR';
  }
}

export class CashuTokenError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: CashuTokenErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'cashu' }, cause);
    this.code = 'CASHU_TOKEN_ERROR';
  }
}

export class CashuParseError extends ProtocolError {
  public override readonly code: string;
  public static readonly MAX_INPUT_LENGTH: number = 128;

  private static truncateInput(input: unknown): unknown {
    if (typeof input === 'string') {
      if (input.length > CashuParseError.MAX_INPUT_LENGTH) {
        return `${input.slice(0, CashuParseError.MAX_INPUT_LENGTH)}...`;
      }
      return input;
    }
    if (input instanceof Uint8Array) {
      const hex = Buffer.from(input).toString('hex');
      if (hex.length > CashuParseError.MAX_INPUT_LENGTH) {
        return `${hex.slice(0, CashuParseError.MAX_INPUT_LENGTH)}...`;
      }
      return hex;
    }
    return input;
  }

  constructor(message: string, context: CashuParseErrorContext = {}, cause?: Error) {
    const sanitizedContext: Record<string, unknown> = {
      ...context,
      protocol: 'cashu'
    };
    if (context.input !== undefined) {
      sanitizedContext.input = CashuParseError.truncateInput(context.input);
    }
    super(message, sanitizedContext, cause);
    this.code = 'CASHU_PARSE_ERROR';
  }
}
