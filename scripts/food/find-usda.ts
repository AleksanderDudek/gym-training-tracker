// Finds USDA foods for the photo catalog's sources: every FNDDS survey food (by food code) and SR
// Legacy food (by FDC id) whose description holds all the words given, with kcal per 100 g, so a
// dish can name `F(code, '…')` or `S(id, '…')` in `scripts/food/dish-sources/`. Reads the same cached
// downloads as fetch-dishes.ts (run that once first).
// Usage: npx tsx scripts/food/find-usda.ts tikka masala [--sr] [--all]
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

const args = process.argv.slice(2);
const words = args.filter((a) => !a.startsWith('--')).map((w) => w.toLowerCase());
const onlySr = args.includes('--sr');
const all = args.includes('--all');
if (!words.length) {
  console.log('usage: npx tsx scripts/food/find-usda.ts <words…> [--sr] [--all]');
  process.exit(1);
}

const SOURCES = [
  { db: 'FNDDS', file: join(homedir(), '.cache/gym-tracker/fndds/FoodData_Central_survey_food_csv_2024-10-31.zip'), fndds: true },
  { db: 'SR', file: join(homedir(), '.cache/gym-tracker/fdc/FoodData_Central_sr_legacy_food_csv_2018-04.zip'), fndds: false },
];

/** One CSV record; FDC quotes every field and doubles quotes inside one (as in fetch-dishes.ts). */
function fields(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = '';
      i++;
      for (;;) {
        const q = line.indexOf('"', i);
        if (q < 0) throw new Error(`unterminated quote: ${line.slice(0, 80)}`);
        value += line.slice(i, q);
        if (line[q + 1] === '"') {
          value += '"';
          i = q + 2;
        } else {
          i = q + 1;
          break;
        }
      }
      out.push(value);
      i++;
    } else {
      const c = line.indexOf(',', i);
      const end = c < 0 ? line.length : c;
      out.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return out;
}

const rows = (csv: string) =>
  csv
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map(fields);

for (const src of SOURCES) {
  if (onlySr && src.fndds) continue;
  const dir = src.file.split('/').pop()!.replace(/\.zip$/, '');
  const wanted = ['food.csv', 'food_nutrient.csv', 'survey_fndds_food.csv'];
  const parts = unzipSync(new Uint8Array(await readFile(src.file)), { filter: (f) => wanted.includes(f.name.replace(`${dir}/`, '')) });
  const part = (n: string) => strFromU8(parts[`${dir}/${n}`] ?? new Uint8Array());
  const codeOf = new Map<string, string>();
  if (src.fndds) for (const [fdc, code] of rows(part('survey_fndds_food.csv'))) codeOf.set(fdc!, code!);
  const hits = new Map<string, { key: string; text: string }>();
  for (const [fdc, , text] of rows(part('food.csv'))) {
    const t = (text ?? '').toLowerCase();
    if (!words.every((w) => t.includes(w))) continue;
    const key = src.fndds ? codeOf.get(fdc!) : fdc;
    if (key) hits.set(fdc!, { key, text: text! });
  }
  // Energy: nutrient number 208 in FNDDS, FDC nutrient id 1008 (or the Atwater ones) in SR.
  const kcal = new Map<string, number>();
  for (const [, fdc, nutrient, amount] of rows(part('food_nutrient.csv'))) {
    if (!hits.has(fdc!) || kcal.has(fdc!)) continue;
    if (nutrient === '208' || nutrient === '1008' || nutrient === '2047' || nutrient === '2048') kcal.set(fdc!, Number(amount));
  }
  const list = [...hits].map(([fdc, h]) => ({ ...h, kcal: kcal.get(fdc) })).sort((a, b) => a.text.length - b.text.length);
  console.log(`\n${src.db}: ${list.length} match${list.length === 1 ? '' : 'es'}${src.fndds ? '  → F(code, …)' : '  → S(id, …)'}`);
  for (const h of all ? list : list.slice(0, 25)) console.log(`  ${h.key.padEnd(9)} ${String(h.kcal ?? '?').padStart(5)} kcal  ${h.text}`);
  if (!all && list.length > 25) console.log(`  … ${list.length - 25} more (--all)`);
}
