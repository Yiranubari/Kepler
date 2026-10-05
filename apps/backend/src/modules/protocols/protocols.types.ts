import type {
  BitcoinClient,
  BitcoinTransaction,
  BitcoinAddressInfo,
  BitcoinBlockTip
} from '@kepler/bitcoin';
import type {
  LightningClient,
  LightningInvoice,
  LightningPayment,
  LightningTransaction
} from '@kepler/lightning';
import type {
  NostrClient,
  NostrEvent
} from '@kepler/nostr';
import type {
  CashuClient,
  CashuMintInfo
} from '@kepler/cashu';

export interface ProtocolsConfig {
  bitcoinClient: BitcoinClient;
  lightningClient: LightningClient;
  nostrClient: NostrClient;
  cashuClient: CashuClient;
}

export interface ProtocolBalanceResult {
  readonly connected: boolean;
  readonly balanceSats: string | null;
  readonly error: string | null;
}

export interface ProtocolsBalanceResult {
  readonly bitcoin: ProtocolBalanceResult;
  readonly lightning: ProtocolBalanceResult;
  readonly cashu: ProtocolBalanceResult;
}

export interface OperationLogContext {
  protocol: 'bitcoin' | 'lightning' | 'nostr' | 'cashu';
  operation: string;
  durationMs: number;
  [key: string]: unknown;
}

export type {
  BitcoinClient,
  BitcoinTransaction,
  BitcoinAddressInfo,
  BitcoinBlockTip,
  LightningClient,
  LightningInvoice,
  LightningPayment,
  LightningTransaction,
  NostrClient,
  NostrEvent,
  CashuClient,
  CashuMintInfo
};
