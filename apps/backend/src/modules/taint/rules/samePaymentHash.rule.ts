import { createHash } from 'node:crypto';
import {
  TaintNodeType,
  TaintEdge,
  EvidenceItem,
  TaintNode
} from '@kepler/shared';
import {
  TaintRule,
  TaintRuleContext,
  TaintRuleResult
} from './rule.interface';

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

    const edges: TaintEdge[] = [];

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

        const edgeId = createHash('sha256')
          .update(`${this.name}:${paymentHashNode.id}:${eventNode.id}:${this.relationship}`)
          .digest('hex');

        const edge = new TaintEdge({
          id: edgeId,
          from: paymentHashNode.id,
          to: eventNode.id,
          relationship: this.relationship,
          confidence: this.maxConfidence,
          evidence: evidenceItems
        });

        edges.push(edge);
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

    const contentEvidence = this.checkContent(paymentHash, eventId, eventNode.metadata.content);
    if (contentEvidence !== null) {
      evidenceItems.push(contentEvidence);
    }

    const tagEvidenceItems = this.checkTags(paymentHash, eventId, eventNode.metadata.tags);
    for (const tagEvidence of tagEvidenceItems) {
      evidenceItems.push(tagEvidence);
    }

    return evidenceItems;
  }

  private checkContent(paymentHash: string, eventId: string, rawContent: unknown): EvidenceItem | null {
    if (typeof rawContent !== 'string') {
      return null;
    }

    const contentLower = rawContent.toLowerCase();
    const matchIndex = contentLower.indexOf(paymentHash);
    if (matchIndex === -1) {
      return null;
    }

    const matchedSubstring = rawContent.slice(matchIndex, matchIndex + paymentHash.length);
    return new EvidenceItem({
      kind: 'RawData',
      ref: eventId,
      description: `Payment hash ${paymentHash} appears in Nostr event ${eventId}.`,
      data: {
        field: 'content',
        match: matchedSubstring
      }
    });
  }

  private checkTags(paymentHash: string, eventId: string, rawTags: unknown): EvidenceItem[] {
    if (!Array.isArray(rawTags)) {
      return [];
    }

    const evidenceItems: EvidenceItem[] = [];

    for (const rawTag of rawTags) {
      if (!Array.isArray(rawTag)) {
        continue;
      }

      const hasMatch = rawTag.some(
        (element) => typeof element === 'string' && element.toLowerCase() === paymentHash
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

    return evidenceItems;
  }
}
