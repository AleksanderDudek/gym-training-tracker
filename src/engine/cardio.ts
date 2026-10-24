import { LOCALE, text } from '../i18n';
import type { AppState, Cardio, CardioInput, CardioSport } from '../types';
import { heightOf, weightOn } from './body';
import { DANCE_MET, DANCE_SHARE, STEP_CADENCE, cardioEnergy, stepsEnergy } from './energy';
import type { Burn, FootPart, StepsDay } from './energy';
import { daysBetween, mondayOf } from './schedule';
import { phoneEntries } from './phone';
import { localDayOf, watchEntries, watchStepsOn } from './watch';

/**
 * Kroki, bieżnia, rower i taniec wpisane ręcznie.
 *
 * Przeglądarka nie ma dostępu do krokomierza telefonu — liczy go system, a strona nie dostaje
 * z niego ani kroku. Zamiast udawać pomiar, aplikacja przyjmuje liczby z urządzenia, które
 * mierzy naprawdę: kroki z telefonu albo zegarka, prędkość i czas z bieżni, prędkość albo moc
 * z roweru, a przy zajęciach tańca — czas i to, ile z niego było tańcem. Z nich i z wagi
 * liczą się kalorie.
 *
 * Wpisy mieszkają osobno od dziennika treningów, tak jak przekąski: dziennik karmi progresję
 * i kalendarz planu, a spacer nie może podnieść celu przysiadów ani domknąć terminu.
 */

/**
 * Zakresy wpisu. Poza nimi to niemal na pewno literówka: sto tysięcy kroków to maraton
 * z zapasem, 25 km/h to sufit bieżni, 700 W to sprinter na torze, a dwanaście godzin to
 * więcej niż cały dzień jazdy.
 */
export const CARDIO_LIMITS = {
  steps: { min: 1, max: 100_000 },
  treadmillKmh: { min: 1, max: 25 },
  grade: { min: 0, max: 25 },
  bikeKmh: { min: 3, max: 70 },
  watts: { min: 10, max: 700 },
  min: { min: 1, max: 720 },
} as const;

type Range = { readonly min: number; readonly max: number };

const within = (v: unknown, r: Range): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Klucz z listy, a nie z prototypu — `constructor` z importowanego pliku to nie rodzaj tańca. */
const oneOf = (v: unknown, table: object): boolean => typeof v === 'string' && Object.hasOwn(table, v);


/** Rower stacjonarny z mocą to wciąż rower — w nawigacji i na liście stoją razem. */
export const sportOf = (c: Pick<CardioInput, 'kind'>): CardioSport => (c.kind === 'ergo' ? 'bike' : c.kind);

const pl = (n: number): string => n.toLocaleString(LOCALE);

const T = text({
  pl: {
    minutes: (min: number, max: number) => `Czas od ${min} do ${max} minut.`,
    steps: (min: number, max: string) => `Kroki od ${min} do ${max}.`,
    treadmillKmh: (min: number, max: number) => `Prędkość bieżni od ${min} do ${max} km/h.`,
    grade: (min: number, max: number) => `Nachylenie od ${min} do ${max}%.`,
    bikeKmh: (min: number, max: number) => `Prędkość roweru od ${min} do ${max} km/h.`,
    watts: (min: number, max: number) => `Moc od ${min} do ${max} W.`,
    danceStyle: 'Wybierz taniec: w parze albo solo.',
    danceMix: 'Wybierz, ile było tańca, a ile tłumaczenia.',
    unknownKind: 'Nieznany rodzaj ruchu.',
    badDay: (day: string) => `Zły dzień: ${day}`,
  },
  en: {
    minutes: (min: number, max: number) => `Time from ${min} to ${max} minutes.`,
    steps: (min: number, max: string) => `Steps from ${min} to ${max}.`,
    treadmillKmh: (min: number, max: number) => `Treadmill speed from ${min} to ${max} km/h.`,
    grade: (min: number, max: number) => `Incline from ${min} to ${max}%.`,
    bikeKmh: (min: number, max: number) => `Bike speed from ${min} to ${max} km/h.`,
    watts: (min: number, max: number) => `Power from ${min} to ${max} W.`,
    danceStyle: 'Pick a dance: partner or solo.',
    danceMix: 'Pick how much was dancing and how much was instruction.',
    unknownKind: 'Unknown kind of movement.',
    badDay: (day: string) => `Invalid day: ${day}`,
  },
});

/**
 * Co jest nie tak z wpisem — zdaniem, do pokazania pod formularzem. `null` znaczy, że wpis
 * nadaje się do zapisu.
 */
export function inputProblem(c: CardioInput): string | null {
  const L = CARDIO_LIMITS;
  const minutes = (): string | null =>
    within((c as { min?: unknown }).min, L.min) ? null : T.minutes(L.min.min, L.min.max);
  switch (c.kind) {
    case 'steps':
      return within(c.steps, L.steps) ? null : T.steps(L.steps.min, pl(L.steps.max));
    case 'treadmill':
      if (!within(c.kmh, L.treadmillKmh))
        return T.treadmillKmh(L.treadmillKmh.min, L.treadmillKmh.max);
      if (!within(c.grade, L.grade)) return T.grade(L.grade.min, L.grade.max);
      return minutes();
    case 'bike':
      if (!within(c.kmh, L.bikeKmh)) return T.bikeKmh(L.bikeKmh.min, L.bikeKmh.max);
      return minutes();
    case 'ergo':
      if (!within(c.watts, L.watts)) return T.watts(L.watts.min, L.watts.max);
      return minutes();
    case 'dance':
      if (!oneOf(c.style, DANCE_MET)) return T.danceStyle;
      if (!oneOf(c.mix, DANCE_SHARE)) return T.danceMix;
      return minutes();
    default:
      return T.unknownKind;
  }
}

/**
 * Wpis sprowadzony do liczb, które da się przepisać z wyświetlacza: kroki i waty w całości,
 * prędkość i nachylenie z jedną cyfrą po przecinku, minuty w całości.
 */
export function normalize(c: CardioInput): CardioInput {
  const r1 = (v: number): number => Math.round(v * 10) / 10;
  switch (c.kind) {
    case 'steps':
      return { kind: 'steps', steps: Math.round(c.steps) };
    case 'treadmill':
      return { kind: 'treadmill', kmh: r1(c.kmh), min: Math.round(c.min), grade: r1(c.grade) };
    case 'bike':
      return { kind: 'bike', kmh: r1(c.kmh), min: Math.round(c.min) };
    case 'ergo':
      return { kind: 'ergo', watts: Math.round(c.watts), min: Math.round(c.min) };
    case 'dance':
      return { kind: 'dance', style: c.style, mix: c.mix, min: Math.round(c.min) };
  }
}

/** Wpisy wpisane ręcznie — tylko te da się usunąć. Zapisy starsze niż lista wczytują się jako pusta. */
export const manualOf = (state: AppState): Cardio[] => state.cardio ?? [];

/** Przejazd z telefonu w tych minutach co przejazd z zegarka to ten sam przejazd, skopiowany przez Garmin Connect. */
export const SAME_RIDE_SEC = 600;

/**
 * Cały ruch, z którego liczą się kalorie, minuty ruchu, doświadczenie i odznaki: wpisy ręczne
 * i to, co podały zegarek i telefon. Kroki mają jeden wpis na dzień, więc z trzech liczb —
 * wpisanej, z zegarka i z telefonu — zostaje najwyższa: mierzą to samo chodzenie, a telefon
 * często ma już w sobie kroki zegarka. Niższe nie przepadają: czekają w zapisie i wracają,
 * gdyby wyższa zniknęła. Przy remisie zostaje wpis ręczny, bo ten da się usunąć, potem zegarek.
 * Przejazd z telefonu ustępuje przejazdowi z zegarka, który zaczął się w tych samych minutach.
 */
export function cardioOf(state: AppState): Cardio[] {
  const manual = manualOf(state);
  const watch = watchEntries(state.watch).filter((c) => inputProblem(c) === null);
  const watchRides = watch.filter((c) => c.kind === 'bike').map((c) => Date.parse(c.at));
  const phone = phoneEntries(state.phone).filter(
    (c) =>
      inputProblem(c) === null &&
      (c.kind !== 'bike' || !watchRides.some((at) => Math.abs(at - Date.parse(c.at)) <= SAME_RIDE_SEC * 1000)),
  );
  const device = [...watch, ...phone];
  if (!device.length) return manual;
  // Najwyższa liczba z urządzeń na dzień; przy remisie zostaje pierwsza — zegarek przed telefonem.
  const best = new Map<string, Extract<Cardio, { kind: 'steps' }>>();
  device.forEach((c) => {
    if (c.kind !== 'steps') return;
    const b = best.get(c.day);
    if (!b || c.steps > b.steps) best.set(c.day, c);
  });
  const typedWins = new Set<string>();
  const out = manual.filter((c) => {
    if (c.kind !== 'steps') return true;
    const d = best.get(c.day);
    if (d && d.steps > c.steps) return false;
    typedWins.add(c.day);
    return true;
  });
  device.forEach((c) => {
    if (c.kind !== 'steps' || (best.get(c.day) === c && !typedWins.has(c.day))) out.push(c);
  });
  return out;
}

/**
 * Kroki z urządzeń na dzień: wyższa liczba z zegarka i telefonu i to, skąd przyszła — do
 * formularza kroków i komunikatu po zapisie. `null`, gdy żadne urządzenie o tym dniu nic nie mówi.
 */
export function deviceStepsOn(state: AppState, day: string): { steps: number; src: 'watch' | 'phone' } | null {
  const w = watchStepsOn(state, day) ?? 0;
  const p = state.phone?.days.find((d) => d.day === day)?.steps ?? 0;
  if (!w && !p) return null;
  return p > w ? { steps: p, src: 'phone' } : { steps: w, src: 'watch' };
}

/* ---------------- Kroki dnia: droga, odcinki, piętra ---------------- */

/** Sporty pieszo w numeracji FIT (`Activity.Sport`): 1 bieg, 11 marsz, 17 wędrówka. */
export const ON_FOOT: ReadonlySet<number> = new Set([1, 11, 17]);

/**
 * Bieżnia wpisana ręcznie i aktywność z zegarka to ta sama sesja, gdy trwały prawie tyle samo:
 * różnica do 15% albo do 5 minut. Wpis ręczny nie ma godziny startu (`at` to chwila zapisu),
 * więc porównać da się tylko dzień i czas trwania.
 */
const sameSession = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(300, 0.15 * b);

type Steps = Extract<Cardio, { kind: 'steps' }>;

/** Bieżnia wpisana ręcznie w danym dniu jako odcinek z drogą i czasem. */
const treadmillParts = (state: AppState, day: string): FootPart[] =>
  manualOf(state)
    .filter((c): c is Extract<Cardio, { kind: 'treadmill' }> => c.kind === 'treadmill' && c.day === day)
    .map((c) => ({ m: (c.kmh * c.min * 1000) / 60, sec: c.min * 60 }));

/**
 * Biegi, marsze i wędrówki z zegarka w danym dniu, z drogą — bez tych, które są tą samą sesją co
 * bieżnia wpisana ręcznie (ta ma nachylenie i liczy się swoim wpisem).
 */
export function footPartsOn(state: AppState, day: string): FootPart[] {
  const treadmill = treadmillParts(state, day);
  return (state.watch?.acts ?? [])
    .filter((a) => ON_FOOT.has(a.sport) && a.m !== null && a.m > 0 && localDayOf(new Date(a.start * 1000)) === day)
    .map((a) => ({ m: a.m!, sec: a.sec }))
    .filter((p) => !treadmill.some((t) => sameSession(p.sec, t.sec)));
}

/**
 * Dzień kroków ze wszystkim, co wie o nim urządzenie, które je podało: droga i piętra z zegarka
 * albo telefonu, biegi i marsze z zegarka. Bieżnia wpisana ręcznie schodzi z kroków tylko
 * wtedy, gdy kroki policzyło urządzenie — samo, bez pytania. Kroki wpisane ręcznie zostają
 * przy zasadzie z formularza: wpisuje się jedno albo drugie.
 */
export function stepsDayOf(state: AppState, c: Steps): StepsDay {
  const dev =
    c.src === 'watch'
      ? state.watch?.days.find((d) => d.day === c.day)
      : c.src === 'phone'
        ? state.phone?.days.find((d) => d.day === c.day)
        : undefined;
  return {
    steps: c.steps,
    m: dev?.m ?? null,
    floors: dev?.floors ?? null,
    parts: footPartsOn(state, c.day),
    elsewhere: c.src ? treadmillParts(state, c.day) : [],
  };
}

/**
 * Kalorie i droga wpisu przy danej wadze. Kroki liczą się z tym, co wie urządzenie (`stepsDayOf`);
 * reszta — z samego wpisu.
 */
export const entryEnergy = (state: AppState, c: Cardio, kg: number): Burn =>
  c.kind === 'steps' ? stepsEnergy(stepsDayOf(state, c), kg, heightOf(state)) : cardioEnergy(c, kg, heightOf(state));

/**
 * Wyjścia na cardio w danym dniu: bieżnia, rower i zajęcia tańca od dziesięciu minut oraz biegi,
 * marsze i wędrówki z zegarka tej samej długości (te nie są osobnymi wpisami — siedzą w krokach).
 */
export function outingsOn(state: AppState, day: string): number {
  const entries = cardioOn(state, day).filter((c) => c.kind !== 'steps' && c.min >= SESSION_MIN).length;
  return entries + footPartsOn(state, day).filter((p) => p.sec >= SESSION_MIN * 60).length;
}

/** Minuty ruchu w jednym dniu, w przeliczeniu na umiarkowany (`activeMinutes`). */
export const minutesOn = (state: AppState, day: string): number =>
  cardioOn(state, day).reduce((s, c) => s + activeMinutes(state, c), 0);

/** Czy zapisany wpis da się bezpiecznie wczytać — po imporcie pliku albo ze starego zapisu. */
export const validCardio = (c: unknown): c is Cardio => {
  if (!c || typeof c !== 'object') return false;
  const x = c as Partial<Cardio>;
  return (
    typeof x.key === 'string' &&
    typeof x.day === 'string' &&
    DAY.test(x.day) &&
    typeof x.at === 'string' &&
    !Number.isNaN(Date.parse(x.at)) &&
    typeof x.kind === 'string' &&
    inputProblem(x as CardioInput) === null
  );
};

/**
 * Dopisuje ruch i go zwraca. Kroki to suma dnia z telefonu, więc drugi wpis kroków na ten
 * sam dzień **zastępuje** pierwszy — wieczorem wpisuje się stan licznika, a nie przyrost od
 * południa. Bieżnia, rower i zajęcia tańca to osobne wyjścia, więc się sumują.
 */
export function addCardio(
  state: AppState,
  input: CardioInput,
  day: string,
  now: number = Date.now(),
): { entry: Cardio; replaced: Cardio | null } {
  if (!DAY.test(day)) throw new Error(T.badDay(day));
  const clean = normalize(input);
  const problem = inputProblem(clean);
  if (problem) throw new Error(problem);
  state.cardio ??= [];
  const replaced =
    clean.kind === 'steps' ? (state.cardio.find((c) => c.kind === 'steps' && c.day === day) ?? null) : null;
  if (replaced) state.cardio = state.cardio.filter((c) => c !== replaced);
  const same = state.cardio.filter((c) => c.key.startsWith(`${now}-`)).length;
  const entry: Cardio = { ...clean, key: `${now}-${same}`, day, at: new Date(now).toISOString() };
  state.cardio.push(entry);
  return { entry, replaced };
}

export function removeCardio(state: AppState, key: string): boolean {
  const list = manualOf(state);
  const i = list.findIndex((c) => c.key === key);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

/** Wpisy z jednego dnia w kolejności zapisu. */
export const cardioOn = (state: AppState, day: string): Cardio[] =>
  cardioOf(state)
    .filter((c) => c.day === day)
    .sort((a, b) => a.at.localeCompare(b.at));

/** Kroki z dnia. Jeden wpis na dzień, więc to jego liczba albo zero. */
export const stepsOn = (state: AppState, day: string): number =>
  cardioOn(state, day).reduce((s, c) => s + (c.kind === 'steps' ? c.steps : 0), 0);

/** Kroki wpisane ręcznie na dzień — zero, gdy wpisu nie ma. Zegarek tu się nie liczy. */
export const typedStepsOn = (state: AppState, day: string): number =>
  manualOf(state).find((c): c is Extract<Cardio, { kind: 'steps' }> => c.kind === 'steps' && c.day === day)?.steps ?? 0;

/**
 * Ostatni wpis danego rodzaju — do podpowiedzi w pustym polu. Tylko podpowiedź: pole zostaje
 * puste, jak przy przekąskach, żeby wpisać to, co było dziś, a nie zatwierdzić wczorajsze.
 */
export function lastOf<K extends CardioInput['kind']>(
  state: AppState,
  kind: K,
): Extract<Cardio, { kind: K }> | null {
  const list = cardioOf(state)
    .filter((c): c is Extract<Cardio, { kind: K }> => c.kind === kind)
    .sort((a, b) => b.at.localeCompare(a.at));
  return list[0] ?? null;
}

/* ---------------- Minuty ruchu, statystyki pod odznaki i doświadczenie ---------------- */

/**
 * Progi intensywności z zaleceń WHO i ACSM: ruch umiarkowany to od 3 MET, intensywny od 6.
 * Minuta intensywna liczy się podwójnie — tak WHO przelicza 75 minut biegu na 150 marszu.
 */
export const MODERATE_MET = 3;
export const VIGOROUS_MET = 6;

/**
 * Kroki, które robi się bez wychodzenia z domu. Poniżej 5 000 dziennie badania Tudor-Locke
 * mówią o trybie siedzącym, więc minuty ruchu liczą się dopiero z nadwyżki — spacer, a nie
 * kroki po mieszkaniu. Przy 100 krokach na minutę to marsz umiarkowany.
 */
export const BASE_STEPS = 5_000;

/**
 * Cel dzienny kroków. Metaanaliza Palucha i in. (Lancet Public Health, 2022) pokazuje, że
 * korzyść dla zdrowia rośnie mniej więcej do 6–8 tysięcy kroków u starszych i 8–10 tysięcy
 * u młodszych, a dalej się wypłaszcza. Osiem tysięcy to środek tego przedziału — okrągłe
 * dziesięć tysięcy wzięło się z reklamy krokomierza z lat 60., a nie z badań.
 */
export const STEP_GOAL = 8_000;

/** Tydzień według WHO: co najmniej 150 minut ruchu umiarkowanego albo odpowiednik. */
export const WHO_WEEK_MIN = 150;

/** Dzień aktywny: tyle minut, ile wychodzi ze 150 rozłożonych na tydzień. */
export const ACTIVE_DAY_MIN = 20;

/** Bieżnia, rower albo zajęcia tańca od tylu minut liczą się jako wyjście — krótsze to rozgrzewka. */
export const SESSION_MIN = 10;

/**
 * Waga do samej intensywności roweru z mocą, gdy ważenia jeszcze nie ma. Tylko do progu
 * umiarkowany/intensywny — kalorii z niej nie pokazujemy.
 */
const INTENSITY_KG = 75;

/** Mnożnik minuty: intensywna razy dwa, umiarkowana raz, lżejsza niż 3 MET zero. */
const intensity = (met: number): number => (met >= VIGOROUS_MET ? 2 : met >= MODERATE_MET ? 1 : 0);

/**
 * Minuty ruchu w przeliczeniu na umiarkowany: intensywny razy dwa, lżejszy niż 3 MET zero.
 * Kroki — z nadwyżki ponad 5 000, przy 100 krokach na minutę.
 *
 * Z zajęć tańca liczy się sam taniec, z intensywnością tańca, a nie średniej zajęć. Godzina
 * pół na pół to pół godziny salsy i pół godziny stania — średnia wyszłaby tuż nad progiem
 * i dała całą godzinę ruchu, a po dorzuceniu tłumaczenia ani minuty. WHO od 2020 roku liczy
 * każdy ruch, bez minimalnej długości odcinka, więc kawałki tańca między objaśnieniami
 * wchodzą w całości.
 */
export function activeMinutes(state: AppState, c: Cardio): number {
  if (c.kind === 'steps') return Math.max(0, c.steps - BASE_STEPS) / STEP_CADENCE;
  if (c.kind === 'dance') return c.min * DANCE_SHARE[c.mix] * intensity(DANCE_MET[c.style]);
  return c.min * intensity(cardioEnergy(c, weightOn(state, c.day) ?? INTENSITY_KG, heightOf(state)).met);
}

/** Minuty ruchu na dzień `yyyy-mm-dd`. Dni bez wpisu nie ma w wyniku. */
export function minutesByDay(state: AppState): Record<string, number> {
  const out: Record<string, number> = {};
  cardioOf(state).forEach((c) => {
    out[c.day] = (out[c.day] ?? 0) + activeMinutes(state, c);
  });
  return out;
}

/** Minuty ruchu w tygodniu od poniedziałku do niedzieli, w którym leży dzień. */
export function weekMinutes(state: AppState, day: string): number {
  const monday = mondayOf(day);
  return Object.entries(minutesByDay(state))
    .filter(([d]) => mondayOf(d) === monday)
    .reduce((s, [, m]) => s + m, 0);
}

export interface CardioStats {
  /** Wszystkie kroki z całej historii. */
  steps: number;
  /** Najwięcej kroków w jednym dniu. */
  bestDaySteps: number;
  /** Dni z celem kroków. */
  goalDays: number;
  /** Bieżnia i rower od dziesięciu minut. */
  sessions: number;
  /** Zajęcia tańca od dziesięciu minut. */
  dances: number;
  /** Droga z kroków, bieżni i roweru, w pełnych kilometrach. Taniec drogi nie ma. */
  km: number;
  /** Tygodnie od poniedziałku do niedzieli ze 150 minutami ruchu. */
  whoWeeks: number;
  /** Najdłuższy ciąg dni aktywnych z rzędu. */
  run: number;
}

export function cardioStats(state: AppState): CardioStats {
  const list = cardioOf(state);
  const stepsByDay: Record<string, number> = {};
  let steps = 0;
  let sessions = 0;
  let dances = 0;
  let km = 0;
  list.forEach((c) => {
    if (c.kind === 'steps') {
      steps += c.steps;
      stepsByDay[c.day] = (stepsByDay[c.day] ?? 0) + c.steps;
    } else if (c.min >= SESSION_MIN) {
      // Krótsze to rozgrzewka — ani wyjście, ani zajęcia.
      if (c.kind === 'dance') dances++;
      else sessions++;
    }
    // Droga nie zależy od wagi — liczymy ją dla dowolnej, żeby odznaka nie czekała na ważenie.
    km += entryEnergy(state, c, INTENSITY_KG).km ?? 0;
  });

  const minutes = minutesByDay(state);
  const perWeek = new Map<string, number>();
  Object.entries(minutes).forEach(([d, m]) => perWeek.set(mondayOf(d), (perWeek.get(mondayOf(d)) ?? 0) + m));

  const active = Object.keys(minutes)
    .filter((d) => minutes[d]! >= ACTIVE_DAY_MIN)
    .sort();
  let run = 0;
  let best = 0;
  active.forEach((d, i) => {
    const prev = active[i - 1];
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });

  return {
    steps,
    bestDaySteps: Math.max(0, ...Object.values(stepsByDay)),
    goalDays: Object.values(stepsByDay).filter((n) => n >= STEP_GOAL).length,
    sessions,
    dances,
    km: Math.floor(km),
    whoWeeks: [...perWeek.values()].filter((m) => m >= WHO_WEEK_MIN).length,
    run: best,
  };
}
