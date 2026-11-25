import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'pl';
});

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parsePseudonym, shortPseudonym } from '@gymtracker/link';
import type { AssignmentV1, HabitsBody, SnapshotV1 } from '@gymtracker/link';
import type { Connection, SentAssignment, SnapshotRead } from '../src/lib/data';
import { loadGroups, loadSeen, saveAlias } from '../src/lib/aliases';

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const ids = ['GT-7K4Q-9XM2-HT3P-ZR8W-E5NA', 'GT-1B2C-3D4E-5F6G-7H8J-9K0M', 'GT-2C3D-4E5F-6G7H-8J9K-0M1N', 'GT-3D4E-5F6G-7H8J-9K0M-1N2P'].map(
  (s) => parsePseudonym(s)!,
);

function conn(i: number, patch: Partial<Connection> = {}): Connection {
  return {
    id: `c${i}`,
    inviteId: `i${i}`,
    pseudonym: ids[i]!,
    areas: ['training', 'nutrition'],
    scopes: ['training', 'food'],
    clientKey: {} as Connection['clientKey'],
    status: 'active',
    endedBy: null,
    createdAt: ago(60),
    endedAt: null,
    lastPushAt: ago(0.2),
    label: null,
    ...patch,
  };
}

const habits: HabitsBody = { kind: 'habits', title: 'Codziennie', items: [{ label: 'Woda', dose: '', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] }], note: '', until: null };
const env = (id: string): AssignmentV1 => ({ v: 1, id, area: 'training', sentAt: Date.now() - 30 * DAY, from: { name: 'Ola', profession: 'trainer' }, body: habits });
const sent = (id: string): SentAssignment => ({
  id,
  kind: 'habits',
  area: 'training',
  createdAt: ago(30),
  withdrawnAt: null,
  visibleFrom: null,
  envelope: env(id),
  receipt: null,
});

/** Paczka z odhaczonymi nawykami: `share` — jaka część ostatnich dni. */
function snap(habitId: string, share: number): SnapshotV1 {
  const days: Record<string, number[]> = {};
  for (let d = 0; d < 10; d++) if (d / 10 < share) days[new Date(Date.now() - d * DAY).toISOString().slice(0, 10)] = [0];
  return { v: 1, at: Date.now() - 3600_000, tz: 'UTC', lang: 'pl', app: 'test', scopes: [], coaching: { answers: [], habits: [{ assignmentId: habitId, days }], meals: [] } };
}

const state = vi.hoisted(() => ({
  connections: [] as unknown[],
  unread: {} as Record<string, number>,
  inFlight: 0,
  maxInFlight: 0,
  delay: 0,
  failMessageTo: null as string | null,
  key: {} as object,
}));

vi.mock('../src/session', () => ({
  useReady: () => ({ coach: { id: 'u1', display_name: 'Ola', profession: 'trainer' }, user: { id: 'u1' }, key: state.key }),
}));

const track = async <T,>(v: T): Promise<T> => {
  state.inFlight++;
  state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
  await new Promise((r) => setTimeout(r, state.delay));
  state.inFlight--;
  return v;
};

vi.mock('../src/lib/data', () => ({
  listConnections: vi.fn(async () => state.connections),
  unreadCounts: vi.fn(async () => state.unread),
  readSnapshot: vi.fn(async (_k: CryptoKey, c: Connection): Promise<SnapshotRead> => {
    const share = c.id === 'c0' ? 1 : c.id === 'c1' ? 0.3 : 0.9;
    return track({ snapshot: snap(`h-${c.id}`, share), at: c.lastPushAt, bytes: 100, unreadable: false });
  }),
  listAssignments: vi.fn(async (_k: CryptoKey, c: Connection) => track([sent(`h-${c.id}`)])),
  sendMessage: vi.fn(async (_k: CryptoKey, c: Connection) => {
    if (c.id === state.failMessageTo) throw new Error('net');
    return 'm';
  }),
}));

vi.mock('../src/pages/Send', () => ({
  SendDialog: ({ connection, recipients, onClose }: { connection: Connection; recipients?: Connection[]; onClose: () => void }) => (
    <div role="dialog" aria-label="send-mock">
      {connection.id}:{recipients?.map((c) => c.id).join(',')}
      <button type="button" onClick={onClose}>
        close-mock
      </button>
    </div>
  ),
}));

vi.mock('../src/components/LaunchProgram', () => ({
  LaunchProgramDialog: ({ program, connections }: { program: unknown; connections: Connection[] }) => (
    <div role="dialog" aria-label="launch-mock">
      {String(program)}:{connections.map((c) => c.id).join(',')}
    </div>
  ),
}));

const { Clients } = await import('../src/pages/Clients');
const data = await import('../src/lib/data');

beforeEach(() => {
  // Otwarcie podopiecznego przewija stronę do góry — jsdom tego nie umie.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  localStorage.clear();
  state.key = {};
  state.inFlight = 0;
  state.maxInFlight = 0;
  state.delay = 0;
  state.failMessageTo = null;
  state.unread = { c0: 2 };
  // c0: dwie wiadomości, nawyki 100%; c1: stare dane i nawyki 30%; c2: wszystko w porządku; c3: zakończona.
  state.connections = [conn(0), conn(1, { lastPushAt: ago(10) }), conn(2), conn(3, { status: 'ended', endedBy: 'client', endedAt: ago(5) })];
  vi.mocked(data.sendMessage).mockClear();
});

const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('Lista podopiecznych: „Do przejrzenia”', () => {
  it('kolumny przeglądu, powody i filtr „Do przejrzenia” posortowany wynikiem', async () => {
    saveAlias('u1', ids[0]!, 'Jan');
    render(<Clients />);
    await screen.findByText('Jan');
    for (const h of ['Numer i obszary', 'Skrót i grupy', 'Dlaczego', 'Dane z', 'Nawyki']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Sprawdzam dane/)).not.toBeInTheDocument());
    expect(screen.getByText('2 nowe wiadomości')).toBeInTheDocument();
    expect(screen.getByText('dane sprzed 10 dni')).toBeInTheDocument();
    expect(tableRows()).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /Do przejrzenia/ }));
    expect(screen.getByRole('button', { name: /Do przejrzenia/ })).toHaveAttribute('aria-pressed', 'true');
    const rows = tableRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Jan')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(shortPseudonym(ids[1]!))).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/nawyki \d+%/)).toBeInTheDocument();

    // Szukanie po skrócie działa w filtrze.
    await userEvent.type(screen.getByRole('searchbox'), 'jan');
    expect(tableRows()).toHaveLength(1);
  });

  it('zakończone osobno, bez zaznaczania; otwarcie z listy zapisuje „ostatnio widziany”', async () => {
    render(<Clients />);
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('tab', { name: /Zakończone/ }));
    expect(tableRows()).toHaveLength(1);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/zakończył podopieczny/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Trwające/ }));
    await userEvent.click(screen.getByRole('link', { name: shortPseudonym(ids[2]!) }));
    expect(location.pathname).toBe('/podopieczni/c2');
    expect(loadSeen('u1').c2).toBeGreaterThan(Date.now() - 5000);
  });

  it('wczytuje najwyżej 4 zapytania naraz', async () => {
    state.delay = 15;
    state.connections = Array.from({ length: 4 }, (_, i) => conn(i)).concat(
      Array.from({ length: 4 }, (_, i) => ({ ...conn(i), id: `x${i}`, pseudonym: ids[i]!.replace(/.$/, 'Z') })),
    );
    render(<Clients />);
    await screen.findByText(/Sprawdzam dane/);
    await waitFor(() => expect(screen.queryByText(/Sprawdzam dane/)).not.toBeInTheDocument(), { timeout: 3000 });
    expect(state.maxInFlight).toBeLessThanOrEqual(4);
    expect(state.maxInFlight).toBeGreaterThan(1);
  });
});

describe('Grupy i akcje na zaznaczonych', () => {
  it('grupa dopisana w wierszu daje filtr; zaznacz wszystkich w filtrze → Wyślij… i Uruchom program…', async () => {
    render(<Clients />);
    await screen.findAllByRole('row');
    const row = tableRows()[2]!;
    await userEvent.click(within(row).getByRole('button', { name: /Dodaj grupę/ }));
    await userEvent.type(within(row).getByRole('combobox', { name: /Dodaj grupę/ }), 'Kolano{Enter}');
    expect(within(row).getByText('Kolano')).toBeInTheDocument();
    expect(loadGroups('u1')).toEqual({ [ids[2]!]: ['Kolano'] });
    expect(screen.getByText(/Grupy zostają w tej przeglądarce/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Kolano/ }));
    expect(tableRows()).toHaveLength(1);
    await userEvent.click(screen.getByRole('checkbox', { name: /Zaznacz wszystkich/ }));
    expect(screen.getByText('Zaznaczono: 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Wszyscy/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: `Zaznacz: ${shortPseudonym(ids[0]!)}` }));
    expect(screen.getByText('Zaznaczono: 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Wyślij…' }));
    // Pierwszy w kolejności listy to `connection`, wszyscy zaznaczeni to `recipients`.
    expect(await screen.findByRole('dialog', { name: 'send-mock' })).toHaveTextContent('c0:c0,c2');
    await userEvent.click(screen.getByRole('button', { name: 'close-mock' }));

    await userEvent.click(screen.getByRole('button', { name: 'Uruchom program…' }));
    expect(await screen.findByRole('dialog', { name: 'launch-mock' })).toHaveTextContent('null:c0,c2');
  });

  it('wiadomość do zaznaczonych: każdy osobno, z postępem i podsumowaniem nieudanych', async () => {
    state.failMessageTo = 'c1';
    render(<Clients />);
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('checkbox', { name: /Zaznacz wszystkich/ }));
    expect(screen.getByText('Zaznaczono: 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Wiadomość do zaznaczonych' }));
    const dialog = await screen.findByRole('dialog', { name: 'Wiadomość do zaznaczonych' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Treść' }), 'Jutro siłownia zamknięta.');
    await act(async () => {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Wyślij (3)' }));
    });
    expect(await within(dialog).findByText('Wysłano do 2 z 3.')).toBeInTheDocument();
    expect(within(dialog).getByText(new RegExp(`Nie doszło do: ${shortPseudonym(ids[1]!)}`))).toBeInTheDocument();
    expect(vi.mocked(data.sendMessage).mock.calls.map((c) => [(c[1] as Connection).id, c[2]])).toEqual([
      ['c0', 'Jutro siłownia zamknięta.'],
      ['c1', 'Jutro siłownia zamknięta.'],
      ['c2', 'Jutro siłownia zamknięta.'],
    ]);

    state.failMessageTo = null;
    await act(async () => {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Ponów dla nieudanych' }));
    });
    expect(await within(dialog).findByText('Wysłano do 1 z 1.')).toBeInTheDocument();
  });
});
