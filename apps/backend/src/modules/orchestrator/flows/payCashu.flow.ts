import { PaymentTargetKind, LightningTargetPayload } from '@kepler/shared';
import { CashuTokenCodec } from '@kepler/cashu';
import { PaymentFlow } from './flow.interface';
import { FlowContext, FlowResult } from '../orchestrator.types';
import { OrchestratorRouteError, OrchestratorExecutionError } from '../orchestrator.errors';

export class PayCashuFlow implements PaymentFlow {
  public readonly protocol = 'Cashu' as const;

  public async execute(context: FlowContext): Promise<FlowResult> {
    const operation =
      context.route.params['operation'] === 'swap' ? 'swap' : 'melt';

    const token =
      typeof context.route.params['token'] === 'string'
        ? context.route.params['token']
        : undefined;

    let bolt11 =
      typeof context.route.params['bolt11'] === 'string'
        ? context.route.params['bolt11']
        : undefined;

    if (!bolt11 && context.scenario.target.kind === PaymentTargetKind.Lightning) {
      const payload = context.scenario.target.payload as LightningTargetPayload;
      bolt11 = payload.invoice;
    }

    if (operation === 'melt' && (!bolt11 || bolt11.trim().length === 0)) {
      throw new OrchestratorRouteError('Invoice bolt11 parameter is missing', {
        scenarioId: context.scenario.id,
        reason: 'MISSING_BOLT11'
      });
    }

    if (operation === 'swap' && (!token || token.trim().length === 0)) {
      throw new OrchestratorRouteError('Token parameter is missing', {
        scenarioId: context.scenario.id,
        reason: 'MISSING_TOKEN'
      });
    }

    const startTime = performance.now();
    try {
      if (operation === 'melt') {
        const decodedToken = token ? CashuTokenCodec.decode(token) : undefined;
        const result = await context.cashuClient.melt(
          bolt11 as string,
          context.amountSats,
          decodedToken
        );
        const durationMs = Math.round(performance.now() - startTime);

        context.logger.info('Cashu payment executed', {
          protocol: 'Cashu',
          operation,
          quote: result.quote,
          amountSats: context.amountSats.toString(),
          feeSats: result.feePaid.toString(),
          durationMs
        });

        return {
          status: 'succeeded',
          identifier: result.quote,
          amountSats: context.amountSats,
          feeSats: result.feePaid,
          rawDetail: {
            quote: result.quote,
            feePaid: result.feePaid.toString(),
            operation
          }
        };
      } else {
        const decodedToken = CashuTokenCodec.decode(token as string);
        const swapResult = await context.cashuClient.swap(decodedToken, context.amountSats);
        const firstProof = swapResult.token.proofs[0];
        if (!firstProof) {
          throw new OrchestratorExecutionError('Swap returned no output proofs', {
            scenarioId: context.scenario.id,
            protocol: 'Cashu',
            reason: 'SWAP_NO_OUTPUT_PROOFS'
          });
        }
        const quote = firstProof.id;
        const feePaid = 0n;
        const durationMs = Math.round(performance.now() - startTime);

        context.logger.info('Cashu payment executed', {
          protocol: 'Cashu',
          operation,
          quote,
          amountSats: context.amountSats.toString(),
          feeSats: feePaid.toString(),
          durationMs
        });

        return {
          status: 'succeeded',
          identifier: quote,
          amountSats: context.amountSats,
          feeSats: feePaid,
          rawDetail: {
            quote,
            operation
          }
        };
      }
    } catch (err: unknown) {
      if (err instanceof OrchestratorExecutionError || err instanceof OrchestratorRouteError) {
        throw err;
      }
      const durationMs = Math.round(performance.now() - startTime);
      const message = err instanceof Error ? err.message : String(err);

      context.logger.info('Cashu payment failed', {
        protocol: 'Cashu',
        operation,
        quote: '',
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
