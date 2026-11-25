import { TRACKER_API_URL } from './env';

/**
 * Tyle współpracy, ile trzeba do powiadomienia — bez importu `data.ts`, żeby moduł dało się wczytać także
 * w teście umowy po stronie GYM TRACKERa (`src/link/notify.contract.test.ts`), który nie zna aliasów Sztabu.
 */
type Notifiable = { notifyToken?: string | null };

/**
 * Powiadomienia push do podopiecznego (spec 2026-11-25 „powiadomienia”).
 *
 * Przeglądarka prowadzącego woła serwer aplikacji GYM TRACKERa (`TRACKER_API_URL`, `POST /link/notify`)
 * tokenem powiadomień współpracy i samym rodzajem zdarzenia — bez treści, bez nazwisk, bez numeru
 * współpracy. Bez tokenu (podopieczny nie włączył powiadomień) albo bez adresu serwera — nic.
 * Zawsze po cichu: powiadomienie to dodatek, nie część wysyłki (błąd nie psuje wysłania zalecenia).
 *
 * Wysłane i zapomniane: krótki limit czasu, bez ponawiania (serwer zawsze odpowiada 204, więc nie ma czego
 * sprawdzać), `keepalive`, żeby zapytanie przeżyło przejście na inną stronę (koniec współpracy). Treść to
 * JSON, ale bez nagłówka `Content-Type: application/json` — przeglądarka wysyła ją jako `text/plain`,
 * czyli „proste” zapytanie CORS bez preflightu: jedno zapytanie zamiast dwóch i `keepalive` bez wyjątków
 * w przeglądarkach. Serwer czyta JSON z treści niezależnie od nagłówka.
 */

/** Rodzaje zdarzeń — ta sama lista co w serwerze (`server/api/link.ts`). */
export type NotifyKind = 'message' | 'assignment' | 'withdrawn' | 'visit' | 'visit-cancel' | 'visit-soon' | 'ended';

const KINDS: ReadonlySet<string> = new Set<NotifyKind>(['message', 'assignment', 'withdrawn', 'visit', 'visit-cancel', 'visit-soon', 'ended']);

export interface NotifyOpts {
  /** Kiedy (zaplanowane zalecenie, przypomnienie o wizycie); brak — od razu. */
  at?: Date;
  /** Numer, po którym zaplanowane da się odwołać (`cancelNotify`), np. numer zalecenia albo rezerwacji. */
  ref?: string;
}

/** Po tylu milisekundach zapytanie do serwera aplikacji się poddaje. */
export const NOTIFY_TIMEOUT_MS = 5000;

/** Ten sam kształt, który sprawdza baza (`connections.notify_token`): 32 bajty w base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const REF = /^[\w-]{1,64}$/;

const tokenOf = (c: Notifiable | null | undefined): string | null => {
  const t = c?.notifyToken;
  return typeof t === 'string' && TOKEN.test(t) ? t : null;
};

/** Czy podopieczny dostanie powiadomienie: włączył je w GYM TRACKERze, a ten Sztab zna serwer aplikacji. */
export const canNotify = (c: Notifiable | null | undefined): boolean => !!TRACKER_API_URL && tokenOf(c) !== null;

async function post(path: '/link/notify' | '/link/cancel', body: Record<string, unknown>): Promise<void> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), NOTIFY_TIMEOUT_MS);
  try {
    await fetch(`${TRACKER_API_URL}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      keepalive: true,
      signal: ctl.signal,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    // Sieć, limit czasu, CORS — powiadomienie przepada, wysyłka zostaje.
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyClient(c: Notifiable, kind: NotifyKind, opts: NotifyOpts = {}): Promise<void> {
  try {
    const token = tokenOf(c);
    if (!token || !TRACKER_API_URL || !KINDS.has(kind)) return;
    const body: Record<string, unknown> = { token, kind };
    if (opts.at !== undefined) {
      const at = opts.at instanceof Date ? opts.at.getTime() : NaN;
      // Zła data nie zamienia się w „od razu” — zaplanowane nie może przyjść przed czasem.
      if (!Number.isFinite(at)) return;
      body.at = Math.round(at);
    }
    if (opts.ref !== undefined) {
      // Bez poprawnego numeru zaplanowanego nie dałoby się odwołać — lepiej nie wysyłać wcale.
      if (typeof opts.ref !== 'string' || !REF.test(opts.ref)) return;
      body.ref = opts.ref;
    }
    await post('/link/notify', body);
  } catch {
    // Po cichu — patrz wyżej.
  }
}

/** Odwołanie zaplanowanego powiadomienia (wycofane zaplanowane zalecenie, odwołana wizyta). */
export async function cancelNotify(c: Notifiable, ref: string): Promise<void> {
  try {
    const token = tokenOf(c);
    if (!token || !TRACKER_API_URL || typeof ref !== 'string' || !REF.test(ref)) return;
    await post('/link/cancel', { token, ref });
  } catch {
    // Po cichu — patrz wyżej.
  }
}
