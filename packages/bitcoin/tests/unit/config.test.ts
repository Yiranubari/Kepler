import { BitcoinConfig, BitcoinConfigError } from '../../src';

describe('BitcoinConfig', () => {
  const validPrimaryUrl = 'https://blockstream.info/api';
  const validFallbackUrl = 'https://mempool.space/api';
  const validNetwork = 'mainnet';

  describe('constructor', () => {
    it('creates an instance with valid parameters', () => {
      const config = new BitcoinConfig({
        primaryUrl: validPrimaryUrl,
        fallbackUrl: validFallbackUrl,
        network: validNetwork
      });
      expect(config.primaryUrl).toBe(validPrimaryUrl);
      expect(config.fallbackUrl).toBe(validFallbackUrl);
      expect(config.network).toBe('mainnet');
    });

    it('accepts testnet and regtest networks', () => {
      const testnetConfig = new BitcoinConfig({
        primaryUrl: validPrimaryUrl,
        fallbackUrl: validFallbackUrl,
        network: 'testnet'
      });
      expect(testnetConfig.network).toBe('testnet');

      const regtestConfig = new BitcoinConfig({
        primaryUrl: validPrimaryUrl,
        fallbackUrl: validFallbackUrl,
        network: 'regtest'
      });
      expect(regtestConfig.network).toBe('regtest');
    });

    it('accepts http URLs for local environments', () => {
      const httpConfig = new BitcoinConfig({
        primaryUrl: 'http://localhost:3000',
        fallbackUrl: 'http://127.0.0.1:3002',
        network: 'regtest'
      });
      expect(httpConfig.primaryUrl).toBe('http://localhost:3000');
      expect(httpConfig.fallbackUrl).toBe('http://127.0.0.1:3002');
    });

    it('throws BitcoinConfigError when primaryUrl is invalid', () => {
      expect(() => {
        new BitcoinConfig({
          primaryUrl: 'ftp://invalid.com',
          fallbackUrl: validFallbackUrl,
          network: validNetwork
        });
      }).toThrow(BitcoinConfigError);

      try {
        new BitcoinConfig({
          primaryUrl: 'not-a-url',
          fallbackUrl: validFallbackUrl,
          network: validNetwork
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BitcoinConfigError);
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('ESPLORA_URL');
        expect(configError.context['protocol']).toBe('bitcoin');
        expect(configError.code).toBe('BITCOIN_CONFIG_ERROR');
      }
    });

    it('throws BitcoinConfigError when fallbackUrl is invalid', () => {
      try {
        new BitcoinConfig({
          primaryUrl: validPrimaryUrl,
          fallbackUrl: 'ws://invalid.com',
          network: validNetwork
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BitcoinConfigError);
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('ESPLORA_FALLBACK_URL');
        expect(configError.context['protocol']).toBe('bitcoin');
        expect(configError.code).toBe('BITCOIN_CONFIG_ERROR');
      }
    });

    it('throws BitcoinConfigError when network is invalid', () => {
      try {
        new BitcoinConfig({
          primaryUrl: validPrimaryUrl,
          fallbackUrl: validFallbackUrl,
          network: 'signet' as unknown as 'mainnet'
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BitcoinConfigError);
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('BITCOIN_NETWORK');
        expect(configError.context['protocol']).toBe('bitcoin');
        expect(configError.code).toBe('BITCOIN_CONFIG_ERROR');
      }
    });
  });

  describe('fromEnv', () => {
    it('creates config from valid environment map', () => {
      const config = BitcoinConfig.fromEnv({
        ESPLORA_URL: 'https://blockstream.info/api',
        ESPLORA_FALLBACK_URL: 'https://mempool.space/api',
        BITCOIN_NETWORK: 'mainnet'
      });

      expect(config.primaryUrl).toBe('https://blockstream.info/api');
      expect(config.fallbackUrl).toBe('https://mempool.space/api');
      expect(config.network).toBe('mainnet');
    });

    it('throws BitcoinConfigError when ESPLORA_URL is missing', () => {
      expect(() => {
        BitcoinConfig.fromEnv({
          ESPLORA_FALLBACK_URL: validFallbackUrl,
          BITCOIN_NETWORK: validNetwork
        });
      }).toThrow(BitcoinConfigError);

      try {
        BitcoinConfig.fromEnv({
          ESPLORA_FALLBACK_URL: validFallbackUrl,
          BITCOIN_NETWORK: validNetwork
        });
      } catch (err) {
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('ESPLORA_URL');
        expect(configError.context['protocol']).toBe('bitcoin');
      }
    });

    it('throws BitcoinConfigError when ESPLORA_URL is empty or whitespace', () => {
      expect(() => {
        BitcoinConfig.fromEnv({
          ESPLORA_URL: '',
          ESPLORA_FALLBACK_URL: validFallbackUrl,
          BITCOIN_NETWORK: validNetwork
        });
      }).toThrow(BitcoinConfigError);

      expect(() => {
        BitcoinConfig.fromEnv({
          ESPLORA_URL: '   ',
          ESPLORA_FALLBACK_URL: validFallbackUrl,
          BITCOIN_NETWORK: validNetwork
        });
      }).toThrow(BitcoinConfigError);
    });

    it('throws BitcoinConfigError when ESPLORA_URL has non-http/https scheme', () => {
      try {
        BitcoinConfig.fromEnv({
          ESPLORA_URL: 'gopher://example.com',
          ESPLORA_FALLBACK_URL: validFallbackUrl,
          BITCOIN_NETWORK: validNetwork
        });
      } catch (err) {
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('ESPLORA_URL');
      }
    });

    it('throws BitcoinConfigError when ESPLORA_FALLBACK_URL is missing', () => {
      try {
        BitcoinConfig.fromEnv({
          ESPLORA_URL: validPrimaryUrl,
          BITCOIN_NETWORK: validNetwork
        });
      } catch (err) {
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('ESPLORA_FALLBACK_URL');
      }
    });

    it('throws BitcoinConfigError when ESPLORA_FALLBACK_URL is empty', () => {
      try {
        BitcoinConfig.fromEnv({
          ESPLORA_URL: validPrimaryUrl,
          ESPLORA_FALLBACK_URL: '',
          BITCOIN_NETWORK: validNetwork
        });
      } catch (err) {
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('ESPLORA_FALLBACK_URL');
      }
    });

    it('throws BitcoinConfigError when BITCOIN_NETWORK is missing', () => {
      try {
        BitcoinConfig.fromEnv({
          ESPLORA_URL: validPrimaryUrl,
          ESPLORA_FALLBACK_URL: validFallbackUrl
        });
      } catch (err) {
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('BITCOIN_NETWORK');
      }
    });

    it('throws BitcoinConfigError when BITCOIN_NETWORK is not mainnet, testnet, or regtest', () => {
      try {
        BitcoinConfig.fromEnv({
          ESPLORA_URL: validPrimaryUrl,
          ESPLORA_FALLBACK_URL: validFallbackUrl,
          BITCOIN_NETWORK: 'customnet'
        });
      } catch (err) {
        const configError = err as BitcoinConfigError;
        expect(configError.context['variable']).toBe('BITCOIN_NETWORK');
      }
    });

    it('reads from process.env by default', () => {
      const originalEsplora = process.env['ESPLORA_URL'];
      const originalFallback = process.env['ESPLORA_FALLBACK_URL'];
      const originalNetwork = process.env['BITCOIN_NETWORK'];

      try {
        process.env['ESPLORA_URL'] = 'https://blockstream.info/api';
        process.env['ESPLORA_FALLBACK_URL'] = 'https://mempool.space/api';
        process.env['BITCOIN_NETWORK'] = 'testnet';

        const config = BitcoinConfig.fromEnv();
        expect(config.primaryUrl).toBe('https://blockstream.info/api');
        expect(config.fallbackUrl).toBe('https://mempool.space/api');
        expect(config.network).toBe('testnet');
      } finally {
        if (originalEsplora !== undefined) {
          process.env['ESPLORA_URL'] = originalEsplora;
        } else {
          delete process.env['ESPLORA_URL'];
        }

        if (originalFallback !== undefined) {
          process.env['ESPLORA_FALLBACK_URL'] = originalFallback;
        } else {
          delete process.env['ESPLORA_FALLBACK_URL'];
        }

        if (originalNetwork !== undefined) {
          process.env['BITCOIN_NETWORK'] = originalNetwork;
        } else {
          delete process.env['BITCOIN_NETWORK'];
        }
      }
    });
  });
});
