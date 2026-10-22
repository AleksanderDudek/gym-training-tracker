import { blocksOf } from './blocks';
import { EX } from '../data/exercises';
import {
  EX_MUSCLES,
  MAJOR_MUSCLES,
  MUSCLES,
  MUSCLE_ACC,
  MUSCLE_NAME,
  PULL_MUSCLES,
  PUSH_MUSCLES,
  ISOLATION,
  STABILIZERS,
} from '../data/muscles';
import type { MuscleId } from '../data/muscles';
import { setsEnergy } from './energy';
import { CIRCUIT_MOVE, PAIR_REST, ROUND_REST } from './rests';
import type { AppState, ExerciseId, PlanTemplate, Workout, WorkoutKind } from '../types';
import { LOCALE, pluralEn, text } from '../i18n';

const T = text({
  pl: {
    circuitPair: (a: string, b: string, muscles: string) => `${a} i ${b} — obie stacje na ${muscles}.`,
    kinds: {
      full: 'Całe ciało',
      push: 'Push — pchanie',
      pull: 'Pull — ciągnięcie',
      legs: 'Nogi',
      upper: 'Góra',
      lower: 'Dół',
      glutes: 'Pośladki',
      chest: 'Klatka',
      back: 'Plecy',
      shoulders: 'Barki',
      arms: 'Ramiona',
      core: 'Brzuch i core',
      light: 'Dzień lekki',
    } as Record<WorkoutKind, string>,
    sessionCapTitle: (list: string) => `Za dużo naraz: ${list} serii`,
    sessionCapText: (cap: number) =>
      `Powyżej ok. ${cap} serii na jedną partię w jednej sesji przyrost prawie przestaje rosnąć, a zmęczenie rośnie dalej. Przenieś jedno ćwiczenie do innego dnia albo zamień je na ruch dla innej partii — ta sama liczba serii w dwóch sesjach da więcej.`,
    orderTitle: 'Kolejność do poprawki',
    orderText: (order: string) =>
      `Siła rośnie najbardziej w tym ćwiczeniu, które idzie pierwsze, więc na początek to, na czym ci zależy — zwykle ruch wybuchowy albo wielostawowy. Izolacje potem, a brzuch, łydki i spacery na koniec, bo stabilizują każde ciężkie ćwiczenie. Na przyrost masy kolejność wpływa niewiele. Proponowana: ${order}.`,
    circuitRepeatTitle: 'Obwód dwa razy z rzędu na tę samą partię',
    circuitRepeatText: (repeats: string) =>
      `${repeats} W obwodzie stacje mają zmieniać partie — wtedy jedna odpoczywa, kiedy pracuje druga, i krótkie przejścia wystarczą.`,
    minutesTitle: (minutes: number) => `Ok. ${minutes} minut`,
    tooLongText:
      'To już dwa treningi w jednym — pod koniec jakość serii spada, a ryzyko błędu technicznego rośnie. Podziel go na dwa dni.',
    longText:
      'Długo jak na jedną sesję. Da się, ale ostatnie ćwiczenia robisz już na zmęczeniu — ważne niech idą na początek.',
    manyTitle: (n: number) => `${n} ćwiczeń`,
    manyText: 'Przy tylu ruchach każdy dostaje mało uwagi. Cztery do siedmiu ćwiczeń to typowy, dobrze znoszony zakres.',
    pushHasPullTitle: 'W treningu pchania jest ciągnięcie',
    pushHasPullText: (names: string) =>
      `${names} — to ruchy dnia pull. W układzie push/pull mieszanie zabiera przerwę mięśniom, które miały odpocząć.`,
    pullHasPushTitle: 'W treningu ciągnięcia jest pchanie',
    pullHasPushText: (names: string) =>
      `${names} — to ruchy dnia push. Przenieś je tam, gdzie klatka i triceps i tak pracują.`,
    noKneeTitle: 'Brakuje przysiadu albo wykroku',
    noKneeText:
      'Nogi to dwa wzorce: kolano (przysiad, wykrok, wypychanie) i biodro (martwy ciąg, hip thrust). Bez pierwszego czworogłowe zostają w tyle.',
    noHipTitle: 'Brakuje zawiasu biodrowego',
    noHipText:
      'Nogi to dwa wzorce: kolano i biodro. Bez martwego ciągu, RDL albo hip thrustu tył uda pracuje tylko pomocniczo.',
    missLegs: 'nóg',
    missPush: 'pchania',
    missPull: 'ciągnięcia',
    fullMissingTitle: (miss: string[]) => `Całe ciało bez ${miss.join(' i ')}`,
    fullMissingText:
      'Trening całego ciała ma ruszyć nogi, pchanie i ciągnięcie — minimum, które Iversen i in. (2021) zalecają nawet przy braku czasu. Wtedy dwa–trzy takie treningi w tygodniu to układ, który ACSM zaleca początkującym.',
    pushPullTitle: (push: string, pull: string) => `Pchania ${push}, ciągnięcia ${pull} serii`,
    pushPullText:
      'Pchania jest wyraźnie więcej niż ciągnięcia. Dołóż wiosłowanie albo ściąganie drążka — plecy i tył barków trzymają ramię w stawie.',
    noPullTitle: 'Samo pchanie, zero ciągnięcia',
    noPullText: 'Górna połowa bez ciągnięcia to prosta droga do zaokrąglonych barków. Dodaj choć jedno wiosłowanie.',
    focusLowTitle: (muscles: string[]) => `Mało serii na ${muscles.join(' i ')}`,
    focusLowText: (min: number) =>
      `Trening pod jedną partię powinien dać jej przynajmniej ${min} serii — inaczej to trening ogólny z inną nazwą.`,
    workoutOkTitle: 'Trening trzyma się zasad',
    workoutOkText: (cap: number, minutes: number) =>
      `Żadna partia nie dostaje więcej niż ${cap} serii, kolejność idzie od ruchów wybuchowych i wielostawowych do izolacji, a całość mieści się w ok. ${minutes} minutach.`,
    missingWorkoutTitle: 'Plan wskazuje trening, którego nie ma',
    missingWorkoutText: (missing: string) => `Brakuje: ${missing}. Wybierz trening z listy albo usuń ten dzień.`,
    emptyTitle: 'Plan bez treningów',
    emptyText: 'Wybierz dni tygodnia i przypisz im treningi.',
    noRestTitle: 'Siedem dni bez przerwy',
    noRestText:
      'Bez choćby jednego dnia wolnego zmęczenie się kumuluje, a siła rośnie właśnie w przerwie. Zostaw przynajmniej jeden dzień wolny.',
    onceTitle: 'Jeden trening w tygodniu',
    onceText:
      'WHO zaleca ćwiczenia siłowe co najmniej dwa dni w tygodniu. Jeden to dobry start, ale drugi dzień wyraźnie przyspiesza efekty.',
    recoveryTitle: (muscles: string) => `Bez 48 godzin przerwy: ${muscles}`,
    recoveryText:
      'Ta sama partia dostaje ciężki trening dwa dni z rzędu. ACSM (2011) zaleca co najmniej 48 godzin przed kolejnym mocnym treningiem tej samej grupy mięśni — przestaw dni albo treningi.',
    weeklyMaxTitle: (list: string) => `Dużo w tygodniu: ${list} serii`,
    weeklyMaxText: (max: number) =>
      `Powyżej ok. ${max} serii tygodniowo na partię przyrost prawie już nie rośnie, a zmęczenia przybywa. To nie błąd, ale te serie więcej dadzą innej partii.`,
    skipsTitle: (muscles: string) => `Plan pomija: ${muscles}`,
    skipsText:
      'WHO zaleca ćwiczenia siłowe angażujące wszystkie główne grupy mięśni. Przy planie pod jedną partię to świadomy wybór — przy ogólnym warto to uzupełnić.',
    weeklyLowTitle: (muscles: string) => `Mało w tygodniu: ${muscles}`,
    weeklyLowText: (min: number, target: number) =>
      `Poniżej ${min} serii tygodniowo partia najwyżej trzyma formę. Wyraźny wzrost zaczyna się od ok. ${target} serii.`,
    frequencyTitle: (muscles: string) => `Raz w tygodniu: ${muscles}`,
    frequencyText:
      'Ta sama liczba serii rozłożona na dwa dni daje lepszą jakość serii i częstszy bodziec. Przy tej samej objętości częstotliwość ma mniejsze znaczenie, ale dwa razy w tygodniu to bezpieczny wybór.',
    weekPushPullTitle: (push: string, pull: string) => `Tygodniowo pchania ${push}, ciągnięcia ${pull} serii`,
    weekPushPullText:
      'Pchanie wyraźnie przeważa. Plecy i tył barków trzymają ramię w stawie — dołóż dzień albo ćwiczenia ciągnięcia.',
    deloadTitle: (longest: number | null) =>
      longest !== null ? `${longest} tygodni bez lżejszego tygodnia` : 'Bez tygodnia lżejszego',
    deloadText: (weeks: number, maxGap: number) =>
      `Przy planie na ${weeks} tygodni warto co 4–${maxGap} tygodni wstawić tydzień lżejszy: mniej serii, bez gonienia rekordów. To zarządzanie zmęczeniem, a nie przyspieszacz — tak robi większość trenujących, średnio co ok. 6 tygodni.`,
    planOkTitle: 'Plan trzyma się zasad',
    planOkText: (lo: string, hi: string, deload: number[]) =>
      `Główne partie dostają od ${lo} do ${hi} serii tygodniowo, żadna nie trenuje ciężko dwa dni z rzędu, a ${deload.length ? `tydzień lżejszy wypada w ${deload.join(', ')}. tygodniu` : 'plan jest na tyle krótki, że obejdzie się bez tygodnia lżejszego'}.`,
  },
  en: {
    circuitPair: (a: string, b: string, muscles: string) => `${a} and ${b} — both stations work ${muscles}.`,
    kinds: {
      full: 'Full body',
      push: 'Push',
      pull: 'Pull',
      legs: 'Legs',
      upper: 'Upper body',
      lower: 'Lower body',
      glutes: 'Glutes',
      chest: 'Chest',
      back: 'Back',
      shoulders: 'Shoulders',
      arms: 'Arms',
      core: 'Abs & core',
      light: 'Light day',
    },
    sessionCapTitle: (list: string) => `Too much in one go: ${list} sets`,
    sessionCapText: (cap: number) =>
      `Beyond about ${cap} sets for one muscle group in a single session, growth almost stops increasing while fatigue keeps climbing. Move one exercise to another day or swap it for a move for another muscle group — the same number of sets over two sessions gets you more.`,
    orderTitle: 'Order needs fixing',
    orderText: (order: string) =>
      `Strength grows most in whichever exercise comes first, so start with what matters to you — usually an explosive or compound move. Isolation work next, then abs, calves and carries at the end, because they stabilise every heavy lift. For muscle growth the order matters little. Suggested: ${order}.`,
    circuitRepeatTitle: 'Circuit hits the same muscle group twice in a row',
    circuitRepeatText: (repeats: string) =>
      `${repeats} In a circuit, stations should switch muscle groups — one rests while the other works, and short transitions are enough.`,
    minutesTitle: (minutes: number) => `About ${minutes} minutes`,
    tooLongText:
      'That’s two workouts in one — towards the end the quality of your sets drops and the risk of a form slip rises. Split it over two days.',
    longText:
      'Long for one session. It’s doable, but you’ll do the last exercises tired — put the important ones first.',
    manyTitle: (n: number) => `${n} exercises`,
    manyText: 'With this many moves, each one gets little attention. Four to seven exercises is the typical, well-tolerated range.',
    pushHasPullTitle: 'Your push workout has pulling in it',
    pushHasPullText: (names: string) =>
      `${names} — these are pull-day moves. In a push/pull split, mixing them takes rest away from muscles that were meant to recover.`,
    pullHasPushTitle: 'Your pull workout has pushing in it',
    pullHasPushText: (names: string) =>
      `${names} — these are push-day moves. Move them to where your chest and triceps are working anyway.`,
    noKneeTitle: 'No squat or lunge',
    noKneeText:
      'Legs have two patterns: knee (squat, lunge, leg press) and hip (deadlift, hip thrust). Without the first, your quads fall behind.',
    noHipTitle: 'No hip hinge',
    noHipText:
      'Legs have two patterns: knee and hip. Without a deadlift, RDL or hip thrust, your hamstrings only work as helpers.',
    missLegs: 'legs',
    missPush: 'pushing',
    missPull: 'pulling',
    fullMissingTitle: (miss: string[]) => `Full body without ${miss.join(' or ')}`,
    fullMissingText:
      'A full-body workout should train legs, pushing and pulling — the minimum Iversen et al. (2021) recommend even when you’re short of time. Two or three of these a week is then the set-up ACSM recommends for beginners.',
    pushPullTitle: (push: string, pull: string) => `Pushing ${push}, pulling ${pull} sets`,
    pushPullText:
      'There’s clearly more pushing than pulling. Add a row or a pulldown — your back and rear delts keep your shoulder in its socket.',
    noPullTitle: 'All push, no pull',
    noPullText: 'Upper body without pulling is a short road to rounded shoulders. Add at least one row.',
    focusLowTitle: (muscles: string[]) => `Few sets for ${muscles.join(' and ')}`,
    focusLowText: (min: number) =>
      `A workout for one muscle group should give it at least ${min} sets — otherwise it’s a general workout with a different name.`,
    workoutOkTitle: 'This workout follows the rules',
    workoutOkText: (cap: number, minutes: number) =>
      `No muscle group gets more than ${cap} sets, the order runs from explosive and compound moves to isolation, and the whole thing fits in about ${minutes} minutes.`,
    missingWorkoutTitle: 'The plan points to a workout that doesn’t exist',
    missingWorkoutText: (missing: string) => `Missing: ${missing}. Pick a workout from the list or remove this day.`,
    emptyTitle: 'Plan with no workouts',
    emptyText: 'Pick days of the week and assign workouts to them.',
    noRestTitle: 'Seven days without a break',
    noRestText:
      'Without even one day off, fatigue builds up — and strength grows during rest. Leave at least one day off.',
    onceTitle: 'One workout a week',
    onceText:
      'The WHO recommends strength training on at least two days a week. One is a good start, but a second day clearly speeds up results.',
    recoveryTitle: (muscles: string) => `Less than 48 hours’ rest: ${muscles}`,
    recoveryText:
      'The same muscle group gets a hard workout two days in a row. ACSM (2011) recommends at least 48 hours before the next hard session for the same muscle group — rearrange the days or the workouts.',
    weeklyMaxTitle: (list: string) => `A lot per week: ${list} sets`,
    weeklyMaxText: (max: number) =>
      `Beyond about ${max} sets a week per muscle group, growth hardly increases while fatigue piles up. It’s not a mistake, but those sets would do more for another muscle group.`,
    skipsTitle: (muscles: string) => `The plan skips: ${muscles}`,
    skipsText:
      'The WHO recommends strength training that works all major muscle groups. In a plan for one muscle group that’s a conscious choice — in a general one it’s worth filling the gap.',
    weeklyLowTitle: (muscles: string) => `Not much per week: ${muscles}`,
    weeklyLowText: (min: number, target: number) =>
      `Below ${min} sets a week, a muscle group at best holds its form. Clear growth starts at about ${target} sets.`,
    frequencyTitle: (muscles: string) => `Once a week: ${muscles}`,
    frequencyText:
      'The same number of sets spread over two days gives better-quality sets and a more frequent stimulus. At the same volume frequency matters less, but twice a week is a safe choice.',
    weekPushPullTitle: (push: string, pull: string) => `Per week: pushing ${push}, pulling ${pull} sets`,
    weekPushPullText:
      'Pushing clearly dominates. Your back and rear delts keep your shoulder in its socket — add a day or some pulling exercises.',
    deloadTitle: (longest: number | null) =>
      longest !== null ? `${longest} weeks without a lighter week` : 'No lighter week',
    deloadText: (weeks: number, maxGap: number) =>
      `With a ${weeks}-week plan, it’s worth adding a lighter week every 4–${maxGap} weeks: fewer sets, no chasing records. It’s fatigue management, not a booster — most lifters do it, on average about every 6 weeks.`,
    planOkTitle: 'This plan follows the rules',
    planOkText: (lo: string, hi: string, deload: number[]) =>
      `Major muscle groups get ${lo} to ${hi} sets a week, none trains hard two days in a row, and ${deload.length ? `the lighter ${pluralEn(deload.length, 'week falls in week', 'weeks fall in weeks')} ${deload.join(', ')}` : 'the plan is short enough to do without a lighter week'}.`,
  },
});

/**
 * Doradca układania treningów i planów.
 *
 * Liczy to, co da się policzyć z listy ćwiczeń, i porównuje z tym, co mówią badania
 * i stanowiska ACSM. Nie ocenia gustu — trening z samych przysiadów jest dozwolony, tylko
 * doradca powie, że siedemnaście serii na czworogłowe w jednej sesji to głównie zmęczenie.
 *
 * Serie liczone są ułamkowo, jak w metaanalizach dawki treningowej: seria liczy się
 * mięśniowi głównemu w całości, pomocniczemu w połowie. Seria wybuchowa (swing) i podchód
 * na czas (deska, spacer farmera) nie idą do upadku mięśniowego, więc same liczą się za pół.
 */

export const RULES = {
  /**
   * Serie na jedną partię w jednej sesji, powyżej których przyrost prawie przestaje rosnąć,
   * a zmęczenie rośnie dalej. Metaregresja dawki na sesję (Remmert i in., 2025, preprint
   * SportRxiv) pokazuje wypłaszczenie w okolicy jedenastu serii ułamkowych.
   */
  sessionCap: 11,
  /** Tydzień: poniżej tego to najwyżej podtrzymanie (Iversen i in., 2021). */
  weeklyMin: 4,
  /**
   * Od tego zaczyna się wyraźny wzrost. Stanowisko ACSM z 2026 r.: od ok. 10 serii na partię
   * tygodniowo; przegląd Baz-Valle i in. (2022) wskazuje 12–20 jako zakres najlepszy.
   */
  weeklyTarget: 10,
  /**
   * Powyżej tego przyrost ledwo rośnie (ACSM 2026: malejące zyski w okolicy 18–20 serii,
   * Baz-Valle 2022: ponad 20 bez dodatkowej korzyści) — doradca podpowiada, nie zabrania.
   */
  weeklyMax: 20,
  /** Serie na partię, od których dzień liczy się jako ciężki dla tego mięśnia. */
  hardDay: 4,
  /** Trening dłuższy niż tyle minut to już dwa treningi w jednym. */
  longMinutes: 75,
  tooLongMinutes: 90,
  maxExercises: 8,
  /**
   * Pchanie do ciągnięcia. Badań z konkretnym stosunkiem nie ma — to praktyka trenerska
   * wsparta obserwacjami Kolbera i in. (2014, 2017): u ćwiczących z bólem barku częściej
   * słabsze są rotatory zewnętrzne i dolne kaptury. Stąd tygodniowo ciągnięcia co najmniej
   * tyle, co pchania, a w jednym treningu górnej połowy najwyżej półtora raza więcej pchania.
   */
  pushPull: 1.5,
  pushPullWeek: 1.2,
  /** Trening pod partię powinien dać jej przynajmniej tyle serii. */
  focusMin: 6,
  /**
   * Tydzień lżejszy co tyle tygodni. W ankiecie Rogerson i in. (2024) zawodnicy robili go
   * średnio co 5,6 tygodnia; konsensus Bell i in. (2023) mówi o 4–8 tygodniach.
   */
  deloadEvery: 6,
  /** Najdłuższy odstęp między tygodniami lżejszymi, zanim doradca o nie zapyta. */
  deloadMaxGap: 8,
} as const;

export type NoteLevel = 'warn' | 'tip' | 'good';

export interface DesignNote {
  level: NoteLevel;
  /** Klucz do testów i do renderowania — tekst bywa zmieniany, klucz nie. */
  code: string;
  title: string;
  text: string;
}

export type Loads = Partial<Record<MuscleId, number>>;

/** Pół serii dla ruchu wybuchowego i na czas — nie idą do upadku, więc dają mniejszy bodziec. */
export const setWeight = (id: ExerciseId): number => {
  const m = EX[id]?.mode;
  return m === 'ballistic' || m === 'carry' ? 0.5 : 1;
};

/** Serie i cel ćwiczenia na obecnym poziomie — z progresji albo z wartości domyślnych. */
export function dose(state: AppState, id: ExerciseId): { sets: number; target: number } {
  const p = state.prog[id];
  const d = EX[id]?.def;
  return { sets: p?.sets ?? d?.sets ?? 3, target: p?.target ?? d?.target ?? 8 };
}

const add = (to: Loads, m: MuscleId, n: number): void => {
  to[m] = (to[m] ?? 0) + n;
};

/** Serie ułamkowe na każdą partię z jednego ćwiczenia. */
export function exerciseLoads(id: ExerciseId, sets: number): Loads {
  const out: Loads = {};
  const use = EX_MUSCLES[id];
  if (!use) return out;
  const w = setWeight(id) * sets;
  use.p.forEach((m) => add(out, m, w));
  use.s.forEach((m) => add(out, m, w * 0.5));
  return out;
}

export function sumLoads(list: Loads[]): Loads {
  const out: Loads = {};
  list.forEach((l) => Object.entries(l).forEach(([m, n]) => add(out, m as MuscleId, n ?? 0)));
  return out;
}

export const workoutLoads = (state: AppState, ids: ExerciseId[]): Loads =>
  sumLoads(ids.map((id) => exerciseLoads(id, dose(state, id).sets)));

/** Lista partii od najbardziej obciążonej, bez zer. */
export const loadList = (l: Loads): { muscle: MuscleId; sets: number }[] =>
  MUSCLES.map((m) => ({ muscle: m, sets: l[m] ?? 0 }))
    .filter((x) => x.sets > 0)
    .sort((a, b) => b.sets - a.sets);

const fmt = (n: number): string => n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
const sum = (l: Loads, ms: MuscleId[]): number => ms.reduce((a, m) => a + (l[m] ?? 0), 0);

/* ---------------- Kolejność ---------------- */

/** Ruchy wybuchowe spoza trybu balistycznego — też na początek, póki układ nerwowy jest świeży. */
const EXPLOSIVE = new Set<ExerciseId>(['burpee', 'squat_jump']);

/**
 * Miejsce w kolejności: 0 — wybuchowe, 1 — wielostawowe, 2 — izolacje, 3 — brzuch, łydki,
 * spacery i kondycja na koniec. Zasada ze stanowiska ACSM (2009): moc przed siłą, duże
 * partie i ruchy wielostawowe przed małymi i jednostawowymi, a mięśnie stabilizujące —
 * brzuch i chwyt — na końcu, bo są potrzebne w każdym ciężkim ćwiczeniu wcześniej.
 */
export function orderRank(id: ExerciseId): number {
  const e = EX[id];
  const use = EX_MUSCLES[id];
  if (!e || !use) return 2;
  if (e.mode === 'ballistic' || EXPLOSIVE.has(id)) return 0;
  if (e.mode === 'carry' || use.p.every((m) => m === 'brzuch' || m === 'lydki' || m === 'przedramiona'))
    return 3;
  return ISOLATION.has(id) ? 2 : 1;
}

/**
 * Kolejność po zasadach, a w obrębie jednej grupy — ta, którą ktoś wybrał. Para idzie jako
 * całość z miejscem ważniejszego ćwiczenia: łydki na suwnicy zaraz po wypychaniu to jedno
 * stanowisko, a nie łydki przed izolacją.
 */
export const suggestedOrder = (
  ids: ExerciseId[],
  pairs: readonly boolean[] = [],
  circuit: readonly boolean[] = [],
): ExerciseId[] =>
  // Blok idzie w całości: para i obwód zachowują swoją kolejność w środku.
  blocksOf(ids.map((ex, i) => ({ ex, pair: pairs[i], circuit: circuit[i] })))
    .map((b, i) => ({ b, i, r: Math.min(...b.ids.map(orderRank)) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .flatMap((x) => x.b.ids);

// Przerwa między ćwiczeniami pary mieszka razem z resztą przerw.
export { PAIR_REST };

/**
 * Co jest nie tak z kolejnością stacji obwodu: sąsiednie stacje na tę samą partię. Zdania do
 * pokazania; pusta lista — stacje zmieniają partie, jak powinny.
 */
export function circuitProblems(ids: readonly ExerciseId[]): string[] {
  const out: string[] = [];
  ids.forEach((b, i) => {
    const a = ids[i - 1];
    if (!a) return;
    const pa = EX_MUSCLES[a]?.p ?? [];
    const shared = (EX_MUSCLES[b]?.p ?? []).filter((m) => pa.includes(m));
    if (shared.length)
      out.push(
        T.circuitPair(EX[a]?.name ?? a, EX[b]?.name ?? b, shared.map((m) => MUSCLE_NAME[m].toLowerCase()).join(', ')),
      );
  });
  return out;
}

/* ---------------- Trening ---------------- */

export const KIND_LABEL: Record<WorkoutKind, string> = T.kinds;

/** Partie, na które trening pod partię ma dać co najmniej `focusMin` serii. */
const FOCUS: Partial<Record<WorkoutKind, MuscleId[]>> = {
  glutes: ['posladki'],
  chest: ['klatka'],
  back: ['najszersze', 'plecy-gora'],
  shoulders: ['bark-przod', 'bark-bok', 'bark-tyl'],
  arms: ['biceps', 'triceps'],
  core: ['brzuch'],
};

const isPush = (id: ExerciseId): boolean => {
  const p = EX_MUSCLES[id]?.p ?? [];
  return p.some((m) => PUSH_MUSCLES.includes(m)) && !p.some((m) => PULL_MUSCLES.includes(m));
};
const isPull = (id: ExerciseId): boolean => {
  const p = EX_MUSCLES[id]?.p ?? [];
  return p.some((m) => PULL_MUSCLES.includes(m)) && !p.some((m) => PUSH_MUSCLES.includes(m));
};
const LOWER: MuscleId[] = ['czworoglowe', 'posladki', 'dwuglowe', 'przywodziciele'];
const isLower = (id: ExerciseId): boolean => (EX_MUSCLES[id]?.p ?? []).some((m) => LOWER.includes(m));
const isKnee = (id: ExerciseId): boolean => (EX_MUSCLES[id]?.p ?? []).includes('czworoglowe');
const isHip = (id: ExerciseId): boolean => {
  const p = EX_MUSCLES[id]?.p ?? [];
  return p.includes('dwuglowe') || (p.includes('posladki') && !p.includes('czworoglowe'));
};

const names = (ids: ExerciseId[]): string => ids.map((id) => EX[id]?.name ?? id).join(', ');

export interface WorkoutReview {
  loads: { muscle: MuscleId; sets: number }[];
  /** Serie razem, nieułamkowe — tyle trzeba zrobić. */
  sets: number;
  /** Szacowany czas serii z przerwami. */
  secs: number;
  notes: DesignNote[];
  /** Kolejność po zasadach i czy obecna się z nią zgadza. */
  order: ExerciseId[];
  orderOk: boolean;
  /** Bez ostrzeżeń — mogą zostać wskazówki. */
  ok: boolean;
}

/**
 * Przegląd jednego treningu: serie na partie, czas, kolejność, a przy znanym rodzaju —
 * czy trening robi to, co obiecuje nazwa.
 */
export function reviewWorkout(
  state: AppState,
  ids: ExerciseId[],
  kind?: WorkoutKind,
  /** `pair` każdego ćwiczenia z `ids` — „na zmianę z poprzednim”. */
  pairs: readonly boolean[] = [],
  /** Obwód (`circuit` każdego ćwiczenia) i przerwy treningu, gdy ma własne. */
  opts: { circuit?: readonly boolean[]; rest?: number | undefined; roundRest?: number | undefined } = {},
): WorkoutReview {
  const flags = ids
    .map((id, i) => ({ id, pair: !!pairs[i], circuit: !!opts.circuit?.[i] }))
    .filter((x) => EX[x.id]);
  const known = flags.map((x) => x.id);
  const knownPairs = flags.map((x) => x.pair);
  const loads = workoutLoads(state, known);
  const list = loadList(loads);
  const sets = known.reduce((a, id) => a + dose(state, id).sets, 0);
  const energy = (id: ExerciseId) => {
    const d = dose(state, id);
    return { sets: d.sets, ...setsEnergy(id, Array.from({ length: d.sets }, () => ({ reps: d.target })), 70, true, opts.rest) };
  };
  const blocks = blocksOf(flags.map((x) => ({ ex: x.id, pair: x.pair, circuit: x.circuit })));
  // Para: przerwa jednego ćwiczenia to czas pracy drugiego, więc liczy się praca obu
  // i krótka przerwa po każdej serii zamiast pełnej przerwy każdego z osobna.
  // Obwód: praca wszystkich stacji, przejścia między nimi i pełna przerwa dopiero po rundzie.
  const secs = blocks.reduce((a, b) => {
    if (b.kind === 'straight') return a + energy(b.ids[0]!).secs;
    if (b.kind === 'pair')
      return a + b.ids.reduce((t, id) => {
        const e = energy(id);
        return t + e.work + e.sets * PAIR_REST;
      }, 0);
    const parts = b.ids.map(energy);
    const rounds = Math.max(...parts.map((e) => e.sets));
    const stationSets = parts.reduce((t, e) => t + e.sets, 0);
    return (
      a +
      parts.reduce((t, e) => t + e.work, 0) +
      (stationSets - rounds) * CIRCUIT_MOVE +
      (rounds - 1) * (opts.roundRest ?? ROUND_REST)
    );
  }, 0);
  const order = suggestedOrder(known, knownPairs, flags.map((x) => x.circuit));
  const orderOk = order.every((id, i) => id === known[i]);
  const notes: DesignNote[] = [];
  if (!known.length) return { loads: list, sets, secs, notes, order, orderOk, ok: true };

  const over = list.filter((x) => x.sets > RULES.sessionCap);
  if (over.length && kind !== 'light')
    notes.push({
      level: 'warn',
      code: 'session-cap',
      title: T.sessionCapTitle(over.map((x) => `${MUSCLE_ACC[x.muscle]} ${fmt(x.sets)}`).join(', ')),
      text: T.sessionCapText(RULES.sessionCap),
    });

  if (!orderOk)
    notes.push({
      level: 'tip',
      code: 'order',
      title: T.orderTitle,
      text: T.orderText(names(order)),
    });

  blocks
    .filter((b) => b.kind === 'circuit')
    .forEach((b) => {
      const repeats = circuitProblems(b.ids);
      if (repeats.length)
        notes.push({
          level: 'tip',
          code: 'circuit-repeat',
          title: T.circuitRepeatTitle,
          text: T.circuitRepeatText(repeats.join(' ')),
        });
    });

  const minutes = Math.round(secs / 60);
  if (minutes > RULES.tooLongMinutes)
    notes.push({
      level: 'warn',
      code: 'too-long',
      title: T.minutesTitle(minutes),
      text: T.tooLongText,
    });
  else if (minutes > RULES.longMinutes)
    notes.push({
      level: 'tip',
      code: 'long',
      title: T.minutesTitle(minutes),
      text: T.longText,
    });

  if (known.length > RULES.maxExercises)
    notes.push({
      level: 'tip',
      code: 'many',
      title: T.manyTitle(known.length),
      text: T.manyText,
    });

  const push = sum(loads, PUSH_MUSCLES);
  const pull = sum(loads, PULL_MUSCLES);

  if (kind === 'push') {
    const bad = known.filter(isPull);
    if (bad.length)
      notes.push({
        level: 'tip',
        code: 'push-has-pull',
        title: T.pushHasPullTitle,
        text: T.pushHasPullText(names(bad)),
      });
  }
  if (kind === 'pull') {
    const bad = known.filter(isPush);
    if (bad.length)
      notes.push({
        level: 'tip',
        code: 'pull-has-push',
        title: T.pullHasPushTitle,
        text: T.pullHasPushText(names(bad)),
      });
  }
  if (kind === 'legs' || kind === 'lower') {
    if (!known.some(isKnee))
      notes.push({
        level: 'tip',
        code: 'no-knee',
        title: T.noKneeTitle,
        text: T.noKneeText,
      });
    if (!known.some(isHip))
      notes.push({
        level: 'tip',
        code: 'no-hip',
        title: T.noHipTitle,
        text: T.noHipText,
      });
  }
  if (kind === 'full') {
    const miss = [
      !known.some(isLower) && T.missLegs,
      !known.some(isPush) && T.missPush,
      !known.some(isPull) && T.missPull,
    ].filter((x): x is string => !!x);
    if (miss.length)
      notes.push({
        level: 'tip',
        code: 'full-missing',
        title: T.fullMissingTitle(miss),
        text: T.fullMissingText,
      });
  }
  if (kind === 'upper' && push > 0 && pull > 0 && push > pull * RULES.pushPull)
    notes.push({
      level: 'tip',
      code: 'push-pull',
      title: T.pushPullTitle(fmt(push), fmt(pull)),
      text: T.pushPullText,
    });
  if ((kind === 'full' || kind === 'upper') && push >= 3 && pull === 0)
    notes.push({
      level: 'tip',
      code: 'no-pull',
      title: T.noPullTitle,
      text: T.noPullText,
    });

  const focus = kind ? FOCUS[kind] : undefined;
  if (focus && sum(loads, focus) < RULES.focusMin)
    notes.push({
      level: 'tip',
      code: 'focus-low',
      title: T.focusLowTitle(focus.map((m) => MUSCLE_ACC[m])),
      text: T.focusLowText(RULES.focusMin),
    });

  if (!notes.length)
    notes.push({
      level: 'good',
      code: 'ok',
      title: T.workoutOkTitle,
      text: T.workoutOkText(RULES.sessionCap, minutes),
    });

  return { loads: list, sets, secs, notes, order, orderOk, ok: !notes.some((n) => n.level === 'warn') };
}

/* ---------------- Plan ---------------- */

export type PlanShape = Pick<PlanTemplate, 'cycle' | 'weekdays' | 'weeks'> &
  Partial<Pick<PlanTemplate, 'deload'>>;

export interface PlanReview {
  /** Średnio na tydzień: serie ułamkowe i w ilu sesjach partia dostaje realny bodziec. */
  weekly: { muscle: MuscleId; sets: number; freq: number }[];
  perWeek: number;
  notes: DesignNote[];
  ok: boolean;
}

/**
 * Tygodnie lżejsze co `deloadEvery` tygodni — cztery tygodnie pracy i jeden lżejszy. Ostatni
 * tydzień planu nie bywa lżejszy: po nim i tak jest przerwa albo nowy plan.
 */
export const autoDeload = (weeks: number, every: number = RULES.deloadEvery): number[] =>
  every <= 0
    ? []
    : Array.from({ length: Math.floor(weeks / every) }, (_, i) => (i + 1) * every).filter((w) => w < weeks);

/** Dni tygodnia od poniedziałku pod indeksem 1 — z `Intl` w języku aplikacji (1 stycznia 2024 to poniedziałek). */
const WD = [
  '',
  ...Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(LOCALE, { weekday: 'long', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + i)),
  ),
];

/**
 * Przegląd planu tydzień po tygodniu. Rotacja bywa dłuższa niż tydzień (trzy treningi na dwa
 * dni), więc tygodnie liczą się, aż wzorzec wróci do początku — średnia jest wtedy uczciwa.
 */
export function reviewPlan(state: AppState, plan: PlanShape, workouts: Workout[]): PlanReview {
  const days = [...new Set(plan.weekdays)].sort((a, b) => a - b);
  const notes: DesignNote[] = [];
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const missing = [...new Set(plan.cycle.filter((id) => !byId.has(id)))];
  if (missing.length)
    notes.push({
      level: 'warn',
      code: 'missing-workout',
      title: T.missingWorkoutTitle,
      text: T.missingWorkoutText(missing.join(', ')),
    });
  if (!days.length || !plan.cycle.length) {
    notes.push({
      level: 'warn',
      code: 'empty',
      title: T.emptyTitle,
      text: T.emptyText,
    });
    return { weekly: [], perWeek: 0, notes, ok: false };
  }

  // Tyle tygodni, ile trzeba, żeby rotacja wróciła do pierwszego treningu w poniedziałek.
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const period = plan.cycle.length / gcd(days.length, plan.cycle.length);
  const loadsOf = new Map<string, Loads>();
  const loadFor = (id: string): Loads => {
    if (!loadsOf.has(id)) {
      const w = byId.get(id);
      loadsOf.set(id, w ? workoutLoads(state, w.items.map((i) => i.ex)) : {});
    }
    return loadsOf.get(id)!;
  };

  const total: Loads = {};
  const freq: Loads = {};
  // Dzień tygodnia w kolejnych tygodniach → obciążenie tego dnia, do sprawdzenia przerw.
  const timeline: { abs: number; loads: Loads }[] = [];
  let n = 0;
  for (let w = 0; w < period; w++) {
    days.forEach((d) => {
      const l = loadFor(plan.cycle[n % plan.cycle.length]!);
      n++;
      Object.entries(l).forEach(([m, v]) => {
        add(total, m as MuscleId, v ?? 0);
        if ((v ?? 0) >= 2) add(freq, m as MuscleId, 1);
      });
      timeline.push({ abs: w * 7 + d, loads: l });
    });
  }
  const weekly = MUSCLES.map((m) => ({
    muscle: m,
    sets: (total[m] ?? 0) / period,
    freq: (freq[m] ?? 0) / period,
  })).filter((x) => x.sets > 0);
  const get = (m: MuscleId) => weekly.find((x) => x.muscle === m) ?? { muscle: m, sets: 0, freq: 0 };

  if (days.length === 7)
    notes.push({
      level: 'warn',
      code: 'no-rest',
      title: T.noRestTitle,
      text: T.noRestText,
    });
  if (days.length === 1)
    notes.push({
      level: 'tip',
      code: 'once',
      title: T.onceTitle,
      text: T.onceText,
    });

  // Przerwy: ta sama partia ciężko dwa dni z rzędu, także z niedzieli na poniedziałek.
  const tight = new Set<MuscleId>();
  const sorted = [...timeline].sort((a, b) => a.abs - b.abs);
  const span = period * 7;
  sorted.forEach((cur, i) => {
    const next = sorted[(i + 1) % sorted.length]!;
    const gap = (next.abs - cur.abs + span) % span || span;
    if (gap !== 1) return;
    MUSCLES.filter((m) => !STABILIZERS.includes(m)).forEach((m) => {
      if ((cur.loads[m] ?? 0) >= RULES.hardDay && (next.loads[m] ?? 0) >= RULES.hardDay) tight.add(m);
    });
  });
  // Wskazówka, nie ostrzeżenie: 48 godzin to zalecenie ekspertów ACSM, a nie wynik badań.
  if (tight.size)
    notes.push({
      level: 'tip',
      code: 'recovery',
      title: T.recoveryTitle([...tight].map((m) => MUSCLE_ACC[m]).join(', ')),
      text: T.recoveryText,
    });

  const over = weekly.filter((x) => x.sets > RULES.weeklyMax && !STABILIZERS.includes(x.muscle));
  if (over.length)
    notes.push({
      level: 'tip',
      code: 'weekly-max',
      title: T.weeklyMaxTitle(over.map((x) => `${MUSCLE_ACC[x.muscle]} ${fmt(x.sets)}`).join(', ')),
      text: T.weeklyMaxText(RULES.weeklyMax),
    });

  const skipped = MAJOR_MUSCLES.filter((m) => get(m).sets === 0);
  if (skipped.length)
    notes.push({
      level: 'tip',
      code: 'skips',
      title: T.skipsTitle(skipped.map((m) => MUSCLE_ACC[m]).join(', ')),
      text: T.skipsText,
    });
  const low = MAJOR_MUSCLES.filter((m) => get(m).sets > 0 && get(m).sets < RULES.weeklyMin);
  if (low.length)
    notes.push({
      level: 'tip',
      code: 'weekly-low',
      title: T.weeklyLowTitle(low.map((m) => MUSCLE_ACC[m]).join(', ')),
      text: T.weeklyLowText(RULES.weeklyMin, RULES.weeklyTarget),
    });
  const once = MAJOR_MUSCLES.filter((m) => get(m).sets >= 8 && get(m).freq < 1.5 && days.length >= 2);
  if (once.length)
    notes.push({
      level: 'tip',
      code: 'frequency',
      title: T.frequencyTitle(once.map((m) => MUSCLE_ACC[m]).join(', ')),
      text: T.frequencyText,
    });

  const push = sum(Object.fromEntries(weekly.map((x) => [x.muscle, x.sets])), PUSH_MUSCLES);
  const pull = sum(Object.fromEntries(weekly.map((x) => [x.muscle, x.sets])), PULL_MUSCLES);
  if (pull > 0 && push > pull * RULES.pushPullWeek)
    notes.push({
      level: 'tip',
      code: 'push-pull',
      title: T.weekPushPullTitle(fmt(push), fmt(pull)),
      text: T.weekPushPullText,
    });

  const deload = [...(plan.deload ?? [])].sort((a, b) => a - b);
  const marks = [0, ...deload, plan.weeks];
  const longest = marks.slice(1).reduce((m, w, i) => Math.max(m, w - marks[i]!), 0);
  if (plan.weeks >= RULES.deloadMaxGap && longest > RULES.deloadMaxGap)
    notes.push({
      level: 'tip',
      code: 'deload',
      title: T.deloadTitle(deload.length ? longest : null),
      text: T.deloadText(plan.weeks, RULES.deloadMaxGap),
    });

  if (!notes.length) {
    const main = MAJOR_MUSCLES.map(get).filter((x) => x.sets > 0);
    const lo = Math.min(...main.map((x) => x.sets));
    const hi = Math.max(...main.map((x) => x.sets));
    notes.push({
      level: 'good',
      code: 'ok',
      title: T.planOkTitle,
      text: T.planOkText(fmt(lo), fmt(hi), deload),
    });
  }

  return { weekly, perWeek: days.length, notes, ok: !notes.some((x) => x.level === 'warn') };
}

/** Pierwszy tydzień planu: dzień tygodnia i trening, który na niego wypada. */
export const weekLayout = (plan: PlanShape): { weekday: number; name: string; workout: string }[] =>
  [...new Set(plan.weekdays)]
    .sort((a, b) => a - b)
    .map((d, i) => ({ weekday: d, name: WD[d]!, workout: plan.cycle[i % Math.max(1, plan.cycle.length)] ?? '' }));
