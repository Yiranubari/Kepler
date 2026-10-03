import { getFriendlyMessage } from "@/lib/errorMessages";

export class ClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly friendlyMessage: string;

  constructor(code: string, status: number, friendlyMessage: string) {
    super(friendlyMessage);
    this.name = "ClientError";
    this.code = code;
    this.status = status;
    this.friendlyMessage = friendlyMessage;
  }
}

export interface PaymentTargetInput {
  kind: "Lightning" | "Bitcoin" | "Cashu" | "lightning" | "bitcoin" | "cashu";
  payload: Record<string, unknown>;
}

export interface ScenarioResponse {
  id: string;
  target: PaymentTargetInput;
  status: "Pending" | "Analyzed" | "Decided" | "Executed" | "Failed";
  createdAt: string;
  updatedAt: string;
}

export interface AnalyzeResponse {
  graph: unknown;
  scenarioId: string;
  analyzedAt: string;
  ruleCount: number;
  nodeCount: number;
  edgeCount: number;
  pathCount: number;
}

export interface OrchestrateOptions {
  ingestData?: Record<string, unknown>;
  candidateRoutes?: unknown[];
}

export interface OrchestrateResponse {
  scenarioId: string;
  decision: {
    route: {
      type: "lightning" | "bitcoin" | "cashu";
      costSats: number;
      estimatedDurationSec: number;
      targetAddress?: string;
      mintUrl?: string;
    };
    explanation: string;
    proofBundleHash: string;
  };
  execution: {
    success: boolean;
    txid?: string;
    preimage?: string;
    feeSat?: number;
    completedAt: string;
  };
  nostrEventId: string | null;
}

export interface PolicyResponse {
  id: string;
  dailyBudgetSats: string;
  perTxBudgetSats: string;
  scopes: string[];
  allowedMints: string[];
  allowedRelays: string[];
  allowedEsplora: string[];
  updatedAt: string;
}

export interface OnchainFeesResponse {
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
  minimum: number;
}

export interface LightningDecodeResponse {
  paymentHash: string;
  amountMsat: string;
  expiry: number;
  timestamp: number;
  description: string;
  descriptionHash?: string | null;
  payeePubkey?: string | null;
}

export interface CashuMintInfoResponse {
  name: string;
  pubkey: string;
  version: string;
  description: string;
  descriptionLong?: string | null;
  contact?: string[][] | null;
  motd?: string | null;
  nuts: Record<string, unknown>;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl: string = import.meta.env.VITE_API_BASE_URL || "",
    timeoutMs = 30000
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined)
    };

    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        let code = "NETWORK_ERROR";
        try {
          const body: unknown = await response.json();
          if (
            body &&
            typeof body === "object" &&
            "error" in body &&
            body.error &&
            typeof body.error === "object" &&
            "code" in body.error &&
            typeof body.error.code === "string"
          ) {
            code = body.error.code;
          }
        } catch {
          if (response.status === 404) {
            code = "NOT_FOUND";
          } else if (response.status === 429) {
            code = "RATE_LIMIT_EXCEEDED";
          }
        }

        const friendlyMessage = getFriendlyMessage(code);
        throw new ClientError(code, response.status, friendlyMessage);
      }

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      const data: unknown = await response.json();
      return data as T;
    } catch (err: unknown) {
      if (err instanceof ClientError) {
        throw err;
      }

      if (err instanceof Error && err.name === "AbortError") {
        throw new ClientError(
          "NETWORK_ERROR",
          408,
          getFriendlyMessage("NETWORK_ERROR")
        );
      }

      throw new ClientError(
        "NETWORK_ERROR",
        0,
        getFriendlyMessage("NETWORK_ERROR")
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async createScenario(target: PaymentTargetInput): Promise<ScenarioResponse> {
    const normalizedKind =
      target.kind.toLowerCase() === "lightning"
        ? "Lightning"
        : target.kind.toLowerCase() === "bitcoin"
        ? "Bitcoin"
        : "Cashu";
    return this.request<ScenarioResponse>("/api/scenarios", {
      method: "POST",
      body: JSON.stringify({
        target: {
          kind: normalizedKind,
          payload: target.payload
        }
      })
    });
  }

  public async getScenario(id: string): Promise<ScenarioResponse> {
    return this.request<ScenarioResponse>(`/api/scenarios/${encodeURIComponent(id)}`, {
      method: "GET"
    });
  }

  public async listScenarios(
    limitOrParams?: number | { limit?: number; offset?: number },
    offsetParam?: number
  ): Promise<ScenarioResponse[]> {
    let limit: number | undefined;
    let offset: number | undefined;

    if (typeof limitOrParams === "number") {
      limit = limitOrParams;
      offset = offsetParam;
    } else if (limitOrParams) {
      limit = limitOrParams.limit;
      offset = limitOrParams.offset;
    }

    const searchParams = new URLSearchParams();
    if (limit !== undefined) {
      searchParams.set("limit", String(limit));
    }
    if (offset !== undefined) {
      searchParams.set("offset", String(offset));
    }
    const query = searchParams.toString();
    const path = query ? `/api/scenarios?${query}` : "/api/scenarios";
    return this.request<ScenarioResponse[]>(path, {
      method: "GET"
    });
  }

  public async analyzeTaint(scenarioId: string): Promise<AnalyzeResponse> {
    return this.request<AnalyzeResponse>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ scenarioId })
    });
  }

  public async orchestrate(
    scenarioId: string,
    options?: OrchestrateOptions
  ): Promise<OrchestrateResponse> {
    return this.request<OrchestrateResponse>("/api/orchestrator/orchestrate", {
      method: "POST",
      body: JSON.stringify({
        scenarioId,
        ingestData: options?.ingestData ?? {},
        ...(options?.candidateRoutes ? { candidateRoutes: options.candidateRoutes } : {})
      })
    });
  }

  public async getPolicy(): Promise<PolicyResponse> {
    return this.request<PolicyResponse>("/api/policy", {
      method: "GET"
    });
  }

  public async getFees(network?: string): Promise<OnchainFeesResponse> {
    const selectedNetwork =
      network || import.meta.env.VITE_BITCOIN_NETWORK || "testnet4";
    return this.request<OnchainFeesResponse>("/api/onchain/fees", {
      method: "POST",
      body: JSON.stringify({ network: selectedNetwork })
    });
  }

  public async decodeLightningInvoice(
    invoice: string
  ): Promise<LightningDecodeResponse> {
    return this.request<LightningDecodeResponse>(
      "/api/protocols/lightning/decode",
      {
        method: "POST",
        body: JSON.stringify({ invoice })
      }
    );
  }

  public async getMintInfo(mintUrl: string): Promise<CashuMintInfoResponse> {
    return this.request<CashuMintInfoResponse>("/api/protocols/cashu/mint", {
      method: "POST",
      body: JSON.stringify({ mintUrl })
    });
  }
}

export const api = new ApiClient();
