import { z } from 'zod';
import { verifyEvent, type Event as NostrToolsEvent } from 'nostr-tools';
import {
  Claim,
  ClaimType,
  ClaimVerificationResult,
  EvidenceBundle,
  RawDataRef,
  RawDataSource,
  VerificationStep
} from '@kepler/shared';
import {
  ClaimBuilder,
  ClaimBuildContext,
  BuiltClaim,
  ClaimVerifier,
  ClaimVerifierContext
} from './claim.interface';
import { ProofBuildError } from '../proof.errors';

export interface NostrClaimInput {
  event: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  };
  rawDataRefs: Array<{
    source: 'Nostr';
    ref: string;
    payload: unknown;
  }>;
}

function refineNoControlCharacters(value: string): boolean {
  return !/[\u0000-\u001F\u007F]/.test(value);
}

const identifierStringSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(refineNoControlCharacters, {
    message: 'Identifier must not contain control characters'
  });

const nostrEventSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/, {
    message: 'id must be a 64-character lowercase hex string'
  }),
  pubkey: z.string().regex(/^[0-9a-f]{64}$/, {
    message: 'pubkey must be a 64-character lowercase hex string'
  }),
  created_at: z.number().int().nonnegative(),
  kind: z.number().int(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string().regex(/^(?:[0-9a-f]{64}|[0-9a-f]{128})$/, {
    message: 'sig must be a lowercase hex string'
  })
});

const nostrRawDataRefSchema = z.object({
  source: z.literal('Nostr'),
  ref: identifierStringSchema,
  payload: z.unknown()
});

const nostrClaimInputSchema = z.object({
  event: nostrEventSchema,
  rawDataRefs: z.array(nostrRawDataRefSchema)
});

export class NostrClaimBuilder implements ClaimBuilder {
  public readonly supports: ClaimType = ClaimType.Nostr;
  public readonly name: string = 'NostrClaimBuilder';

  public build(context: ClaimBuildContext, input: unknown): BuiltClaim {
    const parseResult = nostrClaimInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ProofBuildError('Invalid nostr claim input', {
        claimType: ClaimType.Nostr,
        reason: parseResult.error.message
      });
    }

    const validated = parseResult.data;

    const eventForVerification: NostrToolsEvent = {
      id: validated.event.id,
      pubkey: validated.event.pubkey,
      created_at: validated.event.created_at,
      kind: validated.event.kind,
      tags: validated.event.tags,
      content: validated.event.content,
      sig: validated.event.sig
    };

    let isValid = false;
    try {
      isValid = verifyEvent(eventForVerification);
    } catch {
      isValid = false;
    }

    if (!isValid) {
      throw new ProofBuildError('Invalid Nostr event signature', {
        claimType: ClaimType.Nostr,
        reason: 'INVALID_SIGNATURE'
      });
    }

    const truncatedId = `${validated.event.id.slice(0, 8)}…${validated.event.id.slice(-8)}`;
    const truncatedPubkey = `${validated.event.pubkey.slice(0, 8)}…${validated.event.pubkey.slice(-8)}`;
    const claimText = `Nostr event ${truncatedId} was published by pubkey ${truncatedPubkey} at ${validated.event.created_at} with a valid signature.`;

    const claim = new Claim({
      text: claimText,
      type: ClaimType.Nostr
    });

    const eventRef = new RawDataRef({
      source: 'Nostr',
      ref: validated.event.id,
      payload: validated.event,
      fetchedAt: new Date(context.now)
    });

    const additionalRefs = validated.rawDataRefs.map(
      (entry) =>
        new RawDataRef({
          source: entry.source as RawDataSource,
          ref: entry.ref,
          payload: entry.payload,
          fetchedAt: new Date(context.now)
        })
    );

    const rawDataRefs = [eventRef, ...additionalRefs];

    const stepSignature = new VerificationStep({
      name: 'nostr:signature',
      endpoint: '/api/proof/verify',
      input: {
        event: validated.event
      },
      expected: true
    });

    const bundleId = `nostr:${context.scenarioId}:${validated.event.id}`;

    const bundle = new EvidenceBundle({
      id: bundleId,
      claim,
      rawDataRefs,
      verificationSteps: [stepSignature],
      confidence: 1.0,
      riskScore: null,
      createdAt: new Date(context.now)
    });

    return { bundle };
  }
}

export class NostrClaimVerifier implements ClaimVerifier {
  public readonly supports: ClaimType = ClaimType.Nostr;
  public readonly name: string = 'NostrClaimVerifier';

  public verify(context: ClaimVerifierContext): ClaimVerificationResult {
    const bundle = context.bundle;
    const computedHash = bundle.computeHash();

    if (bundle.bundleHash !== computedHash) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'HASH_MISMATCH',
        failedStep: 'bundleHash',
        expected: bundle.bundleHash,
        actual: computedHash
      });
    }

    for (const step of bundle.verificationSteps) {
      const stepResult = this.verifyStep(step);
      if (!stepResult.valid) {
        return stepResult;
      }
    }

    return new ClaimVerificationResult({
      valid: true,
      reason: 'All verification steps passed and bundle hash verified'
    });
  }

  private verifyStep(step: VerificationStep): ClaimVerificationResult {
    if (step.name !== 'nostr:signature') {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'STEP_FAILED',
        failedStep: step.name,
        expected: 'known step name',
        actual: step.name
      });
    }

    const stepInput =
      typeof step.input === 'object' && step.input !== null
        ? (step.input as Record<string, unknown>)
        : {};

    const rawEvent = stepInput['event'];
    if (typeof rawEvent !== 'object' || rawEvent === null) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'STEP_FAILED',
        failedStep: step.name,
        expected: String(step.expected),
        actual: 'Event missing in step input'
      });
    }

    const ev = rawEvent as Record<string, unknown>;
    const eventForVerification: NostrToolsEvent = {
      id: typeof ev['id'] === 'string' ? ev['id'] : '',
      pubkey: typeof ev['pubkey'] === 'string' ? ev['pubkey'] : '',
      created_at: typeof ev['created_at'] === 'number' ? ev['created_at'] : 0,
      kind: typeof ev['kind'] === 'number' ? ev['kind'] : 0,
      tags: Array.isArray(ev['tags']) ? (ev['tags'] as string[][]) : [],
      content: typeof ev['content'] === 'string' ? ev['content'] : '',
      sig: typeof ev['sig'] === 'string' ? ev['sig'] : ''
    };

    let isValid = false;
    try {
      isValid = verifyEvent(eventForVerification);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new ClaimVerificationResult({
        valid: false,
        reason: 'STEP_FAILED',
        failedStep: step.name,
        expected: String(step.expected),
        actual: message
      });
    }

    if (!isValid) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'STEP_FAILED',
        failedStep: step.name,
        expected: String(step.expected),
        actual: 'false'
      });
    }

    return new ClaimVerificationResult({
      valid: true,
      reason: `Verification step ${step.name} passed`
    });
  }
}
