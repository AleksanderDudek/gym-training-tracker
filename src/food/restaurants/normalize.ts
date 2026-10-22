import { CATEGORY_LABELS, CATEGORY_TEXT, type Chain, type ChainData, type MenuItem, type MenuItemData } from './types';
import { foldMenuText, slug } from './text';

/**
 * Ids from names: "big-mac". Two positions with the same name (a burger and
 * its double, sizes listed as separate rows) get the portion too:
 * "frytki-male", "frytki-duze". The id only has to be unique in its chain.
 */
function ids(chain: ChainData): string[] {
  const byName = chain.items.map((item) => slug(item.name));
  const counts = new Map<string, number>();
  for (const id of byName) counts.set(id, (counts.get(id) ?? 0) + 1);
  const seen = new Map<string, number>();
  return chain.items.map((item, i) => {
    const base = counts.get(byName[i]!)! > 1 ? slug(`${item.name} ${item.portion}`) : byName[i]!;
    // Same name AND portion (a data slip): a counter keeps the address unique.
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base}-${n}` : base;
  });
}

/**
 * Energy from the macros, against the label: ±15 %, or ±25 kcal for small
 * items. Fibre and polyols move real labels a little; a slip moves them a lot.
 */
export function energyAgrees(i: Pick<MenuItemData, 'kcal' | 'protein' | 'carbs' | 'fat'>): boolean {
  const atwater = 4 * i.protein + 4 * i.carbs + 9 * i.fat;
  return Math.abs(atwater - i.kcal) <= (i.kcal < 170 ? 25 : i.kcal * 0.15);
}

/** A chain as the app holds it: items with ids, menu order and search text. */
export function normalizeChain(data: ChainData): Chain {
  const itemIds = ids(data);
  const listed = new Set(data.source.inconsistent ?? []);
  const items: MenuItem[] = data.items.map((item, order) => ({
    ...item,
    id: itemIds[order]!,
    order,
    searchText: foldMenuText(
      [data.name, item.name, item.portion, ...new Set([CATEGORY_TEXT.pl[item.category], CATEGORY_LABELS[item.category]])].join(' '),
    ),
    inconsistent: listed.has(item.name) || listed.has(`${item.name} · ${item.portion}`) || !energyAgrees(item),
  }));
  return { ...data, items };
}

export function chainById(chains: Chain[], id: string | null): Chain | null {
  return (id && chains.find((c) => c.id === id)) || null;
}
