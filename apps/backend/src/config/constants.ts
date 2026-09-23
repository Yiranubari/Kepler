export const RATE_LIMIT_SCOPES = ['read', 'propose', 'send', 'publish'] as const;

export type RateLimitScope = typeof RATE_LIMIT_SCOPES[number];

export const RATE_LIMIT_WINDOWS_MS = Object.freeze({
  read: 60_000,
  propose: 60_000,
  send: 3_600_000,
  publish: 3_600_000
} as const);
