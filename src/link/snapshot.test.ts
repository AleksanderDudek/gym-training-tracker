import { describe, expect, it } from 'vitest';
import { AAD, generateIdentity, isSnapshot, linkKey, openJson } from '@gymtracker/link';
import { freshState } from '../engine/plan';
import { db } from '../food/diet/db';
import { saveReport } from '../food/labs/store';
import { buildSnapshot, readExtras, sealSnapshot, windowStart } from './snapshot';
import type { AppState } from '../types';

/** Paczka dla prowadzącego: tylko udostępnione części, tylko z okna, i nie większa niż limit. */

const NOW = Date.parse('2026-11-03T12:00:00');
const day = (offset: number) => new Date(NOW + offset * 86_400_000).toISOString();
const dayKey = (offset: number) => day(offset).slice(0, 10);

function state(): AppState {
  const s = freshState();
  s.log = [
    { date: day(-1), workout: 'A', ready: 'ok', items: [] },
    { date: day(-400), workout: 'Stary', ready: 'ok', items: [] },
  ];
  s.body = [
    { day: dayKey(-500), kg: 90 },
    { day: dayKey(-2), kg: 82 },
  ];
  s.cardio = [{ key: 'k', day: dayKey(-3), at: day(-3), kind: 'steps', steps: 9000 }];
  s.cfg.height = 180;
  return s;
}

describe('paczka danych', () => {
  it('niesie tylko części z udostępnionych zakresów', () => {
    const snap = buildSnapshot(state(), ['body'], {}, NOW);
    expect(isSnapshot(snap)).toBe(true);
    expect(snap.scopes).toEqual(['body']);
    expect(snap.body?.height).toBe(180);
    expect(snap.training).toBeUndefined();
    expect(snap.movement).toBeUndefined();
    expect(snap.food).toBeUndefined();
    expect(snap.labs).toBeUndefined();
  });

  it('bez zakresów — sama koperta, żadnych danych', () => {
    const snap = buildSnapshot(state(), [], { food: { days: [], entries: [] }, labs: [] }, NOW);
    expect(Object.keys(snap).sort()).toEqual(['app', 'at', 'lang', 'scopes', 'tz', 'v']);
  });

  it('tylko ostatnie pół roku: starsze treningi i ważenia zostają na telefonie', () => {
    const snap = buildSnapshot(state(), ['training', 'body', 'movement'], {}, NOW);
    expect(snap.training?.log.map((e) => e.workout)).toEqual(['A']);
    expect(snap.body?.body.map((b) => b.kg)).toEqual([82]);
    expect(snap.movement?.cardio).toHaveLength(1);
    expect(windowStart(NOW, 180)).toBe(dayKey(-179));
  });

  it('jedzenie i badania tylko z zakresem — nawet gdy zostały wczytane', () => {
    const food = { days: [{ date: dayKey(-1), drinksMl: 1500, targetKcal: null, targetProtein: null, partial: null, note: null }], entries: [] };
    const labs = [{ date: dayKey(-10), lab: null, results: [] }, { date: dayKey(-300), lab: null, results: [] }];
    expect(buildSnapshot(state(), ['training'], { food, labs }, NOW).food).toBeUndefined();
    const both = buildSnapshot(state(), ['food', 'labs'], { food, labs }, NOW);
    expect(both.food?.days).toHaveLength(1);
    expect(both.labs?.visits).toHaveLength(1);
  });

  it('za duża paczka traci najstarsze dni, aż się zmieści; nie mieści się tydzień — nie idzie wcale', async () => {
    const coach = await generateIdentity(true);
    const phone = await generateIdentity(true);
    const key = await linkKey(phone.privateKey, coach.publicJwk, 'inv');
    const days: number[] = [];
    const big = (d: number) => {
      days.push(d);
      // Na każdy dzień okna kawałek losowego tekstu, którego gzip nie ściśnie.
      const s = state();
      s.log = Array.from({ length: d }, (_, i) => ({
        date: day(-i),
        workout: Array.from({ length: 40 }, () => Math.random().toString(36).slice(2)).join(''),
        ready: 'ok' as const,
        items: [],
      }));
      return buildSnapshot(s, ['training'], {}, NOW, d);
    };
    const sealed = await sealSnapshot(key, 'c1', big, 60_000);
    expect(sealed).not.toBeNull();
    expect(sealed!.days).toBeLessThan(180);
    expect(sealed!.bytes).toBe(sealed!.ciphertext.length);
    expect(sealed!.bytes).toBeLessThanOrEqual(60_000);
    expect(days[0]).toBe(180);
    const opened = (await openJson(key, AAD.snapshot('c1'), sealed!.ciphertext)) as { training: { log: unknown[] } };
    expect(opened.training.log).toHaveLength(sealed!.days);
    expect(await sealSnapshot(key, 'c1', big, 100)).toBeNull();
  });

  it('jedzenie i badania czyta z bazy dziennika — tylko te części, o które proszą zakresy', async () => {
    await db.entries.clear();
    await db.days.clear();
    await db.labs.clear();
    await db.entries.add({
      date: '2026-11-02',
      time: '08:15',
      name: 'Owsianka',
      amountLabel: '1 miska',
      kcal: 420,
      protein: 18,
      carbs: 60,
      fat: 9,
      source: 'quick',
      fiber: 7,
      sugars: null,
      salt: null,
    });
    await db.days.add({ date: '2026-11-02', drinks: [{ kind: 'water', ml: 500 }, { kind: 'water', ml: 250 }], partial: true, note: ' Dzień w biegu ' });
    await saveReport({
      date: '2026-10-20',
      lab: 'Diagnostyka',
      source: 'manual',
      addedAt: '2026-10-20T10:00:00.000Z',
      results: [{ marker: 'hgb', value: 14.2, cmp: null, qual: null, printed: '14,2 g/dl', ref: [12, 16] }],
    });
    expect(await readExtras(['training'], NOW)).toEqual({});
    const food = await readExtras(['food'], NOW);
    expect(food.labs).toBeUndefined();
    expect(food.food?.entries).toEqual([
      { date: '2026-11-02', time: '08:15', name: 'Owsianka', amount: '1 miska', kcal: 420, protein: 18, carbs: 60, fat: 9, fiber: 7, sugars: null, salt: null },
    ]);
    expect(food.food?.days).toEqual([
      { date: '2026-11-02', drinksMl: 750, targetKcal: null, targetProtein: null, partial: true, note: 'Dzień w biegu' },
    ]);
    const labs = await readExtras(['labs'], NOW);
    expect(labs.food).toBeUndefined();
    expect(labs.labs?.[0]).toMatchObject({ date: '2026-10-20', lab: 'Diagnostyka' });
    expect(labs.labs?.[0]?.results[0]).toEqual({ marker: 'hgb', value: 14.2, cmp: null, printed: '14,2 g/dl', ref: [12, 16], qual: null });
  });
});
