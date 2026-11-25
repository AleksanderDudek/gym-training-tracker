import { MESSAGE_MAX, localDay } from '@gymtracker/link/coaching';
import type { MessageRef } from '@gymtracker/link/coaching';
import type { StoredMessage } from '../../link/store';
import type { LogEntry } from '../../types';

/**
 * Rozmowa z prowadzącym — czyste funkcje dla `Chat.tsx`: dni, znacznik „przeczytane”, treningi do
 * dołączenia. Bez tekstów i bez sieci, więc testują się same.
 */

/** Chwila wiadomości do pokazania: czas serwera, a nasza niewysłana — chwila napisania. */
export const whenOf = (m: Pick<StoredMessage, 'serverAt' | 'at'>): number => {
  const t = m.serverAt ? Date.parse(m.serverAt) : NaN;
  return Number.isNaN(t) ? m.at : t;
};

export interface DayGroup<T> {
  /** `YYYY-MM-DD` w strefie urządzenia. */
  day: string;
  items: T[];
}

/** Kolejne wiadomości pod nagłówkami dni — w kolejności, w jakiej przyszły (bez sortowania). */
export function byDay<T>(items: readonly T[], when: (t: T) => number): DayGroup<T>[] {
  const out: DayGroup<T>[] = [];
  for (const it of items) {
    const day = localDay(when(it));
    const last = out.at(-1);
    if (last && last.day === day) last.items.push(it);
    else out.push({ day, items: [it] });
  }
  return out;
}

/**
 * Nasza ostatnia wiadomość, którą prowadzący już przeczytał (`readUpTo` — czas serwera ostatniej
 * przeczytanej), albo `null`. Pod nią stoi „Przeczytane”: wszystko wcześniej też jest przeczytane.
 */
export function lastReadId(list: readonly StoredMessage[], readUpTo: string | null | undefined): string | null {
  const upTo = readUpTo ? Date.parse(readUpTo) : NaN;
  if (Number.isNaN(upTo)) return null;
  let id: string | null = null;
  for (const m of list) {
    if (m.author !== 'client' || !m.serverAt) continue;
    const at = Date.parse(m.serverAt);
    if (!Number.isNaN(at) && at <= upTo) id = m.id;
  }
  return id;
}

/** Zamknięte treningi do dołączenia: najnowsze pierwsze, jako odniesienie wiadomości. */
export function recentSessions(log: readonly LogEntry[], n = 10): Extract<MessageRef, { kind: 'session' }>[] {
  return log
    .filter((e) => typeof e.date === 'string' && !Number.isNaN(Date.parse(e.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, n)
    .map((e) => ({ kind: 'session' as const, at: e.date, label: (e.workout ?? '').trim().slice(0, 120) }));
}

/** Licznik znaków pokazuje się dopiero blisko granicy — wcześniej tylko by rozpraszał. */
export const COUNTER_FROM = MESSAGE_MAX - 500;
export const nearLimit = (text: string): boolean => text.length >= COUNTER_FROM;
