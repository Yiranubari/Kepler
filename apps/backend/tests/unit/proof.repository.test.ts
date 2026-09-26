import '../../src/config/env';
import { PrismaClient } from '@prisma/client';
import {
  Claim,
  ClaimType,
  EvidenceBundle,
  RawDataRef,
  VerificationStep
} from '@kepler/shared';
import { ProofRepository } from '../../src/modules/proof/proof.repository';

describe('ProofRepository', () => {
  let prisma: PrismaClient;
  let repository: ProofRepository;

  const testScenarioId = 'test_proof_repo_scenario_real';
  const bundleHash1 = '1111111111111111111111111111111111111111111111111111111111111111';
  const bundleHash2 = '2222222222222222222222222222222222222222222222222222222222222222';

  const bundle1 = new EvidenceBundle({
    id: 'bundle-real-1',
    claim: new Claim({ text: 'Claim 1 statement', type: ClaimType.Transaction }),
    rawDataRefs: [
      new RawDataRef({
        source: 'Bitcoin',
        ref: 'txid-real-1',
        payload: { txid: 'txid-real-1' },
        fetchedAt: new Date('2026-01-01T00:00:00Z')
      })
    ],
    verificationSteps: [
      new VerificationStep({
        name: 'execution:identifier',
        endpoint: '/api/proof/verify',
        input: { identifier: 'txid-real-1' },
        expected: 'txid-real-1'
      })
    ],
    confidence: 1.0,
    riskScore: 0.1,
    bundleHash: bundleHash1,
    createdAt: new Date('2026-01-01T00:00:00Z')
  });

  const bundle2 = new EvidenceBundle({
    id: 'bundle-real-2',
    claim: new Claim({ text: 'Claim 2 statement', type: ClaimType.Privacy }),
    rawDataRefs: [
      new RawDataRef({
        source: 'Nostr',
        ref: 'nostr-real-1',
        payload: { id: 'nostr-real-1' },
        fetchedAt: new Date('2026-01-02T00:00:00Z')
      })
    ],
    verificationSteps: [
      new VerificationStep({
        name: 'SAME_PAYMENT_HASH:recompute',
        endpoint: '/api/proof/verify',
        input: { hash: 'hash1' },
        expected: true
      })
    ],
    confidence: 0.8,
    riskScore: 0.3,
    bundleHash: bundleHash2,
    createdAt: new Date('2026-01-02T00:00:00Z')
  });

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repository = new ProofRepository(prisma);

    await prisma.scenario.upsert({
      where: { id: testScenarioId },
      create: {
        id: testScenarioId,
        targetKind: 'BITCOIN',
        targetData: {},
        status: 'ACTIVE'
      },
      update: {}
    });

    await prisma.decision.deleteMany({
      where: { scenarioId: testScenarioId }
    });
    await prisma.evidenceRecord.deleteMany({
      where: { bundleHash: { in: [bundleHash1, bundleHash2] } }
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.decision.deleteMany({
        where: { scenarioId: testScenarioId }
      });
      await prisma.evidenceRecord.deleteMany({
        where: { bundleHash: { in: [bundleHash1, bundleHash2] } }
      });
      await prisma.scenario.deleteMany({
        where: { id: testScenarioId }
      });
      await prisma.$disconnect();
    } catch {
      return;
    }
  }, 30000);

  it('saveBundle upserts by hash', async () => {
    await repository.saveBundle(bundle1, testScenarioId);

    const record = await prisma.evidenceRecord.findUnique({
      where: { bundleHash: bundleHash1 }
    });
    expect(record).not.toBeNull();
    expect(record?.bundleHash).toBe(bundleHash1);
    expect(record?.claimText).toBe('Claim 1 statement');

    await repository.saveBundle(bundle1, testScenarioId);

    const count = await prisma.evidenceRecord.count({
      where: { bundleHash: bundleHash1 }
    });
    expect(count).toBe(1);

    const fetched = await repository.getByHash(bundleHash1);
    expect(fetched).not.toBeNull();
    expect(fetched?.bundleHash).toBe(bundleHash1);
    expect(fetched?.claim.text).toBe('Claim 1 statement');
  });

  it('getByHash returns null for unknown', async () => {
    const unknown = await repository.getByHash('unknown_bundle_hash_999999999999999999999999999999');
    expect(unknown).toBeNull();
  });

  it('listByScenario joins correctly through Decision', async () => {
    await repository.saveBundle(bundle2, testScenarioId);

    await repository.linkDecision(testScenarioId, { route: 'route-1' }, bundleHash1);
    await repository.linkDecision(testScenarioId, { route: 'route-2' }, bundleHash2);

    const results = await repository.listByScenario(testScenarioId);
    expect(results).toHaveLength(2);

    const hashes = results.map((b) => b.bundleHash);
    expect(hashes).toContain(bundleHash1);
    expect(hashes).toContain(bundleHash2);

    expect(results[0].createdAt.getTime()).toBeLessThanOrEqual(results[1].createdAt.getTime());
  });
});
