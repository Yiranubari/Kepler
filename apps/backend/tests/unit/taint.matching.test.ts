import { TaintGraph, TaintNode, TaintNodeType } from '@kepler/shared';
import { TaintConfig } from '../../src/modules/taint/taint.types';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import {
  matchesPaymentHash,
  matchesPreimage,
  matchesPubkey,
  matchesMintUrl,
  matchesQuoteHash,
  matchesTemporalWindow,
  extractQuoteHashesFromRequest
} from '../../src/shared/taintMatching';
import { SamePaymentHashRule } from '../../src/modules/taint/rules/samePaymentHash.rule';
import { SamePreimageRule } from '../../src/modules/taint/rules/samePreimage.rule';
import { PublishedByRule } from '../../src/modules/taint/rules/publishedBy.rule';
import { SharedMintRule } from '../../src/modules/taint/rules/sharedMint.rule';
import { CashuQuoteInvoiceRule } from '../../src/modules/taint/rules/cashuQuoteInvoice.rule';
import {
  TaintCorrelationClaimBuilder,
  TaintCorrelationClaimVerifier
} from '../../src/modules/proof/claims/taintCorrelation.claim';

describe('TaintMatching pure predicates', () => {
  const hash = 'a'.repeat(64);
  const preimage = 'b'.repeat(64);
  const pubkey = 'c'.repeat(64);
  const mintUrl = 'https://mint.example.com';

  describe('matchesPaymentHash', () => {
    it('matches when hash is substring in content', () => {
      const result = matchesPaymentHash(`payment hash: ${hash}`, [], hash);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('content');
    });

    it('matches case-insensitively in content', () => {
      const result = matchesPaymentHash(`payment hash: ${hash.toUpperCase()}`, [], hash);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('content');
    });

    it('matches exact hash in tags', () => {
      const result = matchesPaymentHash('', [['r', hash]], hash);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('tags');
    });

    it('matches exact hash case-insensitively in tags', () => {
      const result = matchesPaymentHash('', [['r', hash.toUpperCase()]], hash);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('tags');
    });

    it('rejects near-miss when tag contains hash only as substring', () => {
      const result = matchesPaymentHash('', [['r', `prefix_${hash}_suffix`]], hash);
      expect(result.matched).toBe(false);
      expect(result.field).toBeNull();
    });

    it('rejects when hash is absent from both content and tags', () => {
      const result = matchesPaymentHash('unrelated text', [['p', 'other']], hash);
      expect(result.matched).toBe(false);
      expect(result.field).toBeNull();
    });
  });

  describe('matchesPreimage', () => {
    it('matches when preimage is substring in content', () => {
      const result = matchesPreimage(`preimage: ${preimage}`, [], preimage);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('content');
    });

    it('matches case-insensitively in content', () => {
      const result = matchesPreimage(`preimage: ${preimage.toUpperCase()}`, [], preimage);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('content');
    });

    it('matches exact preimage in tags', () => {
      const result = matchesPreimage('', [['preimage', preimage]], preimage);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('tags');
    });

    it('rejects near-miss when tag contains preimage only as substring', () => {
      const result = matchesPreimage('', [['preimage', `not_${preimage}`]], preimage);
      expect(result.matched).toBe(false);
      expect(result.field).toBeNull();
    });

    it('rejects when preimage is absent', () => {
      const result = matchesPreimage('no match here', [], preimage);
      expect(result.matched).toBe(false);
      expect(result.field).toBeNull();
    });
  });

  describe('matchesPubkey', () => {
    it('matches identical pubkeys case-insensitively', () => {
      expect(matchesPubkey(pubkey, pubkey.toUpperCase())).toBe(true);
    });

    it('matches pubkeys with surrounding whitespace', () => {
      expect(matchesPubkey(`  ${pubkey}  `, pubkey)).toBe(true);
    });

    it('rejects near-miss when one pubkey is prefix of another', () => {
      expect(matchesPubkey(pubkey.slice(0, 63) + 'd', pubkey)).toBe(false);
    });

    it('rejects completely different pubkeys', () => {
      expect(matchesPubkey('1'.repeat(64), '2'.repeat(64))).toBe(false);
    });
  });

  describe('matchesMintUrl', () => {
    it('matches exact mint url in content case-sensitively', () => {
      const result = matchesMintUrl(`uses ${mintUrl} for minting`, [], mintUrl);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('content');
    });

    it('matches exact mint url in tags', () => {
      const result = matchesMintUrl('', [['mint', mintUrl]], mintUrl);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('tags');
    });

    it('normalizes trailing slashes before matching', () => {
      const result = matchesMintUrl(`uses ${mintUrl}`, [], `${mintUrl}///`);
      expect(result.matched).toBe(true);
      expect(result.field).toBe('content');
    });

    it('rejects near-miss when tag has mint url as substring only', () => {
      const result = matchesMintUrl('', [['mint', `${mintUrl}/v1/api`]], mintUrl);
      expect(result.matched).toBe(false);
      expect(result.field).toBeNull();
    });

    it('rejects near-miss with different case in content', () => {
      const result = matchesMintUrl(`uses ${mintUrl.toUpperCase()}`, [], mintUrl);
      expect(result.matched).toBe(false);
      expect(result.field).toBeNull();
    });

    it('rejects when mint url is completely absent', () => {
      const result = matchesMintUrl('no mint here', [], mintUrl);
      expect(result.matched).toBe(false);
      expect(result.field).toBeNull();
    });
  });

  describe('matchesQuoteHash', () => {
    it('matches exact quote hash in array case-insensitively', () => {
      expect(matchesQuoteHash([hash], hash.toUpperCase())).toBe(true);
    });

    it('rejects near-miss when quote hash is substring in array', () => {
      expect(matchesQuoteHash([`prefix_${hash}`], hash)).toBe(false);
    });

    it('rejects when quote hash is absent from array', () => {
      expect(matchesQuoteHash(['b'.repeat(64)], hash)).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(matchesQuoteHash([], hash)).toBe(false);
    });
  });

  describe('matchesTemporalWindow', () => {
    it('matches when delta is strictly less than windowSeconds', () => {
      expect(matchesTemporalWindow(1000, 1050, 60)).toBe(true);
    });

    it('rejects near-miss when delta equals windowSeconds exactly', () => {
      expect(matchesTemporalWindow(1000, 1060, 60)).toBe(false);
    });

    it('rejects when delta exceeds windowSeconds', () => {
      expect(matchesTemporalWindow(1000, 1200, 60)).toBe(false);
    });
  });

  describe('extractQuoteHashesFromRequest', () => {
    it('extracts 64-hex hash embedded within a request string', () => {
      const result = extractQuoteHashesFromRequest(`lnbc10u1p${hash}sampleinvoice`);
      expect(result).toEqual([hash]);
    });

    it('extracts and normalizes uppercase 64-hex hash to lowercase', () => {
      const result = extractQuoteHashesFromRequest(`lnbc10u1p${hash.toUpperCase()}sampleinvoice`);
      expect(result).toEqual([hash.toLowerCase()]);
    });

    it('extracts standalone 64-hex hash', () => {
      const result = extractQuoteHashesFromRequest(hash);
      expect(result).toEqual([hash]);
    });

    it('returns empty array when no 64-hex substring is present', () => {
      const result = extractQuoteHashesFromRequest('not-a-valid-hex-hash');
      expect(result).toEqual([]);
    });

    it('returns empty array when hex string is only 63 characters', () => {
      const result = extractQuoteHashesFromRequest(hash.slice(0, 63));
      expect(result).toEqual([]);
    });

    it('returns empty array for empty or whitespace request', () => {
      expect(extractQuoteHashesFromRequest('')).toEqual([]);
      expect(extractQuoteHashesFromRequest('   ')).toEqual([]);
    });
  });
});

describe('Meta-test: Rule and Verifier alignment across 1-byte mutations', () => {
  const config = new TaintConfig();
  const scorer = new TaintScorer();
  const now = 1700000000000;
  const buildContext = { now, scenarioId: 'meta-test-scenario' };
  const builder = new TaintCorrelationClaimBuilder();
  const verifier = new TaintCorrelationClaimVerifier();

  it('SamePaymentHashRule: produces edge, bundle verifies, 1-byte mutation fails both', () => {
    const rule = new SamePaymentHashRule();
    const paymentHash = 'a'.repeat(64);
    const eventId = 'e'.repeat(64);

    const validGraph = new TaintGraph({
      id: 'g-valid-payment-hash',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHash}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHash
        }),
        new TaintNode({
          id: `event_id:${eventId}`,
          type: TaintNodeType.EventId,
          value: eventId,
          metadata: {
            content: `paid invoice with hash: ${paymentHash}`,
            tags: []
          }
        })
      ]
    });

    const ruleResult = rule.apply({ graph: validGraph, config, scorer, now });
    expect(ruleResult.edges).toHaveLength(1);
    const edge = ruleResult.edges[0];

    const { bundle: validBundle } = builder.build(buildContext, {
      fromNodeId: `payment_hash:${paymentHash}`,
      toNodeId: `event_id:${eventId}`,
      relationship: 'SAME_PAYMENT_HASH',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Lightning',
          ref: `payment_hash:${paymentHash}`,
          payload: { paymentHash }
        },
        {
          source: 'Nostr',
          ref: eventId,
          payload: {
            id: eventId,
            pubkey: 'f'.repeat(64),
            content: `paid invoice with hash: ${paymentHash}`,
            tags: []
          }
        }
      ]
    });

    const validVerification = verifier.verify({ bundle: validBundle });
    expect(validVerification.valid).toBe(true);

    const mutatedHash = paymentHash.slice(0, 63) + 'b';
    const mutatedGraph = new TaintGraph({
      id: 'g-mutated-payment-hash',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHash}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHash
        }),
        new TaintNode({
          id: `event_id:${eventId}`,
          type: TaintNodeType.EventId,
          value: eventId,
          metadata: {
            content: `paid invoice with hash: ${mutatedHash}`,
            tags: []
          }
        })
      ]
    });

    const mutatedRuleResult = rule.apply({ graph: mutatedGraph, config, scorer, now });
    expect(mutatedRuleResult.edges).toHaveLength(0);

    const { bundle: mutatedBundle } = builder.build(buildContext, {
      fromNodeId: `payment_hash:${paymentHash}`,
      toNodeId: `event_id:${eventId}`,
      relationship: 'SAME_PAYMENT_HASH',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Lightning',
          ref: `payment_hash:${paymentHash}`,
          payload: { paymentHash }
        },
        {
          source: 'Nostr',
          ref: eventId,
          payload: {
            id: eventId,
            pubkey: 'f'.repeat(64),
            content: `paid invoice with hash: ${mutatedHash}`,
            tags: []
          }
        }
      ]
    });

    const mutatedVerification = verifier.verify({ bundle: mutatedBundle });
    expect(mutatedVerification.valid).toBe(false);
  });

  it('SamePreimageRule: produces edge, bundle verifies, 1-byte mutation fails both', () => {
    const rule = new SamePreimageRule();
    const preimage = 'b'.repeat(64);
    const eventId = 'e'.repeat(64);

    const validGraph = new TaintGraph({
      id: 'g-valid-preimage',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimage}`,
          type: TaintNodeType.Preimage,
          value: preimage
        }),
        new TaintNode({
          id: `event_id:${eventId}`,
          type: TaintNodeType.EventId,
          value: eventId,
          metadata: {
            content: `preimage reveal: ${preimage}`,
            tags: []
          }
        })
      ]
    });

    const ruleResult = rule.apply({ graph: validGraph, config, scorer, now });
    expect(ruleResult.edges).toHaveLength(1);
    const edge = ruleResult.edges[0];

    const { bundle: validBundle } = builder.build(buildContext, {
      fromNodeId: `preimage:${preimage}`,
      toNodeId: `event_id:${eventId}`,
      relationship: 'SAME_PREIMAGE',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Lightning',
          ref: `preimage:${preimage}`,
          payload: { preimage }
        },
        {
          source: 'Nostr',
          ref: eventId,
          payload: {
            id: eventId,
            pubkey: 'f'.repeat(64),
            content: `preimage reveal: ${preimage}`,
            tags: []
          }
        }
      ]
    });

    const validVerification = verifier.verify({ bundle: validBundle });
    expect(validVerification.valid).toBe(true);

    const mutatedPreimage = preimage.slice(0, 63) + 'c';
    const mutatedGraph = new TaintGraph({
      id: 'g-mutated-preimage',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimage}`,
          type: TaintNodeType.Preimage,
          value: preimage
        }),
        new TaintNode({
          id: `event_id:${eventId}`,
          type: TaintNodeType.EventId,
          value: eventId,
          metadata: {
            content: `preimage reveal: ${mutatedPreimage}`,
            tags: []
          }
        })
      ]
    });

    const mutatedRuleResult = rule.apply({ graph: mutatedGraph, config, scorer, now });
    expect(mutatedRuleResult.edges).toHaveLength(0);

    const { bundle: mutatedBundle } = builder.build(buildContext, {
      fromNodeId: `preimage:${preimage}`,
      toNodeId: `event_id:${eventId}`,
      relationship: 'SAME_PREIMAGE',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Lightning',
          ref: `preimage:${preimage}`,
          payload: { preimage }
        },
        {
          source: 'Nostr',
          ref: eventId,
          payload: {
            id: eventId,
            pubkey: 'f'.repeat(64),
            content: `preimage reveal: ${mutatedPreimage}`,
            tags: []
          }
        }
      ]
    });

    const mutatedVerification = verifier.verify({ bundle: mutatedBundle });
    expect(mutatedVerification.valid).toBe(false);
  });

  it('PublishedByRule: produces edge, bundle verifies, 1-byte mutation fails both', () => {
    const rule = new PublishedByRule();
    const pubkey = 'c'.repeat(64);
    const eventId = 'e'.repeat(64);

    const validGraph = new TaintGraph({
      id: 'g-valid-published',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `pubkey:${pubkey}`,
          type: TaintNodeType.Pubkey,
          value: pubkey
        }),
        new TaintNode({
          id: `event_id:${eventId}`,
          type: TaintNodeType.EventId,
          value: eventId,
          metadata: {
            pubkey
          }
        })
      ]
    });

    const ruleResult = rule.apply({ graph: validGraph, config, scorer, now });
    expect(ruleResult.edges).toHaveLength(1);
    const edge = ruleResult.edges[0];

    const { bundle: validBundle } = builder.build(buildContext, {
      fromNodeId: `event_id:${eventId}`,
      toNodeId: `pubkey:${pubkey}`,
      relationship: 'PUBLISHED_BY',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Nostr',
          ref: eventId,
          payload: {
            id: eventId,
            pubkey,
            content: 'test',
            tags: []
          }
        },
        {
          source: 'Nostr',
          ref: `pubkey:${pubkey}`,
          payload: { pubkey }
        }
      ]
    });

    const validVerification = verifier.verify({ bundle: validBundle });
    expect(validVerification.valid).toBe(true);

    const mutatedPubkey = pubkey.slice(0, 63) + 'd';
    const mutatedGraph = new TaintGraph({
      id: 'g-mutated-published',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `pubkey:${pubkey}`,
          type: TaintNodeType.Pubkey,
          value: pubkey
        }),
        new TaintNode({
          id: `event_id:${eventId}`,
          type: TaintNodeType.EventId,
          value: eventId,
          metadata: {
            pubkey: mutatedPubkey
          }
        })
      ]
    });

    const mutatedRuleResult = rule.apply({ graph: mutatedGraph, config, scorer, now });
    expect(mutatedRuleResult.edges).toHaveLength(0);

    const { bundle: mutatedBundle } = builder.build(buildContext, {
      fromNodeId: `event_id:${eventId}`,
      toNodeId: `pubkey:${pubkey}`,
      relationship: 'PUBLISHED_BY',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Nostr',
          ref: eventId,
          payload: {
            id: eventId,
            pubkey: mutatedPubkey,
            content: 'test',
            tags: []
          }
        },
        {
          source: 'Nostr',
          ref: `pubkey:${pubkey}`,
          payload: { pubkey }
        }
      ]
    });

    const mutatedVerification = verifier.verify({ bundle: mutatedBundle });
    expect(mutatedVerification.valid).toBe(false);
  });

  it('SharedMintRule: produces edge, bundle verifies, 1-byte mutation fails both', () => {
    const rule = new SharedMintRule();
    const mintUrl = 'https://mint.example.com';
    const tokenId = 'cashu_token_1';
    const eventId = 'e'.repeat(64);

    const validGraph = new TaintGraph({
      id: 'g-valid-shared-mint',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrl}`,
          type: TaintNodeType.Mint,
          value: mintUrl
        }),
        new TaintNode({
          id: `cashu_token:${tokenId}`,
          type: TaintNodeType.CashuToken,
          value: tokenId,
          metadata: { mint: mintUrl }
        }),
        new TaintNode({
          id: `event_id:${eventId}`,
          type: TaintNodeType.EventId,
          value: eventId,
          metadata: {
            content: `token issued from ${mintUrl} for test`,
            tags: []
          }
        })
      ]
    });

    const ruleResult = rule.apply({ graph: validGraph, config, scorer, now });
    expect(ruleResult.edges).toHaveLength(1);
    const edge = ruleResult.edges[0];

    const { bundle: validBundle } = builder.build(buildContext, {
      fromNodeId: `mint:${mintUrl}`,
      toNodeId: `event_id:${eventId}`,
      relationship: 'SHARED_MINT',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Nostr',
          ref: eventId,
          payload: {
            id: eventId,
            pubkey: 'f'.repeat(64),
            content: `token issued from ${mintUrl} for test`,
            tags: []
          }
        },
        {
          source: 'Cashu',
          ref: `mint:${mintUrl}`,
          payload: { mint: mintUrl }
        }
      ]
    });

    const validVerification = verifier.verify({ bundle: validBundle });
    expect(validVerification.valid).toBe(true);

    const mutatedMintUrl = 'https://mint.example.org';
    const mutatedGraph = new TaintGraph({
      id: 'g-mutated-shared-mint',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrl}`,
          type: TaintNodeType.Mint,
          value: mintUrl
        }),
        new TaintNode({
          id: `cashu_token:${tokenId}`,
          type: TaintNodeType.CashuToken,
          value: tokenId,
          metadata: { mint: mintUrl }
        }),
        new TaintNode({
          id: `event_id:${eventId}`,
          type: TaintNodeType.EventId,
          value: eventId,
          metadata: {
            content: `token issued from ${mutatedMintUrl} for test`,
            tags: []
          }
        })
      ]
    });

    const mutatedRuleResult = rule.apply({ graph: mutatedGraph, config, scorer, now });
    expect(mutatedRuleResult.edges).toHaveLength(0);

    const { bundle: mutatedBundle } = builder.build(buildContext, {
      fromNodeId: `mint:${mintUrl}`,
      toNodeId: `event_id:${eventId}`,
      relationship: 'SHARED_MINT',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Nostr',
          ref: eventId,
          payload: {
            id: eventId,
            pubkey: 'f'.repeat(64),
            content: `token issued from ${mutatedMintUrl} for test`,
            tags: []
          }
        },
        {
          source: 'Cashu',
          ref: `mint:${mintUrl}`,
          payload: { mint: mintUrl }
        }
      ]
    });

    const mutatedVerification = verifier.verify({ bundle: mutatedBundle });
    expect(mutatedVerification.valid).toBe(false);
  });

  it('CashuQuoteInvoiceRule: produces edge, bundle verifies, 1-byte mutation fails both', () => {
    const rule = new CashuQuoteInvoiceRule();
    const paymentHash = 'd'.repeat(64);
    const mintUrl = 'https://mint.example.com';

    const validGraph = new TaintGraph({
      id: 'g-valid-quote-invoice',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrl}`,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: {
            quoteHashes: [paymentHash]
          }
        }),
        new TaintNode({
          id: `payment_hash:${paymentHash}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHash
        })
      ]
    });

    const ruleResult = rule.apply({ graph: validGraph, config, scorer, now });
    expect(ruleResult.edges).toHaveLength(1);
    const edge = ruleResult.edges[0];

    const { bundle: validBundle } = builder.build(buildContext, {
      fromNodeId: `mint:${mintUrl}`,
      toNodeId: `payment_hash:${paymentHash}`,
      relationship: 'CASHU_QUOTE_INVOICE',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Cashu',
          ref: `quote:${paymentHash}`,
          payload: { quoteHashes: [paymentHash] }
        },
        {
          source: 'Lightning',
          ref: `payment_hash:${paymentHash}`,
          payload: { paymentHash }
        }
      ]
    });

    const validVerification = verifier.verify({ bundle: validBundle });
    expect(validVerification.valid).toBe(true);

    const mutatedHash = paymentHash.slice(0, 63) + 'e';
    const mutatedGraph = new TaintGraph({
      id: 'g-mutated-quote-invoice',
      scenarioId: 'meta-test-scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrl}`,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: {
            quoteHashes: [mutatedHash]
          }
        }),
        new TaintNode({
          id: `payment_hash:${paymentHash}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHash
        })
      ]
    });

    const mutatedRuleResult = rule.apply({ graph: mutatedGraph, config, scorer, now });
    expect(mutatedRuleResult.edges).toHaveLength(0);

    const { bundle: mutatedBundle } = builder.build(buildContext, {
      fromNodeId: `mint:${mintUrl}`,
      toNodeId: `payment_hash:${paymentHash}`,
      relationship: 'CASHU_QUOTE_INVOICE',
      confidence: edge.confidence,
      edgeEvidence: edge.evidence.map((e) => e.toJSON()),
      rawDataRefs: [
        {
          source: 'Cashu',
          ref: `quote:${mutatedHash}`,
          payload: { quoteHashes: [mutatedHash] }
        },
        {
          source: 'Lightning',
          ref: `payment_hash:${paymentHash}`,
          payload: { paymentHash }
        }
      ]
    });

    const mutatedVerification = verifier.verify({ bundle: mutatedBundle });
    expect(mutatedVerification.valid).toBe(false);
  });
});
