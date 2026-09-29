import type { AppState, BodyWeight } from '../types';

/**
 * Waga ciała w czasie.
 *
 * Kalorie zależą od wagi wprost, a waga się zmienia — i to często właśnie dlatego, że ktoś
 * liczy kalorie. Trzymamy więc dziennik ważeń, a nie jedną liczbę: spacer sprzed pół roku
 * liczy się z wagą sprzed pół roku, a nowe ważenie nie przepisuje historii.
 */

export const WEIGHT_RANGE = { min: 30, max: 300 } as const;
export const HEIGHT_RANGE = { min: 120, max: 230 } as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Zapisy starsze niż ta funkcja nie mają dziennika wagi — traktujemy to jak pusty. */
export const bodyOf = (state: AppState): BodyWeight[] => state.body ?? [];

export const validWeight = (kg: unknown): kg is number =>
  typeof kg === 'number' && Number.isFinite(kg) && kg >= WEIGHT_RANGE.min && kg <= WEIGHT_RANGE.max;

export const validHeight = (cm: unknown): cm is number =>
  typeof cm === 'number' && Number.isFinite(cm) && cm >= HEIGHT_RANGE.min && cm <= HEIGHT_RANGE.max;

export const validBody = (b: Partial<BodyWeight> | null | undefined): b is BodyWeight =>
  !!b && typeof b.day === 'string' && DAY.test(b.day) && validWeight(b.kg);

/**
 * Ważenie z danego dnia. Drugie tego samego dnia zastępuje pierwsze — waga po śniadaniu
 * nie jest nowym punktem pomiaru, tylko poprawką. Lista zostaje posortowana po dniu.
 */
export function setBodyWeight(state: AppState, kg: number, day: string): BodyWeight {
  if (!validWeight(kg))
    throw new Error(`Waga poza zakresem ${WEIGHT_RANGE.min}–${WEIGHT_RANGE.max} kg.`);
  const entry: BodyWeight = { day, kg: Math.round(kg * 10) / 10 };
  state.body = [...bodyOf(state).filter((b) => b.day !== day), entry].sort((a, b) =>
    a.day.localeCompare(b.day),
  );
  return entry;
}

export function removeBodyWeight(state: AppState, day: string): boolean {
  const list = bodyOf(state);
  const next = list.filter((b) => b.day !== day);
  if (next.length === list.length) return false;
  state.body = next;
  return true;
}

/**
 * Waga obowiązująca w danym dniu: ostatnie ważenie nie późniejsze niż ten dzień. Ruch sprzed
 * pierwszego ważenia bierze pierwsze ważenie — to lepsze niż brak liczby i pewniejsze niż
 * przeciętna z tabel. Bez żadnego ważenia kalorii nie liczymy wcale.
 */
export function weightOn(state: AppState, day: string): number | null {
  const list = bodyOf(state);
  if (!list.length) return null;
  let kg = list[0]!.kg;
  for (const b of list) {
    if (b.day > day) break;
    kg = b.kg;
  }
  return kg;
}

/** Ostatnie ważenie — to, co widać w profilu jako „twoja waga”. */
export const latestWeight = (state: AppState): BodyWeight | null => {
  const list = bodyOf(state);
  return list.length ? list[list.length - 1]! : null;
};

/** Wzrost z profilu, jeśli ma sens. Inaczej długość kroku idzie z przeciętnej. */
export const heightOf = (state: AppState): number | undefined =>
  validHeight(state.cfg.height) ? state.cfg.height : undefined;
