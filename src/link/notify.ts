import { AAD, newToken, notifyRef, sealJson } from '@gymtracker/link';
import type { NotifySealV1 } from '@gymtracker/link';
import { API_URL } from '../api';
import { LANG } from '../i18n';
import { deviceSubscription, deviceTimeZone, dropCoachSubscription, hasPush, pushConfigured, pushEnv, pushStateOf, subscriptionEpoch } from '../push';
import type { AppState } from '../types';
import { linkConfigured } from './config';
import { LATER_KEY, changeNotifyMemo, notifyMemo } from './notifyMemo';
import { askCoachPermission } from './permission';
import { clientSetNotify, isRpcError } from './rpc';
import type { Booking } from './rpc';
import { activeConnections, connectionOf, linkState, updateLink } from './store';
import type { LinkConnection } from './store';
import { keyFor } from './sync';

/**
 * Powiadomienia push od prowadzącego (spec 2026-11-25 „powiadomienia”).
 *
 * Jedna subskrypcja push urządzenia (ten sam klucz VAPID co przypomnienia, `src/push.ts`) — na serwerze
 * aplikacji GYM TRACKERa. Dla każdej trwającej współpracy telefon losuje token powiadomień, rejestruje go
 * tam (`POST /link/register` z subskrypcją, strefą i językiem) i podaje Sztabowi (`clientSetNotify`) —
 * zapieczętowany kluczem współpracy (`AAD.notify`), więc baza Sztabu go nie zna, zna go tylko przeglądarka
 * prowadzącego. Sztab woła potem serwer tym tokenem i rodzajem zdarzenia; treści serwer nie zna.
 * Zaplanowane (przypomnienie o wizycie) mają numer `notifyRef(token, numer rezerwacji)` — serwer nie
 * dostaje numerów z bazy Sztabu, a telefon i Sztab liczą ten sam i mogą odwołać to samo.
 *
 * Żadna funkcja nie rzuca — powiadomienia to dodatek. Moduł ciągnie za sobą `rpc.ts` (rozmowa ze Sztabem)
 * i klucze współpracy, więc z głównej paczki (ekran Dziś) wczytuje się go leniwie, `import('../link/notify')`;
 * pytanie o zgodę (`permission.ts`) i pamięć urządzenia (`notifyMemo.ts`) leżą osobno.
 */

export type CoachPushState = 'unconfigured' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

/** Rejestracja odświeżana co tyle — serwer kasuje subskrypcje, które długo się nie odzywają. */
export const REGISTER_EVERY_MS = 5 * 86_400_000;

/** Przypomnienie o wizycie zarezerwowanej na telefonie: tyle przed jej początkiem. */
export const VISIT_SOON_MS = 2 * 3_600_000;

const configured = (): boolean => pushConfigured() && linkConfigured();

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
    changeNotifyMemo((m) => {
      m.ep[token] = mark;
    });
  return r;
}

/** Token wyłączony: urządzenie go zapomina, a gdy serwer nie odpowiedział (`offline`), czeka w `drop`. */
const forget = (token: string, r: Reply): void =>
  changeNotifyMemo((m) => {
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

/* ── Sztab ─────────────────────────────────────────────────────────────────────────── */

/**
 * Token powiadomień (albo `null`) do Sztabu — zapieczętowany kluczem współpracy (`AAD.notify`), bo kolumna
 * w bazie przyjmuje tylko szyfrogram. `ended` — współpracy już nie ma; synchronizacja to zapisze.
 */
async function tellSztab(c: LinkConnection, notify: string | null): Promise<'ok' | 'offline' | 'ended'> {
  if (c.status !== 'active' || !c.token) return 'ended';
  try {
    const seal: NotifySealV1 | null = notify === null ? null : { v: 1, token: notify };
    const sealed = seal === null ? null : await sealJson(await keyFor(c), AAD.notify(c.id), seal);
    await clientSetNotify(c.id, c.token, sealed);
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

/* ── Zaległe ───────────────────────────────────────────────────────────────────────── */

/**
 * Zaległe wyrejestrowania i odwołania na serwerze aplikacji oraz tokeny, które Sztab wciąż trzyma po
 * wyłączeniu. Synchronizacja woła to zawsze (`syncAll`) — także bez żadnej współpracy z powiadomieniami,
 * bo po „Usuń wszystkie dane” zostaje tylko ta pamięć. Pusta pamięć — bez zapytań. `offline` — któryś
 * serwer nie odpowiedział; reszta czeka na następny raz.
 */
export async function flushCoachPush(): Promise<'ok' | 'offline'> {
  try {
    const { drop, cancel, unset } = notifyMemo();
    let offline = false;
    if (pushConfigured()) {
      for (const token of drop) {
        if ((await unregister(token)) !== 'offline') continue;
        offline = true;
        break;
      }
      for (const x of offline ? [] : cancel) {
        if ((await worker('/link/cancel', { token: x.token, ref: x.ref })) === 'offline') {
          offline = true;
          break;
        }
        changeNotifyMemo((m) => {
          m.cancel = m.cancel.filter((y) => !(y.token === x.token && y.ref === x.ref));
        });
      }
    }
    if (linkConfigured())
      for (const id of unset) {
        const c = connectionOf(linkState(), id);
        // Włączone znów (nowy token pójdzie przy synchronizacji) albo koniec współpracy (Sztab skasował token
        // sam) — nie ma czego kasować.
        const told = !c || c.notify || c.status !== 'active' || !c.token ? 'ended' : await tellSztab(c, null);
        if (told === 'offline') {
          offline = true;
          break;
        }
        changeNotifyMemo((m) => {
          m.unset = m.unset.filter((x) => x !== id);
        });
      }
    return offline ? 'offline' : 'ok';
  } catch {
    return 'offline';
  }
}

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

/* ── Włączanie i wyłączanie ────────────────────────────────────────────────────────── */

/** Włączanie w toku, po współpracy — jedno naraz. */
const enabling = new Map<string, Promise<CoachPushState>>();

/**
 * Włącza powiadomienia od prowadzącego tej współpracy (pyta o zgodę przeglądarki, gdy trzeba): subskrypcja
 * urządzenia, rejestracja tokenu na serwerze aplikacji, token do Sztabu. Sztab bez sieci — zapisane
 * z `sztab: false`, synchronizacja dośle. `state` — jak w przypomnieniach (`enablePush`); niepotrzebny.
 *
 * Drugie wywołanie dla tej samej współpracy w trakcie pierwszego (przyjęcie zaproszenia i stuknięcie
 * w karcie na ekranie Dziś) dostaje wynik pierwszego — inaczej powstałyby dwa tokeny, a Sztab i telefon
 * mogłyby zapamiętać różne.
 */
export function enableCoachPush(connectionId: string, state: AppState): Promise<CoachPushState> {
  void state;
  const running = enabling.get(connectionId);
  if (running) return running;
  // Pierwsze, przed jakimkolwiek `await` — inaczej stuknięcie przestaje się liczyć jako gest.
  const asking = askCoachPermission();
  const p = enableNow(connectionId, asking).finally(() => enabling.delete(connectionId));
  enabling.set(connectionId, p);
  return p;
}

async function enableNow(connectionId: string, asking: Promise<NotificationPermission> | null): Promise<CoachPushState> {
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
    // Wyłączenie, którego Sztab jeszcze nie dostał, jest już nieaktualne — dostanie nowy token.
    changeNotifyMemo((m) => {
      m.unset = m.unset.filter((x) => x !== connectionId);
    });
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
 * przed wyłączeniem); bez jednego z nich jego część czeka w pamięci urządzenia na następną synchronizację —
 * także Sztab, który inaczej dalej mówiłby prowadzącemu „powiadomienia włączone”.
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
    if (told === 'offline')
      changeNotifyMemo((m) => {
        if (!m.unset.includes(connectionId)) m.unset.push(connectionId);
      });
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
    if ((await flushCoachPush()) === 'offline') return 'offline';
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
    if (now - n.registeredAt < REGISTER_EVERY_MS && notifyMemo().ep[n.token] === subMark(sub)) return 'ok';
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

/**
 * „Usuń wszystkie dane”, przed zakończeniem współprac (koniec kasuje token w Sztabie) i `clearLink`: serwer
 * aplikacji zapomina tokeny wszystkich współprac. Bez sieci wyrejestrowania czekają w pamięci urządzenia
 * (`drop`), którą reset zostawia, i idą przy następnej synchronizacji. Reszta (subskrypcje tokenów, odwołania
 * wizyt, wyłączenia dla Sztabu, „Nie teraz”) znika. Subskrypcja trzymana tylko dla prowadzących (przypomnienia
 * wyłączone) — wypisana z serwera i z przeglądarki.
 */
export async function forgetCoachPush(): Promise<void> {
  let left: string[] = [];
  try {
    if (pushConfigured()) {
      const tokens = new Set([...notifyMemo().drop, ...linkState().connections.flatMap((c) => (c.notify ? [c.notify.token] : []))]);
      let offline = false;
      for (const token of tokens) {
        // Bez sieci reszta nawet nie próbuje — poczeka razem.
        if (!offline && (await worker('/link/unregister', { token })) === 'offline') offline = true;
        if (offline) left.push(token);
      }
    }
  } catch {
    left = notifyMemo().drop;
  }
  changeNotifyMemo((m) => {
    m.ep = {};
    m.cancel = [];
    m.unset = [];
    m.drop = left;
  });
  try {
    localStorage.removeItem(LATER_KEY);
  } catch {
    /* nic do skasowania */
  }
  updateLink((s) => {
    for (const c of s.connections) delete c.notify;
  });
  if (pushConfigured()) await dropCoachSubscription();
}

/* ── Przypomnienia o wizytach ──────────────────────────────────────────────────────── */

/**
 * Wizyta zarezerwowana na telefonie: powiadomienie 2 godziny przed nią, z kolejki serwera aplikacji
 * (`ref` — `notifyRef(token, numer rezerwacji)`, po nim odwołanie). Tylko przy włączonych powiadomieniach
 * i gdy ta chwila jeszcze nie minęła. `true` — serwer przyjął.
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
    const token = c.notify.token;
    // `at` w milisekundach, jak w Sztabie — serwer aplikacji przyjmuje tylko liczbę.
    return (await worker('/link/notify', { token, kind: 'visit-soon', at: Math.round(at), ref: await notifyRef(token, booking.id) })) === 'ok';
  } catch {
    return false;
  }
}

/** Odwołana wizyta: przypomnienie z kolejki znika. Bez sieci — przy następnej synchronizacji. */
export async function cancelVisitReminder(connectionId: string, bookingId: string): Promise<boolean> {
  try {
    const n = connectionOf(linkState(), connectionId)?.notify;
    if (!pushConfigured() || !n) return false;
    const ref = await notifyRef(n.token, bookingId);
    const r = await worker('/link/cancel', { token: n.token, ref });
    if (r === 'offline')
      changeNotifyMemo((m) => {
        m.cancel.push({ token: n.token, ref });
      });
    return r === 'ok';
  } catch {
    return false;
  }
}

/**
 * Wizyty świeżo ze Sztabu (`refreshVisits` w synchronizacji, strona wizyt): rezerwacja, która była, a teraz
 * jest odwołana przez prowadzącego albo zniknęła, nie dostaje już przypomnienia. Sztab przy odwołaniu kasuje
 * je sam (ten sam `ref`), ale wysyła i zapomina — to druga linia. Odwołanej na telefonie
 * (`cancelledBy: 'client'`) przypomnienie odwołało już `cancelVisitReminder`. Tylko te, które jeszcze czekają.
 */
export async function dropGoneVisitReminders(
  connectionId: string,
  before: readonly Booking[],
  after: readonly Booking[],
  now: number = Date.now(),
): Promise<void> {
  try {
    if (!pushConfigured() || !connectionOf(linkState(), connectionId)?.notify) return;
    const fresh = new Map(after.map((b) => [b.id, b]));
    for (const b of before) {
      if (b.cancelledAt || !(Date.parse(b.startsAt) - VISIT_SOON_MS > now)) continue;
      const a = fresh.get(b.id);
      if (a && (!a.cancelledAt || a.cancelledBy === 'client')) continue;
      await cancelVisitReminder(connectionId, b.id);
    }
  } catch {
    /* Po cichu — Sztab odwołał swoje, a przypomnienie o odwołanej wizycie to najwyżej zbędne powiadomienie. */
  }
}
