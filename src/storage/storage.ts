import type { AppState } from '../types';

const KEY = 'kb-trener-v3';

/** Magazyn dostępny w osadzonym artefakcie Claude. */
interface ClaudeStorage {
  get(key: string, shared?: boolean): Promise<{ key: string; value: string } | null>;
  set(key: string, value: string, shared?: boolean): Promise<{ key: string } | null>;
  delete(key: string, shared?: boolean): Promise<{ deleted: boolean } | null>;
}

declare global {
  interface Window {
    storage?: ClaudeStorage;
  }
}

/**
 * Ta sama aplikacja działa w dwóch środowiskach: osadzona korzysta z window.storage,
 * uruchomiona lokalnie z localStorage. Warstwa wybiera to, co akurat działa.
 */
export const store = {
  async get(): Promise<AppState | null> {
    if (typeof window !== 'undefined' && window.storage) {
      try {
        const r = await window.storage.get(KEY);
        if (r) return JSON.parse(r.value) as AppState;
      } catch {
        /* brak klucza przy pierwszym uruchomieniu */
      }
    }
    try {
      const v = localStorage.getItem(KEY);
      return v ? (JSON.parse(v) as AppState) : null;
    } catch {
      return null;
    }
  },

  async set(state: AppState): Promise<boolean> {
    const s = JSON.stringify(state);
    if (typeof window !== 'undefined' && window.storage) {
      try {
        const r = await window.storage.set(KEY, s);
        if (r) return true;
      } catch {
        /* spadamy na localStorage */
      }
    }
    try {
      localStorage.setItem(KEY, s);
      return true;
    } catch {
      return false;
    }
  },

  async clear(): Promise<void> {
    if (typeof window !== 'undefined' && window.storage) {
      try {
        await window.storage.delete(KEY);
      } catch {
        /* nic do skasowania */
      }
    }
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* pomijamy */
    }
  },
};

/** Zapisy idą jednym łańcuchem, żeby równoległe wywołania nie wyścigały się o klucz. */
let chain: Promise<void> = Promise.resolve();

export function queueSave(state: AppState, onFail: (broken: boolean) => void): Promise<void> {
  chain = chain
    .then(async () => {
      const ok = await store.set(state);
      onFail(!ok);
    })
    .catch(() => onFail(true));
  return chain;
}
