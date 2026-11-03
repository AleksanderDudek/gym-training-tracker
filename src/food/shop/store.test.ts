// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import { DietDb } from '../diet/db';
import { completeProfile, saveProfile } from '../diet/store';
import { readSource, readTicks, saveShopping, writeSource, writeTicks } from './store';

beforeEach(() => window.localStorage.clear());

describe('the shopping rhythm on the profile', () => {
  test('writes only the rhythm, keeps the rest of the stored row', async () => {
    const db = new DietDb(`test-${Math.random()}`);
    await saveProfile({ ...completeProfile({ age: 41 }), waterMl: 2500 }, db);
    await saveShopping({ kind: 'every', days: 10, from: '2026-11-07', at: '18:00' }, db);
    expect(await db.profile.get('me')).toMatchObject({ age: 41, waterMl: 2500, shopping: { kind: 'every', days: 10, from: '2026-11-07', at: '18:00' } });
  });

  test('no profile, or one not yet upgraded: nothing is written', async () => {
    const db = new DietDb(`test-${Math.random()}`);
    await saveShopping({ kind: 'weekdays', days: [6], at: '10:00' }, db);
    expect(await db.profile.get('me')).toBeUndefined();
    await db.profile.put({ ...completeProfile({}), version: 1, id: 'me' } as never);
    await saveShopping({ kind: 'weekdays', days: [6], at: '10:00' }, db);
    expect((await db.profile.get('me'))!.shopping).toBeUndefined();
  });
});

describe('ticks and the chosen list, on the device', () => {
  test('ticks belong to one shopping day', () => {
    expect(writeTicks('2026-11-07', ['skyr', 'product:590'])).toBe(true);
    expect(readTicks('2026-11-07')).toEqual(['skyr', 'product:590']);
    expect(readTicks('2026-11-14')).toEqual([]);
    writeTicks('2026-11-07', []);
    expect(window.localStorage.getItem('gt:zakupy-dziennik')).toBeNull();
  });

  test('anything unreadable is no ticks and no choice', () => {
    window.localStorage.setItem('gt:zakupy-dziennik', '{nie json');
    expect(readTicks('2026-11-07')).toEqual([]);
    window.localStorage.setItem('gt:zakupy-dziennik', JSON.stringify({ shop: '2026-11-07', keys: ['skyr', 3] }));
    expect(readTicks('2026-11-07')).toEqual(['skyr']);
    window.localStorage.setItem('gt:zakupy-zrodlo', 'sklep');
    expect(readSource()).toBeNull();
    writeSource('plan');
    expect(readSource()).toBe('plan');
  });
});
