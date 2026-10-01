import { PrismaClient, Prisma } from '@prisma/client';
import {
  Scenario,
  ScenarioStatus,
  TaintGraph,
  TaintEdge,
  ClaimType,
  PaymentTargetKind,
  LightningTargetPayload,
  BitcoinTargetPayload,
  KeplerLogger,
  NotFoundError
} from '@kepler/shared';
import { BitcoinClient } from '@kepler/bitcoin';
import { LightningClient, Bolt11 } from '@kepler/lightning';
import { CashuClient } from '@kepler/cashu';
import { NostrClient } from '@kepler/nostr';
import { ScenarioService } from '../scenario/scenario.service';
import { ScenarioNotFoundError } from '../scenario/scenario.errors';
import { TaintService, TaintIngestPayload } from '../taint';
import { ProofService } from '../proof/proof.service';
import { PolicyService } from '../policy/policy.service';
import { OnchainService } from '../onchain/onchain.service';
import {
  OrchestrateRequest,
  OrchestrateResponse,
  RouteCandidate,
  FlowContext,
  FlowResult,
  OrchestratorDeps
} from './orchestrator.types';
import {
  OrchestratorNotFoundError,
  OrchestratorStateError,
  OrchestratorRouteError,
  OrchestratorExecutionError,
  OrchestratorNoRouteError
} from './orchestrator.errors';
import { RouteSelector } from '../../shared/route.selector';
import { PaymentFlow } from './flows/flow.interface';
import { PayLightningFlow } from './flows/payLightning.flow';
import { PayBitcoinFlow } from './flows/payBitcoin.flow';
import { PayCashuFlow } from './flows/payCashu.flow';

export class OrchestratorService {
  private readonly scenarioService: ScenarioService;
  private readonly taintService: TaintService;
  private readonly proofService: ProofService;
  private readonly policyService: PolicyService;
  private readonly onchainService: OnchainService;
  private readonly nostrClient: NostrClient;
  private readonly lightningClient: LightningClient;
  private readonly cashuClient: CashuClient;
  private readonly logger: KeplerLogger;
  private readonly bitcoinClient: BitcoinClient;
  private readonly prisma: PrismaClient;

  constructor(deps: OrchestratorDeps) {
    this.scenarioService = deps.scenarioService;
    this.taintService = deps.taintService;
    this.proofService = deps.proofService;
    this.policyService = deps.policyService;
    this.onchainService = deps.onchainService;
    this.nostrClient = deps.nostrClient;
    this.lightningClient = deps.lightningClient;
    this.cashuClient = deps.cashuClient;
    this.logger = deps.logger;
    this.bitcoinClient = deps.bitcoinClient;
    this.prisma = deps.prisma;
  }

  public async orchestrate(request: OrchestrateRequest): Promise<OrchestrateResponse> {
    const startTime = performance.now();

    const scenario = await this.loadScenario(request);
    await this.guardScenarioState(scenario);

    const graph = await this.fetchTaintGraph(scenario, request.ingestData);
    await this.checkPropose(scenario);

    const candidates = request.candidateRoutes ?? [];
    let route: RouteCandidate;
    try {
      route = this.selectRoute(scenario, graph, candidates);
    } catch (selectErr: unknown) {
      await this.markScenarioFailed(scenario.id);
      if (selectErr instanceof OrchestratorNoRouteError) {
        throw selectErr;
      }
      throw new OrchestratorNoRouteError(
        'Route selection failed',
        { scenarioId: scenario.id, candidateCount: candidates.length },
        selectErr instanceof Error ? selectErr : undefined
      );
    }

    const bundleHash = await this.buildEvidence(scenario, graph, route);
    const reasonString = this.generateDecisionReason(route);

    const amountSats = this.resolveAmount(scenario, route);
    await this.checkSend(scenario, route, amountSats);

    const flowResult = await this.executeFlow(scenario, graph, route, amountSats);
    const logId = await this.recordExecution(scenario, route, flowResult);

    let nostrEventId: string | null = null;
    if (flowResult.status === 'succeeded') {
      nostrEventId = await this.publishDecision(
        scenario,
        route,
        bundleHash,
        reasonString,
        logId
      );
    }

    const detailAmountSats =
      flowResult.status === 'succeeded' ? flowResult.amountSats.toString() : '0';
    const durationMs = Math.round(performance.now() - startTime);

    this.logger.info('Orchestration completed', {
      scenarioId: scenario.id,
      routeName: route.name,
      protocol: route.protocol,
      status: flowResult.status,
      durationMs
    });

    return {
      scenarioId: scenario.id,
      decision: {
        routeName: route.name,
        protocol: route.protocol,
        evidenceBundleHash: bundleHash,
        reason: reasonString
      },
      execution: {
        status: flowResult.status,
        amountSats: detailAmountSats,
        feeSats: flowResult.feeSats.toString(),
        identifier: flowResult.identifier,
        protocol: route.protocol
      },
      nostrEventId
    };
  }

  private async loadScenario(request: OrchestrateRequest): Promise<Scenario> {
    try {
      return await this.scenarioService.getById(request.scenarioId);
    } catch (err: unknown) {
      if (err instanceof ScenarioNotFoundError || err instanceof NotFoundError) {
        throw new OrchestratorNotFoundError(
          `Scenario ${request.scenarioId} not found`,
          { resource: 'Scenario', id: request.scenarioId },
          err instanceof Error ? err : undefined
        );
      }
      throw err;
    }
  }

  private async guardScenarioState(scenario: Scenario): Promise<void> {
    if (scenario.status !== ScenarioStatus.Pending) {
      throw new OrchestratorStateError(
        `Scenario ${scenario.id} is in status ${scenario.status}, expected Pending`,
        {
          scenarioId: scenario.id,
          currentStatus: scenario.status,
          expectedStatus: ScenarioStatus.Pending
        }
      );
    }

    const existingExecution = await this.prisma.executionLog.findFirst({
      where: {
        scenarioId: scenario.id,
        status: 'succeeded'
      }
    });

    if (existingExecution) {
      throw new OrchestratorStateError('Scenario already executed successfully', {
        scenarioId: scenario.id,
        currentStatus: scenario.status,
        expectedStatus: ScenarioStatus.Pending,
        reason: 'ALREADY_EXECUTED'
      });
    }
  }

  private async fetchTaintGraph(
    scenario: Scenario,
    ingestData: TaintIngestPayload
  ): Promise<TaintGraph> {
    try {
      const isIngestEmpty =
        !ingestData ||
        (!ingestData.bitcoin &&
          !ingestData.lightning &&
          !ingestData.nostr &&
          !ingestData.cashu);

      let graph: TaintGraph;
      if (isIngestEmpty) {
        graph = new TaintGraph({
          id: `graph-${scenario.id}`,
          scenarioId: scenario.id
        });
      } else {
        const analysis = await this.taintService.analyze(scenario.id, ingestData);
        graph = analysis.graph;
      }
      await this.scenarioService.updateStatus(scenario.id, ScenarioStatus.Analyzed);
      return graph;
    } catch (err: unknown) {
      await this.markScenarioFailed(scenario.id);
      throw new OrchestratorRouteError(
        'Taint analysis failed',
        { scenarioId: scenario.id, reason: 'TAINT_ANALYSIS_FAILED' },
        err instanceof Error ? err : undefined
      );
    }
  }

  private async checkPropose(scenario: Scenario): Promise<void> {
    try {
      await this.policyService.check({ kind: 'propose' });
    } catch (policyErr: unknown) {
      await this.markScenarioFailed(scenario.id);
      throw new OrchestratorStateError(
        'Policy check denied propose',
        {
          scenarioId: scenario.id,
          currentStatus: scenario.status,
          expectedStatus: ScenarioStatus.Analyzed,
          reason: 'POLICY_DENIED'
        },
        policyErr instanceof Error ? policyErr : undefined
      );
    }
  }

  private selectRoute(
    scenario: Scenario,
    _graph: TaintGraph,
    candidates: RouteCandidate[]
  ): RouteCandidate {
    return RouteSelector.select(scenario.target.kind, candidates);
  }

  private async buildEvidence(
    scenario: Scenario,
    graph: TaintGraph,
    route: RouteCandidate
  ): Promise<string> {
    try {
      const correlationInput = this.createCorrelationInput(scenario, graph, route);
      const bundle = await this.proofService.build(
        ClaimType.Privacy,
        correlationInput,
        { scenarioId: scenario.id }
      );
      await this.persistDecision(scenario.id, route, bundle.bundleHash);
      await this.scenarioService.updateStatus(scenario.id, ScenarioStatus.Decided);
      return bundle.bundleHash;
    } catch (evidenceErr: unknown) {
      await this.markScenarioFailed(scenario.id);
      throw new OrchestratorRouteError(
        'Failed to build evidence bundle',
        { scenarioId: scenario.id, reason: 'EVIDENCE_BUILD_FAILED' },
        evidenceErr instanceof Error ? evidenceErr : undefined
      );
    }
  }

  private createCorrelationInput(
    scenario: Scenario,
    graph: TaintGraph,
    route: RouteCandidate
  ): Record<string, unknown> {
    const matchingEdge = this.findMatchingEdge(graph, route.protocol);
    if (matchingEdge) {
      return {
        fromNodeId: matchingEdge.from,
        toNodeId: matchingEdge.to,
        relationship: matchingEdge.relationship,
        confidence: matchingEdge.confidence,
        edgeEvidence: matchingEdge.evidence.map((ev) => ({
          kind: ev.kind,
          ref: ev.ref,
          description: ev.description,
          data: ev.data
        })),
        rawDataRefs: [
          {
            source: route.protocol,
            ref: matchingEdge.id,
            payload: {
              edgeId: matchingEdge.id,
              relationship: matchingEdge.relationship
            }
          }
        ]
      };
    }
    return {
      fromNodeId: scenario.id,
      toNodeId: route.name,
      relationship: 'GRAPH_SUMMARY',
      confidence: route.estimatedLinkageConfidence,
      edgeEvidence: [],
      rawDataRefs: [
        {
          source: route.protocol,
          ref: scenario.id,
          payload: { scenarioId: scenario.id, routeName: route.name }
        }
      ]
    };
  }

  private async persistDecision(
    scenarioId: string,
    route: RouteCandidate,
    bundleHash: string
  ): Promise<void> {
    try {
      const evidenceRecord = await this.prisma.evidenceRecord.findUnique({
        where: { bundleHash }
      });
      if (evidenceRecord) {
        const routeRecord: Prisma.InputJsonObject = {
          name: route.name,
          protocol: route.protocol,
          estimatedFeeSats: route.estimatedFeeSats,
          estimatedLinkageConfidence: route.estimatedLinkageConfidence,
          ...(route.mint !== undefined ? { mint: route.mint } : {}),
          params: route.params as Prisma.InputJsonObject
        };
        await this.prisma.decision.create({
          data: {
            scenarioId,
            route: routeRecord,
            evidenceId: evidenceRecord.id
          }
        });
      }
    } catch (decisionErr: unknown) {
      this.logger.warn('Failed to persist decision row', {
        scenarioId,
        error: decisionErr instanceof Error ? decisionErr.message : String(decisionErr)
      });
    }
  }

  private resolveAmount(scenario: Scenario, route: RouteCandidate): bigint {
    if (scenario.target.kind === PaymentTargetKind.Lightning) {
      const payload = scenario.target.payload as LightningTargetPayload;
      try {
        const decoded = Bolt11.decode(payload.invoice);
        if (decoded.amountMsat > 0n) {
          return (decoded.amountMsat + 999n) / 1000n;
        }
      } catch {
        return this.parseParamAmount(route.params['amountSats']);
      }
    }

    if (scenario.target.kind === PaymentTargetKind.Bitcoin) {
      const payload = scenario.target.payload as BitcoinTargetPayload;
      if (payload.amountSats && BigInt(payload.amountSats) > 0n) {
        return BigInt(payload.amountSats);
      }
    }

    return this.parseParamAmount(route.params['amountSats']);
  }

  private parseParamAmount(param: unknown): bigint {
    if (typeof param === 'string' && /^[0-9]+$/.test(param) && BigInt(param) > 0n) {
      return BigInt(param);
    }
    if (typeof param === 'number' && param > 0) {
      return BigInt(param);
    }
    if (typeof param === 'bigint' && param > 0n) {
      return param;
    }
    return 1n;
  }

  private async checkSend(
    scenario: Scenario,
    route: RouteCandidate,
    amountSats: bigint
  ): Promise<void> {
    try {
      await this.policyService.check({
        kind: 'send',
        amountSats: amountSats.toString(),
        protocol: route.protocol,
        mint: route.mint
      });
    } catch (policyErr: unknown) {
      await this.markScenarioFailed(scenario.id);
      throw new OrchestratorStateError(
        'Policy check denied send',
        {
          scenarioId: scenario.id,
          currentStatus: scenario.status,
          expectedStatus: ScenarioStatus.Decided,
          reason: 'POLICY_DENIED'
        },
        policyErr instanceof Error ? policyErr : undefined
      );
    }
  }

  private async executeFlow(
    scenario: Scenario,
    graph: TaintGraph,
    route: RouteCandidate,
    amountSats: bigint
  ): Promise<FlowResult> {
    try {
      const flow = this.resolveFlow(route.protocol, scenario.id);
      const flowContext: FlowContext = {
        scenario,
        graph,
        route,
        amountSats,
        taintService: this.taintService,
        proofService: this.proofService,
        policyService: this.policyService,
        bitcoinClient: this.bitcoinClient,
        lightningClient: this.lightningClient,
        cashuClient: this.cashuClient,
        nostrClient: this.nostrClient,
        onchainService: this.onchainService,
        logger: this.logger
      };
      return await flow.execute(flowContext);
    } catch (dispatchErr: unknown) {
      await this.markScenarioFailed(scenario.id);
      if (dispatchErr instanceof OrchestratorRouteError) {
        throw dispatchErr;
      }
      if (dispatchErr instanceof OrchestratorExecutionError) {
        throw dispatchErr;
      }
      throw new OrchestratorExecutionError(
        'Execution dispatch failed',
        { scenarioId: scenario.id, protocol: route.protocol, reason: 'DISPATCH_ERROR' },
        dispatchErr instanceof Error ? dispatchErr : undefined
      );
    }
  }

  private async recordExecution(
    scenario: Scenario,
    route: RouteCandidate,
    flowResult: FlowResult
  ): Promise<string> {
    const detailAmountSats =
      flowResult.status === 'succeeded' ? flowResult.amountSats.toString() : '0';

    const executionLog = await this.prisma.executionLog.create({
      data: {
        scenarioId: scenario.id,
        protocol: route.protocol,
        status: flowResult.status,
        detail: {
          amountSats: detailAmountSats,
          feeSats: flowResult.feeSats.toString(),
          identifier: flowResult.identifier,
          routeName: route.name,
          protocol: route.protocol
        }
      }
    });

    if (flowResult.status === 'succeeded') {
      await this.scenarioService.updateStatus(scenario.id, ScenarioStatus.Executed);
    } else {
      await this.scenarioService.updateStatus(scenario.id, ScenarioStatus.Failed);
    }

    return executionLog.id;
  }

  private async publishDecision(
    scenario: Scenario,
    route: RouteCandidate,
    bundleHash: string,
    reasonString: string,
    logId: string
  ): Promise<string | null> {
    try {
      await this.policyService.check({ kind: 'publish' });
      const publishResult = await this.nostrClient.publishDecision({
        scenarioId: scenario.id,
        decision: route.name,
        protocol: route.protocol,
        evidenceHash: bundleHash,
        summary: reasonString
      });
      const nostrEventId = publishResult.event.id;
      await this.prisma.executionLog.update({
        where: { id: logId },
        data: { nostrEventId }
      });
      return nostrEventId;
    } catch (publishErr: unknown) {
      this.logger.warn('Failed to publish decision to Nostr', {
        scenarioId: scenario.id,
        error: publishErr instanceof Error ? publishErr.message : String(publishErr)
      });
      return null;
    }
  }

  private resolveFlow(protocol: string, scenarioId: string): PaymentFlow {
    if (protocol === 'Lightning') {
      return new PayLightningFlow();
    }
    if (protocol === 'Bitcoin') {
      return new PayBitcoinFlow();
    }
    if (protocol === 'Cashu') {
      return new PayCashuFlow();
    }
    throw new OrchestratorRouteError(`Unsupported route protocol: ${protocol}`, {
      scenarioId,
      reason: 'UNSUPPORTED_PROTOCOL'
    });
  }

  private findMatchingEdge(graph: TaintGraph, protocol: string): TaintEdge | null {
    const protocolUpper = protocol.toUpperCase();
    const matchingEdges = graph.edges.filter((edge) => {
      const rel = edge.relationship.toUpperCase();
      if (rel.includes(protocolUpper)) {
        return true;
      }
      if (
        protocolUpper === 'LIGHTNING' &&
        (rel.includes('PREIMAGE') || rel.includes('PAYMENT_HASH') || rel.includes('INVOICE'))
      ) {
        return true;
      }
      if (
        protocolUpper === 'BITCOIN' &&
        (rel.includes('TX') || rel.includes('ADDRESS') || rel.includes('UTXO'))
      ) {
        return true;
      }
      if (
        protocolUpper === 'CASHU' &&
        (rel.includes('MINT') || rel.includes('TOKEN') || rel.includes('PROOF') || rel.includes('QUOTE'))
      ) {
        return true;
      }
      return false;
    });

    if (matchingEdges.length === 0) {
      return null;
    }

    let highest = matchingEdges[0];
    for (const edge of matchingEdges) {
      if (edge.confidence > highest.confidence) {
        highest = edge;
      }
    }
    return highest;
  }

  private generateDecisionReason(route: RouteCandidate): string {
    const confidenceStr = route.estimatedLinkageConfidence.toFixed(2);
    const mintInfo = route.mint ? ` via ${route.mint}` : '';
    return `Selected ${route.protocol} route ${route.name}${mintInfo} because it has the lowest estimated linkage confidence (${confidenceStr}).`;
  }

  private async markScenarioFailed(scenarioId: string): Promise<void> {
    try {
      const current = await this.scenarioService.getById(scenarioId);
      if (
        current.status !== ScenarioStatus.Executed &&
        current.status !== ScenarioStatus.Failed
      ) {
        await this.scenarioService.updateStatus(scenarioId, ScenarioStatus.Failed);
      }
    } catch (error: unknown) {
      this.logger.warn(`Failed to mark scenario ${scenarioId} as Failed`, {
        scenarioId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
