import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { constants, gunzipSync } from 'node:zlib';
import type { Plugin } from 'vite';

/** Baza produktów w repozytorium: spakowany JSON, który przygotowuje `npm run food:data`. */
export const FOOD_DATA_FILE = 'data/food/products.json.gz';

const VIRTUAL_ID = 'virtual:food-data';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** To, co aplikacja dostaje z `virtual:food-data`: adres pliku z bazą i jej wersja. */
export interface FoodDataMeta {
  url: string | null;
  version: string | null;
  generatedAt: string | null;
}

interface FoodData {
  meta: FoodDataMeta;
  fileName: string;
  bytes: Buffer;
}

/**
 * Data przygotowania bazy z samego początku pliku. Rozpakowuje tylko pierwsze kilka kilobajtów
 * (`Z_SYNC_FLUSH` oddaje to, co już się rozpakowało, zamiast żądać końca strumienia) — całość
 * to ponad 20 MB tekstu, a `generatedAt` stoi w pierwszej linijce.
 */
export function readGeneratedAt(gz: Uint8Array): string | null {
  try {
    const head = gunzipSync(gz.subarray(0, 4096), { finishFlush: constants.Z_SYNC_FLUSH })
      .toString('utf8')
      .slice(0, 300);
    return head.match(/"generatedAt":"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Plik bazy i to, co o nim wie aplikacja — albo nic, gdy pliku nie ma. */
export function readFoodData(file: string): FoodData | null {
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file);
  // Nazwa od treści: nowa baza to nowy adres, więc przeglądarka i service worker mogą trzymać
  // plik bez końca, a starej kopii pozbywają się same (CacheFirst z jednym wpisem w `sw.ts`).
  const version = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const fileName = `data/products.${version}.json.gz`;
  return { meta: { url: fileName, version, generatedAt: readGeneratedAt(bytes) }, fileName, bytes };
}

/**
 * Baza produktów dla części „Jedzenie”: build wydaje ją jako `data/products.<sha12>.json.gz`,
 * serwer deweloperski podaje ten sam plik spod tego samego adresu, a kod dostaje adres przez
 * `virtual:food-data`. Bez pliku w repozytorium aplikacja działa dalej — `url` jest wtedy `null`
 * i ekrany jedzenia mówią, że danych nie dołączono.
 */
export function foodData(): Plugin {
  let data: FoodData | null = null;
  let base = '/';

  return {
    name: 'gym-tracker:food-data',
    configResolved(config) {
      base = config.base;
      data = readFoodData(resolve(config.root, FOOD_DATA_FILE));
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const meta: FoodDataMeta = data?.meta ?? { url: null, version: null, generatedAt: null };
      return `export default ${JSON.stringify(meta)};`;
    },
    configureServer(server) {
      // Ścieżka z adresem bazy z obu stron: `base: './'` w trybie deweloperskim to `/`, ale
      // bezwzględna baza (np. `/gym/`) też ma trafić w plik.
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (!data || (path !== `/${data.fileName}` && path !== `${base}${data.fileName}`)) return next();
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Length', String(data.bytes.length));
        res.setHeader('Cache-Control', 'no-cache');
        res.end(data.bytes);
      });
    },
    generateBundle() {
      if (data) this.emitFile({ type: 'asset', fileName: data.fileName, source: data.bytes });
    },
  };
}
