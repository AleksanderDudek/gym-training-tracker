import { EX } from '../data/exercises';
import {
  EX_MUSCLES,
  MAJOR_MUSCLES,
  MUSCLES,
  MUSCLE_ACC,
  PULL_MUSCLES,
  PUSH_MUSCLES,
  ISOLATION,
  STABILIZERS,
} from '../data/muscles';
import type { MuscleId } from '../data/muscles';
import { setsEnergy } from './energy';
import type { AppState, ExerciseId, PlanTemplate, Workout, WorkoutKind } from '../types';

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

const fmt = (n: number): string => n.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
const sum = (l: Loads, ms: MuscleId[]): number => ms.reduce((a, m) => a + (l[m] ?? 0), 0);

/* ---------------- Kolejność ---------------- */

/** Ruchy wybuchowe spoza trybu balistycznego — też na początek, póki układ nerwowy jest świeży. */
const EXPLOSIVE = new Set<ExerciseId>(['burpee']);

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

/** Kolejność po zasadach, a w obrębie jednej grupy — ta, którą ktoś wybrał. */
export const suggestedOrder = (ids: ExerciseId[]): ExerciseId[] =>
  ids
    .map((id, i) => ({ id, i, r: orderRank(id) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.id);

/* ---------------- Trening ---------------- */

export const KIND_LABEL: Record<WorkoutKind, string> = {
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
};

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
export function reviewWorkout(state: AppState, ids: ExerciseId[], kind?: WorkoutKind): WorkoutReview {
  const known = ids.filter((id) => EX[id]);
  const loads = workoutLoads(state, known);
  const list = loadList(loads);
  const sets = known.reduce((a, id) => a + dose(state, id).sets, 0);
  const secs = known.reduce((a, id) => {
    const d = dose(state, id);
    return a + setsEnergy(id, Array.from({ length: d.sets }, () => ({ reps: d.target })), 70).secs;
  }, 0);
  const order = suggestedOrder(known);
  const orderOk = order.every((id, i) => id === known[i]);
  const notes: DesignNote[] = [];
  if (!known.length) return { loads: list, sets, secs, notes, order, orderOk, ok: true };

  const over = list.filter((x) => x.sets > RULES.sessionCap);
  if (over.length && kind !== 'light')
    notes.push({
      level: 'warn',
      code: 'session-cap',
      title: `Za dużo naraz: ${over.map((x) => `${MUSCLE_ACC[x.muscle]} ${fmt(x.sets)}`).join(', ')} serii`,
      text: `Powyżej ok. ${RULES.sessionCap} serii na jedną partię w jednej sesji przyrost prawie przestaje rosnąć, a zmęczenie rośnie dalej. Przenieś jedno ćwiczenie do innego dnia albo zamień je na ruch dla innej partii — ta sama liczba serii w dwóch sesjach da więcej.`,
    });

  if (!orderOk)
    notes.push({
      level: 'tip',
      code: 'order',
      title: 'Kolejność do poprawki',
      text: `Siła rośnie najbardziej w tym ćwiczeniu, które idzie pierwsze, więc na początek to, na czym ci zależy — zwykle ruch wybuchowy albo wielostawowy. Izolacje potem, a brzuch, łydki i spacery na koniec, bo stabilizują każde ciężkie ćwiczenie. Na przyrost masy kolejność wpływa niewiele. Proponowana: ${names(order)}.`,
    });

  const minutes = Math.round(secs / 60);
  if (minutes > RULES.tooLongMinutes)
    notes.push({
      level: 'warn',
      code: 'too-long',
      title: `Ok. ${minutes} minut`,
      text: 'To już dwa treningi w jednym — pod koniec jakość serii spada, a ryzyko błędu technicznego rośnie. Podziel go na dwa dni.',
    });
  else if (minutes > RULES.longMinutes)
    notes.push({
      level: 'tip',
      code: 'long',
      title: `Ok. ${minutes} minut`,
      text: 'Długo jak na jedną sesję. Da się, ale ostatnie ćwiczenia robisz już na zmęczeniu — ważne niech idą na początek.',
    });

  if (known.length > RULES.maxExercises)
    notes.push({
      level: 'tip',
      code: 'many',
      title: `${known.length} ćwiczeń`,
      text: 'Przy tylu ruchach każdy dostaje mało uwagi. Cztery do siedmiu ćwiczeń to typowy, dobrze znoszony zakres.',
    });

  const push = sum(loads, PUSH_MUSCLES);
  const pull = sum(loads, PULL_MUSCLES);

  if (kind === 'push') {
    const bad = known.filter(isPull);
    if (bad.length)
      notes.push({
        level: 'tip',
        code: 'push-has-pull',
        title: 'W treningu pchania jest ciągnięcie',
        text: `${names(bad)} — to ruchy dnia pull. W układzie push/pull mieszanie zabiera przerwę mięśniom, które miały odpocząć.`,
      });
  }
  if (kind === 'pull') {
    const bad = known.filter(isPush);
    if (bad.length)
      notes.push({
        level: 'tip',
        code: 'pull-has-push',
        title: 'W treningu ciągnięcia jest pchanie',
        text: `${names(bad)} — to ruchy dnia push. Przenieś je tam, gdzie klatka i triceps i tak pracują.`,
      });
  }
  if (kind === 'legs' || kind === 'lower') {
    if (!known.some(isKnee))
      notes.push({
        level: 'tip',
        code: 'no-knee',
        title: 'Brakuje przysiadu albo wykroku',
        text: 'Nogi to dwa wzorce: kolano (przysiad, wykrok, wypychanie) i biodro (martwy ciąg, hip thrust). Bez pierwszego czworogłowe zostają w tyle.',
      });
    if (!known.some(isHip))
      notes.push({
        level: 'tip',
        code: 'no-hip',
        title: 'Brakuje zawiasu biodrowego',
        text: 'Nogi to dwa wzorce: kolano i biodro. Bez martwego ciągu, RDL albo hip thrustu tył uda pracuje tylko pomocniczo.',
      });
  }
  if (kind === 'full') {
    const miss = [
      !known.some(isLower) && 'nóg',
      !known.some(isPush) && 'pchania',
      !known.some(isPull) && 'ciągnięcia',
    ].filter(Boolean);
    if (miss.length)
      notes.push({
        level: 'tip',
        code: 'full-missing',
        title: `Całe ciało bez ${miss.join(' i ')}`,
        text: 'Trening całego ciała ma ruszyć nogi, pchanie i ciągnięcie — minimum, które Iversen i in. (2021) zalecają nawet przy braku czasu. Wtedy dwa–trzy takie treningi w tygodniu to układ, który ACSM zaleca początkującym.',
      });
  }
  if (kind === 'upper' && push > 0 && pull > 0 && push > pull * RULES.pushPull)
    notes.push({
      level: 'tip',
      code: 'push-pull',
      title: `Pchania ${fmt(push)}, ciągnięcia ${fmt(pull)} serii`,
      text: 'Pchania jest wyraźnie więcej niż ciągnięcia. Dołóż wiosłowanie albo ściąganie drążka — plecy i tył barków trzymają ramię w stawie.',
    });
  if ((kind === 'full' || kind === 'upper') && push >= 3 && pull === 0)
    notes.push({
      level: 'tip',
      code: 'no-pull',
      title: 'Samo pchanie, zero ciągnięcia',
      text: 'Górna połowa bez ciągnięcia to prosta droga do zaokrąglonych barków. Dodaj choć jedno wiosłowanie.',
    });

  const focus = kind ? FOCUS[kind] : undefined;
  if (focus && sum(loads, focus) < RULES.focusMin)
    notes.push({
      level: 'tip',
      code: 'focus-low',
      title: `Mało serii na ${focus.map((m) => MUSCLE_ACC[m]).join(' i ')}`,
      text: `Trening pod jedną partię powinien dać jej przynajmniej ${RULES.focusMin} serii — inaczej to trening ogólny z inną nazwą.`,
    });

  if (!notes.length)
    notes.push({
      level: 'good',
      code: 'ok',
      title: 'Trening trzyma się zasad',
      text: `Żadna partia nie dostaje więcej niż ${RULES.sessionCap} serii, kolejność idzie od ruchów wybuchowych i wielostawowych do izolacji, a całość mieści się w ok. ${minutes} minutach.`,
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

const WD = ['', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];

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
      title: 'Plan wskazuje trening, którego nie ma',
      text: `Brakuje: ${missing.join(', ')}. Wybierz trening z listy albo usuń ten dzień.`,
    });
  if (!days.length || !plan.cycle.length) {
    notes.push({
      level: 'warn',
      code: 'empty',
      title: 'Plan bez treningów',
      text: 'Wybierz dni tygodnia i przypisz im treningi.',
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
      title: 'Siedem dni bez przerwy',
      text: 'Bez choćby jednego dnia wolnego zmęczenie się kumuluje, a siła rośnie właśnie w przerwie. Zostaw przynajmniej jeden dzień wolny.',
    });
  if (days.length === 1)
    notes.push({
      level: 'tip',
      code: 'once',
      title: 'Jeden trening w tygodniu',
      text: 'WHO zaleca ćwiczenia siłowe co najmniej dwa dni w tygodniu. Jeden to dobry start, ale drugi dzień wyraźnie przyspiesza efekty.',
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
      title: `Bez 48 godzin przerwy: ${[...tight].map((m) => MUSCLE_ACC[m]).join(', ')}`,
      text: 'Ta sama partia dostaje ciężki trening dwa dni z rzędu. ACSM (2011) zaleca co najmniej 48 godzin przed kolejnym mocnym treningiem tej samej grupy mięśni — przestaw dni albo treningi.',
    });

  const over = weekly.filter((x) => x.sets > RULES.weeklyMax && !STABILIZERS.includes(x.muscle));
  if (over.length)
    notes.push({
      level: 'tip',
      code: 'weekly-max',
      title: `Dużo w tygodniu: ${over.map((x) => `${MUSCLE_ACC[x.muscle]} ${fmt(x.sets)}`).join(', ')} serii`,
      text: `Powyżej ok. ${RULES.weeklyMax} serii tygodniowo na partię przyrost prawie już nie rośnie, a zmęczenia przybywa. To nie błąd, ale te serie więcej dadzą innej partii.`,
    });

  const skipped = MAJOR_MUSCLES.filter((m) => get(m).sets === 0);
  if (skipped.length)
    notes.push({
      level: 'tip',
      code: 'skips',
      title: `Plan pomija: ${skipped.map((m) => MUSCLE_ACC[m]).join(', ')}`,
      text: 'WHO zaleca ćwiczenia siłowe angażujące wszystkie główne grupy mięśni. Przy planie pod jedną partię to świadomy wybór — przy ogólnym warto to uzupełnić.',
    });
  const low = MAJOR_MUSCLES.filter((m) => get(m).sets > 0 && get(m).sets < RULES.weeklyMin);
  if (low.length)
    notes.push({
      level: 'tip',
      code: 'weekly-low',
      title: `Mało w tygodniu: ${low.map((m) => MUSCLE_ACC[m]).join(', ')}`,
      text: `Poniżej ${RULES.weeklyMin} serii tygodniowo partia najwyżej trzyma formę. Wyraźny wzrost zaczyna się od ok. ${RULES.weeklyTarget} serii.`,
    });
  const once = MAJOR_MUSCLES.filter((m) => get(m).sets >= 8 && get(m).freq < 1.5 && days.length >= 2);
  if (once.length)
    notes.push({
      level: 'tip',
      code: 'frequency',
      title: `Raz w tygodniu: ${once.map((m) => MUSCLE_ACC[m]).join(', ')}`,
      text: 'Ta sama liczba serii rozłożona na dwa dni daje lepszą jakość serii i częstszy bodziec. Przy tej samej objętości częstotliwość ma mniejsze znaczenie, ale dwa razy w tygodniu to bezpieczny wybór.',
    });

  const push = sum(Object.fromEntries(weekly.map((x) => [x.muscle, x.sets])), PUSH_MUSCLES);
  const pull = sum(Object.fromEntries(weekly.map((x) => [x.muscle, x.sets])), PULL_MUSCLES);
  if (pull > 0 && push > pull * RULES.pushPullWeek)
    notes.push({
      level: 'tip',
      code: 'push-pull',
      title: `Tygodniowo pchania ${fmt(push)}, ciągnięcia ${fmt(pull)} serii`,
      text: 'Pchanie wyraźnie przeważa. Plecy i tył barków trzymają ramię w stawie — dołóż dzień albo ćwiczenia ciągnięcia.',
    });

  const deload = [...(plan.deload ?? [])].sort((a, b) => a - b);
  const marks = [0, ...deload, plan.weeks];
  const longest = marks.slice(1).reduce((m, w, i) => Math.max(m, w - marks[i]!), 0);
  if (plan.weeks >= RULES.deloadMaxGap && longest > RULES.deloadMaxGap)
    notes.push({
      level: 'tip',
      code: 'deload',
      title: deload.length ? `${longest} tygodni bez lżejszego tygodnia` : 'Bez tygodnia lżejszego',
      text: `Przy planie na ${plan.weeks} tygodni warto co 4–${RULES.deloadMaxGap} tygodni wstawić tydzień lżejszy: mniej serii, bez gonienia rekordów. To zarządzanie zmęczeniem, a nie przyspieszacz — tak robi większość trenujących, średnio co ok. 6 tygodni.`,
    });

  if (!notes.length) {
    const main = MAJOR_MUSCLES.map(get).filter((x) => x.sets > 0);
    const lo = Math.min(...main.map((x) => x.sets));
    const hi = Math.max(...main.map((x) => x.sets));
    notes.push({
      level: 'good',
      code: 'ok',
      title: 'Plan trzyma się zasad',
      text: `Główne partie dostają od ${fmt(lo)} do ${fmt(hi)} serii tygodniowo, żadna nie trenuje ciężko dwa dni z rzędu, a ${deload.length ? `tydzień lżejszy wypada w ${deload.join(', ')}. tygodniu` : 'plan jest na tyle krótki, że obejdzie się bez tygodnia lżejszego'}.`,
    });
  }

  return { weekly, perWeek: days.length, notes, ok: !notes.some((x) => x.level === 'warn') };
}

/** Pierwszy tydzień planu: dzień tygodnia i trening, który na niego wypada. */
export const weekLayout = (plan: PlanShape): { weekday: number; name: string; workout: string }[] =>
  [...new Set(plan.weekdays)]
    .sort((a, b) => a - b)
    .map((d, i) => ({ weekday: d, name: WD[d]!, workout: plan.cycle[i % Math.max(1, plan.cycle.length)] ?? '' }));
