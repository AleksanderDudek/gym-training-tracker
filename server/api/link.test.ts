import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { handle, tick } from './api';
import type { Env, Send } from './api';
import { DUE_PER_RUN, LINK_TTL_MS, MAX_QUEUED, SENDS_PER_HOUR, TOKENS_PER_ENDPOINT, hashToken, linkTick } from './link';
import { d1Store, memoryStore } from './store';
import type { D1Database, Store } from './store';
import { b64u } from './webpush';

/**
 * Powiadomienia od prowadzącego: telefon wiąże token współpracy ze swoją subskrypcją, Sztab woła
 * serwer tym tokenem i rodzajem zdarzenia. Serwer wysyła ogólny tekst w języku telefonu, pilnuje
 * limitów, trzyma zaplanowane do czasu i nie zdradza, które tokeny istnieją.
 *
 * Scenariusze z bazą biegną dwa razy: na magazynie w pamięci i na prawdziwym SQL-u z `schema.sql`
 * (SQLite z Node'a — D1 to SQLite), żeby zapytania D1 nie rozjechały się z wersją testową.
 */

const APP = 'https://aleksanderdudek.github.io';
const SZTAB = 'https://gym-tracker-sztab.instrukcje-app.workers.dev';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/telefon';
const T0 = Date.parse('2026-11-25T10:00:00Z');
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const enc = new TextEncoder();
const newToken = () => b64u(crypto.getRandomValues(new Uint8Array(32)));

/** Klucze „telefonu”: z nimi test odszyfrowuje to, co serwer wysłał. */
let ua: { keys: CryptoKeyPair; p256dh: Uint8Array<ArrayBuffer>; auth: Uint8Array<ArrayBuffer> };
let env: Env;

beforeAll(async () => {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  ua = {
    keys,
    p256dh: new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey)),
    auth: crypto.getRandomValues(new Uint8Array(16)),
  };
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  env = {
    VAPID_PUBLIC_KEY: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', vapid.publicKey))),
    VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', vapid.privateKey)),
    VAPID_SUBJECT: 'https://aleksanderdudek.github.io/gym-training-tracker/',
    // Ta sama lista co we wdrożeniu — test pilnuje, że Sztab w niej jest.
    ALLOWED_ORIGINS: /^ALLOWED_ORIGINS = "([^"]+)"$/m.exec(readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8'))![1]!,
  };
});

const subscription = (endpoint = ENDPOINT) => ({ endpoint, keys: { p256dh: b64u(ua.p256dh), auth: b64u(ua.auth) } });

const post = (path: string, data: unknown, origin = APP) =>
  new Request(`https://gym-tracker-api.example.workers.dev${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(data),
  });

/** Udawana usługa powiadomień: zapisuje zapytania, odpowiada podanym kodem. */
function pushService(status = 201) {
  const sent: Request[] = [];
  const send: Send = async (r) => {
    sent.push(r);
    return new Response(null, { status });
  };
  return { sent, send };
}

/** Zapytanie do serwera; praca „po odpowiedzi” (wysyłka) kończy się, zanim test pójdzie dalej. */
async function call(store: Store, path: string, data: unknown, o: { now?: number; send?: Send; origin?: string } = {}) {
  const jobs: Promise<unknown>[] = [];
  const res = await handle(
    post(path, data, o.origin),
    env,
    store,
    o.now ?? T0,
    (p) => void jobs.push(p),
    o.send ?? pushService().send,
  );
  await Promise.all(jobs);
  return res;
}

const register = (store: Store, token: string, o: { lang?: string; now?: number } = {}) =>
  call(store, '/link/register', { token, subscription: subscription(), tz: 'Europe/Warsaw', lang: o.lang ?? 'pl' }, { now: o.now });

const queued = (store: Store) => store.dueNotifies(T0 + 500 * DAY, 1000);

/* ---------------- RFC 8291 od strony telefonu ---------------- */

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** Odszyfrowuje wiadomość tak, jak zrobi to przeglądarka telefonu. */
async function openPush(req: Request): Promise<unknown> {
  const body = new Uint8Array(await req.clone().arrayBuffer());
  const salt = body.slice(0, 16);
  const asPublic = body.slice(21, 21 + body[20]!);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.keys.privateKey, 256));
  const ikm = await hmac(await hmac(ua.auth, ecdh), concat(enc.encode('WebPush: info\0'), ua.p256dh, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body.slice(21 + asPublic.length)));
  return JSON.parse(new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2))));
}

/* ---------------- Magazyny: w pamięci i SQL z schema.sql ---------------- */

type Statement = ReturnType<D1Database['prepare']>;
type Value = null | number | bigint | string;

/** D1 na SQLite z Node'a: te same zapytania i ten sam schemat co w Cloudflare. */
async function sqliteStore(): Promise<Store> {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const sql = (s: string) => db.prepare(s).run();
  readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach(sql);
  const statement = (s: string, args: Value[] = []): Statement => ({
    bind: (...v: unknown[]) => statement(s, v as Value[]),
    run: async () => db.prepare(s).run(...args),
    all: async <T,>() => ({ results: db.prepare(s).all(...args) as T[] }),
  });
  return d1Store({
    prepare: (s) => statement(s),
    // Jak w D1: wszystko albo nic.
    batch: async (stmts) => {
      sql('BEGIN');
      try {
        for (const s of stmts) await s.run();
        sql('COMMIT');
      } catch (e) {
        sql('ROLLBACK');
        throw e;
      }
    },
  });
}

const hasSqlite = await import('node:sqlite').then(
  () => true,
  () => false,
);

const stores: [string, () => Promise<Store>][] = [['w pamięci', async () => memoryStore()]];
if (hasSqlite) stores.push(['D1 (SQLite)', sqliteStore]);

/* ---------------- Testy ---------------- */

describe.each(stores)('powiadomienia od prowadzącego — magazyn %s', (_name, makeStore) => {
  it('rejestracja zakłada subskrypcję z pustą listą, a istniejącej nie rusza listy przypomnień', async () => {
    const fresh = await makeStore();
    expect((await register(fresh, newToken())).status).toBe(204);
    const [s] = await fresh.all();
    expect(s).toMatchObject({ endpoint: ENDPOINT, tz: 'Europe/Warsaw', items: [], sent: [], updated: T0 });

    const store = await makeStore();
    const items = [{ tag: 'trening', date: '2026-11-26', time: '07:30', title: 'Dziś trening', body: '', url: '#/sesja' }];
    await call(store, '/subscribe', { subscription: subscription(), tz: 'Europe/Warsaw', items }, { now: T0 - DAY });
    await store.markSent(ENDPOINT, ['2026-11-25|trening']);
    // Rejestracja dzień później: nowa strefa i świeży czas (45 dni ciszy liczy się od teraz), lista ta sama.
    const res = await call(store, '/link/register', { token: newToken(), subscription: subscription(), tz: 'Europe/London', lang: 'pl' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP);
    const [r] = await store.all();
    expect(r).toMatchObject({ items, sent: ['2026-11-25|trening'], tz: 'Europe/London', updated: T0 });
  });

  it('powiadomienie teraz: ogólny tekst w języku telefonu, trasa współpracy, rodzaj jako znacznik', async () => {
    const store = await makeStore();
    const pl = newToken();
    const en = newToken();
    await register(store, pl);
    await register(store, en, { lang: 'en' });
    const push = pushService();
    expect((await call(store, '/link/notify', { token: pl, kind: 'message' }, { send: push.send, origin: SZTAB })).status).toBe(204);
    await call(store, '/link/notify', { token: en, kind: 'visit-soon' }, { send: push.send, origin: SZTAB });
    expect(push.sent).toHaveLength(2);

    const [a, b] = push.sent as [Request, Request];
    expect(a.url).toBe(ENDPOINT);
    expect(a.method).toBe('POST');
    expect(a.headers.get('Topic')).toBe('coach-message');
    expect(a.headers.get('TTL')).toBe(String(24 * 3600));
    expect(a.headers.get('Authorization')).toContain(`k=${env.VAPID_PUBLIC_KEY}`);
    expect(await openPush(a)).toEqual({
      title: 'GYM TRACKER',
      body: 'Nowa wiadomość od prowadzącego',
      url: '#/wspolpraca',
      tag: 'coach-message',
    });
    expect(b.headers.get('TTL')).toBe(String(2 * 3600));
    expect(await openPush(b)).toEqual({
      title: 'GYM TRACKER',
      body: 'Appointment with your coach in two hours',
      url: '#/wspolpraca',
      tag: 'coach-visit-soon',
    });
  });

  it('nieznany token: 204 jak każdy inny, nic nie wychodzi i nic nie czeka', async () => {
    const store = await makeStore();
    await register(store, newToken());
    const push = pushService();
    const stranger = newToken();
    expect((await call(store, '/link/notify', { token: stranger, kind: 'message' }, { send: push.send })).status).toBe(204);
    expect((await call(store, '/link/notify', { token: stranger, kind: 'assignment', at: T0 + HOUR, ref: 'z1' })).status).toBe(204);
    expect((await call(store, '/link/cancel', { token: stranger, ref: 'z1' })).status).toBe(204);
    expect((await call(store, '/link/unregister', { token: stranger })).status).toBe(204);
    expect(push.sent).toEqual([]);
    expect(await queued(store)).toEqual([]);
  });

  it(`najwyżej ${SENDS_PER_HOUR} natychmiastowych na godzinę, potem po cichu nic`, async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    // Co 61 s, żeby nie sklejały się jako powtórki.
    for (let i = 0; i < SENDS_PER_HOUR + 5; i++) {
      const res = await call(store, '/link/notify', { token, kind: 'message' }, { now: T0 + i * 61_000, send: push.send });
      expect(res.status).toBe(204);
    }
    expect(push.sent).toHaveLength(SENDS_PER_HOUR);
    // Godzinę po pierwszym okno się przesuwa.
    await call(store, '/link/notify', { token, kind: 'message' }, { now: T0 + HOUR + 1, send: push.send });
    expect(push.sent).toHaveLength(SENDS_PER_HOUR + 1);
  });

  it('ten sam rodzaj w ciągu minuty skleja się w jedno', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    await call(store, '/link/notify', { token, kind: 'assignment' }, { send: push.send });
    await call(store, '/link/notify', { token, kind: 'assignment' }, { now: T0 + 30_000, send: push.send });
    await call(store, '/link/notify', { token, kind: 'message' }, { now: T0 + 30_000, send: push.send });
    expect(push.sent.map((r) => r.headers.get('Topic'))).toEqual(['coach-assignment', 'coach-message']);
    await call(store, '/link/notify', { token, kind: 'assignment' }, { now: T0 + 61_000, send: push.send });
    expect(push.sent).toHaveLength(3);
  });

  it('zaplanowane czeka w kolejce i wychodzi raz, w przebiegu crona po swoim czasie', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    const at = T0 + 3 * HOUR;
    await call(store, '/link/notify', { token, kind: 'assignment', at, ref: 'zalecenie-1' }, { send: push.send, origin: SZTAB });
    expect(push.sent).toEqual([]);
    expect((await linkTick(store, env, new Date(at - 5 * MIN), push.send)).sent).toBe(0);
    expect(await linkTick(store, env, new Date(at + 2 * MIN), push.send)).toMatchObject({ sent: 1, dropped: 0, failed: 0 });
    expect(await openPush(push.sent[0]!)).toMatchObject({ body: 'Nowe zalecenie od prowadzącego', tag: 'coach-assignment' });
    expect((await linkTick(store, env, new Date(at + 7 * MIN), push.send)).sent).toBe(0);
    expect(push.sent).toHaveLength(1);
    expect(await queued(store)).toEqual([]);
  });

  it('czas w ciągu minuty (albo miniony) — wysyła od razu, bez kolejki', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    await call(store, '/link/notify', { token, kind: 'visit', at: T0 + 30_000 }, { send: push.send });
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 - HOUR }, { send: push.send });
    expect(push.sent).toHaveLength(2);
    expect(await queued(store)).toEqual([]);
  });

  it('koniec współpracy czyści kolejkę tokenu — od razu i gdy był zaplanowany', async () => {
    const store = await makeStore();
    const token = newToken();
    const other = newToken();
    await register(store, token);
    await register(store, other);
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 5 * HOUR, ref: 'z-9' });
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 30 * HOUR, ref: 'w-9' });
    await call(store, '/link/notify', { token: other, kind: 'assignment', at: T0 + 5 * HOUR });
    const push = pushService();
    await call(store, '/link/notify', { token, kind: 'ended' }, { send: push.send, origin: SZTAB });
    expect(await openPush(push.sent[0]!)).toMatchObject({ body: 'Prowadzący zakończył współpracę', tag: 'coach-ended' });
    // Kolejka innej współpracy zostaje.
    expect((await queued(store)).map((q) => q.kind)).toEqual(['assignment']);

    // Nawet zatrzymany limitem koniec czyści kolejkę.
    for (let i = 0; i < SENDS_PER_HOUR; i++) await call(store, '/link/notify', { token: other, kind: 'message' }, { now: T0 + i * 61_000 });
    await call(store, '/link/notify', { token: other, kind: 'ended' }, { now: T0 + 30 * MIN, send: push.send });
    expect(push.sent).toHaveLength(1);
    expect(await queued(store)).toEqual([]);

    // Zaplanowany koniec: w przebiegu crona wychodzi i zabiera resztę, także późniejszą.
    await call(store, '/link/notify', { token, kind: 'ended', at: T0 + HOUR });
    await call(store, '/link/notify', { token, kind: 'message', at: T0 + HOUR });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 9 * HOUR });
    const cron = pushService();
    expect(await linkTick(store, env, new Date(T0 + HOUR), cron.send)).toMatchObject({ sent: 1, dropped: 1 });
    expect(await openPush(cron.sent[0]!)).toMatchObject({ tag: 'coach-ended' });
    expect(await queued(store)).toEqual([]);
  });

  it('odwołanie po numerze kasuje zaplanowane', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 5 * HOUR, ref: 'wizyta-7' });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 5 * HOUR, ref: 'zalecenie-2' });
    expect((await call(store, '/link/cancel', { token, ref: 'wizyta-7' }, { origin: SZTAB })).status).toBe(204);
    const push = pushService();
    expect((await linkTick(store, env, new Date(T0 + 5 * HOUR), push.send)).sent).toBe(1);
    expect(await openPush(push.sent[0]!)).toMatchObject({ tag: 'coach-assignment' });
  });

  it('ten sam numer podmienia zaplanowane; natychmiastowe tego rodzaju je zastępuje, innego rodzaju — nie', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 2 * HOUR, ref: 'z-1' });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 6 * HOUR, ref: 'z-1' });
    expect((await queued(store)).map((q) => [q.kind, q.at, q.ref])).toEqual([['assignment', T0 + 6 * HOUR, 'z-1']]);

    // Wizyta: „zapisał cię” od razu nie kasuje „za dwie godziny” z tym samym numerem.
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 20 * HOUR, ref: 'w-1' });
    await call(store, '/link/notify', { token, kind: 'visit', ref: 'w-1' });
    // Zalecenie pokazane jednak od razu: zaplanowane tego samego rodzaju i numeru znika.
    await call(store, '/link/notify', { token, kind: 'assignment', ref: 'z-1' });
    expect((await queued(store)).map((q) => q.kind)).toEqual(['visit-soon']);
  });

  it('wyrejestrowanie kasuje token i jego kolejkę, subskrypcja zostaje', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR });
    expect((await call(store, '/link/unregister', { token })).status).toBe(204);
    const push = pushService();
    await call(store, '/link/notify', { token, kind: 'message' }, { send: push.send });
    expect(await linkTick(store, env, new Date(T0 + 2 * HOUR), push.send)).toMatchObject({ sent: 0, dropped: 0 });
    expect(push.sent).toEqual([]);
    expect(await store.linkTarget(await hashToken(token))).toBeNull();
    expect(await store.all()).toHaveLength(1);
  });

  it('martwa subskrypcja (410, 404) znika z tokenami — przy wysyłce od razu i w cronie', async () => {
    const now = await makeStore();
    const token = newToken();
    await register(now, token);
    await call(now, '/link/notify', { token, kind: 'message' }, { send: pushService(410).send });
    expect(await now.all()).toEqual([]);
    expect(await now.linkTarget(await hashToken(token))).toBeNull();

    const later = await makeStore();
    const other = newToken();
    await register(later, token);
    await register(later, other);
    await call(later, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR });
    await call(later, '/link/notify', { token: other, kind: 'visit-soon', at: T0 + HOUR });
    const gone = pushService(404);
    expect(await linkTick(later, env, new Date(T0 + HOUR), gone.send)).toMatchObject({ sent: 0, removed: 1 });
    expect(gone.sent).toHaveLength(1);
    expect(await later.all()).toEqual([]);
    expect(await queued(later)).toEqual([]);
  });

  it('błąd usługi powiadomień: zaplanowane zostaje na następny przebieg, dopóki ma sens', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + HOUR });
    expect(await linkTick(store, env, new Date(T0 + HOUR), pushService(503).send)).toMatchObject({ sent: 0, failed: 1 });
    const ok = pushService();
    expect(await linkTick(store, env, new Date(T0 + HOUR + 5 * MIN), ok.send)).toMatchObject({ sent: 1 });

    // Przypomnienie o wizycie dwie godziny po swoim czasie już nie wychodzi.
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 3 * HOUR, ref: 'w-2' });
    expect(await linkTick(store, env, new Date(T0 + 5 * HOUR), ok.send)).toMatchObject({ sent: 0, dropped: 1 });
    expect(ok.sent).toHaveLength(1);
  });

  it('cron: kilka zaplanowanych tego samego rodzaju naraz — jedno powiadomienie; bez tokenu — do kosza', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR, ref: 'a' });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR, ref: 'b' });
    await call(store, '/link/notify', { token, kind: 'message', at: T0 + HOUR });
    // Osierocone (token zniknął w międzyczasie) — nie ma do kogo wysłać.
    await store.queueNotify({ hash: 'f'.repeat(64), kind: 'message', at: T0, ref: null }, MAX_QUEUED);
    const push = pushService();
    expect(await linkTick(store, env, new Date(T0 + HOUR), push.send)).toMatchObject({ sent: 2, dropped: 1 });
    expect(push.sent.map((r) => r.headers.get('Topic')).sort()).toEqual(['coach-assignment', 'coach-message']);
    expect(await queued(store)).toEqual([]);
  });

  it(`kolejka: najwyżej ${MAX_QUEUED} zaplanowanych na token, cron bierze po ${DUE_PER_RUN}`, async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    for (let i = 0; i < MAX_QUEUED + 5; i++) await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR + i * MIN, ref: `z${i}` });
    expect(await queued(store)).toHaveLength(MAX_QUEUED);
    // Podmiana po numerze przy pełnej kolejce przechodzi.
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 10 * DAY, ref: 'z7' });
    const all = await queued(store);
    expect(all).toHaveLength(MAX_QUEUED);
    expect(all.find((q) => q.ref === 'z7')?.at).toBe(T0 + 10 * DAY);
    // Cron bierze po kawałku (tu wszystkie dawno po czasie, więc kawałek idzie do kosza).
    await linkTick(store, env, new Date(T0 + 12 * DAY), pushService().send);
    expect(await queued(store)).toHaveLength(MAX_QUEUED - DUE_PER_RUN);
  });

  it(`najwyżej ${TOKENS_PER_ENDPOINT} tokenów na telefon — najdawniej odświeżony wypada z kolejką`, async () => {
    const store = await makeStore();
    const tokens = Array.from({ length: TOKENS_PER_ENDPOINT + 1 }, newToken);
    for (const [i, t] of tokens.entries()) {
      await register(store, t, { now: T0 + i * MIN });
      await call(store, '/link/notify', { token: t, kind: 'assignment', at: T0 + 5 * HOUR }, { now: T0 + i * MIN });
    }
    expect(await store.linkTarget(await hashToken(tokens[0]!))).toBeNull();
    expect(await store.linkTarget(await hashToken(tokens[1]!))).not.toBeNull();
    expect(await queued(store)).toHaveLength(TOKENS_PER_ENDPOINT);
    // Ponowna rejestracja odświeża — wypada następny najstarszy.
    await register(store, tokens[1]!, { now: T0 + HOUR });
    await register(store, newToken(), { now: T0 + HOUR + 1 });
    expect(await store.linkTarget(await hashToken(tokens[1]!))).not.toBeNull();
    expect(await store.linkTarget(await hashToken(tokens[2]!))).toBeNull();
  });

  it('token bez odświeżenia przez 45 dni znika w przebiegu crona; wypisanie z przypomnień zabiera tokeny', async () => {
    const store = await makeStore();
    const old = newToken();
    const fresh = newToken();
    await register(store, old);
    await register(store, fresh, { now: T0 + 40 * DAY });
    expect((await linkTick(store, env, new Date(T0 + LINK_TTL_MS + 1), pushService().send)).pruned).toBe(1);
    expect(await store.linkTarget(await hashToken(old))).toBeNull();
    expect(await store.linkTarget(await hashToken(fresh))).not.toBeNull();

    expect((await call(store, '/unsubscribe', { endpoint: ENDPOINT })).status).toBe(204);
    expect(await store.linkTarget(await hashToken(fresh))).toBeNull();
  });

  it('subskrypcja tylko dla prowadzącego nie dostaje przypomnień i żyje, póki telefon się odzywa', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    expect(await tick(store, env, new Date(T0 + 40 * DAY), push.send)).toEqual({ sent: 0, removed: 0, failed: 0 });
    await register(store, token, { now: T0 + 40 * DAY });
    expect((await tick(store, env, new Date(T0 + 60 * DAY), push.send)).removed).toBe(0);
    expect(push.sent).toEqual([]);
  });
});

describe('powiadomienia od prowadzącego — zapytania', () => {
  it('Sztab dostaje CORS na zapytanie wstępne i na odpowiedź; obca strona — nie', async () => {
    const store = memoryStore();
    const pre = await handle(
      new Request('https://gym-tracker-api.example.workers.dev/link/notify', {
        method: 'OPTIONS',
        headers: { Origin: SZTAB, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
      }),
      env,
      store,
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(SZTAB);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(pre.headers.get('Access-Control-Allow-Headers')).toMatch(/content-type/i);

    const res = await call(store, '/link/notify', { token: newToken(), kind: 'message' }, { origin: SZTAB });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SZTAB);
    const dev = await call(store, '/link/cancel', { token: newToken(), ref: 'x' }, { origin: 'http://localhost:5190' });
    expect(dev.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5190');
    const evil = await call(store, '/link/notify', { token: newToken(), kind: 'message' }, { origin: 'https://evil.example' });
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull();
    // Aplikacja zostaje na liście.
    expect(env.ALLOWED_ORIGINS.split(',')).toContain(APP);
  });

  it('Sztab wysyła JSON jako text/plain (bez preflightu, z keepalive) — działa tak samo, z CORS', async () => {
    const store = memoryStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    const plain = (path: string, data: unknown) =>
      new Request(`https://gym-tracker-api.example.workers.dev${path}`, {
        method: 'POST',
        headers: { Origin: SZTAB },
        body: JSON.stringify(data),
      });
    const jobs: Promise<unknown>[] = [];
    const notify = plain('/link/notify', { token, kind: 'message' });
    expect(notify.headers.get('Content-Type')).toMatch(/^text\/plain/);
    const res = await handle(notify, env, store, T0, (p) => void jobs.push(p), push.send);
    await Promise.all(jobs);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SZTAB);
    expect(push.sent).toHaveLength(1);

    await handle(plain('/link/notify', { token, kind: 'visit-soon', at: T0 + 3 * HOUR, ref: 'w-3' }), env, store, T0);
    expect(await queued(store)).toHaveLength(1);
    const cancel = await handle(plain('/link/cancel', { token, ref: 'w-3' }), env, store, T0);
    expect(cancel.status).toBe(204);
    expect(cancel.headers.get('Access-Control-Allow-Origin')).toBe(SZTAB);
    expect(await queued(store)).toEqual([]);
  });

  it('zapytania w złym kształcie — 400, a baza bez zmian', async () => {
    const store = memoryStore();
    const token = newToken();
    const sub = subscription();
    const reg = (over: Record<string, unknown>) => ({ token, subscription: sub, tz: 'Europe/Warsaw', lang: 'pl', ...over });
    const bad: [string, unknown][] = [
      ['/link/register', reg({ token: token.slice(1) })],
      ['/link/register', reg({ token: `${token.slice(1)}=` })],
      ['/link/register', reg({ subscription: subscription('https://evil.example/x') })],
      ['/link/register', reg({ subscription: { endpoint: ENDPOINT, keys: { p256dh: 'krotki', auth: sub.keys.auth } } })],
      ['/link/register', reg({ subscription: { endpoint: ENDPOINT, keys: { p256dh: sub.keys.p256dh } } })],
      ['/link/register', reg({ tz: 'Mars/Olympus' })],
      ['/link/register', reg({ lang: 'de' })],
      ['/link/register', reg({ lang: undefined })],
      ['/link/unregister', { token: 42 }],
      ['/link/notify', { token, kind: 'spam' }],
      ['/link/notify', { token, kind: 'message', at: String(T0 + HOUR) }],
      ['/link/notify', { token, kind: 'message', at: new Date(T0 + HOUR).toISOString() }],
      ['/link/notify', { token, kind: 'message', at: T0 + 401 * DAY }],
      ['/link/notify', { token, kind: 'message', ref: 'ma spacje' }],
      ['/link/notify', { token, kind: 'message', ref: 'x'.repeat(65) }],
      ['/link/notify', { token, kind: 'message', ref: '' }],
      ['/link/notify', { kind: 'message' }],
      ['/link/cancel', { token }],
      ['/link/cancel', { token, ref: 'ząb' }],
    ];
    for (const [path, data] of bad) {
      const res = await call(store, path, data);
      expect([path, data, res.status]).toEqual([path, data, 400]);
    }
    expect(await store.all()).toEqual([]);
    expect((await call(store, '/link/nowhere', { token })).status).toBe(404);
    // Pola opcjonalne jako null to brak pola, 400 dni naprzód jeszcze wolno, a przeszłość (choćby
    // najdawniejsza) i ułamek milisekundy to po prostu „teraz”.
    expect((await call(store, '/link/notify', { token, kind: 'ended', at: null, ref: null })).status).toBe(204);
    expect((await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 400 * DAY, ref: 'w_1-A' })).status).toBe(204);
    for (const at of [T0 + 0.5, 0, -1, T0 - 30 * DAY]) expect((await call(store, '/link/notify', { token, kind: 'message', at })).status).toBe(204);
  });

  it('przeszłe albo ułamkowe `at` od zarejestrowanego tokenu wychodzi od razu; zaplanowane zapisuje się w pełnych ms', async () => {
    const store = memoryStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    await call(store, '/link/notify', { token, kind: 'message', at: -1 }, { send: push.send });
    await call(store, '/link/notify', { token, kind: 'visit', at: T0 - 0.25 }, { send: push.send });
    expect(push.sent).toHaveLength(2);
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR + 0.6 });
    expect((await queued(store)).map((q) => q.at)).toEqual([T0 + HOUR + 1]);
  });
});
