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
import { matchesMintUrl } from '../../../shared/taintMatching';

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
    const rawContent = eventNode.metadata.content;
    const contentStr = typeof rawContent === 'string' ? rawContent : '';
    const rawTags = eventNode.metadata.tags;
    const parsedTags: string[][] = Array.isArray(rawTags)
      ? rawTags
          .filter((tag): tag is unknown[] => Array.isArray(tag))
          .map((tag) => tag.filter((e): e is string => typeof e === 'string'))
      : [];

    const result = matchesMintUrl(contentStr, parsedTags, mintUrl);
    if (!result.matched) {
      return null;
    }

    if (result.field === 'content') {
      const matchTarget =
        contentStr.indexOf(mintUrl) !== -1
          ? mintUrl
          : mintUrl.trim().replace(/\/+$/, '');
      const matchIndex = contentStr.indexOf(matchTarget);
      const matchedSubstring =
        matchIndex !== -1
          ? contentStr.slice(matchIndex, matchIndex + matchTarget.length)
          : mintUrl;
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

    if (result.field === 'tags') {
      const normalizedMint = mintUrl.trim().replace(/\/+$/, '');
      const matchingTag = parsedTags.find((rawTag) =>
        rawTag.some(
          (element) => element === mintUrl || element === normalizedMint
        )
      );
      if (matchingTag) {
        return new EvidenceItem({
          kind: 'RawData',
          ref: eventId,
          description: `Cashu mint ${mintUrl} is referenced by Nostr event ${eventId}.`,
          data: {
            field: 'tags',
            match: matchingTag,
            mint: mintUrl
          }
        });
      }
    }

    return null;
  }
}
