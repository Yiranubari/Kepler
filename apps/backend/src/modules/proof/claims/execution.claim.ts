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

export interface ExecutionClaimInput {
  protocol: 'Bitcoin' | 'Lightning' | 'Cashu';
  identifier: string;
  amountSats: string;
  rawDataRefs: Array<{
    source: 'Bitcoin' | 'Lightning' | 'Cashu';
    ref: string;
    payload: unknown;
  }>;
}

const executionClaimInputSchema = z.object({
  protocol: z.enum(['Bitcoin', 'Lightning', 'Cashu']),
  identifier: z.string().min(1),
  amountSats: z.string().min(1),
  rawDataRefs: z.array(
    z.object({
      source: z.enum(['Bitcoin', 'Lightning', 'Cashu']),
      ref: z.string().min(1),
      payload: z.unknown()
    })
  )
});

export class ExecutionClaimBuilder implements ClaimBuilder {
  public readonly supports: ClaimType = ClaimType.Transaction;
  public readonly name: string = 'ExecutionClaimBuilder';

  public build(context: ClaimBuildContext, input: unknown): BuiltClaim {
    const parseResult = executionClaimInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ProofBuildError('Invalid execution claim input', {
        claimType: ClaimType.Transaction,
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

    const verificationStep = new VerificationStep({
      name: 'execution:identifier',
      endpoint: '/api/proof/verify',
      input: {
        protocol: validated.protocol,
        identifier: validated.identifier
      },
      expected: validated.identifier
    });

    const claimText = `A payment of ${validated.amountSats} sats was executed via protocol ${validated.protocol} with identifier ${validated.identifier}.`;
    const claim = new Claim({
      text: claimText,
      type: ClaimType.Transaction
    });

    const bundleId = `execution:${context.scenarioId}:${validated.protocol}:${validated.identifier}`;

    const bundle = new EvidenceBundle({
      id: bundleId,
      claim,
      rawDataRefs,
      verificationSteps: [verificationStep],
      confidence: 1.0,
      riskScore: null,
      createdAt: new Date(context.now)
    });

    return { bundle };
  }
}

export class ExecutionClaimVerifier implements ClaimVerifier {
  public readonly supports: ClaimType = ClaimType.Transaction;
  public readonly name: string = 'ExecutionClaimVerifier';

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
      reason: 'Execution claim verified successfully'
    });
  }

  private verifyStep(step: VerificationStep, bundle: EvidenceBundle): ClaimVerificationResult {
    const stepInput =
      typeof step.input === 'object' && step.input !== null
        ? (step.input as Record<string, unknown>)
        : {};

    const protocol = typeof stepInput['protocol'] === 'string' ? stepInput['protocol'] : undefined;
    const identifier =
      typeof stepInput['identifier'] === 'string'
        ? stepInput['identifier'].trim()
        : typeof step.expected === 'string'
        ? step.expected.trim()
        : undefined;

    if (!identifier) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'IDENTIFIER_MISSING',
        failedStep: step.name
      });
    }

    const targetRef = protocol
      ? bundle.rawDataRefs.find((r) => r.source.toLowerCase() === protocol.toLowerCase())
      : bundle.rawDataRefs[0];

    if (!targetRef) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'MISSING_RAW_DATA',
        failedStep: step.name
      });
    }

    const isPresent = this.checkIdentifierInPayload(
      targetRef.source,
      targetRef.payload,
      targetRef.ref,
      identifier
    );

    if (!isPresent) {
      return new ClaimVerificationResult({
        valid: false,
        reason: 'IDENTIFIER_MISSING',
        failedStep: step.name,
        expected: identifier
      });
    }

    return new ClaimVerificationResult({
      valid: true,
      reason: 'Identifier verified in raw data payload'
    });
  }

  private checkIdentifierInPayload(
    source: RawDataSource,
    payload: unknown,
    ref: string,
    identifier: string
  ): boolean {
    const lowerIdentifier = identifier.toLowerCase();

    if (ref.trim().toLowerCase() === lowerIdentifier) {
      return true;
    }

    if (typeof payload === 'string' && payload.trim().toLowerCase() === lowerIdentifier) {
      return true;
    }

    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;

      if (source === 'Bitcoin') {
        const txid = typeof p['txid'] === 'string' ? p['txid'] : p['txId'];
        if (typeof txid === 'string' && txid.trim().toLowerCase() === lowerIdentifier) {
          return true;
        }
      } else if (source === 'Lightning') {
        const paymentHash =
          typeof p['paymentHash'] === 'string'
            ? p['paymentHash']
            : typeof p['payment_hash'] === 'string'
            ? p['payment_hash']
            : p['hash'];
        if (typeof paymentHash === 'string' && paymentHash.trim().toLowerCase() === lowerIdentifier) {
          return true;
        }
      } else if (source === 'Cashu') {
        const quoteId =
          typeof p['quote'] === 'string'
            ? p['quote']
            : typeof p['quoteId'] === 'string'
            ? p['quoteId']
            : typeof p['quote_id'] === 'string'
            ? p['quote_id']
            : p['id'];
        if (typeof quoteId === 'string' && quoteId.trim().toLowerCase() === lowerIdentifier) {
          return true;
        }
      }

      if (typeof p['id'] === 'string' && p['id'].trim().toLowerCase() === lowerIdentifier) {
        return true;
      }
    }

    return false;
  }
}
