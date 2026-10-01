import { z } from 'zod';
import { TaintIngestPayloadSchema } from '../taint';

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

export const RouteCandidateSchema = z
  .object({
    name: IdentifierString,
    protocol: z.enum(['Bitcoin', 'Lightning', 'Cashu']),
    estimatedFeeSats: z
      .string()
      .regex(/^[0-9]+$/, { message: 'estimatedFeeSats must contain only digits' })
      .refine(refineNoControlCharacters, {
        message: 'Identifier must not contain control characters'
      }),
    estimatedLinkageConfidence: z.number().min(0).max(1),
    mint: IdentifierString.optional(),
    params: z.record(z.unknown())
  })
  .strict();

export const OrchestrateRequestSchema = z
  .object({
    scenarioId: IdentifierString,
    ingestData: TaintIngestPayloadSchema,
    candidateRoutes: z.array(RouteCandidateSchema).optional()
  })
  .strict();

export const DecisionSummarySchema = z
  .object({
    routeName: IdentifierString,
    protocol: IdentifierString,
    evidenceBundleHash: IdentifierString,
    reason: z
      .string()
      .min(1)
      .max(1024)
      .refine(refineNoControlCharacters, {
        message: 'Identifier must not contain control characters'
      })
  })
  .strict();

export const ExecutionSummarySchema = z
  .object({
    status: z.enum(['succeeded', 'failed']),
    amountSats: z
      .string()
      .regex(/^[0-9]+$/, { message: 'amountSats must contain only digits' })
      .refine(refineNoControlCharacters, {
        message: 'Identifier must not contain control characters'
      }),
    feeSats: z
      .string()
      .regex(/^[0-9]+$/, { message: 'feeSats must contain only digits' })
      .refine(refineNoControlCharacters, {
        message: 'Identifier must not contain control characters'
      }),
    identifier: IdentifierString,
    protocol: IdentifierString
  })
  .strict();

export const OrchestrateResponseSchema = z
  .object({
    scenarioId: IdentifierString,
    decision: DecisionSummarySchema,
    execution: ExecutionSummarySchema,
    nostrEventId: IdentifierString.nullable()
  })
  .strict();
