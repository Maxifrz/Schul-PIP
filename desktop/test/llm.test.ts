import { describe, expect, it } from 'vitest';
import { LlmError, ask, checkEndpoint, fetchModels, modelListUrl, modelNote, parseModels, searchModels } from '../src/lib/llm';

const reply = (status: number, text: string) => async () => new Response(text, { status });

describe('custom endpoint (same cases as the Swift tests)', () => {
  const url = (text: string) => {
    const check = checkEndpoint(text);
    return check.kind === 'valid' ? check.url : null;
  };
  it('leads to the chat completions address', () => {
    expect(url('https://mein-server.de/v1')).toBe('https://mein-server.de/v1/chat/completions');
    expect(url('https://mein-server.de/v1/')).toBe('https://mein-server.de/v1/chat/completions');
    expect(url('https://mein-server.de')).toBe('https://mein-server.de/v1/chat/completions');
    expect(url('https://mein-server.de/api/openai')).toBe('https://mein-server.de/api/openai/chat/completions');
    expect(url('https://mein-server.de/v1/chat/completions')).toBe('https://mein-server.de/v1/chat/completions');
  });
  it('allows plain http only in the local network', () => {
    expect(url('http://192.168.1.20:11434/v1')).not.toBeNull();
    expect(url('http://localhost:1234/v1')).not.toBeNull();
    expect(checkEndpoint('http://example.com/v1').kind).toBe('insecureRemote');
    expect(checkEndpoint('http://172.32.0.1/v1').kind).toBe('insecureRemote');
    expect(checkEndpoint('ftp://example.com').kind).toBe('invalid');
    expect(checkEndpoint('').kind).toBe('empty');
  });
});

describe('asking', () => {
  it('reads an OpenAI-style answer and sends the key', async () => {
    let seen: { url: string; headers: Record<string, string>; body: string } | null = null;
    const text = await ask(
      { provider: 'openRouter', apiKey: 'k', model: 'm', system: 's', user: 'u' },
      async (url, init) => {
        seen = { url, headers: init?.headers ?? {}, body: String(init?.body) };
        return new Response('{"choices":[{"message":{"content":" Hallo "}}]}');
      },
    );
    expect(text).toBe('Hallo');
    expect(seen!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(seen!.headers.authorization).toBe('Bearer k');
    expect(JSON.parse(seen!.body).messages[0]).toEqual({ role: 'system', content: 's' });
  });

  it('talks to Claude with its own headers', async () => {
    let headers: Record<string, string> = {};
    const text = await ask({ provider: 'anthropic', apiKey: 'sk-ant', model: 'claude-sonnet-5', system: 's', user: 'u' }, async (_url, init) => {
      headers = init?.headers ?? {};
      return new Response('{"content":[{"type":"text","text":"Antwort"}]}');
    });
    expect(text).toBe('Antwort');
    expect(headers['x-api-key']).toBe('sk-ant');
  });

  it('needs no key for the own API and explains problems', async () => {
    await expect(ask({ provider: 'custom', apiKey: '', model: 'llama', endpoint: 'http://localhost:1234/v1/chat/completions', system: 's', user: 'u' }, reply(200, '{"choices":[{"message":{"content":"ok"}}]}'))).resolves.toBe('ok');
    await expect(ask({ provider: 'nvidia', apiKey: '', model: 'm', system: 's', user: 'u' }, reply(200, '{}'))).rejects.toBeInstanceOf(LlmError);
    await expect(ask({ provider: 'nvidia', apiKey: 'k', model: 'm', system: 's', user: 'u' }, reply(401, '{}'))).rejects.toThrow('abgelehnt');
    await expect(ask({ provider: 'nvidia', apiKey: 'k', model: '', system: 's', user: 'u' }, reply(200, '{}'))).rejects.toThrow('kein Modell');
  });
});

describe('model list (same cases as the Swift tests)', () => {
  it('keeps price and picture support from OpenRouter', () => {
    const models = parseModels(`{"data":[
      {"id":"google/gemma-4-31b-it:free","name":"Google: Gemma 4 31B (free)","context_length":131072,"pricing":{"prompt":"0","completion":"0"},"architecture":{"input_modalities":["text","image"]}},
      {"id":"deepseek/deepseek-v4","name":"DeepSeek V4","context_length":64000,"pricing":{"prompt":"0.0000003","completion":"0.000001"},"architecture":{"input_modalities":["text"]}}]}`);
    expect(models.map((m) => m.id)).toEqual(['google/gemma-4-31b-it:free', 'deepseek/deepseek-v4']);
    expect(models[0]).toMatchObject({ free: true, vision: true });
    expect(modelNote(models[0])).toBe('Gratis · Bilder · 131k Kontext');
    expect(models[1]).toMatchObject({ free: false, vision: false });
  });

  it('reads Claude and Gemini lists', () => {
    expect(parseModels('{"data":[{"type":"model","id":"claude-sonnet-5","display_name":"Claude Sonnet 5"}]}')[0]).toMatchObject({ name: 'Claude Sonnet 5', vision: true });
    const gemini = parseModels('{"models":[{"name":"models/gemini-3.8-flash","displayName":"Gemini 3.8 Flash","inputTokenLimit":1048576}]}')[0];
    expect(gemini).toMatchObject({ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', contextLength: 1048576 });
  });

  it('drops models that cannot chat and duplicates', () => {
    const models = parseModels('{"data":[{"id":"nvidia/nv-embedqa-e5-v5"},{"id":"openai/whisper-large"},{"id":"meta/llama-3.1-70b-instruct"},{"id":"meta/llama-3.1-70b-instruct"}]}');
    expect(models.map((m) => m.id)).toEqual(['meta/llama-3.1-70b-instruct']);
    expect(models[0].vision).toBeNull();
    expect(parseModels('kein json')).toEqual([]);
  });

  it('searches with every word and ranks prefixes first', () => {
    const all = parseModels('{"data":[{"id":"qwen/qwen3.8-27b"},{"id":"google/gemma-4-31b-it"},{"id":"meta/llama-4-maverick"},{"id":"llama-4"}]}');
    expect(searchModels(all, 'llama 4').map((m) => m.id)).toEqual(['llama-4', 'meta/llama-4-maverick']);
    expect(searchModels(all, '  QWEN ').map((m) => m.id)).toEqual(['qwen/qwen3.8-27b']);
    expect(searchModels(all, '')).toHaveLength(4);
    expect(searchModels(all, 'gpt')).toHaveLength(0);
  });

  it('knows where each list lives and fails early without a key', async () => {
    expect(modelListUrl('nvidia')).toBe('https://integrate.api.nvidia.com/v1/models');
    expect(modelListUrl('custom', 'https://router.huggingface.co/v1/chat/completions')).toBe('https://router.huggingface.co/v1/models');
    expect(modelListUrl('custom')).toBeNull();
    await expect(fetchModels('nvidia', '', undefined, reply(200, '{}'))).rejects.toThrow('API-Key');
    await expect(fetchModels('custom', '', undefined, reply(200, '{}'))).rejects.toThrow('Adresse');
  });
});
