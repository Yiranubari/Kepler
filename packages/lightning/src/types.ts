import { z } from 'zod';

export type LightningPaymentStatus = 'pending' | 'succeeded' | 'failed';

export type LightningTransactionType = 'incoming' | 'outgoing';

export type NWCNetwork = 'mainnet' | 'testnet' | 'regtest';

export interface LightningInvoice {
  readonly bolt11: string;
  readonly paymentHash: string;
  readonly preimage: string | null;
  readonly amountMsat: bigint;
  readonly description: string;
  readonly descriptionHash: string | null;
  readonly timestamp: number;
  readonly expiry: number;
  readonly payeePubkey: string;
  readonly expiresAt: number;
}

export interface LightningPayment {
  readonly paymentHash: string;
  readonly preimage: string;
  readonly amountMsat: bigint;
  readonly feeMsat: bigint;
  readonly status: LightningPaymentStatus;
  readonly createdAt: number;
  readonly description: string;
}

export interface LightningTransaction {
  readonly type: LightningTransactionType;
  readonly invoice: string;
  readonly paymentHash: string;
  readonly preimage: string | null;
  readonly amountMsat: bigint;
  readonly feeMsat: bigint;
  readonly status: LightningPaymentStatus;
  readonly createdAt: number;
  readonly settledAt: number | null;
  readonly description: string;
}

export interface NWCWalletInfo {
  readonly alias: string;
  readonly color: string;
  readonly pubkey: string;
  readonly network: NWCNetwork;
  readonly blockHeight: number;
  readonly blockHash: string;
  readonly methods: string[];
}

export interface InvoiceCreationResult {
  readonly invoice: string;
  readonly paymentHash: string;
}

export interface PaymentResult {
  readonly paymentHash: string;
  readonly preimage: string;
  readonly feeMsat: bigint;
}

export const NWCErrorPayloadSchema = z.object({
  code: z.string().min(1),
  message: z.string()
});

export const NWCResponsePayloadSchema = z.object({
  result_type: z.string().min(1),
  error: NWCErrorPayloadSchema.nullable().optional(),
  result: z.unknown().optional()
});

export const NWCPayInvoiceResultSchema = z.object({
  preimage: z.string().min(1),
  fees_paid: z.union([z.number().int().nonnegative(), z.bigint().nonnegative(), z.string().regex(/^\d+$/)]).optional().default(0),
  payment_hash: z.string().optional()
});

export const NWCMakeInvoiceResultSchema = z.object({
  type: z.literal('incoming').optional(),
  state: z.string().optional(),
  invoice: z.string().min(1),
  description: z.string().optional(),
  description_hash: z.string().nullable().optional(),
  preimage: z.string().nullable().optional(),
  payment_hash: z.string().min(1),
  amount: z.union([z.number().int().nonnegative(), z.bigint().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  fees_paid: z.union([z.number().int().nonnegative(), z.bigint().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  created_at: z.number().int().nonnegative().optional(),
  expires_at: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const NWCLookupInvoiceResultSchema = z.object({
  type: z.enum(['incoming', 'outgoing']).optional(),
  state: z.string().optional(),
  invoice: z.string().optional(),
  description: z.string().optional(),
  description_hash: z.string().nullable().optional(),
  preimage: z.string().nullable().optional(),
  payment_hash: z.string().min(1),
  amount: z.union([z.number().int().nonnegative(), z.bigint().nonnegative(), z.string().regex(/^\d+$/)]),
  fees_paid: z.union([z.number().int().nonnegative(), z.bigint().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  created_at: z.number().int().nonnegative(),
  expires_at: z.number().int().nonnegative().nullable().optional(),
  settled_at: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const NWCGetBalanceResultSchema = z.object({
  balance: z.union([z.number().int().nonnegative(), z.bigint().nonnegative(), z.string().regex(/^\d+$/)])
});

export const NWCGetInfoResultSchema = z.object({
  alias: z.string().optional().default(''),
  color: z.string().optional().default(''),
  pubkey: z.string().min(1),
  network: z.string().min(1),
  block_height: z.number().int().nonnegative().optional().default(0),
  block_hash: z.string().optional().default(''),
  methods: z.array(z.string()).default([]),
  extensions: z.array(z.string()).optional()
});

export const NWCTransactionItemSchema = z.object({
  type: z.enum(['incoming', 'outgoing']),
  state: z.string().optional(),
  invoice: z.string().optional().default(''),
  description: z.string().optional().default(''),
  description_hash: z.string().nullable().optional(),
  preimage: z.string().nullable().optional(),
  payment_hash: z.string().min(1),
  amount: z.union([z.number().int().nonnegative(), z.bigint().nonnegative(), z.string().regex(/^\d+$/)]),
  fees_paid: z.union([z.number().int().nonnegative(), z.bigint().nonnegative(), z.string().regex(/^\d+$/)]).optional().default(0),
  created_at: z.number().int().nonnegative(),
  expires_at: z.number().int().nonnegative().nullable().optional(),
  settled_at: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const NWCListTransactionsResultSchema = z.object({
  transactions: z.array(NWCTransactionItemSchema),
  total_count: z.number().int().nonnegative().optional()
});

export type NWCErrorPayload = z.infer<typeof NWCErrorPayloadSchema>;
export type NWCResponsePayload = z.infer<typeof NWCResponsePayloadSchema>;
export type NWCPayInvoiceResult = z.infer<typeof NWCPayInvoiceResultSchema>;
export type NWCMakeInvoiceResult = z.infer<typeof NWCMakeInvoiceResultSchema>;
export type NWCLookupInvoiceResult = z.infer<typeof NWCLookupInvoiceResultSchema>;
export type NWCGetBalanceResult = z.infer<typeof NWCGetBalanceResultSchema>;
export type NWCGetInfoResult = z.infer<typeof NWCGetInfoResultSchema>;
export type NWCTransactionItem = z.infer<typeof NWCTransactionItemSchema>;
export type NWCListTransactionsResult = z.infer<typeof NWCListTransactionsResultSchema>;
