// The data contract of the restaurant menus: one JSON file per chain in
// ./data, transcribed from the chain's own nutrition table (see README,
// "Jedzenie"). Values are PER PORTION as served; null means not published.

export const MENU_CATEGORIES = [
  'burger',
  'kanapka',
  'kurczak',
  'pizza',
  'salatka',
  'sniadanie',
  'danie',
  'zupa',
  'dodatek',
  'deser',
  'kawa',
  'napoj',
  'sos',
] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

/** Polish labels, in the order the chips show them: meals, then sides, sweets, drinks and sauces. */
export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  burger: 'Burgery',
  kanapka: 'Kanapki i wrapy',
  kurczak: 'Kurczak',
  pizza: 'Pizza',
  salatka: 'Sałatki i bowle',
  sniadanie: 'Śniadania',
  danie: 'Dania',
  zupa: 'Zupy',
  dodatek: 'Frytki i dodatki',
  deser: 'Desery',
  kawa: 'Kawa i napoje gorące',
  napoj: 'Napoje zimne',
  sos: 'Sosy',
};

export const CHAIN_KINDS = ['fast-food', 'kawiarnia', 'pizzeria', 'stacja', 'bar'] as const;
export type ChainKind = (typeof CHAIN_KINDS)[number];

export const CHAIN_KIND_LABELS: Record<ChainKind, string> = {
  'fast-food': 'Fast food',
  kawiarnia: 'Kawiarnia',
  pizzeria: 'Pizzeria',
  stacja: 'Stacja paliw',
  bar: 'Bar i restauracja',
};

/** Headings of the chain list, grouped by kind. */
export const CHAIN_KIND_GROUPS: Record<ChainKind, string> = {
  'fast-food': 'Fast food',
  kawiarnia: 'Kawiarnie',
  pizzeria: 'Pizzerie',
  stacja: 'Stacje paliw',
  bar: 'Bary i restauracje',
};

/** One menu position as the file has it. */
export interface MenuItemData {
  name: string;
  category: MenuCategory;
  /** The portion in words: "1 szt.", "średnie", "Grande 473 ml", "cała pizza 30 cm". */
  portion: string;
  /** Portion weight in grams (drinks: millilitres), when published. */
  grams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number | null;
  fiber: number | null;
  saturatedFat: number | null;
  salt: number | null;
  /** The per-portion values were computed from per-100 g ones and the portion weight. */
  computed?: true;
  /** The product page the values came from, when not the chain's main table. */
  url?: string;
}

export interface ChainData {
  id: string;
  name: string;
  kind: ChainKind;
  /** Whose menu the numbers are from: "PL", or another market when the Polish one publishes none. */
  market: string;
  source: {
    url: string;
    title: string;
    checked: string;
    note?: string;
    /**
     * Positions whose numbers the chain's own table gets wrong (energy not what the macros give,
     * more sugars than carbohydrates): "Muffin Choco" for every portion, "Americano · Grande" for
     * one. Checked against the source and kept as published; the app says so on screen.
     */
    inconsistent?: string[];
  };
  items: MenuItemData[];
}

export interface MenuItem extends MenuItemData {
  /** Unique within the chain, stable across data updates as long as the name is: "big-mac". */
  id: string;
  /** Position in the chain's file: the menu's own order. */
  order: number;
  /** Folded chain, name, portion and category, for search. */
  searchText: string;
  /**
   * The chain's own numbers disagree (see `source.inconsistent`), or the energy
   * is not what the macros give beyond rounding. Kept as published - which
   * number is wrong nobody knows - and said on screen.
   */
  inconsistent: boolean;
}

export interface Chain extends Omit<ChainData, 'items'> {
  items: MenuItem[];
}
