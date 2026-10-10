import { Provider, ModelSelection, defaultSelection, providers } from '../lib/llm';
import { Card } from '../lib/review';
import { blobs, secrets } from '../lib/platform';
import { createStore, persist } from './createStore';

export type Tab = 'today' | 'library' | 'review' | 'courses' | 'calculator' | 'settings';

export const ui = createStore({ tab: 'today' as Tab, message: null as string | null });

/** A short message at the top of the window (errors and confirmations alike). */
export function say(message: string | null): void {
  ui.set({ message });
}

export function fail(error: unknown): void {
  say(error instanceof Error ? error.message : String(error));
}

// Flashcards

export const cardStore = createStore({ list: [] as Card[], repeatWrong: false });

export function updateCard(card: Card): void {
  cardStore.set((s) => ({ ...s, list: s.list.map((c) => (c.id === card.id ? card : c)) }));
}

export function addCards(cards: Card[]): void {
  cardStore.set((s) => ({ ...s, list: [...s.list, ...cards] }));
}

export function removeCard(id: string): void {
  cardStore.set((s) => ({ ...s, list: s.list.filter((c) => c.id !== id) }));
}

// Library

export interface Material {
  id: string;
  title: string;
  fileName: string;
  createdAt: number;
  lastPage: number;
  lastOpenedAt: number | null;
}

export const libraryStore = createStore({ items: [] as Material[] });

export async function importMaterial(name: string, data: Uint8Array): Promise<Material> {
  const id = crypto.randomUUID();
  await blobs.put(id, data);
  const material: Material = {
    id, title: name.replace(/\.[^.]+$/, ''), fileName: name, createdAt: Date.now(), lastPage: 1, lastOpenedAt: null,
  };
  libraryStore.set((s) => ({ items: [material, ...s.items] }));
  return material;
}

export function updateMaterial(id: string, patch: Partial<Material>): void {
  libraryStore.set((s) => ({ items: s.items.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
}

export async function deleteMaterial(id: string): Promise<void> {
  await blobs.delete(id);
  libraryStore.set((s) => ({ items: s.items.filter((m) => m.id !== id) }));
}

// Settings: the model, the address of the own API. The keys live in the secret store, not here.

export const settingsStore = createStore({
  selection: defaultSelection('openRouter') as ModelSelection,
  customUrl: '',
  providersWithKey: [] as Provider[],
});

export const keyAccount = (provider: Provider) => `llm.${provider}`;

export async function loadKeys(): Promise<void> {
  const found: Provider[] = [];
  for (const provider of providers) if (await secrets.get(keyAccount(provider))) found.push(provider);
  settingsStore.set({ providersWithKey: found });
}

export async function saveKey(provider: Provider, key: string): Promise<boolean> {
  const ok = await secrets.set(keyAccount(provider), key.trim());
  if (ok) await loadKeys();
  return ok;
}

export async function deleteKey(provider: Provider): Promise<void> {
  await secrets.delete(keyAccount(provider));
  await loadKeys();
}

let started = false;

export async function startStores(): Promise<void> {
  if (started) return;
  started = true;
  await Promise.all([
    persist(cardStore, 'cards', (s) => ({ list: s.list, repeatWrong: s.repeatWrong }), (stored, s) => {
      const data = stored as { list?: Card[]; repeatWrong?: boolean };
      return { ...s, list: data.list ?? [], repeatWrong: data.repeatWrong ?? false };
    }),
    persist(libraryStore, 'library', (s) => ({ items: s.items }), (stored, s) => ({ ...s, items: (stored as { items?: Material[] }).items ?? [] })),
    persist(settingsStore, 'settings', (s) => ({ selection: s.selection, customUrl: s.customUrl }), (stored, s) => {
      const data = stored as { selection?: ModelSelection; customUrl?: string };
      return { ...s, selection: data.selection ?? s.selection, customUrl: data.customUrl ?? '' };
    }),
  ]);
  await loadKeys();
}
