import type { Achievement, AchievementHit, AppState } from '../types';
import type { PlanStats, Schedule } from './schedule';
import { metrics } from './metrics';
import type { Metrics } from './metrics';
import { countCleanWeeks } from './score';

/**
 * Odznaki opisują zachowanie i dorobek, nie wynik siłowy: przy dowolnym ciężarze da się zdobyć
 * każdą z nich, bo jedyne, na co człowiek ma realny wpływ każdego dnia, to czy się pojawi.
 *
 * Każda rodzina ma kilka progów. Jeden próg to koniec i cisza; pięć progów to zawsze widoczny
 * następny krok — a przy okazji pasek postępu, który mówi, ile jeszcze brakuje.
 */

export interface AchCtx {
  state: AppState;
  metrics: Metrics;
  schedule: Schedule | null;
  stats: PlanStats | null;
  today: string;
}

/** Odznaka razem ze sposobem liczenia jej wartości. */
interface AchDef extends Achievement {
  value: (c: AchCtx) => number;
  /** Formatowanie wartości i progu, gdy goła liczba niewiele mówi. */
  fmt?: (n: number) => string;
}

const kg = (n: number): string => (n >= 1000 ? `${Math.round(n / 100) / 10} t` : `${n} kg`);
const mins = (n: number): string => (n >= 120 ? `${Math.round(n / 60)} min` : `${n} s`);
const yes = (b: boolean): number => (b ? 1 : 0);

const DEFS: AchDef[] = [
  /* ---------------- Dorobek: sumy z całej historii ---------------- */
  {
    id: 'treningi',
    group: 'dorobek',
    mark: '⛭',
    name: 'Zapisane treningi',
    desc: 'Suma zamkniętych sesji. Pierwsza jest najtrudniejsza.',
    unit: 'treningów',
    tiers: [1, 10, 25, 50, 100, 250],
    value: (c) => c.metrics.workouts,
  },
  {
    id: 'powtorzenia',
    group: 'dorobek',
    mark: '∑',
    name: 'Powtórzenia',
    desc: 'Suma powtórzeń z całej historii. Ćwiczenia na stronę liczą się dwa razy.',
    unit: 'powtórzeń',
    tiers: [500, 2_000, 10_000, 25_000, 50_000, 100_000],
    value: (c) => c.metrics.reps,
  },
  {
    id: 'serie',
    group: 'dorobek',
    mark: '≡',
    name: 'Serie',
    desc: 'Każda seria z wpisanym wynikiem to jedna sztuka.',
    unit: 'serii',
    tiers: [100, 500, 1_500, 4_000, 10_000],
    value: (c) => c.metrics.sets,
  },
  {
    id: 'cwiczenia',
    group: 'dorobek',
    mark: '◆',
    name: 'Wykonane ćwiczenia',
    desc: 'Jedno ćwiczenie w jednej sesji to jedna sztuka.',
    unit: 'sztuk',
    tiers: [50, 250, 1_000, 3_000, 8_000],
    value: (c) => c.metrics.exercises,
  },
  {
    id: 'tonaz',
    group: 'dorobek',
    mark: '▬',
    name: 'Tonaż',
    desc: 'Ciężar razy powtórzenia, zsumowany przez całą historię.',
    tiers: [10_000, 50_000, 200_000, 500_000, 1_000_000],
    value: (c) => c.metrics.tonnage,
    fmt: kg,
  },
  {
    id: 'czas',
    group: 'dorobek',
    mark: '◷',
    name: 'Czas pod obciążeniem',
    desc: 'Sekundy z ćwiczeń liczonych na czas: spacery farmera i deska.',
    tiers: [600, 3_000, 10_000, 30_000],
    value: (c) => c.metrics.secs,
    fmt: mins,
  },
  {
    id: 'atlas',
    group: 'dorobek',
    mark: '⌘',
    name: 'Poznany atlas',
    desc: 'Ile różnych ćwiczeń w ogóle się pojawiło w historii.',
    unit: 'ćwiczeń',
    tiers: [5, 10, 15, 19],
    value: (c) => c.metrics.distinct,
  },

  /* ---------------- Szczyty: rekord z okna czasu ---------------- */
  {
    id: 'dzien-powtorzenia',
    group: 'szczyty',
    mark: '24',
    name: 'Najlepszy dzień',
    desc: 'Najwięcej powtórzeń w jednej dobie.',
    unit: 'powtórzeń',
    tiers: [100, 200, 350, 500],
    value: (c) => c.metrics.best.dayReps,
  },
  {
    id: 'dzien-serie',
    group: 'szczyty',
    mark: '≣',
    name: 'Najdłuższa sesja',
    desc: 'Najwięcej serii w jednej dobie.',
    unit: 'serii',
    tiers: [10, 20, 30, 45],
    value: (c) => c.metrics.best.daySets,
  },
  {
    id: 'tydzien-powtorzenia',
    group: 'szczyty',
    mark: '7',
    name: 'Najlepszy tydzień',
    desc: 'Najwięcej powtórzeń w dowolnych siedmiu dniach z rzędu.',
    unit: 'powtórzeń',
    tiers: [300, 600, 1_000, 1_800],
    value: (c) => c.metrics.best.weekReps,
  },
  {
    id: 'tydzien-treningi',
    group: 'szczyty',
    mark: '7×',
    name: 'Gęsty tydzień',
    desc: 'Najwięcej treningów w dowolnych siedmiu dniach.',
    unit: 'treningów',
    tiers: [2, 3, 4, 5, 6],
    value: (c) => c.metrics.best.weekWorkouts,
  },
  {
    id: 'dwa-tygodnie',
    group: 'szczyty',
    mark: '14',
    name: 'Dwa tygodnie',
    desc: 'Najwięcej treningów w dowolnych czternastu dniach.',
    unit: 'treningów',
    tiers: [4, 6, 8, 10],
    value: (c) => c.metrics.best.twoWeekWorkouts,
  },
  {
    id: 'trzy-tygodnie',
    group: 'szczyty',
    mark: '21',
    name: 'Trzy tygodnie',
    desc: 'Najwięcej treningów w dowolnych dwudziestu jeden dniach.',
    unit: 'treningów',
    tiers: [6, 9, 12, 15],
    value: (c) => c.metrics.best.threeWeekWorkouts,
  },
  {
    id: 'miesiac-treningi',
    group: 'szczyty',
    mark: '30',
    name: 'Najlepszy miesiąc',
    desc: 'Najwięcej treningów w dowolnych trzydziestu dniach.',
    unit: 'treningów',
    tiers: [8, 12, 16, 20],
    value: (c) => c.metrics.best.monthWorkouts,
  },
  {
    id: 'miesiac-tonaz',
    group: 'szczyty',
    mark: '▮',
    name: 'Miesięczny tonaż',
    desc: 'Najcięższe trzydzieści dni z rzędu.',
    tiers: [5_000, 15_000, 40_000, 80_000],
    value: (c) => c.metrics.best.monthTonnage,
    fmt: kg,
  },
  {
    id: 'kwartal-treningi',
    group: 'szczyty',
    mark: '90',
    name: 'Najlepszy kwartał',
    desc: 'Najwięcej treningów w dowolnych dziewięćdziesięciu dniach.',
    unit: 'treningów',
    tiers: [20, 30, 40, 55],
    value: (c) => c.metrics.best.quarterWorkouts,
  },
  {
    id: 'kwartal-powtorzenia',
    group: 'szczyty',
    mark: 'Q',
    name: 'Kwartał objętości',
    desc: 'Najwięcej powtórzeń w dowolnych dziewięćdziesięciu dniach.',
    unit: 'powtórzeń',
    tiers: [2_000, 5_000, 10_000, 18_000],
    value: (c) => c.metrics.best.quarterReps,
  },

  /* ---------------- Utrzymanie: poziom, który się nie osypuje ---------------- */
  {
    id: 'rytm',
    group: 'utrzymanie',
    mark: '≈',
    name: 'Utrzymany rytm',
    desc: 'Tygodnie z rzędu, w każdym co najmniej dwa treningi. Jeden pusty tydzień zeruje ciąg.',
    unit: 'tygodni',
    tiers: [4, 8, 12, 26, 52],
    value: (c) => c.metrics.steadyWeeks,
  },
  {
    id: 'bez-cofniecia',
    group: 'utrzymanie',
    mark: '⊟',
    name: 'Bez cofnięcia',
    desc: 'Dni treningu bez ani jednego zejścia z ciężaru. Liczone do ostatniej sesji, nie do dzisiaj.',
    unit: 'dni',
    tiers: [30, 60, 120, 240],
    value: (c) => c.metrics.noDropDays,
  },
  {
    id: 'forma',
    group: 'utrzymanie',
    mark: '=',
    name: 'Trzymana forma',
    desc: 'Ćwiczenia stojące w granicach 5% własnego szczytu. Miara utrzymania, nie wzrostu.',
    unit: 'ćwiczeń',
    tiers: [3, 6, 10, 15],
    value: (c) => c.metrics.heldForm,
  },
  {
    id: 'powrot-do-formy',
    group: 'utrzymanie',
    mark: '⟲',
    name: 'Powrót do poziomu',
    desc: 'Po przerwie od czternastu dni ciężar wrócił w miesiąc tam, gdzie był przed nią.',
    unit: 'razy',
    tiers: [1, 3, 6],
    value: (c) => c.metrics.comebacks,
  },
  {
    id: 'zelazo',
    group: 'utrzymanie',
    mark: '▲',
    name: 'Żelazo',
    desc: 'Ćwiczenia, które przeszły na cięższy kettlebell i tam zostały.',
    unit: 'ćwiczeń',
    tiers: [1, 3, 6, 10],
    value: (c) => c.metrics.heavier,
  },
  {
    id: 'ranny-ptaszek',
    group: 'utrzymanie',
    mark: '☀',
    name: 'Ranny ptaszek',
    desc: 'Trening zamknięty przed ósmą rano.',
    tiers: [1],
    value: (c) => yes(c.metrics.early),
  },

  /* ---------------- Terminy: kalendarz planu ---------------- */
  {
    id: 'seria',
    group: 'terminy',
    mark: '→',
    name: 'Seria w terminie',
    desc: 'Terminy z rzędu zrobione co do dnia. Nadrobienie serii nie przedłuża.',
    unit: 'terminów',
    tiers: [3, 10, 25, 50],
    value: (c) => c.stats?.bestStreak ?? 0,
  },
  {
    id: 'bez-pudla',
    group: 'terminy',
    mark: '○',
    name: 'Bez pudła',
    desc: 'Terminy z rzędu nieopuszczone. Nadrobienie w oknie łaski się liczy.',
    unit: 'terminów',
    tiers: [5, 10, 20, 40],
    value: (c) => c.stats?.alive ?? 0,
  },
  {
    id: 'czysty-tydzien',
    group: 'terminy',
    mark: '7',
    name: 'Czysty tydzień',
    desc: 'Tygodnie planu domknięte w komplecie, bez ani jednego opuszczonego terminu.',
    unit: 'tygodni',
    tiers: [1, 4, 12],
    value: (c) => (c.schedule ? countCleanWeeks(c.schedule.days) : 0),
  },
  {
    id: 'nadrabiacz',
    group: 'terminy',
    mark: '↺',
    name: 'Nadrabiacz',
    desc: 'Zaległe terminy domknięte w ciągu dwóch dni.',
    unit: 'razy',
    tiers: [1, 5, 15],
    value: (c) =>
      c.schedule
        ? c.schedule.days.filter((d) => d.status === 'done' && d.late >= 1 && d.late <= 2).length
        : 0,
  },
  {
    id: 'punktualny',
    group: 'terminy',
    mark: '✓',
    name: 'Punktualny',
    desc: 'Realizacja co najmniej 90% przy minimum dwunastu rozstrzygniętych terminach.',
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.elapsed >= 12 && (c.stats.adherence ?? 0) >= 90),
  },
  {
    id: 'polowa',
    group: 'terminy',
    mark: '½',
    name: 'Półmetek',
    desc: 'Połowa terminów planu zrobiona.',
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.total > 0 && c.stats.done >= c.stats.total / 2),
  },
  {
    id: 'plan-zamkniety',
    group: 'terminy',
    mark: '★',
    name: 'Plan zamknięty',
    desc: 'Wszystkie terminy planu zrobione.',
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.total > 0 && c.stats.done === c.stats.total),
  },
];

export const ACHIEVEMENTS: Achievement[] = DEFS;

export const GROUP_LABEL: Record<Achievement['group'], string> = {
  dorobek: 'Dorobek',
  szczyty: 'Szczyty',
  utrzymanie: 'Utrzymanie',
  terminy: 'Terminy',
};

export const GROUP_NOTE: Record<Achievement['group'], string> = {
  dorobek: 'Sumy z całej historii. Rosną same, dopóki trenujesz.',
  szczyty: 'Rekordy z przesuwanego okna — dowolne siedem, trzydzieści czy dziewięćdziesiąt dni z rzędu.',
  utrzymanie: 'Nie o to, ile urosło, tylko o to, że nic się nie osypało.',
  terminy: 'Zależne od uruchomionego planu i jego kalendarza.',
};

export const GROUPS: Achievement['group'][] = ['dorobek', 'szczyty', 'utrzymanie', 'terminy'];

export const achievementById = (id: string): Achievement | undefined =>
  DEFS.find((d) => d.id === id);

/** Klucz w trwałym dorobku. Progi numerowane od jedynki. */
export const tierKey = (id: string, tier: number): string => `${id}:${tier}`;

/** Sformatowana wartość progu — tonaż w tonach, czas w minutach, reszta gołą liczbą. */
export function formatTier(a: Achievement, n: number): string {
  const def = DEFS.find((d) => d.id === a.id);
  if (def?.fmt) return def.fmt(n);
  return a.unit ? `${n.toLocaleString('pl-PL')} ${a.unit}` : n.toLocaleString('pl-PL');
}

export interface AchProgress {
  ach: Achievement;
  value: number;
  /** Ile progów zdobytych. */
  tier: number;
  /** Kolejny próg albo null, gdy rodzina wyczerpana. */
  next: number | null;
  /** Postęp do kolejnego progu, 0–1. Po ostatnim progu zawsze 1. */
  progress: number;
  /** Dzień zdobycia ostatniego progu. */
  at: string | null;
}

/** Stan wszystkich rodzin na dziś — do ekranu i do modala z nowościami. */
export function achievementProgress(ctx: AchCtx): AchProgress[] {
  return DEFS.map((d) => {
    const value = d.value(ctx);
    const tier = d.tiers.filter((t) => value >= t).length;
    const next = d.tiers[tier] ?? null;
    const from = tier > 0 ? d.tiers[tier - 1]! : 0;
    return {
      ach: d,
      value,
      tier,
      next,
      progress: next === null ? 1 : Math.min(1, Math.max(0, (value - from) / (next - from))),
      at: tier > 0 ? (ctx.state.award.badges[tierKey(d.id, tier)] ?? null) : null,
    };
  });
}

export const achCtx = (
  state: AppState,
  schedule: Schedule | null,
  stats: PlanStats | null,
  today: string,
): AchCtx => ({ state, metrics: metrics(state), schedule, stats, today });

/**
 * Dopisuje nowo zdobyte progi do trwałego dorobku i do dziennika. Raz zdobyty próg zostaje
 * na zawsze — także po zmianie planu, bo dotyczy tego, co ktoś zrobił, a nie tego, jaki
 * kalendarz ma akurat włączony.
 */
export function syncBadges(state: AppState, ctx: AchCtx): AchievementHit[] {
  const fresh: AchievementHit[] = [];

  DEFS.forEach((d) => {
    const value = d.value(ctx);
    d.tiers.forEach((threshold, i) => {
      const tier = i + 1;
      const key = tierKey(d.id, tier);
      if (state.award.badges[key] || value < threshold) return;
      state.award.badges[key] = ctx.today;
      fresh.push({ ach: d, tier, threshold });
      state.events.push({
        id: `badge:${key}`,
        date: ctx.today,
        kind: 'badge',
        title: `Odznaka: ${d.name}${d.tiers.length > 1 ? ` ${tier}` : ''}`,
        text: `${d.desc} Próg: ${formatTier(d, threshold)}.`,
      });
    });
  });

  return fresh;
}

/**
 * Przeniesienie odznak sprzed wprowadzenia progów. Klucze były wtedy gołymi nazwami,
 * a część odznak stała się progiem większej rodziny — kto je miał, ma je dalej.
 */
const LEGACY: Record<string, string> = {
  'pierwszy-krok': 'treningi:1',
  setka: 'treningi:5',
  'seria-3': 'seria:1',
  'seria-10': 'seria:2',
  'seria-25': 'seria:3',
  'czysty-tydzien': 'czysty-tydzien:1',
  nadrabiacz: 'nadrabiacz:1',
  punktualny: 'punktualny:1',
  powrot: 'powrot-do-formy:1',
  polowa: 'polowa:1',
  'plan-zamkniety': 'plan-zamkniety:1',
  'ranny-ptaszek': 'ranny-ptaszek:1',
  zelazo: 'zelazo:1',
};

export function migrateBadges(badges: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(badges).forEach(([k, at]) => {
    const key = LEGACY[k];
    if (key) {
      out[key] ??= at;
      return;
    }
    if (k.includes(':')) out[k] = at;
  });
  return out;
}
