import { KeplerError, ProtocolError } from '@kepler/shared';
import {
  CashuConfigError,
  CashuNetworkError,
  CashuMintError,
  CashuMeltError,
  CashuSwapError,
  CashuTokenError,
  CashuParseError
} from '../../src';

describe('Cashu Error Hierarchy', () => {
  const errorSubclasses: Array<{
    name: string;
    factory: () => ProtocolError;
    expectedCode: string;
  }> = [
    {
      name: 'CashuConfigError',
      factory: () => new CashuConfigError('Configuration missing'),
      expectedCode: 'CASHU_CONFIG_ERROR'
    },
    {
      name: 'CashuNetworkError',
      factory: () => new CashuNetworkError('Connection refused', { url: 'https://testnut.cashu.space' }),
      expectedCode: 'CASHU_NETWORK_ERROR'
    },
    {
      name: 'CashuMintError',
      factory: () => new CashuMintError('Mint keyset invalid', { mintUrl: 'https://testnut.cashu.space' }),
      expectedCode: 'CASHU_MINT_ERROR'
    },
    {
      name: 'CashuMeltError',
      factory: () => new CashuMeltError('Melt quote expired', { mintUrl: 'https://testnut.cashu.space', quoteId: 'quote-123' }),
      expectedCode: 'CASHU_MELT_ERROR'
    },
    {
      name: 'CashuSwapError',
      factory: () => new CashuSwapError('Split failed', { mintUrl: 'https://testnut.cashu.space' }),
      expectedCode: 'CASHU_SWAP_ERROR'
    },
    {
      name: 'CashuTokenError',
      factory: () => new CashuTokenError('Invalid token proofs', { token: 'cashuA...' }),
      expectedCode: 'CASHU_TOKEN_ERROR'
    },
    {
      name: 'CashuParseError',
      factory: () => new CashuParseError('Failed to parse token', { input: 'cashuA...' }),
      expectedCode: 'CASHU_PARSE_ERROR'
    }
  ];

  describe.each(errorSubclasses)('$name common contract', ({ factory, expectedCode, name }) => {
    it('sets the expected code', () => {
      const err = factory();
      expect(err.code).toBe(expectedCode);
    });

    it('sets context.protocol to cashu', () => {
      const err = factory();
      expect(err.context['protocol']).toBe('cashu');
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
      expect(json.context['protocol']).toBe('cashu');
    });
  });

  describe('CashuConfigError', () => {
    it('preserves custom context alongside protocol', () => {
      const err = new CashuConfigError('Missing CASHU_MINT_URL', {
        variable: 'CASHU_MINT_URL',
        field: 'mintUrl',
        reason: 'Required variable'
      });
      expect(err.context['variable']).toBe('CASHU_MINT_URL');
      expect(err.context['field']).toBe('mintUrl');
      expect(err.context['reason']).toBe('Required variable');
      expect(err.context['protocol']).toBe('cashu');
    });

    it('preserves cause when supplied', () => {
      const cause = new Error('Root cause');
      const err = new CashuConfigError('Config error', {}, cause);
      expect(err.cause).toBe(cause);
    });

    it('does not allow overriding protocol', () => {
      const err = new CashuConfigError('Config error', { protocol: 'overridden' });
      expect(err.context['protocol']).toBe('cashu');
    });
  });

  describe('CashuNetworkError', () => {
    it('includes url and status in context', () => {
      const err = new CashuNetworkError('Bad gateway', {
        url: 'https://testnut.cashu.space/v1/info',
        status: 502,
        reason: 'Bad Gateway'
      });
      expect(err.context['url']).toBe('https://testnut.cashu.space/v1/info');
      expect(err.context['status']).toBe(502);
      expect(err.context['reason']).toBe('Bad Gateway');
      expect(err.context['protocol']).toBe('cashu');
    });
  });

  describe('CashuMintError', () => {
    it('includes mintUrl and reason in context', () => {
      const err = new CashuMintError('Mint unavailable', {
        mintUrl: 'https://testnut.cashu.space',
        reason: 'Inactive keyset'
      });
      expect(err.context['mintUrl']).toBe('https://testnut.cashu.space');
      expect(err.context['reason']).toBe('Inactive keyset');
      expect(err.context['protocol']).toBe('cashu');
    });
  });

  describe('CashuMeltError', () => {
    it('includes mintUrl, quoteId, and reason in context', () => {
      const err = new CashuMeltError('Quote expired', {
        mintUrl: 'https://testnut.cashu.space',
        quoteId: 'quote-456',
        reason: 'Expired'
      });
      expect(err.context['mintUrl']).toBe('https://testnut.cashu.space');
      expect(err.context['quoteId']).toBe('quote-456');
      expect(err.context['reason']).toBe('Expired');
      expect(err.context['protocol']).toBe('cashu');
    });
  });

  describe('CashuSwapError', () => {
    it('includes mintUrl and reason in context', () => {
      const err = new CashuSwapError('Swap failed', {
        mintUrl: 'https://testnut.cashu.space',
        reason: 'Already spent'
      });
      expect(err.context['mintUrl']).toBe('https://testnut.cashu.space');
      expect(err.context['reason']).toBe('Already spent');
      expect(err.context['protocol']).toBe('cashu');
    });
  });

  describe('CashuTokenError', () => {
    it('includes token and reason in context', () => {
      const err = new CashuTokenError('Token invalid', {
        token: 'cashuAxyz',
        reason: 'Missing proofs'
      });
      expect(err.context['token']).toBe('cashuAxyz');
      expect(err.context['reason']).toBe('Missing proofs');
      expect(err.context['protocol']).toBe('cashu');
    });
  });

  describe('CashuParseError', () => {
    it('preserves short input without truncation', () => {
      const shortInput = 'cashuAeyJ0b2tlbnMiOlt7Im1pbnQiOiJodHRwczovL2V4YW1wbGUuY29tIn1dfQ==';
      const err = new CashuParseError('Invalid token prefix', {
        input: shortInput,
        reason: 'Unexpected prefix'
      });
      expect(err.context['input']).toBe(shortInput);
      expect(err.context['reason']).toBe('Unexpected prefix');
      expect(err.context['protocol']).toBe('cashu');
    });

    it('safely truncates string input exceeding 128 characters', () => {
      const longInput = 'c'.repeat(300);
      const err = new CashuParseError('Token too long', {
        input: longInput,
        reason: 'Exceeded length'
      });
      const truncated = `${'c'.repeat(128)}...`;
      expect(err.context['input']).toBe(truncated);
      expect(err.context['reason']).toBe('Exceeded length');
      expect(err.context['protocol']).toBe('cashu');
    });

    it('preserves input of exactly 128 characters without truncation', () => {
      const exactInput = 'k'.repeat(128);
      const err = new CashuParseError('Exact length', {
        input: exactInput
      });
      expect(err.context['input']).toBe(exactInput);
    });

    it('converts short Uint8Array input to hex without truncation', () => {
      const shortBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const err = new CashuParseError('Invalid bytes', {
        input: shortBytes,
        reason: 'Corrupt'
      });
      expect(err.context['input']).toBe('deadbeef');
      expect(err.context['reason']).toBe('Corrupt');
    });

    it('safely truncates Uint8Array input whose hex exceeds 128 characters', () => {
      const longBytes = new Uint8Array(100);
      longBytes.fill(0xee);
      const err = new CashuParseError('Long byte stream', {
        input: longBytes
      });
      const expectedPrefix = 'ee'.repeat(64);
      expect(typeof err.context['input']).toBe('string');
      expect(err.context['input']).toBe(`${expectedPrefix}...`);
    });

    it('handles context without input safely', () => {
      const err = new CashuParseError('Empty error', {
        reason: 'No input provided'
      });
      expect(err.context['input']).toBeUndefined();
      expect(err.context['reason']).toBe('No input provided');
      expect(err.context['protocol']).toBe('cashu');
    });

    it('handles non-string non-Uint8Array input without crashing', () => {
      const numberInput = 12345;
      const err = new CashuParseError('Invalid numeric input', {
        input: numberInput
      });
      expect(err.context['input']).toBe(12345);
    });
  });
});
