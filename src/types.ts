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

export interface AppState {
  cfg: { weights: number[] };
  prog: Record<ExerciseId, Progress>;
  workouts: Workout[];
  session: Session | null;
  log: LogEntry[];
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
}

export type View = 'train' | 'prog' | 'work' | 'set';

/** Zakładka w dolnej nawigacji. */
export type TabKey = View | 'atlas';

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
