import { NO_DIET, type DietCalendar } from '../engine/calendar';
import { db as defaultDb, type DietDb } from './diet/db';
import { hasDiet } from './dietFlag';
import { retestOf } from './labs/retest';
import { MARKERS } from './labs/markers';
import { loadPrefs, loadReports } from './labs/store';
import { cleanRhythm } from './shop/rhythm';

/**
 * The diet's part of the calendar (`#/kalendarz`, the Today card, push reminders): the shopping
 * rhythm from the diet profile, the follow-up lab test of a started lab plan and the days of saved
 * lab results. Loaded with a dynamic import, together with Dexie — someone who only trains never
 * loads the diet database at start.
 *
 * Labs work without a diet profile, so the flag alone is not enough: an existing database counts
 * too. Without either, nothing is opened, so the calendar does not create an empty database.
 */

const DB_NAME = 'produkty-pl-dieta';

async function dietDbExists(): Promise<boolean> {
  if (hasDiet()) return true;
  try {
    const list = await indexedDB.databases?.();
    // A browser without `databases()` (older Firefox): only the flag decides.
    return !!list?.some((d) => d.name === DB_NAME);
  } catch {
    return false;
  }
}

export async function loadDietCalendar(database: DietDb = defaultDb, check = database === defaultDb): Promise<DietCalendar> {
  if (check && !(await dietDbExists())) return NO_DIET;
  const [row, prefs, reports] = await Promise.all([database.profile.get('me'), loadPrefs(database), loadReports(database)]);
  const plan = prefs.plan;
  // Results newer than the ones the plan was made from, saved after its start: the follow-up is done.
  const retested = !!plan && reports.some((r) => r.date > plan.basedOn && r.date >= plan.start);
  const retest = plan && !retested ? retestOf(plan) : null;
  return {
    shop: row ? cleanRhythm(row.shopping) : null,
    retest: retest ? { date: retest.date, markers: retest.markers.map((m) => MARKERS[m]?.short ?? MARKERS[m]?.name ?? m) } : null,
    labDays: [...new Set(reports.map((r) => r.date))].sort(),
  };
}
