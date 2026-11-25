import { API_URL, apiConfigured } from './api';
import { localDay, reminderItems, remindersOf } from './engine/reminders';
import { hasDiet } from './food/dietFlag';
import { linkState } from './link/store';
import type { AppState } from './types';

/**
 * Przypomnienia na telefonie — warstwa przeglądarki: zgoda, subskrypcja Web Push i wysyłka
 * listy do serwera.
 *
 * Dlaczego serwer, skoro przypomnienia są „lokalne”: strona nie umie zaplanować powiadomienia
 * na 7:30. API, które miało to robić (Notification Triggers), wycofano z Chrome, a Safari
 * nigdy go nie miał; iOS usypia aplikację w tle, więc żaden zegar w JavaScripcie nie dotrwa
 * do rana. Działa tylko Web Push: o czasie powiadomienie wysyła serwer, a telefon je pokazuje
 * — także na iPhonie, od iOS 16.4, w aplikacji dodanej do ekranu początkowego.
 *
 * Adres serwera i jego klucz publiczny przychodzą z buildu (`VITE_API_URL`,
 * `VITE_VAPID_PUBLIC_KEY`). Bez nich aplikacja działa jak dotąd, a karty przypomnień nie ma.
 */

export const VAPID_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '');

export const pushConfigured = (): boolean => apiConfigured() && VAPID_KEY !== '';

/**
 * - `unconfigured` — build bez serwera przypomnień;
 * - `ios-install` — iPhone w karcie Safari: powiadomienia działają dopiero z ekranu początkowego;
 * - `unsupported` — przeglądarka bez Web Push;
 * - `no-worker` — brak service workera (tryb deweloperski albo zablokowany);
 * - `denied` — zgoda odebrana w ustawieniach;
 * - `off` / `on` — da się włączyć / włączone.
 */
export type PushState = 'unconfigured' | 'ios-install' | 'unsupported' | 'no-worker' | 'denied' | 'off' | 'on';

export interface PushEnv {
  configured: boolean;
  ios: boolean;
  standalone: boolean;
  hasPush: boolean;
  worker: boolean;
  permission: NotificationPermission | null;
  subscribed: boolean;
}

export function pushStateOf(e: PushEnv): PushState {
  if (!e.configured) return 'unconfigured';
  // Przed sprawdzeniem Web Push: Safari w zwykłej karcie nie ma `PushManager`, a wtedy
  // „przeglądarka nie obsługuje” byłoby nieprawdą — wystarczy dodać aplikację do ekranu.
  if (e.ios && !e.standalone) return 'ios-install';
  if (!e.hasPush) return 'unsupported';
  if (!e.worker) return 'no-worker';
  if (e.permission === 'denied') return 'denied';
  return e.subscribed && e.permission === 'granted' ? 'on' : 'off';
}

export const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS przedstawia się jak Mac — zdradza go ekran dotykowy.
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

export const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const hasPush = (): boolean => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  // `getRegistration`, nie `ready`: bez service workera `ready` czeka w nieskończoność.
  return hasPush() ? navigator.serviceWorker.getRegistration() : undefined;
}

/**
 * Subskrypcja push jest jedna na urządzenie (jeden klucz VAPID) i dzielą ją przypomnienia z powiadomieniami
 * od prowadzącego (`src/link/notify.ts`). Subskrypcja założona tylko dla prowadzącego zapisuje tu `off`:
 * inaczej przypomnienia (domyślnie rano i wieczorem) włączyłyby się przy okazji. Bez wpisu — jak zawsze:
 * subskrypcja znaczy włączone przypomnienia.
 */
const REMINDERS_KEY = 'gt-push-reminders';

const remindersOff = (): boolean => {
  try {
    return localStorage.getItem(REMINDERS_KEY) === 'off';
  } catch {
    return false;
  }
};

const setRemindersOff = (off: boolean) => {
  try {
    if (off) localStorage.setItem(REMINDERS_KEY, 'off');
    else localStorage.removeItem(REMINDERS_KEY);
  } catch {
    /* Bez pamięci strony zostaje stary zwyczaj: subskrypcja to przypomnienia. */
  }
};

/**
 * Czy subskrypcję trzyma któraś trwająca współpraca z powiadomieniami. Wtedy wyłączenie przypomnień nie wypisuje
 * jej z serwera (`/unsubscribe` kasuje tam subskrypcję razem z tokenami prowadzących i ich kolejką).
 */
const coachPushOn = (): boolean => linkState().connections.some((c) => c.status === 'active' && !!c.notify);

/**
 * Numer kolejnej subskrypcji urządzenia: rośnie przy każdej nowej (`subscribe`) i przy wypisaniu z serwera.
 * Powiadomienia od prowadzącego pamiętają go przy rejestracji tokenu i po zmianie rejestrują się od nowa —
 * także wtedy, gdy przeglądarka dała nowej subskrypcji ten sam adres.
 */
const EPOCH_KEY = 'gt-push-epoch';

export const subscriptionEpoch = (): number => {
  try {
    const n = Number(localStorage.getItem(EPOCH_KEY));
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};

const nextEpoch = (): void => {
  try {
    localStorage.setItem(EPOCH_KEY, String(subscriptionEpoch() + 1));
  } catch {
    /* Bez pamięci strony zostaje porównanie adresu subskrypcji. */
  }
};

/** Nowa subskrypcja urządzenia — z numerem kolejnej. */
const subscribeDevice = (reg: ServiceWorkerRegistration, key: Uint8Array<ArrayBuffer>): Promise<PushSubscription> => {
  nextEpoch();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
};

/** Urządzenie: wszystko oprócz tego, czyje są powiadomienia (`subscribed` — jakakolwiek subskrypcja). */
export async function pushEnv(): Promise<PushEnv> {
  const reg = pushConfigured() ? await registration().catch(() => undefined) : undefined;
  return {
    configured: pushConfigured(),
    ios: isIos(),
    standalone: isStandalone(),
    hasPush: hasPush(),
    worker: !!reg,
    permission: 'Notification' in window ? Notification.permission : null,
    subscribed: !!(await reg?.pushManager.getSubscription().catch(() => null)),
  };
}

export async function currentPushState(): Promise<PushState> {
  const env = await pushEnv();
  return pushStateOf({ ...env, subscribed: env.subscribed && !remindersOff() });
}

/** Klucz publiczny VAPID z base64url do bajtów, jak chce `pushManager.subscribe`. */
export function keyBytes(b64u: string): Uint8Array<ArrayBuffer> {
  const t = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array): boolean => {
  if (!a || a.byteLength !== b.length) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
};

/**
 * Subskrypcja push urządzenia dla powiadomień od prowadzącego — ta sama, którą mają przypomnienia. Bez
 * `create` tylko odczyt (`null`, gdy jej nie ma albo założono ją starym kluczem serwera); z `create` zakłada
 * ją, gdy trzeba. Zgoda przeglądarki musi już być. Nigdy nie rzuca.
 */
export async function deviceSubscription(create = false): Promise<PushSubscription | null> {
  if (!pushConfigured() || !hasPush() || Notification.permission !== 'granted') return null;
  try {
    const reg = await registration();
    if (!reg) return null;
    const key = keyBytes(VAPID_KEY);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
      if (!create) return null;
      // Stary klucz serwera: od nowa. Przypomnienia zostają, jakie były — ich lista pójdzie z nową subskrypcją.
      await sub.unsubscribe();
      sub = null;
    } else if (!sub) {
      if (!create) return null;
      // Nowa subskrypcja tylko dla prowadzącego: przypomnień nikt tu nie włączał.
      setRemindersOff(true);
    }
    return sub ?? (await subscribeDevice(reg, key));
  } catch {
    return null;
  }
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
  } catch {
    return 'Europe/Warsaw';
  }
}

/** Co i kiedy ostatnio poszło do serwera — żeby nie wysyłać tej samej listy przy każdym kliknięciu. */
const SYNC_KEY = 'gt-push-sync';

/** Wpis w `SYNC_KEY`: przypomnienia wyłączone, a pusta lista jeszcze nie doszła do serwera. */
const CLEAR = 'clear';

/** Krótki odcisk listy (djb2). Do porównania, nie do bezpieczeństwa. */
const fingerprint = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const remember = (v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(SYNC_KEY);
    else localStorage.setItem(SYNC_KEY, v);
  } catch {
    /* Bez pamięci strony lista po prostu pójdzie jeszcze raz. */
  }
};

const recalled = (): string | null => {
  try {
    return localStorage.getItem(SYNC_KEY);
  } catch {
    return null;
  }
};

/**
 * Wysyła serwerowi aktualną listę przypomnień, jeśli od ostatniego razu się zmieniła. Woła
 * ją aplikacja po każdej zmianie stanu i po powrocie na ekran; bez sieci po prostu poczeka
 * na następny raz.
 */
export async function syncReminders(state: AppState, force = false): Promise<boolean> {
  if (!pushConfigured() || !hasPush() || Notification.permission !== 'granted') return false;
  // Subskrypcja tylko dla prowadzącego: listy nie ma — najwyżej pusta, której wyłączenie nie doszło.
  if (remindersOff()) return recalled() === CLEAR ? clearList() : false;
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) return false;
    const now = new Date();
    const prefs = remindersOf(state);
    const diet = hasDiet();
    // Zakupy i badanie kontrolne leżą w bazie diety: wczytywana dopiero wtedy, gdy któreś z tych
    // przypomnień jest włączone. Baza nie odpowiada — lista idzie bez nich.
    const extras =
      diet && (prefs.shop || prefs.labs)
        ? await import('./food/calendar').then((m) => m.loadDietCalendar()).catch(() => null)
        : null;
    const body = JSON.stringify({
      subscription: sub.toJSON(),
      tz: deviceTimeZone(),
      // Przypomnienie o jedzeniu tylko przy profilu diety — znacznik zna ekran Dziś bez wczytywania bazy.
      items: reminderItems(state, prefs, localDay(now), now.getHours() * 60 + now.getMinutes(), diet, extras),
    });
    const mark = fingerprint(body);
    if (!force && recalled() === mark) return true;
    const res = await fetch(`${API_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    // Odrzuconej listy (400) nie ma sensu wysyłać znów, dopóki się nie zmieni; błąd sieci
    // albo serwera — owszem, przy następnej okazji.
    if (res.ok || res.status === 400) remember(mark);
    return res.ok;
  } catch {
    return false;
  }
}

/** Pusta lista przypomnień dla subskrypcji, którą trzymają już tylko powiadomienia od prowadzącego. */
async function clearList(): Promise<boolean> {
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) {
      remember(null);
      return false;
    }
    const res = await fetch(`${API_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), tz: deviceTimeZone(), items: [] }),
    });
    remember(res.ok || res.status === 400 ? null : CLEAR);
    return res.ok;
  } catch {
    remember(CLEAR);
    return false;
  }
}

/**
 * Włącza przypomnienia: pyta o zgodę (musi to zrobić stuknięcie — przeglądarki odrzucają
 * pytanie bez gestu), zakłada subskrypcję i od razu wysyła listę.
 */
export async function enablePush(state: AppState): Promise<PushState> {
  if (!pushConfigured() || !hasPush()) return currentPushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return currentPushState();
  const reg = await registration();
  if (!reg) return 'no-worker';
  const key = keyBytes(VAPID_KEY);
  let sub = await reg.pushManager.getSubscription();
  // Subskrypcja założona starym kluczem serwera nie przyjmie nowych wiadomości — od nowa.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await subscribeDevice(reg, key);
  setRemindersOff(false);
  await syncReminders(state, true);
  return currentPushState();
}

export async function disablePush(): Promise<PushState> {
  let kept = false;
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub && coachPushOn()) {
      // Subskrypcję trzymają też powiadomienia od prowadzącego: zostaje, a serwer dostaje pustą listę.
      kept = true;
      setRemindersOff(true);
      remember(CLEAR);
      await clearList();
    } else if (sub) {
      nextEpoch();
      await fetch(`${API_URL}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);
      await sub.unsubscribe();
    }
  } finally {
    if (!kept) remember(null);
  }
  return currentPushState();
}
