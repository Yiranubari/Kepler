import { PaymentFlow } from './flow.interface';
import { FlowContext, FlowResult } from '../orchestrator.types';
import { OrchestratorRouteError } from '../orchestrator.errors';
import { SupportedNetwork } from '../../onchain/onchain.types';

function parseSupportedNetwork(network: unknown, scenarioId: string): SupportedNetwork {
  if (
    network === 'mainnet' ||
    network === 'testnet' ||
    network === 'testnet4' ||
    network === 'signet' ||
    network === 'regtest'
  ) {
    return network;
  }
  throw new OrchestratorRouteError('Network parameter is missing or invalid', {
    scenarioId,
    reason: 'INVALID_NETWORK'
  });
}

export class PayBitcoinFlow implements PaymentFlow {
  public readonly protocol = 'Bitcoin' as const;

  public async execute(context: FlowContext): Promise<FlowResult> {
    const signedPsbt = context.route.params['signedPsbt'];
    if (typeof signedPsbt !== 'string' || signedPsbt.trim().length === 0) {
      throw new OrchestratorRouteError('Signed PSBT parameter is missing', {
        scenarioId: context.scenario.id,
        reason: 'MISSING_SIGNED_PSBT'
      });
    }

    const network = parseSupportedNetwork(context.route.params['network'], context.scenario.id);
    const feeSats =
      typeof context.route.params['feeSats'] === 'string'
        ? BigInt(context.route.params['feeSats'])
        : BigInt(context.route.estimatedFeeSats);

    const startTime = performance.now();
    try {
      const result = await context.onchainService.broadcast({
        signedPsbt,
        network
      });
      const durationMs = Math.round(performance.now() - startTime);

      context.logger.info('Bitcoin payment broadcasted', {
        protocol: 'Bitcoin',
        txid: result.txid,
        amountSats: context.amountSats.toString(),
        feeSats: feeSats.toString(),
        durationMs
      });

      return {
        status: 'succeeded',
        identifier: result.txid,
        amountSats: context.amountSats,
        feeSats,
        rawDetail: {
          txid: result.txid,
          network
        }
      };
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      const message = err instanceof Error ? err.message : String(err);

      context.logger.info('Bitcoin payment failed', {
        protocol: 'Bitcoin',
        txid: '',
        amountSats: context.amountSats.toString(),
        feeSats: '0',
        durationMs
      });

      return {
        status: 'failed',
        identifier: '',
        amountSats: context.amountSats,
        feeSats: 0n,
        rawDetail: {
          error: message
        }
      };
    }
  }
}
