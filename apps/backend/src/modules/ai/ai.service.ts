import { KeplerLogger, TaintNodeType, RELATIONSHIP_LABELS } from '@kepler/shared';
import {
  AIInputTooLargeError,
  AINoProviderError,
  AINotFoundError,
  AIProviderError,
  AITimeoutError
} from './ai.errors';
import { AIConfig, AIResponse } from './ai.types';
import { AICache } from './ai.cache';
import {
  AIPrompt,
  EvidenceSummaryInput,
  RouteSuggestionInput,
  TaintGraphExplanationInput
} from './ai.prompt';
import { AIProviderRegistry } from './providers/registry';
import { AICompletionResponse } from './providers/provider.interface';
import { TaintService } from '../taint/taint.service';
import { ProofService } from '../proof/proof.service';

export { AIResponse };

export class AIService {
  private readonly registry: AIProviderRegistry;
  private readonly cache: AICache;
  private readonly config: AIConfig;
  private readonly taintService: TaintService;
  private readonly proofService: ProofService;
  private readonly logger: KeplerLogger;

  constructor(
    registry: AIProviderRegistry,
    cache: AICache,
    config: AIConfig,
    taintService: TaintService,
    proofService: ProofService,
    logger: KeplerLogger
  ) {
    this.registry = registry;
    this.cache = cache;
    this.config = config;
    this.taintService = taintService;
    this.proofService = proofService;
    this.logger = logger;
  }

  public async explainGraph(scenarioId: string): Promise<AIResponse> {
    const graph = await this.taintService.getGraph(scenarioId);
    if (!graph) {
      throw new AINotFoundError('Taint graph not found', {
        resource: 'TaintGraph',
        id: scenarioId
      });
    }

    const cacheKey = AICache.keyFromRequest('explain', { scenarioId });
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        text: cached.text,
        model: cached.model,
        provider: cached.provider,
        cached: true
      };
    }

    let scenarioKind: 'Lightning' | 'Bitcoin' | 'Cashu' = 'Bitcoin';
    for (const node of graph.nodes) {
      if (
        node.type === TaintNodeType.Invoice ||
        node.type === TaintNodeType.PaymentHash ||
        node.type === TaintNodeType.Preimage
      ) {
        scenarioKind = 'Lightning';
        break;
      }
      if (node.type === TaintNodeType.CashuToken || node.type === TaintNodeType.Mint) {
        scenarioKind = 'Cashu';
        break;
      }
    }

    const sortedEdges = [...graph.edges]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    const topEdges = sortedEdges.map((edge) => {
      const fromNode = graph.getNode(edge.from);
      const toNode = graph.getNode(edge.to);
      return {
        relationship: edge.relationship,
        confidence: edge.confidence,
        fromType: fromNode ? fromNode.type : 'Unknown',
        toType: toNode ? toNode.type : 'Unknown',
        fromIdTruncated: fromNode?.type === TaintNodeType.Preimage ? '[REDACTED]' : AIPrompt.truncateHash(edge.from),
        toIdTruncated: toNode?.type === TaintNodeType.Preimage ? '[REDACTED]' : AIPrompt.truncateHash(edge.to)
      };
    });

    const sortedPaths = [...graph.paths]
      .sort((a, b) => b.overallConfidence - a.overallConfidence)
      .slice(0, 5);

    const topPaths = sortedPaths.map((path) => ({
      length: path.nodes.length,
      overallConfidence: path.overallConfidence,
      nodeTypes: path.nodes.map((nodeId) => {
        const node = graph.getNode(nodeId);
        return node ? node.type : 'Unknown';
      })
    }));

    const input: TaintGraphExplanationInput = {
      scenarioKind,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      topEdges,
      topPaths
    };

    const { system, user } = AIPrompt.explainTaintGraph(input);
    const response = await this.complete(system, user);
    const cleanedText = this.cleanExplanationText(response.text);
    const cleanedResponse = {
      ...response,
      text: cleanedText
    };
    this.cache.set(cacheKey, cleanedResponse);

    return {
      text: cleanedResponse.text,
      model: cleanedResponse.model,
      provider: cleanedResponse.provider,
      cached: false
    };
  }

  public async summarizeEvidence(bundleHash: string): Promise<AIResponse> {
    const bundle = await this.proofService.getByHash(bundleHash);
    if (!bundle) {
      throw new AINotFoundError('Evidence bundle not found', {
        resource: 'EvidenceBundle',
        id: bundleHash
      });
    }

    const cacheKey = AICache.keyFromRequest('summarize', { bundleHash });
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        text: cached.text,
        model: cached.model,
        provider: cached.provider,
        cached: true
      };
    }

    const input: EvidenceSummaryInput = {
      claimType: bundle.claim.type,
      claimText: bundle.claim.text,
      confidence: bundle.confidence,
      rawDataRefs: bundle.rawDataRefs.map((r) => ({
        source: r.source,
        refTruncated: AIPrompt.truncateHash(r.ref)
      })),
      verificationStepNames: bundle.verificationSteps.map((s) => s.name),
      valid: null
    };

    const { system, user } = AIPrompt.summarizeEvidence(input);
    const response = await this.complete(system, user);
    this.cache.set(cacheKey, response);

    return {
      text: response.text,
      model: response.model,
      provider: response.provider,
      cached: false
    };
  }

  public async suggestRoute(input: RouteSuggestionInput): Promise<AIResponse> {
    const cacheKey = AICache.keyFromRequest('suggest', input);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        text: cached.text,
        model: cached.model,
        provider: cached.provider,
        cached: true
      };
    }

    const { system, user } = AIPrompt.suggestRoute(input);
    const response = await this.complete(system, user);
    this.cache.set(cacheKey, response);

    return {
      text: response.text,
      model: response.model,
      provider: response.provider,
      cached: false
    };
  }

  private async complete(system: string, user: string): Promise<AICompletionResponse> {
    const size = system.length + user.length;
    const max = this.config.maxInputChars;
    if (size > max) {
      throw new AIInputTooLargeError('AI input size exceeds maximum allowed characters', {
        size,
        max
      });
    }

    const providers = this.registry.getProviders();
    const attempted: string[] = [];

    for (const provider of providers) {
      attempted.push(provider.name);
      try {
        const response = await provider.complete({
          system,
          user,
          maxTokens: 2048,
          temperature: 0.2
        });
        return response;
      } catch (error: unknown) {
        if (error instanceof AITimeoutError) {
          this.logger.warn(`AI provider ${provider.name} timed out, trying next provider`, {
            provider: provider.name,
            timeoutMs: error.context['timeoutMs']
          });
          continue;
        }
        if (error instanceof AIProviderError) {
          this.logger.warn(`AI provider ${provider.name} failed, trying next provider`, {
            provider: provider.name,
            status: error.context['status'],
            reason: error.context['reason']
          });
          continue;
        }
        throw error;
      }
    }

    throw new AINoProviderError('All AI providers failed', {
      attempted
    });
  }

  private cleanExplanationText(text: string): string {
    let cleaned = text
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/[\u2014\u2013]|--/g, ', ');

    for (const [key, label] of Object.entries(RELATIONSHIP_LABELS)) {
      if (cleaned.includes(key)) {
        cleaned = cleaned.split(key).join(label);
      }
    }

    cleaned = cleaned.replace(/_/g, ' ').trim();

    if (cleaned.length > 800) {
      cleaned = cleaned.slice(0, 800).trim();
    }
    return cleaned;
  }
}
