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
import { matchesPaymentHash } from '../../../shared/taintMatching';

export class SamePaymentHashRule implements TaintRule {
  public readonly name: string = 'same_payment_hash';
  public readonly description: string =
    'Emits an edge when a payment hash appears in both a Lightning invoice and a Nostr event.';
  public readonly relationship: string = 'SAME_PAYMENT_HASH';
  public readonly maxConfidence: number = 1.0;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const paymentHashNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.PaymentHash)
      .sort((a, b) => a.id.localeCompare(b.id));

    const eventNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.EventId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const edges: EdgeDraft[] = [];

    for (const paymentHashNode of paymentHashNodes) {
      const paymentHash = paymentHashNode.value.trim().toLowerCase();
      if (!this.isValidPaymentHash(paymentHash)) {
        continue;
      }

      for (const eventNode of eventNodes) {
        const evidenceItems = this.collectEvidence(paymentHash, eventNode);
        if (evidenceItems.length === 0) {
          continue;
        }

        edges.push({
          from: paymentHashNode.id,
          to: eventNode.id,
          relationship: this.relationship,
          confidence: this.maxConfidence,
          evidence: evidenceItems
        });
      }
    }

    return { edges };
  }

  private isValidPaymentHash(paymentHash: string): boolean {
    return paymentHash.length === 64 && /^[0-9a-f]{64}$/.test(paymentHash);
  }

  private collectEvidence(paymentHash: string, eventNode: TaintNode): EvidenceItem[] {
    const evidenceItems: EvidenceItem[] = [];
    const eventId = eventNode.value.trim().toLowerCase();

    const rawContent = eventNode.metadata.content;
    const contentStr = typeof rawContent === 'string' ? rawContent : '';
    const rawTags = eventNode.metadata.tags;
    const parsedTags: string[][] = Array.isArray(rawTags)
      ? rawTags
          .filter((tag): tag is unknown[] => Array.isArray(tag))
          .map((tag) => tag.filter((e): e is string => typeof e === 'string'))
      : [];

    const result = matchesPaymentHash(contentStr, parsedTags, paymentHash);
    if (!result.matched) {
      return evidenceItems;
    }

    if (result.field === 'content') {
      const contentLower = contentStr.toLowerCase();
      const matchIndex = contentLower.indexOf(paymentHash);
      const matchedSubstring = contentStr.slice(matchIndex, matchIndex + paymentHash.length);
      evidenceItems.push(
        new EvidenceItem({
          kind: 'RawData',
          ref: eventId,
          description: `Payment hash ${paymentHash} appears in Nostr event ${eventId}.`,
          data: {
            field: 'content',
            match: matchedSubstring
          }
        })
      );
    }

    if (result.field === 'tags') {
      for (const rawTag of parsedTags) {
        const hasMatch = rawTag.some(
          (element) => element.toLowerCase() === paymentHash
        );
        if (hasMatch) {
          evidenceItems.push(
            new EvidenceItem({
              kind: 'RawData',
              ref: eventId,
              description: `Payment hash ${paymentHash} appears in Nostr event ${eventId}.`,
              data: {
                field: 'tags',
                match: rawTag
              }
            })
          );
        }
      }
    }

    return evidenceItems;
  }
}
