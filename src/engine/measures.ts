import { num, text } from '../i18n';
import type { AppState, BodyMeasures, MeasureKey } from '../types';

/**
 * Obwody ciała w czasie: talia, biodra, klatka, ramię i udo, w centymetrach do 0,1.
 *
 * Dziennik stoi obok ważeń (`state.measures`) i działa jak one: jeden wpis na dzień, drugi
 * pomiar tego samego dnia dopisuje albo poprawia pola pierwszego. Każde pole jest opcjonalne —
 * kto mierzy samą talię, nie musi wpisywać reszty. Liczby stoją bez ocen i progów: co z nich
 * wynika, to rozmowa z trenerem albo lekarzem, tak jak przy wadze.
 */

export const MEASURES: readonly MeasureKey[] = ['waist', 'hips', 'chest', 'arm', 'thigh'];

/**
 * Zakresy, w których pomiar jest liczbą, a nie literówką („8,5” zamiast „85”, „850”).
 * Szerokie, bo to nie normy — tylko granica tego, co taśma w ogóle pokaże u dorosłego.
 */
export const MEASURE_RANGE: Record<MeasureKey, { min: number; max: number }> = {
  waist: { min: 40, max: 250 },
  hips: { min: 50, max: 250 },
  chest: { min: 50, max: 250 },
  arm: { min: 10, max: 80 },
  thigh: { min: 20, max: 120 },
};

const T = text({
  pl: {
    names: { waist: 'Talia', hips: 'Biodra', chest: 'Klatka', arm: 'Ramię', thigh: 'Udo' } as Record<MeasureKey, string>,
    outOfRange: (name: string, min: number, max: number) => `${name}: poza zakresem ${min}–${max} cm.`,
  },
  en: {
    names: { waist: 'Waist', hips: 'Hips', chest: 'Chest', arm: 'Arm', thigh: 'Thigh' } as Record<MeasureKey, string>,
    outOfRange: (name: string, min: number, max: number) => `${name}: out of range ${min}–${max} cm.`,
  },
});

/** Nazwa obwodu do etykiet i komunikatów. */
export const measureName = (key: MeasureKey): string => T.names[key];

/** Obwód tak, jak go pokazujemy: jedna cyfra po przecinku („84,5”), bez jednostki. */
export const formatCm = (cm: number): string => num(cm, 1);

/** Zmiana ze znakiem zawsze — „−2,0”, „+0,5”, „0,0” — żeby przyrost nie czytał się jak spadek. */
export const formatCmChange = (d: number): string => {
  const r = round1(d);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${formatCm(Math.abs(r))}`;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const round1 = (n: number): number => Math.round(n * 10) / 10;

export const validMeasure = (key: MeasureKey, cm: unknown): cm is number =>
  typeof cm === 'number' && Number.isFinite(cm) && cm >= MEASURE_RANGE[key].min && cm <= MEASURE_RANGE[key].max;

/** Zapisy sprzed obwodów nie mają tej listy — to pusty dziennik. */
export const measuresOf = (state: AppState): BodyMeasures[] => state.measures ?? [];

/**
 * Wpis z zapisu albo z pliku po przesianiu: zepsuta data — nic; pola spoza zakresu odpadają
 * pojedynczo, a wpis bez żadnego dobrego pola znika. Wartości zaokrąglone do 0,1 cm.
 */
export function cleanMeasures(raw: unknown): BodyMeasures | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.day !== 'string' || !DAY.test(r.day)) return null;
  const out: BodyMeasures = { day: r.day };
  let any = false;
  for (const key of MEASURES) {
    const v = r[key];
    if (validMeasure(key, v)) {
      out[key] = round1(v);
      any = true;
    }
  }
  return any ? out : null;
}

/**
 * Dziennik obwodów z zapisu albo z importu: przesiany, po jednym wpisie na dzień (dwa wpisy z tego
 * samego dnia łączą się, późniejszy wygrywa pole po polu) i rosnąco po dniu.
 */
export function restoreMeasures(saved: unknown): BodyMeasures[] {
  if (!Array.isArray(saved)) return [];
  const byDay = new Map<string, BodyMeasures>();
  for (const raw of saved) {
    const m = cleanMeasures(raw);
    if (m) byDay.set(m.day, { ...byDay.get(m.day), ...m });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Co przychodzi z formularza: liczba — zapisz, `null` — wyczyść to pole, brak — zostaw. */
export type MeasureInput = Partial<Record<MeasureKey, number | null>>;

/**
 * Pomiar z danego dnia. Drugi tego samego dnia dopisuje albo poprawia pola pierwszego — wieczorem
 * dopisane ramię nie kasuje porannej talii. Liczba spoza zakresu kończy się wyjątkiem z nazwą
 * obwodu i niczego nie zapisuje. Wpis bez żadnego pola znika. Zwraca wpis po zmianie (`null`,
 * gdy zniknął).
 */
export function setMeasures(state: AppState, day: string, input: MeasureInput): BodyMeasures | null {
  for (const key of MEASURES) {
    const v = input[key];
    if (typeof v === 'number' && !validMeasure(key, v))
      throw new Error(T.outOfRange(measureName(key), MEASURE_RANGE[key].min, MEASURE_RANGE[key].max));
  }
  const list = measuresOf(state);
  const entry: BodyMeasures = { ...list.find((m) => m.day === day), day };
  for (const key of MEASURES) {
    const v = input[key];
    if (v === null) delete entry[key];
    else if (typeof v === 'number') entry[key] = round1(v);
  }
  const rest = list.filter((m) => m.day !== day);
  const kept = MEASURES.some((key) => entry[key] !== undefined);
  state.measures = (kept ? [...rest, entry] : rest).sort((a, b) => a.day.localeCompare(b.day));
  return kept ? entry : null;
}

export function removeMeasures(state: AppState, day: string): boolean {
  const list = measuresOf(state);
  const next = list.filter((m) => m.day !== day);
  if (next.length === list.length) return false;
  state.measures = next;
  return true;
}

/** Jeden obwód dzień po dniu — tylko dni, w których go zmierzono. */
export function measureSeries(list: readonly BodyMeasures[], key: MeasureKey): { day: string; cm: number }[] {
  return list.flatMap((m) => (m[key] !== undefined ? [{ day: m.day, cm: m[key] }] : []));
}

export interface MeasureSummary {
  key: MeasureKey;
  /** Ostatni pomiar i jego dzień. */
  last: number;
  lastDay: string;
  /** Pierwszy pomiar i jego dzień. */
  first: number;
  firstDay: string;
  /** Ostatni minus pierwszy, do 0,1 cm; przy jednym pomiarze 0. */
  change: number;
  /** Ile pomiarów tego obwodu. */
  n: number;
}

/** Ostatnia wartość i zmiana od pierwszego pomiaru; `null`, gdy tego obwodu nikt jeszcze nie zmierzył. */
export function measureSummary(list: readonly BodyMeasures[], key: MeasureKey): MeasureSummary | null {
  const s = measureSeries(list, key);
  if (!s.length) return null;
  const first = s[0]!;
  const last = s[s.length - 1]!;
  return { key, last: last.cm, lastDay: last.day, first: first.cm, firstDay: first.day, change: round1(last.cm - first.cm), n: s.length };
}
