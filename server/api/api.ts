import { garmin } from './garmin';
import { dueItems, isStale, localParts, pruneSent, sentKey } from './schedule';
import type { ReminderItem } from './schedule';
import type { FeedbackSummary, Store } from './store';
import { fromB64u, pushRequest } from './webpush';
import type { Vapid } from './webpush';

/**
 * Serwer aplikacji: przypomnienia, uwagi od użytkowników, skrzynki zegarka i jeden przebieg crona.
 *
 * - `POST /subscribe` — subskrypcja telefonu, jego strefa czasowa i lista gotowych
 *   przypomnień na najbliższe dni. Każde otwarcie aplikacji przysyła listę od nowa.
 * - `POST /unsubscribe` — wyłączenie przypomnień.
 * - `POST /feedback` — uwaga albo zgłoszenie błędu: e-mail, treść, zrzut ekranu i ślad wizyty.
 * - `GET /admin/feedback` — lista uwag dla autora, za hasłem (`ADMIN_TOKEN`).
 * - `POST /garmin/push` — zaszyfrowana paczka z zegarka Garmin (serwer nie ma klucza).
 * - `POST /garmin/pull`, `POST /garmin/forget` — odbiór paczki i odłączenie zegarka.
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
  /** Sekret: hasło do listy uwag. Puste albo krótsze niż 16 znaków — listy nie ma. */
  ADMIN_TOKEN?: string;
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
/** Uwaga ze zrzutem ekranu: JPEG telefonu to zwykle 50–200 kB, w base64 o trzecią część więcej. */
const MAX_FEEDBACK_BODY = 3 * 1024 * 1024;

async function readJson(req: Request, max = MAX_BODY): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get('Content-Length') ?? 0) > max) return null;
  const raw = await req.text();
  if (raw.length > max) return null;
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
  if (req.method === 'GET' && path === '') return reply(200, 'GYM TRACKER — serwer aplikacji');
  if (req.method === 'GET' && path.startsWith('/admin/')) return admin(req, path, env, store);
  if (req.method !== 'POST') return reply(405);

  const data = await readJson(req, path === '/feedback' ? MAX_FEEDBACK_BODY : MAX_BODY);
  if (!data) return reply(400, 'zły JSON');

  if (path === '/feedback') return feedback(req, data, env, store, now, reply);

  if (path.startsWith('/garmin/')) {
    const json = (status: number, d: unknown) => {
      const h = new Headers(headers);
      h.set('Content-Type', 'application/json');
      h.set('Cache-Control', 'no-store');
      return new Response(JSON.stringify(d), { status, headers: h });
    };
    return garmin(path, data, () => ipHashOf(req, env), store, now, { reply, json });
  }

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

/* ---------------- Uwagi od użytkowników ---------------- */

/** Wiadomości z jednego adresu na godzinę — dość na rozmowę, za mało na zalew. */
export const FEEDBACK_PER_HOUR = 10;
const TEXT_MAX = 4000;
const SHOT_MAX = 2_000_000;
const CONTEXT_MAX = 32 * 1024;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const SHOT = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

async function sha256(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Adres IP tylko jako skrót z solą — do limitów, nie do zapisania, kto pisał. */
const ipHashOf = (req: Request, env: Env): Promise<string> =>
  sha256(`${req.headers.get('CF-Connecting-IP') ?? 'nieznany'}|${env.VAPID_SUBJECT}`);

async function feedback(
  req: Request,
  data: Record<string, unknown>,
  env: Env,
  store: Store,
  now: number,
  reply: (status: number, msg?: string) => Response,
): Promise<Response> {
  // Pole, którego człowiek nie widzi: wypełnia je tylko bot. Bot dostaje „ok”, żeby nie
  // uczył się, co go zdradziło.
  if (typeof data.website === 'string' && data.website.trim()) return reply(204);

  const email = typeof data.email === 'string' ? data.email.trim() : '';
  const text = typeof data.text === 'string' ? data.text.trim() : '';
  const shot = data.screenshot ?? null;
  const ctx = data.context && typeof data.context === 'object' ? (data.context as Record<string, unknown>) : {};
  const context = JSON.stringify(ctx);
  if (
    (email && (email.length > 254 || !EMAIL.test(email))) ||
    text.length < 3 ||
    text.length > TEXT_MAX ||
    (shot !== null && (typeof shot !== 'string' || shot.length > SHOT_MAX || !SHOT.test(shot))) ||
    context.length > CONTEXT_MAX
  )
    return reply(400, 'zła wiadomość');

  const ipHash = await ipHashOf(req, env);
  if ((await store.recentFeedback(ipHash, now - 3_600_000)) >= FEEDBACK_PER_HOUR) return reply(429, 'za dużo wiadomości');

  await store.addFeedback({
    id: crypto.randomUUID(),
    created: now,
    email: email || null,
    text,
    view: typeof ctx.view === 'string' ? ctx.view.slice(0, 200) : '',
    context,
    screenshot: shot as string | null,
    ipHash,
  });
  return reply(204);
}

/* ---------------- Podgląd dla autora ---------------- */

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Hasło z nagłówka Basic. Porównanie skrótów — czas nie zdradza, ile znaków się zgadza. */
async function authorized(req: Request, token: string): Promise<boolean> {
  const h = req.headers.get('Authorization') ?? '';
  if (!h.startsWith('Basic ')) return false;
  let pass = '';
  try {
    pass = atob(h.slice(6)).split(':').slice(1).join(':');
  } catch {
    return false;
  }
  return (await sha256(pass)) === (await sha256(token));
}

function page(list: FeedbackSummary[]): string {
  const row = (f: FeedbackSummary) => {
    let ctx = f.context;
    try {
      ctx = JSON.stringify(JSON.parse(f.context), null, 2);
    } catch {
      /* zostaje surowy */
    }
    return `<article>
<header><time>${esc(new Date(f.created).toISOString().replace('T', ' ').slice(0, 16))}</time> · <b>${esc(f.view || '—')}</b>${
      f.email ? ` · <a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : ''
    }</header>
<p>${esc(f.text)}</p>
${f.hasShot ? `<a href="/admin/feedback/${esc(f.id)}/screenshot"><img loading="lazy" alt="zrzut ekranu" src="/admin/feedback/${esc(f.id)}/screenshot"></a>` : ''}
<details><summary>ślad wizyty i dane techniczne</summary><pre>${esc(ctx)}</pre></details>
</article>`;
  };
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Uwagi — GYM TRACKER</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:720px;padding:16px;background:#f3f3ef;color:#1e2320}
article{background:#fff;border:1px solid #c2c5bd;border-radius:3px;padding:12px;margin:0 0 12px}
header{font-size:13px;color:#4c524b}p{white-space:pre-wrap;margin:8px 0}img{max-width:240px;border:1px solid #c2c5bd}
pre{white-space:pre-wrap;font-size:12px;background:#f3f3ef;padding:8px}
</style></head><body><h1>Uwagi (${list.length})</h1>${list.map(row).join('\n') || '<p>Na razie cisza.</p>'}</body></html>`;
}

async function admin(req: Request, path: string, env: Env, store: Store): Promise<Response> {
  const token = env.ADMIN_TOKEN ?? '';
  if (token.length < 16) return new Response(null, { status: 404 });
  if (!(await authorized(req, token)))
    return new Response('Hasło do listy uwag', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="uwagi", charset="UTF-8"' } });
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

  if (path === '/admin/feedback') {
    return new Response(page(await store.listFeedback(200)), {
      headers: {
        ...headers,
        'Content-Type': 'text/html; charset=utf-8',
        // Treść pisali obcy ludzie — strona nie wykona z niej ani linijki skryptu.
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      },
    });
  }
  const m = path.match(/^\/admin\/feedback\/([0-9a-f-]{36})\/screenshot$/);
  if (m) {
    const shot = await store.feedbackShot(m[1]!);
    const parts = shot?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!parts) return new Response(null, { status: 404, headers });
    const bytes = Uint8Array.from(atob(parts[2]!), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { ...headers, 'Content-Type': parts[1]! } });
  }
  return new Response(null, { status: 404, headers });
}
