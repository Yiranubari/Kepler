import { TaintGraph, TaintEdge } from '@kepler/shared';
import { TaintConfig } from '../taint.types';

export interface TaintRuleContext {
  readonly graph: TaintGraph;
  readonly config: TaintConfig;
  readonly now: number;
}

export interface TaintRuleResult {
  readonly edges: TaintEdge[];
}

export interface TaintRule {
  readonly name: string;
  readonly description: string;
  readonly relationship: string;
  readonly maxConfidence: number;
  apply(context: TaintRuleContext): TaintRuleResult;
}
