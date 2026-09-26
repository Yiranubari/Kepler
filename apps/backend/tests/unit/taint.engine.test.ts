import * as crypto from 'crypto';
import {
  EvidenceItem,
  TaintEdge,
  TaintGraph,
  TaintNode,
  TaintNodeType
} from '@kepler/shared';
import { TaintEngine } from '../../src/modules/taint/taint.engine';
import { TaintConfig } from '../../src/modules/taint/taint.types';
import { TaintRuleRegistry } from '../../src/modules/taint/rules/registry';
import { PublishedByRule } from '../../src/modules/taint/rules/publishedBy.rule';
import { SamePaymentHashRule } from '../../src/modules/taint/rules/samePaymentHash.rule';
import { SamePreimageRule } from '../../src/modules/taint/rules/samePreimage.rule';
import { TemporalWindowRule } from '../../src/modules/taint/rules/temporalWindow.rule';
import { SharedMintRule } from '../../src/modules/taint/rules/sharedMint.rule';
import { CashuQuoteInvoiceRule } from '../../src/modules/taint/rules/cashuQuoteInvoice.rule';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import {
  TaintRule,
  TaintRuleContext,
  TaintRuleResult
} from '../../src/modules/taint/rules/rule.interface';
import {
  TaintIngestError,
  TaintRuleError,
  TaintPathError
} from '../../src/modules/taint/taint.errors';

class SingleEdgeFixtureRule implements TaintRule {
  public static readonly maxConfidence = 0.9;
  public readonly name = 'single_fixture_rule';
  public readonly description = 'Emits single edge';
  public readonly relationship = 'CO_SPEND';
  public readonly maxConfidence = SingleEdgeFixtureRule.maxConfidence;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const nodes = context.graph.nodes;
    if (nodes.length < 2) {
      return { edges: [] };
    }
    return {
      edges: [
        {
          from: nodes[0].id,
          to: nodes[1].id,
          relationship: this.relationship,
          confidence: 0.8,
          evidence: [
            new EvidenceItem({
              kind: 'Correlation',
              ref: 'ev_single',
              description: 'Single correlation evidence'
            })
          ]
        }
      ]
    };
  }
}

class MergeRuleA implements TaintRule {
  public static readonly maxConfidence = 0.8;
  public readonly name = 'merge_rule_a';
  public readonly description = 'Merge rule A';
  public readonly relationship = 'CO_SPEND';
  public readonly maxConfidence = MergeRuleA.maxConfidence;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const nodes = context.graph.nodes;
    if (nodes.length < 2) {
      return { edges: [] };
    }
    return {
      edges: [
        {
          from: nodes[0].id,
          to: nodes[1].id,
          relationship: this.relationship,
          confidence: 0.6,
          evidence: [
            new EvidenceItem({
              kind: 'Correlation',
              ref: 'ev_a',
              description: 'Evidence A'
            })
          ]
        }
      ]
    };
  }
}

class MergeRuleB implements TaintRule {
  public static readonly maxConfidence = 0.95;
  public readonly name = 'merge_rule_b';
  public readonly description = 'Merge rule B';
  public readonly relationship = 'CO_SPEND';
  public readonly maxConfidence = MergeRuleB.maxConfidence;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const nodes = context.graph.nodes;
    if (nodes.length < 2) {
      return { edges: [] };
    }
    return {
      edges: [
        {
          from: nodes[0].id,
          to: nodes[1].id,
          relationship: this.relationship,
          confidence: 0.9,
          evidence: [
            new EvidenceItem({
              kind: 'Correlation',
              ref: 'ev_b',
              description: 'Evidence B'
            })
          ]
        }
      ]
    };
  }
}

class OverflowEdgesRule implements TaintRule {
  public static readonly maxConfidence = 0.9;
  public readonly name = 'overflow_edges_rule';
  public readonly description = 'Overflow edges rule';
  public readonly relationship = 'LINK';
  public readonly maxConfidence = OverflowEdgesRule.maxConfidence;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const nodes = context.graph.nodes;
    if (nodes.length < 3) {
      return { edges: [] };
    }
    return {
      edges: [
        {
          from: nodes[0].id,
          to: nodes[1].id,
          relationship: 'REL_1',
          confidence: 0.8,
          evidence: [
            new EvidenceItem({
              kind: 'Correlation',
              ref: 'ref_1',
              description: 'Evidence 1'
            })
          ]
        },
        {
          from: nodes[0].id,
          to: nodes[2].id,
          relationship: 'REL_2',
          confidence: 0.8,
          evidence: [
            new EvidenceItem({
              kind: 'Correlation',
              ref: 'ref_2',
              description: 'Evidence 2'
            })
          ]
        }
      ]
    };
  }
}

describe('TaintEngine', () => {
  let config: TaintConfig;
  let registry: TaintRuleRegistry;
  let scorer: TaintScorer;
  let engine: TaintEngine;

  beforeEach(() => {
    config = new TaintConfig();
    registry = new TaintRuleRegistry();
    scorer = new TaintScorer();
    engine = new TaintEngine(config, registry, scorer);
  });

  test('ingests Bitcoin transaction with two inputs and two outputs and asserts node count', () => {
    engine.ingestBitcoin({
      transactions: [
        {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          blockHeight: 800000,
          blockTime: 1700000000,
          inputs: [
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000001',
              vout: 0,
              address: 'bc1qinputoneaddress000000000000000000000001'
            },
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000002',
              vout: 1,
              address: 'bc1qinputtwoaddress000000000000000000000002'
            }
          ],
          outputs: [
            {
              address: 'bc1qoutputoneaddress00000000000000000000001',
              value: BigInt(50000)
            },
            {
              address: 'bc1qoutputtwoaddress00000000000000000000002',
              value: BigInt(30000)
            }
          ]
        }
      ],
      addresses: []
    });

    expect(engine.getGraph().nodes).toHaveLength(7);
  });

  test('ingests same transaction twice without adding new nodes due to deduplication', () => {
    const payload = {
      transactions: [
        {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          blockHeight: 800000,
          blockTime: 1700000000,
          inputs: [
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000001',
              vout: 0,
              address: 'bc1qinputoneaddress000000000000000000000001'
            },
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000002',
              vout: 1,
              address: 'bc1qinputtwoaddress000000000000000000000002'
            }
          ],
          outputs: [
            {
              address: 'bc1qoutputoneaddress00000000000000000000001',
              value: BigInt(50000)
            },
            {
              address: 'bc1qoutputtwoaddress00000000000000000000002',
              value: BigInt(30000)
            }
          ]
        }
      ],
      addresses: []
    };

    engine.ingestBitcoin(payload);
    expect(engine.getGraph().nodes).toHaveLength(7);

    engine.ingestBitcoin(payload);
    expect(engine.getGraph().nodes).toHaveLength(7);
  });

  test('ingests Lightning invoice and asserts payment hash node exists', () => {
    const paymentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    engine.ingestLightning({
      invoices: [
        {
          bolt11: 'lnbc10u1pj8testinvoice0000000000000000000000000000000000000000000000',
          paymentHash,
          preimage: null,
          amountMsat: BigInt(1000000),
          createdAt: 1700000000,
          expiresAt: 1700003600,
          payeePubkey: '02abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
        }
      ]
    });

    const node = engine.getGraph().getNode(`payment_hash:${paymentHash}`);
    expect(node).toBeDefined();
    expect(node?.id).toBe(`payment_hash:${paymentHash}`);
  });

  test('ingests Nostr event and asserts pubkey node exists', () => {
    const pubkey = '020000000000000000000000000000000000000000000000000000000000000002';
    engine.ingestNostr({
      events: [
        {
          id: 'nostrevent00000000000000000000000000000000000000000000000000000001',
          pubkey,
          kind: 1,
          tags: [],
          content: 'Hello Kepler',
          createdAt: 1700000000
        }
      ]
    });

    const node = engine.getGraph().getNode(`pubkey:${pubkey}`);
    expect(node).toBeDefined();
    expect(node?.id).toBe(`pubkey:${pubkey}`);
  });

  test('ingests Cashu token and asserts mint node exists', () => {
    const mintUrl = 'https://mint.kepler.internal';
    engine.ingestCashu({
      mints: [],
      tokens: [
        {
          mint: `${mintUrl}/`,
          unit: 'sat',
          memo: 'test payment',
          proofs: [
            {
              id: 'keyset_01',
              amount: BigInt(8),
              secret: 'secret_token_proof_01',
              C: '02proofpoint0000000000000000000000000000000000000000000000000000001'
            }
          ]
        }
      ],
      quotes: []
    });

    const node = engine.getGraph().getNode(`mint:${mintUrl}`);
    expect(node).toBeDefined();
    expect(node?.id).toBe(`mint:${mintUrl}`);
  });

  test('runs analyze() with an empty registry and asserts empty edge list', () => {
    engine.ingestBitcoin({
      transactions: [
        {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          blockHeight: 800000,
          blockTime: 1700000000,
          inputs: [],
          outputs: []
        }
      ],
      addresses: []
    });

    const result = engine.analyze();
    expect(result.edgeCount).toBe(0);
    expect(result.graph.edges).toHaveLength(0);
  });

  test('registers a fixture rule that emits one edge and asserts edge exists with correct sha256 id', () => {
    engine.ingestBitcoin({
      transactions: [
        {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          blockHeight: 800000,
          blockTime: 1700000000,
          inputs: [
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000001',
              vout: 0,
              address: 'bc1qinputoneaddress000000000000000000000001'
            }
          ],
          outputs: [
            {
              address: 'bc1qoutputoneaddress00000000000000000000001',
              value: BigInt(50000)
            }
          ]
        }
      ],
      addresses: []
    });

    const rule = new SingleEdgeFixtureRule();
    registry.register(rule);

    const result = engine.analyze();
    expect(result.edgeCount).toBe(1);

    const nodes = engine.getGraph().nodes;
    const expectedEdgeId = crypto
      .createHash('sha256')
      .update(`${rule.name}:${nodes[0].id}:${nodes[1].id}:${rule.relationship}`)
      .digest('hex');

    const edge = engine.getGraph().getEdge(expectedEdgeId);
    expect(edge).toBeDefined();
    expect(edge?.id).toBe(expectedEdgeId);
    expect(edge?.confidence).toBe(0.8);
  });

  test('registers two fixture rules that emit the same edge and asserts edge merged, higher confidence kept, evidence unioned', () => {
    engine.ingestBitcoin({
      transactions: [
        {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          blockHeight: 800000,
          blockTime: 1700000000,
          inputs: [
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000001',
              vout: 0,
              address: 'bc1qinputoneaddress000000000000000000000001'
            }
          ],
          outputs: [
            {
              address: 'bc1qoutputoneaddress00000000000000000000001',
              value: BigInt(50000)
            }
          ]
        }
      ],
      addresses: []
    });

    registry.register(new MergeRuleA());
    registry.register(new MergeRuleB());

    const result = engine.analyze();
    expect(result.edgeCount).toBe(1);
    expect(result.graph.edges).toHaveLength(1);

    const mergedEdge = result.graph.edges[0];
    expect(mergedEdge.confidence).toBe(0.9);
    expect(mergedEdge.evidence).toHaveLength(2);
    const refs = mergedEdge.evidence.map((e) => e.ref);
    expect(refs).toContain('ev_a');
    expect(refs).toContain('ev_b');
  });

  test('determinism: ingesting same data into two engines and analyzing with same now yields byte-identical serialize() output', () => {
    const fixedNow = new Date('2026-03-01T12:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);

    const testConfig = new TaintConfig();
    const testRegistry1 = new TaintRuleRegistry();
    const testRegistry2 = new TaintRuleRegistry();
    const rule1 = new SingleEdgeFixtureRule();
    const rule2 = new SingleEdgeFixtureRule();
    testRegistry1.register(rule1);
    testRegistry2.register(rule2);

    const engine1 = new TaintEngine(testConfig, testRegistry1, new TaintScorer());
    const engine2 = new TaintEngine(testConfig, testRegistry2, new TaintScorer());

    const payload = {
      transactions: [
        {
          txid: 'tx_deterministic_000000000000000000000000000000000000000000000001',
          blockHeight: 850000,
          blockTime: 1705000000,
          inputs: [
            {
              txid: 'prevtx_det_00000000000000000000000000000000000000000000000000001',
              vout: 0,
              address: 'bc1qdetinput0000000000000000000000000000001'
            }
          ],
          outputs: [
            {
              address: 'bc1qdetoutput0000000000000000000000000000001',
              value: BigInt(100000)
            }
          ]
        }
      ],
      addresses: []
    };

    engine1.ingestBitcoin(payload);
    engine2.ingestBitcoin(payload);

    engine1.analyze();
    engine2.analyze();

    const serialized1 = engine1.getGraph().serialize();
    const serialized2 = engine2.getGraph().serialize();

    expect(serialized1).toBe(serialized2);

    jest.useRealTimers();
  });

  test('enforces maxNodesPerGraph and throws TaintIngestError when ceiling is exceeded', () => {
    const limitedConfig = new TaintConfig({
      maxNodesPerGraph: 3
    });
    const limitedEngine = new TaintEngine(limitedConfig, registry, scorer);

    expect(() => {
      limitedEngine.ingestBitcoin({
        transactions: [
          {
            txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            blockHeight: 800000,
            blockTime: 1700000000,
            inputs: [
              {
                txid: 'prevtx0000000000000000000000000000000000000000000000000000000001',
                vout: 0,
                address: 'bc1qinputoneaddress000000000000000000000001'
              },
              {
                txid: 'prevtx0000000000000000000000000000000000000000000000000000000002',
                vout: 1,
                address: 'bc1qinputtwoaddress000000000000000000000002'
              }
            ],
            outputs: []
          }
        ],
        addresses: []
      });
    }).toThrow(TaintIngestError);
  });

  test('enforces maxEdgesPerGraph and throws TaintRuleError when fixture rule emits more than ceiling', () => {
    const limitedConfig = new TaintConfig({
      maxEdgesPerGraph: 1
    });
    const limitedEngine = new TaintEngine(limitedConfig, registry, scorer);

    limitedEngine.ingestBitcoin({
      transactions: [
        {
          txid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          blockHeight: 800000,
          blockTime: 1700000000,
          inputs: [
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000001',
              vout: 0,
              address: 'bc1qinputoneaddress000000000000000000000001'
            },
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000002',
              vout: 1,
              address: 'bc1qinputtwoaddress000000000000000000000002'
            }
          ],
          outputs: []
        }
      ],
      addresses: []
    });

    registry.register(new OverflowEdgesRule());

    expect(() => {
      limitedEngine.analyze();
    }).toThrow(TaintRuleError);

    try {
      limitedEngine.analyze();
    } catch (error) {
      expect(error).toBeInstanceOf(TaintRuleError);
      const taintError = error as TaintRuleError;
      expect(taintError.context.reason).toBe('MAX_EDGES_EXCEEDED');
    }
  });

  test('constructs engine with unified Option A signature accepting graph as fifth parameter', () => {
    const existingGraph = new TaintGraph({
      id: 'graph_option_a',
      scenarioId: 'scenario_option_a',
      createdAt: new Date(1700000000000)
    });
    const customConfig = new TaintConfig();
    const customRegistry = new TaintRuleRegistry();
    const customScorer = new TaintScorer();
    const customEngine = new TaintEngine(
      customConfig,
      customRegistry,
      customScorer,
      undefined,
      existingGraph
    );
    expect(customEngine.getScenarioId()).toBe('scenario_option_a');
  });

  test('end-to-end cross-protocol correlation emits SAME_PAYMENT_HASH edge between lightning invoice and nostr event', () => {
    registry.register(new SamePaymentHashRule());
    const paymentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const eventId = '0000000000000000000000000000000000000000000000000000000000000001';

    engine.ingestLightning({
      invoices: [
        {
          bolt11: 'lnbc10u1pj8testinvoice0000000000000000000000000000000000000000000000',
          paymentHash,
          preimage: 'preimage000000000000000000000000000000000000000000000000000000000',
          amountMsat: BigInt(1000000),
          createdAt: 1700000000,
          expiresAt: 1700003600,
          payeePubkey: '020000000000000000000000000000000000000000000000000000000000000001'
        }
      ]
    });

    engine.ingestNostr({
      events: [
        {
          id: eventId,
          pubkey: '020000000000000000000000000000000000000000000000000000000000000002',
          kind: 1,
          tags: [],
          content: `Payment received with payment hash ${paymentHash} settled`,
          createdAt: 1700001000
        }
      ]
    });

    const result = engine.analyze();
    const edges = result.graph.edges.filter((edge) => edge.relationship === 'SAME_PAYMENT_HASH');

    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe(`payment_hash:${paymentHash}`);
    expect(edges[0].to).toBe(`event_id:${eventId}`);
    expect(edges[0].confidence).toBe(1.0);
    expect(edges[0].evidence).toHaveLength(1);
    expect(edges[0].evidence[0].ref).toBe(eventId);
  });

  test('end-to-end cross-protocol correlation emits SAME_PREIMAGE edge between lightning invoice and nostr event', () => {
    registry.register(new SamePreimageRule());
    const preimage = '1111111111111111111111111111111111111111111111111111111111111111';
    const paymentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const eventId = '0000000000000000000000000000000000000000000000000000000000000002';

    engine.ingestLightning({
      invoices: [
        {
          bolt11: 'lnbc10u1pj8testinvoice0000000000000000000000000000000000000000000000',
          paymentHash,
          preimage,
          amountMsat: BigInt(1000000),
          createdAt: 1700000000,
          expiresAt: 1700003600,
          payeePubkey: '020000000000000000000000000000000000000000000000000000000000000001'
        }
      ]
    });

    engine.ingestNostr({
      events: [
        {
          id: eventId,
          pubkey: '020000000000000000000000000000000000000000000000000000000000000002',
          kind: 1,
          tags: [],
          content: `Payment settled with preimage ${preimage}`,
          createdAt: 1700001000
        }
      ]
    });

    const result = engine.analyze();
    const edges = result.graph.edges.filter((edge) => edge.relationship === 'SAME_PREIMAGE');

    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe(`preimage:${preimage}`);
    expect(edges[0].to).toBe(`event_id:${eventId}`);
    expect(edges[0].confidence).toBe(1.0);
    expect(edges[0].evidence).toHaveLength(1);
    expect(edges[0].evidence[0].ref).toBe(eventId);
  });

  test('demo flow end-to-end: cross-protocol correlation across Lightning, Nostr, Bitcoin, and Cashu', () => {
    registry.register(new PublishedByRule());
    registry.register(new SamePaymentHashRule());
    registry.register(new SamePreimageRule());
    registry.register(new TemporalWindowRule());
    registry.register(new SharedMintRule());
    registry.register(new CashuQuoteInvoiceRule());

    const paymentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const preimage = '1111111111111111111111111111111111111111111111111111111111111111';
    const pubkey = '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff';
    const eventId = '0000000000000000000000000000000000000000000000000000000000000001';
    const txid = '2222222222222222222222222222222222222222222222222222222222222222';
    const mintUrl = 'https://mint.demo.example.com';
    const mintId = `mint:${mintUrl}`;
    const tokenSecret = 'cashu_demo_secret_token_12345';

    engine.ingestLightning({
      invoices: [
        {
          bolt11: 'lnbc10u1pj8testinvoice0000000000000000000000000000000000000000000000',
          paymentHash,
          preimage,
          amountMsat: BigInt(1000000),
          createdAt: 1700000000,
          expiresAt: 1700003600,
          payeePubkey: '020000000000000000000000000000000000000000000000000000000000000001'
        }
      ]
    });

    engine.ingestNostr({
      events: [
        {
          id: eventId,
          pubkey,
          kind: 1,
          tags: [],
          content: `Settled payment_hash: ${paymentHash} with preimage: ${preimage} at mint: ${mintUrl}`,
          createdAt: 1700001000
        }
      ]
    });

    engine.ingestBitcoin({
      transactions: [
        {
          txid,
          blockHeight: 800000,
          blockTime: 1700001030,
          inputs: [
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000001',
              vout: 0,
              address: 'bc1qinputoneaddress000000000000000000000001'
            }
          ],
          outputs: [
            {
              address: 'bc1qoutputoneaddress00000000000000000000001',
              value: BigInt(50000)
            }
          ]
        }
      ],
      addresses: []
    });

    engine.ingestCashu({
      mints: [
        {
          url: mintUrl,
          name: 'Demo Cashu Mint'
        }
      ],
      tokens: [
        {
          mint: mintUrl,
          unit: 'sat',
          proofs: [
            {
              id: 'keyset_demo_1',
              amount: BigInt(500),
              secret: tokenSecret,
              C: '020000000000000000000000000000000000000000000000000000000000000002'
            }
          ],
          memo: null
        }
      ],
      quotes: [
        {
          quote: 'quote_demo_1',
          type: 'mint',
          amount: BigInt(1000),
          request: `lnbc10u1p${paymentHash}sampleinvoice`,
          state: 'PAID'
        }
      ]
    });

    const result = engine.analyze();

    const paymentHashEdges = result.graph.edges.filter(
      (edge) => edge.relationship === 'SAME_PAYMENT_HASH'
    );
    expect(paymentHashEdges).toHaveLength(1);
    expect(paymentHashEdges[0].from).toBe(`payment_hash:${paymentHash}`);
    expect(paymentHashEdges[0].to).toBe(`event_id:${eventId}`);

    const preimageEdges = result.graph.edges.filter(
      (edge) => edge.relationship === 'SAME_PREIMAGE'
    );
    expect(preimageEdges).toHaveLength(1);
    expect(preimageEdges[0].from).toBe(`preimage:${preimage}`);
    expect(preimageEdges[0].to).toBe(`event_id:${eventId}`);

    const publishedByEdges = result.graph.edges.filter(
      (edge) => edge.relationship === 'PUBLISHED_BY'
    );
    expect(publishedByEdges).toHaveLength(1);
    expect(publishedByEdges[0].from).toBe(`event_id:${eventId}`);
    expect(publishedByEdges[0].to).toBe(`pubkey:${pubkey}`);

    const temporalEdges = result.graph.edges.filter(
      (edge) => edge.relationship === 'TEMPORAL_WINDOW'
    );
    const eventTxEdge = temporalEdges.find(
      (edge) =>
        (edge.from === `event_id:${eventId}` && edge.to === `txid:${txid}`) ||
        (edge.from === `txid:${txid}` && edge.to === `event_id:${eventId}`)
    );
    expect(eventTxEdge).toBeDefined();
    expect(eventTxEdge?.from).toBe(`event_id:${eventId}`);
    expect(eventTxEdge?.to).toBe(`txid:${txid}`);
    expect(eventTxEdge?.confidence).toBe(0.4167);

    const sharedMintEdges = result.graph.edges.filter(
      (edge) => edge.relationship === 'SHARED_MINT'
    );
    expect(sharedMintEdges).toHaveLength(1);
    expect(sharedMintEdges[0].from).toBe(mintId);
    expect(sharedMintEdges[0].to).toBe(`event_id:${eventId}`);
    expect(sharedMintEdges[0].confidence).toBe(0.6);

    const cashuQuoteEdges = result.graph.edges.filter(
      (edge) => edge.relationship === 'CASHU_QUOTE_INVOICE'
    );
    expect(cashuQuoteEdges).toHaveLength(1);
    expect(cashuQuoteEdges[0].from).toBe(mintId);
    expect(cashuQuoteEdges[0].to).toBe(`payment_hash:${paymentHash}`);
    expect(cashuQuoteEdges[0].confidence).toBe(1.0);

    const crossProtocolPaths = engine.findPaths(
      `payment_hash:${paymentHash}`,
      `txid:${txid}`
    );
    expect(crossProtocolPaths.length).toBeGreaterThan(0);

    const fullCrossPath = crossProtocolPaths.find(
      (p) =>
        p.nodes[0] === `payment_hash:${paymentHash}` &&
        p.nodes[p.nodes.length - 1] === `txid:${txid}`
    );
    expect(fullCrossPath).toBeDefined();
    expect(fullCrossPath?.nodes).toEqual([
      `payment_hash:${paymentHash}`,
      `event_id:${eventId}`,
      `txid:${txid}`
    ]);
    expect(fullCrossPath?.overallConfidence).toBeLessThan(1.0);
    expect(fullCrossPath?.overallConfidence).toBe(0.4167);

    const txToPubkeyPaths = engine.findPaths(`txid:${txid}`, `pubkey:${pubkey}`);
    expect(txToPubkeyPaths.length).toBeGreaterThan(0);
    const txToPubkeyPath = txToPubkeyPaths.find(
      (p) =>
        p.nodes[0] === `txid:${txid}` &&
        p.nodes[p.nodes.length - 1] === `pubkey:${pubkey}`
    );
    expect(txToPubkeyPath).toBeDefined();
    expect(txToPubkeyPath?.nodes).toEqual([
      `txid:${txid}`,
      `event_id:${eventId}`,
      `pubkey:${pubkey}`
    ]);
    expect(txToPubkeyPath?.overallConfidence).toBeLessThan(1.0);
    expect(txToPubkeyPath?.overallConfidence).toBe(0.4167);

    const lightningToNostrPaths = engine.findPaths(
      `payment_hash:${paymentHash}`,
      `pubkey:${pubkey}`
    );
    expect(lightningToNostrPaths.length).toBeGreaterThan(0);
    const lightningToNostrPath = lightningToNostrPaths.find(
      (p) =>
        p.nodes[0] === `payment_hash:${paymentHash}` &&
        p.nodes[p.nodes.length - 1] === `pubkey:${pubkey}`
    );
    expect(lightningToNostrPath).toBeDefined();
    expect(lightningToNostrPath?.overallConfidence).toBe(1.0);

    const paymentToMintPaths = engine.findPaths(
      `payment_hash:${paymentHash}`,
      mintId
    );
    expect(paymentToMintPaths.length).toBeGreaterThan(0);
    const twoHopPath = paymentToMintPaths.find(
      (p) => p.nodes.length === 3 && p.nodes[1] === `event_id:${eventId}`
    );
    expect(twoHopPath).toBeDefined();
    expect(twoHopPath?.nodes).toEqual([
      `payment_hash:${paymentHash}`,
      `event_id:${eventId}`,
      mintId
    ]);
    expect(twoHopPath?.overallConfidence).toBe(0.6);

    const bitcoinToCashuPaths = engine.findPaths(
      `txid:${txid}`,
      mintId
    );
    expect(bitcoinToCashuPaths.length).toBeGreaterThan(0);
    const btcToCashuPath = bitcoinToCashuPaths.find(
      (p) => p.nodes.length === 3 && p.nodes[1] === `event_id:${eventId}`
    );
    expect(btcToCashuPath).toBeDefined();
    expect(btcToCashuPath?.nodes).toEqual([
      `txid:${txid}`,
      `event_id:${eventId}`,
      mintId
    ]);
    expect(btcToCashuPath?.overallConfidence).toBeCloseTo(0.25002, 4);
  });

  test('reset produces a graph whose serialized createdAt is within the last 5 seconds', () => {
    const freshEngine = new TaintEngine();
    freshEngine.reset();
    const serialized = freshEngine.getGraph().toJSON();
    const createdAtMs = new Date(serialized.createdAt).getTime();
    const nowMs = Date.now();
    expect(createdAtMs).toBeGreaterThanOrEqual(nowMs - 5000);
    expect(createdAtMs).toBeLessThanOrEqual(nowMs + 1000);
    expect(new Date(serialized.createdAt).getUTCFullYear()).toBeGreaterThanOrEqual(2026);
  });

  test('constructor default produces a graph whose serialized createdAt is within the last 5 seconds', () => {
    const freshEngine = new TaintEngine();
    const serialized = freshEngine.getGraph().toJSON();
    const createdAtMs = new Date(serialized.createdAt).getTime();
    const nowMs = Date.now();
    expect(createdAtMs).toBeGreaterThanOrEqual(nowMs - 5000);
    expect(createdAtMs).toBeLessThanOrEqual(nowMs + 1000);
    expect(new Date(serialized.createdAt).getUTCFullYear()).toBeGreaterThanOrEqual(2026);
  });

  test('findTopPaths from invoice node returns paths to nodes of different types ordered by confidence descending', () => {
    const reg = new TaintRuleRegistry();
    reg.register(new PublishedByRule());
    reg.register(new SamePaymentHashRule());
    reg.register(new SamePreimageRule());
    reg.register(new TemporalWindowRule());
    reg.register(new SharedMintRule());
    reg.register(new CashuQuoteInvoiceRule());

    const eng = new TaintEngine(new TaintConfig(), reg, new TaintScorer());
    const paymentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const preimage = '1111111111111111111111111111111111111111111111111111111111111111';
    const pubkey = '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff';
    const eventId = '0000000000000000000000000000000000000000000000000000000000000001';
    const txid = '2222222222222222222222222222222222222222222222222222222222222222';
    const mintUrl = 'https://mint.demo.example.com';
    const bolt11 = 'lnbc10u1pj8testinvoice0000000000000000000000000000000000000000000000';

    eng.ingestLightning({
      invoices: [
        {
          bolt11,
          paymentHash,
          preimage,
          amountMsat: BigInt(1000000),
          createdAt: 1700000000,
          expiresAt: 1700003600,
          payeePubkey: '020000000000000000000000000000000000000000000000000000000000000001'
        }
      ]
    });
    eng.ingestNostr({
      events: [
        {
          id: eventId,
          pubkey,
          kind: 1,
          tags: [],
          content: `Settled payment_hash: ${paymentHash} with preimage: ${preimage} at mint: ${mintUrl}`,
          createdAt: 1700001000
        }
      ]
    });
    eng.ingestBitcoin({
      transactions: [
        {
          txid,
          blockHeight: 800000,
          blockTime: 1700001030,
          inputs: [
            {
              txid: 'prevtx0000000000000000000000000000000000000000000000000000000001',
              vout: 0,
              address: 'bc1qinputoneaddress000000000000000000000001'
            }
          ],
          outputs: [
            {
              address: 'bc1qoutputoneaddress00000000000000000000001',
              value: BigInt(50000)
            }
          ]
        }
      ],
      addresses: []
    });
    eng.ingestCashu({
      mints: [{ url: mintUrl, name: 'Demo Cashu Mint' }],
      tokens: [
        {
          mint: mintUrl,
          unit: 'sat',
          proofs: [
            {
              id: 'keyset_demo_1',
              amount: BigInt(500),
              secret: 'cashu_demo_secret_token_12345',
              C: '020000000000000000000000000000000000000000000000000000000000000002'
            }
          ],
          memo: null
        }
      ],
      quotes: [
        {
          quote: 'quote_demo_1',
          type: 'mint',
          amount: BigInt(1000),
          request: `lnbc10u1p${paymentHash}sampleinvoice`,
          state: 'PAID'
        }
      ]
    });

    eng.analyze();

    const invoiceNodeId = `invoice:${bolt11.toLowerCase()}`;
    const topPaths = eng.findTopPaths(invoiceNodeId, 5, 5);
    expect(topPaths.length).toBeGreaterThan(0);

    const endNodeTypes = topPaths.map((p) => {
      const endNode = eng.getGraph().getNode(p.nodes[p.nodes.length - 1]);
      return endNode?.type;
    });
    expect(endNodeTypes).not.toContain(TaintNodeType.Invoice);

    for (let i = 0; i < topPaths.length - 1; i++) {
      expect(topPaths[i].overallConfidence).toBeGreaterThanOrEqual(topPaths[i + 1].overallConfidence);
    }

    const deterministicPaths = eng.findTopPaths(invoiceNodeId, 5, 5);
    expect(topPaths.map((p) => p.toJSON())).toEqual(deterministicPaths.map((p) => p.toJSON()));
  });

  test('findTopPaths does not return paths to nodes of the same type as the start node', () => {
    const eng = new TaintEngine();
    const g = eng.getGraph();
    const nodeA = new TaintNode({ id: 'invoice:inv1', type: TaintNodeType.Invoice, value: 'inv1', metadata: {} });
    const nodeB = new TaintNode({ id: 'invoice:inv2', type: TaintNodeType.Invoice, value: 'inv2', metadata: {} });
    const nodeC = new TaintNode({ id: 'txid:tx1', type: TaintNodeType.Txid, value: 'tx1', metadata: {} });
    g.addNode(nodeA);
    g.addNode(nodeB);
    g.addNode(nodeC);
    g.addEdge(new TaintEdge({ id: 'e1', from: 'invoice:inv1', to: 'invoice:inv2', relationship: 'CORRELATED', confidence: 0.9, evidence: [] }));
    g.addEdge(new TaintEdge({ id: 'e2', from: 'invoice:inv2', to: 'txid:tx1', relationship: 'CORRELATED', confidence: 0.8, evidence: [] }));

    const paths = eng.findTopPaths('invoice:inv1', 5, 5);
    expect(paths.length).toBe(1);
    expect(paths[0].nodes).toEqual(['invoice:inv1', 'invoice:inv2', 'txid:tx1']);
    const targetNode = g.getNode(paths[0].nodes[paths[0].nodes.length - 1]);
    expect(targetNode?.type).toBe(TaintNodeType.Txid);
  });

  test('findTopPaths with a nonexistent node throws TaintPathError with NODE_NOT_FOUND', () => {
    const eng = new TaintEngine();
    let caught: unknown;
    try {
      eng.findTopPaths('nonexistent:id_123', 5, 5);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TaintPathError);
    const pathError = caught as TaintPathError;
    expect(pathError.context['reason']).toBe('NODE_NOT_FOUND');
  });

  test('addOrMergeNode unions array metadata', () => {
    const eng = new TaintEngine();
    const node1 = new TaintNode({
      id: 'mint:https://mint.example.com',
      type: TaintNodeType.Mint,
      value: 'https://mint.example.com',
      metadata: { quoteHashes: ['a', 'b'] }
    });
    const node2 = new TaintNode({
      id: 'mint:https://mint.example.com',
      type: TaintNodeType.Mint,
      value: 'https://mint.example.com',
      metadata: { quoteHashes: ['b', 'c'] }
    });

    const engineInternal = eng as unknown as {
      addOrMergeNode: (node: TaintNode, protocol: string) => void;
    };
    engineInternal.addOrMergeNode(node1, 'CASHU');
    engineInternal.addOrMergeNode(node2, 'CASHU');

    const mergedNode = eng.getGraph().getNode('mint:https://mint.example.com');
    expect(mergedNode).toBeDefined();
    expect(mergedNode?.metadata['quoteHashes']).toEqual(['a', 'b', 'c']);
  });
});

