import { TaintGraph, EdgeDraft } from '@kepler/shared';
import { TaintConfig } from '../taint.types';
import type { TaintScorer } from '../taint.scorer';

export interface TaintRuleContext {
  readonly graph: TaintGraph;
  readonly config: TaintConfig;
  readonly scorer: TaintScorer;
  readonly now: number;
}

export interface TaintRuleResult {
  readonly edges: EdgeDraft[];
}

export interface TaintRule {
  readonly name: string;
  readonly description: string;
  readonly relationship: string;
  readonly maxConfidence: number;
  apply(context: TaintRuleContext): TaintRuleResult;
}
