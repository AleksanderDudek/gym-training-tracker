import { cleanAreas, cleanPublicJwk, cleanScopes, isUuid, PROFESSIONS } from '@gymtracker/link';
import type { Area, InvitePreview, InviteStatus, PublicJwk, Scope } from '@gymtracker/link';
import { sztabAnonKey, sztabUrl } from './config';

/**
 * Funkcje Sztabu dla telefonu — zwykły `fetch` na PostgREST, bez klienta Supabase. Telefon nie ma
 * konta: uprawnia go token współpracy, a baza widzi wyłącznie szyfrogram.
 *
 * Błąd funkcji (`raise exception 'bad_token'`) przychodzi jako HTTP 400 z JSON-em
 * `{ code: 'P0001', message: 'bad_token' }` — `RpcError.code` to właśnie ten `message`. Brak sieci
 * albo odpowiedź, której nie da się przeczytać, to `offline`.
 */

export class RpcError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'RpcError';
  }
}

export const isRpcError = (e: unknown, code?: string): e is RpcError =>
  e instanceof RpcError && (code === undefined || e.code === code);

export async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const key = sztabAnonKey();
  let res: Response;
  try {
    res = await fetch(`${sztabUrl()}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
  } catch {
    throw new RpcError('offline', 0);
  }
  let text = '';
  try {
    text = await res.text();
  } catch {
    throw new RpcError('offline', res.status);
  }
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new RpcError(res.ok ? 'bad_reply' : 'offline', res.status);
    }
  }
  if (!res.ok) {
    const msg = body && typeof body === 'object' ? (body as { message?: unknown }).message : null;
    // Funkcja odmówiła po swojemu (P0001) — kod w `message`. Inne błędy (502, limit) to „bez sieci”.
    throw new RpcError(res.status >= 400 && res.status < 500 && typeof msg === 'string' && /^[a-z_]{2,40}$/.test(msg) ? msg : 'offline', res.status);
  }
  return body;
}

/* ── Typowane wywołania ─────────────────────────────────────────────────────────────── */

const STATUSES: readonly InviteStatus[] = ['open', 'expired', 'revoked', 'accepted'];

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Odpowiedź `invite_preview` sprawdzona pole po polu — `null`, gdy zaproszenia nie ma albo przyszło zepsute. */
export function cleanPreview(v: unknown): InvitePreview | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const publicKey = cleanPublicJwk(p.publicKey);
  const status = STATUSES.find((s) => s === p.status);
  const coachName = str(p.coachName, 80);
  const areas = cleanAreas(p.areas);
  if (!isUuid(p.id) || !isUuid(p.coachId) || !publicKey || !status || !coachName || !areas.length) return null;
  const expires = typeof p.expiresAt === 'string' && Number.isFinite(Date.parse(p.expiresAt)) ? p.expiresAt : new Date(0).toISOString();
  return {
    id: String(p.id).toLowerCase(),
    status,
    coachId: String(p.coachId).toLowerCase(),
    coachName,
    profession: PROFESSIONS.find((x) => x === p.profession) ?? 'other',
    bio: str(p.bio, 500),
    publicKey,
    areas,
    scopes: cleanScopes(p.scopes),
    message: str(p.message, 500),
    expiresAt: expires,
  };
}

export const invitePreview = async (inviteId: string): Promise<InvitePreview | null> =>
  cleanPreview(await rpc('invite_preview', { p_invite: inviteId }));

export async function inviteAccept(a: {
  inviteId: string;
  pseudonym: string;
  publicKey: PublicJwk;
  token: string;
  areas: readonly Area[];
  scopes: readonly Scope[];
}): Promise<string> {
  const id = await rpc('invite_accept', {
    p_invite: a.inviteId,
    p_pseudonym: a.pseudonym,
    p_public_key: a.publicKey,
    p_token: a.token,
    p_areas: a.areas,
    p_scopes: a.scopes,
  });
  if (!isUuid(id)) throw new RpcError('bad_reply', 200);
  return String(id).toLowerCase();
}

export interface PushReply {
  ok: boolean;
  ended?: boolean;
  retryAfter?: number;
}

export async function clientPush(connection: string, token: string, ciphertext: string, bytes: number): Promise<PushReply> {
  const r = await rpc('client_push', { p_connection: connection, p_token: token, p_ciphertext: ciphertext, p_bytes: bytes });
  const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
  return {
    ok: o.ok === true,
    ...(o.ended === true ? { ended: true } : {}),
    ...(typeof o.retryAfter === 'number' ? { retryAfter: o.retryAfter } : {}),
  };
}

export interface PulledAssignment {
  id: string;
  kind: string;
  area: string;
  ciphertext: string;
  createdAt: string;
  withdrawnAt: string | null;
}

export interface PullReply {
  status: 'active' | 'ended';
  areas: Area[];
  scopes: Scope[];
  assignments: PulledAssignment[];
}

export async function clientPull(connection: string, token: string): Promise<PullReply> {
  const r = await rpc('client_pull', { p_connection: connection, p_token: token });
  if (!r || typeof r !== 'object') throw new RpcError('bad_reply', 200);
  const o = r as Record<string, unknown>;
  const list = Array.isArray(o.assignments) ? o.assignments : [];
  return {
    status: o.status === 'ended' ? 'ended' : 'active',
    areas: cleanAreas(o.areas),
    scopes: cleanScopes(o.scopes),
    assignments: list.flatMap((a): PulledAssignment[] => {
      if (!a || typeof a !== 'object') return [];
      const x = a as Record<string, unknown>;
      if (!isUuid(x.id) || typeof x.ciphertext !== 'string') return [];
      return [
        {
          id: String(x.id).toLowerCase(),
          kind: String(x.kind ?? ''),
          area: String(x.area ?? ''),
          ciphertext: x.ciphertext,
          createdAt: typeof x.createdAt === 'string' ? x.createdAt : '',
          withdrawnAt: typeof x.withdrawnAt === 'string' ? x.withdrawnAt : null,
        },
      ];
    }),
  };
}

export interface StatusReply {
  status: 'active' | 'ended';
  endedBy: 'client' | 'coach' | null;
  endedAt: string | null;
}

/** Stan współpracy bez tokenu. `null` — takiej współpracy na serwerze już nie ma (konto prowadzącego usunięte). */
export async function clientStatus(connection: string): Promise<StatusReply | null> {
  const r = await rpc('client_status', { p_connection: connection });
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  return {
    status: o.status === 'ended' ? 'ended' : 'active',
    endedBy: o.endedBy === 'client' || o.endedBy === 'coach' ? o.endedBy : null,
    endedAt: typeof o.endedAt === 'string' ? o.endedAt : null,
  };
}

export async function clientReceipt(connection: string, token: string, assignment: string, ciphertext: string): Promise<void> {
  await rpc('client_receipt', { p_connection: connection, p_token: token, p_assignment: assignment, p_ciphertext: ciphertext });
}

export async function clientUpdate(connection: string, token: string, areas: readonly Area[], scopes: readonly Scope[]): Promise<void> {
  await rpc('client_update', { p_connection: connection, p_token: token, p_areas: areas, p_scopes: scopes });
}

export async function clientEnd(connection: string, token: string): Promise<void> {
  await rpc('client_end', { p_connection: connection, p_token: token });
}

/* ── Wiadomości ────────────────────────────────────────────────────────────────────── */

export interface PulledMessage {
  id: string;
  author: 'coach' | 'client';
  ciphertext: string;
  createdAt: string;
  readAt: string | null;
}

export interface MessagesReply {
  messages: PulledMessage[];
  /** Do której chwili (czas serwera) prowadzący przeczytał wiadomości od podopiecznego. */
  readUpTo: string | null;
}

const isoOrNull = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

export async function clientMessages(connection: string, token: string, since: string | null): Promise<MessagesReply> {
  const r = await rpc('client_messages', { p_connection: connection, p_token: token, p_since: since });
  if (!r || typeof r !== 'object') throw new RpcError('bad_reply', 200);
  const o = r as Record<string, unknown>;
  return {
    messages: (Array.isArray(o.messages) ? o.messages : []).flatMap((m): PulledMessage[] => {
      if (!m || typeof m !== 'object') return [];
      const x = m as Record<string, unknown>;
      const createdAt = isoOrNull(x.createdAt);
      if (!isUuid(x.id) || typeof x.ciphertext !== 'string' || !createdAt || (x.author !== 'coach' && x.author !== 'client')) return [];
      return [{ id: String(x.id).toLowerCase(), author: x.author, ciphertext: x.ciphertext, createdAt, readAt: isoOrNull(x.readAt) }];
    }),
    readUpTo: isoOrNull(o.readUpTo),
  };
}

/** Wysyła wiadomość; zwraca czas serwera. Ponowienie z tym samym numerem nie dubluje. */
export async function clientMessage(connection: string, token: string, id: string, ciphertext: string): Promise<string> {
  const r = await rpc('client_message', { p_connection: connection, p_token: token, p_id: id, p_ciphertext: ciphertext });
  const at = isoOrNull(r && typeof r === 'object' ? (r as Record<string, unknown>).createdAt : null);
  if (!at) throw new RpcError('bad_reply', 200);
  return at;
}

export async function clientRead(connection: string, token: string, upTo: string): Promise<void> {
  await rpc('client_read', { p_connection: connection, p_token: token, p_upto: upTo });
}

/* ── Zdjęcia sylwetki ──────────────────────────────────────────────────────────────── */

export async function clientPhotoIds(connection: string, token: string): Promise<string[]> {
  const r = await rpc('client_photo_ids', { p_connection: connection, p_token: token });
  return Array.isArray(r) ? r.filter(isUuid).map((x) => String(x).toLowerCase()) : [];
}

export async function clientPhotoPut(connection: string, token: string, id: string, ciphertext: string): Promise<void> {
  await rpc('client_photo_put', { p_connection: connection, p_token: token, p_id: id, p_ciphertext: ciphertext });
}

export async function clientPhotoDelete(connection: string, token: string, id: string): Promise<void> {
  await rpc('client_photo_delete', { p_connection: connection, p_token: token, p_id: id });
}

/* ── Kalendarz wizyt ───────────────────────────────────────────────────────────────── */

export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  title: string;
  place: string | null;
  note: string | null;
  capacity: number;
  taken: number;
}

export interface Booking {
  id: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  place: string | null;
  note: string | null;
  cancelledAt: string | null;
  cancelledBy: 'client' | 'coach' | null;
}

export interface SlotsReply {
  slots: Slot[];
  bookings: Booking[];
}

const optStr = (v: unknown, max: number): string | null => str(v, max);

export async function clientSlots(connection: string, token: string): Promise<SlotsReply> {
  const r = await rpc('client_slots', { p_connection: connection, p_token: token });
  if (!r || typeof r !== 'object') throw new RpcError('bad_reply', 200);
  const o = r as Record<string, unknown>;
  const times = (x: Record<string, unknown>) => {
    const startsAt = isoOrNull(x.startsAt);
    const endsAt = isoOrNull(x.endsAt);
    return startsAt && endsAt ? { startsAt, endsAt } : null;
  };
  return {
    slots: (Array.isArray(o.slots) ? o.slots : []).flatMap((s): Slot[] => {
      if (!s || typeof s !== 'object') return [];
      const x = s as Record<string, unknown>;
      const t = times(x);
      const title = str(x.title, 80);
      if (!isUuid(x.id) || !t || !title) return [];
      const capacity = typeof x.capacity === 'number' && x.capacity >= 1 ? Math.round(x.capacity) : 1;
      const taken = typeof x.taken === 'number' && x.taken >= 0 ? Math.round(x.taken) : 0;
      return [{ id: String(x.id).toLowerCase(), ...t, title, place: optStr(x.place, 300), note: optStr(x.note, 500), capacity, taken }];
    }),
    bookings: (Array.isArray(o.bookings) ? o.bookings : []).flatMap((b): Booking[] => {
      if (!b || typeof b !== 'object') return [];
      const x = b as Record<string, unknown>;
      const t = times(x);
      const title = str(x.title, 80);
      if (!isUuid(x.id) || !isUuid(x.slotId) || !t || !title) return [];
      return [
        {
          id: String(x.id).toLowerCase(),
          slotId: String(x.slotId).toLowerCase(),
          ...t,
          title,
          place: optStr(x.place, 300),
          note: optStr(x.note, 500),
          cancelledAt: isoOrNull(x.cancelledAt),
          cancelledBy: x.cancelledBy === 'client' || x.cancelledBy === 'coach' ? x.cancelledBy : null,
        },
      ];
    }),
  };
}

/** Rezerwuje termin; zwraca numer rezerwacji. Odmowy: `slot_missing`, `slot_past`, `slot_full`, `already_booked`, `too_many`. */
export async function clientBook(connection: string, token: string, slot: string): Promise<string> {
  const id = await rpc('client_book', { p_connection: connection, p_token: token, p_slot: slot });
  if (!isUuid(id)) throw new RpcError('bad_reply', 200);
  return String(id).toLowerCase();
}

export async function clientCancelBooking(connection: string, token: string, booking: string): Promise<void> {
  await rpc('client_cancel_booking', { p_connection: connection, p_token: token, p_booking: booking });
}
