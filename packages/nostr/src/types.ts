import { z } from 'zod';

export interface NostrEvent {
  readonly id: string;
  readonly pubkey: string;
  readonly createdAt: number;
  readonly kind: number;
  readonly tags: string[][];
  readonly content: string;
  readonly sig: string;
}

export interface NostrFilter {
  readonly ids?: string[];
  readonly authors?: string[];
  readonly kinds?: number[];
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
  readonly '#e'?: string[];
  readonly '#p'?: string[];
  readonly '#d'?: string[];
}

export interface VerifiedNostrEvent {
  readonly event: NostrEvent;
  readonly verified: true;
}

export interface PublishRejectedRelay {
  readonly relay: string;
  readonly reason: string;
}

export interface PublishResult {
  readonly event: NostrEvent;
  readonly acceptedBy: string[];
  readonly rejectedBy: PublishRejectedRelay[];
}

export interface KeplerDecisionPayload {
  readonly scenarioId: string;
  readonly decision: string;
  readonly protocol: string;
  readonly evidenceHash: string;
  readonly summary: string;
}

export const NostrEventSchema = z.object({
  id: z.string().min(1),
  pubkey: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  kind: z.number().int().nonnegative(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string().min(1)
});

export const NostrWireEventSchema = z.object({
  id: z.string().min(1),
  pubkey: z.string().min(1),
  created_at: z.number().int().nonnegative(),
  kind: z.number().int().nonnegative(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string().min(1)
});

export const NostrFilterSchema = z.object({
  ids: z.array(z.string().min(1)).optional(),
  authors: z.array(z.string().min(1)).optional(),
  kinds: z.array(z.number().int().nonnegative()).optional(),
  since: z.number().int().nonnegative().optional(),
  until: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative().optional(),
  '#e': z.array(z.string().min(1)).optional(),
  '#p': z.array(z.string().min(1)).optional(),
  '#d': z.array(z.string()).optional()
});

export const KeplerDecisionPayloadSchema = z.object({
  scenarioId: z.string().min(1),
  decision: z.string().min(1),
  protocol: z.string().min(1),
  evidenceHash: z.string().min(1),
  summary: z.string()
});
