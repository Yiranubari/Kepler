import {
  KeplerLogger,
  TaintGraph,
  TaintNode,
  TaintEdge,
  TaintNodeType,
  EvidenceItem
} from '@kepler/shared';
import { AIService } from '../../src/modules/ai/ai.service';
import { AICache } from '../../src/modules/ai/ai.cache';
import { AIConfig } from '../../src/modules/ai/ai.types';
import { AIProviderRegistry } from '../../src/modules/ai/providers/registry';
import {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider
} from '../../src/modules/ai/providers/provider.interface';
import {
  AIInputTooLargeError,
  AINoProviderError,
  AINotFoundError,
  AIProviderError,
  AITimeoutError
} from '../../src/modules/ai/ai.errors';
import { TaintService } from '../../src/modules/taint/taint.service';
import { ProofService } from '../../src/modules/proof/proof.service';
import { TaintConfig } from '../../src/modules/taint/taint.types';
import { TaintRuleRegistry } from '../../src/modules/taint/rules/registry';
import { TaintScorer } from '../../src/modules/taint/taint.scorer';
import { TaintRepository } from '../../src/modules/taint/taint.repository';
import { ClaimRegistry } from '../../src/modules/proof/claims/registry';
import { ProofRepository } from '../../src/modules/proof/proof.repository';

class StubProvider implements AIProvider {
  public callCount = 0;
  public errorToThrow: Error | null = null;
  public responseText = 'ai generated text';

  constructor(
    public readonly name: string,
    public readonly model: string
  ) {}

  public async complete(_request: AICompletionRequest): Promise<AICompletionResponse> {
    this.callCount++;
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    return {
      text: this.responseText,
      model: this.model,
      provider: this.name,
      inputTokens: 10,
      outputTokens: 20
    };
  }
}

class TestRecordingLogger implements KeplerLogger {
  public entries: Array<{ level: string; message: string; context?: Record<string, unknown> }> = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: 'debug', message, context });
  }
  public info(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: 'info', message, context });
  }
  public warn(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: 'warn', message, context });
  }
  public error(message: string, _error?: unknown, context?: Record<string, unknown>): void {
    this.entries.push({ level: 'error', message, context });
  }
  public fatal(message: string, _error: unknown, context?: Record<string, unknown>): void {
    this.entries.push({ level: 'fatal', message, context });
  }
}

class StubTaintService extends TaintService {
  public graphToReturn: TaintGraph | null = null;

  constructor() {
    super(
      {} as unknown as TaintConfig,
      {} as unknown as TaintRuleRegistry,
      {} as unknown as TaintScorer,
      {} as unknown as TaintRepository,
      new TestRecordingLogger()
    );
  }

  public override async getGraph(_scenarioId: string): Promise<TaintGraph | null> {
    return this.graphToReturn;
  }
}

class StubProofService extends ProofService {
  constructor() {
    super(
      {} as unknown as ClaimRegistry,
      {} as unknown as ProofRepository,
      new TestRecordingLogger()
    );
  }

  public override async getByHash(_hash: string): Promise<null> {
    return null;
  }
}

describe('AIService', () => {
  const createSampleGraph = (scenarioId = 'scen-1'): TaintGraph => {
    const node1 = new TaintNode({ id: 'addr:1', type: TaintNodeType.Address, value: 'addr1' });
    const node2 = new TaintNode({ id: 'txid:2', type: TaintNodeType.Txid, value: 'txid2' });
    const edge1 = new TaintEdge({
      id: 'e1',
      from: 'addr:1',
      to: 'txid:2',
      relationship: 'sent_to',
      confidence: 0.9,
      evidence: [new EvidenceItem({ kind: 'RawData', ref: 'r1', description: 'desc' })]
    });
    return new TaintGraph({ id: 'g1', scenarioId, nodes: [node1, node2], edges: [edge1] });
  };

  it('explainGraph returns cached response on second call and asserts provider is called exactly once', async () => {
    const provider = new StubProvider('groq', 'llama-3.3-70b-versatile');
    const registry = new AIProviderRegistry([provider]);
    const cache = new AICache(60000, 10);
    const config = new AIConfig({ groqApiKey: 'key' });
    const taintService = new StubTaintService();
    taintService.graphToReturn = createSampleGraph('scen-1');
    const proofService = new StubProofService();
    const logger = new TestRecordingLogger();

    const service = new AIService(registry, cache, config, taintService, proofService, logger);

    const first = await service.explainGraph('scen-1');
    expect(first.cached).toBe(false);
    expect(first.text).toBe('ai generated text');
    expect(provider.callCount).toBe(1);

    const second = await service.explainGraph('scen-1');
    expect(second.cached).toBe(true);
    expect(second.text).toBe('ai generated text');
    expect(provider.callCount).toBe(1);
  });

  it('explainGraph falls back to second provider when first throws AITimeoutError', async () => {
    const p1 = new StubProvider('groq', 'groq-model');
    p1.errorToThrow = new AITimeoutError('Timeout', { provider: 'groq', timeoutMs: 1000 });
    const p2 = new StubProvider('huggingface', 'hf-model');
    p2.responseText = 'fallback response';

    const registry = new AIProviderRegistry([p1, p2]);
    const cache = new AICache(60000, 10);
    const config = new AIConfig({ groqApiKey: 'key1', huggingfaceApiKey: 'key2' });
    const taintService = new StubTaintService();
    taintService.graphToReturn = createSampleGraph('scen-1');
    const proofService = new StubProofService();
    const logger = new TestRecordingLogger();

    const service = new AIService(registry, cache, config, taintService, proofService, logger);
    const result = await service.explainGraph('scen-1');

    expect(p1.callCount).toBe(1);
    expect(p2.callCount).toBe(1);
    expect(result.provider).toBe('huggingface');
    expect(result.text).toBe('fallback response');
  });

  it('explainGraph throws AINoProviderError when both providers fail', async () => {
    const p1 = new StubProvider('groq', 'groq-model');
    p1.errorToThrow = new AIProviderError('Groq failed', { provider: 'groq', status: 502 });
    const p2 = new StubProvider('huggingface', 'hf-model');
    p2.errorToThrow = new AITimeoutError('HF timeout', { provider: 'huggingface', timeoutMs: 1000 });

    const registry = new AIProviderRegistry([p1, p2]);
    const cache = new AICache(60000, 10);
    const config = new AIConfig({ groqApiKey: 'key1', huggingfaceApiKey: 'key2' });
    const taintService = new StubTaintService();
    taintService.graphToReturn = createSampleGraph('scen-1');
    const proofService = new StubProofService();
    const logger = new TestRecordingLogger();

    const service = new AIService(registry, cache, config, taintService, proofService, logger);

    let caughtError: unknown;
    try {
      await service.explainGraph('scen-1');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AINoProviderError);
    const noProvErr = caughtError as AINoProviderError;
    expect(noProvErr.context['attempted']).toEqual(['groq', 'huggingface']);
  });

  it('explainGraph throws AINotFoundError when graph is missing', async () => {
    const provider = new StubProvider('groq', 'model');
    const registry = new AIProviderRegistry([provider]);
    const cache = new AICache(60000, 10);
    const config = new AIConfig({ groqApiKey: 'key' });
    const taintService = new StubTaintService();
    taintService.graphToReturn = null;
    const proofService = new StubProofService();
    const logger = new TestRecordingLogger();

    const service = new AIService(registry, cache, config, taintService, proofService, logger);

    let caughtError: unknown;
    try {
      await service.explainGraph('missing-scen');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(AINotFoundError);
    const notFound = caughtError as AINotFoundError;
    expect(notFound.context['resource']).toBe('TaintGraph');
    expect(notFound.context['id']).toBe('missing-scen');
  });

  it('explainGraph throws AIInputTooLargeError when prompt exceeds maxInputChars', async () => {
    const provider = new StubProvider('groq', 'model');
    const registry = new AIProviderRegistry([provider]);
    const cache = new AICache(60000, 10);
    const config = new AIConfig({ groqApiKey: 'key', maxInputChars: 10 });
    const taintService = new StubTaintService();
    taintService.graphToReturn = createSampleGraph('scen-1');
    const proofService = new StubProofService();
    const logger = new TestRecordingLogger();

    const service = new AIService(registry, cache, config, taintService, proofService, logger);

    await expect(service.explainGraph('scen-1')).rejects.toThrow(AIInputTooLargeError);
  });

  it('ensures no log call contains the full prompt or the full AI response text', async () => {
    const secretResponseText = 'very_specific_secret_ai_output_content_string';
    const provider = new StubProvider('groq', 'model');
    provider.responseText = secretResponseText;
    const registry = new AIProviderRegistry([provider]);
    const cache = new AICache(60000, 10);
    const config = new AIConfig({ groqApiKey: 'key' });
    const taintService = new StubTaintService();
    taintService.graphToReturn = createSampleGraph('scen-1');
    const proofService = new StubProofService();
    const logger = new TestRecordingLogger();

    const service = new AIService(registry, cache, config, taintService, proofService, logger);
    await service.explainGraph('scen-1');

    for (const entry of logger.entries) {
      const fullLogString = JSON.stringify(entry);
      expect(fullLogString).not.toContain(secretResponseText);
      expect(fullLogString).not.toContain('Scenario Kind:');
      expect(fullLogString).not.toContain('Top Identified Connections:');
    }
  });
});
