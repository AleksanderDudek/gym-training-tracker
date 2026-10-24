// The committed watch list against its source of truth, `garmin/manifest.xml`. CI has no Connect IQ
// SDK, so it can't rebuild the list — but it can see that the manifest and the list name the same
// watches (`build.sh store` runs the full `npm run garmin:watches -- --check` on the author's Mac).
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { GARMIN } from './list';
import type { Cap } from './types';

const STALE = 'Lista zegarków nieaktualna — npm run garmin:watches';

const manifest = readFileSync(new URL('../../garmin/manifest.xml', import.meta.url), 'utf8');
const manifestIds = [...manifest.matchAll(/<iq:product id="([^"]+)"/g)].map((m) => m[1]!);

const CAPS: Cap[] = ['stress', 'bodyBattery', 'rides'];
const VERSION = /^\d+\.\d+\.\d+$/;
const PART = /^006-B\d{4}-\d{2}$/;
const v = (s: string) => s.split('.').map(Number) as [number, number, number];
const below = (a: string, b: string) => {
  const [x, y] = [v(a), v(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
const capList = (xs: unknown) => Array.isArray(xs) && xs.length > 0 && new Set(xs).size === xs.length && xs.every((c) => CAPS.includes(c));

describe('garmin.json against garmin/manifest.xml', () => {
  test('the same watches: no manifest product missing from the list, nothing extra', () => {
    const listed = new Set(GARMIN.supported.map((s) => s.id));
    const inManifest = new Set(manifestIds);
    const missing = manifestIds.filter((id) => !listed.has(id));
    const extra = [...listed].filter((id) => !inManifest.has(id));
    expect({ missing, extra }, STALE).toEqual({ missing: [], extra: [] });
    expect(manifestIds.length).toBe(GARMIN.supported.length);
  });

  test('the same app and the same minimum Connect IQ', () => {
    expect(manifest.match(/<iq:application id="([0-9a-f]{32})"/)?.[1], STALE).toBe(GARMIN.appId);
    expect(manifest.match(/minApiLevel="([\d.]+)"/)?.[1], STALE).toBe(GARMIN.minCiq);
  });
});

describe('garmin.json shape', () => {
  test('header: SDK version, app id, minimum Connect IQ', () => {
    expect(GARMIN.sdk).toMatch(VERSION);
    expect(GARMIN.appId).toMatch(/^[0-9a-f]{32}$/);
    expect(GARMIN.minCiq).toMatch(VERSION);
  });

  test('every supported product has valid fields', () => {
    for (const s of GARMIN.supported) {
      const where = s.id;
      expect(s.id, where).toMatch(/^[a-z0-9_]+$/);
      expect(s.series, where).toBeTruthy();
      expect(s.names.length, where).toBeGreaterThan(0);
      expect(s.names.every((n) => n.trim() === n && n.length > 0), where).toBe(true);
      expect(s.aliases === undefined || (s.aliases.length > 0 && s.aliases.every((n) => n.trim() === n && n.length > 0)), where).toBe(true);
      expect(s.ciq, where).toMatch(VERSION);
      expect(below(s.ciq, GARMIN.minCiq), where).toBeGreaterThanOrEqual(0);
      expect([32, 64], where).toContain(s.bg);
      expect(s.parts.length, where).toBeGreaterThan(0);
      expect(s.parts.every((p) => PART.test(p)), where).toBe(true);
      expect(s.lacks === undefined || capList(s.lacks), where).toBe(true);
      expect(s.newest === undefined || capList(s.newest), where).toBe(true);
      // What comes only with the newest software is something the newest software has.
      expect((s.newest ?? []).every((c) => !(s.lacks ?? []).includes(c)), where).toBe(true);
      expect(s.apac === undefined || capList(s.apac.lacks), where).toBe(true);
    }
  });

  test('ids and part numbers are unique', () => {
    const ids = [...GARMIN.supported, ...GARMIN.unsupported].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const parts = GARMIN.supported.flatMap((s) => s.parts);
    expect(new Set(parts).size).toBe(parts.length);
  });

  test('every unsupported SDK device says why', () => {
    for (const u of GARMIN.unsupported) {
      const where = u.id;
      expect(u.names.length, where).toBeGreaterThan(0);
      expect(['oldCiq', 'noBackground', 'noApps', 'notWatch', 'notListed'], where).toContain(u.reason);
      if (u.reason === 'notWatch') {
        expect(['bike', 'handheld'], where).toContain(u.kind);
        expect(u.ciq, where).toBeUndefined();
      } else expect(u.ciq, where).toMatch(VERSION);
      if (u.reason === 'oldCiq') expect(below(u.ciq!, GARMIN.minCiq), where).toBeLessThan(0);
    }
    // A watch that passes the manifest's rule belongs in the manifest.
    expect(GARMIN.unsupported.filter((u) => u.reason === 'notListed').map((u) => u.id), STALE).toEqual([]);
  });

  test('what each model sends, today: 111 in full, the 7 others as Garmin’s data says', () => {
    const notFull = Object.fromEntries(
      GARMIN.supported.filter((s) => s.lacks || s.newest).map((s) => [s.id, { lacks: s.lacks, newest: s.newest }]),
    );
    const all: Cap[] = ['stress', 'bodyBattery', 'rides'];
    const fenix5plus = { lacks: ['bodyBattery'], newest: ['stress', 'rides'] };
    expect(notFull).toEqual({
      d2air: { lacks: all },
      fenix5plus,
      fenix5splus: fenix5plus,
      fenix5xplus: fenix5plus,
      fr645m: { lacks: all },
      venud: { lacks: all },
      vivoactive3m: { lacks: all },
    });
    expect(GARMIN.supported.length - Object.keys(notFull).length).toBe(111);
  });

  test('the Asian versions that send less, and the names only they carry', () => {
    const apac = Object.fromEntries(GARMIN.supported.filter((s) => s.apac).map((s) => [s.id, s.apac]));
    const all: Cap[] = ['stress', 'bodyBattery', 'rides'];
    expect(apac).toEqual({
      descentg1: { lacks: all, names: ['Descent™ G1 Dual Power', 'Descent™ G1 Dual Power - Ocean Edition'] },
      fenix5plus: { lacks: ['stress', 'rides'] },
      fenix5splus: { lacks: ['stress', 'rides'] },
      fenix5xplus: { lacks: ['stress', 'rides'] },
      instinct2: { lacks: all, names: ['Instinct® 2 Dual Power', 'Instinct® 2 Dual Power - Tactical Edition', 'Instinct® 2 Dual Power ONE PIECE LUFFY'] },
      instinct2s: { lacks: all, names: ['Instinct® 2S Dual Power', 'Instinct® 2S Dual Power - Surf Edition', 'Instinct® 2S Dual Power ONE PIECE CHOPPER'] },
    });
  });

  test('the 32 kB background models (background sync not yet seen on a real one)', () => {
    expect(GARMIN.supported.filter((s) => s.bg === 32).map((s) => s.id)).toEqual([
      'descentg1', 'descentmk2', 'descentmk2s', 'enduro', 'fenix5plus', 'fenix5splus', 'fenix5xplus', 'fenix6', 'fenix6pro', 'fenix6s',
      'fenix6spro', 'fenix6xpro', 'fr245', 'fr55', 'instinct2', 'instinct2s', 'instinct2x', 'instinct3solar45mm', 'instinctcrossover',
      'instincte40mm', 'instincte45mm', 'marqadventurer', 'marqathlete', 'marqaviator', 'marqcaptain', 'marqcommander', 'marqdriver',
      'marqexpedition', 'marqgolfer', 'venusq',
    ]);
  });
});
