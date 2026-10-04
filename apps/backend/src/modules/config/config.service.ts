import { BitcoinConfig } from '@kepler/bitcoin';
import type { KeplerLogger } from '@kepler/shared';
import { ConfigRepository } from './config.repository';
import { AppConfig, SupportedNetwork } from './config.types';
import { ConfigNetworkInvalidError } from './config.errors';
import { SupportedNetworkSchema, SUPPORTED_NETWORKS } from './config.validators';

export class ConfigService {
  private readonly repository: ConfigRepository;
  private readonly bitcoinConfig: BitcoinConfig;
  private readonly logger: KeplerLogger;

  public constructor(
    repository: ConfigRepository,
    bitcoinConfig: BitcoinConfig,
    logger: KeplerLogger
  ) {
    this.repository = repository;
    this.bitcoinConfig = bitcoinConfig;
    this.logger = logger;
  }

  public async initialize(): Promise<void> {
    await this.repository.ensureDefault(this.bitcoinConfig.network);
    const persisted = await this.repository.get();
    if (persisted.network !== this.bitcoinConfig.network) {
      this.syncBitcoinConfig(persisted.network);
    }
  }

  public async get(): Promise<AppConfig> {
    return this.repository.get();
  }

  public async setNetwork(network: SupportedNetwork): Promise<AppConfig> {
    const validationResult = SupportedNetworkSchema.safeParse(network);
    if (!validationResult.success) {
      throw new ConfigNetworkInvalidError(
        'The specified network is not supported. Use a supported Bitcoin network and try again.',
        {
          value: String(network),
          allowed: SUPPORTED_NETWORKS
        }
      );
    }

    const validatedNetwork = validationResult.data;
    const from = this.bitcoinConfig.network;

    this.bitcoinConfig.setNetwork(validatedNetwork);

    try {
      const updated = await this.repository.updateNetwork(validatedNetwork);
      this.logger.info('Network configuration changed', { from, to: validatedNetwork });
      return updated;
    } catch (err) {
      this.bitcoinConfig.setNetwork(from);
      throw err;
    }
  }

  private syncBitcoinConfig(network: SupportedNetwork): void {
    this.bitcoinConfig.setNetwork(network);
  }
}
