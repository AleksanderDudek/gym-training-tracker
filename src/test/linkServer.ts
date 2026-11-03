import { AAD, fingerprint, generateIdentity, linkKey, openJson, sealJson, sha256Hex } from '@gymtracker/link';
import type { Area, AssignmentV1, Identity, PublicJwk, Scope } from '@gymtracker/link';

/**
 * Sztab w pamięci dla testów współpracy: te same funkcje RPC co w migracji
 * (`apps/sztab/supabase/migrations/…_wspolpraca.sql`), te same kody błędów i ten sam kształt
 * odpowiedzi PostgREST (HTTP 400 z `{ code: 'P0001', message }`). Prowadzący ma prawdziwą parę
 * kluczy, więc zalecenia są szyfrowane naprawdę, a paczki od telefonu da się odczytać.
 */

export interface FakeConnection {
  id: string;
  inviteId: string;
  pseudonym: string;
  areas: Area[];
  scopes: Scope[];
  clientKey: PublicJwk;
  tokenHash: string | null;
  status: 'active' | 'ended';
  endedBy: 'client' | 'coach' | null;
  snapshot: string | null;
  bytes: number | null;
  assignments: { id: string; kind: string; area: string; ciphertext: string; createdAt: string; withdrawnAt: string | null }[];
  receipts: Record<string, string>;
}

export interface FakeInvite {
  id: string;
  areas: Area[];
  scopes: Scope[];
  message: string | null;
  status: 'open' | 'accepted' | 'revoked' | 'expired';
}

let n = 0;
const uuid = (): string => {
  n += 1;
  const hex = (n * 7919 + Math.floor(Math.random() * 1e6)).toString(16).padStart(12, '0').slice(-12);
  return `${hex.slice(0, 8)}-1234-4abc-8def-${hex}`;
};

const RPC = /\/rest\/v1\/rpc\/([a-z_]+)$/;

export async function fakeSztab(opts: { coachName?: string; profession?: string } = {}) {
  const coach: Identity = await generateIdentity(true);
  const coachId = uuid();
  const invites = new Map<string, FakeInvite>();
  const connections = new Map<string, FakeConnection>();
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  /** Podmiana klucza w odpowiedzi `invite_preview` — atak z przejętym serwerem. */
  let swapped: PublicJwk | null = null;
  /** Ile razy jeszcze `invite_accept` odpowie `pseudonym_taken`. */
  let taken = 0;
  let offline = false;
  /** Ile kolejnych paczek dostanie „za wcześnie, spróbuj za 30 s” (limit z `client_push`). */
  let throttled = 0;

  const fail = (message: string) =>
    new Response(JSON.stringify({ code: 'P0001', message, details: null, hint: null }), { status: 400 });
  const ok = (body: unknown) => new Response(body === undefined ? '' : JSON.stringify(body), { status: 200 });

  async function byToken(id: unknown, token: unknown): Promise<FakeConnection | null> {
    const c = connections.get(String(id));
    if (!c || !c.tokenHash || c.tokenHash !== (await sha256Hex(String(token ?? '')))) return null;
    return c;
  }

  function end(c: FakeConnection, by: 'client' | 'coach') {
    c.status = 'ended';
    c.endedBy = by;
    c.tokenHash = null;
    c.snapshot = null;
    c.bytes = null;
    c.assignments = [];
    c.scopes = [];
  }

  async function handle(name: string, a: Record<string, unknown>): Promise<Response> {
    switch (name) {
      case 'invite_preview': {
        const i = invites.get(String(a.p_invite));
        if (!i) return ok(null);
        return ok({
          id: i.id,
          status: i.status,
          coachId,
          coachName: opts.coachName ?? 'Anna Kowalska',
          profession: opts.profession ?? 'trainer',
          bio: null,
          publicKey: swapped ?? coach.publicJwk,
          areas: i.areas,
          scopes: i.scopes,
          message: i.message,
          expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        });
      }
      case 'invite_accept': {
        const i = invites.get(String(a.p_invite));
        if (!i) return fail('invite_missing');
        if (i.status === 'accepted') return fail('invite_used');
        if (i.status === 'revoked') return fail('invite_revoked');
        if (i.status === 'expired') return fail('invite_expired');
        const areas = a.p_areas as Area[];
        if (!areas?.length || !areas.every((x) => i.areas.includes(x))) return fail('bad_areas');
        if (String(a.p_token ?? '').length < 40) return fail('bad_token');
        if (taken > 0) {
          taken -= 1;
          return fail('pseudonym_taken');
        }
        if ([...connections.values()].some((c) => c.status === 'active' && c.pseudonym === a.p_pseudonym)) return fail('pseudonym_taken');
        const id = uuid();
        connections.set(id, {
          id,
          inviteId: i.id,
          pseudonym: String(a.p_pseudonym),
          areas: [...areas],
          scopes: [...((a.p_scopes as Scope[]) ?? [])],
          clientKey: a.p_public_key as PublicJwk,
          tokenHash: await sha256Hex(String(a.p_token)),
          status: 'active',
          endedBy: null,
          snapshot: null,
          bytes: null,
          assignments: [],
          receipts: {},
        });
        i.status = 'accepted';
        return ok(id);
      }
      case 'client_push': {
        const c = await byToken(a.p_connection, a.p_token);
        if (!c) return fail('bad_token');
        if (throttled > 0) {
          throttled -= 1;
          return ok({ ok: false, retryAfter: 30 });
        }
        c.snapshot = String(a.p_ciphertext);
        c.bytes = Number(a.p_bytes);
        return ok({ ok: true });
      }
      case 'client_pull': {
        const c = await byToken(a.p_connection, a.p_token);
        if (!c) return fail('bad_token');
        return ok({ status: c.status, areas: c.areas, scopes: c.scopes, assignments: c.assignments });
      }
      case 'client_status': {
        const c = connections.get(String(a.p_connection));
        return ok(c ? { status: c.status, endedBy: c.endedBy, endedAt: c.status === 'ended' ? new Date().toISOString() : null } : null);
      }
      case 'client_receipt': {
        const c = await byToken(a.p_connection, a.p_token);
        if (!c) return fail('bad_token');
        if (!c.assignments.some((x) => x.id === a.p_assignment)) return fail('assignment_missing');
        c.receipts[String(a.p_assignment)] = String(a.p_ciphertext);
        return ok(undefined);
      }
      case 'client_update': {
        const c = await byToken(a.p_connection, a.p_token);
        if (!c) return fail('bad_token');
        const areas = a.p_areas as Area[];
        if (!areas?.length || !areas.every((x) => c.areas.includes(x))) return fail('bad_areas');
        const scopes = (a.p_scopes as Scope[]) ?? [];
        if (!c.scopes.every((x) => scopes.includes(x))) {
          c.snapshot = null;
          c.bytes = null;
        }
        c.areas = [...areas];
        c.scopes = [...scopes];
        return ok(undefined);
      }
      case 'client_end': {
        const c = await byToken(a.p_connection, a.p_token);
        if (!c) return fail('bad_token');
        end(c, 'client');
        return ok(undefined);
      }
      default:
        return new Response('not found', { status: 404 });
    }
  }

  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (offline) throw new TypeError('Failed to fetch');
    const m = String(input).match(RPC);
    if (!m) return new Response('nope', { status: 404 });
    const args = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    calls.push({ name: m[1]!, args });
    return handle(m[1]!, args);
  };

  return {
    coach,
    coachId,
    invites,
    connections,
    calls,
    fetch: fetchMock,
    names: () => calls.map((c) => c.name),
    async invite(areas: Area[], scopes: Scope[] = [], message: string | null = null) {
      const i: FakeInvite = { id: uuid(), areas, scopes, message, status: 'open' };
      invites.set(i.id, i);
      return { id: i.id, fingerprint: await fingerprint(coach.publicJwk) };
    },
    swapKey(k: PublicJwk | null) {
      swapped = k;
    },
    takenTimes(k: number) {
      taken = k;
    },
    throttle(k: number) {
      throttled = k;
    },
    setOffline(v: boolean) {
      offline = v;
    },
    /** Prowadzący kończy współpracę po swojej stronie. */
    endByCoach(id: string) {
      const c = connections.get(id);
      if (c) end(c, 'coach');
    },
    /** Prowadzący wysyła zalecenie: szyfruje je kluczem współpracy, jak przeglądarka w Sztabie. */
    async send(connectionId: string, a: Omit<AssignmentV1, 'id' | 'v'> & { id?: string }) {
      const c = connections.get(connectionId)!;
      const id = a.id ?? uuid();
      const key = await linkKey(coach.privateKey, c.clientKey, c.inviteId);
      const ciphertext = await sealJson(key, AAD.assignment(c.id, id), { ...a, v: 1, id });
      c.assignments.unshift({ id, kind: a.body.kind, area: a.area, ciphertext, createdAt: new Date().toISOString(), withdrawnAt: null });
      return id;
    },
    /** Paczka od telefonu odczytana kluczem prowadzącego. */
    async readSnapshot(connectionId: string): Promise<unknown> {
      const c = connections.get(connectionId)!;
      if (!c.snapshot) return null;
      const key = await linkKey(coach.privateKey, c.clientKey, c.inviteId);
      return openJson(key, AAD.snapshot(c.id), c.snapshot);
    },
    async readReceipt(connectionId: string, assignmentId: string): Promise<unknown> {
      const c = connections.get(connectionId)!;
      const key = await linkKey(coach.privateKey, c.clientKey, c.inviteId);
      return openJson(key, AAD.receipt(c.id, assignmentId), c.receipts[assignmentId]!);
    },
  };
}

export type FakeSztab = Awaited<ReturnType<typeof fakeSztab>>;
