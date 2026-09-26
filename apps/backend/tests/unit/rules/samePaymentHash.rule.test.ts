import { TaintGraph, TaintNode, TaintNodeType } from '@kepler/shared';
import { TaintConfig } from '../../../src/modules/taint/taint.types';
import { SamePaymentHashRule } from '../../../src/modules/taint/rules/samePaymentHash.rule';

describe('SamePaymentHashRule', () => {
  const rule = new SamePaymentHashRule();
  const config = new TaintConfig();
  const now = 1700000000000;

  const paymentHashA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const paymentHashB = 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3ef7ff2e0325492d3b2024b3b';
  const eventIdA = '0000000000000000000000000000000000000000000000000000000000000001';
  const eventIdB = '0000000000000000000000000000000000000000000000000000000000000002';

  test('returns zero edges when graph contains no payment hash nodes', () => {
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

    const result = rule.apply({ graph, config, now });
    expect(result.edges).toHaveLength(0);
  });

  test('returns zero edges when payment hash exists but no event references it', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHashA}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHashA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: 'paid to lnbc... unrelated event content without payment hash',
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, now });
    expect(result.edges).toHaveLength(0);
  });

  test('emits one edge when event references payment hash in content', () => {
    const content = `paid to lnbc... payment_hash is ${paymentHashA} thanks`;
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHashA}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHashA
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

    const result = rule.apply({ graph, config, now });
    expect(result.edges).toHaveLength(1);

    const edge = result.edges[0];
    expect(edge.from).toBe(`payment_hash:${paymentHashA}`);
    expect(edge.to).toBe(`event_id:${eventIdA}`);
    expect(edge.relationship).toBe('SAME_PAYMENT_HASH');
    expect(edge.confidence).toBe(1.0);
    expect(edge.evidence).toHaveLength(1);
    expect(edge.evidence[0].kind).toBe('RawData');
    expect(edge.evidence[0].ref).toBe(eventIdA);
    expect(edge.evidence[0].description).toBe(
      `Payment hash ${paymentHashA} appears in Nostr event ${eventIdA}.`
    );
    expect(edge.evidence[0].data).toEqual({
      field: 'content',
      match: paymentHashA
    });
  });

  test('emits one edge when event references payment hash in a tag', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHashA}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHashA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: 'payment completed',
            tags: [['payment', paymentHashA]]
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, now });
    expect(result.edges).toHaveLength(1);

    const edge = result.edges[0];
    expect(edge.from).toBe(`payment_hash:${paymentHashA}`);
    expect(edge.to).toBe(`event_id:${eventIdA}`);
    expect(edge.relationship).toBe('SAME_PAYMENT_HASH');
    expect(edge.confidence).toBe(1.0);
    expect(edge.evidence).toHaveLength(1);
    expect(edge.evidence[0].kind).toBe('RawData');
    expect(edge.evidence[0].ref).toBe(eventIdA);
    expect(edge.evidence[0].data).toEqual({
      field: 'tags',
      match: ['payment', paymentHashA]
    });
  });

  test('emits two edges when two events reference one payment hash', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHashA}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHashA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: `invoice hash is ${paymentHashA}`,
            tags: []
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdB}`,
          type: TaintNodeType.EventId,
          value: eventIdB,
          metadata: {
            content: 'receipt tag attached',
            tags: [['payment', paymentHashA]]
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, now });
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].from).toBe(`payment_hash:${paymentHashA}`);
    expect(result.edges[1].from).toBe(`payment_hash:${paymentHashA}`);

    const targetEventIds = result.edges.map((e) => e.to).sort();
    expect(targetEventIds).toEqual([`event_id:${eventIdA}`, `event_id:${eventIdB}`].sort());
  });

  test('emits two edges when one event references two payment hashes', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHashA}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHashA
        }),
        new TaintNode({
          id: `payment_hash:${paymentHashB}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHashB
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: `hashes: ${paymentHashA} and ${paymentHashB}`,
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, now });
    expect(result.edges).toHaveLength(2);

    const fromNodes = result.edges.map((e) => e.from).sort();
    expect(fromNodes).toEqual(
      [`payment_hash:${paymentHashA}`, `payment_hash:${paymentHashB}`].sort()
    );
    expect(result.edges[0].to).toBe(`event_id:${eventIdA}`);
    expect(result.edges[1].to).toBe(`event_id:${eventIdA}`);
  });

  test('matches case-insensitively when event content contains uppercase payment hash', () => {
    const upperHash = paymentHashA.toUpperCase();
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHashA}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHashA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: `settled invoice ${upperHash}`,
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, now });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].evidence[0].data).toEqual({
      field: 'content',
      match: upperHash
    });
  });

  test('returns zero edges on partial 63-character match', () => {
    const partialHash = paymentHashA.slice(0, 63);
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: `payment_hash:${paymentHashA}`,
          type: TaintNodeType.PaymentHash,
          value: paymentHashA
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            content: `partial hash is ${partialHash}`,
            tags: []
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, now });
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
            id: `payment_hash:${paymentHashB}`,
            type: TaintNodeType.PaymentHash,
            value: paymentHashB
          }),
          new TaintNode({
            id: `payment_hash:${paymentHashA}`,
            type: TaintNodeType.PaymentHash,
            value: paymentHashA
          }),
          new TaintNode({
            id: `event_id:${eventIdB}`,
            type: TaintNodeType.EventId,
            value: eventIdB,
            metadata: {
              content: `content with ${paymentHashA}`,
              tags: [['tag', paymentHashB]]
            }
          }),
          new TaintNode({
            id: `event_id:${eventIdA}`,
            type: TaintNodeType.EventId,
            value: eventIdA,
            metadata: {
              content: `content with ${paymentHashB}`,
              tags: [['tag', paymentHashA]]
            }
          })
        ]
      });

    const graphOne = createTestGraph();
    const graphTwo = createTestGraph();

    const resultOne = rule.apply({ graph: graphOne, config, now });
    const resultTwo = rule.apply({ graph: graphTwo, config, now });

    expect(JSON.stringify(resultOne.edges)).toBe(JSON.stringify(resultTwo.edges));
  });
});
