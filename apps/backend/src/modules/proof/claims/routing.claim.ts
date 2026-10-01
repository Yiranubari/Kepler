import { z } from 'zod';
import {
  Claim,
  ClaimType,
  ClaimVerificationResult,
  EvidenceBundle,
  PaymentTargetKind,
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
import { RouteSelector, RouteCandidate } from '../../../shared/route.selector';

export interface RoutingClaimInput {
  targetKind: 'Lightning' | 'Bitcoin' | 'Cashu';
  selectedRouteName: string;
  candidates: Array<{
    name: string;
    protocol: 'Bitcoin' | 'Lightning' | 'Cashu';
    estimatedFeeSats: string;
    estimatedLinkageConfidence: number;
    params: Record<string, unknown>;
  }>;
  rawDataRefs: Array<{
    source: 'Bitcoin' | 'Lightning' | 'Cashu';
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

const routingCandidateSchema = z.object({
  name: identifierStringSchema,
  protocol: z.enum(['Bitcoin', 'Lightning', 'Cashu']),
  estimatedFeeSats: z
    .string()
    .regex(/^[0-9]+$/, { message: 'estimatedFeeSats must contain only digits' })
    .refine(refineNoControlCharacters, {
      message: 'Identifier must not contain control characters'
    }),
  estimatedLinkageConfidence: z.number().min(0).max(1),
  params: z.record(z.unknown())
});

const routingRawDataRefSchema = z.object({
  source: z.enum(['Bitcoin', 'Lightning', 'Cashu']),
  ref: identifierStringSchema,
  payload: z.unknown()
});

const routingClaimInputSchema = z.object({
  targetKind: z.enum(['Lightning', 'Bitcoin', 'Cashu']),
  selectedRouteName: identifierStringSchema,
  candidates: z.array(routingCandidateSchema),
  rawDataRefs: z.array(routingRawDataRefSchema)
});

export class RoutingClaimBuilder implements ClaimBuilder {
  public readonly supports: ClaimType = ClaimType.Routing;
  public readonly name: string = 'RoutingClaimBuilder';

  public build(context: ClaimBuildContext, input: unknown): BuiltClaim {
    const parseResult = routingClaimInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ProofBuildError('Invalid routing claim input', {
        claimType: ClaimType.Routing,
        reason: parseResult.error.message
      });
    }

    const validated = parseResult.data;

    let selected: RouteCandidate;
    try {
      selected = RouteSelector.select(
        validated.targetKind as PaymentTargetKind,
        validated.candidates as RouteCandidate[]
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProofBuildError('Route selection failed during claim construction', {
        claimType: ClaimType.Routing,
        reason
      });
    }

    if (selected.name !== validated.selectedRouteName) {
      throw new ProofBuildError(
        `Selected route mismatch: expected ${validated.selectedRouteName}, got ${selected.name}`,
        {
          claimType: ClaimType.Routing,
          reason: 'SELECTION_MISMATCH'
        }
      );
    }

    const claimText = `Route ${selected.name} via ${selected.protocol} was selected over ${validated.candidates.length - 1} other candidates because it has the lowest estimated linkage confidence (${selected.estimatedLinkageConfidence.toFixed(4)}).`;
    const claim = new Claim({
      text: claimText,
      type: ClaimType.Routing
    });

    const rawDataRefs = validated.rawDataRefs.map(
      (entry) =>
        new RawDataRef({
          source: entry.source as RawDataSource,
          ref: entry.ref,
          payload: entry.payload,
          fetchedAt: new Date(context.now)
        })
    );

    const stepSelection = new VerificationStep({
      name: 'routing:selection',
      endpoint: '/api/proof/verify',
      input: {
        targetKind: validated.targetKind,
        candidates: validated.candidates
      },
      expected: validated.selectedRouteName
    });

    const stepDeterministic = new VerificationStep({
      name: 'routing:deterministic',
      endpoint: '/api/proof/verify',
      input: {
        targetKind: validated.targetKind,
        candidates: validated.candidates
      },
      expected: validated.selectedRouteName
    });

    const bundleId = `routing:${context.scenarioId}:${validated.selectedRouteName}`;

    const bundle = new EvidenceBundle({
      id: bundleId,
      claim,
      rawDataRefs,
      verificationSteps: [stepSelection, stepDeterministic],
      confidence: 1.0,
      riskScore: selected.estimatedLinkageConfidence,
      createdAt: new Date(context.now)
    });

    return { bundle };
  }
}

export class RoutingClaimVerifier implements ClaimVerifier {
  public readonly supports: ClaimType = ClaimType.Routing;
  public readonly name: string = 'RoutingClaimVerifier';

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
    if (step.name !== 'routing:selection' && step.name !== 'routing:deterministic') {
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

    const targetKind = stepInput['targetKind'] as PaymentTargetKind;
    const candidates = stepInput['candidates'] as RouteCandidate[];

    let selected: RouteCandidate;
    try {
      if (!targetKind || !Array.isArray(candidates)) {
        throw new Error('Malformed step input: targetKind or candidates missing');
      }
      selected = RouteSelector.select(targetKind, candidates);
    } catch (error) {
      const actualMessage = error instanceof Error ? error.message : String(error);
      return new ClaimVerificationResult({
        valid: false,
        reason: 'STEP_FAILED',
        failedStep: step.name,
        expected: String(step.expected),
        actual: actualMessage
      });
    }

    if (selected.name !== step.expected) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'STEP_FAILED',
        failedStep: step.name,
        expected: String(step.expected),
        actual: selected.name
      });
    }

    return new ClaimVerificationResult({
      valid: true,
      reason: `Verification step ${step.name} passed`
    });
  }
}
