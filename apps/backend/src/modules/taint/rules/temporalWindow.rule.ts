import {
  TaintNodeType,
  EdgeDraft,
  EvidenceItem,
  TaintNode
} from '@kepler/shared';
import {
  TaintRule,
  TaintRuleContext,
  TaintRuleResult
} from './rule.interface';

interface TimestampedNode {
  readonly id: string;
  readonly type: TaintNodeType;
  readonly timestamp: number;
}

export class TemporalWindowRule implements TaintRule {
  public readonly name: string = 'temporal_window';
  public readonly description: string =
    'Emits an edge between two nodes of different types when their timestamps are within the configured temporal window.';
  public readonly relationship: string = 'TEMPORAL_WINDOW';
  public readonly maxConfidence: number = 0.5;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const candidateNodes = context.graph.nodes
      .filter(
        (node) =>
          node.type === TaintNodeType.EventId ||
          node.type === TaintNodeType.Invoice ||
          node.type === TaintNodeType.Txid
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    const timestampedNodes: TimestampedNode[] = [];
    for (const node of candidateNodes) {
      const timestamp = this.extractTimestamp(node);
      if (timestamp !== null) {
        timestampedNodes.push({
          id: node.id,
          type: node.type,
          timestamp
        });
      }
    }

    const edges: EdgeDraft[] = [];

    for (let i = 0; i < timestampedNodes.length; i++) {
      const nodeA = timestampedNodes[i];
      for (let j = i + 1; j < timestampedNodes.length; j++) {
        const nodeB = timestampedNodes[j];
        if (nodeA.type === nodeB.type) {
          continue;
        }

        const deltaSeconds = Math.abs(nodeA.timestamp - nodeB.timestamp);
        if (deltaSeconds >= context.config.temporalWindowSeconds) {
          continue;
        }

        const evidenceItems: EvidenceItem[] = [
          new EvidenceItem({
            kind: 'RawData',
            ref: nodeA.id,
            description: `Node ${nodeA.id} timestamp ${nodeA.timestamp}. Nodes ${nodeA.id} and ${nodeB.id} are ${deltaSeconds} seconds apart.`,
            data: {
              field: 'timestamp',
              match: nodeA.timestamp
            }
          }),
          new EvidenceItem({
            kind: 'RawData',
            ref: nodeB.id,
            description: `Node ${nodeB.id} timestamp ${nodeB.timestamp}. Nodes ${nodeA.id} and ${nodeB.id} are ${deltaSeconds} seconds apart.`,
            data: {
              field: 'timestamp',
              match: nodeB.timestamp
            }
          })
        ];

        const confidence = context.scorer.scoreEdge(this, evidenceItems);

        edges.push({
          from: nodeA.id,
          to: nodeB.id,
          relationship: this.relationship,
          confidence,
          evidence: evidenceItems
        });
      }
    }

    return { edges };
  }

  private extractTimestamp(node: TaintNode): number | null {
    if (!node.metadata) {
      return null;
    }
    let rawTs: unknown;
    if (node.type === TaintNodeType.EventId || node.type === TaintNodeType.Invoice) {
      rawTs = node.metadata['createdAt'];
    } else if (node.type === TaintNodeType.Txid) {
      rawTs = node.metadata['blockTime'];
    } else {
      return null;
    }

    if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
      return rawTs;
    }
    return null;
  }
}
