import { afterEach, describe, expect, it } from 'vitest';
import { loadDietCalendar } from './calendar';
import { DietDb } from './diet/db';
import { completeProfile } from './diet/store';
import { retestOf } from './labs/retest';
import type { LabReport } from './labs/types';

/** The diet's part of the calendar, read from IndexedDB: shopping rhythm, follow-up test, lab days. */

const report = (date: string): Omit<LabReport, 'id'> => ({
  date,
  lab: null,
  source: 'manual',
  results: [{ marker: 'hgb', value: 14, cmp: null, qual: null, printed: '14 g/dl', ref: null }],
  addedAt: `${date}T10:00:00.000Z`,
});

describe('diet part of the calendar', () => {
  let database: DietDb | null = null;
  afterEach(async () => {
    await database?.delete();
    database = null;
  });

  it('empty database: no rhythm, no follow-up, no lab days', async () => {
    database = new DietDb('calendar-empty');
    expect(await loadDietCalendar(database)).toEqual({ shop: null, retest: null, labDays: [] });
  });

  it('rhythm from the profile, follow-up from the lab plan, collection days from reports', async () => {
    database = new DietDb('calendar-full');
    await database.profile.put({ ...completeProfile({ shopping: { kind: 'weekdays', days: [6], at: '10:00' } }), id: 'me' });
    const plan = { start: '2026-11-02', focus: ['iron'], basedOn: '2026-10-30' };
    await database.labPrefs.put({ id: 'me', eats: 'all', sex: null, age: null, plan });
    await database.labs.add(report('2026-10-30'));
    await database.labs.add(report('2026-06-01'));
    const cal = await loadDietCalendar(database);
    expect(cal.shop).toEqual({ kind: 'weekdays', days: [6], at: '10:00' });
    expect(cal.retest?.date).toBe(retestOf(plan).date);
    expect(cal.retest!.markers.length).toBeGreaterThan(0);
    expect(cal.retest!.markers.every((m) => typeof m === 'string' && m.length > 0)).toBe(true);
    expect(cal.labDays).toEqual(['2026-06-01', '2026-10-30']);
  });

  it('a broken rhythm is no rhythm', async () => {
    database = new DietDb('calendar-broken');
    await database.profile.put({ ...completeProfile({}), shopping: { kind: 'weekdays', days: [9], at: 'x' } as never, id: 'me' });
    expect((await loadDietCalendar(database)).shop).toBeNull();
  });

  it('newer results after the plan started: the follow-up is done', async () => {
    database = new DietDb('calendar-retested');
    await database.labPrefs.put({ id: 'me', eats: 'all', sex: null, age: null, plan: { start: '2026-08-01', focus: ['iron'], basedOn: '2026-07-30' } });
    await database.labs.add(report('2026-07-30'));
    await database.labs.add(report('2026-10-25'));
    expect((await loadDietCalendar(database)).retest).toBeNull();
  });
});
