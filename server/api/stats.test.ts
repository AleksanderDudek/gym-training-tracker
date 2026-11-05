import { describe, expect, it } from 'vitest';
import { handle } from './api';
import type { Env } from './api';
import { parseStats, statsPage } from './stats';
import { memoryStore } from './store';

const ORIGIN = 'https://aleksanderdudek.github.io';
const env: Env = {
  VAPID_PUBLIC_KEY: 'x',
  VAPID_PRIVATE_JWK: '{}',
  VAPID_SUBJECT: 'https://aleksanderdudek.github.io/gym-training-tracker/',
  ALLOWED_ORIGINS: ORIGIN,
  ADMIN_TOKEN: 'haslo-do-statystyk-123',
};
const NOW = Date.parse('2026-11-05T10:00:00Z');

// Aplikacja wysyła paczkę jako text/plain (sendBeacon bez zapytania wstępnego CORS).
const post = (e: unknown, headers: Record<string, string> = {}) =>
  new Request('https://api.example/stats', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'text/plain;charset=UTF-8', ...headers },
    body: JSON.stringify({ e }),
  });

describe('POST /stats', () => {
  it('dolicza pary z listy do licznika dnia', async () => {
    const store = memoryStore();
    const res = await handle(post([['open', 'pwa'], ['screen', 'tab-train'], ['screen', 'tab-train']]), env, store, NOW);
    expect(res.status).toBe(204);
    await handle(post([['screen', 'tab-train']]), env, store, NOW);
    const rows = await store.listStats('2026-11-05');
    expect(rows).toContainEqual({ day: '2026-11-05', event: 'screen', value: 'tab-train', n: 3 });
    expect(rows).toContainEqual({ day: '2026-11-05', event: 'open', value: 'pwa', n: 1 });
  });

  it('odrzuca wszystko spoza zamkniętej listy — także tekst wpisany przez użytkownika', async () => {
    const store = memoryStore();
    for (const bad of [
      [['screen', 'Śniadanie: owsianka 450 kcal']],
      [['weight', '82.4']],
      [['open']],
      [['open', 'pwa', 'extra']],
      [],
      'open',
      Array.from({ length: 61 }, () => ['open', 'pwa']),
      [['constructor', 'pwa']],
    ]) {
      const res = await handle(post(bad), env, store, NOW);
      expect(res.status, JSON.stringify(bad).slice(0, 60)).toBe(400);
    }
    expect(await store.listStats('2000-01-01')).toEqual([]);
  });

  it('nie zapisuje adresu IP ani nagłówków — tylko dzień, zdarzenie, wartość i liczbę', async () => {
    const store = memoryStore();
    await handle(post([['lang', 'pl']], { 'CF-Connecting-IP': '203.0.113.7', 'User-Agent': 'Telefon X' }), env, store, NOW);
    const dump = JSON.stringify(await store.listStats('2000-01-01'));
    expect(dump).not.toContain('203.0.113.7');
    expect(dump).not.toContain('Telefon');
    expect(Object.keys((await store.listStats('2000-01-01'))[0]!).sort()).toEqual(['day', 'event', 'n', 'value']);
  });
});

describe('GET /admin/stats', () => {
  const get = (pass?: string) =>
    new Request('https://api.example/admin/stats', {
      headers: pass ? { Authorization: `Basic ${btoa(`autor:${pass}`)}` } : {},
    });

  it('wymaga hasła', async () => {
    expect((await handle(get(), env, memoryStore(), NOW)).status).toBe(401);
    expect((await handle(get('zle-haslo-zle-haslo'), env, memoryStore(), NOW)).status).toBe(401);
  });

  it('pokazuje tabelę bez skryptów', async () => {
    const store = memoryStore();
    await handle(post([['workout_finish', 'guided']]), env, store, Date.now());
    const res = await handle(get(env.ADMIN_TOKEN), env, store, Date.now());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    const html = await res.text();
    expect(html).toContain('Treningi zamknięte');
    expect(html).not.toContain('<script');
  });
});

describe('pulpit', () => {
  it('rzadkie liczby pokazuje jako <5', () => {
    const html = statsPage([{ day: '2026-11-05', event: 'screen', value: 'diet-labs', n: 2 }], ['2026-11-05']);
    expect(html).toContain('&lt;5');
    expect(html).not.toMatch(/>2</);
  });

  it('parseStats liczy powtórzenia', () => {
    expect(parseStats({ e: [['open', 'web'], ['open', 'web']] })?.get('open\u0000web')).toBe(2);
  });
});
