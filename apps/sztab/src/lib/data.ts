import {
  AAD,
  cleanAreas,
  cleanPublicJwk,
  cleanScopes,
  isSnapshot,
  linkKey,
  openJson,
  parseReceipt,
  sealJson,
} from '@gymtracker/link';
import type {
  Area,
  AssignmentBody,
  AssignmentKind,
  AssignmentV1,
  Profession,
  PublicJwk,
  ReceiptV1,
  Scope,
  SnapshotV1,
} from '@gymtracker/link';
import type { PlanTemplate, Workout } from '@gt/types';
import { errorCode, sb } from './sb';

/**
 * Wszystko, co Sztab czyta i zapisuje w bazie. Szyfrogramy otwiera tu przeglądarka kluczem
 * z sejfu — do komponentów trafiają już odszyfrowane, sprawdzone dane.
 */

export interface Coach {
  id: string;
  display_name: string;
  profession: Profession;
  bio: string | null;
  public_key: PublicJwk;
  key_fingerprint: string;
  sealed_key: string;
}

export interface Connection {
  id: string;
  inviteId: string;
  pseudonym: string;
  areas: Area[];
  scopes: Scope[];
  clientKey: PublicJwk;
  status: 'active' | 'ended';
  endedBy: 'client' | 'coach' | null;
  createdAt: string;
  endedAt: string | null;
  lastPushAt: string | null;
  label: string | null;
}

export interface Invite {
  id: string;
  areas: Area[];
  scopes: Scope[];
  message: string | null;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface SentAssignment {
  id: string;
  kind: AssignmentKind;
  area: Area;
  createdAt: string;
  withdrawnAt: string | null;
  /** Odszyfrowana treść; `null`, gdy szyfrogram się nie otworzył. */
  envelope: AssignmentV1 | null;
  receipt: (ReceiptV1 & { updatedAt: string }) | null;
}

/* ── Biblioteka ───────────────────────────────────────────────────────────────────── */

export type LibraryBody =
  | { kind: 'workout'; workout: Workout; videos: Record<string, string> }
  | { kind: 'plan'; plan: PlanTemplate }
  | Extract<AssignmentBody, { kind: 'targets' | 'labs' | 'note' }>;

export interface LibraryItem {
  id: string;
  kind: AssignmentKind;
  title: string;
  body: LibraryBody;
  createdAt: string;
  updatedAt: string;
}

const fail = (e: { message?: string } | null): never => {
  throw new Error(errorCode(e));
};

export async function getCoach(userId: string): Promise<Coach | null> {
  const { data, error } = await sb.from('coaches').select('*').eq('id', userId).maybeSingle();
  if (error) fail(error);
  return (data as Coach | null) ?? null;
}

export async function insertCoach(row: Omit<Coach, 'public_key'> & { public_key: PublicJwk }): Promise<void> {
  const { error } = await sb.from('coaches').insert(row);
  if (error) fail(error);
}

export async function updateCoach(id: string, patch: Partial<Pick<Coach, 'display_name' | 'profession' | 'bio' | 'sealed_key'>>): Promise<void> {
  const { error } = await sb.from('coaches').update(patch).eq('id', id);
  if (error) fail(error);
}

type ConnRow = {
  id: string;
  invite_id: string;
  pseudonym: string;
  areas: string[];
  scopes: string[];
  client_public_key: unknown;
  status: 'active' | 'ended';
  ended_by: 'client' | 'coach' | null;
  created_at: string;
  ended_at: string | null;
  last_push_at: string | null;
  invites: { label: string | null } | null;
};

const toConnection = (r: ConnRow): Connection | null => {
  const clientKey = cleanPublicJwk(r.client_public_key);
  if (!clientKey) return null;
  return {
    id: r.id,
    inviteId: r.invite_id,
    pseudonym: r.pseudonym,
    areas: cleanAreas(r.areas),
    scopes: cleanScopes(r.scopes),
    clientKey,
    status: r.status,
    endedBy: r.ended_by,
    createdAt: r.created_at,
    endedAt: r.ended_at,
    lastPushAt: r.last_push_at,
    label: r.invites?.label ?? null,
  };
};

const CONN_COLS =
  'id, invite_id, pseudonym, areas, scopes, client_public_key, status, ended_by, created_at, ended_at, last_push_at, invites(label)';

export async function listConnections(): Promise<Connection[]> {
  const { data, error } = await sb.from('connections').select(CONN_COLS).order('created_at', { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as unknown as ConnRow[]).map(toConnection).filter((c): c is Connection => c !== null);
}

export async function getConnection(id: string): Promise<Connection | null> {
  const { data, error } = await sb.from('connections').select(CONN_COLS).eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? toConnection(data as unknown as ConnRow) : null;
}

export async function endConnection(id: string): Promise<void> {
  const { error } = await sb.rpc('coach_end_connection', { p_connection: id });
  if (error) fail(error);
}

/* ── Klucz współpracy ─────────────────────────────────────────────────────────────── */

const keys = new Map<string, Promise<CryptoKey>>();

export function connectionKey(privateKey: CryptoKey, c: Pick<Connection, 'id' | 'clientKey' | 'inviteId'>): Promise<CryptoKey> {
  let k = keys.get(c.id);
  if (!k) {
    k = linkKey(privateKey, c.clientKey, c.inviteId);
    keys.set(c.id, k);
  }
  return k;
}

export interface SnapshotRead {
  snapshot: SnapshotV1 | null;
  /** Kiedy paczka przyszła; `null` — jeszcze żadna. */
  at: string | null;
  bytes: number;
  /** Paczka jest, ale nie otwiera się kluczem z sejfu (inny sejf albo uszkodzona). */
  unreadable: boolean;
}

export async function readSnapshot(privateKey: CryptoKey, c: Connection): Promise<SnapshotRead> {
  const { data, error } = await sb.from('snapshots').select('ciphertext, bytes, created_at').eq('connection_id', c.id).maybeSingle();
  if (error) fail(error);
  if (!data) return { snapshot: null, at: null, bytes: 0, unreadable: false };
  const json = await openJson(await connectionKey(privateKey, c), AAD.snapshot(c.id), data.ciphertext as string);
  const ok = isSnapshot(json);
  return { snapshot: ok ? json : null, at: data.created_at as string, bytes: data.bytes as number, unreadable: !ok };
}

/* ── Zaproszenia ──────────────────────────────────────────────────────────────────── */

type InviteRow = {
  id: string;
  areas: string[];
  scopes: string[];
  message: string | null;
  label: string | null;
  expires_at: string;
  revoked_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

const toInvite = (r: InviteRow): Invite => ({
  id: r.id,
  areas: cleanAreas(r.areas),
  scopes: cleanScopes(r.scopes),
  message: r.message,
  label: r.label,
  expiresAt: r.expires_at,
  revokedAt: r.revoked_at,
  acceptedAt: r.accepted_at,
  createdAt: r.created_at,
});

export async function listInvites(): Promise<Invite[]> {
  const { data, error } = await sb
    .from('invites')
    .select('id, areas, scopes, message, label, expires_at, revoked_at, accepted_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) fail(error);
  return ((data ?? []) as InviteRow[]).map(toInvite);
}

export async function createInvite(
  coachId: string,
  input: { areas: Area[]; scopes: Scope[]; message: string; label: string; days: number },
): Promise<Invite> {
  const { data, error } = await sb
    .from('invites')
    .insert({
      coach_id: coachId,
      areas: input.areas,
      scopes: input.scopes,
      message: input.message.trim() || null,
      label: input.label.trim() || null,
      expires_at: new Date(Date.now() + input.days * 86_400_000).toISOString(),
    })
    .select('id, areas, scopes, message, label, expires_at, revoked_at, accepted_at, created_at')
    .single();
  if (error) fail(error);
  return toInvite(data as InviteRow);
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await sb.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) fail(error);
}

export type InviteState = 'open' | 'accepted' | 'revoked' | 'expired';

export const inviteState = (i: Invite, now = Date.now()): InviteState =>
  i.acceptedAt ? 'accepted' : i.revokedAt ? 'revoked' : Date.parse(i.expiresAt) < now ? 'expired' : 'open';

/* ── Zalecenia ────────────────────────────────────────────────────────────────────── */

export async function listAssignments(privateKey: CryptoKey, c: Connection): Promise<SentAssignment[]> {
  const [a, r] = await Promise.all([
    sb.from('assignments').select('id, kind, area, ciphertext, created_at, withdrawn_at').eq('connection_id', c.id).order('created_at', { ascending: false }),
    sb.from('receipts').select('assignment_id, ciphertext, updated_at').eq('connection_id', c.id),
  ]);
  if (a.error) fail(a.error);
  if (r.error) fail(r.error);
  const key = await connectionKey(privateKey, c);
  const receipts = new Map<string, ReceiptV1 & { updatedAt: string }>();
  for (const row of r.data ?? []) {
    const rec = parseReceipt(await openJson(key, AAD.receipt(c.id, row.assignment_id as string), row.ciphertext as string));
    if (rec) receipts.set(rec.assignmentId, { ...rec, updatedAt: row.updated_at as string });
  }
  return Promise.all(
    (a.data ?? []).map(async (row) => {
      const env = (await openJson(key, AAD.assignment(c.id, row.id as string), row.ciphertext as string)) as AssignmentV1 | null;
      return {
        id: row.id as string,
        kind: row.kind as AssignmentKind,
        area: row.area as Area,
        createdAt: row.created_at as string,
        withdrawnAt: row.withdrawn_at as string | null,
        envelope: env && env.v === 1 ? env : null,
        receipt: receipts.get(row.id as string) ?? null,
      };
    }),
  );
}

export async function sendAssignment(
  privateKey: CryptoKey,
  coach: Pick<Coach, 'display_name' | 'profession'>,
  c: Connection,
  area: Area,
  body: AssignmentBody,
): Promise<string> {
  const id = crypto.randomUUID();
  const envelope: AssignmentV1 = {
    v: 1,
    id,
    area,
    sentAt: Date.now(),
    from: { name: coach.display_name, profession: coach.profession },
    body,
  };
  const ciphertext = await sealJson(await connectionKey(privateKey, c), AAD.assignment(c.id, id), envelope);
  const { error } = await sb.from('assignments').insert({ id, connection_id: c.id, kind: body.kind, area, ciphertext });
  if (error) fail(error);
  return id;
}

export async function withdrawAssignment(id: string): Promise<void> {
  const { error } = await sb.from('assignments').update({ withdrawn_at: new Date().toISOString() }).eq('id', id);
  if (error) fail(error);
}

/* ── Biblioteka ───────────────────────────────────────────────────────────────────── */

type LibRow = { id: string; kind: AssignmentKind; title: string; body: LibraryBody; created_at: string; updated_at: string };
const toItem = (r: LibRow): LibraryItem => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at });

export async function listLibrary(): Promise<LibraryItem[]> {
  const { data, error } = await sb.from('library_items').select('*').order('updated_at', { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as LibRow[]).map(toItem);
}

export async function saveLibraryItem(coachId: string, item: { id?: string; title: string; body: LibraryBody }): Promise<LibraryItem> {
  const row = { coach_id: coachId, kind: item.body.kind, title: item.title.trim().slice(0, 120), body: item.body };
  const q = item.id ? sb.from('library_items').update(row).eq('id', item.id) : sb.from('library_items').insert(row);
  const { data, error } = await q.select('*').single();
  if (error) fail(error);
  return toItem(data as LibRow);
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const { error } = await sb.from('library_items').delete().eq('id', id);
  if (error) fail(error);
}

export async function deleteAccount(): Promise<void> {
  const { error } = await sb.rpc('coach_delete_account');
  if (error) fail(error);
}
