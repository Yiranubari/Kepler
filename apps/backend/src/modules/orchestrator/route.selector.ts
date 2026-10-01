import { Scenario, TaintGraph, PaymentTargetKind } from '@kepler/shared';
import { RouteCandidate } from './orchestrator.types';
import { OrchestratorNoRouteError } from './orchestrator.errors';

export class RouteSelector {
  public static select(
    scenario: Scenario,
    _graph: TaintGraph,
    candidates: RouteCandidate[]
  ): RouteCandidate {
    if (candidates.length === 0) {
      throw new OrchestratorNoRouteError('No candidate routes provided', {
        scenarioId: scenario.id,
        candidateCount: 0
      });
    }

    const filteredCandidates = candidates.filter((candidate) => {
      if (scenario.target.kind === PaymentTargetKind.Lightning) {
        if (candidate.protocol === 'Lightning') {
          return true;
        }
        if (candidate.protocol === 'Cashu' && candidate.params['operation'] === 'melt') {
          return true;
        }
        return false;
      }
      if (scenario.target.kind === PaymentTargetKind.Bitcoin) {
        return candidate.protocol === 'Bitcoin';
      }
      if (scenario.target.kind === PaymentTargetKind.Cashu) {
        return candidate.protocol === 'Cashu';
      }
      return false;
    });

    if (filteredCandidates.length === 0) {
      throw new OrchestratorNoRouteError(
        'No compatible routes found for payment target',
        {
          scenarioId: scenario.id,
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
