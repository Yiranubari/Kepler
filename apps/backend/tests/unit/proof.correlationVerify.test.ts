import {
  EvidenceBundle,
  RawDataRef
} from '@kepler/shared';
import {
  TaintCorrelationClaimBuilder,
  TaintCorrelationClaimVerifier
} from '../../src/modules/proof/claims/taintCorrelation.claim';

describe('Taint Correlation Verify', () => {
  const builder = new TaintCorrelationClaimBuilder();
  const verifier = new TaintCorrelationClaimVerifier();
  const context = {
    now: 1710000000000,
    scenarioId: 'scenario-corr-verify'
  };

  const paymentHash = 'a'.repeat(64);
  const baseInput = {
    fromNodeId: `payment_hash:${paymentHash}`,
    toNodeId: 'event:nostr-verify-1',
    relationship: 'SAME_PAYMENT_HASH',
    confidence: 0.9,
    edgeEvidence: [
      {
        kind: 'RawData',
        ref: 'nostr-verify-1',
        description: 'Payment hash match',
        data: { field: 'content' }
      }
    ],
    rawDataRefs: [
      {
        source: 'Lightning' as const,
        ref: `payment_hash:${paymentHash}`,
        payload: { paymentHash }
      },
      {
        source: 'Nostr' as const,
        ref: 'nostr-verify-1',
        payload: {
          id: 'nostr-verify-1',
          pubkey: 'b'.repeat(64),
          content: `invoice hash: ${paymentHash}`,
          tags: []
        }
      }
    ]
  };

  it('builds a SAME_PAYMENT_HASH bundle, verifies it, and asserts valid: true', () => {
    const { bundle } = builder.build(context, baseInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(true);
    expect(result.reason).toContain('verified');
  });

  it('tampers rawDataRefs[0].payload (changes one byte) and asserts HASH_MISMATCH', () => {
    const { bundle } = builder.build(context, baseInput);

    const tamperedRef = new RawDataRef({
      source: bundle.rawDataRefs[0].source,
      ref: bundle.rawDataRefs[0].ref,
      payload: { paymentHash: 'b' + paymentHash.slice(1) },
      fetchedAt: bundle.rawDataRefs[0].fetchedAt
    });

    const tamperedBundle = new EvidenceBundle({
      id: bundle.id,
      claim: bundle.claim,
      rawDataRefs: [tamperedRef, bundle.rawDataRefs[1]],
      verificationSteps: [...bundle.verificationSteps],
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

  it('replaces Nostr content so it lacks payment hash and asserts STEP_FAILED with failedStep', () => {
    const alteredInput = {
      ...baseInput,
      rawDataRefs: [
        baseInput.rawDataRefs[0],
        {
          source: 'Nostr' as const,
          ref: 'nostr-verify-1',
          payload: {
            id: 'nostr-verify-1',
            pubkey: 'b'.repeat(64),
            content: 'completely different content without payment hash',
            tags: []
          }
        }
      ]
    };

    const { bundle } = builder.build(context, alteredInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('SAME_PAYMENT_HASH:recompute');
  });

  it('removes a RawDataRef and asserts MISSING_RAW_DATA', () => {
    const missingRefInput = {
      ...baseInput,
      rawDataRefs: [baseInput.rawDataRefs[0]]
    };

    const { bundle } = builder.build(context, missingRefInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MISSING_RAW_DATA');
    expect(result.failedStep).toBe('SAME_PAYMENT_HASH:recompute');
  });

  it('rejects SAME_PAYMENT_HASH verification when tag contains hash only as substring', () => {
    const substringInput = {
      ...baseInput,
      rawDataRefs: [
        baseInput.rawDataRefs[0],
        {
          source: 'Nostr' as const,
          ref: 'nostr-verify-1',
          payload: {
            id: 'nostr-verify-1',
            pubkey: 'b'.repeat(64),
            content: '',
            tags: [['r', `not_${paymentHash}_really`]]
          }
        }
      ]
    };

    const { bundle } = builder.build(context, substringInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('SAME_PAYMENT_HASH:recompute');
  });

  it('verifies SAME_PAYMENT_HASH when tag matches payment hash exactly', () => {
    const exactTagInput = {
      ...baseInput,
      rawDataRefs: [
        baseInput.rawDataRefs[0],
        {
          source: 'Nostr' as const,
          ref: 'nostr-verify-1',
          payload: {
            id: 'nostr-verify-1',
            pubkey: 'b'.repeat(64),
            content: '',
            tags: [['r', paymentHash]]
          }
        }
      ]
    };

    const { bundle } = builder.build(context, exactTagInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(true);
  });

  it('verifies SAME_PAYMENT_HASH when content contains payment hash substring', () => {
    const substringContentInput = {
      ...baseInput,
      rawDataRefs: [
        baseInput.rawDataRefs[0],
        {
          source: 'Nostr' as const,
          ref: 'nostr-verify-1',
          payload: {
            id: 'nostr-verify-1',
            pubkey: 'b'.repeat(64),
            content: `invoice hash: ${paymentHash}`,
            tags: []
          }
        }
      ]
    };

    const { bundle } = builder.build(context, substringContentInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(true);
  });

  it('rejects SAME_PREIMAGE verification when tag contains preimage only as substring', () => {
    const preimage = 'c'.repeat(64);
    const preimageSubstringInput = {
      fromNodeId: `preimage:${preimage}`,
      toNodeId: 'event:nostr-verify-preimage',
      relationship: 'SAME_PREIMAGE',
      confidence: 0.95,
      edgeEvidence: [
        {
          kind: 'RawData',
          ref: 'nostr-verify-preimage',
          description: 'Preimage match',
          data: { field: 'tags' }
        }
      ],
      rawDataRefs: [
        {
          source: 'Lightning' as const,
          ref: `preimage:${preimage}`,
          payload: { preimage }
        },
        {
          source: 'Nostr' as const,
          ref: 'nostr-verify-preimage',
          payload: {
            id: 'nostr-verify-preimage',
            pubkey: 'b'.repeat(64),
            content: '',
            tags: [['preimage', `prefix_${preimage}_suffix`]]
          }
        }
      ]
    };

    const { bundle } = builder.build(context, preimageSubstringInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('SAME_PREIMAGE:recompute');
  });

  it('verifies SAME_PREIMAGE when tag matches preimage exactly', () => {
    const preimage = 'c'.repeat(64);
    const preimageExactInput = {
      fromNodeId: `preimage:${preimage}`,
      toNodeId: 'event:nostr-verify-preimage',
      relationship: 'SAME_PREIMAGE',
      confidence: 0.95,
      edgeEvidence: [
        {
          kind: 'RawData',
          ref: 'nostr-verify-preimage',
          description: 'Preimage match',
          data: { field: 'tags' }
        }
      ],
      rawDataRefs: [
        {
          source: 'Lightning' as const,
          ref: `preimage:${preimage}`,
          payload: { preimage }
        },
        {
          source: 'Nostr' as const,
          ref: 'nostr-verify-preimage',
          payload: {
            id: 'nostr-verify-preimage',
            pubkey: 'b'.repeat(64),
            content: '',
            tags: [['preimage', preimage]]
          }
        }
      ]
    };

    const { bundle } = builder.build(context, preimageExactInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(true);
  });

  it('rejects SHARED_MINT verification when tag contains mint URL only as substring', () => {
    const mintUrl = 'https://mint.example.com';
    const mintSubstringInput = {
      fromNodeId: `mint:${mintUrl}`,
      toNodeId: 'event:nostr-verify-mint',
      relationship: 'SHARED_MINT',
      confidence: 0.85,
      edgeEvidence: [
        {
          kind: 'RawData',
          ref: 'nostr-verify-mint',
          description: 'Mint match',
          data: { field: 'tags' }
        }
      ],
      rawDataRefs: [
        {
          source: 'Cashu' as const,
          ref: `mint:${mintUrl}`,
          payload: { mint: mintUrl }
        },
        {
          source: 'Nostr' as const,
          ref: 'nostr-verify-mint',
          payload: {
            id: 'nostr-verify-mint',
            pubkey: 'b'.repeat(64),
            content: '',
            tags: [['mint', `${mintUrl}/extra`]]
          }
        }
      ]
    };

    const { bundle } = builder.build(context, mintSubstringInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('SHARED_MINT:recompute');
  });

  it('verifies SHARED_MINT when tag matches mint URL exactly', () => {
    const mintUrl = 'https://mint.example.com';
    const mintExactInput = {
      fromNodeId: `mint:${mintUrl}`,
      toNodeId: 'event:nostr-verify-mint',
      relationship: 'SHARED_MINT',
      confidence: 0.85,
      edgeEvidence: [
        {
          kind: 'RawData',
          ref: 'nostr-verify-mint',
          description: 'Mint match',
          data: { field: 'tags' }
        }
      ],
      rawDataRefs: [
        {
          source: 'Cashu' as const,
          ref: `mint:${mintUrl}`,
          payload: { mint: mintUrl }
        },
        {
          source: 'Nostr' as const,
          ref: 'nostr-verify-mint',
          payload: {
            id: 'nostr-verify-mint',
            pubkey: 'b'.repeat(64),
            content: '',
            tags: [['mint', mintUrl]]
          }
        }
      ]
    };

    const { bundle } = builder.build(context, mintExactInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(true);
  });

  it('rejects TEMPORAL_WINDOW when delta equals windowSeconds exactly', () => {
    const timestampA = 1710000000;
    const windowSeconds = 3600;
    const timestampB = timestampA + windowSeconds;

    const temporalBoundaryInput = {
      fromNodeId: 'tx:bitcoin-tx-1',
      toNodeId: 'tx:bitcoin-tx-2',
      relationship: 'TEMPORAL_WINDOW',
      confidence: 0.7,
      edgeEvidence: [
        {
          kind: 'RawData',
          ref: 'temporal-1',
          description: 'Temporal match',
          data: { windowSeconds, match: timestampA }
        },
        {
          kind: 'RawData',
          ref: 'temporal-2',
          description: 'Temporal match',
          data: { windowSeconds, match: timestampB }
        }
      ],
      rawDataRefs: [
        {
          source: 'Bitcoin' as const,
          ref: 'temporal-1',
          payload: { blockTime: timestampA }
        },
        {
          source: 'Bitcoin' as const,
          ref: 'temporal-2',
          payload: { blockTime: timestampB }
        }
      ]
    };

    const { bundle } = builder.build(context, temporalBoundaryInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('TEMPORAL_WINDOW:recompute');
    expect(result.expected).toBe('<3600');
    expect(result.actual).toBe('3600');
  });

  it('verifies TEMPORAL_WINDOW when delta is strictly less than windowSeconds', () => {
    const timestampA = 1710000000;
    const windowSeconds = 3600;
    const timestampB = timestampA + windowSeconds - 1;

    const temporalWithinInput = {
      fromNodeId: 'tx:bitcoin-tx-1',
      toNodeId: 'tx:bitcoin-tx-2',
      relationship: 'TEMPORAL_WINDOW',
      confidence: 0.7,
      edgeEvidence: [
        {
          kind: 'RawData',
          ref: 'temporal-1',
          description: 'Temporal match',
          data: { windowSeconds, match: timestampA }
        },
        {
          kind: 'RawData',
          ref: 'temporal-2',
          description: 'Temporal match',
          data: { windowSeconds, match: timestampB }
        }
      ],
      rawDataRefs: [
        {
          source: 'Bitcoin' as const,
          ref: 'temporal-1',
          payload: { blockTime: timestampA }
        },
        {
          source: 'Bitcoin' as const,
          ref: 'temporal-2',
          payload: { blockTime: timestampB }
        }
      ]
    };

    const { bundle } = builder.build(context, temporalWithinInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(true);
  });

  it('rejects CASHU_QUOTE_INVOICE verification when quote hash does not match payment hash exactly', () => {
    const quoteMismatchInput = {
      fromNodeId: 'quote:cashu-quote-1',
      toNodeId: `payment_hash:${paymentHash}`,
      relationship: 'CASHU_QUOTE_INVOICE',
      confidence: 0.99,
      edgeEvidence: [
        {
          kind: 'RawData',
          ref: 'quote-1',
          description: 'Quote invoice match',
          data: {}
        }
      ],
      rawDataRefs: [
        {
          source: 'Cashu' as const,
          ref: 'quote:cashu-quote-1',
          payload: { paymentHash: `prefix_${paymentHash}` }
        },
        {
          source: 'Lightning' as const,
          ref: `payment_hash:${paymentHash}`,
          payload: { paymentHash }
        }
      ]
    };

    const { bundle } = builder.build(context, quoteMismatchInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STEP_FAILED');
    expect(result.failedStep).toBe('CASHU_QUOTE_INVOICE:recompute');
  });

  it('verifies CASHU_QUOTE_INVOICE when quote hash matches payment hash exactly', () => {
    const quoteExactInput = {
      fromNodeId: 'quote:cashu-quote-1',
      toNodeId: `payment_hash:${paymentHash}`,
      relationship: 'CASHU_QUOTE_INVOICE',
      confidence: 0.99,
      edgeEvidence: [
        {
          kind: 'RawData',
          ref: 'quote-1',
          description: 'Quote invoice match',
          data: {}
        }
      ],
      rawDataRefs: [
        {
          source: 'Cashu' as const,
          ref: 'quote:cashu-quote-1',
          payload: { paymentHash }
        },
        {
          source: 'Lightning' as const,
          ref: `payment_hash:${paymentHash}`,
          payload: { paymentHash }
        }
      ]
    };

    const { bundle } = builder.build(context, quoteExactInput);
    const result = verifier.verify({ bundle });

    expect(result.valid).toBe(true);
  });
});

