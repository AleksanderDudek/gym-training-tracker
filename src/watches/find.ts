// The watch check's matcher (spec 2026-10-24 §4.11): what a typed name means. Ported from the
// prototype; the words live in `words.ts`, the index in `list.ts`. Pure, no DOM, no i18n.
import { POPULAR } from './extra';
import { APAC_TWIN, ENTRIES, VOCAB, targetByKey } from './list';
import type { Answer, Hit, Short, Target, Verdict } from './types';
import {
  BRAND,
  SERIES_WORDS,
  brandPrefix,
  hasDigit,
  inflected,
  isNoise,
  isNum,
  isSize,
  isSoft,
  tokenize,
  typos,
} from './words';

export { fold, tokenize, typos } from './words';

/* ---------------- verdicts ---------------- */

/** Same answer for the person: grouping key of a verdict. */
export const verdictKey = (v: Verdict): string => ('lacks' in v ? `${v.kind}:${v.lacks.join(',')}` : v.kind);

/**
 * The short answer of a verdict (list rows, options, the remembered model). Data that comes only
 * with the newest software is a connection step, never a headline: without missing data it is `ok`.
 */
export function shortOf(v: Verdict): Short {
  switch (v.kind) {
    case 'full':
      return 'ok';
    case 'update':
      return v.lacks.length ? 'part' : 'ok';
    case 'limited':
    case 'apac':
      return 'part';
    case 'notYet':
      return 'notYet';
    case 'otherBrand':
      return 'other';
    default:
      return 'no';
  }
}

/* ---------------- matching ---------------- */

interface Fit {
  score: number;
  typo: boolean;
}
const NONE: Fit = { score: 0, typo: false };

/** How well one typed word fits one word of a name: 0 — not at all. */
function fit(q: string, c: string, last: boolean, typing: boolean): Fit {
  if (q === c) return { score: 1, typo: false };
  if (isNum(q) && (c === `${q}mm` || c === `gen${q}`)) return { score: 0.9, typo: false };
  if (typing && last && c.startsWith(q)) return { score: isNum(q) ? 0.6 : 0.75, typo: false };
  // Numbers are model numbers: „265” is not „255”, and „gen 2” is not „gen 3”.
  if (hasDigit(q) || hasDigit(c)) return NONE;
  if (inflected(q, c)) return { score: 0.95, typo: false };
  if (q.length >= 4 && c.length >= 3) {
    const max = q.length >= 8 ? 2 : 1;
    if (typos(q, c, max) <= max) return { score: 0.6, typo: true };
  }
  return NONE;
}

const unglue = (w: string): string[] => {
  if (VOCAB.has(w) || w.length < 4 || hasDigit(w)) return [w];
  for (let i = w.length - 1; i >= 1; i--) {
    const a = w.slice(0, i);
    const b = w.slice(i);
    if (VOCAB.has(a) && VOCAB.has(b)) return [a, b];
  }
  return [w];
};

/** A name's words that say something: no marketing words, no noise. */
const hard = (name: string): Set<string> => new Set(tokenize(name).words.filter((w) => !isSoft(w) && !isNoise(w)));

/**
 * What the person may mean. `typing`: the last word may be unfinished („fr 2” → 245, 255, 265).
 * Every typed word has to fit a word of the name, except noise and marketing words; numbers fit
 * exactly — „Forerunner 975” is not the 970. `words` are the typed words that count; `typed` all of
 * them, noise too; `help` — the person said they don't know the model.
 */
export function search(
  query: string,
  typing = false,
): { hits: Hit[]; apac: boolean; words: string[]; typed: string[]; help: boolean } {
  const { words: raw, apac, help = false } = tokenize(query);
  // The last word may still be typed: never take it apart while typing.
  const typed = raw.flatMap((w, i) => (typing && i === raw.length - 1 ? [w] : unglue(w)));
  const q = typed.filter((w) => !isNoise(w));
  if (!q.length) return { hits: [], apac, words: q, typed, help };
  const best = new Map<string, { official?: Hit; alias?: Hit }>();
  for (const e of ENTRIES) {
    const used = new Set<number>();
    let score = 0;
    let spare = 0;
    let lastMatched = -1;
    let firstSpare = Infinity;
    let fuzzy = false;
    let typoOnly = true;
    let hardMatch = false;
    for (let i = 0; i < q.length; i++) {
      const w = q[i]!;
      let top = NONE;
      let at = -1;
      for (let j = 0; j < e.words.length; j++) {
        if (used.has(j)) continue;
        const f = fit(w, e.words[j]!, i === q.length - 1, typing);
        if (f.score > top.score) {
          top = f;
          at = j;
        }
      }
      if (top.score > 0) {
        used.add(at);
        score += top.score;
        lastMatched = i;
        if (top.typo) fuzzy = true;
        else typoOnly = false;
        if (!isSoft(e.words[at]!)) hardMatch = true;
      } else if (isSoft(w)) score -= 0.2;
      // „fēnix 7 Pro 47 mm”: the name has no size, so a typed size tells nothing against it.
      else if ((isSize(w) || (isNum(w) && i > 0 && Number(w) >= 38 && Number(w) <= 54)) && !e.words.some(isSize)) score -= 0.1;
      else {
        spare++;
        firstSpare = Math.min(firstSpare, i);
      }
    }
    // Only a marketing word fit („sa” → Sapphire, „po” → Dual Power): that names no model.
    if (!hardMatch) continue;
    const rest = e.words.filter((c, j) => !used.has(j) && !isSize(c) && !isSoft(c) && !isNoise(c));
    // A typed word that fits nothing is fine only after a whole line name („Galaxy Watch 7”).
    if (spare && !(e.open && rest.length === 0 && firstSpare > lastMatched)) continue;
    const exact = rest.length === 0 && spare === 0 && !fuzzy;
    score += exact ? 0.5 : -0.15 * rest.length;
    // A longer name ranks a little lower; noise words don't make it longer, so of two names that fit
    // alike the first one wins — an item's main name („Samsung Galaxy Watch”, not „Samsung Gear”).
    score -= 0.3 * spare + 0.01 * e.size;
    const k = e.target.verdict.kind;
    if (apac) {
      if (k === 'apac' || k === 'regional') score += 1;
      else if (e.target.id && APAC_TWIN.has(e.target.id)) score -= 0.5;
    } else if (k === 'apac') score -= 1;
    else if (k === 'regional') score -= 2;
    const hit: Hit = { target: e.target, name: e.shown, score, exact, fuzzy, ...(typoOnly && { typoOnly: true as const }) };
    const slot = best.get(e.target.key) ?? {};
    const which = e.official ? 'official' : 'alias';
    if (!slot[which] || score > slot[which]!.score) slot[which] = hit;
    best.set(e.target.key, slot);
  }
  // A store spelling becomes the title only for a word no official name has („158”, „GarminActive”);
  // a marketing word („Sapphire Solar Edition”) never does.
  const merged: Hit[] = [];
  for (const { official, alias } of best.values()) {
    const own = alias && (!official || q.some((w) => !isSoft(w) && hard(alias.name).has(w) && !hard(official.name).has(w)));
    if (alias && own) merged.push({ ...alias, name: official?.name ?? alias.target.names[0]!, as: alias.name });
    else if (official)
      merged.push(alias && alias.score > official.score ? { ...official, score: alias.score, exact: official.exact || alias.exact } : official);
  }
  // A word that fits exactly beats the same word read as a typo („MARQ Diver” is not the Driver).
  const plain = merged.filter((h) => !h.fuzzy);
  const pool = plain.length ? plain : merged;
  const hits = pool.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pl', { numeric: true }));
  return { hits, apac, words: q, typed, help };
}

/* ---------------- ranking ---------------- */

const POPULAR_IDS = new Set<string>(POPULAR);

/** 0 popular supported, 1 other supported, 2 other Garmin, 3 other brands. */
const group = (t: Target): number => {
  const s = shortOf(t.verdict);
  if (s === 'ok' || s === 'part') return POPULAR_IDS.has(t.key) ? 0 : 1;
  return s === 'other' ? 3 : 2;
};

/** Supported Garmin models first (popular ones before the rest), then other Garmin, then other brands; by score within each. */
const ranked = (hits: Hit[]): Hit[] =>
  hits
    .map((h, i) => ({ h, i, g: group(h.target) }))
    .sort((a, b) => a.g - b.g || b.h.score - a.h.score || a.i - b.i)
    .map(({ h }) => h);

const asHit = (t: Target): Hit => ({ target: t, name: t.names[0]!, score: 0, exact: true, fuzzy: false });

/** The popular chips' models, in chip order. */
const popularHits = (): Hit[] => POPULAR.map((id) => targetByKey(id)).filter((t): t is Target => !!t).map(asHit);

/** Only the brand was typed (or is being typed): „ga”, „garmin”, „mam garmina”. */
const brandOnly = (typed: string[]): boolean =>
  typed.length > 0 &&
  typed.every((w) => isNoise(w) || brandPrefix(w)) &&
  typed.some((w) => w === BRAND || inflected(w, BRAND) || brandPrefix(w));

/**
 * Suggestions while typing, from 2 characters: the first `limit` hits and how many there are in all,
 * for „i N więcej”. Supported Garmin models come first, the popular ones before the rest, then other
 * Garmin devices, then other brands. Only the brand typed („ga”, „garmin”) → the popular models.
 */
export function suggest(query: string, limit: number): { hits: Hit[]; total: number } {
  if (query.replace(/\s/g, '').length < 2) return { hits: [], total: 0 };
  const { hits, typed } = search(query, true);
  let list = ranked(hits);
  if (brandOnly(typed)) {
    const shown = new Set(list.map((h) => h.target.key));
    list = [...popularHits().filter((h) => !shown.has(h.target.key)), ...list];
  }
  return { hits: list.slice(0, limit), total: list.length };
}

/* ---------------- answers ---------------- */

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
 * line was named and its models differ („vívoactive”, „Instinct”); a guess when every match is a
 * typo („Forrunner”) or one typed word fits nothing („Forerunner 970 Pro”); „unknown” with the
 * nearest model numbers; help when the person says they don't know („nie wiem”).
 */
export function answer(query: string): Answer {
  const { hits, words, apac, help } = search(query);
  if (!words.length) return help ? { kind: 'help' } : { kind: 'prompt' };
  const found = answerFrom(hits, words, apac);
  // „Nie pamiętam nazwy”: what is left of the words means nothing either.
  return help && found.kind === 'unknown' ? { kind: 'help' } : found;
}

function answerFrom(hits: Hit[], words: string[], apac: boolean): Answer {
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
    // One model per number — the base one, which fits best („Forerunner 256” → 255, 265, 245,
    // not 255, 255 Music and 255s).
    const byNumber = new Map<number, Hit>();
    for (const h of search(others.join(' ')).hits) {
      const n = numberOf(h);
      if (n !== null && !byNumber.has(n)) byNumber.set(n, h);
    }
    const distance = (h: Hit) => Math.abs(numberOf(h)! - Number(typed));
    const near = [...byNumber.values()].sort((a, b) => distance(a) - distance(b)).slice(0, 3);
    return { kind: 'unknown', near };
  }
  const top = hits[0]!.score;
  const family = hits.filter((h) => h.score >= top - 1.2 && (apac || h.target.verdict.kind !== 'regional'));
  // Every word fit only as a typo: ask, never a verdict.
  if (family.every((h) => h.typoOnly)) return { kind: 'guess', hits: ranked(family).slice(0, 5) };
  const keys = new Set(family.map((h) => verdictKey(h.target.verdict)));
  if (keys.size > 1 && words.every((w) => SERIES_WORDS.has(w))) return { kind: 'line', hits: family };
  const main = family.find((h) => h.exact) ?? family[0]!;
  const key = verdictKey(main.target.verdict);
  const rest = family.filter((h) => h !== main);
  const same = rest.filter((h) => verdictKey(h.target.verdict) === key);
  const other = rest.filter((h) => verdictKey(h.target.verdict) !== key);
  if (!main.exact && other.length) return { kind: 'line', hits: family };
  // „fēnix 8” names the line, not the 43 mm: the title is what the same-answer names share —
  // but it keeps every number the person typed („265” → „Forerunner® 265”, not „Forerunner®”).
  const fullWords = tokenize(main.as ?? main.name).words.filter((w) => !isSoft(w));
  const typedAll = fullWords.every((w) => words.includes(w) || (isSize(w) && words.includes(w.slice(0, -2))));
  const shared = same.length ? sharedStart([main.name, ...same.map((h) => h.name)]) : '';
  const sharedWords = tokenize(shared).words;
  const hardTyped = words.filter((w) => !isSoft(w)).length;
  const keepsNumbers = words.filter(isNum).every((n) => sharedWords.includes(n));
  const title = !typedAll && shared && sharedWords.length >= hardTyped && keepsNumbers ? shared : (main.as ?? main.name);
  return { kind: 'one', hit: main, title, same, other };
}

/** The answer for one target by its key: a remembered model, `?model=<id>`, a row of the full list. */
export function answerFor(key: string): Answer {
  const target = targetByKey(key);
  if (!target) return { kind: 'unknown', near: [] };
  const hit = asHit(target);
  return { kind: 'one', hit, title: hit.name, same: [], other: [] };
}
