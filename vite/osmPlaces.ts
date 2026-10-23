import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';
// Z rozszerzeniem `.ts`, jak wtyczki w `vite.config.ts`: natywny loader konfiguracji Vite go wymaga.
// Oba moduły nie importują niczego — dlatego da się je tu wczytać poza aplikacją.
import { CAP, LAT0, LON0, MAX_DEPTH, ROOT_DEPTH, buildTree, cellBox } from '../src/food/nearby/osmGrid.ts';
import { encodeLeaf, leafPath, parseTsv, type OsmIndex } from '../src/food/nearby/osmFormat.ts';

/** Dane OSM „W pobliżu” w repozytorium: TSV z `npm run food:osm` i jego metadane. */
export const OSM_DATA_FILE = 'data/osm/places-pl.tsv';
export const OSM_META_FILE = 'data/osm/meta.json';

const VIRTUAL_ID = 'virtual:osm-places';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
/** Katalog z kawałkami w zbudowanej aplikacji; `v1` to wersja formatu, nie danych. */
const OUT = 'data/osm/v1';
/** Stały adres indeksu: nowe dane nie zmieniają ani kodu, ani `sw.js` — nie ma paska „Nowa wersja”. */
export const INDEX_PATH = `${OUT}/index.json`;
/** Po tylu dniach build ostrzega, że dane trzeba odświeżyć. */
const STALE_DAYS = 45;

/** To, co z `meta.json` trafia do indeksu. */
interface OsmMeta {
  dataAsOf: string;
  license: string;
  attribution: string;
  coverage: { eps: number; rings: number[][]; holes: number[][] };
}

export interface OsmFiles {
  index: OsmIndex;
  /** Ścieżka w buildzie → zawartość. */
  files: Map<string, Buffer>;
}

function licenseText(meta: OsmMeta): string {
  return [
    'Lokale i sklepy „W pobliżu” — dane OpenStreetMap',
    `© autorzy OpenStreetMap (https://www.openstreetmap.org/copyright), stan z ${meta.dataAsOf}.`,
    'Te pliki to baza pochodna danych OpenStreetMap, udostępniana na licencji Open Database License 1.0',
    '(https://opendatacommons.org/licenses/odbl/1-0/). Cała baza i sposób jej przygotowania:',
    'https://github.com/AleksanderDudek/gym-training-tracker/tree/main/data/osm',
    '(scripts/food/osm-places.ts, `npm run food:osm`).',
    '',
    'Places and shops for “Nearby” — OpenStreetMap data',
    `© OpenStreetMap contributors (https://www.openstreetmap.org/copyright), data as of ${meta.dataAsOf}.`,
    'These files are a derived database of OpenStreetMap data, available under the Open Database License 1.0',
    '(https://opendatacommons.org/licenses/odbl/1-0/). The whole database and how it is made:',
    'https://github.com/AleksanderDudek/gym-training-tracker/tree/main/data/osm',
    '(scripts/food/osm-places.ts, `npm run food:osm`).',
    '',
  ].join('\n');
}

/**
 * Kawałki danych z TSV: drzewo czwórkowe (najwyżej 500 miejsc w kawałku), każdy kawałek jako JSON
 * spakowany gzipem pod nazwą z haszem treści (niezmieniony kawałek zachowuje adres — przeglądarka
 * i service worker trzymają go dalej), indeks pod stałym adresem i plik z licencją.
 */
export function buildOsmFiles(tsv: string, meta: OsmMeta): OsmFiles {
  const { columns, rows } = parseTsv(tsv);
  const files = new Map<string, Buffer>();
  const leaves: OsmIndex['leaves'] = [];
  for (const leaf of buildTree(rows, CAP, MAX_DEPTH, ROOT_DEPTH)) {
    const box = cellBox(leaf);
    const json = encodeLeaf(leaf, leaf.rows, columns, [box.south, box.west]);
    // Hasz z treści przed spakowaniem: gzip na macOS i w CI różni się bajtem systemu w nagłówku.
    const sha10 = createHash('sha256').update(json).digest('hex').slice(0, 10);
    const entry: OsmIndex['leaves'][number] = [leaf.d, leaf.i, leaf.j, leaf.rows.length, sha10];
    files.set(`${OUT}/${leafPath(entry)}`, gzipSync(Buffer.from(json), { level: 9 }));
    leaves.push(entry);
  }
  const index: OsmIndex = {
    f: 1,
    dataAsOf: meta.dataAsOf,
    count: rows.length,
    license: meta.license,
    attribution: meta.attribution,
    notice: 'LICENSE.txt',
    grid: { lat0: LAT0, lon0: LON0, root: ROOT_DEPTH, maxDepth: MAX_DEPTH, cap: CAP },
    coverage: { eps: meta.coverage.eps, rings: meta.coverage.rings, holes: meta.coverage.holes },
    leaves,
  };
  files.set(INDEX_PATH, Buffer.from(JSON.stringify(index)));
  files.set(`${OUT}/LICENSE.txt`, Buffer.from(licenseText(meta)));
  return { index, files };
}

/** Pliki z repozytorium; `null`, gdy ich nie ma albo nie da się ich odczytać (wtedy strona pyta Overpass). */
export function readOsmFiles(root: string): OsmFiles | null {
  const tsvFile = resolve(root, OSM_DATA_FILE);
  const metaFile = resolve(root, OSM_META_FILE);
  if (!existsSync(tsvFile) || !existsSync(metaFile)) return null;
  const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as OsmMeta;
  return buildOsmFiles(readFileSync(tsvFile, 'utf8'), meta);
}

/**
 * Dane OSM dla „W pobliżu”: build tnie `data/osm/places-pl.tsv` na kawałki (`data/osm/v1/…`),
 * serwer deweloperski podaje je spod tych samych adresów, a kod dostaje adres indeksu przez
 * `virtual:osm-places`. Pod Vitestem i bez danych — `{ index: null }`: strona pyta wtedy Overpass
 * jak dawniej, a testy stron dalej sprawdzają tę drogę.
 */
export function osmPlaces(): Plugin {
  let root = process.cwd();
  let base = '/';
  let enabled = false;
  let built: OsmFiles | null | undefined;
  const files = () => (built === undefined ? (built = readOsmFiles(root)) : built);

  return {
    name: 'gym-tracker:osm-places',
    configResolved(config) {
      root = config.root;
      base = config.base;
      enabled = !process.env.VITEST && existsSync(resolve(root, OSM_DATA_FILE)) && existsSync(resolve(root, OSM_META_FILE));
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify({ index: enabled ? INDEX_PATH : null })};`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? '';
        const prefix = path.startsWith(`/${OUT}/`) ? '/' : path.startsWith(`${base}${OUT}/`) ? base : null;
        if (!enabled || prefix === null) return next();
        const body = files()?.files.get(path.slice(prefix.length));
        if (!body) return next();
        res.setHeader('Content-Type', path.endsWith('.gz') ? 'application/gzip' : path.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(body);
      });
    },
    generateBundle() {
      if (!enabled) {
        if (!process.env.VITEST) this.warn(`Brak ${OSM_DATA_FILE}: „W pobliżu” będzie pytać serwer Overpass.`);
        return;
      }
      const data = files();
      if (!data) return;
      for (const [fileName, source] of data.files) this.emitFile({ type: 'asset', fileName, source });
      const days = (Date.now() - Date.parse(data.index.dataAsOf)) / 86_400_000;
      if (days > STALE_DAYS)
        this.warn(`Dane OSM są z ${data.index.dataAsOf.slice(0, 10)} — odśwież je: npm run food:osm (albo workflow „Dane OSM”).`);
    },
  };
}
