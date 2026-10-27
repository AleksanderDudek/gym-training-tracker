import Dexie, { type Table } from 'dexie';
import type { CustomFood, Food, FoodSet, FoodSource } from './foods';
import type { LabPrefs, LabReport } from '../labs/types';
import type { PrepPlan } from '../prep/types';
import type { DayChoices, Plan } from './plan';
import type { LegacyFields, Profile } from './types';

/**
 * Everything the diet tab knows, on this device only (IndexedDB). Health data
 * does not leave it; a JSON export is the backup.
 */

/** The stored profile: the profile plus the old model's keys, which stay in the row untouched. */
export interface ProfileRow extends Profile, LegacyFields {
  id: 'me';
}

export interface DayRow {
  /** YYYY-MM-DD */
  date: string;
  weightKg?: number | null;
  steps?: number | null;
  training?: boolean;
  /** Variant, swaps and skips of the plan for this day. */
  choices?: DayChoices;
  /** Which "Ułóż dzień" set is shown on a day without a plan (another click, another set). */
  autoSeed?: number;
  note?: string;
  /** A cheat meal planned for this day: the rest of the day is planned around it until it is eaten. */
  cheat?: PlannedCheat;
  /**
   * The person's word on the day's log: `true` — incomplete („Nie wszystko zapisane”), `false` —
   * the whole day („To był cały dzień”); absent — 60 % of the day's target decides (`isComplete`).
   */
  partial?: boolean;
  /** Weekly habits of the lab-results plan ticked this day: habit id → times. */
  labHabits?: Record<string, number>;
}

/** A planned cheat meal: calories always, macros when known (unknown is not zero). */
export interface PlannedCheat {
  name: string;
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** What it is made of, when picked from the list: „Pizza Margherita (1 szt.)”, „Cola (0,5 l)”. */
  items?: string[];
}

/** What was eaten: a snapshot, so history never changes when a product's data does. */
export interface Entry {
  id?: number;
  date: string;
  /** HH:MM */
  time: string;
  name: string;
  amountLabel: string;
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  source: FoodSource | 'quick';
  /** The food it came from, when it came from one. */
  key?: string;
  /** The plan line it ticked off, when it did. */
  planIndex?: number;
}

/**
 * A starred food („Ulubione”): a snapshot of the food as it was starred - the
 * quick-pick list renders and logs it without the product base - and how
 * often it is eaten, so the list sorts itself.
 */
export interface Favorite {
  /** The food's key: "product:590…", "restaurant:kfc:strips", "set:3". */
  key: string;
  food: Food;
  /** ISO time. */
  addedAt: string;
  /** Logs of a food with this key since it was starred. */
  uses: number;
  /** ISO time of the last such log. */
  lastUsed: string | null;
}

export class DietDb extends Dexie {
  profile!: Table<ProfileRow, string>;
  days!: Table<DayRow, string>;
  entries!: Table<Entry, number>;
  plans!: Table<Plan, string>;
  foods!: Table<CustomFood & { id?: number }, number>;
  sets!: Table<FoodSet, number>;
  favorites!: Table<Favorite, string>;
  prep!: Table<PrepPlan, number>;
  labs!: Table<LabReport, number>;
  labPrefs!: Table<LabPrefs, string>;

  constructor(name = 'produkty-pl-dieta') {
    super(name);
    this.version(1).stores({ profile: 'id', days: 'date', entries: '++id, date', plans: 'id', foods: '++id' });
    // Własne zestawy („Banan + batonik”). Nowa tabela, reszta bez zmian — dane z wersji 1 zostają.
    this.version(2).stores({ sets: '++id' });
    // Ulubione — gwiazdka przy jedzeniu, klucz to klucz jedzenia.
    this.version(3).stores({ favorites: 'key' });
    // Meal prep — plany na kolejne dni z listą zakupów, każdy jako migawka.
    this.version(4).stores({ prep: '++id' });
    // Badania — wyniki z laboratorium (jeden wiersz na dzień pobrania) i ustawienia planu pod wyniki.
    this.version(5).stores({ labs: '++id, date', labPrefs: 'id' });
  }
}

export const db = new DietDb();
