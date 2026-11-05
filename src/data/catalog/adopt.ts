import type { AppState, Exercise, ExerciseId, Gear, Mode, Unit } from '../../types';
import { freshProgress } from '../../engine/plan';
import { LANG } from '../../i18n';
import { ALL, EX, WEIGHTED } from '../exercises';
import { EX_MUSCLES, MUSCLES } from '../muscles';
import type { MuscleId } from '../muscles';
import { catalogId, defOf, isCatalogId } from './derive';
import type { CatalogDef, CatalogRow } from './derive';

/**
 * Adopcja: ćwiczenie z katalogu staje się zwykłym ćwiczeniem silnika — trafia do `EX`,
 * `EX_MUSCLES` i `ALL`, więc plan, sesja, progresja, mięśnie tygodnia i eksporty widzą je jak każde
 * inne. Rejestr jest w pamięci strony; trwałość daje `state.catalog`, zapisywane w `syncCatalog`
 * tylko dla ćwiczeń, do których coś się odwołuje (trening, sesja, dziennik, przekąski, plany).
 * Ćwiczenie wybrane i porzucone w kreatorze po przeładowaniu znika.
 */

const registered = new Map<ExerciseId, CatalogDef>();

const toExercise = (d: CatalogDef): Exercise => ({
  name: LANG === 'pl' ? d.name[0] : d.name[1],
  group: d.group,
  gear: d.gear,
  mode: d.mode,
  unit: d.unit,
  ...(d.side ? { side: true } : {}),
  def: d.def,
  // Wskazówki z biblioteki tu nie ma — technikę niosą kroki z katalogu (arkusz „Jak to zrobić?”).
  hint: '',
});

/** Rejestruje definicje (start aplikacji, import pliku, adopcja). Ćwiczeń z biblioteki nie rusza. */
export function registerCatalog(defs: Record<ExerciseId, CatalogDef> | undefined): void {
  if (!defs) return;
  for (const [id, d] of Object.entries(defs)) {
    if (!isCatalogId(id) || registered.has(id) || Object.hasOwn(EX, id)) continue;
    registered.set(id, d);
    EX[id] = toExercise(d);
    EX_MUSCLES[id] = d.muscles;
    ALL.push(id);
    if (d.def.w !== undefined) WEIGHTED.push(id);
  }
}

/** Adopcja z wiersza katalogu; zwraca id ćwiczenia w silniku. */
export function adopt(row: CatalogRow): ExerciseId {
  const id = catalogId(row.i);
  if (!registered.has(id)) registerCatalog({ [id]: defOf(row) });
  return id;
}

export const isAdopted = (id: ExerciseId): boolean => registered.has(id);
export const adoptedDef = (id: ExerciseId): CatalogDef | undefined => registered.get(id);

/** Ćwiczenia z katalogu, do których odwołuje się zapis — po surowym tekście, bo miejsc jest wiele. */
function referenced(state: AppState): Set<ExerciseId> {
  const blob = JSON.stringify([state.workouts, state.session, state.log, state.snacks, state.plans ?? null]);
  return new Set(blob.match(/"kat-[0-9a-z]+"/g)?.map((s) => s.slice(1, -1)) ?? []);
}

/**
 * Przed zapisem: dopisuje do `state.catalog` zarejestrowane ćwiczenia, do których coś się
 * odwołuje. Raz zapisanych nie usuwa — historia może je pamiętać. Zwykle nic nie czeka, więc
 * kosztuje jedno porównanie; skan zapisu tylko wtedy, gdy jest świeża adopcja.
 */
export function syncCatalog(state: AppState): void {
  const saved = state.catalog ?? {};
  const pending = [...registered.keys()].filter((id) => !saved[id]);
  if (!pending.length) return;
  const used = referenced(state);
  const add = pending.filter((id) => used.has(id));
  if (!add.length) return;
  state.catalog = { ...saved, ...Object.fromEntries(add.map((id) => [id, registered.get(id)!])) };
  // Progresja powstaje razem z zapisem definicji, nawet gdy nikt jeszcze nie zapytał o `P`.
  for (const id of add) state.prog[id] ??= freshProgress(id);
}

const GEARS: readonly Gear[] = ['kettlebell', 'dumbbell', 'barbell', 'machine', 'band', 'bodyweight'];
const MODES: readonly Mode[] = ['grind', 'ballistic', 'carry', 'stage', 'body'];
const UNITS: readonly Unit[] = ['reps', 'secs'];
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const muscles = (v: unknown): v is MuscleId[] =>
  Array.isArray(v) && v.every((m) => MUSCLES.includes(m as MuscleId));

/**
 * Definicje z zapisu albo z pliku kopii, przesiane pole po polu: zepsuta pozycja odpada, reszta
 * zostaje. Bez tego jedna ręcznie poprawiona definicja wywróciłaby `freshProgress` przy starcie.
 */
export function restoreCatalog(raw: unknown): Record<ExerciseId, CatalogDef> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<ExerciseId, CatalogDef> = {};
  for (const [id, d] of Object.entries(raw as Record<string, Partial<CatalogDef>>)) {
    if (!isCatalogId(id) || !d || typeof d !== 'object') continue;
    const ok =
      typeof d.src === 'string' &&
      Array.isArray(d.name) &&
      d.name.length === 2 &&
      d.name.every((n) => typeof n === 'string' && n.length > 0) &&
      typeof d.eq === 'string' &&
      GEARS.includes(d.gear as Gear) &&
      MODES.includes(d.mode as Mode) &&
      UNITS.includes(d.unit as Unit) &&
      typeof d.group === 'string' &&
      !!d.def &&
      num(d.def.sets) &&
      num(d.def.target) &&
      num(d.def.min) &&
      num(d.def.max) &&
      (d.def.w === undefined || num(d.def.w)) &&
      !!d.muscles &&
      muscles(d.muscles.p) &&
      muscles(d.muscles.s);
    if (ok) out[id] = d as CatalogDef;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Tylko dla testów: rejestr wraca do biblioteki. */
export function resetCatalogForTests(): void {
  for (const id of registered.keys()) {
    delete EX[id];
    delete EX_MUSCLES[id];
    const a = ALL.indexOf(id);
    if (a >= 0) ALL.splice(a, 1);
    const w = WEIGHTED.indexOf(id);
    if (w >= 0) WEIGHTED.splice(w, 1);
  }
  registered.clear();
}
