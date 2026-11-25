import { newToken } from '@gymtracker/link';
import { API_URL } from '../api';
import { LANG } from '../i18n';
import { deviceSubscription, deviceTimeZone, hasPush, isIos, isStandalone, pushConfigured, pushEnv, pushStateOf, subscriptionEpoch } from '../push';
import type { AppState } from '../types';
import { linkConfigured } from './config';
import { clientSetNotify, isRpcError } from './rpc';
import type { Booking } from './rpc';
import { activeConnections, connectionOf, linkState, updateLink } from './store';
import type { LinkConnection } from './store';

/**
 * Powiadomienia push od prowadzącego (spec 2026-11-25 „powiadomienia”).
 *
 * Jedna subskrypcja push urządzenia (ten sam klucz VAPID co przypomnienia, `src/push.ts`) — na serwerze
 * aplikacji GYM TRACKERa. Dla każdej trwającej współpracy telefon losuje token powiadomień, rejestruje go
 * tam (`POST /link/register` z subskrypcją, strefą i językiem) i podaje Sztabowi (`clientSetNotify`).
 * Sztab woła potem serwer tym tokenem i rodzajem zdarzenia; treści serwer nie zna.
 *
 * Żadna funkcja nie rzuca — powiadomienia to dodatek. Moduł ciągnie za sobą `rpc.ts` (rozmowa ze Sztabem),
 * więc z głównej paczki (ekran Dziś) najlepiej wczytywać go leniwie, `import('../link/notify')`.
 */

export type CoachPushState = 'unconfigured' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

/** Rejestracja odświeżana co tyle — serwer kasuje subskrypcje, które długo się nie odzywają. */
export const REGISTER_EVERY_MS = 5 * 86_400_000;

/** Przypomnienie o wizycie zarezerwowanej na telefonie: tyle przed jej początkiem. */
export const VISIT_SOON_MS = 2 * 3_600_000;

const configured = (): boolean => pushConfigured() && linkConfigured();

/* ── Pamięć urządzenia ─────────────────────────────────────────────────────────────── */

/**
 * Co wie tylko to urządzenie (poza zapisem współprac, bo dotyczy subskrypcji, nie współpracy):
 * - `ep` — subskrypcja, z którą token ostatnio się zarejestrował: numer kolejnej subskrypcji urządzenia
 *   (`subscriptionEpoch`) i jej adres. Inna — rejestracja od nowa, bo serwer mógł ją skasować razem z tokenami
 *   (wypisanie, 404/410 z usługi powiadomień), a nowa subskrypcja tokenów jeszcze nie zna;
 * - `drop` — tokeny wyłączone bez sieci, których serwer aplikacji jeszcze nie zapomniał;
 * - `cancel` — odwołane wizyty, których przypomnienie wciąż czeka w kolejce serwera.
 */
interface Memo {
  ep: Record<string, string>;
  drop: string[];
  cancel: { token: string; ref: string }[];
}

const MEMO_KEY = 'gt-coach-push';

function memo(): Memo {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMO_KEY) ?? 'null') as Partial<Memo> | null;
    const ep: Record<string, string> = {};
    if (raw?.ep && typeof raw.ep === 'object') for (const [k, v] of Object.entries(raw.ep)) if (typeof v === 'string') ep[k] = v;
    return {
      ep,
      drop: Array.isArray(raw?.drop) ? raw.drop.filter((t): t is string => typeof t === 'string') : [],
      cancel: Array.isArray(raw?.cancel)
        ? raw.cancel.filter((x): x is Memo['cancel'][number] => !!x && typeof x.token === 'string' && typeof x.ref === 'string')
        : [],
    };
  } catch {
    return { ep: {}, drop: [], cancel: [] };
  }
}

function changeMemo(f: (m: Memo) => void): void {
  const m = memo();
  f(m);
  try {
    localStorage.setItem(MEMO_KEY, JSON.stringify(m));
  } catch {
    /* Bez pamięci strony: rejestracja pójdzie przy następnej synchronizacji jeszcze raz. */
  }
}

/* ── Serwer aplikacji ──────────────────────────────────────────────────────────────── */

type Reply = 'ok' | 'offline' | 'refused';

/** `POST` do serwera aplikacji. `refused` — odrzucił to, co dostał (4xx), ponawianie nic nie da. */
async function worker(path: string, body: Record<string, unknown>): Promise<Reply> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return 'ok';
    return res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429 ? 'refused' : 'offline';
  } catch {
    return 'offline';
  }
}

/** Odcisk subskrypcji urządzenia do porównania z tym, z którym token się rejestrował. */
const subMark = (sub: PushSubscription): string => `${subscriptionEpoch()}|${sub.endpoint}`;

async function register(token: string, sub: PushSubscription): Promise<Reply> {
  const mark = subMark(sub);
  const r = await worker('/link/register', { token, subscription: sub.toJSON(), tz: deviceTimeZone(), lang: LANG });
  if (r === 'ok')
    changeMemo((m) => {
      m.ep[token] = mark;
    });
  return r;
}

/** Token wyłączony: urządzenie go zapomina, a gdy serwer nie odpowiedział (`offline`), czeka w `drop`. */
const forget = (token: string, r: Reply): void =>
  changeMemo((m) => {
    delete m.ep[token];
    m.drop = m.drop.filter((t) => t !== token);
    if (r === 'offline') m.drop.push(token);
    else m.cancel = m.cancel.filter((x) => x.token !== token);
  });

async function unregister(token: string): Promise<Reply> {
  const r = await worker('/link/unregister', { token });
  forget(token, r);
  return r;
}

/** Zaległe wyrejestrowania i odwołania. */
async function flush(): Promise<'ok' | 'offline'> {
  const { drop, cancel } = memo();
  for (const token of drop) if ((await unregister(token)) === 'offline') return 'offline';
  for (const x of cancel) {
    const r = await worker('/link/cancel', { token: x.token, ref: x.ref });
    if (r === 'offline') return 'offline';
    changeMemo((m) => {
      m.cancel = m.cancel.filter((y) => !(y.token === x.token && y.ref === x.ref));
    });
  }
  return 'ok';
}

/* ── Sztab ─────────────────────────────────────────────────────────────────────────── */

/** Token powiadomień (albo `null`) do Sztabu. `ended` — współpracy już nie ma; synchronizacja to zapisze. */
async function tellSztab(c: LinkConnection, notify: string | null): Promise<'ok' | 'offline' | 'ended'> {
  if (c.status !== 'active' || !c.token) return 'ended';
  try {
    await clientSetNotify(c.id, c.token, notify);
    return 'ok';
  } catch (e) {
    return isRpcError(e, 'ended') || isRpcError(e, 'bad_token') ? 'ended' : 'offline';
  }
}

const setNotify = (id: string, notify: LinkConnection['notify'] | undefined): void => {
  updateLink((s) => {
    const x = s.connections.find((y) => y.id === id);
    if (!x) return;
    if (notify) x.notify = notify;
    else delete x.notify;
  });
};

/* ── Stan ──────────────────────────────────────────────────────────────────────────── */

/** Stan urządzenia, gdy nie pozwala włączyć powiadomień; `null` — pozwala. */
async function blocked(): Promise<CoachPushState | null> {
  if (!configured()) return 'unconfigured';
  const st = pushStateOf({ ...(await pushEnv()), subscribed: true });
  // Bez service workera (tryb deweloperski) — dla podopiecznego to po prostu „ta przeglądarka nie umie”.
  if (st === 'no-worker') return 'unsupported';
  return st === 'on' || st === 'off' ? null : st;
}

/** Stan dla jednej współpracy (albo ogólnie, bez `connectionId` — „włączone”, gdy dla którejkolwiek). */
export async function coachPushState(connectionId?: string): Promise<CoachPushState> {
  try {
    const gate = await blocked();
    if (gate) return gate;
    const s = linkState();
    const c = connectionId === undefined ? undefined : connectionOf(s, connectionId);
    const on = connectionId === undefined ? activeConnections(s).some((x) => !!x.notify) : c?.status === 'active' && !!c.notify;
    if (!on || Notification.permission !== 'granted') return 'off';
    return (await deviceSubscription()) ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/**
 * Pytanie o zgodę przeglądarki — wołane wprost w stuknięciu, zanim cokolwiek na coś poczeka: przeglądarki
 * (Safari najostrzej) pytają tylko w geście użytkownika. `null` — nie ma o co pytać (odpowiedź już jest
 * albo powiadomień tu nie będzie).
 */
export function askCoachPermission(): Promise<NotificationPermission> | null {
  try {
    if (!configured() || !hasPush() || (isIos() && !isStandalone()) || Notification.permission !== 'default') return null;
    return Promise.resolve(Notification.requestPermission()).then(
      () => Notification.permission,
      () => Notification.permission,
    );
  } catch {
    return null;
  }
}

/* ── Włączanie i wyłączanie ────────────────────────────────────────────────────────── */

/**
 * Włącza powiadomienia od prowadzącego tej współpracy (pyta o zgodę przeglądarki, gdy trzeba): subskrypcja
 * urządzenia, rejestracja tokenu na serwerze aplikacji, token do Sztabu. Sztab bez sieci — zapisane
 * z `sztab: false`, synchronizacja dośle. `state` — jak w przypomnieniach (`enablePush`); niepotrzebny.
 */
export async function enableCoachPush(connectionId: string, state: AppState): Promise<CoachPushState> {
  void state;
  // Pierwsze, przed jakimkolwiek `await` — inaczej stuknięcie przestaje się liczyć jako gest.
  const asking = askCoachPermission();
  try {
    if (asking) await asking;
    const gate = await blocked();
    if (gate) return gate;
    const c = connectionOf(linkState(), connectionId);
    if (Notification.permission !== 'granted' || c?.status !== 'active' || !c.token) return 'off';
    const sub = await deviceSubscription(true);
    if (!sub) return 'off';
    const fresh = !c.notify;
    const token = c.notify?.token ?? newToken();
    if ((await register(token, sub)) !== 'ok') return coachPushState(connectionId);
    const told = await tellSztab(c, token);
    if (told === 'ended') {
      await unregister(token);
      return 'off';
    }
    setNotify(connectionId, { token, registeredAt: Date.now(), sztab: told === 'ok' });
    // Nowy token: wizyty zarezerwowane wcześniej dostają przypomnienie teraz (prowadzący tego tokenu nie znał).
    if (fresh) for (const b of c.visits?.bookings ?? []) if (!b.cancelledAt) await scheduleVisitReminder(connectionId, b);
    return coachPushState(connectionId);
  } catch {
    return 'off';
  }
}

/**
 * Wyłącza je: kasuje token na serwerze aplikacji i w Sztabie. Wystarczy jedno z dwóch — serwer bez tokenu
 * nic nie wyśle, a Sztab bez tokenu nie ma czym wołać. Bez sieci do obu nic się nie zmienia (wynik jak
 * przed wyłączeniem); bez serwera aplikacji wyrejestrowanie czeka na następną synchronizację.
 */
export async function disableCoachPush(connectionId: string): Promise<CoachPushState> {
  try {
    const c = connectionOf(linkState(), connectionId);
    const n = c?.notify;
    if (!c || !n) return coachPushState(connectionId);
    const r = pushConfigured() ? await worker('/link/unregister', { token: n.token }) : 'refused';
    const told = linkConfigured() ? await tellSztab(c, null) : 'ended';
    if (r === 'offline' && told === 'offline') return coachPushState(connectionId);
    forget(n.token, r);
    setNotify(connectionId, undefined);
    return coachPushState(connectionId);
  } catch {
    return coachPushState(connectionId);
  }
}

/**
 * W synchronizacji: odświeża rejestrację (co kilka dni, żeby serwer nie skasował cichej subskrypcji, i po
 * zmianie subskrypcji urządzenia), ponawia to, co nie doszło do Sztabu, i sprząta po zakończonych
 * współpracach. `offline` — sieć nie odpowiada, synchronizacja kończy po cichu.
 */
export async function keepCoachPush(c: LinkConnection, now: number = Date.now()): Promise<'ok' | 'offline'> {
  try {
    if (!pushConfigured()) return 'ok';
    if ((await flush()) === 'offline') return 'offline';
    const x = connectionOf(linkState(), c.id) ?? c;
    const n = x.notify;
    if (!n) return 'ok';
    if (x.status !== 'active' || !x.token) {
      // Koniec współpracy: Sztab skasował token u siebie, serwer aplikacji jeszcze go zna.
      const r = await worker('/link/unregister', { token: n.token });
      if (r === 'offline') return 'offline';
      forget(n.token, r);
      setNotify(x.id, undefined);
      return 'ok';
    }
    if (!n.sztab && linkConfigured()) {
      const told = await tellSztab(x, n.token);
      if (told === 'offline') return 'offline';
      // `ended` — odbiór zapisze koniec współpracy, a następna synchronizacja posprząta.
      if (told === 'ended') return 'ok';
      setNotify(x.id, { ...n, sztab: true });
    }
    if (!hasPush() || Notification.permission !== 'granted') return 'ok';
    const sub = await deviceSubscription(true);
    if (!sub) return 'ok';
    if (now - n.registeredAt < REGISTER_EVERY_MS && memo().ep[n.token] === subMark(sub)) return 'ok';
    const r = await register(n.token, sub);
    if (r === 'offline') return 'offline';
    if (r === 'ok') {
      const cur = connectionOf(linkState(), x.id)?.notify;
      if (cur?.token === n.token) setNotify(x.id, { ...cur, registeredAt: now });
    }
    return 'ok';
  } catch {
    return 'offline';
  }
}

/* ── Przypomnienia o wizytach ──────────────────────────────────────────────────────── */

/**
 * Wizyta zarezerwowana na telefonie: powiadomienie 2 godziny przed nią, z kolejki serwera aplikacji
 * (`ref` — numer rezerwacji, po nim odwołanie). Tylko przy włączonych powiadomieniach i gdy ta chwila
 * jeszcze nie minęła. `true` — serwer przyjął.
 */
export async function scheduleVisitReminder(
  connectionId: string,
  booking: Pick<Booking, 'id' | 'startsAt'>,
  now: number = Date.now(),
): Promise<boolean> {
  try {
    const c = connectionOf(linkState(), connectionId);
    if (!configured() || c?.status !== 'active' || !c.notify) return false;
    const at = Date.parse(booking.startsAt) - VISIT_SOON_MS;
    if (!Number.isFinite(at) || at <= now) return false;
    // `at` w milisekundach, jak w Sztabie — serwer aplikacji przyjmuje tylko liczbę.
    return (await worker('/link/notify', { token: c.notify.token, kind: 'visit-soon', at: Math.round(at), ref: booking.id })) === 'ok';
  } catch {
    return false;
  }
}

/** Odwołana wizyta: przypomnienie z kolejki znika. Bez sieci — przy następnej synchronizacji. */
export async function cancelVisitReminder(connectionId: string, bookingId: string): Promise<boolean> {
  try {
    const n = connectionOf(linkState(), connectionId)?.notify;
    if (!pushConfigured() || !n) return false;
    const r = await worker('/link/cancel', { token: n.token, ref: bookingId });
    if (r === 'offline')
      changeMemo((m) => {
        m.cancel.push({ token: n.token, ref: bookingId });
      });
    return r === 'ok';
  } catch {
    return false;
  }
}
