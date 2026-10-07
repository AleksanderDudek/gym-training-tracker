import { describe, expect, it } from 'vitest';
import { handle } from './api';
import type { Env } from './api';
import { memoryStore } from './store';

/**
 * Uwagi od użytkowników: serwer przyjmuje wiadomość z adresem e-mail, treścią, zrzutem
 * i śladem wizyty, odrzuca śmieci i boty, a autor czyta je na stronie chronionej hasłem —
 * gdzie treść, którą ktoś wpisał, nigdy nie staje się kodem strony.
 */

const ORIGIN = 'https://aleksanderdudek.github.io';
const env: Env = {
  VAPID_PUBLIC_KEY: 'x',
  VAPID_PRIVATE_JWK: '{}',
  VAPID_SUBJECT: 'https://example.org/',
  ALLOWED_ORIGINS: ORIGIN,
  ADMIN_TOKEN: 'sekret-dlugi-na-tyle-zeby-byl-bezpieczny',
};

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const body = (over: Record<string, unknown> = {}) => ({
  email: 'ktos@example.org',
  text: 'Przycisk zapisu nie reaguje po zmianie ciężaru.',
  screenshot: PNG,
  context: { view: '#/sesja · Dziś', sessionSec: 300, activeSec: 280, events: [{ t: 3, kind: 'tap', name: 'Zapisz' }] },
  ...over,
});

const post = (data: unknown, ip = '203.0.113.7') =>
  new Request('https://api.example.workers.dev/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': ip },
    body: JSON.stringify(data),
  });

const admin = (path: string, pass?: string) =>
  new Request(`https://api.example.workers.dev${path}`, {
    headers: pass ? { Authorization: `Basic ${btoa(`autor:${pass}`)}` } : {},
  });

describe('przyjmowanie uwag', () => {
  it('zapisuje wiadomość ze śladem i zrzutem, ale bez adresu IP', async () => {
    const store = memoryStore();
    const res = await handle(post(body()), env, store);
    expect(res.status).toBe(204);
    const [f] = await store.listFeedback(10);
    expect(f!.email).toBe('ktos@example.org');
    expect(f!.view).toBe('#/sesja · Dziś');
    expect(f!.hasShot).toBe(true);
    expect(JSON.stringify(f)).not.toContain('203.0.113.7');
  });

  it('adres e-mail jest opcjonalny, ale jeśli jest — musi wyglądać na adres', async () => {
    expect((await handle(post(body({ email: '' })), env, memoryStore())).status).toBe(204);
    expect((await handle(post(body({ email: 'nie-adres' })), env, memoryStore())).status).toBe(400);
  });

  it('odrzuca pustą treść, zbyt długą treść i zrzut, który nie jest obrazkiem', async () => {
    for (const b of [body({ text: ' ' }), body({ text: 'x'.repeat(5000) }), body({ screenshot: 'data:text/html;base64,PHNjcmlwdD4=' })])
      expect((await handle(post(b), env, memoryStore())).status).toBe(400);
  });

  it('bot, który wypełnił ukryte pole, dostaje „ok”, ale nic się nie zapisuje', async () => {
    const store = memoryStore();
    expect((await handle(post(body({ website: 'http://spam.example' })), env, store)).status).toBe(204);
    expect(await store.listFeedback(10)).toEqual([]);
  });

  it('najwyżej kilka wiadomości na godzinę z jednego adresu', async () => {
    const store = memoryStore();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await handle(post(body()), env, store)).status);
    expect(codes.filter((c) => c === 204)).toHaveLength(10);
    expect(codes.at(-1)).toBe(429);
    // Inny adres — swój limit.
    expect((await handle(post(body(), '198.51.100.2'), env, store)).status).toBe(204);
  });
});

describe('podgląd dla autora', () => {
  it('bez hasła nic nie widać, a bez ustawionego hasła podglądu w ogóle nie ma', async () => {
    const r = await handle(admin('/admin/feedback'), env, memoryStore());
    expect(r.status).toBe(401);
    expect(r.headers.get('WWW-Authenticate')).toMatch(/^Basic/);
    expect((await handle(admin('/admin/feedback', 'zle'), env, memoryStore())).status).toBe(401);
    expect((await handle(admin('/admin/feedback', 'x'), { ...env, ADMIN_TOKEN: '' }, memoryStore())).status).toBe(404);
  });

  it('pokazuje wiadomości, a treść wpisana przez kogoś nigdy nie staje się kodem strony', async () => {
    const store = memoryStore();
    await handle(post(body({ text: '<script>alert(1)</script> & "cudzysłów"', email: '' })), env, store);
    const r = await handle(admin('/admin/feedback', env.ADMIN_TOKEN), env, store);
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Security-Policy')).toMatch(/default-src 'none'/);
    const html = await r.text();
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;cudzysłów&quot;');
  });

  it('zrzut ekranu wraca jako obrazek', async () => {
    const store = memoryStore();
    await handle(post(body()), env, store);
    const [f] = await store.listFeedback(1);
    const r = await handle(admin(`/admin/feedback/${f!.id}/screenshot`, env.ADMIN_TOKEN), env, store);
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await r.arrayBuffer())[1]).toBe(0x50);
  });
});
