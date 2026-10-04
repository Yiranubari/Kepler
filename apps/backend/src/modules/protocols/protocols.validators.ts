import { z } from 'zod';
import { IdentifierString } from '../../shared/identifierString';
export { IdentifierString };

export const BitcoinTxRequestSchema = z.object({
  txid: IdentifierString.refine(
    (value) => /^[0-9a-f]{64}$/.test(value),
    { message: 'txid must be a 64-character lowercase hex string' }
  )
});

export const BitcoinAddressRequestSchema = z.object({
  address: IdentifierString.refine(
    (value) => /^(bc1|1|3|tb1|m|n|2|bcrt1)[a-zA-HJ-NP-Z0-9]+$/.test(value),
    { message: 'Invalid Bitcoin address' }
  )
});

export const LightningDecodeRequestSchema = z.object({
  invoice: z
    .string()
    .min(1)
    .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
      message: 'Identifier must not contain control characters'
    })
    .refine(
      (value) => /^(lnbc|lntb|lnbcrt)/i.test(value),
      { message: 'Invoice must start with lnbc, lntb, or lnbcrt' }
    )
});

export const LightningLookupRequestSchema = z.object({
  paymentHash: IdentifierString.refine(
    (value) => /^[0-9a-f]{64}$/.test(value),
    { message: 'paymentHash must be a 64-character lowercase hex string' }
  )
});

export const LightningListRequestSchema = z.object({
  limit: z.coerce.number().int().positive().max(50)
});

export const LightningCreateRequestSchema = z.object({
  amountSats: z.coerce.number().int().positive(),
  memo: z.string().min(1).max(500).optional()
});

export const NostrEventRequestSchema = z.object({
  eventId: IdentifierString.refine(
    (value) => /^[0-9a-fA-F]{64}$/.test(value),
    { message: 'eventId must be a 64-character hex string' }
  )
});

export const NostrAuthorRequestSchema = z.object({
  pubkey: IdentifierString.refine(
    (value) => /^[0-9a-fA-F]{64}$/.test(value),
    { message: 'pubkey must be a 64-character hex string' }
  ),
  limit: z.coerce.number().int().min(1).max(50)
});

export const CashuMintRequestSchema = z.object({
  url: z
    .string()
    .min(1)
    .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
      message: 'Identifier must not contain control characters'
    })
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'URL must use http or https scheme' }
    )
});

export type BitcoinTxRequest = z.infer<typeof BitcoinTxRequestSchema>;
export type BitcoinAddressRequest = z.infer<typeof BitcoinAddressRequestSchema>;
export type LightningDecodeRequest = z.infer<typeof LightningDecodeRequestSchema>;
export type LightningLookupRequest = z.infer<typeof LightningLookupRequestSchema>;
export type LightningListRequest = z.infer<typeof LightningListRequestSchema>;
export type NostrEventRequest = z.infer<typeof NostrEventRequestSchema>;
export type NostrAuthorRequest = z.infer<typeof NostrAuthorRequestSchema>;
export type CashuMintRequest = z.infer<typeof CashuMintRequestSchema>;

export const LightningDecodeResponseSchema = z.object({
  bolt11: z.string(),
  paymentHash: z.string(),
  preimage: z.string().nullable(),
  amountMsat: z.string(),
  description: z.string(),
  descriptionHash: z.string().nullable(),
  timestamp: z.number().int(),
  expiry: z.number().int(),
  payeePubkey: z.string().nullable(),
  expiresAt: z.number().int()
});

export type LightningDecodeResponse = z.infer<typeof LightningDecodeResponseSchema>;
