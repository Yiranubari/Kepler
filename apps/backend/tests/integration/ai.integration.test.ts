import '../../src/config/env';
import { PrismaClient } from '@prisma/client';
import {
  TaintNode,
  TaintEdge,
  TaintGraph,
  TaintNodeType,
  EvidenceItem,
  EvidenceBundle,
  Claim,
  ClaimType,
  RawDataRef,
  VerificationStep,
  KeplerLogger,
  RELATIONSHIP_LABELS
} from '@kepler/shared';
import { TaintConfig } from '../../src/modules/taint/taint.types';
import { createDefaultRuleRegistry } from '../../src/modules/taint';
import { TaintRepository } from '../../src/modules/taint/taint.repository';
import { TaintService } from '../../src/modules/taint/taint.service';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import { ProofRepository } from '../../src/modules/proof/proof.repository';
import { ProofService } from '../../src/modules/proof/proof.service';
import { ClaimRegistry } from '../../src/modules/proof/claims/registry';
import { AIConfig } from '../../src/modules/ai/ai.types';
import { AIProviderRegistry } from '../../src/modules/ai/providers/registry';
import { AICache } from '../../src/modules/ai/ai.cache';
import { AIService } from '../../src/modules/ai/ai.service';

class IntegrationLogger implements KeplerLogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public fatal(): void {}
}

const groqKey = process.env.GROQ_API_KEY ?? '';
const groqConfigured = groqKey.length > 0 && !groqKey.includes('placeholder');

const hfKey = process.env.HUGGINGFACE_API_KEY ?? '';
const hfConfigured = hfKey.length > 0 && !hfKey.includes('placeholder');

const shouldRun = groqConfigured || hfConfigured;
const describeOrSkip = shouldRun ? describe : describe.skip;

describeOrSkip('AI Integration Tests (Real providers, no mocks)', () => {
  let prisma: PrismaClient;
  let taintRepository: TaintRepository;
  let taintService: TaintService;
  let proofRepository: ProofRepository;
  let proofService: ProofService;
  let aiService: AIService;

  const testScenarioId = `test_ai_integration_${Date.now()}`;
  const logger = new IntegrationLogger();

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

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

    taintRepository = new TaintRepository(prisma);
    const taintConfig = TaintConfig.fromEnv();
    const taintRegistry = createDefaultRuleRegistry();
    const taintScorer = new TaintScorer();
    taintService = new TaintService(
      taintConfig,
      taintRegistry,
      taintScorer,
      taintRepository,
      logger
    );

    const proofRegistry = ClaimRegistry.createDefault();
    proofRepository = new ProofRepository(prisma);
    proofService = new ProofService(proofRegistry, proofRepository, logger);

    const aiConfig = AIConfig.fromEnv();
    const aiRegistry = AIProviderRegistry.createDefault(aiConfig, logger);
    const aiCache = new AICache(60000, 100);
    aiService = new AIService(
      aiRegistry,
      aiCache,
      aiConfig,
      taintService,
      proofService,
      logger
    );
  }, 30000);

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.taintGraphRecord.deleteMany({
          where: { scenarioId: testScenarioId }
        });
        await prisma.evidenceRecord.deleteMany({
          where: { id: { startsWith: 'bundle_int_' } }
        });
        await prisma.scenario.deleteMany({
          where: { id: testScenarioId }
        });
        await prisma.$disconnect();
      }
    } catch {}
  }, 30000);

  const describeGroq = groqConfigured ? describe : describe.skip;
  describeGroq('Groq provider', () => {
    it(
      'calls explainGraph against a real scenario graph via Groq and receives non-empty text',
      async () => {
        const node1 = new TaintNode({
          id: 'txid:3b5a11d08e1a1234567890abcdef3b5a11d08e1a1234567890abcdef1234',
          type: TaintNodeType.Txid,
          value: '3b5a11d08e1a1234567890abcdef3b5a11d08e1a1234567890abcdef1234'
        });
        const node2 = new TaintNode({
          id: 'address:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          type: TaintNodeType.Address,
          value: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
        });
        const edge1 = new TaintEdge({
          id: 'edge:int1',
          from: 'txid:3b5a11d08e1a1234567890abcdef3b5a11d08e1a1234567890abcdef1234',
          to: 'address:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          relationship: 'transfers_to',
          confidence: 0.9,
          evidence: [
            new EvidenceItem({
              kind: 'RawData',
              ref: 'ref:tx1',
              description: 'Transaction confirmation'
            })
          ]
        });

        const graph = new TaintGraph({
          id: `graph_${testScenarioId}`,
          scenarioId: testScenarioId,
          nodes: [node1, node2],
          edges: [edge1]
        });
        await taintRepository.saveGraph(testScenarioId, {
          graph,
          scenarioId: testScenarioId,
          analyzedAt: new Date().toISOString(),
          ruleCount: 1,
          nodeCount: 2,
          edgeCount: 1,
          pathCount: 0
        });

        const response = await aiService.explainGraph(testScenarioId);

        expect(response).toBeDefined();
        expect(typeof response.text).toBe('string');
        expect(response.text.trim().length).toBeGreaterThan(0);
        expect(response.text).not.toContain('**');
        expect(response.text).not.toContain('_');
        for (const rel of Object.keys(RELATIONSHIP_LABELS)) {
          expect(response.text).not.toContain(rel);
        }
        expect(response.text).not.toContain('\u2014');
        expect(response.text).not.toContain('\u2013');
        expect(response.text.length).toBeLessThan(800);
        expect(response.provider).toBe('groq');
        expect(response.cached).toBe(false);

        const cachedResponse = await aiService.explainGraph(testScenarioId);
        expect(cachedResponse.cached).toBe(true);
        expect(cachedResponse.text).toBe(response.text);
      },
      30000
    );
  });

  const describeHf = hfConfigured ? describe : describe.skip;
  describeHf('Hugging Face provider', () => {
    it(
      'calls summarizeEvidence against a real bundle via Hugging Face when Groq is not set',
      async () => {
        const bundle = new EvidenceBundle({
          id: `bundle_int_${Date.now()}`,
          claim: new Claim({
            text: 'Payment verified onchain with 6 confirmations',
            type: ClaimType.Transaction
          }),
          rawDataRefs: [
            new RawDataRef({
              source: 'Bitcoin',
              ref: 'tx_ref_3b5a11d08e1a1234567890abcdef3b5a11d0',
              payload: {}
            })
          ],
          verificationSteps: [
            new VerificationStep({
              name: 'CheckConfirmations',
              endpoint: 'https://blockstream.info/api',
              input: {},
              expected: {}
            })
          ],
          confidence: 0.95
        });

        await proofRepository.saveBundle(bundle, testScenarioId);

        const response = await aiService.summarizeEvidence(bundle.bundleHash);

        expect(response).toBeDefined();
        expect(typeof response.text).toBe('string');
        expect(response.text.trim().length).toBeGreaterThan(0);
        expect(response.provider).toBe('huggingface');
        expect(response.cached).toBe(false);
      },
      30000
    );
  });
});
