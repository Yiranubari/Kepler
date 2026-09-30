import { z } from 'zod';
import { ConfigurationError } from '@kepler/shared';
import { AINoProviderError } from './ai.errors';

export interface AIConfigParams {
  readonly groqApiKey?: string;
  readonly groqModel?: string;
  readonly huggingfaceApiKey?: string;
  readonly hfModel?: string;
  readonly timeoutMs?: number;
  readonly cacheTtlSeconds?: number;
  readonly maxInputChars?: number;
}

export interface AIResponse {
  readonly text: string;
  readonly model: string;
  readonly provider: string;
  readonly cached: boolean;
}

const positiveIntegerEnvSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (val === undefined) return true;
      const trimmed = val.trim();
      if (trimmed.length === 0) return false;
      if (!/^\d+$/.test(trimmed)) return false;
      const num = Number(trimmed);
      return Number.isSafeInteger(num) && num > 0;
    },
    { message: 'Must be a positive integer' }
  )
  .transform((val) => {
    if (val === undefined) return undefined;
    return Number(val.trim());
  });

const aiEnvSchema = z.object({
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  HF_MODEL: z.string().optional(),
  AI_TIMEOUT_MS: positiveIntegerEnvSchema,
  AI_CACHE_TTL_SECONDS: positiveIntegerEnvSchema,
  AI_MAX_INPUT_CHARS: positiveIntegerEnvSchema
});

export class AIConfig {
  private static readonly DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
  private static readonly DEFAULT_HF_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';
  private static readonly DEFAULT_TIMEOUT_MS = 20000;
  private static readonly DEFAULT_CACHE_TTL_SECONDS = 900;
  private static readonly DEFAULT_MAX_INPUT_CHARS = 12000;

  private readonly _groqApiKey?: string;
  private readonly _groqModel: string;
  private readonly _huggingfaceApiKey?: string;
  private readonly _hfModel: string;
  private readonly _timeoutMs: number;
  private readonly _cacheTtlSeconds: number;
  private readonly _maxInputChars: number;

  constructor(params: AIConfigParams) {
    const groqKey = params.groqApiKey?.trim();
    this._groqApiKey = groqKey && groqKey.length > 0 ? groqKey : undefined;

    const hfKey = params.huggingfaceApiKey?.trim();
    this._huggingfaceApiKey = hfKey && hfKey.length > 0 ? hfKey : undefined;

    if (!this._groqApiKey && !this._huggingfaceApiKey) {
      throw new AINoProviderError('At least one AI provider must be configured', {
        attempted: ['groq', 'huggingface']
      });
    }

    const groqModel = params.groqModel?.trim();
    this._groqModel = groqModel && groqModel.length > 0 ? groqModel : AIConfig.DEFAULT_GROQ_MODEL;

    const hfModel = params.hfModel?.trim();
    this._hfModel = hfModel && hfModel.length > 0 ? hfModel : AIConfig.DEFAULT_HF_MODEL;

    const timeoutMs = params.timeoutMs ?? AIConfig.DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new ConfigurationError('Invalid timeoutMs: must be a positive integer', {
        field: 'timeoutMs',
        value: timeoutMs
      });
    }
    this._timeoutMs = timeoutMs;

    const cacheTtlSeconds = params.cacheTtlSeconds ?? AIConfig.DEFAULT_CACHE_TTL_SECONDS;
    if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds <= 0) {
      throw new ConfigurationError('Invalid cacheTtlSeconds: must be a positive integer', {
        field: 'cacheTtlSeconds',
        value: cacheTtlSeconds
      });
    }
    this._cacheTtlSeconds = cacheTtlSeconds;

    const maxInputChars = params.maxInputChars ?? AIConfig.DEFAULT_MAX_INPUT_CHARS;
    if (!Number.isInteger(maxInputChars) || maxInputChars <= 0) {
      throw new ConfigurationError('Invalid maxInputChars: must be a positive integer', {
        field: 'maxInputChars',
        value: maxInputChars
      });
    }
    this._maxInputChars = maxInputChars;

    Object.freeze(this);
  }

  public get groqApiKey(): string | undefined {
    return this._groqApiKey;
  }

  public get groqModel(): string {
    return this._groqModel;
  }

  public get huggingfaceApiKey(): string | undefined {
    return this._huggingfaceApiKey;
  }

  public get hfModel(): string {
    return this._hfModel;
  }

  public get timeoutMs(): number {
    return this._timeoutMs;
  }

  public get cacheTtlSeconds(): number {
    return this._cacheTtlSeconds;
  }

  public get maxInputChars(): number {
    return this._maxInputChars;
  }

  public get hasGroq(): boolean {
    return this._groqApiKey !== undefined;
  }

  public get hasHuggingFace(): boolean {
    return this._huggingfaceApiKey !== undefined;
  }

  public static fromEnv(env: Record<string, string | undefined> = process.env): AIConfig {
    const result = aiEnvSchema.safeParse(env);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue && issue.path.length > 0 ? String(issue.path[0]) : 'unknown';
      const reason = issue ? issue.message : 'Invalid environment variable value';
      throw new ConfigurationError(`Invalid ${field} configuration: ${reason}`, {
        field,
        reason
      });
    }

    const groqApiKey = result.data.GROQ_API_KEY?.trim() || undefined;
    const hfApiKey = result.data.HUGGINGFACE_API_KEY?.trim() || undefined;

    if (!groqApiKey && !hfApiKey) {
      throw new AINoProviderError('At least one AI provider must be configured', {
        attempted: ['groq', 'huggingface']
      });
    }

    return new AIConfig({
      groqApiKey,
      groqModel: result.data.GROQ_MODEL?.trim() || undefined,
      huggingfaceApiKey: hfApiKey,
      hfModel: result.data.HF_MODEL?.trim() || undefined,
      timeoutMs: result.data.AI_TIMEOUT_MS,
      cacheTtlSeconds: result.data.AI_CACHE_TTL_SECONDS,
      maxInputChars: result.data.AI_MAX_INPUT_CHARS
    });
  }
}
