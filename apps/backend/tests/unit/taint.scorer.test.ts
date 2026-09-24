import { EvidenceItem, TaintEdge } from '@kepler/shared';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import {
  TaintRule,
  TaintRuleContext,
  TaintRuleResult
} from '../../src/modules/taint/rules/rule.interface';
import { TaintConfig } from '../../src/modules/taint/taint.types';

class ScorerFixtureRule implements TaintRule {
  public static readonly maxConfidence = 0.8;
  public readonly name: string;
  public readonly description: string;
  public readonly relationship: string;
  public readonly maxConfidence: number;

  constructor(maxConfidence: number = ScorerFixtureRule.maxConfidence) {
    this.name = 'scorer_fixture_rule';
    this.description = 'Scorer fixture rule description';
    this.relationship = 'CO_SPEND';
    this.maxConfidence = maxConfidence;
  }

  public apply(context: TaintRuleContext): TaintRuleResult {
    return { edges: [] };
  }
}

describe('TaintScorer', () => {
  let scorer: TaintScorer;
  let rule: ScorerFixtureRule;

  beforeEach(() => {
    scorer = new TaintScorer();
    rule = new ScorerFixtureRule(0.8);
  });

  test('scoreEdge with zero evidence returns base score of maxConfidence * 0.5', () => {
    const evidence: EvidenceItem[] = [];
    const score = scorer.scoreEdge(rule, evidence);
    expect(score).toBe(0.4);
  });

  test('scoreEdge with three evidence items returns max score for the rule', () => {
    const evidence: EvidenceItem[] = [
      new EvidenceItem({
        kind: 'RawData',
        ref: 'ref_1',
        description: 'First piece of evidence'
      }),
      new EvidenceItem({
        kind: 'VerificationStep',
        ref: 'ref_2',
        description: 'Second piece of evidence'
      }),
      new EvidenceItem({
        kind: 'Correlation',
        ref: 'ref_3',
        description: 'Third piece of evidence'
      })
    ];
    const score = scorer.scoreEdge(rule, evidence);
    expect(score).toBe(0.8);
  });

  test('scoreEdge with ten evidence items is clamped at rule.maxConfidence', () => {
    const evidence: EvidenceItem[] = [];
    for (let i = 0; i < 10; i++) {
      evidence.push(
        new EvidenceItem({
          kind: 'RawData',
          ref: `ref_${i}`,
          description: `Evidence item ${i}`
        })
      );
    }
    const score = scorer.scoreEdge(rule, evidence);
    expect(score).toBe(0.8);
  });

  test('scorePath with three edges returns product of edge confidences rounded to 4 decimals', () => {
    const edges: TaintEdge[] = [
      new TaintEdge({
        id: 'edge_1',
        from: 'node_a',
        to: 'node_b',
        relationship: 'CO_SPEND',
        confidence: 0.8,
        evidence: []
      }),
      new TaintEdge({
        id: 'edge_2',
        from: 'node_b',
        to: 'node_c',
        relationship: 'PAYMENT_CORRELATION',
        confidence: 0.5,
        evidence: []
      }),
      new TaintEdge({
        id: 'edge_3',
        from: 'node_c',
        to: 'node_d',
        relationship: 'SHARED_PREIMAGE',
        confidence: 0.5,
        evidence: []
      })
    ];
    const pathScore = scorer.scorePath(edges);
    expect(pathScore).toBe(0.2);
  });

  test('aboveThreshold at boundary passes at exactly minEdgeConfidence', () => {
    const config = new TaintConfig({
      minEdgeConfidence: 0.5
    });

    expect(scorer.aboveThreshold(0.5, config)).toBe(true);
    expect(scorer.aboveThreshold(0.5001, config)).toBe(true);
    expect(scorer.aboveThreshold(0.4999, config)).toBe(false);
  });
});
