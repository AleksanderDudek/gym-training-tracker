import { describe, expect, it } from 'vitest';
import { parseAssignment, parsePseudonym } from '@gymtracker/link';
import type { SnapshotV1 } from '@gymtracker/link';
import { crmCsv, importAliases, loadAliases, saveAlias } from '../src/lib/aliases';
import { foodDays, overview, stateOf } from '../src/lib/metrics';
import { commitVault, draftVault, loadDeviceKey, rekey, unlock } from '../src/lib/vault';
import { toAssignment } from '../src/pages/Send';
import type { LibraryItem } from '../src/lib/data';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-03T12:00:00Z');
const day = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10);

function snap(): SnapshotV1 {
  return {
    v: 1,
    at: NOW - 2 * 3600_000,
    tz: 'Europe/Warsaw',
    lang: 'pl',
    app: 'test',
    scopes: ['training', 'body', 'food'],
    training: {
      log: [3, 6, 10, 13].map((n) => ({
        date: new Date(NOW - n * DAY).toISOString(),
        workout: 'Góra A',
        ready: 'ok',
        items: [{ id: 'swing', effort: 'solid', sets: [{ reps: 12, w: 16 }, { reps: 12, w: 16 }] }],
        time: { secs: 3000, parts: [] },
      })) as SnapshotV1['training'] extends infer T ? (T extends { log: infer L } ? L : never) : never,
      plan: null,
      plans: [],
      workouts: [],
      snacks: [],
    },
    body: { body: [14, 7, 1].map((n, i) => ({ day: day(n), kg: 85 - i * 0.6 })), measures: [] },
    food: {
      days: [{ date: day(1), drinksMl: 1500, targetKcal: 2200, targetProtein: 150, partial: false, note: null }],
      entries: [
        { date: day(1), time: '08:00', name: 'Skyr', amount: '150 g', kcal: 100, protein: 18, carbs: 6, fat: 0, fiber: null, sugars: null, salt: null },
        { date: day(1), time: '13:00', name: 'Kurczak', amount: '200 g', kcal: 330, protein: 62, carbs: 0, fat: 7, fiber: null, sugars: null, salt: null },
      ],
    },
  };
}

describe('Pulpit z paczki', () => {
  it('liczy z silnika GYM TRACKERa: treningi w tygodniu, tonaż, waga, białko', () => {
    const ov = overview(snap(), NOW);
    expect(ov.perWeek).toBe(1);
    expect(ov.sessions[0]).toMatchObject({ name: 'Góra A', minutes: 50, tonnage: 384, sets: 2 });
    expect(ov.weight.series.map((p) => p.kg)).toEqual([85, 84.4, 83.8]);
    expect(ov.food).toMatchObject({ days: 1, kcal: 430, protein: 80, targetProtein: 150 });
    expect(ov.flags).toContain('protein_low');
    expect(ov.flags).not.toContain('stale');
  });

  it('czego nie udostępniono, tego nie ma — zamiast zer', () => {
    const s = { ...snap(), scopes: ['body'] as SnapshotV1['scopes'] };
    delete s.training;
    delete s.food;
    const ov = overview(s, NOW);
    expect(ov.perWeek).toBeNull();
    expect(ov.food).toBeNull();
    expect(ov.sessions).toEqual([]);
    expect(stateOf(s).log).toEqual([]);
  });

  it('stara paczka jest oznaczona', () => {
    expect(overview({ ...snap(), at: NOW - 9 * DAY }, NOW).flags).toContain('stale');
  });

  it('dni jedzenia: sumy i wpisy po godzinie', () => {
    const [d] = foodDays(snap());
    expect(d).toMatchObject({ kcal: 430, protein: 80, drinksMl: 1500, targetKcal: 2200 });
    expect(d!.entries.map((e) => e.name)).toEqual(['Skyr', 'Kurczak']);
  });
});

describe('Wysyłka', () => {
  it('plan z biblioteki zabiera swoje treningi i ich wideo; gotowe zostają odnośnikiem', () => {
    const lib: LibraryItem[] = [
      { id: '1', kind: 'workout', title: 'A', createdAt: '', updatedAt: '', body: { kind: 'workout', workout: { id: 'w-a', name: 'A', items: [{ ex: 'swing' }] }, videos: { swing: 'https://youtu.be/x1' } } },
      { id: '2', kind: 'workout', title: 'B', createdAt: '', updatedAt: '', body: { kind: 'workout', workout: { id: 'w-b', name: 'B', items: [{ ex: 'goblet' }] }, videos: {} } },
    ];
    const a = toAssignment(
      { kind: 'plan', plan: { id: 'p-1', name: 'Siła', level: 'base', sex: 'any', daysPerWeek: 2, weeks: 8, loadFactor: 1, cycle: ['w-a', 'full-kb-a'], weekdays: [1, 4], desc: '' } },
      lib,
      'Powodzenia',
    );
    expect(a.kind).toBe('plan');
    if (a.kind !== 'plan') return;
    expect(a.workouts.map((w) => w.id)).toEqual(['w-a']);
    expect(a.videos).toEqual({ swing: 'https://youtu.be/x1' });
    expect(parseAssignment({ v: 1, id: 'x', area: 'training', sentAt: 1, from: { name: 'Anna', profession: 'trainer' }, body: a })).not.toBeNull();
  });
});

describe('Sejf', () => {
  it('klucz trafia na komputer dopiero po zatwierdzeniu, kod otwiera go na nowym, nowy kod zastępuje stary', async () => {
    const user = crypto.randomUUID();
    const d = await draftVault(user, 1000);
    expect(await loadDeviceKey(user)).toBeUndefined();
    await commitVault(user, d);
    const k = await loadDeviceKey(user);
    expect(k?.fingerprint).toBe(d.fingerprint);
    expect(k?.privateKey.extractable).toBe(false);

    const other = crypto.randomUUID();
    expect(await unlock(other, d.sealed, d.code, d.fingerprint)).toBe(false);

    const r = await rekey(user, d.sealed, d.code, 1000);
    expect(r).not.toBeNull();
    expect(await unlock(user, r!.sealed, d.code, d.fingerprint)).toBe(false);
    expect(await unlock(user, r!.sealed, r!.code, d.fingerprint)).toBe(true);
  });
});

describe('Skróty prowadzącego', () => {
  it('kluczowane numerem, tylko poprawne numery, CSV bez formuł', () => {
    const u = crypto.randomUUID();
    const id = parsePseudonym('GT-7K4Q-9XM2-HT3P-ZR8W-E5NA')!;
    saveAlias(u, id, '  Jan, wtorki  ');
    expect(loadAliases(u)).toEqual({ [id]: 'Jan, wtorki' });
    saveAlias(u, id, '');
    expect(loadAliases(u)).toEqual({});
    expect(importAliases(u, { [id]: 'Ola', nonsense: 'x' })).toBe(1);
    const csv = crmCsv([{ pseudonym: 'GT-1', alias: '=HYPERLINK("x")', areas: 'Trening', since: '1.11', status: 'trwa' }]);
    expect(csv.startsWith('﻿ID;')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
