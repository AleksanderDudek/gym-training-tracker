import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Connection, LibraryItem, ProgramBody, SentAssignment } from '../src/lib/data';

const sent: { conn: string; area: string; kind: string; visibleFrom: Date | null }[] = [];
const withdrawn: string[] = [];
let library: LibraryItem[] = [];
let connections: Connection[] = [];
let assignments: SentAssignment[] = [];

vi.mock('../src/session', () => ({
  useReady: () => ({
    coach: { id: 'c1', display_name: 'Anna Nowak', profession: 'trainer', key_fingerprint: 'A'.repeat(22) },
    user: { id: 'c1' },
    key: {} as CryptoKey,
  }),
}));

vi.mock('../src/lib/data', async (orig) => {
  const real = await orig<typeof import('../src/lib/data')>();
  return {
    ...real,
    listLibrary: vi.fn(async () => library),
    listConnections: vi.fn(async () => connections),
    getConnection: vi.fn(async (id: string) => connections.find((c) => c.id === id) ?? null),
    readSnapshot: vi.fn(async () => ({ snapshot: null, at: null, bytes: 0, unreadable: false })),
    listAssignments: vi.fn(async () => assignments),
    withdrawAssignment: vi.fn(async (id: string) => {
      withdrawn.push(id);
    }),
    sendAssignment: vi.fn(async (_k: CryptoKey, _c: unknown, c: Connection, area: string, body: { kind: string }, opts: { visibleFrom?: Date | null } = {}) => {
      sent.push({ conn: c.id, area, kind: body.kind, visibleFrom: opts.visibleFrom ?? null });
      return crypto.randomUUID();
    }),
  };
});

const { stepAt, tomorrow } = await import('../src/lib/program');

const conn = (id: string, pseudonym: string, areas: Connection['areas'], status: Connection['status'] = 'active'): Connection => ({
  id,
  inviteId: `i-${id}`,
  pseudonym,
  areas,
  scopes: ['training'],
  clientKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as Connection['clientKey'],
  status,
  endedBy: null,
  createdAt: '2026-11-01T10:00:00Z',
  endedAt: null,
  lastPushAt: null,
  label: null,
});

const lib = (id: string, title: string, body: LibraryItem['body']): LibraryItem => ({
  id,
  kind: body.kind,
  title,
  body,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
});

const WORKOUT = lib('w1', 'Góra A', { kind: 'workout', workout: { id: 'w-a', name: 'Góra A', items: [{ ex: 'swing2' }] }, videos: {} });
const MEALS = lib('m1', 'Jadłospis 1800', {
  kind: 'meals',
  title: 'Jadłospis 1800',
  days: [{ label: 'Pn', meals: [{ slot: 'Śniadanie', name: 'Owsianka', recipe: null, kcal: 500, protein: 30, carbs: 60, fat: 12, note: '' }] }],
  start: null,
  note: '',
});
const NOTE = lib('n1', 'Sen', { kind: 'note', title: 'Sen', text: 'Śpij 8 godzin.', checklist: [] });
const PROGRAM = lib('p1', 'Start 4 tygodnie', {
  kind: 'program',
  steps: [
    { day: 0, time: '07:00', itemId: 'w1' },
    { day: 1, time: '07:00', itemId: 'm1' },
    { day: 2, time: '07:00', itemId: 'gone' },
  ],
  note: '',
});

const A = conn('a', '7K4Q9XM2HT3PZR8WE5NA', ['training']);
const B = conn('b', 'B4Q29XM2HT3PZR8WE5NA', ['nutrition']);
const C = conn('c', 'C4Q29XM2HT3PZR8WE5NA', ['training'], 'ended');

beforeEach(() => {
  sent.length = 0;
  withdrawn.length = 0;
  library = [WORKOUT, MEALS, NOTE, PROGRAM];
  connections = [A, B, C];
  assignments = [];
  window.print = vi.fn();
});

describe('Kreator programu', () => {
  it('dodaje krok z „tydzień, dzień tygodnia”, układa w tygodniach i powiela tydzień', async () => {
    const { ProgramForm } = await import('../src/components/editors/ProgramEditor');
    const seen: ProgramBody[] = [];
    function Host() {
      const [v, setV] = useState<ProgramBody>({ kind: 'program', steps: [], note: '' });
      return (
        <ProgramForm
          value={v}
          onChange={(x) => {
            seen.push(x);
            setV(x);
          }}
          items={library}
        />
      );
    }
    render(<Host />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /^(Tydzień|Week)$/ }), { target: { value: '2' } });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Dzień tygodnia|Day of week/ }), '3');
    expect(screen.getByRole('spinbutton', { name: /Dzień programu|Program day/ })).toHaveValue(10);
    fireEvent.change(screen.getByLabelText(/^(Godzina|Time)$/), { target: { value: '08:30' } });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Element biblioteki|Library item/ }), 'w1');
    await userEvent.click(screen.getByRole('button', { name: /Dodaj krok|Add step/ }));
    expect(seen.at(-1)!.steps).toEqual([{ day: 9, time: '08:30', itemId: 'w1' }]);
    expect(screen.getByRole('region', { name: /Tydzień 2|Week 2/ })).toHaveTextContent('Góra A');

    // Ten sam krok drugi raz — odmowa.
    await userEvent.click(screen.getByRole('button', { name: /Dodaj krok|Add step/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/już jest|already exists/);

    await userEvent.click(screen.getByRole('button', { name: /Powiel do tygodnia 3|Copy to week 3/ }));
    expect(seen.at(-1)!.steps).toEqual([
      { day: 9, time: '08:30', itemId: 'w1' },
      { day: 16, time: '08:30', itemId: 'w1' },
    ]);
    expect(screen.getByRole('region', { name: /Tydzień 3|Week 3/ })).toBeInTheDocument();
  });

  it('ostrzega o krokach, których elementu nie ma już w bibliotece', async () => {
    const { ProgramForm } = await import('../src/components/editors/ProgramEditor');
    render(<ProgramForm value={PROGRAM.body as ProgramBody} onChange={() => undefined} items={library} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/1 krok odsyła|1 step points/);
    expect(screen.getByText(/Brak w bibliotece|Not in the library/)).toBeInTheDocument();
  });
});

describe('Uruchom program', () => {
  it('każdy krok jako zalecenie z „pokaż od”; co nie pasuje do obszaru — pominięte z powodem', async () => {
    const { LaunchProgramDialog } = await import('../src/components/LaunchProgram');
    const onClose = vi.fn();
    render(<LaunchProgramDialog program={PROGRAM} connections={[A]} onClose={onClose} />);
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Góra A');
    expect(dialog).toHaveTextContent(/teraz w bibliotece|right now/);
    expect(within(dialog).getByRole('checkbox', { name: /GT-7K4Q-9XM2/ })).toBeChecked();
    expect(dialog).toHaveTextContent(/pominie 1 z 3|skips 1 of 3/);

    await userEvent.click(within(dialog).getByRole('button', { name: /Uruchom dla 1|Launch for 1/ }));
    await within(dialog).findByText(/Program uruchomiony dla 1 z 1|Program launched for 1 of 1/);
    expect(sent).toEqual([{ conn: 'a', area: 'training', kind: 'workout', visibleFrom: stepAt(tomorrow(), 0, '07:00') }]);
    expect(dialog).toHaveTextContent(/pominięto 2|skipped 2/);
  });

  it('bez programu i odbiorców: wybór z biblioteki i z trwających współprac', async () => {
    const { LaunchProgramDialog } = await import('../src/components/LaunchProgram');
    render(<LaunchProgramDialog program={null} connections={[]} onClose={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: /^(Program)$/ }), 'p1');
    // Zakończona współpraca nie trafia na listę.
    await within(dialog).findByRole('checkbox', { name: /GT-B4Q2-9XM2/ });
    expect(within(dialog).queryByRole('checkbox', { name: /GT-C4Q2-9XM2/ })).toBeNull();
    const launch = within(dialog).getByRole('button', { name: /Uruchom dla 0|Launch for 0/ });
    expect(launch).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /GT-B4Q2-9XM2/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: /Uruchom dla 1|Launch for 1/ }));
    await within(dialog).findByText(/uruchomiony|launched/);
    expect(sent.map((s) => [s.conn, s.area, s.kind])).toEqual([['b', 'nutrition', 'meals']]);
  });
});

describe('Wysyłka: zaplanowana i do wielu', () => {
  it('„Zaplanuj”: telefon dostaje to dopiero o wybranej porze; przeszłość odrzucona', async () => {
    const { SendDialog } = await import('../src/pages/Send');
    const onSent = vi.fn();
    render(<SendDialog connection={A} initialKind="note" onClose={() => undefined} onSent={onSent} />);
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(await within(dialog).findByRole('combobox'), 'n1');
    await userEvent.click(within(dialog).getByRole('radio', { name: /Zaplanuj|Schedule/ }));
    expect(dialog).toHaveTextContent(/dopiero o tej porze|only at that time/);
    fireEvent.change(within(dialog).getByLabelText(/^(Dzień|Day)$/), { target: { value: '2020-01-01' } });
    await userEvent.click(within(dialog).getByRole('button', { name: /^(Zaplanuj|Schedule)$/ }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/minęła|passed/);
    expect(sent).toHaveLength(0);

    const day = tomorrow();
    fireEvent.change(within(dialog).getByLabelText(/^(Dzień|Day)$/), { target: { value: day } });
    fireEvent.change(within(dialog).getByLabelText(/^(Godzina|Time)$/), { target: { value: '18:45' } });
    await userEvent.click(within(dialog).getByRole('button', { name: /^(Zaplanuj|Schedule)$/ }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(sent).toEqual([{ conn: 'a', area: 'training', kind: 'note', visibleFrom: stepAt(day, 0, '18:45') }]);
  });

  it('do wielu: każdy w swoim obszarze, pominięci z powodem, podsumowanie', async () => {
    const { SendDialog } = await import('../src/pages/Send');
    const onSent = vi.fn();
    render(<SendDialog connection={A} recipients={[A, B, C]} initialKind="note" onClose={() => undefined} onSent={onSent} />);
    const dialog = await screen.findByRole('dialog', { name: /3 podopiecznym|3 clients/ });
    const list = within(dialog).getByRole('list', { name: /Odbiorcy|Recipients/ });
    expect(list).toHaveTextContent(/GT-7K4Q-9XM2.*(Trening|Training)/);
    expect(list).toHaveTextContent(/GT-C4Q2-9XM2.*(zakończona|ended)/);
    await userEvent.selectOptions(await within(dialog).findByRole('combobox'), 'n1');
    await userEvent.click(within(dialog).getByRole('button', { name: /Wyślij do 2|Send to 2/ }));
    await within(dialog).findByText(/Wysłano do 2 z 3|Sent to 2 of 3/);
    expect(sent.map((s) => [s.conn, s.area, s.visibleFrom])).toEqual([
      ['a', 'training', null],
      ['b', 'nutrition', null],
    ]);
    expect(dialog).toHaveTextContent(/Pominięto|Skipped/);
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it('do wielu: rodzaj, którego część nie przyjmie — pominięci, reszta dostaje', async () => {
    const { SendDialog } = await import('../src/pages/Send');
    render(<SendDialog connection={A} recipients={[A, B]} initialKind="meals" onClose={() => undefined} onSent={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('list', { name: /Odbiorcy|Recipients/ })).toHaveTextContent(/GT-7K4Q-9XM2.*(Jadłospis|Meal plan)/);
    await userEvent.selectOptions(await within(dialog).findByRole('combobox'), 'm1');
    await userEvent.click(within(dialog).getByRole('button', { name: /Wyślij do 1|Send to 1/ }));
    await within(dialog).findByText(/Wysłano do 1 z 2|Sent to 1 of 2/);
    expect(sent.map((s) => s.conn)).toEqual(['b']);
  });
});

describe('Zalecenia podopiecznego: zaplanowane i druk', () => {
  it('zaplanowane na górze z datą, „Anuluj” po potwierdzeniu, „Drukuj” z numerem podopiecznego', async () => {
    const future = new Date(Date.now() + 3 * 86_400_000);
    future.setHours(7, 0, 0, 0);
    const env = (id: string, body: SentAssignment['envelope'] extends infer E ? (E extends { body: infer B } ? B : never) : never) => ({
      v: 1 as const,
      id,
      area: 'training' as const,
      sentAt: Date.now(),
      from: { name: 'Anna Nowak', profession: 'trainer' as const },
      body,
    });
    assignments = [
      {
        id: 'x-old',
        kind: 'note',
        area: 'training',
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
        withdrawnAt: null,
        visibleFrom: null,
        envelope: env('x-old', { kind: 'note', title: 'Stare', text: 'a', checklist: [] }),
        receipt: null,
      },
      {
        id: 'x-later',
        kind: 'note',
        area: 'training',
        createdAt: new Date().toISOString(),
        withdrawnAt: null,
        visibleFrom: future.toISOString(),
        envelope: env('x-later', { kind: 'note', title: 'Na potem', text: 'b', checklist: ['jeden'] }),
        receipt: null,
      },
    ];
    history.replaceState(null, '', '/podopieczni/a?t=sent');
    const { ClientPage } = await import('../src/pages/Client');
    render(<ClientPage id="a" />);
    const upcoming = await screen.findByRole('region', { name: /Zaplanowane \(1\)|Scheduled \(1\)/ });
    expect(upcoming).toHaveTextContent('Na potem');
    expect(upcoming).toHaveTextContent(/(Zaplanowane|Scheduled): \d+ \S+, 7:00/);
    expect(upcoming).not.toHaveTextContent('Stare');

    await userEvent.click(within(upcoming).getByRole('button', { name: /^(Anuluj|Cancel)$/ }));
    expect(withdrawn).toEqual([]);
    await userEvent.click(within(upcoming).getByRole('button', { name: /Tak, anuluj|Yes, cancel/ }));
    await waitFor(() => expect(withdrawn).toEqual(['x-later']));

    await userEvent.click(within(upcoming).getByRole('button', { name: /^(Drukuj|Print)$/ }));
    const preview = await screen.findByRole('dialog', { name: /Podgląd wydruku|Print preview/ });
    expect(preview).toHaveTextContent('GT-7K4Q-9XM2');
    expect(preview).toHaveTextContent('Na potem');
    expect(document.documentElement).toHaveClass('sz-printing');
    await act(() => new Promise((r) => setTimeout(r, 200)));
    expect(window.print).toHaveBeenCalledTimes(1);
    await userEvent.click(within(preview).getByRole('button', { name: /^(Zamknij|Close)$/ }));
    expect(screen.queryByRole('dialog', { name: /Podgląd wydruku|Print preview/ })).toBeNull();
    expect(document.documentElement).not.toHaveClass('sz-printing');
  });
});
