import { ALL, EX } from '../data/exercises';
import { ANIM } from '../data/anim';
import type { MoveName } from '../data/moves';
import type { ExerciseId } from '../types';
import type { AchCtx, AchDef } from './badges';
import { periodValue } from './volume';
import type { Period } from './volume';

/**
 * Odznaki pojedynczego ćwiczenia: rekord dnia, tygodnia i miesiąca kalendarzowego oraz suma
 * z całej historii. Liczą treningi i przekąski razem — to jedyne odznaki, do których
 * przekąska dokłada się na równi z treningiem.
 *
 * Progi nie są wpisane ręcznie dla stu pięciu ćwiczeń, tylko liczone z typowej objętości
 * jednej sesji (serie × cel z biblioteki). Dzięki temu dwadzieścia podciągnięć i dwadzieścia
 * wspięć na palce nie stoją na tym samym progu, a nowe ćwiczenie w bibliotece dostaje
 * odznaki samo. Liczby zaokrąglane są do okrągłych — „próg 168” wygląda na błąd, „150” nie.
 */

export type ExKind = Period | 'lacznie';

export const EX_KINDS: ExKind[] = ['dzien', 'tydzien', 'miesiac', 'lacznie'];

/**
 * Mnożniki objętości jednej sesji. Pierwszy próg dnia to jedna pełna sesja albo kilka
 * przekąsek, pierwszy próg tygodnia — dwie sesje, miesiąca — sześć. Ostatnie są odległe
 * celowo: sześćdziesiąt sesji w miesiąc da się zrobić tylko przekąskami rozłożonymi
 * przez cały dzień, i o to w nich chodzi.
 */
export const EX_MULT: Record<ExKind, number[]> = {
  dzien: [1, 2, 3, 5, 8],
  tydzien: [2, 4, 7, 12, 20],
  miesiac: [6, 12, 20, 35, 60],
  lacznie: [5, 25, 75, 200, 500, 1200],
};

export const KIND_TITLE: Record<ExKind, string> = {
  dzien: 'rekord dnia',
  tydzien: 'rekord tygodnia',
  miesiac: 'rekord miesiąca',
  lacznie: 'łącznie',
};

/** Jak nazywa się okres, w którym właśnie jesteśmy — do „dziś 30 z 50”. */
export const KIND_NOW: Record<Period, string> = {
  dzien: 'dziś',
  tydzien: 'w tym tygodniu',
  miesiac: 'w tym miesiącu',
};

const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];

/** Najbliższa okrągła liczba w skali logarytmicznej: 168 → 150, 288 → 300, 1440 → 1500. */
export function nice(x: number): number {
  if (x < 10) return Math.max(1, Math.round(x));
  const base = 10 ** Math.floor(Math.log10(x));
  let best = base;
  STEPS.forEach((s) => {
    const v = s * base;
    if (Math.abs(Math.log(v / x)) < Math.abs(Math.log(best / x))) best = v;
  });
  return Math.round(best);
}

/** Najmniejsza okrągła liczba większa od podanej. */
function above(x: number): number {
  if (x < 10) return Math.floor(x) + 1;
  const base = 10 ** Math.floor(Math.log10(x));
  const next = [...STEPS.map((s) => s * base), ...STEPS.map((s) => s * base * 10)].find((v) => v > x);
  return Math.round(next ?? x * 2);
}

/**
 * Objętość typowej sesji z biblioteki. Ćwiczenie na czas daje sekundy, reszta powtórzenia —
 * przy ruchu na stronę na stronę, bo tak wpisuje się je w formularz.
 */
export const sessionVolume = (id: ExerciseId): number => {
  const d = EX[id]?.def;
  return d ? Math.max(1, d.sets * d.target) : 1;
};

/**
 * Drabina progów. Przy sekundach powyżej dwóch minut zaokrągla się minuty, a nie sekundy —
 * „próg 450 s” czyta się gorzej niż „8 min”, więc od razu są pełne minuty.
 */
export function exerciseTiers(id: ExerciseId, kind: ExKind): number[] {
  const secs = EX[id]?.unit === 'secs';
  const round = (x: number): number => (secs && x >= 120 ? nice(x / 60) * 60 : nice(x));
  const bump = (x: number): number => (secs && x >= 120 ? above(x / 60) * 60 : above(x));
  const base = sessionVolume(id);
  const out: number[] = [];
  EX_MULT[kind].forEach((m) => {
    let v = round(base * m);
    const prev = out[out.length - 1];
    if (prev !== undefined && v <= prev) v = bump(prev);
    out.push(v);
  });
  return out;
}

/** Sekundy jako czas: krótkie gołą liczbą, dłuższe w minutach. */
export const clock = (n: number): string => {
  const s = Math.round(n);
  if (s < 120) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
};

/**
 * Figurka na medalu sumy: ta sama sylwetka, co w atlasie, jeśli ruch ma swoją pozę;
 * inaczej figurka partii. Medale okresów niosą napis — 24H, 7D, 30D — tak samo jak
 * rekordy z okna w „Szczytach”, więc rodzaj odznaki widać z daleka.
 */
const MOVE_ART: Partial<Record<MoveName, string>> = {
  swing: 'fig-swing',
  hinge: 'fig-hinge',
  squat: 'fig-squat',
  lunge: 'fig-carry',
  pressOverhead: 'fig-press',
  plank: 'fig-plank',
  pullup: 'fig-pull',
  row: 'fig-row',
  pushup: 'fig-pushup',
  calf: 'fig-calf',
  dip: 'fig-dip',
  carry: 'fig-walk',
};

const GROUP_ART: Record<string, string> = {
  'Zawias biodrowy': 'fig-hinge',
  Przysiad: 'fig-squat',
  Ciągnięcie: 'fig-row',
  Pchanie: 'fig-pushup',
  'Całe ciało': 'fig-swing',
  'Core i carry': 'fig-plank',
  'Nogi — dodatkowe': 'fig-calf',
};

export const exerciseArt = (id: ExerciseId): string => {
  const move = ANIM[id];
  return (move && MOVE_ART[move]) || GROUP_ART[EX[id]?.group ?? ''] || 'fig-walk';
};

const MARK: Record<Period, string> = { dzien: '24H', tydzien: '7D', miesiac: '30D' };

/** Puenty, po kilka na rodzaj — ćwiczenie wybiera swoją po numerze w bibliotece. */
export const EX_QUIPS: Record<ExKind, readonly string[]> = {
  dzien: [
    'Jeden dzień, jeden ruch i licznik, który się nie nudzi.',
    'Doba, w której ten ruch był twoim hobby.',
    'Tyle razy jednego dnia. Krzesło poczuło się niepotrzebne.',
  ],
  tydzien: [
    'Tydzień z tym ruchem w roli głównej.',
    'Siedem dni i jeden ulubiony ruch.',
    'Tydzień, w którym to ćwiczenie miało lepszą frekwencję niż poniedziałkowe zebrania.',
  ],
  miesiac: [
    'Miesiąc, w którym to ćwiczenie weszło w nawyk.',
    'Trzydzieści dni i ruch, który przestał być wydarzeniem.',
    'Miesiąc objętości bez fanfar. Fanfary są tutaj.',
  ],
  lacznie: [
    'Suma, której nikt nie liczył. Poza tobą i tą aplikacją.',
    'Każde powtórzenie z osobna nic nie znaczy. Razem — to.',
    'Dorobek jednego ruchu. Stawy pamiętają każde.',
  ],
};

/** Rodzina odznak jednego ćwiczenia. */
export interface ExFamily extends AchDef {
  ex: ExerciseId;
  kind: ExKind;
}

export const exFamilyId = (id: ExerciseId, kind: ExKind): string => `ex:${id}:${kind}`;

function family(id: ExerciseId, kind: ExKind, index: number): ExFamily {
  const m = EX[id]!;
  const secs = m.unit === 'secs';
  const unit = secs ? 'sekund' : m.side ? 'powtórzeń na stronę' : 'powtórzeń';
  const both = 'treningi i przekąski razem';
  const desc: Record<ExKind, string> = {
    dzien: `Najwięcej ${unit} w jednym dniu — ${both}.`,
    tydzien: `Najwięcej ${unit} w jednym tygodniu, od poniedziałku do niedzieli — ${both}.`,
    miesiac: `Najwięcej ${unit} w jednym miesiącu kalendarzowym — ${both}.`,
    lacznie: `Wszystkie ${unit} z historii — ${both}.`,
  };
  const quips = EX_QUIPS[kind];

  return {
    id: exFamilyId(id, kind),
    group: 'cwiczenia',
    ex: id,
    kind,
    name: `${m.name} — ${KIND_TITLE[kind]}`,
    desc: desc[kind],
    mark: kind === 'lacznie' ? '' : MARK[kind],
    ...(kind === 'lacznie' ? { art: exerciseArt(id) } : {}),
    quip: quips[index % quips.length]!,
    tiers: exerciseTiers(id, kind),
    ...(secs ? { fmt: clock } : { unit: m.side ? 'powtórzeń na stronę' : 'powtórzeń' }),
    value: (c: AchCtx) => {
      const v = c.metrics.perEx[id];
      if (!v) return 0;
      return kind === 'lacznie' ? v.total : v.best[kind];
    },
    ...(kind === 'lacznie'
      ? {}
      : { current: (c: AchCtx) => periodValue(c.metrics.perEx[id], kind, c.today) }),
  };
}

/** Cztery rodziny na każde ćwiczenie biblioteki. */
export const EX_DEFS: ExFamily[] = ALL.flatMap((id, i) => EX_KINDS.map((k) => family(id, k, i)));

const BY_EX = new Map<ExerciseId, ExFamily[]>();
EX_DEFS.forEach((f) => {
  const list = BY_EX.get(f.ex) ?? [];
  list.push(f);
  BY_EX.set(f.ex, list);
});

export const exFamiliesOf = (id: ExerciseId): ExFamily[] => BY_EX.get(id) ?? [];
