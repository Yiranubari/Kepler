import { z } from 'zod';
import { PolicyScope } from '@kepler/shared';

function refineNoControlCharacters(value: string): boolean {
  return !/[\u0000-\u001F\u007F]/.test(value);
}

export const IdentifierString = z
  .string()
  .min(1)
  .max(256)
  .refine(refineNoControlCharacters, {
    message: 'Identifier must not contain control characters'
  });

export const AmountSatsSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[0-9]+$/, { message: 'amountSats must be numeric digits' })
  .refine(refineNoControlCharacters, {
    message: 'Identifier must not contain control characters'
  })
  .refine(
    (val: string) => {
      try {
        return BigInt(val) > 0n;
      } catch {
        return false;
      }
    },
    { message: 'amountSats must be greater than 0' }
  );

export const BudgetSatsSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[0-9]+$/, { message: 'Budget must be numeric digits' })
  .refine(refineNoControlCharacters, {
    message: 'Identifier must not contain control characters'
  });

export const ReadCheckRequestSchema = z
  .object({
    kind: z.literal('read')
  })
  .strict();

export const ProposeCheckRequestSchema = z
  .object({
    kind: z.literal('propose')
  })
  .strict();

export const SendCheckRequestSchema = z
  .object({
    kind: z.literal('send'),
    amountSats: AmountSatsSchema,
    protocol: z.enum(['Bitcoin', 'Lightning', 'Cashu']),
    mint: IdentifierString.optional()
  })
  .strict();

export const PublishCheckRequestSchema = z
  .object({
    kind: z.literal('publish')
  })
  .strict();

export const CheckRequestSchema = z.discriminatedUnion('kind', [
  ReadCheckRequestSchema,
  ProposeCheckRequestSchema,
  SendCheckRequestSchema,
  PublishCheckRequestSchema
]);

export const PolicyScopesSchema = z
  .array(z.nativeEnum(PolicyScope))
  .min(1, { message: 'Scopes must not be empty' })
  .refine((scopes: PolicyScope[]) => new Set(scopes).size === scopes.length, {
    message: 'Scopes must not contain duplicate elements'
  });

export const UpdatePolicyRequestSchema = z
  .object({
    dailyBudgetSats: BudgetSatsSchema,
    perTxBudgetSats: BudgetSatsSchema,
    scopes: PolicyScopesSchema,
    allowedMints: z.array(IdentifierString),
    allowedRelays: z.array(IdentifierString),
    allowedEsplora: z.array(IdentifierString)
  })
  .strict();

export const PolicyResponseSchema = z
  .object({
    id: IdentifierString,
    dailyBudgetSats: z
      .string()
      .regex(/^[0-9]+$/, { message: 'dailyBudgetSats must be numeric digits' }),
    perTxBudgetSats: z
      .string()
      .regex(/^[0-9]+$/, { message: 'perTxBudgetSats must be numeric digits' }),
    scopes: z.array(z.nativeEnum(PolicyScope)),
    allowedMints: z.array(IdentifierString),
    allowedRelays: z.array(IdentifierString),
    allowedEsplora: z.array(IdentifierString),
    updatedAt: z.string().min(1)
  })
  .strict();

export const PolicyLimitsSchema = z
  .object({
    dailyRemainingSats: z
      .string()
      .regex(/^[0-9]+$/, { message: 'dailyRemainingSats must be numeric digits' }),
    perTxLimitSats: z
      .string()
      .regex(/^[0-9]+$/, { message: 'perTxLimitSats must be numeric digits' })
  })
  .strict();

export const CheckResponseSchema = z
  .object({
    allowed: z.literal(true),
    limits: PolicyLimitsSchema
  })
  .strict();

export type CheckRequestInput = z.infer<typeof CheckRequestSchema>;
export type UpdatePolicyRequestInput = z.infer<typeof UpdatePolicyRequestSchema>;
export type PolicyResponseOutput = z.infer<typeof PolicyResponseSchema>;
export type CheckResponseOutput = z.infer<typeof CheckResponseSchema>;
