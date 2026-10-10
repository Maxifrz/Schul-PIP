import { useSyncExternalStore } from 'react';
import { storage } from '../lib/platform';

export interface Store<T> {
  get(): T;
  set(update: Partial<T> | ((state: T) => T)): void;
  subscribe(listener: () => void): () => void;
  use(): T;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const get = () => state;
  return {
    get,
    set(update) {
      state = typeof update === 'function' ? update(state) : { ...state, ...update };
      listeners.forEach((listener) => listener());
    },
    subscribe,
    use: () => useSyncExternalStore(subscribe, get),
  };
}

/** Loads the stored copy once and writes every change back (after a short pause, so typing does not hammer the disk). */
export async function persist<T extends object>(store: Store<T>, name: string, pick: (state: T) => unknown, restore: (stored: unknown, state: T) => T): Promise<void> {
  try {
    const text = await storage.read(name);
    if (text) store.set((state) => restore(JSON.parse(text), state));
  } catch {
    // a damaged file must not stop the app
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  store.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void storage.write(name, JSON.stringify(pick(store.get())));
    }, 300);
  });
}
