import foodData from 'virtual:food-data';
import { inflate } from './lib/inflate';
import { indexProducts } from './lib/search';
import type { Dataset, IndexedProduct } from './lib/types';
import { mergeChains } from './chains/merge';
import type { ChainData } from './chains/types';
import { mergeOnline } from './online/merge';
import type { ShopData } from './online/types';
import { text } from '../i18n';
import { refetchWhenControlled } from '../swWarm';

const T = text({
  pl: {
    missing: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    offline: 'Nie udało się pobrać danych produktów. Sprawdź połączenie z internetem.',
    http: (status: number) => `Nie udało się pobrać danych produktów (HTTP ${status}).`,
    broken: 'Dane produktów są uszkodzone.',
  },
  en: {
    missing: 'Product data isn’t included in this version of the app.',
    offline: 'Couldn’t load the product data. Check your internet connection.',
    http: (status: number) => `Couldn’t load the product data (HTTP ${status}).`,
    broken: 'The product data is damaged.',
  },
});

export interface LoadedDataset {
  dataset: Dataset;
  products: IndexedProduct[];
}

export const MISSING_DATA_MESSAGE = T.missing;

/** Re-exported: the products dataset and the OSM leaves unpack the same way. */
export { inflate };

/** Adres bazy produktów albo `null`, gdy tę wersję aplikacji zbudowano bez niej. */
const datasetUrl = (): string | null => (foodData.url ? import.meta.env.BASE_URL + foodData.url : null);

/**
 * Tyle pobieranie bazy może milczeć — bez nagłówków odpowiedzi, potem bez kolejnego kawałka treści —
 * zanim uzna się je za zawieszone. Liczy się tylko cisza, nie całość: 3,3 MB na wolnym łączu idą
 * minutami, ale idą. Dłużej niż przy małych plikach OSM (10 s): pobierana z niskim priorytetem baza
 * może nie dostać nic, póki serwer, który pilnuje priorytetów, wysyła przed nią paczkę sklepów
 * (783 kB, na EDGE ok. pół minuty) i kawałki mapy.
 */
export const DATASET_STALL_MS = 90_000;

/**
 * Ostatnie pobieranie bazy zawiesiło się albo urwało: następne idzie z pominięciem pamięci podręcznej
 * przeglądarki (`reload`, odpowiedź i tak do niej trafia). Przerwanie strony kończy tylko jej stronę:
 * zapytanie service workera trwa dalej i pisze wpis pliku w tej pamięci, a w Chromium każde następne
 * zapytanie w zwykłym trybie dołącza do tego wpisu i wisi razem z nim — „Spróbuj ponownie” nigdy nie
 * doszłoby do serwera. Udane pobranie znosi znacznik.
 */
let pastCache = false;

/**
 * Produkty sklepów internetowych i sieci z własnymi danymi (Selgros) — osobna paczka, wczytywana
 * razem z bazą. Gdy się nie wczyta (np. offline przed pierwszym zapisaniem paczki), baza przychodzi
 * bez nich: to dodatek, nie powód, żeby nie pokazać 29 tysięcy produktów.
 */
function loadShops(): Promise<{ shops: ShopData[]; chains: ChainData[] }> {
  const loading = import('./online/shopData');
  // Pierwsza wizyta: paczka przyszła obok service workera, więc gdy ten przejmie stronę, jest
  // pobierana jeszcze raz — do jego kopii. Nazwę z haszem zna tylko build, więc adres podaje sama
  // paczka, kiedy już się wczyta.
  let chunk: string | undefined;
  refetchWhenControlled(
    () => chunk,
    loading.then(
      (m) => {
        chunk = m.CHUNK_URL;
      },
      // Paczka się nie wczytała: nie ma czego pobierać drugi raz, a jej błąd obsługuje zwrot niżej.
      () => undefined,
    ),
  );
  return loading.then(
    (m) => ({ shops: m.SHOPS, chains: m.CHAIN_DATA }),
    () => ({ shops: [], chains: [] }),
  );
}

/**
 * Plik bazy, czytany kawałek po kawałku z zegarem, który każdy znak życia nastawia od nowa
 * (`DATASET_STALL_MS`): powolne, ale równe pobieranie kończy się, ile by nie trwało, a zawieszone
 * staje się błędem połączenia — z „Spróbuj ponownie” zamiast „Wczytuję…” bez końca.
 */
async function download(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const controller = new AbortController();
  // Przerwanie kończy zapytanie; wyścig z nim kończy też czytanie, które przeglądarka zostawiłaby zawieszone.
  const stalled = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error(T.offline))));
  stalled.catch(() => {});
  const within = <V>(step: Promise<V>) => Promise.race([step, stalled]);
  /** Zegar ciszy się skończył (zawieszone pobieranie, nie brak sieci). */
  let cut = false;
  const silence = () => {
    cut = true;
    controller.abort();
  };
  let timer = setTimeout(silence, DATASET_STALL_MS);
  /** Coś przyszło: następny kawałek ma znów cały czas. */
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(silence, DATASET_STALL_MS);
  };
  // Zerwane połączenie wychodzi z `fetch` albo dopiero w trakcie czytania treści.
  const offline = () => {
    throw new Error(T.offline);
  };
  let answered = false;
  try {
    // Niski priorytet (Chromium): na wolnym łączu baza (3 MB) idzie za indeksem i kawałkami danych OSM
    // „W pobliżu” (`nearby/staticData`, pytanymi w tym samym czasie z wysokim). Przy równych serwer
    // wysyła odpowiedzi po kolei, a te małe pliki czekałyby za bazą, aż ich limit czasu uznałby to
    // za brak połączenia.
    const init: RequestInit = { priority: 'low', signal: controller.signal, ...(pastCache ? { cache: 'reload' as const } : {}) };
    const response = await within(fetch(url, init)).catch(offline);
    if (!response.ok) throw new Error(T.http(response.status));
    answered = true;
    alive();
    if (!response.body) return new Uint8Array(await within(response.arrayBuffer()).catch(offline));
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await within(reader.read()).catch(offline);
      if (done) break;
      chunks.push(value);
      size += value.length;
      alive();
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    pastCache = false;
    return bytes;
  } catch (error) {
    // Cisza albo treść urwana w drodze: wpis w pamięci podręcznej mógł zostać w połowie (`pastCache`).
    // Brak sieci od początku niczego nie zaczął pisać.
    if (cut || answered) pastCache = true;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDataset(): Promise<LoadedDataset> {
  const url = datasetUrl();
  if (!url) throw new Error(MISSING_DATA_MESSAGE);
  const shops = loadShops();
  const bytes = await download(url);
  let dataset: Dataset;
  try {
    dataset = JSON.parse(await inflate(bytes)) as Dataset;
  } catch {
    throw new Error(T.broken);
  }
  const extra = await shops;
  // Najpierw sieci stacjonarne (ich produkty łączą się z bazą po EAN), potem sklepy internetowe —
  // produkt z obu dostaje i sieć, i ofertę sklepu.
  try {
    dataset = mergeChains(dataset, extra.chains);
  } catch (error) {
    // Uszkodzony plik sieci nie może zabrać 29 tysięcy produktów — baza przychodzi bez niej.
    console.warn('Produkty sieci pominięte:', error); // i18n-ignore: developer log
  }
  try {
    dataset = mergeOnline(dataset, extra.shops);
  } catch (error) {
    // Uszkodzony plik sklepu nie może zabrać 29 tysięcy produktów — baza przychodzi bez sklepów.
    console.warn('Produkty sklepów internetowych pominięte:', error); // i18n-ignore: developer log
  }
  return { dataset, products: indexProducts(dataset.products, dataset.dictionaries.brands) };
}

let pending: Promise<LoadedDataset> | null = null;
let loaded: LoadedDataset | null = null;

/** Baza, jeśli już się wczytała — ekran otwierany drugi raz nie mignie „Wczytywaniem”. */
export function loadedDataset(): LoadedDataset | null {
  return loaded;
}

/**
 * Baza produktów, pobrana raz na życie strony: każdy ekran jedzenia dostaje tę samą obietnicę.
 * Nieudana próba nie zostaje w pamięci — „Spróbuj ponownie” pobiera od nowa.
 */
export function loadDataset(): Promise<LoadedDataset> {
  if (!pending) {
    pending = fetchDataset();
    // Pierwsza wizyta: baza przyszła obok service workera, więc bez sieci by jej nie było. Gdy ten
    // przejmie stronę, jest pobierana jeszcze raz — po tej próbie, zwykle z pamięci podręcznej
    // przeglądarki — do jego kopii.
    const url = datasetUrl();
    if (url) refetchWhenControlled(url, pending);
    pending.then(
      (result) => {
        loaded = result;
      },
      () => {
        pending = null;
      },
    );
  }
  return pending;
}
