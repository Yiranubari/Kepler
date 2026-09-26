import { TaintGraph, TaintNode, TaintNodeType } from '@kepler/shared';
import { TaintConfig } from '../../../src/modules/taint/taint.types';
import { SharedMintRule } from '../../../src/modules/taint/rules/sharedMint.rule';
import { TaintScorer } from '../../../src/modules/taint/taint.scorer';

describe('SharedMintRule', () => {
  const rule = new SharedMintRule();
  const config = new TaintConfig();
  const scorer = new TaintScorer();
  const now = 1700000000000;

  const mintUrl = 'https://mint.example.com';
  const mintId = `mint:${mintUrl}`;
  const eventIdA = '0000000000000000000000000000000000000000000000000000000000000001';
  const eventIdB = '0000000000000000000000000000000000000000000000000000000000000002';
  const secretA = 'secret_proof_a_12345';
  const secretB = 'secret_proof_b_67890';

  test('one cashu_token with metadata.mint matching a mint node, one event whose content references the mint URL emits one edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: mintId,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: { name: 'Example Mint' }
        }),
        new TaintNode({
          id: `cashu_token:${secretA}`,
          type: TaintNodeType.CashuToken,
          value: secretA,
          metadata: {
            mint: mintUrl,
            amount: '100',
            id: 'keyset1'
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff',
            kind: 1,
            tags: [],
            content: `Tokens issued by ${mintUrl} for settlement`
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);

    const edge = result.edges[0];
    expect(edge.from).toBe(mintId);
    expect(edge.to).toBe(`event_id:${eventIdA}`);
    expect(edge.relationship).toBe('SHARED_MINT');
    expect(edge.confidence).toBe(0.6);
    expect(edge.evidence).toHaveLength(1);
    expect(edge.evidence[0].kind).toBe('RawData');
    expect(edge.evidence[0].ref).toBe(eventIdA);
    expect(edge.evidence[0].description).toBe(
      `Cashu mint ${mintUrl} is referenced by Nostr event ${eventIdA}.`
    );
    expect(edge.evidence[0].data).toEqual({
      field: 'content',
      match: mintUrl,
      mint: mintUrl
    });
  });

  test('same as above, event references the mint URL in a tag emits one edge', () => {
    const tagArray = ['r', mintUrl];
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: mintId,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: { name: 'Example Mint' }
        }),
        new TaintNode({
          id: `cashu_token:${secretA}`,
          type: TaintNodeType.CashuToken,
          value: secretA,
          metadata: {
            mint: mintUrl,
            amount: '100'
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff',
            kind: 1,
            tags: [tagArray],
            content: 'Check out this mint recommendation'
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(1);

    const edge = result.edges[0];
    expect(edge.from).toBe(mintId);
    expect(edge.to).toBe(`event_id:${eventIdA}`);
    expect(edge.relationship).toBe('SHARED_MINT');
    expect(edge.confidence).toBe(0.6);
    expect(edge.evidence).toHaveLength(1);
    expect(edge.evidence[0].kind).toBe('RawData');
    expect(edge.evidence[0].ref).toBe(eventIdA);
    expect(edge.evidence[0].description).toBe(
      `Cashu mint ${mintUrl} is referenced by Nostr event ${eventIdA}.`
    );
    expect(edge.evidence[0].data).toEqual({
      field: 'tags',
      match: tagArray,
      mint: mintUrl
    });
  });

  test('cashu token with a mint URL that does not appear in any event emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: mintId,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: { name: 'Example Mint' }
        }),
        new TaintNode({
          id: `cashu_token:${secretA}`,
          type: TaintNodeType.CashuToken,
          value: secretA,
          metadata: {
            mint: mintUrl,
            amount: '100'
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff',
            kind: 1,
            tags: [],
            content: 'Unrelated content mentioning nothing about mints'
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('cashu token with metadata.mint missing or non-string emits no edge', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: mintId,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: { name: 'Example Mint' }
        }),
        new TaintNode({
          id: `cashu_token:${secretA}`,
          type: TaintNodeType.CashuToken,
          value: secretA,
          metadata: {
            amount: '100'
          }
        }),
        new TaintNode({
          id: `cashu_token:${secretB}`,
          type: TaintNodeType.CashuToken,
          value: secretB,
          metadata: {
            mint: 12345,
            amount: '200'
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff',
            kind: 1,
            tags: [],
            content: `Mentions ${mintUrl}`
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(0);
  });

  test('two events reference the same mint URL emits two edges', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: mintId,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: { name: 'Example Mint' }
        }),
        new TaintNode({
          id: `cashu_token:${secretA}`,
          type: TaintNodeType.CashuToken,
          value: secretA,
          metadata: {
            mint: mintUrl,
            amount: '100'
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff',
            kind: 1,
            tags: [],
            content: `Event 1 mentions ${mintUrl}`
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdB}`,
          type: TaintNodeType.EventId,
          value: eventIdB,
          metadata: {
            pubkey: '618bdf39eaf542de9ffd17c0a0e748fe35a73e42e09148daf349c9d0e7003289',
            kind: 1,
            tags: [['r', mintUrl]],
            content: 'Event 2 tag reference'
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((e) => e.to).sort()).toEqual([
      `event_id:${eventIdA}`,
      `event_id:${eventIdB}`
    ]);
  });

  test('two cashu_tokens referencing the same mint, one event emits one edge per token', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: mintId,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: { name: 'Example Mint' }
        }),
        new TaintNode({
          id: `cashu_token:${secretA}`,
          type: TaintNodeType.CashuToken,
          value: secretA,
          metadata: {
            mint: mintUrl,
            amount: '50'
          }
        }),
        new TaintNode({
          id: `cashu_token:${secretB}`,
          type: TaintNodeType.CashuToken,
          value: secretB,
          metadata: {
            mint: mintUrl,
            amount: '50'
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff',
            kind: 1,
            tags: [],
            content: `References ${mintUrl}`
          }
        })
      ]
    });

    const result = rule.apply({ graph, config, scorer, now });
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].from).toBe(mintId);
    expect(result.edges[0].to).toBe(`event_id:${eventIdA}`);
    expect(result.edges[1].from).toBe(mintId);
    expect(result.edges[1].to).toBe(`event_id:${eventIdA}`);
  });

  test('determinism: byte-identical output across two applications', () => {
    const graph = new TaintGraph({
      id: 'graph_test',
      scenarioId: 'test_scenario',
      createdAt: new Date(now),
      nodes: [
        new TaintNode({
          id: mintId,
          type: TaintNodeType.Mint,
          value: mintUrl,
          metadata: { name: 'Example Mint' }
        }),
        new TaintNode({
          id: `cashu_token:${secretA}`,
          type: TaintNodeType.CashuToken,
          value: secretA,
          metadata: {
            mint: mintUrl,
            amount: '100'
          }
        }),
        new TaintNode({
          id: `event_id:${eventIdA}`,
          type: TaintNodeType.EventId,
          value: eventIdA,
          metadata: {
            pubkey: '4646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff',
            kind: 1,
            tags: [],
            content: `Mentions ${mintUrl}`
          }
        })
      ]
    });

    const result1 = rule.apply({ graph, config, scorer, now });
    const result2 = rule.apply({ graph, config, scorer, now });

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });
});
