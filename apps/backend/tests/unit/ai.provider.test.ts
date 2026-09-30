import { KeplerLogger } from '@kepler/shared';
import { GroqProvider } from '../../src/modules/ai/providers/groq.provider';
import { HuggingFaceProvider } from '../../src/modules/ai/providers/huggingface.provider';
import { AIProviderError, AITimeoutError } from '../../src/modules/ai/ai.errors';
import { AICompletionRequest } from '../../src/modules/ai/providers/provider.interface';

class TestLogger implements KeplerLogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public fatal(): void {}
}

describe('AI Providers', () => {
  const logger = new TestLogger();
  const originalFetch = globalThis.fetch;
  const sampleRequest: AICompletionRequest = {
    system: 'system prompt',
    user: 'user input',
    maxTokens: 512,
    temperature: 0.2
  };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  describe('GroqProvider', () => {
    it('sends the correct request shape', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = jest.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
        capturedUrl = String(input);
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'Groq response text' } }],
            usage: { prompt_tokens: 12, completion_tokens: 24 }
          })
        } as unknown as Response;
      });

      const provider = new GroqProvider('groq-key-123', 'llama-3.3-70b-versatile', 10000, logger);
      const result = await provider.complete(sampleRequest);

      expect(capturedUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(capturedInit?.method).toBe('POST');
      expect((capturedInit?.headers as Record<string, string>)?.['Authorization']).toBe('Bearer groq-key-123');
      expect((capturedInit?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json');

      const parsedBody = JSON.parse(String(capturedInit?.body));
      expect(parsedBody.model).toBe('llama-3.3-70b-versatile');
      expect(parsedBody.messages).toEqual([
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'user input' }
      ]);
      expect(parsedBody.max_tokens).toBe(512);
      expect(parsedBody.temperature).toBe(0.2);
      expect(parsedBody.response_format).toEqual({ type: 'text' });

      expect(result.text).toBe('Groq response text');
      expect(result.provider).toBe('groq');
      expect(result.inputTokens).toBe(12);
      expect(result.outputTokens).toBe(24);
    });

    it('throws AITimeoutError on timeout using fake timers', async () => {
      jest.useFakeTimers();

      globalThis.fetch = jest.fn((_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      });

      const provider = new GroqProvider('groq-key', 'model', 1000, logger);
      const promise = provider.complete(sampleRequest);

      jest.advanceTimersByTime(1100);

      await expect(promise).rejects.toThrow(AITimeoutError);
    });

    it('throws AIProviderError with status 429 on rate limit', async () => {
      globalThis.fetch = jest.fn(async (): Promise<Response> => {
        return {
          ok: false,
          status: 429
        } as unknown as Response;
      });

      const provider = new GroqProvider('groq-key', 'model', 10000, logger);
      let caughtError: unknown;
      try {
        await provider.complete(sampleRequest);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AIProviderError);
      const aiErr = caughtError as AIProviderError;
      expect(aiErr.context['status']).toBe(429);
      expect(aiErr.context['reason']).toBe('RATE_LIMITED');
      expect(aiErr.context['provider']).toBe('groq');
    });

    it('throws AIProviderError with reason MALFORMED_RESPONSE on invalid JSON', async () => {
      globalThis.fetch = jest.fn(async (): Promise<Response> => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          }
        } as unknown as Response;
      });

      const provider = new GroqProvider('groq-key', 'model', 10000, logger);
      let caughtError: unknown;
      try {
        await provider.complete(sampleRequest);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AIProviderError);
      const aiErr = caughtError as AIProviderError;
      expect(aiErr.context['reason']).toBe('MALFORMED_RESPONSE');
      expect(aiErr.context['provider']).toBe('groq');
    });
  });

  describe('HuggingFaceProvider', () => {
    it('sends the correct request shape', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = jest.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
        capturedUrl = String(input);
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'HF response text' } }],
            usage: { prompt_tokens: 18, completion_tokens: 36 }
          })
        } as unknown as Response;
      });

      const provider = new HuggingFaceProvider('hf-key-123', 'meta-llama/Llama-3.1-8B-Instruct', 10000, logger);
      const result = await provider.complete(sampleRequest);

      expect(capturedUrl).toBe('https://router.huggingface.co/v1/chat/completions');
      expect(capturedInit?.method).toBe('POST');
      expect((capturedInit?.headers as Record<string, string>)?.['Authorization']).toBe('Bearer hf-key-123');

      const parsedBody = JSON.parse(String(capturedInit?.body));
      expect(parsedBody.model).toBe('meta-llama/Llama-3.1-8B-Instruct');
      expect(parsedBody.messages).toEqual([
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'user input' }
      ]);

      expect(result.text).toBe('HF response text');
      expect(result.provider).toBe('huggingface');
      expect(result.inputTokens).toBe(18);
      expect(result.outputTokens).toBe(36);
    });

    it('throws AITimeoutError on timeout using fake timers', async () => {
      jest.useFakeTimers();

      globalThis.fetch = jest.fn((_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      });

      const provider = new HuggingFaceProvider('hf-key', 'model', 1000, logger);
      const promise = provider.complete(sampleRequest);

      jest.advanceTimersByTime(1100);

      await expect(promise).rejects.toThrow(AITimeoutError);
    });

    it('throws AIProviderError with status 429 on rate limit', async () => {
      globalThis.fetch = jest.fn(async (): Promise<Response> => {
        return {
          ok: false,
          status: 429
        } as unknown as Response;
      });

      const provider = new HuggingFaceProvider('hf-key', 'model', 10000, logger);
      let caughtError: unknown;
      try {
        await provider.complete(sampleRequest);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AIProviderError);
      const aiErr = caughtError as AIProviderError;
      expect(aiErr.context['status']).toBe(429);
      expect(aiErr.context['reason']).toBe('RATE_LIMITED');
      expect(aiErr.context['provider']).toBe('huggingface');
    });

    it('throws AIProviderError with reason MALFORMED_RESPONSE on invalid JSON', async () => {
      globalThis.fetch = jest.fn(async (): Promise<Response> => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          }
        } as unknown as Response;
      });

      const provider = new HuggingFaceProvider('hf-key', 'model', 10000, logger);
      let caughtError: unknown;
      try {
        await provider.complete(sampleRequest);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AIProviderError);
      const aiErr = caughtError as AIProviderError;
      expect(aiErr.context['reason']).toBe('MALFORMED_RESPONSE');
      expect(aiErr.context['provider']).toBe('huggingface');
    });
  });
});
