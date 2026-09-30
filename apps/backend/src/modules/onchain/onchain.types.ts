export type SupportedNetwork = 'mainnet' | 'testnet' | 'testnet4' | 'signet' | 'regtest';

export interface DeriveRequest {
  readonly xpub: string;
  readonly network: SupportedNetwork;
  readonly count: number;
  readonly change?: boolean;
}

export interface DeriveResponse {
  readonly addresses: string[];
  readonly changeAddress: string;
}

export interface UtxosRequest {
  readonly addresses: string[];
  readonly network: SupportedNetwork;
}

export interface OnchainUtxoItem {
  readonly txid: string;
  readonly vout: number;
  readonly valueSats: string;
  readonly address: string;
  readonly confirmed: boolean;
}

export interface UtxosResponse {
  readonly utxos: OnchainUtxoItem[];
  readonly totalSats: string;
}

export interface FeesRequest {
  readonly network: SupportedNetwork;
}

export interface FeesResponse {
  readonly fastest: number;
  readonly halfHour: number;
  readonly hour: number;
  readonly economy: number;
  readonly minimum: number;
}

export interface PsbtBuildRequest {
  readonly xpub: string;
  readonly network: SupportedNetwork;
  readonly toAddress: string;
  readonly amountSats: string;
  readonly feeRate: number;
  readonly changeAddress?: string;
}

export interface PsbtBuildResponse {
  readonly psbt: string;
  readonly feeSats: string;
  readonly inputCount: number;
  readonly outputCount: number;
}

export interface PsbtBroadcastRequest {
  readonly signedPsbt: string;
  readonly network: SupportedNetwork;
}

export interface PsbtBroadcastResponse {
  readonly txid: string;
}
