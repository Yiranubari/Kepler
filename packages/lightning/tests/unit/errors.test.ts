import { KeplerError, ProtocolError } from '@kepler/shared';
import {
  LightningConfigError,
  LightningNetworkError,
  LightningConnectionError,
  LightningTimeoutError,
  LightningInvoiceError,
  LightningPaymentError,
  LightningParseError
} from '../../src';

describe('Lightning Error Hierarchy', () => {
  const errorSubclasses: Array<{
    name: string;
    factory: () => ProtocolError;
    expectedCode: string;
  }> = [
    {
      name: 'LightningConfigError',
      factory: () => new LightningConfigError('Configuration missing'),
      expectedCode: 'LIGHTNING_CONFIG_ERROR'
    },
    {
      name: 'LightningNetworkError',
      factory: () => new LightningNetworkError('Relay network unreachable', { relayUrl: 'wss://relay.damus.io' }),
      expectedCode: 'LIGHTNING_NETWORK_ERROR'
    },
    {
      name: 'LightningConnectionError',
      factory: () => new LightningConnectionError('Failed to connect to relay', { relayUrl: 'wss://relay.damus.io', pubkey: 'abcdef' }),
      expectedCode: 'LIGHTNING_CONNECTION_ERROR'
    },
    {
      name: 'LightningTimeoutError',
      factory: () => new LightningTimeoutError('NWC request timed out', { operation: 'pay_invoice', timeoutMs: 30000 }),
      expectedCode: 'LIGHTNING_TIMEOUT_ERROR'
    },
    {
      name: 'LightningInvoiceError',
      factory: () => new LightningInvoiceError('Malformed invoice', { invoice: 'lnbc1...', reason: 'Invalid checksum' }),
      expectedCode: 'LIGHTNING_INVOICE_ERROR'
    },
    {
      name: 'LightningPaymentError',
      factory: () => new LightningPaymentError('Payment rejected', { paymentHash: '123456' }),
      expectedCode: 'LIGHTNING_PAYMENT_ERROR'
    },
    {
      name: 'LightningParseError',
      factory: () => new LightningParseError('Parse failed', { input: 'lnbc...', reason: 'Invalid hrp' }),
      expectedCode: 'LIGHTNING_PARSE_ERROR'
    }
  ];

  describe.each(errorSubclasses)('$name common contract', ({ factory, expectedCode, name }) => {
    it('sets the expected code', () => {
      const err = factory();
      expect(err.code).toBe(expectedCode);
    });

    it('sets context.protocol to lightning', () => {
      const err = factory();
      expect(err.context['protocol']).toBe('lightning');
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
      expect(json.context['protocol']).toBe('lightning');
    });
  });

  describe('LightningConfigError', () => {
    it('preserves custom context alongside protocol', () => {
      const err = new LightningConfigError('Missing NWC_CONNECTION_STRING', { variable: 'NWC_CONNECTION_STRING' });
      expect(err.context['variable']).toBe('NWC_CONNECTION_STRING');
      expect(err.context['protocol']).toBe('lightning');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('Parse error');
      const err = new LightningConfigError('Config error', {}, cause);
      expect(err.cause).toBe(cause);
    });

    it('does not allow overriding protocol', () => {
      const err = new LightningConfigError('Config error', { protocol: 'overridden' });
      expect(err.context['protocol']).toBe('lightning');
    });
  });

  describe('LightningNetworkError', () => {
    it('includes relayUrl, url, and optional status in context', () => {
      const err = new LightningNetworkError('Relay connection failed', {
        relayUrl: 'wss://relay.getalby.com',
        url: 'https://relay.getalby.com',
        status: 502
      });
      expect(err.context['relayUrl']).toBe('wss://relay.getalby.com');
      expect(err.context['url']).toBe('https://relay.getalby.com');
      expect(err.context['status']).toBe(502);
      expect(err.context['protocol']).toBe('lightning');
    });

    it('handles omission of status', () => {
      const err = new LightningNetworkError('WebSocket closed unexpectedly', {
        relayUrl: 'wss://relay.getalby.com'
      });
      expect(err.context['relayUrl']).toBe('wss://relay.getalby.com');
      expect(err.context['status']).toBeUndefined();
      expect(err.context['protocol']).toBe('lightning');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('ECONNREFUSED');
      const err = new LightningNetworkError('Network error', {}, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('LightningConnectionError', () => {
    it('includes relayUrl and pubkey in context', () => {
      const err = new LightningConnectionError('Failed to establish connection', {
        relayUrl: 'wss://relay.damus.io',
        pubkey: '618bdf39eaf542de9ffd17c0a0e748fe35a73e42e09148daf349c9d0e7003289'
      });
      expect(err.context['relayUrl']).toBe('wss://relay.damus.io');
      expect(err.context['pubkey']).toBe('618bdf39eaf542de9ffd17c0a0e748fe35a73e42e09148daf349c9d0e7003289');
      expect(err.context['protocol']).toBe('lightning');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('Socket timeout');
      const err = new LightningConnectionError('Connection failure', {}, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('LightningTimeoutError', () => {
    it('includes operation, timeoutMs, and eventId in context', () => {
      const err = new LightningTimeoutError('Request timed out waiting for response', {
        operation: 'get_balance',
        timeoutMs: 15000,
        eventId: 'event123'
      });
      expect(err.context['operation']).toBe('get_balance');
      expect(err.context['timeoutMs']).toBe(15000);
      expect(err.context['eventId']).toBe('event123');
      expect(err.context['protocol']).toBe('lightning');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('AbortError');
      const err = new LightningTimeoutError('Timeout', {}, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('LightningInvoiceError', () => {
    it('includes invoice, paymentHash, and reason in context', () => {
      const err = new LightningInvoiceError('Expired invoice', {
        invoice: 'lnbc10u1p3...',
        paymentHash: 'abcdef0123456789',
        reason: 'Invoice expiry timestamp is in the past'
      });
      expect(err.context['invoice']).toBe('lnbc10u1p3...');
      expect(err.context['paymentHash']).toBe('abcdef0123456789');
      expect(err.context['reason']).toBe('Invoice expiry timestamp is in the past');
      expect(err.context['protocol']).toBe('lightning');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('Decode error');
      const err = new LightningInvoiceError('Invoice invalid', {}, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('LightningPaymentError', () => {
    it('includes paymentHash and preimage in context', () => {
      const err = new LightningPaymentError('Payment routed but failed at hop', {
        paymentHash: '112233445566',
        preimage: 'aabbccdd'
      });
      expect(err.context['paymentHash']).toBe('112233445566');
      expect(err.context['preimage']).toBe('aabbccdd');
      expect(err.context['protocol']).toBe('lightning');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('Insufficient balance');
      const err = new LightningPaymentError('Payment failed', {}, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('LightningParseError', () => {
    it('includes short input without truncation', () => {
      const shortInput = 'lnbc100n1p...';
      const err = new LightningParseError('Invalid bech32 separator', {
        input: shortInput,
        reason: 'Missing 1 separator'
      });
      expect(err.context['input']).toBe(shortInput);
      expect(err.context['reason']).toBe('Missing 1 separator');
      expect(err.context['protocol']).toBe('lightning');
    });

    it('safely truncates string input exceeding max length', () => {
      const longInput = 'x'.repeat(300);
      const err = new LightningParseError('Payload too large', {
        input: longInput,
        reason: 'Exceeded buffer size'
      });
      const truncated = `${'x'.repeat(128)}...`;
      expect(err.context['input']).toBe(truncated);
      expect(err.context['reason']).toBe('Exceeded buffer size');
      expect(err.context['protocol']).toBe('lightning');
    });

    it('safely truncates Uint8Array input exceeding max length', () => {
      const longBytes = new Uint8Array(200);
      longBytes.fill(0xcd);
      const err = new LightningParseError('Raw bytes malformed', {
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
      const err = new LightningParseError('Short byte stream', {
        input: shortBytes,
        reason: 'Unexpected EOF'
      });
      expect(err.context['input']).toBe('0a0b0c0d');
    });

    it('handles context without input safely', () => {
      const err = new LightningParseError('Missing input', {
        reason: 'Input was empty'
      });
      expect(err.context['input']).toBeUndefined();
      expect(err.context['reason']).toBe('Input was empty');
      expect(err.context['protocol']).toBe('lightning');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('Checksum mismatch');
      const err = new LightningParseError('Invalid checksum', {}, cause);
      expect(err.cause).toBe(cause);
    });

    it('does not allow overriding protocol', () => {
      const err = new LightningParseError('Parse error', { protocol: 'overridden' });
      expect(err.context['protocol']).toBe('lightning');
    });
  });
});
