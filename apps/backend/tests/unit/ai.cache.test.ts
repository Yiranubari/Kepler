import { AICache } from '../../src/modules/ai/ai.cache';
import { AICompletionResponse } from '../../src/modules/ai/providers/provider.interface';

describe('AICache', () => {
  const createSampleResponse = (text = 'test output'): AICompletionResponse => ({
    text,
    model: 'llama-3.3-70b-versatile',
    provider: 'groq',
    inputTokens: 15,
    outputTokens: 25
  });

  it('generates deterministic keys from request endpoint and payload', () => {
    const payload = { scenarioId: 'scenario-123', options: { depth: 3 } };
    const key1 = AICache.keyFromRequest('explain', payload);
    const key2 = AICache.keyFromRequest('explain', payload);
    expect(key1).toBe(key2);
  });

  it('distinguishes different endpoints with the same payload', () => {
    const payload = { id: 'item-123' };
    const keyExplain = AICache.keyFromRequest('explain', payload);
    const keySummarize = AICache.keyFromRequest('summarize', payload);
    expect(keyExplain).not.toBe(keySummarize);
  });

  it('stores and retrieves cached responses in a round trip', () => {
    const cache = new AICache(10000, 5);
    const response = createSampleResponse('cached text');
    cache.set('key-1', response);
    const retrieved = cache.get('key-1');
    expect(retrieved).toEqual(response);
  });

  it('returns null for expired entries', async () => {
    const cache = new AICache(20, 5);
    const response = createSampleResponse('short lived');
    cache.set('key-exp', response);
    await new Promise((resolve) => setTimeout(resolve, 35));
    const retrieved = cache.get('key-exp');
    expect(retrieved).toBeNull();
  });

  it('evicts the oldest entry by insertion order when maxEntries is exceeded', () => {
    const cache = new AICache(60000, 2);
    const resp1 = createSampleResponse('one');
    const resp2 = createSampleResponse('two');
    const resp3 = createSampleResponse('three');

    cache.set('key-1', resp1);
    cache.set('key-2', resp2);
    cache.set('key-3', resp3);

    expect(cache.get('key-1')).toBeNull();
    expect(cache.get('key-2')).toEqual(resp2);
    expect(cache.get('key-3')).toEqual(resp3);
  });
});
