import type { ExerciseId, ProfileKey, WorkoutGear } from '../types';
import { say } from '../i18n';

/**
 * Profile: trening ogólnorozwojowy z akcentem na jeden cel.
 *
 * Podstawą zostaje całe ciało dwa razy na zmianę (A i B) — trzy razy w tygodniu przez
 * 60 dni, jak w planach z celem. Profil zmienia w tym trzy rzeczy:
 *
 * - **ćwiczenie priorytetowe na początek** (zaraz po ruchu wybuchowym, jeśli jest) — siła
 *   rośnie najbardziej w tym, co robi się pierwsze, na świeżo (Simão i in., 2012;
 *   Nunes i in., 2021);
 * - **dwa dodatki na koniec** zamiast zwykłej końcówki (brzuch, łydki, spacery) — trening
 *   nie rośnie, tylko zmienia akcent;
 * - **przekąski ruchowe** podpowiadane między treningami, z listy profilu.
 *
 * Plan nie robi z nikogo zawodnika: na boisku, korcie i ścianie liczy się sam sport.
 * Profil dokłada to, czego sam sport zwykle nie daje — siłę i odporność tkanek.
 */

export interface ProfileSpec {
  key: ProfileKey;
  name: string;
  /** Cel planu jednym zdaniem. */
  goal: string;
  /** Dlaczego tak — ze źródłem, do opisu planu. */
  why: string;
  /** Ćwiczenie priorytetowe według sprzętu. Brak — bez zmiany początku treningu. */
  lead?: Partial<Record<WorkoutGear, ExerciseId>>;
  /** Dwa dodatki na koniec według sprzętu. Sprzęt bez wpisu — profil na nim niedostępny. */
  extras: Partial<Record<WorkoutGear, [ExerciseId, ExerciseId]>>;
  /** Czy dodatki robić na zmianę — tylko gdy nie męczą tej samej partii (pilnuje test). */
  pairExtras: boolean;
  /**
   * Ćwiczenia bazy, które wypadają, bo dodatki robią to samo — inaczej partia przekracza
   * ok. 20 serii tygodniowo, powyżej których przybywa już tylko zmęczenia (pilnuje test).
   */
  drop?: Partial<Record<WorkoutGear, ExerciseId[]>>;
  /** Podmiany w bazie z tego samego powodu: inne ćwiczenie tego samego wzorca. */
  swap?: Partial<Record<WorkoutGear, Record<ExerciseId, ExerciseId>>>;
  /** Przekąski ruchowe między treningami. */
  snacks: ExerciseId[];
  /** Dopisek do treningów profilu. */
  joke: string;
}

export const PROFILES: Record<ProfileKey, ProfileSpec> = {
  podciaganie: {
    key: 'podciaganie',
    name: say('Podciąganie', 'Pull-ups'),
    goal: say('Więcej podciągnięć przy całym ciele w formie — z drążkiem na początku każdego treningu.', 'More pull-ups with the rest of your body in shape too: the bar comes first in every workout.'),
    why: say('Podciąganie idzie pierwsze, kiedy plecy i ramiona są świeże. Zwis buduje chwyt, który przy podciąganiu poddaje się często pierwszy, a hollow — napięcie ciała, które zatrzymuje bujanie. Między treningami pojedyncze serie z zapasem: częsty, niepełny wysiłek uczy ruchu bez zmęczenia.', 'Pull-ups go first, while your back and arms are fresh. The dead hang builds grip, which is often the first thing to give out on pull-ups, and the hollow hold builds the body tension that stops you swinging. Between workouts, single sets with reps to spare: frequent, submaximal effort teaches the movement without the fatigue.'),
    lead: { kb: 'pullup', gym: 'chinup' },
    extras: { kb: ['dead_hang', 'hollow'], gym: ['dead_hang', 'hollow'] },
    pairExtras: true,
    snacks: ['pullup', 'dead_hang', 'hollow'],
    joke: say('Broda nad drążek, reszta ciała za nią. Grawitacja nie odpuszcza, ty też nie.', "Chin over the bar, and the rest of you follows. Gravity doesn't let up, and neither do you."),
  },
  chwyt: {
    key: 'chwyt',
    name: say('Chwyt', 'Grip'),
    goal: say('Mocniejszy chwyt — do noszenia, wspinania, ciężkich ciągów i słoików, które ktoś zakręcił za mocno.', 'A stronger grip for carrying, climbing, heavy pulls and jars someone closed too tight.'),
    why: say('Chwyt rośnie od trzymania ciężaru w czasie: spacer farmera i zwis na drążku to dwa najprostsze sposoby, a martwy ciąg i wiosłowanie dokładają swoje. Oba dodatki męczą przedramiona, więc idą pod rząd, nie na zmianę.', 'Grip grows from holding weight over time: the farmer carry and the dead hang are the two simplest ways, and deadlifts and rows add their share. Both extras tire your forearms, so they go back to back, not alternated.'),
    extras: { kb: ['dead_hang', 'farmer'], gym: ['dead_hang', 'farmer'] },
    pairExtras: false,
    snacks: ['dead_hang', 'farmer', 'carry'],
    joke: say('Uścisk dłoni po tym planie wymaga uprzedzenia rozmówcy na piśmie.', 'After this plan, shaking hands requires written notice.'),
  },
  pilka: {
    key: 'pilka',
    name: say('Piłka nożna', 'Football'),
    goal: say('Siła jednej nogi, moc i odporność tylnej części uda i pachwin — to, czego boisko samo nie daje.', "Single-leg strength, power and tougher hamstrings and groin: what the pitch alone won't give you."),
    why: say('Nordic curl zmniejsza ryzyko naderwania mięśni tylnej części uda mniej więcej o połowę (van der Horst i in., 2015; metaanaliza van Dyk i in., 2019), a plank kopenhaski — urazów pachwiny o ok. 40% (Harøy i in., 2019). Do tego siła jednej nogi i — na siłowni — wskoki, bo w piłce wszystko dzieje się na jednej nodze i szybko.', 'Nordic curls roughly halve the risk of hamstring strains (van der Horst et al., 2015; meta-analysis by van Dyk et al., 2019), and the Copenhagen plank cuts groin injuries by about 40% (Harøy et al., 2019). Add single-leg strength and, at the gym, box jumps, because in football everything happens on one leg and fast.'),
    lead: { none: 'split_bw', kb: 'lunge', gym: 'boxjump' },
    extras: { none: ['nordic', 'copenhagen'], kb: ['nordic', 'copenhagen'], gym: ['nordic', 'copenhagen'] },
    pairExtras: true,
    // Tył uda robi nordic, a zawias biodrowy — martwy ciąg w treningu B.
    drop: { gym: ['rdl_db'] },
    snacks: ['copenhagen', 'nordic', 'split_bw'],
    joke: say('Nogi do gry, nie na ławkę rezerwowych. Sędzia tego nie gwiżdże, ale trener zauważy.', "Legs for playing, not for the subs' bench. The referee won't blow the whistle, but the manager will notice."),
  },
  bieganie: {
    key: 'bieganie',
    name: say('Bieganie', 'Running'),
    goal: say('Mocniejsze łydki, biodra i jedna noga — trening siłowy, który poprawia ekonomię biegu.', 'Stronger calves, hips and single legs: strength training that improves your running economy.'),
    why: say('Trening siłowy poprawia ekonomię biegu i wytrzymałość na długim dystansie bez dokładania kilometrów (przegląd Blagrove i in., 2018). Bieg to seria podskoków na jednej nodze, więc priorytet ma przysiad jednonóż albo wykrok, a na koniec łydki — w biegu niosą kilka razy masę ciała — i plank kopenhaski, który trzyma miednicę od środka.', 'Strength training improves running economy and long-distance endurance without adding kilometres (review by Blagrove et al., 2018). Running is a series of hops on one leg, so a single-leg squat or lunge comes first, and the workout ends with calves (they carry several times your body weight with every stride) and the Copenhagen plank, which steadies your pelvis from the inside.'),
    lead: { none: 'split_bw', kb: 'lunge', gym: 'bulgarian' },
    extras: { none: ['calf1', 'copenhagen'], kb: ['calf1', 'copenhagen'], gym: ['calf1', 'copenhagen'] },
    pairExtras: true,
    snacks: ['calf1', 'split_bw', 'copenhagen'],
    joke: say('Kilometry robią biegacza, ale łydki trzymają go w jednym kawałku.', 'Kilometres make the runner, but calves keep them in one piece.'),
  },
  padel: {
    key: 'padel',
    name: say('Padel i tenis', 'Padel and tennis'),
    goal: say('Tułów, który przenosi skręt, i barki odporne na tysiące uderzeń nad głową.', 'A trunk that transfers rotation and shoulders that can take thousands of overhead shots.'),
    why: say('Uderzenie zaczyna się w nogach i przechodzi przez tułów, a bark pracuje w nim nad głową setki razy w meczu. Dodatki profilu wzmacniają to, czego kort nie trenuje: tył barku (y-raise, face pull), który hamuje ramię po uderzeniu, i mięśnie tułowia, które trzymają skręt pod kontrolą.', "A shot starts in your legs and travels through your trunk, and your shoulder works overhead hundreds of times a match. The profile's extras strengthen what the court doesn't train: the back of the shoulder (Y raise, face pull), which brakes your arm after the shot, and the trunk muscles that keep rotation under control."),
    extras: { none: ['y_raise', 'deadbug'], kb: ['russian', 'y_raise'], gym: ['facepull', 'pallof'] },
    pairExtras: true,
    // Bez sprzętu pompki w podporze przodem dokładają tył barków, który robi już y-raise —
    // razem ponad 20 serii tygodniowo. Zwykłe pompki pchają tak samo, a barków nie dublują.
    swap: { none: { pushup_pike: 'pushup' } },
    snacks: ['y_raise', 'plank_side', 'copenhagen'],
    joke: say('Ściana odbija piłkę. Ty po tym planie też — bez stękania przy wstawaniu.', 'The wall bounces the ball back. After this plan, so do you, without groaning as you get up.'),
  },
  plecy: {
    key: 'plecy',
    name: say('Zdrowe plecy', 'Healthy back'),
    goal: say('Mocne biodra i wytrzymały tułów — dla każdego, kto spędza dzień na krześle.', 'Strong hips and a resilient trunk, for anyone who spends the day in a chair.'),
    why: say('Ćwiczenia zmniejszają ból krzyża i ryzyko jego nawrotu (przegląd Cochrane, Hayden i in., 2021), a najlepiej działa to, co da się robić regularnie. Dead bug uczy trzymać tułów bez zginania kręgosłupa. W domu wyprosty budują wytrzymałość prostowników; z kettlebell i na siłowni robią to już swing, RDL i martwy ciąg, więc w to miejsce wchodzi tył barków — postawa przy biurku. To nie terapia: przy bólu, który promieniuje albo nie mija, prowadzi fizjoterapeuta.', "Exercise reduces lower back pain and the risk of it coming back (Cochrane review, Hayden et al., 2021), and what works best is what you can do regularly. The dead bug teaches you to hold your trunk without bending your spine. At home, back extensions build endurance in your spinal erectors; with a kettlebell or at the gym, swings, RDLs and deadlifts already do that, so rear delts take that slot instead, for your posture at the desk. This isn't therapy: for pain that radiates or won't go away, see a physiotherapist."),
    // Z kettlebell i na siłowni biodra i prostowniki mają już swing, RDL i martwy ciąg —
    // kolejny ruch na tę samą taśmę przebija limit serii, więc dodatkiem jest tył barków.
    extras: { none: ['hyper', 'deadbug'], kb: ['y_raise', 'deadbug'], gym: ['facepull', 'deadbug'] },
    // W domu wyprosty zastępują mostek biodrowy z bazy.
    drop: { none: ['glutebridge'] },
    pairExtras: true,
    snacks: ['plank_side', 'glutebridge', 'deadbug'],
    joke: say('Biurko przegrało. Kręgosłup wygrał i nawet się nie chwali.', "The desk lost. Your spine won and isn't even bragging."),
  },
};

export const PROFILE_KEYS = Object.keys(PROFILES) as ProfileKey[];

/** Bazowe treningi całego ciała według sprzętu: A i B na zmianę. */
export const PROFILE_BASE: Record<WorkoutGear, [string, string]> = {
  none: ['full-none', 'full-none-b'],
  kb: ['A', 'B'],
  gym: ['full-gym', 'full-gym-b'],
};

export const PROFILE_GEARS: WorkoutGear[] = ['none', 'kb', 'gym'];

/** Sprzęt, na którym profil jest dostępny. Podciąganie i chwyt potrzebują drążka i ciężaru. */
export const gearsOf = (k: ProfileKey): WorkoutGear[] => PROFILE_GEARS.filter((g) => PROFILES[k].extras[g]);

export const profileWorkoutId = (k: ProfileKey, g: WorkoutGear, v: 0 | 1): string => `profil-${k}-${g}-${v ? 'b' : 'a'}`;
export const profilePlanId = (k: ProfileKey, g: WorkoutGear): string => `profil-${k}-${g}`;

const PROFILE_ID = /^profil-([a-z]+)-(none|kb|gym)(?:-[ab])?$/;

/** Profil i sprzęt z identyfikatora treningu albo planu profilu. */
export function parseProfileId(id: string): { key: ProfileKey; gear: WorkoutGear } | null {
  const m = id.match(PROFILE_ID);
  if (!m || !Object.hasOwn(PROFILES, m[1]!)) return null;
  return { key: m[1] as ProfileKey, gear: m[2] as WorkoutGear };
}
