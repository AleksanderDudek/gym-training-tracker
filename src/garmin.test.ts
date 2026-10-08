import { describe, expect, it } from 'vitest';
import { readPull, whenText } from './garmin';
import { deriveKeys, newKey, seal } from './watchseal';

/** Odpowiedź serwera na odbiór paczki — bez sieci: koperta, jej treść i jej brak. */

const NOW = Date.parse('2026-10-08T18:00:00Z');
const PAYLOAD = { v: 1, t: NOW / 1000 - 60, d: [['2026-10-08', 9120]], a: [], h: [] };

describe('odbiór paczki', () => {
  it('otwiera kopertę i oddaje paczkę', async () => {
    const keys = (await deriveKeys(newKey()))!;
    const blob = await seal(keys, JSON.stringify(PAYLOAD));
    const r = await readPull(keys, 200, { blob, updated: NOW }, NOW);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.payload.days[0]!.steps).toBe(9120);
  });

  it('pusta skrzynka, awaria serwera, obcy klucz i nie-paczka', async () => {
    const keys = (await deriveKeys(newKey()))!;
    const other = (await deriveKeys(newKey()))!;
    expect((await readPull(keys, 404, null, NOW)).kind).toBe('empty');
    expect((await readPull(keys, 503, null, NOW)).kind).toBe('offline');
    expect((await readPull(keys, 200, { blob: await seal(other, JSON.stringify(PAYLOAD)) }, NOW)).kind).toBe('bad');
    expect((await readPull(keys, 200, { blob: await seal(keys, 'to nie JSON') }, NOW)).kind).toBe('bad');
    expect((await readPull(keys, 200, { blob: await seal(keys, '{"v":9}') }, NOW)).kind).toBe('bad');
    expect((await readPull(keys, 200, {}, NOW)).kind).toBe('bad');
  });
});

describe('kiedy przyszły dane', () => {
  const now = new Date(2026, 9, 8, 18, 0);
  it('dziś, wczoraj albo data', () => {
    expect(whenText(new Date(2026, 9, 8, 14, 5).toISOString(), now)).toBe('dziś 14:05');
    expect(whenText(new Date(2026, 9, 7, 7, 30).toISOString(), now)).toBe('wczoraj 7:30');
    expect(whenText(new Date(2026, 9, 1, 21, 40).toISOString(), now)).toBe('1.10 21:40');
  });
});
