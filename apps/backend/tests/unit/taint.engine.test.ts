import * as crypto from 'crypto';
import { EvidenceItem, TaintEdge, TaintGraph } from '@kepler/shared';
import { TaintEngine } from '../../src/modules/taint/taint.engine';
import { TaintConfig } from '../../src/modules/taint/taint.types';
import { TaintRuleRegistry } from '../../src/modules/taint/rules/registry';
import { SamePaymentHashRule } from '../../src/modules/taint/rules/samePaymentHash.rule';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import {
  TaintRule,
  TaintRuleContext,
  TaintRuleResult
} from '../../src/modules/taint/rules/rule.interface';
import {
  TaintIngestError,
  TaintRuleError
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
        new TaintEdge({
          id: 'placeholder',
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
        })
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
        new TaintEdge({
          id: 'temp_a',
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
        })
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
        new TaintEdge({
          id: 'temp_b',
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
        })
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
        new TaintEdge({
          id: 'edge_1',
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
        }),
        new TaintEdge({
          id: 'edge_2',
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
        })
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

  test('ingests Nostr event and asserts npub node exists', () => {
    const pubkey = 'npub10000000000000000000000000000000000000000000000000000000001';
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

    const node = engine.getGraph().getNode(`npub:${pubkey}`);
    expect(node).toBeDefined();
    expect(node?.id).toBe(`npub:${pubkey}`);
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
});

