// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DietDb } from './diet/db';
import { saveProfile, completeProfile, logQuick, updateDay } from './diet/store';
import { clearFood, dietBackup, forgetDietWeights, restoreDiet } from './backup';
import { DIET_FLAG, hasDiet } from './dietFlag';

let database: DietDb;
let n = 0;

beforeEach(() => {
  database = new DietDb(`backup-test-${n++}`);
  window.localStorage.clear();
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe('kopia jedzenia', () => {
  it('pusty dziennik nie trafia do pliku', async () => {
    expect(await dietBackup(database)).toBeNull();
  });

  it('dziennik z profilem i wpisem trafia do pliku i wraca z niego', async () => {
    await saveProfile(completeProfile({ dailyKcal: 2100 }), database);
    await logQuick('2026-10-11', 'Obiad na mieście', 650, {}, database);
    const backup = await dietBackup(database);
    expect(backup?.profile?.dailyKcal).toBe(2100);
    expect(backup?.entries).toHaveLength(1);

    const other = new DietDb(`backup-test-${n++}`);
    try {
      await restoreDiet(backup, other);
      expect(await other.entries.count()).toBe(1);
      expect(hasDiet()).toBe(true);
    } finally {
      other.close();
      await other.delete();
    }
  });

  it('kopia bez profilu zdejmuje znacznik diety', async () => {
    window.localStorage.setItem(DIET_FLAG, '1');
    await restoreDiet({ app: 'produkty-pl', version: 1, profile: null, days: [], entries: [], plans: [], foods: [] }, database);
    expect(hasDiet()).toBe(false);
  });

  it('reset czyści dziennik, znacznik i zapamiętane miejsce sklepów', async () => {
    await saveProfile(completeProfile({}), database);
    window.localStorage.setItem(DIET_FLAG, '1');
    window.localStorage.setItem('produkty-pl:position', '{"lat":52,"lon":21}');
    window.localStorage.setItem('kb-trener-v3', '{}');
    await clearFood(database);
    expect(await database.profile.count()).toBe(0);
    expect(hasDiet()).toBe(false);
    expect(window.localStorage.getItem('produkty-pl:position')).toBeNull();
    // Zapis treningu czyści aplikacja osobno — tu zostaje nietknięty.
    expect(window.localStorage.getItem('kb-trener-v3')).toBe('{}');
  });

  it('po przeniesieniu ważeń dziennik diety zapomina własne, resztę dnia zostawia', async () => {
    await updateDay('2026-10-10', { weightKg: 84.2, steps: 9000 }, database);
    await updateDay('2026-10-11', { steps: 4000 }, database);
    await forgetDietWeights(database);
    const days = await database.days.toArray();
    expect(days.map((d) => d.weightKg)).toEqual([undefined, undefined]);
    expect(days.map((d) => d.steps)).toEqual([9000, 4000]);
  });
});
