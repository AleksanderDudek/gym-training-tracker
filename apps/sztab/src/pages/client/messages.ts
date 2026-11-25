import { useEffect, useSyncExternalStore } from 'react';
import { MESSAGE_MAX, localDay } from '@gymtracker/link/coaching';
import type { MessageRef } from '@gymtracker/link/coaching';
import { unreadCounts } from '../../lib/data';
import type { Message } from '../../lib/data';

/**
 * Wiadomości w Sztabie — czyste funkcje zakładki (dni, „przeczytane”, odniesienie z adresu)
 * i licznik nieprzeczytanych przy zakładce, wspólny dla nagłówka i otwartej rozmowy.
 */

/** Jak często otwarta rozmowa pyta o nowe (tylko na widocznej karcie). */
export const POLL_MS = 20_000;
/** Licznik nieprzeczytanych przy zakładce odświeża się rzadziej — to tylko znak „coś jest”. */
export const UNREAD_POLL_MS = 60_000;

export const visible = (): boolean => document.visibilityState === 'visible';

export interface DayGroup<T> {
  /** `YYYY-MM-DD` w strefie przeglądarki prowadzącego. */
  day: string;
  items: T[];
}

/** Kolejne wiadomości pod nagłówkami dni — w kolejności rozmowy (bez sortowania). */
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

export const whenOf = (m: Pick<Message, 'createdAt'>): number => Date.parse(m.createdAt);

/**
 * Nasza (prowadzącego) ostatnia przeczytana wiadomość — pod nią „przeczytane”. Telefon czyta
 * do chwili, więc wszystko wcześniej też jest przeczytane i drugi znacznik byłby szumem.
 */
export function lastReadOwn(list: readonly Message[]): Message | null {
  let out: Message | null = null;
  for (const m of list) if (m.author === 'coach' && m.readAt) out = m;
  return out;
}

/** Pierwsza nieprzeczytana od podopiecznego — nad nią kreska „nowe”, póki zakładka jest otwarta. */
export function firstUnread(list: readonly Message[]): string | null {
  return list.find((m) => m.author === 'client' && !m.readAt)?.id ?? null;
}

export const hasUnread = (list: readonly Message[]): boolean => list.some((m) => m.author === 'client' && !m.readAt);

/** Odniesienie z adresu („Skomentuj” przy treningu): `?sesja=<ISO>&nazwa=<nazwa>`. Zepsute — `null`. */
export function sessionRef(at: string | null, name: string | null): Extract<MessageRef, { kind: 'session' }> | null {
  if (!at || Number.isNaN(Date.parse(at))) return null;
  return { kind: 'session', at, label: (name ?? '').trim().slice(0, 120) };
}

export const refFromQuery = (q: URLSearchParams) => sessionRef(q.get('sesja'), q.get('nazwa'));

export const messagesHref = (cid: string): string => `/podopieczni/${encodeURIComponent(cid)}?t=messages`;

/** Rozmowa z podopiecznym z treningiem dołączonym jako odniesienie. */
export const commentHref = (cid: string, at: string, label: string): string =>
  `${messagesHref(cid)}&sesja=${encodeURIComponent(at)}&nazwa=${encodeURIComponent(label.slice(0, 120))}`;

/** Licznik znaków pokazuje się dopiero blisko granicy. */
export const COUNTER_FROM = MESSAGE_MAX - 500;
export const nearLimit = (text: string): boolean => text.length >= COUNTER_FROM;

/* ── Nieprzeczytane przy zakładce ──────────────────────────────────────────────────── */

let counts: Record<string, number> = {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Świeże liczby z serwera. Błąd — zostają poprzednie: to tylko znaczek przy zakładce. */
export async function refreshUnread(): Promise<void> {
  try {
    counts = await unreadCounts();
    notify();
  } catch {
    /* następna próba za minutę */
  }
}

/** Rozmowa otwarta i przeczytana — znaczek gaśnie od razu, bez czekania na serwer. */
export function clearUnread(connectionId: string): void {
  if (!counts[connectionId]) return;
  counts = { ...counts, [connectionId]: 0 };
  notify();
}

/** Ile nieprzeczytanych od tego podopiecznego; odświeża się co minutę na widocznej karcie. */
export function useUnreadCount(connectionId: string): number {
  const n = useSyncExternalStore(subscribe, () => counts[connectionId] ?? 0);
  useEffect(() => {
    void refreshUnread();
    const t = window.setInterval(() => {
      if (visible()) void refreshUnread();
    }, UNREAD_POLL_MS);
    return () => window.clearInterval(t);
  }, [connectionId]);
  return n;
}
