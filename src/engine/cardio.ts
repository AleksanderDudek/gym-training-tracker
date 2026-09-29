import type { AppState, Cardio, CardioInput, CardioSport } from '../types';

/**
 * Kroki, bieżnia i rower wpisane ręcznie.
 *
 * Przeglądarka nie ma dostępu do krokomierza telefonu — liczy go system, a strona nie dostaje
 * z niego ani kroku. Zamiast udawać pomiar, aplikacja przyjmuje liczby z urządzenia, które
 * mierzy naprawdę: kroki z telefonu albo zegarka, prędkość i czas z bieżni, prędkość albo moc
 * z roweru. Z nich i z wagi liczą się kalorie.
 *
 * Wpisy mieszkają osobno od dziennika treningów, tak jak przekąski: dziennik karmi progresję
 * i kalendarz planu, a spacer nie może podnieść celu przysiadów ani domknąć terminu.
 */

/**
 * Zakresy wpisu. Poza nimi to niemal na pewno literówka: sto tysięcy kroków to maraton
 * z zapasem, 25 km/h to sufit bieżni, 700 W to sprinter na torze, a dwanaście godzin to
 * więcej niż cały dzień jazdy.
 */
export const CARDIO_LIMITS = {
  steps: { min: 1, max: 100_000 },
  treadmillKmh: { min: 1, max: 25 },
  grade: { min: 0, max: 25 },
  bikeKmh: { min: 3, max: 70 },
  watts: { min: 10, max: 700 },
  min: { min: 1, max: 720 },
} as const;

type Range = { readonly min: number; readonly max: number };

const within = (v: unknown, r: Range): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Zapisy starsze niż ta funkcja nie mają listy — traktujemy to jak pustą. */
export const cardioOf = (state: AppState): Cardio[] => state.cardio ?? [];

/** Rower stacjonarny z mocą to wciąż rower — w nawigacji i na liście stoją razem. */
export const sportOf = (c: Pick<CardioInput, 'kind'>): CardioSport => (c.kind === 'ergo' ? 'bike' : c.kind);

const pl = (n: number): string => n.toLocaleString('pl-PL');

/**
 * Co jest nie tak z wpisem — zdaniem, do pokazania pod formularzem. `null` znaczy, że wpis
 * nadaje się do zapisu.
 */
export function inputProblem(c: CardioInput): string | null {
  const L = CARDIO_LIMITS;
  const minutes = (): string | null =>
    within((c as { min?: unknown }).min, L.min) ? null : `Czas od ${L.min.min} do ${L.min.max} minut.`;
  switch (c.kind) {
    case 'steps':
      return within(c.steps, L.steps) ? null : `Kroki od ${L.steps.min} do ${pl(L.steps.max)}.`;
    case 'treadmill':
      if (!within(c.kmh, L.treadmillKmh))
        return `Prędkość bieżni od ${L.treadmillKmh.min} do ${L.treadmillKmh.max} km/h.`;
      if (!within(c.grade, L.grade)) return `Nachylenie od ${L.grade.min} do ${L.grade.max}%.`;
      return minutes();
    case 'bike':
      if (!within(c.kmh, L.bikeKmh)) return `Prędkość roweru od ${L.bikeKmh.min} do ${L.bikeKmh.max} km/h.`;
      return minutes();
    case 'ergo':
      if (!within(c.watts, L.watts)) return `Moc od ${L.watts.min} do ${L.watts.max} W.`;
      return minutes();
    default:
      return 'Nieznany rodzaj ruchu.';
  }
}

/**
 * Wpis sprowadzony do liczb, które da się przepisać z wyświetlacza: kroki i waty w całości,
 * prędkość i nachylenie z jedną cyfrą po przecinku, minuty w całości.
 */
export function normalize(c: CardioInput): CardioInput {
  const r1 = (v: number): number => Math.round(v * 10) / 10;
  switch (c.kind) {
    case 'steps':
      return { kind: 'steps', steps: Math.round(c.steps) };
    case 'treadmill':
      return { kind: 'treadmill', kmh: r1(c.kmh), min: Math.round(c.min), grade: r1(c.grade) };
    case 'bike':
      return { kind: 'bike', kmh: r1(c.kmh), min: Math.round(c.min) };
    case 'ergo':
      return { kind: 'ergo', watts: Math.round(c.watts), min: Math.round(c.min) };
  }
}

/** Czy zapisany wpis da się bezpiecznie wczytać — po imporcie pliku albo ze starego zapisu. */
export const validCardio = (c: unknown): c is Cardio => {
  if (!c || typeof c !== 'object') return false;
  const x = c as Partial<Cardio>;
  return (
    typeof x.key === 'string' &&
    typeof x.day === 'string' &&
    DAY.test(x.day) &&
    typeof x.at === 'string' &&
    !Number.isNaN(Date.parse(x.at)) &&
    typeof x.kind === 'string' &&
    inputProblem(x as CardioInput) === null
  );
};

/**
 * Dopisuje ruch i go zwraca. Kroki to suma dnia z telefonu, więc drugi wpis kroków na ten
 * sam dzień **zastępuje** pierwszy — wieczorem wpisuje się stan licznika, a nie przyrost od
 * południa. Bieżnia i rower to osobne wyjścia, więc się sumują.
 */
export function addCardio(
  state: AppState,
  input: CardioInput,
  day: string,
  now: number = Date.now(),
): { entry: Cardio; replaced: Cardio | null } {
  if (!DAY.test(day)) throw new Error(`Zły dzień: ${day}`);
  const clean = normalize(input);
  const problem = inputProblem(clean);
  if (problem) throw new Error(problem);
  state.cardio ??= [];
  const replaced =
    clean.kind === 'steps' ? (state.cardio.find((c) => c.kind === 'steps' && c.day === day) ?? null) : null;
  if (replaced) state.cardio = state.cardio.filter((c) => c !== replaced);
  const same = state.cardio.filter((c) => c.key.startsWith(`${now}-`)).length;
  const entry: Cardio = { ...clean, key: `${now}-${same}`, day, at: new Date(now).toISOString() };
  state.cardio.push(entry);
  return { entry, replaced };
}

export function removeCardio(state: AppState, key: string): boolean {
  const list = cardioOf(state);
  const i = list.findIndex((c) => c.key === key);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

/** Wpisy z jednego dnia w kolejności zapisu. */
export const cardioOn = (state: AppState, day: string): Cardio[] =>
  cardioOf(state)
    .filter((c) => c.day === day)
    .sort((a, b) => a.at.localeCompare(b.at));

/** Kroki z dnia. Jeden wpis na dzień, więc to jego liczba albo zero. */
export const stepsOn = (state: AppState, day: string): number =>
  cardioOn(state, day).reduce((s, c) => s + (c.kind === 'steps' ? c.steps : 0), 0);

/**
 * Ostatni wpis danego rodzaju — do podpowiedzi w pustym polu. Tylko podpowiedź: pole zostaje
 * puste, jak przy przekąskach, żeby wpisać to, co było dziś, a nie zatwierdzić wczorajsze.
 */
export function lastOf<K extends CardioInput['kind']>(
  state: AppState,
  kind: K,
): Extract<Cardio, { kind: K }> | null {
  const list = cardioOf(state)
    .filter((c): c is Extract<Cardio, { kind: K }> => c.kind === kind)
    .sort((a, b) => b.at.localeCompare(a.at));
  return list[0] ?? null;
}
