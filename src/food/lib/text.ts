// Shared by the data scripts and the app. No imports, so it compiles under
// both the bundler and the nodenext configurations.

/**
 * Removes diacritics. `ł`/`Ł` are mapped by hand: they are letters in their own
 * right in Unicode, not `l` plus a combining mark, so NFD leaves them alone —
 * the usual reason accent-folding silently misses Polish.
 */
export function foldDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
}

export function normalizeForSearch(text: string): string {
  return foldDiacritics(text.toLowerCase()).replace(/\s+/g, ' ').trim();
}

export function tokenize(query: string): string[] {
  return normalizeForSearch(query).split(' ').filter(Boolean);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase('pl-PL') + text.slice(1) : text;
}

/** `pl:twarogi-polskie` -> `Twarogi polskie`. */
export function humanizeTag(tag: string): string {
  const withoutLang = tag.replace(/^[a-z]{2,3}:/, '');
  return capitalize(withoutLang.replace(/-/g, ' ').trim());
}
