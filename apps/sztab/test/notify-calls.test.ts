import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '../src/lib/data';

/**
 * Gdzie Sztab powiadamia podopiecznego: funkcje `lib/data.ts` na bazie w pamięci (podmieniony klient
 * Supabase) i z podmienionym `fetch` — sprawdzamy, co idzie do serwera aplikacji GYM TRACKERa.
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
}));

vi.mock('../src/lib/env', async (orig) => ({ ...(await orig<typeof import('../src/lib/env')>()), TRACKER_API_URL: 'https://api.example.test' }));

vi.mock('@gymtracker/link', async (orig) => ({
  ...(await orig<typeof import('@gymtracker/link')>()),
  linkKey: vi.fn(async () => ({}) as CryptoKey),
  sealJson: vi.fn(async () => 'v1.sealed'),
}));

/** Najmniejszy PostgREST: eq / is / gt / in na wierszach w pamięci, insert z `select().single()`, update. */
vi.mock('../src/lib/sb', () => {
  const run = (table: string, ops: Op[]) => {
    const first = ops[0]?.[0];
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
  // Koniec współpracy jak w bazie (`private.end_connection`): kasuje token, zalecenia i przyszłe rezerwacje.
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

const conn = (id: string, notifyToken: string | null): Connection => ({
  id,
  inviteId: `i-${id}`,
  pseudonym: 'ABCDEFGHJK0123456789',
  areas: ['training'],
  scopes: ['training'],
  clientKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as Connection['clientKey'],
  status: 'active',
  endedBy: null,
  createdAt: '2026-11-01T10:00:00Z',
  endedAt: null,
  lastPushAt: null,
  label: null,
  notifyToken,
});

const A = conn('ca', TOKEN_A);
const B = conn('cb', TOKEN_B);
const SILENT = conn('cs', null);
const KEY = {} as CryptoKey;
const COACH = { display_name: 'Anna', profession: 'trainer' as const };
const NOTE = { kind: 'note' as const, title: 'Sen', text: 'Śpij 8 godzin.', checklist: [] };

const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

let fetchMock: ReturnType<typeof vi.fn>;
/** Co poszło do serwera aplikacji: trasa i treść. */
const sent = () => fetchMock.mock.calls.map(([url, init]) => [(url as string).replace(API, ''), JSON.parse((init as RequestInit).body as string)] as const);

beforeEach(() => {
  st.db = {
    connections: [
      { id: 'ca', notify_token: TOKEN_A },
      { id: 'cb', notify_token: TOKEN_B },
      { id: 'cs', notify_token: null },
    ],
  };
  st.fail.clear();
  st.rpc = [];
  fetchMock = vi.fn(async () => ({ ok: true, status: 204 }) as Response);
  vi.stubGlobal('fetch', fetchMock);
});

describe('wiadomość', () => {
  it('od prowadzącego — „message”; bez tokenu nic', async () => {
    await data.sendMessage(KEY, A, 'Jutro lżej.');
    await data.sendMessage(KEY, SILENT, 'Jutro lżej.');
    expect(sent()).toEqual([['/link/notify', { token: TOKEN_A, kind: 'message' }]]);
  });

  it('wiadomość do grupy (Podopieczni → „Napisz do zaznaczonych”) — każdy z tokenem osobno', async () => {
    for (const c of [A, SILENT, B]) await data.sendMessage(KEY, c, 'Zmiana godzin w przyszłym tygodniu.');
    expect(sent()).toEqual([
      ['/link/notify', { token: TOKEN_A, kind: 'message' }],
      ['/link/notify', { token: TOKEN_B, kind: 'message' }],
    ]);
  });

  it('nieudany zapis — bez powiadomienia', async () => {
    st.fail.add('messages.insert');
    await expect(data.sendMessage(KEY, A, 'x')).rejects.toThrow('messages insert failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('zalecenie', () => {
  it('wysłane teraz — „assignment” od razu', async () => {
    await data.sendAssignment(KEY, COACH, A, 'training', NOTE);
    expect(sent()).toEqual([['/link/notify', { token: TOKEN_A, kind: 'assignment' }]]);
  });

  it('zaplanowane — „assignment” o „pokaż od”, z numerem zalecenia (Wyślij i Uruchom program)', async () => {
    const at = new Date(Date.now() + 26 * H);
    const id = await data.sendAssignment(KEY, COACH, A, 'training', NOTE, { visibleFrom: at });
    expect(sent()).toEqual([['/link/notify', { token: TOKEN_A, kind: 'assignment', at: at.getTime(), ref: id }]]);
    expect(st.db.assignments![0]).toMatchObject({ id, visible_from: at.toISOString() });
  });

  it('„pokaż od” w przeszłości to wysyłka teraz', async () => {
    await data.sendAssignment(KEY, COACH, A, 'training', NOTE, { visibleFrom: new Date(Date.now() - H) });
    expect(sent()).toEqual([['/link/notify', { token: TOKEN_A, kind: 'assignment' }]]);
  });

  it('nieudany zapis — bez powiadomienia', async () => {
    st.fail.add('assignments.insert');
    await expect(data.sendAssignment(KEY, COACH, A, 'training', NOTE)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('wycofanie', () => {
  it('zaplanowane, jeszcze niewidoczne — tylko odwołanie z kolejki', async () => {
    await data.withdrawAssignment(A, { id: 'as-1', visibleFrom: iso(Date.now() + 5 * H) });
    expect(sent()).toEqual([['/link/cancel', { token: TOKEN_A, ref: 'as-1' }]]);
  });

  it('już widoczne — „withdrawn”', async () => {
    await data.withdrawAssignment(A, { id: 'as-2', visibleFrom: null });
    expect(sent()).toEqual([['/link/notify', { token: TOKEN_A, kind: 'withdrawn' }]]);
  });

  it('zaplanowane, którego pora właśnie minęła — odwołanie (kolejka mogła nie zdążyć) i „withdrawn”', async () => {
    await data.withdrawAssignment(A, { id: 'as-3', visibleFrom: iso(Date.now() - 60_000) });
    expect(sent()).toEqual([
      ['/link/cancel', { token: TOKEN_A, ref: 'as-3' }],
      ['/link/notify', { token: TOKEN_A, kind: 'withdrawn' }],
    ]);
  });

  it('nieudane wycofanie — bez powiadomienia', async () => {
    st.fail.add('assignments.update');
    await expect(data.withdrawAssignment(A, { id: 'as-4', visibleFrom: null })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('wizyty', () => {
  it('zapis przez prowadzącego — „visit” teraz i „visit-soon” 2 h przed, z numerem rezerwacji', async () => {
    const startsAt = iso(Date.now() + 30 * H);
    const id = await data.bookClient({ id: 's1', startsAt }, A);
    expect(id).toBe('bookings-new');
    expect(st.db.bookings).toEqual([expect.objectContaining({ slot_id: 's1', connection_id: 'ca' })]);
    expect(sent()).toEqual([
      ['/link/notify', { token: TOKEN_A, kind: 'visit' }],
      ['/link/notify', { token: TOKEN_A, kind: 'visit-soon', at: Date.parse(startsAt) - 2 * H, ref: id }],
    ]);
  });

  it('wizyta za mniej niż 2 h — samo „visit”', async () => {
    await data.bookClient({ id: 's1', startsAt: iso(Date.now() + H) }, A);
    expect(sent()).toEqual([['/link/notify', { token: TOKEN_A, kind: 'visit' }]]);
  });

  it('podopieczny już zapisany (błąd bazy) — bez powiadomień', async () => {
    st.fail.add('bookings.insert');
    await expect(data.bookClient({ id: 's1', startsAt: iso(Date.now() + 30 * H) }, A)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('odwołanie rezerwacji — „visit-cancel” i odwołanie przypomnienia', async () => {
    st.db.bookings = [{ id: 'bk-1', slot_id: 's1', connection_id: 'ca', cancelled_at: null }];
    await data.cancelBooking('bk-1', A);
    expect(st.db.bookings[0]).toMatchObject({ cancelled_by: 'coach' });
    expect(sent()).toEqual([
      ['/link/notify', { token: TOKEN_A, kind: 'visit-cancel' }],
      ['/link/cancel', { token: TOKEN_A, ref: 'bk-1' }],
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
    await data.cancelSlot('s1');
    expect(st.db.slots[0]!.cancelled_at).toEqual(expect.any(String));
    expect(sent()).toEqual([
      ['/link/notify', { token: TOKEN_A, kind: 'visit-cancel' }],
      ['/link/cancel', { token: TOKEN_A, ref: 'bk-a' }],
      ['/link/notify', { token: TOKEN_B, kind: 'visit-cancel' }],
      ['/link/cancel', { token: TOKEN_B, ref: 'bk-b' }],
    ]);
  });

  it('termin nieodwołany (błąd bazy) — bez powiadomień; błąd odczytu zapisanych nie psuje odwołania', async () => {
    st.db.slots = [{ id: 's1', starts_at: iso(Date.now() + 30 * H), cancelled_at: null }];
    st.db.bookings = [{ id: 'bk-a', slot_id: 's1', connection_id: 'ca', cancelled_at: null }];
    st.fail.add('slots.update');
    await expect(data.cancelSlot('s1')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();

    st.fail.clear();
    st.fail.add('bookings.select');
    await expect(data.cancelSlot('s1')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('„ended” tokenem sprzed funkcji bazy (ona go kasuje) i odwołanie wszystkiego, co czeka w kolejce', async () => {
    await data.endConnection('ca');
    expect(st.rpc).toEqual([['coach_end_connection', { p_connection: 'ca' }]]);
    expect(st.db.connections!.find((c) => c.id === 'ca')!.notify_token).toBeNull();
    expect(sent()).toEqual([
      ['/link/notify', { token: TOKEN_A, kind: 'ended' }],
      ['/link/cancel', { token: TOKEN_A, ref: 'as-later' }],
      ['/link/cancel', { token: TOKEN_A, ref: 'bk-soon' }],
    ]);
  });

  it('bez tokenu — nic; nieudany koniec — nic; nieudany odczyt tokenu nie blokuje końca', async () => {
    await data.endConnection('cs');
    expect(fetchMock).not.toHaveBeenCalled();

    st.fail.add('rpc.coach_end_connection');
    await expect(data.endConnection('ca')).rejects.toThrow('ended');
    expect(fetchMock).not.toHaveBeenCalled();

    st.fail.clear();
    st.fail.add('connections.select');
    await data.endConnection('ca');
    expect(st.rpc.at(-1)).toEqual(['coach_end_connection', { p_connection: 'ca' }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('błąd odczytu kolejki (zalecenia, wizyty) — samo „ended”', async () => {
    st.fail.add('assignments.select');
    st.fail.add('slots.select');
    await data.endConnection('ca');
    expect(sent()).toEqual([['/link/notify', { token: TOKEN_A, kind: 'ended' }]]);
  });
});
