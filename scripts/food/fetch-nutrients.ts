// Builds src/food/labs/data/nutrients.json: per 100 g of each lab food (src/food/labs/foods.ts),
// the nutrients a lab focus works with, from USDA FoodData Central SR Legacy (April 2018), and
// iodine - which SR barely has - from the USDA/FDA/ODS-NIH Iodine Database (Release 4, 2024).
// Both are public domain. Downloads are kept in ~/.cache/gym-tracker/fdc/ and reused; delete a
// file there to fetch it again. A missing FDC id, or an iodine row that is not what this file
// expects, stops the run.
// Usage: npx tsx scripts/food/fetch-nutrients.ts
import './lib/polish';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { lastRow, readWorkbook } from '../../src/food/diet/xlsx';
import { LAB_FOODS } from '../../src/food/labs/foods';
import { fetchWithRetry } from './http';

const CACHE = join(homedir(), '.cache/gym-tracker/fdc');
const OUT = 'src/food/labs/data/nutrients.json';

const SR = {
  name: 'USDA FoodData Central, SR Legacy (April 2018)',
  url: 'https://fdc.nal.usda.gov/download-datasets',
  zip: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  file: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
};
const IODINE = {
  name: 'USDA, FDA and ODS-NIH Database for the Iodine Content of Common Foods, Release 4 (October 2024)',
  url: 'https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/methods-and-application-of-food-composition-laboratory/mafcl-site-pages/iodine/',
  zip: 'https://www.ars.usda.gov/ARSUserFiles/80400535/Data/Iodine/IODINE_RELEASE_4.zip',
  file: 'IODINE_RELEASE_4.zip',
  sheet: 'Iodine Database_Release 4_Per 100g.xlsx',
};

type Key = (typeof KEYS)[number];
const KEYS = [
  'kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugars', 'satFat',
  'iron', 'zinc', 'magnesium', 'calcium', 'potassium', 'sodium', 'phosphorus', 'selenium', 'iodine',
  'vitC', 'vitD', 'vitB12', 'folate', 'vitA', 'vitE', 'vitK', 'vitB6',
  'epaDha', 'ala', 'cholesterol',
] as const;

const UNITS: Record<Key, string> = {
  kcal: 'kcal', protein: 'g', carbs: 'g', fat: 'g', fiber: 'g', sugars: 'g', satFat: 'g',
  iron: 'mg', zinc: 'mg', magnesium: 'mg', calcium: 'mg', potassium: 'mg', sodium: 'mg', phosphorus: 'mg',
  selenium: 'µg', iodine: 'µg', vitC: 'mg', vitD: 'µg', vitB12: 'µg', folate: 'µg', vitA: 'µg', vitE: 'mg',
  vitK: 'µg', vitB6: 'mg', epaDha: 'g', ala: 'g', cholesterol: 'mg',
};

/** FDC nutrient ids (nutrient.csv `id`, not the SR number), first one present wins. */
const SOURCES: Record<Exclude<Key, 'epaDha'>, number[]> = {
  kcal: [1008],
  protein: [1003],
  carbs: [1005],
  fat: [1004],
  fiber: [1079],
  sugars: [2000, 1063],
  satFat: [1258],
  iron: [1089],
  zinc: [1095],
  magnesium: [1090],
  calcium: [1087],
  potassium: [1092],
  sodium: [1093],
  phosphorus: [1091],
  selenium: [1103],
  iodine: [1100],
  vitC: [1162],
  // 1114 is D2 + D3 in µg; 1110 is the same in IU (40 IU = 1 µg), used when only that is given.
  vitD: [1114, 1110],
  vitB12: [1178],
  // DFE; for unfortified food DFE, food folate and total folate are the same number.
  folate: [1190, 1187, 1177],
  vitA: [1106],
  vitE: [1109],
  vitK: [1185],
  vitB6: [1175],
  // 18:3 n-3 ALA; else total 18:3, which in these foods is almost all ALA.
  ala: [1404, 1270],
  cholesterol: [1253],
};
const EPA = 1278;
const DHA = 1272;
const VIT_D_IU = 1110;
const ALA_TOTAL_18_3 = 1270;
const FOLATE_DFE = 1190;
const FOLATE_FOOD = 1187;

/**
 * Iodine rows standing in for a food whose own SR row the database does not list (same food,
 * another variant or state). Keyed by the database's DB_ID, with a piece of its description so
 * a renumbered release fails instead of borrowing the wrong row. Foods matched by SR number need
 * no entry. Fish, meat and grains differ too much between variants to borrow across.
 */
const IODINE_STAND_INS: Record<string, [dbId: number, description: string]> = {
  // Unfortified milks: the database measured the fortified ones; vitamins A and D add no iodine.
  milk: [21, 'Milk, reduced fat (2%)'],
  milkWhole: [20, 'Milk, whole'],
  // Kefir's row is cultured reduced-fat milk; the database has the low-fat one.
  kefir: [446, 'Milk, buttermilk, lowfat'],
  pollock: [396, 'Fish, pollock, Alaska, raw'],
  eggWhite: [358, 'Egg, white, raw, frozen, pasteurized'],
  butter: [91, 'Butter, salted'],
  cod: [498, 'Fish, cod, Atlantic, wild, raw'],
  chickenSliced: [261, 'Luncheon meat (chicken/turkey)'],
  kidneyBeans: [271, 'Beans, kidney, canned, drained'],
  chickpeas: [456, 'Beans, garbanzo (chickpeas), canned, drained solids'],
  peanutButter: [38, 'Peanut butter, smooth/creamy'],
  sunflowerSeeds: [168, 'Seeds, sunflower, shelled'],
  cashews: [455, 'Nuts, cashew'],
  flour: [16, 'Flour, white, all-purpose'],
  wholemealRoll: [48, 'Bread, whole-wheat, commercially prepared'],
  rapeseedOil: [183, 'Oil, vegetable'],
  cocoa: [488, 'Cocoa powder'],
  // Vegetables: raw or boiled, the values are a few µg at most either way.
  carrot: [175, 'Carrot, baby, raw'],
  cucumber: [79, 'Cucumber, peeled, raw'],
  redPepper: [80, 'Pepper, bell, green, raw'],
  fermentedCucumber: [89, 'dill, cucumber'],
  broccoli: [72, 'Broccoli, fresh/frozen, boiled'],
  brusselsSprouts: [140, 'Brussels sprouts, fresh/frozen, boiled'],
  cauliflower: [75, 'Cauliflower, fresh/frozen, boiled'],
  greenBeans: [77, 'Green beans, fresh/frozen, boiled'],
  greenPeas: [37, 'Peas, green, fresh/frozen, boiled'],
  zucchini: [205, 'Squash, summer, zucchini'],
  potato: [84, 'Potato, with peel, baked'],
  passata: [220, 'Sauce, tomato, canned/bottled'],
};

async function cached(url: string, file: string): Promise<Uint8Array> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    await mkdir(CACHE, { recursive: true });
    console.log(`downloading ${url}`);
    const response = await fetchWithRetry(url);
    await writeFile(path, new Uint8Array(await response.arrayBuffer()));
  }
  return new Uint8Array(await readFile(path));
}

/** One CSV record; FDC quotes every field and doubles quotes inside one. */
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
      i++; // the comma
    } else {
      const c = line.indexOf(',', i);
      const end = c < 0 ? line.length : c;
      out.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return out;
}

function* rows(csv: string): Generator<string[]> {
  const lines = csv.split(/\r?\n/);
  for (let n = 1; n < lines.length; n++) if (lines[n]) yield fields(lines[n]!);
}

/** Three significant digits: 1919.0 -> 1920, 0.06234 -> 0.0623. */
const round = (v: number): number => Number(v.toPrecision(3)) || 0;

// --- SR Legacy ---

const srZip = await cached(SR.zip, SR.file);
const DIR = SR.file.replace(/\.zip$/, '');
const WANTED = new Set(['food.csv', 'food_nutrient.csv', 'sr_legacy_food.csv']);
const parts = unzipSync(srZip, { filter: (f) => WANTED.has(f.name.replace(`${DIR}/`, '')) });
const part = (name: string) => {
  const bytes = parts[`${DIR}/${name}`];
  if (!bytes) throw new Error(`${SR.file} has no ${name}`);
  return strFromU8(bytes);
};

const wanted = new Set(LAB_FOODS.map((f) => f.fdc));
if (wanted.size !== LAB_FOODS.length) throw new Error('two lab foods share an FDC id');

const descriptions = new Map<number, string>();
for (const [fdc, type, description] of rows(part('food.csv'))) {
  const id = Number(fdc);
  if (!wanted.has(id)) continue;
  if (type !== 'sr_legacy_food') throw new Error(`FDC ${id} is ${type}, not SR Legacy`);
  descriptions.set(id, description!);
}
const missing = LAB_FOODS.filter((f) => !descriptions.has(f.fdc));
if (missing.length) throw new Error(`not in SR Legacy: ${missing.map((f) => `${f.id} (${f.fdc})`).join(', ')}`);

const ndbOf = new Map<number, number>();
for (const [fdc, ndb] of rows(part('sr_legacy_food.csv'))) {
  if (wanted.has(Number(fdc))) ndbOf.set(Number(fdc), Number(ndb));
}

const amounts = new Map<number, Map<number, number>>();
for (const [, fdc, nutrient, amount] of rows(part('food_nutrient.csv'))) {
  const id = Number(fdc);
  if (!wanted.has(id) || amount === '') continue;
  let m = amounts.get(id);
  if (!m) amounts.set(id, (m = new Map()));
  m.set(Number(nutrient), Number(amount));
}

// --- Iodine database ---

interface IodineRow {
  dbId: number;
  ndb: number | null;
  description: string;
  value: number;
}
const iodineZip = unzipSync(await cached(IODINE.zip, IODINE.file), { filter: (f) => f.name === IODINE.sheet });
const book = iodineZip[IODINE.sheet];
if (!book) throw new Error(`${IODINE.file} has no ${IODINE.sheet}`);
const sheet = readWorkbook(book).values().next().value;
if (!sheet) throw new Error(`${IODINE.sheet} has no sheet`);
if (!String(sheet.get('F2') ?? '').startsWith('Iodine mcg/100g')) throw new Error(`${IODINE.sheet}: column F is not iodine per 100 g`);
const iodineRows: IodineRow[] = [];
for (let r = 3; r <= lastRow(sheet); r++) {
  const dbId = sheet.get(`A${r}`);
  const value = sheet.get(`F${r}`);
  if (typeof dbId !== 'number' || typeof value !== 'number') continue;
  // "01123", "01253 (100297)", "16123/16124"; an asterisk marks a variant (iodate dough conditioner).
  const ref = String(sheet.get(`B${r}`) ?? '').trim();
  const ndb = ref.match(/^\d{4,5}(?=\s|$)/)?.[0];
  iodineRows.push({ dbId, ndb: ndb ? Number(ndb) : null, description: String(sheet.get(`D${r}`) ?? '').trim(), value });
}
const iodineByNdb = new Map(iodineRows.filter((r) => r.ndb !== null).map((r) => [r.ndb!, r]));
const iodineById = new Map(iodineRows.map((r) => [r.dbId, r]));

for (const [food, [dbId, piece]] of Object.entries(IODINE_STAND_INS)) {
  if (!LAB_FOODS.some((f) => f.id === food)) throw new Error(`iodine stand-in for unknown food ${food}`);
  const row = iodineById.get(dbId);
  if (!row?.description.includes(piece)) throw new Error(`iodine DB_ID ${dbId} is "${row?.description}", expected "${piece}"`);
}

// --- Build ---

const notes = {
  folate: 'µg DFE (dietary folate equivalents); food folate where SR gives no DFE - the same number for unfortified food',
  vitD: 'Vitamin D2 + D3 in µg (FDC nutrient 1114, SR 328); from IU / 40 where only IU is given',
  vitA: 'µg RAE',
  vitE: 'mg alpha-tocopherol',
  vitK: 'µg phylloquinone (K1); menaquinones not included',
  epaDha: 'g EPA (20:5 n-3) + DHA (22:6 n-3); DPA (22:5 n-3) not included',
  ala: 'g ALA (18:3 n-3); total 18:3 where SR does not split it',
  iodine:
    'SR Legacy rarely gives iodine; the Iodine Database row with the same SR number, or a listed stand-in (same food, another variant or state); null where neither exists',
  folateFromFood: [] as string[],
  vitDFromIU: [] as string[],
  alaFromTotal18_3: [] as string[],
  iodineSources: {} as Record<string, string>,
};

const foods: Record<string, Record<Key, number | null>> = {};
const warnings: string[] = [];
for (const food of [...LAB_FOODS].sort((a, b) => (a.id < b.id ? -1 : 1))) {
  const m = amounts.get(food.fdc) ?? new Map<number, number>();
  const row = {} as Record<Key, number | null>;
  for (const key of KEYS) {
    if (key === 'epaDha') {
      const epa = m.get(EPA);
      const dha = m.get(DHA);
      row.epaDha = epa === undefined && dha === undefined ? null : round((epa ?? 0) + (dha ?? 0));
      continue;
    }
    const id = SOURCES[key].find((n) => m.has(n));
    if (id === undefined) {
      row[key] = null;
      continue;
    }
    let v = m.get(id)!;
    if (id === VIT_D_IU) {
      v /= 40;
      notes.vitDFromIU.push(food.id);
    }
    if (key === 'ala' && id === ALA_TOTAL_18_3) notes.alaFromTotal18_3.push(food.id);
    if (key === 'folate' && id !== FOLATE_DFE) notes.folateFromFood.push(food.id);
    row[key] = round(v);
  }

  if (row.iodine !== null) notes.iodineSources[food.id] = 'SR Legacy';
  else {
    const exact = iodineByNdb.get(ndbOf.get(food.fdc) ?? -1);
    const standIn = IODINE_STAND_INS[food.id];
    const source = exact ?? (standIn ? iodineById.get(standIn[0]) : undefined);
    if (source) {
      row.iodine = round(source.value);
      notes.iodineSources[food.id] = `${exact ? 'same food' : 'stand-in'}: #${source.dbId} ${source.description}`;
    }
  }

  // Fortification shows as folic acid (DFE well above food folate) or vitamin D in plain dairy.
  const dfe = m.get(FOLATE_DFE);
  const foodFolate = m.get(FOLATE_FOOD);
  if (dfe !== undefined && foodFolate !== undefined && dfe > foodFolate * 1.1 + 1)
    warnings.push(`${food.id}: folate DFE ${dfe} > food folate ${foodFolate} (folic acid added?)`);
  if (food.group === 'dairy' && (row.vitD ?? 0) > 0.5) warnings.push(`${food.id}: vitamin D ${row.vitD} µg (fortified?)`);
  if (row.kcal === null) throw new Error(`${food.id} (${food.fdc}) has no energy value`);
  foods[food.id] = row;
}

const fetched = (await stat(join(CACHE, SR.file))).mtime.toISOString().slice(0, 10);
const head = {
  source: {
    name: `${SR.name}; iodine: ${IODINE.name}`,
    url: SR.url,
    iodineUrl: IODINE.url,
    license: 'CC0 1.0 / public domain',
    fetched,
  },
  units: UNITS,
  notes,
};
const lines = Object.entries(foods).map(([id, row]) => `    ${JSON.stringify(id)}: ${JSON.stringify(row)}`);
await mkdir('src/food/labs/data', { recursive: true });
await writeFile(OUT, `${JSON.stringify(head, null, 2).replace(/\n\}$/, '')},\n  "foods": {\n${lines.join(',\n')}\n  }\n}\n`);

const iodineCount = Object.keys(notes.iodineSources).length;
console.log(`${OUT}: ${lines.length} foods, iodine for ${iodineCount}`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const f of LAB_FOODS) console.log(`  ${f.id.padEnd(18)} ${String(f.fdc).padEnd(7)} ${descriptions.get(f.fdc)}`);
