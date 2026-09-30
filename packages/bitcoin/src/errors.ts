import { ProtocolError } from '@kepler/shared';

export interface BitcoinConfigErrorContext {
  readonly [key: string]: unknown;
}

export interface BitcoinNetworkErrorContext {
  readonly url?: string;
  readonly status?: number;
  readonly [key: string]: unknown;
}

export interface BitcoinNotFoundErrorContext {
  readonly ref?: string;
  readonly [key: string]: unknown;
}

export interface BitcoinInvalidResponseErrorContext {
  readonly url?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface BitcoinParseErrorContext {
  readonly input?: unknown;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface BitcoinBroadcastErrorContext {
  readonly reason?: string;
  readonly txHex?: string;
  readonly [key: string]: unknown;
}

export interface BitcoinFeeErrorContext {
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export class BitcoinConfigError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: BitcoinConfigErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'bitcoin' }, cause);
    this.code = 'BITCOIN_CONFIG_ERROR';
  }
}

export class BitcoinNetworkError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: BitcoinNetworkErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'bitcoin' }, cause);
    this.code = 'BITCOIN_NETWORK_ERROR';
  }
}

export class BitcoinNotFoundError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: BitcoinNotFoundErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'bitcoin' }, cause);
    this.code = 'BITCOIN_NOT_FOUND';
  }
}

export class BitcoinInvalidResponseError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: BitcoinInvalidResponseErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'bitcoin' }, cause);
    this.code = 'BITCOIN_INVALID_RESPONSE';
  }
}

export class BitcoinParseError extends ProtocolError {
  public override readonly code: string;
  public static readonly MAX_INPUT_LENGTH: number = 128;

  private static truncateInput(input: unknown): unknown {
    if (typeof input === 'string') {
      if (input.length > BitcoinParseError.MAX_INPUT_LENGTH) {
        return `${input.slice(0, BitcoinParseError.MAX_INPUT_LENGTH)}...`;
      }
      return input;
    }
    if (input instanceof Uint8Array) {
      const hex = Buffer.from(input).toString('hex');
      if (hex.length > BitcoinParseError.MAX_INPUT_LENGTH) {
        return `${hex.slice(0, BitcoinParseError.MAX_INPUT_LENGTH)}...`;
      }
      return hex;
    }
    return input;
  }

  constructor(message: string, context: BitcoinParseErrorContext = {}, cause?: Error) {
    const sanitizedContext: Record<string, unknown> = {
      ...context,
      protocol: 'bitcoin'
    };
    if (context.input !== undefined) {
      sanitizedContext.input = BitcoinParseError.truncateInput(context.input);
    }
    super(message, sanitizedContext, cause);
    this.code = 'BITCOIN_PARSE_ERROR';
  }
}

export class BitcoinBroadcastError extends ProtocolError {
  public override readonly code: string;
  public static readonly MAX_TX_HEX_LENGTH: number = 256;

  private static truncateTxHex(txHex: unknown): unknown {
    if (typeof txHex === 'string') {
      if (txHex.length > BitcoinBroadcastError.MAX_TX_HEX_LENGTH) {
        return `${txHex.slice(0, BitcoinBroadcastError.MAX_TX_HEX_LENGTH)}...`;
      }
      return txHex;
    }
    return txHex;
  }

  constructor(message: string, context: BitcoinBroadcastErrorContext = {}, cause?: Error) {
    const sanitizedContext: Record<string, unknown> = {
      ...context,
      protocol: 'bitcoin'
    };
    if (context.txHex !== undefined) {
      sanitizedContext.txHex = BitcoinBroadcastError.truncateTxHex(context.txHex);
    }
    super(message, sanitizedContext, cause);
    this.code = 'BITCOIN_BROADCAST_ERROR';
  }
}

export class BitcoinFeeError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: BitcoinFeeErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'bitcoin' }, cause);
    this.code = 'BITCOIN_FEE_ERROR';
  }
}
