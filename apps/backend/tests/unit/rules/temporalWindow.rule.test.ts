import { TaintGraph, TaintNode, TaintNodeType } from '@kepler/shared';
import { TaintConfig } from '../../../src/modules/taint/taint.types';
import { TemporalWindowRule } from '../../../src/modules/taint/rules/temporalWindow.rule';
import { TaintScorer } from '../../../src/modules/taint/taint.scorer';

describe('TemporalWindowRule', () => {
  const rule = new TemporalWindowRule();
  const config = new TaintConfig({ temporalWindowSeconds: 3600 });
  const scorer = new TaintScorer();
  const now = 1700000000000;

  test('two nodes of different types within window emits one edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000001',
          metadata: { createdAt: 1700000000 }
        }),
        new TaintNode({
          id: 'txid:0000000000000000000000000000000000000000000000000000000000000002',
          type: TaintNodeType.Txid,
          value: '0000000000000000000000000000000000000000000000000000000000000002',
          metadata: { blockTime: 1700000030 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from).toBe('event_id:0000000000000000000000000000000000000000000000000000000000000001');
    expect(result.edges[0].to).toBe('txid:0000000000000000000000000000000000000000000000000000000000000002');
    expect(result.edges[0].relationship).toBe('TEMPORAL_WINDOW');
    expect(result.edges[0].confidence).toBe(0.4167);
    expect(result.edges[0].evidence).toHaveLength(2);
  });

  test('two nodes of the same type within window emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000001',
          metadata: { createdAt: 1700000000 }
        }),
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000002',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000002',
          metadata: { createdAt: 1700000010 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('two nodes outside window emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000001',
          metadata: { createdAt: 1700000000 }
        }),
        new TaintNode({
          id: 'invoice:lnbc1testinvoiceoutside',
          type: TaintNodeType.Invoice,
          value: 'lnbc1testinvoiceoutside',
          metadata: { createdAt: 1700005000 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('three nodes of different types all within window emit three edges', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000001',
          metadata: { createdAt: 1700000000 }
        }),
        new TaintNode({
          id: 'invoice:lnbc1testinvoiceinside',
          type: TaintNodeType.Invoice,
          value: 'lnbc1testinvoiceinside',
          metadata: { createdAt: 1700000020 }
        }),
        new TaintNode({
          id: 'txid:0000000000000000000000000000000000000000000000000000000000000003',
          type: TaintNodeType.Txid,
          value: '0000000000000000000000000000000000000000000000000000000000000003',
          metadata: { blockTime: 1700000050 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(3);
  });

  test('node with missing timestamp is skipped and emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000001',
          metadata: {}
        }),
        new TaintNode({
          id: 'txid:0000000000000000000000000000000000000000000000000000000000000002',
          type: TaintNodeType.Txid,
          value: '0000000000000000000000000000000000000000000000000000000000000002',
          metadata: { blockTime: 1700000030 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('node with non-numeric timestamp is skipped and emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000001',
          metadata: { createdAt: 'not-a-number' }
        }),
        new TaintNode({
          id: 'txid:0000000000000000000000000000000000000000000000000000000000000002',
          type: TaintNodeType.Txid,
          value: '0000000000000000000000000000000000000000000000000000000000000002',
          metadata: { blockTime: 1700000030 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('exactly at the window boundary delta equals window emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000001',
          metadata: { createdAt: 1700000000 }
        }),
        new TaintNode({
          id: 'txid:0000000000000000000000000000000000000000000000000000000000000002',
          type: TaintNodeType.Txid,
          value: '0000000000000000000000000000000000000000000000000000000000000002',
          metadata: { blockTime: 1700003600 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('just below the boundary delta equals window minus one emits an edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
          type: TaintNodeType.EventId,
          value: '0000000000000000000000000000000000000000000000000000000000000001',
          metadata: { createdAt: 1700000000 }
        }),
        new TaintNode({
          id: 'txid:0000000000000000000000000000000000000000000000000000000000000002',
          type: TaintNodeType.Txid,
          value: '0000000000000000000000000000000000000000000000000000000000000002',
          metadata: { blockTime: 1700003599 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from).toBe('event_id:0000000000000000000000000000000000000000000000000000000000000001');
    expect(result.edges[0].to).toBe('txid:0000000000000000000000000000000000000000000000000000000000000002');
  });

  test('edge direction is always from lexicographically smaller id to larger', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'txid:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          type: TaintNodeType.Txid,
          value: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          metadata: { blockTime: 1700000010 }
        }),
        new TaintNode({
          id: 'event_id:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          type: TaintNodeType.EventId,
          value: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          metadata: { createdAt: 1700000000 }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from).toBe('event_id:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(result.edges[0].to).toBe('txid:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    expect(result.edges[0].from < result.edges[0].to).toBe(true);
  });

  test('guarantees deterministic byte-identical output across two applications', () => {
    const createTestGraph = (): TaintGraph =>
      new TaintGraph({
        id: 'graph_test',
        scenarioId: 'test_scenario',
        createdAt: new Date(now),
        nodes: [
          new TaintNode({
            id: 'txid:0000000000000000000000000000000000000000000000000000000000000003',
            type: TaintNodeType.Txid,
            value: '0000000000000000000000000000000000000000000000000000000000000003',
            metadata: { blockTime: 1700000030 }
          }),
          new TaintNode({
            id: 'invoice:lnbc1testinvoice',
            type: TaintNodeType.Invoice,
            value: 'lnbc1testinvoice',
            metadata: { createdAt: 1700000015 }
          }),
          new TaintNode({
            id: 'event_id:0000000000000000000000000000000000000000000000000000000000000001',
            type: TaintNodeType.EventId,
            value: '0000000000000000000000000000000000000000000000000000000000000001',
            metadata: { createdAt: 1700000000 }
          })
        ]
      });

    const graphOne = createTestGraph();
    const graphTwo = createTestGraph();

    const resultOne = rule.apply({ graph: graphOne, config, scorer, now });
    const resultTwo = rule.apply({ graph: graphTwo, config, scorer, now });

    expect(JSON.stringify(resultOne.edges)).toBe(JSON.stringify(resultTwo.edges));
  });
});
