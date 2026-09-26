import { z } from 'zod';

export const IdentifierString = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
    message: 'Identifier must not contain control characters'
  });

export const bitcoinTransactionInputSchema = z.object({
  txid: IdentifierString,
  vout: z.number().int().nonnegative(),
  address: IdentifierString.nullable()
});

export const bitcoinTransactionOutputSchema = z.object({
  address: IdentifierString.nullable(),
  value: z.union([
    z.bigint(),
    z.number().int().nonnegative().transform((val) => BigInt(val))
  ])
});

export const bitcoinTransactionSchema = z.object({
  txid: IdentifierString,
  blockHeight: z.number().int().nullable(),
  blockTime: z.number().int().nullable(),
  inputs: z.array(bitcoinTransactionInputSchema),
  outputs: z.array(bitcoinTransactionOutputSchema)
});

export const bitcoinAddressSchema = z.object({
  address: IdentifierString
});

export const bitcoinIngestSchema = z.object({
  transactions: z.array(bitcoinTransactionSchema),
  addresses: z.array(bitcoinAddressSchema)
});

export const lightningInvoiceSchema = z.object({
  bolt11: z.string().min(1),
  paymentHash: IdentifierString,
  preimage: IdentifierString.nullable(),
  amountMsat: z.union([
    z.bigint(),
    z.number().int().nonnegative().transform((val) => BigInt(val))
  ]),
  createdAt: z.number(),
  expiresAt: z.number(),
  payeePubkey: IdentifierString
});

export const lightningIngestSchema = z.object({
  invoices: z.array(lightningInvoiceSchema)
});

export const nostrEventSchema = z.object({
  id: IdentifierString,
  pubkey: IdentifierString,
  kind: z.number().int(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  createdAt: z.number()
});

export const nostrIngestSchema = z.object({
  events: z.array(nostrEventSchema)
});

export const cashuMintSchema = z.object({
  url: IdentifierString,
  name: z.string()
});

export const cashuProofSchema = z.object({
  id: IdentifierString,
  amount: z.union([
    z.bigint(),
    z.number().int().nonnegative().transform((val) => BigInt(val))
  ]),
  secret: z.string().min(1),
  C: IdentifierString
});

export const cashuTokenSchema = z.object({
  mint: IdentifierString,
  unit: z.string(),
  proofs: z.array(cashuProofSchema),
  memo: z.string().nullable()
});

export const cashuQuoteSchema = z.object({
  quote: IdentifierString,
  type: z.enum(['mint', 'melt']),
  amount: z.union([
    z.bigint(),
    z.number().int().nonnegative().transform((val) => BigInt(val))
  ]),
  request: z.string(),
  state: z.string()
});

export const cashuIngestSchema = z.object({
  mints: z.array(cashuMintSchema),
  tokens: z.array(cashuTokenSchema),
  quotes: z.array(cashuQuoteSchema)
});

export const TaintIngestPayloadSchema = z.object({
  bitcoin: bitcoinIngestSchema.optional(),
  lightning: lightningIngestSchema.optional(),
  nostr: nostrIngestSchema.optional(),
  cashu: cashuIngestSchema.optional()
});

export const AnalyzeRequestSchema = z.object({
  scenarioId: IdentifierString,
  ingestData: TaintIngestPayloadSchema.optional(),
  bitcoin: bitcoinIngestSchema.optional(),
  lightning: lightningIngestSchema.optional(),
  nostr: nostrIngestSchema.optional(),
  cashu: cashuIngestSchema.optional()
});

export const GraphResponseSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  nodes: z.array(z.record(z.unknown())),
  edges: z.array(z.record(z.unknown())),
  paths: z.array(z.record(z.unknown())),
  createdAt: z.union([z.string(), z.date().transform((d) => d.toISOString())])
});

export const AnalyzeResponseSchema = z.object({
  graph: GraphResponseSchema,
  scenarioId: z.string(),
  analyzedAt: z.string(),
  ruleCount: z.number(),
  nodeCount: z.number(),
  edgeCount: z.number(),
  pathCount: z.number()
});

export const FindPathsRequestSchema = z.object({
  scenarioId: IdentifierString,
  fromNodeId: IdentifierString,
  toNodeId: IdentifierString,
  maxPaths: z.number().int().positive().optional()
});

export const EvidencePathSchema = z.object({
  nodes: z.array(z.string()),
  edges: z.array(z.string()),
  overallConfidence: z.number()
});

export const FindPathsResponseSchema = z.union([
  z.object({
    paths: z.array(EvidencePathSchema)
  }),
  z.array(EvidencePathSchema)
]);
