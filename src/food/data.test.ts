import { gzipSync, strToU8 } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATASET } from './test/fixtures';

// Adres bazy z `virtual:food-data` podmieniany w każdym teście: moduł czyta go dopiero przy
// wczytywaniu, więc wystarczy zmienić pole wspólnego obiektu.
const meta = vi.hoisted(() => ({
  url: 'data/products.abc123def456.json.gz' as string | null,
  version: 'abc123def456' as string | null,
  generatedAt: '2026-10-10T19:19:26.837Z' as string | null,
}));
vi.mock('virtual:food-data', () => ({ default: meta }));

const TEXT = JSON.stringify(DATASET);
const gz = (text: string) => gzipSync(strToU8(text));
const plain = (text: string) => new TextEncoder().encode(text);

/** Świeży moduł w każdym teście: pamięć „jedno pobranie na życie strony” nie przechodzi dalej. */
async function load() {
  vi.resetModules();
  return import('./data');
}

beforeEach(() => {
  meta.url = 'data/products.abc123def456.json.gz';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('inflate', () => {
  it('rozpakowuje gzip i przyjmuje tekst, który serwer już rozpakował — wynik ten sam', async () => {
    const { inflate } = await load();
    expect(await inflate(gz(TEXT))).toBe(TEXT);
    expect(await inflate(plain(TEXT))).toBe(TEXT);
  });

  it('bez DecompressionStream rozpakowuje fflate', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    const { inflate } = await load();
    expect(await inflate(gz('zażółć gęślą jaźń'))).toBe('zażółć gęślą jaźń');
  });
});

describe('loadDataset', () => {
  it('bez bazy w tej wersji aplikacji odmawia po polsku i niczego nie pobiera', async () => {
    meta.url = null;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { loadDataset } = await load();
    await expect(loadDataset()).rejects.toThrow('Dane produktów nie są dołączone do tej wersji aplikacji.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pobiera plik spod adresu z wersją, rozpakowuje i indeksuje produkty do wyszukiwania', async () => {
    const fetchMock = vi.fn(async () => new Response(gz(TEXT)));
    vi.stubGlobal('fetch', fetchMock);
    const { loadDataset } = await load();
    const { dataset, products } = await loadDataset();
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/products.abc123def456.json.gz`);
    expect(dataset.products).toHaveLength(DATASET.products.length);
    expect(products[0]?.searchText).toBe('zolty ser gouda mlekovita 1');
  });

  it('pobiera raz na życie strony', async () => {
    const fetchMock = vi.fn(async () => new Response(gz(TEXT)));
    vi.stubGlobal('fetch', fetchMock);
    const { loadDataset } = await load();
    const first = await loadDataset();
    expect(await loadDataset()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('błąd serwera to polski komunikat z kodem, a nieudana próba nie zostaje w pamięci', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nie ma', { status: 404 }))
      .mockResolvedValueOnce(new Response(gz(TEXT)));
    vi.stubGlobal('fetch', fetchMock);
    const { loadDataset } = await load();
    await expect(loadDataset()).rejects.toThrow('Nie udało się pobrać danych produktów (HTTP 404).');
    await expect(loadDataset()).resolves.toMatchObject({ dataset: { generatedAt: DATASET.generatedAt } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
