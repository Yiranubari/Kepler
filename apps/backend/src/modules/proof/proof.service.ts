import {
  ClaimType,
  EvidenceBundle,
  EvidenceBundleJSON,
  ClaimVerificationResult,
  KeplerLogger
} from '@kepler/shared';
import { ClaimRegistry } from './claims/registry';
import { ProofRepository } from './proof.repository';
import { ProofBuildError, ProofPersistenceError } from './proof.errors';

export class ProofService {
  private readonly registry: ClaimRegistry;
  private readonly repository: ProofRepository;
  private readonly logger: KeplerLogger;

  constructor(
    registry: ClaimRegistry,
    repository: ProofRepository,
    logger: KeplerLogger
  ) {
    this.registry = registry;
    this.repository = repository;
    this.logger = logger;
  }

  public async build(
    type: ClaimType,
    input: unknown,
    context: { scenarioId: string }
  ): Promise<EvidenceBundle> {
    const builder = this.registry.getBuilder(type);

    let builtClaim: { bundle: EvidenceBundle };
    try {
      builtClaim = builder.build(
        { now: Date.now(), scenarioId: context.scenarioId },
        input
      );
    } catch (error) {
      if (error instanceof ProofBuildError) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProofBuildError(
        'Failed to build proof claim',
        { claimType: type, reason },
        error instanceof Error ? error : undefined
      );
    }

    try {
      await this.repository.saveBundle(builtClaim.bundle, context.scenarioId);
    } catch (error) {
      if (error instanceof ProofPersistenceError) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProofPersistenceError(
        'Failed to persist evidence bundle',
        {
          bundleId: builtClaim.bundle.id,
          operation: 'saveBundle',
          reason
        },
        error instanceof Error ? error : undefined
      );
    }

    this.logger.info(`Evidence bundle built and persisted for scenario ${context.scenarioId}`);
    return builtClaim.bundle;
  }

  public async verify(bundleJson: unknown): Promise<ClaimVerificationResult> {
    const bundle =
      bundleJson instanceof EvidenceBundle
        ? bundleJson
        : EvidenceBundle.fromJSON(bundleJson as EvidenceBundleJSON);

    const verifier = this.registry.getVerifier(bundle.claim.type);
    const result = verifier.verify({ bundle });
    this.logger.info(`Evidence bundle ${bundle.id} verification result: ${result.valid}`);
    return result;
  }

  public async getByHash(bundleHash: string): Promise<EvidenceBundle | null> {
    try {
      const bundle = await this.repository.getByHash(bundleHash);
      return bundle ?? null;
    } catch {
      return null;
    }
  }

  public async listByScenario(scenarioId: string): Promise<EvidenceBundle[]> {
    const bundles = await this.repository.listByScenario(scenarioId);
    return [...bundles].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
