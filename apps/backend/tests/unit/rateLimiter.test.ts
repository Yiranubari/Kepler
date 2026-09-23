import { RateLimiter } from '../../src/services/rateLimiter';

const makeConfig = () => ({
  read: { limit: 5, windowMs: 60_000 },
  propose: { limit: 3, windowMs: 60_000 },
  send: { limit: 10, windowMs: 3_600_000 },
  publish: { limit: 10, windowMs: 3_600_000 }
});

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows requests under the limit and decrements remaining', () => {
    const limiter = new RateLimiter(makeConfig());
    const result = limiter.check('read', 'ip:1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('allows up to the limit and denies at the limit', () => {
    const limiter = new RateLimiter(makeConfig());
    const key = 'ip:test';

    for (let i = 0; i < 5; i++) {
      const r = limiter.check('read', key);
      expect(r.allowed).toBe(true);
    }

    const denied = limiter.check('read', key);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
    expect(denied.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('allows again after the window has passed', () => {
    const limiter = new RateLimiter(makeConfig());
    const key = 'ip:window-test';

    for (let i = 0; i < 5; i++) {
      limiter.check('read', key);
    }

    const denied = limiter.check('read', key);
    expect(denied.allowed).toBe(false);

    jest.advanceTimersByTime(60_001);

    const allowed = limiter.check('read', key);
    expect(allowed.allowed).toBe(true);
  });

  it('separate keys are independent', () => {
    const limiter = new RateLimiter(makeConfig());

    for (let i = 0; i < 5; i++) {
      limiter.check('read', 'key-a');
    }

    const result = limiter.check('read', 'key-b');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('separate scopes are independent', () => {
    const limiter = new RateLimiter(makeConfig());
    const key = 'shared-key';

    for (let i = 0; i < 3; i++) {
      limiter.check('propose', key);
    }

    const denied = limiter.check('propose', key);
    expect(denied.allowed).toBe(false);

    const readResult = limiter.check('read', key);
    expect(readResult.allowed).toBe(true);
  });

  it('reset clears the bucket', () => {
    const limiter = new RateLimiter(makeConfig());
    const key = 'reset-test';

    for (let i = 0; i < 5; i++) {
      limiter.check('read', key);
    }

    expect(limiter.check('read', key).allowed).toBe(false);

    limiter.reset('read', key);

    expect(limiter.check('read', key).allowed).toBe(true);
  });

  it('snapshot returns correct count', () => {
    const limiter = new RateLimiter(makeConfig());
    const key = 'snap-test';

    limiter.check('read', key);
    limiter.check('read', key);
    limiter.check('read', key);

    const snap = limiter.snapshot();
    expect(snap[`read:${key}`]).toBeDefined();
    expect(snap[`read:${key}`].count).toBe(3);
    expect(snap[`read:${key}`].windowMs).toBe(60_000);
  });

  it('snapshot excludes expired entries from count', () => {
    const limiter = new RateLimiter(makeConfig());
    const key = 'snap-expire-test';

    limiter.check('read', key);
    limiter.check('read', key);

    jest.advanceTimersByTime(60_001);

    const snap = limiter.snapshot();
    const entry = snap[`read:${key}`];
    expect(entry === undefined || entry.count === 0).toBe(true);
  });

  it('retryAfterMs is computed from the oldest timestamp in the window', () => {
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());
    const limiter = new RateLimiter(makeConfig());
    const key = 'retry-test';

    for (let i = 0; i < 5; i++) {
      limiter.check('read', key);
    }

    jest.advanceTimersByTime(30_000);

    const denied = limiter.check('read', key);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
    expect(denied.retryAfterMs).toBeLessThanOrEqual(30_000);
  });
});
