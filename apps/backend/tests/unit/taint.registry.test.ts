import {
  TaintRuleRegistry,
  createDefaultRuleRegistry
} from '../../src/modules/taint/rules/registry';
import {
  TaintRule,
  TaintRuleContext,
  TaintRuleResult
} from '../../src/modules/taint/rules/rule.interface';
import { TaintRuleError } from '../../src/modules/taint/taint.errors';

class FixtureRule implements TaintRule {
  public static readonly maxConfidence = 0.8;
  public readonly name: string;
  public readonly description: string;
  public readonly relationship: string;
  public readonly maxConfidence: number;

  constructor(name: string = 'fixture_rule') {
    this.name = name;
    this.description = 'Fixture rule description';
    this.relationship = 'CO_SPEND';
    this.maxConfidence = FixtureRule.maxConfidence;
  }

  public apply(context: TaintRuleContext): TaintRuleResult {
    return { edges: [] };
  }
}

describe('TaintRuleRegistry', () => {
  let registry: TaintRuleRegistry;

  beforeEach(() => {
    registry = new TaintRuleRegistry();
  });

  test('registers a rule and returns it in getRules()', () => {
    const rule = new FixtureRule('rule_one');
    registry.register(rule);
    const rules = registry.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toBe(rule);
    expect(rules[0].name).toBe('rule_one');
  });

  test('rejects duplicate rule name with TaintRuleError containing rule in context', () => {
    const rule1 = new FixtureRule('duplicate_rule');
    const rule2 = new FixtureRule('duplicate_rule');
    registry.register(rule1);

    expect(() => {
      registry.register(rule2);
    }).toThrow(TaintRuleError);

    try {
      registry.register(rule2);
    } catch (error) {
      expect(error).toBeInstanceOf(TaintRuleError);
      const taintError = error as TaintRuleError;
      expect(taintError.context.rule).toBe('duplicate_rule');
    }
  });

  test('clears the registry and asserts empty', () => {
    registry.register(new FixtureRule('rule_a'));
    registry.register(new FixtureRule('rule_b'));
    expect(registry.getRules()).toHaveLength(2);

    registry.clear();
    expect(registry.getRules()).toHaveLength(0);
  });

  test('createDefaultRuleRegistry creates registry with default rules in specified order', () => {
    const defaultRegistry = createDefaultRuleRegistry();
    const rules = defaultRegistry.getRules();
    expect(rules).toHaveLength(4);
    expect(rules.map((r) => r.name)).toEqual([
      'published_by',
      'same_payment_hash',
      'same_preimage',
      'temporal_window'
    ]);
  });
});

