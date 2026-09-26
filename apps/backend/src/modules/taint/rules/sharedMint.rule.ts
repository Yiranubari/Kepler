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

export class SharedMintRule implements TaintRule {
  public readonly name: string = 'shared_mint';
  public readonly description: string =
    'Emits an edge when a Cashu mint URL referenced by a Cashu token also appears in a Nostr event.';
  public readonly relationship: string = 'SHARED_MINT';
  public readonly maxConfidence: number = 0.6;

  public apply(context: TaintRuleContext): TaintRuleResult {
    const mintNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.Mint)
      .sort((a, b) => a.id.localeCompare(b.id));

    const eventNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.EventId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const tokenNodes = context.graph.nodes
      .filter((node) => node.type === TaintNodeType.CashuToken)
      .sort((a, b) => a.id.localeCompare(b.id));

    const edges: EdgeDraft[] = [];

    for (const tokenNode of tokenNodes) {
      const rawMint = tokenNode.metadata ? tokenNode.metadata['mint'] : undefined;
      if (typeof rawMint !== 'string') {
        continue;
      }

      const normalizedMint = this.normalizeMintUrl(rawMint);
      if (!this.isValidUrl(normalizedMint)) {
        continue;
      }

      const targetMintId = `mint:${normalizedMint}`;
      const mintNode =
        mintNodes.find((node) => node.id === targetMintId) ??
        context.graph.getNode(targetMintId);

      if (!mintNode || mintNode.type !== TaintNodeType.Mint) {
        continue;
      }

      for (const eventNode of eventNodes) {
        const eventId =
          typeof eventNode.value === 'string'
            ? eventNode.value.trim().toLowerCase()
            : eventNode.id;

        const evidenceItem = this.checkEventEvidence(
          normalizedMint,
          eventId,
          eventNode
        );

        if (!evidenceItem) {
          continue;
        }

        edges.push({
          from: mintNode.id,
          to: eventNode.id,
          relationship: this.relationship,
          confidence: this.maxConfidence,
          evidence: [evidenceItem]
        });
      }
    }

    return { edges };
  }

  private normalizeMintUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }

  private isValidUrl(url: string): boolean {
    if (url.length === 0) {
      return false;
    }
    try {
      const parsed = new URL(url);
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.host.length > 0
      );
    } catch {
      return false;
    }
  }

  private checkEventEvidence(
    mintUrl: string,
    eventId: string,
    eventNode: TaintNode
  ): EvidenceItem | null {
    const rawContent = eventNode.metadata
      ? eventNode.metadata['content']
      : undefined;

    if (typeof rawContent === 'string') {
      const matchIndex = rawContent.indexOf(mintUrl);
      if (matchIndex !== -1) {
        const matchedSubstring = rawContent.slice(
          matchIndex,
          matchIndex + mintUrl.length
        );
        return new EvidenceItem({
          kind: 'RawData',
          ref: eventId,
          description: `Cashu mint ${mintUrl} is referenced by Nostr event ${eventId}.`,
          data: {
            field: 'content',
            match: matchedSubstring,
            mint: mintUrl
          }
        });
      }
    }

    const rawTags = eventNode.metadata ? eventNode.metadata['tags'] : undefined;
    if (Array.isArray(rawTags)) {
      for (const rawTag of rawTags) {
        if (!Array.isArray(rawTag)) {
          continue;
        }
        const hasMatch = rawTag.some(
          (element) => typeof element === 'string' && element === mintUrl
        );
        if (hasMatch) {
          return new EvidenceItem({
            kind: 'RawData',
            ref: eventId,
            description: `Cashu mint ${mintUrl} is referenced by Nostr event ${eventId}.`,
            data: {
              field: 'tags',
              match: rawTag,
              mint: mintUrl
            }
          });
        }
      }
    }

    return null;
  }
}
