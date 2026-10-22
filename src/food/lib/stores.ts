import { foldDiacritics } from './text';

export interface Store {
  key: string;
  label: string;
}

// Shared by the data pipeline (the products' free-text stores column) and the
// app (OpenStreetMap shop brands): both name a chain in many spellings.
//
// The stores column is free text typed by whoever added the product, so one
// chain arrives as "biedronka", "Biedronka ", "carrefour.fr", "Carrefour
// Market". Known chains are folded into one key; `\b` keeps "Dinozaur" from
// becoming Dino.
const CHAINS: { key: string; label: string; pattern: RegExp }[] = [
  { key: 'biedronka', label: 'Biedronka', pattern: /^biedronka\b/ },
  { key: 'lidl', label: 'Lidl', pattern: /^lidl\b/ },
  { key: 'kaufland', label: 'Kaufland', pattern: /^kaufland\b/ },
  { key: 'auchan', label: 'Auchan', pattern: /^auchan\b/ },
  { key: 'carrefour', label: 'Carrefour', pattern: /^carrefour\b/ },
  // i18n-ignore: chain name
  { key: 'zabka', label: 'Żabka', pattern: /^zabka\b/ },
  { key: 'dino', label: 'Dino', pattern: /^dino\b/ },
  { key: 'netto', label: 'Netto', pattern: /^netto\b/ },
  { key: 'aldi', label: 'Aldi', pattern: /^aldi\b/ },
  { key: 'tesco', label: 'Tesco', pattern: /^tesco\b/ },
  { key: 'rossmann', label: 'Rossmann', pattern: /^rossmann\b/ },
  { key: 'stokrotka', label: 'Stokrotka', pattern: /^stokrotka\b/ },
  { key: 'lewiatan', label: 'Lewiatan', pattern: /^lewiatan\b/ },
  { key: 'intermarche', label: 'Intermarché', pattern: /^intermarche\b/ },
  { key: 'polomarket', label: 'POLOmarket', pattern: /^polo\s*market\b/ },
  { key: 'spar', label: 'Spar', pattern: /^spar\b/ },
  { key: 'leclerc', label: 'E.Leclerc', pattern: /^(e\.?\s*)?leclerc\b/ },
  { key: 'makro', label: 'Makro', pattern: /^makro\b/ },
  { key: 'selgros', label: 'Selgros', pattern: /^selgros\b/ },
  { key: 'hebe', label: 'Hebe', pattern: /^hebe\b/ },
  { key: 'delikatesy-centrum', label: 'Delikatesy Centrum', pattern: /^delikatesy centrum\b/ },
  { key: 'frisco', label: 'Frisco', pattern: /^frisco\b/ },
];

/**
 * Cash & carry halls: a customer card at the door and often catering-size packs. A store like any
 * other once chosen (a filter, „W pobliżu”, the diet profile), but never the default suggestion
 * ahead of the supermarkets most people shop at.
 */
export const CASH_AND_CARRY: ReadonlySet<string> = new Set(['selgros', 'makro']);

const MAX_STORE_CHARS = 60;

export function storeKey(raw: string): Store | null {
  const label = raw.replace(/\s+/g, ' ').trim();
  if (!label || label.length > MAX_STORE_CHARS) return null;

  const folded = foldDiacritics(label.toLowerCase()).replace(/\.(pl|fr|de|com|eu)$/, '');
  const chain = CHAINS.find((c) => c.pattern.test(folded));
  if (chain) return { key: chain.key, label: chain.label };

  const key = folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return key ? { key, label } : null;
}

export function parseStores(field: string): Store[] {
  const seen = new Set<string>();
  const stores: Store[] = [];
  for (const piece of field.split(',')) {
    const store = storeKey(piece);
    if (store && !seen.has(store.key)) {
      seen.add(store.key);
      stores.push(store);
    }
  }
  return stores;
}
