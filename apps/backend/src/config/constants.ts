export const RATE_LIMIT_SCOPES = ['read', 'propose', 'send', 'publish'] as const;

export type RateLimitScope = typeof RATE_LIMIT_SCOPES[number];

export const RATE_LIMIT_WINDOWS_MS = Object.freeze({
  read: 60_000,
  propose: 60_000,
  send: 3_600_000,
  publish: 3_600_000
} as const);

export const LOG_SERVICE_NAMES = Object.freeze({
  http: 'http',
  taint: 'taint',
  proof: 'proof',
  policy: 'policy',
  orchestrator: 'orchestrator',
  ai: 'ai',
  nostr: 'nostr',
  bitcoin: 'bitcoin',
  lightning: 'lightning',
  cashu: 'cashu',
  lifecycle: 'lifecycle',
  rateLimiter: 'rateLimiter'
} as const);

export type LogServiceName = typeof LOG_SERVICE_NAMES[keyof typeof LOG_SERVICE_NAMES];

export const SHUTDOWN_TIMEOUT_MS = 10_000;

export const STARTUP_TIMEOUT_MS = 15_000;
