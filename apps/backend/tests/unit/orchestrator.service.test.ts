import '../../src/config/env';
import { PrismaClient } from '@prisma/client';
import {
  PaymentTarget,
  PaymentTargetKind,
  ScenarioStatus,
  KeplerLogger,
  Policy,
  PolicyScope
} from '@kepler/shared';
import { BitcoinClient, BitcoinConfig } from '@kepler/bitcoin';
import { LightningClient, LightningConfig, PaymentResult } from '@kepler/lightning';
import { CashuClient, CashuConfig } from '@kepler/cashu';
import { NostrClient, NostrConfig, PublishResult, KeplerDecisionPayload } from '@kepler/nostr';
import { ScenarioRepository } from '../../src/modules/scenario/scenario.repository';
import { ScenarioService } from '../../src/modules/scenario/scenario.service';
import { TaintRepository } from '../../src/modules/taint/taint.repository';
import { TaintConfig } from '../../src/modules/taint/taint.types';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import { createDefaultRuleRegistry } from '../../src/modules/taint/rules/registry';
import { TaintService } from '../../src/modules/taint/taint.service';
import { ProofRepository } from '../../src/modules/proof/proof.repository';
import { ClaimRegistry } from '../../src/modules/proof/claims/registry';
import { ProofService } from '../../src/modules/proof/proof.service';
import { PolicyRepository } from '../../src/modules/policy/policy.repository';
import { PolicyService } from '../../src/modules/policy/policy.service';
import { OnchainService } from '../../src/modules/onchain/onchain.service';
import { OrchestratorService } from '../../src/modules/orchestrator/orchestrator.service';
import {
  OrchestratorNotFoundError,
  OrchestratorStateError,
  OrchestratorNoRouteError
} from '../../src/modules/orchestrator/orchestrator.errors';

class TestLogger implements KeplerLogger {
  public messages: Array<{ level: string; message: string; context?: Record<string, unknown> }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'debug', message, context });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'info', message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'warn', message, context });
  }

  public error(message: string, _error?: unknown, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'error', message, context });
  }

  public fatal(message: string, _error: unknown, context?: Record<string, unknown>): void {
    this.messages.push({ level: 'fatal', message, context });
  }
}

class TestLightningClient extends LightningClient {
  public payResult?: PaymentResult;
  public payError?: Error;

  constructor(logger: KeplerLogger) {
    super(
      new LightningConfig({
        connectionString:
          'nostr+walletconnect://0000000000000000000000000000000000000000000000000000000000000001?relay=wss://relay.damus.io&secret=0000000000000000000000000000000000000000000000000000000000000002'
      }),
      logger
    );
  }

  public override async payInvoice(
    _invoice: string,
    _amountMsat?: bigint
  ): Promise<PaymentResult> {
    if (this.payError) {
      throw this.payError;
    }
    if (this.payResult) {
      return this.payResult;
    }
    throw new Error('Payment failed');
  }
}

class TestNostrClient extends NostrClient {
  public publishResult?: PublishResult;
  public publishError?: Error;

  constructor(logger: KeplerLogger) {
    super(
      new NostrConfig({
        relays: ['wss://nos.lol'],
        privateKey: '0000000000000000000000000000000000000000000000000000000000000001'
      }),
      logger
    );
  }

  public override async publishDecision(
    _payload: KeplerDecisionPayload
  ): Promise<PublishResult> {
    if (this.publishError) {
      throw this.publishError;
    }
    if (this.publishResult) {
      return this.publishResult;
    }
    return {
      event: {
        id: 'nostr-event-success-123',
        pubkey: 'pubkey-1',
        createdAt: 1700000000,
        kind: 30078,
        tags: [],
        content: 'decision summary',
        sig: 'sig-1'
      },
      acceptedBy: ['wss://nos.lol'],
      rejectedBy: []
    };
  }
}

describe('OrchestratorService', () => {
  jest.setTimeout(30000);

  let prisma: PrismaClient;
  let logger: TestLogger;
  let scenarioService: ScenarioService;
  let taintService: TaintService;
  let proofService: ProofService;
  let policyService: PolicyService;
  let policyRepository: PolicyRepository;
  let onchainService: OnchainService;
  let nostrClient: TestNostrClient;
  let lightningClient: TestLightningClient;
  let cashuClient: CashuClient;
  let bitcoinClient: BitcoinClient;
  let orchestratorService: OrchestratorService;
  let scenarioCounter = 0;

  const testScenarioPrefix = 'orch_test_';

  const nextScenarioId = (): string => {
    scenarioCounter++;
    return `${testScenarioPrefix}${Date.now()}_${scenarioCounter}`;
  };

  const cleanDb = async (): Promise<void> => {
    await prisma.decision.deleteMany({
      where: { scenarioId: { startsWith: testScenarioPrefix } }
    });
    await prisma.executionLog.deleteMany({
      where: { scenarioId: { startsWith: testScenarioPrefix } }
    });
    await prisma.evidenceRecord.deleteMany({
      where: { id: { contains: testScenarioPrefix } }
    });
    await prisma.scenario.deleteMany({
      where: { id: { startsWith: testScenarioPrefix } }
    });
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await prisma.$connect();
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger = new TestLogger();

    const scenarioRepo = new ScenarioRepository(prisma);
    scenarioService = new ScenarioService(scenarioRepo, logger);

    const taintRepo = new TaintRepository(prisma);
    taintService = new TaintService(
      TaintConfig.fromEnv(),
      createDefaultRuleRegistry(),
      new TaintScorer(),
      taintRepo,
      logger
    );

    const proofRepo = new ProofRepository(prisma);
    proofService = new ProofService(ClaimRegistry.createDefault(), proofRepo, logger);

    policyRepository = new PolicyRepository(prisma, 'orchestrator_test_policy');
    policyService = new PolicyService(policyRepository, logger);

    bitcoinClient = new BitcoinClient(
      new BitcoinConfig({
        network: 'mainnet',
        primaryUrl: 'https://blockstream.info/api',
        fallbackUrl: 'https://mempool.space/api'
      }),
      logger
    );

    onchainService = new OnchainService(bitcoinClient, logger);
    lightningClient = new TestLightningClient(logger);
    nostrClient = new TestNostrClient(logger);

    cashuClient = new CashuClient(
      new CashuConfig({ mintUrl: 'https://testnut.cashu.space' }),
      logger
    );

    orchestratorService = new OrchestratorService({
      scenarioService,
      taintService,
      proofService,
      policyService,
      onchainService,
      nostrClient,
      lightningClient,
      cashuClient,
      logger,
      bitcoinClient,
      prisma
    });

    await cleanDb();
  });

  beforeEach(async () => {
    await cleanDb();

    lightningClient.payResult = undefined;
    lightningClient.payError = undefined;
    nostrClient.publishResult = undefined;
    nostrClient.publishError = undefined;

    await policyRepository.upsert(
      new Policy({
        id: 'orchestrator_test_policy',
        dailyBudgetSats: 1000000,
        perTxBudgetSats: 500000,
        scopes: [PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send, PolicyScope.Publish],
        allowedMints: ['https://testnut.cashu.space'],
        allowedRelays: ['wss://nos.lol'],
        allowedEsplora: ['https://blockstream.info/api'],
        updatedAt: new Date()
      })
    );
  });

  afterAll(async () => {
    await cleanDb();
    await prisma.$disconnect();
  });

  it('throws OrchestratorNotFoundError when scenario does not exist', async () => {
    await expect(
      orchestratorService.orchestrate({
        scenarioId: nextScenarioId(),
        ingestData: {}
      })
    ).rejects.toThrow(OrchestratorNotFoundError);
  });

  it('throws OrchestratorStateError when scenario is in Decided status', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });
    await scenarioService.updateStatus(scenarioId, ScenarioStatus.Analyzed);
    await scenarioService.updateStatus(scenarioId, ScenarioStatus.Decided);

    await expect(
      orchestratorService.orchestrate({
        scenarioId,
        ingestData: {}
      })
    ).rejects.toThrow(OrchestratorStateError);
  });

  it('throws OrchestratorStateError with ALREADY_EXECUTED when successful execution log exists', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });

    await prisma.executionLog.create({
      data: {
        scenarioId,
        protocol: 'Lightning',
        status: 'succeeded',
        detail: {
          amountSats: '1000',
          feeSats: '1',
          identifier: 'hash-abc',
          routeName: 'ln-route',
          protocol: 'Lightning'
        }
      }
    });

    await expect(
      orchestratorService.orchestrate({
        scenarioId,
        ingestData: {}
      })
    ).rejects.toThrow(OrchestratorStateError);
  });

  it('moves scenario to Failed and throws OrchestratorStateError when policy propose is denied', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });

    await policyRepository.upsert(
      new Policy({
        id: 'orchestrator_test_policy',
        dailyBudgetSats: 1000000,
        perTxBudgetSats: 500000,
        scopes: [PolicyScope.Read, PolicyScope.Send],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: [],
        updatedAt: new Date()
      })
    );

    await expect(
      orchestratorService.orchestrate({
        scenarioId,
        ingestData: {}
      })
    ).rejects.toThrow(OrchestratorStateError);

    const updated = await scenarioService.getById(scenarioId);
    expect(updated.status).toBe(ScenarioStatus.Failed);
  });

  it('moves scenario to Failed and throws OrchestratorNoRouteError when no routes are provided', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });

    await expect(
      orchestratorService.orchestrate({
        scenarioId,
        ingestData: {},
        candidateRoutes: []
      })
    ).rejects.toThrow(OrchestratorNoRouteError);

    const updated = await scenarioService.getById(scenarioId);
    expect(updated.status).toBe(ScenarioStatus.Failed);
  });

  it('moves scenario to Failed and throws OrchestratorNoRouteError when no candidate matches protocol', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });

    await expect(
      orchestratorService.orchestrate({
        scenarioId,
        ingestData: {},
        candidateRoutes: [
          {
            name: 'bitcoin-candidate-only',
            protocol: 'Bitcoin',
            estimatedFeeSats: '100',
            estimatedLinkageConfidence: 0.1,
            params: {
              signedPsbt: 'cHNidP8...'
            }
          }
        ]
      })
    ).rejects.toThrow(OrchestratorNoRouteError);

    const updated = await scenarioService.getById(scenarioId);
    expect(updated.status).toBe(ScenarioStatus.Failed);
  });

  it('moves scenario to Failed and throws OrchestratorStateError when policy send is denied', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Bitcoin,
        payload: {
          address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
          amountSats: 100000
        }
      })
    });

    await policyRepository.upsert(
      new Policy({
        id: 'orchestrator_test_policy',
        dailyBudgetSats: 1000000,
        perTxBudgetSats: 50000,
        scopes: [PolicyScope.Read, PolicyScope.Propose, PolicyScope.Send, PolicyScope.Publish],
        allowedMints: [],
        allowedRelays: [],
        allowedEsplora: [],
        updatedAt: new Date()
      })
    );

    await expect(
      orchestratorService.orchestrate({
        scenarioId,
        ingestData: {},
        candidateRoutes: [
          {
            name: 'bitcoin-route-overbudget',
            protocol: 'Bitcoin',
            estimatedFeeSats: '100',
            estimatedLinkageConfidence: 0.1,
            params: {
              amountSats: '100000',
              signedPsbt: 'cHNidP8...'
            }
          }
        ]
      })
    ).rejects.toThrow(OrchestratorStateError);

    const updated = await scenarioService.getById(scenarioId);
    expect(updated.status).toBe(ScenarioStatus.Failed);
  });

  it('runs complete flow and records failed status when execution fails', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });

    lightningClient.payError = new Error('Route failure');

    const response = await orchestratorService.orchestrate({
      scenarioId,
      ingestData: {},
      candidateRoutes: [
        {
          name: 'lightning-route-fail',
          protocol: 'Lightning',
          estimatedFeeSats: '10',
          estimatedLinkageConfidence: 0.12,
          params: {
            amountSats: '1000',
            invoice: 'lnbc100n1...'
          }
        }
      ]
    });

    expect(response.scenarioId).toBe(scenarioId);
    expect(response.execution.status).toBe('failed');
    expect(response.execution.amountSats).toBe('0');
    expect(response.nostrEventId).toBeNull();

    const updated = await scenarioService.getById(scenarioId);
    expect(updated.status).toBe(ScenarioStatus.Failed);

    const logEntry = await prisma.executionLog.findFirst({
      where: { scenarioId }
    });
    expect(logEntry).toBeDefined();
    expect(logEntry?.status).toBe('failed');
  });

  it('runs complete flow successfully, publishes to Nostr, and marks Executed', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });

    lightningClient.payResult = {
      paymentHash: 'payment_hash_success_999',
      preimage: 'preimage_secret_999',
      feeMsat: 2000n
    };

    const response = await orchestratorService.orchestrate({
      scenarioId,
      ingestData: {},
      candidateRoutes: [
        {
          name: 'via NWC',
          protocol: 'Lightning',
          estimatedFeeSats: '2',
          estimatedLinkageConfidence: 0.08,
          params: {
            amountSats: '5000',
            invoice: 'lnbc100n1...'
          }
        }
      ]
    });

    expect(response.scenarioId).toBe(scenarioId);
    expect(response.execution.status).toBe('succeeded');
    expect(response.execution.amountSats).toBe('5000');
    expect(response.execution.feeSats).toBe('2');
    expect(response.execution.identifier).toBe('payment_hash_success_999');
    expect(response.nostrEventId).toBe('nostr-event-success-123');

    const updated = await scenarioService.getById(scenarioId);
    expect(updated.status).toBe(ScenarioStatus.Executed);

    const logEntry = await prisma.executionLog.findFirst({
      where: { scenarioId }
    });
    expect(logEntry).toBeDefined();
    expect(logEntry?.status).toBe('succeeded');
    expect(logEntry?.nostrEventId).toBe('nostr-event-success-123');

    const decisionRecord = await prisma.decision.findFirst({
      where: { scenarioId }
    });
    expect(decisionRecord).toBeDefined();
  });

  it('completes orchestration with nostrEventId null when nostr publish fails', async () => {
    const scenarioId = nextScenarioId();
    await scenarioService.create({
      id: scenarioId,
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });

    lightningClient.payResult = {
      paymentHash: 'payment_hash_success_888',
      preimage: 'preimage_secret_888',
      feeMsat: 1000n
    };

    nostrClient.publishError = new Error('Relay write rejected');

    const response = await orchestratorService.orchestrate({
      scenarioId,
      ingestData: {},
      candidateRoutes: [
        {
          name: 'via NWC',
          protocol: 'Lightning',
          estimatedFeeSats: '1',
          estimatedLinkageConfidence: 0.05,
          params: {
            amountSats: '3000',
            invoice: 'lnbc100n1...'
          }
        }
      ]
    });

    expect(response.scenarioId).toBe(scenarioId);
    expect(response.execution.status).toBe('succeeded');
    expect(response.nostrEventId).toBeNull();

    const updated = await scenarioService.getById(scenarioId);
    expect(updated.status).toBe(ScenarioStatus.Executed);

    const logEntry = await prisma.executionLog.findFirst({
      where: { scenarioId }
    });
    expect(logEntry).toBeDefined();
    expect(logEntry?.status).toBe('succeeded');
    expect(logEntry?.nostrEventId).toBeNull();
  });
});

