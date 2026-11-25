import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { cron, handle, tick } from './api';
import type { Env, Send } from './api';
import {
  KINDS,
  LINK_TTL_MS,
  MAX_QUEUED,
  PAD_TO,
  PER_ENDPOINT_PER_RUN,
  PER_TOKEN_PER_RUN,
  REGISTRATIONS_PER_HOUR,
  SENDS_PER_HOUR,
  SENDS_PER_RUN,
  TOKENS_PER_ENDPOINT,
  TTL_NOW_S,
  TTL_QUEUED_S,
  hashToken,
  linkTick,
  payloadOf,
} from './link';
import type { Kind } from './link';
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
/** Numer zaplanowanego tak, jak liczą go dziś klienci: HMAC numeru zalecenia/rezerwacji, 32 znaki hex. */
const newRef = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

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
    ALLOWED_ORIGINS: readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8').match(/^ALLOWED_ORIGINS = "([^"]+)"$/m)![1]!,
  };
});

const subscription = (endpoint = ENDPOINT) => ({ endpoint, keys: { p256dh: b64u(ua.p256dh), auth: b64u(ua.auth) } });

const post = (path: string, data: unknown, origin = APP, ip?: string) =>
  new Request(`https://gym-tracker-api.example.workers.dev${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(ip ? { 'CF-Connecting-IP': ip } : {}) },
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
async function call(store: Store, path: string, data: unknown, o: { now?: number; send?: Send; origin?: string; ip?: string } = {}) {
  const jobs: Promise<unknown>[] = [];
  const res = await handle(
    post(path, data, o.origin, o.ip),
    env,
    store,
    o.now ?? T0,
    (p) => void jobs.push(p),
    o.send ?? pushService().send,
  );
  await Promise.all(jobs);
  return res;
}

const register = (store: Store, token: string, o: { lang?: string; now?: number; endpoint?: string; ip?: string } = {}) =>
  call(
    store,
    '/link/register',
    { token, subscription: subscription(o.endpoint), tz: 'Europe/Warsaw', lang: o.lang ?? 'pl' },
    { now: o.now, ip: o.ip },
  );

/** Cała kolejka, bez limitów przebiegu. */
const queued = (store: Store) => store.dueNotifies(T0 + 500 * DAY, { perToken: 1e4, perEndpoint: 1e4, limit: 1e4 });

/**
 * Równoległe zapytania naprawdę naraz: `method` czeka, aż wywoła ją `n` zapytań, i dopiero wtedy wszystkie
 * idą do bazy w jednej chwili — jak równoległe zapytania do D1. Bez tego kroki WebCrypto (skrót tokenu,
 * adresu) ustawiają je w kolejce i limit „trzymałby” nawet przy odczycie i zapisie osobnymi zapytaniami.
 */
function together(store: Store, method: 'reserveSend' | 'reserveRegistration', n: number): Store {
  let waiting: (() => void)[] = [];
  const gate = () =>
    new Promise<void>((resolve) => {
      waiting.push(resolve);
      if (waiting.length < n) return;
      const all = waiting;
      waiting = [];
      for (const go of all) go();
    });
  const real = store[method] as (...a: unknown[]) => Promise<unknown>;
  return {
    ...store,
    [method]: async (...a: unknown[]) => {
      await gate();
      return real(...a);
    },
  };
}

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

/** Odszyfrowuje wiadomość tak, jak zrobi to przeglądarka telefonu (z dopełnieniem zerami za znacznikiem 0x02). */
async function openPush(req: Request): Promise<{ title: string; body: string; url: string; tag: string }> {
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

const tagOf = async (r: Request) => (await openPush(r)).tag;
const sizeOf = async (r: Request) => (await r.clone().arrayBuffer()).byteLength;

/* ---------------- Magazyny: w pamięci i SQL z schema.sql ---------------- */

type Statement = ReturnType<D1Database['prepare']>;
type SyncStatement = Statement & { runSync(): void };
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
  const statement = (s: string, args: Value[] = []): SyncStatement => ({
    bind: (...v: unknown[]) => statement(s, v as Value[]),
    runSync: () => void db.prepare(s).run(...args),
    run: async () => db.prepare(s).run(...args),
    all: async <T,>() => ({ results: db.prepare(s).all(...args) as T[] }),
  });
  return d1Store({
    prepare: (s) => statement(s),
    // Jak w D1: wszystko albo nic, a w środku nie wciśnie się żadne inne zapytanie (bez `await` między
    // zapytaniami — inaczej równoległe testy przeplatałyby transakcje).
    batch: async (stmts) => {
      sql('BEGIN');
      try {
        for (const s of stmts) (s as SyncStatement).runSync();
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

  it('powiadomienie teraz: ogólny tekst w języku telefonu, trasa współpracy, rodzaj tylko w zaszyfrowanej treści', async () => {
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
    expect(a.headers.get('Authorization')).toContain(`k=${env.VAPID_PUBLIC_KEY}`);
    expect(await openPush(a)).toEqual({
      title: 'GYM TRACKER',
      body: 'Nowa wiadomość od prowadzącego',
      url: '#/wspolpraca',
      tag: 'coach-message',
    });
    expect(await openPush(b)).toEqual({
      title: 'GYM TRACKER',
      body: 'Appointment with your coach in two hours',
      url: '#/wspolpraca',
      tag: 'coach-visit-soon',
    });
    // Usługa powiadomień widzi to samo przy każdym rodzaju: temat, czas życia, pilność, rozmiar.
    for (const r of [a, b]) {
      expect(r.headers.get('Topic')).toBe('coach');
      expect(r.headers.get('TTL')).toBe(String(TTL_NOW_S));
      expect(r.headers.get('Urgency')).toBe('normal');
    }
    expect(await sizeOf(a)).toBe(await sizeOf(b));
  });

  it('nagłówki i rozmiar nie zdradzają rodzaju — każdy rodzaj w obu językach, od razu i z kolejki', async () => {
    // Każda treść mieści się w dopełnieniu — inaczej dłuższa zdradzałaby się rozmiarem.
    for (const lang of ['pl', 'en'] as const)
      for (const kind of KINDS) expect(enc.encode(JSON.stringify(payloadOf(kind, lang))).length).toBeLessThanOrEqual(PAD_TO);

    const store = await makeStore();
    const push = pushService();
    for (const lang of ['pl', 'en'] as const) {
      const token = newToken();
      await register(store, token, { lang });
      // `ended` na końcu — kasuje token.
      for (const kind of KINDS) await call(store, '/link/notify', { token, kind }, { send: push.send });
    }
    expect(push.sent).toHaveLength(2 * KINDS.length);
    const now = push.sent.splice(0);

    for (const kind of KINDS) {
      const token = newToken();
      await register(store, token, { endpoint: `${ENDPOINT}-${kind}` });
      await call(store, '/link/notify', { token, kind, at: T0 + HOUR, ref: newRef() });
    }
    await linkTick(store, env, new Date(T0 + HOUR), push.send);
    expect(push.sent).toHaveLength(KINDS.length);
    expect(new Set(await Promise.all(push.sent.map(tagOf)))).toEqual(new Set(KINDS.map((k) => `coach-${k}`)));

    const size = await sizeOf(now[0]!);
    for (const r of [...now, ...push.sent]) {
      expect(r.headers.get('Topic')).toBe('coach');
      expect(await sizeOf(r)).toBe(size);
    }
    expect(new Set(now.map((r) => r.headers.get('TTL')))).toEqual(new Set([String(TTL_NOW_S)]));
    expect(new Set(push.sent.map((r) => r.headers.get('TTL')))).toEqual(new Set([String(TTL_QUEUED_S)]));
  });

  it('nieznany token: 204 jak każdy inny, nic nie wychodzi i nic nie czeka', async () => {
    const store = await makeStore();
    await register(store, newToken());
    const push = pushService();
    const stranger = newToken();
    const ref = newRef();
    expect((await call(store, '/link/notify', { token: stranger, kind: 'message' }, { send: push.send })).status).toBe(204);
    expect((await call(store, '/link/notify', { token: stranger, kind: 'assignment', at: T0 + HOUR, ref })).status).toBe(204);
    expect((await call(store, '/link/cancel', { token: stranger, ref })).status).toBe(204);
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
    expect(await Promise.all(push.sent.map(tagOf))).toEqual(['coach-assignment', 'coach-message']);
    await call(store, '/link/notify', { token, kind: 'assignment' }, { now: T0 + 61_000, send: push.send });
    expect(push.sent).toHaveLength(3);
  });

  it('równoległe powiadomienia nie przeskoczą limitów — sprawdzenie i zapis to jeden krok', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    // Pięćdziesiąt naraz tego samego rodzaju: jedno powiadomienie.
    const fifty = together(store, 'reserveSend', 50);
    const burst = await Promise.all(Array.from({ length: 50 }, () => call(fifty, '/link/notify', { token, kind: 'message' }, { send: push.send })));
    expect(burst.every((r) => r.status === 204)).toBe(true);
    expect(push.sent).toHaveLength(1);

    // Limit godzinny: 18 w oknie, potem naraz po 5 z sześciu rodzajów — przechodzą dokładnie dwa.
    for (let i = 1; i < SENDS_PER_HOUR - 2; i++) await call(store, '/link/notify', { token, kind: 'message' }, { now: T0 + i * 61_000, send: push.send });
    expect(push.sent).toHaveLength(SENDS_PER_HOUR - 2);
    const kinds: Kind[] = ['message', 'assignment', 'withdrawn', 'visit', 'visit-cancel', 'visit-soon'];
    const thirty = together(store, 'reserveSend', kinds.length * 5);
    await Promise.all(
      kinds.flatMap((kind) => Array.from({ length: 5 }, () => call(thirty, '/link/notify', { token, kind }, { now: T0 + 30 * MIN, send: push.send }))),
    );
    expect(push.sent).toHaveLength(SENDS_PER_HOUR);
    const late = await Promise.all(push.sent.slice(-2).map(tagOf));
    expect(new Set(late).size).toBe(2);
  });

  it('zaplanowane czeka w kolejce i wychodzi raz, w przebiegu crona po swoim czasie, z krótszym czasem życia', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    const at = T0 + 3 * HOUR;
    await call(store, '/link/notify', { token, kind: 'assignment', at, ref: newRef() }, { send: push.send, origin: SZTAB });
    expect(push.sent).toEqual([]);
    expect((await linkTick(store, env, new Date(at - 5 * MIN), push.send)).sent).toBe(0);
    expect(await linkTick(store, env, new Date(at + 2 * MIN), push.send)).toMatchObject({ sent: 1, dropped: 0, failed: 0 });
    expect(await openPush(push.sent[0]!)).toMatchObject({ body: 'Nowe zalecenie od prowadzącego', tag: 'coach-assignment' });
    expect(push.sent[0]!.headers.get('TTL')).toBe(String(TTL_QUEUED_S));
    expect((await linkTick(store, env, new Date(at + 7 * MIN), push.send)).sent).toBe(0);
    expect(push.sent).toHaveLength(1);
    expect(await queued(store)).toEqual([]);
  });

  it('czas miniony (albo brak) — od razu; każdy w przyszłości, choćby o sekundy — do kolejki, nie przed czasem', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 - HOUR }, { send: push.send });
    await call(store, '/link/notify', { token, kind: 'message', at: T0 }, { send: push.send });
    expect(push.sent).toHaveLength(2);
    // Zalecenie „pokaż od” za 30 s: telefon zobaczy je dopiero o tym czasie, więc powiadomienie też nie wcześniej.
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 30_000, ref: newRef() }, { send: push.send });
    expect(push.sent).toHaveLength(2);
    expect((await queued(store)).map((q) => q.at)).toEqual([T0 + 30_000]);
    expect((await linkTick(store, env, new Date(T0 + 29_000), push.send)).sent).toBe(0);
    expect((await linkTick(store, env, new Date(T0 + 5 * MIN), push.send)).sent).toBe(1);
    expect(await tagOf(push.sent[2]!)).toBe('coach-assignment');
  });

  it('koniec współpracy kasuje token z kolejką — od razu, zatrzymany limitem i zaplanowany', async () => {
    const store = await makeStore();
    const token = newToken();
    const other = newToken();
    await register(store, token);
    await register(store, other);
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 5 * HOUR, ref: newRef() });
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 30 * HOUR, ref: newRef() });
    await call(store, '/link/notify', { token: other, kind: 'assignment', at: T0 + 5 * HOUR });
    const push = pushService();
    await call(store, '/link/notify', { token, kind: 'ended' }, { send: push.send, origin: SZTAB });
    expect(await openPush(push.sent[0]!)).toMatchObject({ body: 'Prowadzący zakończył współpracę', tag: 'coach-ended' });
    // Token zniknął: były prowadzący już niczego nie wyśle ani nie zaplanuje, zanim telefon zauważy koniec.
    expect(await store.linkTarget(await hashToken(token))).toBeNull();
    await call(store, '/link/notify', { token, kind: 'message' }, { now: T0 + 2 * MIN, send: push.send });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR }, { now: T0 + 2 * MIN });
    expect(push.sent).toHaveLength(1);
    // Kolejka innej współpracy i subskrypcja zostają.
    expect((await queued(store)).map((q) => q.kind)).toEqual(['assignment']);
    expect(await store.all()).toHaveLength(1);

    // Nawet zatrzymany limitem koniec kasuje token i kolejkę.
    for (let i = 0; i < SENDS_PER_HOUR; i++) await call(store, '/link/notify', { token: other, kind: 'message' }, { now: T0 + i * 61_000 });
    await call(store, '/link/notify', { token: other, kind: 'ended' }, { now: T0 + 30 * MIN, send: push.send });
    expect(push.sent).toHaveLength(1);
    expect(await store.linkTarget(await hashToken(other))).toBeNull();
    expect(await queued(store)).toEqual([]);

    // Zaplanowany koniec: w przebiegu crona wychodzi, kasuje token i zabiera resztę kolejki, także późniejszą.
    const later = newToken();
    await register(store, later);
    await call(store, '/link/notify', { token: later, kind: 'ended', at: T0 + HOUR });
    await call(store, '/link/notify', { token: later, kind: 'message', at: T0 + HOUR });
    await call(store, '/link/notify', { token: later, kind: 'assignment', at: T0 + 9 * HOUR });
    const cron = pushService();
    expect(await linkTick(store, env, new Date(T0 + HOUR), cron.send)).toMatchObject({ sent: 1 });
    expect(cron.sent).toHaveLength(1);
    expect(await tagOf(cron.sent[0]!)).toBe('coach-ended');
    expect(await store.linkTarget(await hashToken(later))).toBeNull();
    expect(await queued(store)).toEqual([]);
  });

  it('odwołanie po numerze kasuje zaplanowane', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const visit = newRef();
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 5 * HOUR, ref: visit });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 5 * HOUR, ref: newRef() });
    expect((await call(store, '/link/cancel', { token, ref: visit }, { origin: SZTAB })).status).toBe(204);
    const push = pushService();
    expect((await linkTick(store, env, new Date(T0 + 5 * HOUR), push.send)).sent).toBe(1);
    expect(await openPush(push.sent[0]!)).toMatchObject({ tag: 'coach-assignment' });
  });

  it('ten sam numer podmienia zaplanowane; natychmiastowe tego rodzaju je zastępuje, innego rodzaju — nie', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const z = newRef();
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 2 * HOUR, ref: z });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 6 * HOUR, ref: z });
    expect((await queued(store)).map((q) => [q.kind, q.at, q.ref])).toEqual([['assignment', T0 + 6 * HOUR, z]]);

    // Wizyta: „zapisał cię” od razu nie kasuje „za dwie godziny” z tym samym numerem.
    const w = newRef();
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 20 * HOUR, ref: w });
    await call(store, '/link/notify', { token, kind: 'visit', ref: w });
    // Zalecenie pokazane jednak od razu: zaplanowane tego samego rodzaju i numeru znika.
    await call(store, '/link/notify', { token, kind: 'assignment', ref: z });
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

  it('nieudana wysyłka z kolejki: następna próba po 5, potem po 20 minutach, po trzeciej przepada', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR, ref: newRef() });
    const down = pushService(503);
    const run = (after: number) => linkTick(store, env, new Date(T0 + HOUR + after), down.send);
    expect(await run(0)).toMatchObject({ sent: 0, failed: 1, dropped: 0 });
    expect(await run(4 * MIN)).toMatchObject({ failed: 0 });
    expect(await run(5 * MIN)).toMatchObject({ failed: 1, dropped: 0 });
    expect(await run(24 * MIN)).toMatchObject({ failed: 0 });
    expect(await run(25 * MIN)).toMatchObject({ failed: 1, dropped: 1 });
    expect(down.sent).toHaveLength(3);
    expect(await queued(store)).toEqual([]);

    // Sieć i wyjątki to też nieudana próba; usługa wraca — wychodzi w następnym przebiegu po odstępie.
    await call(store, '/link/notify', { token, kind: 'message', at: T0 + 2 * HOUR });
    const thrown: Send = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await linkTick(store, env, new Date(T0 + 2 * HOUR), thrown)).toMatchObject({ failed: 1 });
    const ok = pushService();
    expect(await linkTick(store, env, new Date(T0 + 2 * HOUR + 5 * MIN), ok.send)).toMatchObject({ sent: 1 });

    // Przypomnienie o wizycie godzinę po swoim czasie już nie wychodzi — przepada bez próby.
    await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 3 * HOUR, ref: newRef() });
    expect(await linkTick(store, env, new Date(T0 + 4 * HOUR + MIN), ok.send)).toMatchObject({ sent: 0, dropped: 1 });
    expect(ok.sent).toHaveLength(1);
  });

  it('zepsuta subskrypcja z dziesięcioma tokenami i pełną kolejką nie blokuje cudzych zaplanowanych', async () => {
    const store = await makeStore();
    // Ktoś zakłada subskrypcję własnym kluczem VAPID (usługa odpowie nam 403), dziesięć tokenów i po
    // pięć zaplanowanych na każdy — wszystkie wcześniej niż cudze.
    const BAD = 'https://fcm.googleapis.com/fcm/send/zly';
    for (let t = 0; t < TOKENS_PER_ENDPOINT; t++) {
      const token = newToken();
      await register(store, token, { endpoint: BAD });
      for (const [i, kind] of (['message', 'assignment', 'withdrawn', 'visit', 'visit-cancel'] as const).entries())
        await call(store, '/link/notify', { token, kind, at: T0 + 10 * MIN + i, ref: newRef() });
    }
    const good = newToken();
    await register(store, good);
    await call(store, '/link/notify', { token: good, kind: 'assignment', at: T0 + HOUR, ref: newRef() });

    const urls: string[] = [];
    const send: Send = async (r) => {
      urls.push(r.url);
      return new Response(null, { status: r.url === BAD ? 403 : 201 });
    };
    expect(await linkTick(store, env, new Date(T0 + HOUR), send)).toMatchObject({ sent: 1, failed: 1 });
    expect(urls).toEqual([BAD, ENDPOINT]);
    // Kolejne przebiegi: zepsuta subskrypcja dostaje najwyżej jedną próbę na przebieg.
    for (let run = 1; run < 24; run++) {
      const before = urls.length;
      await linkTick(store, env, new Date(T0 + HOUR + run * 5 * MIN), send);
      expect(urls.length - before).toBeLessThanOrEqual(1);
    }
  });

  it('nawet kilkanaście zepsutych subskrypcji opóźnia cudze zaplanowane najwyżej o jeden przebieg', async () => {
    const store = await makeStore();
    const bad = Array.from({ length: SENDS_PER_RUN + 2 }, (_, i) => `https://fcm.googleapis.com/fcm/send/zly-${i}`);
    for (const endpoint of bad) {
      const token = newToken();
      await register(store, token, { endpoint });
      for (const kind of ['message', 'assignment', 'visit'] as const) await call(store, '/link/notify', { token, kind, at: T0 + 10 * MIN });
    }
    const good = newToken();
    await register(store, good);
    await call(store, '/link/notify', { token: good, kind: 'assignment', at: T0 + HOUR - 1 });
    const urls: string[] = [];
    const send: Send = async (r) => {
      urls.push(r.url);
      return new Response(null, { status: r.url === ENDPOINT ? 201 : 403 });
    };
    await linkTick(store, env, new Date(T0 + HOUR), send);
    expect(urls).toHaveLength(SENDS_PER_RUN);
    await linkTick(store, env, new Date(T0 + HOUR + 5 * MIN), send);
    expect(urls).toContain(ENDPOINT);
  });

  it(`przebieg bierze po kolei: najwyżej ${PER_TOKEN_PER_RUN} na token, ${PER_ENDPOINT_PER_RUN} na telefon, ${SENDS_PER_RUN} razem`, async () => {
    const store = await makeStore();
    const A = `${ENDPOINT}-a`;
    const B = `${ENDPOINT}-b`;
    const C = `${ENDPOINT}-c`;
    const a = newToken();
    await register(store, a, { endpoint: A });
    for (const kind of ['message', 'assignment', 'withdrawn', 'visit', 'visit-cancel', 'visit-soon'] as const)
      await call(store, '/link/notify', { token: a, kind, at: T0 + HOUR });
    for (const [endpoint, n] of [[B, 8], [C, 4]] as const)
      for (let i = 0; i < n; i++) {
        const token = newToken();
        await register(store, token, { endpoint });
        await call(store, '/link/notify', { token, kind: 'message', at: T0 + HOUR });
      }
    const per = async (after: number) => {
      const push = pushService();
      await linkTick(store, env, new Date(T0 + HOUR + after), push.send);
      const n: Record<string, number> = {};
      for (const r of push.sent) n[r.url] = (n[r.url] ?? 0) + 1;
      return n;
    };
    // Najpierw pierwsze każdego tokenu (z B tylko pięć), dopiero potem drugie i trzecie z A.
    expect(await per(0)).toEqual({ [A]: 1, [B]: 5, [C]: 4 });
    expect(await per(5 * MIN)).toEqual({ [A]: 3, [B]: 3 });
    expect(await per(10 * MIN)).toEqual({ [A]: 2 });
    expect(await queued(store)).toEqual([]);
  });

  it('wysyłki z kolejki liczą się do tego samego godzinnego limitu; ponad limit czekają, nie przepadają', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const push = pushService();
    for (let i = 0; i < SENDS_PER_HOUR; i++) await call(store, '/link/notify', { token, kind: 'message' }, { now: T0 + i * 61_000, send: push.send });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 30 * MIN, ref: newRef() });
    expect(await linkTick(store, env, new Date(T0 + 30 * MIN), push.send)).toMatchObject({ sent: 0, deferred: 1, dropped: 0 });
    expect(await queued(store)).toHaveLength(1);
    // Czeka, aż zwolni się miejsce — godzinę po pierwszej wysyłce; wcześniejsze przebiegi go nie ruszają.
    expect(await linkTick(store, env, new Date(T0 + 55 * MIN), push.send)).toMatchObject({ sent: 0, deferred: 0 });
    expect(await linkTick(store, env, new Date(T0 + HOUR), push.send)).toMatchObject({ sent: 1 });
    expect(push.sent).toHaveLength(SENDS_PER_HOUR + 1);
    // Wysłane z kolejki zajęło miejsce w limicie — natychmiastowe zaraz potem już nie przejdzie.
    await call(store, '/link/notify', { token, kind: 'visit' }, { now: T0 + HOUR + 30_000, send: push.send });
    expect(push.sent).toHaveLength(SENDS_PER_HOUR + 1);
  });

  it('dwa przebiegi crona naraz nie wyślą tego samego dwa razy', async () => {
    const store = await makeStore();
    for (let i = 0; i < 4; i++) {
      const token = newToken();
      await register(store, token, { endpoint: `${ENDPOINT}-${i}` });
      await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR, ref: newRef() });
      await call(store, '/link/notify', { token, kind: 'message', at: T0 + HOUR });
    }
    const push = pushService();
    const [a, b] = await Promise.all([linkTick(store, env, new Date(T0 + HOUR), push.send), linkTick(store, env, new Date(T0 + HOUR), push.send)]);
    expect(a.sent + b.sent).toBe(8);
    expect(push.sent).toHaveLength(8);
    expect(await queued(store)).toEqual([]);
  });

  it('dwa przebiegi naraz przy niedziałającej usłudze: każde wzięte raz, nic nie przepada', async () => {
    const store = await makeStore();
    for (let i = 0; i < 4; i++) {
      const token = newToken();
      await register(store, token, { endpoint: `${ENDPOINT}-${i}` });
      await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR, ref: newRef() });
    }
    const down = pushService(503);
    const at = new Date(T0 + HOUR);
    await Promise.all([linkTick(store, env, at, down.send), linkTick(store, env, at, down.send)]);
    // Drugi przebieg nie wziął tego, co pierwszy właśnie wysyłał (dzierżawa), więc nie uznał go za powtórkę
    // i nie skasował: każde czeka na następną próbę.
    expect(down.sent).toHaveLength(4);
    expect((await queued(store)).map((q) => q.attempts)).toEqual([1, 1, 1, 1]);
    const ok = pushService();
    expect(await linkTick(store, env, new Date(T0 + HOUR + 5 * MIN), ok.send)).toMatchObject({ sent: 4 });
  });

  it('cron: kilka zaplanowanych tego samego rodzaju naraz — jedno powiadomienie; bez tokenu — do kosza', async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR, ref: newRef() });
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR, ref: newRef() });
    await call(store, '/link/notify', { token, kind: 'message', at: T0 + HOUR });
    // Osierocone (token zniknął w międzyczasie) — nie ma do kogo wysłać.
    await store.queueNotify({ hash: 'f'.repeat(64), kind: 'message', at: T0, ref: null, expires: T0 + DAY }, MAX_QUEUED);
    const push = pushService();
    expect(await linkTick(store, env, new Date(T0 + HOUR), push.send)).toMatchObject({ sent: 2, dropped: 1 });
    expect((await Promise.all(push.sent.map(tagOf))).sort()).toEqual(['coach-assignment', 'coach-message']);
    expect(await queued(store)).toEqual([]);
  });

  it(`kolejka: najwyżej ${MAX_QUEUED} zaplanowanych na token; po terminie przepadają wszystkie naraz, bez wysyłki`, async () => {
    const store = await makeStore();
    const token = newToken();
    await register(store, token);
    const refs = Array.from({ length: MAX_QUEUED + 5 }, newRef);
    for (const [i, ref] of refs.entries()) await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + HOUR + i * MIN, ref });
    expect(await queued(store)).toHaveLength(MAX_QUEUED);
    // Podmiana po numerze przy pełnej kolejce przechodzi.
    await call(store, '/link/notify', { token, kind: 'assignment', at: T0 + 10 * DAY, ref: refs[7] });
    const all = await queued(store);
    expect(all).toHaveLength(MAX_QUEUED);
    expect(all.find((q) => q.ref === refs[7])?.at).toBe(T0 + 10 * DAY);
    // Doba po czasie — wszystkie do kosza w jednym przebiegu, bez limitu przebiegu.
    const push = pushService();
    expect(await linkTick(store, env, new Date(T0 + 12 * DAY), push.send)).toMatchObject({ sent: 0, dropped: MAX_QUEUED });
    expect(push.sent).toEqual([]);
    expect(await queued(store)).toEqual([]);
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

  it(`rejestracja: najwyżej ${REGISTRATIONS_PER_HOUR} na godzinę z jednego adresu, także naraz`, async () => {
    const store = await makeStore();
    const IP = '203.0.113.7';
    const all = together(store, 'reserveRegistration', REGISTRATIONS_PER_HOUR + 10);
    const burst = await Promise.all(Array.from({ length: REGISTRATIONS_PER_HOUR + 10 }, () => register(all, newToken(), { ip: IP })));
    expect(burst.filter((r) => r.status === 204)).toHaveLength(REGISTRATIONS_PER_HOUR);
    const refused = burst.filter((r) => r.status === 429);
    expect(refused).toHaveLength(10);
    expect(refused[0]!.headers.get('Access-Control-Allow-Origin')).toBe(APP);
    // Odrzucona rejestracja niczego nie zapisuje.
    const late = newToken();
    expect((await register(store, late, { ip: IP, now: T0 + 30 * MIN })).status).toBe(429);
    expect(await store.linkTarget(await hashToken(late))).toBeNull();
    // Inny adres ma swój limit; po godzinie (i sprzątaniu w cronie) ten sam znowu może.
    expect((await register(store, newToken(), { ip: '198.51.100.1', now: T0 + 30 * MIN })).status).toBe(204);
    await linkTick(store, env, new Date(T0 + HOUR + MIN), pushService().send);
    expect((await register(store, late, { ip: IP, now: T0 + HOUR + MIN })).status).toBe(204);
    expect(await store.linkTarget(await hashToken(late))).not.toBeNull();
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

describe('przebieg crona: przypomnienia, potem zaplanowane od prowadzącego, każde osobno', () => {
  /** Subskrypcja z przypomnieniem na 7:30 w Warszawie i token z zaplanowanym na tę samą chwilę. */
  async function setup(store: Store) {
    const at = Date.parse('2026-11-26T06:35:00Z');
    const items = [{ tag: 'trening', date: '2026-11-26', time: '07:30', title: 'Dziś trening', body: '', url: '#/sesja' }];
    await call(store, '/subscribe', { subscription: subscription(), tz: 'Europe/Warsaw', items }, { now: at - HOUR });
    const token = newToken();
    await register(store, token, { now: at - HOUR, endpoint: `${ENDPOINT}-coach` });
    await call(store, '/link/notify', { token, kind: 'message', at: at - MIN }, { now: at - HOUR });
    return new Date(at);
  }

  it('przypomnienia wychodzą pierwsze; dziennik ma osobne części', async () => {
    const store = memoryStore();
    const now = await setup(store);
    const push = pushService();
    const r = await cron(store, env, now, push.send);
    expect(r).toEqual({
      reminders: { sent: 1, removed: 0, failed: 0 },
      coach: { sent: 1, failed: 0, deferred: 0, dropped: 0, removed: 0, pruned: 0 },
      boxes: 0,
    });
    expect(push.sent.map((q) => q.url)).toEqual([ENDPOINT, `${ENDPOINT}-coach`]);
  });

  it('błąd jednej części nie zatrzymuje pozostałych', async () => {
    const broken = async (over: Partial<Store>) => {
      const store = memoryStore();
      const now = await setup(store);
      return { store: { ...store, ...over }, now };
    };
    const noCoach = await broken({
      dueNotifies: async () => {
        throw new Error('D1 nie odpowiada');
      },
    });
    expect(await cron(noCoach.store, env, noCoach.now, pushService().send)).toMatchObject({
      reminders: { sent: 1 },
      coach: { error: 'D1 nie odpowiada' },
      boxes: 0,
    });

    const noReminders = await broken({
      all: async () => {
        throw new Error('subs nie odpowiada');
      },
    });
    const push = pushService();
    expect(await cron(noReminders.store, env, noReminders.now, push.send)).toMatchObject({
      reminders: { error: 'subs nie odpowiada' },
      coach: { sent: 1 },
    });
    expect(push.sent.map((q) => q.url)).toEqual([`${ENDPOINT}-coach`]);
  });

  it('wyjątek przy jednej subskrypcji przypomnień (sieć) nie przerywa przebiegu', async () => {
    const store = memoryStore();
    const now = await setup(store);
    const other = `${ENDPOINT}-druga`;
    const items = [{ tag: 'trening', date: '2026-11-26', time: '07:30', title: 'Dziś trening', body: '', url: '#/sesja' }];
    await call(store, '/subscribe', { subscription: subscription(other), tz: 'Europe/Warsaw', items }, { now: now.getTime() - HOUR });
    const ok: string[] = [];
    const send: Send = async (r) => {
      if (r.url === ENDPOINT) throw new TypeError('fetch failed');
      ok.push(r.url);
      return new Response(null, { status: 201 });
    };
    expect(await tick(store, env, now, send)).toEqual({ sent: 1, removed: 0, failed: 1 });
    expect(ok).toEqual([other]);
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
    const dev = await call(store, '/link/cancel', { token: newToken(), ref: newRef() }, { origin: 'http://localhost:5190' });
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

    const ref = newRef();
    await handle(plain('/link/notify', { token, kind: 'visit-soon', at: T0 + 3 * HOUR, ref }), env, store, T0);
    expect(await queued(store)).toHaveLength(1);
    const cancel = await handle(plain('/link/cancel', { token, ref }), env, store, T0);
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
    // najdawniejsza) to po prostu „teraz”. Numer: dzisiejszy (32 znaki hex) i dawny kształt — oba przechodzą.
    expect((await call(store, '/link/notify', { token, kind: 'ended', at: null, ref: null })).status).toBe(204);
    expect((await call(store, '/link/notify', { token, kind: 'visit-soon', at: T0 + 400 * DAY, ref: newRef() })).status).toBe(204);
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
