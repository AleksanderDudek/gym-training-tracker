import type { ExerciseId, ProfileKey, WorkoutGear } from '../types';

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
    name: 'Podciąganie',
    goal: 'Więcej podciągnięć przy całym ciele w formie — z drążkiem na początku każdego treningu.',
    why: 'Podciąganie idzie pierwsze, kiedy plecy i ramiona są świeże. Zwis buduje chwyt, który przy podciąganiu poddaje się często pierwszy, a hollow — napięcie ciała, które zatrzymuje bujanie. Między treningami pojedyncze serie z zapasem: częsty, niepełny wysiłek uczy ruchu bez zmęczenia.',
    lead: { kb: 'pullup', gym: 'chinup' },
    extras: { kb: ['dead_hang', 'hollow'], gym: ['dead_hang', 'hollow'] },
    pairExtras: true,
    snacks: ['pullup', 'dead_hang', 'hollow'],
    joke: 'Broda nad drążek, reszta ciała za nią. Grawitacja nie odpuszcza, ty też nie.',
  },
  chwyt: {
    key: 'chwyt',
    name: 'Chwyt',
    goal: 'Mocniejszy chwyt — do noszenia, wspinania, ciężkich ciągów i słoików, które ktoś zakręcił za mocno.',
    why: 'Chwyt rośnie od trzymania ciężaru w czasie: spacer farmera i zwis na drążku to dwa najprostsze sposoby, a martwy ciąg i wiosłowanie dokładają swoje. Oba dodatki męczą przedramiona, więc idą pod rząd, nie na zmianę.',
    extras: { kb: ['dead_hang', 'farmer'], gym: ['dead_hang', 'farmer'] },
    pairExtras: false,
    snacks: ['dead_hang', 'farmer', 'carry'],
    joke: 'Uścisk dłoni po tym planie wymaga uprzedzenia rozmówcy na piśmie.',
  },
  pilka: {
    key: 'pilka',
    name: 'Piłka nożna',
    goal: 'Siła jednej nogi, moc i odporność tylnej części uda i pachwin — to, czego boisko samo nie daje.',
    why: 'Nordic curl zmniejsza ryzyko naderwania mięśni tylnej części uda mniej więcej o połowę (van der Horst i in., 2015; metaanaliza van Dyk i in., 2019), a plank kopenhaski — urazów pachwiny o ok. 40% (Harøy i in., 2019). Do tego siła jednej nogi i — na siłowni — wskoki, bo w piłce wszystko dzieje się na jednej nodze i szybko.',
    lead: { none: 'split_bw', kb: 'lunge', gym: 'boxjump' },
    extras: { none: ['nordic', 'copenhagen'], kb: ['nordic', 'copenhagen'], gym: ['nordic', 'copenhagen'] },
    pairExtras: true,
    // Tył uda robi nordic, a zawias biodrowy — martwy ciąg w treningu B.
    drop: { gym: ['rdl_db'] },
    snacks: ['copenhagen', 'nordic', 'split_bw'],
    joke: 'Nogi do gry, nie na ławkę rezerwowych. Sędzia tego nie gwiżdże, ale trener zauważy.',
  },
  bieganie: {
    key: 'bieganie',
    name: 'Bieganie',
    goal: 'Mocniejsze łydki, biodra i jedna noga — trening siłowy, który poprawia ekonomię biegu.',
    why: 'Trening siłowy poprawia ekonomię biegu i wytrzymałość na długim dystansie bez dokładania kilometrów (przegląd Blagrove i in., 2018). Bieg to seria podskoków na jednej nodze, więc priorytet ma przysiad jednonóż albo wykrok, a na koniec łydki — w biegu niosą kilka razy masę ciała — i plank kopenhaski, który trzyma miednicę od środka.',
    lead: { none: 'split_bw', kb: 'lunge', gym: 'bulgarian' },
    extras: { none: ['calf1', 'copenhagen'], kb: ['calf1', 'copenhagen'], gym: ['calf1', 'copenhagen'] },
    pairExtras: true,
    snacks: ['calf1', 'split_bw', 'copenhagen'],
    joke: 'Kilometry robią biegacza, ale łydki trzymają go w jednym kawałku.',
  },
  padel: {
    key: 'padel',
    name: 'Padel i tenis',
    goal: 'Tułów, który przenosi skręt, i barki odporne na tysiące uderzeń nad głową.',
    why: 'Uderzenie zaczyna się w nogach i przechodzi przez tułów, a bark pracuje w nim nad głową setki razy w meczu. Dodatki profilu wzmacniają to, czego kort nie trenuje: tył barku (y-raise, face pull), który hamuje ramię po uderzeniu, i mięśnie tułowia, które trzymają skręt pod kontrolą.',
    extras: { none: ['y_raise', 'deadbug'], kb: ['russian', 'y_raise'], gym: ['facepull', 'pallof'] },
    pairExtras: true,
    // Bez sprzętu pompki w podporze przodem dokładają tył barków, który robi już y-raise —
    // razem ponad 20 serii tygodniowo. Zwykłe pompki pchają tak samo, a barków nie dublują.
    swap: { none: { pushup_pike: 'pushup' } },
    snacks: ['y_raise', 'plank_side', 'copenhagen'],
    joke: 'Ściana odbija piłkę. Ty po tym planie też — bez stękania przy wstawaniu.',
  },
  plecy: {
    key: 'plecy',
    name: 'Zdrowe plecy',
    goal: 'Mocne biodra i wytrzymały tułów — dla każdego, kto spędza dzień na krześle.',
    why: 'Ćwiczenia zmniejszają ból krzyża i ryzyko jego nawrotu (przegląd Cochrane, Hayden i in., 2021), a najlepiej działa to, co da się robić regularnie. Dead bug uczy trzymać tułów bez zginania kręgosłupa. W domu wyprosty budują wytrzymałość prostowników; z kettlebell i na siłowni robią to już swing, RDL i martwy ciąg, więc w to miejsce wchodzi tył barków — postawa przy biurku. To nie terapia: przy bólu, który promieniuje albo nie mija, prowadzi fizjoterapeuta.',
    // Z kettlebell i na siłowni biodra i prostowniki mają już swing, RDL i martwy ciąg —
    // kolejny ruch na tę samą taśmę przebija limit serii, więc dodatkiem jest tył barków.
    extras: { none: ['hyper', 'deadbug'], kb: ['y_raise', 'deadbug'], gym: ['facepull', 'deadbug'] },
    // W domu wyprosty zastępują mostek biodrowy z bazy.
    drop: { none: ['glutebridge'] },
    pairExtras: true,
    snacks: ['plank_side', 'glutebridge', 'deadbug'],
    joke: 'Biurko przegrało. Kręgosłup wygrał i nawet się nie chwali.',
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
