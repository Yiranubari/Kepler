import { TaintRule } from './rule.interface';
import { TaintRuleError } from '../taint.errors';
import { PublishedByRule } from './publishedBy.rule';
import { SamePaymentHashRule } from './samePaymentHash.rule';
import { SamePreimageRule } from './samePreimage.rule';
import { TemporalWindowRule } from './temporalWindow.rule';

export class TaintRuleRegistry {
  private readonly rulesMap: Map<string, TaintRule>;
  private readonly rulesList: TaintRule[];

  constructor() {
    this.rulesMap = new Map();
    this.rulesList = [];
  }

  public register(rule: TaintRule): void {
    if (!rule || !rule.name || rule.name.trim().length === 0) {
      throw new TaintRuleError('Rule name cannot be empty', {
        rule: rule?.name ?? '',
        reason: 'Empty rule name'
      });
    }

    if (this.rulesMap.has(rule.name)) {
      throw new TaintRuleError('Rule already registered', {
        rule: rule.name,
        reason: 'Duplicate rule registration'
      });
    }

    this.rulesMap.set(rule.name, rule);
    this.rulesList.push(rule);
  }

  public getRules(): readonly TaintRule[] {
    return Object.freeze([...this.rulesList]);
  }

  public clear(): void {
    this.rulesMap.clear();
    this.rulesList.length = 0;
  }
}

export function createDefaultRuleRegistry(): TaintRuleRegistry {
  const registry = new TaintRuleRegistry();
  registry.register(new PublishedByRule());
  registry.register(new SamePaymentHashRule());
  registry.register(new SamePreimageRule());
  registry.register(new TemporalWindowRule());
  return registry;
}
