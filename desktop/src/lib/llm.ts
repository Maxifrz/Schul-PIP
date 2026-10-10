// AI providers and the model list: a port of LLMProvider.swift, OpenAICompatibleClient.swift, ClaudeClient.swift and
// ModelCatalog.swift, reduced to what the desktop app needs (a text question and an answer).

import { isLocalHost } from './social/format';
import type { DoFetch } from './social/api';

export const providers = ['nvidia', 'openRouter', 'google', 'anthropic', 'custom'] as const;
export type Provider = (typeof providers)[number];

export const providerName: Record<Provider, string> = {
  nvidia: 'NVIDIA NIM', openRouter: 'OpenRouter', google: 'Gemini', anthropic: 'Claude API', custom: 'Eigene API',
};

export const keyPlaceholder: Record<Provider, string> = {
  nvidia: 'nvapi-…', openRouter: 'sk-or-…', google: 'AIza…', anthropic: 'sk-ant-…', custom: 'Key (falls der Server einen verlangt)',
};

export const keyPortal: Record<Provider, string | null> = {
  nvidia: 'https://build.nvidia.com', openRouter: 'https://openrouter.ai', google: 'https://aistudio.google.com/apikey',
  anthropic: 'https://console.anthropic.com', custom: null,
};

export const chatCompletionsUrl: Record<Provider, string | null> = {
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  openRouter: 'https://openrouter.ai/api/v1/chat/completions',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  anthropic: null,
  custom: null,
};

export interface ModelOption {
  id: string;
  name: string;
  note: string;
}

export const curatedModels: Record<Provider, ModelOption[]> = {
  nvidia: [
    { id: 'moonshotai/kimi-k3', name: 'Kimi K3', note: 'Stark, versteht Bilder' },
    { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B', note: 'Schnell, versteht Bilder' },
    { id: 'z-ai/glm-5.3-flash', name: 'GLM 5.3 Flash', note: 'Schnell, versteht Bilder' },
    { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super', note: 'Nur Text' },
  ],
  openRouter: [
    { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', note: 'Gratis, versteht Bilder' },
    { id: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B', note: 'Gratis, versteht Bilder' },
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super', note: 'Gratis, nur Text, großer Kontext' },
    { id: 'openrouter/free', name: 'Automatisch', note: 'Gratis, wechselndes Modell' },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', note: 'Kostenpflichtig, braucht Guthaben' },
  ],
  google: [
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', note: 'Stark, Gratis-Kontingent' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', note: 'Am schnellsten' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', note: 'Beste Qualität, Vorschau, oft kostenpflichtig' },
  ],
  anthropic: [
    { id: 'claude-opus-5', name: 'Claude Opus 5', note: 'Beste Erklärungen' },
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', note: 'Schneller, günstiger' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', note: 'Am günstigsten' },
  ],
  custom: [],
};

export interface ModelSelection {
  provider: Provider;
  model: string;
}

export function defaultSelection(provider: Provider): ModelSelection {
  return { provider, model: curatedModels[provider][0]?.id ?? '' };
}

// The student's own OpenAI-compatible API

export type EndpointCheck = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'insecureRemote' } | { kind: 'valid'; url: string };

/** "https://host/v1", "https://host" and the full ".../chat/completions" all lead to the chat completions endpoint. */
export function checkEndpoint(text: string): EndpointCheck {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'invalid' };
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '') return { kind: 'invalid' };
  let path = url.pathname.replace(/\/+$/, '');
  if (path.toLowerCase().endsWith('/chat/completions')) {
    // already complete
  } else if (path === '') {
    path = '/v1/chat/completions';
  } else {
    path += '/chat/completions';
  }
  if (url.protocol === 'http:' && !isLocalHost(url.hostname)) return { kind: 'insecureRemote' };
  return { kind: 'valid', url: `${url.protocol}//${url.host}${path}` };
}

export function endpointMessage(check: EndpointCheck): string | null {
  switch (check.kind) {
    case 'empty': return 'Trag die Adresse der API ein, z. B. https://mein-server.de/v1.';
    case 'invalid': return 'Das ist keine gültige Adresse. Sie beginnt mit https:// (oder http:// im lokalen Netz).';
    case 'insecureRemote': return 'http:// funktioniert nur im lokalen Netz. Nimm für andere Server https://.';
    default: return null;
  }
}

// Asking

export interface AskInput {
  provider: Provider;
  apiKey: string;
  model: string;
  /** The custom API's chat completions address. */
  endpoint?: string;
  system: string;
  user: string;
  maxTokens?: number;
}

export class LlmError extends Error {}

export async function ask(input: AskInput, doFetch: DoFetch): Promise<string> {
  if (input.model.trim() === '') throw new LlmError('Es ist kein Modell eingetragen. Wähl in den Einstellungen ein Modell aus.');
  if (input.provider === 'anthropic') return askClaude(input, doFetch);
  const url = input.provider === 'custom' ? input.endpoint : chatCompletionsUrl[input.provider];
  if (!url) throw new LlmError('Für die eigene API fehlt eine gültige Adresse. Trag sie in den Einstellungen ein.');
  if (input.provider !== 'custom' && input.apiKey === '') throw new LlmError(`Für ${providerName[input.provider]} ist noch kein API-Key hinterlegt.`);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (input.apiKey !== '') headers.authorization = `Bearer ${input.apiKey}`;
  if (input.provider === 'openRouter') headers['X-Title'] = 'Schul-PIP';
  const body = JSON.stringify({
    model: input.model,
    max_tokens: input.maxTokens ?? 1200,
    messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.user }],
  });
  const response = await post(url, headers, body, doFetch);
  const object = JSON.parse(response) as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = object.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') throw new LlmError('Die Antwort der KI konnte nicht gelesen werden. Versuch es noch einmal oder wähl ein anderes Modell.');
  return content.trim();
}

async function askClaude(input: AskInput, doFetch: DoFetch): Promise<string> {
  if (input.apiKey === '') throw new LlmError('Für Claude API ist noch kein API-Key hinterlegt.');
  const body = JSON.stringify({
    model: input.model,
    max_tokens: input.maxTokens ?? 1200,
    system: input.system,
    messages: [{ role: 'user', content: input.user }],
  });
  const response = await post('https://api.anthropic.com/v1/messages', { 'content-type': 'application/json', 'x-api-key': input.apiKey, 'anthropic-version': '2023-06-01' }, body, doFetch);
  const object = JSON.parse(response) as { content?: Array<{ type?: string; text?: string }> };
  const text = (object.content ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('').trim();
  if (text === '') throw new LlmError('Die Antwort der KI konnte nicht gelesen werden. Versuch es noch einmal oder wähl ein anderes Modell.');
  return text;
}

async function post(url: string, headers: Record<string, string>, body: string, doFetch: DoFetch): Promise<string> {
  let response: Response;
  try {
    response = await doFetch(url, { method: 'POST', headers, body });
  } catch {
    throw new LlmError('Keine Verbindung zum Anbieter.');
  }
  const text = await response.text();
  if (response.status === 401 || response.status === 403) throw new LlmError('Der API-Key wurde abgelehnt. Prüf ihn in den Einstellungen.');
  if (response.status === 402) throw new LlmError('Der Anbieter verlangt Guthaben für diese Anfrage.');
  if (response.status === 429) throw new LlmError('Limit des Anbieters erreicht – warte kurz oder versuch es morgen wieder.');
  if (response.status < 200 || response.status >= 300) throw new LlmError(`Die KI-Anfrage ist fehlgeschlagen (${response.status}).`);
  return text;
}

// Model list

export interface RemoteModel {
  id: string;
  name: string;
  vision: boolean | null;
  free: boolean;
  contextLength: number | null;
}

export function modelNote(model: RemoteModel): string {
  const parts: string[] = [];
  if (model.free) parts.push('Gratis');
  if (model.vision === true) parts.push('Bilder');
  if (model.contextLength !== null && model.contextLength >= 1000) parts.push(`${Math.floor(model.contextLength / 1000)}k Kontext`);
  return parts.join(' · ');
}

export function modelListUrl(provider: Provider, endpoint?: string): string | null {
  switch (provider) {
    case 'nvidia': return 'https://integrate.api.nvidia.com/v1/models';
    case 'openRouter': return 'https://openrouter.ai/api/v1/models';
    case 'google': return 'https://generativelanguage.googleapis.com/v1beta/openai/models';
    case 'anthropic': return 'https://api.anthropic.com/v1/models?limit=1000';
    case 'custom': {
      if (!endpoint) return null;
      let text = endpoint;
      const suffix = '/chat/completions';
      if (text.toLowerCase().endsWith(suffix)) text = text.slice(0, -suffix.length);
      return text.replace(/\/+$/, '') + '/models';
    }
  }
}

/** OpenRouter lists its models without a key; every other provider wants one (a custom server may not). */
export const modelListNeedsKey = (provider: Provider) => provider !== 'openRouter' && provider !== 'custom';

const notChat = ['embed', 'rerank', 'whisper', 'tts', 'moderation', 'guard', 'reward', 'dall-e', 'transcribe'];
export const isChatModel = (id: string) => !notChat.some((word) => id.toLowerCase().includes(word));

const visionHints = [
  'vision', '-vl', 'vl-', 'llava', 'pixtral', 'gemini', 'gemma-3', 'gemma-4', 'gemma3', 'gemma4', 'claude', 'gpt-4o', 'gpt-4.1',
  'gpt-5', 'llama-3.2-11b', 'llama-3.2-90b', 'llama-4', 'kimi', 'glm-4v', 'omni',
];
export const guessVision = (id: string): boolean | null => (visionHints.some((hint) => id.toLowerCase().includes(hint)) ? true : null);

/** OpenAI, OpenRouter, NVIDIA and Anthropic answer {"data": [...]}, Gemini's own API {"models": [...]}. */
export function parseModels(text: string): RemoteModel[] {
  let object: Record<string, unknown>;
  try {
    object = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return [];
  }
  const items = (Array.isArray(object.data) ? object.data : Array.isArray(object.models) ? object.models : []) as Array<Record<string, unknown>>;
  const seen = new Set<string>();
  const result: RemoteModel[] = [];
  for (const item of items) {
    const raw = (typeof item.id === 'string' ? item.id : typeof item.name === 'string' ? item.name : '') as string;
    const id = raw.startsWith('models/') ? raw.slice('models/'.length) : raw;
    if (id === '' || !isChatModel(id) || seen.has(id)) continue;
    seen.add(id);
    const display = [item.display_name, item.displayName, typeof item.name === 'string' && !item.name.startsWith('models/') ? item.name : null].find((value) => typeof value === 'string' && value !== '');
    const architecture = item.architecture as { input_modalities?: unknown } | undefined;
    const vision = Array.isArray(architecture?.input_modalities) ? (architecture!.input_modalities as unknown[]).includes('image') : guessVision(id);
    const pricing = item.pricing as { prompt?: unknown; completion?: unknown } | undefined;
    const free = id.endsWith(':free') || (pricing?.prompt === '0' && pricing?.completion === '0');
    const context = typeof item.context_length === 'number' ? item.context_length : typeof item.inputTokenLimit === 'number' ? item.inputTokenLimit : null;
    result.push({ id, name: (display as string | undefined) ?? id, vision, free, contextLength: context });
  }
  return result;
}

/** Every word of the query has to be in the id or the name; the best matches come first. */
export function searchModels(models: RemoteModel[], query: string): RemoteModel[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return models;
  const whole = query.trim().toLowerCase();
  const matches = models.filter((m) => {
    const haystack = `${m.id} ${m.name}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
  const rank = (m: RemoteModel) => {
    const id = m.id.toLowerCase();
    const name = m.name.toLowerCase();
    if (id === whole || name === whole) return 0;
    if (id.startsWith(whole)) return 1;
    if (name.startsWith(whole)) return 2;
    return 3;
  };
  return [...matches].sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export async function fetchModels(provider: Provider, apiKey: string, endpoint: string | undefined, doFetch: DoFetch): Promise<RemoteModel[]> {
  if (modelListNeedsKey(provider) && apiKey === '') throw new LlmError('Für die Modellsuche braucht dieser Anbieter einen API-Key. Trag ihn unten ein.');
  const url = modelListUrl(provider, endpoint);
  if (!url) throw new LlmError('Trag zuerst die Adresse der eigenen API ein.');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (apiKey !== '') {
    headers.authorization = `Bearer ${apiKey}`;
  }
  let response: Response;
  try {
    response = await doFetch(url, { method: 'GET', headers });
  } catch {
    throw new LlmError('Keine Verbindung zum Anbieter.');
  }
  const text = await response.text();
  if (response.status === 401 || response.status === 403) throw new LlmError('Der Anbieter hat den Key abgelehnt.');
  if (response.status < 200 || response.status >= 300) throw new LlmError(`Der Anbieter hat die Modellliste verweigert (${response.status}).`);
  const models = parseModels(text);
  if (models.length === 0) throw new LlmError('Die Modellliste des Anbieters ließ sich nicht lesen. Tipp die Modell-ID selbst ein.');
  return models;
}
