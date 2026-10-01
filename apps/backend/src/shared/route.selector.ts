import { PaymentTargetKind } from '@kepler/shared';
import { OrchestratorNoRouteError } from '../modules/orchestrator/orchestrator.errors';

export interface RouteCandidate {
  readonly name: string;
  readonly protocol: 'Bitcoin' | 'Lightning' | 'Cashu';
  readonly estimatedFeeSats: string;
  readonly estimatedLinkageConfidence: number;
  readonly mint?: string;
  readonly params: Record<string, unknown>;
}

export class RouteSelector {
  public static select(
    targetKind: PaymentTargetKind,
    candidates: RouteCandidate[]
  ): RouteCandidate {
    if (candidates.length === 0) {
      throw new OrchestratorNoRouteError('No candidate routes provided', {
        scenarioId: 'unspecified',
        candidateCount: 0
      });
    }

    const filteredCandidates = candidates.filter((candidate) => {
      if (targetKind === PaymentTargetKind.Lightning) {
        if (candidate.protocol === 'Lightning') {
          return true;
        }
        if (candidate.protocol === 'Cashu' && candidate.params['operation'] === 'melt') {
          return true;
        }
        return false;
      }
      if (targetKind === PaymentTargetKind.Bitcoin) {
        return candidate.protocol === 'Bitcoin';
      }
      if (targetKind === PaymentTargetKind.Cashu) {
        return candidate.protocol === 'Cashu';
      }
      return false;
    });

    if (filteredCandidates.length === 0) {
      throw new OrchestratorNoRouteError(
        'No compatible routes found for payment target',
        {
          scenarioId: 'unspecified',
          candidateCount: 0
        }
      );
    }

    const sorted = [...filteredCandidates].sort((a, b) => {
      if (a.estimatedLinkageConfidence !== b.estimatedLinkageConfidence) {
        return a.estimatedLinkageConfidence - b.estimatedLinkageConfidence;
      }
      const feeA = BigInt(a.estimatedFeeSats);
      const feeB = BigInt(b.estimatedFeeSats);
      if (feeA < feeB) {
        return -1;
      }
      if (feeA > feeB) {
        return 1;
      }
      return 0;
    });

    return sorted[0];
  }
}
