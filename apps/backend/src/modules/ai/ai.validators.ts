import { z } from 'zod';

export const ExplainGraphRequestSchema = z.object({
  scenarioId: z.string().trim().min(1, 'scenarioId cannot be empty')
});

export const SummarizeEvidenceRequestSchema = z.object({
  bundleHash: z.string().trim().min(1, 'bundleHash cannot be empty')
});

export const CandidateRouteSchema = z.object({
  name: z.string().trim().min(1, 'route name cannot be empty'),
  protocol: z.string().trim().min(1, 'protocol cannot be empty'),
  estimatedFeeSats: z.number().int().nonnegative('estimatedFeeSats must be non-negative').nullable(),
  estimatedLinkageConfidence: z.number().min(0).max(1, 'estimatedLinkageConfidence must be between 0 and 1')
});

export const RouteConstraintsSchema = z.object({
  maxFeeSats: z.number().int().nonnegative('maxFeeSats must be non-negative').nullable(),
  requireNonCustodial: z.boolean()
});

export const SuggestRouteRequestSchema = z.object({
  paymentTargetKind: z.enum(['Lightning', 'Bitcoin', 'Cashu']),
  paymentTargetTruncated: z.string().trim().min(1, 'paymentTargetTruncated cannot be empty'),
  candidateRoutes: z.array(CandidateRouteSchema).min(1, 'candidateRoutes cannot be empty'),
  constraints: RouteConstraintsSchema
});

export const AIResponseSchema = z.object({
  text: z.string(),
  model: z.string(),
  provider: z.string(),
  cached: z.boolean()
});

export type ExplainGraphRequest = z.infer<typeof ExplainGraphRequestSchema>;
export type SummarizeEvidenceRequest = z.infer<typeof SummarizeEvidenceRequestSchema>;
export type SuggestRouteRequest = z.infer<typeof SuggestRouteRequestSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
