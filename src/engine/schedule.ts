import type {
  ActivePlan,
  AppState,
  PlanPolicy,
  PlanTemplate,
  PlannedDay,
} from '../types';

/**
 * Daty planu liczone są na `yyyy-mm-dd` w UTC — tak samo, jak historia ćwiczeń zapisuje
 * dzień (`toISOString().slice(0, 10)`). Mieszanie z czasem lokalnym przesuwałoby treningi
 * o jeden dzień u każdego, kto trenuje wieczorem na wschód od Greenwich.
 */
const MS_DAY = 86_400_000;

/**
 * Okno łaski: tyle dni po terminie trening jeszcze go domyka jako nadrobiony.
 * Krócej byłoby okrutne wobec kogoś, kto raz w tygodniu ma dyżur; dłużej zamieniłoby
 * plan w listę życzeń bez terminów.
 */
export const GRACE_DAYS = 3;

export const dayKey = (d: Date | string | number): string =>
  new Date(d).toISOString().slice(0, 10);

const parse = (key: string): number => Date.parse(`${key}T00:00:00Z`);

export const addDays = (key: string, n: number): string => dayKey(parse(key) + n * MS_DAY);

export const daysBetween = (a: string, b: string): number =>
  Math.round((parse(b) - parse(a)) / MS_DAY);

/** Poniedziałek tygodnia, w którym leży podana data. 1 = poniedziałek, 7 = niedziela. */
export const weekdayOf = (key: string): number => {
  const d = new Date(parse(key)).getUTCDay();
  return d === 0 ? 7 : d;
};

export const mondayOf = (key: string): string => addDays(key, 1 - weekdayOf(key));

/** Dni tygodnia planu: wybór użytkownika bije szablon. */
export const planWeekdays = (t: PlanTemplate, p: ActivePlan): number[] =>
  p.weekdays?.length ? [...new Set(p.weekdays)].sort((a, b) => a - b) : t.weekdays;

/** Plany zapisane przed wprowadzeniem polityki zachowują się jak `shift`. */
export const planPolicy = (p: ActivePlan): PlanPolicy => p.policy ?? 'shift';

/** Rozpisany plan razem z sesjami, które nie trafiły w żaden termin. */
export interface Schedule {
  days: PlannedDay[];
  /** Dni z treningiem poza planem — nadprogramowe, nie zaległe. */
  extras: string[];
}

/**
 * Rozpisanie planu na konkretne daty i przypisanie do nich realnych treningów.
 *
 * Dwie rzeczy dzieją się tu naraz i obie zależą od tego, co się faktycznie odbyło:
 *
 * 1. Przypisanie sesji do terminu. Trening z danego dnia domyka najpierw termin z tą samą
 *    datą, potem najstarszy zaległy w oknie łaski (to jest nadrobienie), a na końcu termin
 *    jutrzejszy (ktoś zrobił swoje dzień wcześniej). Jeśli nic nie pasuje — sesja dodatkowa.
 *
 * 2. Który trening wypada na dany termin. Przy polityce `shift` wskaźnik rotacji przesuwa się
 *    wyłącznie po terminie zrealizowanym albo jeszcze otwartym. Opuszczony poniedziałek nie
 *    zjada treningu A: dostanie go środa. Bez tego rotacja gubiłaby wzorce ruchowe dokładnie
 *    u tych osób, które i tak trenują nieregularnie.
 */
export function buildSchedule(
  template: PlanTemplate,
  plan: ActivePlan,
  logged: string[],
  today: string = dayKey(Date.now()),
): Schedule {
  const weekdays = planWeekdays(template, plan);
  const monday = mondayOf(plan.start);
  const days: PlannedDay[] = [];

  for (let w = 0; w < template.weeks; w++) {
    for (const wd of weekdays) {
      const date = addDays(monday, w * 7 + (wd - 1));
      // Tydzień startowy bywa napoczęty — dni sprzed startu nie są zaległościami.
      if (date < plan.start) continue;
      days.push({
        index: 0,
        date,
        weekday: wd,
        week: w + 1,
        workout: '',
        gap: 0,
        status: 'future',
        filled: null,
        late: 0,
        source: null,
      });
    }
  }

  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  days.forEach((d, i) => {
    d.index = i;
    d.gap = i ? daysBetween(days[i - 1]!.date, d.date) - 1 : 0;
  });

  // Ręczne odhaczenia wchodzą przed historią, żeby nie zabrały terminu realnej sesji.
  Object.keys(plan.ticked ?? {}).forEach((k) => {
    const d = days[Number(k)];
    if (d) {
      d.filled = d.date;
      d.source = 'tick';
    }
  });

  const extras: string[] = [];
  const free = (test: (d: PlannedDay) => boolean): PlannedDay | undefined =>
    days.find((d) => d.filled === null && test(d));

  [...new Set(logged)].sort().forEach((day) => {
    const slot =
      free((d) => d.date === day) ??
      free((d) => d.date < day && daysBetween(d.date, day) <= GRACE_DAYS) ??
      free((d) => daysBetween(day, d.date) === 1);
    if (!slot) {
      extras.push(day);
      return;
    }
    slot.filled = day;
    slot.source = 'log';
    slot.late = Math.max(0, daysBetween(slot.date, day));
  });

  const shift = planPolicy(plan) === 'shift';
  const cycle = template.cycle;
  let ptr = 0;

  days.forEach((d, i) => {
    d.workout = cycle[(shift ? ptr : i) % cycle.length]!;

    const late = daysBetween(d.date, today);
    d.status =
      d.filled !== null
        ? 'done'
        : d.date === today
          ? 'today'
          : d.date > today
            ? 'future'
            : late <= GRACE_DAYS
              ? 'open'
              : 'missed';

    // Wskaźnik stoi tylko na terminach ostatecznie przepadłych. Termin dzisiejszy i przyszły
    // idą dalej, bo rozpisanie na przód zakłada, że zostaną zrobione.
    if (d.status !== 'missed') ptr++;
  });

  return { days, extras };
}

/** Dni, w które cokolwiek zalogowano — stąd bierze się domknięcie terminu. */
export const logDays = (state: AppState): string[] =>
  [...new Set(state.log.map((e) => dayKey(e.date)))].sort();

export interface PlanStats {
  total: number;
  done: number;
  /** Terminy zrealizowane co do dnia. */
  onTime: number;
  /** Terminy nadrobione po czasie. */
  late: number;
  /** Terminy po czasie, ale wciąż w oknie łaski. */
  open: number;
  missed: number;
  /** Sesje poza planem. */
  extra: number;
  /** Terminy rozstrzygnięte: zrobione i opuszczone razem. */
  elapsed: number;
  /** Udział zrobionych w rozstrzygniętych. Terminy jeszcze do nadrobienia się nie liczą. */
  adherence: number | null;
  week: number;
  /** Najdłuższa zaplanowana przerwa między treningami. */
  maxGap: number;
  /** Kolejny termin do zrobienia: dzisiejszy albo przyszły. */
  next: PlannedDay | null;
  /** Co robić teraz: dzisiejszy termin, a jak go nie ma — najstarszy zaległy do nadrobienia. */
  due: PlannedDay | null;
  /** Terminy z rzędu zrobione co do dnia. */
  streak: number;
  /** Najdłuższa taka seria w tym planie. */
  bestStreak: number;
  /** Terminy z rzędu nieopuszczone — nadrobienie serii nie zrywa. */
  alive: number;
}

export function planStats(
  schedule: Schedule,
  today: string = dayKey(Date.now()),
): PlanStats {
  const { days, extras } = schedule;
  const count = (s: PlannedDay['status']): number => days.filter((d) => d.status === s).length;

  const done = count('done');
  const missed = count('missed');
  const onTime = days.filter((d) => d.status === 'done' && d.late === 0).length;

  let streak = 0;
  let bestStreak = 0;
  let alive = 0;
  days.forEach((d) => {
    if (d.status === 'done') {
      alive++;
      if (d.late === 0) {
        streak++;
        bestStreak = Math.max(bestStreak, streak);
      } else streak = 0;
    } else if (d.status === 'missed') {
      streak = 0;
      alive = 0;
    }
  });

  const elapsed = done + missed;

  return {
    total: days.length,
    done,
    onTime,
    late: done - onTime,
    open: count('open'),
    missed,
    extra: extras.length,
    elapsed,
    adherence: elapsed ? Math.round((done / elapsed) * 100) : null,
    week: days.find((d) => d.date >= today)?.week ?? days[days.length - 1]?.week ?? 1,
    maxGap: days.reduce((m, d) => Math.max(m, d.gap), 0),
    next: days.find((d) => d.status === 'today' || d.status === 'future') ?? null,
    due: days.find((d) => d.status === 'today') ?? days.find((d) => d.status === 'open') ?? null,
    streak,
    bestStreak,
    alive,
  };
}
