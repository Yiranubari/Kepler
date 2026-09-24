import { KeplerError, ProtocolError } from '@kepler/shared';
import {
  NostrConfigError,
  NostrNetworkError,
  NostrConnectionError,
  NostrTimeoutError,
  NostrPublishError,
  NostrVerificationError,
  NostrParseError
} from '../../src';

describe('Nostr Error Hierarchy', () => {
  const errorSubclasses: Array<{
    name: string;
    factory: () => ProtocolError;
    expectedCode: string;
  }> = [
    {
      name: 'NostrConfigError',
      factory: () => new NostrConfigError('Configuration missing'),
      expectedCode: 'NOSTR_CONFIG_ERROR'
    },
    {
      name: 'NostrNetworkError',
      factory: () => new NostrNetworkError('Relay network unreachable', { relayUrl: 'wss://relay.damus.io' }),
      expectedCode: 'NOSTR_NETWORK_ERROR'
    },
    {
      name: 'NostrConnectionError',
      factory: () => new NostrConnectionError('Failed to connect to relay', { relayUrl: 'wss://relay.damus.io', pubkey: 'abcdef' }),
      expectedCode: 'NOSTR_CONNECTION_ERROR'
    },
    {
      name: 'NostrTimeoutError',
      factory: () => new NostrTimeoutError('Request timed out', { operation: 'publish', timeoutMs: 5000 }),
      expectedCode: 'NOSTR_TIMEOUT_ERROR'
    },
    {
      name: 'NostrPublishError',
      factory: () => new NostrPublishError('Event publication rejected', { eventId: 'event123', relayUrl: 'wss://relay.damus.io' }),
      expectedCode: 'NOSTR_PUBLISH_ERROR'
    },
    {
      name: 'NostrVerificationError',
      factory: () => new NostrVerificationError('Event signature verification failed', { eventId: 'event123' }),
      expectedCode: 'NOSTR_VERIFICATION_ERROR'
    },
    {
      name: 'NostrParseError',
      factory: () => new NostrParseError('Parse failed', { input: 'invalid', reason: 'Malformed JSON' }),
      expectedCode: 'NOSTR_PARSE_ERROR'
    }
  ];

  describe.each(errorSubclasses)('$name common contract', ({ factory, expectedCode, name }) => {
    it('sets the expected code', () => {
      const err = factory();
      expect(err.code).toBe(expectedCode);
    });

    it('sets context.protocol to nostr', () => {
      const err = factory();
      expect(err.context['protocol']).toBe('nostr');
    });

    it('is an instance of ProtocolError', () => {
      const err = factory();
      expect(err).toBeInstanceOf(ProtocolError);
    });

    it('is an instance of KeplerError', () => {
      const err = factory();
      expect(err).toBeInstanceOf(KeplerError);
    });

    it('is an instance of Error', () => {
      const err = factory();
      expect(err).toBeInstanceOf(Error);
    });

    it('has name matching constructor name', () => {
      const err = factory();
      expect(err.name).toBe(name);
    });

    it('returns valid JSON from toJSON', () => {
      const err = factory();
      const json = err.toJSON();
      expect(json.name).toBe(name);
      expect(json.code).toBe(expectedCode);
      expect(json.context['protocol']).toBe('nostr');
    });
  });

  describe('NostrConfigError', () => {
    it('preserves custom context alongside protocol', () => {
      const err = new NostrConfigError('Missing NOSTR_PRIVATE_KEY', {
        variable: 'NOSTR_PRIVATE_KEY',
        field: 'privateKey'
      });
      expect(err.context['variable']).toBe('NOSTR_PRIVATE_KEY');
      expect(err.context['field']).toBe('privateKey');
      expect(err.context['protocol']).toBe('nostr');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('Zod validation error');
      const err = new NostrConfigError('Invalid config', {}, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('NostrNetworkError', () => {
    it('preserves relayUrl, url, and status in context', () => {
      const err = new NostrNetworkError('Network error', {
        relayUrl: 'wss://relay.damus.io',
        url: 'https://relay.damus.io',
        status: 502
      });
      expect(err.context['relayUrl']).toBe('wss://relay.damus.io');
      expect(err.context['url']).toBe('https://relay.damus.io');
      expect(err.context['status']).toBe(502);
      expect(err.context['protocol']).toBe('nostr');
    });
  });

  describe('NostrConnectionError', () => {
    it('preserves relayUrl and pubkey in context', () => {
      const err = new NostrConnectionError('Connection failed', {
        relayUrl: 'wss://relay.damus.io',
        pubkey: 'abcdef123456'
      });
      expect(err.context['relayUrl']).toBe('wss://relay.damus.io');
      expect(err.context['pubkey']).toBe('abcdef123456');
      expect(err.context['protocol']).toBe('nostr');
    });
  });

  describe('NostrTimeoutError', () => {
    it('preserves operation, timeoutMs, and relayUrl in context', () => {
      const err = new NostrTimeoutError('Relay timeout', {
        operation: 'publish',
        timeoutMs: 5000,
        relayUrl: 'wss://relay.damus.io'
      });
      expect(err.context['operation']).toBe('publish');
      expect(err.context['timeoutMs']).toBe(5000);
      expect(err.context['relayUrl']).toBe('wss://relay.damus.io');
      expect(err.context['protocol']).toBe('nostr');
    });
  });

  describe('NostrPublishError', () => {
    it('preserves eventId, relayUrl, and reason in context', () => {
      const err = new NostrPublishError('Relay rejected event', {
        eventId: 'event_deadbeef',
        relayUrl: 'wss://relay.damus.io',
        reason: 'blocked: tor exit node'
      });
      expect(err.context['eventId']).toBe('event_deadbeef');
      expect(err.context['relayUrl']).toBe('wss://relay.damus.io');
      expect(err.context['reason']).toBe('blocked: tor exit node');
      expect(err.context['protocol']).toBe('nostr');
    });
  });

  describe('NostrVerificationError', () => {
    it('preserves eventId and reason in context', () => {
      const err = new NostrVerificationError('Signature invalid', {
        eventId: 'event_deadbeef',
        reason: 'Invalid schnorr signature'
      });
      expect(err.context['eventId']).toBe('event_deadbeef');
      expect(err.context['reason']).toBe('Invalid schnorr signature');
      expect(err.context['protocol']).toBe('nostr');
    });
  });

  describe('NostrParseError', () => {
    it('includes short input without truncation', () => {
      const shortInput = '{"kind":1,"content":"hello"}';
      const err = new NostrParseError('Invalid event JSON', {
        input: shortInput,
        reason: 'Unexpected token'
      });
      expect(err.context['input']).toBe(shortInput);
      expect(err.context['reason']).toBe('Unexpected token');
      expect(err.context['protocol']).toBe('nostr');
    });

    it('safely truncates string input exceeding max length', () => {
      const longInput = 'x'.repeat(300);
      const err = new NostrParseError('Payload too large', {
        input: longInput,
        reason: 'Exceeded buffer size'
      });
      const truncated = `${'x'.repeat(128)}...`;
      expect(err.context['input']).toBe(truncated);
      expect(err.context['reason']).toBe('Exceeded buffer size');
      expect(err.context['protocol']).toBe('nostr');
    });

    it('safely truncates Uint8Array input exceeding max length', () => {
      const longBytes = new Uint8Array(200);
      longBytes.fill(0xcd);
      const err = new NostrParseError('Raw bytes malformed', {
        input: longBytes,
        reason: 'Corrupt signature'
      });
      const expectedHex = 'cd'.repeat(64);
      expect(typeof err.context['input']).toBe('string');
      expect((err.context['input'] as string).startsWith(expectedHex)).toBe(true);
      expect((err.context['input'] as string).endsWith('...')).toBe(true);
    });

    it('converts short Uint8Array input to hex without truncation', () => {
      const shortBytes = new Uint8Array([0x0a, 0x0b, 0x0c, 0x0d]);
      const err = new NostrParseError('Short byte stream', {
        input: shortBytes,
        reason: 'Unexpected EOF'
      });
      expect(err.context['input']).toBe('0a0b0c0d');
    });

    it('handles context without input safely', () => {
      const err = new NostrParseError('Missing input', {
        reason: 'Input was empty'
      });
      expect(err.context['input']).toBeUndefined();
      expect(err.context['reason']).toBe('Input was empty');
      expect(err.context['protocol']).toBe('nostr');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('JSON parse error');
      const err = new NostrParseError('Parse failed', {}, cause);
      expect(err.cause).toBe(cause);
    });

    it('does not allow overriding protocol', () => {
      const err = new NostrParseError('Parse error', { protocol: 'overridden' });
      expect(err.context['protocol']).toBe('nostr');
    });
  });
});
