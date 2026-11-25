import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AAD, generateIdentity, linkKey, notifyRef, sealJson } from '@gymtracker/link';
import type { Identity } from '@gymtracker/link';

/**
 * `lib/notify.ts`: token zapieczętowany kluczem współpracy, otwierany dopiero w chwili wysyłki kluczem
 * prowadzącego; pieczęć świeżo z bazy (z krótką pamięcią dla wysyłek), numery zaplanowanych jako HMAC,
 * kształt zapytania do serwera aplikacji GYM TRACKERa, błędy po cichu, limit czasu.
 */

const env = vi.hoisted(() => ({ api: 'https://api.example.test' }));

/** Baza: wiersze `connections` (to, co widzi prowadzący przez RLS) i licznik odczytów pieczęci. */
const db = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  reads: 0,
  fail: false,
}));

vi.mock('../src/lib/env', async (orig) => {
  const real = await orig<typeof import('../src/lib/env')>();
  return {
    ...real,
    get TRACKER_API_URL() {
      return env.api;
    },
  };
});

vi.mock('../src/lib/sb', () => ({
  errorCode: (e: { message?: string } | null) => e?.message ?? 'unknown',
  sb: {
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, id: string) => ({
          maybeSingle: async () => {
            db.reads++;
            expect(table).toBe('connections');
            expect(cols).toBe('notify_token, invite_id, client_public_key');
            expect(col).toBe('id');
            if (db.fail) return { data: null, error: { message: 'offline' } };
            const r = db.rows.get(id);
            return { data: r ? { ...r } : null, error: null };
          },
        }),
      }),
    }),
  },
}));

const { NOTIFY_CACHE_MS, NOTIFY_TIMEOUT_MS, canNotify, forgetNotify, notifierFor, notifyIdle, notifyLater, tokenNotifier } = await import('../src/lib/notify');

const TOKEN = 'tok_A-0123456789abcdefghijklmnopqrstuvwxyzA';
const REF = '6f1c2b0e-3d4a-4f5b-9c8d-7e6f5a4b3c2d';
const coach = await generateIdentity();

/** Współpraca, jak ją widzi telefon: jego klucze, numer zaproszenia i pieczęć tokenu tym, co liczy telefon. */
interface Phone {
  id: string;
  inviteId: string;
  me: Identity;
}

async function phone(): Promise<Phone> {
  return { id: crypto.randomUUID(), inviteId: crypto.randomUUID(), me: await generateIdentity() };
}

/** Pieczęć dokładnie tak, jak robi ją telefon (`client_set_notify`): klucz współpracy z jego strony. */
async function seal(p: Phone, value: unknown, aad = AAD.notify(p.id), who: Identity = p.me): Promise<string> {
  return sealJson(await linkKey(who.privateKey, coach.publicJwk, p.inviteId), aad, value);
}

function store(p: Phone, notifyToken: string | null): void {
  db.rows.set(p.id, { notify_token: notifyToken, invite_id: p.inviteId, client_public_key: p.me.publicJwk });
}

async function enabled(token = TOKEN): Promise<Phone> {
  const p = await phone();
  store(p, await seal(p, { v: 1, token }));
  return p;
}

let fetchMock: ReturnType<typeof vi.fn>;
const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({ url: url as string, init: init as RequestInit, body: JSON.parse((init as RequestInit).body as string) as Record<string, unknown> }));

beforeEach(() => {
  env.api = 'https://api.example.test';
  db.rows.clear();
  db.reads = 0;
  db.fail = false;
  forgetNotify();
  fetchMock = vi.fn(async () => ({ ok: true, status: 204 }) as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Pieczęć tokenu', () => {
  it('otwiera token zapieczętowany przez telefon i woła POST /link/notify samym tokenem i rodzajem, bez preflightu', async () => {
    const p = await enabled();
    const n = await notifierFor(coach.privateKey, p.id);
    expect(n).not.toBeNull();
    await n!.notify('message');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [x] = calls();
    expect(x!.url).toBe('https://api.example.test/link/notify');
    expect(x!.body).toEqual({ token: TOKEN, kind: 'message' });
    expect(x!.init.method).toBe('POST');
    expect(x!.init.keepalive).toBe(true);
    expect(x!.init.credentials).toBe('omit');
    expect(x!.init.signal).toBeInstanceOf(AbortSignal);
    // Bez `Content-Type: application/json` — proste zapytanie CORS, bez OPTIONS przed nim.
    expect(x!.init.headers).toBeUndefined();
  });

  it('odmawia pieczęci podrobionej albo cudzej: inna współpraca (zły AAD), inny klucz, śmieci, zły środek, jawny token', async () => {
    const other = await phone();
    const stranger = await generateIdentity();
    const cases: [string, (p: Phone) => Promise<string | null>][] = [
      ['pieczęć z innej współpracy (AAD)', (p) => seal(p, { v: 1, token: TOKEN }, AAD.notify(other.id))],
      ['pieczęć innym kluczem', (p) => seal(p, { v: 1, token: TOKEN }, AAD.notify(p.id), stranger)],
      ['pieczęć zalecenia, nie tokenu (AAD)', (p) => seal(p, { v: 1, token: TOKEN }, AAD.assignment(p.id, p.id))],
      ['śmieci', async () => `v1.${'A'.repeat(80)}`],
      ['inna wersja', (p) => seal(p, { v: 2, token: TOKEN })],
      ['zły kształt tokenu', (p) => seal(p, { v: 1, token: 'krótki' })],
      ['jawny token zamiast pieczęci', async () => TOKEN],
      ['brak', async () => null],
    ];
    for (const [name, make] of cases) {
      const p = await phone();
      store(p, await make(p));
      expect(await notifierFor(coach.privateKey, p.id), name).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bez adresu serwera aplikacji — nic, nawet odczytu bazy', async () => {
    const p = await enabled();
    env.api = '';
    expect(await notifierFor(coach.privateKey, p.id)).toBeNull();
    notifyLater(coach.privateKey, p.id, (n) => [n.notify('message')]);
    await notifyIdle();
    expect(db.reads).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('błąd bazy — po cichu `null`; błąd nie zostaje w pamięci', async () => {
    const p = await enabled();
    db.fail = true;
    expect(await notifierFor(coach.privateKey, p.id)).toBeNull();
    db.fail = false;
    expect(await notifierFor(coach.privateKey, p.id)).not.toBeNull();
    expect(db.reads).toBe(2);
  });
});

describe('Świeży token', () => {
  it('telefon włączył powiadomienia po wczytaniu strony — odwołanie (`fresh`) czyta bazę od nowa', async () => {
    const p = await phone();
    store(p, null);
    expect(await notifierFor(coach.privateKey, p.id)).toBeNull();
    // Telefon zostawia pieczęć, gdy strona prowadzącego jest już otwarta.
    store(p, await seal(p, { v: 1, token: TOKEN }));
    const n = await notifierFor(coach.privateKey, p.id, { fresh: true });
    await n!.cancel(REF);
    expect(calls()[0]!.body).toEqual({ token: TOKEN, ref: await notifyRef(TOKEN, REF) });
  });

  it(`wysyłki do wielu: jeden odczyt bazy na ${NOTIFY_CACHE_MS / 1000} s, potem od nowa`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const p = await enabled();
    for (let i = 0; i < 5; i++) notifyLater(coach.privateKey, p.id, (n) => [n.notify('assignment')]);
    await notifyIdle();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(db.reads).toBe(1);

    // Telefon wyłączył powiadomienia: najwyżej pół minuty starej pieczęci (serwer i tak już nie zna tokenu).
    store(p, null);
    vi.advanceTimersByTime(NOTIFY_CACHE_MS - 1);
    expect(await notifierFor(coach.privateKey, p.id)).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(await notifierFor(coach.privateKey, p.id)).toBeNull();
    expect(db.reads).toBe(2);
  });

  it('`forgetNotify` (koniec współpracy, wylogowanie) zapomina pieczęć', async () => {
    const p = await enabled();
    await notifierFor(coach.privateKey, p.id);
    forgetNotify(p.id);
    await notifierFor(coach.privateKey, p.id);
    forgetNotify();
    await notifierFor(coach.privateKey, p.id);
    expect(db.reads).toBe(3);
  });
});

describe('Numery zaplanowanych', () => {
  it('`ref` to HMAC tokenem (32 znaki hex), nigdy numer z bazy — ten sam, który liczy telefon', async () => {
    const n = tokenNotifier(TOKEN)!;
    const at = new Date('2026-12-01T07:00:00Z');
    await n.notify('assignment', { at, ref: REF });
    await n.cancel(REF);
    const hmac = await notifyRef(TOKEN, REF);
    expect(hmac).toMatch(/^[0-9a-f]{32}$/);
    expect(calls().map((c) => [c.url, c.body])).toEqual([
      ['https://api.example.test/link/notify', { token: TOKEN, kind: 'assignment', at: at.getTime(), ref: hmac }],
      ['https://api.example.test/link/cancel', { token: TOKEN, ref: hmac }],
    ]);
    // Numer z bazy nie wychodzi z przeglądarki w żadnej postaci.
    for (const c of calls()) expect(JSON.stringify(c.body)).not.toContain(REF.slice(0, 8));
    // Inny token — inny numer: serwer nie połączy zaplanowanych dwóch współprac po numerze zalecenia.
    expect(await notifyRef(`B${TOKEN.slice(1)}`, REF)).not.toBe(hmac);
  });
});

describe('tokenNotifier', () => {
  it('zły kształt tokenu — brak nadawcy', () => {
    expect(tokenNotifier('krótki')).toBeNull();
    expect(tokenNotifier(`${TOKEN.slice(0, 42)}!`)).toBeNull();
    expect(tokenNotifier(42 as never)).toBeNull();
  });

  it('zły numer albo zła data zaplanowanego — nic (nie „od razu” i nie bez odwołania)', async () => {
    const n = tokenNotifier(TOKEN)!;
    await n.notify('visit-soon', { ref: 'z spacją' });
    await n.notify('visit-soon', { ref: 'x'.repeat(65) });
    await n.notify('visit-soon', { ref: '' });
    await n.notify('visit-soon', { at: new Date(NaN), ref: REF });
    await n.notify('nieznany' as never);
    await n.cancel('a/b');
    env.api = '';
    await n.notify('message');
    await n.cancel(REF);
    expect(fetchMock).not.toHaveBeenCalled();
    env.api = 'https://api.example.test';
    await n.notify('visit-soon', { ref: 'x'.repeat(64) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('błąd sieci albo wyjątek fetch — po cichu, bez ponawiania', async () => {
    const n = tokenNotifier(TOKEN)!;
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(n.notify('message')).resolves.toBeUndefined();
    fetchMock.mockImplementationOnce(() => {
      throw new Error('keepalive quota');
    });
    await expect(n.notify('withdrawn')).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(n.cancel(REF)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it(`po ${NOTIFY_TIMEOUT_MS} ms zapytanie się poddaje (AbortController), a timer znika po odpowiedzi`, async () => {
    const n = tokenNotifier(TOKEN)!;
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_ok, bad) => {
          signal = init.signal!;
          signal.addEventListener('abort', () => bad(new DOMException('aborted', 'AbortError')));
        }),
    );
    let done = false;
    const p = n.notify('message').then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(NOTIFY_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(signal!.aborted).toBe(true);
    expect(done).toBe(true);

    await n.notify('message');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('canNotify', () => {
  it('pieczęć przy wczytaniu i znany serwer aplikacji', () => {
    expect(canNotify({ notifySealed: true })).toBe(true);
    expect(canNotify({ notifySealed: false })).toBe(false);
    expect(canNotify({})).toBe(false);
    expect(canNotify(null)).toBe(false);
    env.api = '';
    expect(canNotify({ notifySealed: true })).toBe(false);
  });
});
