import util from 'node:util';
import { NostrConfig, NostrConfigError } from '../../src';

describe('NostrConfig', () => {
  const validPrivateKey = 'c69fb849f4bd3c374b9b940511c8b9e772a5bc12e36f4ca9a62bde8ea90bc06b';
  const expectedPublicKey = '687c062df7ee56c2f6ba249bafb74ee86ed896da753f0b2a57d83d0c999200db';
  const expectedNpub = 'npub1dp7qvt0haetv9a46yjd6ld6waphd39k6w5lsk2jhmq7sexvjqrds4trjt5';
  const validRelays = ['wss://relay.damus.io', 'wss://nos.lol'];
  const validRelaysString = 'wss://relay.damus.io, wss://nos.lol';

  describe('constructor', () => {
    it('creates an instance with valid parameters and defaults', () => {
      const config = new NostrConfig({
        privateKey: validPrivateKey,
        relays: validRelays
      });

      expect(config.privateKey).toBe(validPrivateKey);
      expect(config.publicKey).toBe(expectedPublicKey);
      expect(config.npub).toBe(expectedNpub);
      expect(config.relays).toEqual(validRelays);
      expect(config.timeoutMs).toBe(15000);
      expect(config.publishTimeoutMs).toBe(5000);
      expect(config.subscriptionLimit).toBe(500);
    });

    it('creates an instance with comma-separated relays string', () => {
      const config = new NostrConfig({
        privateKey: validPrivateKey,
        relays: validRelaysString
      });

      expect(config.relays).toEqual(validRelays);
    });

    it('creates an instance with custom timeouts and subscription limit', () => {
      const config = new NostrConfig({
        privateKey: validPrivateKey,
        relays: validRelays,
        timeoutMs: 20000,
        publishTimeoutMs: 8000,
        subscriptionLimit: 1000
      });

      expect(config.timeoutMs).toBe(20000);
      expect(config.publishTimeoutMs).toBe(8000);
      expect(config.subscriptionLimit).toBe(1000);
    });

    it('normalizes uppercase hex private key to lowercase', () => {
      const uppercaseKey = validPrivateKey.toUpperCase();
      const config = new NostrConfig({
        privateKey: uppercaseKey,
        relays: validRelays
      });

      expect(config.privateKey).toBe(validPrivateKey);
      expect(config.publicKey).toBe(expectedPublicKey);
      expect(config.npub).toBe(expectedNpub);
    });

    it('returns a defensive copy of relays array', () => {
      const config = new NostrConfig({
        privateKey: validPrivateKey,
        relays: validRelays
      });

      const relaysCopy = config.relays;
      relaysCopy.push('wss://malicious-relay.com');
      expect(config.relays).toEqual(validRelays);
    });

    it('redacts private key in inspect output', () => {
      const config = new NostrConfig({
        privateKey: validPrivateKey,
        relays: validRelays
      });

      const inspected = util.inspect(config);
      expect(inspected).toContain('[REDACTED]');
      expect(inspected).not.toContain(validPrivateKey);
    });

    it('does not expose private key in toJSON', () => {
      const config = new NostrConfig({
        privateKey: validPrivateKey,
        relays: validRelays
      });

      const json = config.toJSON();
      expect(json['privateKey']).toBeUndefined();
      expect(json['publicKey']).toBe(expectedPublicKey);
      expect(json['npub']).toBe(expectedNpub);
      expect(json['relays']).toEqual(validRelays);
    });

    it('throws NostrConfigError when private key is empty', () => {
      try {
        new NostrConfig({
          privateKey: '',
          relays: validRelays
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('privateKey');
      }
    });

    it('throws NostrConfigError when private key length is invalid', () => {
      const shortKey = validPrivateKey.slice(0, 63);
      try {
        new NostrConfig({
          privateKey: shortKey,
          relays: validRelays
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('privateKey');
        expect(JSON.stringify(configErr.context)).not.toContain(shortKey);
      }
    });

    it('throws NostrConfigError when private key is not hexadecimal', () => {
      const nonHexKey = 'z'.repeat(64);
      try {
        new NostrConfig({
          privateKey: nonHexKey,
          relays: validRelays
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('privateKey');
        expect(JSON.stringify(configErr.context)).not.toContain(nonHexKey);
      }
    });

    it('throws NostrConfigError when private key is invalid secp256k1 scalar', () => {
      const allZeros = '0'.repeat(64);
      try {
        new NostrConfig({
          privateKey: allZeros,
          relays: validRelays
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('privateKey');
        expect(JSON.stringify(configErr.context)).not.toContain(allZeros);
      }
    });

    it('throws NostrConfigError when relays array is empty', () => {
      try {
        new NostrConfig({
          privateKey: validPrivateKey,
          relays: []
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('relays');
      }
    });

    it('throws NostrConfigError when relays string is empty or whitespace', () => {
      try {
        new NostrConfig({
          privateKey: validPrivateKey,
          relays: '   '
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('relays');
      }
    });

    it('throws NostrConfigError when relay URL does not use wss:// protocol', () => {
      const invalidRelayProtocols = [
        'ws://relay.damus.io',
        'http://relay.damus.io',
        'https://relay.damus.io',
        'ftp://relay.damus.io'
      ];

      for (const invalidRelay of invalidRelayProtocols) {
        try {
          new NostrConfig({
            privateKey: validPrivateKey,
            relays: [invalidRelay]
          });
          fail(`Expected NostrConfigError for ${invalidRelay}`);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(NostrConfigError);
          const configErr = err as NostrConfigError;
          expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
          expect(configErr.context['field']).toBe('relays');
        }
      }
    });

    it('throws NostrConfigError when relay URL is malformed', () => {
      try {
        new NostrConfig({
          privateKey: validPrivateKey,
          relays: ['not-a-valid-url']
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['field']).toBe('relays');
      }
    });

    it('throws NostrConfigError when timeoutMs is invalid', () => {
      const invalidTimeouts = [0, -1, 12.34];
      for (const invalid of invalidTimeouts) {
        expect(() => {
          new NostrConfig({
            privateKey: validPrivateKey,
            relays: validRelays,
            timeoutMs: invalid
          });
        }).toThrow(NostrConfigError);
      }
    });

    it('throws NostrConfigError when publishTimeoutMs is invalid', () => {
      const invalidPublishTimeouts = [0, -5, 4.5];
      for (const invalid of invalidPublishTimeouts) {
        expect(() => {
          new NostrConfig({
            privateKey: validPrivateKey,
            relays: validRelays,
            publishTimeoutMs: invalid
          });
        }).toThrow(NostrConfigError);
      }
    });

    it('throws NostrConfigError when subscriptionLimit is invalid', () => {
      const invalidLimits = [0, -50, 10.5];
      for (const invalid of invalidLimits) {
        expect(() => {
          new NostrConfig({
            privateKey: validPrivateKey,
            relays: validRelays,
            subscriptionLimit: invalid
          });
        }).toThrow(NostrConfigError);
      }
    });
  });

  describe('fromEnv', () => {
    it('creates an instance from valid env object with defaults', () => {
      const env = {
        NOSTR_PRIVATE_KEY: validPrivateKey,
        NOSTR_RELAYS: validRelaysString
      };

      const config = NostrConfig.fromEnv(env);
      expect(config.privateKey).toBe(validPrivateKey);
      expect(config.publicKey).toBe(expectedPublicKey);
      expect(config.npub).toBe(expectedNpub);
      expect(config.relays).toEqual(validRelays);
      expect(config.timeoutMs).toBe(15000);
      expect(config.publishTimeoutMs).toBe(5000);
      expect(config.subscriptionLimit).toBe(500);
    });

    it('creates an instance from valid env object with custom options', () => {
      const env = {
        NOSTR_PRIVATE_KEY: validPrivateKey,
        NOSTR_RELAYS: validRelaysString,
        NOSTR_TIMEOUT_MS: '25000',
        NOSTR_PUBLISH_TIMEOUT_MS: '10000',
        NOSTR_SUBSCRIPTION_LIMIT: '250'
      };

      const config = NostrConfig.fromEnv(env);
      expect(config.timeoutMs).toBe(25000);
      expect(config.publishTimeoutMs).toBe(10000);
      expect(config.subscriptionLimit).toBe(250);
    });

    it('falls back to defaults when optional env vars are whitespace', () => {
      const env = {
        NOSTR_PRIVATE_KEY: validPrivateKey,
        NOSTR_RELAYS: validRelaysString,
        NOSTR_TIMEOUT_MS: '  ',
        NOSTR_PUBLISH_TIMEOUT_MS: '  ',
        NOSTR_SUBSCRIPTION_LIMIT: '  '
      };

      const config = NostrConfig.fromEnv(env);
      expect(config.timeoutMs).toBe(15000);
      expect(config.publishTimeoutMs).toBe(5000);
      expect(config.subscriptionLimit).toBe(500);
    });

    it('throws NostrConfigError when NOSTR_PRIVATE_KEY is missing in env', () => {
      try {
        NostrConfig.fromEnv({
          NOSTR_RELAYS: validRelaysString
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['variable']).toBe('NOSTR_PRIVATE_KEY');
        expect(configErr.context['field']).toBe('NOSTR_PRIVATE_KEY');
      }
    });

    it('throws NostrConfigError when NOSTR_PRIVATE_KEY is malformed in env', () => {
      try {
        NostrConfig.fromEnv({
          NOSTR_PRIVATE_KEY: 'not-a-valid-key',
          NOSTR_RELAYS: validRelaysString
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['variable']).toBe('NOSTR_PRIVATE_KEY');
        expect(configErr.context['field']).toBe('NOSTR_PRIVATE_KEY');
      }
    });

    it('throws NostrConfigError when NOSTR_RELAYS is missing in env', () => {
      try {
        NostrConfig.fromEnv({
          NOSTR_PRIVATE_KEY: validPrivateKey
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['variable']).toBe('NOSTR_RELAYS');
        expect(configErr.context['field']).toBe('NOSTR_RELAYS');
      }
    });

    it('throws NostrConfigError when NOSTR_RELAYS is empty in env', () => {
      try {
        NostrConfig.fromEnv({
          NOSTR_PRIVATE_KEY: validPrivateKey,
          NOSTR_RELAYS: '   '
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['variable']).toBe('NOSTR_RELAYS');
        expect(configErr.context['field']).toBe('NOSTR_RELAYS');
      }
    });

    it('throws NostrConfigError when NOSTR_RELAYS contains non-wss URL in env', () => {
      try {
        NostrConfig.fromEnv({
          NOSTR_PRIVATE_KEY: validPrivateKey,
          NOSTR_RELAYS: 'ws://insecure-relay.com'
        });
        fail('Expected NostrConfigError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(NostrConfigError);
        const configErr = err as NostrConfigError;
        expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
        expect(configErr.context['variable']).toBe('NOSTR_RELAYS');
        expect(configErr.context['field']).toBe('NOSTR_RELAYS');
      }
    });

    it('throws NostrConfigError when NOSTR_TIMEOUT_MS is invalid in env', () => {
      const invalidValues = ['abc', '0', '-500', '12.5'];
      for (const invalid of invalidValues) {
        try {
          NostrConfig.fromEnv({
            NOSTR_PRIVATE_KEY: validPrivateKey,
            NOSTR_RELAYS: validRelaysString,
            NOSTR_TIMEOUT_MS: invalid
          });
          fail(`Expected error for timeout: ${invalid}`);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(NostrConfigError);
          const configErr = err as NostrConfigError;
          expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
          expect(configErr.context['variable']).toBe('NOSTR_TIMEOUT_MS');
          expect(configErr.context['field']).toBe('NOSTR_TIMEOUT_MS');
        }
      }
    });

    it('throws NostrConfigError when NOSTR_PUBLISH_TIMEOUT_MS is invalid in env', () => {
      const invalidValues = ['abc', '0', '-500', '12.5'];
      for (const invalid of invalidValues) {
        try {
          NostrConfig.fromEnv({
            NOSTR_PRIVATE_KEY: validPrivateKey,
            NOSTR_RELAYS: validRelaysString,
            NOSTR_PUBLISH_TIMEOUT_MS: invalid
          });
          fail(`Expected error for publish timeout: ${invalid}`);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(NostrConfigError);
          const configErr = err as NostrConfigError;
          expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
          expect(configErr.context['variable']).toBe('NOSTR_PUBLISH_TIMEOUT_MS');
          expect(configErr.context['field']).toBe('NOSTR_PUBLISH_TIMEOUT_MS');
        }
      }
    });

    it('throws NostrConfigError when NOSTR_SUBSCRIPTION_LIMIT is invalid in env', () => {
      const invalidValues = ['abc', '0', '-500', '12.5'];
      for (const invalid of invalidValues) {
        try {
          NostrConfig.fromEnv({
            NOSTR_PRIVATE_KEY: validPrivateKey,
            NOSTR_RELAYS: validRelaysString,
            NOSTR_SUBSCRIPTION_LIMIT: invalid
          });
          fail(`Expected error for subscription limit: ${invalid}`);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(NostrConfigError);
          const configErr = err as NostrConfigError;
          expect(configErr.code).toBe('NOSTR_CONFIG_ERROR');
          expect(configErr.context['variable']).toBe('NOSTR_SUBSCRIPTION_LIMIT');
          expect(configErr.context['field']).toBe('NOSTR_SUBSCRIPTION_LIMIT');
        }
      }
    });
  });
});
