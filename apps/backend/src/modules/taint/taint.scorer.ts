import { EvidenceItem, TaintEdge } from '@kepler/shared';
import { TaintRule } from './rules/rule.interface';
import { TaintConfig } from './taint.types';

export class TaintScorer {
  public scoreEdge(rule: TaintRule, evidence: EvidenceItem[]): number {
    const evidenceRatio = Math.min(1, evidence.length / 3);
    let confidence = rule.maxConfidence * (0.5 + 0.5 * evidenceRatio);
    confidence = Math.max(0, Math.min(1, confidence));
    confidence = Math.min(confidence, rule.maxConfidence);
    return Number(confidence.toFixed(4));
  }

  public scorePath(edges: TaintEdge[]): number {
    if (edges.length === 0) {
      return 0;
    }
    let product = 1;
    for (const edge of edges) {
      product *= edge.confidence;
    }
    return Number(product.toFixed(4));
  }

  public aboveThreshold(confidence: number, config: TaintConfig): boolean {
    return confidence >= config.minEdgeConfidence;
  }
}
