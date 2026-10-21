import { describe, expect, it } from 'vitest';
import vector from '../health/vectors.json';
import { platformOf, readPhonePull } from './phone';
import { deriveKeys, hexBytes, newKey, seal } from './watchseal';

/**
 * Odbiór paczki z telefonu — bez sieci. Wspólny wektor (`health/vectors.json`) pieczętują też
 * testy aplikacji na Androida i iPhone'a: jeśli któraś strona się rozjedzie, ten test albo tamte
 * przestaną przechodzić.
 */

const NOW = Date.parse('2026-10-21T08:00:00Z');

describe('paczka z telefonu w skrzynce', () => {
  it('wspólny wektor: ta sama skrzynka, ta sama koperta bajt w bajt, ta sama treść', async () => {
    const keys = (await deriveKeys(vector.key))!;
    expect(keys.box).toBe(vector.box);
    expect([...keys.enc].map((b) => b.toString(16).padStart(2, '0')).join('')).toBe(vector.enc);
    expect([...keys.mac].map((b) => b.toString(16).padStart(2, '0')).join('')).toBe(vector.mac);
    expect(await seal(keys, vector.plaintext, hexBytes(vector.iv)!)).toBe(vector.blob);
    const r = await readPhonePull(keys, 200, { blob: vector.blob, updated: NOW }, NOW);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.payload.days.map((d) => d.steps)).toEqual([4210, 9120]);
  });

  it('paczka zegarka w skrzynce telefonu to zła paczka, nie dane', async () => {
    const keys = (await deriveKeys(newKey()))!;
    const watch = { v: 1, t: NOW / 1000 - 60, d: [['2026-10-20', 9120]], a: [], h: [] };
    expect((await readPhonePull(keys, 200, { blob: await seal(keys, JSON.stringify(watch)) }, NOW)).kind).toBe('bad');
    expect((await readPhonePull(keys, 404, null, NOW)).kind).toBe('empty');
    expect((await readPhonePull(keys, 502, null, NOW)).kind).toBe('offline');
  });
});

describe('na czym otwarto stronę', () => {
  it('iPhone, iPad udający Maca, Android i komputer', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other');
    expect(platformOf('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('android');
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('other');
  });
});
