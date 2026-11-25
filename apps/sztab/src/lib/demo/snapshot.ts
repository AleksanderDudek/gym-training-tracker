import type { SnapshotV1 } from '@gymtracker/link';

/**
 * Paczka telefonu demo: siedem tygodni treningów z planu, ważenia, obwody, dziennik jedzenia, kroki
 * i jedno badanie — w kształcie, w jakim wysyła ją GYM TRACKER. Wspólna dla „Podopiecznego
 * demonstracyjnego” w Sztabie i skryptów `scripts/demo-client.ts`, `scripts/seed.ts` (Node), więc
 * importuje tylko protokół — bez aliasu `@gt` i bez katalogów tekstów aplikacji.
 *
 * Dni liczą się od `now` wstecz; wartości są pseudolosowe, ale stałe dla danego dnia wstecz, więc
 * kolejna paczka tego samego dnia mówi to samo.
 */

export type DemoLang = 'pl' | 'en';

/** Strefa telefonu demo — w niej telefon liczy dni odhaczeń i okresy formularzy (`snapshot.tz`). */
export const DEMO_TZ = 'Europe/Warsaw';

const DAY = 86_400_000;

/** Pseudolosowo z liczby: [0, 1). */
export const rand = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const WORDS = {
  pl: {
    workouts: ['Góra A', 'Dół A', 'Góra B'],
    kneeNote: 'Lewe kolano trochę ciągnęło przy przysiadzie',
    meals: [
      ['Owsianka z jogurtem', '350 g'],
      ['Kurczak, ryż, warzywa', '450 g'],
      ['Skyr naturalny', '150 g'],
      ['Kanapki z twarożkiem', '3 szt.'],
    ],
    lab: 'Diagnostyka',
  },
  en: {
    workouts: ['Upper A', 'Lower A', 'Upper B'],
    kneeNote: 'Left knee pulled a little in the squat',
    meals: [
      ['Porridge with yoghurt', '350 g'],
      ['Chicken, rice, vegetables', '450 g'],
      ['Plain skyr', '150 g'],
      ['Sandwiches with quark', '3 pcs'],
    ],
    lab: 'Diagnostics lab',
  },
};

/** Waga telefonu demo w danym dniu wstecz (od 87,2 kg siedem tygodni temu, ok. −0,45 kg na tydzień). */
export const demoWeight = (daysAgo: number): number => Math.round((87.2 - (49 - daysAgo) * 0.065 + (rand(daysAgo) - 0.5) * 0.6) * 10) / 10;

export function demoSnapshot(scopes: SnapshotV1['scopes'], opts: { now?: number; lang?: DemoLang } = {}): SnapshotV1 {
  const now = opts.now ?? Date.now();
  const w = WORDS[opts.lang ?? 'pl'];
  const iso = (daysAgo: number, h = 18) => new Date(Math.floor((now - daysAgo * DAY) / DAY) * DAY + h * 3600_000).toISOString();
  const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);
  const start = day(49);
  const plan = { templateId: 'cel-gora-dol-kb-60', start, ticked: {}, weekdays: [1, 3, 5] };
  const log: NonNullable<SnapshotV1['training']>['log'] = [];
  let n = 0;
  for (let d = 49; d >= 1; d--) {
    const wd = new Date(now - d * DAY).getUTCDay();
    if (![1, 3, 5].includes(wd) || rand(d) < 0.12) continue;
    const k = n++ % 3;
    const prog = 1 + (49 - d) / 160;
    log.push({
      date: iso(d),
      workout: w.workouts[k]!,
      ready: 'ok',
      items:
        k === 1
          ? [
              { id: 'goblet', effort: 'solid', sets: [0, 1, 2].map(() => ({ reps: 10, w: Math.round(20 * prog) })) },
              { id: 'rdl', effort: 'solid', sets: [0, 1, 2].map(() => ({ reps: 8, w: Math.round(24 * prog) })) },
            ]
          : [
              { id: 'press', effort: 'solid', sets: [0, 1, 2].map(() => ({ reps: 8, w: Math.round(12 * prog) })) },
              { id: 'row', effort: 'easy', sets: [0, 1, 2].map(() => ({ reps: 10, w: Math.round(16 * prog) })) },
            ],
      time: { secs: 2900 + Math.round(rand(d + 3) * 900), parts: [] },
      ...(d === 6 ? { note: w.kneeNote } : {}),
    } as never);
  }
  const body = Array.from({ length: 25 }, (_, i) => 49 - i * 2)
    .filter((d) => d >= 0)
    .map((d) => ({ day: day(d), kg: demoWeight(d) }));
  const entries: NonNullable<SnapshotV1['food']>['entries'] = [];
  const days: NonNullable<SnapshotV1['food']>['days'] = [];
  const macros: [string, number, number, number, number][] = [
    ['07:40', 480, 24, 62, 12],
    ['12:30', 640, 48, 72, 14],
    ['16:00', 95, 17, 6, 0],
    ['19:30', 520, 26, 58, 18],
  ];
  for (let d = 21; d >= 1; d--) {
    const date = day(d);
    days.push({ date, drinksMl: 1500 + Math.round(rand(d) * 1000), targetKcal: 2000, targetProtein: 140, partial: d === 9, note: null });
    macros.forEach(([time, kcal, protein, carbs, fat], i) =>
      entries.push({
        date,
        time,
        name: w.meals[i]![0]!,
        amount: w.meals[i]![1]!,
        kcal: Math.round(kcal * (0.9 + rand(d * 7 + i) * 0.25)),
        protein,
        carbs,
        fat,
        fiber: null,
        sugars: null,
        salt: null,
      }),
    );
  }
  const cardio = Array.from({ length: 21 }, (_, i) => ({ kind: 'steps', day: day(i + 1), steps: 6500 + Math.round(rand(i) * 5000), key: `s${i}`, src: 'manual' }));
  return {
    v: 1,
    at: now,
    tz: DEMO_TZ,
    lang: opts.lang ?? 'pl',
    app: 'demo-client',
    scopes,
    ...(scopes.includes('training') ? { training: { log, plan, plans: [], workouts: [], snacks: [] } } : {}),
    ...(scopes.includes('movement') ? { movement: { cardio: cardio as never } } : {}),
    ...(scopes.includes('body')
      ? { body: { body, measures: [{ day: day(42), waist: 96, hips: 104 }, { day: day(7), waist: 92.5, hips: 102 }], height: 181 } }
      : {}),
    ...(scopes.includes('food') ? { food: { days, entries } } : {}),
    ...(scopes.includes('labs')
      ? {
          labs: {
            visits: [
              {
                date: day(30),
                lab: w.lab,
                results: [
                  { marker: 'vitD', value: 18.4, cmp: null, printed: '18,4 ng/ml', ref: [30, 50], qual: null },
                  { marker: 'ferritin', value: 64, cmp: null, printed: '64 ng/ml', ref: [30, 400], qual: null },
                ],
              },
            ],
          },
        }
      : {}),
  };
}
