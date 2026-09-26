import { PrismaClient, Prisma } from "@prisma/client";
import {
  Claim,
  ClaimType,
  EvidenceBundle,
  RawDataRef,
  RawDataRefJSON,
  VerificationStep,
  VerificationStepJSON,
} from "@kepler/shared";
import { ProofNotFoundError, ProofPersistenceError } from "./proof.errors";

export class ProofRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async saveBundle(
    bundle: EvidenceBundle,
    _scenarioId: string,
  ): Promise<void> {
    try {
      const rawDataRefsJson = bundle.rawDataRefs.map((r) => r.toJSON());
      const verificationJson = bundle.verificationSteps.map((s) => s.toJSON());

      await this.prisma.evidenceRecord.upsert({
        where: { bundleHash: bundle.bundleHash },
        create: {
          id: bundle.id,
          claimType: bundle.claim.type,
          claimText: bundle.claim.text,
          rawDataRefs: JSON.parse(JSON.stringify(rawDataRefsJson)),
          verification: JSON.parse(JSON.stringify(verificationJson)),
          confidence: bundle.confidence,
          riskScore:
            bundle.riskScore !== null && bundle.riskScore !== undefined
              ? bundle.riskScore
              : null,
          bundleHash: bundle.bundleHash,
          createdAt: bundle.createdAt,
        },
        update: {
          claimType: bundle.claim.type,
          claimText: bundle.claim.text,
          rawDataRefs: JSON.parse(JSON.stringify(rawDataRefsJson)),
          verification: JSON.parse(JSON.stringify(verificationJson)),
          confidence: bundle.confidence,
          riskScore:
            bundle.riskScore !== null && bundle.riskScore !== undefined
              ? bundle.riskScore
              : null,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProofPersistenceError(
        "Failed to save evidence bundle",
        { bundleId: bundle.id, operation: "saveBundle", reason },
        error instanceof Error ? error : undefined,
      );
    }
  }

  public async linkDecision(
    scenarioId: string,
    routeJson: unknown,
    bundleHash: string,
  ): Promise<void> {
    const evidence = await this.prisma.evidenceRecord.findUnique({
      where: { bundleHash },
    });

    if (!evidence) {
      throw new ProofNotFoundError(
        "Evidence record not found for decision linking",
        {
          bundleHash,
        },
      );
    }

    try {
      await this.prisma.decision.create({
        data: {
          scenarioId,
          route: (routeJson ?? {}) as Prisma.InputJsonValue,
          evidenceId: evidence.id,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProofPersistenceError(
        "Failed to link decision to evidence record",
        { bundleId: evidence.id, operation: "linkDecision", reason },
        error instanceof Error ? error : undefined,
      );
    }
  }

  public async getByHash(bundleHash: string): Promise<EvidenceBundle | null> {
    try {
      const record = await this.prisma.evidenceRecord.findUnique({
        where: { bundleHash },
      });
      if (!record) {
        return null;
      }
      return this.mapToEvidenceBundle(record);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProofPersistenceError(
        "Failed to get evidence bundle by hash",
        { bundleId: bundleHash, operation: "getByHash", reason },
        error instanceof Error ? error : undefined,
      );
    }
  }

  public async listByScenario(scenarioId: string): Promise<EvidenceBundle[]> {
    try {
      const records = await this.prisma.evidenceRecord.findMany({
        where: {
          decisions: {
            some: { scenarioId },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return records.map((record) => this.mapToEvidenceBundle(record));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProofPersistenceError(
        "Failed to list evidence bundles by scenario",
        { bundleId: scenarioId, operation: "listByScenario", reason },
        error instanceof Error ? error : undefined,
      );
    }
  }

  public async deleteByHash(bundleHash: string): Promise<void> {
    try {
      const record = await this.prisma.evidenceRecord.findUnique({
        where: { bundleHash },
        select: { id: true },
      });

      if (!record) {
        return;
      }

      await this.prisma.decision.deleteMany({
        where: { evidenceId: record.id },
      });

      await this.prisma.evidenceRecord.delete({
        where: { id: record.id },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProofPersistenceError(
        "Failed to delete evidence bundle by hash",
        { bundleId: bundleHash, operation: "deleteByHash", reason },
        error instanceof Error ? error : undefined,
      );
    }
  }

  private mapToEvidenceBundle(record: {
    id: string;
    claimType: string;
    claimText: string;
    rawDataRefs: unknown;
    verification: unknown;
    confidence: number | null;
    riskScore: number | null;
    bundleHash: string;
    createdAt: Date;
  }): EvidenceBundle {
    const rawDataRefsArray = Array.isArray(record.rawDataRefs)
      ? (record.rawDataRefs as RawDataRefJSON[]).map((r) =>
          RawDataRef.fromJSON(r),
        )
      : [];

    const verificationStepsArray = Array.isArray(record.verification)
      ? (record.verification as VerificationStepJSON[]).map((s) =>
          VerificationStep.fromJSON(s),
        )
      : [];

    return new EvidenceBundle({
      id: record.id,
      claim: new Claim({
        text: record.claimText,
        type: record.claimType as ClaimType,
      }),
      rawDataRefs: rawDataRefsArray,
      verificationSteps: verificationStepsArray,
      confidence: record.confidence ?? 0,
      riskScore: record.riskScore ?? null,
      bundleHash: record.bundleHash,
      createdAt: record.createdAt,
    });
  }
}
