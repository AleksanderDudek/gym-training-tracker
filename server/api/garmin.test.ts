import { describe, expect, it } from 'vitest';
import { handle } from './api';
import type { Env } from './api';
import { BOXES_PER_HOUR, BOX_TTL_MS, PUSH_GAP_MS } from './garmin';
import { memoryStore } from './store';

/**
 * Skrzynki zegarka: serwer przyjmuje od zegarka tylko kopertę w kształcie, który da się
 * otworzyć, oddaje ją aplikacji i nie da się zasypać skrzynkami. Treści nie ogląda — nie ma
 * czym: klucz zna tylko zegarek i przeglądarka.
 */

const ORIGIN = 'https://aleksanderdudek.github.io';
const env: Env = {
  VAPID_PUBLIC_KEY: 'x',
  VAPID_PRIVATE_JWK: '{}',
  VAPID_SUBJECT: 'https://example.org/',
  ALLOWED_ORIGINS: ORIGIN,
};
// Wektor wspólny z src/watchseal.test.ts i testem na zegarku.
const BOX = '737a7eb70569826b3e8462ab4ac24904';
const BLOB = 'AaChoqOkpaanqKmqq6ytrq9nI0xALzFgri8DBZAN/yhxd7AY60ot2CVM9j2Gz9jgGIqwuDTJGghOUyekfekvvks=';
const T0 = Date.parse('2026-10-08T12:00:00Z');
const box = (i: number) => i.toString(16).padStart(32, '0');

// Zegarek nie wysyła nagłówka Origin — zapytanie wychodzi z aplikacji Garmin Connect na telefonie.
const fromWatch = (data: unknown, ip = '203.0.113.7') =>
  new Request('https://api.example.workers.dev/garmin/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(data),
  });

const fromApp = (path: string, data: unknown) =>
  new Request(`https://api.example.workers.dev${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(data),
  });

describe('skrzynka zegarka', () => {
  it('zegarek odkłada kopertę, a aplikacja ją odbiera z nagłówkiem CORS i bez pamięci podręcznej', async () => {
    const store = memoryStore();
    const put = await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0);
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ ok: true });
    const got = await handle(fromApp('/garmin/pull', { box: BOX }), env, store, T0 + 1000);
    expect(got.status).toBe(200);
    expect(got.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(got.headers.get('Cache-Control')).toBe('no-store');
    expect(await got.json()).toEqual({ blob: BLOB, updated: T0 });
  });

  it('nowsza paczka zastępuje starszą, a założenie skrzynki zostaje', async () => {
    const store = memoryStore();
    await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0);
    const other = `${'B'.repeat(84)}AAA=`;
    expect((await handle(fromWatch({ box: BOX, blob: other }), env, store, T0 + PUSH_GAP_MS)).status).toBe(200);
    expect(await store.getBox(BOX)).toMatchObject({ blob: other, updated: T0 + PUSH_GAP_MS, created: T0 });
  });

  it('pusta skrzynka to 404', async () => {
    expect((await handle(fromApp('/garmin/pull', { box: BOX }), env, memoryStore(), T0)).status).toBe(404);
  });

  it('odrzuca zły identyfikator i coś, co nie jest kopertą', async () => {
    const store = memoryStore();
    const bad = [
      { box: 'abc', blob: BLOB },
      { box: BOX.toUpperCase(), blob: BLOB },
      { box: BOX, blob: 'krótkie' },
      { box: BOX, blob: `${BLOB.slice(0, -4)}!!!=` },
      { box: BOX, blob: 'A'.repeat(12_004) },
      { box: BOX },
    ];
    for (const b of bad) expect((await handle(fromWatch(b), env, store, T0)).status).toBe(400);
    expect((await handle(fromApp('/garmin/pull', { box: 'x' }), env, store, T0)).status).toBe(400);
    expect((await handle(fromApp('/garmin/forget', {}), env, store, T0)).status).toBe(400);
    expect(await store.getBox(BOX)).toBeNull();
  });

  it('przyjmuje base64 zawinięty w linie i zapisuje go bez białych znaków', async () => {
    const store = memoryStore();
    const wrapped = `${BLOB.slice(0, 40)}\n${BLOB.slice(40)}`;
    expect((await handle(fromWatch({ box: BOX, blob: wrapped }), env, store, T0)).status).toBe(200);
    expect((await store.getBox(BOX))!.blob).toBe(BLOB);
  });

  it('ta sama skrzynka częściej niż raz na minutę dostaje 429', async () => {
    const store = memoryStore();
    await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0);
    expect((await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0 + PUSH_GAP_MS - 1)).status).toBe(429);
  });

  it('jeden adres zakłada ograniczoną liczbę skrzynek na godzinę', async () => {
    const store = memoryStore();
    for (let i = 0; i < BOXES_PER_HOUR; i++)
      expect((await handle(fromWatch({ box: box(i), blob: BLOB }), env, store, T0 + i)).status).toBe(200);
    expect((await handle(fromWatch({ box: box(999), blob: BLOB }), env, store, T0 + 100)).status).toBe(429);
    // Inny adres — bez przeszkód; istniejąca skrzynka z tego samego adresu — też.
    expect((await handle(fromWatch({ box: box(999), blob: BLOB }, '198.51.100.1'), env, store, T0 + 100)).status).toBe(200);
    expect((await handle(fromWatch({ box: box(0), blob: BLOB }), env, store, T0 + PUSH_GAP_MS)).status).toBe(200);
    // Po godzinie limit się odnawia.
    expect((await handle(fromWatch({ box: box(1000), blob: BLOB }), env, store, T0 + 3_600_001)).status).toBe(200);
  });

  it('odłączenie kasuje skrzynkę', async () => {
    const store = memoryStore();
    await handle(fromWatch({ box: BOX, blob: BLOB }), env, store, T0);
    expect((await handle(fromApp('/garmin/forget', { box: BOX }), env, store, T0)).status).toBe(204);
    expect(await store.getBox(BOX)).toBeNull();
  });

  it('sprzątanie usuwa tylko skrzynki milczące dłużej niż tydzień', async () => {
    const store = memoryStore();
    await handle(fromWatch({ box: box(1), blob: BLOB }), env, store, T0);
    await handle(fromWatch({ box: box(2), blob: BLOB }), env, store, T0 + 3_600_000);
    expect(await store.pruneBoxes(T0 + 1)).toBe(1);
    expect(await store.getBox(box(1))).toBeNull();
    expect(await store.getBox(box(2))).not.toBeNull();
    expect(BOX_TTL_MS).toBe(7 * 24 * 3_600_000);
  });
});
