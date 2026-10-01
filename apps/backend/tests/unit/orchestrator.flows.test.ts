import {
  Scenario,
  PaymentTarget,
  PaymentTargetKind,
  TaintGraph,
  KeplerLogger
} from '@kepler/shared';
import { LightningClient, LightningConfig, PaymentResult } from '@kepler/lightning';
import { CashuClient, CashuConfig, CashuMeltResult, CashuSwapResult, CashuProof, CashuToken } from '@kepler/cashu';
import { BitcoinClient, BitcoinConfig } from '@kepler/bitcoin';
import { NostrClient, NostrConfig } from '@kepler/nostr';
import { OnchainService } from '../../src/modules/onchain/onchain.service';
import { PsbtBroadcastRequest, PsbtBroadcastResponse } from '../../src/modules/onchain/onchain.types';
import { TaintService } from '../../src/modules/taint/taint.service';
import { ProofService } from '../../src/modules/proof/proof.service';
import { PolicyService } from '../../src/modules/policy/policy.service';
import { FlowContext, RouteCandidate } from '../../src/modules/orchestrator/orchestrator.types';
import { OrchestratorRouteError, OrchestratorExecutionError } from '../../src/modules/orchestrator/orchestrator.errors';
import { PayLightningFlow } from '../../src/modules/orchestrator/flows/payLightning.flow';
import { PayBitcoinFlow } from '../../src/modules/orchestrator/flows/payBitcoin.flow';
import { PayCashuFlow } from '../../src/modules/orchestrator/flows/payCashu.flow';

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
    throw new Error('Unconfigured test result');
  }
}

class TestOnchainService extends OnchainService {
  public broadcastResult?: { txid: string };
  public broadcastError?: Error;

  constructor(bitcoinClient: BitcoinClient, logger: KeplerLogger) {
    super(bitcoinClient, logger);
  }

  public override async broadcast(
    _request: PsbtBroadcastRequest
  ): Promise<PsbtBroadcastResponse> {
    if (this.broadcastError) {
      throw this.broadcastError;
    }
    if (this.broadcastResult) {
      return this.broadcastResult;
    }
    throw new Error('Unconfigured test result');
  }
}

class TestCashuClient extends CashuClient {
  public meltResult?: CashuMeltResult;
  public meltError?: Error;
  public swapResult?: CashuSwapResult;
  public swapError?: Error;

  constructor(logger: KeplerLogger) {
    super(new CashuConfig({ mintUrl: 'https://testnut.cashu.space' }), logger);
  }

  public override async melt(
    _bolt11: string,
    _amountSats?: bigint,
    _proofsInput?: CashuProof[] | CashuToken
  ): Promise<CashuMeltResult> {
    if (this.meltError) {
      throw this.meltError;
    }
    if (this.meltResult) {
      return this.meltResult;
    }
    throw new Error('Unconfigured test result');
  }

  public override async swap(
    _token: CashuToken,
    _amountSats: bigint
  ): Promise<CashuSwapResult> {
    if (this.swapError) {
      throw this.swapError;
    }
    if (this.swapResult) {
      return this.swapResult;
    }
    throw new Error('Unconfigured test result');
  }
}

describe('PaymentFlows', () => {
  let logger: TestLogger;
  let lightningClient: TestLightningClient;
  let bitcoinClient: BitcoinClient;
  let nostrClient: NostrClient;
  let cashuClient: TestCashuClient;
  let onchainService: TestOnchainService;
  let dummyScenario: Scenario;
  let dummyGraph: TaintGraph;

  beforeEach(() => {
    logger = new TestLogger();
    lightningClient = new TestLightningClient(logger);
    bitcoinClient = new BitcoinClient(
      new BitcoinConfig({
        network: 'mainnet',
        primaryUrl: 'https://blockstream.info/api',
        fallbackUrl: 'https://mempool.space/api'
      }),
      logger
    );
    nostrClient = new NostrClient(
      new NostrConfig({
        relays: ['wss://nos.lol'],
        privateKey: '0000000000000000000000000000000000000000000000000000000000000001'
      }),
      logger
    );
    cashuClient = new TestCashuClient(logger);
    onchainService = new TestOnchainService(bitcoinClient, logger);

    dummyScenario = new Scenario({
      id: 'scenario-test-1',
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });

    dummyGraph = new TaintGraph({
      id: 'graph-1',
      scenarioId: 'scenario-test-1'
    });
  });

  const createFlowContext = (route: RouteCandidate, amountSats = 1000n): FlowContext => ({
    scenario: dummyScenario,
    graph: dummyGraph,
    route,
    amountSats,
    taintService: {} as TaintService,
    proofService: {} as ProofService,
    policyService: {} as PolicyService,
    bitcoinClient,
    lightningClient,
    cashuClient,
    nostrClient,
    onchainService,
    logger
  });

  describe('PayLightningFlow', () => {
    const flow = new PayLightningFlow();

    it('has Lightning protocol', () => {
      expect(flow.protocol).toBe('Lightning');
    });

    it('throws OrchestratorRouteError when invoice param is missing', async () => {
      const context = createFlowContext({
        name: 'route-no-invoice',
        protocol: 'Lightning',
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.1,
        params: {}
      });

      await expect(flow.execute(context)).rejects.toThrow(OrchestratorRouteError);
    });

    it('returns succeeded and rounds fee up on success', async () => {
      lightningClient.payResult = {
        paymentHash: 'hash-abc',
        preimage: 'preimage-xyz',
        feeMsat: 1001n
      };

      const context = createFlowContext({
        name: 'route-valid-ln',
        protocol: 'Lightning',
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.1,
        params: { invoice: 'lnbc100n1...' }
      });

      const result = await flow.execute(context);
      expect(result.status).toBe('succeeded');
      expect(result.identifier).toBe('hash-abc');
      expect(result.amountSats).toBe(1000n);
      expect(result.feeSats).toBe(2n);
      expect(result.rawDetail['paymentHash']).toBe('hash-abc');

      const logEntry = logger.messages.find((m) => m.message === 'Lightning payment executed');
      expect(logEntry).toBeDefined();
      expect(logEntry?.context?.['protocol']).toBe('Lightning');
      expect(logEntry?.context?.['amountSats']).toBe('1000');
      expect(logEntry?.context?.['feeSats']).toBe('2');
      expect(logEntry?.context?.['invoice']).toBeUndefined();
      expect(logEntry?.context?.['preimage']).toBeUndefined();
    });

    it('returns failed without throwing on lightning error', async () => {
      lightningClient.payError = new Error('Route not found');

      const context = createFlowContext({
        name: 'route-failed-ln',
        protocol: 'Lightning',
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.1,
        params: { invoice: 'lnbc100n1...' }
      });

      const result = await flow.execute(context);
      expect(result.status).toBe('failed');
      expect(result.identifier).toBe('');
      expect(result.amountSats).toBe(1000n);
      expect(result.feeSats).toBe(0n);
      expect(result.rawDetail['error']).toBe('Route not found');

      const logEntry = logger.messages.find((m) => m.message === 'Lightning payment failed');
      expect(logEntry).toBeDefined();
    });
  });

  describe('PayBitcoinFlow', () => {
    const flow = new PayBitcoinFlow();

    it('has Bitcoin protocol', () => {
      expect(flow.protocol).toBe('Bitcoin');
    });

    it('throws OrchestratorRouteError when signedPsbt is missing', async () => {
      const context = createFlowContext({
        name: 'btc-route-no-psbt',
        protocol: 'Bitcoin',
        estimatedFeeSats: '50',
        estimatedLinkageConfidence: 0.05,
        params: {}
      });

      await expect(flow.execute(context)).rejects.toThrow(OrchestratorRouteError);
    });

    it('broadcasts signed PSBT and returns succeeded', async () => {
      onchainService.broadcastResult = {
        txid: 'txid-12345'
      };

      const context = createFlowContext({
        name: 'btc-route-valid',
        protocol: 'Bitcoin',
        estimatedFeeSats: '50',
        estimatedLinkageConfidence: 0.05,
        params: {
          signedPsbt: 'cHNidP8...',
          network: 'mainnet',
          feeSats: '45'
        }
      });

      const result = await flow.execute(context);
      expect(result.status).toBe('succeeded');
      expect(result.identifier).toBe('txid-12345');
      expect(result.amountSats).toBe(1000n);
      expect(result.feeSats).toBe(45n);
      expect(result.rawDetail['txid']).toBe('txid-12345');

      const logEntry = logger.messages.find((m) => m.message === 'Bitcoin payment broadcasted');
      expect(logEntry).toBeDefined();
      expect(logEntry?.context?.['txid']).toBe('txid-12345');
      expect(logEntry?.context?.['protocol']).toBe('Bitcoin');
    });

    it('returns failed without throwing on broadcast failure', async () => {
      onchainService.broadcastError = new Error('Mempool conflict');

      const context = createFlowContext({
        name: 'btc-route-fail',
        protocol: 'Bitcoin',
        estimatedFeeSats: '50',
        estimatedLinkageConfidence: 0.05,
        params: {
          signedPsbt: 'cHNidP8...',
          network: 'mainnet'
        }
      });

      const result = await flow.execute(context);
      expect(result.status).toBe('failed');
      expect(result.identifier).toBe('');
      expect(result.feeSats).toBe(0n);
      expect(result.rawDetail['error']).toBe('Mempool conflict');

      const logEntry = logger.messages.find((m) => m.message === 'Bitcoin payment failed');
      expect(logEntry).toBeDefined();
    });

    it('throws OrchestratorRouteError with INVALID_NETWORK when network is missing or invalid', async () => {
      const context = createFlowContext({
        name: 'btc-no-network',
        protocol: 'Bitcoin',
        estimatedFeeSats: '50',
        estimatedLinkageConfidence: 0.05,
        params: {
          signedPsbt: 'cHNidP8...'
        }
      });

      await expect(flow.execute(context)).rejects.toThrow(OrchestratorRouteError);
      try {
        await flow.execute(context);
      } catch (err) {
        expect(err).toBeInstanceOf(OrchestratorRouteError);
        const routeErr = err as OrchestratorRouteError;
        expect(routeErr.context['reason']).toBe('INVALID_NETWORK');
      }
    });
  });

  describe('PayCashuFlow', () => {
    const flow = new PayCashuFlow();

    it('has Cashu protocol', () => {
      expect(flow.protocol).toBe('Cashu');
    });

    it('throws OrchestratorRouteError when bolt11 is missing for melt and target is not Lightning', async () => {
      const bitcoinScenario = new Scenario({
        id: 'scenario-test-btc',
        target: new PaymentTarget({
          kind: PaymentTargetKind.Bitcoin,
          payload: {
            address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
            amountSats: 1000
          }
        })
      });

      const context: FlowContext = {
        ...createFlowContext({
          name: 'cashu-melt-no-bolt11',
          protocol: 'Cashu',
          estimatedFeeSats: '0',
          estimatedLinkageConfidence: 0.01,
          params: { operation: 'melt' }
        }),
        scenario: bitcoinScenario
      };

      await expect(flow.execute(context)).rejects.toThrow(OrchestratorRouteError);
    });

    it('throws OrchestratorRouteError when token is missing for swap', async () => {
      const context = createFlowContext({
        name: 'cashu-swap-no-token',
        protocol: 'Cashu',
        estimatedFeeSats: '0',
        estimatedLinkageConfidence: 0.01,
        params: { operation: 'swap' }
      });

      await expect(flow.execute(context)).rejects.toThrow(OrchestratorRouteError);
    });

    it('melts Lightning invoice with cashu and returns succeeded', async () => {
      cashuClient.meltResult = {
        quote: 'cashu-melt-quote-1',
        amount: 1000n,
        feePaid: 5n,
        paymentPreimage: 'preimage-1'
      };

      const context = createFlowContext({
        name: 'cashu-melt-route',
        protocol: 'Cashu',
        estimatedFeeSats: '5',
        estimatedLinkageConfidence: 0.02,
        params: {
          operation: 'melt',
          bolt11: 'lnbc100n1...'
        }
      });

      const result = await flow.execute(context);
      expect(result.status).toBe('succeeded');
      expect(result.identifier).toBe('cashu-melt-quote-1');
      expect(result.amountSats).toBe(1000n);
      expect(result.feeSats).toBe(5n);

      const logEntry = logger.messages.find((m) => m.message === 'Cashu payment executed');
      expect(logEntry).toBeDefined();
      expect(logEntry?.context?.['quote']).toBe('cashu-melt-quote-1');
      expect(logEntry?.context?.['token']).toBeUndefined();
    });

    it('returns failed without throwing on melt failure', async () => {
      cashuClient.meltError = new Error('Mint quote expired');

      const context = createFlowContext({
        name: 'cashu-melt-fail',
        protocol: 'Cashu',
        estimatedFeeSats: '5',
        estimatedLinkageConfidence: 0.02,
        params: {
          operation: 'melt',
          bolt11: 'lnbc100n1...'
        }
      });

      const result = await flow.execute(context);
      expect(result.status).toBe('failed');
      expect(result.identifier).toBe('');
      expect(result.feeSats).toBe(0n);
      expect(result.rawDetail['error']).toBe('Mint quote expired');

      const logEntry = logger.messages.find((m) => m.message === 'Cashu payment failed');
      expect(logEntry).toBeDefined();
    });

    it('two swaps of the same input token produce different identifiers', async () => {
      const token = {
        token: [
          {
            mint: 'https://testnut.cashu.space',
            proofs: [{ id: 'input-keyset-1', amount: 1000, secret: 'sec-in', C: 'c-in' }]
          }
        ]
      };
      const tokenStr = `cashuA${Buffer.from(JSON.stringify(token)).toString('base64')}`;

      cashuClient.swapResult = {
        token: {
          mint: 'https://testnut.cashu.space',
          unit: 'sat',
          proofs: [{ id: 'out-swap-proof-1', amount: 1000n, secret: 'sec-1', C: 'c-1', witness: null }],
          memo: null
        }
      };

      const context1 = createFlowContext({
        name: 'cashu-swap-route-1',
        protocol: 'Cashu',
        estimatedFeeSats: '0',
        estimatedLinkageConfidence: 0.01,
        params: {
          operation: 'swap',
          token: tokenStr
        }
      });

      const res1 = await flow.execute(context1);

      cashuClient.swapResult = {
        token: {
          mint: 'https://testnut.cashu.space',
          unit: 'sat',
          proofs: [{ id: 'out-swap-proof-2', amount: 1000n, secret: 'sec-2', C: 'c-2', witness: null }],
          memo: null
        }
      };

      const context2 = createFlowContext({
        name: 'cashu-swap-route-2',
        protocol: 'Cashu',
        estimatedFeeSats: '0',
        estimatedLinkageConfidence: 0.01,
        params: {
          operation: 'swap',
          token: tokenStr
        }
      });

      const res2 = await flow.execute(context2);

      expect(res1.identifier).toBe('out-swap-proof-1');
      expect(res2.identifier).toBe('out-swap-proof-2');
      expect(res1.identifier).not.toBe(res2.identifier);
    });

    it('throws OrchestratorExecutionError with SWAP_NO_OUTPUT_PROOFS when swap returns empty proofs', async () => {
      const token = {
        token: [
          {
            mint: 'https://testnut.cashu.space',
            proofs: [{ id: 'input-keyset-1', amount: 1000, secret: 'sec-in', C: 'c-in' }]
          }
        ]
      };
      const tokenStr = `cashuA${Buffer.from(JSON.stringify(token)).toString('base64')}`;

      cashuClient.swapResult = {
        token: {
          mint: 'https://testnut.cashu.space',
          unit: 'sat',
          proofs: [],
          memo: null
        }
      };

      const context = createFlowContext({
        name: 'cashu-swap-empty-proofs',
        protocol: 'Cashu',
        estimatedFeeSats: '0',
        estimatedLinkageConfidence: 0.01,
        params: {
          operation: 'swap',
          token: tokenStr
        }
      });

      await expect(flow.execute(context)).rejects.toThrow(OrchestratorExecutionError);
      try {
        await flow.execute(context);
      } catch (err) {
        expect(err).toBeInstanceOf(OrchestratorExecutionError);
        const execErr = err as OrchestratorExecutionError;
        expect(execErr.context['reason']).toBe('SWAP_NO_OUTPUT_PROOFS');
      }
    });
  });
});

