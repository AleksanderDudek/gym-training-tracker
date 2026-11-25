import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parsePseudonym } from '@gymtracker/link';
import type { Connection, LibraryItem } from '../src/lib/data';

/** Przyciski „Dodaj przykłady”, „Dodaj podopiecznego demo”, „DEMO”, „Symuluj telefon” i „Usuń demo”. */

const state = vi.hoisted(() => ({ library: [] as unknown[], connections: [] as unknown[] }));

vi.mock('../src/session', () => ({
  useReady: () => ({ coach: { id: 'u1', display_name: 'Ola', profession: 'trainer', public_key: {} }, user: { id: 'u1' }, key: {} as CryptoKey }),
}));

vi.mock('../src/lib/data', async (orig) => ({
  ...(await orig<typeof import('../src/lib/data')>()),
  listLibrary: vi.fn(async () => state.library),
  listConnections: vi.fn(async () => state.connections),
  unreadCounts: vi.fn(async () => ({})),
  readSnapshot: vi.fn(async () => ({ snapshot: null, at: null, bytes: 0, unreadable: false })),
  listAssignments: vi.fn(async () => []),
}));

vi.mock('../src/lib/demo/library', () => ({
  addExamples: vi.fn(async (_coach: string, opts: { onProgress?: (d: number, t: number) => void }) => {
    opts.onProgress?.(0, 2);
    opts.onProgress?.(2, 2);
    return [{ id: 'a' }, { id: 'b' }];
  }),
}));

vi.mock('../src/lib/demo/client', () => ({
  createDemoClient: vi.fn(async (_ctx: unknown, opts: { onStep?: (s: string) => void }) => {
    opts.onStep?.('accept');
    return { connectionId: 'c-demo' };
  }),
  simulateDemo: vi.fn(async () => ({ assignments: 3, answers: 5, ticks: 12, receipts: 3, push: 'sent', replied: true, booked: false })),
  removeDemo: vi.fn(async () => undefined),
}));

const { Library } = await import('../src/pages/Library');
const { Clients } = await import('../src/pages/Clients');
const { DemoActions } = await import('../src/components/Demo');
const { Toaster } = await import('../src/components/ui');
const data = await import('../src/lib/data');
const demoLib = await import('../src/lib/demo/library');
const demoClient = await import('../src/lib/demo/client');

const PSEUDO = parsePseudonym('GT-7K4Q-9XM2-HT3P-ZR8W-E5NA')!;
const demoState = { connectionId: 'c-demo', inviteId: 'i', token: 't', privateJwk: { kty: 'EC' }, pseudonym: PSEUDO, createdAt: 1 };

function conn(id: string, pseudonym: string): Connection {
  return {
    id,
    inviteId: `i-${id}`,
    pseudonym,
    areas: ['training'],
    scopes: ['training'],
    clientKey: {} as Connection['clientKey'],
    status: 'active',
    endedBy: null,
    createdAt: new Date().toISOString(),
    endedAt: null,
    lastPushAt: new Date().toISOString(),
    label: id === 'c-demo' ? 'DEMO' : null,
  };
}

const item = (id: string): LibraryItem => ({
  id,
  kind: 'note',
  title: 'Moje zalecenie',
  body: { kind: 'note', title: 'Moje zalecenie', text: 'x', checklist: [] },
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
});

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  state.library = [];
  state.connections = [];
  vi.mocked(demoLib.addExamples).mockClear();
  vi.mocked(demoClient.createDemoClient).mockClear();
  vi.mocked(demoClient.simulateDemo).mockClear();
  vi.mocked(demoClient.removeDemo).mockClear();
  vi.mocked(data.listLibrary).mockClear();
});

describe('Biblioteka: „Dodaj przykłady”', () => {
  it('pusta biblioteka: przycisk główny obok „+ Trening” i w nagłówku; dodaje od razu, pokazuje wynik i wczytuje listę od nowa', async () => {
    render(
      <>
        <Library />
        <Toaster />
      </>,
    );
    const empty = (await screen.findByRole('heading', { name: 'Biblioteka jest pusta' })).closest('section')!;
    const main = within(empty).getByRole('button', { name: 'Dodaj przykłady' });
    expect(main).toHaveClass('blue');
    expect(within(empty).getByRole('link', { name: '+ Trening' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dodaj przykłady' })).toHaveLength(2);

    await userEvent.click(main);
    expect(await screen.findByText('Dodano 2 przykłady do biblioteki')).toBeInTheDocument();
    expect(demoLib.addExamples).toHaveBeenCalledWith('u1', expect.anything());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(data.listLibrary).toHaveBeenCalledTimes(2));
  });

  it('niepusta biblioteka: najpierw pyta (kopie obok twoich), „Anuluj” nic nie dodaje', async () => {
    state.library = [item('a'), item('b'), item('c')];
    render(<Library />);
    await screen.findAllByText('Moje zalecenie');
    await userEvent.click(screen.getByRole('button', { name: 'Dodaj przykłady' }));
    const dialog = screen.getByRole('dialog', { name: 'Dodać przykłady?' });
    expect(within(dialog).getByText(/masz już 3 elementy/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Anuluj' }));
    expect(demoLib.addExamples).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Dodaj przykłady' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dodaj przykłady' }));
    await waitFor(() => expect(demoLib.addExamples).toHaveBeenCalledTimes(1));
  });
});

describe('Podopieczni: podopieczny demonstracyjny', () => {
  it('pusta lista: „Dodaj podopiecznego demo” ze zdaniem wyjaśnienia; okno → zakładanie → karta podopiecznego', async () => {
    render(<Clients />);
    await screen.findByRole('heading', { name: 'Nie masz jeszcze podopiecznych' });
    expect(screen.getByText(/Telefon symulowany w tej przeglądarce/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dodaj podopiecznego demo' }));
    const dialog = screen.getByRole('dialog', { name: 'Podopieczny demonstracyjny' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Dodaj podopiecznego demo' }));
    await waitFor(() => expect(location.pathname).toBe('/podopieczni/c-demo'));
    expect(demoClient.createDemoClient).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), expect.anything());
  });

  it('lista z demo z tej przeglądarki: chip „DEMO” w jego wierszu, bez drugiego przycisku zakładania', async () => {
    localStorage.setItem('sztab-demo:u1', JSON.stringify(demoState));
    state.connections = [conn('c-demo', PSEUDO), conn('c-real', parsePseudonym('GT-1B2C-3D4E-5F6G-7H8J-9K0M')!)];
    render(<Clients />);
    const rows = await screen.findAllByRole('row');
    const demoRow = rows.find((r) => r.textContent?.includes('DEMO'))!;
    expect(within(demoRow).getByTitle(/telefon symulowany w tej przeglądarce/)).toBeInTheDocument();
    expect(screen.getAllByText('DEMO')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Dodaj podopiecznego demo' })).not.toBeInTheDocument();
  });

  it('lista bez demo: przycisk w nagłówku obok zaproszenia', async () => {
    state.connections = [conn('c-real', PSEUDO)];
    render(<Clients />);
    await screen.findAllByRole('row');
    expect(screen.getByRole('button', { name: 'Dodaj podopiecznego demo' })).toHaveClass('ghost');
  });
});

describe('Karta podopiecznego: „Symuluj telefon” i „Usuń demo”', () => {
  it('tylko dla współpracy demo z tej przeglądarki', () => {
    const { container } = render(<DemoActions c={{ id: 'c-real', status: 'active' }} onChanged={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('symulacja: wynik słowami i odświeżenie karty; usunięcie po potwierdzeniu', async () => {
    localStorage.setItem('sztab-demo:u1', JSON.stringify(demoState));
    const changed = vi.fn();
    render(
      <>
        <DemoActions c={{ id: 'c-demo', status: 'active' }} onChanged={changed} />
        <Toaster />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Symuluj telefon' }));
    expect(await screen.findByText(/Telefon odebrał 3 zalecenia, 5 odpowiedzi na formularze, 12 dni z odhaczeniami, odpowiedź na wiadomość/)).toBeInTheDocument();
    expect(changed).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Usuń demo' }));
    const dialog = screen.getByRole('dialog', { name: 'Usunąć podopiecznego demo?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tak, usuń demo' }));
    await waitFor(() => expect(demoClient.removeDemo).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(location.pathname).toBe('/podopieczni'));
  });
});
