import { normalizeForSearch } from '../lib/text';

/** Folded the same way on both sides: lower case, no diacritics, punctuation as spaces. */
const fold = (s: string) => normalizeForSearch(s.replace(/[^\p{L}\p{N}]+/gu, ' '));

/**
 * Which chain's menu a place serves, from the brand it shows in OpenStreetMap: its folded tag
 * equals one of the chain's `osm.brands` or starts with it followed by a word break - "BP" finds
 * "BP Express" but not "Bperfect". The longest brand wins, so "Caffè Nero" never takes a "Green
 * Caffè Nero" from a chain that names both.
 */
export function brandIndex<T extends { osm?: { brands: string[] } | undefined }>(chains: T[]): (brand: string) => T | null {
  const entries = chains
    .flatMap((chain) => (chain.osm?.brands ?? []).map((b) => ({ key: fold(b), chain })))
    .filter((e) => e.key)
    .sort((a, b) => b.key.length - a.key.length);
  return (brand) => {
    const tag = fold(brand);
    const hit = entries.find((e) => tag === e.key || tag.startsWith(`${e.key} `));
    return hit?.chain ?? null;
  };
}
