import { z } from 'zod';
import { base64 } from '@scure/base';
import { IdentifierString } from '../../shared/identifierString';
export { IdentifierString };
import type { SupportedNetwork } from './onchain.types';



export const SupportedNetworkSchema = z.enum([
  'mainnet',
  'testnet',
  'testnet4',
  'signet',
  'regtest'
]);

export const XpubSchema = z
  .string()
  .min(100)
  .max(130)
  .regex(/^[xyztuv]pub[1-9A-HJ-NP-Za-km-z]{100,120}$/, {
    message: 'Invalid xpub format'
  })
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
    message: 'xpub must not contain control characters'
  });

export const BitcoinAddressSchema = z
  .string()
  .min(14)
  .max(120)
  .regex(/^(bc1|tb1|bcrt1|[13mn2])[a-zA-HJ-NP-Z0-9]+$/, {
    message: 'Invalid Bitcoin address format'
  })
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
    message: 'Address must not contain control characters'
  });

export const AmountSatsSchema = z
  .string()
  .regex(/^[0-9]+$/, {
    message: 'amountSats must match ^[0-9]+$'
  })
  .refine((val) => {
    try {
      return BigInt(val) > 0n;
    } catch {
      return false;
    }
  }, {
    message: 'amountSats must be greater than 0'
  });

export const FeeRateSchema = z
  .number()
  .int()
  .min(1)
  .max(1000);

export const CountSchema = z
  .number()
  .int()
  .min(1)
  .max(100);

export const PsbtStringSchema = z
  .string()
  .min(1)
  .refine((val) => !/[\u0000-\u001F\u007F]/.test(val), {
    message: 'PSBT must not contain control characters'
  })
  .refine((val) => {
    if (val.length % 4 !== 0) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(val)) return false;
    try {
      base64.decode(val);
      return true;
    } catch {
      return false;
    }
  }, {
    message: 'Must be a valid base64 string'
  });

export function isValidXpubForNetwork(xpub: string, network: SupportedNetwork): boolean {
  if (network === 'mainnet') {
    return /^[xyz]pub[1-9A-HJ-NP-Za-km-z]{100,120}$/.test(xpub);
  }
  return /^[tuv]pub[1-9A-HJ-NP-Za-km-z]{100,120}$/.test(xpub);
}

export function isValidAddressForNetwork(address: string, network: SupportedNetwork): boolean {
  if (network === 'mainnet') {
    return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{14,90}$/.test(address);
  }
  if (network === 'regtest') {
    return /^(bcrt1|[mn2])[a-zA-HJ-NP-Z0-9]{14,90}$/.test(address);
  }
  return /^(tb1|[mn2])[a-zA-HJ-NP-Z0-9]{14,90}$/.test(address);
}

export const DeriveRequestSchema = z
  .object({
    xpub: IdentifierString,
    network: SupportedNetworkSchema,
    count: CountSchema,
    change: z.boolean().optional()
  })
  .strict();

export const DeriveResponseSchema = z
  .object({
    addresses: z.array(BitcoinAddressSchema),
    changeAddress: BitcoinAddressSchema
  })
  .strict();

export const UtxosRequestSchema = z
  .object({
    addresses: z.array(BitcoinAddressSchema).min(1),
    network: SupportedNetworkSchema
  })
  .strict()
  .superRefine((data, ctx) => {
    for (let i = 0; i < data.addresses.length; i++) {
      if (!isValidAddressForNetwork(data.addresses[i], data.network)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Address ${data.addresses[i]} does not match network ${data.network}`,
          path: ['addresses', i]
        });
      }
    }
  });

export const OnchainUtxoItemSchema = z
  .object({
    txid: z.string().regex(/^[0-9a-fA-F]{64}$/, {
      message: 'Invalid txid hex'
    }),
    vout: z.number().int().nonnegative(),
    valueSats: z.string().regex(/^[0-9]+$/),
    address: BitcoinAddressSchema,
    confirmed: z.boolean()
  })
  .strict();

export const UtxosResponseSchema = z
  .object({
    utxos: z.array(OnchainUtxoItemSchema),
    totalSats: z.string().regex(/^[0-9]+$/)
  })
  .strict();

export const FeesRequestSchema = z
  .object({
    network: SupportedNetworkSchema
  })
  .strict();

export const FeesResponseSchema = z
  .object({
    fastest: z.number().int().nonnegative(),
    halfHour: z.number().int().nonnegative(),
    hour: z.number().int().nonnegative(),
    economy: z.number().int().nonnegative(),
    minimum: z.number().int().nonnegative()
  })
  .strict();

export const PsbtBuildRequestSchema = z
  .object({
    xpub: IdentifierString,
    network: SupportedNetworkSchema,
    toAddress: BitcoinAddressSchema,
    amountSats: AmountSatsSchema,
    feeRate: FeeRateSchema,
    changeAddress: BitcoinAddressSchema.optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!isValidAddressForNetwork(data.toAddress, data.network)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `toAddress does not match network ${data.network}`,
        path: ['toAddress']
      });
    }
    if (data.changeAddress && !isValidAddressForNetwork(data.changeAddress, data.network)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `changeAddress does not match network ${data.network}`,
        path: ['changeAddress']
      });
    }
  });

export const PsbtBuildResponseSchema = z
  .object({
    psbt: PsbtStringSchema,
    feeSats: z.string().regex(/^[0-9]+$/),
    inputCount: z.number().int().positive(),
    outputCount: z.number().int().positive()
  })
  .strict();

export const PsbtBroadcastRequestSchema = z
  .object({
    signedPsbt: PsbtStringSchema,
    network: SupportedNetworkSchema
  })
  .strict();

export const PsbtBroadcastResponseSchema = z
  .object({
    txid: z.string().regex(/^[0-9a-fA-F]{64}$/, {
      message: 'Invalid txid hex'
    })
  })
  .strict();

export type DeriveRequestInput = z.infer<typeof DeriveRequestSchema>;
export type DeriveResponseOutput = z.infer<typeof DeriveResponseSchema>;
export type UtxosRequestInput = z.infer<typeof UtxosRequestSchema>;
export type UtxosResponseOutput = z.infer<typeof UtxosResponseSchema>;
export type FeesRequestInput = z.infer<typeof FeesRequestSchema>;
export type FeesResponseOutput = z.infer<typeof FeesResponseSchema>;
export type PsbtBuildRequestInput = z.infer<typeof PsbtBuildRequestSchema>;
export type PsbtBuildResponseOutput = z.infer<typeof PsbtBuildResponseSchema>;
export type PsbtBroadcastRequestInput = z.infer<typeof PsbtBroadcastRequestSchema>;
export type PsbtBroadcastResponseOutput = z.infer<typeof PsbtBroadcastResponseSchema>;
