import {
  AIPrompt,
  TaintGraphExplanationInput,
  EvidenceSummaryInput,
  RouteSuggestionInput
} from '../../src/modules/ai/ai.prompt';

describe('AIPrompt', () => {
  const fullHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const fullInvoice = 'lnbc100u1p3x0d47pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgq';

  it('explainTaintGraph truncates hashes and invoices', () => {
    const input: TaintGraphExplanationInput = {
      scenarioKind: 'Lightning',
      nodeCount: 2,
      edgeCount: 1,
      topEdges: [
        {
          relationship: 'pays',
          confidence: 0.95,
          fromType: 'Invoice',
          toType: 'PaymentHash',
          fromIdTruncated: fullInvoice,
          toIdTruncated: fullHash
        }
      ],
      topPaths: [
        {
          length: 2,
          overallConfidence: 0.95,
          nodeTypes: ['Invoice', 'PaymentHash']
        }
      ]
    };

    const prompt = AIPrompt.explainTaintGraph(input);
    expect(prompt.user).toContain('e3b0c442…7852b855');
    expect(prompt.user).not.toContain(fullHash);
    expect(prompt.user).not.toContain(fullInvoice);
  });

  it('explainTaintGraph includes only the top 5 edges and top 5 paths', () => {
    const topEdges = Array.from({ length: 8 }, (_, i) => ({
      relationship: `rel-${i}`,
      confidence: 0.9 - i * 0.05,
      fromType: 'Txid',
      toType: 'Address',
      fromIdTruncated: `from-id-${i}`,
      toIdTruncated: `to-id-${i}`
    }));

    const topPaths = Array.from({ length: 8 }, (_, i) => ({
      length: 2,
      overallConfidence: 0.9 - i * 0.05,
      nodeTypes: ['Txid', 'Address']
    }));

    const input: TaintGraphExplanationInput = {
      scenarioKind: 'Bitcoin',
      nodeCount: 16,
      edgeCount: 8,
      topEdges,
      topPaths
    };

    const prompt = AIPrompt.explainTaintGraph(input);
    expect(prompt.user).toContain('1. Relationship: rel-0');
    expect(prompt.user).toContain('5. Relationship: rel-4');
    expect(prompt.user).not.toContain('6. Relationship: rel-5');

    expect(prompt.user).toContain('1. Length: 2, Overall Confidence: 0.9');
    expect(prompt.user).toContain('5. Length: 2, Overall Confidence: 0.7');
    expect(prompt.user).not.toContain('6. Length: 2, Overall Confidence: 0.65');
  });

  it('explainTaintGraph never includes a preimage', () => {
    const rawSecret = 'secret_preimage_value_9876543210';
    const input: TaintGraphExplanationInput = {
      scenarioKind: 'Lightning',
      nodeCount: 2,
      edgeCount: 1,
      topEdges: [
        {
          relationship: 'reveals',
          confidence: 0.99,
          fromType: 'PaymentHash',
          toType: 'Preimage',
          fromIdTruncated: 'hash12345678',
          toIdTruncated: 'preimage1234'
        }
      ],
      topPaths: [
        {
          length: 2,
          overallConfidence: 0.99,
          nodeTypes: ['PaymentHash', 'Preimage']
        }
      ]
    };

    const prompt = AIPrompt.explainTaintGraph(input);
    expect(prompt.user).not.toContain(rawSecret);
  });

  it('summarizeEvidence truncates raw data refs', () => {
    const input: EvidenceSummaryInput = {
      claimType: 'Transaction',
      claimText: 'Payment confirmed onchain',
      confidence: 0.95,
      rawDataRefs: [
        {
          source: 'Esplora',
          refTruncated: fullHash
        }
      ],
      verificationStepNames: ['VerifyTxConfirmations'],
      valid: true
    };

    const prompt = AIPrompt.summarizeEvidence(input);
    expect(prompt.user).toContain('e3b0c442…7852b855');
    expect(prompt.user).not.toContain(fullHash);
  });

  it('suggestRoute truncates the payment target', () => {
    const inputLightning: RouteSuggestionInput = {
      paymentTargetKind: 'Lightning',
      paymentTargetTruncated: fullInvoice,
      candidateRoutes: [
        {
          name: 'Direct Channel',
          protocol: 'Lightning',
          estimatedFeeSats: 25,
          estimatedLinkageConfidence: 0.1
        }
      ],
      constraints: {
        maxFeeSats: 100,
        requireNonCustodial: true
      }
    };

    const promptLightning = AIPrompt.suggestRoute(inputLightning);
    expect(promptLightning.user).not.toContain(fullInvoice);
    expect(promptLightning.user).toContain('…');

    const inputBitcoin: RouteSuggestionInput = {
      paymentTargetKind: 'Bitcoin',
      paymentTargetTruncated: fullHash,
      candidateRoutes: [
        {
          name: 'Onchain Standard',
          protocol: 'Bitcoin',
          estimatedFeeSats: 500,
          estimatedLinkageConfidence: 0.2
        }
      ],
      constraints: {
        maxFeeSats: 1000,
        requireNonCustodial: true
      }
    };

    const promptBitcoin = AIPrompt.suggestRoute(inputBitcoin);
    expect(promptBitcoin.user).not.toContain(fullHash);
    expect(promptBitcoin.user).toContain('e3b0c442…7852b855');
  });

  it('ensures no prompt contains the string preimage with a value longer than 4 characters', () => {
    const explainInput: TaintGraphExplanationInput = {
      scenarioKind: 'Lightning',
      nodeCount: 1,
      edgeCount: 0,
      topEdges: [],
      topPaths: []
    };
    const evidenceInput: EvidenceSummaryInput = {
      claimType: 'Lightning',
      claimText: 'Settled invoice',
      confidence: 1.0,
      rawDataRefs: [],
      verificationStepNames: [],
      valid: true
    };
    const routeInput: RouteSuggestionInput = {
      paymentTargetKind: 'Lightning',
      paymentTargetTruncated: 'lnbc100u',
      candidateRoutes: [],
      constraints: { maxFeeSats: null, requireNonCustodial: false }
    };

    const p1 = AIPrompt.explainTaintGraph(explainInput).user;
    const p2 = AIPrompt.summarizeEvidence(evidenceInput).user;
    const p3 = AIPrompt.suggestRoute(routeInput).user;

    const preimagePattern = /preimage[:=_\s][a-zA-Z0-9]{5,}/i;
    expect(preimagePattern.test(p1)).toBe(false);
    expect(preimagePattern.test(p2)).toBe(false);
    expect(preimagePattern.test(p3)).toBe(false);
  });
});
