import type { AppState, PlanLevel, PlanTemplate, Sex, WorkoutGear } from '../types';
import { PROFILES, PROFILE_KEYS, gearsOf, profilePlanId, profileWorkoutId } from './profiles';
import { say } from '../i18n';

export const PLAN_WEEKS = 12;

export const SEX_LABEL: Record<Sex, string> = {
  f: say('Kobieta', 'Woman'),
  m: say('Mężczyzna', 'Man'),
  any: say('Bez wskazania', 'Prefer not to say'),
};

export const LEVEL_LABEL: Record<PlanLevel, string> = {
  zero: say('Od zera', 'From scratch'),
  base: say('Podstawowy', 'Basic'),
  strong: say('Zaawansowany', 'Advanced'),
};

export const LEVEL_DESC: Record<PlanLevel, string> = {
  zero: say('Nigdy nie ćwiczyłeś albo wracasz po długiej przerwie.', "You've never trained, or you're coming back after a long break."),
  base: say('Ruszasz się regularnie, kettlebell nie jest nowością.', "You move regularly and a kettlebell isn't new to you."),
  strong: say('Trenujesz od dawna i szukasz obciążenia, nie wprowadzenia.', "You've trained for a long time and want a challenge, not an introduction."),
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
  2: say('Dwa treningi, 3–4 dni przerwy. Minimum, przy którym forma jeszcze rośnie.', 'Two workouts, 3–4 days apart. The minimum at which you still improve.'),
  3: say('Trzy treningi co drugi dzień. Najlepszy stosunek efektu do czasu.', 'Three workouts, every other day. The best results for the time you put in.'),
  4: say('Cztery treningi w dwóch blokach po dwa dni, z weekendem wolnym.', 'Four workouts in two blocks of two days, with the weekend off.'),
  5: say('Pięć treningów, w tym jeden lekki. Dwa dni pełnej przerwy.', 'Five workouts, one of them light. Two full rest days.'),
  6: say('Sześć treningów, co drugi lekki. Niedziela wolna.', 'Six workouts, every other one light. Sunday off.'),
  7: say('Codziennie, z czterema dniami lekkimi. Tylko przy dobrej regeneracji i bez bólu.', 'Every day, with four light days. Only if you recover well and nothing hurts.'),
};

export const planId = (level: PlanLevel, sex: Sex, days: number): string => `${level}-${sex}-${days}`;

/** Mnożnik ciężarów startowych dla poziomu i płci — przy starcie każdego planu, także własnego. */
export const loadFactorFor = (level: PlanLevel, sex: Sex): number => LOAD[level][sex];

/** Dni tygodnia z równymi przerwami dla danej liczby treningów. */
export const weekdaysFor = (n: number): number[] => WEEKDAYS[Math.min(7, Math.max(1, n))] ?? [1];

function build(level: PlanLevel, sex: Sex, days: number): PlanTemplate {
  return {
    id: planId(level, sex, days),
    name: say(`${LEVEL_LABEL[level]} · ${days}× w tygodniu`, `${LEVEL_LABEL[level]} · ${days}× a week`),
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
  30: say('Po 30 dniach: wyraźnie więcej siły i pewniejsza technika — to w dużej mierze nauka ruchu. Mięśnie rosną już po 3–4 tygodniach o kilka procent, ale w lustrze to zwykle jeszcze niewidoczne.', "After 30 days: clearly more strength and surer technique, largely from learning the moves. Muscles grow by a few per cent within 3–4 weeks, but it usually doesn't show in the mirror yet."),
  60: say('Po 60 dniach: u zaczynających przekrój mięśni rośnie zwykle o 5–10%, a siła w głównych ćwiczeniach wyraźnie idzie w górę. Tu pierwszy raz widać różnicę w ubraniu.', 'After 60 days: beginners usually gain 5–10% in muscle size, and strength in the main lifts clearly goes up. This is when you first notice the difference in your clothes.'),
  90: say('Po 90 dniach: u zaczynających +5–10% masy trenowanych partii i często +20–30% siły w głównych ćwiczeniach. U kogoś, kto trenuje od lat, te liczby będą mniejsze — to normalne.', "After 90 days: beginners gain 5–10% muscle in the trained areas and often 20–30% strength in the main lifts. If you've trained for years, these numbers will be smaller, and that's normal."),
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
    say('Start od zera — 30 dni', 'Start from scratch — 30 days'),
    30,
    'kb',
    'zero',
    3,
    ['A', 'B'],
    say('Nauczyć się podstawowych ruchów z kettlebell i wyrobić rytm trzech treningów w tygodniu.', 'Learn the basic kettlebell moves and get into a rhythm of three workouts a week.'),
    say('Trzy treningi całego ciała na zmianę A i B: poniedziałek, środa, piątek. Klasyczny początek według ACSM — każda partia dwa–trzy razy w tygodniu, zawsze z dniem przerwy.', 'Three full-body workouts, alternating A and B: Monday, Wednesday, Friday. The classic ACSM start: every muscle group two or three times a week, always with a rest day in between.'),
  ),
  goal(
    'cel-core-30',
    say('Brzuch i core — 30 dni', 'Abs and core — 30 days'),
    30,
    'kb',
    'zero',
    3,
    ['A', 'core-kb', 'B'],
    say('Mocniejszy brzuch i stabilny tułów — pod deskę, noszenie i każdy ciężki ruch.', 'Stronger abs and a stable trunk for planks, carrying and every heavy lift.'),
    say('Dwa treningi całego ciała i jeden dzień brzucha pomiędzy nimi. Brzuch pracuje w każdym z nich, najmocniej w środę.', 'Two full-body workouts with an abs day in between. Your abs work in all of them, hardest on Wednesday.'),
  ),
  goal(
    'cel-posladki-dom-60',
    say('Pośladki w domu — 60 dni', 'Glutes at home — 60 days'),
    60,
    'kb',
    'base',
    3,
    ['glutes-kb', 'upper-kb', 'lower-kb'],
    say('Silniejsze i pełniejsze pośladki bez siłowni — kettlebell i mata.', 'Stronger, fuller glutes without a gym: a kettlebell and a mat.'),
    say('Pośladki dwa razy w tygodniu, z dniem góry pomiędzy. Szósty tydzień lżejszy.', 'Glutes twice a week, with an upper-body day in between. Week six is lighter.'),
  ),
  goal(
    'cel-gora-dol-kb-60',
    say('Góra i dół z kettlebell — 60 dni', 'Upper/lower with a kettlebell — 60 days'),
    60,
    'kb',
    'base',
    4,
    ['upper-kb', 'lower-kb', 'upper-kb', 'legs-kb'],
    say('Cała sylwetka z jednym kettlebell i drążkiem, cztery razy w tygodniu.', 'Your whole physique with one kettlebell and a pull-up bar, four times a week.'),
    say('Góra, dół, dzień wolny, góra, nogi. Każda partia dwa razy w tygodniu, szósty tydzień lżejszy.', 'Upper, lower, rest day, upper, legs. Every muscle group twice a week; week six is lighter.'),
  ),
  goal(
    'cel-ppl-60',
    say('Push, pull, nogi — 60 dni', 'Push, pull, legs — 60 days'),
    60,
    'gym',
    'strong',
    6,
    ['push-gym', 'pull-gym', 'legs-gym'],
    say('Masa mięśniowa w klasycznym podziale — dla kogoś, kto ma za sobą pierwszy rok.', 'Muscle mass on a classic split, for someone with their first year behind them.'),
    say('Sześć dni w tygodniu, każda partia dwa razy. Wymaga czasu i snu; przy gorszej regeneracji wybierz góra/dół.', 'Six days a week, every muscle group twice. It takes time and sleep; if you recover less well, choose upper/lower.'),
  ),
  goal(
    'cel-gora-dol-60',
    say('Góra i dół — 60 dni', 'Upper/lower — 60 days'),
    60,
    'gym',
    'base',
    4,
    ['upper-gym', 'lower-gym', 'upper-gym', 'legs-gym'],
    say('Siła i masa całego ciała na siłowni, cztery razy w tygodniu.', 'Full-body strength and size at the gym, four times a week.'),
    say('Najpopularniejszy podział dla średniozaawansowanych: każda partia dwa razy w tygodniu, weekend wolny.', 'The most popular split for intermediates: every muscle group twice a week, weekends off.'),
  ),
  goal(
    'cel-klatka-60',
    say('Mocna klatka — 60 dni', 'Strong chest — 60 days'),
    60,
    'gym',
    'base',
    4,
    ['chest-gym', 'lower-gym', 'upper-gym', 'legs-gym'],
    say('Większa i silniejsza klatka piersiowa, bez zaniedbania reszty.', 'A bigger, stronger chest without neglecting the rest.'),
    say('Dzień klatki i dzień góry w tygodniu — klatka dwa razy, plecy dla równowagi barków też.', 'A chest day and an upper day each week: chest twice, and back twice too, to balance your shoulders.'),
  ),
  goal(
    'cel-plecy-60',
    say('Plecy i postawa — 60 dni', 'Back and posture — 60 days'),
    60,
    'gym',
    'base',
    3,
    ['back-gym', 'legs-gym', 'upper-gym'],
    say('Szersze, grubsze plecy i barki, które nie uciekają do przodu.', "A wider, thicker back and shoulders that don't roll forward."),
    say('Więcej ciągnięcia niż pchania — dzień pleców i dzień góry, a nogi pomiędzy. Klatka dostaje tylko serie na podtrzymanie, doradca to zaznaczy — tu to świadomy wybór.', "More pulling than pushing: a back day and an upper day, with legs in between. The chest only gets maintenance sets; the advisor will flag it, but here it's a deliberate choice."),
  ),
  goal(
    'cel-sila-90',
    say('Siła całego ciała — 90 dni', 'Full-body strength — 90 days'),
    90,
    'gym',
    'zero',
    3,
    ['full-gym', 'full-gym-b'],
    say('Solidne podstawy siły: przysiad, martwy ciąg, wyciskania i podciąganie.', 'Solid strength foundations: squat, deadlift, presses and pull-ups.'),
    say('Trzy treningi całego ciała na zmianę A i B — układ, który ACSM zaleca na początek. Tygodnie lżejsze: szósty i dwunasty.', 'Three full-body workouts, alternating A and B: the layout ACSM recommends for starting out. Lighter weeks: six and twelve.'),
  ),
  goal(
    'cel-posladki-90',
    say('Pośladki — 90 dni', 'Glutes — 90 days'),
    90,
    'gym',
    'base',
    3,
    ['glutes-gym', 'upper-gym', 'lower-gym'],
    say('Wyraźnie mocniejsze i pełniejsze pośladki — hip thrust, przysiady i martwy ciąg.', 'Noticeably stronger, fuller glutes: hip thrusts, squats and deadlifts.'),
    say('Pośladki dwa razy w tygodniu, prawie 20 serii — górna granica tego, co się jeszcze opłaca. Klatka tylko na podtrzymanie. Tygodnie lżejsze: szósty i dwunasty.', 'Glutes twice a week, almost 20 sets: the upper limit of what still pays off. Chest on maintenance only. Lighter weeks: six and twelve.'),
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
    say('Bez sprzętu — start, 30 dni', 'No equipment — start, 30 days'),
    30,
    'none',
    'zero',
    3,
    ['full-none', 'full-none-b'],
    say('Ruszyć z miejsca bez siłowni i bez zakupów: przysiad, pompki, wiosłowanie pod stołem i core.', 'Get going with no gym and nothing to buy: squats, push-ups, rows under a table and core.'),
    say('Trzy treningi całego ciała na zmianę A i B, po 25 minut — poniedziałek, środa, piątek. Każda partia dwa–trzy razy w tygodniu, zawsze z dniem przerwy.', 'Three 25-minute full-body workouts, alternating A and B: Monday, Wednesday, Friday. Every muscle group two or three times a week, always with a rest day in between.'),
  ),
  goal(
    'cel-bez-brzuch-30',
    say('Brzuch bez sprzętu — 30 dni', 'Abs, no equipment — 30 days'),
    30,
    'none',
    'zero',
    3,
    ['full-none-c', 'core-none', 'full-none'],
    say('Mocniejszy brzuch i stabilny tułów na samej macie.', 'Stronger abs and a stable trunk with nothing but a mat.'),
    say('Dwa treningi całego ciała i kwadrans brzucha pomiędzy nimi. Tył uda i biceps dostają tu mało — to plan pod tułów.', "Two full-body workouts with fifteen minutes of abs in between. Hamstrings and biceps get little here: it's a plan for your trunk."),
  ),
  goal(
    'cel-bez-cialo-60',
    say('Całe ciało bez sprzętu — 60 dni', 'Full body, no equipment — 60 days'),
    60,
    'none',
    'zero',
    3,
    ['full-none', 'full-none-b', 'full-none-c'],
    say('Siła i kondycja całego ciała w domu, trzy razy w tygodniu po pół godziny.', 'Full-body strength and fitness at home, three half-hour sessions a week.'),
    say('Trzy różne treningi całego ciała — A, B i C — każdy raz w tygodniu, z dniem przerwy między nimi. Szósty tydzień lżejszy.', 'Three different full-body workouts (A, B and C), each once a week with a rest day between them. Week six is lighter.'),
  ),
  goal(
    'cel-bez-posladki-60',
    say('Pośladki bez sprzętu — 60 dni', 'Glutes, no equipment — 60 days'),
    60,
    'none',
    'base',
    3,
    ['glutes-none', 'upper-none', 'full-none-b'],
    say('Silniejsze i pełniejsze pośladki na macie i z krzesłem.', 'Stronger, fuller glutes with a mat and a chair.'),
    say('Pośladki dwa razy w tygodniu — w dniu pośladków i w treningu całego ciała — a góra pomiędzy. Biceps tylko pomocniczo. Szósty tydzień lżejszy.', 'Glutes twice a week (on glute day and in a full-body workout), with upper body in between. Biceps only as a helper. Week six is lighter.'),
  ),
  goal(
    'cel-bez-gora-dol-60',
    say('Góra i dół bez sprzętu — 60 dni', 'Upper/lower, no equipment — 60 days'),
    60,
    'none',
    'base',
    4,
    ['upper-none', 'lower-none', 'upper-none', 'legs-none'],
    say('Więcej objętości niż całe ciało: cztery dni w tygodniu, każda partia dwa razy.', 'More volume than full body: four days a week, every muscle group twice.'),
    say('Góra, dół, dzień wolny, góra, nogi. Biceps pracuje tylko pomocniczo przy wiosłowaniu — bez drążka inaczej się nie da. Szósty tydzień lżejszy.', "Upper, lower, rest day, upper, legs. The biceps only help out in the rows: without a bar there's no other way. Week six is lighter."),
  ),
  goal(
    'cel-bez-sila-90',
    say('Siła z masą ciała — 90 dni', 'Bodyweight strength — 90 days'),
    90,
    'none',
    'base',
    4,
    ['upper-none', 'lower-none', 'upper-none', 'legs-none'],
    say('Pompki w staniu na rękach przy ścianie i przysiad jednonóż — siła, którą widać bez ciężarów.', 'Wall handstand push-ups and single-leg squats: strength that shows without weights.'),
    say('Ten sam układ góra/dół na trzy miesiące: dość czasu, żeby przejść kolejne etapy pompek i przysiadu jednonóż. Biceps tylko pomocniczo. Tygodnie lżejsze: szósty i dwunasty.', 'The same upper/lower layout for three months: enough time to work through the push-up and single-leg squat stages. Biceps only as a helper. Lighter weeks: six and twelve.'),
  ),
];

/**
 * Plany ogólnorozwojowe z profilem: 60 dni, trzy treningi całego ciała w tygodniu, A i B
 * na zmianę, z akcentem profilu (`data/profiles.ts`). Po jednym na profil i sprzęt.
 */
export const PROFILE_PLANS: PlanTemplate[] = PROFILE_KEYS.flatMap((k) =>
  gearsOf(k).map((g) => ({
    ...goal(
      profilePlanId(k, g),
      say(`${PROFILES[k].name} — ogólnorozwojowy, 60 dni`, `${PROFILES[k].name} — all-round, 60 days`),
      60,
      g,
      'base',
      3,
      [profileWorkoutId(k, g, 0), profileWorkoutId(k, g, 1)],
      PROFILES[k].goal,
      say(
        `Trzy treningi całego ciała w tygodniu, A i B na zmianę — cała reszta ciała dalej rośnie. ${PROFILES[k].why}`,
        `Three full-body workouts a week, alternating A and B, so the rest of your body keeps growing. ${PROFILES[k].why}`,
      ),
    ),
    profile: k,
  })),
);

/** Plan klasyczny, z celem albo z profilem — bez planów własnych, które mieszkają w zapisie. */
export const planById = (id: string): PlanTemplate | undefined =>
  PLANS.find((p) => p.id === id) ?? GOAL_PLANS.find((p) => p.id === id) ?? PROFILE_PLANS.find((p) => p.id === id);

/** Dowolny plan, także własny. */
export const planOf = (state: AppState, id: string): PlanTemplate | undefined =>
  planById(id) ?? state.plans?.find((p) => p.id === id);
