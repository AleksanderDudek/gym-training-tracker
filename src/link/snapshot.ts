import { AAD, SNAPSHOT_DAYS, SNAPSHOT_MAX_CHARS, sealJson } from '@gymtracker/link';
import type { FoodDay, FoodEntry, LabVisit, Scope, SnapshotV1 } from '@gymtracker/link';
import { version } from '../../package.json';
import { LANG } from '../i18n';
import { localDayOf } from '../engine/watch';
import type { AppState } from '../types';

/**
 * Paczka dla prowadzącego (`SnapshotV1`): tylko części, na które podopieczny się zgodził
 * (`scopes`), i tylko z ostatnich `SNAPSHOT_DAYS` dni. Treningi, ruch i ciało są w zapisie
 * aplikacji; jedzenie i badania w bazie Dexie — tę czyta `readFood`, wczytywane leniwie jak raport
 * dla dietetyka, więc start aplikacji nie wczytuje kodu jedzenia.
 */

export interface FoodPart {
  days: FoodDay[];
  entries: FoodEntry[];
}

export interface Extras {
  food?: FoodPart | null;
  labs?: LabVisit[] | null;
}

const DAY_MS = 86_400_000;

/** Pierwszy dzień okna (lokalnie), włącznie. */
export const windowStart = (now: number, days: number): string => localDayOf(new Date(now - (days - 1) * DAY_MS));

const inDay = (day: string | undefined, from: string): boolean => typeof day === 'string' && day >= from;
const inIso = (iso: string | undefined, from: string): boolean => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) && localDayOf(new Date(t)) >= from;
};

const tz = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export function buildSnapshot(state: AppState, scopes: readonly Scope[], extras: Extras, now: number, days = SNAPSHOT_DAYS): SnapshotV1 {
  const from = windowStart(now, days);
  const has = (s: Scope) => scopes.includes(s);
  const snap: SnapshotV1 = { v: 1, at: now, tz: tz(), lang: LANG, app: version, scopes: [...scopes] };
  if (has('training')) {
    snap.training = {
      log: state.log.filter((e) => inIso(e.date, from)),
      plan: state.plan,
      plans: state.plans ?? [],
      workouts: state.workouts,
      snacks: state.snacks.filter((x) => inIso(x.at, from)),
      ...(state.catalog ? { catalog: state.catalog } : {}),
    };
  }
  if (has('movement')) {
    snap.movement = { cardio: state.cardio.filter((c) => inDay(c.day, from)) };
    if (state.watch) {
      const w = state.watch;
      snap.movement.watch = {
        ...w,
        days: w.days.filter((d) => inDay(d.day, from)),
        acts: w.acts.filter((a) => a.start * 1000 >= Date.parse(`${from}T00:00:00`)),
        health: w.health.filter((d) => inDay(d.day, from)),
      };
    }
    if (state.phone) {
      const p = state.phone;
      snap.movement.phone = {
        ...p,
        days: p.days.filter((d) => inDay(d.day, from)),
        acts: p.acts.filter((a) => a.start * 1000 >= Date.parse(`${from}T00:00:00`)),
      };
    }
  }
  if (has('body')) {
    snap.body = {
      body: state.body.filter((b) => inDay(b.day, from)),
      measures: (state.measures ?? []).filter((m) => inDay(m.day, from)),
      ...(state.cfg.height !== undefined ? { height: state.cfg.height } : {}),
    };
  }
  if (has('food') && extras.food) {
    snap.food = {
      days: extras.food.days.filter((d) => inDay(d.date, from)),
      entries: extras.food.entries.filter((e) => inDay(e.date, from)),
    };
  }
  if (has('labs') && extras.labs) snap.labs = { visits: extras.labs.filter((v) => inDay(v.date, from)) };
  return snap;
}

/**
 * Paczka zaszyfrowana kluczem współpracy. Za duża — bez najstarszych dni, aż się zmieści (okno
 * kurczy się o czwartą część na raz). Gdy nie mieści się nawet tydzień, nie wysyłamy niczego:
 * `null`. `bytes` to długość szyfrogramu.
 */
export async function sealSnapshot(
  key: CryptoKey,
  connectionId: string,
  build: (days: number) => SnapshotV1,
  max = SNAPSHOT_MAX_CHARS,
): Promise<{ ciphertext: string; bytes: number; days: number } | null> {
  for (let days = SNAPSHOT_DAYS; days >= 7; days = Math.floor(days * 0.75)) {
    const ciphertext = await sealJson(key, AAD.snapshot(connectionId), build(days));
    if (ciphertext.length <= max) return { ciphertext, bytes: ciphertext.length, days };
  }
  return null;
}

/**
 * Jedzenie i badania z bazy Dexie — tylko te części, o które proszą zakresy. Każdy wiersz
 * przechodzi przez te same sita co raport i kopia (`clean…`). Bez bazy (brak IndexedDB) — `null`,
 * a paczka idzie bez tych części.
 */
export async function readExtras(scopes: readonly Scope[], now: number): Promise<Extras> {
  const wantFood = scopes.includes('food');
  const wantLabs = scopes.includes('labs');
  if (!wantFood && !wantLabs) return {};
  try {
    const [{ db }, validate, { drinksOf, hydration }, target, { DIET_PROFILES }, { loadReports }] = await Promise.all([
      import('../food/diet/db'),
      import('../food/diet/validate'),
      import('../food/diet/drinks'),
      import('../food/diet/target'),
      import('../food/diet/profiles'),
      import('../food/labs/store'),
    ]);
    const out: Extras = {};
    if (wantFood) {
      const today = localDayOf(new Date(now));
      const [row, entries, days] = await Promise.all([db.profile.get('me'), db.entries.toArray(), db.days.toArray()]);
      const profile = row ? validate.cleanProfile(row, { today }) : null;
      const showTargets = !!profile && !target.hidesKcal(profile);
      const cleanEntries = validate.cleanRows(entries, validate.cleanEntry).rows;
      const cleanDays = validate.cleanRows(days, validate.cleanDay).rows;
      const dates = new Set<string>([...cleanEntries.map((e) => e.date), ...cleanDays.map((d) => d.date)]);
      const rowOf = new Map(cleanDays.map((d) => [d.date, d]));
      out.food = {
        entries: cleanEntries.map((e) => ({
          date: e.date,
          time: e.time,
          name: e.name,
          amount: e.amountLabel,
          kcal: e.kcal,
          protein: e.protein,
          carbs: e.carbs,
          fat: e.fat,
          fiber: e.fiber ?? null,
          sugars: e.sugars ?? null,
          salt: e.salt ?? null,
        })),
        days: [...dates].sort().map((date): FoodDay => {
          const d = rowOf.get(date);
          const drinks = drinksOf(d);
          const kcal = showTargets && profile && date >= profile.startDate ? target.targetOn(profile, date) : null;
          const protein = kcal !== null && profile ? DIET_PROFILES[profile.dietProfile].targets(kcal, profile.targetWeightKg).protein.target : null;
          return {
            date,
            drinksMl: drinks.length ? hydration(drinks).total : null,
            targetKcal: kcal,
            targetProtein: protein,
            partial: d?.partial ?? null,
            note: d?.note?.trim() || null,
          };
        }),
      };
    }
    if (wantLabs) {
      const reports = await loadReports(db);
      out.labs = reports.map((r) => ({
        date: r.date,
        lab: r.lab,
        results: r.results.map((x) => ({ marker: x.marker, value: x.value, cmp: x.cmp, printed: x.printed, ref: x.ref, qual: x.qual })),
      }));
    }
    return out;
  } catch {
    return {};
  }
}
