export const RELATIONSHIP_LABELS: Record<string, string> = {
  SAME_PAYMENT_HASH: "Same payment code",
  SAME_PREIMAGE: "Same secret value",
  PUBLISHED_BY: "Published by this user",
  TEMPORAL_WINDOW: "Happened around the same time",
  SHARED_MINT: "Same ecash service",
  CASHU_QUOTE_INVOICE: "Ecash service issued this quote",
  GRAPH_SUMMARY: "Overall summary"
};

export function relationshipLabel(relationship: string): string {
  return RELATIONSHIP_LABELS[relationship] ?? "Related";
}
