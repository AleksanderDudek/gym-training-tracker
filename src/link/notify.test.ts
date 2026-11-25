// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret } from '@gymtracker/link';
import type { Area } from '@gymtracker/link';
import { freshState } from '../engine/plan';
import { currentPushState, disablePush, enablePush, syncReminders } from '../push';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { fakeDevice, fakeWorker, forgetDevice } from '../test/pushDevice';
import type { FakeDevice, FakeWorker } from '../test/pushDevice';
import { acceptInvite } from './accept';
import {
  REGISTER_EVERY_MS,
  VISIT_SOON_MS,
  cancelVisitReminder,
  coachPushState,
  disableCoachPush,
  enableCoachPush,
  keepCoachPush,
  scheduleVisitReminder,
} from './notify';
import { invitePreview } from './rpc';
import { clearLink, connectionOf, linkState } from './store';
import type { LinkConnection } from './store';
import { forgetKeys, syncAll } from './sync';

/**
 * Powiadomienia od prowadzącego po stronie telefonu, przeciw Sztabowi w pamięci i serwerowi aplikacji
 * w pamięci: zgoda, ten sam token po obu stronach, wyłączenie, odświeżanie rejestracji, sprzątanie po
 * zakończonej współpracy, brak sieci i przypomnienia o wizytach. Adres serwera i klucz VAPID przychodzą
 * z buildu (stałe modułu), więc są ustawione przed wczytaniem modułów.
 */

vi.hoisted(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
});

const API = 'https://api.example';
let server: FakeSztab;
let worker: FakeWorker;
let device: FakeDevice;
const state = freshState();
const HOUR = 3_600_000;

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  worker = fakeWorker(API, server.fetch);
  vi.stubGlobal('fetch', vi.fn(worker.fetch));
  device = fakeDevice();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  forgetDevice();
});

async function connect(areas: Area[] = ['training']): Promise<LinkConnection> {
  const inv = await server.invite(areas, ['training']);
  const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: areas, replace: [], scopes: ['training'], secret: newIdSecret() });
  if (!r.ok) throw new Error(r.reason);
  return r.connection;
}

/** Dwie współprace z dwoma prowadzącymi (ten sam prowadzący zastępuje dawną współpracę nową). */
async function twoCoaches(): Promise<[LinkConnection, LinkConnection, FakeSztab]> {
  const a = await connect(['training']);
  const other = await fakeSztab({ coachName: 'Jan Nowak' });
  const route = (input: RequestInfo | URL, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    const id = String(args.p_connection ?? args.p_invite ?? '');
    return (other.connections.has(id) || other.invites.has(id) ? other : server).fetch(input, init);
  };
  worker = fakeWorker(API, route);
  vi.stubGlobal('fetch', vi.fn(worker.fetch));
  const inv = await other.invite(['nutrition']);
  const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: ['nutrition'], replace: [], scopes: [], secret: newIdSecret() });
  if (!r.ok) throw new Error(r.reason);
  return [a, r.connection, other];
}

const notifyOf = (id: string) => connectionOf(linkState(), id)?.notify;
const count = (path: string) => worker.paths().filter((p) => p === path).length;

describe('włączanie i wyłączanie', () => {
  it('włączenie pyta o zgodę i rejestruje ten sam token na serwerze aplikacji i w Sztabie', async () => {
    const c = await connect();
    expect(await coachPushState(c.id)).toBe('off');
    expect(await enableCoachPush(c.id, state)).toBe('on');
    expect(device.requestPermission).toHaveBeenCalledTimes(1);
    const n = notifyOf(c.id)!;
    expect(n.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(n.sztab).toBe(true);
    expect(Date.now() - n.registeredAt).toBeLessThan(5000);
    expect(worker.last('/link/register')).toEqual({
      token: n.token,
      subscription: { endpoint: device.subscription!.endpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } },
      tz: expect.any(String),
      lang: 'pl',
    });
    expect(server.connections.get(c.id)!.notifyToken).toBe(n.token);
    expect(await coachPushState(c.id)).toBe('on');
    expect(await coachPushState()).toBe('on');
  });

  it('każda współpraca ma własny token', async () => {
    const [a, b, other] = await twoCoaches();
    expect(await enableCoachPush(a.id, state)).toBe('on');
    expect(await enableCoachPush(b.id, state)).toBe('on');
    expect(notifyOf(a.id)!.token).not.toBe(notifyOf(b.id)!.token);
    expect(server.connections.get(a.id)!.notifyToken).toBe(notifyOf(a.id)!.token);
    expect(other.connections.get(b.id)!.notifyToken).toBe(notifyOf(b.id)!.token);
    // Jedna subskrypcja urządzenia dla obu.
    expect(device.subscribe).toHaveBeenCalledTimes(1);
  });

  it('odmowa zgody: nic nie idzie ani do serwera aplikacji, ani do Sztabu', async () => {
    const c = await connect();
    device.answer('denied');
    expect(await enableCoachPush(c.id, state)).toBe('denied');
    expect(worker.calls).toEqual([]);
    expect(server.connections.get(c.id)!.notifyToken).toBeUndefined();
    expect(notifyOf(c.id)).toBeUndefined();
  });

  it('wyłączenie kasuje token po obu stronach', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    const token = notifyOf(c.id)!.token;
    expect(await disableCoachPush(c.id)).toBe('off');
    expect(worker.last('/link/unregister')).toEqual({ token });
    expect(server.connections.get(c.id)!.notifyToken).toBeNull();
    expect(notifyOf(c.id)).toBeUndefined();
  });

  it('Sztab bez sieci przy włączaniu: zapisane z `sztab: false`, synchronizacja dosyła token', async () => {
    const c = await connect();
    server.setOffline(true);
    expect(await enableCoachPush(c.id, state)).toBe('on');
    const n = notifyOf(c.id)!;
    expect(n.sztab).toBe(false);
    expect(server.connections.get(c.id)!.notifyToken).toBeUndefined();
    server.setOffline(false);
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!)).toBe('ok');
    expect(server.connections.get(c.id)!.notifyToken).toBe(n.token);
    expect(notifyOf(c.id)!.sztab).toBe(true);
    // Rejestracja świeża i ta sama subskrypcja — drugi raz nie idzie.
    expect(count('/link/register')).toBe(1);
  });
});

describe('przypomnienia i powiadomienia od prowadzącego dzielą subskrypcję', () => {
  it('włączenie powiadomień od prowadzącego nie włącza przypomnień przy okazji', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    expect(await currentPushState()).toBe('off');
    expect(await syncReminders(state, true)).toBe(false);
    expect(count('/subscribe')).toBe(0);
  });

  it('wyłączenie przypomnień zostawia subskrypcję prowadzącemu — serwer dostaje pustą listę, nie `/unsubscribe`', async () => {
    const c = await connect();
    expect(await enablePush(state)).toBe('on');
    await enableCoachPush(c.id, state);
    const sub = device.subscription;
    expect(await disablePush()).toBe('off');
    expect(device.subscription).toBe(sub);
    expect(worker.last('/subscribe')).toMatchObject({ items: [] });
    expect(count('/unsubscribe')).toBe(0);
    expect(await coachPushState(c.id)).toBe('on');
    // Lista przypomnień nie wraca sama przy następnej synchronizacji.
    worker.clear();
    expect(await syncReminders(state, true)).toBe(false);
    expect(worker.calls).toEqual([]);

    // I z powrotem: ta sama subskrypcja z listą, rejestracja prowadzącego dalej ważna.
    expect(await enablePush(state)).toBe('on');
    expect(device.subscription).toBe(sub);
    expect((worker.last('/subscribe')!.items as unknown[]).length).toBeGreaterThan(0);
    worker.clear();
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!)).toBe('ok');
    expect(worker.calls).toEqual([]);
    expect(count('/unsubscribe')).toBe(0);
  });

  it('wyłączenie ostatnich powiadomień od prowadzącego nie rusza subskrypcji przypomnień', async () => {
    const c = await connect();
    expect(await enablePush(state)).toBe('on');
    await enableCoachPush(c.id, state);
    const sub = device.subscription;
    expect(await disableCoachPush(c.id)).toBe('off');
    expect(device.subscription).toBe(sub);
    expect(count('/unsubscribe')).toBe(0);
    expect(await currentPushState()).toBe('on');
    worker.clear();
    expect(await syncReminders(state, true)).toBe(true);
    expect((worker.last('/subscribe')!.items as unknown[]).length).toBeGreaterThan(0);
  });

  it('przypomnienia wyłączone, gdy prowadzący nie miał powiadomień: jak dotąd `/unsubscribe` i koniec subskrypcji', async () => {
    await connect();
    await enablePush(state);
    expect(await disablePush()).toBe('off');
    expect(count('/unsubscribe')).toBe(1);
    expect(device.subscription).toBeNull();
  });

  it('pusta lista, która nie doszła, idzie przy następnej synchronizacji przypomnień', async () => {
    const c = await connect();
    await enablePush(state);
    await enableCoachPush(c.id, state);
    worker.setOffline(true);
    await disablePush();
    worker.setOffline(false);
    worker.clear();
    await syncReminders(state);
    expect(worker.calls).toEqual([{ path: '/subscribe', body: expect.objectContaining({ items: [] }) }]);
    worker.clear();
    await syncReminders(state);
    expect(worker.calls).toEqual([]);
  });

  it('przypomnienia włączone potem — normalnie, z listą', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    expect(await enablePush(state)).toBe('on');
    expect((worker.last('/subscribe')!.items as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('synchronizacja', () => {
  it('rejestracja odświeżana po 5 dniach i po zmianie subskrypcji urządzenia', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    const t0 = notifyOf(c.id)!.registeredAt;
    worker.clear();
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!, t0 + 86_400_000)).toBe('ok');
    expect(worker.calls).toEqual([]);

    const later = t0 + REGISTER_EVERY_MS + 1;
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!, later)).toBe('ok');
    expect(worker.paths()).toEqual(['/link/register']);
    expect(notifyOf(c.id)!.registeredAt).toBe(later);

    worker.clear();
    device.rotate();
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!, later + HOUR)).toBe('ok');
    expect(worker.last('/link/register')).toMatchObject({ token: notifyOf(c.id)!.token, subscription: { endpoint: device.subscription!.endpoint } });
  });

  it('po każdej nowej subskrypcji rejestracja od nowa — także z tym samym adresem', async () => {
    const c = await connect();
    await enablePush(state);
    await enableCoachPush(c.id, state);
    const endpoint = device.subscription!.endpoint;
    // Przypomnienia włączane ponownie przy starym kluczu serwera: wypisanie i nowa subskrypcja, adres ten sam.
    device.reuseEndpoint(true);
    device.staleKey();
    expect(await enablePush(state)).toBe('on');
    expect(device.subscription!.endpoint).toBe(endpoint);
    worker.clear();
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!)).toBe('ok');
    expect(worker.paths()).toEqual(['/link/register']);
    worker.clear();
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!)).toBe('ok');
    expect(worker.calls).toEqual([]);
  });

  it('subskrypcja zniknęła (przeglądarka ją odebrała): zakłada nową i rejestruje token od nowa', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    const before = device.subscription!.endpoint;
    await device.subscription!.unsubscribe();
    worker.clear();
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!)).toBe('ok');
    expect(device.subscription!.endpoint).not.toBe(before);
    expect(worker.last('/link/register')).toMatchObject({ subscription: { endpoint: device.subscription!.endpoint } });
  });

  it('prowadzący zakończył współpracę: synchronizacja wyrejestrowuje token na serwerze aplikacji', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    const token = notifyOf(c.id)!.token;
    server.endByCoach(c.id);
    await syncAll(() => state);
    expect(connectionOf(linkState(), c.id)!.status).toBe('ended');
    expect(worker.last('/link/unregister')).toEqual({ token });
    expect(notifyOf(c.id)).toBeUndefined();
  });

  it('bez sieci: `offline`, bez wyjątku i bez zmian w zapisie', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    const n = notifyOf(c.id)!;
    worker.setOffline(true);
    server.setOffline(true);
    expect(await keepCoachPush(connectionOf(linkState(), c.id)!, n.registeredAt + REGISTER_EVERY_MS + 1)).toBe('offline');
    expect(notifyOf(c.id)).toEqual(n);
    // Wyłączenie bez sieci do obu serwerów: nic się nie zmienia, powiadomienia dalej włączone.
    expect(await disableCoachPush(c.id)).toBe('on');
    expect(notifyOf(c.id)).toEqual(n);
    // Zakończona współpraca bez sieci — token czeka na następną próbę.
    server.endByCoach(c.id);
    await syncAll(() => state);
    expect(notifyOf(c.id)).toEqual(n);
  });

  it('włączenie bez serwera aplikacji: wyłączone, nic nie zapisane', async () => {
    const c = await connect();
    worker.setOffline(true);
    expect(await enableCoachPush(c.id, state)).toBe('off');
    expect(notifyOf(c.id)).toBeUndefined();
    expect(server.connections.get(c.id)!.notifyToken).toBeUndefined();
  });

  it('wyłączone, gdy serwer aplikacji nie odpowiadał: wyrejestrowanie idzie przy następnej synchronizacji', async () => {
    const [a, b] = await twoCoaches();
    await enableCoachPush(a.id, state);
    await enableCoachPush(b.id, state);
    const token = notifyOf(a.id)!.token;
    worker.setOffline(true);
    expect(await disableCoachPush(a.id)).toBe('off');
    expect(server.connections.get(a.id)!.notifyToken).toBeNull();
    worker.setOffline(false);
    worker.clear();
    expect(await keepCoachPush(connectionOf(linkState(), b.id)!)).toBe('ok');
    expect(worker.calls).toEqual([{ path: '/link/unregister', body: { token } }]);
  });
});

describe('przypomnienie o wizycie', () => {
  it('rezerwacja: 2 godziny przed wizytą, z numerem rezerwacji; odwołanie je kasuje', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    const token = notifyOf(c.id)!.token;
    const now = Date.now();
    const startsAt = new Date(now + 26 * HOUR).toISOString();
    expect(await scheduleVisitReminder(c.id, { id: 'booking-1', startsAt }, now)).toBe(true);
    expect(worker.last('/link/notify')).toEqual({ token, kind: 'visit-soon', at: new Date(Date.parse(startsAt) - VISIT_SOON_MS).toISOString(), ref: 'booking-1' });
    expect(await cancelVisitReminder(c.id, 'booking-1')).toBe(true);
    expect(worker.last('/link/cancel')).toEqual({ token, ref: 'booking-1' });
  });

  it('wizyta za mniej niż 2 godziny albo powiadomienia wyłączone — nic', async () => {
    const c = await connect();
    const soon = new Date(Date.now() + HOUR).toISOString();
    const later = new Date(Date.now() + 30 * HOUR).toISOString();
    expect(await scheduleVisitReminder(c.id, { id: 'b-1', startsAt: later })).toBe(false);
    await enableCoachPush(c.id, state);
    worker.clear();
    expect(await scheduleVisitReminder(c.id, { id: 'b-2', startsAt: soon })).toBe(false);
    expect(worker.calls).toEqual([]);
  });

  it('włączenie po rezerwacji: znane wizyty dostają przypomnienie od razu', async () => {
    const c = await connect();
    const slot = server.slot();
    const { clientBook, clientSlots } = await import('./rpc');
    const booking = await clientBook(c.id, c.token!, slot.id);
    const r = await clientSlots(c.id, c.token!);
    const { updateLink } = await import('./store');
    updateLink((s) => {
      s.connections.find((x) => x.id === c.id)!.visits = { at: Date.now(), bookings: r.bookings };
    });
    await enableCoachPush(c.id, state);
    expect(worker.last('/link/notify')).toMatchObject({ kind: 'visit-soon', ref: booking, at: new Date(Date.parse(slot.startsAt) - VISIT_SOON_MS).toISOString() });
  });

  it('odwołanie bez sieci czeka i idzie przy następnej synchronizacji', async () => {
    const c = await connect();
    await enableCoachPush(c.id, state);
    const token = notifyOf(c.id)!.token;
    worker.setOffline(true);
    expect(await cancelVisitReminder(c.id, 'b-9')).toBe(false);
    worker.setOffline(false);
    worker.clear();
    await keepCoachPush(connectionOf(linkState(), c.id)!);
    expect(worker.calls).toEqual([{ path: '/link/cancel', body: { token, ref: 'b-9' } }]);
  });
});
