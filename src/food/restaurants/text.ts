import { normalizeForSearch } from '../lib/text';

/**
 * Search text without apostrophes: "McDonald's", "mcdonalds" and "Mc Donald's"
 * are one chain to whoever types it. Other punctuation becomes a space.
 */
export function foldMenuText(text: string): string {
  return normalizeForSearch(text.replace(/['’`]/g, '').replace(/[^\p{L}\p{N}%]+/gu, ' '));
}

export function menuTokens(query: string): string[] {
  return foldMenuText(query).split(' ').filter(Boolean);
}

/** "Frytki średnie" -> "frytki-srednie": ASCII, for addresses. */
export function slug(text: string): string {
  return foldMenuText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
