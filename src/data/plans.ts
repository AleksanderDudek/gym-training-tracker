import type { AppState, PlanLevel, PlanTemplate, Sex, WorkoutGear } from '../types';

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
  1: [3],
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

/** Mnożnik ciężarów startowych dla poziomu i płci — przy starcie każdego planu, także własnego. */
export const loadFactorFor = (level: PlanLevel, sex: Sex): number => LOAD[level][sex];

/** Dni tygodnia z równymi przerwami dla danej liczby treningów. */
export const weekdaysFor = (n: number): number[] => WEEKDAYS[Math.min(7, Math.max(1, n))] ?? [1];

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

/* ---------------- Plany z celem ---------------- */

/**
 * Czego się spodziewać — uczciwie. Liczby z badań nad osobami zaczynającymi (Seynnes i in.
 * 2007, DeFreitas i in. 2011, Kubo i in. 2019): pierwsze tygodnie to głównie nauka ruchu
 * i siła, masa rośnie od kilku tygodni, a widać ją zwykle dopiero po dwóch–trzech miesiącach.
 * U kogoś, kto trenuje od lat, te same liczby będą wyraźnie mniejsze.
 */
export const EXPECT: Record<30 | 60 | 90, string> = {
  30: 'Po 30 dniach: wyraźnie więcej siły i pewniejsza technika — to w dużej mierze nauka ruchu. Mięśnie rosną już po 3–4 tygodniach o kilka procent, ale w lustrze to zwykle jeszcze niewidoczne.',
  60: 'Po 60 dniach: u zaczynających przekrój mięśni rośnie zwykle o 5–10%, a siła w głównych ćwiczeniach wyraźnie idzie w górę. Tu pierwszy raz widać różnicę w ubraniu.',
  90: 'Po 90 dniach: u zaczynających +5–10% masy trenowanych partii i często +20–30% siły w głównych ćwiczeniach. U kogoś, kto trenuje od lat, te liczby będą mniejsze — to normalne.',
};

/** Dni tygodnia pod plan z celem — te same, co w katalogu klasycznym. */
const DAYS_OF: Record<number, number[]> = WEEKDAYS;

const goal = (
  id: string,
  name: string,
  days: 30 | 60 | 90,
  gear: WorkoutGear,
  level: PlanLevel,
  perWeek: number,
  cycle: string[],
  goalText: string,
  desc: string,
): PlanTemplate => {
  const weeks = days === 30 ? 4 : days === 60 ? 9 : 13;
  // Tydzień lżejszy co sześć tygodni, ale nigdy ostatni — po nim i tak jest przerwa.
  const deload = Array.from({ length: Math.floor(weeks / 6) }, (_, i) => (i + 1) * 6).filter((w) => w < weeks);
  return {
    id,
    name,
    kind: 'goal',
    level,
    sex: 'any',
    daysPerWeek: perWeek,
    weeks,
    loadFactor: LOAD[level].any,
    cycle,
    weekdays: DAYS_OF[perWeek]!,
    desc,
    goal: goalText,
    expect: EXPECT[days],
    gear,
    days,
    deload,
  };
};

/**
 * Plany z konkretnym celem. Każdy daje głównym partiom 10–20 serii tygodniowo (zakres
 * z badań), rozkłada je na co najmniej dwa dni i nie trenuje tej samej partii ciężko dwa
 * dni z rzędu — pilnuje tego test doradcy. Plany 60- i 90-dniowe mają tydzień lżejszy.
 */
export const GOAL_PLANS: PlanTemplate[] = [
  goal(
    'cel-start-30',
    'Start od zera — 30 dni',
    30,
    'kb',
    'zero',
    3,
    ['A', 'B'],
    'Nauczyć się podstawowych ruchów z kettlebell i wyrobić rytm trzech treningów w tygodniu.',
    'Trzy treningi całego ciała na zmianę A i B: poniedziałek, środa, piątek. Klasyczny początek według ACSM — każda partia dwa–trzy razy w tygodniu, zawsze z dniem przerwy.',
  ),
  goal(
    'cel-core-30',
    'Brzuch i core — 30 dni',
    30,
    'kb',
    'zero',
    3,
    ['A', 'core-kb', 'B'],
    'Mocniejszy brzuch i stabilny tułów — pod deskę, noszenie i każdy ciężki ruch.',
    'Dwa treningi całego ciała i jeden dzień brzucha pomiędzy nimi. Brzuch pracuje w każdym z nich, najmocniej w środę.',
  ),
  goal(
    'cel-posladki-dom-60',
    'Pośladki w domu — 60 dni',
    60,
    'kb',
    'base',
    3,
    ['glutes-kb', 'upper-kb', 'lower-kb'],
    'Silniejsze i pełniejsze pośladki bez siłowni — kettlebell i mata.',
    'Pośladki dwa razy w tygodniu, z dniem góry pomiędzy. Szósty tydzień lżejszy.',
  ),
  goal(
    'cel-gora-dol-kb-60',
    'Góra i dół z kettlebell — 60 dni',
    60,
    'kb',
    'base',
    4,
    ['upper-kb', 'lower-kb', 'upper-kb', 'legs-kb'],
    'Cała sylwetka z jednym kettlebell i drążkiem, cztery razy w tygodniu.',
    'Góra, dół, dzień wolny, góra, nogi. Każda partia dwa razy w tygodniu, szósty tydzień lżejszy.',
  ),
  goal(
    'cel-ppl-60',
    'Push, pull, nogi — 60 dni',
    60,
    'gym',
    'strong',
    6,
    ['push-gym', 'pull-gym', 'legs-gym'],
    'Masa mięśniowa w klasycznym podziale — dla kogoś, kto ma za sobą pierwszy rok.',
    'Sześć dni w tygodniu, każda partia dwa razy. Wymaga czasu i snu; przy gorszej regeneracji wybierz góra/dół.',
  ),
  goal(
    'cel-gora-dol-60',
    'Góra i dół — 60 dni',
    60,
    'gym',
    'base',
    4,
    ['upper-gym', 'lower-gym', 'upper-gym', 'legs-gym'],
    'Siła i masa całego ciała na siłowni, cztery razy w tygodniu.',
    'Najpopularniejszy podział dla średniozaawansowanych: każda partia dwa razy w tygodniu, weekend wolny.',
  ),
  goal(
    'cel-klatka-60',
    'Mocna klatka — 60 dni',
    60,
    'gym',
    'base',
    4,
    ['chest-gym', 'lower-gym', 'upper-gym', 'legs-gym'],
    'Większa i silniejsza klatka piersiowa, bez zaniedbania reszty.',
    'Dzień klatki i dzień góry w tygodniu — klatka dwa razy, plecy dla równowagi barków też.',
  ),
  goal(
    'cel-plecy-60',
    'Plecy i postawa — 60 dni',
    60,
    'gym',
    'base',
    3,
    ['back-gym', 'legs-gym', 'upper-gym'],
    'Szersze, grubsze plecy i barki, które nie uciekają do przodu.',
    'Więcej ciągnięcia niż pchania — dzień pleców i dzień góry, a nogi pomiędzy. Klatka dostaje tylko serie na podtrzymanie, doradca to zaznaczy — tu to świadomy wybór.',
  ),
  goal(
    'cel-sila-90',
    'Siła całego ciała — 90 dni',
    90,
    'gym',
    'zero',
    3,
    ['full-gym', 'full-gym-b'],
    'Solidne podstawy siły: przysiad, martwy ciąg, wyciskania i podciąganie.',
    'Trzy treningi całego ciała na zmianę A i B — układ, który ACSM zaleca na początek. Tygodnie lżejsze: szósty i dwunasty.',
  ),
  goal(
    'cel-posladki-90',
    'Pośladki — 90 dni',
    90,
    'gym',
    'base',
    3,
    ['glutes-gym', 'upper-gym', 'lower-gym'],
    'Wyraźnie mocniejsze i pełniejsze pośladki — hip thrust, przysiady i martwy ciąg.',
    'Pośladki dwa razy w tygodniu, prawie 20 serii — górna granica tego, co się jeszcze opłaca. Klatka tylko na podtrzymanie. Tygodnie lżejsze: szósty i dwunasty.',
  ),

  /*
   * ---------------- Bez sprzętu ----------------
   *
   * Podłoga, ściana, krzesło i solidny stół. Progresja idzie powtórzeniami i etapami trudności
   * (pompki, przysiad jednonóż, core), a nie ciężarem. Uczciwie: bez drążka biceps pracuje tylko
   * pomocniczo przy wiosłowaniu pod stołem, więc doradca zaznaczy go jako słabo obciążony.
   */
  goal(
    'cel-bez-start-30',
    'Bez sprzętu — start, 30 dni',
    30,
    'none',
    'zero',
    3,
    ['full-none', 'full-none-b'],
    'Ruszyć z miejsca bez siłowni i bez zakupów: przysiad, pompki, wiosłowanie pod stołem i core.',
    'Trzy treningi całego ciała na zmianę A i B, po 25 minut — poniedziałek, środa, piątek. Każda partia dwa–trzy razy w tygodniu, zawsze z dniem przerwy.',
  ),
  goal(
    'cel-bez-brzuch-30',
    'Brzuch bez sprzętu — 30 dni',
    30,
    'none',
    'zero',
    3,
    ['full-none-c', 'core-none', 'full-none'],
    'Mocniejszy brzuch i stabilny tułów na samej macie.',
    'Dwa treningi całego ciała i kwadrans brzucha pomiędzy nimi. Tył uda i biceps dostają tu mało — to plan pod tułów.',
  ),
  goal(
    'cel-bez-cialo-60',
    'Całe ciało bez sprzętu — 60 dni',
    60,
    'none',
    'zero',
    3,
    ['full-none', 'full-none-b', 'full-none-c'],
    'Siła i kondycja całego ciała w domu, trzy razy w tygodniu po pół godziny.',
    'Trzy różne treningi całego ciała — A, B i C — każdy raz w tygodniu, z dniem przerwy między nimi. Szósty tydzień lżejszy.',
  ),
  goal(
    'cel-bez-posladki-60',
    'Pośladki bez sprzętu — 60 dni',
    60,
    'none',
    'base',
    3,
    ['glutes-none', 'upper-none', 'full-none-b'],
    'Silniejsze i pełniejsze pośladki na macie i z krzesłem.',
    'Pośladki dwa razy w tygodniu — w dniu pośladków i w treningu całego ciała — a góra pomiędzy. Biceps tylko pomocniczo. Szósty tydzień lżejszy.',
  ),
  goal(
    'cel-bez-gora-dol-60',
    'Góra i dół bez sprzętu — 60 dni',
    60,
    'none',
    'base',
    4,
    ['upper-none', 'lower-none', 'upper-none', 'legs-none'],
    'Więcej objętości niż całe ciało: cztery dni w tygodniu, każda partia dwa razy.',
    'Góra, dół, dzień wolny, góra, nogi. Biceps pracuje tylko pomocniczo przy wiosłowaniu — bez drążka inaczej się nie da. Szósty tydzień lżejszy.',
  ),
  goal(
    'cel-bez-sila-90',
    'Siła z masą ciała — 90 dni',
    90,
    'none',
    'base',
    4,
    ['upper-none', 'lower-none', 'upper-none', 'legs-none'],
    'Pompki w staniu na rękach przy ścianie i przysiad jednonóż — siła, którą widać bez ciężarów.',
    'Ten sam układ góra/dół na trzy miesiące: dość czasu, żeby przejść kolejne etapy pompek i przysiadu jednonóż. Biceps tylko pomocniczo. Tygodnie lżejsze: szósty i dwunasty.',
  ),
];

/** Plan klasyczny albo z celem — bez planów własnych, które mieszkają w zapisie. */
export const planById = (id: string): PlanTemplate | undefined =>
  PLANS.find((p) => p.id === id) ?? GOAL_PLANS.find((p) => p.id === id);

/** Dowolny plan, także własny. */
export const planOf = (state: AppState, id: string): PlanTemplate | undefined =>
  planById(id) ?? state.plans?.find((p) => p.id === id);
