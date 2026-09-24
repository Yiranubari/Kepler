import type { KeplerLogger } from '@kepler/shared';
import { SimplePool, finalizeEvent, type Event, type Filter } from 'nostr-tools';
import {
  NostrClient,
  NostrConfig,
  NostrKind,
  KeplerTag,
  NostrConnectionError,
  NostrTimeoutError,
  NostrPublishError,
  NostrParseError
} from '../../src';

class TestLogger implements KeplerLogger {
  public readonly debugLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly infoLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly warnLogs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  public readonly errorLogs: Array<{ message: string; error?: unknown; context?: Record<string, unknown> }> = [];
  public readonly fatalLogs: Array<{ message: string; error: unknown; context?: Record<string, unknown> }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.debugLogs.push({ message, context });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.infoLogs.push({ message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.warnLogs.push({ message, context });
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.errorLogs.push({ message, error, context });
  }

  public fatal(message: string, error: unknown, context?: Record<string, unknown>): void {
    this.fatalLogs.push({ message, error, context });
  }

  public clear(): void {
    this.debugLogs.length = 0;
    this.infoLogs.length = 0;
    this.warnLogs.length = 0;
    this.errorLogs.length = 0;
    this.fatalLogs.length = 0;
  }
}

describe('NostrClient', () => {
  const privateKey = 'c69fb849f4bd3c374b9b940511c8b9e772a5bc12e36f4ca9a62bde8ea90bc06b';
  const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  const relays = ['wss://relay.damus.io', 'wss://nos.lol'];

  let logger: TestLogger;
  let config: NostrConfig;
  let pool: SimplePool;
  let client: NostrClient;

  beforeEach(() => {
    logger = new TestLogger();
    config = new NostrConfig({
      privateKey,
      relays,
      timeoutMs: 1000,
      publishTimeoutMs: 500,
      subscriptionLimit: 100
    });
    pool = new SimplePool();
    client = new NostrClient(config, logger, pool);
  });

  describe('constructor', () => {
    it('initializes with config, logger, and default disconnected state', () => {
      expect(client.config).toBe(config);
      expect(client.isConnected).toBe(false);
      expect(client.connectedRelays).toEqual([]);
    });
  });

  describe('connect', () => {
    it('connects to all relays successfully and logs info', async () => {
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);

      await client.connect();

      expect(client.isConnected).toBe(true);
      expect(client.connectedRelays).toEqual(relays);
      expect(logger.infoLogs).toHaveLength(1);
      expect(logger.infoLogs[0]?.context).toEqual({
        connectedRelays: 2,
        totalRelays: 2
      });
    });

    it('is idempotent when called multiple times', async () => {
      const ensureSpy = jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);

      await client.connect();
      await client.connect();

      expect(ensureSpy).toHaveBeenCalledTimes(2);
      expect(client.isConnected).toBe(true);
    });

    it('logs a warning when a relay fails to connect but succeeds if at least one connects', async () => {
      jest.spyOn(pool, 'ensureRelay').mockImplementation(async (url: string) => {
        if (url === 'wss://nos.lol') {
          throw new Error('ECONNREFUSED');
        }
        return {} as never;
      });

      await client.connect();

      expect(client.isConnected).toBe(true);
      expect(client.connectedRelays).toEqual(['wss://relay.damus.io']);
      expect(logger.warnLogs).toHaveLength(1);
      expect(logger.warnLogs[0]?.context).toEqual({
        relay: 'wss://nos.lol',
        reason: 'ECONNREFUSED'
      });
      expect(logger.infoLogs[0]?.context).toEqual({
        connectedRelays: 1,
        totalRelays: 2
      });
    });

    it('throws NostrConnectionError when all relays fail to connect', async () => {
      jest.spyOn(pool, 'ensureRelay').mockRejectedValue(new Error('Network unreachable'));

      try {
        await client.connect();
        fail('Expected NostrConnectionError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConnectionError);
        const connErr = err as NostrConnectionError;
        expect(connErr.code).toBe('NOSTR_CONNECTION_ERROR');
        expect(connErr.context['relays']).toEqual(relays);
        expect(connErr.context['errors']).toBeDefined();
        expect(client.isConnected).toBe(false);
      }
    });

    it('throws NostrTimeoutError when connection phase exceeds timeout', async () => {
      const shortTimeoutConfig = new NostrConfig({
        privateKey,
        relays,
        timeoutMs: 50
      });
      const timeoutClient = new NostrClient(shortTimeoutConfig, logger, pool);

      jest.spyOn(pool, 'ensureRelay').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({} as never), 200))
      );

      try {
        await timeoutClient.connect();
        fail('Expected NostrTimeoutError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrTimeoutError);
        const timeoutErr = err as NostrTimeoutError;
        expect(timeoutErr.code).toBe('NOSTR_TIMEOUT_ERROR');
        expect(timeoutErr.context['timeoutMs']).toBe(50);
        expect(timeoutClient.isConnected).toBe(false);
      }
    });
  });

  describe('disconnect', () => {
    it('closes all connections and resets state', async () => {
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);
      const closeSpy = jest.spyOn(pool, 'close').mockImplementation(() => {});

      await client.connect();
      expect(client.isConnected).toBe(true);

      await client.disconnect();
      expect(closeSpy).toHaveBeenCalledWith(relays);
      expect(client.isConnected).toBe(false);
      expect(client.connectedRelays).toEqual([]);
    });

    it('is idempotent and does not throw when not connected', async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);
      await client.connect();
      logger.clear();
    });

    it('throws NostrConnectionError if client is disconnected', async () => {
      await client.disconnect();

      await expect(
        client.publish({
          pubkey: config.publicKey,
          createdAt: 1000,
          kind: 1,
          tags: [],
          content: 'hello'
        })
      ).rejects.toBeInstanceOf(NostrConnectionError);
    });

    it('signs event and publishes to all relays when accepted', async () => {
      jest.spyOn(pool, 'publish').mockReturnValue([
        Promise.resolve('OK'),
        Promise.resolve('OK')
      ]);

      const result = await client.publish({
        pubkey: config.publicKey,
        createdAt: 1700000000,
        kind: 1,
        tags: [['t', 'kepler']],
        content: 'Test content'
      });

      expect(result.event.id).toBeDefined();
      expect(result.event.pubkey).toBe(config.publicKey);
      expect(result.event.sig).toBeDefined();
      expect(result.event.kind).toBe(1);
      expect(result.acceptedBy).toEqual(relays);
      expect(result.rejectedBy).toEqual([]);

      expect(logger.infoLogs).toHaveLength(1);
      expect(logger.infoLogs[0]?.context).toEqual({
        eventId: result.event.id,
        kind: 1,
        acceptedCount: 2
      });

      const serializedLogs = JSON.stringify(logger.infoLogs);
      expect(serializedLogs).not.toContain(privateKey);
      expect(serializedLogs).not.toContain(result.event.sig);
    });

    it('returns result with rejectedBy and logs warning if some relays reject', async () => {
      jest.spyOn(pool, 'publish').mockReturnValue([
        Promise.resolve('OK'),
        Promise.reject(new Error('blocked: tor exit node'))
      ]);

      const result = await client.publish({
        pubkey: config.publicKey,
        createdAt: 1700000000,
        kind: 1,
        tags: [],
        content: 'Partial publish'
      });

      expect(result.acceptedBy).toEqual(['wss://relay.damus.io']);
      expect(result.rejectedBy).toHaveLength(1);
      expect(result.rejectedBy[0]?.relay).toBe('wss://nos.lol');
      expect(result.rejectedBy[0]?.reason).toBe('blocked: tor exit node');

      expect(logger.warnLogs).toHaveLength(1);
      expect(logger.warnLogs[0]?.context).toEqual({
        relay: 'wss://nos.lol',
        reason: 'blocked: tor exit node'
      });
    });

    it('records TIMEOUT in rejectedBy when a relay does not respond within publishTimeoutMs', async () => {
      jest.spyOn(pool, 'publish').mockReturnValue([
        Promise.resolve('OK'),
        new Promise((resolve) => setTimeout(() => resolve('OK'), 1000))
      ]);

      const result = await client.publish({
        pubkey: config.publicKey,
        createdAt: 1700000000,
        kind: 1,
        tags: [],
        content: 'Timeout test'
      });

      expect(result.acceptedBy).toEqual(['wss://relay.damus.io']);
      expect(result.rejectedBy).toHaveLength(1);
      expect(result.rejectedBy[0]?.relay).toBe('wss://nos.lol');
      expect(result.rejectedBy[0]?.reason).toBe('TIMEOUT');
    });

    it('throws NostrPublishError when all relays reject or fail', async () => {
      jest.spyOn(pool, 'publish').mockReturnValue([
        Promise.reject(new Error('blocked: rate limited')),
        Promise.reject(new Error('blocked: spam'))
      ]);

      try {
        await client.publish({
          pubkey: config.publicKey,
          createdAt: 1700000000,
          kind: 1,
          tags: [],
          content: 'Failed test'
        });
        fail('Expected NostrPublishError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrPublishError);
        const pubErr = err as NostrPublishError;
        expect(pubErr.code).toBe('NOSTR_PUBLISH_ERROR');
        expect(pubErr.context['eventId']).toBeDefined();
        expect(pubErr.context['rejectedBy']).toHaveLength(2);
      }
    });
  });

  describe('publishDecision', () => {
    beforeEach(async () => {
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);
      await client.connect();
    });

    it('constructs kind 30078 event with required tags and passes to pool.publish', async () => {
      let publishedEvent: Event | undefined;
      jest.spyOn(pool, 'publish').mockImplementation((_relays, event) => {
        publishedEvent = event;
        return [Promise.resolve('OK'), Promise.resolve('OK')];
      });

      const payload = {
        scenarioId: 'scenario_999',
        decision: 'allow',
        protocol: 'bitcoin',
        evidenceHash: 'hash_abc123',
        summary: 'Decision summary text'
      };

      const result = await client.publishDecision(payload);

      expect(result.acceptedBy).toEqual(relays);
      expect(publishedEvent).toBeDefined();
      expect(publishedEvent?.kind).toBe(NostrKind.AppSpecificData);
      expect(publishedEvent?.content).toBe(payload.summary);
      expect(publishedEvent?.tags).toEqual([
        ['d', 'scenario_999'],
        ['kepler', 'true'],
        ['decision', 'allow'],
        ['protocol', 'bitcoin'],
        ['evidence', 'hash_abc123']
      ]);
    });
  });

  describe('fetchEvents', () => {
    beforeEach(async () => {
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);
      await client.connect();
      logger.clear();
    });

    it('throws NostrConnectionError if not connected', async () => {
      await client.disconnect();
      await expect(client.fetchEvents([{ kinds: [1] }])).rejects.toBeInstanceOf(NostrConnectionError);
    });

    it('returns empty array when filters array is empty', async () => {
      const results = await client.fetchEvents([]);
      expect(results).toEqual([]);
    });

    it('fetches, validates, and returns signature-verified events', async () => {
      const validEvent: Event = finalizeEvent(
        {
          kind: 1,
          created_at: 1700000000,
          tags: [],
          content: 'Valid signed note'
        },
        privateKeyBytes
      );

      jest.spyOn(pool, 'subscribeMap').mockImplementation((_requests, params) => {
        setTimeout(() => {
          params.onevent?.(validEvent);
          params.oneose?.();
        }, 10);
        return { close: () => {} };
      });

      const events = await client.fetchEvents([{ kinds: [1] }]);

      expect(events).toHaveLength(1);
      expect(events[0]?.verified).toBe(true);
      expect(events[0]?.event.id).toBe(validEvent.id);
      expect(events[0]?.event.pubkey).toBe(validEvent.pubkey);
      expect(events[0]?.event.createdAt).toBe(validEvent.created_at);
      expect(events[0]?.event.content).toBe('Valid signed note');
      expect(logger.debugLogs).toHaveLength(1);
    });

    it('deduplicates events with identical ids from multiple relays', async () => {
      const validEvent: Event = finalizeEvent(
        {
          kind: 1,
          created_at: 1700000000,
          tags: [],
          content: 'Duplicate event across relays'
        },
        privateKeyBytes
      );

      jest.spyOn(pool, 'subscribeMap').mockImplementation((_requests, params) => {
        setTimeout(() => {
          params.onevent?.(validEvent);
          params.onevent?.(validEvent);
          params.oneose?.();
        }, 10);
        return { close: () => {} };
      });

      const events = await client.fetchEvents([{ kinds: [1] }]);
      expect(events).toHaveLength(1);
    });

    it('drops events with invalid signatures and logs a warning without throwing', async () => {
      const validEvent: Event = finalizeEvent(
        {
          kind: 1,
          created_at: 1700000000,
          tags: [],
          content: 'Original'
        },
        privateKeyBytes
      );

      const tamperedEvent = JSON.parse(JSON.stringify(validEvent));
      tamperedEvent.content = 'Tampered content';

      jest.spyOn(pool, 'subscribeMap').mockImplementation((_requests, params) => {
        setTimeout(() => {
          params.onevent?.(tamperedEvent);
          params.oneose?.();
        }, 10);
        return { close: () => {} };
      });

      const events = await client.fetchEvents([{ kinds: [1] }]);
      expect(events).toHaveLength(0);
      expect(logger.warnLogs).toHaveLength(2);
      expect(logger.warnLogs[0]?.message).toContain('Event signature verification failed');
    });

    it('drops malformed wire payloads that fail Zod validation', async () => {
      const malformedEvent = {
        id: 'some_id',
        pubkey: 'some_pubkey'
      };

      jest.spyOn(pool, 'subscribeMap').mockImplementation((_requests, params) => {
        setTimeout(() => {
          params.onevent?.(malformedEvent as never);
          params.oneose?.();
        }, 10);
        return { close: () => {} };
      });

      const events = await client.fetchEvents([{ kinds: [1] }]);
      expect(events).toHaveLength(0);
      expect(logger.warnLogs).toHaveLength(2);
      expect(logger.warnLogs[0]?.message).toContain('invalid event wire payload');
    });

    it('caps results at subscriptionLimit and logs a warning', async () => {
      const smallLimitConfig = new NostrConfig({
        privateKey,
        relays,
        subscriptionLimit: 2,
        timeoutMs: 1000
      });
      const limitClient = new NostrClient(smallLimitConfig, logger, pool);
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);
      await limitClient.connect();
      logger.clear();

      const event1: Event = finalizeEvent({ kind: 1, created_at: 1000, tags: [], content: '1' }, privateKeyBytes);
      const event2: Event = finalizeEvent({ kind: 1, created_at: 1001, tags: [], content: '2' }, privateKeyBytes);
      const event3: Event = finalizeEvent({ kind: 1, created_at: 1002, tags: [], content: '3' }, privateKeyBytes);

      jest.spyOn(pool, 'subscribeMap').mockImplementation((_requests, params) => {
        setTimeout(() => {
          params.onevent?.(event1);
          params.onevent?.(event2);
          params.onevent?.(event3);
          params.oneose?.();
        }, 10);
        return { close: () => {} };
      });

      const events = await limitClient.fetchEvents([{ kinds: [1] }]);
      expect(events).toHaveLength(2);
    });

    it('returns empty array when EOSE is received before timeout even with zero events', async () => {
      jest.spyOn(pool, 'subscribeMap').mockImplementation((_requests, params) => {
        setTimeout(() => {
          params.oneose?.();
        }, 10);
        return { close: () => {} };
      });

      const events = await client.fetchEvents([{ kinds: [1] }]);
      expect(events).toHaveLength(0);
    });

    it('throws NostrTimeoutError when zero events and zero EOSE before timeout', async () => {
      jest.spyOn(pool, 'subscribeMap').mockImplementation(() => {
        return { close: () => {} };
      });

      await expect(client.fetchEvents([{ kinds: [1] }], 50)).rejects.toBeInstanceOf(NostrTimeoutError);
    });
  });

  describe('fetchEventById', () => {
    beforeEach(async () => {
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);
      await client.connect();
    });

    it('returns the event when found', async () => {
      const validEvent: Event = finalizeEvent(
        {
          kind: 1,
          created_at: 1700000000,
          tags: [],
          content: 'Found by ID'
        },
        privateKeyBytes
      );

      jest.spyOn(client, 'fetchEvents').mockResolvedValue([
        {
          event: {
            id: validEvent.id,
            pubkey: validEvent.pubkey,
            createdAt: validEvent.created_at,
            kind: validEvent.kind,
            tags: validEvent.tags,
            content: validEvent.content,
            sig: validEvent.sig
          },
          verified: true
        }
      ]);

      const found = await client.fetchEventById(validEvent.id);
      expect(found).not.toBeNull();
      expect(found?.event.id).toBe(validEvent.id);
    });

    it('returns null when empty id is supplied', async () => {
      const found = await client.fetchEventById('');
      expect(found).toBeNull();
    });

    it('returns null and does not throw when event is not found or times out', async () => {
      jest.spyOn(client, 'fetchEvents').mockRejectedValue(
        new NostrTimeoutError('Timed out', { timeoutMs: 1000 })
      );

      const found = await client.fetchEventById('missing_event_id');
      expect(found).toBeNull();
    });
  });

  describe('fetchEventsByAuthor', () => {
    beforeEach(async () => {
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);
      await client.connect();
    });

    it('throws NostrParseError if pubkey is not a 64-char hex string', async () => {
      await expect(client.fetchEventsByAuthor('not-a-valid-pubkey')).rejects.toBeInstanceOf(NostrParseError);
      await expect(client.fetchEventsByAuthor('1234')).rejects.toBeInstanceOf(NostrParseError);
    });

    it('calls fetchEvents with correct author filter when pubkey is valid', async () => {
      const fetchSpy = jest.spyOn(client, 'fetchEvents').mockResolvedValue([]);
      const validAuthor = '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff';

      await client.fetchEventsByAuthor(validAuthor, { kinds: [1], limit: 5 });

      expect(fetchSpy).toHaveBeenCalledWith([
        {
          authors: [validAuthor],
          kinds: [1],
          limit: 5
        }
      ]);
    });
  });

  describe('fetchEventsByTag', () => {
    beforeEach(async () => {
      jest.spyOn(pool, 'ensureRelay').mockResolvedValue({} as never);
      await client.connect();
    });

    it('throws NostrParseError if tag value is empty or whitespace', async () => {
      await expect(client.fetchEventsByTag('#d', '')).rejects.toBeInstanceOf(NostrParseError);
      await expect(client.fetchEventsByTag('#d', '   ')).rejects.toBeInstanceOf(NostrParseError);
    });

    it('calls fetchEvents with tag filter for non-empty value', async () => {
      const fetchSpy = jest.spyOn(client, 'fetchEvents').mockResolvedValue([]);

      await client.fetchEventsByTag('#d', 'scenario_123', { limit: 1 });

      expect(fetchSpy).toHaveBeenCalledWith([
        {
          '#d': ['scenario_123'],
          limit: 1
        }
      ]);
    });
  });

  describe('npubEncode and npubDecode', () => {
    const validPubkey = '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff';
    const expectedNpub = 'npub1ger2u5z8x945yvxsppkg4nkxslcqk8xe68wxxnmvkdv2cz563lls9fwehy';

    it('encodes a 64-char hex pubkey to bech32 npub', () => {
      const npub = client.npubEncode(validPubkey);
      expect(npub).toBe(expectedNpub);
    });

    it('throws NostrParseError when encoding invalid pubkey', () => {
      expect(() => client.npubEncode('invalid')).toThrow(NostrParseError);
      expect(() => client.npubEncode('0'.repeat(63))).toThrow(NostrParseError);
    });

    it('decodes a bech32 npub back to 64-char hex', () => {
      const decoded = client.npubDecode(expectedNpub);
      expect(decoded).toBe(validPubkey);
    });

    it('throws NostrParseError when decoding invalid npub', () => {
      expect(() => client.npubDecode('invalid_bech32')).toThrow(NostrParseError);
      expect(() => client.npubDecode('note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toThrow(NostrParseError);
    });
  });
});
