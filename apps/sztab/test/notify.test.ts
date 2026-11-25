import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `lib/notify.ts`: kształt zapytania do serwera aplikacji GYM TRACKERa, nic bez tokenu albo adresu,
 * błędy sieci po cichu, limit czasu.
 */

const env = vi.hoisted(() => ({ api: 'https://api.example.test' }));

vi.mock('../src/lib/env', async (orig) => {
  const real = await orig<typeof import('../src/lib/env')>();
  return {
    ...real,
    get TRACKER_API_URL() {
      return env.api;
    },
  };
});

const { NOTIFY_TIMEOUT_MS, canNotify, cancelNotify, notifyClient } = await import('../src/lib/notify');

const TOKEN = 'tok_A-0123456789abcdefghijklmnopqrstuvwxyzA';
const REF = '6f1c2b0e-3d4a-4f5b-9c8d-7e6f5a4b3c2d';
const c = { notifyToken: TOKEN };

let fetchMock: ReturnType<typeof vi.fn>;
const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({ url: url as string, init: init as RequestInit, body: JSON.parse((init as RequestInit).body as string) as unknown }));

beforeEach(() => {
  env.api = 'https://api.example.test';
  fetchMock = vi.fn(async () => ({ ok: true, status: 204 }) as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('notifyClient', () => {
  it('od razu: POST /link/notify z samym tokenem i rodzajem, keepalive, bez preflightu', async () => {
    expect(TOKEN).toHaveLength(43);
    await notifyClient(c, 'message');
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

  it('zaplanowane: `at` w milisekundach i numer do odwołania', async () => {
    const at = new Date('2026-12-01T07:00:00Z');
    await notifyClient(c, 'assignment', { at, ref: REF });
    expect(calls()[0]!.body).toEqual({ token: TOKEN, kind: 'assignment', at: at.getTime(), ref: REF });
  });

  it('bez tokenu, ze złym tokenem albo bez adresu serwera — nic', async () => {
    await notifyClient({ notifyToken: null }, 'message');
    await notifyClient({}, 'message');
    await notifyClient({ notifyToken: 'krótki' }, 'message');
    await notifyClient({ notifyToken: `${TOKEN.slice(0, 42)}!` }, 'message');
    env.api = '';
    await notifyClient(c, 'message');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('zły numer albo zła data zaplanowanego — nic (nie „od razu” i nie bez odwołania)', async () => {
    await notifyClient(c, 'visit-soon', { ref: 'z spacją' });
    await notifyClient(c, 'visit-soon', { ref: 'x'.repeat(65) });
    await notifyClient(c, 'visit-soon', { ref: '' });
    await notifyClient(c, 'visit-soon', { at: new Date(NaN), ref: REF });
    await notifyClient(c, 'nieznany' as never);
    expect(fetchMock).not.toHaveBeenCalled();
    await notifyClient(c, 'visit-soon', { ref: 'x'.repeat(64) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('błąd sieci albo wyjątek fetch — po cichu, bez ponawiania', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(notifyClient(c, 'message')).resolves.toBeUndefined();
    fetchMock.mockImplementationOnce(() => {
      throw new Error('keepalive quota');
    });
    await expect(notifyClient(c, 'withdrawn')).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(cancelNotify(c, REF)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it(`po ${NOTIFY_TIMEOUT_MS} ms zapytanie się poddaje (AbortController), a timer znika po odpowiedzi`, async () => {
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
    const p = notifyClient(c, 'message').then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(NOTIFY_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(signal!.aborted).toBe(true);
    expect(done).toBe(true);

    await notifyClient(c, 'message');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('cancelNotify', () => {
  it('POST /link/cancel z tokenem i numerem', async () => {
    await cancelNotify(c, REF);
    const [x] = calls();
    expect(x!.url).toBe('https://api.example.test/link/cancel');
    expect(x!.body).toEqual({ token: TOKEN, ref: REF });
    expect(x!.init.keepalive).toBe(true);
  });

  it('bez tokenu, adresu albo ze złym numerem — nic', async () => {
    await cancelNotify({ notifyToken: null }, REF);
    await cancelNotify(c, 'a/b');
    env.api = '';
    await cancelNotify(c, REF);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('canNotify', () => {
  it('tylko z tokenem i znanym serwerem aplikacji', () => {
    expect(canNotify(c)).toBe(true);
    expect(canNotify({ notifyToken: null })).toBe(false);
    expect(canNotify(null)).toBe(false);
    env.api = '';
    expect(canNotify(c)).toBe(false);
  });
});
