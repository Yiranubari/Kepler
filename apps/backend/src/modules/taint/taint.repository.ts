import { PrismaClient, Prisma, Scenario } from '@prisma/client';
import {
  TaintGraph,
  TaintNodeJSON,
  TaintEdgeJSON,
  EvidencePathJSON,
  TaintNodeType
} from '@kepler/shared';
import { TaintAnalysisResult } from './taint.types';
import { TaintPersistenceError } from './taint.errors';

export class TaintRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async scenarioExists(scenarioId: string): Promise<boolean> {
    const trimmedScenarioId = scenarioId ? scenarioId.trim() : '';
    if (trimmedScenarioId.length === 0) {
      return false;
    }

    const scenario = await this.prisma.scenario.findUnique({
      where: { id: trimmedScenarioId },
      select: { id: true }
    });

    return scenario !== null;
  }

  public async getScenario(scenarioId: string): Promise<Scenario | null> {
    const trimmedScenarioId = scenarioId ? scenarioId.trim() : '';
    if (trimmedScenarioId.length === 0) {
      return null;
    }

    return this.prisma.scenario.findUnique({
      where: { id: trimmedScenarioId }
    });
  }

  public async saveGraph(
    scenarioId: string,
    result: TaintAnalysisResult
  ): Promise<void> {
    const trimmedScenarioId = scenarioId.trim();

    try {
      const serializedNodes = result.graph.nodes.map((n) =>
        this.serializeNode(n.toJSON())
      );
      const serializedEdges = result.graph.edges.map((e) =>
        this.serializeValue(e.toJSON())
      );
      const serializedPaths = result.graph.paths.map((p) =>
        this.serializeValue(p.toJSON())
      );

      const existing = await this.prisma.taintGraphRecord.findFirst({
        where: { scenarioId: trimmedScenarioId }
      });

      if (existing) {
        await this.prisma.taintGraphRecord.update({
          where: { id: existing.id },
          data: {
            nodes: serializedNodes as unknown as Prisma.InputJsonValue,
            edges: serializedEdges as unknown as Prisma.InputJsonValue,
            paths: serializedPaths as unknown as Prisma.InputJsonValue,
            createdAt: result.graph.createdAt
          }
        });
      } else {
        await this.prisma.taintGraphRecord.create({
          data: {
            id: result.graph.id,
            scenarioId: trimmedScenarioId,
            nodes: serializedNodes as unknown as Prisma.InputJsonValue,
            edges: serializedEdges as unknown as Prisma.InputJsonValue,
            paths: serializedPaths as unknown as Prisma.InputJsonValue,
            createdAt: result.graph.createdAt
          }
        });
      }
    } catch (error) {
      const prismaCode = (error as { code?: unknown })?.code;
      const reason =
        prismaCode === 'P2003'
          ? 'FOREIGN_KEY_VIOLATION'
          : error instanceof Error
            ? error.message
            : String(error);
      throw new TaintPersistenceError(
        'Failed to save taint graph to database',
        {
          scenarioId: trimmedScenarioId,
          operation: 'saveGraph',
          reason
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  public async getGraph(scenarioId: string): Promise<TaintGraph | null> {
    const trimmedScenarioId = scenarioId ? scenarioId.trim() : '';
    if (trimmedScenarioId.length === 0) {
      return null;
    }

    try {
      const record = await this.prisma.taintGraphRecord.findFirst({
        where: { scenarioId: trimmedScenarioId },
        orderBy: { createdAt: 'desc' }
      });

      if (!record) {
        return null;
      }

      const rawNodes = Array.isArray(record.nodes) ? record.nodes : [];
      const rawEdges = Array.isArray(record.edges) ? record.edges : [];
      const rawPaths = Array.isArray(record.paths) ? record.paths : [];

      const nodes = rawNodes.map((n) => this.deserializeNode(n));
      const edges = rawEdges.map((e) => e as unknown as TaintEdgeJSON);
      const paths = rawPaths.map((p) => p as unknown as EvidencePathJSON);


      return TaintGraph.fromJSON({
        id: record.id,
        scenarioId: record.scenarioId,
        nodes,
        edges,
        paths,
        createdAt: record.createdAt.toISOString()
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TaintPersistenceError(
        'Failed to retrieve taint graph from database',
        {
          scenarioId: trimmedScenarioId,
          operation: 'getGraph',
          reason
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  public async deleteGraph(scenarioId: string): Promise<void> {
    const trimmedScenarioId = scenarioId ? scenarioId.trim() : '';
    if (trimmedScenarioId.length === 0) {
      return;
    }

    try {
      await this.prisma.taintGraphRecord.deleteMany({
        where: { scenarioId: trimmedScenarioId }
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TaintPersistenceError(
        'Failed to delete taint graph from database',
        {
          scenarioId: trimmedScenarioId,
          operation: 'deleteGraph',
          reason
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  private serializeNode(node: TaintNodeJSON): Record<string, unknown> {
    const bigintKeys: string[] = [];
    const serializedMetadata: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(node.metadata)) {
      if (typeof val === 'bigint') {
        bigintKeys.push(key);
        serializedMetadata[key] = val.toString();
      } else if (
        (key === 'amountMsat' || key === 'amount' || key === 'value') &&
        typeof val === 'string' &&
        /^-?\d+$/.test(val)
      ) {
        bigintKeys.push(key);
        serializedMetadata[key] = val;
      } else {
        serializedMetadata[key] = this.serializeValue(val);
      }
    }

    if (bigintKeys.length > 0) {
      serializedMetadata['__bigintKeys'] = bigintKeys;
    }

    return {
      id: node.id,
      type: node.type,
      value: node.value,
      metadata: serializedMetadata
    };
  }

  private serializeValue(val: unknown): unknown {
    if (typeof val === 'bigint') {
      return val.toString();
    }
    if (Array.isArray(val)) {
      return val.map((item) => this.serializeValue(item));
    }
    if (val !== null && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k] = this.serializeValue(v);
      }
      return res;
    }
    return val;
  }

  private deserializeNode(raw: unknown): TaintNodeJSON {
    const node = raw as Record<string, unknown>;
    const rawMetadata = (node['metadata'] as Record<string, unknown>) ?? {};
    const deserializedMetadata: Record<string, unknown> = {};

    const bigintKeys = Array.isArray(rawMetadata['__bigintKeys'])
      ? (rawMetadata['__bigintKeys'] as string[])
      : [];

    for (const [key, val] of Object.entries(rawMetadata)) {
      if (key === '__bigintKeys') {
        continue;
      }
      if (
        bigintKeys.includes(key) &&
        typeof val === 'string' &&
        /^-?\d+$/.test(val)
      ) {
        deserializedMetadata[key] = BigInt(val);
      } else if (
        (key === 'amountMsat' || key === 'amount' || key === 'value') &&
        typeof val === 'string' &&
        /^-?\d+$/.test(val)
      ) {
        deserializedMetadata[key] = BigInt(val);
      } else {
        deserializedMetadata[key] = val;
      }
    }

    return {
      id: String(node['id']),
      type: node['type'] as TaintNodeType,
      value: String(node['value']),
      metadata: deserializedMetadata
    };
  }
}
