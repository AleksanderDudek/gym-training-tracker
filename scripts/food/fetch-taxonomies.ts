// Downloads the Open Food Facts taxonomies that give tags their Polish names.
// Usage: npm run food:taxonomies
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchWithRetry } from './http';

const NAMES = ['categories', 'labels', 'allergens', 'additives'] as const;
const OUT_DIR = 'data/food/raw/taxonomies';

await mkdir(OUT_DIR, { recursive: true });
for (const name of NAMES) {
  const url = `https://static.openfoodfacts.org/data/taxonomies/${name}.json`;
  const response = await fetchWithRetry(url);
  const body = await response.text();
  JSON.parse(body); // refuse to save something that is not JSON
  await writeFile(join(OUT_DIR, `${name}.json`), body);
  console.log(`${name}: ${(body.length / 1024).toFixed(0)} KB`);
}
