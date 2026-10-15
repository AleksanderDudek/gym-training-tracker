/**
 * Seed generator for the demo videos: a fictional person, no real data.
 *
 * Replays ~7 weeks of a realistic user THROUGH THE APP'S OWN ENGINE (progression, calibration,
 * badges with their real unlock dates, plan schedule), so every derived number in the UI is
 * consistent. Then builds the diet backup from real catalog data (products base, recipes,
 * restaurant menus) and validates both halves with the same validators the import uses.
 *
 * It runs under vitest (the food catalogs use `import.meta.glob`, and the check of the diet half
 * needs the in-memory IndexedDB of the test setup):
 *   npm run demo:seed
 *
 * Output (next to this file), each a backup file for Ustawienia → „Importuj plik”:
 *   full.json  – the person after ~7 weeks: plan, sessions, weights, steps, badges, and `diet`
 *   fresh.json – someone who has just installed the app: height and one weigh-in, nothing else
 *
 * Every take lives on DEMO_DATE (the recorder installs the browser clock there), so the files do
 * not age; re-run only after a change to the app's data model.
 */
import { expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');
const { freshState, seedFromPlan, plan: prescribe, P } = await import(`${SRC}/engine/plan`);
const { applyResult, applyLayoff } = await import(`${SRC}/engine/progression`);
const { syncBadges, achCtx, migrateBadges } = await import(`${SRC}/engine/badges`);
const { snapshot } = await import(`${SRC}/engine/snapshot`);
const { dayKey, addDays, mondayOf, weekdayOf } = await import(`${SRC}/engine/schedule`);
const { planById } = await import(`${SRC}/data/plans`);
const { BUILTIN, EX, ALL } = await import(`${SRC}/data/exercises`);
const { blocksOf } = await import(`${SRC}/engine/blocks`);
const { setBodyWeight, validBody } = await import(`${SRC}/engine/body`);
const { addCardio, validCardio } = await import(`${SRC}/engine/cardio`);
const { addSnack, validSnack } = await import(`${SRC}/engine/snacks`);
const { validLogTime } = await import(`${SRC}/engine/clock`);
const { acwr, daysSince, epley } = await import(`${SRC}/engine/math`);
const { xpSummary, levelFor } = await import(`${SRC}/engine/xp`);
const { metrics } = await import(`${SRC}/engine/metrics`);
const { DietDb } = await import(`${SRC}/food/diet/db`);
const { restoreAll, exportAll } = await import(`${SRC}/food/diet/store`);
const { productFood, withGrams, recipeFood, customFood, setFood, partOf } = await import(`${SRC}/food/diet/foods`);
const { restaurantFood } = await import(`${SRC}/food/restaurants/food`);
const { CHAINS } = await import(`${SRC}/food/restaurants/catalog`);
const { indexProducts } = await import(`${SRC}/food/lib/search`);
const { recipeIndex, bestVariant, availableStores, needsStore } = await import(`${SRC}/food/recipes/resolve`);
const { RECIPES } = await import(`${SRC}/food/recipes/catalog`);

const OUT = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ knobs */
export const DEMO_DATE = '2026-10-15';
const TODAY: string = DEMO_DATE;
/** Local time "now" on TODAY — nothing is generated after it. */
const NOW_HM = '12:40';
/** Polish offset. CEST (+02:00) until 2026-10-25, CET (+01:00) after. */
const OFFSET = TODAY < '2026-10-25' ? '+02:00' : '+01:00';
const WEIGH_TODAY = false;
const PLAN_ID = 'cel-gora-dol-60'; // Góra i dół — 60 dni: Mon/Tue/Thu/Fri, deload week 6
/** Plan starts on the Monday ~6.5 weeks before TODAY; it was set up on the Thursday before. */
const START = mondayOf(addDays(TODAY, -45));
const SET_DAY = addDays(START, -4);
const DIET_START = addDays(START, 1);

/* -------------------------------------------------------------- helpers */
const at = (day: string, hm: string): number => Date.parse(`${day}T${hm}:00${OFFSET}`);
const iso = (ms: number) => new Date(ms).toISOString();
const setNow = (ms: number) => vi.setSystemTime(ms);
const isPast = (day: string, hm: string) => day < TODAY || (day === TODAY && hm <= NOW_HM);

// Deterministic PRNG (mulberry32), so the same TODAY gives the same file.
let seed = 20261015;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a: number, b: number) => a + (b - a) * rnd();
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 0.5;
const chance = (p: number) => rnd() < p;
const pad = (n: number) => String(n).padStart(2, '0');
const hm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

/* ------------------------------------------------------- athlete model */
/** True 1RM (kg) at plan start for the lifts in the gym plans; others fall back to the defaults. */
const TRUE_1RM: Record<string, number> = {
  bench: 84, row_bb: 78, ohp_db: 23, latpulldown: 72, lateral: 12.5, curl_db: 18, pushdown: 42,
  deadlift: 135, bulgarian: 30, hipthrust: 115, legext: 62, calf_seated: 62,
  squat_back: 102, rdl_bb: 98, legpress: 190, calf_press: 140, legcurl: 56,
  bench_close: 70, skullcrusher: 34, curl_bb: 38, curl_hammer: 19, curl_preacher: 30,
};
/** Max clean reps (or seconds) for bodyweight moves at plan start. */
const TRUE_MAX: Record<string, number> = { legraise_hang: 11, pushup: 28, squat_air: 45, plank: 90, dead_hang: 55, chinup: 9 };
const GAIN_PER_WEEK = 0.011; // novice-ish strength gain

function capacity(id: string, w: number | null, day: string, ready: string, setIndex: number): number {
  const weeks = Math.max(0, (Date.parse(day) - Date.parse(START)) / (7 * 86_400_000));
  const form = 1 + GAIN_PER_WEEK * weeks + gauss() * 0.02 + (ready === 'low' ? -0.05 : ready === 'high' ? 0.03 : 0);
  const fatigue = Math.round(setIndex * 0.6);
  const e = EX[id];
  if (w === null || w === undefined) {
    const base = TRUE_MAX[id] ?? e.def.max + 2;
    return Math.max(1, Math.floor(base * form) - fatigue * (e.unit === 'secs' ? 5 : 1));
  }
  const oneRm = (TRUE_1RM[id] ?? epley(e.def.w ?? 10, e.def.target + 2) * 1.25) * form;
  return Math.max(0, Math.floor(30 * (oneRm / w - 1)) - fatigue);
}

/** What the person actually does with today's prescription, and how hard it felt (zapas/RIR). */
function perform(state: any, id: string, day: string, ready: string): { rows: { reps: number; w: number | null }[]; effort: 'easy' | 'solid' | 'max' } {
  const rx = prescribe(state, id);
  let margin = 99;
  const rows = rx.map((r: any, i: number) => {
    const cap = capacity(id, r.w, day, ready, i);
    if (r.amrap) {
      const done = Math.max(1, Math.min(cap - 1, EX[id].unit === 'secs' ? 300 : 30));
      margin = Math.min(margin, 1);
      return { reps: done, w: r.w };
    }
    const done = Math.max(Math.min(r.reps, cap), Math.max(1, r.reps - 3));
    margin = Math.min(margin, cap - done);
    return { reps: done, w: r.w };
  });
  const effort = state.session?.deload ? 'easy' : margin >= 3 ? 'easy' : margin >= 1 ? 'solid' : 'max';
  return { rows, effort };
}

/** Realistic session clock: per block (straight / pair) start and end in seconds from „Zaczynam”. */
function logTime(workout: any, rowsById: Record<string, { reps: number }[]>) {
  const parts: any[] = [];
  let t = int(60, 150);
  for (const b of blocksOf(workout.items)) {
    const sets = Math.max(...b.ids.map((id: string) => rowsById[id]?.length ?? 0));
    if (!sets) continue;
    const perSet = b.kind === 'pair' ? 2 * (int(35, 50) + int(60, 80)) : int(35, 55) + int(100, 150);
    const start = t;
    const end = start + sets * perSet - int(60, 100);
    parts.push({ block: b.n, ex: [...b.ids], at: start, end });
    t = end + int(70, 210); // transition: change station, load plates
  }
  return { secs: t + int(60, 180), parts };
}

const badgeCtx = (s: any) => {
  const snap = snapshot(s);
  return achCtx(s, snap?.schedule ?? null, snap?.stats ?? null, snap?.today ?? dayKey(Date.now()));
};

/* ================================================================ GYM */
function buildGym() {
  vi.useFakeTimers({ toFake: ['Date'] });
  const state: any = freshState();
  const template = planById(PLAN_ID)!;
  const workouts = [...BUILTIN];
  state.cfg.height = 182;
  state.cfg.avatar = 'gustaw';
  state.cfg.view = 'guided';
  // Hides the „Postaw espresso” strip at the top for clean shots; remove the line to show it.
  state.supportSnooze = addDays(TODAY, 120);

  const SKIP = new Set([addDays(START, 22), addDays(START, 32)]); // wk4 Tue, wk5 Fri — made up next day
  const MAKEUP = new Set([addDays(START, 23), addDays(START, 33)]);
  const EXTRA: Record<string, string> = { [addDays(START, 12)]: 'arms-gym' }; // wk2 Saturday

  for (let day = SET_DAY; day <= TODAY; day = addDays(day, 1)) {
    const wd = weekdayOf(day);

    // 07:10 — weigh-in (most mornings)
    if (isPast(day, '07:10') && (day !== TODAY || WEIGH_TODAY) && chance(0.82)) {
      setNow(at(day, hm(7, int(2, 25))));
      const d = (Date.parse(day) - Date.parse(SET_DAY)) / 86_400_000;
      const kg = 88.4 - 0.064 * d + gauss() * 0.3 + (wd === 1 ? 0.35 : 0);
      setBodyWeight(state, Math.round(kg * 10) / 10, day);
    }

    // Plan set up on SET_DAY evening (intro seen the same day)
    if (day === SET_DAY) {
      setNow(at(day, '20:40'));
      state.introSeen = day;
      seedFromPlan(state, template.loadFactor);
      state.plan = { templateId: template.id, start: START, weekdays: [...template.weekdays], policy: 'shift', ticked: {} };
      state.events.push({
        id: `plan-start:${template.id}:${START}`,
        date: day,
        kind: 'plan-start',
        title: `Start planu: ${template.name}`,
        text: `Pierwsze terminy od ${START}. `,
      });
      syncBadges(state, badgeCtx(state));
    }

    // Movement snacks (~3/week), late morning or afternoon
    if (day > SET_DAY && chance(0.42)) {
      const h = chance(0.5) ? 11 : 15;
      if (isPast(day, hm(h, 59))) {
        setNow(at(day, hm(h, int(5, 55))));
        const pick = [
          ['pushup', int(15, 25)],
          ['squat_air', int(20, 30)],
          ['plank', int(45, 80)],
          ['dead_hang', int(25, 45)],
        ][int(0, 3)] as [string, number];
        addSnack(state, pick[0], pick[1], null, Date.now());
        if (chance(0.3)) addSnack(state, 'pushup', int(12, 20), null, Date.now() + 1000 * 60 * int(20, 90));
      }
    }

    // Training
    let workoutId: string | null = null;
    let startHm = hm(18, int(0, 40));
    if (day >= START && day < TODAY) {
      setNow(at(day, '17:00'));
      const due = snapshot(state)?.stats.due;
      const extra = EXTRA[day];
      if (extra) {
        workoutId = extra;
        startHm = '10:30';
      } else if (due && due.date === day && !SKIP.has(day)) workoutId = due.workout;
      else if (due && due.date < day && MAKEUP.has(day)) {
        workoutId = due.workout;
        if (wd >= 6) startHm = '10:15';
      }
    }
    if (workoutId) {
      const w = workouts.find((x) => x.id === workoutId)!;
      const begin = at(day, startHm);
      setNow(begin);
      const due = snapshot(state)?.stats.due;
      const deload = !!due?.deload && due.workout === w.id;
      const ready = chance(0.12) ? 'low' : chance(0.18) ? 'high' : 'ok';
      const d = daysSince(state);
      const ratio = acwr(state);
      const blockJump = (d !== null && d >= 11 && d < 21) || (ratio !== null && ratio > 1.5) || ready === 'low';
      state.session = { workout: w.id, started: iso(begin), ready, res: {}, done: {}, skip: {}, ...(deload ? { deload: true } : {}) };
      const items: any[] = [];
      const rowsById: Record<string, any[]> = {};
      for (const it of w.items) {
        const r = perform(state, it.ex, day, ready);
        rowsById[it.ex] = r.rows;
        items.push({ id: it.ex, sets: r.rows, effort: r.effort });
      }
      const time = logTime(w, rowsById);
      const end = begin + time.secs * 1000;
      setNow(end);
      if (!deload) for (const it of items) applyResult(state, it.id, it.sets, it.effort, blockJump, day);
      expect(validLogTime(time)).toBe(true);
      state.log.push({
        date: iso(end),
        workout: w.name,
        wid: w.id,
        ...(deload ? { deload: true } : {}),
        ready,
        items,
        time,
      });
      state.session = null;
      state.notice = null;
      syncBadges(state, badgeCtx(state));
    }

    // Cardio: treadmill after Friday sessions, bike on some Sundays
    if (workoutId && wd === 5 && chance(0.7)) {
      setNow(Date.now() + 10 * 60_000);
      addCardio(state, { kind: 'treadmill', kmh: 6.2, min: int(15, 25), grade: 6 }, day, Date.now());
    }
    if (wd === 7 && day > START && day < TODAY && chance(0.6)) {
      setNow(at(day, '11:20'));
      addCardio(state, { kind: 'bike', kmh: Math.round(between(17, 22) * 10) / 10, min: int(40, 75) }, day, Date.now());
    }

    // 21:45 — steps of the day from the phone
    if (day > SET_DAY && day < TODAY) {
      setNow(at(day, hm(21, int(30, 59))));
      const base = wd >= 6 ? between(5000, 14000) : workoutId ? between(6500, 9500) : between(7500, 12000);
      addCardio(state, { kind: 'steps', steps: Math.round(base / 10) * 10 }, day, Date.now());
    }

    // End of day: badges earned by the passage of time land on the right day
    const eod = day === TODAY ? at(day, NOW_HM) : at(day, '23:30');
    setNow(eod);
    syncBadges(state, badgeCtx(state));
  }
  vi.useRealTimers();
  return state;
}

/* =============================================================== DIET */
function loadProducts() {
  const ds = JSON.parse(gunzipSync(readFileSync(resolve(SRC, '../data/food/products.json.gz'))).toString());
  return { ds, products: indexProducts(ds.products, ds.dictionaries.brands) };
}

function buildDiet(gym: any) {
  const { ds, products } = loadProducts();
  const dict = ds.dictionaries;
  const byCode = (code: string) => products.find((p: any) => p.code === code)!;
  const product = (code: string, grams?: number) => {
    const f = productFood(byCode(code), dict)!;
    return grams ? withGrams(f, grams) : f;
  };
  const { candidates } = recipeIndex(products);
  const ranking = ['lidl', 'biedronka'];
  const recipe = (id: string) => {
    const r = RECIPES.find((x: any) => x.id === id)!;
    const v = bestVariant(r, candidates, ranking);
    if (!v) throw new Error(`recipe ${id} has no variant at ${ranking}`);
    return recipeFood(r, v.perServing, availableStores(r, candidates, ranking), !needsStore(r));
  };
  const resto = (chain: string, item: string) => {
    const c = CHAINS.find((x: any) => x.id === chain)!;
    const i = c.items.find((x: any) => x.id === item);
    if (!i) throw new Error(`${chain}: no ${item}; have ${c.items.map((x: any) => x.id).join(', ')}`);
    return restaurantFood(c, i);
  };

  // Own foods (table `foods`) and own sets (table `sets`)
  const foods = [
    { id: 1, name: 'Obiad: kurczak, ryż i warzywa', amountLabel: '1 pudełko (450 g)', kcal: 640, protein: 52, carbs: 74, fat: 13 },
    { id: 2, name: 'Shake białkowy na mleku', amountLabel: '1 shaker (30 g + 300 ml)', kcal: 265, protein: 34, carbs: 16, fat: 6.5 },
    { id: 3, name: 'Makaron z indykiem w pomidorach', amountLabel: '1 porcja', kcal: 690, protein: 48, carbs: 88, fat: 14 },
    { id: 4, name: 'Banan', amountLabel: '1 szt. (120 g)', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
    { id: 5, name: 'Orzechy włoskie', amountLabel: 'garść (30 g)', kcal: 196, protein: 4.6, carbs: 4.1, fat: 19.6 },
  ];
  const oats = product('4056489180968', 80);
  const skyr = product('20692230'); // 150 g pack
  const pb = product('5900617012197', 20);
  const twarog = product('5900531004018', 125);
  const bread = product('20859688', 120);
  const ham = product('5900567015613', 60);
  const sets = [
    { id: 1, name: 'Owsianka ze skyrem', parts: [partOf(oats), partOf(skyr), partOf(pb)] },
    { id: 2, name: 'Kolacja: twaróg, chleb, szynka', parts: [partOf(twarog), partOf(bread), partOf(ham)] },
    { id: 3, name: 'Kanapki z szynką', parts: [partOf(product('20859688', 100)), partOf(product('5900567015613', 80))] },
  ];
  const F = {
    owsianka: setFood(sets[0]),
    kolacja: setFood(sets[1]),
    kanapki: setFood(sets[2]),
    obiad: customFood(foods[0] as any),
    shake: customFood(foods[1] as any),
    makaron: customFood(foods[2] as any),
    banan: customFood(foods[3] as any),
    orzechy: customFood(foods[4] as any),
    skyr,
    baton: product('5900617013064'), // Go On 50 g
    serek: product('5900531007019'), // serek wiejski wysokobiałkowy 200 g
    kefir: product('5902057001748', 250),
    wraps: product('4056489018636', 124),
    nocnaOwsianka: recipe('owsianka-nocna'),
    kurczakPatelnia: recipe('kurczak-papryka'),
    omlet: recipe('omlet-twarozek'),
    burrito: recipe('burrito-bowl'),
    subway: resto('subway', 'kurczak-w-stylu-rotisserie-15-cm'),
    cezar: resto('salad-story', 'salatka-cezar-powiekszona-bez-dressingu'),
    latte: resto('zabka-cafe', 'latte-macchiato-400-ml'),
    bigmac: resto('mcdonalds', 'big-mac'),
  };

  const entries: any[] = [];
  const add = (date: string, time: string, food: any) => {
    if (!isPast(date, time)) return;
    entries.push({
      date, time, name: food.name, amountLabel: food.amountLabel,
      kcal: food.nutrients.kcal, protein: food.nutrients.protein, carbs: food.nutrients.carbs, fat: food.nutrients.fat,
      source: food.source, key: food.key,
    });
  };
  const quick = (date: string, time: string, name: string, kcal: number) => {
    if (isPast(date, time)) entries.push({ date, time, name, amountLabel: '', kcal, protein: null, carbs: null, fat: null, source: 'quick' });
  };

  const trained = new Set(gym.log.map((e: any) => dayKey(e.date)));
  for (let day = DIET_START; day <= TODAY; day = addDays(day, 1)) {
    const wd = weekdayOf(day);
    if (day < TODAY && chance(0.07)) continue; // a day nobody logged — the forecast assumes the goal
    const m = () => pad(int(0, 25));
    // Breakfast
    add(day, `07:${m()}`, chance(0.65) ? F.owsianka : chance(0.5) ? F.nocnaOwsianka : F.omlet);
    if (wd <= 5 && chance(0.5)) add(day, `08:${pad(int(30, 55))}`, F.latte);
    // Second breakfast
    if (chance(0.7)) add(day, `10:${pad(int(15, 50))}`, chance(0.55) ? F.kanapki : F.serek);
    // Lunch
    const lunch =
      wd >= 6
        ? [F.makaron, F.kurczakPatelnia, F.burrito][int(0, 2)]
        : chance(0.5) ? F.obiad : chance(0.5) ? F.subway : F.cezar;
    add(day, `13:${m()}`, lunch);
    // Afternoon
    add(day, `16:${m()}`, chance(0.5) ? F.baton : F.skyr);
    if (chance(0.6)) add(day, `16:${pad(int(30, 55))}`, F.banan);
    if (trained.has(day)) add(day, `19:${pad(int(30, 55))}`, F.shake);
    // Dinner
    add(day, `20:${pad(int(10, 50))}`, chance(0.55) ? F.kolacja : chance(0.5) ? F.wraps : F.kurczakPatelnia);
    if (chance(0.35)) add(day, `21:${m()}`, chance(0.5) ? F.kefir : F.orzechy);
    // Weekend treat
    if (wd === 6 && chance(0.6)) quick(day, '19:45', 'Pizza ze znajomymi (pół dużej)', int(900, 1150));
    if (wd === 7 && chance(0.35)) add(day, '14:10', F.bigmac);
  }

  // Favorites: snapshots + use counts consistent with the entries logged since they were starred
  const star = (food: any, addedAt: string) => {
    const { favorite: _f, ...snap } = food;
    const since = entries.filter((e) => e.key === food.key && `${e.date}T${e.time}` >= addedAt.slice(0, 16));
    const last = since.at(-1);
    return {
      key: food.key, food: snap, addedAt: new Date(Date.parse(`${addedAt}:00${OFFSET}`)).toISOString(),
      uses: since.length,
      lastUsed: last ? new Date(Date.parse(`${last.date}T${last.time}:00${OFFSET}`)).toISOString() : null,
    };
  };
  const favDay = addDays(DIET_START, 3);
  const favorites = [
    star(F.owsianka, `${favDay}T07:05`),
    star(F.shake, `${favDay}T19:40`),
    star(F.baton, `${addDays(favDay, 2)}T16:10`),
    star(F.subway, `${addDays(favDay, 6)}T13:20`),
    star(F.skyr, `${addDays(favDay, 9)}T16:05`),
  ];

  const first = gym.body.find((b: any) => b.day >= DIET_START) ?? gym.body[0];
  const profile = {
    sex: 'M', age: 34, heightCm: 182,
    startWeightKg: first.kg, targetWeightKg: 82, startDate: DIET_START,
    activityMultiplier: 1.4, baseSteps: 4000, targetSteps: 9000, kcalPer1000StepsPerKg: 0.4,
    extraWeeklyKcal: 0, kcalPerKg: 7500, dailyKcal: 2300, dietProfile: 'sportowa', adaptWeekly: true,
    preferredStore: 'lidl',
  };

  entries.forEach((e, i) => (e.id = i + 1));
  return {
    app: 'produkty-pl', version: 1, exportedAt: new Date(at(TODAY, NOW_HM)).toISOString(),
    profile,
    days: [], // weights/steps live in the gym state (body/cardio); diet DayRow weights would be migrated anyway
    entries, plans: [], foods, sets, favorites,
  };
}

/* ============================================================== FRESH */
/** Someone who installed the app yesterday: entered height and weight, nothing trained yet. */
function buildFresh() {
  vi.useFakeTimers({ toFake: ['Date'] });
  setNow(at(addDays(TODAY, -1), '21:10'));
  const state: any = freshState();
  state.cfg.height = 168;
  state.cfg.avatar = 'gosia';
  state.cfg.view = 'guided';
  state.supportSnooze = addDays(TODAY, 120);
  setBodyWeight(state, 71.4, addDays(TODAY, -1));
  vi.useRealTimers();
  validateGymLikeImport(state);
  expect(state.log).toEqual([]);
  return state;
}

/* ========================================================= validation */
function validateGymLikeImport(s: any) {
  // App.importData: throws unless prog and cfg exist
  expect(s.prog && s.cfg).toBeTruthy();
  expect(Object.keys(s.prog).sort()).toEqual([...ALL].sort());
  // restoreExtras: rows that would be dropped
  expect(s.snacks.filter((x: any) => !validSnack(x))).toEqual([]);
  expect(s.cardio.filter((x: any) => !validCardio(x))).toEqual([]);
  expect(s.body.filter((x: any) => !validBody(x))).toEqual([]);
  expect(new Set(s.body.map((b: any) => b.day)).size).toBe(s.body.length);
  expect([...s.body].sort((a: any, b: any) => a.day.localeCompare(b.day))).toEqual(s.body);
  expect(s.log.filter((e: any) => e.time !== undefined && !validLogTime(e.time))).toEqual([]);
  expect(s.session).toBeNull();
  expect(migrateBadges(s.award.badges)).toEqual(s.award.badges);
  expect(s.cfg.height).toBeGreaterThanOrEqual(120);
}

it('generates and validates the seed', async () => {
  const gym = buildGym();
  const diet = buildDiet(gym);
  validateGymLikeImport(gym);

  // Boot simulation at "now": no layoff notice, no fresh badges stamped with today's date
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(TODAY, NOW_HM));
  const boot = JSON.parse(JSON.stringify(gym));
  expect(applyLayoff(boot, daysSince(boot))).toBeNull();
  const fresh = syncBadges(boot, badgeCtx(boot));
  const snap = snapshot(boot)!;
  const lvl = levelFor(xpSummary(boot).total);
  const m = metrics(boot);
  vi.useRealTimers();

  // Diet half through the real restore (fake-indexeddb from src/test/setup.ts)
  const db = new DietDb(`seed-check-${Date.now()}`);
  const { dropped } = await restoreAll(diet, db);
  expect(dropped).toBe(0);
  const back = await exportAll(db);
  expect(back.entries.length).toBe(diet.entries.length);
  expect(back.favorites!.length).toBe(diet.favorites.length);
  expect(back.sets!.length).toBe(3);
  expect(back.profile).toMatchObject({ startDate: DIET_START, dietProfile: 'sportowa', dailyKcal: 2300 });

  writeFileSync(join(OUT, 'full.json'), `${JSON.stringify({ ...gym, diet })}\n`);
  writeFileSync(join(OUT, 'fresh.json'), `${JSON.stringify(buildFresh())}\n`);

  console.log(
    JSON.stringify(
      {
        today: TODAY, now: NOW_HM, planStart: START, setDay: SET_DAY, dietStart: DIET_START,
        sessions: gym.log.length, deloadSessions: gym.log.filter((e: any) => e.deload).length,
        snacks: gym.snacks.length, cardio: gym.cardio.length, weighIns: gym.body.length,
        firstWeight: gym.body[0], lastWeight: gym.body.at(-1),
        badges: Object.keys(gym.award.badges).length, freshAtBoot: fresh.length,
        level: { level: lvl.level, title: lvl.title, xp: lvl.xp },
        plan: { week: snap.stats.week, done: snap.stats.done, late: snap.stats.late, missed: snap.stats.missed, extra: snap.stats.extra, adherence: snap.stats.adherence, streak: snap.stats.streak, due: snap.stats.due && { date: snap.stats.due.date, workout: snap.stats.due.workout } },
        points: snap.points, rank: snap.rank.rank.name,
        metrics: { workouts: m.workouts, reps: m.reps, tonnage: Math.round(m.tonnage) },
        levels: Object.fromEntries(['bench', 'row_bb', 'deadlift', 'squat_back', 'ohp_db', 'latpulldown'].map((id) => [id, `${P(gym, id).phase} ${P(gym, id).sets}x${P(gym, id).target} @ ${P(gym, id).weight}`])),
        diet: { avgKcalLoggedDays: Math.round(diet.entries.reduce((n: number, e: any) => n + e.kcal, 0) / new Set(diet.entries.filter((e: any) => e.date < TODAY).map((e: any) => e.date)).size), entries: diet.entries.length, favorites: diet.favorites.map((f: any) => `${f.key} uses=${f.uses}`), foods: diet.foods.length, sets: diet.sets.length },
      },
      null,
      2,
    ),
  );
});
