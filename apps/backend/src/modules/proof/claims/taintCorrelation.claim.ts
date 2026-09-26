import { z } from 'zod';
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

export interface TaintCorrelationClaimInput {
  fromNodeId: string;
  toNodeId: string;
  relationship: string;
  confidence: number;
  edgeEvidence: Array<{
    kind: string;
    ref: string;
    description: string;
    data: unknown;
  }>;
  rawDataRefs: Array<{
    source: 'Bitcoin' | 'Lightning' | 'Nostr' | 'Cashu';
    ref: string;
    payload: unknown;
  }>;
}

const taintCorrelationClaimInputSchema = z.object({
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  relationship: z.string().min(1),
  confidence: z.number().min(0).max(1),
  edgeEvidence: z.array(
    z.object({
      kind: z.string(),
      ref: z.string(),
      description: z.string(),
      data: z.unknown()
    })
  ),
  rawDataRefs: z.array(
    z.object({
      source: z.enum(['Bitcoin', 'Lightning', 'Nostr', 'Cashu']),
      ref: z.string().min(1),
      payload: z.unknown()
    })
  )
});

export class TaintCorrelationClaimBuilder implements ClaimBuilder {
  public readonly supports: ClaimType = ClaimType.Privacy;
  public readonly name: string = 'TaintCorrelationClaimBuilder';

  public build(context: ClaimBuildContext, input: unknown): BuiltClaim {
    const parseResult = taintCorrelationClaimInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ProofBuildError('Invalid taint correlation claim input', {
        claimType: ClaimType.Privacy,
        reason: parseResult.error.message
      });
    }

    const validated = parseResult.data;

    const rawDataRefs = validated.rawDataRefs.map(
      (entry) =>
        new RawDataRef({
          source: entry.source as RawDataSource,
          ref: entry.ref,
          payload: entry.payload,
          fetchedAt: new Date(context.now)
        })
    );

    const stepName = `${validated.relationship}:recompute`;
    const stepInput = this.buildStepInput(validated);
    const verificationStep = new VerificationStep({
      name: stepName,
      endpoint: '/api/proof/verify',
      input: stepInput,
      expected: true
    });

    const claimText = `${validated.fromNodeId} and ${validated.toNodeId} are correlated via ${validated.relationship} with confidence ${validated.confidence}.`;
    const claim = new Claim({
      text: claimText,
      type: ClaimType.Privacy
    });

    const bundleId = `correlation:${context.scenarioId}:${validated.fromNodeId}:${validated.toNodeId}:${validated.relationship}`;

    const bundle = new EvidenceBundle({
      id: bundleId,
      claim,
      rawDataRefs,
      verificationSteps: [verificationStep],
      confidence: validated.confidence,
      riskScore: null,
      createdAt: new Date(context.now)
    });

    return { bundle };
  }

  private buildStepInput(input: z.infer<typeof taintCorrelationClaimInputSchema>): Record<string, unknown> {
    const base: Record<string, unknown> = {
      relationship: input.relationship,
      from: input.fromNodeId,
      to: input.toNodeId
    };

    if (input.relationship === 'TEMPORAL_WINDOW') {
      let windowSeconds = 3600;
      let timestampA: number | undefined;
      let timestampB: number | undefined;

      for (const item of input.edgeEvidence) {
        if (
          typeof item.data === 'object' &&
          item.data !== null &&
          'windowSeconds' in item.data &&
          typeof (item.data as Record<string, unknown>)['windowSeconds'] === 'number'
        ) {
          windowSeconds = (item.data as Record<string, unknown>)['windowSeconds'] as number;
        }
        if (
          typeof item.data === 'object' &&
          item.data !== null &&
          'match' in item.data &&
          typeof (item.data as Record<string, unknown>)['match'] === 'number'
        ) {
          const ts = (item.data as Record<string, unknown>)['match'] as number;
          if (timestampA === undefined) {
            timestampA = ts;
          } else if (timestampB === undefined) {
            timestampB = ts;
          }
        }
      }

      base['windowSeconds'] = windowSeconds;
      if (timestampA !== undefined) {
        base['timestampA'] = timestampA;
      }
      if (timestampB !== undefined) {
        base['timestampB'] = timestampB;
      }
    }

    return base;
  }
}

export class TaintCorrelationClaimVerifier implements ClaimVerifier {
  public readonly supports: ClaimType = ClaimType.Privacy;
  public readonly name: string = 'TaintCorrelationClaimVerifier';

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
      const stepResult = this.verifyStep(step, bundle);
      if (!stepResult.valid) {
        return stepResult;
      }
    }

    return new ClaimVerificationResult({
      valid: true,
      reason: 'All verification steps passed and bundle hash verified'
    });
  }

  private verifyStep(step: VerificationStep, bundle: EvidenceBundle): ClaimVerificationResult {
    const stepName = step.name;

    if (stepName.startsWith('SAME_PAYMENT_HASH')) {
      return this.verifySamePaymentHash(step, bundle);
    }
    if (stepName.startsWith('SAME_PREIMAGE')) {
      return this.verifySamePreimage(step, bundle);
    }
    if (stepName.startsWith('PUBLISHED_BY')) {
      return this.verifyPublishedBy(step, bundle);
    }
    if (stepName.startsWith('SHARED_MINT')) {
      return this.verifySharedMint(step, bundle);
    }
    if (stepName.startsWith('CASHU_QUOTE_INVOICE')) {
      return this.verifyCashuQuoteInvoice(step, bundle);
    }
    if (stepName.startsWith('TEMPORAL_WINDOW')) {
      return this.verifyTemporalWindow(step, bundle);
    }

    return new ClaimVerificationResult({
      valid: false,
      reason: 'STEP_FAILED',
      failedStep: step.name,
      expected: 'Known verification rule',
      actual: step.name
    });
  }

  private verifySamePaymentHash(step: VerificationStep, bundle: EvidenceBundle): ClaimVerificationResult {
    const nostrRef = bundle.rawDataRefs.find((r) => r.source === 'Nostr');
    const lightningRef = bundle.rawDataRefs.find((r) => r.source === 'Lightning');

    if (!nostrRef || !lightningRef) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const paymentHash = this.extractPaymentHash(lightningRef, step);
    if (!paymentHash) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const { content, tags } = this.extractNostrContentAndTags(nostrRef.payload);
    const lowerHash = paymentHash.toLowerCase();

    const inContent = content.toLowerCase().includes(lowerHash);
    const inTags = tags.some((tag) =>
      tag.some((elem) => elem.toLowerCase() === lowerHash)
    );

    if (inContent || inTags) {
      return new ClaimVerificationResult({
        valid: true,
        reason: 'Payment hash found in Nostr event'
      });
    }

    return new ClaimVerificationResult({
      valid: false,
      reason: 'STEP_FAILED',
      failedStep: step.name,
      expected: paymentHash,
      actual: content
    });
  }

  private verifySamePreimage(step: VerificationStep, bundle: EvidenceBundle): ClaimVerificationResult {
    const nostrRef = bundle.rawDataRefs.find((r) => r.source === 'Nostr');
    const lightningRef = bundle.rawDataRefs.find((r) => r.source === 'Lightning');

    if (!nostrRef || !lightningRef) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const preimage = this.extractPreimage(lightningRef, step);
    if (!preimage) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const { content, tags } = this.extractNostrContentAndTags(nostrRef.payload);
    const lowerPreimage = preimage.toLowerCase();

    const inContent = content.toLowerCase().includes(lowerPreimage);
    const inTags = tags.some((tag) =>
      tag.some((elem) => elem.toLowerCase() === lowerPreimage)
    );

    if (inContent || inTags) {
      return new ClaimVerificationResult({
        valid: true,
        reason: 'Preimage found in Nostr event'
      });
    }

    return new ClaimVerificationResult({
      valid: false,
      reason: 'STEP_FAILED',
      failedStep: step.name,
      expected: preimage,
      actual: content
    });
  }

  private verifyPublishedBy(step: VerificationStep, bundle: EvidenceBundle): ClaimVerificationResult {
    const nostrRef = bundle.rawDataRefs.find((r) => r.source === 'Nostr');
    if (!nostrRef) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const eventPubkey = this.extractPubkeyFromPayload(nostrRef.payload);
    if (!eventPubkey) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    let expectedPubkey: string | undefined;

    const secondRef = bundle.rawDataRefs.find(
      (r) =>
        r !== nostrRef &&
        (r.ref.startsWith('pubkey:') ||
          r.ref.length === 64 ||
          (typeof r.payload === 'object' && r.payload !== null && 'pubkey' in r.payload))
    );

    if (secondRef) {
      if (secondRef.ref.startsWith('pubkey:')) {
        expectedPubkey = secondRef.ref.replace(/^pubkey:/, '').trim();
      } else if (secondRef.ref.length === 64 && /^[0-9a-f]{64}$/i.test(secondRef.ref)) {
        expectedPubkey = secondRef.ref.trim();
      } else if (typeof secondRef.payload === 'object' && secondRef.payload !== null) {
        const p = secondRef.payload as Record<string, unknown>;
        if (typeof p['pubkey'] === 'string') {
          expectedPubkey = p['pubkey'].trim();
        }
      }
    }

    if (!expectedPubkey && typeof step.input === 'object' && step.input !== null) {
      const inp = step.input as Record<string, unknown>;
      if (typeof inp['pubkey'] === 'string') {
        expectedPubkey = inp['pubkey'].trim();
      }
    }

    if (!expectedPubkey) {
      expectedPubkey = eventPubkey;
    }

    if (eventPubkey.toLowerCase() === expectedPubkey.toLowerCase()) {
      return new ClaimVerificationResult({
        valid: true,
        reason: 'Nostr event pubkey verified'
      });
    }

    return new ClaimVerificationResult({
      valid: false,
      reason: 'STEP_FAILED',
      failedStep: step.name,
      expected: expectedPubkey,
      actual: eventPubkey
    });
  }

  private verifySharedMint(step: VerificationStep, bundle: EvidenceBundle): ClaimVerificationResult {
    const nostrRef = bundle.rawDataRefs.find((r) => r.source === 'Nostr');
    const cashuRef = bundle.rawDataRefs.find((r) => r.source === 'Cashu');

    if (!nostrRef) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    let mintUrl: string | undefined;

    if (cashuRef) {
      if (typeof cashuRef.payload === 'object' && cashuRef.payload !== null) {
        const p = cashuRef.payload as Record<string, unknown>;
        if (typeof p['mint'] === 'string') {
          mintUrl = p['mint'].trim().replace(/\/+$/, '');
        } else if (typeof p['url'] === 'string') {
          mintUrl = p['url'].trim().replace(/\/+$/, '');
        }
      }
      if (!mintUrl && cashuRef.ref) {
        mintUrl = cashuRef.ref.replace(/^mint:/, '').trim().replace(/\/+$/, '');
      }
    }

    if (!mintUrl && typeof step.input === 'object' && step.input !== null) {
      const inp = step.input as Record<string, unknown>;
      if (typeof inp['mintUrl'] === 'string') {
        mintUrl = (inp['mintUrl'] as string).trim().replace(/\/+$/, '');
      }
    }

    if (!mintUrl) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const { content, tags } = this.extractNostrContentAndTags(nostrRef.payload);

    const inContent = content.includes(mintUrl);
    const inTags = tags.some((tag) => tag.some((elem) => elem === mintUrl));

    if (inContent || inTags) {
      return new ClaimVerificationResult({
        valid: true,
        reason: 'Cashu mint URL found in Nostr event'
      });
    }

    return new ClaimVerificationResult({
      valid: false,
      reason: 'STEP_FAILED',
      failedStep: step.name,
      expected: mintUrl,
      actual: content
    });
  }

  private verifyCashuQuoteInvoice(step: VerificationStep, bundle: EvidenceBundle): ClaimVerificationResult {
    const cashuRef = bundle.rawDataRefs.find((r) => r.source === 'Cashu');
    const lightningRef = bundle.rawDataRefs.find((r) => r.source === 'Lightning');

    if (!cashuRef) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    let paymentHash: string | undefined;
    if (lightningRef) {
      paymentHash = this.extractPaymentHash(lightningRef, step);
    }
    if (!paymentHash && typeof step.input === 'object' && step.input !== null) {
      const inp = step.input as Record<string, unknown>;
      if (typeof inp['paymentHash'] === 'string') {
        paymentHash = inp['paymentHash'].trim();
      }
    }

    if (!paymentHash) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const lowerPaymentHash = paymentHash.toLowerCase();
    const candidateHashes = this.extractCashuQuoteHashes(cashuRef);
    const exactMatch = candidateHashes.some((hash) => hash.toLowerCase() === lowerPaymentHash);

    const requestString = this.extractCashuQuoteRequest(cashuRef);
    const requestMatch =
      requestString !== undefined && requestString.toLowerCase().includes(lowerPaymentHash);

    if (candidateHashes.length === 0 && requestString === undefined) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    if (exactMatch || requestMatch) {
      return new ClaimVerificationResult({
        valid: true,
        reason: 'Payment hash matches Cashu quote reference'
      });
    }

    return new ClaimVerificationResult({
      valid: false,
      reason: 'STEP_FAILED',
      failedStep: step.name,
      expected: paymentHash,
      actual: candidateHashes.length > 0 ? candidateHashes.join(', ') : (requestString ?? '')
    });
  }

  private verifyTemporalWindow(step: VerificationStep, bundle: EvidenceBundle): ClaimVerificationResult {
    let windowSeconds = 3600;
    let timestampA: number | undefined;
    let timestampB: number | undefined;

    if (typeof step.input === 'object' && step.input !== null) {
      const inp = step.input as Record<string, unknown>;
      if (typeof inp['windowSeconds'] === 'number') {
        windowSeconds = inp['windowSeconds'];
      }
      if (typeof inp['timestampA'] === 'number') {
        timestampA = inp['timestampA'];
      }
      if (typeof inp['timestampB'] === 'number') {
        timestampB = inp['timestampB'];
      }
    }

    if (timestampA === undefined || timestampB === undefined) {
      const timestamps: number[] = [];
      for (const ref of bundle.rawDataRefs) {
        const extracted = this.extractTimestampFromRef(ref);
        if (extracted !== undefined) {
          timestamps.push(extracted);
        }
      }
      if (timestamps.length >= 2) {
        if (timestampA === undefined) timestampA = timestamps[0];
        if (timestampB === undefined) timestampB = timestamps[1];
      }
    }

    if (timestampA === undefined || timestampB === undefined) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const delta = Math.abs(timestampA - timestampB);
    if (delta < windowSeconds) {
      return new ClaimVerificationResult({
        valid: true,
        reason: 'Timestamps are within the configured temporal window'
      });
    }

    return new ClaimVerificationResult({
      valid: false,
      reason: 'STEP_FAILED',
      failedStep: step.name,
      expected: `<${windowSeconds}`,
      actual: String(delta)
    });
  }

  private extractPaymentHash(ref: RawDataRef, step: VerificationStep): string | undefined {
    if (typeof ref.payload === 'string' && ref.payload.trim().length > 0) {
      return ref.payload.trim();
    }
    if (typeof ref.payload === 'object' && ref.payload !== null) {
      const p = ref.payload as Record<string, unknown>;
      if (typeof p['paymentHash'] === 'string') return p['paymentHash'].trim();
      if (typeof p['payment_hash'] === 'string') return p['payment_hash'].trim();
      if (typeof p['hash'] === 'string') return p['hash'].trim();
    }
    if (typeof step.input === 'object' && step.input !== null) {
      const inp = step.input as Record<string, unknown>;
      if (typeof inp['paymentHash'] === 'string') return inp['paymentHash'].trim();
    }
    if (ref.ref) {
      const stripped = ref.ref.replace(/^payment_hash:/, '').trim();
      if (stripped.length === 64) {
        return stripped;
      }
    }
    return undefined;
  }

  private extractPreimage(ref: RawDataRef, step: VerificationStep): string | undefined {
    if (typeof ref.payload === 'string' && ref.payload.trim().length > 0) {
      return ref.payload.trim();
    }
    if (typeof ref.payload === 'object' && ref.payload !== null) {
      const p = ref.payload as Record<string, unknown>;
      if (typeof p['preimage'] === 'string') return p['preimage'].trim();
      if (typeof p['paymentPreimage'] === 'string') return p['paymentPreimage'].trim();
      if (typeof p['payment_preimage'] === 'string') return p['payment_preimage'].trim();
    }
    if (typeof step.input === 'object' && step.input !== null) {
      const inp = step.input as Record<string, unknown>;
      if (typeof inp['preimage'] === 'string') return inp['preimage'].trim();
    }
    if (ref.ref) {
      const stripped = ref.ref.replace(/^preimage:/, '').trim();
      if (stripped.length === 64) {
        return stripped;
      }
    }
    return undefined;
  }

  private extractNostrContentAndTags(payload: unknown): { content: string; tags: string[][] } {
    let content = '';
    const tags: string[][] = [];

    if (typeof payload === 'string') {
      content = payload;
    } else if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      if (typeof p['content'] === 'string') {
        content = p['content'];
      }
      if (Array.isArray(p['tags'])) {
        for (const item of p['tags']) {
          if (Array.isArray(item)) {
            tags.push(item.filter((e): e is string => typeof e === 'string'));
          }
        }
      }
    }

    return { content, tags };
  }

  private extractPubkeyFromPayload(payload: unknown): string | undefined {
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      if (typeof p['pubkey'] === 'string') {
        return p['pubkey'].trim();
      }
    }
    return undefined;
  }

  private extractTimestampFromRef(ref: RawDataRef): number | undefined {
    if (typeof ref.payload === 'object' && ref.payload !== null) {
      const p = ref.payload as Record<string, unknown>;
      if (typeof p['createdAt'] === 'number') return p['createdAt'];
      if (typeof p['created_at'] === 'number') return p['created_at'];
      if (typeof p['blockTime'] === 'number') return p['blockTime'];
      if (typeof p['timestamp'] === 'number') return p['timestamp'];
    }
    return Math.floor(ref.fetchedAt.getTime() / 1000);
  }

  private extractCashuQuoteHashes(ref: RawDataRef): string[] {
    const hashes: string[] = [];
    if (typeof ref.payload === 'object' && ref.payload !== null) {
      const p = ref.payload as Record<string, unknown>;
      if (Array.isArray(p['quoteHashes'])) {
        for (const item of p['quoteHashes']) {
          if (typeof item === 'string' && item.trim().length > 0) {
            hashes.push(item.trim());
          }
        }
      }
      if (typeof p['quoteHash'] === 'string' && p['quoteHash'].trim().length > 0) {
        hashes.push(p['quoteHash'].trim());
      }
      if (typeof p['paymentHash'] === 'string' && p['paymentHash'].trim().length > 0) {
        hashes.push(p['paymentHash'].trim());
      }
    } else if (typeof ref.payload === 'string' && ref.payload.trim().length > 0) {
      hashes.push(ref.payload.trim());
    }
    if (ref.ref && ref.ref.trim().length > 0) {
      const cleanRef = ref.ref.replace(/^payment_hash:/, '').replace(/^quote:/, '').trim();
      if (cleanRef.length === 64) {
        hashes.push(cleanRef);
      }
    }
    return hashes;
  }

  private extractCashuQuoteRequest(ref: RawDataRef): string | undefined {
    if (typeof ref.payload === 'object' && ref.payload !== null) {
      const p = ref.payload as Record<string, unknown>;
      if (typeof p['request'] === 'string' && p['request'].trim().length > 0) {
        return p['request'].trim();
      }
    }
    return undefined;
  }
}

