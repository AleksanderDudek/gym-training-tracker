import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret, parseReceipt } from '@gymtracker/link';
import { freshState } from '../engine/plan';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { acceptInvite } from './accept';
import { invitePreview } from './rpc';
import { activeConnections, clearLink, connectionOf, hasLinkWork, linkState, newAssignments, updateLink, visibleAssignments } from './store';
import type { LinkConnection } from './store';
import { changeScopes, endConnection, forgetKeys, pushOne, setAssignmentStatus, syncAll } from './sync';

/**
 * Synchronizacja w tle: zalecenia odszyfrowane i sprawdzone, wycofane znikają, koniec
 * współpracy po stronie prowadzącego zapisany u siebie z uwagą, paczka co kwadrans i na żądanie,
 * potwierdzenia, zaległe zmiany po braku sieci.
 */

let server: FakeSztab;
let conn: LinkConnection;
const state = freshState();

beforeEach(async () => {
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  const inv = await server.invite(['training'], ['training', 'body']);
  const r = await acceptInvite({
    preview: (await invitePreview(inv.id))!,
    fingerprint: inv.fingerprint,
    chosen: ['training'],
    replace: [],
    scopes: ['training', 'body'],
    secret: newIdSecret(),
  });
  if (!r.ok) throw new Error(r.reason);
  conn = r.connection;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const note = { area: 'training' as const, sentAt: Date.now(), from: { name: 'Anna Kowalska', profession: 'trainer' as const } };

describe('synchronizacja', () => {
  it('odbiera zalecenie, odszyfrowuje je i zapisuje jako nowe', async () => {
    const id = await server.send(conn.id, { ...note, body: { kind: 'note', title: 'Sen', text: 'Śpij 8 godzin.', checklist: ['Bez ekranu po 22'] } });
    await syncAll(() => state);
    const fresh = newAssignments(linkState());
    expect(fresh.map((a) => a.id)).toEqual([id]);
    expect(fresh[0]!.a.body).toMatchObject({ kind: 'note', title: 'Sen' });
  });

  it('szyfrogram pod cudzym numerem (podmieniony wiersz) nie otwiera się — liczy się jako zepsuty', async () => {
    const id = await server.send(conn.id, { ...note, body: { kind: 'note', title: 'A', text: 'x', checklist: [] } });
    server.connections.get(conn.id)!.assignments[0]!.id = id.replace(/^.{8}/, 'ffffffff');
    await syncAll(() => state);
    expect(visibleAssignments(linkState())).toHaveLength(0);
    expect(linkState().broken).toHaveLength(1);
  });

  it('wycofane zalecenie znika z ekranów', async () => {
    const id = await server.send(conn.id, { ...note, body: { kind: 'note', title: 'A', text: 'x', checklist: [] } });
    await syncAll(() => state);
    server.connections.get(conn.id)!.assignments[0]!.withdrawnAt = new Date().toISOString();
    await syncAll(() => state);
    expect(linkState().assignments.find((a) => a.id === id)?.withdrawn).toBe(true);
    expect(visibleAssignments(linkState())).toHaveLength(0);
  });

  it('prowadzący zakończył: `bad_token`, potem stan — współpraca zakończona u siebie, z uwagą', async () => {
    server.endByCoach(conn.id);
    await syncAll(() => state);
    const c = connectionOf(linkState(), conn.id)!;
    expect(c.status).toBe('ended');
    expect(c.endedBy).toBe('coach');
    expect(c.endNotice).toBe(true);
    expect(c.token).toBeNull();
    expect(c.privateJwk).toBeNull();
    expect(server.names()).toContain('client_status');
    expect(hasLinkWork()).toBe(false);
  });

  it('`bad_token` bez sieci przy pytaniu o stan — niczego nie zmienia', async () => {
    const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('client_status')) throw new TypeError('offline');
      return server.fetch(input, init);
    });
    vi.stubGlobal('fetch', f);
    server.connections.get(conn.id)!.tokenHash = '0'.repeat(64);
    await syncAll(() => state);
    expect(connectionOf(linkState(), conn.id)!.status).toBe('active');
  });

  it('wysyła paczkę, którą prowadzący odczyta swoim kluczem; drugi raz dopiero po kwadransie', async () => {
    const s = freshState();
    s.body = [{ day: '2026-11-01', kg: 80 }];
    await syncAll(() => s, { force: true });
    const snap = (await server.readSnapshot(conn.id)) as { scopes: string[]; body?: { body: unknown[] } };
    expect(snap.scopes).toEqual(['training', 'body']);
    expect(snap.body?.body).toHaveLength(1);
    const pushes = () => server.names().filter((n) => n === 'client_push').length;
    const before = pushes();
    await syncAll(() => s);
    expect(pushes()).toBe(before);
    await syncAll(() => s, { now: Date.now() + 16 * 60_000 });
    expect(pushes()).toBe(before + 1);
  });

  it('serwer każe poczekać pół minuty: paczka idzie przy następnej synchronizacji, nie po kwadransie', async () => {
    await syncAll(() => state, { force: true });
    server.throttle(1);
    await syncAll(() => state, { force: true });
    expect(connectionOf(linkState(), conn.id)!.pushDue).toBe(true);
    const pushes = () => server.names().filter((n) => n === 'client_push').length;
    const before = pushes();
    await syncAll(() => state);
    expect(pushes()).toBe(before + 1);
    expect(connectionOf(linkState(), conn.id)!.pushDue).toBeUndefined();
  });

  it('bez sieci po cichu nic nie robi', async () => {
    server.setOffline(true);
    await expect(syncAll(() => state, { force: true })).resolves.toBeUndefined();
    expect(connectionOf(linkState(), conn.id)!.status).toBe('active');
  });

  it('potwierdzenie „zobaczone” idzie zaszyfrowane do prowadzącego', async () => {
    const id = await server.send(conn.id, { ...note, body: { kind: 'note', title: 'A', text: 'x', checklist: ['a', 'b'] } });
    await syncAll(() => state);
    await setAssignmentStatus(id, 'started', { ticked: [1] });
    const r = parseReceipt(await server.readReceipt(conn.id, id));
    expect(r).toMatchObject({ assignmentId: id, status: 'started', ticked: [1] });
    expect(linkState().assignments[0]!.sent).toBe('started');
  });

  it('potwierdzenie bez sieci czeka i idzie przy następnej synchronizacji', async () => {
    const id = await server.send(conn.id, { ...note, body: { kind: 'note', title: 'A', text: 'x', checklist: [] } });
    await syncAll(() => state);
    server.setOffline(true);
    await setAssignmentStatus(id, 'done');
    expect(linkState().assignments[0]!.sent).toBe('new');
    server.setOffline(false);
    await syncAll(() => state);
    expect(linkState().assignments[0]!.sent).toBe('done');
  });

  it('węższy zakres: serwer kasuje starą paczkę, a nowa idzie bez wyłączonej części', async () => {
    const s = freshState();
    s.body = [{ day: '2026-11-01', kg: 80 }];
    await pushOne(connectionOf(linkState(), conn.id)!, s, { force: true });
    // Serwer przyjmuje jedną paczkę na 30 s — w teście zegar się nie przesuwa, więc odpowiedź jest ok.
    expect(await changeScopes(conn.id, ['training'], s)).toBe('ok');
    const snap = (await server.readSnapshot(conn.id)) as { scopes: string[]; body?: unknown };
    expect(snap.scopes).toEqual(['training']);
    expect(snap.body).toBeUndefined();
  });

  it('zakończenie przez podopiecznego bez sieci: na ekranie od razu, serwer dowie się później', async () => {
    server.setOffline(true);
    expect(await endConnection(conn.id)).toBe('later');
    expect(activeConnections(linkState())).toHaveLength(0);
    expect(hasLinkWork()).toBe(true);
    server.setOffline(false);
    await syncAll(() => state);
    expect(server.connections.get(conn.id)!.status).toBe('ended');
    const c = connectionOf(linkState(), conn.id)!;
    expect(c.token).toBeNull();
    expect(c.pending).toBeUndefined();
    expect(c.endNotice).toBeUndefined();
  });

  it('obszary i zakres przychodzą z serwera', async () => {
    updateLink((s) => {
      s.connections[0]!.scopes = ['labs'];
    });
    await syncAll(() => state);
    expect(connectionOf(linkState(), conn.id)!.scopes).toEqual(['training', 'body']);
  });
});
