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

// Sklepy internetowe i sieci z próbki zamiast prawdziwych plików: liczby produktów w testach zostają stałe.
const online = vi.hoisted(() => ({ SHOPS: [] as unknown[], CHAIN_DATA: [] as unknown[], CHUNK_URL: '' }));
vi.mock('./online/shopData', () => online);

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
  online.SHOPS = [];
  online.CHAIN_DATA = [];
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

  it('dokłada produkty sklepów internetowych — do wyszukiwania i ze sklepem w słowniku', async () => {
    online.SHOPS = [
      {
        id: 'guiltfree',
        name: 'GuiltFree',
        url: 'https://guiltfree.pl',
        checked: '2026-10-13',
        products: [
          {
            name: 'Syrop zero klonowy',
            brand: 'GuiltFree',
            url: 'https://guiltfree.pl/products/syrop-klonowy',
            quantity: '300 ml',
            category: 'sosy',
            nutrition: { kcal: 3, protein: 0, carbs: 0.5, fat: 0, sugars: 0, fiber: null, saturatedFat: 0, salt: 0.1 },
            price: 19.99,
            vegan: true,
            ean: null,
          },
        ],
      },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(gz(TEXT))));
    const { loadDataset } = await load();
    const { dataset, products } = await loadDataset();
    expect(dataset.products).toHaveLength(DATASET.products.length + 1);
    expect(dataset.dictionaries.stores.guiltfree).toBe('GuiltFree');
    expect(products.at(-1)).toMatchObject({ code: 'guiltfree-syrop-klonowy', stores: ['guiltfree'] });
    expect(products.at(-1)?.searchText).toContain('syrop zero klonowy guiltfree');
  });

  it('dokłada produkty sieci (Selgros) — sieć jako sklep, z odnośnikiem do karty produktu', async () => {
    online.CHAIN_DATA = [
      {
        id: 'selgros',
        name: 'Selgros',
        url: 'https://www.selgros.pl',
        productUrl: 'https://www.selgros.pl/znajdz-produkt/product/{id}',
        checked: '2026-10-16',
        hall: 'Kraków',
        products: [
          {
            ean: '5902899143835',
            id: '339221',
            name: 'Almette śmietankowy',
            brand: 'Almette',
            quantity: '150 g',
            categories: ['en:dairies'],
            allergens: ['en:milk'],
            nutrition: { kcal: 260, protein: 6.3, carbs: 2.4, fat: 25, sugars: 2.3, fiber: null, saturatedFat: 17, salt: 0.78 },
            price: 5.19,
          },
        ],
      },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(gz(TEXT))));
    const { loadDataset } = await load();
    const { dataset, products } = await loadDataset();
    expect(dataset.products).toHaveLength(DATASET.products.length + 1);
    expect(dataset.dictionaries.stores.selgros).toBe('Selgros');
    expect(products.at(-1)).toMatchObject({
      code: '5902899143835',
      stores: ['selgros'],
      pages: [{ store: 'selgros', url: 'https://www.selgros.pl/znajdz-produkt/product/339221' }],
    });
    expect(products.at(-1)?.searchText).toContain('almette smietankowy');
  });

  it('pobiera raz na życie strony, a wczytaną bazę oddaje też od ręki', async () => {
    const fetchMock = vi.fn(async () => new Response(gz(TEXT)));
    vi.stubGlobal('fetch', fetchMock);
    const { loadDataset, loadedDataset } = await load();
    expect(loadedDataset()).toBeNull();
    const first = await loadDataset();
    expect(await loadDataset()).toBe(first);
    expect(loadedDataset()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bez sieci i z uszkodzonym plikiem też mówi po polsku, co się stało', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { loadDataset } = await load();
    await expect(loadDataset()).rejects.toThrow(
      'Nie udało się pobrać danych produktów. Sprawdź połączenie z internetem.',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(gz('{"products": ['))),
    );
    await expect(loadDataset()).rejects.toThrow('Dane produktów są uszkodzone.');
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

describe('pierwsza wizyta: baza i paczka sklepów trafiają do kopii service workera', () => {
  const DB = `${import.meta.env.BASE_URL}data/products.abc123def456.json.gz`;
  const PAGES = 'https://aleksanderdudek.github.io/gym-training-tracker/';
  const CHUNK = `${PAGES}assets/shopData-CPHrJmUd.js`;

  /** `navigator.serviceWorker` (node go nie ma) z kontrolerem albo bez — wtedy strona jeszcze nie jest pod jego opieką. */
  function serviceWorker(controller: object | null) {
    const sw = Object.assign(new EventTarget(), { controller });
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    const takeOver = () => {
      sw.controller = {};
      sw.dispatchEvent(new Event('controllerchange'));
    };
    return { sw, takeOver };
  }

  beforeEach(() => {
    // Paczka z builda zna swój adres z haszem (`import.meta.url`).
    online.CHUNK_URL = CHUNK;
  });

  afterEach(() => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  it('gdy service worker przejmie stronę, pobiera je jeszcze raz przez niego — bazę dopiero po jej pierwszej próbie', async () => {
    const calls: string[] = [];
    let arrive = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        if (calls.length > 1) return Promise.resolve(new Response('kopia'));
        return new Promise<Response>((resolve) => {
          arrive = () => resolve(new Response(gz(TEXT)));
        });
      }),
    );
    const { takeOver } = serviceWorker(null);
    const { loadDataset } = await load();
    const loading = loadDataset();
    // Service worker przejmuje stronę, kiedy baza jest jeszcze w drodze.
    takeOver();
    await vi.waitFor(() => expect(calls).toContain(CHUNK));
    expect(calls).toEqual([DB, CHUNK]);
    arrive();
    await loading;
    await vi.waitFor(() => expect(calls).toEqual([DB, CHUNK, DB]));
  });

  it('strona już pod opieką service workera: wszystko poszło przez niego, nic nie jest pobierane drugi raz', async () => {
    const fetchMock = vi.fn(async () => new Response(gz(TEXT)));
    vi.stubGlobal('fetch', fetchMock);
    const { sw } = serviceWorker({});
    const { loadDataset } = await load();
    await loadDataset();
    sw.dispatchEvent(new Event('controllerchange'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
