import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { POPULAR } from './extra';
import { answer, answerFor, shortOf, suggest, verdictKey } from './find';
import { ENTRIES, GARMIN, targetByKey } from './list';
import type { Answer, Hit, Short } from './types';
import { SERIES_WORDS, tokenize } from './words';

/** The `one` answer of a query, flattened for comparing; any other kind fails the test. */
function one(q: string) {
  const a = answer(q);
  if (a.kind !== 'one') throw new Error(`${q}: expected one model, got ${a.kind}`);
  return {
    key: a.hit.target.key,
    short: shortOf(a.hit.target.verdict),
    kind: a.hit.target.verdict.kind,
    title: a.title,
    other: a.other.map((h) => h.target.key),
  };
}

const keys = (hits: Hit[]) => hits.map((h) => h.target.key);
const shorts = (hits: Hit[]) => hits.map((h) => shortOf(h.target.verdict));

describe('the critique’s queries', () => {
  test('„stary garmin” is the prompt, not Star Wars; „stary forerunner” is the line', () => {
    expect(answer('stary garmin')).toEqual({ kind: 'prompt' });
    expect(answer('nowy zegarek garmin').kind).toBe('prompt');
    const a = answer('stary forerunner');
    expect(a.kind).toBe('line');
    expect(a.kind === 'line' && a.hits.length).toBe(32);
  });

  test('filler words don’t stop a model: „mój zegarek to fenix 7”, „to jest chyba venu 3”', () => {
    expect(one('mój zegarek to fenix 7')).toMatchObject({ key: 'fenix7', title: 'fēnix® 7', short: 'ok' });
    expect(one('to jest chyba venu 3')).toMatchObject({ key: 'venu3', title: 'Venu® 3' });
    expect(one('mam jakiś stary forerunner 235')).toMatchObject({ key: 'fr235', short: 'no' });
  });

  test('Polish words for Music and Sapphire, and the glued „255sm”', () => {
    expect(one('forerunner 255 muzyka')).toMatchObject({ key: 'fr255m', title: 'Forerunner® 255 Music' });
    expect(one('forerunner 255 z muzyką')).toMatchObject({ key: 'fr255m' });
    expect(one('forerunner255sm')).toMatchObject({ key: 'fr255sm', title: 'Forerunner® 255s Music' });
    expect(one('fr 255sm')).toMatchObject({ key: 'fr255sm' });
    expect(one('fenix 6 pro szafir')).toMatchObject({ key: 'fenix6pro', short: 'ok' });
  });

  test('the title keeps every number the person typed', () => {
    expect(one('265')).toMatchObject({ key: 'fr265', title: 'Forerunner® 265' });
    expect(one('965')).toMatchObject({ key: 'fr965', title: 'Forerunner® 965' });
    // The shared start still names a line when it holds the number: „fēnix® 8”, „Instinct® 3”.
    expect(one('fenix 8').title).toBe('fēnix® 8');
    expect(one('instinct 3').title).toBe('Instinct® 3');
  });

  test('„nie wiem” and its kin ask for help: „Gdzie znajdę nazwę modelu?”', () => {
    for (const q of ['nie wiem', 'Nie wiem', 'nie znam', 'nie pamiętam', 'nie pamiętam nazwy', 'nie wiem jaki', 'zapomniałem modelu', "I don't know"])
      expect(answer(q), q).toEqual({ kind: 'help' });
    // A model next to it still counts.
    expect(one('nie wiem, chyba fenix 7')).toMatchObject({ key: 'fenix7' });
  });

  test('Xiaomi bands by their everyday names; a brand alone is titled with its watch line', () => {
    for (const q of ['mi smart band 9', 'xiaomi smart band 8', 'smart band 7', 'mi band 8', 'redmi watch 4'])
      expect(one(q), q).toMatchObject({ key: 'xiaomi', kind: 'otherBrand', short: 'other' });
    expect(one('samsung')).toMatchObject({ key: 'samsung', title: 'Samsung Galaxy Watch' });
    expect(one('samsung gear s3')).toMatchObject({ key: 'samsung', title: 'Samsung Gear' });
    expect(one('honor')).toMatchObject({ key: 'honor', title: 'Honor Watch' });
    expect(one('google')).toMatchObject({ key: 'pixel', title: 'Google Pixel Watch' });
  });

  test('every match a typo → „Czy chodzi o…”, never a verdict', () => {
    for (const q of ['Forrunner', 'fenx', 'instnict', 'Vivoactve', 'Desent']) {
      const a = answer(q);
      expect(a.kind, q).toBe('guess');
      expect(a.kind === 'guess' && a.hits.length, q).toBeGreaterThan(0);
    }
    const fr = answer('Forrunner');
    // The guesses lead with supported, popular models.
    expect(fr.kind === 'guess' && keys(fr.hits)).toEqual(['fr55', 'fr165', 'fr265', 'fr70', 'fr170']);
    // One word typed exactly is enough for a verdict.
    expect(one('Forrunner 265')).toMatchObject({ key: 'fr265' });
    expect(one('fenx 7')).toMatchObject({ key: 'fenix7' });
  });

  test('APAC never changes the headline unless the query names the region or „Dual Power”', () => {
    expect(one('instinct 2')).toMatchObject({ key: 'instinct2', kind: 'full', short: 'ok' });
    expect(one('instinct 2 dual power')).toMatchObject({ key: 'instinct2:apac', kind: 'apac', short: 'part' });
    expect(one('instinct 2 apac')).toMatchObject({ key: 'instinct2:apac', kind: 'apac' });
    expect(one('instinct 2 z azji')).toMatchObject({ key: 'instinct2:apac' });
    expect(one('descent mk3 43')).toMatchObject({ key: 'descentmk343mm', short: 'ok' });
    expect(one('descent mk3 43 apac')).toMatchObject({ key: 'descentmk343mm-apac', kind: 'regional', short: 'no' });
    // Every product with an Asian version: its own names answer the European one.
    for (const s of GARMIN.supported.filter((x) => x.apac))
      for (const n of s.names) expect(one(n).key, n).toBe(s.id);
  });
});

describe('suggestions while typing', () => {
  test('nothing under 2 characters', () => {
    expect(suggest('f', 8)).toEqual({ hits: [], total: 0 });
    expect(suggest(' f ', 8)).toEqual({ hits: [], total: 0 });
    expect(suggest('fr', 8).hits.length).toBeGreaterThan(0);
  });

  test.each(['fo', 've', 'vi', 'in', 'ga', 'fe', 'fr', 'ap'])('„%s” starts with supported Garmin models', (q) => {
    const { hits } = suggest(q, 8);
    expect(['ok', 'part']).toContain(shortOf(hits[0]!.target.verdict));
    // Supported first, then other Garmin, then other brands — over the whole list, not only the first 8.
    const all = suggest(q, 1000).hits;
    const rank = (s: Short) => (s === 'ok' || s === 'part' ? 0 : s === 'other' ? 2 : 1);
    const ranks = shorts(all).map(rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test('popular models before the other supported ones, by score within each group', () => {
    expect(keys(suggest('fo', 3).hits)).toEqual(['fr55', 'fr165', 'fr265']);
    expect(keys(suggest('ve', 2).hits)).toEqual(['venu3', 'venu']);
    expect(keys(suggest('fr 2', 3).hits)).toEqual(['fr265', 'fr245', 'fr255']);
    // „fo” no longer starts with Forerunner 10, „ve” with COROS or Fitbit.
    expect(keys(suggest('fo', 8).hits)).not.toContain('fr-basic');
    expect(shorts(suggest('ve', 8).hits)).not.toContain('other');
  });

  test('only the brand („ga”, „garmin”) → the popular models first, not GarminActive', () => {
    for (const q of ['ga', 'garm', 'garmin', 'mam garmina']) {
      const { hits } = suggest(q, 8);
      expect(keys(hits).slice(0, 6), q).toEqual([...POPULAR]);
      expect(hits[0]!.as, q).toBeUndefined();
    }
    // „gal” is no longer the brand: Galaxy Watch.
    expect(keys(suggest('gal', 8).hits)).toEqual(['samsung']);
  });

  test('a marketing word alone names no model: „po” is Polar, not „Dual Power”', () => {
    expect(keys(suggest('po', 8).hits)).toEqual(['polar']);
    expect(keys(suggest('su', 8).hits)).toEqual(['suunto']);
    expect(keys(suggest('sa', 8).hits)).toEqual(['legacysagarey', 'legacysagadarthvader', 'samsung']);
  });

  test('the total counts every match, for „i N więcej”', () => {
    const { hits, total } = suggest('forerunner', 8);
    expect(hits).toHaveLength(8);
    expect(total).toBe(suggest('forerunner', 1000).hits.length);
    expect(total).toBeGreaterThan(30);
  });
});

describe('hand-written pairs: similar names, told apart', () => {
  test.each([
    ['vívoactive 3', 'vivoactive3', 'no', ['vivoactive3m']],
    ['vívoactive 3 Music', 'vivoactive3m', 'part', ['vivoactive3mlte']],
    ['vívoactive 3 Music LTE', 'vivoactive3mlte', 'no', []],
    ['fēnix 5', 'fenix5', 'no', ['fenix5plus', 'fenix5splus', 'fenix5xplus']],
    ['fēnix 5 Plus', 'fenix5plus', 'part', []],
    ['fēnix 5S', 'fenix5s', 'no', ['fenix5splus']],
    ['fēnix 5S Plus', 'fenix5splus', 'part', []],
    ['fēnix 5X', 'fenix5x', 'no', ['fenix5xplus']],
    ['fēnix 5X Plus', 'fenix5xplus', 'part', []],
    ['Forerunner 645', 'fr645', 'no', ['fr645m']],
    ['Forerunner 645 Music', 'fr645m', 'part', []],
    ['Instinct 1', 'instinct1', 'no', []],
    ['Instinct 2', 'instinct2', 'ok', ['instinct2:apac']],
    ['Instinct Solar', 'instinct1', 'no', ['instinct2', 'instinct3solar45mm', 'instinct2s', 'instinct2x']],
    ['Instinct 2 Solar', 'instinct2', 'ok', []],
    ['epix Gen 2', 'epix2', 'ok', []],
    ['MARQ Gen 3', 'marq3', 'notYet', []],
    ['MARQ Gen 2', 'marq2', 'ok', []],
    ['MARQ Athlete', 'marqathlete', 'ok', ['marq3']],
    ['MARQ Athlete Gen 2', 'marq2', 'ok', []],
    ['D2 Air', 'd2air', 'part', ['d2airx10', 'venu445mm']],
    ['D2 Air X10', 'd2airx10', 'ok', []],
    ['Venu Mercedes-Benz', 'venud', 'part', ['venu2', 'venu2s']],
    ['Forerunner 935', 'fr935', 'no', []],
    ['Forerunner 945', 'fr945', 'ok', []],
    ['Forerunner 45', 'fr45', 'no', []],
    ['Forerunner 55', 'fr55', 'ok', []],
    ['Approach S62', 'approachs62', 'no', []],
    ['Approach S70', 'approachs7042mm', 'ok', []],
    ['vívoactive 4', 'vivoactive4', 'ok', []],
    ['Descent Mk1', 'descentmk1', 'no', []],
    ['Descent Mk2', 'descentmk2', 'ok', []],
  ])('%s → %s (%s)', (q, key, short, other) => {
    expect(one(q)).toMatchObject({ key, short, other });
  });

  test.each([
    ['Instinct', ['instinct1', 'instinct2']],
    ['epix', ['epix', 'epix2']],
    ['MARQ', ['marq3', 'marq2', 'marqathlete']],
    ['Venu', ['venu', 'venud']],
    ['vívoactive', ['vivoactive', 'vivoactive4']],
  ])('only the line name „%s” → the line, with both', (q, both) => {
    const a = answer(q);
    expect(a.kind).toBe('line');
    for (const k of both) expect(a.kind === 'line' && keys(a.hits), k).toContain(k);
  });
});

describe('generated coverage', () => {
  /** A name answers its target when the model, or one with the same answer, heads the card. */
  function answers(a: Answer, key: string, name: string): boolean {
    const verdict = verdictKey(targetByKey(key)!.verdict);
    if (a.kind === 'one') return a.hit.target.key === key || verdictKey(a.hit.target.verdict) === verdict;
    // A line name („Venu®”, „Instinct®”) asks about the line: fine, as long as the model is in it.
    if (a.kind === 'line') return tokenize(name).words.every((w) => SERIES_WORDS.has(w)) && a.hits.some((h) => h.target.key === key);
    return false;
  }

  test('every name and alias in garmin.json and extra.ts answers its own model or a same-answer family', () => {
    const wrong = ENTRIES.filter((e) => !answers(answer(e.name), e.target.key, e.name)).map((e) => `${e.name} → ${e.target.key}`);
    expect(wrong).toEqual([]);
    expect(ENTRIES.length).toBeGreaterThan(480);
  });

  test('no supported name answers unknown or not supported', () => {
    for (const e of ENTRIES.filter((x) => x.target.id && x.target.verdict.kind !== 'apac')) {
      const a = answer(e.name);
      expect(a.kind, e.name).not.toBe('unknown');
      if (a.kind === 'one') expect(['ok', 'part'], e.name).toContain(shortOf(a.hit.target.verdict));
    }
  });

  test('every manifest product is findable by its name: as the answer and among the suggestions', () => {
    const manifest = readFileSync(new URL('../../garmin/manifest.xml', import.meta.url), 'utf8');
    const ids = [...manifest.matchAll(/<iq:product id="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids).toHaveLength(118);
    for (const id of ids) {
      const name = GARMIN.supported.find((s) => s.id === id)!.names[0]!;
      expect(answers(answer(name), id, name), name).toBe(true);
      expect(keys(suggest(name, 8).hits), name).toContain(id);
      expect(answerFor(id)).toMatchObject({ kind: 'one', title: name, hit: { target: { id } } });
    }
  });
});

describe('numbers and typos', () => {
  test('never a typo in a word with a digit: „256” is not the 255, „gen 3” is not gen 2', () => {
    const fr = answer('forerunner 256');
    expect(fr.kind).toBe('unknown');
    expect(fr.kind === 'unknown' && keys(fr.near)).toEqual(['fr255', 'fr265', 'fr245']);
    expect(one('epix gen 2')).toMatchObject({ key: 'epix2' });
    expect(answer('epix gen 3').kind).not.toBe('one');
    expect(answer('fenix 9x').kind).not.toBe('one');
  });

  test('a word that fits exactly beats the same word read as a typo', () => {
    expect(one('marq driver')).toMatchObject({ key: 'marqdriver' });
    expect(one('marq diver')).toMatchObject({ key: 'marq3' });
  });
});

describe('answerFor and shortOf', () => {
  test('a key gives that target’s card; an unknown key gives unknown', () => {
    expect(answerFor('fenix5plus')).toMatchObject({ kind: 'one', title: 'fēnix® 5 Plus', same: [], other: [] });
    expect(answerFor('instinct2:apac')).toMatchObject({ kind: 'one', title: 'Instinct® 2 Dual Power' });
    expect(answerFor('apple')).toMatchObject({ kind: 'one', title: 'Apple Watch' });
    expect(answerFor('nope')).toEqual({ kind: 'unknown', near: [] });
  });

  test('short answers: newest software is a step, never a headline', () => {
    expect(shortOf({ kind: 'full' })).toBe('ok');
    expect(shortOf({ kind: 'update', newest: ['stress'], lacks: [] })).toBe('ok');
    expect(shortOf({ kind: 'update', newest: ['stress'], lacks: ['bodyBattery'] })).toBe('part');
    expect(shortOf({ kind: 'limited', lacks: ['rides'] })).toBe('part');
    expect(shortOf({ kind: 'apac', lacks: ['rides'] })).toBe('part');
    expect(shortOf({ kind: 'oldCiq', ciq: '3.1.0' })).toBe('no');
    expect(shortOf({ kind: 'regional', of: 'marq2' })).toBe('no');
    expect(shortOf({ kind: 'notWatch', what: 'band' })).toBe('no');
    expect(shortOf({ kind: 'notYet' })).toBe('notYet');
    expect(shortOf({ kind: 'otherBrand', bike: false })).toBe('other');
    // fēnix 5 Plus: no Body Battery, stress and rides with the newest software.
    expect(shortOf(targetByKey('fenix5plus')!.verdict)).toBe('part');
  });
});
