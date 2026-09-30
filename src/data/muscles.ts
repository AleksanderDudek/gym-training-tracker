import type { ExerciseId } from '../types';

/**
 * Mięśnie, które pracują w ćwiczeniach.
 *
 * Grupy ruchu z atlasu („zawias”, „przysiad”) mówią, jak się ruszasz. Doradca potrzebuje
 * czegoś innego: kto za to płaci. Hip thrust i przysiad to dwa różne wzorce, ale oba biorą
 * pośladki — i dopiero licząc po mięśniu widać, że trening z czterema takimi ćwiczeniami
 * ładuje w jedną partię kilkanaście serii naraz.
 *
 * Szesnaście grup to kompromis: barki są rozbite na trzy aktony, bo wyciskanie nad głowę
 * i face pull pracują na zupełnie innych częściach barku, a plecy na dwie — szerokość
 * (najszersze, ciągnięcie z góry) i środek (czworoboczny i równoległoboczne, wiosłowanie).
 */
export type MuscleId =
  | 'klatka'
  | 'najszersze'
  | 'plecy-gora'
  | 'bark-przod'
  | 'bark-bok'
  | 'bark-tyl'
  | 'biceps'
  | 'triceps'
  | 'przedramiona'
  | 'brzuch'
  | 'prostowniki'
  | 'posladki'
  | 'czworoglowe'
  | 'dwuglowe'
  | 'przywodziciele'
  | 'lydki';

export const MUSCLES: MuscleId[] = [
  'klatka',
  'najszersze',
  'plecy-gora',
  'bark-przod',
  'bark-bok',
  'bark-tyl',
  'biceps',
  'triceps',
  'przedramiona',
  'brzuch',
  'prostowniki',
  'posladki',
  'czworoglowe',
  'dwuglowe',
  'przywodziciele',
  'lydki',
];

/** Nazwa w mianowniku — na etykiety pasków. */
export const MUSCLE_NAME: Record<MuscleId, string> = {
  klatka: 'Klatka piersiowa',
  najszersze: 'Plecy — najszersze',
  'plecy-gora': 'Plecy — środek i kaptury',
  'bark-przod': 'Barki — przód',
  'bark-bok': 'Barki — bok',
  'bark-tyl': 'Barki — tył',
  biceps: 'Biceps',
  triceps: 'Triceps',
  przedramiona: 'Przedramiona i chwyt',
  brzuch: 'Brzuch i core',
  prostowniki: 'Prostowniki grzbietu',
  posladki: 'Pośladki',
  czworoglowe: 'Czworogłowe uda',
  dwuglowe: 'Tył uda',
  przywodziciele: 'Przywodziciele',
  lydki: 'Łydki i podudzie',
};

/** Ta sama partia w zdaniu, po „na” — „za dużo serii na pośladki”. */
export const MUSCLE_ACC: Record<MuscleId, string> = {
  klatka: 'klatkę',
  najszersze: 'najszersze grzbietu',
  'plecy-gora': 'środek pleców',
  'bark-przod': 'przód barków',
  'bark-bok': 'boczne aktony barków',
  'bark-tyl': 'tył barków',
  biceps: 'biceps',
  triceps: 'triceps',
  przedramiona: 'przedramiona',
  brzuch: 'brzuch',
  prostowniki: 'prostowniki grzbietu',
  posladki: 'pośladki',
  czworoglowe: 'czworogłowe',
  dwuglowe: 'tył uda',
  przywodziciele: 'przywodziciele',
  lydki: 'łydki',
};

/** Główne mięśnie ruchu i pomocnicze. Seria liczy się głównym w całości, pomocniczym w połowie. */
export interface MuscleUse {
  p: MuscleId[];
  s: MuscleId[];
}

const u = (p: MuscleId[], s: MuscleId[] = []): MuscleUse => ({ p, s });

/**
 * Główne i pomocnicze mięśnie każdego ćwiczenia z atlasu. Główny to ten, który ogranicza
 * ruch i dostaje z niego bodziec do wzrostu; pomocniczy pracuje, ale mniej — stabilizuje
 * albo domyka ruch. Test pilnuje, żeby każde ćwiczenie miało przynajmniej jeden główny.
 */
export const EX_MUSCLES: Record<ExerciseId, MuscleUse> = {
  // Kettlebell, pierwsza biblioteka
  swing2: u(['posladki', 'dwuglowe'], ['prostowniki', 'brzuch', 'przedramiona']),
  swing1: u(['posladki', 'dwuglowe'], ['prostowniki', 'brzuch', 'przedramiona']),
  rdl: u(['dwuglowe', 'posladki'], ['prostowniki', 'przedramiona']),
  goblet: u(['czworoglowe', 'posladki'], ['brzuch', 'przywodziciele']),
  lunge: u(['czworoglowe', 'posladki'], ['przywodziciele', 'brzuch']),
  row: u(['najszersze', 'plecy-gora'], ['biceps', 'bark-tyl']),
  // Podchwyt: biceps ciągnie razem z najszerszymi, a nie tylko pomaga.
  pullup: u(['najszersze', 'biceps'], ['plecy-gora']),
  curl: u(['biceps'], ['przedramiona']),
  press: u(['bark-przod'], ['triceps', 'bark-bok', 'brzuch']),
  floor: u(['klatka', 'triceps'], ['bark-przod']),
  pushup: u(['klatka'], ['triceps', 'bark-przod', 'brzuch']),
  dip: u(['triceps', 'klatka'], ['bark-przod']),
  tgu: u(['brzuch', 'bark-przod'], ['posladki', 'triceps', 'czworoglowe']),
  complex: u(['czworoglowe', 'posladki', 'bark-przod'], ['dwuglowe', 'triceps', 'plecy-gora', 'brzuch']),
  carry: u(['brzuch', 'przedramiona'], ['plecy-gora']),
  farmer: u(['przedramiona', 'plecy-gora'], ['brzuch']),
  core: u(['brzuch']),
  calf: u(['lydki']),
  calf1: u(['lydki']),

  // Zawias biodrowy
  deadlift: u(
    ['posladki', 'dwuglowe', 'prostowniki'],
    ['czworoglowe', 'plecy-gora', 'przedramiona', 'najszersze'],
  ),
  deadlift_sumo: u(
    ['posladki', 'czworoglowe', 'przywodziciele'],
    ['dwuglowe', 'prostowniki', 'plecy-gora', 'przedramiona'],
  ),
  rdl_bb: u(['dwuglowe', 'posladki'], ['prostowniki', 'przedramiona']),
  rdl_db: u(['dwuglowe', 'posladki'], ['prostowniki', 'przedramiona']),
  rdl_single: u(['dwuglowe', 'posladki'], ['prostowniki', 'brzuch']),
  hipthrust: u(['posladki'], ['dwuglowe']),
  glutebridge: u(['posladki'], ['dwuglowe']),
  glutebridge1: u(['posladki'], ['dwuglowe', 'brzuch']),
  goodmorning: u(['dwuglowe', 'prostowniki'], ['posladki']),
  hyper: u(['prostowniki', 'posladki'], ['dwuglowe']),
  nordic: u(['dwuglowe'], ['lydki']),
  legcurl: u(['dwuglowe'], ['lydki']),
  pullthrough: u(['posladki'], ['dwuglowe']),
  clean_kb: u(['posladki', 'dwuglowe'], ['plecy-gora', 'przedramiona', 'prostowniki']),
  snatch_kb: u(['posladki', 'dwuglowe'], ['bark-przod', 'plecy-gora', 'przedramiona', 'prostowniki']),

  // Przysiad
  squat_back: u(['czworoglowe', 'posladki'], ['przywodziciele', 'prostowniki', 'brzuch']),
  squat_front: u(['czworoglowe'], ['posladki', 'plecy-gora', 'brzuch']),
  squat_box: u(['posladki', 'czworoglowe'], ['dwuglowe', 'prostowniki']),
  hacksquat: u(['czworoglowe'], ['posladki']),
  legpress: u(['czworoglowe', 'posladki'], ['przywodziciele']),
  bulgarian: u(['czworoglowe', 'posladki'], ['przywodziciele', 'dwuglowe']),
  stepup: u(['czworoglowe', 'posladki'], ['dwuglowe', 'lydki']),
  lunge_walk: u(['czworoglowe', 'posladki'], ['przywodziciele', 'brzuch']),
  pistol: u(['czworoglowe', 'posladki'], ['brzuch']),
  squat_air: u(['czworoglowe', 'posladki']),
  lunge_bw: u(['czworoglowe', 'posladki'], ['przywodziciele', 'brzuch']),
  split_bw: u(['czworoglowe', 'posladki'], ['przywodziciele', 'dwuglowe']),
  sissy: u(['czworoglowe']),
  legext: u(['czworoglowe']),

  // Ciągnięcie
  row_bb: u(['najszersze', 'plecy-gora'], ['biceps', 'bark-tyl', 'prostowniki']),
  row_db: u(['najszersze', 'plecy-gora'], ['biceps', 'bark-tyl']),
  row_tbar: u(['plecy-gora', 'najszersze'], ['biceps', 'bark-tyl', 'prostowniki']),
  row_cable: u(['plecy-gora', 'najszersze'], ['biceps', 'bark-tyl']),
  row_inverted: u(['plecy-gora', 'najszersze'], ['biceps', 'bark-tyl', 'brzuch']),
  latpulldown: u(['najszersze'], ['biceps', 'plecy-gora']),
  chinup: u(['najszersze'], ['plecy-gora', 'biceps', 'przedramiona']),
  facepull: u(['bark-tyl'], ['plecy-gora']),
  // Dolne kaptury i tył barku — u ćwiczących z bólem barku bywają słabsze (Kolber i in. 2017).
  y_raise: u(['bark-tyl', 'plecy-gora'], ['prostowniki']),
  shrug: u(['plecy-gora'], ['przedramiona']),
  pullover: u(['najszersze'], ['klatka', 'triceps']),
  curl_bb: u(['biceps'], ['przedramiona']),
  curl_db: u(['biceps'], ['przedramiona']),
  curl_hammer: u(['biceps', 'przedramiona']),
  curl_preacher: u(['biceps']),

  // Pchanie
  bench: u(['klatka'], ['triceps', 'bark-przod']),
  bench_incline: u(['klatka', 'bark-przod'], ['triceps']),
  bench_db: u(['klatka'], ['triceps', 'bark-przod']),
  bench_close: u(['triceps'], ['klatka', 'bark-przod']),
  chestpress: u(['klatka'], ['triceps', 'bark-przod']),
  pecdeck: u(['klatka'], ['bark-przod']),
  fly_cable: u(['klatka'], ['bark-przod']),
  ohp_bb: u(['bark-przod'], ['triceps', 'bark-bok', 'plecy-gora', 'brzuch']),
  ohp_db: u(['bark-przod'], ['triceps', 'bark-bok']),
  arnold: u(['bark-przod', 'bark-bok'], ['triceps']),
  lateral: u(['bark-bok'], ['plecy-gora']),
  frontraise: u(['bark-przod']),
  pushdown: u(['triceps']),
  skullcrusher: u(['triceps']),
  pushup_diamond: u(['triceps', 'klatka'], ['bark-przod']),
  pushup_pike: u(['bark-przod'], ['triceps', 'plecy-gora']),
  hspu: u(['bark-przod'], ['triceps', 'plecy-gora', 'brzuch']),
  dip_bench: u(['triceps'], ['klatka', 'bark-przod']),

  // Całe ciało
  thruster: u(['czworoglowe', 'bark-przod'], ['posladki', 'triceps', 'brzuch']),
  clean_jerk: u(['czworoglowe', 'posladki', 'bark-przod'], ['dwuglowe', 'triceps', 'plecy-gora', 'prostowniki']),
  burpee: u(['klatka', 'czworoglowe'], ['triceps', 'bark-przod', 'brzuch', 'posladki']),
  wallball: u(['czworoglowe', 'bark-przod'], ['posladki', 'triceps']),
  boxjump: u(['czworoglowe', 'posladki'], ['lydki', 'dwuglowe']),
  rower: u(['czworoglowe', 'plecy-gora'], ['posladki', 'dwuglowe', 'najszersze', 'biceps']),
  bike: u(['czworoglowe'], ['posladki', 'dwuglowe']),
  jumprope: u(['lydki'], ['czworoglowe']),
  ropes: u(['bark-przod'], ['brzuch', 'przedramiona', 'plecy-gora']),
  sled: u(['czworoglowe', 'posladki'], ['lydki', 'dwuglowe']),

  // Core i carry
  plank: u(['brzuch'], ['bark-przod']),
  plank_side: u(['brzuch'], ['posladki']),
  deadbug: u(['brzuch']),
  hollow: u(['brzuch']),
  abwheel: u(['brzuch'], ['najszersze', 'triceps']),
  legraise_hang: u(['brzuch'], ['przedramiona', 'najszersze']),
  crunch_cable: u(['brzuch']),
  pallof: u(['brzuch']),
  russian: u(['brzuch']),
  carry_oh: u(['bark-przod', 'brzuch'], ['plecy-gora', 'triceps']),
  carry_rack: u(['brzuch'], ['plecy-gora', 'bark-przod', 'przedramiona']),
  sled_drag: u(['czworoglowe'], ['lydki', 'posladki']),

  // Nogi — dodatkowe
  calf_seated: u(['lydki']),
  calf_press: u(['lydki']),
  tibialis: u(['lydki']),
  abduction: u(['posladki']),
  adduction: u(['przywodziciele']),
  copenhagen: u(['przywodziciele'], ['brzuch']),
};

/** Mięśnie pchające i ciągnące górnej połowy — do bilansu push/pull. */
export const PUSH_MUSCLES: MuscleId[] = ['klatka', 'bark-przod', 'triceps'];
export const PULL_MUSCLES: MuscleId[] = ['najszersze', 'plecy-gora', 'bark-tyl', 'biceps'];

/**
 * Duże partie, które plan ogólny powinien ruszać co tydzień — WHO zaleca ćwiczenia siłowe
 * „angażujące wszystkie główne grupy mięśni”. Reszta (przedramiona, łydki, przywodziciele)
 * pracuje przy okazji albo jest dodatkiem.
 */
/**
 * Mięśnie stabilizujące: brzuch, chwyt i łydki pracują pomocniczo w prawie każdym ćwiczeniu
 * i szybko się regenerują. Liczone połówkami z każdego ruchu dałyby tygodniowo dwadzieścia
 * kilka serii „na brzuch” w zwykłym planie całego ciała — dlatego doradca nie stosuje do nich
 * górnej granicy tygodnia ani zasady 48 godzin.
 */
export const STABILIZERS: MuscleId[] = ['brzuch', 'przedramiona', 'lydki'];

export const MAJOR_MUSCLES: MuscleId[] = [
  'klatka',
  'najszersze',
  'plecy-gora',
  'bark-przod',
  'biceps',
  'triceps',
  'brzuch',
  'posladki',
  'czworoglowe',
  'dwuglowe',
];

/**
 * Ćwiczenia jednostawowe — izolacje. Idą po wielostawowych, bo zmęczony biceps
 * ogranicza potem wiosłowanie, a nie odwrotnie.
 */
export const ISOLATION = new Set<ExerciseId>([
  'curl',
  'curl_bb',
  'curl_db',
  'curl_hammer',
  'curl_preacher',
  'lateral',
  'frontraise',
  'pushdown',
  'skullcrusher',
  'legext',
  'legcurl',
  'pecdeck',
  'fly_cable',
  'facepull',
  'shrug',
  'pullover',
  'abduction',
  'adduction',
  'sissy',
  'nordic',
  'hyper',
  'pullthrough',
  'glutebridge',
  'glutebridge1',
  'y_raise',
]);
