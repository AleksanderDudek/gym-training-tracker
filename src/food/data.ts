import { gunzipSync } from 'fflate';
import foodData from 'virtual:food-data';
import { indexProducts } from './lib/search';
import type { Dataset, IndexedProduct } from './lib/types';

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
export async function inflate(bytes: Uint8Array): Promise<string> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === 'function') {
    // Kopia do zwykłego ArrayBuffera: `Blob` nie przyjmuje widoku na współdzieloną pamięć.
    const stream = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  // Starsze przeglądarki bez DecompressionStream (Safari < 16.4).
  return new TextDecoder().decode(gunzipSync(bytes));
}

async function fetchDataset(): Promise<LoadedDataset> {
  const { url } = foodData;
  if (!url) throw new Error(MISSING_DATA_MESSAGE);
  const response = await fetch(import.meta.env.BASE_URL + url);
  if (!response.ok) throw new Error(`Nie udało się pobrać danych produktów (HTTP ${response.status}).`);
  const dataset = JSON.parse(await inflate(new Uint8Array(await response.arrayBuffer()))) as Dataset;
  return { dataset, products: indexProducts(dataset.products, dataset.dictionaries.brands) };
}

let pending: Promise<LoadedDataset> | null = null;

/**
 * Baza produktów, pobrana raz na życie strony: każdy ekran jedzenia dostaje tę samą obietnicę.
 * Nieudana próba nie zostaje w pamięci — „Spróbuj ponownie” pobiera od nowa.
 */
export function loadDataset(): Promise<LoadedDataset> {
  if (!pending) {
    pending = fetchDataset();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
