import { describe, expect, test } from 'vitest';
import { EXTRA, NICKNAMES, POPULAR } from './extra';
import { answer, answerFor, verdictKey } from './find';
import { ENTRIES, GARMIN, TARGETS, supportedById, supportedByLine, targetByKey } from './list';

describe('the index', () => {
  test('every target has its own key', () => {
    const keys = TARGETS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(TARGETS.every((t) => targetByKey(t.key) === t)).toBe(true);
  });

  test('a name two targets share gives the same answer for both', () => {
    const byName = new Map<string, Set<string>>();
    for (const e of ENTRIES) {
      // „Descent™ Mk3 43mm (APAC)” is not „Descent™ Mk3 43mm”: the region word sets a flag, and the
      // region decides between the two.
      const k = `${e.apac ? 'apac:' : ''}${e.words.join(' ')}`;
      byName.set(k, new Set([...(byName.get(k) ?? []), e.target.key]));
    }
    const shared = [...byName].filter(([, keys]) => keys.size > 1);
    for (const [name, keys] of shared) {
      const answers = new Set([...keys].map((k) => verdictKey(targetByKey(k)!.verdict)));
      expect(answers.size, `${name}: ${[...keys].join(', ')}`).toBe(1);
    }
    // Today: „tactix® 8 51mm” (two fēnix 8 products) and „Edge® 1030” (two bike computers).
    expect(shared.map(([name]) => name).sort()).toEqual(['edge 1030', 'tactix 8 51mm']);
  });
});

describe('extra.ts', () => {
  test('every item has names and a reason; regional items point at a supported product', () => {
    for (const x of EXTRA) {
      expect(x.names.length, x.key).toBeGreaterThan(0);
      expect(['noCiq', 'notWatch', 'notYet', 'regional', 'otherBrand'], x.key).toContain(x.reason);
      if (x.reason === 'regional') expect(supportedById(x.of!), x.key).toBeDefined();
      if (x.reason === 'notWatch') expect(['band', 'scale', 'bike'], x.key).toContain(x.kind);
      if (Array.isArray(x.open)) expect(x.open.every((n) => x.names.includes(n)), x.key).toBe(true);
    }
  });

  test('the hand-kept groups: MARQ Gen 3 not yet, 4 refused Asian versions, 17 brands and Apple Watch', () => {
    const of = (reason: string) => EXTRA.filter((x) => x.reason === reason);
    expect(of('notYet').map((x) => x.key)).toEqual(['marq3']);
    expect(of('notYet')[0]!.names.filter((n) => n.includes('(Gen 3)') && n !== 'MARQ® (Gen 3)')).toHaveLength(6);
    expect(of('regional').map((x) => x.of)).toEqual(['descentmk343mm', 'descentmk351mm', 'fr945lte', 'marq2']);
    const brands = of('otherBrand');
    expect(brands).toHaveLength(18);
    expect(brands.every((x) => x.open === true)).toBe(true);
    expect(brands.filter((x) => x.only).map((x) => [x.key, x.only])).toEqual([['apple', 'ios']]);
  });

  test('every NICKNAMES key is a supported product', () => {
    for (const id of Object.keys(NICKNAMES)) expect(supportedById(id), id).toBeDefined();
  });

  test('every popular chip is one supported model, by its id and by its name', () => {
    expect(POPULAR).toEqual(['fr55', 'fr165', 'fr265', 'venu3', 'vivoactive5', 'fenix7']);
    for (const id of POPULAR) {
      const s = supportedById(id)!;
      expect(s, id).toBeDefined();
      const byId = answerFor(id);
      expect(byId.kind === 'one' && byId.hit.target.id, id).toBe(id);
      const byName = answer(s.names[0]!);
      expect(byName.kind === 'one' && byName.hit.target.key, id).toBe(id);
    }
  });
});

describe('supportedByLine', () => {
  const lines = supportedByLine();

  test('every supported product once, by its main name', () => {
    const ids = lines.flatMap((l) => l.models.map((m) => m.id));
    expect(ids.sort()).toEqual(GARMIN.supported.map((s) => s.id).sort());
    for (const l of lines) for (const m of l.models) expect(m.name).toBe(supportedById(m.id)!.names[0]);
  });

  test('lines in the order people look for them, models in natural order', () => {
    expect(lines.map((l) => l.series)).toEqual(['Forerunner', 'Venu', 'vívoactive', 'fēnix', 'epix', 'Instinct', 'Enduro', 'MARQ', 'Descent', 'Approach', 'D2', 'Legacy']);
    const fr = lines[0]!.models.map((m) => m.name);
    expect(fr.indexOf('Forerunner® 55')).toBeLessThan(fr.indexOf('Forerunner® 165'));
    expect(fr.indexOf('Forerunner® 965')).toBeLessThan(fr.indexOf('Forerunner® 970'));
  });
});
