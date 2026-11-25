import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AAD, generateIdentity, linkKey, notifyRef, sealJson } from '@gymtracker/link';
import type { Identity } from '@gymtracker/link';
import type { Connection } from '../src/lib/data';

/**
 * Gdzie Sztab powiadamia podopiecznego: funkcje `lib/data.ts` na bazie w pamięci (podmieniony klient
 * Supabase), z prawdziwym szyfrowaniem i z podmienionym `fetch` — sprawdzamy, co idzie do serwera
 * aplikacji GYM TRACKERa. Token leży w bazie zapieczętowany przez telefon i otwiera go dopiero wysyłka,
 * świeżo z bazy; numery zaplanowanych to HMAC tokenem, nie numery z bazy.
 */

const API = 'https://api.example.test';
const TOKEN_A = `A${'a'.repeat(42)}`;
const TOKEN_B = `B${'b'.repeat(42)}`;

type Row = Record<string, unknown>;
type Op = [string, unknown[]];

const st = vi.hoisted(() => ({
  db: {} as Record<string, Record<string, unknown>[]>,
  /** `tabela.operacja`, która kończy się błędem bazy. */
  fail: new Set<string>(),
  rpc: [] as [string, unknown][],
  /** Odczyty z bazy: `tabela.operacja`. */
  reads: [] as string[],
}));

vi.mock('../src/lib/env', async (orig) => ({ ...(await orig<typeof import('../src/lib/env')>()), TRACKER_API_URL: 'https://api.example.test' }));

/** Najmniejszy PostgREST: eq / is / gt / in na wierszach w pamięci, insert z `select().single()`, update. */
vi.mock('../src/lib/sb', () => {
  const run = (table: string, ops: Op[]) => {
    const first = ops[0]?.[0];
    st.reads.push(`${table}.${first}`);
    if (st.fail.has(`${table}.${first}`)) return { data: null, error: { message: `${table} ${first} failed` } };
    const rows = (st.db[table] ??= []);
    if (first === 'insert') {
      const row = { id: `${table}-new`, cancelled_at: null, ...(ops[0]![1][0] as Row) };
      rows.push(row);
      return { data: ops.some(([o]) => o === 'single') ? { id: row.id } : null, error: null };
    }
    const hit = rows.filter((r) =>
      ops.every(([op, args]) => {
        const [col, val] = args as [string, unknown];
        if (op === 'eq') return r[col] === val;
        if (op === 'is') return (r[col] ?? null) === val;
        if (op === 'gt') return typeof r[col] === 'string' && (r[col] as string) > (val as string);
        if (op === 'in') return (val as unknown[]).includes(r[col]);
        return true;
      }),
    );
    if (first === 'update') {
      for (const r of hit) Object.assign(r, ops[0]![1][0] as Row);
      return { data: null, error: null };
    }
    if (ops.some(([o]) => o === 'maybeSingle' || o === 'single')) return { data: hit[0] ?? null, error: null };
    return { data: hit, error: null };
  };
  const from = (table: string) => {
    const ops: Op[] = [];
    const q: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve().then(() => run(table, ops)).then(ok, bad);
          return (...args: unknown[]) => {
            ops.push([String(prop), args]);
            return q;
          };
        },
      },
    );
    return q;
  };
  // Koniec współpracy jak w bazie (`private.end_connection`): kasuje pieczęć, zalecenia i przyszłe rezerwacje.
  const rpc = async (name: string, args: { p_connection: string }) => {
    st.rpc.push([name, args]);
    if (st.fail.has(`rpc.${name}`)) return { error: { message: 'ended' } };
    const now = new Date().toISOString();
    const future = new Set((st.db.slots ?? []).filter((s) => (s.starts_at as string) > now).map((s) => s.id));
    st.db.assignments = (st.db.assignments ?? []).filter((a) => a.connection_id !== args.p_connection);
    st.db.bookings = (st.db.bookings ?? []).filter((b) => !(b.connection_id === args.p_connection && future.has(b.slot_id)));
    for (const c of st.db.connections ?? []) if (c.id === args.p_connection) Object.assign(c, { status: 'ended', notify_token: null });
    return { error: null };
  };
  return { sb: { from, rpc }, errorCode: (e: { message?: string } | null | undefined) => e?.message ?? 'unknown' };
});

const data = await import('../src/lib/data');
const { forgetNotify, notifyIdle } = await import('../src/lib/notify');

/** Prowadzący (klucz z sejfu) i trzy telefony — prawdziwe klucze ECDH. */
const coach = await generateIdentity();
const phones: Record<string, Identity> = { ca: await generateIdentity(), cb: await generateIdentity(), cs: await generateIdentity() };
const KEY = coach.privateKey;

/** Pieczęć tokenu tak, jak robi ją telefon (`client_set_notify`). */
const sealFor = async (id: string, token: string) =>
  sealJson(await linkKey(phones[id]!.privateKey, coach.publicJwk, `i-${id}`), AAD.notify(id), { v: 1, token });

const conn = (id: string, notifySealed: boolean): Connection => ({
  id,
  inviteId: `i-${id}`,
  pseudonym: 'ABCDEFGHJK0123456789',
  areas: ['training'],
  scopes: ['training'],
  clientKey: phones[id]!.publicJwk,
  status: 'active',
  endedBy: null,
  createdAt: '2026-11-01T10:00:00Z',
  endedAt: null,
  lastPushAt: null,
  label: null,
  notifySealed,
});

const A = conn('ca', true);
const B = conn('cb', true);
const SILENT = conn('cs', false);
const COACH = { display_name: 'Anna', profession: 'trainer' as const };
const NOTE = { kind: 'note' as const, title: 'Sen', text: 'Śpij 8 godzin.', checklist: [] };

const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ref = notifyRef;

let fetchMock: ReturnType<typeof vi.fn>;
/** Co poszło do serwera aplikacji: trasa i treść, po wysłaniu wszystkiego, co czeka w tle. */
const sent = async () => {
  await notifyIdle();
  return fetchMock.mock.calls.map(([url, init]) => [(url as string).replace(API, ''), JSON.parse((init as RequestInit).body as string)] as const);
};
/** Powiadomienia jednego działania idą równolegle — kolejność między nimi nie ma znaczenia. */
const sorted = <T,>(xs: readonly T[]) => [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const expectSent = async (want: (readonly [string, unknown])[]) => expect(sorted(await sent())).toEqual(sorted(want));

beforeEach(async () => {
  forgetNotify();
  st.db = {
    connections: [
      { id: 'ca', invite_id: 'i-ca', client_public_key: phones.ca!.publicJwk, notify_token: await sealFor('ca', TOKEN_A) },
      { id: 'cb', invite_id: 'i-cb', client_public_key: phones.cb!.publicJwk, notify_token: await sealFor('cb', TOKEN_B) },
      { id: 'cs', invite_id: 'i-cs', client_public_key: phones.cs!.publicJwk, notify_token: null },
    ],
  };
  st.fail.clear();
  st.rpc = [];
  st.reads = [];
  fetchMock = vi.fn(async () => ({ ok: true, status: 204 }) as Response);
  vi.stubGlobal('fetch', fetchMock);
});

describe('wiadomość', () => {
  it('od prowadzącego — „message” tokenem otwartym z pieczęci; bez pieczęci nic', async () => {
    await data.sendMessage(KEY, A, 'Jutro lżej.');
    await data.sendMessage(KEY, SILENT, 'Jutro lżej.');
    await expectSent([['/link/notify', { token: TOKEN_A, kind: 'message' }]]);
  });

  it('wiadomość do grupy (Podopieczni → „Napisz do zaznaczonych”) — każdy z tokenem osobno', async () => {
    for (const c of [A, SILENT, B]) await data.sendMessage(KEY, c, 'Zmiana godzin w przyszłym tygodniu.');
    await expectSent([
      ['/link/notify', { token: TOKEN_A, kind: 'message' }],
      ['/link/notify', { token: TOKEN_B, kind: 'message' }],
    ]);
  });

  it('nieudany zapis — bez powiadomienia', async () => {
    st.fail.add('messages.insert');
    await expect(data.sendMessage(KEY, A, 'x')).rejects.toThrow('messages insert failed');
    expect(await sent()).toEqual([]);
  });

  it('cudza pieczęć w wierszu (podłożona z innej współpracy) — nic', async () => {
    st.db.connections![0]!.notify_token = st.db.connections![1]!.notify_token;
    await data.sendMessage(KEY, A, 'x');
    expect(await sent()).toEqual([]);
  });
});

describe('świeży token', () => {
  it('telefon włączył powiadomienia po wczytaniu strony — wysyłka i odwołanie biorą token z bazy, nie z listy', async () => {
    // Lista wczytana, zanim telefon włączył powiadomienia: `notifySealed: false`. Pierwsza wiadomość — bez.
    const stale = conn('cs', false);
    await data.sendMessage(KEY, stale, 'Hej');
    expect(await sent()).toEqual([]);
    // Telefon włącza powiadomienia i sam rezerwuje wizytę (planuje swoje przypomnienie), strona dalej otwarta.
    st.db.connections![2]!.notify_token = await sealFor('cs', TOKEN_B);
    st.db.bookings = [{ id: 'bk-phone', slot_id: 's1', connection_id: 'cs', cancelled_at: null }];
    await data.cancelBooking(KEY, { id: 'bk-phone', connectionId: 'cs' });
    // Odwołanie czyta pieczęć od nowa (mimo pamięci sprzed chwili) i trafia w przypomnienie telefonu:
    // ten sam numer HMAC(token, rezerwacja). Następna wiadomość korzysta już z odświeżonej pieczęci.
    await data.sendMessage(KEY, stale, 'Odwołuję czwartek');
    await expectSent([
      ['/link/notify', { token: TOKEN_B, kind: 'visit-cancel' }],
      ['/link/cancel', { token: TOKEN_B, ref: await ref(TOKEN_B, 'bk-phone') }],
      ['/link/notify', { token: TOKEN_B, kind: 'message' }],
    ]);
  });

  it('program dla jednego podopiecznego: jeden odczyt pieczęci na całą partię; odwołanie czyta od nowa', async () => {
    for (let i = 0; i < 6; i++) await data.sendAssignment(KEY, COACH, A, 'training', NOTE, { visibleFrom: new Date(Date.now() + (i + 1) * 24 * H) });
    expect(await sent()).toHaveLength(6);
    expect(st.reads.filter((r) => r === 'connections.select')).toHaveLength(1);
    await data.withdrawAssignment(KEY, A, { id: 'as-x', visibleFrom: iso(Date.now() + 5 * H) });
    await sent();
    expect(st.reads.filter((r) => r === 'connections.select')).toHaveLength(2);
  });
});

describe('zalecenie', () => {
  it('wysłane teraz — „assignment” od razu', async () => {
    await data.sendAssignment(KEY, COACH, A, 'training', NOTE);
    await expectSent([['/link/notify', { token: TOKEN_A, kind: 'assignment' }]]);
  });

  it('zaplanowane — „assignment” o „pokaż od”, z numerem HMAC zalecenia (Wyślij i Uruchom program)', async () => {
    const at = new Date(Date.now() + 26 * H);
    const id = await data.sendAssignment(KEY, COACH, A, 'training', NOTE, { visibleFrom: at });
    const [[, body]] = (await sent()) as [[string, { ref: string }]];
    expect(body).toEqual({ token: TOKEN_A, kind: 'assignment', at: at.getTime(), ref: await ref(TOKEN_A, id) });
    expect(body.ref).toMatch(/^[0-9a-f]{32}$/);
    expect(body.ref).not.toBe(id);
    expect(st.db.assignments![0]).toMatchObject({ id, visible_from: at.toISOString() });
  });

  it('„pokaż od” w przeszłości to wysyłka teraz', async () => {
    await data.sendAssignment(KEY, COACH, A, 'training', NOTE, { visibleFrom: new Date(Date.now() - H) });
    await expectSent([['/link/notify', { token: TOKEN_A, kind: 'assignment' }]]);
  });

  it('nieudany zapis — bez powiadomienia', async () => {
    st.fail.add('assignments.insert');
    await expect(data.sendAssignment(KEY, COACH, A, 'training', NOTE)).rejects.toThrow();
    expect(await sent()).toEqual([]);
  });
});

describe('wycofanie', () => {
  it('zaplanowane, jeszcze niewidoczne — tylko odwołanie z kolejki', async () => {
    await data.withdrawAssignment(KEY, A, { id: 'as-1', visibleFrom: iso(Date.now() + 5 * H) });
    await expectSent([['/link/cancel', { token: TOKEN_A, ref: await ref(TOKEN_A, 'as-1') }]]);
  });

  it('już widoczne — „withdrawn”', async () => {
    await data.withdrawAssignment(KEY, A, { id: 'as-2', visibleFrom: null });
    await expectSent([['/link/notify', { token: TOKEN_A, kind: 'withdrawn' }]]);
  });

  it('zaplanowane, którego pora właśnie minęła — odwołanie (kolejka mogła nie zdążyć) i „withdrawn”', async () => {
    await data.withdrawAssignment(KEY, A, { id: 'as-3', visibleFrom: iso(Date.now() - 60_000) });
    await expectSent([
      ['/link/cancel', { token: TOKEN_A, ref: await ref(TOKEN_A, 'as-3') }],
      ['/link/notify', { token: TOKEN_A, kind: 'withdrawn' }],
    ]);
  });

  it('nieudane wycofanie — bez powiadomienia', async () => {
    st.fail.add('assignments.update');
    await expect(data.withdrawAssignment(KEY, A, { id: 'as-4', visibleFrom: null })).rejects.toThrow();
    expect(await sent()).toEqual([]);
  });
});

describe('wizyty', () => {
  it('zapis przez prowadzącego — „visit” teraz i „visit-soon” 2 h przed, z numerem HMAC rezerwacji', async () => {
    const startsAt = iso(Date.now() + 30 * H);
    const id = await data.bookClient(KEY, { id: 's1', startsAt }, A);
    expect(id).toBe('bookings-new');
    expect(st.db.bookings).toEqual([expect.objectContaining({ slot_id: 's1', connection_id: 'ca' })]);
    await expectSent([
      ['/link/notify', { token: TOKEN_A, kind: 'visit' }],
      ['/link/notify', { token: TOKEN_A, kind: 'visit-soon', at: Date.parse(startsAt) - 2 * H, ref: await ref(TOKEN_A, id) }],
    ]);
  });

  it('wizyta za mniej niż 2 h — samo „visit”', async () => {
    await data.bookClient(KEY, { id: 's1', startsAt: iso(Date.now() + H) }, A);
    await expectSent([['/link/notify', { token: TOKEN_A, kind: 'visit' }]]);
  });

  it('podopieczny już zapisany (błąd bazy) — bez powiadomień', async () => {
    st.fail.add('bookings.insert');
    await expect(data.bookClient(KEY, { id: 's1', startsAt: iso(Date.now() + 30 * H) }, A)).rejects.toThrow();
    expect(await sent()).toEqual([]);
  });

  it('odwołanie rezerwacji — „visit-cancel” i odwołanie przypomnienia', async () => {
    st.db.bookings = [{ id: 'bk-1', slot_id: 's1', connection_id: 'ca', cancelled_at: null }];
    await data.cancelBooking(KEY, { id: 'bk-1', connectionId: 'ca' });
    expect(st.db.bookings[0]).toMatchObject({ cancelled_by: 'coach' });
    await expectSent([
      ['/link/notify', { token: TOKEN_A, kind: 'visit-cancel' }],
      ['/link/cancel', { token: TOKEN_A, ref: await ref(TOKEN_A, 'bk-1') }],
    ]);
  });

  it('odwołanie całego terminu — każdy zapisany z tokenem, świeżo z bazy; odwołani wcześniej i inne terminy pominięte', async () => {
    st.db.slots = [{ id: 's1', starts_at: iso(Date.now() + 30 * H), cancelled_at: null }];
    st.db.bookings = [
      { id: 'bk-a', slot_id: 's1', connection_id: 'ca', created_at: iso(Date.now()), cancelled_at: null, cancelled_by: null },
      { id: 'bk-b', slot_id: 's1', connection_id: 'cb', created_at: iso(Date.now()), cancelled_at: null, cancelled_by: null },
      { id: 'bk-s', slot_id: 's1', connection_id: 'cs', created_at: iso(Date.now()), cancelled_at: null, cancelled_by: null },
      { id: 'bk-old', slot_id: 's1', connection_id: 'ca', created_at: iso(Date.now()), cancelled_at: iso(Date.now()), cancelled_by: 'client' },
      { id: 'bk-other', slot_id: 's2', connection_id: 'ca', created_at: iso(Date.now()), cancelled_at: null, cancelled_by: null },
    ];
    await data.cancelSlot(KEY, 's1');
    expect(st.db.slots[0]!.cancelled_at).toEqual(expect.any(String));
    await expectSent([
      ['/link/notify', { token: TOKEN_A, kind: 'visit-cancel' }],
      ['/link/cancel', { token: TOKEN_A, ref: await ref(TOKEN_A, 'bk-a') }],
      ['/link/notify', { token: TOKEN_B, kind: 'visit-cancel' }],
      ['/link/cancel', { token: TOKEN_B, ref: await ref(TOKEN_B, 'bk-b') }],
    ]);
  });

  it('termin nieodwołany (błąd bazy) — bez powiadomień; błąd odczytu zapisanych nie psuje odwołania', async () => {
    st.db.slots = [{ id: 's1', starts_at: iso(Date.now() + 30 * H), cancelled_at: null }];
    st.db.bookings = [{ id: 'bk-a', slot_id: 's1', connection_id: 'ca', cancelled_at: null }];
    st.fail.add('slots.update');
    await expect(data.cancelSlot(KEY, 's1')).rejects.toThrow();
    expect(await sent()).toEqual([]);

    st.fail.clear();
    st.fail.add('bookings.select');
    await expect(data.cancelSlot(KEY, 's1')).resolves.toBeUndefined();
    expect(await sent()).toEqual([]);
  });
});

describe('koniec współpracy', () => {
  beforeEach(() => {
    const now = Date.now();
    st.db.assignments = [
      { id: 'as-later', connection_id: 'ca', withdrawn_at: null, visible_from: iso(now + 48 * H) },
      { id: 'as-later-withdrawn', connection_id: 'ca', withdrawn_at: iso(now), visible_from: iso(now + 48 * H) },
      { id: 'as-shown', connection_id: 'ca', withdrawn_at: null, visible_from: iso(now - H) },
      { id: 'as-now', connection_id: 'ca', withdrawn_at: null, visible_from: null },
      { id: 'as-other', connection_id: 'cb', withdrawn_at: null, visible_from: iso(now + 48 * H) },
    ];
    st.db.slots = [
      { id: 'past', starts_at: iso(now - 72 * H) },
      { id: 'soon', starts_at: iso(now + 20 * H) },
    ];
    st.db.bookings = [
      { id: 'bk-past', slot_id: 'past', connection_id: 'ca', cancelled_at: null },
      { id: 'bk-soon', slot_id: 'soon', connection_id: 'ca', cancelled_at: null },
      { id: 'bk-soon-cancelled', slot_id: 'soon', connection_id: 'ca', cancelled_at: iso(now) },
      { id: 'bk-soon-b', slot_id: 'soon', connection_id: 'cb', cancelled_at: null },
    ];
  });

  it('„ended” tokenem sprzed funkcji bazy (ona kasuje pieczęć) i odwołanie wszystkiego, co czeka w kolejce', async () => {
    await data.endConnection(KEY, 'ca');
    expect(st.rpc).toEqual([['coach_end_connection', { p_connection: 'ca' }]]);
    expect(st.db.connections!.find((c) => c.id === 'ca')!.notify_token).toBeNull();
    await expectSent([
      ['/link/notify', { token: TOKEN_A, kind: 'ended' }],
      ['/link/cancel', { token: TOKEN_A, ref: await ref(TOKEN_A, 'as-later') }],
      ['/link/cancel', { token: TOKEN_A, ref: await ref(TOKEN_A, 'bk-soon') }],
    ]);
    // Po końcu pieczęć nie zostaje w pamięci — następna wysyłka nie ma czym powiadomić.
    await data.sendMessage(KEY, A, 'x');
    expect(await sent()).toHaveLength(3);
  });

  it('bez pieczęci — nic; nieudany koniec — nic; nieudany odczyt pieczęci nie blokuje końca', async () => {
    await data.endConnection(KEY, 'cs');
    expect(await sent()).toEqual([]);

    st.fail.add('rpc.coach_end_connection');
    await expect(data.endConnection(KEY, 'ca')).rejects.toThrow('ended');
    expect(await sent()).toEqual([]);

    st.fail.clear();
    st.fail.add('connections.select');
    await data.endConnection(KEY, 'ca');
    expect(st.rpc.at(-1)).toEqual(['coach_end_connection', { p_connection: 'ca' }]);
    expect(await sent()).toEqual([]);
  });

  it('błąd odczytu kolejki (zalecenia, wizyty) — samo „ended”', async () => {
    st.fail.add('assignments.select');
    st.fail.add('slots.select');
    await data.endConnection(KEY, 'ca');
    await expectSent([['/link/notify', { token: TOKEN_A, kind: 'ended' }]]);
  });
});

describe('numery z bazy nie wychodzą', () => {
  it('żadne zapytanie do serwera aplikacji nie niesie numeru zalecenia, rezerwacji ani współpracy', async () => {
    const id = await data.sendAssignment(KEY, COACH, A, 'training', NOTE, { visibleFrom: new Date(Date.now() + 26 * H) });
    const bk = await data.bookClient(KEY, { id: 's1', startsAt: iso(Date.now() + 30 * H) }, A);
    await data.withdrawAssignment(KEY, A, { id, visibleFrom: iso(Date.now() + 26 * H) });
    st.db.bookings!.push({ id: 'bk-9', slot_id: 's1', connection_id: 'ca', cancelled_at: null });
    await data.cancelBooking(KEY, { id: 'bk-9', connectionId: 'ca' });
    const all = JSON.stringify(await sent());
    expect((await sent()).length).toBeGreaterThanOrEqual(5);
    for (const raw of [id, bk, 'bk-9', 'ca', 'i-ca']) expect(all).not.toContain(`"${raw}"`);
  });
});
