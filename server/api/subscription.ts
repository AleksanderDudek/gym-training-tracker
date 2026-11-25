import { fromB64u } from './webpush';

/**
 * Sprawdzanie subskrypcji Web Push z zapytań aplikacji — wspólne dla przypomnień (`api.ts`)
 * i powiadomień od prowadzącego (`link.ts`).
 */

/**
 * Usługi powiadomień przeglądarek: Chrome i Edge na Androidzie (FCM), Safari na iOS
 * i macOS, Firefox, Windows. Serwer wysyła zapytania tylko tam — bez tej listy każdy mógłby
 * zapisać „subskrypcję” z adresem wewnętrznym i kazać serwerowi pod niego stukać.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^(web\.push|[a-z0-9-]+\.push)\.apple\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

/** Klucz w base64url o dokładnie `n` bajtach (p256dh — 65, auth — 16). */
export const byteLength = (s: unknown, n: number): s is string => {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]+$/.test(s)) return false;
  try {
    return fromB64u(s).length === n;
  } catch {
    return false;
  }
};

export const validTz = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** `subscription` z zapytania (wynik `PushSubscription.toJSON()`) albo `null`, gdy w złym kształcie. */
export function subscriptionOf(v: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const sub = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null | undefined;
  if (!sub || typeof sub !== 'object' || !validEndpoint(sub.endpoint)) return null;
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;
  return byteLength(p256dh, 65) && byteLength(auth, 16) ? { endpoint: sub.endpoint, p256dh, auth } : null;
}
