import { CashuConfig, CashuConfigError } from '../../src';

describe('CashuConfig', () => {
  const validMintUrl = 'https://testnut.cashu.space';
  const validFallbackMintUrl = 'https://mint.minibits.cash/Bitcoin';

  describe('constructor', () => {
    it('creates an instance with valid required parameters', () => {
      const config = new CashuConfig({
        mintUrl: validMintUrl
      });
      expect(config.mintUrl).toBe(validMintUrl);
      expect(config.fallbackMintUrl).toBeNull();
      expect(config.unit).toBe('sat');
      expect(config.requestTimeoutMs).toBe(15_000);
    });

    it('creates an instance with all valid parameters', () => {
      const config = new CashuConfig({
        mintUrl: validMintUrl,
        fallbackMintUrl: validFallbackMintUrl,
        unit: 'msat',
        requestTimeoutMs: 30_000
      });
      expect(config.mintUrl).toBe(validMintUrl);
      expect(config.fallbackMintUrl).toBe(validFallbackMintUrl);
      expect(config.unit).toBe('msat');
      expect(config.requestTimeoutMs).toBe(30_000);
    });

    it('accepts http URLs for local development', () => {
      const config = new CashuConfig({
        mintUrl: 'http://localhost:3338',
        fallbackMintUrl: 'http://127.0.0.1:3338'
      });
      expect(config.mintUrl).toBe('http://localhost:3338');
      expect(config.fallbackMintUrl).toBe('http://127.0.0.1:3338');
    });

    it('accepts explicit null for fallbackMintUrl', () => {
      const config = new CashuConfig({
        mintUrl: validMintUrl,
        fallbackMintUrl: null
      });
      expect(config.fallbackMintUrl).toBeNull();
    });

    it('throws CashuConfigError when mintUrl is invalid scheme', () => {
      try {
        new CashuConfig({
          mintUrl: 'ftp://mint.example.com'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.code).toBe('CASHU_CONFIG_ERROR');
        expect(configError.context['field']).toBe('mintUrl');
        expect(configError.context['protocol']).toBe('cashu');
      }
    });

    it('throws CashuConfigError when mintUrl is not a valid URL', () => {
      try {
        new CashuConfig({
          mintUrl: 'not-a-url'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('mintUrl');
      }
    });

    it('throws CashuConfigError when fallbackMintUrl is invalid scheme', () => {
      try {
        new CashuConfig({
          mintUrl: validMintUrl,
          fallbackMintUrl: 'ws://relay.example.com'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('fallbackMintUrl');
      }
    });

    it('throws CashuConfigError when unit is not sat or msat', () => {
      try {
        new CashuConfig({
          mintUrl: validMintUrl,
          unit: 'btc' as unknown as 'sat'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('unit');
      }
    });

    it('throws CashuConfigError when requestTimeoutMs is zero or negative', () => {
      try {
        new CashuConfig({
          mintUrl: validMintUrl,
          requestTimeoutMs: 0
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('requestTimeoutMs');
      }

      try {
        new CashuConfig({
          mintUrl: validMintUrl,
          requestTimeoutMs: -100
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('requestTimeoutMs');
      }
    });

    it('throws CashuConfigError when requestTimeoutMs is not an integer', () => {
      try {
        new CashuConfig({
          mintUrl: validMintUrl,
          requestTimeoutMs: 1500.5
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('requestTimeoutMs');
      }
    });
  });

  describe('fromEnv', () => {
    it('creates an instance from full valid environment', () => {
      const env = {
        CASHU_MINT_URL: validMintUrl,
        CASHU_MINT_URL_FALLBACK: validFallbackMintUrl,
        CASHU_UNIT: 'msat',
        CASHU_REQUEST_TIMEOUT_MS: '20000'
      };
      const config = CashuConfig.fromEnv(env);
      expect(config.mintUrl).toBe(validMintUrl);
      expect(config.fallbackMintUrl).toBe(validFallbackMintUrl);
      expect(config.unit).toBe('msat');
      expect(config.requestTimeoutMs).toBe(20_000);
    });

    it('defaults unit to sat when CASHU_UNIT is absent', () => {
      const env = {
        CASHU_MINT_URL: validMintUrl
      };
      const config = CashuConfig.fromEnv(env);
      expect(config.unit).toBe('sat');
    });

    it('defaults fallbackMintUrl to null when absent', () => {
      const env = {
        CASHU_MINT_URL: validMintUrl
      };
      const config = CashuConfig.fromEnv(env);
      expect(config.fallbackMintUrl).toBeNull();
    });

    it('defaults requestTimeoutMs to 15000 when absent', () => {
      const env = {
        CASHU_MINT_URL: validMintUrl
      };
      const config = CashuConfig.fromEnv(env);
      expect(config.requestTimeoutMs).toBe(15_000);
    });

    it('throws CashuConfigError when CASHU_MINT_URL is unset', () => {
      try {
        CashuConfig.fromEnv({});
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['variable']).toBe('CASHU_MINT_URL');
        expect(configError.context['field']).toBe('CASHU_MINT_URL');
        expect(configError.context['protocol']).toBe('cashu');
      }
    });

    it('throws CashuConfigError when CASHU_MINT_URL is empty', () => {
      try {
        CashuConfig.fromEnv({ CASHU_MINT_URL: '   ' });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('CASHU_MINT_URL');
      }
    });

    it('throws CashuConfigError when CASHU_MINT_URL is invalid', () => {
      try {
        CashuConfig.fromEnv({ CASHU_MINT_URL: 'invalid-url' });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('mintUrl');
      }
    });

    it('throws CashuConfigError when CASHU_MINT_URL_FALLBACK is invalid', () => {
      try {
        CashuConfig.fromEnv({
          CASHU_MINT_URL: validMintUrl,
          CASHU_MINT_URL_FALLBACK: 'not-a-valid-url'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['variable']).toBe('CASHU_MINT_URL_FALLBACK');
        expect(configError.context['field']).toBe('fallbackMintUrl');
      }
    });

    it('throws CashuConfigError when CASHU_UNIT is foo', () => {
      try {
        CashuConfig.fromEnv({
          CASHU_MINT_URL: validMintUrl,
          CASHU_UNIT: 'foo'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['variable']).toBe('CASHU_UNIT');
        expect(configError.context['field']).toBe('unit');
      }
    });

    it('throws CashuConfigError when CASHU_UNIT is present and not sat or msat', () => {
      try {
        CashuConfig.fromEnv({
          CASHU_MINT_URL: validMintUrl,
          CASHU_UNIT: 'btc'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['variable']).toBe('CASHU_UNIT');
        expect(configError.context['field']).toBe('unit');
      }

      try {
        CashuConfig.fromEnv({
          CASHU_MINT_URL: validMintUrl,
          CASHU_UNIT: ''
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('unit');
      }
    });

    it('throws CashuConfigError when CASHU_REQUEST_TIMEOUT_MS is invalid', () => {
      try {
        CashuConfig.fromEnv({
          CASHU_MINT_URL: validMintUrl,
          CASHU_REQUEST_TIMEOUT_MS: '0'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['variable']).toBe('CASHU_REQUEST_TIMEOUT_MS');
        expect(configError.context['field']).toBe('requestTimeoutMs');
      }

      try {
        CashuConfig.fromEnv({
          CASHU_MINT_URL: validMintUrl,
          CASHU_REQUEST_TIMEOUT_MS: 'not-a-number'
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('requestTimeoutMs');
      }

      try {
        CashuConfig.fromEnv({
          CASHU_MINT_URL: validMintUrl,
          CASHU_REQUEST_TIMEOUT_MS: '   '
        });
        fail('Expected CashuConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(CashuConfigError);
        const configError = err as CashuConfigError;
        expect(configError.context['field']).toBe('requestTimeoutMs');
      }
    });
  });
});
