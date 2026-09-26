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

export class SamePreimageRule implements TaintRule {
  public readonly name: string = 'same_preimage';
  public readonly description: string =
    'Emits an edge when a Lightning preimage appears in both a Lightning invoice and a Nostr event.';
  public readonly relationship: string = 'SAME_PREIMAGE';
  public readonly maxConfidence: number = 1.0;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const preimageNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.Preimage)
      .sort((a, b) => a.id.localeCompare(b.id));

    const eventNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.EventId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const edges: EdgeDraft[] = [];

    for (const preimageNode of preimageNodes) {
      if (typeof preimageNode.value !== 'string') {
        continue;
      }
      const preimage = preimageNode.value.trim().toLowerCase();
      if (!this.isValidPreimage(preimage)) {
        continue;
      }

      for (const eventNode of eventNodes) {
        const evidenceItems = this.collectEvidence(preimage, eventNode);
        if (evidenceItems.length === 0) {
          continue;
        }

        edges.push({
          from: preimageNode.id,
          to: eventNode.id,
          relationship: this.relationship,
          confidence: this.maxConfidence,
          evidence: evidenceItems
        });
      }
    }

    return { edges };
  }

  private isValidPreimage(preimage: string): boolean {
    return preimage.length === 64 && /^[0-9a-f]{64}$/.test(preimage);
  }

  private collectEvidence(preimage: string, eventNode: TaintNode): EvidenceItem[] {
    const evidenceItems: EvidenceItem[] = [];
    const eventId =
      typeof eventNode.value === 'string'
        ? eventNode.value.trim().toLowerCase()
        : eventNode.id;

    const rawContent = eventNode.metadata ? eventNode.metadata['content'] : undefined;
    const contentEvidence = this.checkContent(preimage, eventId, rawContent);
    if (contentEvidence !== null) {
      evidenceItems.push(contentEvidence);
    }

    const rawTags = eventNode.metadata ? eventNode.metadata['tags'] : undefined;
    const tagEvidenceItems = this.checkTags(preimage, eventId, rawTags);
    for (const tagEvidence of tagEvidenceItems) {
      evidenceItems.push(tagEvidence);
    }

    return evidenceItems;
  }

  private checkContent(preimage: string, eventId: string, rawContent: unknown): EvidenceItem | null {
    if (typeof rawContent !== 'string') {
      return null;
    }

    const contentLower = rawContent.toLowerCase();
    const matchIndex = contentLower.indexOf(preimage);
    if (matchIndex === -1) {
      return null;
    }

    const matchedSubstring = rawContent.slice(matchIndex, matchIndex + preimage.length);
    return new EvidenceItem({
      kind: 'RawData',
      ref: eventId,
      description: `Lightning preimage ${preimage} appears in Nostr event ${eventId}.`,
      data: {
        field: 'content',
        match: matchedSubstring
      }
    });
  }

  private checkTags(preimage: string, eventId: string, rawTags: unknown): EvidenceItem[] {
    if (!Array.isArray(rawTags)) {
      return [];
    }

    const evidenceItems: EvidenceItem[] = [];

    for (const rawTag of rawTags) {
      if (!Array.isArray(rawTag)) {
        continue;
      }

      const hasMatch = rawTag.some(
        (element) => typeof element === 'string' && element.toLowerCase() === preimage
      );

      if (hasMatch) {
        evidenceItems.push(
          new EvidenceItem({
            kind: 'RawData',
            ref: eventId,
            description: `Lightning preimage ${preimage} appears in Nostr event ${eventId}.`,
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
