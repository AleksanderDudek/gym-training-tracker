import { AAD, NOTIFY_TOKEN, cleanPublicJwk, notifyRef, openJson, parseNotifySeal } from '@gymtracker/link';
import type { PublicJwk } from '@gymtracker/link';
import { connectionKey } from './connectionKey';
import { TRACKER_API_URL } from './env';
import { sb } from './sb';

/**
 * Powiadomienia push do podopiecznego (spec 2026-11-25 „powiadomienia”).
 *
 * Przeglądarka prowadzącego woła serwer aplikacji GYM TRACKERa (`TRACKER_API_URL`, `POST /link/notify`)
 * tokenem powiadomień współpracy i samym rodzajem zdarzenia — bez treści, bez nazwisk, bez numeru
 * współpracy. Bez tokenu (podopieczny nie włączył powiadomień) albo bez adresu serwera — nic.
 * Zawsze po cichu: powiadomienie to dodatek, nie część wysyłki (błąd nie psuje wysłania zalecenia).
 *
 * **Token zapieczętowany.** Telefon podaje Sztabowi token zapieczętowany kluczem współpracy
 * (`connections.notify_token` = `sealJson(klucz, AAD.notify(współpraca), { v: 1, token })`): przejęta baza
 * nie wyśle nim powiadomień. Jawny token istnieje tylko tu, w chwili wysyłki — pieczęć otwiera klucz
 * prywatny z sejfu, który każda funkcja dostaje w argumencie (jak `sendAssignment` i `sendMessage` w
 * `data.ts`): bez stanu modułu, który trzeba by ustawiać przy otwarciu sejfu i czyścić przy wylogowaniu.
 *
 * **Świeży przy wysyłce.** Pieczęć czytamy z bazy w chwili wysyłki (`notify_token, invite_id,
 * client_public_key` jednej współpracy), a nie z listy wczytanej z ekranem: telefon mógł włączyć
 * powiadomienia, gdy strona była już otwarta — inaczej odwołana wizyta zostawiłaby jego przypomnienie
 * w kolejce. Wysyłki biorą pieczęć z krótkiej pamięci (`NOTIFY_CACHE_MS`), żeby wysyłka do grupy albo
 * program z dwudziestoma krokami nie pytały bazy przy każdym zaleceniu; odwołania i koniec współpracy
 * (`fresh`) czytają zawsze od nowa. Pamięć trzyma pieczęć, nie token.
 *
 * **Numery zaplanowanych.** Do serwera idzie `notifyRef(token, numer)` — HMAC numeru zalecenia albo
 * rezerwacji, nigdy numer z bazy Sztabu. Telefon liczy ten sam dla swoich przypomnień o wizycie, więc
 * Sztab odwoła także to, co zaplanował telefon.
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
  /**
   * Numer zalecenia albo rezerwacji, po którym zaplanowane da się odwołać (`Notifier.cancel`). Do serwera
   * idzie jego HMAC tokenem (`notifyRef`), nie on sam.
   */
  ref?: string;
}

/** Nadawca z otwartym tokenem jednej współpracy. Obie funkcje zawsze po cichu (nigdy nie odrzucają). */
export interface Notifier {
  notify(kind: NotifyKind, opts?: NotifyOpts): Promise<void>;
  /** Odwołanie zaplanowanego (wycofane zaplanowane zalecenie, odwołana wizyta) — numer jak w `NotifyOpts.ref`. */
  cancel(ref: string): Promise<void>;
}

/** Po tylu milisekundach zapytanie do serwera aplikacji się poddaje. */
export const NOTIFY_TIMEOUT_MS = 5000;

/** Tyle żyje pieczęć w pamięci dla wysyłek (odwołania czytają zawsze od nowa). */
export const NOTIFY_CACHE_MS = 30_000;

/** Kolumny współpracy, z których otwiera się token (RLS: tylko współprace tego prowadzącego). */
export const NOTIFY_COLUMNS = 'notify_token, invite_id, client_public_key';

/** Numer z bazy, z którego liczymy numer zaplanowanego (uuid zalecenia albo rezerwacji). */
const ID = /^[\w-]{1,64}$/;

/** Co ekran wie o współpracy z chwili wczytania: czy telefon zostawił pieczęć tokenu. */
type Notifiable = { notifySealed?: boolean };

/**
 * Czy podopieczny dostanie powiadomienie: włączył je w GYM TRACKERze (w bazie leży pieczęć tokenu),
 * a ten Sztab zna serwer aplikacji. Podpowiedź dla ekranu — sama wysyłka sprawdza bazę od nowa.
 */
export const canNotify = (c: Notifiable | null | undefined): boolean => !!TRACKER_API_URL && c?.notifySealed === true;

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

/** `at` i numer zaplanowanego sprawdzone przed czymkolwiek innym; `null` — nie wysyłać wcale. */
function checked(kind: NotifyKind, opts: NotifyOpts): { at?: number; ref?: string } | null {
  if (!KINDS.has(kind)) return null;
  const out: { at?: number; ref?: string } = {};
  if (opts.at !== undefined) {
    const at = opts.at instanceof Date ? opts.at.getTime() : NaN;
    // Zła data nie zamienia się w „od razu” — zaplanowane nie może przyjść przed czasem.
    if (!Number.isFinite(at)) return null;
    out.at = Math.round(at);
  }
  if (opts.ref !== undefined) {
    // Bez poprawnego numeru zaplanowanego nie dałoby się odwołać — lepiej nie wysyłać wcale.
    if (typeof opts.ref !== 'string' || !ID.test(opts.ref)) return null;
    out.ref = opts.ref;
  }
  return out;
}

/**
 * Nadawca z jawnym tokenem — tylko w chwili wysyłki (`notifierFor`) i w teście umowy z serwerem aplikacji.
 * Zły kształt tokenu — `null`.
 */
export function tokenNotifier(token: string): Notifier | null {
  if (typeof token !== 'string' || !NOTIFY_TOKEN.test(token)) return null;
  return {
    async notify(kind, opts = {}) {
      try {
        const p = checked(kind, opts);
        if (!p || !TRACKER_API_URL) return;
        const body: Record<string, unknown> = { token, kind };
        if (p.at !== undefined) body.at = p.at;
        if (p.ref !== undefined) body.ref = await notifyRef(token, p.ref);
        await post('/link/notify', body);
      } catch {
        // Po cichu — patrz wyżej.
      }
    },
    async cancel(ref) {
      try {
        if (typeof ref !== 'string' || !ID.test(ref) || !TRACKER_API_URL) return;
        await post('/link/cancel', { token, ref: await notifyRef(token, ref) });
      } catch {
        // Po cichu — patrz wyżej.
      }
    },
  };
}

/* ── Pieczęć z bazy ──────────────────────────────────────────────────────────────── */

interface Seal {
  sealed: string;
  clientKey: PublicJwk;
  inviteId: string;
}

const seals = new Map<string, { at: number; seal: Promise<Seal | null> }>();

async function readSeal(connectionId: string): Promise<Seal | null> {
  const { data, error } = await sb.from('connections').select(NOTIFY_COLUMNS).eq('id', connectionId).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { notify_token?: unknown; invite_id?: unknown; client_public_key?: unknown } | null;
  const sealed = row?.notify_token;
  if (typeof sealed !== 'string' || !sealed.startsWith('v1.')) return null;
  const clientKey = cleanPublicJwk(row?.client_public_key);
  if (!clientKey || typeof row?.invite_id !== 'string') return null;
  return { sealed, clientKey, inviteId: row.invite_id };
}

function sealOf(connectionId: string, fresh: boolean): Promise<Seal | null> {
  const now = Date.now();
  const hit = seals.get(connectionId);
  if (!fresh && hit && now - hit.at < NOTIFY_CACHE_MS) return hit.seal;
  const seal = readSeal(connectionId);
  seals.set(connectionId, { at: now, seal });
  // Błąd odczytu nie zostaje w pamięci — następna wysyłka spyta bazę znowu.
  seal.catch(() => {
    if (seals.get(connectionId)?.seal === seal) seals.delete(connectionId);
  });
  return seal;
}

/** Zapomina pieczęcie z pamięci: jednej współpracy (po jej końcu) albo wszystkie (wylogowanie). */
export function forgetNotify(connectionId?: string): void {
  if (connectionId === undefined) seals.clear();
  else seals.delete(connectionId);
}

/**
 * Nadawca dla współpracy: pieczęć z bazy (`fresh` — z pominięciem pamięci) otwarta kluczem z sejfu.
 * `null`, gdy podopieczny nie włączył powiadomień, Sztab nie zna serwera aplikacji, pieczęć się nie
 * otwiera (podmieniona, z innej współpracy, z innego sejfu) albo baza nie odpowiedziała. Nigdy nie odrzuca.
 */
export async function notifierFor(privateKey: CryptoKey, connectionId: string, opts: { fresh?: boolean } = {}): Promise<Notifier | null> {
  try {
    if (!TRACKER_API_URL) return null;
    const s = await sealOf(connectionId, opts.fresh === true);
    if (!s) return null;
    const key = await connectionKey(privateKey, { id: connectionId, clientKey: s.clientKey, inviteId: s.inviteId });
    const token = parseNotifySeal(await openJson(key, AAD.notify(connectionId), s.sealed));
    return token ? tokenNotifier(token) : null;
  } catch {
    return null;
  }
}

/* ── W tle ───────────────────────────────────────────────────────────────────────── */

const inflight = new Set<Promise<unknown>>();

function later(notifier: Promise<Notifier | null>, send: (n: Notifier) => Promise<void>[]): void {
  const p = notifier.then((n) => (n ? Promise.all(send(n)) : undefined)).catch(() => undefined);
  inflight.add(p);
  void p.finally(() => inflight.delete(p));
}

/**
 * Powiadomienia w tle: działanie, które je wywołało (wysyłka, zapis na wizytę), na nie nie czeka i nie
 * zawiedzie przez nie. `send` dostaje nadawcę tej współpracy — bez powiadomień włączonych nie jest wołane.
 */
export function notifyLater(
  privateKey: CryptoKey,
  connectionId: string,
  send: (n: Notifier) => Promise<void>[],
  opts: { fresh?: boolean } = {},
): void {
  if (TRACKER_API_URL) later(notifierFor(privateKey, connectionId, opts), send);
}

/** To samo nadawcą otwartym wcześniej (koniec współpracy: token sprzed funkcji bazy, która go kasuje). */
export function sendLater(n: Notifier, send: (n: Notifier) => Promise<void>[]): void {
  later(Promise.resolve(n), send);
}

/** Czeka, aż wyjdzie wszystko, co `notifyLater` zaczęło (testy). */
export async function notifyIdle(): Promise<void> {
  while (inflight.size) await Promise.allSettled([...inflight]);
}
