import { ClaimType, EvidenceBundle, KeplerLogger } from "@kepler/shared";
import { ProofService } from "../../src/modules/proof/proof.service";
import { ClaimRegistry } from "../../src/modules/proof/claims/registry";
import { ProofRepository } from "../../src/modules/proof/proof.repository";
import {
  ProofBuildError,
  ProofPersistenceError,
} from "../../src/modules/proof/proof.errors";

import { PrismaClient } from "@prisma/client";

class TestProofRepository extends ProofRepository {
  public bundles = new Map<string, EvidenceBundle>();
  public scenarioBundles = new Map<string, EvidenceBundle[]>();
  public saveThrows = false;
  public getThrows = false;

  constructor() {
    super({} as PrismaClient);
  }

  public override async saveBundle(
    bundle: EvidenceBundle,
    scenarioId: string,
  ): Promise<void> {
    if (this.saveThrows) {
      throw new Error("Database write failure");
    }
    this.bundles.set(bundle.bundleHash, bundle);
    const existing = this.scenarioBundles.get(scenarioId) ?? [];
    existing.push(bundle);
    this.scenarioBundles.set(scenarioId, existing);
  }

  public override async getByHash(
    bundleHash: string,
  ): Promise<EvidenceBundle | null> {
    if (this.getThrows) {
      throw new Error("Database read failure");
    }
    return this.bundles.get(bundleHash) ?? null;
  }

  public override async listByScenario(
    scenarioId: string,
  ): Promise<EvidenceBundle[]> {
    return this.scenarioBundles.get(scenarioId) ?? [];
  }
}

class TestLogger implements KeplerLogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public fatal(): void {}
  public child(): KeplerLogger {
    return this;
  }
}

describe("ProofService", () => {
  let registry: ClaimRegistry;
  let repository: TestProofRepository;
  let logger: KeplerLogger;
  let service: ProofService;

  beforeEach(() => {
    registry = ClaimRegistry.createDefault();
    repository = new TestProofRepository();
    logger = new TestLogger();
    service = new ProofService(registry, repository, logger);
  });

  describe("build", () => {
    it("builds, persists, and returns evidence bundle for execution claim", async () => {
      const txid = "5".repeat(64);
      const input = {
        protocol: "Bitcoin",
        identifier: txid,
        amountSats: "10000",
        rawDataRefs: [
          {
            source: "Bitcoin",
            ref: txid,
            payload: { txid },
          },
        ],
      };

      const bundle = await service.build(ClaimType.Transaction, input, {
        scenarioId: "scenario-123",
      });

      expect(bundle).toBeInstanceOf(EvidenceBundle);
      expect(bundle.claim.type).toBe(ClaimType.Transaction);
      expect(repository.bundles.has(bundle.bundleHash)).toBe(true);
    });

    it("wraps builder errors in ProofBuildError", async () => {
      await expect(
        service.build(
          ClaimType.Transaction,
          { invalid: "input" },
          {
            scenarioId: "scenario-123",
          },
        ),
      ).rejects.toThrow(ProofBuildError);
    });

    it("wraps repository errors in ProofPersistenceError", async () => {
      repository.saveThrows = true;
      const txid = "6".repeat(64);
      const input = {
        protocol: "Bitcoin",
        identifier: txid,
        amountSats: "5000",
        rawDataRefs: [
          {
            source: "Bitcoin",
            ref: txid,
            payload: { txid },
          },
        ],
      };

      await expect(
        service.build(ClaimType.Transaction, input, {
          scenarioId: "scenario-123",
        }),
      ).rejects.toThrow(ProofPersistenceError);
    });
  });

  describe("verify", () => {
    it("verifies a valid evidence bundle from JSON without persisting", async () => {
      const txid = "7".repeat(64);
      const input = {
        protocol: "Bitcoin",
        identifier: txid,
        amountSats: "20000",
        rawDataRefs: [
          {
            source: "Bitcoin",
            ref: txid,
            payload: { txid },
          },
        ],
      };

      const bundle = await service.build(ClaimType.Transaction, input, {
        scenarioId: "scenario-123",
      });

      repository.bundles.clear();
      const result = await service.verify(bundle.toJSON());
      expect(result.valid).toBe(true);
      expect(repository.bundles.size).toBe(0);
    });

    it("returns invalid verification result on tampered bundle", async () => {
      const txid = "8".repeat(64);
      const input = {
        protocol: "Bitcoin",
        identifier: txid,
        amountSats: "20000",
        rawDataRefs: [
          {
            source: "Bitcoin",
            ref: txid,
            payload: { txid },
          },
        ],
      };

      const bundle = await service.build(ClaimType.Transaction, input, {
        scenarioId: "scenario-123",
      });

      const json = bundle.toJSON();
      const tampered = {
        ...json,
        bundleHash: "0x" + "9".repeat(64),
      };

      const result = await service.verify(tampered);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("HASH_MISMATCH");
    });
  });

  describe("getByHash", () => {
    it("returns bundle when found", async () => {
      const txid = "9".repeat(64);
      const input = {
        protocol: "Bitcoin",
        identifier: txid,
        amountSats: "1234",
        rawDataRefs: [
          {
            source: "Bitcoin",
            ref: txid,
            payload: { txid },
          },
        ],
      };

      const bundle = await service.build(ClaimType.Transaction, input, {
        scenarioId: "scenario-123",
      });

      const found = await service.getByHash(bundle.bundleHash);
      expect(found).not.toBeNull();
      expect(found?.bundleHash).toBe(bundle.bundleHash);
    });

    it("returns null when not found without throwing", async () => {
      const found = await service.getByHash("non-existent-hash");
      expect(found).toBeNull();
    });

    it("returns null when repository throws without throwing", async () => {
      repository.getThrows = true;
      const found = await service.getByHash("error-causing-hash");
      expect(found).toBeNull();
    });
  });

  describe("listByScenario", () => {
    it("returns bundles ordered by createdAt ascending", async () => {
      const txid1 = "a".repeat(64);
      const txid2 = "b".repeat(64);

      const bundleLater = await service.build(
        ClaimType.Transaction,
        {
          protocol: "Bitcoin",
          identifier: txid1,
          amountSats: "100",
          rawDataRefs: [
            { source: "Bitcoin", ref: txid1, payload: { txid: txid1 } },
          ],
        },
        { scenarioId: "scenario-order" },
      );

      const bundleEarlier = await service.build(
        ClaimType.Transaction,
        {
          protocol: "Bitcoin",
          identifier: txid2,
          amountSats: "200",
          rawDataRefs: [
            { source: "Bitcoin", ref: txid2, payload: { txid: txid2 } },
          ],
        },
        { scenarioId: "scenario-order" },
      );

      const earlierTime = new Date("2026-01-01T00:00:00Z");
      const laterTime = new Date("2026-01-02T00:00:00Z");

      const reordered1 = new EvidenceBundle({
        id: bundleLater.id,
        claim: bundleLater.claim,
        rawDataRefs: [...bundleLater.rawDataRefs],
        verificationSteps: [...bundleLater.verificationSteps],
        confidence: bundleLater.confidence,
        riskScore: bundleLater.riskScore,
        bundleHash: bundleLater.bundleHash,
        createdAt: laterTime,
      });

      const reordered2 = new EvidenceBundle({
        id: bundleEarlier.id,
        claim: bundleEarlier.claim,
        rawDataRefs: [...bundleEarlier.rawDataRefs],
        verificationSteps: [...bundleEarlier.verificationSteps],
        confidence: bundleEarlier.confidence,
        riskScore: bundleEarlier.riskScore,
        bundleHash: bundleEarlier.bundleHash,
        createdAt: earlierTime,
      });

      repository.scenarioBundles.set("scenario-order", [
        reordered1,
        reordered2,
      ]);

      const listed = await service.listByScenario("scenario-order");
      expect(listed).toHaveLength(2);
      expect(listed[0].createdAt.getTime()).toBeLessThan(
        listed[1].createdAt.getTime(),
      );
      expect(listed[0].createdAt).toEqual(earlierTime);
      expect(listed[1].createdAt).toEqual(laterTime);
    });
  });
});
