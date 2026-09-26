import { PrismaClient, Prisma } from '@prisma/client';
import {
  Scenario,
  ScenarioStatus,
  PaymentTargetKind,
  PaymentTargetPayload
} from '@kepler/shared';
import { CreateScenarioInput } from './scenario.types';

export class ScenarioRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async create(input: CreateScenarioInput): Promise<Scenario> {
    const data: Prisma.ScenarioCreateInput = {
      ...(input.id ? { id: input.id } : {}),
      targetKind: input.target.kind,
      targetData: JSON.parse(JSON.stringify(input.target.payload)),
      status: ScenarioStatus.Pending
    };

    const record = await this.prisma.scenario.create({ data });
    const scenario = this.mapToScenario(record);
    if (!scenario) {
      throw new Error(`Failed to map created scenario ${record.id}`);
    }
    return scenario;
  }

  public async getById(id: string): Promise<Scenario | null> {
    const record = await this.prisma.scenario.findUnique({
      where: { id }
    });

    if (!record) {
      return null;
    }

    return this.mapToScenario(record);
  }

  public async list(limit: number = 50, offset: number = 0): Promise<Scenario[]> {
    const safeLimit = typeof limit === 'number' && !Number.isNaN(limit) ? limit : 50;
    const effectiveLimit = Math.min(Math.max(1, safeLimit), 200);
    const effectiveOffset = typeof offset === 'number' && !Number.isNaN(offset) && offset > 0 ? Math.min(offset, 1000000) : 0;

    const records = await this.prisma.scenario.findMany({
      orderBy: { createdAt: 'desc' },
      take: effectiveLimit,
      skip: effectiveOffset
    });

    const scenarios: Scenario[] = [];
    for (const record of records) {
      const scenario = this.mapToScenario(record);
      if (scenario !== null) {
        scenarios.push(scenario);
      }
    }
    return scenarios;
  }

  public async updateStatus(id: string, status: ScenarioStatus): Promise<Scenario> {
    const record = await this.prisma.scenario.update({
      where: { id },
      data: { status }
    });

    const scenario = this.mapToScenario(record);
    if (!scenario) {
      throw new Error(`Failed to map scenario ${id}`);
    }
    return scenario;
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.prisma.scenario.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      return;
    }

    await this.prisma.scenario.delete({
      where: { id }
    });
  }

  private mapToScenario(record: {
    id: string;
    targetKind: string;
    targetData: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): Scenario | null {
    try {
      const parsedPayload =
        typeof record.targetData === 'string'
          ? JSON.parse(record.targetData)
          : record.targetData;

      return Scenario.fromJSON({
        id: record.id,
        target: {
          kind: this.parseTargetKind(record.targetKind),
          payload: parsedPayload as PaymentTargetPayload
        },
        status: this.parseStatus(record.status),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      });
    } catch {
      return null;
    }
  }

  private parseTargetKind(kind: string): PaymentTargetKind {
    const lower = kind.trim().toLowerCase();
    if (lower === 'lightning') return PaymentTargetKind.Lightning;
    if (lower === 'bitcoin') return PaymentTargetKind.Bitcoin;
    if (lower === 'cashu') return PaymentTargetKind.Cashu;
    return kind as PaymentTargetKind;
  }

  private parseStatus(status: string): ScenarioStatus {
    const s = Object.values(ScenarioStatus).find(
      (val) => val.toLowerCase() === status.trim().toLowerCase()
    );
    return s ?? (status as ScenarioStatus);
  }
}
