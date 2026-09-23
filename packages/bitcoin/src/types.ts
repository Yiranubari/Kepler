import { z } from 'zod';

export type BitcoinScriptType =
  | 'p2pkh'
  | 'p2sh'
  | 'p2wpkh'
  | 'p2wsh'
  | 'p2tr'
  | 'op_return'
  | 'unknown';

export interface BitcoinOutput {
  readonly scriptpubkey: string;
  readonly scriptpubkeyAddress: string | null;
  readonly value: bigint;
}

export interface BitcoinInput {
  readonly txid: string;
  readonly vout: number;
  readonly prevout: BitcoinOutput | null;
  readonly scriptsig: string;
  readonly sequence: number;
  readonly witness: string[];
}

export interface BitcoinTransaction {
  readonly txid: string;
  readonly version: number;
  readonly locktime: number;
  readonly size: number;
  readonly weight: number;
  readonly fee: bigint | null;
  readonly status: {
    readonly confirmed: boolean | null;
    readonly blockHeight: number | null;
    readonly blockHash: string | null;
    readonly blockTime: number | null;
  };
  readonly inputs: BitcoinInput[];
  readonly outputs: BitcoinOutput[];
}

export interface BitcoinAddressInfo {
  readonly address: string;
  readonly chainStats: {
    readonly fundedTxoCount: number;
    readonly fundedTxoSum: bigint;
    readonly spentTxoCount: number;
    readonly spentTxoSum: bigint;
  };
  readonly mempoolStats: {
    readonly fundedTxoCount: number;
    readonly fundedTxoSum: bigint;
    readonly spentTxoCount: number;
    readonly spentTxoSum: bigint;
  };
}

export interface BitcoinBlockTip {
  readonly height: number;
  readonly hash: string;
  readonly timestamp: number;
}

export const EsploraTxStatusSchema = z.object({
  confirmed: z.boolean(),
  block_height: z.number().int().nonnegative().nullable().optional(),
  block_hash: z.string().nullable().optional(),
  block_time: z.number().int().nonnegative().nullable().optional()
});

export const EsploraTxOutputSchema = z.object({
  scriptpubkey: z.string(),
  scriptpubkey_address: z.string().nullable().optional(),
  value: z.number().int().nonnegative()
});

export const EsploraTxInputSchema = z.object({
  txid: z.string().min(1),
  vout: z.number().int().nonnegative(),
  prevout: EsploraTxOutputSchema.nullable().optional(),
  scriptsig: z.string(),
  sequence: z.number().int().nonnegative(),
  witness: z.array(z.string()).optional()
});

export const EsploraTxSchema = z.object({
  txid: z.string().min(1),
  version: z.number().int(),
  locktime: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  weight: z.number().int().nonnegative(),
  fee: z.number().int().nonnegative(),
  status: EsploraTxStatusSchema,
  vin: z.array(EsploraTxInputSchema),
  vout: z.array(EsploraTxOutputSchema)
});

export const EsploraAddressStatsSchema = z.object({
  funded_txo_count: z.number().int().nonnegative(),
  funded_txo_sum: z.number().int().nonnegative(),
  spent_txo_count: z.number().int().nonnegative(),
  spent_txo_sum: z.number().int().nonnegative()
});

export const EsploraAddressInfoSchema = z.object({
  address: z.string().min(1),
  chain_stats: EsploraAddressStatsSchema,
  mempool_stats: EsploraAddressStatsSchema
});

export const EsploraBlockSchema = z.object({
  id: z.string().min(1),
  height: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative()
});

export const EsploraBlocksResponseSchema = z.union([
  z.array(EsploraBlockSchema).min(1),
  EsploraBlockSchema
]);
