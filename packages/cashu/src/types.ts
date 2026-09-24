import { z } from 'zod';

export interface CashuMintInfo {
  readonly url: string;
  readonly name: string;
  readonly version: string;
  readonly nuts: Record<string, unknown>;
  readonly supportsMint: boolean;
  readonly supportsMelt: boolean;
  readonly supportsSwap: boolean;
  readonly supportsRestore: boolean;
}

export interface CashuProof {
  readonly id: string;
  readonly amount: bigint;
  readonly secret: string;
  readonly C: string;
  readonly witness: string | null;
}

export interface CashuToken {
  readonly mint: string;
  readonly unit: string;
  readonly proofs: CashuProof[];
  readonly memo: string | null;
}

export type CashuMintQuoteState = 'unpaid' | 'paid' | 'issued' | 'expired';

export interface CashuMintQuote {
  readonly quote: string;
  readonly request: string;
  readonly amount: bigint;
  readonly unit: string;
  readonly state: CashuMintQuoteState;
  readonly expiry: number | null;
}

export type CashuMeltQuoteState = 'unpaid' | 'paid' | 'pending' | 'expired';

export interface CashuMeltQuote {
  readonly quote: string;
  readonly request: string;
  readonly amount: bigint;
  readonly feeReserve: bigint;
  readonly state: CashuMeltQuoteState;
  readonly expiry: number | null;
  readonly paymentPreimage: string | null;
}

export interface CashuMintResult {
  readonly quote: string;
  readonly token: CashuToken;
  readonly request?: string;
}

export interface CashuMeltResult {
  readonly quote: string;
  readonly amount: bigint;
  readonly feePaid: bigint;
  readonly paymentPreimage: string | null;
}

export interface CashuSwapResult {
  readonly token: CashuToken;
}

export interface CashuBalance {
  readonly total: bigint;
  readonly byMint: Record<string, bigint>;
}

export const CashuWireProofSchema = z.object({
  id: z.string().min(1),
  amount: z.union([
    z.number().int().nonnegative(),
    z.bigint().nonnegative(),
    z.string().regex(/^\d+$/)
  ]),
  secret: z.string().min(1),
  C: z.string().min(1),
  witness: z.string().nullable().optional()
});

export const CashuWireTokenSchema = z.object({
  mint: z.string().min(1),
  proofs: z.array(CashuWireProofSchema),
  unit: z.string().optional().default('sat'),
  memo: z.string().nullable().optional()
});

export const CashuWireMintInfoSchema = z.object({
  name: z.string().optional().default(''),
  version: z.string().optional().default(''),
  nuts: z.record(z.unknown()).optional().default({}),
  pubkey: z.string().optional(),
  description: z.string().optional(),
  description_long: z.string().optional(),
  contact: z.unknown().optional(),
  motd: z.string().optional()
});

export const CashuWireMintQuoteSchema = z.object({
  quote: z.string().min(1),
  request: z.string().min(1),
  amount: z.union([
    z.number().int().nonnegative(),
    z.bigint().nonnegative(),
    z.string().regex(/^\d+$/)
  ]).optional(),
  unit: z.string().optional(),
  state: z.string().optional(),
  expiry: z.number().int().nonnegative().nullable().optional(),
  paid: z.boolean().optional()
});

export const CashuWireMeltQuoteSchema = z.object({
  quote: z.string().min(1),
  request: z.string().min(1),
  amount: z.union([
    z.number().int().nonnegative(),
    z.bigint().nonnegative(),
    z.string().regex(/^\d+$/)
  ]),
  fee_reserve: z.union([
    z.number().int().nonnegative(),
    z.bigint().nonnegative(),
    z.string().regex(/^\d+$/)
  ]).optional().default(0),
  state: z.string().optional(),
  expiry: z.number().int().nonnegative().nullable().optional(),
  payment_preimage: z.string().nullable().optional(),
  paid: z.boolean().optional()
});

export const CashuProofSchema = z.object({
  id: z.string().min(1),
  amount: z.bigint().nonnegative(),
  secret: z.string().min(1),
  C: z.string().min(1),
  witness: z.string().nullable()
});

export const CashuTokenSchema = z.object({
  mint: z.string().url(),
  unit: z.string().min(1),
  proofs: z.array(CashuProofSchema),
  memo: z.string().nullable()
});

export const CashuMintInfoSchema = z.object({
  url: z.string().url(),
  name: z.string(),
  version: z.string(),
  nuts: z.record(z.unknown()),
  supportsMint: z.boolean(),
  supportsMelt: z.boolean(),
  supportsSwap: z.boolean(),
  supportsRestore: z.boolean()
});

export const CashuMintQuoteStateSchema = z.enum(['unpaid', 'paid', 'issued', 'expired']);

export const CashuMintQuoteSchema = z.object({
  quote: z.string().min(1),
  request: z.string().min(1),
  amount: z.bigint().nonnegative(),
  unit: z.string().min(1),
  state: CashuMintQuoteStateSchema,
  expiry: z.number().int().nonnegative().nullable()
});

export const CashuMeltQuoteStateSchema = z.enum(['unpaid', 'paid', 'pending', 'expired']);

export const CashuMeltQuoteSchema = z.object({
  quote: z.string().min(1),
  request: z.string().min(1),
  amount: z.bigint().nonnegative(),
  feeReserve: z.bigint().nonnegative(),
  state: CashuMeltQuoteStateSchema,
  expiry: z.number().int().nonnegative().nullable(),
  paymentPreimage: z.string().nullable()
});

export const CashuMintResultSchema = z.object({
  quote: z.string().min(1),
  token: CashuTokenSchema,
  request: z.string().optional()
});

export const CashuMeltResultSchema = z.object({
  quote: z.string().min(1),
  amount: z.bigint().nonnegative(),
  feePaid: z.bigint().nonnegative(),
  paymentPreimage: z.string().nullable()
});

export const CashuSwapResultSchema = z.object({
  token: CashuTokenSchema
});

export const CashuBalanceSchema = z.object({
  total: z.bigint().nonnegative(),
  byMint: z.record(z.bigint().nonnegative())
});

export type CashuWireProof = z.infer<typeof CashuWireProofSchema>;
export type CashuWireToken = z.infer<typeof CashuWireTokenSchema>;
export type CashuWireMintInfo = z.infer<typeof CashuWireMintInfoSchema>;
export type CashuWireMintQuote = z.infer<typeof CashuWireMintQuoteSchema>;
export type CashuWireMeltQuote = z.infer<typeof CashuWireMeltQuoteSchema>;
