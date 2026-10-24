// How meal-prep plans come out on the real data: for the best physical shops (alone and with the
// broadest online shop) and every eating style, a week of four meals - how close each day gets to its
// targets, which recipes were chosen, and what the shopping list holds (lines, packs, known prices).
// Usage: npm run food:check-prep
import './lib/polish';
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { mergeChains } from '../../src/food/chains/merge';
import type { ChainData } from '../../src/food/chains/types';
import { completeProfile } from '../../src/food/diet/store';
import { DIET_PROFILE_IDS, DIET_PROFILES } from '../../src/food/diet/profiles';
import { indexProducts } from '../../src/food/lib/search';
import type { Dataset } from '../../src/food/lib/types';
import { mergeOnline } from '../../src/food/online/merge';
import type { ShopData } from '../../src/food/online/types';
import { planDates } from '../../src/food/prep/blocks';
import { generatePlan } from '../../src/food/prep/generate';
import { dayPlanTotals } from '../../src/food/prep/meals';
import { amountText, itemName, priceSum } from '../../src/food/prep/shopping';
import { planTargets } from '../../src/food/prep/targets';
import { recipeIndex } from '../../src/food/recipes/resolve';

const SHOP_DIR = 'src/food/online/data';
const CHAIN_DIR = 'src/food/chains/data';
const json = async <T>(dir: string) =>
  Promise.all(
    (await readdir(dir)).filter((f) => f.endsWith('.json')).map(async (f) => JSON.parse(await readFile(`${dir}/${f}`, 'utf8')) as T),
  );
const offData = JSON.parse(gunzipSync(await readFile('data/food/products.json.gz')).toString('utf8')) as Dataset;
const dataset = mergeOnline(mergeChains(offData, await json<ChainData>(CHAIN_DIR)), await json<ShopData>(SHOP_DIR));
const products = indexProducts(dataset.products, dataset.dictionaries.brands);
const index = recipeIndex(products);
const dict = dataset.dictionaries;
const START = '2026-10-20';
const profile = completeProfile({ sex: 'M', age: 30, heightCm: 180, startWeightKg: 84, targetWeightKg: 78, dailyKcal: 2200 });

const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
const baskets: [string, string | null][] = [
  ...index.ranking.slice(0, 4).map((s): [string, string | null] => [s, null]),
  [index.ranking[0]!, index.online[0] ?? null],
];

let shown = false;
for (const [store, online] of baskets) {
  for (const style of DIET_PROFILE_IDS) {
    const p = { ...profile, dietProfile: style };
    const t0 = performance.now();
    const result = generatePlan({
      settings: { start: START, days: 7, meals: 4, cooking: 'lunch', store, online, exclude: [], seed: 1, avoid: [] },
      index,
      dict,
      dayTargets: planTargets({ profile: p, kcal: 2200, eaten: new Map(), today: START, dates: planDates(START, 7) }),
      goal: { kcal: 2200, source: 'profile', dietProfile: style, styleLabel: DIET_PROFILES[style].label, pace: 0.5, weightKg: 84 },
      checkIn: null,
    });
    const ms = Math.round(performance.now() - t0);
    const label = `${[store, online].filter(Boolean).join('+').padEnd(20)} ${style.padEnd(12)}`;
    if (!result.ok) {
      console.log(`${label} NO PLAN  ${result.message}`);
      continue;
    }
    const plan = result.plan;
    let worst = 0;
    let carbsOver = 0;
    let proteinShort = 0;
    for (const { date, targets } of plan.dayTargets) {
      const t = dayPlanTotals(plan, date);
      const dev = (t.kcal - targets.kcal) / targets.kcal;
      if (Math.abs(dev) > Math.abs(worst)) worst = dev;
      if (targets.carbs.max !== null && t.carbs > targets.carbs.max) carbsOver++;
      if (t.protein < targets.protein.min) proteinShort++;
    }
    const sum = priceSum(plan.shopping.filter((i) => i.group !== 'home'));
    console.log(
      `${label} ${String(ms).padStart(4)} ms  worst day ${pct(worst).padStart(6)}  protein<min ${proteinShort}  carbs>limit ${carbsOver}  ` +
        `list ${plan.shopping.length} lines, ~${sum.total.toFixed(0)} zł (${sum.known}/${sum.known + sum.unknown} priced)  ` +
        `${Object.entries(plan.choices)
          .map(([role, ids]) => `${role}:${ids.join(',')}`)
          .join(' ')}`,
    );
    if (!shown && style === 'redukcja') {
      shown = true;
      for (const item of plan.shopping)
        console.log(`    ${item.group.padEnd(5)} ${item.aisle.padEnd(8)} ${itemName(item).slice(0, 48).padEnd(48)} ${amountText(item).padEnd(26)} ${item.price ?? ''}`);
    }
  }
}
