// A product with a price reported in PLN is on sale in Poland, whether or not
// anyone tagged it with the country. This pulls those rows out of the FULL Open
// Food Facts dump so prepare-data can include them: about half of the priced
// products are missing from a countries_tags=en:poland extract.
// Usage: npm run food:extract-priced -- path/to/en.openfoodfacts.org.products.csv
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { OpenPriceItem } from './lib/prices';

const DUMP_PATH = process.argv[2];
const PRICES_PATH = 'data/food/raw/prices.json';
const OUT_PATH = 'data/food/raw/off_priced.csv';

if (!DUMP_PATH || !existsSync(DUMP_PATH)) {
  console.error('Pass the path to the full en.openfoodfacts.org.products.csv dump.');
  process.exit(1);
}
if (!existsSync(PRICES_PATH)) {
  console.error('No prices yet: run npm run food:prices first.');
  process.exit(1);
}

const { items } = JSON.parse(await readFile(PRICES_PATH, 'utf8')) as { items: OpenPriceItem[] };
const wanted = new Set(items.map((i) => i.product_code?.trim()).filter((c): c is string => !!c));

const out = createWriteStream(OUT_PATH);
const lines = createInterface({ input: createReadStream(DUMP_PATH, 'utf8'), crlfDelay: Infinity });
let isHeader = true;
let scanned = 0;
let found = 0;
for await (const line of lines) {
  if (isHeader) {
    out.write(line + '\n');
    isHeader = false;
    continue;
  }
  scanned++;
  // Only the first field is needed to decide, so split nothing else.
  const code = line.slice(0, line.indexOf('\t'));
  if (wanted.has(code)) {
    out.write(line + '\n');
    found++;
  }
  if (scanned % 500_000 === 0) process.stdout.write(`\r${scanned} rows, ${found} priced`);
}
await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
console.log(`\n${found} of ${wanted.size} priced products found in ${scanned} rows -> ${OUT_PATH}`);
