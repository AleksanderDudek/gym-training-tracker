import type { ExerciseDefaults, Gear, Mode, Unit } from '../../types';
import { GROUPS } from '../exercises';
import { say } from '../../i18n';
import type { MuscleId, MuscleUse } from '../muscles';

/**
 * Katalog ćwiczeń (1324 pozycje ze zbioru MIT hasaneyldrm/exercises-dataset, tekst ExerciseDB v1).
 *
 * Tu leżą wyłącznie czyste reguły: jak surowy wiersz katalogu (sprzęt, cel, mięśnie pomocnicze po
 * angielsku) zamienia się w to, czego potrzebuje silnik — sprzęt z drabiną ciężaru, tryb progresji,
 * jednostkę, cele, partię ruchu i 16 partii mięśniowych aplikacji. Same dane ładują się leniwie
 * (`catalog/load.ts`), a do silnika ćwiczenie wchodzi dopiero po dodaniu do treningu (`adopt.ts`).
 */

/** Wiersz `index.json`: id źródła, nazwa [pl, en], sprzęt, partia ciała, cel, pomocnicze. */
export interface CatalogRow {
  i: string;
  n: [string, string];
  e: string;
  b: string;
  t: string;
  s: string[];
}

/**
 * Definicja ćwiczenia z katalogu zapisana w stanie przy adopcji. Reguły wyprowadzania mogą się
 * kiedyś zmienić — zapisana definicja nie, więc progresja raz dodanego ćwiczenia nie skacze.
 */
export interface CatalogDef {
  /** Id w zbiorze źródłowym (`0025`). */
  src: string;
  name: [string, string];
  /** Sprzęt ze źródła, po angielsku (`cable`, `smith machine`) — na etykietę. */
  eq: string;
  gear: Gear;
  mode: Mode;
  unit: Unit;
  side?: boolean;
  def: ExerciseDefaults;
  group: string;
  muscles: MuscleUse;
}

export const CATALOG_PREFIX = 'kat-';
export const catalogId = (src: string): string => `${CATALOG_PREFIX}${src}`;
export const isCatalogId = (id: string): boolean => id.startsWith(CATALOG_PREFIX);
export const srcOf = (id: string): string => id.slice(CATALOG_PREFIX.length);

/* ---------------- Sprzęt ---------------- */

/** Każda wartość `equipment` ze źródła. Test pilnuje, żeby żadna nie została bez reguły. */
export const GEAR_OF: Record<string, Gear> = {
  barbell: 'barbell',
  'ez barbell': 'barbell',
  'olympic barbell': 'barbell',
  'trap bar': 'barbell',
  'smith machine': 'barbell',
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  cable: 'machine',
  'leverage machine': 'machine',
  'sled machine': 'machine',
  assisted: 'machine',
  band: 'band',
  'resistance band': 'band',
  'body weight': 'bodyweight',
  weighted: 'bodyweight',
  'stability ball': 'bodyweight',
  'bosu ball': 'bodyweight',
  'medicine ball': 'bodyweight',
  roller: 'bodyweight',
  'wheel roller': 'bodyweight',
  rope: 'bodyweight',
  hammer: 'bodyweight',
  tire: 'bodyweight',
  'stationary bike': 'bodyweight',
  'upper body ergometer': 'bodyweight',
  'elliptical machine': 'bodyweight',
  'skierg machine': 'bodyweight',
  'stepmill machine': 'bodyweight',
};

/** Polska etykieta sprzętu ze źródła — dokładniejsza niż sama drabina („wyciąg”, nie „maszyna”). */
export const EQ_LABEL: Record<string, string> = {
  barbell: say('sztanga', 'barbell'),
  'ez barbell': say('sztanga łamana', 'EZ bar'),
  'olympic barbell': say('sztanga olimpijska', 'Olympic barbell'),
  'trap bar': say('sztanga heksagonalna', 'trap bar'),
  'smith machine': say('suwnica Smitha', 'Smith machine'),
  dumbbell: say('hantle', 'dumbbells'),
  kettlebell: say('kettlebell', 'kettlebell'),
  cable: say('wyciąg', 'cable'),
  'leverage machine': say('maszyna', 'machine'),
  'sled machine': say('maszyna (sanie)', 'sled machine'),
  assisted: say('maszyna ze wspomaganiem', 'assisted machine'),
  band: say('guma', 'band'),
  'resistance band': say('guma oporowa', 'resistance band'),
  'body weight': say('masa ciała', 'bodyweight'),
  weighted: say('obciążenie dodatkowe', 'added weight'),
  'stability ball': say('piłka gimnastyczna', 'stability ball'),
  'bosu ball': say('BOSU', 'BOSU ball'),
  'medicine ball': say('piłka lekarska', 'medicine ball'),
  roller: say('wałek', 'foam roller'),
  'wheel roller': say('kółko do brzucha', 'ab wheel'),
  rope: say('lina / skakanka', 'rope'),
  hammer: say('młot', 'sledgehammer'),
  tire: say('opona', 'tyre'),
  'stationary bike': say('rower stacjonarny', 'stationary bike'),
  'upper body ergometer': say('ergometr ręczny', 'arm ergometer'),
  'elliptical machine': say('orbitrek', 'elliptical'),
  'skierg machine': say('SkiErg', 'SkiErg'),
  'stepmill machine': say('schodołaz', 'stepmill'),
};

/* ---------------- Mięśnie ---------------- */

/**
 * Barki w źródle to jeden „delts”. Aplikacja liczy trzy aktony osobno, więc rozbijamy po nazwie:
 * odwrotne rozpiętki i face pull idą w tył, unoszenia bokiem i wiosłowanie wzdłuż tułowia w bok,
 * wyciskania i unoszenia przodem — w przód.
 */
export function deltOf(nameEn: string): MuscleId {
  const n = nameEn.toLowerCase();
  if (/rear|reverse fl(y|ies)|face pull|bent[- ]over lateral|posterior/.test(n)) return 'bark-tyl';
  if (/lateral|side raise|upright|\by[- ]raise/.test(n)) return 'bark-bok';
  return 'bark-przod';
}

/** Cel (`target`) ze źródła. `delts` rozstrzyga `deltOf`. Pusta lista — ćwiczenie bez partii (cardio). */
export const TARGET_OF: Record<string, MuscleId[] | 'delts'> = {
  pectorals: ['klatka'],
  delts: 'delts',
  biceps: ['biceps'],
  triceps: ['triceps'],
  abs: ['brzuch'],
  quads: ['czworoglowe'],
  lats: ['najszersze'],
  'upper back': ['plecy-gora'],
  glutes: ['posladki'],
  calves: ['lydki'],
  obliques: ['brzuch'],
  hamstrings: ['dwuglowe'],
  forearms: ['przedramiona'],
  'cardiovascular system': [],
  spine: ['prostowniki'],
  traps: ['plecy-gora'],
  adductors: ['przywodziciele'],
  'serratus anterior': ['klatka'],
  abductors: ['posladki'],
  'levator scapulae': ['plecy-gora'],
  shins: ['lydki'],
};

/** Mięśnie pomocnicze ze źródła (39 nazw, część to synonimy). Pusta lista — szyja. */
export const SECONDARY_OF: Record<string, MuscleId[]> = {
  shoulders: ['bark-przod'],
  deltoids: ['bark-przod'],
  'rear deltoids': ['bark-tyl'],
  'rotator cuff': ['bark-tyl'],
  triceps: ['triceps'],
  biceps: ['biceps'],
  brachialis: ['biceps'],
  forearms: ['przedramiona'],
  wrists: ['przedramiona'],
  'wrist extensors': ['przedramiona'],
  'wrist flexors': ['przedramiona'],
  hands: ['przedramiona'],
  'grip muscles': ['przedramiona'],
  chest: ['klatka'],
  'upper chest': ['klatka'],
  pectorals: ['klatka'],
  'serratus anterior': ['klatka'],
  core: ['brzuch'],
  abdominals: ['brzuch'],
  abs: ['brzuch'],
  obliques: ['brzuch'],
  'lower abs': ['brzuch'],
  'lower back': ['prostowniki'],
  spine: ['prostowniki'],
  back: ['plecy-gora'],
  'upper back': ['plecy-gora'],
  rhomboids: ['plecy-gora'],
  trapezius: ['plecy-gora'],
  traps: ['plecy-gora'],
  'levator scapulae': ['plecy-gora'],
  lats: ['najszersze'],
  'latissimus dorsi': ['najszersze'],
  glutes: ['posladki'],
  abductors: ['posladki'],
  hamstrings: ['dwuglowe'],
  quadriceps: ['czworoglowe'],
  quads: ['czworoglowe'],
  'hip flexors': ['czworoglowe'],
  adductors: ['przywodziciele'],
  'inner thighs': ['przywodziciele'],
  groin: ['przywodziciele'],
  calves: ['lydki'],
  soleus: ['lydki'],
  shins: ['lydki'],
  ankles: ['lydki'],
  'ankle stabilizers': ['lydki'],
  feet: ['lydki'],
  sternocleidomastoid: [],
};

export function musclesOf(row: CatalogRow): MuscleUse {
  const t = TARGET_OF[row.t];
  const p: MuscleId[] = t === 'delts' ? [deltOf(row.n[1])] : [...(t ?? [])];
  const s: MuscleId[] = [];
  for (const name of row.s) {
    const list = name === 'shoulders' || name === 'deltoids' ? [deltOf(row.n[1])] : (SECONDARY_OF[name] ?? []);
    for (const m of list) if (!p.includes(m) && !s.includes(m)) s.push(m);
  }
  return { p, s };
}

/* ---------------- Silnik ---------------- */

/** Partia ruchu z głównego mięśnia — ta sama siatka, którą liczą energia, odznaki i atlas. */
const GROUP_OF: Record<MuscleId, string> = {
  klatka: GROUPS.PUSH,
  'bark-przod': GROUPS.PUSH,
  'bark-bok': GROUPS.PUSH,
  'bark-tyl': GROUPS.PULL,
  triceps: GROUPS.PUSH,
  najszersze: GROUPS.PULL,
  'plecy-gora': GROUPS.PULL,
  biceps: GROUPS.PULL,
  przedramiona: GROUPS.PULL,
  brzuch: GROUPS.CORE,
  prostowniki: GROUPS.HINGE,
  posladki: GROUPS.HINGE,
  dwuglowe: GROUPS.HINGE,
  czworoglowe: GROUPS.SQUAT,
  przywodziciele: GROUPS.SQUAT,
  lydki: GROUPS.LEGS,
};

/** Ruch mierzony czasem: rozciąganie, przytrzymania, deski, joga, cardio. */
export function isTimed(row: CatalogRow): boolean {
  if (row.b === 'cardio' || row.t === 'cardiovascular system') return true;
  return /stretch|\bhold\b|plank|\bpose\b|isometric|wall sit|static|\bhang\b|bridge hold/i.test(row.n[1]);
}

/** Powtórzenia liczone na stronę: jednorącz, jednonóż, naprzemiennie. */
const isSided = (nameEn: string): boolean =>
  /single[- ]arm|one[- ]arm|single[- ]leg|one[- ]leg|unilateral|alternat/i.test(nameEn);

/** Ciężar startowy z dołu drabiny — i tak koryguje go faza próbna. */
const START_W: Partial<Record<Gear, number>> = { barbell: 20, dumbbell: 6, kettlebell: 8, machine: 10 };

export function defOf(row: CatalogRow): CatalogDef {
  const gear = GEAR_OF[row.e] ?? 'bodyweight';
  const muscles = musclesOf(row);
  const w = START_W[gear];
  const timed = isTimed(row);
  const side = isSided(row.n[1]);
  let mode: Mode;
  let unit: Unit;
  let def: ExerciseDefaults;
  if (timed) {
    mode = 'carry';
    unit = 'secs';
    def = { sets: 3, target: 30, min: 20, max: 60, ...(w !== undefined ? { w } : {}) };
  } else if (w !== undefined) {
    mode = 'grind';
    unit = 'reps';
    def = { sets: 3, target: 10, min: 8, max: 12, w };
  } else {
    mode = 'body';
    unit = 'reps';
    def = { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 6, max: 15 };
  }
  return {
    src: row.i,
    name: row.n,
    eq: row.e,
    gear,
    mode,
    unit,
    ...(side ? { side } : {}),
    def,
    group: muscles.p[0] ? GROUP_OF[muscles.p[0]] : GROUPS.FULL,
    muscles,
  };
}
