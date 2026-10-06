import { localDay, reminderItems, remindersOf } from './engine/reminders';
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
 * Adres serwera i jego klucz publiczny przychodzą z buildu (`VITE_PUSH_API`,
 * `VITE_VAPID_PUBLIC_KEY`). Bez nich aplikacja działa jak dotąd, a karty przypomnień nie ma.
 */

export const PUSH_API = String(import.meta.env.VITE_PUSH_API ?? '').replace(/\/+$/, '');
export const VAPID_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '');

export const pushConfigured = (): boolean => PUSH_API !== '' && VAPID_KEY !== '';

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

const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS przedstawia się jak Mac — zdradza go ekran dotykowy.
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const hasPush = (): boolean => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  // `getRegistration`, nie `ready`: bez service workera `ready` czeka w nieskończoność.
  return hasPush() ? navigator.serviceWorker.getRegistration() : undefined;
}

export async function currentPushState(): Promise<PushState> {
  const reg = pushConfigured() ? await registration().catch(() => undefined) : undefined;
  return pushStateOf({
    configured: pushConfigured(),
    ios: isIos(),
    standalone: isStandalone(),
    hasPush: hasPush(),
    worker: !!reg,
    permission: 'Notification' in window ? Notification.permission : null,
    subscribed: !!(await reg?.pushManager.getSubscription().catch(() => null)),
  });
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

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
  } catch {
    return 'Europe/Warsaw';
  }
}

/** Co i kiedy ostatnio poszło do serwera — żeby nie wysyłać tej samej listy przy każdym kliknięciu. */
const SYNC_KEY = 'gt-push-sync';

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
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) return false;
    const now = new Date();
    const body = JSON.stringify({
      subscription: sub.toJSON(),
      tz: deviceTimeZone(),
      items: reminderItems(state, remindersOf(state), localDay(now), now.getHours() * 60 + now.getMinutes()),
    });
    const mark = fingerprint(body);
    if (!force && recalled() === mark) return true;
    const res = await fetch(`${PUSH_API}/subscribe`, {
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
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await syncReminders(state, true);
  return currentPushState();
}

export async function disablePush(): Promise<PushState> {
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub) {
      await fetch(`${PUSH_API}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);
      await sub.unsubscribe();
    }
  } finally {
    remember(null);
  }
  return currentPushState();
}
