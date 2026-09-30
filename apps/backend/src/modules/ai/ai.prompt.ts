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
  private static readonly SYSTEM_PROMPT =
    "You are a Bitcoin privacy analyst helping a non-technical user understand their wallet's privacy risks. " +
    "You explain findings in clear, plain language. " +
    "You never invent numbers. " +
    "You never claim certainty about ownership. " +
    'You refer to correlations as "potential links" with the stated confidence. ' +
    "You do not include em dashes and emojis in your responses. " +
    "You do not give financial advice. " +
    "You keep responses under 150 words unless the user asks for detail.";

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
    const paths = input.topPaths.slice(0, 5);

    const edgeLines = edges.map((e, idx) => {
      const fromId = AIPrompt.truncateHash(e.fromIdTruncated);
      const toId = AIPrompt.truncateHash(e.toIdTruncated);
      return `  ${idx + 1}. Relationship: ${e.relationship}, Confidence: ${e.confidence}, From: ${e.fromType} (${fromId}), To: ${e.toType} (${toId})`;
    });

    const pathLines = paths.map((p, idx) => {
      return `  ${idx + 1}. Length: ${p.length}, Overall Confidence: ${p.overallConfidence}, Path: ${p.nodeTypes.join(" -> ")}`;
    });

    const userPrompt = [
      `Scenario Kind: ${input.scenarioKind}`,
      `Total Nodes: ${input.nodeCount}`,
      `Total Edges: ${input.edgeCount}`,
      "Top Identified Connections:",
      ...(edgeLines.length > 0 ? edgeLines : ["  None"]),
      "Top Potential Link Paths:",
      ...(pathLines.length > 0 ? pathLines : ["  None"]),
      "Please explain the privacy implications of these connections in plain language.",
    ].join("\n");

    return {
      system: AIPrompt.SYSTEM_PROMPT,
      user: userPrompt,
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
