import {
  AAD,
  cleanAreas,
  cleanPublicJwk,
  cleanScopes,
  isSnapshot,
  linkKey,
  openJson,
  parseMessage,
  parsePhoto,
  parseReceipt,
  sealJson,
} from '@gymtracker/link';
import type {
  Area,
  AssignmentBody,
  AssignmentKind,
  AssignmentV1,
  FormBody,
  HabitsBody,
  MealsBody,
  MessageRef,
  MessageV1,
  PhotoV1,
  Profession,
  PublicJwk,
  ReceiptV1,
  Scope,
  SnapshotV1,
} from '@gymtracker/link';
import type { PlanTemplate, Workout } from '@gt/types';
import { cancelNotify, notifyClient } from './notify';
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
  /**
   * Token powiadomień push od telefonu (`client_set_notify`) — `null`, gdy podopieczny ich nie włączył.
   * Sztab woła z nim serwer aplikacji GYM TRACKERa (`lib/notify.ts`), samym rodzajem zdarzenia.
   */
  notifyToken?: string | null;
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
  /** Zaplanowane: telefon dostaje je dopiero od tej chwili; `null` — od razu. */
  visibleFrom: string | null;
  /** Odszyfrowana treść; `null`, gdy szyfrogram się nie otworzył. */
  envelope: AssignmentV1 | null;
  receipt: (ReceiptV1 & { updatedAt: string }) | null;
}

/* ── Biblioteka ───────────────────────────────────────────────────────────────────── */

/**
 * Program — tylko w bibliotece, nigdy nie jedzie do telefonu jako całość: „Uruchom program” rozpisuje
 * go na zalecenia z datą „pokaż od” (dzień startu + `day`, o godzinie `time`), każde z elementu
 * biblioteki `itemId`. Oś czasu kursu jak w dużych platformach, bez nowego rodzaju po stronie telefonu.
 */
export interface ProgramStep {
  /** Dzień od startu (0 = dzień startu). */
  day: number;
  /** Godzina wypuszczenia, `HH:MM`, czas przeglądarki prowadzącego. */
  time: string;
  itemId: string;
}

export interface ProgramBody {
  kind: 'program';
  steps: ProgramStep[];
  note: string;
}

export type LibraryKind = AssignmentKind | 'program';
export const LIBRARY_KINDS: readonly LibraryKind[] = ['workout', 'plan', 'targets', 'labs', 'note', 'form', 'habits', 'meals', 'program'];

export type LibraryBody =
  | { kind: 'workout'; workout: Workout; videos: Record<string, string> }
  | { kind: 'plan'; plan: PlanTemplate }
  | Extract<AssignmentBody, { kind: 'targets' | 'labs' | 'note' }>
  | FormBody
  | HabitsBody
  | MealsBody
  | ProgramBody;

/** Treść, którą da się wysłać jako zalecenie (wszystko poza programem). */
export type SendableBody = Exclude<LibraryBody, ProgramBody>;

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
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
  notify_token: string | null;
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
    notifyToken: typeof r.notify_token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(r.notify_token) ? r.notify_token : null,
  };
};

const CONN_COLS =
  'id, invite_id, pseudonym, areas, scopes, client_public_key, status, ended_by, created_at, ended_at, last_push_at, notify_token, invites(label)';

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

/**
 * Koniec współpracy. Token powiadomień i to, co czeka w kolejce serwera aplikacji (zaplanowane zalecenia,
 * przypomnienia o przyszłych wizytach), trzeba przeczytać przed funkcją bazy — ona kasuje token, zalecenia
 * i przyszłe rezerwacje. Po udanym końcu: „zakończona” do podopiecznego i odwołanie zaplanowanych, żeby
 * prowadzący po rozstaniu niczego już nie wysłał. Odczyt jest po cichu: jego błąd nie blokuje końca.
 */
export async function endConnection(id: string): Promise<void> {
  const pending = await pendingNotify(id).catch(() => null);
  const { error } = await sb.rpc('coach_end_connection', { p_connection: id });
  if (error) fail(error);
  if (!pending?.token) return;
  const c = { notifyToken: pending.token };
  void notifyClient(c, 'ended');
  for (const ref of pending.refs) void cancelNotify(c, ref);
}

/** Token współpracy i numery zaplanowanych powiadomień: zalecenia „pokaż od” w przyszłości, przyszłe wizyty. */
async function pendingNotify(connectionId: string): Promise<{ token: string | null; refs: string[] }> {
  const { data, error } = await sb.from('connections').select('notify_token').eq('id', connectionId).maybeSingle();
  if (error) fail(error);
  const token = typeof data?.notify_token === 'string' ? (data.notify_token as string) : null;
  if (!token) return { token: null, refs: [] };
  const now = new Date().toISOString();
  // Przyszłe terminy prowadzącego (RLS: tylko jego) osobno, bez listy numerów w adresie zapytania.
  const [a, b, s] = await Promise.all([
    sb.from('assignments').select('id').eq('connection_id', connectionId).is('withdrawn_at', null).gt('visible_from', now),
    sb.from('bookings').select('id, slot_id').eq('connection_id', connectionId).is('cancelled_at', null),
    sb.from('slots').select('id').gt('starts_at', now),
  ]);
  const refs = a.error ? [] : (a.data ?? []).map((r) => r.id as string);
  const future = new Set(s.error ? [] : (s.data ?? []).map((r) => r.id as string));
  for (const r of b.error ? [] : (b.data ?? [])) if (future.has(r.slot_id as string)) refs.push(r.id as string);
  return { token, refs };
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
    sb
      .from('assignments')
      .select('id, kind, area, ciphertext, created_at, withdrawn_at, visible_from')
      .eq('connection_id', c.id)
      .order('created_at', { ascending: false }),
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
        visibleFrom: (row.visible_from as string | null) ?? null,
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
  opts: { visibleFrom?: Date | null } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  const visible = opts.visibleFrom && opts.visibleFrom.getTime() > Date.now() ? opts.visibleFrom : null;
  const envelope: AssignmentV1 = {
    v: 1,
    id,
    area,
    // Zaplanowane „przychodzi” do podopiecznego w chwili wypuszczenia — tak też je widzi.
    sentAt: visible ? visible.getTime() : Date.now(),
    from: { name: coach.display_name, profession: coach.profession },
    body,
  };
  const ciphertext = await sealJson(await connectionKey(privateKey, c), AAD.assignment(c.id, id), envelope);
  const { error } = await sb
    .from('assignments')
    .insert({ id, connection_id: c.id, kind: body.kind, area, ciphertext, visible_from: visible ? visible.toISOString() : null });
  if (error) fail(error);
  // Zaplanowane: serwer aplikacji trzyma je w kolejce do „pokaż od”; numer zalecenia pozwala je odwołać.
  void notifyClient(c, 'assignment', visible ? { at: visible, ref: id } : {});
  return id;
}

/**
 * Wycofanie (albo anulowanie zaplanowanego). Jeszcze niewidoczne — podopieczny nic nie wie, więc tylko
 * odwołanie zaplanowanego powiadomienia; już widoczne — „wycofane”. Zaplanowane, którego czas właśnie minął,
 * dostaje oba: kolejka serwera mogła go jeszcze nie wysłać (cron co 5 minut).
 */
export async function withdrawAssignment(c: Pick<Connection, 'notifyToken'>, a: Pick<SentAssignment, 'id' | 'visibleFrom'>): Promise<void> {
  const { error } = await sb.from('assignments').update({ withdrawn_at: new Date().toISOString() }).eq('id', a.id);
  if (error) fail(error);
  if (a.visibleFrom) void cancelNotify(c, a.id);
  if (!a.visibleFrom || !(Date.parse(a.visibleFrom) > Date.now())) void notifyClient(c, 'withdrawn');
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

/* ── Wiadomości ───────────────────────────────────────────────────────────────────── */

export interface Message {
  id: string;
  author: 'coach' | 'client';
  text: string;
  ref: MessageRef | null;
  /** Czas serwera. */
  createdAt: string;
  readAt: string | null;
}

/** Rozmowa z jednym podopiecznym, od najstarszej (najwyżej 500 ostatnich). Nieotwierające się — pomijane. */
export async function listMessages(privateKey: CryptoKey, c: Connection): Promise<Message[]> {
  const { data, error } = await sb
    .from('messages')
    .select('id, author, ciphertext, created_at, read_at')
    .eq('connection_id', c.id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) fail(error);
  const key = await connectionKey(privateKey, c);
  const out: Message[] = [];
  for (const row of (data ?? []).reverse()) {
    const m = parseMessage(await openJson(key, AAD.message(c.id, row.id as string, row.author as 'coach' | 'client'), row.ciphertext as string));
    if (!m || m.id.toLowerCase() !== row.id) continue;
    out.push({ id: row.id as string, author: row.author as 'coach' | 'client', text: m.text, ref: m.ref, createdAt: row.created_at as string, readAt: row.read_at as string | null });
  }
  return out;
}

export async function sendMessage(privateKey: CryptoKey, c: Connection, text: string, ref: MessageRef | null = null): Promise<string> {
  const id = crypto.randomUUID();
  const env: MessageV1 = { v: 1, id, at: Date.now(), text: text.trim().slice(0, 4000), ref };
  const ciphertext = await sealJson(await connectionKey(privateKey, c), AAD.message(c.id, id, 'coach'), env);
  const { error } = await sb.from('messages').insert({ id, connection_id: c.id, author: 'coach', ciphertext });
  if (error) fail(error);
  void notifyClient(c, 'message');
  return id;
}

/** Wiadomości od podopiecznego oznaczone jako przeczytane (telefon widzi „przeczytane”). */
export async function markRead(c: Pick<Connection, 'id'>): Promise<void> {
  const { error } = await sb
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('connection_id', c.id)
    .eq('author', 'client')
    .is('read_at', null);
  if (error) fail(error);
}

/** Nieprzeczytane wiadomości od podopiecznych: numer współpracy → ile. */
export async function unreadCounts(): Promise<Record<string, number>> {
  const { data, error } = await sb.from('messages').select('connection_id').eq('author', 'client').is('read_at', null).limit(1000);
  if (error) fail(error);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.connection_id as string] = (out[r.connection_id as string] ?? 0) + 1;
  return out;
}

/* ── Zdjęcia sylwetki ─────────────────────────────────────────────────────────────── */

export interface Photo extends PhotoV1 {
  createdAt: string;
}

/** Zdjęcia od podopiecznego, od najnowszego dnia. Nieotwierające się — pomijane. */
export async function listPhotos(privateKey: CryptoKey, c: Connection): Promise<Photo[]> {
  const { data, error } = await sb.from('photos').select('id, ciphertext, created_at').eq('connection_id', c.id).limit(60);
  if (error) fail(error);
  const key = await connectionKey(privateKey, c);
  const out: Photo[] = [];
  for (const row of data ?? []) {
    const p = parsePhoto(await openJson(key, AAD.photo(c.id, row.id as string), row.ciphertext as string));
    // Numer w środku musi być numerem wiersza — jak przy zaleceniach i wiadomościach.
    if (p && p.id.toLowerCase() === row.id) out.push({ ...p, createdAt: row.created_at as string });
  }
  return out.sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));
}

/* ── Kalendarz wizyt ──────────────────────────────────────────────────────────────── */

export interface SlotRow {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  title: string;
  place: string | null;
  note: string | null;
  cancelledAt: string | null;
}

export interface BookingRow {
  id: string;
  slotId: string;
  connectionId: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: 'client' | 'coach' | null;
}

type SlotDb = { id: string; starts_at: string; ends_at: string; capacity: number; title: string; place: string | null; note: string | null; cancelled_at: string | null };
const toSlot = (r: SlotDb): SlotRow => ({
  id: r.id,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  capacity: r.capacity,
  title: r.title,
  place: r.place,
  note: r.note,
  cancelledAt: r.cancelled_at,
});

/** Terminy prowadzącego, które zaczynają się w [od, do). */
export async function listSlots(from: Date, to: Date): Promise<SlotRow[]> {
  const { data, error } = await sb
    .from('slots')
    .select('id, starts_at, ends_at, capacity, title, place, note, cancelled_at')
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at');
  if (error) fail(error);
  return ((data ?? []) as SlotDb[]).map(toSlot);
}

export async function createSlots(
  coachId: string,
  rows: { startsAt: Date; endsAt: Date; capacity: number; title: string; place: string; note: string }[],
): Promise<SlotRow[]> {
  if (!rows.length) return [];
  const { data, error } = await sb
    .from('slots')
    .insert(
      rows.map((r) => ({
        coach_id: coachId,
        starts_at: r.startsAt.toISOString(),
        ends_at: r.endsAt.toISOString(),
        capacity: r.capacity,
        title: r.title.trim(),
        place: r.place.trim() || null,
        note: r.note.trim() || null,
      })),
    )
    .select('id, starts_at, ends_at, capacity, title, place, note, cancelled_at');
  if (error) fail(error);
  return ((data ?? []) as SlotDb[]).map(toSlot);
}

/**
 * Odwołanie terminu: zostaje jako ślad, telefon widzi rezerwację „odwołaną przez prowadzącego”. Każdy
 * zapisany dostaje „wizyta odwołana”, a jego przypomnienie znika z kolejki. Zapisanych i ich tokeny czyta
 * tu, świeżo z bazy (telefon mógł zarezerwować, gdy kalendarz był otwarty) — po cichu, po udanym odwołaniu.
 */
export async function cancelSlot(id: string): Promise<void> {
  const { error } = await sb.from('slots').update({ cancelled_at: new Date().toISOString() }).eq('id', id);
  if (error) fail(error);
  try {
    const active = (await listBookings([id])).filter((b) => !b.cancelledAt);
    if (!active.length) return;
    const tokens = await notifyTokens(active.map((b) => b.connectionId));
    for (const b of active) {
      const c = { notifyToken: tokens.get(b.connectionId) ?? null };
      void notifyClient(c, 'visit-cancel');
      void cancelNotify(c, b.id);
    }
  } catch {
    // Termin odwołany; powiadomienia to dodatek.
  }
}

/** Tokeny powiadomień współprac (numer → token); bez tokenu — brak w mapie. */
async function notifyTokens(connectionIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(connectionIds)];
  const { data, error } = await sb.from('connections').select('id, notify_token').in('id', ids);
  if (error) fail(error);
  const out = new Map<string, string>();
  for (const r of data ?? []) if (typeof r.notify_token === 'string') out.set(r.id as string, r.notify_token);
  return out;
}

export async function listBookings(slotIds: string[]): Promise<BookingRow[]> {
  if (!slotIds.length) return [];
  const { data, error } = await sb
    .from('bookings')
    .select('id, slot_id, connection_id, created_at, cancelled_at, cancelled_by')
    .in('slot_id', slotIds);
  if (error) fail(error);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    slotId: r.slot_id as string,
    connectionId: r.connection_id as string,
    createdAt: r.created_at as string,
    cancelledAt: r.cancelled_at as string | null,
    cancelledBy: r.cancelled_by as 'client' | 'coach' | null,
  }));
}

/** Przypomnienie o wizycie przychodzi tyle przed jej początkiem. */
export const VISIT_SOON_MS = 2 * 3_600_000;

/**
 * Prowadzący zapisuje podopiecznego na swój termin (może ponad limit — to jego decyzja). Podopieczny
 * dostaje „zapisano cię na wizytę” od razu i przypomnienie 2 h przed nią (numer rezerwacji pozwala je
 * odwołać); gdy do wizyty zostało mniej — samo pierwsze. Zwraca numer rezerwacji.
 */
export async function bookClient(slot: Pick<SlotRow, 'id' | 'startsAt'>, c: Pick<Connection, 'id' | 'notifyToken'>): Promise<string> {
  const { data, error } = await sb.from('bookings').insert({ slot_id: slot.id, connection_id: c.id }).select('id').single();
  if (error) fail(error);
  // Zapis się udał; bez numeru (nie powinno się zdarzyć) przypomnienie bez odwołania i tak nie wyjdzie.
  const id = String((data as { id?: unknown } | null)?.id ?? '');
  void notifyClient(c, 'visit');
  const soon = Date.parse(slot.startsAt) - VISIT_SOON_MS;
  if (soon > Date.now()) void notifyClient(c, 'visit-soon', { at: new Date(soon), ref: id });
  return id;
}

/** Odwołanie rezerwacji przez prowadzącego: „wizyta odwołana” i bez przypomnienia. `c` — współpraca tej rezerwacji. */
export async function cancelBooking(id: string, c: Pick<Connection, 'notifyToken'> | null | undefined): Promise<void> {
  const { error } = await sb.from('bookings').update({ cancelled_at: new Date().toISOString(), cancelled_by: 'coach' }).eq('id', id);
  if (error) fail(error);
  if (!c) return;
  void notifyClient(c, 'visit-cancel');
  void cancelNotify(c, id);
}
