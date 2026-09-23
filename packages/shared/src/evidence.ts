import { createHash } from 'node:crypto';
import { CanonicalJson } from './canonical';
import { ValidationError } from './exceptions/ValidationError';
import { ProofError } from './exceptions/ProofError';

export enum ClaimType {
  Transaction = 'Transaction',
  Nostr = 'Nostr',
  Lightning = 'Lightning',
  Routing = 'Routing',
  Privacy = 'Privacy',
  Cashu = 'Cashu'
}

export interface ClaimJSON {
  readonly text: string;
  readonly type: ClaimType;
}

export class Claim {
  public readonly text: string;
  public readonly type: ClaimType;

  constructor(params: { text: string; type: ClaimType }) {
    if (!params.text || params.text.trim().length === 0) {
      throw new ValidationError('Claim text cannot be empty', { field: 'text', receivedValue: params.text });
    }
    this.text = params.text;
    this.type = params.type;
    Object.freeze(this);
  }

  public toJSON(): ClaimJSON {
    return {
      text: this.text,
      type: this.type
    };
  }

  public static fromJSON(json: ClaimJSON): Claim {
    return new Claim({
      text: json.text,
      type: json.type
    });
  }
}

export type RawDataSource = 'Bitcoin' | 'Lightning' | 'Nostr' | 'Cashu';

export interface RawDataRefJSON {
  readonly source: RawDataSource;
  readonly ref: string;
  readonly payload: unknown;
  readonly fetchedAt: string;
}

export class RawDataRef {
  public readonly source: RawDataSource;
  public readonly ref: string;
  public readonly payload: unknown;
  public readonly fetchedAt: Date;

  constructor(params: {
    source: RawDataSource;
    ref: string;
    payload: unknown;
    fetchedAt?: Date;
  }) {
    if (!params.ref || params.ref.trim().length === 0) {
      throw new ValidationError('RawDataRef ref cannot be empty', { field: 'ref', receivedValue: params.ref });
    }
    this.source = params.source;
    this.ref = params.ref;
    this.payload = params.payload;
    this.fetchedAt = params.fetchedAt ?? new Date();
    Object.freeze(this);
  }

  public toJSON(): RawDataRefJSON {
    return {
      source: this.source,
      ref: this.ref,
      payload: this.payload,
      fetchedAt: this.fetchedAt.toISOString()
    };
  }

  public static fromJSON(json: RawDataRefJSON): RawDataRef {
    return new RawDataRef({
      source: json.source,
      ref: json.ref,
      payload: json.payload,
      fetchedAt: new Date(json.fetchedAt)
    });
  }
}

export interface VerificationStepJSON {
  readonly name: string;
  readonly endpoint: string;
  readonly input: unknown;
  readonly expected: unknown;
}

export class VerificationStep {
  public readonly name: string;
  public readonly endpoint: string;
  public readonly input: unknown;
  public readonly expected: unknown;

  constructor(params: {
    name: string;
    endpoint: string;
    input: unknown;
    expected: unknown;
  }) {
    if (!params.name || params.name.trim().length === 0) {
      throw new ValidationError('VerificationStep name cannot be empty', { field: 'name', receivedValue: params.name });
    }
    if (!params.endpoint || params.endpoint.trim().length === 0) {
      throw new ValidationError('VerificationStep endpoint cannot be empty', { field: 'endpoint', receivedValue: params.endpoint });
    }
    this.name = params.name;
    this.endpoint = params.endpoint;
    this.input = params.input;
    this.expected = params.expected;
    Object.freeze(this);
  }

  public toJSON(): VerificationStepJSON {
    return {
      name: this.name,
      endpoint: this.endpoint,
      input: this.input,
      expected: this.expected
    };
  }

  public static fromJSON(json: VerificationStepJSON): VerificationStep {
    return new VerificationStep({
      name: json.name,
      endpoint: json.endpoint,
      input: json.input,
      expected: json.expected
    });
  }
}

export interface ClaimVerificationResultJSON {
  readonly valid: boolean;
  readonly reason: string;
  readonly failedStep?: string;
  readonly expected?: string;
  readonly actual?: string;
}

export class ClaimVerificationResult {
  public readonly valid: boolean;
  public readonly reason: string;
  public readonly failedStep?: string;
  public readonly expected?: string;
  public readonly actual?: string;

  constructor(params: {
    valid: boolean;
    reason: string;
    failedStep?: string;
    expected?: string;
    actual?: string;
  }) {
    this.valid = params.valid;
    this.reason = params.reason;
    this.failedStep = params.failedStep;
    this.expected = params.expected;
    this.actual = params.actual;
    Object.freeze(this);
  }

  public toJSON(): ClaimVerificationResultJSON {
    return {
      valid: this.valid,
      reason: this.reason,
      ...(this.failedStep !== undefined ? { failedStep: this.failedStep } : {}),
      ...(this.expected !== undefined ? { expected: this.expected } : {}),
      ...(this.actual !== undefined ? { actual: this.actual } : {})
    };
  }

  public static fromJSON(json: ClaimVerificationResultJSON): ClaimVerificationResult {
    return new ClaimVerificationResult({
      valid: json.valid,
      reason: json.reason,
      failedStep: json.failedStep,
      expected: json.expected,
      actual: json.actual
    });
  }
}

export interface EvidenceBundleJSON {
  readonly id: string;
  readonly claim: ClaimJSON;
  readonly rawDataRefs: readonly RawDataRefJSON[];
  readonly verificationSteps: readonly VerificationStepJSON[];
  readonly confidence: number;
  readonly riskScore: number;
  readonly bundleHash: string;
  readonly createdAt: string;
}

export class EvidenceBundle {
  public readonly id: string;
  public readonly claim: Claim;
  public readonly rawDataRefs: readonly RawDataRef[];
  public readonly verificationSteps: readonly VerificationStep[];
  public readonly confidence: number;
  public readonly riskScore: number;
  public readonly bundleHash: string;
  public readonly createdAt: Date;

  constructor(params: {
    id: string;
    claim: Claim;
    rawDataRefs: RawDataRef[];
    verificationSteps: VerificationStep[];
    confidence: number;
    riskScore: number;
    bundleHash?: string;
    createdAt?: Date;
  }) {
    if (!params.id || params.id.trim().length === 0) {
      throw new ValidationError('EvidenceBundle id cannot be empty', { field: 'id', receivedValue: params.id });
    }
    if (params.confidence < 0 || params.confidence > 1) {
      throw new ValidationError('EvidenceBundle confidence must be between 0 and 1', { field: 'confidence', receivedValue: params.confidence, min: 0, max: 1 });
    }
    if (params.riskScore < 0 || params.riskScore > 1) {
      throw new ValidationError('EvidenceBundle riskScore must be between 0 and 1', { field: 'riskScore', receivedValue: params.riskScore, min: 0, max: 1 });
    }
    this.id = params.id;
    this.claim = params.claim;
    this.rawDataRefs = Object.freeze([...params.rawDataRefs]);
    this.verificationSteps = Object.freeze([...params.verificationSteps]);
    this.confidence = params.confidence;
    this.riskScore = params.riskScore;
    this.createdAt = params.createdAt ?? new Date();
    this.bundleHash = params.bundleHash ?? this.computeHash();
    Object.freeze(this);
  }

  public computeHash(): string {
    const sortedRefs = [...this.rawDataRefs]
      .sort((a, b) => a.ref.localeCompare(b.ref))
      .map((r) => r.toJSON());

    const sortedSteps = [...this.verificationSteps]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => s.toJSON());

    const canonicalData = {
      claim: this.claim.toJSON(),
      rawDataRefs: sortedRefs,
      verificationSteps: sortedSteps,
      confidence: this.confidence,
      riskScore: this.riskScore
    };

    return createHash('sha256').update(CanonicalJson.stringify(canonicalData)).digest('hex');
  }

  public verify(): ClaimVerificationResult {
    const recomputedHash = this.computeHash();
    if (this.bundleHash === recomputedHash) {
      return new ClaimVerificationResult({
        valid: true,
        reason: 'Bundle hash matches computed hash'
      });
    }
    throw new ProofError('Evidence bundle hash mismatch — bundle may have been tampered with', {
      claimType: this.claim.type,
      bundleId: this.id,
      storedHash: this.bundleHash,
      computedHash: recomputedHash
    });
  }

  public toJSON(): EvidenceBundleJSON {
    return {
      id: this.id,
      claim: this.claim.toJSON(),
      rawDataRefs: this.rawDataRefs.map((r) => r.toJSON()),
      verificationSteps: this.verificationSteps.map((s) => s.toJSON()),
      confidence: this.confidence,
      riskScore: this.riskScore,
      bundleHash: this.bundleHash,
      createdAt: this.createdAt.toISOString()
    };
  }

  public static fromJSON(json: EvidenceBundleJSON): EvidenceBundle {
    return new EvidenceBundle({
      id: json.id,
      claim: Claim.fromJSON(json.claim),
      rawDataRefs: json.rawDataRefs.map((r) => RawDataRef.fromJSON(r)),
      verificationSteps: json.verificationSteps.map((s) => VerificationStep.fromJSON(s)),
      confidence: json.confidence,
      riskScore: json.riskScore,
      bundleHash: json.bundleHash,
      createdAt: new Date(json.createdAt)
    });
  }
}
