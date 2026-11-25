import type { Booking, Slot } from './rpc';
import type { LinkConnection, LinkState } from './store';

/**
 * Wizyty u prowadzącego bez sieci i bez Reacta: co pokazać w „Twoich wizytach”, jakie terminy są
 * wolne (po dniach) i która wizyta jest w ciągu doby — dla uwagi na ekranie Dziś, z kopii zapisanej
 * przy ostatnim pobraniu (`LinkConnection.visits`).
 *
 * Moduł bez zależności (same typy), bo czyta go też główna paczka (`LinkEntry.tsx`).
 */

/** Najwięcej zaplanowanych wizyt naraz u jednego prowadzącego — ten sam limit co w `client_book`. */
export const VISIT_LIMIT = 10;
/** Uwaga na ekranie Dziś: wizyta zaczyna się najpóźniej za tyle. */
export const SOON_MS = 24 * 3_600_000;

const at = (iso: string): number => Date.parse(iso);

const pad = (n: number): string => String(n).padStart(2, '0');

/** Dzień w czasie telefonu: `2026-11-25`. */
export const localDay = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Link do rozmowy wideo — tylko pełny adres `https://` bez spacji; inaczej `null` (to adres sali). */
export function videoLink(place: string | null | undefined): string | null {
  const p = place?.trim();
  if (!p || !/^https:\/\/\S+$/i.test(p)) return null;
  try {
    const u = new URL(p);
    return u.protocol === 'https:' && u.hostname.includes('.') ? p : null;
  } catch {
    return null;
  }
}

/**
 * Rezerwacje do pokazania: nadchodzące i trwające (od najbliższej) oraz minione — serwer oddaje
 * 14 dni wstecz — od najświeższej. Odwołana przez nas rezerwacja terminu, na który zapisaliśmy się
 * ponownie, odpada: to ta sama wizyta.
 */
export function splitBookings(list: readonly Booking[], now: number): { upcoming: Booking[]; past: Booking[] } {
  const live = new Set(list.filter((b) => !b.cancelledAt).map((b) => b.slotId));
  const shown = list.filter((b) => !b.cancelledAt || !live.has(b.slotId));
  // Kilka odwołanych na ten sam termin (zapis, odwołanie, zapis, odwołanie) — wystarczy jedna.
  const seen = new Set<string>();
  const unique = shown
    .slice()
    .sort((a, b) => (b.cancelledAt ?? '').localeCompare(a.cancelledAt ?? ''))
    .filter((b) => (seen.has(b.slotId) ? false : (seen.add(b.slotId), true)));
  return {
    upcoming: unique.filter((b) => at(b.endsAt) > now).sort((a, b) => at(a.startsAt) - at(b.startsAt)),
    past: unique.filter((b) => at(b.endsAt) <= now).sort((a, b) => at(b.startsAt) - at(a.startsAt)),
  };
}

/** Wizyty zaplanowane: nieodwołane i jeszcze się nie zaczęły — tyle liczy limit serwera. */
export const plannedCount = (list: readonly Booking[], now: number): number => list.filter((b) => !b.cancelledAt && at(b.startsAt) > now).length;

export interface SlotDay {
  /** `RRRR-MM-DD` w czasie telefonu. */
  day: string;
  slots: Slot[];
}

/** Terminy do rezerwacji po dniach, od najbliższego — bez minionych i bez tych, na które już jesteś zapisany. */
export function slotDays(slots: readonly Slot[], bookings: readonly Booking[], now: number): SlotDay[] {
  const mine = new Set(bookings.filter((b) => !b.cancelledAt).map((b) => b.slotId));
  const out: SlotDay[] = [];
  for (const s of [...slots].sort((a, b) => at(a.startsAt) - at(b.startsAt))) {
    if (mine.has(s.id) || at(s.startsAt) <= now) continue;
    const day = localDay(at(s.startsAt));
    const last = out.at(-1);
    if (last?.day === day) last.slots.push(s);
    else out.push({ day, slots: [s] });
  }
  return out;
}

/** Wolne miejsca w terminie (nigdy mniej niż zero — prowadzący może zapisać ponad limit). */
export const freeSeats = (s: Slot): number => Math.max(0, s.capacity - s.taken);

export interface SoonVisit {
  connection: LinkConnection;
  booking: Booking;
  /** Zaczyna się jutro (w czasie telefonu), a nie dziś. */
  tomorrow: boolean;
}

/** Najbliższa nieodwołana wizyta w ciągu doby u trwającej współpracy — z zapisanej kopii, bez sieci. */
export function soonVisit(s: LinkState, now: number): SoonVisit | null {
  let best: SoonVisit | null = null;
  for (const c of s.connections) {
    if (c.status !== 'active' || !c.visits) continue;
    for (const b of c.visits.bookings) {
      const start = at(b.startsAt);
      if (b.cancelledAt || !(start > now) || start - now > SOON_MS) continue;
      if (!best || start < at(best.booking.startsAt)) best = { connection: c, booking: b, tomorrow: localDay(start) !== localDay(now) };
    }
  }
  return best;
}
