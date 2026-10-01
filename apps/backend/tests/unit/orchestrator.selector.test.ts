import {
  Scenario,
  PaymentTarget,
  PaymentTargetKind
} from '@kepler/shared';
import { RouteSelector, RouteCandidate } from '../../src/shared/route.selector';
import { OrchestratorNoRouteError } from '../../src/modules/orchestrator/orchestrator.errors';

describe('RouteSelector', () => {
  const createLightningScenario = (): Scenario => {
    return new Scenario({
      id: 'scenario-lightning',
      target: new PaymentTarget({
        kind: PaymentTargetKind.Lightning,
        payload: { invoice: 'lnbc100n1...' }
      })
    });
  };

  const createBitcoinScenario = (): Scenario => {
    return new Scenario({
      id: 'scenario-bitcoin',
      target: new PaymentTarget({
        kind: PaymentTargetKind.Bitcoin,
        payload: {
          address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
          amountSats: 50000
        }
      })
    });
  };

  const createCashuScenario = (): Scenario => {
    return new Scenario({
      id: 'scenario-cashu',
      target: new PaymentTarget({
        kind: PaymentTargetKind.Cashu,
        payload: { request: 'cashuA...' }
      })
    });
  };

  it('Empty candidate list throws OrchestratorNoRouteError', () => {
    const scenario = createLightningScenario();

    expect(() => RouteSelector.select(scenario.target.kind, [])).toThrow(
      OrchestratorNoRouteError
    );

    try {
      RouteSelector.select(scenario.target.kind, []);
    } catch (err) {
      expect(err).toBeInstanceOf(OrchestratorNoRouteError);
      const noRouteError = err as OrchestratorNoRouteError;
      expect(noRouteError.code).toBe('ORCHESTRATOR_NO_ROUTE');
      expect(noRouteError.context.candidateCount).toBe(0);
      expect(noRouteError.context.scenarioId).toBe('unspecified');
    }
  });

  it('Candidates of the wrong protocol are filtered out', () => {
    const lnScenario = createLightningScenario();
    const wrongForLn: RouteCandidate[] = [
      {
        name: 'btc-route',
        protocol: 'Bitcoin',
        estimatedFeeSats: '100',
        estimatedLinkageConfidence: 0.1,
        params: {}
      },
      {
        name: 'cashu-route',
        protocol: 'Cashu',
        estimatedFeeSats: '0',
        estimatedLinkageConfidence: 0.05,
        params: {}
      }
    ];

    expect(() => RouteSelector.select(lnScenario.target.kind, wrongForLn)).toThrow(
      OrchestratorNoRouteError
    );

    const btcScenario = createBitcoinScenario();
    const wrongForBtc: RouteCandidate[] = [
      {
        name: 'ln-route',
        protocol: 'Lightning',
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.1,
        params: {}
      }
    ];

    expect(() => RouteSelector.select(btcScenario.target.kind, wrongForBtc)).toThrow(
      OrchestratorNoRouteError
    );

    const cashuScenario = createCashuScenario();
    const wrongForCashu: RouteCandidate[] = [
      {
        name: 'btc-route',
        protocol: 'Bitcoin',
        estimatedFeeSats: '50',
        estimatedLinkageConfidence: 0.2,
        params: {}
      }
    ];

    expect(() => RouteSelector.select(cashuScenario.target.kind, wrongForCashu)).toThrow(
      OrchestratorNoRouteError
    );
  });

  it('Lowest linkage confidence wins', () => {
    const scenario = createLightningScenario();
    const candidates: RouteCandidate[] = [
      {
        name: 'high-linkage',
        protocol: 'Lightning',
        estimatedFeeSats: '1',
        estimatedLinkageConfidence: 0.8,
        params: {}
      },
      {
        name: 'low-linkage',
        protocol: 'Lightning',
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.15,
        params: {}
      },
      {
        name: 'medium-linkage',
        protocol: 'Lightning',
        estimatedFeeSats: '5',
        estimatedLinkageConfidence: 0.4,
        params: {}
      }
    ];

    const selected = RouteSelector.select(scenario.target.kind, candidates);
    expect(selected.name).toBe('low-linkage');
    expect(selected.estimatedLinkageConfidence).toBe(0.15);
  });

  it('Tiebreak on fee', () => {
    const scenario = createLightningScenario();
    const candidates: RouteCandidate[] = [
      {
        name: 'higher-fee',
        protocol: 'Lightning',
        estimatedFeeSats: '50',
        estimatedLinkageConfidence: 0.2,
        params: {}
      },
      {
        name: 'lowest-fee',
        protocol: 'Lightning',
        estimatedFeeSats: '5',
        estimatedLinkageConfidence: 0.2,
        params: {}
      },
      {
        name: 'medium-fee',
        protocol: 'Lightning',
        estimatedFeeSats: '25',
        estimatedLinkageConfidence: 0.2,
        params: {}
      }
    ];

    const selected = RouteSelector.select(scenario.target.kind, candidates);
    expect(selected.name).toBe('lowest-fee');
    expect(selected.estimatedFeeSats).toBe('5');
  });

  it('Determinism: same inputs -> same selected candidate', () => {
    const scenario = createLightningScenario();
    const candidates: RouteCandidate[] = [
      {
        name: 'route-1',
        protocol: 'Lightning',
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.25,
        params: {}
      },
      {
        name: 'route-2',
        protocol: 'Lightning',
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.1,
        params: {}
      },
      {
        name: 'route-3',
        protocol: 'Lightning',
        estimatedFeeSats: '20',
        estimatedLinkageConfidence: 0.1,
        params: {}
      }
    ];

    const runOne = RouteSelector.select(scenario.target.kind, candidates);
    const runTwo = RouteSelector.select(scenario.target.kind, candidates);
    const runThree = RouteSelector.select(scenario.target.kind, candidates);

    expect(runOne).toEqual(runTwo);
    expect(runTwo).toEqual(runThree);
    expect(runOne.name).toBe('route-2');
  });

  it('selects Cashu melt candidate over Lightning candidate when Cashu has lower linkage confidence', () => {
    const scenario = createLightningScenario();
    const candidates: RouteCandidate[] = [
      {
        name: 'ln-direct-route',
        protocol: 'Lightning',
        estimatedFeeSats: '10',
        estimatedLinkageConfidence: 0.4,
        params: {}
      },
      {
        name: 'cashu-melt-route',
        protocol: 'Cashu',
        estimatedFeeSats: '15',
        estimatedLinkageConfidence: 0.15,
        params: {
          operation: 'melt'
        }
      }
    ];

    const selected = RouteSelector.select(scenario.target.kind, candidates);
    expect(selected.name).toBe('cashu-melt-route');
    expect(selected.protocol).toBe('Cashu');
    expect(selected.estimatedLinkageConfidence).toBe(0.15);
  });
});
