import { z } from 'zod';
import { ClaimType } from '@kepler/shared';

export const RawDataRefSchema = z.object({
  source: z.enum(['Bitcoin', 'Lightning', 'Nostr', 'Cashu']),
  ref: z.string().min(1),
  payload: z.unknown(),
  fetchedAt: z.string()
});

export const VerificationStepSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().min(1),
  input: z.unknown(),
  expected: z.unknown()
});

export const ClaimSchema = z.object({
  text: z.string().min(1),
  type: z.nativeEnum(ClaimType)
});

export const EvidenceBundleSchema = z.object({
  id: z.string().min(1),
  claim: ClaimSchema,
  rawDataRefs: z.array(RawDataRefSchema),
  verificationSteps: z.array(VerificationStepSchema),
  confidence: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(1).nullable(),
  bundleHash: z.string().min(1),
  createdAt: z.string()
});

export const BuildClaimRequestSchema = z.object({
  type: z.nativeEnum(ClaimType),
  scenarioId: z.string().min(1),
  input: z.unknown()
});

export const BuildClaimResponseSchema = EvidenceBundleSchema;

export const VerifyClaimRequestSchema = z.union([
  z.object({
    bundleId: z.string().optional(),
    bundle: EvidenceBundleSchema
  }),
  EvidenceBundleSchema
]);

export const VerifyClaimResponseSchema = z.object({
  valid: z.boolean(),
  reason: z.string(),
  failedStep: z.string().optional(),
  expected: z.string().optional(),
  actual: z.string().optional()
});

export const GetClaimResponseSchema = EvidenceBundleSchema;

export const ListClaimsResponseSchema = z.array(EvidenceBundleSchema);

export type BuildClaimRequest = z.infer<typeof BuildClaimRequestSchema>;
export type BuildClaimResponse = z.infer<typeof BuildClaimResponseSchema>;
export type VerifyClaimRequest = z.infer<typeof VerifyClaimRequestSchema>;
export type VerifyClaimResponse = z.infer<typeof VerifyClaimResponseSchema>;
export type GetClaimResponse = z.infer<typeof GetClaimResponseSchema>;
export type ListClaimsResponse = z.infer<typeof ListClaimsResponseSchema>;
