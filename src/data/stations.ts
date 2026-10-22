import type { ExerciseId, WorkoutGear } from '../types';
import { say } from '../i18n';

/**
 * Stanowisko ćwiczenia: co przygotować, zanim padnie pierwsza seria.
 *
 * Z tego powstaje lista „przygotuj” na początku treningu — kettlebelle z konkretnymi wagami,
 * sztanga z talerzami na stronę, ławka, drążek, krzesło — i lista maszyn do znalezienia
 * na siłowni. Maszyna ma nazwę, pod którą się jej szuka, i zamienniki na wypadek, gdy
 * jest zajęta: na siłowni w szczycie to raczej reguła niż wyjątek.
 *
 * Część stanowisk zależy od miejsca. Wyprosty tułowia w domu robi się na podłodze, a na
 * siłowni na ławce rzymskiej; australijskie podciąganie w domu idzie pod stołem, a na
 * siłowni pod sztangą w stojaku.
 */

export type Equip =
  | 'kb'
  | 'kb2'
  | 'barbell'
  | 'rack'
  | 'benchpress'
  | 'benchpress_incline'
  | 'bench'
  | 'dumbbells'
  | 'bar'
  | 'dipbars'
  | 'cable'
  | 'box'
  | 'chair'
  | 'support'
  | 'table'
  | 'wall'
  | 'step'
  | 'anchor'
  | 'mat'
  | 'space'
  | 'rope'
  | 'abwheel'
  | 'roman'
  | 'medball'
  | 'ropes';

export const EQUIP_LABEL: Record<Equip, string> = {
  kb: 'kettlebell',
  kb2: say('dwa kettlebelle', 'two kettlebells'),
  barbell: say('sztanga i talerze', 'barbell and plates'),
  rack: say('stojak (klatka) z asekuracją ustawioną tuż pod najniższym punktem ruchu', 'rack (cage) with the safeties set just below the lowest point of the movement'),
  benchpress: say('ławka do wyciskania ze stojakami', 'bench press bench with uprights'),
  benchpress_incline: say('ławka skośna ze stojakami', 'incline bench with uprights'),
  bench: say('ławka płaska', 'flat bench'),
  dumbbells: say('hantle', 'dumbbells'),
  bar: say('drążek do podciągania', 'pull-up bar'),
  dipbars: say('poręcze (w domu: dwa stabilne krzesła oparte o ścianę)', 'dip bars (at home: two sturdy chairs against a wall)'),
  cable: say('wyciąg z regulowaną wysokością linki', 'cable machine with adjustable height'),
  box: say('skrzynia albo stabilny stopień', 'box or sturdy step'),
  chair: say('stabilne krzesło, oparciem do ściany', 'sturdy chair, backrest against a wall'),
  support: say('oparcie na wysokości kolan: ławka, krzesło albo brzeg kanapy', 'knee-height support: a bench, a chair or the edge of a sofa'),
  table: say('solidny stół, który uniesie twój ciężar', 'sturdy table that can take your weight'),
  wall: say('kawałek wolnej ściany', 'a clear bit of wall'),
  step: say('stopień albo krawędź schodka', 'step or the edge of a stair'),
  anchor: say('coś, pod czym zaczepisz stopy: kanapa, łóżko albo druga osoba', 'something to hook your feet under: a sofa, a bed or another person'),
  mat: say('mata albo miękki dywan', 'mat or soft rug'),
  space: say('kilka metrów wolnej drogi do chodzenia z ciężarem', 'a few metres of clear floor to walk with a weight'),
  rope: say('skakanka i trochę miejsca nad głową', 'skipping rope and some headroom'),
  abwheel: say('kółko do brzucha', 'ab wheel'),
  roman: say('ławka do wyprostów (rzymska)', 'back extension bench (Roman chair)'),
  medball: say('piłka lekarska', 'medicine ball'),
  ropes: say('liny bojowe', 'battle ropes'),
};

/**
 * Stanowiska, które na siłowni trzeba zająć i trzymać: maszyna, wyciąg, stojak, drążek.
 * Para ćwiczeń „na zmianę” może trzymać najwyżej jedno — dwa naraz to w szczycie zajęte
 * miejsce, które ktoś inny czeka, a po drodze między nimi ucieka przerwa.
 */
export const HELD: ReadonlySet<Equip> = new Set<Equip>(['rack', 'benchpress', 'benchpress_incline', 'bar', 'dipbars', 'cable', 'roman']);

export interface Station {
  needs: Equip[];
  /** Maszyna, której trzeba poszukać na sali — nazwa, pod którą ją widać. */
  machine?: string;
  /** Zamienniki, gdy maszyna jest zajęta: ćwiczenia z tej samej partii bez tej maszyny. */
  alt?: ExerciseId[];
}

const s = (needs: Equip[], machine?: string, alt?: ExerciseId[]): Station => ({
  needs,
  ...(machine ? { machine } : {}),
  ...(alt ? { alt } : {}),
});

export const STATIONS: Record<ExerciseId, Station> = {
  // Kettlebell
  swing2: s(['kb']),
  swing1: s(['kb']),
  rdl: s(['kb']),
  goblet: s(['kb']),
  lunge: s(['kb']),
  row: s(['kb', 'support']),
  pullup: s(['bar']),
  curl: s(['kb']),
  press: s(['kb']),
  floor: s(['kb', 'mat']),
  pushup: s([]),
  dip: s(['dipbars']),
  tgu: s(['kb', 'mat']),
  complex: s(['kb']),
  carry: s(['kb', 'space']),
  farmer: s(['kb2', 'space']),
  core: s(['mat']),
  calf: s(['step', 'wall']),
  calf1: s(['step', 'wall']),
  clean_kb: s(['kb']),
  snatch_kb: s(['kb']),
  russian: s(['kb', 'mat']),
  carry_oh: s(['kb', 'space']),
  carry_rack: s(['kb', 'space']),

  // Zawias biodrowy
  deadlift: s(['barbell']),
  deadlift_sumo: s(['barbell']),
  rdl_bb: s(['barbell']),
  rdl_db: s(['dumbbells']),
  rdl_single: s(['dumbbells']),
  hipthrust: s(['barbell', 'bench']),
  glutebridge: s(['mat']),
  glutebridge1: s(['mat']),
  goodmorning: s(['barbell', 'rack']),
  hyper: s(['mat']),
  nordic: s(['anchor', 'mat']),
  legcurl: s([], say('maszyna do uginania nóg', 'leg curl machine'), ['nordic', 'rdl_db']),
  pullthrough: s(['cable'], undefined, ['rdl_db']),

  // Przysiad
  squat_back: s(['barbell', 'rack']),
  squat_front: s(['barbell', 'rack']),
  squat_box: s(['barbell', 'rack', 'box']),
  hacksquat: s([], say('hack maszyna', 'hack squat machine'), ['legpress', 'bulgarian']),
  legpress: s([], say('suwnica', 'leg press'), ['hacksquat', 'bulgarian']),
  bulgarian: s(['dumbbells', 'bench']),
  stepup: s(['dumbbells', 'box']),
  lunge_walk: s(['dumbbells', 'space']),
  pistol: s([]),
  squat_air: s([]),
  squat_jump: s([]),
  lunge_bw: s([]),
  split_bw: s(['chair']),
  sissy: s(['wall']),
  legext: s([], say('maszyna do prostowania nóg', 'leg extension machine'), ['sissy', 'bulgarian']),

  // Ciągnięcie
  row_bb: s(['barbell']),
  row_db: s(['dumbbells', 'bench']),
  row_tbar: s([], say('wiosłowanie T-bar', 'T-bar row'), ['row_db', 'row_bb']),
  row_cable: s([], say('wyciąg dolny do wiosłowania siedząc', 'low cable for seated rows'), ['row_db']),
  row_inverted: s(['table']),
  latpulldown: s([], say('wyciąg górny', 'lat pulldown machine'), ['chinup', 'pullup']),
  chinup: s(['bar']),
  dead_hang: s(['bar']),
  facepull: s(['cable'], undefined, ['y_raise']),
  y_raise: s(['mat']),
  shrug: s(['dumbbells']),
  pullover: s(['cable'], undefined, ['latpulldown', 'row_db']),
  curl_bb: s(['barbell']),
  curl_db: s(['dumbbells']),
  curl_hammer: s(['dumbbells']),
  curl_preacher: s([], say('modlitewnik', 'preacher bench'), ['curl_db']),

  // Pchanie
  bench: s(['barbell', 'benchpress']),
  bench_incline: s(['barbell', 'benchpress_incline']),
  bench_db: s(['dumbbells', 'bench']),
  bench_close: s(['barbell', 'benchpress']),
  chestpress: s([], say('maszyna do wyciskania', 'chest press machine'), ['bench_db', 'pushup']),
  pecdeck: s([], say('maszyna do rozpiętek', 'pec deck'), ['fly_cable', 'bench_db']),
  fly_cable: s(['cable'], undefined, ['pecdeck', 'bench_db']),
  ohp_bb: s(['barbell', 'rack']),
  ohp_db: s(['dumbbells']),
  arnold: s(['dumbbells', 'bench']),
  lateral: s(['dumbbells']),
  frontraise: s(['dumbbells']),
  pushdown: s(['cable'], undefined, ['skullcrusher', 'dip_bench']),
  skullcrusher: s(['barbell', 'bench']),
  pushup_diamond: s([]),
  pushup_pike: s([]),
  hspu: s(['wall']),
  dip_bench: s(['chair']),

  // Całe ciało i kondycja
  thruster: s(['dumbbells']),
  clean_jerk: s(['barbell']),
  burpee: s([]),
  wallball: s(['medball', 'wall']),
  boxjump: s(['box']),
  rower: s([], say('ergometr wioślarski', 'rowing machine'), ['bike', 'jumprope']),
  bike: s([], say('rower powietrzny', 'air bike'), ['rower', 'jumprope']),
  jumprope: s(['rope']),
  ropes: s(['ropes']),
  sled: s([], say('sanie', 'sled'), ['lunge_walk']),
  sled_drag: s([], say('sanie', 'sled'), ['lunge_walk']),

  // Core
  plank: s(['mat']),
  plank_side: s(['mat']),
  deadbug: s(['mat']),
  hollow: s(['mat']),
  abwheel: s(['abwheel', 'mat']),
  legraise_hang: s(['bar']),
  crunch: s(['mat']),
  legraise_floor: s(['mat']),
  vup: s(['mat']),
  crunch_cable: s(['cable'], undefined, ['deadbug', 'abwheel']),
  pallof: s(['cable'], undefined, ['plank_side']),

  // Nogi — dodatkowe
  calf_seated: s([], say('maszyna do łydek siedząc', 'seated calf machine'), ['calf1']),
  calf_press: s([], say('suwnica', 'leg press'), ['calf_seated', 'calf1']),
  tibialis: s(['wall']),
  abduction: s([], say('maszyna do odwodzenia nóg', 'hip abduction machine'), ['glutebridge1', 'plank_side']),
  adduction: s([], say('maszyna do przywodzenia nóg', 'hip adduction machine'), ['copenhagen']),
  copenhagen: s(['support', 'mat']),
};

/**
 * Stanowisko w danym miejscu. Siłownia ma sprzęt, którego w domu nie ma, i na odwrót —
 * na siłowni nikt nie robi australijskiego podciągania pod stołem.
 */
export function stationFor(id: ExerciseId, gear: WorkoutGear | undefined): Station {
  const base = STATIONS[id] ?? s([]);
  if (gear !== 'gym') return base;
  switch (id) {
    case 'hyper':
      return s([], say('ławka do wyprostów (rzymska)', 'back extension bench (Roman chair)'), ['glutebridge']);
    case 'row_inverted':
      return s(['rack'], undefined, ['row_db']);
    case 'dip_bench':
      return s(['bench']);
    case 'copenhagen':
      return s(['bench', 'mat']);
    case 'row':
      return s(['kb', 'bench']);
    default:
      return base;
  }
}

/** Czy stanowisko trzeba zająć i trzymać — maszyna albo sprzęt z listy `HELD`. */
export const heldOf = (st: Station): string[] => [
  ...(st.machine ? [`maszyna:${st.machine}`] : []),
  ...st.needs.filter((e) => HELD.has(e)),
];
