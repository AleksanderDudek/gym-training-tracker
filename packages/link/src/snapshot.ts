import type {
  ActivePlan,
  BodyMeasures,
  BodyWeight,
  Cardio,
  LogEntry,
  PhoneData,
  PlanTemplate,
  Snack,
  WatchData,
  Workout,
} from '../../../src/types';
import type { Scope } from './areas';

/**
 * Paczka danych podopiecznego, wersja 1 — to, co telefon wysyła prowadzącemu.
 *
 * **Typy GYM TRACKERa, nie własne.** Dziennik treningów, waga, ruch i plan jadą w tym samym
 * kształcie, w jakim leżą w zapisie aplikacji. Sztab liczy z nich tym samym silnikiem
 * (`src/engine`), więc prowadzący widzi te same liczby co podopieczny — tonaż, kierunek zmiany,
 * realizację planu, kalorie — zamiast drugiej, rozjeżdżającej się wersji tych wzorów.
 *
 * Każda część jest tylko wtedy, gdy podopieczny ją udostępnia (`scopes`). Okno: ostatnie
 * `SNAPSHOT_DAYS` dni.
 */

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_DAYS = 180;
/** Największa paczka po szyfrowaniu, w znakach — ta sama granica co w bazie. */
export const SNAPSHOT_MAX_CHARS = 2_000_000;

export interface FoodEntry {
  date: string;
  time: string;
  name: string;
  amount: string;
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugars: number | null;
  salt: number | null;
}

export interface FoodDay {
  date: string;
  /** Napoje dnia w ml (woda i reszta razem); `null` — nie zapisywano. */
  drinksMl: number | null;
  /** Cel dnia, gdy dieta jest prowadzona. */
  targetKcal: number | null;
  targetProtein: number | null;
  /** „Nie wszystko zapisane” (`true`) albo „To był cały dzień” (`false`); brak — nie powiedziano. */
  partial: boolean | null;
  note: string | null;
}

export interface LabValue {
  marker: string;
  value: number | null;
  cmp: '<' | '>' | null;
  printed: string;
  /** Zakres laboratorium w jednostce znacznika, `[od, do]` jak w GYM TRACKERze; brak — nie wydrukowano. */
  ref: readonly [number | null, number | null] | null;
  qual: string | null;
}

export interface LabVisit {
  date: string;
  lab: string | null;
  results: LabValue[];
}

export interface SnapshotV1 {
  v: 1;
  /** Chwila złożenia paczki (ms). */
  at: number;
  /** Strefa telefonu — dni w dzienniku jedzenia są lokalne. */
  tz: string;
  lang: 'pl' | 'en';
  /** Wersja aplikacji, z której przyszła paczka. */
  app: string;
  scopes: Scope[];
  training?: {
    log: LogEntry[];
    plan: ActivePlan | null;
    /** Plany i treningi własne — gotowe są w kodzie po obu stronach. */
    plans: PlanTemplate[];
    workouts: Workout[];
    snacks: Snack[];
  };
  movement?: {
    cardio: Cardio[];
    watch?: WatchData;
    phone?: PhoneData;
  };
  body?: {
    body: BodyWeight[];
    measures: BodyMeasures[];
    height?: number;
  };
  food?: {
    days: FoodDay[];
    entries: FoodEntry[];
  };
  labs?: {
    visits: LabVisit[];
  };
}

/** Pierwsze sprawdzenie odszyfrowanej paczki — reszta pól jest tak dobra jak zapis aplikacji. */
export function isSnapshot(v: unknown): v is SnapshotV1 {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<SnapshotV1>;
  return s.v === 1 && typeof s.at === 'number' && Array.isArray(s.scopes);
}
