import { KeplerError, ProtocolError } from '@kepler/shared';
import {
  BitcoinConfigError,
  BitcoinNetworkError,
  BitcoinNotFoundError,
  BitcoinInvalidResponseError,
  BitcoinParseError
} from '../../src';

describe('Bitcoin Error Hierarchy', () => {
  const errorSubclasses: Array<{
    name: string;
    factory: () => ProtocolError;
    expectedCode: string;
  }> = [
    {
      name: 'BitcoinConfigError',
      factory: () => new BitcoinConfigError('Configuration missing'),
      expectedCode: 'BITCOIN_CONFIG_ERROR'
    },
    {
      name: 'BitcoinNetworkError',
      factory: () => new BitcoinNetworkError('Connection refused', { url: 'https://esplora.example.com' }),
      expectedCode: 'BITCOIN_NETWORK_ERROR'
    },
    {
      name: 'BitcoinNotFoundError',
      factory: () => new BitcoinNotFoundError('Tx not found', { ref: 'abcdef0123456789' }),
      expectedCode: 'BITCOIN_NOT_FOUND'
    },
    {
      name: 'BitcoinInvalidResponseError',
      factory: () => new BitcoinInvalidResponseError('Bad payload', { url: 'https://esplora.example.com', reason: 'Non-JSON body' }),
      expectedCode: 'BITCOIN_INVALID_RESPONSE'
    },
    {
      name: 'BitcoinParseError',
      factory: () => new BitcoinParseError('Parse failed', { input: '01000000', reason: 'Invalid header' }),
      expectedCode: 'BITCOIN_PARSE_ERROR'
    }
  ];

  describe.each(errorSubclasses)('$name common contract', ({ factory, expectedCode, name }) => {
    it('sets the expected code', () => {
      const err = factory();
      expect(err.code).toBe(expectedCode);
    });

    it('sets context.protocol to bitcoin', () => {
      const err = factory();
      expect(err.context['protocol']).toBe('bitcoin');
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
      expect(json.context['protocol']).toBe('bitcoin');
    });
  });

  describe('BitcoinConfigError', () => {
    it('preserves custom context alongside protocol', () => {
      const err = new BitcoinConfigError('Missing ESPLORA_URL', { variable: 'ESPLORA_URL' });
      expect(err.context['variable']).toBe('ESPLORA_URL');
      expect(err.context['protocol']).toBe('bitcoin');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('Root cause');
      const err = new BitcoinConfigError('Config error', {}, cause);
      expect(err.cause).toBe(cause);
    });

    it('does not allow overriding protocol', () => {
      const err = new BitcoinConfigError('Config error', { protocol: 'overridden' });
      expect(err.context['protocol']).toBe('bitcoin');
    });
  });

  describe('BitcoinNetworkError', () => {
    it('includes url and optional status in context', () => {
      const err = new BitcoinNetworkError('Gateway timeout', {
        url: 'https://blockstream.info/api/tx/123',
        status: 504
      });
      expect(err.context['url']).toBe('https://blockstream.info/api/tx/123');
      expect(err.context['status']).toBe(504);
      expect(err.context['protocol']).toBe('bitcoin');
    });

    it('handles omission of status', () => {
      const err = new BitcoinNetworkError('Connection reset', {
        url: 'https://blockstream.info/api'
      });
      expect(err.context['url']).toBe('https://blockstream.info/api');
      expect(err.context['status']).toBeUndefined();
      expect(err.context['protocol']).toBe('bitcoin');
    });
  });

  describe('BitcoinNotFoundError', () => {
    it('includes ref in context for txid lookup', () => {
      const txid = '3b92f70b4a4cb88031a0e04664dbd23f793b5ee0e0242277d337d1561f9df76b';
      const err = new BitcoinNotFoundError('Transaction not found', { ref: txid });
      expect(err.context['ref']).toBe(txid);
      expect(err.context['protocol']).toBe('bitcoin');
    });

    it('includes ref in context for address lookup', () => {
      const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
      const err = new BitcoinNotFoundError('Address not found', { ref: address });
      expect(err.context['ref']).toBe(address);
      expect(err.context['protocol']).toBe('bitcoin');
    });
  });

  describe('BitcoinInvalidResponseError', () => {
    it('includes url and reason in context', () => {
      const err = new BitcoinInvalidResponseError('Unexpected response body', {
        url: 'https://mempool.space/api/blocks/tip/height',
        reason: 'Expected numeric string but received HTML'
      });
      expect(err.context['url']).toBe('https://mempool.space/api/blocks/tip/height');
      expect(err.context['reason']).toBe('Expected numeric string but received HTML');
      expect(err.context['protocol']).toBe('bitcoin');
    });
  });

  describe('BitcoinParseError', () => {
    it('includes short input without truncation', () => {
      const shortInput = '0200000001';
      const err = new BitcoinParseError('Invalid transaction version', {
        input: shortInput,
        reason: 'Unsupported version number'
      });
      expect(err.context['input']).toBe(shortInput);
      expect(err.context['reason']).toBe('Unsupported version number');
      expect(err.context['protocol']).toBe('bitcoin');
    });

    it('safely truncates string input exceeding max length', () => {
      const longInput = 'a'.repeat(300);
      const err = new BitcoinParseError('Payload too large', {
        input: longInput,
        reason: 'Exceeded buffer size'
      });
      const truncated = `${'a'.repeat(128)}...`;
      expect(err.context['input']).toBe(truncated);
      expect(err.context['reason']).toBe('Exceeded buffer size');
      expect(err.context['protocol']).toBe('bitcoin');
    });

    it('safely truncates Uint8Array input exceeding max length', () => {
      const longBytes = new Uint8Array(200);
      longBytes.fill(0xab);
      const err = new BitcoinParseError('Raw bytes malformed', {
        input: longBytes,
        reason: 'Corrupt witness data'
      });
      const expectedHex = 'ab'.repeat(64);
      expect(typeof err.context['input']).toBe('string');
      expect((err.context['input'] as string).startsWith(expectedHex)).toBe(true);
      expect((err.context['input'] as string).endsWith('...')).toBe(true);
    });

    it('converts short Uint8Array input to hex without truncation', () => {
      const shortBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const err = new BitcoinParseError('Short byte stream', {
        input: shortBytes,
        reason: 'Unexpected EOF'
      });
      expect(err.context['input']).toBe('01020304');
    });

    it('handles context without input safely', () => {
      const err = new BitcoinParseError('Missing input', {
        reason: 'Input was empty'
      });
      expect(err.context['input']).toBeUndefined();
      expect(err.context['reason']).toBe('Input was empty');
      expect(err.context['protocol']).toBe('bitcoin');
    });
  });
});
