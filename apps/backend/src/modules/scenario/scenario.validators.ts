import { z } from 'zod';
import { PaymentTargetKind, ScenarioStatus } from '@kepler/shared';
import { IdentifierString } from '../taint/taint.validators';

export const LightningTargetSchema = z.object({
  kind: z.literal(PaymentTargetKind.Lightning),
  payload: z.object({
    invoice: z
      .string()
      .min(1)
      .regex(/^(lnbc|lntb|lnbcrt)/i, {
        message: 'Invoice must start with lnbc, lntb, or lnbcrt'
      })
  })
});

export const BitcoinTargetSchema = z.object({
  kind: z.literal(PaymentTargetKind.Bitcoin),
  payload: z.object({
    address: z
      .string()
      .regex(/^(bc1|1|3|tb1|m|n|2|bcrt1)[a-zA-HJ-NP-Z0-9]+$/, {
        message: 'Invalid Bitcoin address'
      }),
    amountSats: z
      .string()
      .regex(/^[0-9]+$/, {
        message: 'amountSats must match ^[0-9]+$'
      })
  })
});

export const CashuTargetSchema = z.object({
  kind: z.literal(PaymentTargetKind.Cashu),
  payload: z.object({
    request: z.string().min(1)
  })
});

export const PaymentTargetSchema = z.discriminatedUnion('kind', [
  LightningTargetSchema,
  BitcoinTargetSchema,
  CashuTargetSchema
]);

export const CreateScenarioRequestSchema = z.object({
  target: PaymentTargetSchema
});

export const ScenarioIdParamSchema = z.object({
  id: IdentifierString
});

export const UpdateStatusRequestSchema = z.object({
  status: z.nativeEnum(ScenarioStatus)
});

export const ScenarioResponseTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(PaymentTargetKind.Lightning),
    payload: z.object({
      invoice: z.string().min(1)
    })
  }),
  z.object({
    kind: z.literal(PaymentTargetKind.Bitcoin),
    payload: z.object({
      address: z.string().min(1),
      amountSats: z.union([z.number().positive(), z.string().regex(/^[0-9]+$/)])
    })
  }),
  z.object({
    kind: z.literal(PaymentTargetKind.Cashu),
    payload: z.object({
      request: z.string().min(1)
    })
  })
]);

export const ScenarioResponseSchema = z.object({
  id: z.string().min(1),
  target: ScenarioResponseTargetSchema,
  status: z.nativeEnum(ScenarioStatus),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ListScenariosResponseSchema = z.array(ScenarioResponseSchema);

export type PaymentTargetInput = z.infer<typeof PaymentTargetSchema>;
export type CreateScenarioRequest = z.infer<typeof CreateScenarioRequestSchema>;
export type ScenarioIdParam = z.infer<typeof ScenarioIdParamSchema>;
export type UpdateStatusRequest = z.infer<typeof UpdateStatusRequestSchema>;
export type ScenarioResponseOutput = z.infer<typeof ScenarioResponseSchema>;
export type ListScenariosResponse = z.infer<typeof ListScenariosResponseSchema>;
