export type MatchField = 'content' | 'tags' | null;

export interface MatchResult {
  readonly matched: boolean;
  readonly field: MatchField;
}

export function matchesPaymentHash(
  content: string,
  tags: string[][],
  hash: string
): MatchResult {
  const lowerHash = hash.toLowerCase();
  const contentLower = content.toLowerCase();
  if (contentLower.indexOf(lowerHash) !== -1) {
    return { matched: true, field: 'content' };
  }
  const inTags = tags.some((tag) =>
    tag.some((elem) => elem.toLowerCase() === lowerHash)
  );
  if (inTags) {
    return { matched: true, field: 'tags' };
  }
  return { matched: false, field: null };
}

export function matchesPreimage(
  content: string,
  tags: string[][],
  preimage: string
): MatchResult {
  const lowerPreimage = preimage.toLowerCase();
  const contentLower = content.toLowerCase();
  if (contentLower.indexOf(lowerPreimage) !== -1) {
    return { matched: true, field: 'content' };
  }
  const inTags = tags.some((tag) =>
    tag.some((elem) => elem.toLowerCase() === lowerPreimage)
  );
  if (inTags) {
    return { matched: true, field: 'tags' };
  }
  return { matched: false, field: null };
}

export function matchesPubkey(
  eventPubkey: string,
  expectedPubkey: string
): boolean {
  return eventPubkey.trim().toLowerCase() === expectedPubkey.trim().toLowerCase();
}

export function matchesMintUrl(
  content: string,
  tags: string[][],
  mintUrl: string
): MatchResult {
  const normalizedMint = mintUrl.trim().replace(/\/+$/, '');
  if (content.indexOf(normalizedMint) !== -1) {
    return { matched: true, field: 'content' };
  }
  const inTags = tags.some((tag) =>
    tag.some((elem) => elem === normalizedMint)
  );
  if (inTags) {
    return { matched: true, field: 'tags' };
  }
  return { matched: false, field: null };
}

export function matchesQuoteHash(
  mintQuoteHashes: string[],
  paymentHash: string
): boolean {
  const lowerPaymentHash = paymentHash.toLowerCase();
  return mintQuoteHashes.some(
    (qh) => qh.trim().toLowerCase() === lowerPaymentHash
  );
}

export function matchesTemporalWindow(
  tsA: number,
  tsB: number,
  windowSeconds: number
): boolean {
  return Math.abs(tsA - tsB) < windowSeconds;
}

export function extractQuoteHashesFromRequest(request: string): string[] {
  if (typeof request !== 'string' || request.trim().length === 0) {
    return [];
  }
  const hexMatch = request.match(/[0-9a-fA-F]{64}/);
  if (!hexMatch) {
    return [];
  }
  return [hexMatch[0].toLowerCase()];
}
