import {
  Scenario,
  TaintGraph,
  KeplerLogger
} from '@kepler/shared';
import { BitcoinClient } from '@kepler/bitcoin';
import { LightningClient } from '@kepler/lightning';
import { CashuClient } from '@kepler/cashu';
import { NostrClient } from '@kepler/nostr';
import { PrismaClient } from '@prisma/client';
import { ScenarioService } from '../scenario';
import { TaintService, TaintIngestPayload } from '../taint';
import { ProofService } from '../proof';
import { PolicyService } from '../policy';
import { OnchainService } from '../onchain';

export interface OrchestratorDeps {
  readonly scenarioService: ScenarioService;
  readonly taintService: TaintService;
  readonly proofService: ProofService;
  readonly policyService: PolicyService;
  readonly onchainService: OnchainService;
  readonly nostrClient: NostrClient;
  readonly lightningClient: LightningClient;
  readonly cashuClient: CashuClient;
  readonly logger: KeplerLogger;
  readonly bitcoinClient: BitcoinClient;
  readonly prisma: PrismaClient;
}

import type { RouteCandidate } from '../../shared/route.selector';
export type { RouteCandidate };

export interface OrchestrateRequest {
  readonly scenarioId: string;
  readonly ingestData: TaintIngestPayload;
  readonly candidateRoutes?: RouteCandidate[];
}

export interface DecisionSummary {
  readonly routeName: string;
  readonly protocol: string;
  readonly evidenceBundleHash: string;
  readonly reason: string;
}

export interface ExecutionSummary {
  readonly status: 'succeeded' | 'failed';
  readonly amountSats: string;
  readonly feeSats: string;
  readonly identifier: string;
  readonly protocol: string;
}

export interface OrchestrateResponse {
  readonly scenarioId: string;
  readonly decision: DecisionSummary;
  readonly execution: ExecutionSummary;
  readonly nostrEventId: string | null;
}

export interface FlowContext {
  readonly scenario: Scenario;
  readonly graph: TaintGraph;
  readonly route: RouteCandidate;
  readonly amountSats: bigint;
  readonly taintService: TaintService;
  readonly proofService: ProofService;
  readonly policyService: PolicyService;
  readonly bitcoinClient: BitcoinClient;
  readonly lightningClient: LightningClient;
  readonly cashuClient: CashuClient;
  readonly nostrClient: NostrClient;
  readonly onchainService: OnchainService;
  readonly logger: KeplerLogger;
}

export interface FlowResult {
  readonly status: 'succeeded' | 'failed';
  readonly identifier: string;
  readonly amountSats: bigint;
  readonly feeSats: bigint;
  readonly rawDetail: Record<string, unknown>;
}
