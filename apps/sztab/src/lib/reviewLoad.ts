import { listAssignments, readSnapshot } from './data';
import type { Connection } from './data';
import type { Overview } from './metrics';
import { prepare } from './review';
import type { ReviewData } from './review';

/**
 * Wczytanie danych do „Do przejrzenia”: paczka i lista zaleceń każdego podopiecznego to osobne
 * zapytania i osobne odszyfrowanie, więc idą w tle, najwyżej `LIMIT` naraz, i zostają w pamięci
 * karty do końca sesji. Klucz pamięci to współpraca i chwila ostatniej paczki — nowa paczka liczy
 * się od nowa. W pamięci zostaje tylko wyciąg do przeglądu (`ReviewData`), nie cała paczka.
 */

export const LIMIT = 4;

/** Kolejka zadań, najwyżej `limit` naraz; reszta czeka w kolejności zgłoszenia. */
export function pool(limit: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    if (running >= limit) return;
    const job = waiting.shift();
    if (!job) return;
    running++;
    job();
  };
  return <T,>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            running--;
            next();
          });
      });
      next();
    });
}

const run = pool(LIMIT);
/** Osobno dla każdego klucza sejfu: inny prowadzący w tej samej karcie nie widzi cudzej pamięci. */
const caches = new WeakMap<CryptoKey, Map<string, Promise<ReviewData>>>();

const cacheOf = (key: CryptoKey) => {
  let m = caches.get(key);
  if (!m) caches.set(key, (m = new Map()));
  return m;
};

export function loadReview(key: CryptoKey, c: Connection): Promise<ReviewData> {
  const cache = cacheOf(key);
  const id = `${c.id}|${c.lastPushAt ?? ''}`;
  const hit = cache.get(id);
  if (hit) return hit;
  forgetReview(key, c.id);
  const snap = run(() => readSnapshot(key, c));
  const sent = run(() => listAssignments(key, c));
  const p = Promise.all([snap, sent, import('./metrics')]).then(([read, list, { overview }]) => {
    const now = Date.now();
    let o: Overview | null = null;
    if (read.snapshot) {
      try {
        o = overview(read.snapshot, now);
      } catch {
        // Silnik nie policzył tej paczki — bez treningów, reszta przeglądu działa.
        o = null;
      }
    }
    return prepare(read, list, o, now);
  });
  cache.set(id, p);
  // Nieudane nie zostaje w pamięci — następne wejście spróbuje jeszcze raz.
  p.catch(() => cache.get(id) === p && cache.delete(id));
  return p;
}

/** Zapomnij współpracę (po otwarciu podopiecznego albo wysyłce — zalecenia mogły się zmienić). */
export function forgetReview(key: CryptoKey, connectionId: string): void {
  const cache = cacheOf(key);
  for (const k of [...cache.keys()]) if (k.startsWith(`${connectionId}|`)) cache.delete(k);
}
