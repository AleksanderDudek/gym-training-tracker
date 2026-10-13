import { normalizeForSearch } from '../lib/text';
import type { IndexedProduct, Product } from '../lib/types';
import { isProteinForward, macrosOf, type Macros } from './macros';

export interface ReadyGroup {
  id: string;
  label: string;
  items: IndexedProduct[];
}

const PROTEIN_WORD = /\b(protein\w*|bialk\w*|wysokobialkow\w*|high protein)\b/;
const DRINK_WORD = /\b(pitn\w*|drink|napoj\w*|shake|koktajl\w*|milk|mleko)\b/;

const has = (p: Product, ...tags: string[]) => tags.some((t) => p.categories.includes(t));

/** A bar that calls itself protein (by category or by name). `name` is folded (`normalizeForSearch`). */
export const isProteinBar = (p: Product, name: string): boolean =>
  has(p, 'en:protein-bars', 'en:protein-energy-bars') || (/\b(baton\w*|bar)\b/.test(name) && PROTEIN_WORD.test(name));

/** A drink that calls itself protein: a shake, a drinking yoghurt or skyr, a protein milk. */
export const isProteinDrink = (p: Product, name: string): boolean =>
  has(p, 'en:protein-shakes') || (PROTEIN_WORD.test(name) && DRINK_WORD.test(name));

// The first group to CLAIM a product decides it, so the order matters: a
// protein shake is a drink before it is a dairy product. A claimed product
// that is not PLAUSIBLE for its group is dropped rather than passed on: a
// "bar" with 75 g protein per 100 g is a data error, not a powder.
const GROUPS: {
  id: string;
  label: string;
  claims: (p: Product, name: string, m: Macros) => boolean;
  plausible: (m: Macros) => boolean;
}[] = [
  {
    id: 'batony',
    label: 'Batony białkowe',
    claims: isProteinBar,
    plausible: (m) => m.protein <= 55 && m.kcal >= 200 && m.kcal <= 550,
  },
  {
    id: 'odzywki',
    label: 'Białko w proszku',
    // By name, or by macros: nothing but a powder is half protein at 300+ kcal.
    claims: (p, name, m) =>
      has(p, 'en:protein-powders', 'en:whey-powder') ||
      /\b(whey|wpc|wpi)\b|odzywka bialkowa/.test(name) ||
      (PROTEIN_WORD.test(name) && m.protein >= 50 && m.kcal >= 300),
    plausible: (m) => m.protein >= 50,
  },
  {
    id: 'napoje',
    label: "Napoje i shake'i białkowe",
    claims: isProteinDrink,
    plausible: (m) => m.kcal <= 150,
  },
  {
    id: 'twarogi',
    label: 'Twarogi i serki wiejskie',
    claims: (p, name) =>
      has(p, 'en:quarks', 'en:lean-quark', 'en:cottage-cheeses') ||
      /serek wiejski|\btwarog\w*|twarozek|cottage/.test(name),
    plausible: (m) => m.kcal <= 200,
  },
  {
    id: 'nabial',
    label: 'Skyry, jogurty i desery białkowe',
    // A hard cheese that calls itself high-protein is still a cheese.
    claims: (p, name) =>
      /\bskyr\b/.test(name) ||
      (PROTEIN_WORD.test(name) &&
        !has(p, 'en:cheeses') &&
        has(p, 'en:dairies', 'en:yogurts', 'en:desserts', 'en:dairy-desserts', 'en:fermented-milk-products')),
    plausible: (m) => m.kcal <= 200,
  },
];

/** Display order: snacks first, powders last (they are a recipe ingredient more than a snack). */
const ORDER = ['batony', 'napoje', 'nabial', 'twarogi', 'odzywki'];

function density(p: Product): number {
  return p.nutrition.kcal ? (p.nutrition.protein ?? 0) / p.nutrition.kcal : 0;
}

/**
 * Ready-to-eat products that obey the rule per 100 g, grouped, best protein
 * per calorie first. With a store, only what that store sells; with several
 * (the chains near you), what any of them sells.
 */
export function readyProducts(products: IndexedProduct[], store: string | readonly string[] | null): ReadyGroup[] {
  const stores = store === null ? null : typeof store === 'string' ? [store] : store;
  const buckets = new Map<string, IndexedProduct[]>(GROUPS.map((g) => [g.id, []]));
  for (const p of products) {
    if (stores && !stores.some((s) => p.stores.includes(s))) continue;
    if (p.labelMismatch) continue;
    const per100 = macrosOf(p);
    if (!per100 || !isProteinForward(per100)) continue;
    const name = normalizeForSearch(p.name);
    const group = GROUPS.find((g) => g.claims(p, name, per100));
    if (group?.plausible(per100)) buckets.get(group.id)!.push(p);
  }
  return ORDER.map((id) => {
    const group = GROUPS.find((g) => g.id === id)!;
    const items = buckets
      .get(id)!
      .sort((a, b) => density(b) - density(a) || (b.popularity ?? -1) - (a.popularity ?? -1));
    return { id, label: group.label, items };
  }).filter((g) => g.items.length > 0);
}
