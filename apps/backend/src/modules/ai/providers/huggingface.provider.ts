import { KeplerLogger } from '@kepler/shared';
import { AIProviderError, AITimeoutError } from '../ai.errors';
import {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider
} from './provider.interface';

export class HuggingFaceProvider implements AIProvider {
  private static readonly ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';

  public readonly name: string = 'huggingface';
  public readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly logger: KeplerLogger;

  constructor(apiKey: string, model: string, timeoutMs: number, logger: KeplerLogger) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
  }

  public async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, this.timeoutMs);

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user }
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      response_format: { type: 'text' }
    });

    const startTime = performance.now();
    let response: Response;

    try {
      response = await fetch(HuggingFaceProvider.ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body,
        signal: controller.signal
      });
    } catch (error: unknown) {
      if (isTimeout || controller.signal.aborted) {
        throw new AITimeoutError('Hugging Face request timed out', {
          provider: 'huggingface',
          timeoutMs: this.timeoutMs
        });
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';
      throw new AIProviderError(`Hugging Face request failed: ${errorMessage}`, {
        provider: 'huggingface',
        reason: errorMessage
      }, error instanceof Error ? error : undefined);
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401 || response.status === 403) {
      throw new AIProviderError(`Hugging Face authentication failed with status ${response.status}`, {
        provider: 'huggingface',
        status: response.status,
        reason: 'AUTH_FAILED'
      });
    }

    if (response.status === 429) {
      throw new AIProviderError('Hugging Face rate limited', {
        provider: 'huggingface',
        status: 429,
        reason: 'RATE_LIMITED'
      });
    }

    if (response.status >= 500 && response.status < 600) {
      throw new AIProviderError(`Hugging Face server error with status ${response.status}`, {
        provider: 'huggingface',
        status: response.status
      });
    }

    if (!response.ok) {
      throw new AIProviderError(`Hugging Face request failed with status ${response.status}`, {
        provider: 'huggingface',
        status: response.status
      });
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error: unknown) {
      throw new AIProviderError('Hugging Face response was not valid JSON', {
        provider: 'huggingface',
        reason: 'MALFORMED_RESPONSE'
      }, error instanceof Error ? error : undefined);
    }

    if (!data || typeof data !== 'object') {
      throw new AIProviderError('Hugging Face response is malformed', {
        provider: 'huggingface',
        reason: 'MALFORMED_RESPONSE'
      });
    }

    const record = data as Record<string, unknown>;
    const choices = record['choices'];
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new AIProviderError('Hugging Face response choices missing or empty', {
        provider: 'huggingface',
        reason: 'MALFORMED_RESPONSE'
      });
    }

    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    if (!firstChoice || typeof firstChoice !== 'object') {
      throw new AIProviderError('Hugging Face response choice is malformed', {
        provider: 'huggingface',
        reason: 'MALFORMED_RESPONSE'
      });
    }

    const message = firstChoice['message'] as Record<string, unknown> | undefined;
    if (!message || typeof message !== 'object') {
      throw new AIProviderError('Hugging Face response message is malformed', {
        provider: 'huggingface',
        reason: 'MALFORMED_RESPONSE'
      });
    }

    const content = message['content'];
    if (typeof content !== 'string') {
      throw new AIProviderError('Hugging Face response content is missing or not a string', {
        provider: 'huggingface',
        reason: 'MALFORMED_RESPONSE'
      });
    }

    const usage = record['usage'] as Record<string, unknown> | undefined;
    const inputTokens = typeof usage?.['prompt_tokens'] === 'number' ? usage['prompt_tokens'] : null;
    const outputTokens = typeof usage?.['completion_tokens'] === 'number' ? usage['completion_tokens'] : null;

    const durationMs = Math.round(performance.now() - startTime);
    this.logger.debug('Hugging Face completion completed', {
      provider: 'huggingface',
      model: this.model,
      inputTokens,
      outputTokens,
      durationMs
    });

    return {
      text: content,
      model: this.model,
      provider: 'huggingface',
      inputTokens,
      outputTokens
    };
  }
}
