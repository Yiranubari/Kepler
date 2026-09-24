import { ProtocolError } from '@kepler/shared';

export interface NostrConfigErrorContext {
  readonly variable?: string;
  readonly field?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface NostrNetworkErrorContext {
  readonly relayUrl?: string;
  readonly url?: string;
  readonly status?: number;
  readonly [key: string]: unknown;
}

export interface NostrConnectionErrorContext {
  readonly relayUrl?: string;
  readonly pubkey?: string;
  readonly [key: string]: unknown;
}

export interface NostrTimeoutErrorContext {
  readonly operation?: string;
  readonly timeoutMs?: number;
  readonly relayUrl?: string;
  readonly [key: string]: unknown;
}

export interface NostrPublishErrorContext {
  readonly eventId?: string;
  readonly relayUrl?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface NostrVerificationErrorContext {
  readonly eventId?: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface NostrParseErrorContext {
  readonly input?: unknown;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export class NostrConfigError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: NostrConfigErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'nostr' }, cause);
    this.code = 'NOSTR_CONFIG_ERROR';
  }
}

export class NostrNetworkError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: NostrNetworkErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'nostr' }, cause);
    this.code = 'NOSTR_NETWORK_ERROR';
  }
}

export class NostrConnectionError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: NostrConnectionErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'nostr' }, cause);
    this.code = 'NOSTR_CONNECTION_ERROR';
  }
}

export class NostrTimeoutError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: NostrTimeoutErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'nostr' }, cause);
    this.code = 'NOSTR_TIMEOUT_ERROR';
  }
}

export class NostrPublishError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: NostrPublishErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'nostr' }, cause);
    this.code = 'NOSTR_PUBLISH_ERROR';
  }
}

export class NostrVerificationError extends ProtocolError {
  public override readonly code: string;

  constructor(message: string, context: NostrVerificationErrorContext = {}, cause?: Error) {
    super(message, { ...context, protocol: 'nostr' }, cause);
    this.code = 'NOSTR_VERIFICATION_ERROR';
  }
}

export class NostrParseError extends ProtocolError {
  public override readonly code: string;
  public static readonly MAX_INPUT_LENGTH: number = 128;

  private static truncateInput(input: unknown): unknown {
    if (typeof input === 'string') {
      if (input.length > NostrParseError.MAX_INPUT_LENGTH) {
        return `${input.slice(0, NostrParseError.MAX_INPUT_LENGTH)}...`;
      }
      return input;
    }
    if (input instanceof Uint8Array) {
      const hex = Buffer.from(input).toString('hex');
      if (hex.length > NostrParseError.MAX_INPUT_LENGTH) {
        return `${hex.slice(0, NostrParseError.MAX_INPUT_LENGTH)}...`;
      }
      return hex;
    }
    return input;
  }

  constructor(message: string, context: NostrParseErrorContext = {}, cause?: Error) {
    const sanitizedContext: Record<string, unknown> = {
      ...context,
      protocol: 'nostr'
    };
    if (context.input !== undefined) {
      sanitizedContext.input = NostrParseError.truncateInput(context.input);
    }
    super(message, sanitizedContext, cause);
    this.code = 'NOSTR_PARSE_ERROR';
  }
}
