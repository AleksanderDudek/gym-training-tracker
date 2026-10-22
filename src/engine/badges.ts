import { ALL } from '../data/exercises';
import type { Achievement, AchievementHit, AppState, PlanEvent } from '../types';
import type { PlanStats, Schedule } from './schedule';
import { metrics } from './metrics';
import type { Metrics } from './metrics';
import { countCleanWeeks } from './score';
import { EX_DEFS } from './exbadges';
import { LOCALE, say, text } from '../i18n';

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
export interface AchDef extends Achievement {
  value: (c: AchCtx) => number;
  /**
   * Wartość w bieżącym okresie — tylko dla rekordów dnia, tygodnia i miesiąca. Kolejny próg
   * zdobywa się w jednym okresie, więc pasek postępu liczy się z tego, co jest teraz,
   * a nie z rekordu, który został w zeszłym tygodniu.
   */
  current?: (c: AchCtx) => number;
  /** Formatowanie wartości i progu, gdy goła liczba niewiele mówi. */
  fmt?: (n: number) => string;
}

/** Tworzywo odznaki. Zero znaczy „jeszcze nie zdobyta”. */
export type Band = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Tworzywo z postępu w obrębie rodziny, a nie z gołego numeru progu. Dzięki temu domknięcie
 * dowolnej rodziny kończy się szmaragdem — także tej trzyprogowej — a rodzina dziesięcioprogowa
 * rozkłada te same pięć pasm na dłuższą drogę.
 */
export const bandFor = (tier: number, total: number): Band => {
  if (tier <= 0 || total <= 0) return 0;
  // Odznaka jednorazowa dostaje złoto, nie szmaragd. Inaczej „Ranny ptaszek” za jeden trening
  // przed ósmą stałby na półce w tym samym tworzywie, co domknięta dziesięcioprogowa rodzina.
  if (total === 1) return 3;
  return Math.max(1, Math.min(5, Math.ceil((tier / total) * 5))) as Band;
};

const kg = (n: number): string => (n >= 1000 ? `${Math.round(n / 100) / 10} t` : `${n} kg`);
const mins = (n: number): string => (n >= 120 ? `${Math.round(n / 60)} min` : `${n} s`);
const yes = (b: boolean): number => (b ? 1 : 0);
/** Minuty w godzinach: „1 h”, „1,5 h”, „250 h”; poniżej godziny — w minutach. */
const hours = (n: number): string =>
  n < 60 ? `${n} min` : `${(Math.round(n / 6) / 10).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} h`;

/**
 * Rodzina objętości dla jednej partii ruchu. Nazwa partii przychodzi z biblioteki ćwiczeń,
 * ale identyfikator jest wpisany na sztywno, bo to klucz w trwałym dorobku — gdyby brał się
 * z nazwy, jedna literówka w bibliotece kasowałaby komuś zdobyte progi.
 */
const GROUP_QUIPS: Record<string, string> = text({
  pl: {"zawias": "Plecy proste, biodra do tyłu, sąsiad zaniepokojony.", "przysiad": "Schody przestały być wyzwaniem. Krzesło bywa.", "ciagniecie": "Ciągnięcie do siebie. Jedyny rodzaj, który wypada.", "pchanie": "Odpychanie świata od siebie, seria po serii.", "cale-cialo": "Ćwiczenia, po których nie wiadomo, co boli. Wszystko.", "core": "Brzuch widać latem, robi się go zimą.", "nogi": "Dzień nóg. Ten, który wszyscy pomijają oprócz ciebie."},
  en: {
    zawias: 'Back straight, hips back, neighbour concerned.',
    przysiad: 'Stairs stopped being a challenge. The chair sometimes still is.',
    ciagniecie: 'Pulling your weight. The only kind of pulling that’s polite.',
    pchanie: 'Pushing the world away, one set at a time.',
    'cale-cialo': 'Exercises after which you can’t tell what hurts. Everything.',
    core: 'Abs show in summer and get made in winter.',
    nogi: 'Leg day. The one everybody skips except you.',
  },
});

/** Teksty rodzin i dziennika, które nie są pojedynczą odznaką. */
const T = text({
  pl: {
    groupDesc: (group: string) => `Powtórzenia z partii „${group}”. Ćwiczenia liczone na czas nie wchodzą.`,
    eventTitle: (name: string, tier: string) => `Odznaka: ${name}${tier}`,
    eventText: (desc: string, tier: string) => `${desc} Próg: ${tier}.`,
  },
  en: {
    groupDesc: (group: string) => `Reps from the “${group}” group. Timed exercises don’t count.`,
    eventTitle: (name: string, tier: string) => `Badge: ${name}${tier}`,
    eventText: (desc: string, tier: string) => `${desc} Tier: ${tier}.`,
  },
});

/**
 * Liczba pojedyncza angielskiej jednostki — do progu „1”. Polskie jednostki stoją w dopełniaczu
 * liczby mnogiej i tej mapy nie dotykają.
 */
const UNIT_ONE: Record<string, string> = {
  workouts: 'workout',
  reps: 'rep',
  'reps per side': 'rep per side',
  sets: 'set',
  exercises: 'exercise',
  weeks: 'week',
  days: 'day',
  stages: 'stage',
  times: 'time',
  snacks: 'snack',
  steps: 'step',
  sessions: 'session',
  classes: 'class',
  minutes: 'minute',
  deadlines: 'deadline',
};

const groupFamily = (
  id: string,
  group: string,
  /** Nazwa partii na ekranie; po polsku to sama nazwa z biblioteki. */
  shown: string,
  art: string,
  name: string,
  tiers: number[],
): AchDef => ({
  id,
  group: 'partie',
  mark: '',
  art,
  name,
  desc: T.groupDesc(shown),
  quip: GROUP_QUIPS[id] ?? '',
  unit: say('powtórzeń', 'reps'),
  tiers,
  value: (c) => c.metrics.byGroup[group] ?? 0,
});

const DEFS: AchDef[] = [
  /* ---------------- Dorobek: sumy z całej historii ---------------- */
  {
    id: 'treningi', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'dorobek',
    mark: '',
    art: 'fig-carry',
    name: say('Zapisane treningi', 'Workouts logged'),
    desc: say(
      'Suma zamkniętych sesji. Pierwsza jest najtrudniejsza, tysięczna najrzadsza.',
      'All your finished sessions. The first is the hardest, the thousandth the rarest.',
    ),
    quip: say('Pierwszy jest najtrudniejszy. Reszta tylko boli.', 'The first is the hardest. The rest just hurt.'),
    unit: say('treningów', 'workouts'),
    tiers: [1, 10, 25, 50, 100, 250, 500, 1_000, 2_000],
    value: (c) => c.metrics.workouts,
  },
  {
    id: 'powtorzenia',
    group: 'dorobek',
    mark: '',
    art: 'fig-swing',
    name: say('Powtórzenia', 'Reps'),
    desc: say(
      'Suma powtórzeń z całej historii. Ćwiczenia na stronę liczą się dwa razy.',
      'Every rep in your history. One-sided exercises count twice.',
    ),
    quip: say('Nikt ich nie liczył oprócz ciebie i tej aplikacji.', 'Nobody counted them except you and this app.'),
    unit: say('powtórzeń', 'reps'),
    tiers: [500, 2_000, 10_000, 25_000, 50_000, 100_000, 200_000, 350_000, 500_000, 1_000_000],
    value: (c) => c.metrics.reps,
  },
  {
    id: 'serie',
    group: 'dorobek',
    mark: '',
    art: 'fig-squat',
    name: say('Serie', 'Sets'),
    desc: say('Każda seria z wpisanym wynikiem to jedna sztuka.', 'Every set with a logged result counts as one.'),
    quip: say('Każda seria to osobna decyzja, żeby nie usiąść.', 'Every set is a separate decision not to sit down.'),
    unit: say('serii', 'sets'),
    tiers: [100, 500, 1_500, 4_000, 10_000, 20_000, 40_000, 75_000],
    value: (c) => c.metrics.sets,
  },
  {
    id: 'cwiczenia',
    group: 'dorobek',
    mark: '',
    art: 'fig-press',
    name: say('Wykonane ćwiczenia', 'Exercises done'),
    desc: say('Jedno ćwiczenie w jednej sesji to jedna sztuka.', 'One exercise in one session counts as one.'),
    quip: say(
      'Statystycznie rzecz biorąc, sporo się naklepałeś.',
      'Statistically speaking, you’ve put in quite a shift.',
    ),
    unit: say('sztuk', 'exercises'),
    tiers: [50, 250, 1_000, 3_000, 8_000, 15_000, 30_000],
    value: (c) => c.metrics.exercises,
  },
  {
    id: 'tonaz',
    group: 'dorobek',
    mark: '',
    art: 'fig-hinge',
    name: say('Tonaż', 'Tonnage'),
    desc: say(
      'Ciężar razy powtórzenia, zsumowany przez całą historię.',
      'Weight times reps, added up over your whole history.',
    ),
    quip: say('Grawitacja próbowała. Grawitacja przegrała.', 'Gravity tried. Gravity lost.'),
    tiers: [10_000, 50_000, 200_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000],
    value: (c) => c.metrics.tonnage,
    fmt: kg,
  },
  {
    id: 'czas',
    group: 'dorobek',
    mark: '',
    art: 'fig-plank',
    name: say('Czas pod obciążeniem', 'Time under load'),
    desc: say(
      'Sekundy z ćwiczeń liczonych na czas: spacery farmera i deska.',
      'Seconds from timed exercises: farmer’s walks and planks.',
    ),
    quip: say(
      'Czas stania z ciężarem i udawania, że wszystko gra.',
      'Time spent holding a weight and pretending it’s all fine.',
    ),
    tiers: [600, 3_000, 10_000, 30_000, 60_000, 120_000, 250_000],
    value: (c) => c.metrics.secs,
    fmt: mins,
  },
  {
    id: 'atlas',
    group: 'dorobek',
    mark: '',
    art: 'fig-pull',
    name: say('Poznany atlas', 'Atlas explored'),
    desc: say(
      'Ile różnych ćwiczeń w ogóle się pojawiło w historii. Ostatni próg to cała biblioteka.',
      'How many different exercises have appeared in your history. The last tier is the whole library.',
    ),
    quip: say('Biblioteka przerobiona. Bibliotekarz dumny.', 'Library worked through. The librarian is proud.'),
    unit: say('ćwiczeń', 'exercises'),
    // Ostatni próg liczony z biblioteki, żeby nie rozjechał się przy kolejnym rozszerzeniu atlasu.
    tiers: [5, 10, 20, 35, 55, 80, ALL.length],
    value: (c) => c.metrics.distinct,
  },

  /* ---------------- Partie ruchu ---------------- */
  groupFamily(
    'zawias',
    'Zawias biodrowy', // i18n-ignore: nazwa partii z biblioteki — klucz w metrykach
    say('Zawias biodrowy', 'Hip hinge'),
    'fig-hinge',
    say('Zawias biodrowy', 'Hip hinge'),
    [500, 2_500, 5_000, 10_000, 25_000, 50_000],
  ),
  groupFamily(
    'przysiad',
    'Przysiad', // i18n-ignore: nazwa partii z biblioteki — klucz w metrykach
    say('Przysiad', 'Squat'),
    'fig-squat',
    say('Przysiad', 'Squat'),
    [300, 1_500, 3_000, 6_000, 12_000, 25_000],
  ),
  groupFamily(
    'ciagniecie',
    'Ciągnięcie', // i18n-ignore: nazwa partii z biblioteki — klucz w metrykach
    say('Ciągnięcie', 'Pull'),
    'fig-row',
    say('Ciągnięcie', 'Pull'),
    [300, 1_500, 3_000, 6_000, 12_000, 25_000],
  ),
  groupFamily(
    'pchanie',
    'Pchanie', // i18n-ignore: nazwa partii z biblioteki — klucz w metrykach
    say('Pchanie', 'Push'),
    'fig-pushup',
    say('Pchanie', 'Push'),
    [300, 1_500, 3_000, 6_000, 12_000, 25_000],
  ),
  groupFamily(
    'cale-cialo',
    'Całe ciało', // i18n-ignore: nazwa partii z biblioteki — klucz w metrykach
    say('Całe ciało', 'Full body'),
    'fig-swing',
    say('Całe ciało', 'Full body'),
    [100, 500, 1_200, 2_500, 5_000, 10_000],
  ),
  groupFamily(
    'core',
    'Core i carry', // i18n-ignore: nazwa partii z biblioteki — klucz w metrykach
    say('Core i carry', 'Core & carry'),
    'fig-plank',
    say('Core', 'Core'),
    [200, 1_000, 2_500, 5_000, 10_000, 20_000],
  ),
  groupFamily(
    'nogi',
    'Nogi — dodatkowe', // i18n-ignore: nazwa partii z biblioteki — klucz w metrykach
    say('Nogi — dodatkowe', 'Legs — extra'),
    'fig-calf',
    say('Nogi dodatkowo', 'Extra leg work'),
    [300, 1_500, 3_000, 6_000, 12_000, 25_000],
  ),

  /* ---------------- Szczyty: rekordy pojedynczych podejść ---------------- */
  {
    id: 'najciezszy',
    group: 'szczyty',
    mark: '',
    art: 'kettlebell',
    name: say('Najcięższy ciężar', 'Heaviest weight'),
    desc: say(
      'Najcięższe obciążenie, jakie w ogóle pojawiło się w zapisanej serii.',
      'The heaviest load that has ever appeared in a logged set.',
    ),
    quip: say('Ciężar, który kiedyś wydawał się nie do ruszenia.', 'A weight that once seemed impossible to move.'),
    tiers: [8, 12, 16, 20, 24, 32, 40, 60, 80, 100, 140],
    value: (c) => c.metrics.heaviest,
    fmt: (n) => `${n} kg`,
  },
  {
    id: 'maksimum',
    group: 'szczyty',
    mark: '',
    art: 'ruler',
    name: say('Szacowane maksimum', 'Estimated max'),
    desc: say(
      'Najwyższy szacowany ciężar na jedno powtórzenie, wzorem Epleya z twoich serii.',
      'Your highest estimated one-rep max, from your sets with the Epley formula.',
    ),
    quip: say(
      'Liczba wyliczona wzorem. Wzór w ciebie wierzy.',
      'A number from a formula. The formula believes in you.',
    ),
    tiers: [20, 30, 40, 50, 60, 80, 100],
    value: (c) => c.metrics.e1rm,
    fmt: (n) => `${n} kg`,
  },
  {
    id: 'seria-rekord', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'szczyty',
    mark: '',
    art: 'fig-dip',
    name: say('Najdłuższa seria', 'Longest set'),
    desc: say('Najwięcej powtórzeń w jednej serii bez przerwy.', 'The most reps in a single set without a break.'),
    quip: say(
      'Moment, w którym przestało się liczyć, a zaczęło wytrzymywać.',
      'The moment counting stopped and holding on began.',
    ),
    unit: say('powtórzeń', 'reps'),
    tiers: [20, 30, 50, 75, 100, 150],
    value: (c) => c.metrics.best.set,
  },
  {
    id: 'podchod',
    group: 'szczyty',
    mark: '',
    art: 'hourglass',
    name: say('Najdłuższy podchód', 'Longest hold'),
    desc: say('Najdłuższy pojedynczy spacer albo trzymanie na czas.', 'Your longest single timed walk or hold.'),
    quip: say('Stanie w miejscu jako dyscyplina sportowa.', 'Standing still as a sport.'),
    tiers: [60, 120, 180, 300],
    value: (c) => c.metrics.best.hold,
    fmt: mins,
  },
  {
    id: 'sesja-tonaz',
    group: 'szczyty',
    mark: '',
    art: 'plate',
    name: say('Najcięższa sesja', 'Heaviest session'),
    desc: say('Największy tonaż w jednym treningu.', 'The biggest tonnage in one workout.'),
    quip: say('Jedna sesja, a magazyn jak po przeprowadzce.', 'One session, and the warehouse looks like moving day.'),
    tiers: [500, 1_500, 3_000, 6_000, 10_000, 15_000],
    value: (c) => c.metrics.best.sessionTonnage,
    fmt: kg,
  },

  /* ---------------- Szczyty: rekord z okna czasu ---------------- */
  {
    id: 'dzien-powtorzenia',
    group: 'szczyty',
    mark: '24H',
    name: say('Najlepszy dzień', 'Best day'),
    desc: say('Najwięcej powtórzeń w jednej dobie.', 'The most reps in one day.'),
    quip: say('Doba, po której schody wydawały się złośliwe.', 'A day after which the stairs seemed spiteful.'),
    unit: say('powtórzeń', 'reps'),
    tiers: [100, 200, 350, 500, 700, 1_000],
    value: (c) => c.metrics.best.dayReps,
  },
  {
    id: 'dzien-serie',
    group: 'szczyty',
    mark: '24H',
    name: say('Dzień serii', 'Day of sets'),
    desc: say(
      'Najwięcej serii w jednej dobie, choćby z dwóch sesji.',
      'The most sets in one day, even across two sessions.',
    ),
    quip: say(
      'Tyle serii, że przerwy zaczęły się zlewać w jedną.',
      'So many sets that the rests began to blur into one.',
    ),
    unit: say('serii', 'sets'),
    tiers: [10, 20, 30, 45, 60, 80],
    value: (c) => c.metrics.best.daySets,
  },
  {
    id: 'dzien-tonaz',
    group: 'szczyty',
    mark: '24H',
    name: say('Najcięższa doba', 'Heaviest day'),
    desc: say(
      'Największy tonaż w jednym dniu, choćby z dwóch sesji.',
      'The biggest tonnage in one day, even across two sessions.',
    ),
    quip: say('Jeden dzień, ciężar jak z listy przewozowej.', 'One day, a load straight off a shipping manifest.'),
    tiers: [1_000, 3_000, 6_000, 10_000, 16_000],
    value: (c) => c.metrics.best.dayTonnage,
    fmt: kg,
  },
  {
    id: 'tydzien-powtorzenia',
    group: 'szczyty',
    mark: '7D',
    name: say('Tydzień objętości', 'Week of volume'),
    desc: say('Najwięcej powtórzeń w dowolnych siedmiu dniach z rzędu.', 'The most reps in any seven days in a row.'),
    quip: say('Tydzień, w którym licznik nie nadążał.', 'A week the counter couldn’t keep up with.'),
    unit: say('powtórzeń', 'reps'),
    tiers: [300, 600, 1_000, 1_800, 2_500, 3_500],
    value: (c) => c.metrics.best.weekReps,
  },
  {
    id: 'tydzien-serie',
    group: 'szczyty',
    mark: '7D',
    name: say('Tydzień serii', 'Week of sets'),
    desc: say('Najwięcej serii w dowolnych siedmiu dniach.', 'The most sets in any seven days.'),
    quip: say('Siedem dni i stos serii, którego nikt nie zamawiał.', 'Seven days and a pile of sets nobody ordered.'),
    unit: say('serii', 'sets'),
    tiers: [20, 45, 80, 130, 200],
    value: (c) => c.metrics.best.weekSets,
  },
  {
    id: 'tydzien-treningi', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'szczyty',
    mark: '7D',
    name: say('Gęsty tydzień', 'Packed week'),
    desc: say('Najwięcej treningów w dowolnych siedmiu dniach.', 'The most workouts in any seven days.'),
    quip: say(
      'Tydzień, w którym siłownia zaczęła rozpoznawać twoją kurtkę.',
      'The week the gym started recognising your jacket.',
    ),
    unit: say('treningów', 'workouts'),
    tiers: [2, 3, 4, 5, 6, 7],
    value: (c) => c.metrics.best.weekWorkouts,
  },
  {
    id: 'dwa-tygodnie',
    group: 'szczyty',
    mark: '14D',
    name: say('Dwa tygodnie treningów', 'Two weeks of workouts'),
    desc: say('Najwięcej treningów w dowolnych czternastu dniach.', 'The most workouts in any fourteen days.'),
    quip: say(
      'Dwa tygodnie konsekwencji. Statystycznie rzadkie zjawisko.',
      'Two weeks of consistency. A statistically rare event.',
    ),
    unit: say('treningów', 'workouts'),
    tiers: [4, 6, 8, 10, 12, 14],
    value: (c) => c.metrics.best.twoWeekWorkouts,
  },
  {
    id: 'dwa-tygodnie-powtorzenia',
    group: 'szczyty',
    mark: '14D',
    name: say('Dwa tygodnie objętości', 'Two weeks of volume'),
    desc: say('Najwięcej powtórzeń w dowolnych czternastu dniach.', 'The most reps in any fourteen days.'),
    quip: say(
      'Czternaście dni i objętość, której nie chce się liczyć.',
      'Fourteen days and volume nobody wants to count.',
    ),
    unit: say('powtórzeń', 'reps'),
    tiers: [600, 1_200, 2_000, 3_200, 5_000],
    value: (c) => c.metrics.best.twoWeekReps,
  },
  {
    id: 'trzy-tygodnie',
    group: 'szczyty',
    mark: '21D',
    name: say('Trzy tygodnie treningów', 'Three weeks of workouts'),
    desc: say('Najwięcej treningów w dowolnych dwudziestu jeden dniach.', 'The most workouts in any twenty-one days.'),
    quip: say(
      'Trzy tygodnie. Tyle podobno trwa budowanie nawyku.',
      'Three weeks. Supposedly that’s how long a habit takes.',
    ),
    unit: say('treningów', 'workouts'),
    tiers: [6, 9, 12, 15, 18, 21],
    value: (c) => c.metrics.best.threeWeekWorkouts,
  },
  {
    id: 'trzy-tygodnie-powtorzenia',
    group: 'szczyty',
    mark: '21D',
    name: say('Trzy tygodnie objętości', 'Three weeks of volume'),
    desc: say('Najwięcej powtórzeń w dowolnych dwudziestu jeden dniach.', 'The most reps in any twenty-one days.'),
    quip: say('Dwadzieścia jeden dni, jedna wielka suma.', 'Twenty-one days, one big total.'),
    unit: say('powtórzeń', 'reps'),
    tiers: [900, 1_800, 3_000, 5_000, 7_500],
    value: (c) => c.metrics.best.threeWeekReps,
  },
  {
    id: 'miesiac-treningi', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'szczyty',
    mark: '30D',
    name: say('Miesiąc treningów', 'Month of workouts'),
    desc: say('Najwięcej treningów w dowolnych trzydziestu dniach.', 'The most workouts in any thirty days.'),
    quip: say(
      'Miesiąc, w którym karnet wreszcie na siebie zarobił.',
      'The month your gym membership finally paid for itself.',
    ),
    unit: say('treningów', 'workouts'),
    tiers: [8, 12, 16, 20, 24, 30],
    value: (c) => c.metrics.best.monthWorkouts,
  },
  {
    id: 'miesiac-powtorzenia',
    group: 'szczyty',
    mark: '30D',
    name: say('Miesiąc objętości', 'Month of volume'),
    desc: say('Najwięcej powtórzeń w dowolnych trzydziestu dniach.', 'The most reps in any thirty days.'),
    quip: say('Trzydzieści dni. Licznik zdążył się zmęczyć.', 'Thirty days. Even the counter got tired.'),
    unit: say('powtórzeń', 'reps'),
    tiers: [1_200, 2_500, 4_500, 7_000, 10_000, 15_000],
    value: (c) => c.metrics.best.monthReps,
  },
  {
    id: 'miesiac-serie',
    group: 'szczyty',
    mark: '30D',
    name: say('Miesiąc serii', 'Month of sets'),
    desc: say('Najwięcej serii w dowolnych trzydziestu dniach.', 'The most sets in any thirty days.'),
    quip: say('Serie liczone już nie na sztuki, tylko na setki.', 'Sets counted not one by one, but by the hundred.'),
    unit: say('serii', 'sets'),
    tiers: [80, 160, 280, 450, 650],
    value: (c) => c.metrics.best.monthSets,
  },
  {
    id: 'miesiac-cwiczenia',
    group: 'szczyty',
    mark: '30D',
    name: say('Miesiąc ćwiczeń', 'Month of exercises'),
    desc: say(
      'Najwięcej wykonanych ćwiczeń w dowolnych trzydziestu dniach.',
      'The most exercises done in any thirty days.',
    ),
    quip: say('Miesiąc przerabiania atlasu po kolei.', 'A month of working through the atlas, one by one.'),
    unit: say('sztuk', 'exercises'),
    tiers: [40, 90, 160, 260, 400],
    value: (c) => c.metrics.best.monthExercises,
  },
  {
    id: 'miesiac-tonaz',
    group: 'szczyty',
    mark: '30D',
    name: say('Miesięczny tonaż', 'Monthly tonnage'),
    desc: say('Najcięższe trzydzieści dni z rzędu.', 'Your heaviest thirty days in a row.'),
    quip: say(
      'Tonaż z jednego miesiąca. Magazynier by się zdziwił.',
      'One month’s tonnage. The warehouse manager would be amazed.',
    ),
    tiers: [5_000, 15_000, 40_000, 80_000, 150_000, 250_000],
    value: (c) => c.metrics.best.monthTonnage,
    fmt: kg,
  },
  {
    id: 'kwartal-treningi', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'szczyty',
    mark: '90D',
    name: say('Kwartał treningów', 'Quarter of workouts'),
    desc: say('Najwięcej treningów w dowolnych dziewięćdziesięciu dniach.', 'The most workouts in any ninety days.'),
    quip: say('Kwartał. Tyle wystarczy, żeby zauważyli inni.', 'A quarter. Long enough for other people to notice.'),
    unit: say('treningów', 'workouts'),
    tiers: [20, 30, 40, 55, 70, 90],
    value: (c) => c.metrics.best.quarterWorkouts,
  },
  {
    id: 'kwartal-powtorzenia',
    group: 'szczyty',
    mark: '90D',
    name: say('Kwartał objętości', 'Quarter of volume'),
    desc: say('Najwięcej powtórzeń w dowolnych dziewięćdziesięciu dniach.', 'The most reps in any ninety days.'),
    quip: say('Trzy miesiące powtórzeń. Nuda robi robotę.', 'Three months of reps. Boring gets the job done.'),
    unit: say('powtórzeń', 'reps'),
    tiers: [2_000, 5_000, 10_000, 18_000, 30_000, 45_000],
    value: (c) => c.metrics.best.quarterReps,
  },
  {
    id: 'polrocze-treningi', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'szczyty',
    mark: '180',
    name: say('Półrocze treningów', 'Half a year of workouts'),
    desc: say(
      'Najwięcej treningów w dowolnych stu osiemdziesięciu dniach.',
      'The most workouts in any hundred and eighty days.',
    ),
    quip: say(
      'Pół roku. Już nie hobby, jeszcze nie osobowość.',
      'Half a year. No longer a hobby, not yet a personality.',
    ),
    unit: say('treningów', 'workouts'),
    tiers: [40, 60, 80, 110, 140, 170],
    value: (c) => c.metrics.best.halfYearWorkouts,
  },
  {
    id: 'polrocze-powtorzenia',
    group: 'szczyty',
    mark: '180',
    name: say('Półrocze objętości', 'Half a year of volume'),
    desc: say(
      'Najwięcej powtórzeń w dowolnych stu osiemdziesięciu dniach.',
      'The most reps in any hundred and eighty days.',
    ),
    quip: say('Sto osiemdziesiąt dni objętości bez fajerwerków.', 'A hundred and eighty days of volume, no fireworks.'),
    unit: say('powtórzeń', 'reps'),
    tiers: [4_000, 10_000, 20_000, 35_000, 55_000, 80_000],
    value: (c) => c.metrics.best.halfYearReps,
  },
  {
    id: 'rok-treningi', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'szczyty',
    mark: '365',
    name: say('Rok treningów', 'Year of workouts'),
    desc: say(
      'Najwięcej treningów w dowolnych trzystu sześćdziesięciu pięciu dniach.',
      'The most workouts in any three hundred and sixty-five days.',
    ),
    quip: say('Rok. Można oficjalnie mówić „trenuję”.', 'A year. You can officially say “I train”.'),
    unit: say('treningów', 'workouts'),
    tiers: [75, 110, 150, 200, 260, 320],
    value: (c) => c.metrics.best.yearWorkouts,
  },
  {
    id: 'rok-powtorzenia',
    group: 'szczyty',
    mark: '365',
    name: say('Rok objętości', 'Year of volume'),
    desc: say(
      'Najwięcej powtórzeń w dowolnym roku liczonym od dowolnego dnia.',
      'The most reps in any year, counted from any day.',
    ),
    quip: say('Rok powtórzeń. Cierpliwość w formie liczby.', 'A year of reps. Patience as a number.'),
    unit: say('powtórzeń', 'reps'),
    tiers: [8_000, 18_000, 35_000, 60_000, 100_000, 150_000],
    value: (c) => c.metrics.best.yearReps,
  },

  /* ---------------- Utrzymanie: poziom, który się nie osypuje ---------------- */
  {
    id: 'rytm',
    group: 'utrzymanie',
    mark: '',
    art: 'fig-walk',
    name: say('Utrzymany rytm', 'Steady rhythm'),
    desc: say(
      'Tygodnie z rzędu, w każdym co najmniej dwa treningi. Jeden pusty tydzień zeruje ciąg.',
      'Weeks in a row with at least two workouts each. One empty week resets the streak.',
    ),
    quip: say('Regularność jest nudna i dlatego działa.', 'Consistency is boring, and that’s why it works.'),
    unit: say('tygodni', 'weeks'),
    tiers: [4, 8, 12, 26, 52, 78, 104],
    value: (c) => c.metrics.steadyWeeks,
  },
  {
    id: 'dni-z-rzedu',
    group: 'utrzymanie',
    mark: '',
    art: 'dots',
    name: say('Dni z rzędu', 'Days in a row'),
    desc: say(
      'Najdłuższy ciąg dni kalendarzowych z treningiem. Dzień przerwy zeruje ciąg.',
      'Your longest run of calendar days with a workout. A day off resets the streak.',
    ),
    quip: say('Dni z rzędu. Regeneracja prosi o głos.', 'Days in a row. Recovery would like a word.'),
    unit: say('dni', 'days'),
    tiers: [2, 3, 5, 7, 10, 14, 21],
    value: (c) => c.metrics.dayStreak,
  },
  {
    id: 'bez-cofniecia',
    group: 'utrzymanie',
    mark: '',
    art: 'shield',
    name: say('Bez cofnięcia', 'No step back'),
    desc: say(
      'Dni treningu bez ani jednego zejścia z ciężaru. Liczone do ostatniej sesji, nie do dzisiaj.',
      'Training days without a single drop in weight. Counted up to your last session, not to today.',
    ),
    quip: say('Ani kroku w tył. Przynajmniej na papierze.', 'Not one step back. On paper, at least.'),
    unit: say('dni', 'days'),
    tiers: [30, 60, 120, 240, 365, 540, 730],
    value: (c) => c.metrics.noDropDays,
  },
  {
    id: 'forma',
    group: 'utrzymanie',
    mark: '',
    art: 'equals',
    name: say('Trzymana forma', 'Form held'),
    desc: say(
      'Ćwiczenia stojące w granicach 5% własnego szczytu. Miara utrzymania, nie wzrostu.',
      'Exercises within 5% of their own peak. A measure of holding on, not of growth.',
    ),
    quip: say('Trzymanie poziomu. Niedoceniana konkurencja.', 'Holding your level. An underrated event.'),
    unit: say('ćwiczeń', 'exercises'),
    tiers: [3, 6, 10, 20, 35, 55],
    value: (c) => c.metrics.heldForm,
  },
  {
    id: 'etapy',
    group: 'utrzymanie',
    mark: '',
    art: 'fig-pushup',
    name: say('Etapy z masą ciała', 'Bodyweight stages'),
    desc: say(
      'Suma etapów w podciąganiu, pompkach i core. Jedyna miara, w której ciężar nie gra żadnej roli.',
      'Stages reached in pull-ups, push-ups and core. The one measure where weight plays no part at all.',
    ),
    quip: say(
      'Masa ciała, zero wymówek, brak sprzętu do obwiniania.',
      'Bodyweight, zero excuses, no equipment to blame.',
    ),
    unit: say('etapów', 'stages'),
    tiers: [2, 4, 6, 9, 12],
    value: (c) => c.metrics.stages,
  },
  {
    id: 'powrot-do-formy',
    group: 'utrzymanie',
    mark: '',
    art: 'refresh',
    name: say('Powrót do poziomu', 'Back to your level'),
    desc: say(
      'Po przerwie od czternastu dni ciężar wrócił w miesiąc tam, gdzie był przed nią.',
      'After a break of fourteen days or more, the weight was back within a month to where it was before.',
    ),
    quip: say(
      'Wrócić na swoje. Trudniejsze niż dojść tam pierwszy raz.',
      'Getting back to where you were. Harder than getting there the first time.',
    ),
    unit: say('razy', 'times'),
    tiers: [1, 3, 6, 10],
    value: (c) => c.metrics.comebacks,
  },
  {
    id: 'zelazo',
    group: 'utrzymanie',
    mark: '',
    art: 'triangleUp',
    name: say('Żelazo', 'Iron'),
    desc: say(
      'Ćwiczenia, które przeszły na cięższe obciążenie i tam zostały.',
      'Exercises that moved up to a heavier load and stayed there.',
    ),
    quip: say('Kolejny ciężar przestał być straszny.', 'Another weight stopped being scary.'),
    unit: say('ćwiczeń', 'exercises'),
    tiers: [1, 3, 6, 12, 25, 40],
    value: (c) => c.metrics.heavier,
  },
  {
    id: 'ranny-ptaszek',
    group: 'utrzymanie',
    mark: '',
    art: 'sun',
    name: say('Ranny ptaszek', 'Early bird'),
    desc: say('Trening zamknięty przed ósmą rano.', 'A workout finished before 8 am.'),
    quip: say('Przed ósmą. Siłownia pusta, sumienie czyste.', 'Before eight. Empty gym, clear conscience.'),
    tiers: [1],
    value: (c) => yes(c.metrics.early),
  },
  {
    id: 'nocny-marek',
    group: 'utrzymanie',
    mark: '',
    art: 'moon',
    name: say('Nocny marek', 'Night owl'),
    desc: say('Trening zamknięty po dwudziestej pierwszej.', 'A workout finished after 9 pm.'),
    quip: say('Po dwudziestej pierwszej. Sąsiedzi wiedzą.', 'After nine at night. The neighbours know.'),
    tiers: [1],
    value: (c) => yes(c.metrics.late),
  },

  /* ---------------- Przekąski ruchowe ---------------- */
  {
    id: 'przekaski',
    group: 'przekaski',
    mark: '',
    art: 'stopwatch',
    name: say('Przekąski ruchowe', 'Exercise snacks'),
    desc: say(
      'Krótkie serie zapisane poza treningiem. Jedna przekąska to jedna sztuka.',
      'Short sets logged outside a workout. Each snack counts as one.',
    ),
    quip: say('Przerwy na nic stały się przerwami na coś.', 'Breaks for nothing became breaks for something.'),
    unit: say('przekąsek', 'snacks'),
    tiers: [1, 10, 30, 75, 150, 300, 600, 1_000],
    value: (c) => c.metrics.snacks.count,
  },
  {
    id: 'przekaski-dzien',
    group: 'przekaski',
    mark: '24H',
    name: say('Dzień w ruchu', 'Day on the move'),
    desc: say(
      'Najwięcej przekąsek w jednym dniu. Liczy się rozłożenie w czasie, nie jedna długa seria.',
      'The most snacks in one day. Spreading them out is what counts, not one long set.',
    ),
    quip: say('Dzień, w którym krzesło widziało cię tylko przelotnie.', 'A day the chair only saw you in passing.'),
    unit: say('przekąsek', 'snacks'),
    tiers: [3, 5, 8, 12],
    value: (c) => c.metrics.snacks.bestDay,
  },
  {
    id: 'przekaski-ciag',
    group: 'przekaski',
    mark: '',
    art: 'wave',
    name: say('Codzienny ruch', 'Daily movement'),
    desc: say(
      'Najdłuższy ciąg dni z rzędu z co najmniej jedną przekąską. Dzień bez przekąski zeruje ciąg.',
      'Your longest run of days with at least one snack. A day without one resets the streak.',
    ),
    quip: say(
      'Codziennie trochę. Nudne jak mycie zębów i równie skuteczne.',
      'A little every day. As boring as brushing your teeth, and just as effective.',
    ),
    unit: say('dni', 'days'),
    tiers: [3, 7, 14, 30, 60, 100, 200],
    value: (c) => c.metrics.snacks.run,
  },
  {
    id: 'przekaski-tydzien',
    group: 'przekaski',
    mark: '7D',
    name: say('Pełny tydzień w ruchu', 'Full week on the move'),
    desc: say(
      'Tygodnie od poniedziałku do niedzieli z przekąską każdego dnia.',
      'Monday-to-Sunday weeks with a snack every day.',
    ),
    quip: say('Siedem dni, siedem okazji, siedem wykorzystanych.', 'Seven days, seven chances, seven taken.'),
    unit: say('tygodni', 'weeks'),
    tiers: [1, 4, 12, 26, 52],
    value: (c) => c.metrics.snacks.fullWeeks,
  },
  {
    id: 'przekaski-menu',
    group: 'przekaski',
    mark: '',
    art: 'book',
    name: say('Menu przekąsek', 'Snack menu'),
    desc: say('Ile różnych ćwiczeń poszło jako przekąska.', 'How many different exercises you’ve done as a snack.'),
    quip: say('Karta dań dłuższa niż w barze mlecznym.', 'A longer menu than your local café.'),
    unit: say('ćwiczeń', 'exercises'),
    tiers: [3, 7, 15, 30],
    value: (c) => c.metrics.snacks.distinct,
  },

  /*
   * ---------------- Kroki i cardio ----------------
   *
   * Liczą kroki, kilometry, zajęcia i minuty ruchu, nigdy kalorie. Kalorie rosną z masą ciała, więc
   * odznaka za nie przychodziłaby szybciej temu, kto waży więcej — a waga to ostatnia rzecz,
   * za którą aplikacja ma kogoś nagradzać albo karać.
   */
  {
    id: 'kroki', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'cardio',
    mark: '',
    art: 'fig-carry',
    name: say('Kroki w nogach', 'Steps walked'),
    desc: say(
      'Wszystkie kroki wpisane z telefonu albo zegarka, z całej historii.',
      'All the steps logged from your phone or watch, across your whole history.',
    ),
    quip: say(
      'Telefon liczył, nogi robiły. Podział pracy jak w dobrym stadzie.',
      'The phone counted, the legs did the work. Division of labour, like in a good troop.',
    ),
    unit: say('kroków', 'steps'),
    tiers: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000],
    value: (c) => c.metrics.cardio.steps,
  },
  {
    id: 'kroki-dzien', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'cardio',
    mark: '24H',
    name: say('Dzień na nogach', 'Day on your feet'),
    desc: say(
      'Najwięcej kroków w jednym dniu, z wpisu z telefonu albo zegarka.',
      'The most steps in one day, from your phone or watch.',
    ),
    quip: say('Dzień, w którym winda czuła się niepotrzebna.', 'A day the lift felt unwanted.'),
    unit: say('kroków', 'steps'),
    tiers: [5_000, 7_500, 10_000, 15_000, 20_000, 30_000],
    value: (c) => c.metrics.cardio.bestDaySteps,
  },
  {
    id: 'kroki-cel', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'cardio',
    mark: '',
    art: 'circleCheck',
    name: say('Osiem tysięcy', 'Eight thousand'),
    desc: say(
      'Dni z co najmniej 8 000 kroków. Według badań korzyść dla zdrowia rośnie mniej więcej do tego miejsca, a dalej już wolniej.',
      'Days with at least 8,000 steps. Research shows the health benefit grows roughly up to this point, and more slowly after it.',
    ),
    quip: say(
      'Dziesięć tysięcy wymyśliła reklama krokomierza. Osiem tysięcy — badania.',
      'Ten thousand came from a pedometer advert. Eight thousand came from research.',
    ),
    unit: say('dni', 'days'),
    tiers: [1, 7, 30, 90, 180, 365, 730],
    value: (c) => c.metrics.cardio.goalDays,
  },
  {
    id: 'cardio-sesje',
    group: 'cardio',
    mark: '',
    art: 'stopwatch',
    name: say('Bieżnia i rower', 'Treadmill and bike'),
    desc: say(
      'Wyjścia na bieżnię albo rower trwające co najmniej dziesięć minut.',
      'Treadmill or bike sessions of at least ten minutes.',
    ),
    quip: say('Bieżnia kręci się w miejscu. Forma już nie.', 'The treadmill goes nowhere. Your fitness doesn’t.'),
    unit: say('wyjść', 'sessions'),
    tiers: [1, 10, 25, 50, 100, 200, 400],
    value: (c) => c.metrics.cardio.sessions,
  },
  {
    id: 'taniec',
    group: 'cardio',
    mark: '',
    art: 'note',
    name: say('Na parkiecie', 'On the dance floor'),
    desc: say(
      'Zajęcia tańca w parze albo solo trwające co najmniej dziesięć minut.',
      'Partner or solo dance classes of at least ten minutes.',
    ),
    quip: say('Instruktor liczył do ośmiu. Ty liczysz zajęcia.', 'The instructor counted to eight. You count classes.'),
    unit: say('zajęć', 'classes'),
    tiers: [1, 5, 10, 25, 50, 100, 200],
    value: (c) => c.metrics.cardio.dances,
  },
  {
    id: 'cardio-dystans',
    group: 'cardio',
    mark: '',
    art: 'ruler',
    name: say('Kilometry', 'Kilometres'),
    desc: say(
      'Droga z kroków, bieżni i roweru na zewnątrz, w pełnych kilometrach. Rower stacjonarny z mocą drogi nie ma.',
      'Distance from steps, the treadmill and outdoor rides, in whole kilometres. A stationary bike logged by power has no distance.',
    ),
    quip: say(
      'Gdyby iść w jedną stronę, za plecami zostałoby już inne województwo.',
      'Walk it all in one direction and you’d have left another county behind.',
    ),
    unit: 'km',
    tiers: [10, 50, 100, 250, 500, 1_000, 2_500, 5_000],
    value: (c) => c.metrics.cardio.km,
  },
  {
    id: 'cardio-who',
    group: 'cardio',
    mark: '',
    art: 'calendarCheck',
    name: say('Tydzień według WHO', 'WHO week'),
    desc: say(
      'Tygodnie od poniedziałku do niedzieli ze 150 minutami ruchu umiarkowanego z kroków, bieżni, roweru i tańca. Minuta intensywna liczy się podwójnie.',
      'Monday-to-Sunday weeks with 150 minutes of moderate movement from steps, treadmill, bike and dance. A vigorous minute counts double.',
    ),
    quip: say(
      'Zalecenie odhaczone. Rzadki przypadek, gdy urzędowa tabelka ma rację.',
      'Guideline ticked off. A rare case of an official table being right.',
    ),
    unit: say('tygodni', 'weeks'),
    tiers: [1, 4, 12, 26, 52, 104],
    value: (c) => c.metrics.cardio.whoWeeks,
  },
  {
    id: 'cardio-ciag',
    group: 'cardio',
    mark: '',
    art: 'wave',
    name: say('Dzień po dniu', 'Day after day'),
    desc: say(
      'Najdłuższy ciąg dni z rzędu z co najmniej 20 minutami ruchu — z kroków ponad 5 000, bieżni, roweru albo tańca.',
      'Your longest run of days with at least 20 minutes of movement — from steps above 5,000, treadmill, bike or dance.',
    ),
    quip: say(
      'Codziennie kawałek drogi. Suma robi się sama.',
      'A bit of distance every day. The total takes care of itself.',
    ),
    unit: say('dni', 'days'),
    tiers: [3, 7, 14, 30, 60, 100, 200, 365],
    value: (c) => c.metrics.cardio.run,
  },

  /*
   * ---------------- Czas na treningu ----------------
   *
   * Z zegara sesji, tylko z treningów od 3 minut do 4 godzin. Żadna rodzina nie nagradza
   * krótkiego treningu: w treningu siłowym przerwa nie jest dźwignią postępu (`rests.ts`),
   * a odznaka za szybkość pchałaby do ucinania przerw. Jedyna „szybkość”, za którą coś jest,
   * to płynne przejścia między ćwiczeniami — czas, którego nikt nie zalecał.
   */
  {
    id: 'czas-suma',
    group: 'czas',
    mark: '',
    art: 'hourglass',
    name: say('Godziny na treningu', 'Hours of training'),
    desc: say(
      'Czas wszystkich treningów z zegarem, od „Zaczynam” do zamknięcia. Trening krótszy niż 3 minuty albo dłuższy niż 4 godziny się nie liczy.',
      'The time of all your timed workouts, from start to finish. A workout shorter than 3 minutes or longer than 4 hours doesn’t count.',
    ),
    quip: say(
      'Godziny, których nie zjadł serial. Serial nie protestował.',
      'Hours the box set didn’t eat. The box set didn’t complain.',
    ),
    unit: say('minut', 'minutes'),
    tiers: [60, 300, 600, 1_500, 3_000, 6_000, 15_000, 30_000],
    value: (c) => c.metrics.time.minutes,
    fmt: hours,
  },
  {
    id: 'czas-tydzien',
    group: 'czas',
    mark: '',
    art: 'calendarCheck',
    name: say('Dwie godziny w tygodniu', 'Two hours a week'),
    desc: say(
      'Tygodnie od poniedziałku do niedzieli z co najmniej 120 minutami treningu z zegarem — z jednego albo kilku treningów.',
      'Monday-to-Sunday weeks with at least 120 minutes of timed training — from one workout or several.',
    ),
    quip: say(
      'Dwie godziny z poniedziałku do niedzieli. Krócej niż jeden długi film.',
      'Two hours from Monday to Sunday. Shorter than one long film.',
    ),
    unit: say('tygodni', 'weeks'),
    tiers: [1, 4, 12, 26, 52, 104],
    value: (c) => c.metrics.time.weeks120,
  },
  {
    id: 'czas-plynnie',
    group: 'czas',
    mark: '',
    art: 'wave',
    name: say('Bez przestojów', 'No downtime'),
    desc: say(
      'Treningi z zegarem i co najmniej trzema częściami, w których każde przejście — od końca jednego ćwiczenia do „Start” następnego — trwało do 4 minut. Przerwy między seriami się nie liczą.',
      'Timed workouts with at least three parts where every changeover — from the end of one exercise to “Start” on the next — took 4 minutes at most. Rests between sets don’t count.',
    ),
    quip: say(
      'Przerwa jest w planie. Przewijanie telefonu między ćwiczeniami — już nie.',
      'Rest is in the plan. Scrolling your phone between exercises isn’t.',
    ),
    unit: say('treningów', 'workouts'),
    tiers: [1, 5, 15, 30, 60, 100],
    value: (c) => c.metrics.time.smooth,
  },
  {
    id: 'czas-rekord',
    group: 'czas',
    mark: '',
    art: 'stopwatch',
    name: say('Najdłuższy trening', 'Longest workout'),
    desc: say(
      'Najdłuższy pojedynczy trening z zegarem, w minutach. Ponad 4 godziny to zwykle zapomniane zamknięcie, więc się nie liczy.',
      'Your longest single timed workout, in minutes. Over 4 hours usually means someone forgot to finish it, so it doesn’t count.',
    ),
    quip: say(
      'Długo nie znaczy lepiej. Znaczy, że tym razem nikt cię nie poganiał.',
      'Longer doesn’t mean better. It means nobody rushed you this time.',
    ),
    unit: say('minut', 'minutes'),
    tiers: [30, 45, 60, 90, 120],
    value: (c) => c.metrics.time.longest,
    fmt: (n) => `${n} min`,
  },

  /* ---------------- Terminy: kalendarz planu ---------------- */
  {
    id: 'seria', // i18n-ignore: identyfikator odznaki — klucz w zapisie
    group: 'terminy',
    mark: '',
    art: 'chain',
    name: say('Seria w terminie', 'On-time streak'),
    desc: say(
      'Terminy z rzędu zrobione co do dnia. Nadrobienie serii nie przedłuża.',
      'Deadlines in a row done on the day. Catching up doesn’t extend the streak.',
    ),
    quip: say(
      'Terminy dotrzymane co do dnia. Kalendarz milczy z szacunku.',
      'Deadlines met to the day. The calendar keeps a respectful silence.',
    ),
    unit: say('terminów', 'deadlines'),
    tiers: [3, 10, 25, 50, 75, 100],
    value: (c) => c.stats?.bestStreak ?? 0,
  },
  {
    id: 'bez-pudla',
    group: 'terminy',
    mark: '',
    art: 'circleCheck',
    name: say('Bez pudła', 'No misses'),
    desc: say(
      'Terminy z rzędu nieopuszczone. Nadrobienie w oknie łaski się liczy.',
      'Deadlines in a row not missed. Catching up within the grace window counts.',
    ),
    quip: say(
      'Ani jednego pominiętego terminu. Podejrzanie dobrze.',
      'Not a single missed deadline. Suspiciously good.',
    ),
    unit: say('terminów', 'deadlines'),
    tiers: [5, 10, 20, 40, 60, 100],
    value: (c) => c.stats?.alive ?? 0,
  },
  {
    id: 'czysty-tydzien',
    group: 'terminy',
    mark: '',
    art: 'calendarCheck',
    name: say('Czysty tydzień', 'Clean week'),
    desc: say(
      'Tygodnie planu domknięte w komplecie, bez ani jednego opuszczonego terminu.',
      'Plan weeks completed in full, without a single missed deadline.',
    ),
    quip: say('Tydzień bez dziury w planie. Bywa i tak.', 'A week with no holes in the plan. It does happen.'),
    unit: say('tygodni', 'weeks'),
    tiers: [1, 4, 12, 24, 52],
    value: (c) => (c.schedule ? countCleanWeeks(c.schedule.days) : 0),
  },
  {
    id: 'nadrabiacz',
    group: 'terminy',
    mark: '',
    art: 'rewind',
    name: say('Nadrabiacz', 'Catch-up artist'),
    desc: say('Zaległe terminy domknięte w ciągu dwóch dni.', 'Overdue deadlines done within two days.'),
    quip: say('Spóźnione, ale zrobione. Liczy się drugie słowo.', 'Late, but done. The last word is what counts.'),
    unit: say('razy', 'times'),
    tiers: [1, 5, 15, 30],
    value: (c) =>
      c.schedule
        ? c.schedule.days.filter((d) => d.status === 'done' && d.late >= 1 && d.late <= 2).length
        : 0,
  },
  {
    id: 'punktualny',
    group: 'terminy',
    mark: '',
    art: 'check',
    name: say('Punktualny', 'Punctual'),
    desc: say(
      'Realizacja co najmniej 90% przy minimum dwunastu rozstrzygniętych terminach.',
      'At least 90% done, with a minimum of twelve deadlines settled.',
    ),
    quip: say('Dziewięćdziesiąt procent. Zegarek by pozazdrościł.', 'Ninety per cent. A watch would be jealous.'),
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.elapsed >= 12 && (c.stats.adherence ?? 0) >= 90),
  },
  {
    id: 'polowa',
    group: 'terminy',
    mark: '',
    art: 'half',
    name: say('Półmetek', 'Halfway'),
    desc: say('Połowa terminów planu zrobiona.', 'Half the plan’s deadlines done.'),
    quip: say('Półmetek. Druga połowa zwykle idzie szybciej.', 'Halfway. The second half usually goes faster.'),
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.total > 0 && c.stats.done >= c.stats.total / 2),
  },
  {
    id: 'plan-zamkniety',
    group: 'terminy',
    mark: '',
    art: 'trophy',
    name: say('Plan zamknięty', 'Plan complete'),
    desc: say('Wszystkie terminy planu zrobione.', 'Every deadline in the plan done.'),
    quip: say(
      'Plan domknięty w całości. Rzadszy okaz niż się wydaje.',
      'Plan completed in full. A rarer specimen than you’d think.',
    ),
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.total > 0 && c.stats.done === c.stats.total),
  },
];

/** Rodziny ogólne. Odznaki ćwiczeń stoją osobno, bo jest ich po cztery na każdy ruch. */
export const ACHIEVEMENTS: Achievement[] = DEFS;

/** Wszystkie rodziny, łącznie z odznakami ćwiczeń — pod zdobywanie i formatowanie. */
const EVERY: AchDef[] = [...DEFS, ...EX_DEFS];
const BY_ID = new Map<string, AchDef>(EVERY.map((d) => [d.id, d]));

export const GROUP_LABEL: Record<Achievement['group'], string> = text({
  pl: {
    dorobek: 'Dorobek',
    partie: 'Partie ruchu',
    szczyty: 'Szczyty',
    utrzymanie: 'Utrzymanie',
    przekaski: 'Przekąski ruchowe',
    cardio: 'Kroki i cardio',
    czas: 'Czas na treningu',
    terminy: 'Terminy',
    cwiczenia: 'Ćwiczenia',
  },
  en: {
    dorobek: 'Lifetime',
    partie: 'Movement patterns',
    szczyty: 'Peaks',
    utrzymanie: 'Keeping it up',
    przekaski: 'Exercise snacks',
    cardio: 'Steps & cardio',
    czas: 'Time training',
    terminy: 'Deadlines',
    cwiczenia: 'Exercises',
  },
});

export const GROUP_NOTE: Record<Achievement['group'], string> = text({
  pl: {
    dorobek: 'Sumy z całej historii treningów. Rosną same, dopóki trenujesz.',
    partie: 'Objętość w rozbiciu na wzorce ruchowe. Widać, co jest zaniedbane.',
    szczyty:
      'Rekordy pojedynczych podejść i przesuwanego okna — dowolne siedem, trzydzieści, dziewięćdziesiąt, sto osiemdziesiąt czy trzysta sześćdziesiąt pięć dni z rzędu.',
    utrzymanie: 'Nie o to, ile urosło, tylko o to, że nic się nie osypało.',
    przekaski: 'Krótkie serie poza treningiem. Liczy się, jak często — nie ile naraz.',
    cardio:
      'Kroki, bieżnia, rower i taniec wpisane ręcznie. Liczą się kroki, kilometry, zajęcia i minuty ruchu według zaleceń WHO — nie kalorie, bo te rosną razem z wagą.',
    czas:
      'Liczone z treningów z zegarem, od „Zaczynam” do zamknięcia. Krótszy niż 3 minuty i dłuższy niż 4 godziny się nie liczy — to zwykle zapomniane zamknięcie. Żadna odznaka nie nagradza krótkiego treningu, bo przerwa nie jest dźwignią postępu; nagradzane są tylko płynne przejścia między ćwiczeniami.',
    terminy: 'Zależne od uruchomionego planu i jego kalendarza.',
    cwiczenia:
      'Każde ćwiczenie ma rekord dnia, tygodnia i miesiąca kalendarzowego oraz sumę — z treningów i przekąsek razem. Widać tylko ruchy, które już robisz.',
  },
  en: {
    dorobek: 'Totals from your whole training history. They keep growing as long as you train.',
    partie: 'Volume split by movement pattern. You can see what’s being neglected.',
    szczyty:
      'Records for single efforts and for a sliding window — any seven, thirty, ninety, hundred and eighty or three hundred and sixty-five days in a row.',
    utrzymanie: 'Not about how much has grown, but about nothing slipping.',
    przekaski: 'Short sets outside a workout. How often counts — not how much at once.',
    cardio:
      'Steps, treadmill, bike and dance logged by hand. Steps, kilometres, classes and movement minutes by the WHO guidelines count — not calories, because those rise with body weight.',
    czas:
      'Counted from timed workouts, from start to finish. Shorter than 3 minutes or longer than 4 hours doesn’t count — that’s usually a workout someone forgot to finish. No badge rewards a short workout, because rest isn’t what drives progress; only smooth changeovers between exercises are rewarded.',
    terminy: 'Depend on the plan you’re running and its calendar.',
    cwiczenia:
      'Every exercise has a day, week and calendar-month record and a total — from workouts and exercise snacks together. Only moves you already do are shown.',
  },
});

/** Grupy rozwijane w zakładce. Odznaki ćwiczeń mają własny układ — po ćwiczeniu, nie po rodzinie. */
export const GROUPS: Achievement['group'][] = [
  'dorobek',
  'partie',
  'szczyty',
  'utrzymanie',
  'przekaski',
  'cardio',
  'czas',
  'terminy',
];

export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id);

/** Klucz w trwałym dorobku. Progi numerowane od jedynki. */
export const tierKey = (id: string, tier: number): string => `${id}:${tier}`;

/**
 * Sama liczba, bez rzeczownika: tonaż w tonach, czas w minutach, reszta gołą liczbą.
 * Potrzebna wszędzie tam, gdzie liczebnik nie stoi w dopełniaczu — „brakuje 4 powtórzeń”
 * jest poprawne, ale „4 powtórzeń do celu” już nie, a odmiana zależy od ostatniej cyfry.
 */
export function formatValue(a: Achievement, n: number): string {
  const def = BY_ID.get(a.id);
  return def?.fmt ? def.fmt(n) : n.toLocaleString(LOCALE);
}

/**
 * Sformatowany próg razem z jednostką. Rzeczownik stoi w dopełniaczu liczby mnogiej, bo
 * pada zawsze po przyimku „z” („z 200 powtórzeń”), gdzie ta forma jest poprawna dla
 * każdego liczebnika.
 */
export function formatTier(a: Achievement, n: number): string {
  const def = BY_ID.get(a.id);
  if (def?.fmt) return def.fmt(n);
  if (!a.unit) return n.toLocaleString(LOCALE);
  return `${n.toLocaleString(LOCALE)} ${n === 1 ? (UNIT_ONE[a.unit] ?? a.unit) : a.unit}`;
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
  /**
   * Wartość w bieżącym dniu, tygodniu albo miesiącu — tylko dla rekordów okresu. Dla sum
   * i reszty rodzin `null`: tam liczy się wartość z całej historii.
   */
  current: number | null;
}

const rowFor = (d: AchDef, ctx: AchCtx): AchProgress => {
  const value = d.value(ctx);
  const tier = d.tiers.filter((t) => value >= t).length;
  const next = d.tiers[tier] ?? null;
  const from = tier > 0 ? d.tiers[tier - 1]! : 0;
  const current = d.current ? d.current(ctx) : null;
  // Rekord okresu goni się w jednym okresie: pasek mierzy to, co jest teraz, od zera.
  const progress =
    next === null
      ? 1
      : current !== null
        ? Math.min(1, Math.max(0, current / next))
        : Math.min(1, Math.max(0, (value - from) / (next - from)));
  return {
    ach: d,
    value,
    tier,
    next,
    progress,
    at: tier > 0 ? (ctx.state.award.badges[tierKey(d.id, tier)] ?? null) : null,
    current,
  };
};

/** Stan rodzin ogólnych na dziś — do ekranu i do modala z nowościami. */
export function achievementProgress(ctx: AchCtx): AchProgress[] {
  return DEFS.map((d) => rowFor(d, ctx));
}

/** Cztery rodziny jednego ćwiczenia: dzień, tydzień, miesiąc i suma. */
export function exerciseProgress(ctx: AchCtx, id: string): AchProgress[] {
  return EX_DEFS.filter((d) => d.ex === id).map((d) => rowFor(d, ctx));
}

/** Ćwiczenia, które już się pojawiły — w treningu albo jako przekąska — od najczęstszego. */
export const touchedExercises = (ctx: AchCtx): string[] =>
  Object.entries(ctx.metrics.perEx)
    .filter(([id, v]) => v.total > 0 && EX_DEFS.some((d) => d.ex === id))
    .sort((a, b) => b[1].sessions + b[1].snacks - (a[1].sessions + a[1].snacks) || a[0].localeCompare(b[0]))
    .map(([id]) => id);

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

  EVERY.forEach((d) => {
    const value = d.value(ctx);
    d.tiers.forEach((threshold, i) => {
      const tier = i + 1;
      const key = tierKey(d.id, tier);
      if (state.award.badges[key] || value < threshold) return;
      state.award.badges[key] = ctx.today;
      fresh.push({ ach: d, tier, threshold });
      // Odznaki ćwiczeń nie idą do dziennika planu: jest ich po cztery na ruch i po imporcie
      // historii zasypałyby dziennik, w którym mają być terminy. Widać je przy ćwiczeniu.
      if (d.group === 'cwiczenia') return;
      state.events.push({ id: `badge:${key}`, date: ctx.today, kind: 'badge', ...badgeWords(d, tier, threshold) });
    });
  });

  return fresh;
}

const badgeWords = (d: Achievement, tier: number, threshold: number): Pick<PlanEvent, 'title' | 'text'> => ({
  title: T.eventTitle(d.name, d.tiers.length > 1 ? ` ${tier}` : ''),
  text: T.eventText(d.desc, formatTier(d, threshold)),
});

/**
 * Wpis odznaki w dzienniku planu słowami tej wizyty. Zapisany tytuł ma język chwili zdobycia,
 * a klucz (`badge:<odznaka>:<próg>`) wskazuje odznakę w katalogu — po zmianie języka dziennik
 * mówi jednym językiem. Wpis, którego katalog nie zna (odznaka wycofana), zostaje jak był.
 */
export function badgeEventNow(e: PlanEvent): PlanEvent {
  if (e.kind !== 'badge') return e;
  const m = e.id.match(/^badge:(.+):(\d+)$/);
  const d = m ? achievementById(m[1]!) : undefined;
  const tier = Number(m?.[2]);
  const threshold = d?.tiers[tier - 1];
  return d && threshold !== undefined ? { ...e, ...badgeWords(d, tier, threshold) } : e;
}

/**
 * Cofa progi, których historia już nie uzasadnia — tylko w rodzinach wskazanych filtrem.
 *
 * Dziennik treningów jest dopisywany, nigdy kasowany, więc tam zdobyty próg zawsze ma pokrycie.
 * Przekąskę da się usunąć: gdyby jej progi zostawały, literówka „150” zamiast „15” dawałaby
 * odznakę i doświadczenie na zawsze, a ekran pokazywałby ten sam próg jako niezdobyty. Usunięcie
 * przekąski jest poprawką pomyłki, więc cofa to, co ta pomyłka dała. Zwraca liczbę cofniętych.
 */
export function revokeUnmet(state: AppState, ctx: AchCtx, only: (d: AchDef) => boolean): number {
  let n = 0;
  EVERY.filter(only).forEach((d) => {
    const value = d.value(ctx);
    d.tiers.forEach((threshold, i) => {
      const key = tierKey(d.id, i + 1);
      if (!state.award.badges[key] || value >= threshold) return;
      delete state.award.badges[key];
      state.events = state.events.filter((e) => e.id !== `badge:${key}`);
      n++;
    });
  });
  return n;
}

/**
 * Przeniesienie odznak sprzed wprowadzenia progów. Klucze były wtedy gołymi nazwami,
 * a część odznak stała się progiem większej rodziny — kto je miał, ma je dalej.
 */
const LEGACY: Record<string, string> = {
  'pierwszy-krok': 'treningi:1', // i18n-ignore: stary i nowy klucz odznaki
  setka: 'treningi:5', // i18n-ignore: stary i nowy klucz odznaki
  'seria-3': 'seria:1', // i18n-ignore: stary i nowy klucz odznaki
  'seria-10': 'seria:2', // i18n-ignore: stary i nowy klucz odznaki
  'seria-25': 'seria:3', // i18n-ignore: stary i nowy klucz odznaki
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
