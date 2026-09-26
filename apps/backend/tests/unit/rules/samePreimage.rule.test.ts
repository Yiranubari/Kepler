import { TaintGraph, TaintNode, TaintNodeType } from '@kepler/shared';
import { TaintConfig } from '../../../src/modules/taint/taint.types';
import { SamePreimageRule } from '../../../src/modules/taint/rules/samePreimage.rule';
import { TaintScorer } from '../../../src/modules/taint/taint.scorer';

describe('SamePreimageRule', () => {
  const rule = new SamePreimageRule();
  const config = new TaintConfig();
  const scorer = new TaintScorer();
  const now = 1700000000000;

  const preimageA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const preimageB = 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3ef7ff2e0325492d3b2024b3b';
  const eventIdA = '0000000000000000000000000000000000000000000000000000000000000001';
  const eventIdB = '0000000000000000000000000000000000000000000000000000000000000002';

  test('returns zero edges when graph contains no preimage nodes', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'txid:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          type: TaintNodeType.Txid,
          value: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        }),
        new TaintNode({
          id: 'address:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          type: TaintNodeType.Address,
          value: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('returns zero edges when preimage exists but no event references it', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimageA}`,
          type: TaintNodeType.Preimage,
          value: preimageA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: 'paid to lnbc... unrelated event content without preimage',
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('emits one edge when event references preimage in content', () => {
    const content = `settled with preimage ${preimageA} completed`;
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimageA}`,
          type: TaintNodeType.Preimage,
          value: preimageA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content,
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);

    const edge = result.edges[0];
    expect(edge.from).toBe(`preimage:${preimageA}`);
    expect(edge.to).toBe(`event_id:${eventIdA}`);
    expect(edge.relationship).toBe('SAME_PREIMAGE');
    expect(edge.confidence).toBe(1.0);
    expect(edge.evidence).toHaveLength(1);
    expect(edge.evidence[0].kind).toBe('RawData');
    expect(edge.evidence[0].ref).toBe(eventIdA);
    expect(edge.evidence[0].description).toBe(
      `Lightning preimage ${preimageA} appears in Nostr event ${eventIdA}.`
    );
    expect(edge.evidence[0].data).toEqual({
      field: 'content',
      match: preimageA
    });
  });

  test('emits one edge when event references preimage in a tag', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimageA}`,
          type: TaintNodeType.Preimage,
          value: preimageA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: 'settlement verified',
            tags: [['preimage', preimageA]]
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);

    const edge = result.edges[0];
    expect(edge.from).toBe(`preimage:${preimageA}`);
    expect(edge.to).toBe(`event_id:${eventIdA}`);
    expect(edge.relationship).toBe('SAME_PREIMAGE');
    expect(edge.confidence).toBe(1.0);
    expect(edge.evidence).toHaveLength(1);
    expect(edge.evidence[0].kind).toBe('RawData');
    expect(edge.evidence[0].ref).toBe(eventIdA);
    expect(edge.evidence[0].data).toEqual({
      field: 'tags',
      match: ['preimage', preimageA]
    });
  });

  test('emits two edges when two events reference one preimage', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimageA}`,
          type: TaintNodeType.Preimage,
          value: preimageA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: `invoice preimage is ${preimageA}`,
            tags: []
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdB}`,
          type: TaintNodeType.EventId,
          value: eventIdB,
          metadata: {
            content: 'receipt attached',
            tags: [['preimage', preimageA]]
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].from).toBe(`preimage:${preimageA}`);
    expect(result.edges[1].from).toBe(`preimage:${preimageA}`);

    const targetEventIds = result.edges.map((e) => e.to).sort();
    expect(targetEventIds).toEqual([`event_id:${eventIdA}`, `event_id:${eventIdB}`].sort());
  });

  test('emits two edges when one event references two preimages', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimageA}`,
          type: TaintNodeType.Preimage,
          value: preimageA
        }),
        new TaintNode({
          id: `preimage:${preimageB}`,
          type: TaintNodeType.Preimage,
          value: preimageB
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: `preimages: ${preimageA} and ${preimageB}`,
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(2);

    const fromNodes = result.edges.map((e) => e.from).sort();
    expect(fromNodes).toEqual(
      [`preimage:${preimageA}`, `preimage:${preimageB}`].sort()
    );
    expect(result.edges[0].to).toBe(`event_id:${eventIdA}`);
    expect(result.edges[1].to).toBe(`event_id:${eventIdA}`);
  });

  test('matches case-insensitively when event content contains uppercase preimage', () => {
    const upperPreimage = preimageA.toUpperCase();
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimageA}`,
          type: TaintNodeType.Preimage,
          value: preimageA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: `settled with ${upperPreimage}`,
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].evidence[0].data).toEqual({
      field: 'content',
      match: upperPreimage
    });
  });

  test('returns zero edges on partial 63-character match', () => {
    const partialPreimage = preimageA.slice(0, 63);
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimageA}`,
          type: TaintNodeType.Preimage,
          value: preimageA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: `partial preimage is ${partialPreimage}`,
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('skips preimage node with invalid hex or non-64-character length', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: 'preimage:not_a_valid_64_hex_string',
          type: TaintNodeType.Preimage,
          value: 'not_a_valid_64_hex_string'
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: 'not_a_valid_64_hex_string',
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('safely handles missing metadata without throwing', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `preimage:${preimageA}`,
          type: TaintNodeType.Preimage,
          value: preimageA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {}
        })
      ]
    });

    expect(() => rule.apply({ graph, config, scorer, now })).not.toThrow();
    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('guarantees deterministic output across identical graph executions', () => {
    const createTestGraph = (): TaintGraph =>
      new TaintGraph({
        id: 'graph_test',
        scenarioId: 'test_scenario',
        createdAt: new Date(now),
        nodes: [
          new TaintNode({
            id: `preimage:${preimageB}`,
            type: TaintNodeType.Preimage,
            value: preimageB
          }),
          new TaintNode({
            id: `preimage:${preimageA}`,
            type: TaintNodeType.Preimage,
            value: preimageA
          }),
          new TaintNode({
            id: `event_id:${eventIdB}`,
            type: TaintNodeType.EventId,
            value: eventIdB,
            metadata: {
              content: `content with ${preimageA}`,
              tags: [['tag', preimageB]]
            }
          }),
          new TaintNode({
            id: `event_id:${eventIdA}`,
            type: TaintNodeType.EventId,
            value: eventIdA,
            metadata: {
              content: `content with ${preimageB}`,
              tags: [['tag', preimageA]]
            }
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
