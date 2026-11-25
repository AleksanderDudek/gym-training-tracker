import { vi } from 'vitest';

/**
 * Telefon z powiadomieniami pod jsdom i serwer aplikacji w pamięci — do testów powiadomień od prowadzącego.
 *
 * `fakeDevice` podstawia `Notification` (zgoda i odpowiedź na pytanie), `PushManager` i service workera
 * z `pushManager` (subskrypcja z adresem FCM, kluczem i `toJSON`). `fakeWorker` odpowiada na trasy
 * `/link/*` i `/subscribe` serwera aplikacji i zapisuje, co dostał; resztę zapytań oddaje dalej (Sztab).
 */

interface FakeSub {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: () => Promise<boolean>;
}

export function fakeDevice(
  opts: {
    permission?: NotificationPermission;
    answer?: NotificationPermission;
    /** Subskrypcja, jaką da przeglądarka — dla testu umowy z prawdziwym serwerem aplikacji (prawdziwe klucze). */
    subscription?: (n: number) => { endpoint: string; keys: { p256dh: string; auth: string } };
  } = {},
) {
  let permission: NotificationPermission = opts.permission ?? 'default';
  let answer: NotificationPermission = opts.answer ?? 'granted';
  let sub: FakeSub | null = null;
  let n = 0;
  /** Nowa subskrypcja dostaje ten sam adres co poprzednia (bywa tak w niektórych usługach powiadomień). */
  let reuse = false;
  const make = (key: ArrayBuffer | null): FakeSub => {
    if (!reuse || n === 0) n += 1;
    // Adres bez `https`: test CSP (`csp.test.ts`) czyta też pliki pomocnicze testów i szuka w nich obcych serwerów.
    const real = opts.subscription?.(n);
    const endpoint = real?.endpoint ?? `http://push.invalid/send/device-${n}`;
    const s: FakeSub = {
      endpoint,
      options: { applicationServerKey: key },
      toJSON: () => real ?? { endpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } },
      unsubscribe: async () => {
        if (sub === s) sub = null;
        return true;
      },
    };
    return s;
  };
  const requestPermission = vi.fn(async () => {
    if (permission === 'default') permission = answer;
    return permission;
  });
  const subscribe = vi.fn(async (o: { applicationServerKey: Uint8Array<ArrayBuffer> }) => {
    sub = make(o.applicationServerKey.buffer.slice(0));
    return sub;
  });
  const registration = { pushManager: { getSubscription: async () => sub, subscribe } };
  class FakeNotification {
    static get permission() {
      return permission;
    }
    static requestPermission = requestPermission;
  }
  vi.stubGlobal('Notification', FakeNotification);
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: async () => registration }, configurable: true });
  return {
    requestPermission,
    subscribe,
    get permission() {
      return permission;
    },
    setPermission(p: NotificationPermission) {
      permission = p;
    },
    answer(p: NotificationPermission) {
      answer = p;
    },
    get subscription() {
      return sub;
    },
    /** Przeglądarka wymieniła subskrypcję (nowy adres, ten sam klucz). */
    rotate() {
      sub = make(sub?.options.applicationServerKey ?? null);
    },
    reuseEndpoint(v: boolean) {
      reuse = v;
    },
    /** Subskrypcja założona innym (starym) kluczem serwera. */
    staleKey() {
      if (sub) sub.options.applicationServerKey = new Uint8Array(65).buffer;
    },
  };
}

/** Sprząta po `fakeDevice` (globalne `Notification` i `PushManager` zdejmuje `vi.unstubAllGlobals`). */
export function forgetDevice(): void {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
}

export type FakeDevice = ReturnType<typeof fakeDevice>;

/** `api` — adres serwera aplikacji z buildu (`VITE_API_URL` w teście); `next` — dokąd idzie reszta zapytań. */
export function fakeWorker(api: string, next: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  let offline = false;
  let status = 204;
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (!url.startsWith(api)) return next(input, init);
    if (offline) throw new TypeError('Failed to fetch');
    calls.push({ path: url.slice(api.length), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    return new Response(null, { status });
  };
  return {
    calls,
    fetch: fetchMock,
    paths: () => calls.map((c) => c.path),
    /** Ostatnie zapytanie na daną trasę. */
    last: (path: string) => calls.filter((c) => c.path === path).at(-1)?.body,
    setOffline(v: boolean) {
      offline = v;
    },
    setStatus(s: number) {
      status = s;
    },
    clear() {
      calls.length = 0;
    },
  };
}

export type FakeWorker = ReturnType<typeof fakeWorker>;
