// The prototype's 86 reviewed queries and its typing cases (design `proto/find.cases.ts`), as the
// matcher answered them when the watch check was designed. A change here is a change of behaviour:
// update a row only on purpose, never to make the test pass.
import { describe, expect, test } from 'vitest';
import { answer, search } from './find';
import type { Answer } from './types';

interface Case {
  q: string;
  kind: Answer['kind'];
  /** `one`: the main model; `guess`: the first suggestion. */
  key?: string;
  title?: string;
  /** `one`: namesakes with a different answer, in order. */
  other?: string[];
  /** `line`: how many models. */
  keys?: number;
  /** `unknown`: the nearest model numbers. */
  near?: string[];
}

const CASES: Case[] = [
  { q: 'fr 265', kind: 'one', key: 'fr265', title: 'Forerunner® 265' },
  { q: 'FR265', kind: 'one', key: 'fr265', title: 'Forerunner® 265' },
  { q: 'forerunner265', kind: 'one', key: 'fr265', title: 'Forerunner® 265' },
  { q: 'Forrunner 265', kind: 'one', key: 'fr265', title: 'Forerunner® 265' },
  { q: 'mam forerunnera 265', kind: 'one', key: 'fr265', title: 'Forerunner® 265' },
  { q: 'Garmin Forerunner® 265', kind: 'one', key: 'fr265', title: 'Forerunner® 265' },
  { q: 'fr 255s music', kind: 'one', key: 'fr255sm', title: 'Forerunner® 255s Music' },
  { q: 'fr 245m', kind: 'one', key: 'fr245m', title: 'Forerunner® 245 Music' },
  { q: 'forerunner 158', kind: 'one', key: 'fr55', title: 'Forerunner® 158' },
  { q: 'ForeAthlete 245', kind: 'one', key: 'fr245', title: 'Forerunner® 245' },
  { q: 'forerunner 975', kind: 'unknown', near: ['fr970', 'fr965', 'fr955'] },
  { q: 'forerunner 970 pro', kind: 'guess', key: 'fr970' },
  { q: 'forerunner', kind: 'line', keys: 32 },
  { q: 'feniks 7', kind: 'one', key: 'fenix7', title: 'fēnix® 7' },
  { q: 'fēnix 7x', kind: 'one', key: 'fenix7x', title: 'fēnix® 7X' },
  { q: 'Fēnix® 7X Pro Solar', kind: 'one', key: 'fenix7xpro', title: 'fēnix® 7X Pro' },
  { q: 'fenix 8', kind: 'one', key: 'fenix843mm', title: 'fēnix® 8' },
  { q: 'fenix 8 47', kind: 'one', key: 'fenix847mm', title: 'fēnix® 8 47mm' },
  { q: 'fenix 5', kind: 'one', key: 'fenix5', title: 'fēnix® 5', other: ['fenix5plus', 'fenix5splus', 'fenix5xplus'] },
  { q: 'fenix 5 plus', kind: 'one', key: 'fenix5plus', title: 'fēnix® 5 Plus' },
  { q: 'phoenix 6', kind: 'one', key: 'fenix6', title: 'fēnix® 6' },
  { q: 'tactix 7', kind: 'one', key: 'fenix7x', title: 'tactix® 7' },
  { q: 'enduro 2', kind: 'one', key: 'fenix7x', title: 'Enduro™ 2' },
  { q: 'quatix 7', kind: 'one', key: 'fenix7', title: 'quatix® 7' },
  { q: 'd2 mach 1 pro', kind: 'one', key: 'epix2pro51mm', title: 'D2™ Mach 1 Pro' },
  { q: 'd2 air x15', kind: 'one', key: 'venu445mm', title: 'D2™ Air X15' },
  { q: 'd2 air', kind: 'one', key: 'd2air', title: 'D2™ Air', other: ['d2airx10', 'venu445mm'] },
  { q: 'vivoactive 3', kind: 'one', key: 'vivoactive3', title: 'vívoactive® 3', other: ['vivoactive3m'] },
  { q: 'vívoactive 3 music', kind: 'one', key: 'vivoactive3m', title: 'vívoactive® 3 Music', other: ['vivoactive3mlte'] },
  { q: 'va3 music', kind: 'one', key: 'vivoactive3m', title: 'vívoactive® 3 Music', other: ['vivoactive3mlte'] },
  { q: 'vivo active 4', kind: 'one', key: 'vivoactive4', title: 'vívoactive® 4' },
  { q: 'vivoactive', kind: 'line', keys: 10 },
  { q: 'GarminActive', kind: 'one', key: 'vivoactive4', title: 'GarminActive' },
  { q: 'venu sq2', kind: 'one', key: 'venusq2', title: 'Venu® Sq 2' },
  { q: 'venu sq 2 music', kind: 'one', key: 'venusq2m', title: 'Venu® Sq 2 Music' },
  { q: 'venu', kind: 'line', keys: 14 },
  { q: 'venu mercedes', kind: 'one', key: 'venud', title: 'Venu® Mercedes-Benz® Collection', other: ['venu2', 'venu2s'] },
  { q: 'venu 4', kind: 'one', key: 'venu441mm', title: 'Venu® 4' },
  { q: 'epix', kind: 'line', keys: 5 },
  { q: 'epix gen 2', kind: 'one', key: 'epix2', title: 'epix™ (Gen 2)' },
  { q: 'epix 2', kind: 'one', key: 'epix2', title: 'epix™ (Gen 2)' },
  { q: 'MARQ', kind: 'line', keys: 11 },
  { q: 'marq gen 3', kind: 'one', key: 'marq3', title: 'MARQ® (Gen 3)' },
  { q: 'marq athlete', kind: 'one', key: 'marqathlete', title: 'MARQ® Athlete', other: ['marq3'] },
  { q: 'marq diver', kind: 'one', key: 'marq3', title: 'MARQ® Diver (Gen 3)' },
  { q: 'instinct', kind: 'line', keys: 11 },
  { q: 'instinct 1', kind: 'one', key: 'instinct1', title: 'Instinct® (1. generacja)' },
  { q: 'instinct 2', kind: 'one', key: 'instinct2', title: 'Instinct® 2', other: ['instinct2:apac'] },
  { q: 'instinct solar', kind: 'one', key: 'instinct1', title: 'Instinct® Solar', other: ['instinct2', 'instinct3solar45mm', 'instinct2s', 'instinct2x'] },
  { q: 'instynkt 3', kind: 'one', key: 'instinct3amoled45mm', title: 'Instinct® 3' },
  { q: 'instinct 2 dual power', kind: 'one', key: 'instinct2:apac', title: 'Instinct® 2 Dual Power' },
  { q: 'instinct 2 apac', kind: 'one', key: 'instinct2:apac', title: 'Instinct® 2 Dual Power' },
  { q: 'descent mk2i', kind: 'one', key: 'descentmk2', title: 'Descent™ Mk2i' },
  { q: 'descent mk3 asia', kind: 'one', key: 'descentmk343mm-apac', title: 'Descent™ Mk3 43mm (APAC)', other: ['descentmk343mm'] },
  { q: 'approach s70', kind: 'one', key: 'approachs7042mm', title: 'Approach® S70' },
  { q: 'approach s62', kind: 'one', key: 'approachs62', title: 'Approach® S62' },
  { q: 'approach s44', kind: 'one', key: 'approach-basic', title: 'Approach® S44' },
  { q: 'captain marvel', kind: 'one', key: 'legacyherocaptainmarvel', title: 'Captain Marvel' },
  { q: 'star wars', kind: 'one', key: 'legacysagarey', title: 'Star Wars' },
  { q: 'edge 540', kind: 'one', key: 'edge540', title: 'Edge® 540' },
  { q: 'edge 1060', kind: 'one', key: 'edge-any', title: 'Edge® 1060' },
  { q: 'edge', kind: 'one', key: 'edge-any', title: 'Edge®' },
  { q: 'gpsmap 66', kind: 'one', key: 'gpsmap66', title: 'GPSMAP® 66s' },
  { q: 'vivosmart 5', kind: 'one', key: 'vivosmart', title: 'vívosmart® 5' },
  { q: 'lily 2', kind: 'one', key: 'lily', title: 'Lily® 2' },
  { q: 'index s2', kind: 'one', key: 'index', title: 'Index™ S2' },
  { q: 'apple watch', kind: 'one', key: 'apple', title: 'Apple Watch' },
  { q: 'galaxy watch 6', kind: 'one', key: 'samsung', title: 'Galaxy Watch' },
  { q: 'mi band 8', kind: 'one', key: 'xiaomi', title: 'Mi Band' },
  { q: 'fitbit charge 6', kind: 'one', key: 'fitbit', title: 'Fitbit Charge' },
  { q: 'garmin', kind: 'prompt' },
  { q: 'mam garmina', kind: 'prompt' },
  { q: 'xyz 123', kind: 'unknown', near: [] },
  { q: 'forerunner 645', kind: 'one', key: 'fr645', title: 'Forerunner® 645', other: ['fr645m'] },
  { q: 'fr 645m', kind: 'one', key: 'fr645m', title: 'Forerunner® 645 Music' },
  { q: 'forerunner 45', kind: 'one', key: 'fr45', title: 'Forerunner® 45' },
  { q: 'fenix 7 pro bez wifi', kind: 'one', key: 'fenix7pronowifi', title: 'fēnix® 7 Pro - Solar Edition (no Wi-Fi)' },
  { q: 'mam feniksa 7', kind: 'one', key: 'fenix7', title: 'fēnix® 7' },
  { q: 'do fenixa 6', kind: 'one', key: 'fenix6', title: 'fēnix® 6' },
  { q: 'z forerunnerem 965', kind: 'one', key: 'fr965', title: 'Forerunner® 965' },
  { q: 'fēnix 7 – pro (47 mm)', kind: 'one', key: 'fenix7pro', title: 'fēnix® 7 Pro' },
  { q: 'FENIX7XPRO', kind: 'one', key: 'fenix7xpro', title: 'fēnix® 7X Pro' },
  { q: 'instinct 3 tactical', kind: 'one', key: 'instinct3amoled45mm', title: 'Instinct® 3' },
  { q: 'approach s70 47', kind: 'one', key: 'approachs7047mm', title: 'Approach® S70 47mm' },
  { q: 'vívoactive® 3 Music LTE', kind: 'one', key: 'vivoactive3mlte', title: 'vívoactive® 3 Music LTE' },
  { q: 'forerunner 265 music', kind: 'guess', key: 'fr265' },
];

/** What the prototype recorded for an answer: the same fields as a case. */
function recorded(q: string, a: Answer): Case {
  switch (a.kind) {
    case 'one':
      return { q, kind: 'one', key: a.hit.target.key, title: a.title, ...(a.other.length ? { other: a.other.map((h) => h.target.key) } : {}) };
    case 'line':
      return { q, kind: 'line', keys: a.hits.length };
    case 'guess':
      return { q, kind: 'guess', key: a.hits[0]!.target.key };
    case 'unknown':
      return { q, kind: 'unknown', near: a.near.map((h) => h.target.key) };
    default:
      return { q, kind: a.kind };
  }
}

describe('the 86 reviewed queries', () => {
  test('there are 86', () => {
    expect(CASES).toHaveLength(86);
  });

  test.each(CASES.map((c) => [c.q, c] as const))('%s', (q, c) => {
    expect(recorded(q, answer(q))).toEqual(c);
  });
});

describe('typing: the raw matches, before the ranking', () => {
  test.each([
    ['fr 26', ['fr265', 'fr265s']],
    ['venu s', ['venusq', 'venu2s', 'venu3s', 'venusq2', 'venusqm', 'venusq2m']],
    ['apple w', ['apple']],
    ['edg', ['edge-any', 'edgeexplore', 'edge130', 'edge_520', 'edge530', 'edge540', 'edge550', 'edge820']],
  ])('%s', (q, keys) => {
    expect(search(q, true).hits.slice(0, 8).map((h) => h.target.key)).toEqual(keys);
  });
});
