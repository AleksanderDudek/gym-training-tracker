// The watch check's matcher (spec 2026-10-24 §4.11): what a typed name means, as the prototype
// built it — copied verbatim apart from the types (`types.ts`) and the data (`list.ts`, imported
// instead of read from disk). Package W1 owns it from here. Pure, no DOM, no i18n.
import { EXTRA, NICKNAMES, type ExtraItem } from './extra';
import { GARMIN } from './list';
import type { Answer, Hit, SdkUnsupported, Supported, Target, Tokens, Verdict } from './types';

/* ---------------- data ---------------- */

const data: { supported: Supported[]; unsupported: SdkUnsupported[] } = GARMIN;

const supportedVerdict = (s: Supported): Verdict =>
  s.newest?.length
    ? { kind: 'update', newest: s.newest, lacks: s.lacks ?? [] }
    : s.lacks?.length
      ? { kind: 'limited', lacks: s.lacks }
      : { kind: 'full' };

const extraVerdict = (x: ExtraItem): Verdict => {
  switch (x.reason) {
    case 'noCiq':
      return { kind: 'noCiq' };
    case 'notWatch':
      return { kind: 'notWatch', what: x.kind as 'band' | 'scale' | 'bike' };
    case 'notYet':
      return { kind: 'notYet' };
    case 'regional':
      return { kind: 'regional', of: x.of! };
    case 'otherBrand':
      return { kind: 'otherBrand', ...(x.app ? { app: x.app } : {}), ...(x.only ? { only: x.only } : {}), bike: x.kind === 'bike' };
  }
};

/* ---------------- words ---------------- */

/** Lower case, no diacritics (ē, í, ł too), no ®™©. */
export const fold = (s: string): string =>
  s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '').replace(/[®™©]/g, '');

/** Words that never tell watches apart: dropped from what the person typed. */
const NOISE = new Set([
  'garmin', 'zegarek', 'zegarka', 'zegarku', 'smartwatch', 'smartwatcha', 'watch', 'mam', 'moj', 'moja', 'my',
  // i18n-ignore: words people type, matched and dropped — never shown
  'model', 'gps', 'sport', 'sportowy', 'edition', 'edycja', 'wersja', 'version', 'series', 'seria', 'the',
  'do', 'z', 'ze', 'w', 'na', 'dla', 'od', 'moim', 'mojego',
]);
/** Marketing words: they never change the answer within a line, so a mismatch costs little. */
const SOFT = new Set([
  'solar', 'sapphire', 'szafir', 'amoled', 'microled', 'tactical', 'camo', 'surf', 'ocean', 'carbon', 'titanium',
  'tytan', 'dual', 'power', 'collection', 'damascus', 'steel', 'ballistics', 'elite', 'inreach', 'wi', 'fi', 'no',
  'benz', 'explore', 'wifi', 'bez',
]);
/** The person has the Asian version. */
const APAC = new Set(['apac', 'asia', 'asian', 'azja', 'azji', 'azjatycka', 'azjatycki', 'azjatyckiej']);
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
};
/** A synonym also with a Polish ending: „feniksa”, „instynktem”. */
const ENDINGS = ['ami', 'ach', 'em', 'ie', 'ow', 'om', 'a', 'u', 'y'];
const canon = (w: string): string => {
  if (SYNONYM[w]) return SYNONYM[w]!;
  for (const e of ENDINGS) if (w.length > e.length + 3 && w.endsWith(e) && SYNONYM[w.slice(0, -e.length)]) return SYNONYM[w.slice(0, -e.length)]!;
  return w;
};
const ORDINAL: Record<string, string> = {
  '1st': '1', first: '1', pierwsza: '1', pierwszej: '1', pierwszy: '1', pierwszego: '1',
  '2nd': '2', second: '2', druga: '2', drugiej: '2', drugi: '2', ii: '2',
  '3rd': '3', third: '3', trzecia: '3', trzeciej: '3', trzeci: '3', iii: '3',
};
const GEN = new Set(['gen', 'generacja', 'generacji', 'generation']);
/** Line names: a query made of these alone asks about the whole line. */
const SERIES_WORDS = new Set([
  'forerunner', 'fenix', 'venu', 'vivoactive', 'instinct', 'epix', 'marq', 'descent', 'approach', 'enduro', 'quatix',
  'tactix', 'edge', 'legacy', 'vivosmart', 'vivofit', 'vivomove', 'lily', 'gpsmap', 'sq', 'pro',
]);

/** „Fēnix® 7X Pro (Gen 2) 47 mm” → fenix 7 x pro gen2 47mm. */
export function tokenize(s: string): Tokens {
  const t = fold(s)
    .replace(/\+/g, ' plus ')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1$2 ')
    .replace(/(\d)(?![\d]|st\b|nd\b|rd\b|th\b)(\p{L})/gu, '$1 $2')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const out: string[] = [];
  let apac = false;
  for (let i = 0; i < t.length; i++) {
    let w = t[i]!;
    const next = t[i + 1];
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
    if (w === 'm' && /^\d+$/.test(out.at(-1) ?? '')) w = 'music';
    out.push(canon(w));
  }
  return { words: out, apac };
}

/* ---------------- index ---------------- */

interface Entry {
  name: string;
  /** Shown instead of `name` when the name is only a spelling („epix 2” → „epix™ (Gen 2)”). */
  shown: string;
  words: string[];
  target: Target;
  /** Only the Asian version carries this name („Instinct 2 Dual Power”). */
  apac: boolean;
  /** Stands for a whole line: model words after it don't disqualify („Galaxy Watch 7”). */
  open: boolean;
  /** An official or curated name (shown as the title); a store spelling is shown only when it is what the person typed. */
  official: boolean;
}

const targets: Target[] = [];
const entries: Entry[] = [];
const add = (
  t: Target,
  names: string[],
  o: { apac?: boolean; open?: (n: string) => boolean; shown?: (n: string) => string; official?: boolean } = {},
) => {
  for (const name of names)
    entries.push({
      name,
      shown: o.shown?.(name) ?? name,
      words: tokenize(name).words,
      target: t,
      apac: o.apac ?? false,
      open: o.open?.(name) ?? false,
      official: o.official ?? true,
    });
};
const apacTwin = new Set<string>();
for (const s of data.supported) {
  const t: Target = { key: s.id, id: s.id, series: s.series, names: s.names, verdict: supportedVerdict(s) };
  targets.push(t);
  add(t, [...(NICKNAMES[s.id] ?? []), ...s.names]);
  add(t, s.aliases ?? [], { official: false });
  // „epix 2”, „MARQ 2 Aviator”: how people say Gen 2. Shown as the official name.
  for (const n of s.names.filter((x) => x.includes('(Gen 2)'))) add(t, [n.replace('(Gen 2)', '2')], { shown: () => n });
  if (s.apac?.names?.length) {
    apacTwin.add(s.id);
    const a: Target = { key: `${s.id}:apac`, id: s.id, series: s.series, names: s.apac.names, verdict: { kind: 'apac', lacks: s.apac.lacks } };
    targets.push(a);
    add(a, s.apac.names, { apac: true });
  }
}
const supportedKeys = new Set(entries.map((e) => e.words.join(' ')));
for (const u of data.unsupported) {
  const verdict: Verdict =
    u.reason === 'notWatch' ? { kind: 'notWatch', what: u.kind! } : u.reason === 'notListed' ? { kind: 'noCiq' } : { kind: u.reason, ciq: u.ciq! };
  const t: Target = { key: u.id, series: u.series, names: u.names, verdict };
  targets.push(t);
  // A store alias that spells a supported name („vívoactive 3 Music” on the LTE model) is dropped: supported wins.
  const free = (n: string) => !supportedKeys.has(tokenize(n).words.join(' '));
  add(t, u.names.filter(free));
  add(t, (u.aliases ?? []).filter(free), { official: false });
}
for (const x of EXTRA) {
  const t: Target = { key: x.key, series: x.series ?? '', names: x.names, verdict: extraVerdict(x) };
  targets.push(t);
  add(t, x.names, { apac: x.reason === 'regional', open: (n) => x.open === true || (x.open ?? []).includes(n) });
}

/* ---------------- matching ---------------- */

/** Polish endings: „mam forerunnera”, „do fenixa”, „instinctem”. */
const SUFFIX = new Set(['a', 'u', 'em', 'ie', 'y', 'ow', 'om', 'ach', 'ami']);
const inflected = (w: string, base: string): boolean => base.length >= 4 && w.startsWith(base) && SUFFIX.has(w.slice(base.length));
const isNoise = (w: string): boolean => NOISE.has(w) || [...NOISE].some((n) => inflected(w, n));

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

const hasDigit = (w: string): boolean => /\d/.test(w);
const isNum = (w: string): boolean => /^\d+$/.test(w);
const isSize = (w: string): boolean => /^\d+mm$/.test(w);

/** How well one typed word fits one word of a name: 0 — not at all. */
function fit(q: string, c: string, last: boolean, typing: boolean): number {
  if (q === c) return 1;
  if (isNum(q) && (c === `${q}mm` || c === `gen${q}`)) return 0.9;
  if (typing && last && c.startsWith(q)) return isNum(q) ? 0.6 : 0.75;
  // Numbers are model numbers: „265” is not „255”, and „gen 2” is not „gen 3”.
  if (hasDigit(q) || hasDigit(c)) return 0;
  if (inflected(q, c)) return 0.95;
  if (q.length >= 4 && c.length >= 3) {
    const max = q.length >= 8 ? 2 : 1;
    if (typos(q, c, max) <= max) return 0.6;
  }
  return 0;
}

/**
 * What the person may mean. `typing`: the last word may be unfinished („fr 2” → 245, 255, 265).
 * Every typed word has to fit a word of the name, except noise and marketing words; numbers fit
 * exactly — „Forerunner 975” is not the 970.
 */
/** Every word some name has — to take apart words typed without a space („7xpro”, „venusq”). */
const VOCAB = new Set(entries.flatMap((e) => e.words));
const unglue = (w: string): string[] => {
  if (VOCAB.has(w) || w.length < 4 || hasDigit(w)) return [w];
  for (let i = w.length - 1; i >= 1; i--) {
    const a = w.slice(0, i);
    const b = w.slice(i);
    if (VOCAB.has(a) && VOCAB.has(b)) return [a, b];
  }
  return [w];
};

export function search(query: string, typing = false): { hits: Hit[]; apac: boolean; words: string[] } {
  const { words: raw, apac } = tokenize(query);
  // The last word may still be typed: never take it apart while typing.
  const words = raw.flatMap((w, i) => (typing && i === raw.length - 1 ? [w] : unglue(w)));
  const q = words.filter((w) => !isNoise(w));
  if (!q.length) return { hits: [], apac, words: q };
  const best = new Map<string, { official?: Hit; alias?: Hit }>();
  for (const e of entries) {
    const used = new Set<number>();
    let score = 0;
    let spare = 0;
    let lastMatched = -1;
    let firstSpare = Infinity;
    let fuzzy = false;
    for (let i = 0; i < q.length; i++) {
      const w = q[i]!;
      let top = 0;
      let at = -1;
      e.words.forEach((c, j) => {
        if (used.has(j)) return;
        const f = fit(w, c, i === q.length - 1, typing);
        if (f > top) {
          top = f;
          at = j;
        }
      });
      if (top > 0) {
        used.add(at);
        score += top;
        lastMatched = i;
        if (top === 0.6 && !(typing && i === q.length - 1)) fuzzy = true;
      } else if (SOFT.has(w)) score -= 0.2;
      // „fēnix 7 Pro 47 mm”: the name has no size, so a typed size tells nothing against it.
      else if ((isSize(w) || (isNum(w) && i > 0 && Number(w) >= 38 && Number(w) <= 54)) && !e.words.some(isSize)) score -= 0.1;
      else {
        spare++;
        firstSpare = Math.min(firstSpare, i);
      }
    }
    if (used.size === 0) continue;
    const rest = e.words.filter((c, j) => !used.has(j) && !isSize(c) && !SOFT.has(c) && !isNoise(c));
    // A typed word that fits nothing is fine only after a whole line name („Galaxy Watch 7”).
    if (spare && !(e.open && rest.length === 0 && firstSpare > lastMatched)) continue;
    const exact = rest.length === 0 && spare === 0 && !fuzzy;
    score += exact ? 0.5 : -0.15 * rest.length;
    score -= 0.3 * spare + 0.01 * e.words.length;
    const k = e.target.verdict.kind;
    if (apac) {
      if (k === 'apac' || k === 'regional') score += 1;
      else if (e.target.id && apacTwin.has(e.target.id)) score -= 0.5;
    } else if (k === 'apac') score -= 1;
    else if (k === 'regional') score -= 2;
    const hit: Hit = { target: e.target, name: e.shown, score, exact, fuzzy };
    const slot = best.get(e.target.key) ?? {};
    const which = e.official ? 'official' : 'alias';
    if (!slot[which] || score > slot[which]!.score) slot[which] = hit;
    best.set(e.target.key, slot);
  }
  // A store spelling becomes the title only for a word no official name has („158”, „GarminActive”);
  // a marketing word („Sapphire Solar Edition”) never does.
  const hard = (name: string): Set<string> => new Set(tokenize(name).words.filter((w) => !SOFT.has(w) && !isNoise(w)));
  const merged: Hit[] = [];
  for (const { official, alias } of best.values()) {
    const own = alias && (!official || q.some((w) => !SOFT.has(w) && hard(alias.name).has(w) && !hard(official.name).has(w)));
    if (alias && own) merged.push({ ...alias, name: official?.name ?? alias.target.names[0]!, as: alias.name });
    else if (official) merged.push(alias && alias.score > official.score ? { ...official, score: alias.score, exact: official.exact || alias.exact } : official);
    else if (alias) merged.push({ ...alias, name: alias.target.names[0]! });
  }
  // A word that fits exactly beats the same word read as a typo („MARQ Diver” is not the Driver).
  const plain = merged.filter((h) => !h.fuzzy);
  const pool = plain.length ? plain : merged;
  const hits = pool.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pl', { numeric: true }));
  return { hits, apac, words: q };
}

/** Same answer for the person: grouping key of a verdict. */
export const verdictKey = (v: Verdict): string =>
  'lacks' in v ? `${v.kind}:${v.lacks.join(',')}` : v.kind;

const numberOf = (h: Hit): number | null => {
  const n = tokenize(h.name).words.find(isNum);
  return n ? Number(n) : null;
};

/** „fēnix® 8 43mm”, „fēnix® 8 Solar 47mm” → „fēnix® 8”: the words all the names share. */
function sharedStart(names: string[]): string {
  const split = names.map((n) => n.split(' '));
  const out: string[] = [];
  for (let i = 0; i < split[0]!.length; i++) {
    const w = split[0]![i]!;
    if (split.every((x) => x[i] === w)) out.push(w);
    else break;
  }
  return out.join(' ');
}

/**
 * The answer under the field after Enter, a chip or a link. One model when the words name one,
 * with namesakes that answer differently („fēnix 5” → 5 Plus works); a whole line when only the
 * line was named and its models differ („vívoactive”, „Instinct”); a guess when one typed word
 * fits nothing („Forerunner 970 Pro”); „unknown” with the nearest model numbers.
 */
export function answer(query: string): Answer {
  const { hits, words, apac } = search(query);
  if (!words.length) return { kind: 'prompt' };
  if (!hits.length) {
    const typed = words.find(isNum);
    const others = words.filter((w) => !isNum(w) && !isSize(w));
    // One word too many („Forerunner 970 Pro”, „fēnix 7 szafirowy”): drop it, keep every number.
    for (let i = others.length - 1; i >= 0; i--) {
      const fewer = words.filter((w) => w !== others[i]);
      const r = search(fewer.join(' ')).hits.filter((h) => h.exact);
      if (r.length) return { kind: 'guess', hits: r.slice(0, 5) };
    }
    if (!typed) return { kind: 'unknown', near: [] };
    const line = search(others.join(' ')).hits.filter((h) => numberOf(h) !== null);
    const near = line.sort((a, b) => Math.abs(numberOf(a)! - Number(typed)) - Math.abs(numberOf(b)! - Number(typed))).slice(0, 3);
    return { kind: 'unknown', near };
  }
  const top = hits[0]!.score;
  const family = hits.filter((h) => h.score >= top - 1.2 && (apac || h.target.verdict.kind !== 'regional'));
  const keys = new Set(family.map((h) => verdictKey(h.target.verdict)));
  if (keys.size > 1 && words.every((w) => SERIES_WORDS.has(w))) return { kind: 'line', hits: family };
  const main = family.find((h) => h.exact) ?? family[0]!;
  const key = verdictKey(main.target.verdict);
  const rest = family.filter((h) => h !== main);
  const same = rest.filter((h) => verdictKey(h.target.verdict) === key);
  const other = rest.filter((h) => verdictKey(h.target.verdict) !== key);
  if (!main.exact && other.length) return { kind: 'line', hits: family };
  // „fēnix 8” names the line, not the 43 mm: the title is what the same-answer names share.
  const fullWords = tokenize(main.as ?? main.name).words.filter((w) => !SOFT.has(w));
  const typedAll = fullWords.every((w) => words.includes(w) || (isSize(w) && words.includes(w.slice(0, -2))));
  const shared = same.length ? sharedStart([main.name, ...same.map((h) => h.name)]) : '';
  const hardTyped = words.filter((w) => !SOFT.has(w)).length;
  const title = !typedAll && shared && tokenize(shared).words.length >= hardTyped ? shared : (main.as ?? main.name);
  return { kind: 'one', hit: main, title, same, other };
}

/* ---------------- API for the screen (signatures final; package W1 refines the behaviour) ---------------- */

/**
 * Suggestions while typing (the screen asks from 2 characters): the first `limit` hits and how many
 * there are in all, for „i N więcej”. Package W1 adds the ranking — supported Garmin first.
 */
export function suggest(query: string, limit: number): { hits: Hit[]; total: number } {
  const { hits } = search(query, true);
  return { hits: hits.slice(0, limit), total: hits.length };
}

/** The answer for one target by its key: a remembered model, `?model=<id>`, a row of the full list. */
export function answerFor(key: string): Answer {
  const target = targets.find((t) => t.key === key);
  if (!target) return { kind: 'unknown', near: [] };
  const name = target.names[0]!;
  return { kind: 'one', hit: { target, name, score: 1, exact: true, fuzzy: false }, title: name, same: [], other: [] };
}
