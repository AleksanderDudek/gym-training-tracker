// Downloads every price reported in PLN on Open Prices.
// Usage: npm run food:prices
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchWithRetry, sleep } from './http';
import type { OpenPriceItem } from './lib/prices';

const OUT_FILE = 'data/food/raw/prices.json';
const PAGE_SIZE = 100;
const PAUSE_MS = 300;

interface Page {
  items: OpenPriceItem[];
  page: number;
  pages: number;
  total: number;
}

const items: OpenPriceItem[] = [];
let page = 1;
let pages = 1;
let total = 0;
do {
  const url = `https://prices.openfoodfacts.org/api/v1/prices?currency=PLN&size=${PAGE_SIZE}&page=${page}&order_by=-date`;
  const data = (await (await fetchWithRetry(url)).json()) as Page;
  items.push(...data.items);
  pages = data.pages;
  total = data.total;
  process.stdout.write(`\rpage ${page}/${pages}`);
  page++;
  if (page <= pages) await sleep(PAUSE_MS);
} while (page <= pages);

await mkdir('data/food/raw', { recursive: true });
await writeFile(OUT_FILE, JSON.stringify({ fetchedAt: new Date().toISOString(), total, items }));
console.log(`\n${items.length} of ${total} prices saved to ${OUT_FILE}`);
