import { ALL } from '../data/exercises';
import type { Achievement, AchievementHit, AppState } from '../types';
import type { PlanStats, Schedule } from './schedule';
import { metrics } from './metrics';
import type { Metrics } from './metrics';
import { countCleanWeeks } from './score';
import { EX_DEFS } from './exbadges';

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

/**
 * Rodzina objętości dla jednej partii ruchu. Nazwa partii przychodzi z biblioteki ćwiczeń,
 * ale identyfikator jest wpisany na sztywno, bo to klucz w trwałym dorobku — gdyby brał się
 * z nazwy, jedna literówka w bibliotece kasowałaby komuś zdobyte progi.
 */
const GROUP_QUIPS: Record<string, string> = {"zawias": "Plecy proste, biodra do tyłu, sąsiad zaniepokojony.", "przysiad": "Schody przestały być wyzwaniem. Krzesło bywa.", "ciagniecie": "Ciągnięcie do siebie. Jedyny rodzaj, który wypada.", "pchanie": "Odpychanie świata od siebie, seria po serii.", "cale-cialo": "Ćwiczenia, po których nie wiadomo, co boli. Wszystko.", "core": "Brzuch widać latem, robi się go zimą.", "nogi": "Dzień nóg. Ten, który wszyscy pomijają oprócz ciebie."};

const groupFamily = (
  id: string,
  group: string,
  art: string,
  name: string,
  tiers: number[],
): AchDef => ({
  id,
  group: 'partie',
  mark: '',
  art,
  name,
  desc: `Powtórzenia z partii „${group}”. Ćwiczenia liczone na czas nie wchodzą.`,
  quip: GROUP_QUIPS[id] ?? '',
  unit: 'powtórzeń',
  tiers,
  value: (c) => c.metrics.byGroup[group] ?? 0,
});

const DEFS: AchDef[] = [
  /* ---------------- Dorobek: sumy z całej historii ---------------- */
  {
    id: 'treningi',
    group: 'dorobek',
    mark: '',
    art: 'fig-carry',
    name: 'Zapisane treningi',
    desc: 'Suma zamkniętych sesji. Pierwsza jest najtrudniejsza, tysięczna najrzadsza.',
    quip: 'Pierwszy jest najtrudniejszy. Reszta tylko boli.',
    unit: 'treningów',
    tiers: [1, 10, 25, 50, 100, 250, 500, 1_000, 2_000],
    value: (c) => c.metrics.workouts,
  },
  {
    id: 'powtorzenia',
    group: 'dorobek',
    mark: '',
    art: 'fig-swing',
    name: 'Powtórzenia',
    desc: 'Suma powtórzeń z całej historii. Ćwiczenia na stronę liczą się dwa razy.',
    quip: 'Nikt ich nie liczył oprócz ciebie i tej aplikacji.',
    unit: 'powtórzeń',
    tiers: [500, 2_000, 10_000, 25_000, 50_000, 100_000, 200_000, 350_000, 500_000, 1_000_000],
    value: (c) => c.metrics.reps,
  },
  {
    id: 'serie',
    group: 'dorobek',
    mark: '',
    art: 'fig-squat',
    name: 'Serie',
    desc: 'Każda seria z wpisanym wynikiem to jedna sztuka.',
    quip: 'Każda seria to osobna decyzja, żeby nie usiąść.',
    unit: 'serii',
    tiers: [100, 500, 1_500, 4_000, 10_000, 20_000, 40_000, 75_000],
    value: (c) => c.metrics.sets,
  },
  {
    id: 'cwiczenia',
    group: 'dorobek',
    mark: '',
    art: 'fig-press',
    name: 'Wykonane ćwiczenia',
    desc: 'Jedno ćwiczenie w jednej sesji to jedna sztuka.',
    quip: 'Statystycznie rzecz biorąc, sporo się naklepałeś.',
    unit: 'sztuk',
    tiers: [50, 250, 1_000, 3_000, 8_000, 15_000, 30_000],
    value: (c) => c.metrics.exercises,
  },
  {
    id: 'tonaz',
    group: 'dorobek',
    mark: '',
    art: 'fig-hinge',
    name: 'Tonaż',
    desc: 'Ciężar razy powtórzenia, zsumowany przez całą historię.',
    quip: 'Grawitacja próbowała. Grawitacja przegrała.',
    tiers: [10_000, 50_000, 200_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000],
    value: (c) => c.metrics.tonnage,
    fmt: kg,
  },
  {
    id: 'czas',
    group: 'dorobek',
    mark: '',
    art: 'fig-plank',
    name: 'Czas pod obciążeniem',
    desc: 'Sekundy z ćwiczeń liczonych na czas: spacery farmera i deska.',
    quip: 'Czas stania z ciężarem i udawania, że wszystko gra.',
    tiers: [600, 3_000, 10_000, 30_000, 60_000, 120_000, 250_000],
    value: (c) => c.metrics.secs,
    fmt: mins,
  },
  {
    id: 'atlas',
    group: 'dorobek',
    mark: '',
    art: 'fig-pull',
    name: 'Poznany atlas',
    desc: 'Ile różnych ćwiczeń w ogóle się pojawiło w historii. Ostatni próg to cała biblioteka.',
    quip: 'Biblioteka przerobiona. Bibliotekarz dumny.',
    unit: 'ćwiczeń',
    // Ostatni próg liczony z biblioteki, żeby nie rozjechał się przy kolejnym rozszerzeniu atlasu.
    tiers: [5, 10, 20, 35, 55, 80, ALL.length],
    value: (c) => c.metrics.distinct,
  },

  /* ---------------- Partie ruchu ---------------- */
  groupFamily('zawias', 'Zawias biodrowy', 'fig-hinge', 'Zawias biodrowy', [
    500, 2_500, 5_000, 10_000, 25_000, 50_000,
  ]),
  groupFamily('przysiad', 'Przysiad', 'fig-squat', 'Przysiad', [300, 1_500, 3_000, 6_000, 12_000, 25_000]),
  groupFamily('ciagniecie', 'Ciągnięcie', 'fig-row', 'Ciągnięcie', [
    300, 1_500, 3_000, 6_000, 12_000, 25_000,
  ]),
  groupFamily('pchanie', 'Pchanie', 'fig-pushup', 'Pchanie', [300, 1_500, 3_000, 6_000, 12_000, 25_000]),
  groupFamily('cale-cialo', 'Całe ciało', 'fig-swing', 'Całe ciało', [
    100, 500, 1_200, 2_500, 5_000, 10_000,
  ]),
  groupFamily('core', 'Core i carry', 'fig-plank', 'Core', [200, 1_000, 2_500, 5_000, 10_000, 20_000]),
  groupFamily('nogi', 'Nogi — dodatkowe', 'fig-calf', 'Nogi dodatkowo', [
    300, 1_500, 3_000, 6_000, 12_000, 25_000,
  ]),

  /* ---------------- Szczyty: rekordy pojedynczych podejść ---------------- */
  {
    id: 'najciezszy',
    group: 'szczyty',
    mark: '',
    art: 'kettlebell',
    name: 'Najcięższy ciężar',
    desc: 'Najcięższe obciążenie, jakie w ogóle pojawiło się w zapisanej serii.',
    quip: 'Ciężar, który kiedyś wydawał się nie do ruszenia.',
    tiers: [8, 12, 16, 20, 24, 32, 40, 60, 80, 100, 140],
    value: (c) => c.metrics.heaviest,
    fmt: (n) => `${n} kg`,
  },
  {
    id: 'maksimum',
    group: 'szczyty',
    mark: '',
    art: 'ruler',
    name: 'Szacowane maksimum',
    desc: 'Najwyższy szacowany ciężar na jedno powtórzenie, wzorem Epleya z twoich serii.',
    quip: 'Liczba wyliczona wzorem. Wzór w ciebie wierzy.',
    tiers: [20, 30, 40, 50, 60, 80, 100],
    value: (c) => c.metrics.e1rm,
    fmt: (n) => `${n} kg`,
  },
  {
    id: 'seria-rekord',
    group: 'szczyty',
    mark: '',
    art: 'fig-dip',
    name: 'Najdłuższa seria',
    desc: 'Najwięcej powtórzeń w jednej serii bez przerwy.',
    quip: 'Moment, w którym przestało się liczyć, a zaczęło wytrzymywać.',
    unit: 'powtórzeń',
    tiers: [20, 30, 50, 75, 100, 150],
    value: (c) => c.metrics.best.set,
  },
  {
    id: 'podchod',
    group: 'szczyty',
    mark: '',
    art: 'hourglass',
    name: 'Najdłuższy podchód',
    desc: 'Najdłuższy pojedynczy spacer albo trzymanie na czas.',
    quip: 'Stanie w miejscu jako dyscyplina sportowa.',
    tiers: [60, 120, 180, 300],
    value: (c) => c.metrics.best.hold,
    fmt: mins,
  },
  {
    id: 'sesja-tonaz',
    group: 'szczyty',
    mark: '',
    art: 'plate',
    name: 'Najcięższa sesja',
    desc: 'Największy tonaż w jednym treningu.',
    quip: 'Jedna sesja, a magazyn jak po przeprowadzce.',
    tiers: [500, 1_500, 3_000, 6_000, 10_000, 15_000],
    value: (c) => c.metrics.best.sessionTonnage,
    fmt: kg,
  },

  /* ---------------- Szczyty: rekord z okna czasu ---------------- */
  {
    id: 'dzien-powtorzenia',
    group: 'szczyty',
    mark: '24H',
    name: 'Najlepszy dzień',
    desc: 'Najwięcej powtórzeń w jednej dobie.',
    quip: 'Doba, po której schody wydawały się złośliwe.',
    unit: 'powtórzeń',
    tiers: [100, 200, 350, 500, 700, 1_000],
    value: (c) => c.metrics.best.dayReps,
  },
  {
    id: 'dzien-serie',
    group: 'szczyty',
    mark: '24H',
    name: 'Dzień serii',
    desc: 'Najwięcej serii w jednej dobie, choćby z dwóch sesji.',
    quip: 'Tyle serii, że przerwy zaczęły się zlewać w jedną.',
    unit: 'serii',
    tiers: [10, 20, 30, 45, 60, 80],
    value: (c) => c.metrics.best.daySets,
  },
  {
    id: 'dzien-tonaz',
    group: 'szczyty',
    mark: '24H',
    name: 'Najcięższa doba',
    desc: 'Największy tonaż w jednym dniu, choćby z dwóch sesji.',
    quip: 'Jeden dzień, ciężar jak z listy przewozowej.',
    tiers: [1_000, 3_000, 6_000, 10_000, 16_000],
    value: (c) => c.metrics.best.dayTonnage,
    fmt: kg,
  },
  {
    id: 'tydzien-powtorzenia',
    group: 'szczyty',
    mark: '7D',
    name: 'Tydzień objętości',
    desc: 'Najwięcej powtórzeń w dowolnych siedmiu dniach z rzędu.',
    quip: 'Tydzień, w którym licznik nie nadążał.',
    unit: 'powtórzeń',
    tiers: [300, 600, 1_000, 1_800, 2_500, 3_500],
    value: (c) => c.metrics.best.weekReps,
  },
  {
    id: 'tydzien-serie',
    group: 'szczyty',
    mark: '7D',
    name: 'Tydzień serii',
    desc: 'Najwięcej serii w dowolnych siedmiu dniach.',
    quip: 'Siedem dni i stos serii, którego nikt nie zamawiał.',
    unit: 'serii',
    tiers: [20, 45, 80, 130, 200],
    value: (c) => c.metrics.best.weekSets,
  },
  {
    id: 'tydzien-treningi',
    group: 'szczyty',
    mark: '7D',
    name: 'Gęsty tydzień',
    desc: 'Najwięcej treningów w dowolnych siedmiu dniach.',
    quip: 'Tydzień, w którym siłownia zaczęła rozpoznawać twoją kurtkę.',
    unit: 'treningów',
    tiers: [2, 3, 4, 5, 6, 7],
    value: (c) => c.metrics.best.weekWorkouts,
  },
  {
    id: 'dwa-tygodnie',
    group: 'szczyty',
    mark: '14D',
    name: 'Dwa tygodnie treningów',
    desc: 'Najwięcej treningów w dowolnych czternastu dniach.',
    quip: 'Dwa tygodnie konsekwencji. Statystycznie rzadkie zjawisko.',
    unit: 'treningów',
    tiers: [4, 6, 8, 10, 12, 14],
    value: (c) => c.metrics.best.twoWeekWorkouts,
  },
  {
    id: 'dwa-tygodnie-powtorzenia',
    group: 'szczyty',
    mark: '14D',
    name: 'Dwa tygodnie objętości',
    desc: 'Najwięcej powtórzeń w dowolnych czternastu dniach.',
    quip: 'Czternaście dni i objętość, której nie chce się liczyć.',
    unit: 'powtórzeń',
    tiers: [600, 1_200, 2_000, 3_200, 5_000],
    value: (c) => c.metrics.best.twoWeekReps,
  },
  {
    id: 'trzy-tygodnie',
    group: 'szczyty',
    mark: '21D',
    name: 'Trzy tygodnie treningów',
    desc: 'Najwięcej treningów w dowolnych dwudziestu jeden dniach.',
    quip: 'Trzy tygodnie. Tyle podobno trwa budowanie nawyku.',
    unit: 'treningów',
    tiers: [6, 9, 12, 15, 18, 21],
    value: (c) => c.metrics.best.threeWeekWorkouts,
  },
  {
    id: 'trzy-tygodnie-powtorzenia',
    group: 'szczyty',
    mark: '21D',
    name: 'Trzy tygodnie objętości',
    desc: 'Najwięcej powtórzeń w dowolnych dwudziestu jeden dniach.',
    quip: 'Dwadzieścia jeden dni, jedna wielka suma.',
    unit: 'powtórzeń',
    tiers: [900, 1_800, 3_000, 5_000, 7_500],
    value: (c) => c.metrics.best.threeWeekReps,
  },
  {
    id: 'miesiac-treningi',
    group: 'szczyty',
    mark: '30D',
    name: 'Miesiąc treningów',
    desc: 'Najwięcej treningów w dowolnych trzydziestu dniach.',
    quip: 'Miesiąc, w którym karnet wreszcie na siebie zarobił.',
    unit: 'treningów',
    tiers: [8, 12, 16, 20, 24, 30],
    value: (c) => c.metrics.best.monthWorkouts,
  },
  {
    id: 'miesiac-powtorzenia',
    group: 'szczyty',
    mark: '30D',
    name: 'Miesiąc objętości',
    desc: 'Najwięcej powtórzeń w dowolnych trzydziestu dniach.',
    quip: 'Trzydzieści dni. Licznik zdążył się zmęczyć.',
    unit: 'powtórzeń',
    tiers: [1_200, 2_500, 4_500, 7_000, 10_000, 15_000],
    value: (c) => c.metrics.best.monthReps,
  },
  {
    id: 'miesiac-serie',
    group: 'szczyty',
    mark: '30D',
    name: 'Miesiąc serii',
    desc: 'Najwięcej serii w dowolnych trzydziestu dniach.',
    quip: 'Serie liczone już nie na sztuki, tylko na setki.',
    unit: 'serii',
    tiers: [80, 160, 280, 450, 650],
    value: (c) => c.metrics.best.monthSets,
  },
  {
    id: 'miesiac-cwiczenia',
    group: 'szczyty',
    mark: '30D',
    name: 'Miesiąc ćwiczeń',
    desc: 'Najwięcej wykonanych ćwiczeń w dowolnych trzydziestu dniach.',
    quip: 'Miesiąc przerabiania atlasu po kolei.',
    unit: 'sztuk',
    tiers: [40, 90, 160, 260, 400],
    value: (c) => c.metrics.best.monthExercises,
  },
  {
    id: 'miesiac-tonaz',
    group: 'szczyty',
    mark: '30D',
    name: 'Miesięczny tonaż',
    desc: 'Najcięższe trzydzieści dni z rzędu.',
    quip: 'Tonaż z jednego miesiąca. Magazynier by się zdziwił.',
    tiers: [5_000, 15_000, 40_000, 80_000, 150_000, 250_000],
    value: (c) => c.metrics.best.monthTonnage,
    fmt: kg,
  },
  {
    id: 'kwartal-treningi',
    group: 'szczyty',
    mark: '90D',
    name: 'Kwartał treningów',
    desc: 'Najwięcej treningów w dowolnych dziewięćdziesięciu dniach.',
    quip: 'Kwartał. Tyle wystarczy, żeby zauważyli inni.',
    unit: 'treningów',
    tiers: [20, 30, 40, 55, 70, 90],
    value: (c) => c.metrics.best.quarterWorkouts,
  },
  {
    id: 'kwartal-powtorzenia',
    group: 'szczyty',
    mark: '90D',
    name: 'Kwartał objętości',
    desc: 'Najwięcej powtórzeń w dowolnych dziewięćdziesięciu dniach.',
    quip: 'Trzy miesiące powtórzeń. Nuda robi robotę.',
    unit: 'powtórzeń',
    tiers: [2_000, 5_000, 10_000, 18_000, 30_000, 45_000],
    value: (c) => c.metrics.best.quarterReps,
  },
  {
    id: 'polrocze-treningi',
    group: 'szczyty',
    mark: '180',
    name: 'Półrocze treningów',
    desc: 'Najwięcej treningów w dowolnych stu osiemdziesięciu dniach.',
    quip: 'Pół roku. Już nie hobby, jeszcze nie osobowość.',
    unit: 'treningów',
    tiers: [40, 60, 80, 110, 140, 170],
    value: (c) => c.metrics.best.halfYearWorkouts,
  },
  {
    id: 'polrocze-powtorzenia',
    group: 'szczyty',
    mark: '180',
    name: 'Półrocze objętości',
    desc: 'Najwięcej powtórzeń w dowolnych stu osiemdziesięciu dniach.',
    quip: 'Sto osiemdziesiąt dni objętości bez fajerwerków.',
    unit: 'powtórzeń',
    tiers: [4_000, 10_000, 20_000, 35_000, 55_000, 80_000],
    value: (c) => c.metrics.best.halfYearReps,
  },
  {
    id: 'rok-treningi',
    group: 'szczyty',
    mark: '365',
    name: 'Rok treningów',
    desc: 'Najwięcej treningów w dowolnych trzystu sześćdziesięciu pięciu dniach.',
    quip: 'Rok. Można oficjalnie mówić „trenuję”.',
    unit: 'treningów',
    tiers: [75, 110, 150, 200, 260, 320],
    value: (c) => c.metrics.best.yearWorkouts,
  },
  {
    id: 'rok-powtorzenia',
    group: 'szczyty',
    mark: '365',
    name: 'Rok objętości',
    desc: 'Najwięcej powtórzeń w dowolnym roku liczonym od dowolnego dnia.',
    quip: 'Rok powtórzeń. Cierpliwość w formie liczby.',
    unit: 'powtórzeń',
    tiers: [8_000, 18_000, 35_000, 60_000, 100_000, 150_000],
    value: (c) => c.metrics.best.yearReps,
  },

  /* ---------------- Utrzymanie: poziom, który się nie osypuje ---------------- */
  {
    id: 'rytm',
    group: 'utrzymanie',
    mark: '',
    art: 'fig-walk',
    name: 'Utrzymany rytm',
    desc: 'Tygodnie z rzędu, w każdym co najmniej dwa treningi. Jeden pusty tydzień zeruje ciąg.',
    quip: 'Regularność jest nudna i dlatego działa.',
    unit: 'tygodni',
    tiers: [4, 8, 12, 26, 52, 78, 104],
    value: (c) => c.metrics.steadyWeeks,
  },
  {
    id: 'dni-z-rzedu',
    group: 'utrzymanie',
    mark: '',
    art: 'dots',
    name: 'Dni z rzędu',
    desc: 'Najdłuższy ciąg dni kalendarzowych z treningiem. Dzień przerwy zeruje ciąg.',
    quip: 'Dni z rzędu. Regeneracja prosi o głos.',
    unit: 'dni',
    tiers: [2, 3, 5, 7, 10, 14, 21],
    value: (c) => c.metrics.dayStreak,
  },
  {
    id: 'bez-cofniecia',
    group: 'utrzymanie',
    mark: '',
    art: 'shield',
    name: 'Bez cofnięcia',
    desc: 'Dni treningu bez ani jednego zejścia z ciężaru. Liczone do ostatniej sesji, nie do dzisiaj.',
    quip: 'Ani kroku w tył. Przynajmniej na papierze.',
    unit: 'dni',
    tiers: [30, 60, 120, 240, 365, 540, 730],
    value: (c) => c.metrics.noDropDays,
  },
  {
    id: 'forma',
    group: 'utrzymanie',
    mark: '',
    art: 'equals',
    name: 'Trzymana forma',
    desc: 'Ćwiczenia stojące w granicach 5% własnego szczytu. Miara utrzymania, nie wzrostu.',
    quip: 'Trzymanie poziomu. Niedoceniana konkurencja.',
    unit: 'ćwiczeń',
    tiers: [3, 6, 10, 20, 35, 55],
    value: (c) => c.metrics.heldForm,
  },
  {
    id: 'etapy',
    group: 'utrzymanie',
    mark: '',
    art: 'fig-pushup',
    name: 'Etapy z masą ciała',
    desc: 'Suma etapów w podciąganiu, pompkach i core. Jedyna miara, w której ciężar nie gra żadnej roli.',
    quip: 'Masa ciała, zero wymówek, brak sprzętu do obwiniania.',
    unit: 'etapów',
    tiers: [2, 4, 6, 9, 12],
    value: (c) => c.metrics.stages,
  },
  {
    id: 'powrot-do-formy',
    group: 'utrzymanie',
    mark: '',
    art: 'refresh',
    name: 'Powrót do poziomu',
    desc: 'Po przerwie od czternastu dni ciężar wrócił w miesiąc tam, gdzie był przed nią.',
    quip: 'Wrócić na swoje. Trudniejsze niż dojść tam pierwszy raz.',
    unit: 'razy',
    tiers: [1, 3, 6, 10],
    value: (c) => c.metrics.comebacks,
  },
  {
    id: 'zelazo',
    group: 'utrzymanie',
    mark: '',
    art: 'triangleUp',
    name: 'Żelazo',
    desc: 'Ćwiczenia, które przeszły na cięższe obciążenie i tam zostały.',
    quip: 'Kolejny ciężar przestał być straszny.',
    unit: 'ćwiczeń',
    tiers: [1, 3, 6, 12, 25, 40],
    value: (c) => c.metrics.heavier,
  },
  {
    id: 'ranny-ptaszek',
    group: 'utrzymanie',
    mark: '',
    art: 'sun',
    name: 'Ranny ptaszek',
    desc: 'Trening zamknięty przed ósmą rano.',
    quip: 'Przed ósmą. Siłownia pusta, sumienie czyste.',
    tiers: [1],
    value: (c) => yes(c.metrics.early),
  },
  {
    id: 'nocny-marek',
    group: 'utrzymanie',
    mark: '',
    art: 'moon',
    name: 'Nocny marek',
    desc: 'Trening zamknięty po dwudziestej pierwszej.',
    quip: 'Po dwudziestej pierwszej. Sąsiedzi wiedzą.',
    tiers: [1],
    value: (c) => yes(c.metrics.late),
  },

  /* ---------------- Przekąski ruchowe ---------------- */
  {
    id: 'przekaski',
    group: 'przekaski',
    mark: '',
    art: 'stopwatch',
    name: 'Przekąski ruchowe',
    desc: 'Krótkie serie zapisane poza treningiem. Jedna przekąska to jedna sztuka.',
    quip: 'Przerwy na nic stały się przerwami na coś.',
    unit: 'przekąsek',
    tiers: [1, 10, 30, 75, 150, 300, 600, 1_000],
    value: (c) => c.metrics.snacks.count,
  },
  {
    id: 'przekaski-dzien',
    group: 'przekaski',
    mark: '24H',
    name: 'Dzień w ruchu',
    desc: 'Najwięcej przekąsek w jednym dniu. Liczy się rozłożenie w czasie, nie jedna długa seria.',
    quip: 'Dzień, w którym krzesło widziało cię tylko przelotnie.',
    unit: 'przekąsek',
    tiers: [3, 5, 8, 12],
    value: (c) => c.metrics.snacks.bestDay,
  },
  {
    id: 'przekaski-ciag',
    group: 'przekaski',
    mark: '',
    art: 'wave',
    name: 'Codzienny ruch',
    desc: 'Najdłuższy ciąg dni z rzędu z co najmniej jedną przekąską. Dzień bez przekąski zeruje ciąg.',
    quip: 'Codziennie trochę. Nudne jak mycie zębów i równie skuteczne.',
    unit: 'dni',
    tiers: [3, 7, 14, 30, 60, 100, 200],
    value: (c) => c.metrics.snacks.run,
  },
  {
    id: 'przekaski-tydzien',
    group: 'przekaski',
    mark: '7D',
    name: 'Pełny tydzień w ruchu',
    desc: 'Tygodnie od poniedziałku do niedzieli z przekąską każdego dnia.',
    quip: 'Siedem dni, siedem okazji, siedem wykorzystanych.',
    unit: 'tygodni',
    tiers: [1, 4, 12, 26, 52],
    value: (c) => c.metrics.snacks.fullWeeks,
  },
  {
    id: 'przekaski-menu',
    group: 'przekaski',
    mark: '',
    art: 'book',
    name: 'Menu przekąsek',
    desc: 'Ile różnych ćwiczeń poszło jako przekąska.',
    quip: 'Karta dań dłuższa niż w barze mlecznym.',
    unit: 'ćwiczeń',
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
    id: 'kroki',
    group: 'cardio',
    mark: '',
    art: 'fig-carry',
    name: 'Kroki w nogach',
    desc: 'Wszystkie kroki wpisane z telefonu albo zegarka, z całej historii.',
    quip: 'Telefon liczył, nogi robiły. Podział pracy jak w dobrym stadzie.',
    unit: 'kroków',
    tiers: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000],
    value: (c) => c.metrics.cardio.steps,
  },
  {
    id: 'kroki-dzien',
    group: 'cardio',
    mark: '24H',
    name: 'Dzień na nogach',
    desc: 'Najwięcej kroków w jednym dniu, z wpisu z telefonu albo zegarka.',
    quip: 'Dzień, w którym winda czuła się niepotrzebna.',
    unit: 'kroków',
    tiers: [5_000, 7_500, 10_000, 15_000, 20_000, 30_000],
    value: (c) => c.metrics.cardio.bestDaySteps,
  },
  {
    id: 'kroki-cel',
    group: 'cardio',
    mark: '',
    art: 'circleCheck',
    name: 'Osiem tysięcy',
    desc: 'Dni z co najmniej 8 000 kroków. Według badań korzyść dla zdrowia rośnie mniej więcej do tego miejsca, a dalej już wolniej.',
    quip: 'Dziesięć tysięcy wymyśliła reklama krokomierza. Osiem tysięcy — badania.',
    unit: 'dni',
    tiers: [1, 7, 30, 90, 180, 365, 730],
    value: (c) => c.metrics.cardio.goalDays,
  },
  {
    id: 'cardio-sesje',
    group: 'cardio',
    mark: '',
    art: 'stopwatch',
    name: 'Bieżnia i rower',
    desc: 'Wyjścia na bieżnię albo rower trwające co najmniej dziesięć minut.',
    quip: 'Bieżnia kręci się w miejscu. Forma już nie.',
    unit: 'wyjść',
    tiers: [1, 10, 25, 50, 100, 200, 400],
    value: (c) => c.metrics.cardio.sessions,
  },
  {
    id: 'taniec',
    group: 'cardio',
    mark: '',
    art: 'note',
    name: 'Na parkiecie',
    desc: 'Zajęcia tańca w parze albo solo trwające co najmniej dziesięć minut.',
    quip: 'Instruktor liczył do ośmiu. Ty liczysz zajęcia.',
    unit: 'zajęć',
    tiers: [1, 5, 10, 25, 50, 100, 200],
    value: (c) => c.metrics.cardio.dances,
  },
  {
    id: 'cardio-dystans',
    group: 'cardio',
    mark: '',
    art: 'ruler',
    name: 'Kilometry',
    desc: 'Droga z kroków, bieżni i roweru na zewnątrz, w pełnych kilometrach. Rower stacjonarny z mocą drogi nie ma.',
    quip: 'Gdyby iść w jedną stronę, za plecami zostałoby już inne województwo.',
    unit: 'km',
    tiers: [10, 50, 100, 250, 500, 1_000, 2_500, 5_000],
    value: (c) => c.metrics.cardio.km,
  },
  {
    id: 'cardio-who',
    group: 'cardio',
    mark: '',
    art: 'calendarCheck',
    name: 'Tydzień według WHO',
    desc: 'Tygodnie od poniedziałku do niedzieli ze 150 minutami ruchu umiarkowanego z kroków, bieżni, roweru i tańca. Minuta intensywna liczy się podwójnie.',
    quip: 'Zalecenie odhaczone. Rzadki przypadek, gdy urzędowa tabelka ma rację.',
    unit: 'tygodni',
    tiers: [1, 4, 12, 26, 52, 104],
    value: (c) => c.metrics.cardio.whoWeeks,
  },
  {
    id: 'cardio-ciag',
    group: 'cardio',
    mark: '',
    art: 'wave',
    name: 'Dzień po dniu',
    desc: 'Najdłuższy ciąg dni z rzędu z co najmniej 20 minutami ruchu — z kroków ponad 5 000, bieżni, roweru albo tańca.',
    quip: 'Codziennie kawałek drogi. Suma robi się sama.',
    unit: 'dni',
    tiers: [3, 7, 14, 30, 60, 100, 200, 365],
    value: (c) => c.metrics.cardio.run,
  },

  /* ---------------- Terminy: kalendarz planu ---------------- */
  {
    id: 'seria',
    group: 'terminy',
    mark: '',
    art: 'chain',
    name: 'Seria w terminie',
    desc: 'Terminy z rzędu zrobione co do dnia. Nadrobienie serii nie przedłuża.',
    quip: 'Terminy dotrzymane co do dnia. Kalendarz milczy z szacunku.',
    unit: 'terminów',
    tiers: [3, 10, 25, 50, 75, 100],
    value: (c) => c.stats?.bestStreak ?? 0,
  },
  {
    id: 'bez-pudla',
    group: 'terminy',
    mark: '',
    art: 'circleCheck',
    name: 'Bez pudła',
    desc: 'Terminy z rzędu nieopuszczone. Nadrobienie w oknie łaski się liczy.',
    quip: 'Ani jednego pominiętego terminu. Podejrzanie dobrze.',
    unit: 'terminów',
    tiers: [5, 10, 20, 40, 60, 100],
    value: (c) => c.stats?.alive ?? 0,
  },
  {
    id: 'czysty-tydzien',
    group: 'terminy',
    mark: '',
    art: 'calendarCheck',
    name: 'Czysty tydzień',
    desc: 'Tygodnie planu domknięte w komplecie, bez ani jednego opuszczonego terminu.',
    quip: 'Tydzień bez dziury w planie. Bywa i tak.',
    unit: 'tygodni',
    tiers: [1, 4, 12, 24, 52],
    value: (c) => (c.schedule ? countCleanWeeks(c.schedule.days) : 0),
  },
  {
    id: 'nadrabiacz',
    group: 'terminy',
    mark: '',
    art: 'rewind',
    name: 'Nadrabiacz',
    desc: 'Zaległe terminy domknięte w ciągu dwóch dni.',
    quip: 'Spóźnione, ale zrobione. Liczy się drugie słowo.',
    unit: 'razy',
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
    name: 'Punktualny',
    desc: 'Realizacja co najmniej 90% przy minimum dwunastu rozstrzygniętych terminach.',
    quip: 'Dziewięćdziesiąt procent. Zegarek by pozazdrościł.',
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.elapsed >= 12 && (c.stats.adherence ?? 0) >= 90),
  },
  {
    id: 'polowa',
    group: 'terminy',
    mark: '',
    art: 'half',
    name: 'Półmetek',
    desc: 'Połowa terminów planu zrobiona.',
    quip: 'Półmetek. Druga połowa zwykle idzie szybciej.',
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.total > 0 && c.stats.done >= c.stats.total / 2),
  },
  {
    id: 'plan-zamkniety',
    group: 'terminy',
    mark: '',
    art: 'trophy',
    name: 'Plan zamknięty',
    desc: 'Wszystkie terminy planu zrobione.',
    quip: 'Plan domknięty w całości. Rzadszy okaz niż się wydaje.',
    tiers: [1],
    value: (c) => yes(!!c.stats && c.stats.total > 0 && c.stats.done === c.stats.total),
  },
];

/** Rodziny ogólne. Odznaki ćwiczeń stoją osobno, bo jest ich po cztery na każdy ruch. */
export const ACHIEVEMENTS: Achievement[] = DEFS;

/** Wszystkie rodziny, łącznie z odznakami ćwiczeń — pod zdobywanie i formatowanie. */
const EVERY: AchDef[] = [...DEFS, ...EX_DEFS];
const BY_ID = new Map<string, AchDef>(EVERY.map((d) => [d.id, d]));

export const GROUP_LABEL: Record<Achievement['group'], string> = {
  dorobek: 'Dorobek',
  partie: 'Partie ruchu',
  szczyty: 'Szczyty',
  utrzymanie: 'Utrzymanie',
  przekaski: 'Przekąski ruchowe',
  cardio: 'Kroki i cardio',
  terminy: 'Terminy',
  cwiczenia: 'Ćwiczenia',
};

export const GROUP_NOTE: Record<Achievement['group'], string> = {
  dorobek: 'Sumy z całej historii treningów. Rosną same, dopóki trenujesz.',
  partie: 'Objętość w rozbiciu na wzorce ruchowe. Widać, co jest zaniedbane.',
  szczyty:
    'Rekordy pojedynczych podejść i przesuwanego okna — dowolne siedem, trzydzieści, dziewięćdziesiąt, sto osiemdziesiąt czy trzysta sześćdziesiąt pięć dni z rzędu.',
  utrzymanie: 'Nie o to, ile urosło, tylko o to, że nic się nie osypało.',
  przekaski: 'Krótkie serie poza treningiem. Liczy się, jak często — nie ile naraz.',
  cardio:
    'Kroki, bieżnia, rower i taniec wpisane ręcznie. Liczą się kroki, kilometry, zajęcia i minuty ruchu według zaleceń WHO — nie kalorie, bo te rosną razem z wagą.',
  terminy: 'Zależne od uruchomionego planu i jego kalendarza.',
  cwiczenia:
    'Każde ćwiczenie ma rekord dnia, tygodnia i miesiąca kalendarzowego oraz sumę — z treningów i przekąsek razem. Widać tylko ruchy, które już robisz.',
};

/** Grupy rozwijane w zakładce. Odznaki ćwiczeń mają własny układ — po ćwiczeniu, nie po rodzinie. */
export const GROUPS: Achievement['group'][] = [
  'dorobek',
  'partie',
  'szczyty',
  'utrzymanie',
  'przekaski',
  'cardio',
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
  return def?.fmt ? def.fmt(n) : n.toLocaleString('pl-PL');
}

/**
 * Sformatowany próg razem z jednostką. Rzeczownik stoi w dopełniaczu liczby mnogiej, bo
 * pada zawsze po przyimku „z” („z 200 powtórzeń”), gdzie ta forma jest poprawna dla
 * każdego liczebnika.
 */
export function formatTier(a: Achievement, n: number): string {
  const def = BY_ID.get(a.id);
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
