import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle } from './api';
import type { Env } from './api';
import { discordPayload, discordRequest, notifyDiscord, shotFile, validWebhook } from './discord';
import { memoryStore } from './store';
import type { FeedbackRecord } from './store';

/**
 * Uwagi na kanale autora na Discordzie: najpierw baza, potem kopia przez webhook — w tle, bez
 * śladu wizyty, bez wołania kogokolwiek, i tylko pod adres webhooka Discorda.
 */

const ORIGIN = 'https://aleksanderdudek.github.io';
const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abc-DEF_123';
const env: Env = {
  VAPID_PUBLIC_KEY: 'x',
  VAPID_PRIVATE_JWK: '{}',
  VAPID_SUBJECT: 'https://example.org/',
  ALLOWED_ORIGINS: ORIGIN,
  ADMIN_TOKEN: 'sekret-dlugi-na-tyle-zeby-byl-bezpieczny',
  DISCORD_WEBHOOK_URL: WEBHOOK,
};

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const record: FeedbackRecord = {
  id: '0b3c1f6e-6b1e-4d7a-9b8e-2f3a4c5d6e7f',
  created: Date.UTC(2026, 9, 20, 18, 30),
  email: 'ktos@example.org',
  text: 'Lista zakupów nie zapamiętuje odhaczenia. @everyone',
  view: '#/jedzenie/zakupy · Lista zakupów',
  context: '{"events":[{"t":3,"kind":"tap","name":"Skyr"}]}',
  screenshot: PNG,
  ipHash: 'abc',
};

const post = (data: unknown) =>
  new Request('https://api.example.workers.dev/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.7' },
    body: JSON.stringify(data),
  });

const body = (over: Record<string, unknown> = {}) => ({
  email: 'ktos@example.org',
  text: 'Przycisk zapisu nie reaguje.',
  screenshot: PNG,
  context: { view: '#/sesja · Dziś', events: [] },
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('adres webhooka', () => {
  it('tylko webhook Discorda, przez https', () => {
    expect(validWebhook(WEBHOOK)).toBe(true);
    expect(validWebhook('https://discordapp.com/api/webhooks/1/x')).toBe(true);
    expect(validWebhook('https://ptb.discord.com/api/webhooks/1/x')).toBe(true);
    expect(validWebhook('http://discord.com/api/webhooks/1/x')).toBe(false);
    expect(validWebhook('https://discord.com.evil.example/api/webhooks/1/x')).toBe(false);
    expect(validWebhook('https://example.org/api/webhooks/1/x')).toBe(false);
    expect(validWebhook('')).toBe(false);
    expect(validWebhook(undefined)).toBe(false);
  });
});

describe('wiadomość na kanale', () => {
  it('treść, ekran, e-mail, odnośnik do listy i godzina — bez śladu wizyty i bez wołania kogokolwiek', () => {
    const p = discordPayload(record, 'https://api.example.workers.dev/admin/feedback', 'zrzut.png');
    expect(p.allowed_mentions).toEqual({ parse: [] });
    const [embed] = p.embeds as Record<string, unknown>[];
    expect(embed).toMatchObject({
      title: 'Nowa uwaga z aplikacji',
      url: 'https://api.example.workers.dev/admin/feedback',
      description: record.text,
      fields: [
        { name: 'Ekran', value: record.view, inline: true },
        { name: 'E-mail', value: 'ktos@example.org', inline: true },
      ],
      image: { url: 'attachment://zrzut.png' },
      timestamp: '2026-10-20T18:30:00.000Z',
    });
    expect(JSON.stringify(p)).not.toContain('Skyr');
    expect(p.attachments).toEqual([{ id: 0, filename: 'zrzut.png' }]);
  });

  it('bez e-maila i bez zrzutu — „nie podano” i bez obrazka', () => {
    const p = discordPayload({ ...record, email: null, screenshot: null }, 'https://x/admin/feedback', null);
    const [embed] = p.embeds as Record<string, unknown>[];
    expect(embed!.fields).toContainEqual({ name: 'E-mail', value: 'nie podano', inline: true });
    expect(embed!.image).toBeUndefined();
    expect(p.attachments).toBeUndefined();
  });

  it('zrzut idzie jako plik obrazka, z tymi samymi bajtami', async () => {
    const file = shotFile(PNG)!;
    expect(file).toMatchObject({ name: 'zrzut.png', type: 'image/png' });
    expect([...file.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(shotFile('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();

    const req = discordRequest(WEBHOOK, record, 'https://x/admin/feedback');
    expect(req.url).toBe(`${WEBHOOK}?wait=true`);
    const form = await req.formData();
    expect(JSON.parse(form.get('payload_json') as string).embeds[0].title).toBe('Nowa uwaga z aplikacji');
    const sent = form.get('files[0]') as File;
    expect(sent.name).toBe('zrzut.png');
    expect(sent.type).toBe('image/png');
    expect(new Uint8Array(await sent.arrayBuffer())).toEqual(file.bytes);
  });

  it('błąd Discorda nie rzuca: trafia do logów, a funkcja mówi, że się nie udało', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await notifyDiscord(WEBHOOK, record, 'https://x', async () => new Response(null, { status: 429 }))).toBe(false);
    expect(await notifyDiscord(WEBHOOK, record, 'https://x', async () => Promise.reject(new Error('sieć')))).toBe(false);
    expect(log).toHaveBeenCalledTimes(2);
    expect(await notifyDiscord(WEBHOOK, record, 'https://x', async () => new Response('{}', { status: 200 }))).toBe(true);
  });
});

describe('uwaga z aplikacji', () => {
  it('zapisuje się w bazie, a kopia idzie na kanał w tle', async () => {
    const sent: Request[] = [];
    vi.stubGlobal('fetch', async (r: Request) => (sent.push(r), new Response('{}')));
    const later: Promise<unknown>[] = [];
    const store = memoryStore();
    const res = await handle(post(body()), env, store, Date.now(), (p) => later.push(p));
    expect(res.status).toBe(204);
    expect(await store.listFeedback(10)).toHaveLength(1);
    expect(later).toHaveLength(1);
    await Promise.all(later);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe(`${WEBHOOK}?wait=true`);
    const payload = JSON.parse((await sent[0]!.formData()).get('payload_json') as string);
    expect(payload.embeds[0].url).toBe('https://api.example.workers.dev/admin/feedback');
  });

  it('bez webhooka, z cudzym adresem, od bota albo z błędną treścią — nic nie idzie na kanał', async () => {
    const later: Promise<unknown>[] = [];
    const defer = (p: Promise<unknown>) => void later.push(p);
    await handle(post(body()), { ...env, DISCORD_WEBHOOK_URL: undefined }, memoryStore(), Date.now(), defer);
    await handle(post(body()), { ...env, DISCORD_WEBHOOK_URL: 'https://example.org/hook' }, memoryStore(), Date.now(), defer);
    await handle(post(body({ website: 'http://spam.example' })), env, memoryStore(), Date.now(), defer);
    await handle(post(body({ text: ' ' })), env, memoryStore(), Date.now(), defer);
    expect(later).toEqual([]);
  });

  it('gdy Discord nie odpowiada, wysyłający i tak dostaje „wysłane”, a uwaga jest w bazie', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => new Response(null, { status: 500 }));
    const later: Promise<unknown>[] = [];
    const store = memoryStore();
    const res = await handle(post(body()), env, store, Date.now(), (p) => later.push(p));
    expect(res.status).toBe(204);
    expect(await Promise.all(later)).toEqual([false]);
    expect(await store.listFeedback(10)).toHaveLength(1);
  });
});
