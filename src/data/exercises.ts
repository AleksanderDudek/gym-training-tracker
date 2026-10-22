import type {
  AppState,
  EffortKey,
  Exercise,
  ExerciseId,
  Gear,
  ProfileKey,
  ReadyKey,
  StageKey,
  Workout,
  WorkoutGear,
} from '../types';
import { LIBRARY } from './workouts';
import { PROFILES, PROFILE_BASE, PROFILE_KEYS, gearsOf, profileWorkoutId } from './profiles';
import { EX_MUSCLES } from './muscles';
import { say } from '../i18n';

/**
 * Kolory z zawodowego standardu kettlebli — obciążenie rozpoznajesz zanim przeczytasz liczbę.
 * Dwa odcienie są o włos ciemniejsze od standardu (12 i 24 kg), bo na oryginalnych biała
 * liczba na kafelku dawała 4,4:1; po przyciemnieniu trzyma 4,6:1. Reszta bez zmian —
 * to kod funkcjonalny, nie paleta marki.
 */
export const KB_COLORS: Record<number, string> = {
  4: '#9AA3A6',
  6: '#D794B8',
  8: '#E8558F',
  10: '#7FA84A',
  12: '#2B7AB5',
  14: '#6B4C93',
  16: '#E0B325',
  20: '#7A47A0',
  24: '#378444',
  28: '#DB7420',
  32: '#BE3630',
  36: '#6B7075',
  40: '#B9BCB6',
};
export const kbColor = (w: number): string => KB_COLORS[w] ?? '#6B7075';

/**
 * Czy numer na kafelku ma być biały. Ciemne kolory kettlebli niosą biel powyżej 4,5:1,
 * jasne — `--ink`. Bez tego podziału żółta szesnastka miała biały napis na 1,8:1.
 */
const DARK_KB = new Set([12, 14, 20, 24, 32, 36]);
export const kbInkIsLight = (w: number): boolean => DARK_KB.has(w) || !(w in KB_COLORS);

/**
 * Drabiny ciężaru na sprzęt. Sztanga zaczyna od pustego gryfu i idzie skokiem talerzy,
 * hantle skaczą co 2 kg do dwudziestki i rzadziej wyżej, stos maszyny co 5. Progresja
 * dobiera ciężary wyłącznie z drabiny właściwej dla ćwiczenia, więc nigdy nie zaproponuje
 * obciążenia, którego nie da się nałożyć.
 */
export const LADDERS: Record<Gear, number[]> = {
  kettlebell: [4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 36, 40],
  dumbbell: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 30, 34, 38, 42, 46, 50],
  barbell: [
    20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 130, 140, 160, 180, 200,
  ],
  machine: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 120, 140],
  // Gumy i masa ciała nie mają ciężaru — drabina jest pusta, a progresja idzie etapami.
  band: [],
  bodyweight: [],
};

export const GEAR_LABEL: Record<Gear, string> = {
  kettlebell: 'kettlebell',
  dumbbell: say('hantle', 'dumbbells'),
  barbell: say('sztanga', 'barbell'),
  machine: say('maszyna', 'machine'),
  band: say('guma', 'band'),
  bodyweight: say('masa ciała', 'bodyweight'),
};

/** Sprzęt ćwiczenia. Brak pola oznacza kettlebell — tak wyglądała pierwsza biblioteka. */
export const gearOf = (id: ExerciseId): Gear => EX[id]?.gear ?? 'kettlebell';

/**
 * Drabina ciężaru dla ćwiczenia. Kettlebelle bierze z ustawień użytkownika, bo tę jedną
 * listę da się tam edytować; reszta idzie z wartości domyślnych, chyba że zapis mówi inaczej.
 */
export function ladderFor(state: AppState, id: ExerciseId): number[] {
  const gear = gearOf(id);
  if (gear === 'kettlebell') return state.cfg.weights;
  return state.cfg.ladders?.[gear] ?? LADDERS[gear];
}

export const STAGES: Record<StageKey, string[]> = {
  pullup: [
    say('negatywy 4–5 s', 'negatives, 4–5 s down'),
    say('z gumą oporową', 'with a resistance band'),
    say('pełne powtórzenia', 'full reps'),
    say('pauza 2 s w górze', '2 s pause at the top'),
    say('z obciążeniem', 'weighted'),
  ],
  pushup: [
    say('ręce na podwyższeniu', 'hands on a raised surface'),
    say('na podłodze', 'on the floor'),
    say('nogi na ławce', 'feet on a bench'),
    say('tempo 3 s w dół', '3 s on the way down'),
    say('deficyt na kettlebellach', 'deficit on kettlebells'),
  ],
  core: [
    say('hollow hold, zgięte nogi', 'hollow hold, knees bent'),
    say('hollow hold, wyprostowane', 'hollow hold, legs straight'),
    say('hollow, ramiona nad głową', 'hollow, arms overhead'),
    say('unoszenie kolan w zwisie', 'hanging knee raises'),
    say('unoszenie prostych nóg', 'straight-leg raises'),
  ],
  pistol: [
    say('przysiad na jednej nodze do ławki', 'single-leg squat to a bench'),
    say('z przytrzymaniem drążka', 'holding on to a bar'),
    say('z przeciwwagą w rękach', 'with a counterweight in your hands'),
    say('pełny pistol', 'full pistol'),
    say('pistol z obciążeniem', 'weighted pistol'),
  ],
  hspu: [
    say('pompki w staniu na rękach przy ścianie, zakres do połowy', 'wall handstand push-ups, half range'),
    say('pełny zakres przy ścianie', 'full range against the wall'),
    say('z głową do poduszki, nogi na ścianie', 'head to a cushion, feet on the wall'),
    say('w deficycie na podwyższeniu', 'deficit, hands raised'),
    say('bez ściany', 'freestanding'),
  ],
};

/**
 * Skala wysiłku ma trzy stopnie, bo metaanalizy oceny zapasu powtórzeń pokazują,
 * że ludzie mylą się średnio o jedno powtórzenie. Drobniejsza podziałka udawałaby
 * precyzję, której nie ma.
 */
export const EFFORT: Record<EffortKey, { label: string; sub: string; rir: number }> = {
  easy: { label: say('Łatwo', 'Easy'), sub: say('zostały 3+', '3+ left'), rir: 3 },
  solid: { label: say('Solidnie', 'Solid'), sub: say('zostały 1–2', '1–2 left'), rir: 1.5 },
  max: { label: say('Na maksa', 'All out'), sub: say('nic nie zostało', 'nothing left'), rir: 0 },
};

export const READY: Record<ReadyKey, string> = {
  low: say('Ciężki dzień', 'Rough day'),
  ok: say('Normalnie', 'Normal'),
  high: say('Świeżo', 'Fresh'),
};

/**
 * Partie ruchu. Nazwa partii to klucz — porównują ją `engine/energy.ts` (ciężkie partie),
 * `engine/badges.ts` (odznaki partii) i `engine/exbadges.ts` (grafiki) — więc zostaje po polsku
 * w każdym języku, a na ekran idzie `groupLabel`.
 */
const HINGE = 'Zawias biodrowy';
const SQUAT = 'Przysiad';
const PULL = 'Ciągnięcie'; // i18n-ignore: klucz partii, etykieta w groupLabel
const PUSH = 'Pchanie';
const FULL = 'Całe ciało'; // i18n-ignore: klucz partii, etykieta w groupLabel
const CORE = 'Core i carry';
const LEGS = 'Nogi — dodatkowe';

const GROUP_LABEL: Record<string, string> = {
  [HINGE]: say(HINGE, 'Hip hinge'),
  [SQUAT]: say(SQUAT, 'Squat'),
  [PULL]: say(PULL, 'Pull'),
  [PUSH]: say(PUSH, 'Push'),
  [FULL]: say(FULL, 'Full body'),
  [CORE]: say(CORE, 'Core and carries'),
  [LEGS]: say(LEGS, 'Legs — extras'),
};

/** Partia ruchu na ekran: `group` ćwiczenia jest kluczem po polsku, etykieta idzie za językiem. */
export const groupLabel = (group: string): string => GROUP_LABEL[group] ?? group;

export const EX: Record<ExerciseId, Exercise> = {
  swing2: {
    name: say('Swing obunóż', 'Two-hand swing'),
    group: HINGE,
    mode: 'ballistic',
    unit: 'reps',
    def: { sets: 4, minSets: 4, maxSets: 8, target: 10, min: 10, max: 10, w: 20 },
    hint: say('Wybuchowo z bioder. Kończysz serię, gdy prędkość spada — nie na granicy sił.', 'Explode from the hips. End the set when the speed drops, not when you run out of strength.'),
  },
  swing1: {
    name: say('Swing jednorącz', 'One-arm swing'),
    group: HINGE,
    mode: 'ballistic',
    unit: 'reps',
    side: true,
    def: { sets: 4, minSets: 4, maxSets: 8, target: 10, min: 10, max: 10, w: 16 },
    hint: say('Wolna ręka odwiedziona, biodra bez rotacji. Powtórzenia na stronę.', 'Free arm out to the side, no hip rotation. Reps are per side.'),
  },
  rdl: {
    name: say('RDL obunóż', 'Kettlebell RDL'),
    group: HINGE,
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 12, w: 24 },
    hint: say('Kettlebell blisko nóg, biodra do tyłu, plecy neutralne.', 'Keep the kettlebell close to your legs, hips back, back neutral.'),
  },
  goblet: {
    name: 'Goblet squat',
    group: SQUAT,
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 12, w: 16 },
    hint: say('Łokcie między kolanami w dole, pięty na ziemi.', 'Elbows inside your knees at the bottom, heels down.'),
  },
  lunge: {
    name: say('Wykrok w front racku', 'Front-rack lunge'),
    group: SQUAT,
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 8, min: 8, max: 12, w: 12 },
    hint: say('Kettlebell przy klatce, kolano tylnej nogi lekko dotyka podłogi.', 'Kettlebell at your chest, back knee just touching the floor.'),
  },
  row: {
    name: say('Wiosłowanie jednorącz', 'One-arm row'),
    group: PULL,
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 8, min: 8, max: 12, w: 16 },
    hint: say('Bark ściągnięty w dół, bez rotacji tułowia.', 'Shoulder pulled down, no twisting through your torso.'),
  },
  pullup: {
    name: say('Podciąganie podchwytem', 'Chin-up'),
    group: PULL,
    mode: 'stage',
    stages: 'pullup',
    unit: 'reps',
    def: { sets: 3, target: 4, min: 4, max: 8 },
    hint: say('Ruch z łopatek, pełny zwis na dole.', 'Start from your shoulder blades, full hang at the bottom.'),
  },
  curl: {
    name: say('Uginania ramion', 'Kettlebell curl'),
    group: PULL,
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 12, w: 12 },
    hint: say('Chwyt za rogi uchwytu — nadgarstek zostaje neutralny.', 'Hold the handle by the horns so your wrist stays neutral.'),
  },
  press: {
    name: say('Wyciskanie nad głowę', 'Overhead press'),
    group: PUSH,
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 5, min: 5, max: 10, w: 12 },
    hint: say('Zacznij z półklęku, jeśli tracisz stabilność w staniu.', 'Start half-kneeling if you lose your balance standing.'),
  },
  floor: {
    name: say('Floor press jednorącz', 'One-arm floor press'),
    group: PUSH,
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 8, min: 8, max: 12, w: 16 },
    hint: say('Łokieć pod kątem 45°, kontrolowane opuszczanie.', 'Elbow at 45°, lower under control.'),
  },
  pushup: {
    name: say('Pompki', 'Push-ups'),
    group: PUSH,
    mode: 'stage',
    stages: 'pushup',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 15 },
    hint: say('Ciało w jednej linii, łokcie 45° od tułowia.', 'Body in one line, elbows 45° from your torso.'),
  },
  dip: {
    name: say('Dipy', 'Dips'),
    group: PUSH,
    mode: 'body',
    unit: 'reps',
    def: { sets: 2, minSets: 2, maxSets: 4, target: 6, min: 6, max: 12 },
    hint: say('Dokładaj tylko, gdy po pompkach zostaje zapas.', 'Add these only when you have something left after the push-ups.'),
  },
  tgu: {
    name: 'Turkish get-up',
    group: FULL,
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 2, min: 2, max: 5, w: 12 },
    hint: say('Pierwszy raz? Zacznij z butem na pięści zamiast kettlebell.', 'First time? Start with a shoe balanced on your fist instead of a kettlebell.'),
  },
  complex: {
    name: say('Kompleks: clean + press + squat', 'Complex: clean + press + squat'),
    group: FULL,
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 3, min: 3, max: 6, w: 12 },
    hint: say('Jedna runda to 3 clean, 3 wyciskania, 3 przysiady na stronę. Wpisujesz rundy.', 'One round is 3 cleans, 3 presses and 3 squats per side. Log rounds.'),
  },
  carry: {
    name: 'Suitcase carry',
    group: CORE,
    mode: 'carry',
    unit: 'secs',
    side: true,
    def: { sets: 3, target: 30, min: 30, max: 60, w: 20 },
    hint: say('Tułów pionowo, bez przechylania się na bok.', 'Stay upright, no leaning to the side.'),
  },
  farmer: {
    name: 'Farmer carry',
    group: CORE,
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 30, min: 30, max: 60, w: 16 },
    hint: say('Pośladki napięte, żebra ściągnięte w dół.', 'Glutes tight, ribs down.'),
  },
  core: {
    name: say('Praca nad core', 'Core work'),
    group: CORE,
    mode: 'stage',
    stages: 'core',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 8, max: 15 },
    hint: say('Plecy dociśnięte do podłogi, żebra ściągnięte w dół.', 'Lower back pressed into the floor, ribs down.'),
  },
  calf: {
    name: say('Wspięcia na palce', 'Calf raises'),
    group: LEGS,
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 12, min: 12, max: 20 },
    hint: say('Pełne opuszczenie pięty, sekunda pauzy w górze.', 'Lower your heels all the way, pause for a second at the top.'),
  },
  calf1: {
    name: say('Wspięcia na palce jednonóż', 'Single-leg calf raises'),
    group: LEGS,
    mode: 'body',
    unit: 'reps',
    side: true,
    def: { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 10, max: 15 },
    hint: say('Druga ręka na ścianie dla równowagi.', 'Other hand on the wall for balance.'),
  },

  /* ---------------- Zawias biodrowy ---------------- */
  deadlift: {
    name: say('Martwy ciąg klasyczny', 'Conventional deadlift'),
    group: HINGE,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 5, min: 5, max: 8, w: 60 },
    hint: say('Sztanga nad środkiem stopy, łopatki nad gryfem, plecy neutralne od pierwszego centymetra.', 'Bar over mid-foot, shoulder blades over the bar, back neutral from the very first centimetre.'),
  },
  deadlift_sumo: {
    name: say('Martwy ciąg sumo', 'Sumo deadlift'),
    group: HINGE,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 5, min: 5, max: 8, w: 60 },
    hint: say('Szeroka pozycja, stopy wyprowadzone na zewnątrz, kolana idą śladem palców.', 'Wide stance, toes turned out, knees tracking over your toes.'),
  },
  rdl_bb: {
    name: say('RDL ze sztangą', 'Barbell RDL'),
    group: HINGE,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 6, max: 12, w: 40 },
    hint: say('Kolana lekko ugięte i nieruchome. Schodzisz tak nisko, jak pozwalają dwójgłowe bez zaokrąglania pleców.', 'Knees soft and still. Go as low as your hamstrings allow without rounding your back.'),
  },
  rdl_db: {
    name: say('RDL z hantlami', 'Dumbbell RDL'),
    group: HINGE,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 12 },
    hint: say('Hantle suną po udach. Ciężar trzymasz blisko, inaczej dokładasz dźwigni kręgosłupowi.', 'Slide the dumbbells down your thighs. Keep the weight close, or you add leverage on your spine.'),
  },
  rdl_single: {
    name: say('RDL jednonóż', 'Single-leg RDL'),
    group: HINGE,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 8, min: 6, max: 12, w: 10 },
    hint: say('Biodra równolegle do podłogi — noga wolna nie skręca miednicy na bok.', "Hips square to the floor; don't let the free leg twist your pelvis open."),
  },
  hipthrust: {
    name: 'Hip thrust',
    group: HINGE,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 15, w: 40 },
    hint: say('Żebra ściągnięte, podbródek do mostka. W górze pauza i pełne zamknięcie bioder.', 'Ribs down, chin tucked. Pause at the top with your hips fully locked out.'),
  },
  glutebridge: {
    name: say('Mostek biodrowy', 'Glute bridge'),
    group: HINGE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 15, min: 12, max: 25 },
    hint: say('Napięcie z pośladków, nie z lędźwi. Pięty pod kolanami.', 'Squeeze from your glutes, not your lower back. Heels under your knees.'),
  },
  glutebridge1: {
    name: say('Mostek biodrowy jednonóż', 'Single-leg glute bridge'),
    group: HINGE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    side: true,
    def: { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 8, max: 20 },
    hint: say('Miednica równo, bez opadania na bok. Druga noga zgięta albo wyprostowana w górę.', 'Keep your pelvis level, no dropping to one side. Other leg bent or straight up.'),
  },
  goodmorning: {
    name: 'Good morning',
    group: HINGE,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 12, w: 30 },
    hint: say('Lekki ciężar i pełna kontrola. To ćwiczenie techniczne, nie siłowe.', 'Light weight, full control. This is a technique drill, not a strength lift.'),
  },
  hyper: {
    name: say('Wyprosty tułowia', 'Back extensions'),
    group: HINGE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 12, min: 10, max: 20 },
    hint: say('Zatrzymujesz się w linii ciała. Przeprost w górze niczego nie dokłada.', 'Stop when your body is in line. Overextending at the top adds nothing.'),
  },
  nordic: {
    name: 'Nordic curl',
    group: HINGE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 2, maxSets: 4, target: 4, min: 3, max: 8 },
    hint: say('Opuszczasz się tak wolno, jak potrafisz, i odbijasz rękami. Bardzo mocne ćwiczenie ekscentryczne.', 'Lower yourself as slowly as you can, then push back up with your hands. A very hard eccentric exercise.'),
  },
  legcurl: {
    name: say('Uginanie nóg na maszynie', 'Machine leg curl'),
    group: HINGE,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 15, w: 25 },
    hint: say('Biodra dociśnięte do oparcia. Faza opuszczania wolniejsza od zginania.', 'Hips pressed into the pad. Lower more slowly than you curl.'),
  },
  pullthrough: {
    name: say('Przeciąganie liny między nogami', 'Cable pull-through'),
    group: HINGE,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 15, w: 25 },
    hint: say('Ruch z bioder, nie z ramion. Ręce są tylko liną.', 'Move from your hips, not your arms. Your arms are just ropes.'),
  },
  clean_kb: {
    name: say('Clean kettlebell', 'Kettlebell clean'),
    group: HINGE,
    gear: 'kettlebell',
    mode: 'ballistic',
    unit: 'reps',
    side: true,
    def: { sets: 4, minSets: 3, maxSets: 6, target: 8, min: 8, max: 8, w: 12 },
    hint: say('Kettlebell ma wylądować miękko w racku. Klapnięcie o przedramię znaczy złą trajektorię.', 'Land the kettlebell softly in the rack. A slap on the forearm means the path is wrong.'),
  },
  snatch_kb: {
    name: say('Snatch kettlebell', 'Kettlebell snatch'),
    group: HINGE,
    gear: 'kettlebell',
    mode: 'ballistic',
    unit: 'reps',
    side: true,
    def: { sets: 4, minSets: 3, maxSets: 6, target: 6, min: 6, max: 6, w: 12 },
    hint: say('Jeden płynny ruch od zawiasu po blokadę nad głową. Ucz się dopiero po czystym swingu jednorącz.', 'One smooth move from the hinge to lockout overhead. Learn it only once your one-arm swing is clean.'),
  },

  /* ---------------- Przysiad ---------------- */
  squat_back: {
    name: say('Przysiad ze sztangą z tyłu', 'Barbell back squat'),
    group: SQUAT,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 6, min: 5, max: 10, w: 50 },
    hint: say('Gryf na mięśniach, nie na kręgach. Schodzisz tak nisko, jak utrzymujesz neutralną miednicę.', 'Bar on muscle, not on bone. Go as low as you can keep your pelvis neutral.'),
  },
  squat_front: {
    name: say('Przysiad przedni', 'Front squat'),
    group: SQUAT,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 6, min: 5, max: 10, w: 40 },
    hint: say('Łokcie wysoko przez cały ruch. Gdy opadną, gryf zjedzie z barków.', 'Elbows high the whole way. If they drop, the bar rolls off your shoulders.'),
  },
  squat_box: {
    name: say('Przysiad do skrzyni', 'Box squat'),
    group: SQUAT,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 6, max: 10, w: 40 },
    hint: say('Siadasz, nie spadasz. Skrzynia wyznacza głębokość, nie odbija.', "Sit, don't drop. The box sets the depth; don't bounce off it."),
  },
  hacksquat: {
    name: 'Hack squat',
    group: SQUAT,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 40 },
    hint: say('Plecy płasko na oparciu przez cały zakres, stopy na środku platformy.', 'Back flat on the pad through the whole range, feet in the middle of the platform.'),
  },
  legpress: {
    name: say('Wypychanie na suwnicy', 'Leg press'),
    group: SQUAT,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 15, w: 60 },
    hint: say('Miednica zostaje na oparciu. Gdy zaczyna się odrywać, zakres jest za duży.', "Keep your pelvis on the seat. If it starts to lift, you're going too deep."),
  },
  bulgarian: {
    name: say('Przysiad bułgarski', 'Bulgarian split squat'),
    group: SQUAT,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 8, min: 6, max: 12, w: 10 },
    hint: say('Stopa przednia dość daleko od ławki, żeby kolano nie wychodziło daleko przed palce.', "Front foot far enough from the bench that your knee doesn't travel far past your toes."),
  },
  stepup: {
    name: say('Wejścia na skrzynię', 'Box step-ups'),
    group: SQUAT,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 10, min: 8, max: 15, w: 10 },
    hint: say('Cała praca z nogi na skrzyni. Noga dolna nie odbija się od podłogi.', "All the work comes from the leg on the box. Don't push off with the bottom leg."),
  },
  lunge_walk: {
    name: say('Wykroki chodzone', 'Walking lunges'),
    group: SQUAT,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 10, min: 8, max: 14, w: 10 },
    hint: say('Tułów pionowo, krok na tyle długi, żeby kolano tylne schodziło pod biodro.', 'Stay upright, with a step long enough for your back knee to drop under your hip.'),
  },
  pistol: {
    name: say('Przysiad jednonóż', 'Single-leg squat'),
    group: SQUAT,
    gear: 'bodyweight',
    mode: 'stage',
    stages: 'pistol',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 5, min: 3, max: 10 },
    hint: say('Pięta zostaje na podłodze. Brak zakresu w kostce to najczęstszy powód, dla którego nie wychodzi.', "Keep your heel down. Stiff ankles are the most common reason it doesn't work."),
  },
  squat_air: {
    name: say('Przysiad bez obciążenia', 'Bodyweight squat'),
    group: SQUAT,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 20, min: 15, max: 35 },
    hint: say('Pełny zakres i równe tempo. To rozgrzewka i nauka wzorca, nie wyścig.', "Full range, steady tempo. It's a warm-up and pattern practice, not a race."),
  },
  squat_jump: {
    name: say('Wyskoki z przysiadu', 'Jump squats'),
    group: SQUAT,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 8, max: 20 },
    hint: say('Z przysiadu dynamicznie w górę, lądowanie miękko na całe stopy i od razu w kolejny przysiad. Kolana nad palcami, nie do środka.', 'Drive up from the squat, land softly on your whole foot and sink straight into the next one. Knees over your toes, not caving in.'),
  },
  lunge_bw: {
    name: say('Wykrok wsteczny bez obciążenia', 'Bodyweight reverse lunge'),
    group: SQUAT,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    side: true,
    def: { sets: 3, minSets: 3, maxSets: 5, target: 12, min: 10, max: 20 },
    hint: say('Krok w tył, kolano tylnej nogi prawie dotyka podłogi. Ciężar na pięcie przedniej stopy.', 'Step back until your back knee almost touches the floor. Weight on your front heel.'),
  },
  split_bw: {
    name: say('Przysiad bułgarski z nogą na krześle', 'Bulgarian split squat on a chair'),
    group: SQUAT,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    side: true,
    def: { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 8, max: 20 },
    hint: say('Tylna stopa na krześle, przednia na tyle daleko, żeby kolano nie uciekało przed palce. Lekki skłon tułowia bierze pośladek.', 'Back foot on the chair, front foot far enough that your knee stays behind your toes. A slight forward lean works your glutes.'),
  },
  sissy: {
    name: 'Sissy squat',
    group: SQUAT,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 2, maxSets: 4, target: 10, min: 8, max: 15 },
    hint: say('Mocno obciąża kolano. Wchodź stopniowo i trzymaj biodra wyprostowane.', 'Hard on the knees. Build up gradually and keep your hips straight.'),
  },
  legext: {
    name: say('Prostowanie nóg na maszynie', 'Machine leg extension'),
    group: SQUAT,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 15, w: 25 },
    hint: say('Pauza w górze zamiast szarpania. Oparcie ustawione tak, żeby oś kolana zgadzała się z osią maszyny.', "Pause at the top instead of jerking. Set the seat so your knee lines up with the machine's pivot."),
  },

  /* ---------------- Ciągnięcie ---------------- */
  row_bb: {
    name: say('Wiosłowanie sztangą', 'Barbell row'),
    group: PULL,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 6, max: 12, w: 40 },
    hint: say('Tułów blisko poziomu i nieruchomy. Gdy zaczynasz się prostować, ciężar jest za duży.', 'Torso near horizontal and still. If you start standing up, the weight is too heavy.'),
  },
  row_db: {
    name: say('Wiosłowanie hantlem', 'One-arm dumbbell row'),
    group: PULL,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 10, min: 8, max: 14, w: 14 },
    hint: say('Łokieć wzdłuż tułowia, hantel do biodra. Bez skręcania klatki.', "Elbow along your side, dumbbell to your hip. Don't twist your chest."),
  },
  row_tbar: {
    name: say('Wiosłowanie T-bar', 'T-bar row'),
    group: PULL,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 12, w: 30 },
    hint: say('Klatka oparta, łopatki pracują pełnym zakresem.', 'Chest on the pad, shoulder blades through their full range.'),
  },
  row_cable: {
    name: say('Wiosłowanie siedząc na wyciągu', 'Seated cable row'),
    group: PULL,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 35 },
    hint: say('Tułów pionowo, ruch kończy się na brzuchu. Odchylanie to już zawias, nie wiosłowanie.', 'Sit tall and finish at your stomach. Leaning back turns it into a hinge, not a row.'),
  },
  row_inverted: {
    name: say('Australijskie podciąganie', 'Inverted row'),
    group: PULL,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 8, max: 18 },
    hint: say('Ciało sztywne jak deska. Im niżej drążek, tym trudniej.', 'Body stiff as a plank. The lower the bar, the harder it gets.'),
  },
  latpulldown: {
    name: say('Ściąganie drążka do klatki', 'Lat pulldown'),
    group: PULL,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 35 },
    hint: say('Klatka do drążka, nie drążek za kark. Ruch zaczynasz łopatkami.', 'Chest to the bar, never behind your neck. Start the pull with your shoulder blades.'),
  },
  chinup: {
    name: say('Podciąganie nachwytem', 'Pull-up'),
    group: PULL,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 2, maxSets: 5, target: 5, min: 3, max: 12 },
    hint: say('Szerzej niż barki, ale nie skrajnie. Pełny zwis na dole liczy się do powtórzenia.', 'Grip wider than your shoulders, but not extreme. The full hang at the bottom is part of the rep.'),
  },
  dead_hang: {
    name: say('Zwis na drążku', 'Dead hang'),
    group: PULL,
    gear: 'bodyweight',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 20, min: 10, max: 60 },
    hint: say('Pełny chwyt kciukiem dookoła drążka, barki lekko ściągnięte w dół — nie wisisz na więzadłach.', "Thumb wrapped round the bar, shoulders pulled slightly down, so you're not hanging on your ligaments."),
  },
  facepull: {
    name: 'Face pull',
    group: PULL,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 15, min: 12, max: 20, w: 15 },
    hint: say('Lina na wysokości twarzy, łokcie wyżej niż nadgarstki. Lekko i dużo powtórzeń.', 'Rope at face height, elbows higher than wrists. Light weight, lots of reps.'),
  },
  y_raise: {
    name: say('Unoszenie ramion w literę Y leżąc', 'Prone Y raise'),
    group: PULL,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 12, min: 10, max: 20 },
    hint: say('Leżysz przodem, kciuki w górę, łopatki w dół i do siebie. Ruch mały, ale czysty — bez odrywania klatki od podłogi.', 'Lie face down, thumbs up, shoulder blades down and together. A small but clean move: keep your chest on the floor.'),
  },
  shrug: {
    name: say('Wzruszanie ramion', 'Shrugs'),
    group: PULL,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 18, w: 20 },
    hint: say('Ruch prosto w górę, bez krążenia barkami. Sekunda pauzy na szczycie.', 'Straight up, no rolling your shoulders. Pause for a second at the top.'),
  },
  pullover: {
    name: say('Przenoszenie na prostych ramionach', 'Cable pullover'),
    group: PULL,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 15, w: 20 },
    hint: say('Łokcie zablokowane, ruch wychodzi z barków i najszerszych.', 'Elbows locked; the move comes from your shoulders and lats.'),
  },
  curl_bb: {
    name: say('Uginanie ramion ze sztangą', 'Barbell curl'),
    group: PULL,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 12, w: 25 },
    hint: say('Łokcie przy tułowiu. Gdy uciekają do przodu, pracują już barki.', 'Elbows at your sides. If they drift forward, your shoulders are taking over.'),
  },
  curl_db: {
    name: say('Uginanie ramion z hantlami', 'Dumbbell curl'),
    group: PULL,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 10, min: 8, max: 14, w: 10 },
    hint: say('Pełny wyprost na dole. Supinacja w drodze w górę.', 'Straighten fully at the bottom. Turn your palms up on the way up.'),
  },
  curl_hammer: {
    name: say('Uginanie młotkowe', 'Hammer curl'),
    group: PULL,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 10, min: 8, max: 14, w: 10 },
    hint: say('Chwyt neutralny przez cały ruch. Bierze ramienno-promieniowy, nie tylko biceps.', 'Neutral grip throughout. Works the brachioradialis, not just the biceps.'),
  },
  curl_preacher: {
    name: say('Uginanie na modlitewniku', 'Preacher curl'),
    group: PULL,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 20 },
    hint: say('Na dole nie rzucasz ciężarem — ta pozycja najłatwiej przeciąża staw łokciowy.', "Don't drop the weight at the bottom: that's where the elbow is easiest to overload."),
  },

  /* ---------------- Pchanie ---------------- */
  bench: {
    name: say('Wyciskanie leżąc', 'Bench press'),
    group: PUSH,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 6, min: 5, max: 10, w: 40 },
    hint: say('Łopatki ściągnięte i schowane, stopy na podłodze. Gryf schodzi do dolnej części klatki.', 'Shoulder blades pulled back and down, feet on the floor. Lower the bar to your lower chest.'),
  },
  bench_incline: {
    name: say('Wyciskanie na skosie', 'Incline bench press'),
    group: PUSH,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 6, max: 12, w: 30 },
    hint: say('Skos 30°. Wyżej i robi się z tego wyciskanie nad głowę.', 'Set the bench at 30°. Any higher and it becomes an overhead press.'),
  },
  bench_db: {
    name: say('Wyciskanie hantlami leżąc', 'Dumbbell bench press'),
    group: PUSH,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 16 },
    hint: say('Większy zakres niż na sztandze. Na dole kontrolujesz, nie rozciągasz na siłę.', "More range than the barbell. Control the bottom, don't force the stretch."),
  },
  bench_close: {
    name: say('Wyciskanie wąskim chwytem', 'Close-grip bench press'),
    group: PUSH,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 8, min: 6, max: 12, w: 30 },
    hint: say('Chwyt na szerokość barków, łokcie blisko tułowia. Wąziej to już obciążanie nadgarstków.', 'Hands shoulder-width apart, elbows close to your body. Any narrower just loads your wrists.'),
  },
  chestpress: {
    name: say('Wyciskanie na maszynie', 'Machine chest press'),
    group: PUSH,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 35 },
    hint: say('Uchwyty na wysokości środka klatki. Łopatki zostają ściągnięte.', 'Handles level with mid-chest. Keep your shoulder blades pulled back.'),
  },
  pecdeck: {
    name: say('Rozpiętki na maszynie', 'Pec deck'),
    group: PUSH,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 16, w: 20 },
    hint: say('Lekkie ugięcie łokci zablokowane przez cały ruch. Zakres do odczucia rozciągnięcia, nie dalej.', 'Keep a slight bend in your elbows throughout. Go to a stretch, no further.'),
  },
  fly_cable: {
    name: say('Rozpiętki na wyciągach', 'Cable fly'),
    group: PUSH,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 16, w: 15 },
    hint: say('Ręce spotykają się przed klatką i zachodzą lekko na siebie.', 'Bring your hands together in front of your chest and cross them slightly.'),
  },
  ohp_bb: {
    name: say('Wyciskanie żołnierskie', 'Military press'),
    group: PUSH,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 6, min: 5, max: 10, w: 30 },
    hint: say('Pośladki i brzuch napięte. Głowa odsuwa się z drogi gryfu, lędźwie się nie wyginają.', "Glutes and abs tight. Move your head out of the bar's way; don't arch your lower back."),
  },
  ohp_db: {
    name: say('Wyciskanie hantli nad głowę', 'Dumbbell shoulder press'),
    group: PUSH,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 12, w: 12 },
    hint: say('Siedząc łatwiej o stabilność, stojąc więcej pracy dla tułowia.', 'Seated is more stable; standing gives your core more work.'),
  },
  arnold: {
    name: say('Wyciskanie Arnoldowe', 'Arnold press'),
    group: PUSH,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 10 },
    hint: say('Rotacja płynna w drodze w górę, nie szarpnięciem na starcie.', 'Rotate smoothly on the way up, not with a jerk at the start.'),
  },
  lateral: {
    name: say('Unoszenie ramion bokiem', 'Lateral raise'),
    group: PUSH,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 15, min: 12, max: 20, w: 6 },
    hint: say('Do linii barków, nie wyżej. Lekki ciężar robi tu więcej niż ciężki z zamachem.', 'Up to shoulder height, no higher. A light weight does more here than a heavy one swung up.'),
  },
  frontraise: {
    name: say('Unoszenie ramion w przód', 'Front raise'),
    group: PUSH,
    gear: 'dumbbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 16, w: 8 },
    hint: say('Bez bujania tułowiem. Zatrzymujesz się na wysokości oczu.', 'No swinging your torso. Stop at eye level.'),
  },
  pushdown: {
    name: say('Prostowanie ramion na wyciągu', 'Triceps pushdown'),
    group: PUSH,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 16, w: 20 },
    hint: say('Łokcie przyklejone do tułowia. Ruch wychodzi tylko z przedramion.', 'Elbows glued to your sides. Only your forearms move.'),
  },
  skullcrusher: {
    name: say('Francuskie wyciskanie', 'Skull crusher'),
    group: PUSH,
    gear: 'barbell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 10, min: 8, max: 14, w: 20 },
    hint: say('Łokcie nieruchome i skierowane do sufitu. Przy bólu łokci zejdź z ciężaru.', 'Elbows still and pointing at the ceiling. If your elbows hurt, go lighter.'),
  },
  pushup_diamond: {
    name: say('Pompki diamentowe', 'Diamond push-ups'),
    group: PUSH,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 8, min: 6, max: 20 },
    hint: say('Dłonie stykają się kciukami i palcami wskazującymi. Łokcie blisko tułowia.', 'Thumbs and index fingers touching. Elbows close to your body.'),
  },
  pushup_pike: {
    name: say('Pompki w podporze przodem', 'Pike push-ups'),
    group: PUSH,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 8, min: 6, max: 15 },
    hint: say('Biodra wysoko, ciało w literę V. Głowa schodzi przed dłonie.', 'Hips high, body in an upside-down V. Lower your head in front of your hands.'),
  },
  hspu: {
    name: say('Pompki w staniu na rękach', 'Handstand push-ups'),
    group: PUSH,
    gear: 'bodyweight',
    mode: 'stage',
    stages: 'hspu',
    unit: 'reps',
    def: { sets: 3, target: 4, min: 3, max: 10 },
    hint: say('Wchodź dopiero, gdy pompki w podporze przodem idą czysto. Zawsze z asekuracją ściany.', 'Only start once your pike push-ups are clean. Always with a wall for safety.'),
  },
  dip_bench: {
    name: say('Pompki na ławce', 'Bench dips'),
    group: PUSH,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 12, min: 10, max: 20 },
    hint: say('Barki nie wjeżdżają do uszu. Przy dyskomforcie z przodu barku zmniejsz zakres.', 'Keep your shoulders away from your ears. If the front of your shoulder complains, shorten the range.'),
  },

  /* ---------------- Całe ciało ---------------- */
  thruster: {
    name: 'Thruster',
    group: FULL,
    gear: 'dumbbell',
    mode: 'ballistic',
    unit: 'reps',
    def: { sets: 4, minSets: 3, maxSets: 6, target: 8, min: 8, max: 8, w: 10 },
    hint: say('Przysiad i wyciskanie w jednym ruchu. Nogi nadają rozpęd, ręce tylko kończą.', 'Squat and press in one move. Your legs drive it, your arms just finish.'),
  },
  clean_jerk: {
    name: say('Podrzut ze sztangą', 'Clean and jerk'),
    group: FULL,
    gear: 'barbell',
    mode: 'ballistic',
    unit: 'reps',
    def: { sets: 4, minSets: 3, maxSets: 6, target: 3, min: 3, max: 3, w: 30 },
    hint: say('Ruch techniczny. Przy nauce zostań długo na gryfie i nagrywaj się z boku.', 'A technical lift. While learning, stay on the empty bar for a long time and film yourself from the side.'),
  },
  burpee: {
    name: 'Burpee',
    group: FULL,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 8, max: 20 },
    hint: say('Miękkie lądowanie i pełne wyprostowanie bioder na górze.', 'Land softly and open your hips fully at the top.'),
  },
  wallball: {
    name: 'Wall ball',
    group: FULL,
    gear: 'dumbbell',
    mode: 'ballistic',
    unit: 'reps',
    def: { sets: 4, minSets: 3, maxSets: 6, target: 12, min: 12, max: 12, w: 6 },
    hint: say('Piłka wychodzi z przysiadu jednym impulsem. Łapiesz ją, wchodząc od razu w dół.', 'Drive the ball up from the squat in one go. Catch it and drop straight into the next squat.'),
  },
  boxjump: {
    name: say('Wskoki na skrzynię', 'Box jumps'),
    group: FULL,
    gear: 'bodyweight',
    mode: 'ballistic',
    unit: 'reps',
    def: { sets: 4, minSets: 3, maxSets: 5, target: 6, min: 6, max: 6 },
    hint: say('Schodzisz ze skrzyni krokiem, nie zeskokiem. Liczy się wysokość, nie zmęczenie.', "Step down from the box, don't jump. Height matters, not fatigue."),
  },
  rower: {
    name: say('Ergometr wioślarski', 'Rowing machine'),
    group: FULL,
    gear: 'machine',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 120, min: 60, max: 300 },
    hint: say('Kolejność: nogi, tułów, ręce. W drodze powrotnej dokładnie odwrotnie.', 'Order: legs, body, arms. On the way back, exactly the reverse.'),
  },
  bike: {
    name: say('Rower powietrzny', 'Air bike'),
    group: FULL,
    gear: 'machine',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 60, min: 30, max: 240 },
    hint: say('Interwał ma boleć krótko. Przy równym tempie przez pięć minut to już inne ćwiczenie.', 'An interval should hurt briefly. Five minutes at a steady pace is a different exercise.'),
  },
  jumprope: {
    name: say('Skakanka', 'Skipping rope'),
    group: FULL,
    gear: 'bodyweight',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 60, min: 30, max: 180 },
    hint: say('Skoki niskie, praca z nadgarstków. Łydki lubią się tu odezwać dzień później.', 'Small jumps, turn the rope with your wrists. Your calves like to speak up the day after.'),
  },
  ropes: {
    name: say('Liny bojowe', 'Battle ropes'),
    group: FULL,
    gear: 'bodyweight',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 30, min: 20, max: 90 },
    hint: say('Kolana miękkie, napięty tułów. Fala idzie z bioder, nie z bicepsów.', 'Soft knees, tight core. The wave comes from your hips, not your biceps.'),
  },
  sled: {
    name: say('Pchanie sań', 'Sled push'),
    group: FULL,
    gear: 'machine',
    mode: 'carry',
    unit: 'secs',
    side: false,
    def: { sets: 3, target: 30, min: 20, max: 60, w: 40 },
    hint: say('Tułów nachylony, kroki krótkie i częste. Brak fazy ekscentrycznej — regeneracja tania.', 'Lean in, short quick steps. No eccentric phase, so it costs little recovery.'),
  },

  /* ---------------- Core i carry ---------------- */
  plank: {
    name: say('Deska', 'Plank'),
    group: CORE,
    gear: 'bodyweight',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 30, min: 20, max: 120 },
    hint: say('Pośladki napięte, żebra ściągnięte. Minuta w dobrej pozycji bije trzy w zgiętej.', 'Glutes tight, ribs down. One minute in good position beats three sagging.'),
  },
  plank_side: {
    name: say('Deska bokiem', 'Side plank'),
    group: CORE,
    gear: 'bodyweight',
    mode: 'carry',
    unit: 'secs',
    side: true,
    def: { sets: 3, target: 25, min: 20, max: 90 },
    hint: say('Biodro wysoko, ciało w jednej linii od kostki po bark.', 'Hip high, body in one line from ankle to shoulder.'),
  },
  deadbug: {
    name: 'Dead bug',
    group: CORE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 4, target: 10, min: 8, max: 16 },
    hint: say('Lędźwie przyklejone do podłogi przez cały ruch. Gdy się odrywają, skróć zakres.', 'Lower back glued to the floor throughout. If it lifts, shorten the range.'),
  },
  hollow: {
    name: 'Hollow hold',
    group: CORE,
    gear: 'bodyweight',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 25, min: 20, max: 75 },
    hint: say('Dół pleców dociśnięty. Im niżej nogi, tym trudniej.', 'Lower back pressed down. The lower your legs, the harder it gets.'),
  },
  abwheel: {
    name: say('Kółko do brzucha', 'Ab wheel rollout'),
    group: CORE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 2, maxSets: 4, target: 8, min: 5, max: 15 },
    hint: say('Miednica podwinięta. Wyjeżdżasz tylko tak daleko, jak utrzymujesz plecy bez wygięcia.', 'Pelvis tucked. Roll out only as far as you can without arching your back.'),
  },
  legraise_hang: {
    name: say('Unoszenie nóg w zwisie', 'Hanging leg raise'),
    group: CORE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 8, min: 6, max: 15 },
    hint: say('Bez bujania. Ruch kończy się podwinięciem miednicy, nie samym uniesieniem kolan.', 'No swinging. Finish by curling your pelvis up, not just lifting your knees.'),
  },
  crunch: {
    name: say('Brzuszki', 'Crunches'),
    group: CORE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 12, min: 10, max: 25 },
    hint: say('Zwijasz kręgosłup od głowy w dół, łopatki odrywają się od podłogi, lędźwie zostają przy macie. Dłonie przy skroniach, nie ciągną głowy.', 'Curl your spine from the head down: shoulder blades off the floor, lower back on the mat. Hands by your temples, not pulling your head.'),
  },
  legraise_floor: {
    name: say('Unoszenie nóg w leżeniu', 'Lying leg raise'),
    group: CORE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 10, min: 8, max: 20 },
    hint: say('Lędźwie dociśnięte do podłogi przez cały ruch. Nogi schodzą tylko tak nisko, jak długo plecy nie odrywają się od maty.', 'Lower back pressed into the floor throughout. Lower your legs only as far as your back stays on the mat.'),
  },
  vup: {
    name: say('Scyzoryki', 'V-ups'),
    group: CORE,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 5, target: 6, min: 5, max: 15 },
    hint: say('Ręce i nogi spotykają się nad biodrami, w dół schodzisz powoli, bez uderzania o podłogę. Łatwiej: z ugiętymi kolanami.', 'Hands and feet meet over your hips; come down slowly without slamming the floor. Easier: bend your knees.'),
  },
  crunch_cable: {
    name: say('Spięcia brzucha na wyciągu', 'Cable crunch'),
    group: CORE,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 12, min: 10, max: 16, w: 25 },
    hint: say('Zwijasz kręgosłup, a nie kłaniasz się w biodrach.', "Curl your spine; don't bow from the hips."),
  },
  pallof: {
    name: 'Pallof press',
    group: CORE,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    side: true,
    def: { sets: 3, target: 12, min: 10, max: 15, w: 10 },
    hint: say('Zadaniem jest nie dać się skręcić. Ręce wychodzą wolno, biodra stoją.', 'The job is not to get twisted. Press out slowly, hips still.'),
  },
  russian: {
    name: say('Rosyjskie skręty', 'Russian twists'),
    group: CORE,
    gear: 'kettlebell',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 16, min: 12, max: 24, w: 8 },
    hint: say('Rotacja z klatki, nie z lędźwi. Tempo kontrolowane.', 'Rotate from your chest, not your lower back. Controlled tempo.'),
  },
  carry_oh: {
    name: say('Spacer z ciężarem nad głową', 'Overhead carry'),
    group: CORE,
    gear: 'kettlebell',
    mode: 'carry',
    unit: 'secs',
    side: true,
    def: { sets: 3, target: 25, min: 20, max: 60, w: 8 },
    hint: say('Łokieć zablokowany, żebra w dole. Najbardziej wymagający z chodzonych.', 'Elbow locked, ribs down. The toughest of the carries.'),
  },
  carry_rack: {
    name: say('Spacer w front racku', 'Front-rack carry'),
    group: CORE,
    gear: 'kettlebell',
    mode: 'carry',
    unit: 'secs',
    side: true,
    def: { sets: 3, target: 30, min: 20, max: 60, w: 12 },
    hint: say('Oddychasz mimo ucisku na żebra. To ćwiczenie oddechowe tak samo jak siłowe.', 'Keep breathing despite the pressure on your ribs. It trains breathing as much as strength.'),
  },
  sled_drag: {
    name: say('Ciągnięcie sań tyłem', 'Backward sled drag'),
    group: CORE,
    gear: 'machine',
    mode: 'carry',
    unit: 'secs',
    def: { sets: 3, target: 30, min: 20, max: 60, w: 30 },
    hint: say('Świetne na kolana i czworogłowe, bo nie ma fazy hamowania.', "Great for knees and quads, because there's no braking phase."),
  },

  /* ---------------- Nogi — dodatkowe ---------------- */
  calf_seated: {
    name: say('Wspięcia siedząc', 'Seated calf raise'),
    group: LEGS,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 15, min: 12, max: 20, w: 20 },
    hint: say('Zgięte kolano przenosi pracę na płaszczkowaty. Pauza na dole i na górze.', 'A bent knee shifts the work to the soleus. Pause at the bottom and at the top.'),
  },
  calf_press: {
    name: say('Wspięcia na suwnicy', 'Leg press calf raise'),
    group: LEGS,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 15, min: 12, max: 20, w: 40 },
    hint: say('Same palce na krawędzi platformy, kolana lekko ugięte i nieruchome.', 'Just the balls of your feet on the platform edge, knees slightly bent and still.'),
  },
  tibialis: {
    name: say('Unoszenie palców', 'Tibialis raise'),
    group: LEGS,
    gear: 'bodyweight',
    mode: 'body',
    unit: 'reps',
    def: { sets: 3, minSets: 3, maxSets: 4, target: 15, min: 12, max: 25 },
    hint: say('Przeciwwaga dla łydek. Pomaga kolanom i kostkom przy bieganiu.', 'A counterbalance to your calves. Helps your knees and ankles when you run.'),
  },
  abduction: {
    name: say('Odwodzenie nóg na maszynie', 'Machine hip abduction'),
    group: LEGS,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 15, min: 12, max: 20, w: 25 },
    hint: say('Lekki wychył tułowia do przodu mocniej angażuje pośladek średni.', 'Leaning slightly forward works the glute medius harder.'),
  },
  adduction: {
    name: say('Przywodzenie nóg na maszynie', 'Machine hip adduction'),
    group: LEGS,
    gear: 'machine',
    mode: 'grind',
    unit: 'reps',
    def: { sets: 3, target: 15, min: 12, max: 20, w: 25 },
    hint: say('Zakres do wyraźnego rozciągnięcia, bez szarpania na końcu.', 'Go to a clear stretch, no jerking at the end.'),
  },
  copenhagen: {
    name: say('Plank kopenhaski', 'Copenhagen plank'),
    group: LEGS,
    gear: 'bodyweight',
    mode: 'carry',
    unit: 'secs',
    side: true,
    def: { sets: 3, target: 20, min: 15, max: 45 },
    hint: say('Najlepsza profilaktyka naciągnięcia przywodzicieli. Zacznij z kolanem na ławce.', 'The best way to prevent groin strains. Start with your knee on the bench.'),
  },
};


export const ALL: ExerciseId[] = Object.keys(EX);
export const WEIGHTED: ExerciseId[] = ALL.filter((id) => EX[id]!.def.w !== undefined);

/**
 * Ćwiczenia bez sprzętu: podłoga, ściana, krzesło albo kanapa i solidny stół — pod nim
 * wiosłuje się w australijskim podciąganiu, bo bez drążka to jedyne porządne ciągnięcie.
 * Drążek, guma, skakanka i kółko to już sprzęt, choć mały. Ostatnie etapy pompek, przysiadu
 * jednonóż i pracy nad core potrzebują drążka albo ciężaru — dochodzi się do nich po miesiącach.
 */
export const NO_EQUIPMENT = new Set<ExerciseId>([
  'squat_air',
  'squat_jump',
  'crunch',
  'legraise_floor',
  'vup',
  'lunge_bw',
  'split_bw',
  'pistol',
  'sissy',
  'glutebridge',
  'glutebridge1',
  'hyper',
  'nordic',
  'calf',
  'calf1',
  'tibialis',
  'copenhagen',
  'pushup',
  'pushup_diamond',
  'pushup_pike',
  'hspu',
  'dip_bench',
  'row_inverted',
  'y_raise',
  'burpee',
  'plank',
  'plank_side',
  'deadbug',
  'hollow',
  'core',
]);

/**
 * Pierwsze cztery treningi — kettlebell i masa ciała, na nich stoją plany klasyczne. Kolejność
 * ćwiczeń idzie za doradcą: ruch wybuchowy, wielostawowe, a spacery z ciężarem, brzuch i łydki
 * na koniec. Spacer farmera przed podciąganiem albo pompkami zabierał chwyt i stabilizację
 * ruchowi, któremu były bardziej potrzebne.
 */
const KB_BASICS: Workout[] = [
  {
    id: 'A',
    name: say('Trening A', 'Workout A'),
    kind: 'full',
    gear: 'kb',
    desc: say('Całe ciało z kettlebell: swing, goblet, wiosłowanie, floor press i podciąganie.', 'Full body with a kettlebell: swing, goblet squat, row, floor press and chin-ups.'),
    // Swing sam, na świeżo; potem dwie pary dół + ciągnięcie i pchanie + ciągnięcie,
    // spacer sam (chwyt i brzuch), na koniec brzuch na zmianę z łydkami.
    items: [
      { ex: 'swing2' },
      { ex: 'goblet' },
      { ex: 'row', pair: true },
      { ex: 'floor' },
      { ex: 'pullup', pair: true },
      { ex: 'carry' },
      { ex: 'core' },
      { ex: 'calf', pair: true },
    ],
  },
  {
    id: 'B',
    name: say('Trening B', 'Workout B'),
    kind: 'full',
    gear: 'kb',
    desc: say('Druga połowa pary: swing jednorącz, wykrok, wyciskanie, RDL i pompki.', 'The other half of the pair: one-arm swing, lunge, press, RDL and push-ups.'),
    items: [
      { ex: 'swing1' },
      { ex: 'lunge' },
      { ex: 'press', pair: true },
      { ex: 'rdl' },
      { ex: 'pushup', pair: true },
      { ex: 'farmer' },
      { ex: 'calf1', pair: true },
    ],
  },
  {
    id: 'C',
    name: say('Trening C — całe ciało', 'Workout C — full body'),
    kind: 'full',
    gear: 'kb',
    desc: say('Turecki wstaw, kompleks i goblet — mniej ćwiczeń, więcej ruchu w każdym.', 'Turkish get-up, complex and goblet squat: fewer exercises, more movement in each.'),
    // Turecki wstaw i kompleks to nauka ruchu i dużo zmęczenia — oba sami, z pełną przerwą.
    items: [{ ex: 'tgu' }, { ex: 'complex' }, { ex: 'goblet' }, { ex: 'farmer' }, { ex: 'core', pair: true }],
  },
  {
    // Dzień lekki. Nie „to samo, tylko słabiej” — po prostu bez ciężkiego zawiasu, przysiadu
    // i wyciskania. Przy pięciu i więcej treningach w tygodniu to on decyduje, czy plan da się
    // wytrzymać przez trzy miesiące.
    id: 'D',
    name: say('Trening D — lekki', 'Workout D — light'),
    kind: 'light',
    gear: 'kb',
    desc: say('Bez ciężkiego zawiasu, przysiadu i wyciskania. Na dni między mocnymi treningami.', 'No heavy hinge, squat or press. For the days between hard workouts.'),
    // Dwie pary i brzuch na koniec: łydki obu rodzajów nie idą w parze ze sobą.
    items: [{ ex: 'curl' }, { ex: 'calf', pair: true }, { ex: 'carry' }, { ex: 'calf1', pair: true }, { ex: 'core' }],
  },
];

/**
 * Końcówka bazowego treningu, którą zastępują dodatki profilu: sam brzuch i łydki. Spacery
 * zostają — spacer farmera bywa jedynym ciągnięciem w treningu, a bez niego całe ciało
 * przestaje być całym ciałem.
 */
const isFinisher = (id: ExerciseId): boolean =>
  (EX_MUSCLES[id]?.p ?? []).every((m) => m === 'brzuch' || m === 'lydki');

/**
 * Angielska nazwa ćwiczenia w środku zdania: mała litera na początku, chyba że nazwa zaczyna
 * się od nazwy własnej albo skrótu („Nordic curl”, „RDL”, „T-bar row”).
 */
const midSentence = (name: string): string =>
  /^(?:[A-Z]{2,}|[A-Z]-|Arnold|Bulgarian|Copenhagen|Nordic|Pallof|Russian|Turkish)/.test(name)
    ? name
    : name.charAt(0).toLowerCase() + name.slice(1);

/**
 * Trening z profilu: bazowe całe ciało (A albo B dla sprzętu) bez zwykłej końcówki,
 * z ćwiczeniem priorytetowym na początku — zaraz po ruchu wybuchowym — i dwoma dodatkami
 * profilu na końcu. Para z bazy, której jedno ćwiczenie wypadło, zostaje seriami pod rząd.
 */
function profileWorkout(k: ProfileKey, g: WorkoutGear, v: 0 | 1): Workout {
  const spec = PROFILES[k];
  const base = [...KB_BASICS, ...LIBRARY].find((w) => w.id === PROFILE_BASE[g][v])!;
  const lead = spec.lead?.[g];
  const [x1, x2] = spec.extras[g]!;
  const moved = new Set([lead, x1, x2, ...(spec.drop?.[g] ?? [])]);
  // Spacer, który robi to samo co dodatek (zwis i spacer farmera to oba chwyt), wypada —
  // inaczej trening rośnie o ćwiczenie, które niczego nowego nie wnosi.
  const extraMuscles = new Set([x1, x2].flatMap((x) => EX_MUSCLES[x]?.p ?? []));
  const redundant = (id: ExerciseId): boolean =>
    EX[id]!.mode === 'carry' && (EX_MUSCLES[id]?.p ?? []).some((m) => extraMuscles.has(m));
  // Ćwiczenie priorytetowe zastępuje bazowe o tym samym wzorcu (wykrok zamiast gobleta,
  // przysiad bułgarski zamiast przysiadu bez obciążenia). Ruch wybuchowy niczego nie zastępuje:
  // wskoki dokładają moc, a siłę dalej buduje przysiad.
  const leadP = lead && EX[lead]!.mode !== 'ballistic' ? [...(EX_MUSCLES[lead]?.p ?? [])].sort().join() : null;
  const replaced = (id: ExerciseId): boolean => leadP !== null && [...(EX_MUSCLES[id]?.p ?? [])].sort().join() === leadP;
  const keep = (id: ExerciseId): boolean => !moved.has(id) && !isFinisher(id) && !redundant(id) && !replaced(id);
  const swap = spec.swap?.[g] ?? {};
  const items: Workout['items'] = [];
  base.items.forEach((it, i) => {
    if (!keep(it.ex)) return;
    const prev = base.items[i - 1];
    const ex = swap[it.ex] ?? it.ex;
    items.push(it.pair && prev && keep(prev.ex) ? { ex, pair: true } : { ex });
  });
  if (lead) {
    let at = 0;
    while (at < items.length && EX[items[at]!.ex]!.mode === 'ballistic' && !items[at + 1]?.pair) at++;
    items.splice(at, 0, { ex: lead });
  }
  // Dodatki przed spacerami, które zostały na końcu: spacer i brzuch kończą trening, bo
  // stabilizują każde wcześniejsze ćwiczenie.
  let end = items.length;
  while (end > 0 && EX[items[end - 1]!.ex]!.mode === 'carry' && !items[end - 1]!.pair) end--;
  items.splice(end, 0, { ex: x1 }, spec.pairExtras ? { ex: x2, pair: true } : { ex: x2 });
  return {
    id: profileWorkoutId(k, g, v),
    name: say(`${spec.name} — całe ciało ${v ? 'B' : 'A'}`, `${spec.name} — full body ${v ? 'B' : 'A'}`),
    kind: 'full',
    gear: g,
    profile: k,
    desc: say(
      `${base.desc ?? ''} Profil: ${EX[lead ?? '']?.name.toLowerCase() ?? 'akcent'}${lead ? ' na początek' : ''}, na koniec ${EX[x1]!.name.toLowerCase()} i ${EX[x2]!.name.toLowerCase()}.`.trim(),
      `${base.desc ?? ''} Profile: ${lead ? `${midSentence(EX[lead]!.name)} first, then ` : ''}${midSentence(EX[x1]!.name)} and ${midSentence(EX[x2]!.name)} to finish.`.trim(),
    ),
    items,
  };
}

/** Treningi profili: po dwa (A i B) na każdy profil i sprzęt, na którym profil jest dostępny. */
export const PROFILE_WORKOUTS: Workout[] = PROFILE_KEYS.flatMap((k) =>
  gearsOf(k).flatMap((g) => [profileWorkout(k, g, 0), profileWorkout(k, g, 1)]),
);

/** Wszystkie gotowe treningi: cztery pierwsze, biblioteka z podziałami i partiami oraz profile. */
export const BUILTIN: Workout[] = [...KB_BASICS, ...LIBRARY, ...PROFILE_WORKOUTS];

export const ex = (id: ExerciseId): Exercise => {
  const e = EX[id];
  if (!e) throw new Error(say(`Nieznane ćwiczenie: ${id}`, `Unknown exercise: ${id}`));
  return e;
};
