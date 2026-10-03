export type SupportedNetwork = 'mainnet' | 'testnet' | 'testnet4' | 'signet' | 'regtest';

export interface AppConfig {
  readonly id: string;
  readonly network: SupportedNetwork;
  readonly updatedAt: Date;
}

export interface UpdateNetworkRequest {
  readonly network: SupportedNetwork;
}

export interface AppConfigResponse {
  readonly network: SupportedNetwork;
  readonly updatedAt: string;
}
