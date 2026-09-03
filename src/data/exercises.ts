import type { EffortKey, Exercise, ExerciseId, ReadyKey, StageKey, Workout } from '../types';

/** Kolory z zawodowego standardu kettlebli — obciążenie rozpoznajesz zanim przeczytasz liczbę. */
export const KB_COLORS: Record<number, string> = {
  4: '#9AA3A6',
  6: '#D794B8',
  8: '#E8558F',
  10: '#7FA84A',
  12: '#2C7CB8',
  14: '#6B4C93',
  16: '#E0B325',
  20: '#7A47A0',
  24: '#3B8F4A',
  28: '#DB7420',
  32: '#BE3630',
  36: '#6B7075',
  40: '#B9BCB6',
};
export const kbColor = (w: number): string => KB_COLORS[w] ?? '#6B7075';

export const STAGES: Record<StageKey, string[]> = {
  pullup: ['negatywy 4–5 s', 'z gumą oporową', 'pełne powtórzenia', 'pauza 2 s w górze', 'z obciążeniem'],
  pushup: ['ręce na podwyższeniu', 'na podłodze', 'nogi na ławce', 'tempo 3 s w dół', 'deficyt na kettlebellach'],
  core: [
    'hollow hold, zgięte nogi',
    'hollow hold, wyprostowane',
    'hollow, ramiona nad głową',
    'unoszenie kolan w zwisie',
    'unoszenie prostych nóg',
  ],
};

/**
 * Skala wysiłku ma trzy stopnie, bo metaanalizy oceny zapasu powtórzeń pokazują,
 * że ludzie mylą się średnio o jedno powtórzenie. Drobniejsza podziałka udawałaby
 * precyzję, której nie ma.
 */
export const EFFORT: Record<EffortKey, { label: string; sub: string; rir: number }> = {
  easy: { label: 'Łatwo', sub: 'zostały 3+', rir: 3 },
  solid: { label: 'Solidnie', sub: 'zostały 1–2', rir: 1.5 },
  max: { label: 'Na maksa', sub: 'nic nie zostało', rir: 0 },
};

export const READY: Record<ReadyKey, string> = {
  low: 'Ciężki dzień',
  ok: 'Normalnie',
  high: 'Świeżo',
};

export const EX: Record<ExerciseId, Exercise> = {
  swing2: {
    name: 'Swing obunóż',
    group: 'Zawias biodrowy',
    mode: 'ballistic',
    unit: 'reps',
    def: { sets: 4, minSets: 4, maxSets: 8, target: 10, min: 10, max: 10, w: 20 },
    hint: 'Wybuchowo z bioder. Kończysz serię, gdy prędkość spada — nie na granicy sił.',
  },
  swing1: {
    name: 'Swing jednorącz',
    group: 'Zawias biodrowy',
    mode: 'ballistic',
    unit: 'reps',
    side: true,
    def: { sets: 4, minSets: 4, maxSets: 8, target: 10, min: 10, max: 10, w: 16 },
    hint: 'Wolna ręka odwiedziona, biodra bez rotacji. Powtórzenia na stronę.',
  },
  rdl: {
    name: 'RDL obunóż',
    group: 'Zawias biodrowy',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 12, w: 24 },
    hint: 'Kettlebell blisko nóg, biodra do tyłu, plecy neutralne.',
  },
  goblet: {
    name: 'Goblet squat',
    group: 'Przysiad',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 12, w: 16 },
    hint: 'Łokcie między kolanami w dole, pięty na ziemi.',
  },
  lunge: {
    name: 'Wykrok w front racku',
    group: 'Przysiad',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 8, min: 8, max: 12, w: 12 },
    hint: 'Kettlebell przy klatce, kolano tylnej nogi lekko dotyka podłogi.',
  },
  row: {
    name: 'Wiosłowanie jednorącz',
    group: 'Ciągnięcie',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 8, min: 8, max: 12, w: 16 },
    hint: 'Bark ściągnięty w dół, bez rotacji tułowia.',
  },
  pullup: {
    name: 'Podciąganie podchwytem',
    group: 'Ciągnięcie',
    mode: 'stage',
    stages: 'pullup',
    unit: 'reps',
    def: { sets: 3, target: 4, min: 4, max: 8 },
    hint: 'Ruch z łopatek, pełny zwis na dole.',
  },
  curl: {
    name: 'Uginania ramion',
    group: 'Ciągnięcie',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 12, w: 12 },
    hint: 'Chwyt za rogi uchwytu — nadgarstek zostaje neutralny.',
  },
  press: {
    name: 'Wyciskanie nad głowę',
    group: 'Pchanie',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 5, min: 5, max: 10, w: 12 },
    hint: 'Zacznij z półklęku, jeśli tracisz stabilność w staniu.',
  },
  floor: {
    name: 'Floor press jednorącz',
    group: 'Pchanie',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 8, min: 8, max: 12, w: 16 },
    hint: 'Łokieć pod kątem 45°, kontrolowane opuszczanie.',
  },
  pushup: {
    name: 'Pompki',
    group: 'Pchanie',
    mode: 'stage',
    stages: 'pushup',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 15 },
    hint: 'Ciało w jednej linii, łokcie 45° od tułowia.',
  },
  dip: {
    name: 'Dipy',
    group: 'Pchanie',
    mode: 'body',
    unit: 'reps',
    def: { sets: 2, minSets: 2, maxSets: 4, target: 6, min: 6, max: 12 },
    hint: 'Dokładaj tylko, gdy po pompkach zostaje zapas.',
  },
  tgu: {
    name: 'Turkish get-up',
    group: 'Całe ciało',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 2, min: 2, max: 5, w: 12 },
    hint: 'Pierwszy raz? Zacznij z butem na pięści zamiast kettlebell.',
  },
  complex: {
    name: 'Kompleks: clean + press + squat',
    group: 'Całe ciało',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 3, min: 3, max: 6, w: 12 },
    hint: 'Jedna runda to 3 clean, 3 wyciskania, 3 przysiady na stronę. Wpisujesz rundy.',
  },
  carry: {
    name: 'Suitcase carry',
    group: 'Core i carry',
    mode: 'carry',
    unit: 'secs',
    side: true,
    def: { sets: 3, target: 30, min: 30, max: 60, w: 20 },
    hint: 'Tułów pionowo, bez przechylania się na bok.',
  },
  farmer: {
    name: 'Farmer carry',
    group: 'Core i carry',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 30, min: 30, max: 60, w: 16 },
    hint: 'Pośladki napięte, żebra ściągnięte w dół.',
  },
  core: {
    name: 'Praca nad core',
    group: 'Core i carry',
    mode: 'stage',
    stages: 'core',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 15 },
    hint: 'Plecy dociśnięte do podłogi, żebra ściągnięte w dół.',
  },
  calf: {
    name: 'Wspięcia na palce',
    group: 'Nogi — dodatkowe',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 12, min: 12, max: 20 },
    hint: 'Pełne opuszczenie pięty, sekunda pauzy w górze.',
  },
  calf1: {
    name: 'Wspięcia na palce jednonóż',
    group: 'Nogi — dodatkowe',
    mode: 'body',
    unit: 'reps',
    side: true,
    def: { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 10, max: 15 },
    hint: 'Druga ręka na ścianie dla równowagi.',
  },
};

export const ALL: ExerciseId[] = Object.keys(EX);
export const WEIGHTED: ExerciseId[] = ALL.filter((id) => EX[id]!.def.w !== undefined);

export const BUILTIN: Workout[] = [
  {
    id: 'A',
    name: 'Trening A',
    items: [
      { ex: 'swing2' },
      { ex: 'goblet' },
      { ex: 'row' },
      { ex: 'floor' },
      { ex: 'carry' },
      { ex: 'pullup' },
      { ex: 'core' },
      { ex: 'calf' },
    ],
  },
  {
    id: 'B',
    name: 'Trening B',
    items: [
      { ex: 'swing1' },
      { ex: 'lunge' },
      { ex: 'press' },
      { ex: 'rdl' },
      { ex: 'farmer' },
      { ex: 'pushup' },
      { ex: 'calf1' },
    ],
  },
  {
    id: 'C',
    name: 'Trening C — całe ciało',
    items: [{ ex: 'tgu' }, { ex: 'complex' }, { ex: 'goblet' }, { ex: 'farmer' }, { ex: 'core' }],
  },
  {
    // Dzień lekki. Nie „to samo, tylko słabiej” — po prostu bez ciężkiego zawiasu, przysiadu
    // i wyciskania. Przy pięciu i więcej treningach w tygodniu to on decyduje, czy plan da się
    // wytrzymać przez trzy miesiące.
    id: 'D',
    name: 'Trening D — lekki',
    items: [{ ex: 'carry' }, { ex: 'core' }, { ex: 'calf' }, { ex: 'calf1' }, { ex: 'curl' }],
  },
];

export const ex = (id: ExerciseId): Exercise => {
  const e = EX[id];
  if (!e) throw new Error(`Nieznane ćwiczenie: ${id}`);
  return e;
};
