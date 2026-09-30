# AI Explanation Layer

## Purpose and Non-Goals

### Purpose

The AI Explanation Layer provides user-facing natural language explanations for non-technical users. It operates strictly downstream of Kepler's core analytical engines and serves three purposes:

1. Explaining taint graphs and potential linkage risks in plain language.
2. Summarizing verifiable evidence bundles and verification steps.
3. Suggesting alternative payment routes based on privacy and fee tradeoffs.

### Non-Goals (What the AI Does Not Do)

The AI layer is strictly decoupled from decision-making and verification:

- Core Logic Exclusion: The AI layer never computes taint scores, never discovers graph paths, never executes rule matching, never signs or constructs transactions, and never executes policy checks.
- Verification Independence: The proof layer never calls the AI layer. Evidence bundles and cryptographic claims are verified deterministically without AI involvement. The AI summarizes existing claims; it never validates them.
- Deterministic Routing: The routing engine and policy engine never consult the AI layer to select routes. The AI only explains routes or suggests alternatives to the human user for evaluation.
- No Autonomous Action: The AI layer cannot initiate transactions, modify wallet state, or publish Nostr events.

## The Three Endpoints

The AI module exposes three HTTP POST endpoints mounted under `/api/ai`:

### 1. POST /api/ai/explain

Generates a natural language explanation of an existing taint graph scenario.

- Path: `/api/ai/explain`
- Rate Limit: `read` tier (default 60 requests per minute).
- Input:
  ```json
  {
    "scenarioId": "scenario-uuid"
  }
  ```
- Output (200 OK):
  ```json
  {
    "text": "Plain language explanation of connections and privacy risks.",
    "model": "openai/gpt-oss-20b",
    "provider": "groq",
    "cached": false
  }
  ```
- Error Codes:
  - `400 Bad Request` (`VALIDATION_ERROR`): Missing or invalid `scenarioId`.
  - `404 Not Found` (`AI_NOT_FOUND`): Scenario or taint graph not found for the given `scenarioId`.
  - `502 Bad Gateway` (`AI_PROVIDER_ERROR`): Upstream provider error or malformed response.
  - `503 Service Unavailable` (`AI_NO_PROVIDER`): No AI providers configured or all providers failed.
  - `504 Gateway Timeout` (`AI_TIMEOUT_ERROR`): Provider request timed out.

### 2. POST /api/ai/summarize

Summarizes a verifiable evidence bundle by its bundle hash.

- Path: `/api/ai/summarize`
- Rate Limit: `read` tier (default 60 requests per minute).
- Input:
  ```json
  {
    "bundleHash": "3b5a11d08e1a1234567890abcdef3b5a11d08e1a1234567890abcdef1234"
  }
  ```
- Output (200 OK):
  ```json
  {
    "text": "Plain language summary of the claim, data sources, and verification status.",
    "model": "openai/gpt-oss-20b",
    "provider": "groq",
    "cached": false
  }
  ```
- Error Codes:
  - `400 Bad Request` (`VALIDATION_ERROR`): Missing or invalid `bundleHash`.
  - `404 Not Found` (`AI_NOT_FOUND`): Evidence bundle not found for the given hash.
  - `502 Bad Gateway` (`AI_PROVIDER_ERROR`): Upstream provider error.
  - `503 Service Unavailable` (`AI_NO_PROVIDER`): All providers failed.
  - `504 Gateway Timeout` (`AI_TIMEOUT_ERROR`): Upstream timeout.

### 3. POST /api/ai/suggest

Recommends route options and explains fee and privacy tradeoffs.

- Path: `/api/ai/suggest`
- Rate Limit: `propose` tier (default 30 requests per minute).
- Input:
  ```json
  {
    "paymentTargetKind": "Lightning",
    "paymentTargetTruncated": "lnbc100u1p3x0d47pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgq",
    "candidateRoutes": [
      {
        "name": "Direct Channel",
        "protocol": "Lightning",
        "estimatedFeeSats": 25,
        "estimatedLinkageConfidence": 0.1
      }
    ],
    "constraints": {
      "maxFeeSats": 100,
      "requireNonCustodial": true
    }
  }
  ```
- Output (200 OK):
  ```json
  {
    "text": "Analysis explaining route tradeoffs and recommendations.",
    "model": "openai/gpt-oss-20b",
    "provider": "groq",
    "cached": false
  }
  ```
- Error Codes:
  - `400 Bad Request` (`VALIDATION_ERROR` or `AI_INPUT_TOO_LARGE`): Malformed schema or prompt length exceeds `maxInputChars`.
  - `502 Bad Gateway` (`AI_PROVIDER_ERROR`): Upstream provider failure.
  - `503 Service Unavailable` (`AI_NO_PROVIDER`): All providers failed.
  - `504 Gateway Timeout` (`AI_TIMEOUT_ERROR`): Request timed out.

## Provider Fallback Order

Kepler supports multiple AI providers managed by `AIProviderRegistry`:

1. Primary Provider: Groq (`GroqProvider`)
   - Default model: `llama-3.3-70b-versatile` (configurable via `GROQ_MODEL`).
   - Endpoint: `https://api.groq.com/openai/v1/chat/completions`.
2. Fallback Provider: Hugging Face (`HuggingFaceProvider`)
   - Default model: `meta-llama/Llama-3.1-8B-Instruct` (configurable via `HUGGINGFACE_MODEL`).
   - Endpoint: `https://router.huggingface.co/v1/chat/completions`.

### Fallback Execution Rules

- Priority Resolution: Providers are registered in order of priority. Groq is evaluated first when configured; Hugging Face is evaluated as the fallback.
- Maximum One Retry: There is at most one retry per request, directed to the fallback provider. Retrying against the same failed provider is prohibited.
- Explicit Failure: If all registered providers fail, `AIService` throws `AINoProviderError` containing the list of attempted providers and underlying failure reasons. It never emits synthetic, placeholder, or mocked completions.

## Caching Strategy

All AI responses are cached in memory using `AICache`:

- Deterministic Key Derivation: Keys are computed via SHA-256 over `endpoint + ":" + CanonicalJson.stringify(payload)`. Identical requests produce identical cache keys regardless of JSON key ordering.
- TTL Expiration: The cache respects `cacheTtlSeconds` (configured via `AI_CACHE_TTL_MS`, defaulting to 3,600,000 ms / 1 hour).
- Entry Limits and Eviction: The cache retains up to `AI_CACHE_MAX_ENTRIES` (default 500). When the threshold is reached upon insertion, the oldest entry by insertion order is evicted (FIFO).
- Passive Lifecycle: Eviction and expiry occur on read and write operations. No background timers or `setInterval` handles are retained.
- Storage: In-memory Map only. No Redis or disk persistence is used.

## Privacy Rules: What Data is Never Sent to the AI

Prompt generation in `AIPrompt` strictly enforces data redaction and sanitization:

1. Preimages: Lightning payment preimages are never sent to the AI under any circumstances. When building graph prompts, preimage node values are redacted to `[REDACTED]`.
2. Private Keys and Secrets: Nostr private keys, seed phrases, and NWC connection secrets are strictly excluded from all prompts.
3. Full Hashes: Transaction IDs, payment hashes, and block hashes are truncated to `<first 8>...<last 8>` (e.g. `3b5a11d0...12345678`).
4. Full Invoices: Lightning BOLT-11 invoices are truncated to `<first 12>...<last 4>`.
5. Balances and High Amounts: Any amount exceeding 100,000 satoshis is replaced with `<large amount>`. Small amounts under 100,000 satoshis are permitted because they do not uniquely identify user wealth.
6. Graph Bounds: Explanations include at most the top 5 highest-confidence edges and top 5 highest-confidence paths.
7. Payload Length: Prompts exceeding `AI_MAX_INPUT_CHARS` (default 8,000 characters) are rejected before provider dispatch.

## How to Add a New Provider

To add a new AI provider to Kepler, follow these steps:

### 1. Implement `AIProvider`

Create a new provider class in `apps/backend/src/modules/ai/providers/<provider-name>.provider.ts` implementing `AIProvider`:

```typescript
export class NewProvider implements AIProvider {
  public readonly name: string = 'new-provider';
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
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const startTime = performance.now();

    try {
      const response = await fetch('https://api.example.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user }
          ],
          max_tokens: request.maxTokens,
          temperature: request.temperature
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new AIProviderError(`Provider failed with status ${response.status}`, {
          provider: this.name,
          status: response.status
        });
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const durationMs = Math.round(performance.now() - startTime);
      this.logger.debug('Provider completion completed', {
        provider: this.name,
        model: this.model,
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
        durationMs
      });

      return {
        text: data.choices[0].message.content,
        model: this.model,
        provider: this.name,
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

### 2. Update `AIConfig`

In `apps/backend/src/modules/ai/ai.types.ts`:
- Add the environment variables to the Zod schema (`NEW_PROVIDER_API_KEY`, `NEW_PROVIDER_MODEL`).
- Add getter methods (`hasNewProvider`, `newProviderApiKey`, `newProviderModel`).

### 3. Register in `AIProviderRegistry`

In `apps/backend/src/modules/ai/providers/registry.ts`:
- Update `createDefault` to instantiate `NewProvider` and append it to the `providers` list according to the desired fallback priority.

### 4. Add Tests

- Create unit tests in `apps/backend/tests/unit/` testing request formation, timeout handling, error mapping, and token logging.
