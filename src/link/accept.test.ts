import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateIdentity, newIdSecret, pseudonymFor } from '@gymtracker/link';
import type { Area, Scope } from '@gymtracker/link';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { acceptInvite, areaChecks } from './accept';
import { invitePreview } from './rpc';
import { activeConnections, clearLink, linkState } from './store';
import { forgetKeys } from './sync';

/**
 * Przyjęcie zaproszenia przeciw Sztabowi w pamięci: kontrola klucza z linku, ID z sekretu
 * telefonu i ponowienie przy kolizji, wyłączność obszarów — zamiana albo pominięcie.
 */

const secret = newIdSecret();

async function accept(server: FakeSztab, areas: Area[], opts: { chosen?: Area[]; replace?: Area[]; scopes?: Scope[]; fp?: string } = {}) {
  const inv = await server.invite(areas, opts.scopes ?? ['training']);
  const preview = (await invitePreview(inv.id))!;
  return acceptInvite({
    preview,
    fingerprint: opts.fp ?? inv.fingerprint,
    chosen: opts.chosen ?? areas,
    replace: opts.replace ?? [],
    scopes: opts.scopes ?? ['training'],
    secret,
  });
}

let server: FakeSztab;

beforeEach(async () => {
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321/');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('przyjęcie zaproszenia', () => {
  it('pyta bazę pod adresem z buildu, z kluczem anon w obu nagłówkach', async () => {
    const r = await accept(server, ['training']);
    expect(r.ok).toBe(true);
    const f = vi.mocked(fetch);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe('http://127.0.0.1:54321/rest/v1/rpc/invite_preview');
    expect(init?.headers).toMatchObject({ apikey: 'anon-key', Authorization: 'Bearer anon-key' });
  });

  it('zapisuje współpracę z ID liczonym z sekretu telefonu, bez nazwiska i maila', async () => {
    const r = await accept(server, ['training', 'nutrition'], { scopes: ['training', 'body'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.connection;
    expect(c.pseudonym).toBe(await pseudonymFor(secret, server.coachId, 0));
    expect(c.areas).toEqual(['training', 'nutrition']);
    expect(c.scopes).toEqual(['training', 'body']);
    expect(c.token).toBeTruthy();
    expect(c.privateJwk).toBeTruthy();
    const onServer = server.connections.get(c.id)!;
    expect(onServer.pseudonym).toBe(c.pseudonym);
    expect(onServer.tokenHash).not.toBe(c.token);
    expect(linkState().connections).toHaveLength(1);
  });

  it('odmawia, gdy klucz od serwera nie zgadza się z odciskiem z linku — i niczego nie przyjmuje', async () => {
    const mallory = await generateIdentity(true);
    server.swapKey(mallory.publicJwk);
    const r = await accept(server, ['training']);
    expect(r).toEqual({ ok: false, reason: 'fingerprint' });
    expect(server.names()).not.toContain('invite_accept');
    expect(linkState().connections).toHaveLength(0);
  });

  it('odmawia też przy odcisku z przepisanego linku', async () => {
    const r = await accept(server, ['training'], { fp: 'AAAAAAAAAAAAAAAAAAAAAA' });
    expect(r).toEqual({ ok: false, reason: 'fingerprint' });
  });

  it('przy kolizji ID (`pseudonym_taken`) liczy ID z licznikiem o jeden większym', async () => {
    server.takenTimes(2);
    const r = await accept(server, ['training']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.connection.attempt).toBe(2);
    expect(r.connection.pseudonym).toBe(await pseudonymFor(secret, server.coachId, 2));
    expect(server.names().filter((n) => n === 'invite_accept')).toHaveLength(3);
  });

  it('po pięciu kolizjach poddaje się zamiast próbować w nieskończoność', async () => {
    server.takenTimes(9);
    const r = await accept(server, ['training']);
    expect(r).toEqual({ ok: false, reason: 'taken' });
  });

  it('zaproszenie zużyte albo wycofane — mówi, które', async () => {
    const inv = await server.invite(['training']);
    const preview = (await invitePreview(inv.id))!;
    server.invites.get(inv.id)!.status = 'revoked';
    const r = await acceptInvite({ preview, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: [], secret });
    expect(r).toEqual({ ok: false, reason: 'revoked' });
  });

  it('bez sieci: nic się nie zmienia', async () => {
    const inv = await server.invite(['training']);
    const preview = (await invitePreview(inv.id))!;
    server.setOffline(true);
    const r = await acceptInvite({ preview, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: [], secret });
    expect(r).toEqual({ ok: false, reason: 'offline' });
    expect(linkState().connections).toHaveLength(0);
  });
});

describe('wyłączność obszarów', () => {
  it('zajęty trening bez zgody na zamianę — odmowa, a dawna współpraca zostaje', async () => {
    expect((await accept(server, ['training'])).ok).toBe(true);
    const other = await fakeSztab({ coachName: 'Jan Nowak' });
    vi.stubGlobal('fetch', vi.fn(other.fetch));
    const inv = await other.invite(['training']);
    const preview = (await invitePreview(inv.id))!;
    const check = areaChecks(linkState(), preview)[0]!;
    expect(check.free).toBe(false);
    expect(check.holders.map((h) => h.coachName)).toEqual(['Anna Kowalska']);
    const r = await acceptInvite({ preview, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: [], secret });
    expect(r).toEqual({ ok: false, reason: 'exclusive' });
    expect(activeConnections(linkState())).toHaveLength(1);
  });

  it('zamiana prowadzącego: nowy przyjęty, dawny kończy się dopiero po udanym przyjęciu', async () => {
    const first = await accept(server, ['training']);
    if (!first.ok) throw new Error('setup');
    const other = await fakeSztab({ coachName: 'Jan Nowak' });
    // Jeden fetch dla obu serwerów: każdy zna tylko swoje współprace.
    const both = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { p_connection?: string };
      return body.p_connection && server.connections.has(body.p_connection) ? server.fetch(input, init) : other.fetch(input, init);
    });
    vi.stubGlobal('fetch', both);
    const inv = await other.invite(['training']);
    const preview = (await invitePreview(inv.id))!;
    const r = await acceptInvite({ preview, fingerprint: inv.fingerprint, chosen: ['training'], replace: ['training'], scopes: [], secret });
    expect(r.ok).toBe(true);
    expect(server.connections.get(first.connection.id)!.status).toBe('ended');
    const order = [...other.names().map((n) => `jan:${n}`)];
    expect(order).toContain('jan:invite_accept');
    const local = linkState().connections.find((c) => c.id === first.connection.id)!;
    expect(local.status).toBe('ended');
    expect(local.token).toBeNull();
    expect(activeConnections(linkState()).map((c) => c.coach.name)).toEqual(['Jan Nowak']);
  });

  it('zamiana jednego obszaru zostawia dawnemu prowadzącemu resztę', async () => {
    const first = await accept(server, ['training', 'nutrition']);
    if (!first.ok) throw new Error('setup');
    const other = await fakeSztab({ coachName: 'Ewa Dietetyk', profession: 'dietitian' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { p_connection?: string };
        return body.p_connection && server.connections.has(body.p_connection) ? server.fetch(input, init) : other.fetch(input, init);
      }),
    );
    const inv = await other.invite(['nutrition', 'insight']);
    const preview = (await invitePreview(inv.id))!;
    const r = await acceptInvite({ preview, fingerprint: inv.fingerprint, chosen: ['nutrition'], replace: ['nutrition'], scopes: ['food'], secret });
    expect(r.ok).toBe(true);
    expect(server.connections.get(first.connection.id)!.areas).toEqual(['training']);
    expect(linkState().connections.find((c) => c.id === first.connection.id)!.areas).toEqual(['training']);
    // Pominięty obszar (wgląd) nie wszedł do nowej współpracy.
    if (r.ok) expect(r.connection.areas).toEqual(['nutrition']);
  });

  it('nowe zaproszenie od tego samego prowadzącego zastępuje dawną współpracę i daje to samo ID', async () => {
    const first = await accept(server, ['training']);
    if (!first.ok) throw new Error('setup');
    const second = await accept(server, ['training', 'rehab']);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.connection.pseudonym).toBe(first.connection.pseudonym);
    expect(server.connections.get(first.connection.id)!.status).toBe('ended');
    expect(activeConnections(linkState()).map((c) => c.id)).toEqual([second.connection.id]);
    // Koniec dawnej poszedł przed przyjęciem — inaczej to samo ID byłoby zajęte.
    const names = server.names();
    expect(names.lastIndexOf('client_end')).toBeLessThan(names.lastIndexOf('invite_accept'));
  });
});
