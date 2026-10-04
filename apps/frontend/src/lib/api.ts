import { getFriendlyMessage } from "@/lib/errorMessages";
import {
  Scenario,
  Policy,
  PaymentTarget,
  PaymentTargetKind,
  type PaymentTargetPayload,
  ScenarioStatus,
  PolicyScope
} from "@kepler/shared";

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

export type SupportedNetwork =
  | "mainnet"
  | "testnet"
  | "testnet4"
  | "signet"
  | "regtest";

export interface AppConfigResponse {
  network: SupportedNetwork;
  updatedAt: string;
}

export interface PaymentTargetInput {
  kind: "Lightning" | "Bitcoin" | "Cashu" | "lightning" | "bitcoin" | "cashu";
  payload: Record<string, unknown>;
}

export interface ScenarioResponse {
  id: string;
  target: PaymentTargetInput;
  status: "Pending" | "Analyzed" | "Decided" | "Executed" | "Failed";
  network?: SupportedNetwork;
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

export interface AnalyzeOptions {
  ingestData?: Record<string, unknown>;
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
    this.baseUrl =
      typeof window !== "undefined" && import.meta.env.DEV
        ? ""
        : baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  public async request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
        let code = "SERVICE_UNAVAILABLE";
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
          } else {
            code = "SERVICE_UNAVAILABLE";
          }
        }

        const friendlyMessage = getFriendlyMessage(code);
        throw new ClientError(code, response.status, friendlyMessage);
      }

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new ClientError(
          "SERVICE_UNAVAILABLE",
          response.status,
          getFriendlyMessage("SERVICE_UNAVAILABLE")
        );
      }
      return data as T;
    } catch (err: unknown) {
      if (err instanceof ClientError) {
        throw err;
      }

      if (err instanceof Error && err.name === "AbortError") {
        throw new ClientError(
          "SERVICE_UNAVAILABLE",
          408,
          getFriendlyMessage("SERVICE_UNAVAILABLE")
        );
      }

      throw new ClientError(
        "SERVICE_UNAVAILABLE",
        0,
        getFriendlyMessage("SERVICE_UNAVAILABLE")
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

  public async analyzeTaint(
    scenarioId: string,
    ingestDataOrOptions?: Record<string, unknown> | AnalyzeOptions
  ): Promise<AnalyzeResponse> {
    const ingestData =
      ingestDataOrOptions && "ingestData" in ingestDataOrOptions
        ? ingestDataOrOptions.ingestData
        : ingestDataOrOptions;

    return this.request<AnalyzeResponse>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        scenarioId,
        ...(ingestData ? { ingestData } : {})
      })
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

  public async getFees(network?: string): Promise<OnchainFeesResponse> {
    const selectedNetwork = network || "testnet4";
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

  public async getAppConfig(): Promise<AppConfigResponse> {
    return this.request<AppConfigResponse>("/api/config", {
      method: "GET"
    });
  }

  public async setNetwork(
    network: SupportedNetwork
  ): Promise<AppConfigResponse> {
    return this.request<AppConfigResponse>("/api/config/network", {
      method: "PUT",
      body: JSON.stringify({ network })
    });
  }
}

const defaultClient = new ApiClient();

export const createScenario = (
  target: PaymentTargetInput
): Promise<ScenarioResponse> => {
  return defaultClient.createScenario(target);
};

export const getScenario = (id: string): Promise<ScenarioResponse> => {
  return defaultClient.getScenario(id);
};

export const analyzeTaint = (
  scenarioId: string,
  ingestDataOrOptions?: Record<string, unknown> | AnalyzeOptions
): Promise<AnalyzeResponse> => {
  return defaultClient.analyzeTaint(scenarioId, ingestDataOrOptions);
};

export const orchestrate = (
  scenarioId: string,
  options?: OrchestrateOptions
): Promise<OrchestrateResponse> => {
  return defaultClient.orchestrate(scenarioId, options);
};

export const getFees = (network?: string): Promise<OnchainFeesResponse> => {
  return defaultClient.getFees(network);
};

export const decodeLightningInvoice = (
  invoice: string
): Promise<LightningDecodeResponse> => {
  return defaultClient.decodeLightningInvoice(invoice);
};

export const getMintInfo = (
  mintUrl: string
): Promise<CashuMintInfoResponse> => {
  return defaultClient.getMintInfo(mintUrl);
};

export const getAppConfig = (): Promise<AppConfigResponse> => {
  return defaultClient.getAppConfig();
};

export const setNetwork = (
  network: SupportedNetwork
): Promise<AppConfigResponse> => {
  return defaultClient.setNetwork(network);
};

export const listScenarios = (
  limitOrParams?: number | { limit?: number; offset?: number; network?: SupportedNetwork },
  offsetParam?: number,
  network?: SupportedNetwork
): Promise<ScenarioResponse[]> => {
  let limit: number | undefined;
  let offset: number | undefined;
  let selectedNetwork: SupportedNetwork | undefined = network;

  if (typeof limitOrParams === "number") {
    limit = limitOrParams;
    offset = offsetParam;
  } else if (limitOrParams) {
    limit = limitOrParams.limit;
    offset = limitOrParams.offset;
    if (limitOrParams.network !== undefined) {
      selectedNetwork = limitOrParams.network;
    }
  }

  const searchParams = new URLSearchParams();
  if (limit !== undefined) {
    searchParams.set("limit", String(limit));
  }
  if (offset !== undefined) {
    searchParams.set("offset", String(offset));
  }
  if (selectedNetwork !== undefined) {
    searchParams.set("network", selectedNetwork);
  }
  const query = searchParams.toString();
  const path = query ? `/api/scenarios?${query}` : "/api/scenarios";
  return defaultClient.request<ScenarioResponse[]>(path, {
    method: "GET"
  });
};

export const getPolicy = (): Promise<PolicyResponse> => {
  return defaultClient.request<PolicyResponse>("/api/policy", {
    method: "GET"
  });
};

export function toScenario(response: ScenarioResponse): Scenario {
  const normalizedKind =
    response.target.kind.toLowerCase() === "lightning"
      ? PaymentTargetKind.Lightning
      : response.target.kind.toLowerCase() === "bitcoin"
      ? PaymentTargetKind.Bitcoin
      : PaymentTargetKind.Cashu;

  const target = new PaymentTarget({
    kind: normalizedKind,
    payload: response.target.payload as unknown as PaymentTargetPayload
  });

  return new Scenario({
    id: response.id,
    target,
    status: response.status as ScenarioStatus,
    createdAt: new Date(response.createdAt),
    updatedAt: new Date(response.updatedAt)
  });
}

export function toPolicy(response: PolicyResponse): Policy {
  return new Policy({
    id: response.id,
    dailyBudgetSats: Number(response.dailyBudgetSats),
    perTxBudgetSats: Number(response.perTxBudgetSats),
    scopes: response.scopes as PolicyScope[],
    allowedMints: response.allowedMints,
    allowedRelays: response.allowedRelays,
    allowedEsplora: response.allowedEsplora,
    updatedAt: new Date(response.updatedAt)
  });
}
