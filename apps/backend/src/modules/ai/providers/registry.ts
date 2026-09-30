import { KeplerLogger } from '@kepler/shared';
import { AINoProviderError } from '../ai.errors';
import { AIConfig } from '../ai.types';
import { AIProvider } from './provider.interface';
import { GroqProvider } from './groq.provider';
import { HuggingFaceProvider } from './huggingface.provider';

export class AIProviderRegistry {
  private readonly providers: readonly AIProvider[];

  constructor(providers: AIProvider[]) {
    this.providers = Object.freeze([...providers]);
  }

  public getProviders(): readonly AIProvider[] {
    return this.providers;
  }

  public getPrimary(): AIProvider {
    const primary = this.providers[0];
    if (!primary) {
      throw new AINoProviderError('No AI providers registered', {
        attempted: []
      });
    }
    return primary;
  }

  public getFallbacks(): readonly AIProvider[] {
    return this.providers.slice(1);
  }

  public hasAny(): boolean {
    return this.providers.length > 0;
  }

  public static createDefault(config: AIConfig, logger: KeplerLogger): AIProviderRegistry {
    const providers: AIProvider[] = [];

    if (config.hasGroq && config.groqApiKey) {
      providers.push(new GroqProvider(config.groqApiKey, config.groqModel, config.timeoutMs, logger));
    }

    if (config.hasHuggingFace && config.huggingfaceApiKey) {
      providers.push(new HuggingFaceProvider(config.huggingfaceApiKey, config.hfModel, config.timeoutMs, logger));
    }

    if (providers.length === 0) {
      throw new AINoProviderError('No AI provider configured in registry', {
        attempted: ['groq', 'huggingface']
      });
    }

    return new AIProviderRegistry(providers);
  }
}
