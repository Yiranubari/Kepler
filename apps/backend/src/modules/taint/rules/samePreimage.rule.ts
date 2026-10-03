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
import { matchesPreimage } from '../../../shared/taintMatching';

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

    const rawContent = eventNode.metadata ? eventNode.metadata.content : undefined;
    const contentStr = typeof rawContent === 'string' ? rawContent : '';
    const rawTags = eventNode.metadata ? eventNode.metadata.tags : undefined;
    const parsedTags: string[][] = Array.isArray(rawTags)
      ? rawTags
          .filter((tag): tag is unknown[] => Array.isArray(tag))
          .map((tag) => tag.filter((e): e is string => typeof e === 'string'))
      : [];

    const result = matchesPreimage(contentStr, parsedTags, preimage);
    if (!result.matched) {
      return evidenceItems;
    }

    if (result.field === 'content') {
      const contentLower = contentStr.toLowerCase();
      const matchIndex = contentLower.indexOf(preimage);
      const matchedSubstring = contentStr.slice(matchIndex, matchIndex + preimage.length);
      evidenceItems.push(
        new EvidenceItem({
          kind: 'RawData',
          ref: eventId,
          description: `Lightning preimage ${preimage} appears in Nostr event ${eventId}.`,
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
          (element) => element.toLowerCase() === preimage
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
    }

    return evidenceItems;
  }
}
