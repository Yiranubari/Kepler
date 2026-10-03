import { finalizeEvent } from 'nostr-tools';
import { ClaimType, EvidenceBundle, VerificationStep } from '@kepler/shared';
import { NostrEvent } from '@kepler/nostr';
import {
  NostrClaimBuilder,
  NostrClaimVerifier,
  NostrClaimInput
} from '../../src/modules/proof/claims/nostr.claim';
import { ProofBuildError } from '../../src/modules/proof/proof.errors';

describe('NostrClaimBuilder and NostrClaimVerifier', () => {
  const builder = new NostrClaimBuilder();
  const verifier = new NostrClaimVerifier();
  const fixedNow = 1700000000000;
  const context = { now: fixedNow, scenarioId: 'scenario-nostr-1' };

  const testSecretKey = new Uint8Array(32).fill(1);
  const signedEventTemplate = {
    kind: 1,
    created_at: 1700000000,
    tags: [
      ['t', 'kepler'],
      ['p', '1b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f']
    ],
    content: 'Kepler verifiable Nostr proof claim test payload'
  };

  const rawEvent = finalizeEvent(signedEventTemplate, testSecretKey);
  const validEvent: NostrEvent = {
    id: rawEvent.id,
    pubkey: rawEvent.pubkey,
    createdAt: rawEvent.created_at,
    kind: rawEvent.kind,
    tags: rawEvent.tags,
    content: rawEvent.content,
    sig: rawEvent.sig
  };

  const validInput: NostrClaimInput = {
    event: validEvent,
    rawDataRefs: [
      {
        source: 'Nostr',
        ref: 'relay:wss://relay.example.com',
        payload: { relay: 'wss://relay.example.com', accepted: true }
      }
    ]
  };

  it('builds a nostr claim with a valid signed event and verifies successfully', () => {
    const { bundle } = builder.build(context, validInput);

    expect(bundle.claim.type).toBe(ClaimType.Nostr);
    expect(bundle.confidence).toBe(1.0);
    expect(bundle.riskScore).toBeNull();
    expect(bundle.verificationSteps.length).toBe(1);
    expect(bundle.verificationSteps[0].name).toBe('nostr:signature');
    expect(bundle.rawDataRefs.length).toBe(2);
    expect(bundle.rawDataRefs[0].ref).toBe(validEvent.id);
    expect(bundle.rawDataRefs[1].ref).toBe('relay:wss://relay.example.com');

    const expectedIdPrefix = validEvent.id.slice(0, 8);
    const expectedIdSuffix = validEvent.id.slice(-8);
    const expectedPubkeyPrefix = validEvent.pubkey.slice(0, 8);
    const expectedPubkeySuffix = validEvent.pubkey.slice(-8);

    expect(bundle.claim.text).toBe(
      `Nostr event ${expectedIdPrefix}…${expectedIdSuffix} was published by pubkey ${expectedPubkeyPrefix}…${expectedPubkeySuffix} at ${validEvent.createdAt} with a valid signature.`
    );

    const result = verifier.verify({ bundle });
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('All verification steps passed and bundle hash verified');
  });

  it('fails verification with HASH_MISMATCH when event content is tampered without recomputing hash', () => {
    const { bundle } = builder.build(context, validInput);

    const tamperedContentEvent = {
      ...validEvent,
      content: 'Tampered content payload violating cryptographic signature'
    };

    const tamperedStep = new VerificationStep({
      name: 'nostr:signature',
      endpoint: '/api/proof/verify',
      input: { event: tamperedContentEvent },
      expected: true
    });

    const tamperedBundle = new EvidenceBundle({
      id: bundle.id,
      claim: bundle.claim,
      rawDataRefs: [...bundle.rawDataRefs],
      verificationSteps: [tamperedStep],
      confidence: bundle.confidence,
      riskScore: bundle.riskScore,
      bundleHash: bundle.bundleHash,
      createdAt: bundle.createdAt
    });

    const result = verifier.verify({ bundle: tamperedBundle });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('HASH_MISMATCH');
    expect(result.failedStep).toBe('bundleHash');
    expect(result.expected).toBe(bundle.bundleHash);
    expect(result.actual).toBe(tamperedBundle.computeHash());
  });

  it('fails verification with STEP_FAILED when event content is tampered and hash is recomputed', () => {
    const { bundle } = builder.build(context, validInput);

    const tamperedContentEvent = {
      ...validEvent,
      content: 'Tampered content payload violating cryptographic signature'
    };

    const tamperedStep = new VerificationStep({
      name: 'nostr:signature',
      endpoint: '/api/proof/verify',
      input: { event: tamperedContentEvent },
      expected: true
    });

    const tamperedBundle = new EvidenceBundle({
      id: bundle.id,
      claim: bundle.claim,
      rawDataRefs: [...bundle.rawDataRefs],
      verificationSteps: [tamperedStep],
      confidence: bundle.confidence,
      riskScore: bundle.riskScore,
      createdAt: bundle.createdAt
    });

    const result = verifier.verify({ bundle: tamperedBundle });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('nostr:signature');
    expect(result.expected).toBe('true');
    expect(result.actual).toBe('false');
  });

  it('fails verification when event sig is tampered', () => {
    const { bundle } = builder.build(context, validInput);

    const tamperedSigEvent = {
      ...validEvent,
      sig: '0'.repeat(128)
    };

    const tamperedStep = new VerificationStep({
      name: 'nostr:signature',
      endpoint: '/api/proof/verify',
      input: { event: tamperedSigEvent },
      expected: true
    });

    const tamperedBundle = new EvidenceBundle({
      id: bundle.id,
      claim: bundle.claim,
      rawDataRefs: [...bundle.rawDataRefs],
      verificationSteps: [tamperedStep],
      confidence: bundle.confidence,
      riskScore: bundle.riskScore,
      createdAt: bundle.createdAt
    });

    const result = verifier.verify({ bundle: tamperedBundle });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('nostr:signature');
    expect(result.expected).toBe('true');
    expect(result.actual).toBe('false');
  });

  it('throws ProofBuildError with INVALID_SIGNATURE when building with invalid signature', () => {
    const invalidSigInput: NostrClaimInput = {
      event: {
        ...validEvent,
        sig: '0'.repeat(128)
      },
      rawDataRefs: []
    };

    expect(() => {
      builder.build(context, invalidSigInput);
    }).toThrow(ProofBuildError);

    try {
      builder.build(context, invalidSigInput);
    } catch (error) {
      expect(error).toBeInstanceOf(ProofBuildError);
      const pbe = error as ProofBuildError;
      expect(pbe.context['reason']).toBe('INVALID_SIGNATURE');
      expect(pbe.context['claimType']).toBe(ClaimType.Nostr);
    }
  });

  it('fails verification with HASH_MISMATCH when bundle hash only is tampered', () => {
    const { bundle } = builder.build(context, validInput);

    const tamperedBundle = new EvidenceBundle({
      id: bundle.id,
      claim: bundle.claim,
      rawDataRefs: [...bundle.rawDataRefs],
      verificationSteps: [...bundle.verificationSteps],
      confidence: bundle.confidence,
      riskScore: bundle.riskScore,
      bundleHash: '0000000000000000000000000000000000000000000000000000000000000000',
      createdAt: bundle.createdAt
    });

    const result = verifier.verify({ bundle: tamperedBundle });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('HASH_MISMATCH');
    expect(result.failedStep).toBe('bundleHash');
    expect(result.expected).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(result.actual).toBe(bundle.bundleHash);
  });

  it('determinism: building twice with identical now produces identical bundleHash', () => {
    const buildOne = builder.build(context, validInput);
    const buildTwo = builder.build(context, validInput);

    expect(buildOne.bundle.bundleHash).toBe(buildTwo.bundle.bundleHash);
  });

  it('preserves bundle hash across serialization and deserialization round-trip', async () => {
    const { bundle } = builder.build({ now: 1000, scenarioId: 'scenario-nostr-rt' }, validInput);
    const json = bundle.toJSON();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const deserialized = EvidenceBundle.fromJSON(json);
    expect(deserialized.computeHash()).toBe(bundle.bundleHash);
    const result = verifier.verify({ bundle: deserialized });
    expect(result.valid).toBe(true);
  });

  it('produces identical hash for same now and different hash for different now', () => {
    const buildA = builder.build({ now: 1000, scenarioId: 'scenario-nostr-1' }, validInput);
    const buildB = builder.build({ now: 1000, scenarioId: 'scenario-nostr-1' }, validInput);
    const buildC = builder.build({ now: 2000, scenarioId: 'scenario-nostr-1' }, validInput);

    expect(buildA.bundle.bundleHash).toBe(buildB.bundle.bundleHash);
    expect(buildA.bundle.bundleHash).not.toBe(buildC.bundle.bundleHash);
  });
});
