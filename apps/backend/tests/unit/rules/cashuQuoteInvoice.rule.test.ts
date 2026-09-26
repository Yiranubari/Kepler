import { TaintGraph, TaintNode, TaintNodeType } from '@kepler/shared';
import { TaintConfig } from '../../../src/modules/taint/taint.types';
import { CashuQuoteInvoiceRule } from '../../../src/modules/taint/rules/cashuQuoteInvoice.rule';
import { TaintScorer } from '../../../src/modules/taint/taint.scorer';

describe('CashuQuoteInvoiceRule', () => {
  const rule = new CashuQuoteInvoiceRule();
  const config = new TaintConfig();
  const scorer = new TaintScorer();
  const now = 1700000000000;

  const mintUrlA = 'https://mint-a.example.com';
  const mintUrlB = 'https://mint-b.example.com';
  const hashH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const hashOther = '1111111111111111111111111111111111111111111111111111111111111111';

  test('mint node with quoteHashes containing hash H; a payment_hash node with value H emits one edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrlA}`,
          type: TaintNodeType.Mint,
          value: mintUrlA,
          metadata: {
            quoteHashes: [hashH]
          }
        }),
        new TaintNode({
          id: `payment_hash:${hashH}`,
          type: TaintNodeType.PaymentHash,
          value: hashH
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);

    const edge = result.edges[0];
    expect(edge.from).toBe(`mint:${mintUrlA}`);
    expect(edge.to).toBe(`payment_hash:${hashH}`);
    expect(edge.relationship).toBe('CASHU_QUOTE_INVOICE');
    expect(edge.confidence).toBe(1.0);
    expect(edge.evidence).toHaveLength(1);
    expect(edge.evidence[0].kind).toBe('RawData');
    expect(edge.evidence[0].ref).toBe(hashH);
    expect(edge.evidence[0].description).toBe(
      `Cashu mint ${mintUrlA} issued a quote for payment hash ${hashH}.`
    );
    expect(edge.evidence[0].data).toEqual({
      field: 'quoteHash',
      match: hashH
    });
  });

  test('mint node with quoteHashes not matching any payment hash emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrlA}`,
          type: TaintNodeType.Mint,
          value: mintUrlA,
          metadata: {
            quoteHashes: [hashH]
          }
        }),
        new TaintNode({
          id: `payment_hash:${hashOther}`,
          type: TaintNodeType.PaymentHash,
          value: hashOther
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('mint node with no quoteHashes metadata emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrlA}`,
          type: TaintNodeType.Mint,
          value: mintUrlA,
          metadata: {}
        }),
        new TaintNode({
          id: `payment_hash:${hashH}`,
          type: TaintNodeType.PaymentHash,
          value: hashH
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('two mints with overlapping quoteHashes emits two edges', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrlA}`,
          type: TaintNodeType.Mint,
          value: mintUrlA,
          metadata: {
            quoteHashes: [hashH]
          }
        }),
        new TaintNode({
          id: `mint:${mintUrlB}`,
          type: TaintNodeType.Mint,
          value: mintUrlB,
          metadata: {
            quoteHashes: [hashH]
          }
        }),
        new TaintNode({
          id: `payment_hash:${hashH}`,
          type: TaintNodeType.PaymentHash,
          value: hashH
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((e) => e.from).sort()).toEqual([
      `mint:${mintUrlA}`,
      `mint:${mintUrlB}`
    ]);
    expect(result.edges.every((e) => e.to === `payment_hash:${hashH}`)).toBe(true);
  });

  test('determinism: byte-identical output across two applications', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `mint:${mintUrlA}`,
          type: TaintNodeType.Mint,
          value: mintUrlA,
          metadata: {
            quoteHashes: [hashH]
          }
        }),
        new TaintNode({
          id: `payment_hash:${hashH}`,
          type: TaintNodeType.PaymentHash,
          value: hashH
        })
      ]
    });

    const result1 = rule.apply({ graph, config, scorer, now });
    const result2 = rule.apply({ graph, config, scorer, now });

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });
});
