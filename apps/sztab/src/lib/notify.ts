import type { Connection } from './data';

/**
 * Powiadomienia push do podopiecznego (spec 2026-11-25 „powiadomienia”). Kontrakt rdzenia — wypełnia go
 * część „Sztab: powiadomienia”.
 *
 * Przeglądarka prowadzącego woła serwer aplikacji GYM TRACKERa (`TRACKER_API_URL`, `POST /link/notify`)
 * tokenem powiadomień współpracy i samym rodzajem zdarzenia — bez treści, bez nazwisk, bez numeru
 * współpracy. Bez tokenu (podopieczny nie włączył powiadomień) albo bez adresu serwera — nic.
 * Zawsze po cichu: powiadomienie to dodatek, nie część wysyłki (błąd nie psuje wysłania zalecenia).
 */

/** Rodzaje zdarzeń — ta sama lista co w serwerze (`server/api/link.ts`). */
export type NotifyKind = 'message' | 'assignment' | 'withdrawn' | 'visit' | 'visit-cancel' | 'visit-soon' | 'ended';

export interface NotifyOpts {
  /** Kiedy (zaplanowane zalecenie, przypomnienie o wizycie); brak — od razu. */
  at?: Date;
  /** Numer, po którym zaplanowane da się odwołać (`cancelNotify`), np. numer zalecenia albo rezerwacji. */
  ref?: string;
}

export async function notifyClient(c: Pick<Connection, 'notifyToken'>, kind: NotifyKind, opts: NotifyOpts = {}): Promise<void> {
  void c;
  void kind;
  void opts;
}

/** Odwołanie zaplanowanego powiadomienia (wycofane zaplanowane zalecenie, odwołana wizyta). */
export async function cancelNotify(c: Pick<Connection, 'notifyToken'>, ref: string): Promise<void> {
  void c;
  void ref;
}
