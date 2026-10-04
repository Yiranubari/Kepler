import { relationshipLabel } from '@kepler/shared';

export interface TaintGraphExplanationInput {
  readonly scenarioKind: "Lightning" | "Bitcoin" | "Cashu";
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly topEdges: ReadonlyArray<{
    readonly relationship: string;
    readonly confidence: number;
    readonly fromType: string;
    readonly toType: string;
    readonly fromIdTruncated: string;
    readonly toIdTruncated: string;
  }>;
  readonly topPaths: ReadonlyArray<{
    readonly length: number;
    readonly overallConfidence: number;
    readonly nodeTypes: readonly string[];
  }>;
}

export interface EvidenceSummaryInput {
  readonly claimType: string;
  readonly claimText: string;
  readonly confidence: number | null;
  readonly rawDataRefs: ReadonlyArray<{
    readonly source: string;
    readonly refTruncated: string;
  }>;
  readonly verificationStepNames: readonly string[];
  readonly valid: boolean | null;
}

export interface RouteSuggestionInput {
  readonly paymentTargetKind: "Lightning" | "Bitcoin" | "Cashu";
  readonly paymentTargetTruncated: string;
  readonly candidateRoutes: ReadonlyArray<{
    readonly name: string;
    readonly protocol: string;
    readonly estimatedFeeSats: number | null;
    readonly estimatedLinkageConfidence: number;
  }>;
  readonly constraints: {
    readonly maxFeeSats: number | null;
    readonly requireNonCustodial: boolean;
  };
}

export class AIPrompt {
  public static readonly SYSTEM_PROMPT =
    'You are explaining a privacy analysis to someone who has never used a Bitcoin wallet before.\n\n' +
    'Write for a smart person who does not know any technical terms. Imagine you are explaining this to a friend over coffee.\n\n' +
    'Strict rules:\n\n' +
    '- Plain text only. No markdown. No asterisks. No underscores. No backticks. No bullet points. No numbered lists. No headings. Just sentences.\n' +
    '- No em dashes or en dashes. Use periods, commas, colons, or semicolons.\n' +
    '- Do not use any internal identifier. Never write a word in all capital letters. Never write a word containing an underscore.\n' +
    '- Do not use these words: hash, preimage, pubkey, npub, invoice, taint, correlation, propagation, linkage, anonymity set, edge, node, graph, confidence score, identifier, protocol.\n' +
    '- Instead of "payment hash", say "payment code".\n' +
    '- Instead of "preimage", say "the secret that proves the payment".\n' +
    '- Instead of "pubkey" or "npub", say "public key" or "the code that identifies this user".\n' +
    '- Instead of "invoice", say "payment request".\n' +
    '- Instead of "taint graph", say "the connections between your payment and other things".\n' +
    '- Instead of "confidence", say "how sure we are".\n' +
    '- Instead of "edge", say "link".\n' +
    '- Instead of "node", say "item".\n\n' +
    'Structure your answer in three short paragraphs:\n\n' +
    '1. First paragraph: what the analysis found. One or two sentences. Name the items involved in plain words ("your payment request", "a public note", "the payment code").\n' +
    '2. Second paragraph: what the links mean. Explain each link in one sentence. Use phrases like "this shows that" or "this suggests that". If a link is strong, say so. If a link is weak, say so.\n' +
    '3. Third paragraph: what the user should understand. One or two sentences about the practical implication for their privacy. Do not alarm them. Do not use the words "deanonymize", "surveillance", or "exposed". Say things like "someone looking at the public data could connect these two things" or "this makes it easier to see that these payments came from the same person".\n\n' +
    'Constraints:\n\n' +
    '- Under 120 words total.\n' +
    '- No exclamation marks.\n' +
    '- No financial advice.\n' +
    '- Never claim to know who owns anything. Always use "could", "might", "appears to", not "is".\n' +
    '- Do not use the words "we" or "our". The analysis is describing what the data shows, not what Kepler did.\n' +
    '- Do not end with a suggestion or a call to action. Just explain.';

  public static truncateHash(value: string): string {
    const trimmed = value.trim();
    if (trimmed.includes("…")) {
      return trimmed;
    }
    if (trimmed.length <= 16) {
      return trimmed;
    }
    return `${trimmed.slice(0, 8)}…${trimmed.slice(-8)}`;
  }

  public static truncateInvoice(value: string): string {
    const trimmed = value.trim();
    if (trimmed.includes("…")) {
      return trimmed;
    }
    if (trimmed.length <= 16) {
      return trimmed;
    }
    return `${trimmed.slice(0, 12)}…${trimmed.slice(-4)}`;
  }

  public static formatAmountSats(amount: number | null): string {
    if (amount === null || amount === undefined) {
      return "None";
    }
    if (amount > 100000) {
      return "<large amount>";
    }
    return `${amount} sats`;
  }

  public static explainTaintGraph(input: TaintGraphExplanationInput): {
    system: string;
    user: string;
  } {
    const edges = input.topEdges.slice(0, 5);

    const edgeLines = edges.map((e) => {
      const level =
        e.confidence >= 0.9 ? 'high' : e.confidence >= 0.6 ? 'medium' : 'low';
      return `- ${relationshipLabel(e.relationship)}, how sure we are: ${level}`;
    });

    const userPrompt = [
      `Scenario Kind: ${input.scenarioKind}`,
      `Total items: ${input.nodeCount}`,
      `Total links: ${input.edgeCount}`,
      'Top connections found:',
      ...(edgeLines.length > 0 ? edgeLines : ['- None']),
      'Please explain what these connections mean for privacy in plain language.'
    ].join('\n');

    return {
      system: AIPrompt.SYSTEM_PROMPT,
      user: userPrompt
    };
  }

  public static summarizeEvidence(input: EvidenceSummaryInput): {
    system: string;
    user: string;
  } {
    const rawRefs = input.rawDataRefs.map((ref, idx) => {
      const truncated = AIPrompt.truncateHash(ref.refTruncated);
      return `  ${idx + 1}. Source: ${ref.source}, Reference: ${truncated}`;
    });

    const steps = input.verificationStepNames.map(
      (step, idx) => `  ${idx + 1}. ${step}`,
    );
    const confidenceStr =
      input.confidence !== null ? `${input.confidence}` : "N/A";
    const validStr =
      input.valid !== null
        ? input.valid
          ? "Verified"
          : "Invalid"
        : "Unverified";

    const userPrompt = [
      `Claim Type: ${input.claimType}`,
      `Claim Statement: ${input.claimText}`,
      `Confidence: ${confidenceStr}`,
      `Verification Status: ${validStr}`,
      "Supporting Raw Data References:",
      ...(rawRefs.length > 0 ? rawRefs : ["  None"]),
      "Completed Verification Steps:",
      ...(steps.length > 0 ? steps : ["  None"]),
      "Please summarize this evidence bundle and its verification findings for the user in plain language.",
    ].join("\n");

    return {
      system: AIPrompt.SYSTEM_PROMPT,
      user: userPrompt,
    };
  }

  public static suggestRoute(input: RouteSuggestionInput): {
    system: string;
    user: string;
  } {
    const targetTruncated =
      input.paymentTargetKind === "Lightning"
        ? AIPrompt.truncateInvoice(input.paymentTargetTruncated)
        : AIPrompt.truncateHash(input.paymentTargetTruncated);

    const maxFeeStr = AIPrompt.formatAmountSats(input.constraints.maxFeeSats);
    const nonCustodialStr = input.constraints.requireNonCustodial
      ? "Yes"
      : "No";

    const routeLines = input.candidateRoutes.map((r, idx) => {
      const feeStr = AIPrompt.formatAmountSats(r.estimatedFeeSats);
      return `  ${idx + 1}. Route: ${r.name}, Protocol: ${r.protocol}, Estimated Fee: ${feeStr}, Linkage Risk: ${r.estimatedLinkageConfidence}`;
    });

    const userPrompt = [
      `Payment Target Kind: ${input.paymentTargetKind}`,
      `Payment Target: ${targetTruncated}`,
      "Constraints:",
      `  Max Fee: ${maxFeeStr}`,
      `  Require Non-Custodial: ${nonCustodialStr}`,
      "Candidate Routes:",
      ...(routeLines.length > 0 ? routeLines : ["  None"]),
      "Please suggest the best payment route based on privacy and fees, and explain the tradeoffs in plain language.",
    ].join("\n");

    return {
      system: AIPrompt.SYSTEM_PROMPT,
      user: userPrompt,
    };
  }
}
