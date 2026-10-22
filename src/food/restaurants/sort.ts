import { text } from '../../i18n';
import type { MenuItem } from './types';

export type MenuSort = 'menu' | 'bialko' | 'kcal' | 'gestosc';

/** Polish keys: they are what a link shows (`?sort=bialko`). */
export const SORT_LABELS: Record<MenuSort, string> = text({
  pl: {
    menu: 'Jak w menu',
    bialko: 'Najwięcej białka',
    kcal: 'Najmniej kcal',
    gestosc: 'Białko na kcal',
  },
  en: {
    menu: 'As on the menu',
    bialko: 'Most protein',
    kcal: 'Fewest kcal',
    gestosc: 'Protein per kcal',
  },
});

const density = (i: MenuItem) => (i.kcal > 0 ? i.protein / i.kcal : 0);

const COMPARE: Record<MenuSort, (a: MenuItem, b: MenuItem) => number> = {
  menu: () => 0,
  bialko: (a, b) => b.protein - a.protein,
  kcal: (a, b) => a.kcal - b.kcal,
  gestosc: (a, b) => density(b) - density(a),
};

/** Sorted copy; ties keep the menu's order. */
export function sortItems(items: MenuItem[], sort: MenuSort): MenuItem[] {
  return [...items].sort((a, b) => COMPARE[sort](a, b) || a.order - b.order);
}

/** A position worth recommending for protein: a real portion of it, not a latte with 12 g. */
export const TOP_PROTEIN_MIN = 15;

/**
 * "Najwięcej białka" at the top of a chain: the positions that give the most
 * protein per calorie among those with at least 15 g of it. Sauces and sides
 * are never a protein choice, and a position whose own numbers disagree is
 * never recommended.
 */
export function topProtein(items: MenuItem[], limit = 3): MenuItem[] {
  return sortItems(
    items.filter(
      (i) => i.protein >= TOP_PROTEIN_MIN && i.category !== 'sos' && i.category !== 'dodatek' && !i.inconsistent,
    ),
    'gestosc',
  ).slice(0, limit);
}
