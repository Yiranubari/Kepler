export {
  BitcoinClient
} from './client';

export {
  BitcoinConfig
} from './config';

export type {
  BitcoinNetwork,
  BitcoinConfigParams
} from './config';

export {
  BitcoinConfigError,
  BitcoinNetworkError,
  BitcoinNotFoundError,
  BitcoinInvalidResponseError,
  BitcoinParseError,
  BitcoinBroadcastError,
  BitcoinFeeError
} from './errors';

export type {
  BitcoinConfigErrorContext,
  BitcoinNetworkErrorContext,
  BitcoinNotFoundErrorContext,
  BitcoinInvalidResponseErrorContext,
  BitcoinParseErrorContext,
  BitcoinBroadcastErrorContext,
  BitcoinFeeErrorContext
} from './errors';

export type {
  BitcoinScriptType,
  BitcoinOutput,
  BitcoinInput,
  BitcoinTransaction,
  BitcoinAddressInfo,
  BitcoinBlockTip,
  Utxo,
  RecommendedFees,
  BroadcastResult
} from './types';

export {
  EsploraTxStatusSchema,
  EsploraTxOutputSchema,
  EsploraTxInputSchema,
  EsploraTxSchema,
  EsploraAddressStatsSchema,
  EsploraAddressInfoSchema,
  EsploraBlockSchema,
  EsploraBlocksResponseSchema,
  MempoolUtxoResponseSchema,
  MempoolFeesResponseSchema
} from './types';
