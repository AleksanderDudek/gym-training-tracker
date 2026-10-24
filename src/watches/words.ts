// The words of the watch check (spec 2026-10-24 §4.11): how a typed name, or an official one,
// becomes words that can be compared. Pure and without imports, so the app's matcher (`list.ts`,
// `find.ts`) and the list generator (`scripts/garmin/lib.ts`) fold names the same way. No DOM, no
// i18n: these are words people type, matched and dropped, never shown.

export interface Tokens {
  words: string[];
  /** A region word was typed: the person has the Asian (APAC) version. */
  apac: boolean;
  /** „nie wiem”, „nie pamiętam”: the person does not know the model. */
  help?: true;
}

/** Lower case, no diacritics (ē, í, ł too), no ®™©. */
export const fold = (s: string): string =>
  s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '').replace(/[®™©]/g, '');

/** The brand: a word that never tells watches apart, but typing it means „some Garmin”. */
export const BRAND = 'garmin';

/** Words that never tell watches apart: dropped from what the person typed (also with Polish endings). */
const NOISE = new Set([
  BRAND, 'zegarek', 'zegarka', 'zegarku', 'smartwatch', 'smartwatcha', 'watch', 'mam', 'moj', 'moja', 'my', 'ja',
  // i18n-ignore: words people type, matched and dropped — never shown
  'model', 'gps', 'sport', 'sportowy', 'edition', 'edycja', 'wersja', 'version', 'series', 'seria', 'the',
  'do', 'z', 'ze', 'w', 'na', 'dla', 'od', 'moim', 'mojego',
  // „stary garmin” is a prompt, not Star Wars; „mój zegarek to fenix 7” is the fēnix 7.
  'stary', 'stara', 'stare', 'starego', 'starej', 'starszy', 'starsza', 'starsze',
  'nowy', 'nowa', 'nowe', 'nowego', 'nowej', 'nowszy', 'nowsza', 'nowsze',
  'jakis', 'jaki', 'jaka', 'jakie', 'ktory', 'ktora', 'ktore', 'chyba', 'to', 'jest',
]);

/** Marketing words: they never change the answer within a line, so a mismatch costs little. */
const SOFT = new Set([
  'solar', 'sapphire', 'szafir', 'amoled', 'microled', 'tactical', 'camo', 'surf', 'ocean', 'carbon', 'titanium',
  'tytan', 'dual', 'power', 'collection', 'damascus', 'steel', 'ballistics', 'elite', 'inreach', 'wi', 'fi', 'no',
  'benz', 'explore', 'wifi', 'bez',
]);

/** The person has the Asian version. */
const APAC = new Set(['apac', 'asia', 'asian', 'azja', 'azji', 'azjatycka', 'azjatycki', 'azjatyckiej']);

/** Other words for the same thing (`canon` also takes them with a Polish ending). */
const SYNONYM: Record<string, string> = {
  fr: 'forerunner',
  foreathlete: 'forerunner',
  feniks: 'fenix',
  phoenix: 'fenix',
  instynkt: 'instinct',
  instinkt: 'instinct',
  va: 'vivoactive',
  vivoaktive: 'vivoactive',
  vivoactiv: 'vivoactive',
  square: 'sq',
  muzyka: 'music',
  muzyki: 'music',
  muzyke: 'music',
  szafir: 'sapphire',
  szafirowy: 'sapphire',
  szafirowa: 'sapphire',
  szafirowe: 'sapphire',
};

/** Polish endings of a synonym: „feniksa”, „instynktem”. */
const ENDINGS = ['ami', 'ach', 'em', 'ie', 'ow', 'om', 'a', 'u', 'y'];

const canon = (w: string): string => {
  if (SYNONYM[w]) return SYNONYM[w]!;
  for (const e of ENDINGS) {
    const base = w.slice(0, -e.length);
    if (w.length > e.length + 3 && w.endsWith(e) && SYNONYM[base]) return SYNONYM[base]!;
  }
  return w;
};

const ORDINAL: Record<string, string> = {
  '1st': '1', first: '1', pierwsza: '1', pierwszej: '1', pierwszy: '1', pierwszego: '1',
  '2nd': '2', second: '2', druga: '2', drugiej: '2', drugi: '2', ii: '2',
  '3rd': '3', third: '3', trzecia: '3', trzeciej: '3', trzeci: '3', iii: '3',
};
const GEN = new Set(['gen', 'generacja', 'generacji', 'generation']);

/** Line names: a query made of these alone asks about the whole line. */
export const SERIES_WORDS = new Set([
  'forerunner', 'fenix', 'venu', 'vivoactive', 'instinct', 'epix', 'marq', 'descent', 'approach', 'enduro', 'quatix',
  'tactix', 'edge', 'legacy', 'vivosmart', 'vivofit', 'vivomove', 'lily', 'gpsmap', 'sq', 'pro',
]);

/**
 * „I don't know the model”: the answer opens „Gdzie znajdę nazwę modelu?” instead of guessing.
 * Folded words, longest phrases first.
 */
const HELP: string[][] = [
  ['nie', 'mam', 'pojecia'],
  ['nie', 'jestem', 'pewien'],
  ['nie', 'jestem', 'pewna'],
  ['nie', 'jestem', 'pewny'],
  ['i', 'do', 'not', 'know'],
  ['i', 'don', 't', 'know'],
  ['i', 'dont', 'know'],
  ['do', 'not', 'know'],
  ['don', 't', 'know'],
  ['i', 'forgot'],
  ['nie', 'wiem'],
  ['nie', 'znam'],
  ['nie', 'pamietam'],
  ['dont', 'know'],
  ['no', 'idea'],
  ['not', 'sure'],
  ['zapomnialem'],
  ['zapomnialam'],
  ['forgot'],
];

const phraseAt = (words: string[], at: number, phrase: string[]): boolean =>
  phrase.every((w, j) => words[at + j] === w);

/** Takes the „I don't know” phrases out of the words: what is left, and whether there was one. */
function withoutHelp(words: string[]): { words: string[]; help: boolean } {
  let out = words;
  let help = false;
  for (const phrase of HELP) {
    for (let i = 0; i + phrase.length <= out.length; ) {
      if (phraseAt(out, i, phrase)) {
        out = [...out.slice(0, i), ...out.slice(i + phrase.length)];
        help = true;
      } else i++;
    }
  }
  return { words: out, help };
}

/** „Fēnix® 7X Pro (Gen 2) 47 mm” → fenix 7 x pro gen2 47mm. */
export function tokenize(s: string): Tokens {
  const split = fold(s)
    .replace(/\+/g, ' plus ')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1$2 ')
    .replace(/(\d)(?![\d]|st\b|nd\b|rd\b|th\b)(\p{L})/gu, '$1 $2')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const { words: t, help } = withoutHelp(split);
  const out: string[] = [];
  let apac = false;
  for (let i = 0; i < t.length; i++) {
    let w = t[i]!;
    const next = t[i + 1];
    const afterNumber = /^\d+$/.test(out.at(-1) ?? '');
    if (APAC.has(w)) {
      apac = true;
      continue;
    }
    if (w === 'wi' && next === 'fi') {
      out.push('wifi');
      i++;
      continue;
    }
    if (w === 'vivo' && next === 'active') {
      out.push('vivoactive');
      i++;
      continue;
    }
    if (GEN.has(w) && next && /^\d$/.test(next)) {
      out.push(`gen${next}`);
      i++;
      continue;
    }
    const ord = ORDINAL[w] ?? (/^\d$/.test(w) ? w : undefined);
    if (ord && next && GEN.has(next)) {
      out.push(`gen${ord}`);
      i++;
      continue;
    }
    if (ORDINAL[w]) {
      out.push(`gen${ORDINAL[w]}`);
      continue;
    }
    if (/^\d+$/.test(w) && next === 'mm') {
      out.push(`${w}mm`);
      i++;
      continue;
    }
    // „255sm”: the store's short form of „255s Music”.
    if (w === 'sm' && afterNumber) {
      out.push('s', 'music');
      continue;
    }
    if (w === 'm' && afterNumber) w = 'music';
    out.push(canon(w));
  }
  return { words: out, apac, ...(help && { help: true as const }) };
}

/** Polish endings: „mam forerunnera”, „do fenixa”, „instinctem”. */
const SUFFIX = new Set(['a', 'u', 'em', 'ie', 'y', 'ow', 'om', 'ach', 'ami']);

/** `w` is `base` with a Polish ending. */
export const inflected = (w: string, base: string): boolean =>
  base.length >= 4 && w.startsWith(base) && SUFFIX.has(w.slice(base.length));

const NOISE_LIST = [...NOISE];
/** Asked for every word of every name on each keystroke: remembered once per word. */
const noiseSeen = new Map<string, boolean>();

export function isNoise(w: string): boolean {
  let noise = noiseSeen.get(w);
  if (noise === undefined) {
    noise = NOISE.has(w) || NOISE_LIST.some((n) => inflected(w, n));
    noiseSeen.set(w, noise);
  }
  return noise;
}

export const isSoft = (w: string): boolean => SOFT.has(w);

/** Typed while still writing „garmin”: „ga”, „garm”. */
export const brandPrefix = (w: string): boolean => w.length >= 2 && w.length < BRAND.length && BRAND.startsWith(w);

export const hasDigit = (w: string): boolean => /\d/.test(w);
export const isNum = (w: string): boolean => /^\d+$/.test(w);
export const isSize = (w: string): boolean => /^\d+mm$/.test(w);

/** Optimal string alignment distance, stopped early above `max`. */
export function typos(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}
