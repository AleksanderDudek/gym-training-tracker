import { gunzipSync } from 'fflate';
import foodData from 'virtual:food-data';
import { indexProducts } from './lib/search';
import type { Dataset, IndexedProduct } from './lib/types';
import { mergeOnline } from './online/merge';
import type { ShopData } from './online/types';

export interface LoadedDataset {
  dataset: Dataset;
  products: IndexedProduct[];
}

export const MISSING_DATA_MESSAGE = 'Dane produktów nie są dołączone do tej wersji aplikacji.';

/**
 * Tekst bazy z pobranych bajtów. Plik leży na serwerze jako gzip (`data/products.<wersja>.json.gz`),
 * ale serwer, który poda go z `Content-Encoding: gzip`, oddaje już rozpakowany JSON — dlatego
 * decyduje znacznik gzipa na początku (`1f 8b`), a nie nazwa pliku czy nagłówki.
 */
export async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  // Starsze przeglądarki bez DecompressionStream (Safari < 16.4).
  return new TextDecoder().decode(gunzipSync(bytes));
}

/**
 * Produkty sklepów internetowych — osobna paczka, wczytywana razem z bazą. Gdy się nie wczyta
 * (np. offline przed pierwszym zapisaniem paczki), baza przychodzi bez nich: to dodatek, nie powód,
 * żeby nie pokazać 29 tysięcy produktów.
 */
function loadShops(): Promise<ShopData[]> {
  return import('./online/shopData').then(
    (m) => m.SHOPS,
    () => [],
  );
}

async function fetchDataset(): Promise<LoadedDataset> {
  const { url } = foodData;
  if (!url) throw new Error(MISSING_DATA_MESSAGE);
  const shops = loadShops();
  // Zerwane połączenie wychodzi z `fetch` albo dopiero w trakcie czytania treści.
  const offline = () => {
    throw new Error('Nie udało się pobrać danych produktów. Sprawdź połączenie z internetem.');
  };
  const response = await fetch(import.meta.env.BASE_URL + url).catch(offline);
  if (!response.ok) throw new Error(`Nie udało się pobrać danych produktów (HTTP ${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer().catch(offline));
  let dataset: Dataset;
  try {
    dataset = JSON.parse(await inflate(bytes)) as Dataset;
  } catch {
    throw new Error('Dane produktów są uszkodzone.');
  }
  try {
    dataset = mergeOnline(dataset, await shops);
  } catch (error) {
    // Uszkodzony plik sklepu nie może zabrać 29 tysięcy produktów — baza przychodzi bez sklepów.
    console.warn('Produkty sklepów internetowych pominięte:', error);
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
