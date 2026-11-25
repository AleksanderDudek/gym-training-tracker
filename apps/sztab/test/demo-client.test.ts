import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AAD, addDays, generateIdentity, isSnapshot, linkKey, openJson, parseMessage, parsePhoto, parseReceipt } from '@gymtracker/link';
import type { AssignmentV1, CoachingV1, HabitsBody, PublicJwk, SnapshotV1 } from '@gymtracker/link';

/**
 * Podopieczny demonstracyjny na udawanym serwerze: te same funkcje bazy co telefon (`invite_accept`,
 * `client_pull`, `client_push` z limitem 30 s, `client_receipt`, wiadomości, zdjęcia, terminy), prawdziwe
 * szyfrowanie. Sprawdza, że telefon demo odpowiada tylko od dnia wysłania, nigdy z przyszłości, z realizacją
 * 70–90 %, i że „Usuń demo” kończy współpracę i czyści przeglądarkę.
 */

vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

type Row = Record<string, unknown>;
interface Conn {
  inviteId: string;
  pseudonym: string;
  publicKey: PublicJwk;
  token: string;
  status: 'active' | 'ended';
  scopes: string[];
  lastPush: number | null;
}

const db = vi.hoisted(() => ({
  now: 0,
  invites: new Map<string, Row>(),
  conns: new Map<string, Conn>(),
  tables: {} as Record<string, Row[]>,
  snapshots: new Map<string, string>(),
  receipts: new Map<string, string>(),
  photos: [] as { id: string; connection: string; ciphertext: string }[],
  reads: [] as string[],
  slots: [] as { id: string; taken: number; capacity: number }[],
  bookings: [] as { id: string; slotId: string; connection: string }[],
  calls: [] as string[],
}));

const table = (name: string): Row[] => (db.tables[name] ??= []);

function conn(args: Row): [string, Conn] {
  const id = args.p_connection as string;
  const c = db.conns.get(id);
  if (!c || c.status !== 'active' || c.token !== args.p_token) throw new Error('bad_token');
  return [id, c];
}

/** Udawany serwer: tyle logiki funkcji telefonu, ile sprawdza ten test. */
async function server(fn: string, args: Row): Promise<unknown> {
  db.calls.push(fn);
  switch (fn) {
    case 'invite_accept': {
      if (!db.invites.has(args.p_invite as string)) throw new Error('invite_missing');
      const id = crypto.randomUUID();
      db.conns.set(id, {
        inviteId: args.p_invite as string,
        pseudonym: args.p_pseudonym as string,
        publicKey: args.p_public_key as PublicJwk,
        token: args.p_token as string,
        status: 'active',
        scopes: args.p_scopes as string[],
        lastPush: null,
      });
      return id;
    }
    case 'client_pull': {
      const [id, c] = conn(args);
      const rows = table('assignments').filter((a) => a.connection_id === id);
      return { status: c.status, scopes: c.scopes, assignments: rows.map((a) => ({ id: a.id, kind: a.kind, ciphertext: a.ciphertext, withdrawnAt: null })) };
    }
    case 'client_push': {
      const [id, c] = conn(args);
      if (c.lastPush !== null && db.now - c.lastPush < 30_000) return { ok: false, retryAfter: 30 };
      c.lastPush = db.now;
      db.snapshots.set(id, args.p_ciphertext as string);
      return { ok: true };
    }
    case 'client_receipt':
      conn(args);
      db.receipts.set(args.p_assignment as string, args.p_ciphertext as string);
      return null;
    case 'client_messages': {
      const [id] = conn(args);
      return { messages: table('messages').filter((m) => m.connection_id === id) };
    }
    case 'client_message': {
      const [id] = conn(args);
      db.now += 1000;
      table('messages').push({ id: args.p_id, connection_id: id, author: 'client', ciphertext: args.p_ciphertext, createdAt: new Date(db.now).toISOString() });
      return { createdAt: new Date(db.now).toISOString() };
    }
    case 'client_read':
      conn(args);
      db.reads.push(args.p_upto as string);
      return null;
    case 'client_photo_put': {
      const [id, c] = conn(args);
      if (!c.scopes.includes('photos')) throw new Error('no_scope');
      db.photos.push({ id: args.p_id as string, connection: id, ciphertext: args.p_ciphertext as string });
      return null;
    }
    case 'client_slots': {
      const [id] = conn(args);
      const mine = db.bookings.filter((b) => b.connection === id).map((b) => ({ id: b.id, cancelledAt: null, startsAt: new Date(db.now + 86_400_000).toISOString() }));
      return { slots: db.slots, bookings: mine };
    }
    case 'client_book': {
      const [id] = conn(args);
      const slot = db.slots.find((s) => s.id === args.p_slot)!;
      slot.taken++;
      const b = { id: crypto.randomUUID(), slotId: slot.id, connection: id };
      db.bookings.push(b);
      return b.id;
    }
    default:
      throw new Error(`unexpected ${fn}`);
  }
}

vi.mock('../src/lib/sb', () => ({
  errorCode: (e: { message?: string } | null) => e?.message ?? 'unknown',
  sb: {
    rpc: (fn: string, args: Row) =>
      server(fn, args).then(
        (data) => ({ data, error: null }),
        (e: Error) => ({ data: null, error: { message: e.message } }),
      ),
    from: (name: string) => ({
      insert: async (rows: Row | Row[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        table(name).push(...list.map((r) => ({ created_at: new Date(db.now).toISOString(), createdAt: new Date(db.now).toISOString(), ...r })));
        return { error: null };
      },
    }),
  },
}));

vi.mock('../src/lib/data', async (orig) => ({
  ...(await orig<typeof import('../src/lib/data')>()),
  createInvite: vi.fn(async (_coach: string, input: Row) => {
    const id = crypto.randomUUID();
    db.invites.set(id, input);
    return { id, ...input };
  }),
  getConnection: vi.fn(async (id: string) => ({ id, status: db.conns.get(id)?.status ?? 'ended' })),
  endConnection: vi.fn(async (id: string) => {
    const c = db.conns.get(id);
    if (c) c.status = 'ended';
  }),
}));

const { createDemoClient, simulateDemo, removeDemo, HISTORY_DAYS } = await import('../src/lib/demo/client');
const { loadDemo, isDemo } = await import('../src/lib/demo/state');
const { HELLO, REPLIES, answerAt, formAnswerDays, photoDays, simulateCoaching } = await import('../src/lib/demo/phone');
const { dayIn } = await import('../src/lib/coached');
const { loadAliases } = await import('../src/lib/aliases');
const data = await import('../src/lib/data');

const TZ = 'Europe/Warsaw';
const DAY = 86_400_000;
const coachId = '0b6a3f0e-7a51-4a8e-9a8b-3d6f1c2e9a10';
const me = await generateIdentity();
const ctx = { coach: { id: coachId, display_name: 'Ola', profession: 'trainer' as const, public_key: me.publicJwk }, userId: 'u1', key: me.privateKey };
const waits: number[] = [];
const wait = async (ms: number) => {
  waits.push(ms);
  db.now += ms;
};
const photos = async (days: string[]) => days.map((day) => ({ day, w: 2, h: 2, jpeg: 'AAAA' }));

/** Klucz współpracy po stronie prowadzącego — tym Sztab czyta paczkę. */
const coachKey = (id: string) => linkKey(me.privateKey, db.conns.get(id)!.publicKey, db.conns.get(id)!.inviteId);

async function snapshotOf(id: string): Promise<SnapshotV1> {
  const s = await openJson(await coachKey(id), AAD.snapshot(id), db.snapshots.get(id)!);
  if (!isSnapshot(s)) throw new Error('snapshot');
  return s;
}

async function sentEnvelopes(id: string): Promise<Map<string, AssignmentV1>> {
  const key = await coachKey(id);
  const out = new Map<string, AssignmentV1>();
  for (const row of table('assignments').filter((a) => a.connection_id === id))
    out.set(row.id as string, (await openJson(key, AAD.assignment(id, row.id as string), row.ciphertext as string)) as AssignmentV1);
  return out;
}

/** Każda odpowiedź i odhaczenie — nie sprzed dnia wysłania, nie z przyszłości. */
function expectBounded(coaching: CoachingV1, sent: Map<string, AssignmentV1>, now: number) {
  const today = dayIn(TZ, now);
  for (const a of coaching.answers) {
    const env = sent.get(a.assignmentId)!;
    expect(a.at).toBeGreaterThanOrEqual(env.sentAt);
    expect(a.at).toBeLessThanOrEqual(now);
  }
  for (const t of [...coaching.habits, ...coaching.meals]) {
    const sentDay = dayIn(TZ, sent.get(t.assignmentId)!.sentAt);
    for (const day of Object.keys(t.days)) {
      expect(day >= sentDay, `${day} ≥ ${sentDay}`).toBe(true);
      expect(day <= today, `${day} ≤ ${today}`).toBe(true);
    }
  }
}

beforeEach(() => {
  localStorage.clear();
  db.now = Date.now();
  db.invites.clear();
  db.conns.clear();
  db.tables = {};
  db.snapshots.clear();
  db.receipts.clear();
  db.photos = [];
  db.reads = [];
  db.slots = [{ id: crypto.randomUUID(), taken: 0, capacity: 1 }];
  db.bookings = [];
  db.calls = [];
  waits.length = 0;
});

describe('Podopieczny demonstracyjny', () => {
  it('zakłada współpracę przez invite_accept, wysyła historię z odpowiedziami, wiadomości i zdjęcia; stan telefonu w tej przeglądarce', async () => {
    const now = Date.now();
    const s = await createDemoClient(ctx, { now, photos, wait });

    expect(vi.mocked(data.createInvite)).toHaveBeenCalledWith(coachId, expect.objectContaining({ label: 'DEMO', areas: ['training', 'nutrition'], scopes: expect.arrayContaining(['photos', 'food']) }));
    expect(db.calls[0]).toBe('invite_accept');
    expect(loadDemo('u1')).toEqual(s);
    expect(isDemo('u1', s.connectionId)).toBe(true);
    expect(loadAliases('u1')[s.pseudonym]).toBe('Demo');

    // Zalecenia „z historią”: wysłane wstecz, każde otwiera się kluczem prowadzącego i przechodzi sprawdzenie telefonu.
    const sent = await sentEnvelopes(s.connectionId);
    expect(sent.size).toBe(7);
    const kinds = [...sent.values()].map((a) => a.body.kind).sort();
    expect(kinds).toEqual(['form', 'form', 'habits', 'meals', 'note', 'plan', 'targets']);
    for (const a of sent.values()) expect(a.sentAt).toBeLessThanOrEqual(now - 14 * DAY);
    expect(Math.min(...[...sent.values()].map((a) => a.sentAt))).toBe(now - HISTORY_DAYS * DAY);

    // Paczka z częścią „coaching”: wywiad raz, check-in co tydzień, nawyki i jadłospis dzień po dniu.
    const snap = await snapshotOf(s.connectionId);
    expect(snap.tz).toBe(TZ);
    expect(snap.scopes).not.toContain('photos');
    expect(snap.training?.log.length).toBeGreaterThan(10);
    const coaching = snap.coaching!;
    expectBounded(coaching, sent, now);
    const intake = [...sent.entries()].find(([, a]) => a.body.kind === 'form' && a.body.intake)!;
    expect(coaching.answers.filter((a) => a.assignmentId === intake[0])).toHaveLength(1);
    const checkin = [...sent.entries()].find(([, a]) => a.body.kind === 'form' && a.body.repeat === 'weekly')!;
    const weekly = coaching.answers.filter((a) => a.assignmentId === checkin[0]);
    expect(weekly.length).toBeGreaterThanOrEqual(2);
    expect(new Set(weekly.map((a) => a.period)).size).toBe(weekly.length);
    // Waga w check-inie z wagi telefonu, nie z połowy zakresu pytania.
    for (const a of weekly) if (typeof a.values.q1 === 'number') expect(a.values.q1).toBeGreaterThan(80);

    // Realizacja nawyków 70–90 % (pseudolosowo, więc z zapasem), dziś — tylko część dnia.
    const habitsRow = [...sent.entries()].find(([, a]) => a.body.kind === 'habits')!;
    const ticks = coaching.habits.find((t) => t.assignmentId === habitsRow[0])!;
    const today = dayIn(TZ, now);
    const sentDay = dayIn(TZ, habitsRow[1].sentAt);
    const items = (habitsRow[1].body as HabitsBody).items.length;
    let due = 0;
    let done = 0;
    for (let d = sentDay; d < today; d = addDays(d, 1)) {
      due += items;
      done += ticks.days[d]?.length ?? 0;
    }
    expect(done / due).toBeGreaterThan(0.6);
    expect(done / due).toBeLessThan(0.95);
    expect(coaching.meals).toHaveLength(1);

    // Potwierdzenia: plan „rozpoczęty”, cele „przeczytane”.
    const key = await coachKey(s.connectionId);
    const status = async (kind: string) => {
      const [id] = [...sent.entries()].find(([, a]) => a.body.kind === kind)!;
      return parseReceipt(await openJson(key, AAD.receipt(s.connectionId, id), db.receipts.get(id)!))!.status;
    };
    expect(await status('plan')).toBe('started');
    expect(await status('targets')).toBe('seen');

    // Dwie wiadomości od podopiecznego i trzy zdjęcia (zgoda `photos`).
    const msgs = table('messages').filter((m) => m.author === 'client');
    expect(msgs).toHaveLength(2);
    const texts = await Promise.all(msgs.map(async (m) => parseMessage(await openJson(key, AAD.message(s.connectionId, m.id as string, 'client'), m.ciphertext as string))!.text));
    expect(texts).toEqual(HELLO.pl);
    expect(db.photos).toHaveLength(3);
    const opened = await Promise.all(db.photos.map(async (p) => parsePhoto(await openJson(key, AAD.photo(s.connectionId, p.id), p.ciphertext))));
    expect(opened.map((p) => p!.day)).toEqual(photoDays(now));
  });

  it('„Symuluj telefon”: odpowiada na to, co wysłano dziś, tylko od dnia wysłania; czeka swoją kolej na paczkę; odpisuje na ostatnią wiadomość i rezerwuje termin', async () => {
    const s = await createDemoClient(ctx, { now: Date.now(), photos, wait });
    const c = { id: s.connectionId, clientKey: db.conns.get(s.connectionId)!.publicKey, inviteId: s.inviteId } as Parameters<typeof data.sendAssignment>[2];
    const habits: HabitsBody = { kind: 'habits', title: 'Nowe', note: '', until: null, items: [{ label: 'Woda', dose: '', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] }] };
    const fresh = await data.sendAssignment(ctx.key, ctx.coach, c, 'training', habits);
    await data.sendMessage(ctx.key, c, 'Jak poszedł dzisiejszy trening?');
    const coachMsg = table('messages').at(-1)!;

    const r = await simulateDemo(ctx, { wait });
    const now = Date.now();
    expect(r.assignments).toBe(8);
    expect(r.receipts).toBe(8);
    // Paczkę sprzed chwili serwer jeszcze pamięta (30 s) — telefon czeka swoją kolej i wysyła.
    expect(waits).toEqual([31_000]);
    expect(r.push).toBe('sent');

    const sent = await sentEnvelopes(s.connectionId);
    const coaching = (await snapshotOf(s.connectionId)).coaching!;
    expectBounded(coaching, sent, now);
    const days = Object.keys(coaching.habits.find((t) => t.assignmentId === fresh.toLowerCase())!.days);
    expect(days.every((d) => d === dayIn(TZ, now))).toBe(true);

    expect(r.replied).toBe(true);
    const reply = table('messages').at(-1)!;
    expect(reply.author).toBe('client');
    const key = await coachKey(s.connectionId);
    expect(REPLIES.pl).toContain(parseMessage(await openJson(key, AAD.message(s.connectionId, reply.id as string, 'client'), reply.ciphertext as string))!.text);
    expect(db.reads).toContain(coachMsg.createdAt);
    expect(r.booked).toBe(true);
    expect(db.bookings).toHaveLength(1);

    // Drugi raz: ostatnie słowo ma już podopieczny, termin zarezerwowany — bez powtórek.
    db.now += 60_000;
    const again = await simulateDemo(ctx, { wait });
    expect(again.replied).toBe(false);
    expect(again.booked).toBe(false);
    expect(db.bookings).toHaveLength(1);
  });

  it('„Usuń demo” kończy współpracę i czyści stan w przeglądarce; symulacja zakończonej — też czyści', async () => {
    const s = await createDemoClient(ctx, { now: Date.now(), photos, wait });
    await removeDemo('u1');
    expect(vi.mocked(data.endConnection)).toHaveBeenCalledWith(s.connectionId);
    expect(db.conns.get(s.connectionId)!.status).toBe('ended');
    expect(loadDemo('u1')).toBeNull();

    const t = await createDemoClient(ctx, { now: Date.now(), photos, wait });
    db.conns.get(t.connectionId)!.status = 'ended';
    await expect(simulateDemo(ctx, { wait })).rejects.toThrow('bad_token');
    expect(loadDemo('u1')).toBeNull();
  });
});

describe('Dni odpowiedzi telefonu demo', () => {
  const today = '2026-11-25'; // środa

  it('nigdy sprzed dnia wysłania i nigdy po dziś', () => {
    for (const sentDay of ['2026-10-20', '2026-11-02', '2026-11-24', today]) {
      for (const form of [
        { repeat: 'weekly' as const, weekday: 1 },
        { repeat: 'weekly' as const, weekday: 5 },
        { repeat: 'daily' as const, weekday: null },
        { repeat: 'once' as const, weekday: null },
      ]) {
        const days = formAnswerDays(form, `row-${sentDay}`, sentDay, today);
        for (const d of days) {
          expect(d >= sentDay && d <= today, `${form.repeat} ${sentDay}: ${d}`).toBe(true);
        }
      }
    }
    expect(formAnswerDays({ repeat: 'once', weekday: null }, 'x', today, today)).toEqual([today]);
    expect(formAnswerDays({ repeat: 'once', weekday: null }, 'x', '2026-11-26', today)).toEqual([]);
    // Cotygodniowy na piątek wysłany w środę: w tym tygodniu jeszcze nic.
    expect(formAnswerDays({ repeat: 'weekly', weekday: 5 }, 'x', today, today)).toEqual([]);
  });

  it('chwila odpowiedzi po wysłaniu i nie w przyszłości', () => {
    const now = Date.parse('2026-11-25T09:00:00Z');
    const sentAt = Date.parse('2026-11-25T08:30:00Z');
    const at = answerAt(today, sentAt, now);
    expect(at).toBeGreaterThanOrEqual(sentAt);
    expect(at).toBeLessThanOrEqual(now);
  });

  it('zalecenie z wysłaniem w przyszłości (zaplanowane) — bez odpowiedzi i odhaczeń', () => {
    const now = Date.parse('2026-11-25T12:00:00Z');
    const a: AssignmentV1 = {
      v: 1,
      id: 'r1',
      area: 'training',
      sentAt: now + 3 * DAY,
      from: { name: 'Ola', profession: 'trainer' },
      body: { kind: 'habits', title: 'H', note: '', until: null, items: [{ label: 'Woda', dose: '', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] }] },
    };
    expect(simulateCoaching([{ rowId: 'r1', a }], { now, lang: 'pl' })).toEqual({ answers: [], habits: [], meals: [] });
  });
});
