import { describe, expect, it } from 'vitest';
import { handle, tick, validEndpoint } from './api';
import type { Env } from './api';
import { memoryStore } from './store';
import { b64u } from './webpush';

/**
 * Serwer od strony zapytań: przyjmuje listę przypomnień tylko w kształcie, który da się
 * bezpiecznie wysłać, i tylko do prawdziwych usług powiadomień — inaczej każdy mógłby kazać
 * mu stukać pod dowolny adres. Przebieg crona wysyła, zapamiętuje wysłane i sprząta martwe.
 */

const UA_PUBLIC = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const AUTH = 'BTBZMqHH6r4Tts7J_aSIgg';
const ORIGIN = 'https://aleksanderdudek.github.io';

async function env(): Promise<Env> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    VAPID_PUBLIC_KEY: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)),
    VAPID_SUBJECT: 'https://aleksanderdudek.github.io/gym-training-tracker/',
    ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
  };
}

const body = (over: Record<string, unknown> = {}) => ({
  subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: UA_PUBLIC, auth: AUTH } },
  tz: 'Europe/Warsaw',
  items: [
    { tag: 'trening', date: '2026-10-07', time: '07:30', title: 'Dziś trening: A', body: 'Plan ma termin.', url: '#/sesja' },
    { tag: 'ruch', date: '2026-10-07', time: '19:30', title: 'Kroki i ruch', body: 'Wpisz kroki.', url: '#/cardio' },
  ],
  ...over,
});

const post = (path: string, data: unknown, origin = ORIGIN) =>
  new Request(`https://push.example.workers.dev${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(data),
  });

describe('zapis subskrypcji', () => {
  it('zapisuje listę i odpowiada z nagłówkiem CORS dla strony aplikacji', async () => {
    const store = memoryStore();
    const res = await handle(post('/subscribe', body()), await env(), store);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const all = await store.all();
    expect(all).toHaveLength(1);
    expect(all[0]!.items).toHaveLength(2);
    expect(all[0]!.tz).toBe('Europe/Warsaw');
  });

  it('ponowne przesłanie podmienia listę, ale pamięta, co już wysłano', async () => {
    const store = memoryStore();
    const e = await env();
    await handle(post('/subscribe', body()), e, store);
    await store.markSent('https://fcm.googleapis.com/fcm/send/abc', ['2026-10-07|trening']);
    await handle(post('/subscribe', body({ items: [] })), e, store);
    const [r] = await store.all();
    expect(r!.items).toEqual([]);
    expect(r!.sent).toEqual(['2026-10-07|trening']);
  });

  it('odpowiada na zapytanie wstępne przeglądarki i nie wpuszcza obcych stron', async () => {
    const e = await env();
    const pre = await handle(
      new Request('https://push.example.workers.dev/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN } }),
      e,
      memoryStore(),
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    const evil = await handle(post('/subscribe', body(), 'https://evil.example'), e, memoryStore());
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('odrzuca adres spoza usług powiadomień — serwer nie stuka pod dowolny adres', async () => {
    expect(validEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(validEndpoint('https://web.push.apple.com/QGuQ')).toBe(true);
    expect(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(validEndpoint('https://wns2-db5p.notify.windows.com/w/?token=x')).toBe(true);
    expect(validEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(validEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(validEndpoint('https://169.254.169.254/latest')).toBe(false);
    const store = memoryStore();
    const res = await handle(
      post('/subscribe', body({ subscription: { endpoint: 'https://evil.example/x', keys: { p256dh: UA_PUBLIC, auth: AUTH } } })),
      await env(),
      store,
    );
    expect(res.status).toBe(400);
    expect(await store.all()).toEqual([]);
  });

  it('odrzuca listę w złym kształcie', async () => {
    const e = await env();
    const bad = [
      body({ tz: 'Mars/Olympus' }),
      body({ items: [{ ...body().items[0], time: '25:00' }] }),
      body({ items: [{ ...body().items[0], date: '7.10.2026' }] }),
      body({ items: [{ ...body().items[0], url: 'https://evil.example' }] }),
      body({ items: [{ ...body().items[0], title: 'x'.repeat(200) }] }),
      body({ items: Array.from({ length: 101 }, () => body().items[0]) }),
      body({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'krotki', auth: AUTH } } }),
    ];
    for (const b of bad) expect((await handle(post('/subscribe', b), e, memoryStore())).status).toBe(400);
  });

  it('wypisanie kasuje subskrypcję', async () => {
    const store = memoryStore();
    const e = await env();
    await handle(post('/subscribe', body()), e, store);
    const res = await handle(post('/unsubscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }), e, store);
    expect(res.status).toBe(204);
    expect(await store.all()).toEqual([]);
  });
});

describe('przebieg crona', () => {
  it('wysyła to, czemu wybiła godzina, raz, i zapamiętuje wysłane', async () => {
    const store = memoryStore();
    const e = await env();
    await handle(post('/subscribe', body()), e, store);
    const sent: Request[] = [];
    const send = async (r: Request) => {
      sent.push(r);
      return new Response(null, { status: 201 });
    };
    const at = new Date('2026-10-07T05:35:00Z'); // 07:35 w Warszawie
    expect(await tick(store, e, at, send)).toEqual({ sent: 1, removed: 0, failed: 0 });
    expect(sent[0]!.url).toBe('https://fcm.googleapis.com/fcm/send/abc');
    expect(sent[0]!.headers.get('Topic')).toBe('trening');
    expect(await tick(store, e, new Date('2026-10-07T05:40:00Z'), send)).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect((await store.all())[0]!.sent).toEqual(['2026-10-07|trening']);
  });

  it('martwą subskrypcję (404, 410) kasuje, a przy błędzie usługi próbuje w następnym przebiegu', async () => {
    const e = await env();
    const at = new Date('2026-10-07T05:35:00Z');
    const gone = memoryStore();
    await handle(post('/subscribe', body()), e, gone);
    expect(await tick(gone, e, at, async () => new Response(null, { status: 410 }))).toEqual({ sent: 0, removed: 1, failed: 0 });
    expect(await gone.all()).toEqual([]);

    const flaky = memoryStore();
    await handle(post('/subscribe', body()), e, flaky);
    expect(await tick(flaky, e, at, async () => new Response(null, { status: 503 }))).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect((await flaky.all())[0]!.sent).toEqual([]);
  });

  it('kasuje subskrypcje, których aplikacja dawno nie odświeżyła', async () => {
    const store = memoryStore();
    const e = await env();
    await handle(post('/subscribe', body()), e, store);
    const later = new Date(Date.now() + 60 * 86_400_000);
    expect((await tick(store, e, later, async () => new Response(null, { status: 201 }))).removed).toBe(1);
  });
});
