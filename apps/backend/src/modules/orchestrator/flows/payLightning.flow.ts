import { PaymentFlow } from './flow.interface';
import { FlowContext, FlowResult } from '../orchestrator.types';
import { OrchestratorRouteError } from '../orchestrator.errors';

export class PayLightningFlow implements PaymentFlow {
  public readonly protocol = 'Lightning' as const;

  public async execute(context: FlowContext): Promise<FlowResult> {
    const invoice = context.route.params['invoice'];
    if (typeof invoice !== 'string' || invoice.trim().length === 0) {
      throw new OrchestratorRouteError('Invoice parameter is missing', {
        scenarioId: context.scenario.id,
        reason: 'MISSING_INVOICE'
      });
    }

    const startTime = performance.now();
    try {
      const result = await context.lightningClient.payInvoice(invoice);
      const durationMs = Math.round(performance.now() - startTime);
      const feeSats = (result.feeMsat + 999n) / 1000n;

      context.logger.info('Lightning payment executed', {
        protocol: 'Lightning',
        amountSats: context.amountSats.toString(),
        feeSats: feeSats.toString(),
        durationMs
      });

      return {
        status: 'succeeded',
        identifier: result.paymentHash,
        amountSats: context.amountSats,
        feeSats,
        rawDetail: {
          paymentHash: result.paymentHash,
          feeMsat: result.feeMsat.toString()
        }
      };
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      const message = err instanceof Error ? err.message : String(err);

      context.logger.info('Lightning payment failed', {
        protocol: 'Lightning',
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
