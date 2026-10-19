import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Flashcard, FlashcardWriter, MaterialPath, flashcardPrompt, flashcardSystem, parseFlashcards } from '../lib/learn/materialPath';
import { checkEndpoint, ask } from '../lib/llm';
import { blobs, doFetch, secrets } from '../lib/platform';
import { newCard } from '../lib/review';
import { addCards, cardStore, keyAccount, libraryStore, settingsStore } from './app';
import { createStore } from './createStore';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** The text of every page of a material, for the cards. A page that is a scan has none. */
export async function pageTexts(materialID: string): Promise<string[]> {
  const data = await blobs.get(materialID);
  if (!data) return [];
  const document = await pdfjs.getDocument({ data: data.slice(), standardFontDataUrl: './pdfjs/standard_fonts/', cMapUrl: './pdfjs/cmaps/', cMapPacked: true }).promise;
  const texts: string[] = [];
  for (let n = 1; n <= document.numPages; n++) {
    const page = await document.getPage(n);
    const content = await page.getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim());
  }
  return texts;
}

export type GeneratorState = { type: 'idle' } | { type: 'running'; done: number; total: number } | { type: 'failed'; text: string } | { type: 'finished'; text: string };

/** Makes the cards of a material by asking the model, stretch by stretch, and puts them into the cards, so the material's lessons appear on the path. One material at a time. */
export const generator = createStore({ state: { type: 'idle' } as GeneratorState, busyID: null as string | null });

export const dismissGeneratorMessage = () => {
  if (generator.get().state.type !== 'running') generator.set({ state: { type: 'idle' } });
};

async function modelWriter(): Promise<FlashcardWriter> {
  const { selection, customUrl } = settingsStore.get();
  const apiKey = (await secrets.get(keyAccount(selection.provider))) ?? '';
  const endpoint = checkEndpoint(customUrl);
  return async (title, label, pages): Promise<Flashcard[]> => {
    const text = await ask({ provider: selection.provider, apiKey, model: selection.model, endpoint: endpoint.kind === 'valid' ? endpoint.url : undefined, system: flashcardSystem, user: flashcardPrompt(title, label, pages), maxTokens: 4000 }, doFetch);
    return parseFlashcards(text);
  };
}

export async function generateCards(materialID: string): Promise<void> {
  if (generator.get().busyID !== null) return;
  const material = libraryStore.get().items.find((m) => m.id === materialID);
  if (!material) return;
  generator.set({ busyID: materialID, state: { type: 'running', done: 0, total: 1 } });
  let texts: string[] = [];
  try {
    texts = await pageTexts(materialID);
  } catch {
    texts = [];
  }
  const mine = cardStore.get().list.filter((c) => c.materialID === materialID);
  const outcome = await MaterialPath.generate({
    title: material.title, pageTexts: texts, cardPages: new Set(mine.flatMap((c) => (c.page === undefined ? [] : [c.page]))), existingFronts: mine.map((c) => c.front),
    writer: await modelWriter(), progress: (done, total) => generator.set({ state: { type: 'running', done, total: Math.max(1, total) } }),
  });
  addCards(outcome.cards.map((c) => ({ ...newCard(c.front, c.back), materialID, page: c.page })));
  const count = outcome.cards.length;
  let state: GeneratorState;
  if (outcome.failure && count === 0) state = { type: 'failed', text: outcome.failure };
  else if (count === 0) state = { type: 'failed', text: texts.length === 0 || texts.every((t) => t === '') ? 'In diesem Material steckt kein lesbarer Text, es ist wohl ein Scan.' : 'Hier gibt es nichts Neues zu lernen.' };
  else if (outcome.failure) state = { type: 'finished', text: `${count} Karten sind entstanden, dann ging es nicht weiter: ${outcome.failure}` };
  else if (outcome.remaining > 0) state = { type: 'finished', text: `${count} Karten sind entstanden. Tippe noch einmal, für die restlichen Seiten.` };
  else state = { type: 'finished', text: `${count} Karten sind entstanden.` };
  generator.set({ busyID: null, state });
}
