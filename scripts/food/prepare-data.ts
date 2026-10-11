// Turns the Open Food Facts dump (plus Open Prices and the taxonomies, when
// they have been fetched) into data/food/products.json.gz, which is committed:
// vite/foodData.ts emits it as data/products.<sha12>.json.gz.
// Usage: npm run food:prepare [-- file.csv ...]
// With no arguments it reads data/food/raw/off_poland.csv and, when present,
// data/food/raw/off_priced.csv (from food:extract-priced). Earlier files win a code.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';
import type { Dataset, Dictionaries, Product } from '../../src/food/lib/types';
import { latestPricesByCode, type OpenPriceItem } from './lib/prices';
import { SpellingCounter } from './lib/spelling';
import { makeNamer, type Taxonomy } from './lib/taxonomy';
import { USED_COLUMNS, rowToProduct, type SkipReason } from './lib/transform';
import { splitLine, toRow } from './lib/tsv';

const DEFAULT_CSVS = ['data/food/raw/off_poland.csv', 'data/food/raw/off_priced.csv'];
const CSV_PATHS =
  process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_CSVS.filter((path, i) => i === 0 || existsSync(path));
const PRICES_PATH = 'data/food/raw/prices.json';
const TAXONOMY_DIR = 'data/food/raw/taxonomies';
const OUT_PATH = 'data/food/products.json.gz';

for (const path of CSV_PATHS) {
  if (!existsSync(path)) {
    console.error(`No CSV at ${path}. Pass the path to off_poland.csv as the first argument.`);
    process.exit(1);
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  return existsSync(path) ? (JSON.parse(await readFile(path, 'utf8')) as T) : null;
}

const taxonomies = {
  categories: await readJson<Taxonomy>(join(TAXONOMY_DIR, 'categories.json')),
  labels: await readJson<Taxonomy>(join(TAXONOMY_DIR, 'labels.json')),
  allergens: await readJson<Taxonomy>(join(TAXONOMY_DIR, 'allergens.json')),
  additives: await readJson<Taxonomy>(join(TAXONOMY_DIR, 'additives.json')),
};
const hasTaxonomies = Object.values(taxonomies).every(Boolean);
if (!hasTaxonomies) console.warn('Taxonomies missing: names will be English. Run npm run food:taxonomies.');

const priceFile = await readJson<{ fetchedAt: string; items: OpenPriceItem[] }>(PRICES_PATH);
const prices = latestPricesByCode(priceFile?.items ?? []);
if (!priceFile) console.warn('No prices: run npm run food:prices.');

const products: Product[] = [];
const seenCodes = new Set<string>();
const brands = new SpellingCounter();
const stores = new SpellingCounter();
const skipped: Record<SkipReason | 'malformed' | 'duplicate', number> = {
  'no-code': 0,
  'no-name': 0,
  malformed: 0,
  duplicate: 0,
};

let read = 0;
for (const csvPath of CSV_PATHS) {
  const before = products.length;
  let header: string[] | null = null;
  const lines = createInterface({ input: createReadStream(csvPath, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!header) {
      header = splitLine(line);
      const missing = USED_COLUMNS.filter((c) => !header!.includes(c));
      if (missing.length) {
        console.error(`${csvPath} lacks columns this script needs: ${missing.join(', ')}`);
        process.exit(1);
      }
      continue;
    }
    if (!line) continue;
    read++;
    const row = toRow(header, splitLine(line));
    if (!row) {
      skipped.malformed++;
      continue;
    }
    const result = rowToProduct(row);
    if (!result.ok) {
      skipped[result.reason]++;
      continue;
    }
    if (seenCodes.has(result.product.code)) {
      skipped.duplicate++;
      continue;
    }
    seenCodes.add(result.product.code);
    for (const [key, label] of result.brandLabels) brands.add(key, label);
    for (const [key, label] of result.storeLabels) stores.add(key, label);
    result.product.price = prices.get(result.product.code) ?? null;
    products.push(result.product);
  }
  console.log(`${csvPath}: ${products.length - before} products added`);
}

function dictionary(tags: Iterable<string>, name: (tag: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tag of tags) out[tag] ??= name(tag);
  return out;
}

const used = {
  categories: new Set<string>(),
  labels: new Set<string>(),
  allergens: new Set<string>(),
  additives: new Set<string>(),
};
for (const p of products) {
  for (const tag of p.categories) used.categories.add(tag);
  if (p.mainCategory) used.categories.add(p.mainCategory);
  for (const tag of p.labels) used.labels.add(tag);
  for (const tag of [...p.allergens, ...p.traces]) used.allergens.add(tag);
  for (const tag of p.additives) used.additives.add(tag);
}

const dictionaries: Dictionaries = {
  categories: dictionary(used.categories, makeNamer(taxonomies.categories)),
  labels: dictionary(used.labels, makeNamer(taxonomies.labels)),
  allergens: dictionary(used.allergens, makeNamer(taxonomies.allergens)),
  additives: dictionary(used.additives, makeNamer(taxonomies.additives)),
  brands: brands.best(),
  stores: stores.best(),
};

const dataset: Dataset = {
  generatedAt: new Date().toISOString(),
  sources: {
    products: CSV_PATHS.map((path) => basename(path)).join(' + '),
    prices: priceFile?.fetchedAt ?? null,
    taxonomies: hasTaxonomies,
  },
  dictionaries,
  products,
};

await mkdir(dirname(OUT_PATH), { recursive: true });
const json = JSON.stringify(dataset);
const gz = gzipSync(json, { level: 9 });
await writeFile(OUT_PATH, gz);
// The version the build names the file with (vite/foodData.ts): the app keeps
// one copy and downloads again only when the content, and so the name, changes.
const version = createHash('sha256').update(gz).digest('hex').slice(0, 12);

const priced = products.filter((p) => p.price).length;
const withImage = products.filter((p) => p.images.front).length;
console.log(`read ${read} rows`);
console.log(`kept ${products.length} products (${withImage} with a photo, ${priced} with a price)`);
console.log(
  `skipped: ${Object.entries(skipped)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')}`,
);
console.log(`prices: ${prices.size} products priced on Open Prices, ${priced} of them in this dataset`);
console.log(
  `wrote ${OUT_PATH} (${(gz.length / 1024 / 1024).toFixed(1)} MB, ${(json.length / 1024 / 1024).toFixed(1)} MB unpacked), version ${version}`,
);
