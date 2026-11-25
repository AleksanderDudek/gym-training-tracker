// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret } from '@gymtracker/link';
import { handle } from '../../server/api/api';
import type { Env, Send } from '../../server/api/api';
import { linkTick } from '../../server/api/link';
import { memoryStore } from '../../server/api/store';
import type { Store } from '../../server/api/store';
import { b64u } from '../../server/api/webpush';
import { freshState } from '../engine/plan';
import { fakeSztab } from '../test/linkServer';
import { fakeDevice, forgetDevice } from '../test/pushDevice';
import { acceptInvite } from './accept';
import { enableCoachPush, scheduleVisitReminder } from './notify';
import { invitePreview } from './rpc';
import { clearLink, connectionOf, linkState } from './store';
import { forgetKeys } from './sync';

/**
 * Umowa trzech stron powiadomień od prowadzącego — bez atrap pośrodku: telefon (`notify.ts`) rejestruje
 * się w PRAWDZIWYM `handle` serwera aplikacji (pamięć zamiast D1), Sztab (`apps/sztab/src/lib/notify.ts`)
 * woła tę samą trasę swoim kształtem zapytania, a cron serwera wysyła zaplanowane. Rozjazd kształtu
 * (np. `at` jako tekst zamiast liczby) wychodzi tu, a nie dopiero na telefonie.
 */

vi.hoisted(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  vi.stubEnv('VITE_TRACKER_API_URL', 'https://api.example');
  // Klucz telefonu (stała modułu) — usługa powiadomień jest tu atrapą, więc nie musi pasować do klucza serwera.
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
});

const API = 'https://api.example';
const HOUR = 3_600_000;
let env: Env;
let store: Store;
let pushes: Request[];
const send: Send = async (r) => {
  pushes.push(r);
  return new Response(null, { status: 201 });
};
const state = freshState();

beforeAll(async () => {
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  env = {
    VAPID_PUBLIC_KEY: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', vapid.publicKey))),
    VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', vapid.privateKey)),
    VAPID_SUBJECT: 'https://aleksanderdudek.github.io/gym-training-tracker/',
    ALLOWED_ORIGINS: 'https://aleksanderdudek.github.io,https://gym-tracker-sztab.instrukcje-app.workers.dev',
  };
});

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  pushes = [];
  store = memoryStore();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  const sztab = await fakeSztab();
  // Klucze „przeglądarki” telefonu — prawdziwe, bo serwer sprawdza ich długość i szyfruje nimi powiadomienie.
  const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const p256dh = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey)));
  const auth = b64u(crypto.getRandomValues(new Uint8Array(16)));
  fakeDevice({ permission: 'granted', subscription: (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/telefon-${n}`, keys: { p256dh, auth } }) });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith(API)) return sztab.fetch(input, init);
      return handle(new Request(url, { method: init?.method ?? 'GET', headers: init?.headers, body: init?.body }), env, store, Date.now(), (p) => void p, send);
    }),
  );
  const inv = await sztab.invite(['training'], ['training']);
  const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: ['training'], secret: newIdSecret() });
  if (!r.ok) throw new Error(r.reason);
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetDevice();
});

describe('powiadomienia: telefon ↔ serwer aplikacji ↔ Sztab', () => {
  it('telefon się rejestruje, Sztab powiadamia od razu i na później, telefon planuje przypomnienie o wizycie', async () => {
    const c = linkState().connections[0]!;
    expect(await enableCoachPush(c.id, state)).toBe('on');
    const token = connectionOf(linkState(), c.id)!.notify!.token;

    const { notifyClient } = await import('../../apps/sztab/src/lib/notify');
    await notifyClient({ notifyToken: token }, 'message');
    await vi.waitFor(() => expect(pushes).toHaveLength(1));

    const later = Date.now() + 3 * HOUR;
    await notifyClient({ notifyToken: token }, 'assignment', { at: new Date(later), ref: crypto.randomUUID() });
    const startsAt = new Date(Date.now() + 5 * HOUR).toISOString();
    expect(await scheduleVisitReminder(c.id, { id: crypto.randomUUID(), startsAt })).toBe(true);
    expect(pushes).toHaveLength(1);

    // Cron serwera za 3,5 h: zaplanowane zalecenie wychodzi; przypomnienie o wizycie (2 h przed, czyli za 3 h) też.
    await linkTick(store, env, new Date(Date.now() + 3.5 * HOUR), send);
    expect(pushes).toHaveLength(3);
  });
});
