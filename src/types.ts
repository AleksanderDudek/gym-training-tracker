/** Sposób, w jaki ćwiczenie się progresuje. */
export type Mode =
  | 'grind' // rosną powtórzenia, potem ciężar
  | 'ballistic' // ruch wybuchowy: rosną serie, potem ciężar
  | 'carry' // rośnie czas, potem ciężar
  | 'stage' // masa ciała: rosną powtórzenia, potem etap trudności
  | 'body'; // masa ciała: rosną powtórzenia, potem serie

export type Unit = 'reps' | 'secs';
export type EffortKey = 'easy' | 'solid' | 'max';
export type ReadyKey = 'low' | 'ok' | 'high';
export type StageKey = 'pullup' | 'pushup' | 'core';
export type ExerciseId = string;

export interface ExerciseDefaults {
  sets: number;
  minSets?: number;
  maxSets?: number;
  target: number;
  min: number;
  max: number;
  /** Ciężar startowy w kg. Brak oznacza ćwiczenie z masą ciała. */
  w?: number;
}

export interface Exercise {
  name: string;
  group: string;
  mode: Mode;
  unit: Unit;
  /** Powtórzenia liczone osobno na każdą stronę. */
  side?: boolean;
  stages?: StageKey;
  def: ExerciseDefaults;
  hint: string;
}

/**
 * Faza pracy nad ćwiczeniem. `calib` to dochodzenie do poziomu startowego serią prób,
 * `work` to normalna progresja.
 */
export type Phase = 'calib' | 'work';

/** Trwające przejście na cięższy kettlebell — wchodzi seria po serii. */
export interface Transition {
  to: number;
  heavySets: number;
  reps: number;
}

export interface HistoryPoint {
  d: string;
  w: number | null;
  reps: number[];
  eff: EffortKey;
  e1rm: number | null;
}

/** Stan progresji pojedynczego ćwiczenia. */
export interface Progress {
  sets: number;
  target: number;
  min: number;
  max: number;
  minSets: number;
  maxSets: number;
  weight: number | null;
  stage: number | null;
  trans: Transition | null;
  /** Szacowany ciężar maksymalny na jedno powtórzenie. */
  e1rm: number | null;
  stalls: number;
  maxHolds: number;
  /** Faza: dochodzenie do poziomu startowego albo normalna progresja. */
  phase: Phase;
  /** Ile prób kalibracyjnych już poszło — zabezpieczenie przed kręceniem się w kółko. */
  calibRuns: number;
  /** Czy w najbliższej sesji ostatnia seria jest testem „ile dasz radę”. */
  probe: boolean;
  /** Sesje od ostatniego testu. */
  sinceProbe: number;
  /** Sesje z rzędu zamknięte na „Łatwo” — sygnał, że obciążenie jest za małe. */
  easyRun: number;
  hist: HistoryPoint[];
}

export interface SetResult {
  reps: number;
  w: number | null;
}

export interface ExerciseResult {
  rows: SetResult[];
  effort: EffortKey;
}

export interface Session {
  workout: string;
  started: string;
  ready: ReadyKey;
  res: Record<ExerciseId, ExerciseResult>;
  done: Record<ExerciseId, boolean>;
  skip: Record<ExerciseId, boolean>;
}

export interface LogItem {
  id: ExerciseId;
  sets: SetResult[];
  effort: EffortKey;
}

export interface LogEntry {
  date: string;
  workout: string;
  ready: ReadyKey;
  items: LogItem[];
}

export interface Workout {
  id: string;
  name: string;
  items: { ex: ExerciseId }[];
}

export interface Notice {
  level: 'warn' | 'good';
  title: string;
  text: string;
}

/** Płeć służy wyłącznie do doboru ciężarów startowych — program jest ten sam. */
export type Sex = 'f' | 'm' | 'any';

export type PlanLevel = 'zero' | 'base' | 'strong';

/** Gotowy plan treningowy: rotacja treningów rozpisana na tygodnie. */
export interface PlanTemplate {
  id: string;
  name: string;
  level: PlanLevel;
  sex: Sex;
  daysPerWeek: number;
  weeks: number;
  /** Mnożnik ciężarów startowych względem domyślnych obciążeń ćwiczeń. */
  loadFactor: number;
  /** Rotacja treningów. Sesja n dostaje `cycle[n % cycle.length]`. */
  cycle: string[];
  /** Dni tygodnia, 1 = poniedziałek … 7 = niedziela. */
  weekdays: number[];
  desc: string;
}

/** Plan uruchomiony przez użytkownika. */
export interface ActivePlan {
  templateId: string;
  /** Dzień startu, `yyyy-mm-dd`. */
  start: string;
  /** Sesje odhaczone ręcznie — poza tymi, które wynikają z historii treningów. */
  ticked: Record<number, true>;
}

/** Jeden dzień rozpisanego planu. */
export interface PlannedDay {
  index: number;
  date: string;
  weekday: number;
  week: number;
  workout: string;
  /** Dni przerwy od poprzedniego treningu w planie. */
  gap: number;
  status: 'done' | 'missed' | 'today' | 'future';
}

export interface AppState {
  cfg: { weights: number[] };
  prog: Record<ExerciseId, Progress>;
  workouts: Workout[];
  session: Session | null;
  log: LogEntry[];
  plan: ActivePlan | null;
  notice: Notice | null;
}

/** Pojedyncza zmiana poziomu po zamkniętym treningu. */
export interface Change {
  type: 'reps' | 'level' | 'down' | 'hold' | 'held' | 'cap';
  text: string;
}

/** Jedna przepisana seria: ile powtórzeń i jakim ciężarem. */
export interface PlannedSet {
  w: number | null;
  reps: number;
  heavy?: boolean;
  /** Seria bez sztywnego celu: robisz tyle, ile dasz radę, zostawiając zapas. */
  amrap?: boolean;
}

export type View = 'train' | 'prog' | 'work' | 'set';

/** Zakładka w dolnej nawigacji. */
export type TabKey = View | 'atlas' | 'plan';

/** Trasa aplikacji. Podstrona ćwiczenia ma własny adres, więc da się ją wysłać komuś linkiem. */
export type Route =
  | { kind: 'tab'; tab: TabKey }
  | { kind: 'atlas' }
  | { kind: 'exercise'; id: ExerciseId };

/** Materiał wideo pokazujący technikę ćwiczenia. */
export interface VideoRef {
  /** Identyfikator filmu w YouTube. */
  id: string;
  title: string;
  channel: string;
  /** Język nagrania — na karcie stoi znacznik, żeby nikt nie klikał w ślepo. */
  lang: 'pl' | 'en';
  /** Długość w sekundach. */
  secs: number;
}

/** Dwie listy filmów dla jednego ćwiczenia. */
export interface ExerciseVideos {
  /** Najpopularniejsze nagrania techniki, bez względu na sprzęt. */
  main: VideoRef[];
  /** To samo ćwiczenie w wariancie z kettlebell. */
  kb: VideoRef[];
}
