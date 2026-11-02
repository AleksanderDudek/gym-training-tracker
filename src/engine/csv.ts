import { BUILTIN, EFFORT, EX } from '../data/exercises';
import { LANG, text } from '../i18n';
import type { Lang } from '../i18n';
import type { AppState, EffortKey } from '../types';
import { bodyOf } from './body';
import { dayKey } from './schedule';

/**
 * Eksport do arkusza: pliki CSV z treningów, ciała i jedzenia (to ostatnie w `food/csv.ts`,
 * bo czyta dziennik z IndexedDB). Plik powstaje w przeglądarce; nic nie idzie do sieci.
 *
 * Format idzie za językiem wizyty, bo tak otwiera plik arkusz w tym języku: po polsku separator
 * `;` i przecinek dziesiętny (polski Excel bierze przecinek za część liczby), po angielsku `,`
 * i kropka. Liczby bez separatora tysięcy — arkusz odczyta „1 250” jako tekst. Plik w UTF-8
 * z BOM (inaczej Excel czyta polskie litery jako krzaki), wiersze kończy CRLF (RFC 4180).
 */

export interface CsvFormat {
  sep: ';' | ',';
  decimal: ',' | '.';
}

export const csvFormat = (lang: Lang = LANG): CsvFormat =>
  lang === 'pl' ? { sep: ';', decimal: ',' } : { sep: ',', decimal: '.' };

/** Liczba z ustaloną liczbą miejsc po przecinku (waga ciała zawsze z dwoma). */
export interface Fixed {
  fixed: number;
  digits: number;
}

export const fixed = (n: number, digits: number): Fixed => ({ fixed: n, digits });

/** Komórka: tekst, liczba (do dwóch miejsc, bez zer na końcu) albo pusta (`null` — brak danych). */
export type Cell = string | number | Fixed | null | undefined;

export const BOM = '﻿';

/**
 * Tekst, który arkusz wziąłby za formułę (`=`, `+`, `-`, `@` na początku), dostaje apostrof —
 * nazwa własnego treningu czy potrawy nie może niczego w arkuszu uruchomić (OWASP, „CSV injection”).
 */
const FORMULA = /^[=+\-@\t\r]/;

function cellText(c: Cell, f: CsvFormat): string {
  if (c === null || c === undefined) return '';
  if (typeof c === 'string') return FORMULA.test(c) ? `'${c}` : c;
  const [n, digits] = typeof c === 'number' ? [c, null] : [c.fixed, c.digits];
  if (!Number.isFinite(n)) return '';
  const s = digits === null ? String(Math.round(n * 100) / 100) : n.toFixed(digits);
  return f.decimal === '.' ? s : s.replace('.', f.decimal);
}

/** Cudzysłów wokół komórki z separatorem, cudzysłowem albo końcem linii; cudzysłów w środku podwojony. */
export function csvCell(c: Cell, f: CsvFormat): string {
  const s = cellText(c, f);
  return s.includes(f.sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Nagłówek i wiersze w jeden tekst CSV (bez BOM — dokłada go pobieranie). */
export function toCsv(header: string[], rows: Cell[][], f: CsvFormat): string {
  return [header, ...rows].map((r) => r.map((c) => csvCell(c, f)).join(f.sep)).join('\r\n') + '\r\n';
}

const T = text({
  pl: {
    workouts: [
      'Data',
      'Trening',
      'Ćwiczenie',
      'Seria',
      'Powtórzenia',
      'Sekundy',
      'Ciężar (kg)',
      'Wysiłek',
      'Zapas powtórzeń',
      'Czas treningu (min)',
    ],
    rir: { easy: '3+', solid: '1–2', max: '0' } as Record<EffortKey, string>,
    date: 'Data',
    weight: 'Waga (kg)',
    measure: {
      waist: 'Talia (cm)',
      hips: 'Biodra (cm)',
      chest: 'Klatka (cm)',
      arm: 'Ramię (cm)',
      thigh: 'Udo (cm)',
    } as Record<string, string>,
  },
  en: {
    workouts: [
      'Date',
      'Workout',
      'Exercise',
      'Set',
      'Reps',
      'Seconds',
      'Weight (kg)',
      'Effort',
      'Reps in reserve',
      'Workout time (min)',
    ],
    rir: { easy: '3+', solid: '1–2', max: '0' },
    date: 'Date',
    weight: 'Weight (kg)',
    measure: {
      waist: 'Waist (cm)',
      hips: 'Hips (cm)',
      chest: 'Chest (cm)',
      arm: 'Arm (cm)',
      thigh: 'Thigh (cm)',
    },
  },
});

/**
 * Treningi: wiersz na serię. Nazwa ćwiczenia w języku wizyty; ćwiczenie spoza biblioteki
 * (usunięte z niej po latach) zostaje z identyfikatorem, zamiast wypaść z historii.
 * Data jak wszędzie w dzienniku — dzień `dayKey` wpisu.
 */
export function workoutsCsv(state: AppState, f: CsvFormat = csvFormat()): { text: string; rows: number } {
  const rows: Cell[][] = [];
  const log = [...state.log].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of log) {
    const name = BUILTIN.find((w) => w.id === e.wid)?.name ?? e.workout;
    const mins = e.time ? Math.round(e.time.secs / 6) / 10 : null;
    for (const item of e.items) {
      const exercise = EX[item.id];
      const secs = exercise?.unit === 'secs';
      const effort = EFFORT[item.effort];
      item.sets.forEach((s, i) =>
        rows.push([
          dayKey(e.date),
          name,
          exercise?.name ?? item.id,
          i + 1,
          secs ? null : s.reps,
          secs ? s.reps : null,
          s.w,
          effort?.label ?? null,
          effort ? T.rir[item.effort] : null,
          mins,
        ]),
      );
    }
  }
  return { text: toCsv(T.workouts, rows, f), rows: rows.length };
}

/** Obwody znane z nazwy — w tej kolejności, z etykietą; inne liczby idą za nimi pod własnym kluczem. */
const MEASURE_ORDER = ['waist', 'hips', 'chest', 'arm', 'thigh'];
// i18n-ignore: klucze możliwego zapisu obwodów po polsku, nie tekst
const MEASURE_ALIAS: Record<string, string> = { talia: 'waist', biodra: 'hips', klatka: 'chest', ramie: 'arm', ramię: 'arm', udo: 'thigh' };

type MeasureDay = { day: string; values: Record<string, number> };

/**
 * Obwody z `state.measures`, jeśli zapis je ma (pakiet „Sylwetka”). Czytane luźno: lista wpisów
 * z dniem (`day` albo `date`, `yyyy-mm-dd`) i polami-liczbami albo słownik dzień → pola. Pole,
 * które nie jest skończoną liczbą, odpada; dzień bez żadnej liczby też.
 */
export function measuresOf(state: AppState): MeasureDay[] {
  const raw = (state as AppState & { measures?: unknown }).measures;
  if (!raw || typeof raw !== 'object') return [];
  const pairs: [unknown, unknown][] = Array.isArray(raw)
    ? raw.map((m) => [(m as { day?: unknown; date?: unknown })?.day ?? (m as { date?: unknown })?.date, m])
    : Object.entries(raw);
  const out: MeasureDay[] = [];
  for (const [day, m] of pairs) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !m || typeof m !== 'object') continue;
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      if (k === 'day' || k === 'date' || typeof v !== 'number' || !Number.isFinite(v)) continue;
      values[MEASURE_ALIAS[k] ?? k] = v;
    }
    if (Object.keys(values).length) out.push({ day, values });
  }
  return out;
}

/** Ciało: wiersz na dzień z ważeniem albo pomiarem obwodów. Waga z dwoma miejscami, jak w aplikacji. */
export function bodyCsv(state: AppState, f: CsvFormat = csvFormat()): { text: string; rows: number } {
  const measures = measuresOf(state);
  const keys = new Set(measures.flatMap((m) => Object.keys(m.values)));
  const cols = [...MEASURE_ORDER.filter((k) => keys.has(k)), ...[...keys].filter((k) => !MEASURE_ORDER.includes(k)).sort()];
  const days = new Map<string, { kg?: number; values?: Record<string, number> }>();
  for (const b of bodyOf(state)) days.set(b.day, { kg: b.kg });
  for (const m of measures) days.set(m.day, { ...days.get(m.day), values: { ...days.get(m.day)?.values, ...m.values } });
  const rows: Cell[][] = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, d]) => [day, d.kg === undefined ? null : fixed(d.kg, 2), ...cols.map((k) => d.values?.[k] ?? null)]);
  const header = [T.date, T.weight, ...cols.map((k) => T.measure[k] ?? k)];
  return { text: toCsv(header, rows, f), rows: rows.length };
}

/** Nazwa pliku z rodzajem i dzisiejszą datą: `gym-tracker-treningi-2026-11-02.csv`. */
export const csvName = (kind: string, now: Date = new Date()): string =>
  `gym-tracker-${kind}-${now.toISOString().slice(0, 10)}.csv`;
