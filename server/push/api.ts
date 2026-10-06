import { dueItems, isStale, localParts, pruneSent, sentKey } from './schedule';
import type { ReminderItem } from './schedule';
import type { Store } from './store';
import { fromB64u, pushRequest } from './webpush';
import type { Vapid } from './webpush';

/**
 * Serwer przypomnień: dwa adresy dla aplikacji i jeden przebieg crona.
 *
 * - `POST /subscribe` — subskrypcja telefonu, jego strefa czasowa i lista gotowych
 *   przypomnień na najbliższe dni. Każde otwarcie aplikacji przysyła listę od nowa.
 * - `POST /unsubscribe` — wyłączenie przypomnień.
 * - `tick` — co kilka minut: wyślij to, czemu wybiła godzina.
 *
 * Konta nie ma. Subskrypcję identyfikuje jej własny adres w usłudze powiadomień — losowy,
 * długi i znany tylko temu telefonowi, więc wypisać może ją tylko on.
 */

export interface Env {
  VAPID_PUBLIC_KEY: string;
  /** Sekret: klucz prywatny VAPID jako JWK. */
  VAPID_PRIVATE_JWK: string;
  /** Kontakt dla usług powiadomień — adres strony aplikacji. */
  VAPID_SUBJECT: string;
  /** Strony, które mogą wołać serwer, po przecinku. */
  ALLOWED_ORIGINS: string;
}

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

const byteLength = (s: unknown, n: number): boolean => {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]+$/.test(s)) return false;
  try {
    return fromB64u(s).length === n;
  } catch {
    return false;
  }
};

const validTz = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Najwięcej przypomnień na listę: dwa dziennie przez trzy tygodnie z zapasem. */
export const MAX_ITEMS = 100;

const text = (s: unknown, max: number, min = 0): s is string =>
  typeof s === 'string' && s.length >= min && s.length <= max;

export function validItem(i: unknown): i is ReminderItem {
  if (!i || typeof i !== 'object') return false;
  const x = i as Record<string, unknown>;
  return (
    typeof x.tag === 'string' &&
    /^[a-z][a-z0-9-]{0,31}$/.test(x.tag) &&
    typeof x.date === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(x.date) &&
    typeof x.time === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) &&
    text(x.title, 80, 1) &&
    text(x.body, 200) &&
    // Tylko trasa aplikacji — powiadomienie nie może otwierać cudzych stron.
    typeof x.url === 'string' &&
    /^#\/[A-Za-z0-9/_-]{0,64}$/.test(x.url)
  );
}

function cors(req: Request, env: Env): Headers {
  const h = new Headers({ Vary: 'Origin' });
  const origin = req.headers.get('Origin');
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  if (origin && allowed.includes(origin)) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    h.set('Access-Control-Allow-Headers', 'Content-Type');
    h.set('Access-Control-Max-Age', '86400');
  }
  return h;
}

/** Lista na trzy tygodnie to kilkanaście kilobajtów; więcej to już nie aplikacja. */
const MAX_BODY = 64 * 1024;

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function handle(req: Request, env: Env, store: Store, now = Date.now()): Promise<Response> {
  const headers = cors(req, env);
  const reply = (status: number, msg?: string) => new Response(msg ?? null, { status, headers });
  const path = new URL(req.url).pathname.replace(/\/+$/, '');

  if (req.method === 'OPTIONS') return reply(204);
  if (req.method === 'GET' && path === '') return reply(200, 'GYM TRACKER — przypomnienia');
  if (req.method !== 'POST') return reply(405);

  const data = await readJson(req);
  if (!data) return reply(400, 'zły JSON');

  if (path === '/subscribe') {
    const sub = data.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    const items = data.items;
    if (
      !sub ||
      !validEndpoint(sub.endpoint) ||
      !byteLength(sub.keys?.p256dh, 65) ||
      !byteLength(sub.keys?.auth, 16) ||
      !validTz(data.tz) ||
      !Array.isArray(items) ||
      items.length > MAX_ITEMS ||
      !items.every(validItem)
    )
      return reply(400, 'zła subskrypcja albo lista');
    await store.upsert({
      endpoint: sub.endpoint,
      p256dh: sub.keys!.p256dh as string,
      auth: sub.keys!.auth as string,
      tz: data.tz,
      items,
      updated: now,
    });
    return reply(204);
  }

  if (path === '/unsubscribe') {
    if (!validEndpoint(data.endpoint)) return reply(400, 'zły adres');
    await store.remove(data.endpoint);
    return reply(204);
  }

  return reply(404);
}

/**
 * Jeden przebieg crona. Postęp zapisuje się po każdej subskrypcji, więc przebieg przerwany
 * limitem czasu procesora nie wyśle niczego dwa razy — następny zacznie od niewysłanych.
 */
export async function tick(
  store: Store,
  env: Env,
  now: Date,
  send: (r: Request) => Promise<Response> = (r) => fetch(r),
): Promise<{ sent: number; removed: number; failed: number }> {
  const vapid: Vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateJwk: env.VAPID_PRIVATE_JWK, subject: env.VAPID_SUBJECT };
  const out = { sent: 0, removed: 0, failed: 0 };

  for (const r of await store.all()) {
    if (isStale(r, now.getTime())) {
      await store.remove(r.endpoint);
      out.removed++;
      continue;
    }
    const due = dueItems(r, now);
    if (!due.length) continue;

    const sent = pruneSent(r.sent, localParts(now, r.tz).date);
    let gone = false;
    for (const item of due) {
      const req = await pushRequest(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        { title: item.title, body: item.body, url: item.url, tag: item.tag },
        vapid,
        // Trzy godziny w usłudze, jeśli telefon jest offline; temat zastępuje starszą wersję.
        { ttl: 3 * 3600, urgency: 'normal', topic: item.tag },
      );
      const res = await send(req);
      if (res.status === 404 || res.status === 410) {
        gone = true;
        break;
      }
      if (res.ok) {
        sent.push(sentKey(item));
        out.sent++;
      } else out.failed++;
    }

    if (gone) {
      await store.remove(r.endpoint);
      out.removed++;
    } else await store.markSent(r.endpoint, sent);
  }
  return out;
}
