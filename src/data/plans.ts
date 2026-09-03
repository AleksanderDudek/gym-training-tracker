import type { PlanLevel, PlanTemplate, Sex } from '../types';

export const PLAN_WEEKS = 12;

export const SEX_LABEL: Record<Sex, string> = {
  f: 'Kobieta',
  m: 'Mężczyzna',
  any: 'Bez wskazania',
};

export const LEVEL_LABEL: Record<PlanLevel, string> = {
  zero: 'Od zera',
  base: 'Podstawowy',
  strong: 'Zaawansowany',
};

export const LEVEL_DESC: Record<PlanLevel, string> = {
  zero: 'Nigdy nie ćwiczyłeś albo wracasz po długiej przerwie.',
  base: 'Ruszasz się regularnie, kettlebell nie jest nowością.',
  strong: 'Trenujesz od dawna i szukasz obciążenia, nie wprowadzenia.',
};

/**
 * Dni tygodnia dobrane pod maksymalny odstęp między treningami. Przy dwóch treningach
 * poniedziałek i czwartek dają 3 i 4 dni przerwy, a nie 1 i 6.
 */
const WEEKDAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

/**
 * Układ tygodnia: sesja n dostaje `cycle[n % cycle.length]`, a że długość cyklu równa się
 * liczbie treningów w tygodniu, wzorzec powtarza się co tydzień — poniedziałek zawsze znaczy
 * to samo. Grafik, który da się zapamiętać, łatwiej wytrzymać przez trzy miesiące, a każdy
 * wzorzec ruchowy i tak wraca co siedem dni.
 *
 * Im częściej ktoś trenuje, tym większy udział dnia lekkiego — przy pięciu i więcej sesjach
 * w tygodniu ogranicznikiem przestaje być motywacja, a zaczyna regeneracja.
 */
const CYCLES: Record<number, string[]> = {
  2: ['A', 'B'],
  3: ['A', 'B', 'C'],
  4: ['A', 'B', 'C', 'D'],
  5: ['A', 'B', 'D', 'C', 'D'],
  6: ['A', 'D', 'B', 'D', 'C', 'D'],
  7: ['A', 'D', 'B', 'D', 'C', 'D', 'D'],
};

/**
 * Mnożnik ciężarów startowych. To jedyne miejsce, w którym płeć w ogóle wchodzi do planu:
 * zasady progresji są identyczne, różni się wyłącznie przeciętny punkt startowy obciążenia.
 * Wariant „bez wskazania” bierze wartość pośrednią, a i tak wszystko weryfikuje seria próbna
 * przy pierwszym treningu — to liczby na start, nie diagnoza.
 */
const LOAD: Record<PlanLevel, Record<Sex, number>> = {
  zero: { f: 0.35, m: 0.5, any: 0.42 },
  base: { f: 0.6, m: 0.85, any: 0.72 },
  strong: { f: 0.9, m: 1.25, any: 1.05 },
};

const FREQ_NOTE: Record<number, string> = {
  2: 'Dwa treningi, 3–4 dni przerwy. Minimum, przy którym forma jeszcze rośnie.',
  3: 'Trzy treningi co drugi dzień. Najlepszy stosunek efektu do czasu.',
  4: 'Cztery treningi w dwóch blokach po dwa dni, z weekendem wolnym.',
  5: 'Pięć treningów, w tym jeden lekki. Dwa dni pełnej przerwy.',
  6: 'Sześć treningów, co drugi lekki. Niedziela wolna.',
  7: 'Codziennie, z czterema dniami lekkimi. Tylko przy dobrej regeneracji i bez bólu.',
};

export const planId = (level: PlanLevel, sex: Sex, days: number): string => `${level}-${sex}-${days}`;

function build(level: PlanLevel, sex: Sex, days: number): PlanTemplate {
  return {
    id: planId(level, sex, days),
    name: `${LEVEL_LABEL[level]} · ${days}× w tygodniu`,
    level,
    sex,
    daysPerWeek: days,
    weeks: PLAN_WEEKS,
    loadFactor: LOAD[level][sex],
    cycle: CYCLES[days]!,
    weekdays: WEEKDAYS[days]!,
    desc: FREQ_NOTE[days]!,
  };
}

export const LEVELS: PlanLevel[] = ['zero', 'base', 'strong'];
export const SEXES: Sex[] = ['f', 'm', 'any'];
export const FREQUENCIES: number[] = [2, 3, 4, 5, 6, 7];

/** Pełny katalog: każdy poziom × każda płeć × każda częstotliwość. */
export const PLANS: PlanTemplate[] = LEVELS.flatMap((level) =>
  SEXES.flatMap((sex) => FREQUENCIES.map((days) => build(level, sex, days))),
);

export const planById = (id: string): PlanTemplate | undefined => PLANS.find((p) => p.id === id);
