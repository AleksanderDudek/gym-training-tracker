import Dexie, { type Table } from 'dexie';
import type { CustomFood, FoodSet, FoodSource } from './foods';
import type { DayChoices, Plan } from './plan';
import type { Profile } from './types';

/**
 * Everything the diet tab knows, on this device only (IndexedDB). Health data
 * does not leave it; a JSON export is the backup.
 */

export interface ProfileRow extends Profile {
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

export class DietDb extends Dexie {
  profile!: Table<ProfileRow, string>;
  days!: Table<DayRow, string>;
  entries!: Table<Entry, number>;
  plans!: Table<Plan, string>;
  foods!: Table<CustomFood & { id?: number }, number>;
  sets!: Table<FoodSet, number>;

  constructor(name = 'produkty-pl-dieta') {
    super(name);
    this.version(1).stores({ profile: 'id', days: 'date', entries: '++id, date', plans: 'id', foods: '++id' });
    // Własne zestawy („Banan + batonik”). Nowa tabela, reszta bez zmian — dane z wersji 1 zostają.
    this.version(2).stores({ sets: '++id' });
  }
}

export const db = new DietDb();
