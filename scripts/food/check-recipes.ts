// How the recipe catalog meets the real data: candidates per ingredient, which
// shops cover each recipe (one shop, or a shop and an online shop), and what
// the default variant looks like. Chains' and online shops' data is merged as the app does.
// Usage: npm run food:check-recipes
import './lib/polish';
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { indexProducts } from '../../src/food/lib/search';
import type { Dataset } from '../../src/food/lib/types';
import { RECIPES, servingsOf } from '../../src/food/recipes/catalog';
import { INGREDIENTS } from '../../src/food/recipes/ingredients';
import { readyProducts } from '../../src/food/recipes/ready';
import { mergeChains } from '../../src/food/chains/merge';
import type { ChainData } from '../../src/food/chains/types';
import { mergeOnline } from '../../src/food/online/merge';
import type { ShopData } from '../../src/food/online/types';
import { basketsFor } from '../../src/food/recipes/baskets';
import {
  availableStores,
  bestVariant,
  buildCandidates,
  onlineRanking,
  resolveRecipe,
  storeRanking,
} from '../../src/food/recipes/resolve';
import { byTime, tierOf } from '../../src/food/recipes/tiers';

const SHOP_DIR = 'src/food/online/data';
const CHAIN_DIR = 'src/food/chains/data';
const shops = await Promise.all(
  (await readdir(SHOP_DIR))
    .filter((f) => f.endsWith('.json'))
    .map(async (f) => JSON.parse(await readFile(`${SHOP_DIR}/${f}`, 'utf8')) as ShopData),
);
const offData = JSON.parse(gunzipSync(await readFile('data/food/products.json.gz')).toString('utf8')) as Dataset;
const chains = await Promise.all(
  (await readdir(CHAIN_DIR))
    .filter((f) => f.endsWith('.json'))
    .map(async (f) => JSON.parse(await readFile(`${CHAIN_DIR}/${f}`, 'utf8')) as ChainData),
);
const dataset = mergeOnline(mergeChains(offData, chains), shops);
const products = indexProducts(dataset.products, dataset.dictionaries.brands);
const candidates = buildCandidates(products);
const ranking = storeRanking(RECIPES, candidates);
const online = onlineRanking(candidates);

console.log('INGREDIENTS (candidates, top stores)');
for (const def of Object.values(INGREDIENTS)) {
  const list = candidates.get(def.id);
  if (!list) continue;
  const stores = new Map<string, number>();
  for (const p of list) for (const s of p.stores) stores.set(s, (stores.get(s) ?? 0) + 1);
  const top = [...stores]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([s, n]) => `${s}:${n}`)
    .join(' ');
  console.log(
    `  ${def.id.padEnd(14)} ${def.role.padEnd(7)} ${String(list.length).padStart(4)}  ${top}  | #1 ${list[0]?.name ?? '-'}`,
  );
}

console.log(`\nSTORE RANKING: ${ranking.join(', ')}`);
console.log(`ONLINE SHOPS: ${online.join(', ') || '-'} (merged ${shops.length} shop files)`);
console.log('Macros are PER SERVING; "x3" is a recipe for three.\n');
for (const recipe of [...RECIPES].sort(byTime)) {
  const baskets = basketsFor(recipe, candidates, ranking, online);
  const stores = baskets.length
    ? baskets.slice(0, 6).map((b) => b.join('+'))
    : availableStores(recipe, candidates, ranking);
  const v = baskets.length ? resolveRecipe(recipe, candidates, baskets[0]!) : bestVariant(recipe, candidates, ranking);
  const t = v?.perServing;
  const macros = t
    ? `P ${t.protein.toFixed(0)} / C ${t.carbs.toFixed(0)} / F ${t.fat.toFixed(0)} / ${t.kcal.toFixed(0)} kcal`
    : 'NOT AVAILABLE';
  const when = `${tierOf(recipe.minutes).padEnd(7)} ${String(recipe.minutes).padStart(2)}' x${servingsOf(recipe)}`;
  console.log(
    `${recipe.id.padEnd(20)} ${when}  ${macros.padEnd(36)} default: ${v ? v.stores.join('+') || 'anywhere' : '-'}  | baskets: ${stores.join(', ') || '-'}`,
  );
  if (v)
    for (const i of v.items)
      console.log(
        `    ${i.def.id.padEnd(13)} ${i.product ? i.product.name : '(typical values)'}${i.shop ? `  @${i.shop}` : i.product ? '  [not from this store]' : ''}`,
      );
}

console.log('\nREADY PRODUCTS (pass the rule per 100 g)');
for (const store of [null, ...ranking.slice(0, 4)]) {
  const groups = readyProducts(products, store);
  console.log(`  ${(store ?? 'all').padEnd(10)} ${groups.map((g) => `${g.id}:${g.items.length}`).join('  ')}`);
}
for (const g of readyProducts(products, null))
  console.log(
    `  ${g.id.padEnd(8)} top: ${g.items
      .slice(0, 3)
      .map((p) => `${p.name} (${p.nutrition.protein}/${p.nutrition.carbs}/${p.nutrition.fat})`)
      .join(' | ')}`,
  );
