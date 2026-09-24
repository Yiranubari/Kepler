import { PrismaClient } from '@prisma/client';
import {
  TaintGraph,
  TaintNode,
  TaintEdge,
  EvidenceItem,
  TaintNodeType
} from '@kepler/shared';
import { TaintRepository } from '../../src/modules/taint/taint.repository';
import { TaintAnalysisResult } from '../../src/modules/taint/taint.types';

const databaseUrl = process.env.DATABASE_URL;
const describeWithDb = databaseUrl ? describe : describe.skip;

describeWithDb('TaintRepository', () => {
  let prisma: PrismaClient;
  let repository: TaintRepository;

  const scenario1 = 'test_repo_scenario_1';
  const scenario2 = 'test_repo_scenario_2';
  const scenario3 = 'test_repo_scenario_3';

  let isConnected = false;

  beforeAll(async () => {
    try {
      prisma = new PrismaClient();
      await prisma.$connect();
      repository = new TaintRepository(prisma);

      for (const scId of [scenario1, scenario2, scenario3]) {
        await prisma.scenario.upsert({
          where: { id: scId },
          create: {
            id: scId,
            targetKind: 'TRANSACTION',
            targetData: {},
            status: 'ACTIVE'
          },
          update: {}
        });
        await prisma.taintGraphRecord.deleteMany({
          where: { scenarioId: scId }
        });
      }
      isConnected = true;
    } catch {
      isConnected = false;
    }
  }, 30000);

  afterAll(async () => {
    if (!isConnected || !prisma) {
      return;
    }
    try {
      for (const scId of [scenario1, scenario2, scenario3]) {
        await prisma.taintGraphRecord.deleteMany({
          where: { scenarioId: scId }
        });
        await prisma.scenario.deleteMany({
          where: { id: scId }
        });
      }
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  test('saves a graph and reads it back asserting serialize() is identical', async () => {
    if (!isConnected) {
      return;
    }
    const fixedCreatedAt = new Date('2026-03-01T12:00:00.000Z');
    const node1 = new TaintNode({
      id: 'address:bc1qrepounittest000000000000000000000001',
      type: TaintNodeType.Address,
      value: 'bc1qrepounittest000000000000000000000001',
      metadata: {
        confirmed: true
      }
    });
    const node2 = new TaintNode({
      id: 'txid:txrepounittest0000000000000000000000000000000000000000000000001',
      type: TaintNodeType.Txid,
      value: 'txrepounittest0000000000000000000000000000000000000000000000001',
      metadata: {
        blockHeight: 800000
      }
    });
    const edge = new TaintEdge({
      id: 'edge_repo_test_1',
      from: node1.id,
      to: node2.id,
      relationship: 'CO_SPEND',
      confidence: 0.85,
      evidence: [
        new EvidenceItem({
          kind: 'Correlation',
          ref: 'ref_repo_1',
          description: 'Repo test evidence'
        })
      ]
    });

    const graph = new TaintGraph({
      id: `graph_${scenario1}`,
      scenarioId: scenario1,
      nodes: [node1, node2],
      edges: [edge],
      createdAt: fixedCreatedAt
    });

    const analysisResult: TaintAnalysisResult = {
      graph,
      scenarioId: scenario1,
      analyzedAt: fixedCreatedAt.toISOString(),
      ruleCount: 1,
      nodeCount: 2,
      edgeCount: 1,
      pathCount: 0
    };

    await repository.saveGraph(scenario1, analysisResult);

    const loaded = await repository.getGraph(scenario1);
    expect(loaded).not.toBeNull();
    expect(loaded?.serialize()).toBe(graph.serialize());
  }, 15000);

  test('saves a graph with bigint values and reads it back preserving bigints', async () => {
    if (!isConnected) {
      return;
    }
    const fixedCreatedAt = new Date('2026-03-01T12:00:00.000Z');
    const node = new TaintNode({
      id: 'address:bc1qrepobigint0000000000000000000000001',
      type: TaintNodeType.Address,
      value: 'bc1qrepobigint0000000000000000000000001',
      metadata: {
        value: BigInt(5000000000),
        amountMsat: BigInt(2100000000000000)
      }
    });

    const graph = new TaintGraph({
      id: `graph_${scenario2}`,
      scenarioId: scenario2,
      nodes: [node],
      createdAt: fixedCreatedAt
    });

    const analysisResult: TaintAnalysisResult = {
      graph,
      scenarioId: scenario2,
      analyzedAt: fixedCreatedAt.toISOString(),
      ruleCount: 0,
      nodeCount: 1,
      edgeCount: 0,
      pathCount: 0
    };

    await repository.saveGraph(scenario2, analysisResult);

    const loaded = await repository.getGraph(scenario2);
    expect(loaded).not.toBeNull();

    const loadedNode = loaded?.getNode(node.id);
    expect(loadedNode).toBeDefined();
    expect(typeof loadedNode?.metadata['value']).toBe('bigint');
    expect(loadedNode?.metadata['value']).toBe(BigInt(5000000000));
    expect(typeof loadedNode?.metadata['amountMsat']).toBe('bigint');
    expect(loadedNode?.metadata['amountMsat']).toBe(BigInt(2100000000000000));
  }, 15000);

  test('reads nonexistent scenario and returns null', async () => {
    if (!isConnected) {
      return;
    }
    const loaded = await repository.getGraph('nonexistent_scenario_99999999');
    expect(loaded).toBeNull();
  }, 15000);

  test('deletes graph and asserts subsequent read returns null', async () => {
    if (!isConnected) {
      return;
    }
    const fixedCreatedAt = new Date('2026-03-01T12:00:00.000Z');
    const node = new TaintNode({
      id: 'address:bc1qrepodelete0000000000000000000000001',
      type: TaintNodeType.Address,
      value: 'bc1qrepodelete0000000000000000000000001'
    });

    const graph = new TaintGraph({
      id: `graph_${scenario3}`,
      scenarioId: scenario3,
      nodes: [node],
      createdAt: fixedCreatedAt
    });

    const analysisResult: TaintAnalysisResult = {
      graph,
      scenarioId: scenario3,
      analyzedAt: fixedCreatedAt.toISOString(),
      ruleCount: 0,
      nodeCount: 1,
      edgeCount: 0,
      pathCount: 0
    };

    await repository.saveGraph(scenario3, analysisResult);

    const loadedBefore = await repository.getGraph(scenario3);
    expect(loadedBefore).not.toBeNull();

    await repository.deleteGraph(scenario3);

    const loadedAfter = await repository.getGraph(scenario3);
    expect(loadedAfter).toBeNull();
  }, 15000);
});
