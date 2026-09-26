import { TaintGraph, TaintNode, TaintNodeType } from '@kepler/shared';
import { TaintConfig } from '../../../src/modules/taint/taint.types';
import { PublishedByRule } from '../../../src/modules/taint/rules/publishedBy.rule';
import { TaintScorer } from '../../../src/modules/taint/taint.scorer';

describe('PublishedByRule', () => {
  const rule = new PublishedByRule();
  const config = new TaintConfig();
  const scorer = new TaintScorer();
  const now = 1700000000000;

  const pubkeyA = '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff';
  const pubkeyB = '618bdf39eaf542de9ffd17c0a0e748fe35a73e42e09148daf349c9d0e7003289';
  const eventIdA = '0000000000000000000000000000000000000000000000000000000000000001';
  const eventIdB = '0000000000000000000000000000000000000000000000000000000000000002';

  test('event with metadata.pubkey matching an existing pubkey node emits one edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: pubkeyA,
            kind: 1,
            tags: [],
            content: 'hello nostr'
          }
        }),
        new TaintNode({
          id: `pubkey:${pubkeyA}`,
          type: TaintNodeType.Pubkey,
          value: pubkeyA
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);

    const edge = result.edges[0];
    expect(edge.from).toBe(`event_id:${eventIdA}`);
    expect(edge.to).toBe(`pubkey:${pubkeyA}`);
    expect(edge.relationship).toBe('PUBLISHED_BY');
    expect(edge.confidence).toBe(1.0);
    expect(edge.evidence).toHaveLength(1);
    expect(edge.evidence[0].kind).toBe('RawData');
    expect(edge.evidence[0].ref).toBe(eventIdA);
    expect(edge.evidence[0].data).toEqual({
      field: 'pubkey',
      match: pubkeyA
    });
  });

  test('event with metadata.pubkey but no matching pubkey node emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: pubkeyA
          }
        }),
        new TaintNode({
          id: `pubkey:${pubkeyB}`,
          type: TaintNodeType.Pubkey,
          value: pubkeyB
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('event with malformed metadata.pubkey emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: 'not_a_valid_hex_pubkey_string'
          }
        }),
        new TaintNode({
          id: 'pubkey:not_a_valid_hex_pubkey_string',
          type: TaintNodeType.Pubkey,
          value: 'not_a_valid_hex_pubkey_string'
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('two events with same pubkey emit two edges to the same pubkey', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: pubkeyA
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdB}`,
          type: TaintNodeType.EventId,
          value: eventIdB,
          metadata: {
            pubkey: pubkeyA
          }
        }),
        new TaintNode({
          id: `pubkey:${pubkeyA}`,
          type: TaintNodeType.Pubkey,
          value: pubkeyA
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(2);

    expect(result.edges[0].from).toBe(`event_id:${eventIdA}`);
    expect(result.edges[0].to).toBe(`pubkey:${pubkeyA}`);
    expect(result.edges[1].from).toBe(`event_id:${eventIdB}`);
    expect(result.edges[1].to).toBe(`pubkey:${pubkeyA}`);
  });

  test('matches case-insensitively when event pubkey is uppercase', () => {
    const upperPubkey = pubkeyA.toUpperCase();
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: upperPubkey
          }
        }),
        new TaintNode({
          id: `pubkey:${pubkeyA}`,
          type: TaintNodeType.Pubkey,
          value: pubkeyA
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from).toBe(`event_id:${eventIdA}`);
    expect(result.edges[0].to).toBe(`pubkey:${pubkeyA}`);
  });

  test('handles missing or non-string pubkey metadata gracefully without throwing', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {}
        }),
        new TaintNode({
          id: `event_id:${eventIdB}`,
          type: TaintNodeType.EventId,
          value: eventIdB,
          metadata: {
            pubkey: 12345
          }
        }),
        new TaintNode({
          id: `pubkey:${pubkeyA}`,
          type: TaintNodeType.Pubkey,
          value: pubkeyA
        })
      ]
    });

    expect(() => rule.apply({ graph, config, scorer, now })).not.toThrow();
    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('guarantees deterministic byte-identical output across two runs', () => {
    const createTestGraph = (): TaintGraph =>
      new TaintGraph({
        id: 'graph_test',
        scenarioId: 'test_scenario',
        createdAt: new Date(now),
        nodes: [
          new TaintNode({
            id: `event_id:${eventIdB}`,
            type: TaintNodeType.EventId,
            value: eventIdB,
            metadata: {
              pubkey: pubkeyB
            }
          }),
          new TaintNode({
            id: `event_id:${eventIdA}`,
            type: TaintNodeType.EventId,
            value: eventIdA,
            metadata: {
              pubkey: pubkeyA
            }
          }),
          new TaintNode({
            id: `pubkey:${pubkeyB}`,
            type: TaintNodeType.Pubkey,
            value: pubkeyB
          }),
          new TaintNode({
            id: `pubkey:${pubkeyA}`,
            type: TaintNodeType.Pubkey,
            value: pubkeyA
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
