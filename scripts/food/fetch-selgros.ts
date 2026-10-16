// Selgros products with nutrition, from the chain's own product finder (selgros.pl/znajdz-produkt).
// Read the way a visitor's browser reads it: Playwright opens each food category page by page and
// keeps the product data the page itself fetches (name, brand, EAN of the selling unit, nutrition
// per 100 g, allergens, regular shelf price) and the product page addresses it shows. One page at a
// time with a pause between pages; every page is saved, so an interrupted run carries on, and a page
// older than a week is read again.
// Usage: npm run food:selgros            (read what is missing or stale, then write the data file)
//        npm run food:selgros -- --fresh (read everything again)
//        npm run food:selgros -- --limit=1 (a trial: at most N pages a department; the data file stays)
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import type { Dataset } from '../../src/food/lib/types';
import type { ChainData, ChainProductData } from '../../src/food/chains/types';
import {
  allergenTag,
  baseUnit,
  categoriesFor,
  labelAddsUp,
  nutritionOf,
  plausible,
  priceOf,
  quantityOf,
  tidyBrand,
  tidyName,
  validEan,
  withBrand,
  type SelgrosRecord,
} from './lib/selgros';

const BASE = 'https://www.selgros.pl';
const OUT = 'src/food/chains/data/selgros.json';
const CACHE = 'node_modules/.cache/selgros';
const PER_PAGE = 24;
const PAUSE_MS = 1500;
/** A saved page older than this is read again: the prices and the range change. */
const MAX_AGE_DAYS = 7;

/**
 * Food departments of the finder. Alcohol and everything non-food stay out, and so does „Dla dzieci”:
 * two thousand products, mostly toys and accessories, with a few hundred baby foods this app is not for.
 */
const FOOD = [
  'Nabiał',
  'Mięso, wędliny i ryby',
  'Sypkie',
  'Słodycze i przekąski',
  'Przetwory',
  'Dania gotowe i mrożonki',
  'Owoce i warzywa',
  'Pieczywo',
  'Napoje i woda',
  'Kawa i herbata',
  'Produkty wegetariańskie i wegańskie',
];

interface SavedPage {
  records: SelgrosRecord[];
  count: number;
  market: string | null;
  /** When the page was read (ISO); pages saved before this field had their file's time. */
  fetchedAt?: string;
}

const fresh = process.argv.includes('--fresh');
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8)) || Infinity;
if (fresh) await rm(CACHE, { recursive: true, force: true });
await mkdir(CACHE, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'pl-PL' });
  const { departments, halls } = await startPage(page);
  const missing = FOOD.filter((name) => !departments.has(name));
  // A department the finder no longer links would quietly vanish from the data: stop instead.
  if (missing.length) throw new Error(`no link on the finder page for: ${missing.join(', ')}`);
  for (const name of FOOD) {
    const href = departments.get(name)!;
    let pages = 1;
    for (let n = 1; n <= Math.min(pages, limit); n++) {
      const file = join(CACHE, `${slug(name)}-${String(n).padStart(3, '0')}.json`);
      const saved = await readSaved(file);
      const got = saved ?? (await patiently(() => crawl(page, href, n), `${name} ${n}`));
      if (!saved) {
        await writeFile(file, JSON.stringify(got));
        await page.waitForTimeout(PAUSE_MS);
      }
      pages = Math.max(1, Math.ceil(got.count / PER_PAGE));
      if (n === 1 || n % 10 === 0 || n === pages) console.log(`${name}: page ${n}/${pages}`);
    }
  }
  if (limit === Infinity) await writeData(halls);
  else console.log(`a trial (--limit=${limit}): pages saved, ${OUT} left as it was`);
} finally {
  await browser.close();
}

/** A saved page, unless it is older than a week (then it is read again). */
async function readSaved(file: string): Promise<SavedPage | null> {
  const saved = await readJson<SavedPage>(file);
  if (!saved) return null;
  saved.fetchedAt ??= (await stat(file)).mtime.toISOString();
  const age = (Date.now() - Date.parse(saved.fetchedAt)) / 86_400_000;
  return age > MAX_AGE_DAYS ? null : saved;
}

/** A page that did not answer gets two more tries, a while apart, before the run gives up. */
async function patiently<T>(work: () => Promise<T>, what: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`! ${what}: ${(error as Error).message.split('\n')[0]} — retrying`);
      await new Promise((r) => setTimeout(r, 15_000 * attempt));
    }
  }
}

/** The finder's start page: links of the departments and names of the halls. */
async function startPage(page: Page) {
  await page.goto(`${BASE}/znajdz-produkt`, { waitUntil: 'networkidle', timeout: 90_000 });
  const anchors = await page
    .locator('a[href]')
    .evaluateAll((as) => as.map((a) => [(a.textContent ?? '').trim(), a.getAttribute('href') ?? ''] as [string, string]));
  const departments = new Map<string, string>();
  for (const [text, href] of anchors) {
    // „Nabiał(1644)”: the link carries the count of its products.
    const name = text.replace(/\s*\(\d+\)$/, '');
    if (/^\/znajdz-produkt\/[^/?]+$/.test(href) && !departments.has(name)) departments.set(name, href);
  }
  const halls = new Map<string, string>();
  for (const [text, href] of anchors) {
    const id = href.match(/[?&]market=(\d+)/)?.[1];
    if (id && text) halls.set(id, text);
  }
  return { departments, halls };
}

/** One page of a department: the product records the page fetched, and its product links. */
async function crawl(page: Page, href: string, n: number): Promise<SavedPage> {
  const skip = (n - 1) * PER_PAGE;
  const response = page.waitForResponse(
    (r) => r.url().includes('/docs/search') && (r.request().postData() ?? '').includes(`"skip":${skip},"top":${PER_PAGE}`),
    { timeout: 90_000 },
  );
  await page.goto(`${BASE}${href}?page=${n}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const r = await response;
  const body = (await r.json()) as { '@odata.count'?: number; value?: SelgrosRecord[] };
  const market = (r.request().postData() ?? '').match(/markets\/any\(m: m eq (\d+)\)/)?.[1] ?? null;
  return { records: body.value ?? [], count: body['@odata.count'] ?? 0, market, fetchedAt: new Date().toISOString() };
}

/** All saved pages → the data file the app merges in. */
async function writeData(halls: Map<string, string>) {
  const dataset = JSON.parse(gunzipSync(await readFile('data/food/products.json.gz')).toString('utf8')) as Dataset;
  const known = {
    categories: new Set(Object.keys(dataset.dictionaries.categories)),
    allergens: new Set(Object.keys(dataset.dictionaries.allergens)),
  };
  const pages: SavedPage[] = [];
  for (const f of (await readdir(CACHE)).filter((f) => f.endsWith('.json')).sort()) {
    const saved = await readSaved(join(CACHE, f));
    if (saved) pages.push(saved);
  }

  const products: ChainProductData[] = [];
  const inconsistent: string[] = [];
  const seen = new Set<string>();
  const drop = { noEan: 0, noNutrition: 0, implausible: 0, duplicate: 0 };
  const unknownTags = new Set<string>();
  for (const pg of pages)
    for (const r of pg.records) {
      const base = baseUnit(r);
      const ean = (base?.eans ?? []).find(validEan);
      if (!ean) {
        drop.noEan++;
        continue;
      }
      if (seen.has(ean)) {
        drop.duplicate++;
        continue;
      }
      const nutrition = nutritionOf(r);
      if (!nutrition) {
        drop.noNutrition++;
        continue;
      }
      if (!plausible(nutrition)) {
        drop.implausible++;
        continue;
      }
      seen.add(ean);
      const brand = r.productBrand ? tidyBrand(r.productBrand) : null;
      const name = withBrand(tidyName(r.title), brand);
      const tags = categoriesFor(r.categoryPath, name);
      for (const t of tags) if (!known.categories.has(t)) unknownTags.add(t);
      const allergens = (r.productDetails?.find((d) => d.id === 'allergen')?.values ?? [])
        .filter((v) => /^tak$/i.test(v.value.trim()))
        .map((v) => allergenTag(v.label))
        .filter((t): t is string => !!t && known.allergens.has(t));
      const { price, perKg } = priceOf(r);
      products.push({
        ean,
        id: r.productId,
        name,
        brand,
        // „Waga” on the page is the gross weight (420 g for a 400 g lasagne); the title names the pack.
        quantity: quantityOf(r.title, base?.weight?.netValue),
        categories: tags.filter((t) => known.categories.has(t)),
        allergens: [...new Set(allergens)],
        nutrition,
        price,
        ...(perKg && { perKg: true as const }),
      });
      if (!labelAddsUp(nutrition)) inconsistent.push(ean);
    }
  products.sort((a, b) => a.name.localeCompare(b.name, 'pl') || a.ean.localeCompare(b.ean));
  const market = pages.find((p) => p.market)?.market ?? null;
  const data: ChainData = {
    id: 'selgros',
    name: 'Selgros',
    url: 'https://www.selgros.pl',
    productUrl: `${BASE}/znajdz-produkt/product/{id}`,
    // The day of the oldest page read: no price is newer than it says.
    checked: pages.map((p) => p.fetchedAt!).sort()[0]!.slice(0, 10),
    hall: market ? (halls.get(market) ?? `hala ${market}`) : null,
    note: 'Wyszukiwarka produktów selgros.pl: nazwa, marka, EAN, wartości odżywcze na 100 g, alergeny i cena regularna brutto z karty produktu.',
    inconsistent,
    products: [],
  };
  // One product per line: the file stays readable in a diff, and a quarter of the pretty size.
  const head = JSON.stringify(data, null, 2).replace(/,\n {2}"products": \[\]\n\}$/, '');
  const lines = products.map((p) => `    ${JSON.stringify(p)}`);
  await mkdir('src/food/chains/data', { recursive: true });
  await writeFile(OUT, `${head},\n  "products": [\n${lines.join(',\n')}\n  ]\n}\n`);
  console.log(`${OUT}: ${products.length} products (${inconsistent.length} with a label that does not add up)`);
  console.log(`dropped: ${JSON.stringify(drop)}`);
  if (unknownTags.size) console.log(`category tags not in the dictionary (left out): ${[...unknownTags].join(', ')}`);
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}
