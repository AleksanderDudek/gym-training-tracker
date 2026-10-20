import { addDays } from '../diet/model';
import { brandLine } from '../lib/display';
import { formatNumber, formatPrice } from '../lib/format';
import type { Dictionaries, IndexedProduct } from '../lib/types';
import { isOnlineShop } from '../online/shops';
import { servingsOf, type Recipe } from '../recipes/catalog';
import type { IngredientId } from '../recipes/ingredients';
import { resolveRecipe, type Basket, type Candidates, type ResolvedItem, type ResolvedRecipe } from '../recipes/resolve';
import { AISLE, AISLE_LABELS, AISLE_ORDER } from './aisles';
import { gramsLabel, rangeLabel } from './format';
import type { PrepPlan, ShoppingGroup, ShoppingItem } from './types';

/** A recipe eaten or cooked: `servings` of it on `date` (a cooking day for a batch). */
export interface RecipeUse {
  recipe: Recipe;
  servings: number;
  date: string;
}

/** A side next to a meal: so many grams of one staple or pantry ingredient on `date`. */
export interface SideUse {
  ingredient: IngredientId;
  grams: number;
  date: string;
}

/** One ingredient as a recipe, so a side is bought by exactly the rules recipes are. */
function itemRecipe(ingredient: IngredientId, grams: number): Recipe {
  return { id: `side-${ingredient}`, name: ingredient, kind: 'mix', minutes: 0, tool: '', description: '', items: [{ ingredient, grams }], steps: [] };
}

/** Never bought. */
const FREE: ReadonlySet<string> = new Set<IngredientId>(['water', 'ice']);

/**
 * Raw meat and fish: 1–2 days in the fridge (USDA FSIS, "Cold Food Storage Chart"). Needed from the
 * third day of the plan on, they go into the freezer after shopping.
 */
const RAW: ReadonlySet<string> = new Set<IngredientId>([
  'chickenFillet',
  'turkeyFillet',
  'turkeyMince',
  'leanBeef',
  'salmonFillet',
  'whiteFish',
]);
const FRIDGE_DAYS = 2;

/** Countable staples: a list says "6 jajek", not "300 g". The weights are the catalog's own measures. */
const PIECE_GRAMS: Partial<Record<IngredientId, number>> = {
  egg: 50,
  banana: 120,
  apple: 180,
  onion: 100,
  tomato: 120,
  pepper: 150,
  cucumber: 200,
  zucchini: 300,
  lemon: 100,
  avocado: 140,
  roll: 60,
};

/**
 * The size of what is taken off the shelf: "500 g", "1 kg", "0,5 l", "4 x 125 g" (the four together).
 * Unlike `packGrams` (one portion) a family pack counts here; anything unreadable is null.
 */
export function packSize(quantity: string | null): number | null {
  if (!quantity) return null;
  const text = quantity.toLowerCase().replace(',', '.');
  const multi = text.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  const single = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  const unit = (n: number, u: string) => n * (u === 'kg' || u === 'l' ? 1000 : 1);
  const grams = multi ? Number(multi[1]) * unit(Number(multi[2]), multi[3]!) : single ? unit(Number(single[1]), single[2]!) : null;
  return grams && grams >= 5 && grams <= 10_000 ? Math.round(grams) : null;
}

/** Packs to buy: a pack that covers all but 5 % still counts - nobody buys a second kilo for 30 g. */
export function packsFor(grams: number, pack: number): number {
  return Math.max(1, Math.ceil(grams / pack - 0.05));
}

function priceOf(product: IndexedProduct, shop: string | null, packs: number | null, packG: number | null, grams: number): number | null {
  const offer = shop ? product.online?.find((o) => o.shop === shop) : undefined;
  if (offer?.price != null && packs !== null) return Math.round(offer.price * packs * 100) / 100;
  const price = product.price;
  if (!price) return null;
  if (price.perKg) return Math.round(((packs !== null && packG !== null ? packs * packG : grams) / 1000) * price.value * 100) / 100;
  return packs !== null ? Math.round(price.value * packs * 100) / 100 : null;
}

interface Line {
  item: ResolvedItem;
  grams: number;
  uses: { date: string; grams: number }[];
}

export interface ShoppingInput {
  uses: readonly RecipeUse[];
  sides: readonly SideUse[];
  basket: Basket;
  candidates: Candidates;
  dict: Dictionaries;
  /** The shopping day: the plan's first. */
  start: string;
}

const GROUP_ORDER: Record<ShoppingGroup, number> = { visit: 0, order: 1, home: 2 };

/**
 * The plan's shopping: every ingredient added up over the plan, with the product the recipes were
 * computed from (one per ingredient - the basket's rules pick the same one for every recipe), in
 * packs, pieces or grams, with a price when one is known. A line is bought on the visit to the
 * physical shop, in the online order, or comes from home (pantry goods: check, buy when out).
 */
export function shoppingList({ uses, sides, basket, candidates, dict, start }: ShoppingInput): ShoppingItem[] {
  const resolved = new Map<string, ResolvedRecipe>();
  const resolve = (recipe: Recipe) => {
    let r = resolved.get(recipe.id);
    if (!r) {
      r = resolveRecipe(recipe, candidates, basket);
      resolved.set(recipe.id, r);
    }
    return r;
  };
  const lines = new Map<string, Line>();
  const add = (item: ResolvedItem, grams: number, date: string) => {
    if (FREE.has(item.def.id) || grams <= 0) return;
    const line = lines.get(item.def.id) ?? { item, grams: 0, uses: [] };
    line.grams += grams;
    line.uses.push({ date, grams });
    lines.set(item.def.id, line);
  };
  for (const use of uses) {
    const r = resolve(use.recipe);
    for (const item of r.items) add(item, (item.grams * use.servings) / servingsOf(use.recipe), use.date);
  }
  for (const side of sides) {
    if (side.grams <= 0) continue;
    const item = resolveRecipe(itemRecipe(side.ingredient, side.grams), candidates, basket).items[0]!;
    add(item, item.grams, side.date);
  }

  const physical = basket.find((s) => !isOnlineShop(s)) ?? null;
  const items: ShoppingItem[] = [];
  for (const [id, line] of lines) {
    const { item } = line;
    const product = item.product;
    const role = item.def.role;
    const shop = item.shop ?? (role === 'pantry' ? null : physical);
    const group: ShoppingGroup = role === 'pantry' ? 'home' : shop && isOnlineShop(shop) ? 'order' : 'visit';
    const packG = product ? packSize(product.quantity) : null;
    const packs = packG !== null ? packsFor(line.grams, packG) : null;
    const piece = PIECE_GRAMS[id as IngredientId];
    // A "pack" of one roll is a piece: the list says "4 szt.", not "4 × 60 g".
    const single = piece !== undefined && packG !== null && packG < 2 * piece;
    const freezeFrom = addDays(start, FRIDGE_DAYS);
    const freeze = new Map<string, number>();
    if (RAW.has(id)) for (const u of line.uses) if (u.date >= freezeFrom) freeze.set(u.date, (freeze.get(u.date) ?? 0) + u.grams);
    items.push({
      key: id,
      ingredient: id,
      label: item.def.label,
      role,
      shop: item.shop,
      group,
      aisle: AISLE[id as IngredientId] ?? 'inne',
      grams: Math.round(line.grams),
      product: product
        ? {
            code: product.code,
            name: product.name,
            brand: brandLine(product, dict) || null,
            quantity: product.quantity,
            url: (shop && product.online?.find((o) => o.shop === shop)?.url) ?? null,
          }
        : null,
      packs: single ? null : packs,
      packGrams: single ? null : packG,
      pieces: (packs === null || single) && piece ? Math.max(1, Math.round(line.grams / piece)) : null,
      price: product ? priceOf(product, shop, packs, packG, line.grams) : null,
      freeze: [...freeze].sort(([a], [b]) => a.localeCompare(b)).map(([date, grams]) => ({ date, grams: Math.round(grams) })),
    });
  }
  return items.sort(
    (a, b) =>
      GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
      (a.group === 'order' ? (a.shop ?? '').localeCompare(b.shop ?? '') : 0) ||
      AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle) ||
      a.label.localeCompare(b.label, 'pl'),
  );
}

/** "3 opak. · po 450 g", "1 opak. · 1 l", "14 szt.", "650 g" — what to take, in the pack's own words. */
export function amountText(item: ShoppingItem): string {
  if (item.packs !== null && item.packGrams !== null) {
    const size = item.product?.quantity?.trim() || gramsLabel(item.packGrams);
    return item.packs === 1 ? `1 opak. · ${size}` : `${item.packs} opak. · po ${size}`;
  }
  if (item.pieces !== null) return `${item.pieces} szt.`;
  return gramsLabel(item.grams);
}

/** The line's name on a list: the product when one is known, the ingredient otherwise. */
export const itemName = (item: ShoppingItem): string => item.product?.name ?? item.label;

/** Sum of the known prices of some lines, and how many lines have none. */
export function priceSum(items: readonly ShoppingItem[]): { total: number; known: number; unknown: number } {
  const known = items.filter((i) => i.price !== null);
  return {
    total: Math.round(known.reduce((s, i) => s + i.price!, 0) * 100) / 100,
    known: known.length,
    unknown: items.length - known.length,
  };
}

/**
 * Whether the known prices say anything about the total: at least half of the lines priced. A sum
 * of two prices out of thirty lines would read as the cost of the shopping.
 */
export const pricedEnough = (sum: { known: number; unknown: number }): boolean =>
  sum.known > 0 && sum.known >= sum.unknown;

/** The list as plain text, to send or paste into notes: shop by shop, aisle by aisle. */
export function shoppingText(plan: PrepPlan): string {
  const end = addDays(plan.settings.start, plan.settings.days - 1);
  const out = [`Lista zakupów · ${rangeLabel(plan.settings.start, end)}`];
  const physical = plan.shops.find((s) => !s.online);
  const groups: { title: string; items: ShoppingItem[] }[] = [
    { title: physical ? physical.name : 'Sklep', items: plan.shopping.filter((i) => i.group === 'visit') },
    ...plan.shops
      .filter((s) => s.online)
      .map((s) => ({ title: `${s.name} (zamówienie)`, items: plan.shopping.filter((i) => i.group === 'order' && i.shop === s.key) })),
    { title: 'Sprawdź w domu', items: plan.shopping.filter((i) => i.group === 'home') },
  ];
  for (const group of groups) {
    if (!group.items.length) continue;
    out.push('', group.title);
    let aisle: string | null = null;
    for (const item of group.items) {
      if (group.title !== 'Sprawdź w domu' && item.aisle !== aisle && item.group === 'visit') {
        aisle = item.aisle;
        out.push(`  ${AISLE_LABELS[item.aisle]}`);
      }
      const done = plan.bought.includes(item.key) ? '[x]' : '[ ]';
      const price = item.price !== null ? ` · ok. ${formatPrice(item.price)}` : '';
      out.push(`  ${done} ${itemName(item)} — ${amountText(item)}${price}`);
    }
  }
  const sum = priceSum(plan.shopping.filter((i) => i.group !== 'home'));
  if (pricedEnough(sum))
    out.push(
      '',
      `Razem ok. ${formatPrice(sum.total)} (ceny znane dla ${formatNumber(sum.known, 0)} z ${formatNumber(sum.known + sum.unknown, 0)} pozycji).`,
    );
  return out.join('\n');
}
