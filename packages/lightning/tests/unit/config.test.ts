import { LightningConfig, LightningConfigError } from '../../src';

describe('LightningConfig', () => {
  const validPubkey = '618bdf39eaf542de9ffd17c0a0e748fe35a73e42e09148daf349c9d0e7003289';
  const validRelay = 'wss://relay.getalby.com';
  const validSecret = '0890fe3a6970880d5d6456b1799f5c9a09004b653aa3b6363f92ea25f8cb2101';
  const validConnectionString = `nostr+walletconnect://${validPubkey}?relay=${validRelay}&secret=${validSecret}`;

  describe('constructor', () => {
    it('creates an instance with valid connection string and default timeout', () => {
      const config = new LightningConfig({
        connectionString: validConnectionString
      });
      expect(config.connectionString).toBe(validConnectionString);
      expect(config.walletPubkey).toBe(validPubkey);
      expect(config.relayUrl).toBe(validRelay);
      expect(config.secret).toBe(validSecret);
      expect(config.requestTimeoutMs).toBe(30000);
    });

    it('creates an instance with custom requestTimeoutMs', () => {
      const config = new LightningConfig({
        connectionString: validConnectionString,
        requestTimeoutMs: 15000
      });
      expect(config.requestTimeoutMs).toBe(15000);
    });

    it('throws LightningConfigError when connectionString is empty', () => {
      try {
        new LightningConfig({ connectionString: '' });
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningConfigError);
        const configErr = err as LightningConfigError;
        expect(configErr.code).toBe('LIGHTNING_CONFIG_ERROR');
        expect(configErr.context['variable']).toBe('NWC_CONNECTION_STRING');
        expect(configErr.context['field']).toBe('connectionString');
        expect(configErr.context['protocol']).toBe('lightning');
      }
    });

    it('throws LightningConfigError when connectionString does not start with nostr+walletconnect://', () => {
      try {
        new LightningConfig({ connectionString: 'https://example.com' });
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningConfigError);
        const configErr = err as LightningConfigError;
        expect(configErr.code).toBe('LIGHTNING_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('connectionString');
      }
    });

    it('throws LightningConfigError when pubkey is missing in connection string', () => {
      try {
        new LightningConfig({
          connectionString: `nostr+walletconnect://?relay=${validRelay}&secret=${validSecret}`
        });
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningConfigError);
        const configErr = err as LightningConfigError;
        expect(configErr.code).toBe('LIGHTNING_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('pubkey');
      }
    });

    it('throws LightningConfigError when relay is missing in connection string', () => {
      try {
        new LightningConfig({
          connectionString: `nostr+walletconnect://${validPubkey}?secret=${validSecret}`
        });
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningConfigError);
        const configErr = err as LightningConfigError;
        expect(configErr.code).toBe('LIGHTNING_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('relay');
      }
    });

    it('throws LightningConfigError when secret is missing in connection string', () => {
      try {
        new LightningConfig({
          connectionString: `nostr+walletconnect://${validPubkey}?relay=${validRelay}`
        });
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningConfigError);
        const configErr = err as LightningConfigError;
        expect(configErr.code).toBe('LIGHTNING_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('secret');
      }
    });

    it('throws LightningConfigError when requestTimeoutMs is zero or negative', () => {
      expect(() => {
        new LightningConfig({
          connectionString: validConnectionString,
          requestTimeoutMs: 0
        });
      }).toThrow(LightningConfigError);

      expect(() => {
        new LightningConfig({
          connectionString: validConnectionString,
          requestTimeoutMs: -100
        });
      }).toThrow(LightningConfigError);
    });

    it('throws LightningConfigError when requestTimeoutMs is non-integer', () => {
      expect(() => {
        new LightningConfig({
          connectionString: validConnectionString,
          requestTimeoutMs: 1234.5
        });
      }).toThrow(LightningConfigError);
    });
  });

  describe('fromEnv', () => {
    it('creates an instance from valid env object with default timeout', () => {
      const env = {
        NWC_CONNECTION_STRING: validConnectionString
      };
      const config = LightningConfig.fromEnv(env);
      expect(config.connectionString).toBe(validConnectionString);
      expect(config.walletPubkey).toBe(validPubkey);
      expect(config.relayUrl).toBe(validRelay);
      expect(config.secret).toBe(validSecret);
      expect(config.requestTimeoutMs).toBe(30000);
    });

    it('creates an instance from valid env object with custom NWC_TIMEOUT_MS', () => {
      const env = {
        NWC_CONNECTION_STRING: validConnectionString,
        NWC_TIMEOUT_MS: '45000'
      };
      const config = LightningConfig.fromEnv(env);
      expect(config.requestTimeoutMs).toBe(45000);
    });

    it('throws LightningConfigError when NWC_CONNECTION_STRING is missing in env', () => {
      try {
        LightningConfig.fromEnv({});
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningConfigError);
        const configErr = err as LightningConfigError;
        expect(configErr.code).toBe('LIGHTNING_CONFIG_ERROR');
        expect(configErr.context['variable']).toBe('NWC_CONNECTION_STRING');
        expect(configErr.context['field']).toBe('connectionString');
      }
    });

    it('throws LightningConfigError when NWC_CONNECTION_STRING is malformed in env', () => {
      try {
        LightningConfig.fromEnv({
          NWC_CONNECTION_STRING: 'not-nostr-walletconnect'
        });
        fail('Expected error not thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(LightningConfigError);
        const configErr = err as LightningConfigError;
        expect(configErr.code).toBe('LIGHTNING_CONFIG_ERROR');
        expect(configErr.context['variable']).toBe('NWC_CONNECTION_STRING');
        expect(configErr.context['field']).toBe('connectionString');
      }
    });

    it('throws LightningConfigError when NWC_TIMEOUT_MS is invalid in env', () => {
      const invalidTimeouts = ['abc', '0', '-500', '12.5'];
      for (const invalid of invalidTimeouts) {
        try {
          LightningConfig.fromEnv({
            NWC_CONNECTION_STRING: validConnectionString,
            NWC_TIMEOUT_MS: invalid
          });
          fail(`Expected error for invalid timeout: ${invalid}`);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(LightningConfigError);
          const configErr = err as LightningConfigError;
          expect(configErr.code).toBe('LIGHTNING_CONFIG_ERROR');
          expect(configErr.context['variable']).toBe('NWC_TIMEOUT_MS');
          expect(configErr.context['field']).toBe('requestTimeoutMs');
        }
      }
    });

    it('falls back to default timeout when NWC_TIMEOUT_MS is empty string or whitespace', () => {
      const config = LightningConfig.fromEnv({
        NWC_CONNECTION_STRING: validConnectionString,
        NWC_TIMEOUT_MS: '   '
      });
      expect(config.requestTimeoutMs).toBe(30000);
    });
  });
});
