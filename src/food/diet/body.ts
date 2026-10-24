import { validWeight } from '../../engine/body';
import type { DayRow } from './db';

/**
 * Jedno ciało, jedno źródło prawdy. Waga i kroki mieszkają w danych treningowych (dziennik wagi,
 * wpisy kroków, zegarek); dieta ma w `DayRow` własne, starsze pola z czasów Produktów PL. Tu
 * jedno nakłada się na drugie (dzień dziennika z `useMergedDay`), a dawne ważenia diety
 * przechodzą do dziennika wagi.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dni diety z wagą i krokami z treningów. Ważenie z dziennika wagi wygrywa z wagą diety tego
 * samego dnia, a dzień z samym ważeniem dostaje własny wiersz. Kroki z treningów wygrywają
 * z krokami diety — ale tylko w dniach, które już są w wyniku: dzień bez wpisu diety i bez
 * ważenia nie powstaje tylko po to, żeby nieść kroki (listy dni pokazywałyby puste wiersze).
 * Tam, gdzie treningi nic nie mają, zostaje to, co zapisała dieta. Wejście zostaje nietknięte.
 */
export function mergeBody(
  days: readonly DayRow[],
  weights: readonly { day: string; kg: number }[],
  stepsOn: (day: string) => number | null,
): DayRow[] {
  const byDate = new Map<string, DayRow>();
  for (const d of days) byDate.set(d.date, { ...d });
  for (const w of weights) {
    const row = byDate.get(w.day);
    if (row) row.weightKg = w.kg;
    else byDate.set(w.day, { date: w.day, weightKg: w.kg });
  }
  for (const row of byDate.values()) {
    const steps = stepsOn(row.date);
    if (steps !== null) row.steps = steps;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Ważenia z dawnego dziennika diety do przeniesienia — jeden raz, przy pierwszym wejściu
 * w Jedzenie. Tylko z dni, których dziennik wagi nie ma (ważenie w treningach jest nowsze
 * albo tak samo dobre), i tylko w zakresie, który dziennik wagi przyjmuje — inaczej zapis
 * by go odrzucił. Rosnąco po dniu, jak sam dziennik wagi.
 */
export function weightsToMigrate(
  dietDays: readonly DayRow[],
  gymWeights: readonly { day: string; kg: number }[],
): { day: string; kg: number }[] {
  const known = new Set(gymWeights.map((w) => w.day));
  return dietDays
    .filter((d): d is DayRow & { weightKg: number } => DAY.test(d.date) && !known.has(d.date) && validWeight(d.weightKg))
    .map((d) => ({ day: d.date, kg: d.weightKg }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
