import { FlowContext, FlowResult } from '../orchestrator.types';

export interface PaymentFlow {
  readonly protocol: 'Bitcoin' | 'Lightning' | 'Cashu';
  execute(context: FlowContext): Promise<FlowResult>;
}
