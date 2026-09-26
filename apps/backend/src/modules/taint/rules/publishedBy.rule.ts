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

export class PublishedByRule implements TaintRule {
  public readonly name: string = 'published_by';
  public readonly description: string =
    'Emits an edge from a Nostr event to its publishing pubkey node.';
  public readonly relationship: string = 'PUBLISHED_BY';
  public readonly maxConfidence: number = 1.0;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const eventNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.EventId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const pubkeyNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.Pubkey)
      .sort((a, b) => a.id.localeCompare(b.id));

    const edges: EdgeDraft[] = [];

    for (const eventNode of eventNodes) {
      const rawPubkey = eventNode.metadata ? eventNode.metadata['pubkey'] : undefined;
      if (typeof rawPubkey !== 'string') {
        continue;
      }

      const pubkey = rawPubkey.trim().toLowerCase();
      if (!this.isValidPubkey(pubkey)) {
        continue;
      }

      const matchingPubkey = this.findMatchingPubkeyNode(pubkey, pubkeyNodes);
      if (!matchingPubkey) {
        continue;
      }

      const eventId =
        typeof eventNode.value === 'string'
          ? eventNode.value.trim().toLowerCase()
          : eventNode.id;

      edges.push({
        from: eventNode.id,
        to: matchingPubkey.id,
        relationship: this.relationship,
        confidence: this.maxConfidence,
        evidence: [
          new EvidenceItem({
            kind: 'RawData',
            ref: eventId,
            description: `Nostr event ${eventId} was published by pubkey ${matchingPubkey.value}.`,
            data: {
              field: 'pubkey',
              match: matchingPubkey.value
            }
          })
        ]
      });
    }

    return { edges };
  }

  private isValidPubkey(pubkey: string): boolean {
    return /^[0-9a-f]{64}$/.test(pubkey);
  }

  private findMatchingPubkeyNode(
    pubkey: string,
    pubkeyNodes: readonly TaintNode[]
  ): TaintNode | undefined {
    return pubkeyNodes.find((pubkeyNode) => {
      const pubkeyVal = pubkeyNode.value.trim().toLowerCase();
      return pubkeyVal === pubkey || pubkeyNode.id.toLowerCase() === `pubkey:${pubkey}`;
    });
  }
}
