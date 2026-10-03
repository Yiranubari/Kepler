import { BitcoinConfig } from '@kepler/bitcoin';
import type { KeplerLogger } from '@kepler/shared';
import { ConfigService } from '../../src/modules/config/config.service';
import { ConfigRepository } from '../../src/modules/config/config.repository';
import { ConfigNetworkInvalidError } from '../../src/modules/config/config.errors';
import { AppConfig, SupportedNetwork } from '../../src/modules/config/config.types';

describe('ConfigService', () => {
  let mockRepo: jest.Mocked<ConfigRepository>;
  let bitcoinConfig: BitcoinConfig;
  let mockLogger: jest.Mocked<KeplerLogger>;
  let service: ConfigService;

  beforeEach(() => {
    bitcoinConfig = new BitcoinConfig({
      primaryUrl: 'https://blockstream.info/api',
      fallbackUrl: 'https://mempool.space/api',
      network: 'mainnet'
    });

    mockRepo = {
      get: jest.fn(),
      ensureDefault: jest.fn(),
      updateNetwork: jest.fn()
    } as unknown as jest.Mocked<ConfigRepository>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as unknown as jest.Mocked<KeplerLogger>;

    service = new ConfigService(mockRepo, bitcoinConfig, mockLogger);
  });

  describe('initialize', () => {
    it('seeds default and syncs bitcoinConfig when persisted differs', async () => {
      const persistedConfig: AppConfig = {
        id: 'default',
        network: 'testnet4',
        updatedAt: new Date()
      };

      mockRepo.ensureDefault.mockResolvedValue(persistedConfig);
      mockRepo.get.mockResolvedValue(persistedConfig);

      await service.initialize();

      expect(mockRepo.ensureDefault).toHaveBeenCalledWith('mainnet');
      expect(bitcoinConfig.network).toBe('testnet4');
    });

    it('keeps bitcoinConfig when persisted matches', async () => {
      const persistedConfig: AppConfig = {
        id: 'default',
        network: 'mainnet',
        updatedAt: new Date()
      };

      mockRepo.ensureDefault.mockResolvedValue(persistedConfig);
      mockRepo.get.mockResolvedValue(persistedConfig);

      await service.initialize();

      expect(mockRepo.ensureDefault).toHaveBeenCalledWith('mainnet');
      expect(bitcoinConfig.network).toBe('mainnet');
    });
  });

  describe('get', () => {
    it('delegates to repository.get', async () => {
      const persistedConfig: AppConfig = {
        id: 'default',
        network: 'mainnet',
        updatedAt: new Date()
      };

      mockRepo.get.mockResolvedValue(persistedConfig);

      const result = await service.get();
      expect(result).toEqual(persistedConfig);
      expect(mockRepo.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('setNetwork', () => {
    it('validates, updates repository, updates bitcoinConfig, and logs change', async () => {
      const updatedConfig: AppConfig = {
        id: 'default',
        network: 'testnet4',
        updatedAt: new Date()
      };

      mockRepo.updateNetwork.mockResolvedValue(updatedConfig);

      const result = await service.setNetwork('testnet4');

      expect(mockRepo.updateNetwork).toHaveBeenCalledWith('testnet4');
      expect(bitcoinConfig.network).toBe('testnet4');
      expect(mockLogger.info).toHaveBeenCalledWith('Network configuration changed', {
        from: 'mainnet',
        to: 'testnet4'
      });
      expect(result).toEqual(updatedConfig);
    });

    it('throws ConfigNetworkInvalidError on invalid network value', async () => {
      await expect(
        service.setNetwork('invalid_network' as unknown as SupportedNetwork)
      ).rejects.toThrow(ConfigNetworkInvalidError);

      expect(mockRepo.updateNetwork).not.toHaveBeenCalled();
      expect(bitcoinConfig.network).toBe('mainnet');
    });
  });
});
