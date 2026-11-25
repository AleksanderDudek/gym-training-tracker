import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookingRow, Connection, SlotRow } from '../src/lib/data';

/**
 * Strona Kalendarz w jsdom, z bazą podmienioną na pamięć: tydzień z terminami, szczegóły terminu
 * (zapisani ze skrótem, odwołanie rezerwacji, zapis podopiecznego, odwołanie terminu), nowy termin
 * co tydzień, nawigacja tygodni i plik .ics z numerami bez skrótów.
 */

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'pl';
});

const A = 'ABCDEFGHJK0123456789';
const B = 'MNPQRSTVWXYZ01234567';
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();

const db = vi.hoisted(() => ({
  slots: [] as SlotRow[],
  bookings: [] as BookingRow[],
  created: [] as unknown[],
  calls: [] as string[],
}));

vi.mock('../src/session', () => ({
  useReady: () => ({ coach: { id: 'coach-1', display_name: 'Anna', profession: 'trainer' }, user: { id: 'u1' } }),
}));

vi.mock('../src/lib/data', () => {
  const conn = (id: string, pseudonym: string): Connection => ({
    id,
    inviteId: `i-${id}`,
    pseudonym,
    areas: ['training'],
    scopes: [],
    clientKey: {} as Connection['clientKey'],
    status: 'active',
    endedBy: null,
    createdAt: '2026-11-01T10:00:00Z',
    endedAt: null,
    lastPushAt: null,
    label: null,
  });
  return {
    listSlots: vi.fn(async (from: Date, to: Date) => db.slots.filter((s) => Date.parse(s.startsAt) >= from.getTime() && Date.parse(s.startsAt) < to.getTime())),
    listBookings: vi.fn(async (ids: string[]) => db.bookings.filter((b) => ids.includes(b.slotId))),
    listConnections: vi.fn(async () => [conn('c1', A), conn('c2', B)]),
    createSlots: vi.fn(async (_coach: string, rows: unknown[]) => {
      db.created.push(...rows);
      return rows;
    }),
    bookClient: vi.fn(async (slotId: string, connectionId: string) => {
      db.calls.push(`book ${slotId} ${connectionId}`);
    }),
    cancelBooking: vi.fn(async (id: string) => {
      db.calls.push(`cancelBooking ${id}`);
    }),
    cancelSlot: vi.fn(async (id: string) => {
      db.calls.push(`cancelSlot ${id}`);
    }),
  };
});

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 25, 10, 0));
});
afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sztab-aliases:u1', JSON.stringify({ [A]: 'Jan' }));
  db.slots = [
    { id: 's1', startsAt: at(26, 18), endsAt: at(26, 19), capacity: 1, title: 'Trening personalny', place: 'Studio, ul. Długa 5', note: null, cancelledAt: null },
    { id: 's2', startsAt: at(27, 7, 30), endsAt: at(27, 8, 15), capacity: 3, title: 'Konsultacja online', place: 'https://meet.example.com/abc', note: 'Kamera włączona.', cancelledAt: null },
  ];
  db.bookings = [{ id: 'b1', slotId: 's1', connectionId: 'c1', createdAt: at(20, 9), cancelledAt: null, cancelledBy: null }];
  db.created = [];
  db.calls = [];
});

async function open() {
  const { Calendar } = await import('../src/pages/Calendar');
  render(<Calendar />);
  return screen.findByRole('button', { name: /Trening personalny/ });
}

describe('Kalendarz', () => {
  it('tydzień: terminy w dniach z godziną, miejscami i miejscem albo rozmową wideo', async () => {
    const slot = await open();
    expect(screen.getByRole('heading', { level: 2, name: /23–29 listopada 2026/ })).toBeInTheDocument();
    expect(within(slot).getByText('18:00–19:00')).toBeInTheDocument();
    expect(within(slot).getByText('zajęte 1 z 1')).toBeInTheDocument();
    expect(within(slot).getByText('Studio, ul. Długa 5')).toBeInTheDocument();
    const online = screen.getByRole('button', { name: /Konsultacja online/ });
    expect(within(online).getByText('rozmowa wideo')).toBeInTheDocument();
    expect(within(online).getByText('zajęte 0 z 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dziś' })).toBeDisabled();
    // Dni minione bez „+”, przyszłe z nim.
    expect(screen.queryByRole('button', { name: /Nowy termin: poniedziałek, 23 listopada/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nowy termin: czwartek, 26 listopada/ })).toBeInTheDocument();
  });

  it('szczegóły: zapisany ze skrótem, odwołanie rezerwacji i terminu po potwierdzeniu, zapis ponad limit', async () => {
    const user = userEvent.setup();
    await user.click(await open());
    const dialog = screen.getByRole('dialog', { name: 'Trening personalny' });
    expect(within(dialog).getByText('Zapisani: 1 z 1')).toBeInTheDocument();
    expect(within(dialog).getByText('GT-ABCD-EFGH · Jan')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Odwołaj' }));
    const ask = within(dialog).getByRole('group', { name: 'Odwołać rezerwację: GT-ABCD-EFGH · Jan?' });
    expect(db.calls).toEqual([]);
    await user.click(within(ask).getByRole('button', { name: 'Tak, odwołaj' }));
    await waitFor(() => expect(db.calls).toEqual(['cancelBooking b1']));

    expect(within(dialog).getByText(/Termin jest pełny — zapiszesz ponad limit/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Podopieczny' }), 'c2');
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(db.calls).toContain('book s1 c2'));

    await user.click(within(dialog).getByRole('button', { name: 'Odwołaj termin' }));
    const sure = within(dialog).getByRole('group', { name: 'Odwołać cały termin?' });
    expect(within(sure).getByText(/Zapisani \(1\) zobaczą w GYM TRACKERze, że wizytę odwołał prowadzący/)).toBeInTheDocument();
    await user.click(within(sure).getByRole('button', { name: 'Tak, odwołaj termin' }));
    await waitFor(() => expect(db.calls).toContain('cancelSlot s1'));
  });

  it('rozmowa wideo w szczegółach to link, który otwiera się w nowej karcie', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: /Konsultacja online/ }));
    const link = within(screen.getByRole('dialog')).getByRole('link', { name: 'Otwórz link do rozmowy' });
    expect(link).toHaveAttribute('href', 'https://meet.example.com/abc');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('nowy termin co tydzień: tytuł z zawodu, ta sama godzina, długość z szybkiego wyboru; błędy przy polach', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Nowy termin' }));
    const dialog = screen.getByRole('dialog', { name: 'Nowy termin' });
    const title = within(dialog).getByRole('textbox', { name: 'Tytuł' });
    expect(title).toHaveValue('Trening personalny');

    await user.clear(title);
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj termin' }));
    expect(within(dialog).getByText('Tytuł jest potrzebny, najwyżej 80 znaków.')).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(db.created).toEqual([]);

    await user.type(title, 'Trening w parze');
    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: '2026-11-30' } });
    fireEvent.change(within(dialog).getByLabelText('Początek'), { target: { value: '18:00' } });
    await user.click(within(dialog).getByRole('button', { name: '45 min' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Powtarzaj co tydzień' }));
    const weeks = within(dialog).getByRole('spinbutton', { name: 'Przez ile tygodni (2–12)' });
    await user.clear(weeks);
    await user.type(weeks, '3');
    expect(within(dialog).getByText(/Terminy: 30 lis.*, 7 gru.*, 14 gru.* — zawsze o 18:00\./)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj 3 terminy' }));

    await waitFor(() => expect(db.created).toHaveLength(3));
    const rows = db.created as { startsAt: Date; endsAt: Date; title: string; capacity: number }[];
    expect(rows.map((r) => [r.startsAt.getDate(), r.startsAt.getHours(), r.startsAt.getMinutes()])).toEqual([
      [30, 18, 0],
      [7, 18, 0],
      [14, 18, 0],
    ]);
    expect(rows.every((r) => r.endsAt.getTime() - r.startsAt.getTime() === 45 * 60_000 && r.title === 'Trening w parze' && r.capacity === 1)).toBe(true);
    // Dodany termin jest w innym tygodniu — kalendarz do niego przechodzi.
    expect(await screen.findByRole('heading', { level: 2, name: /30 listopada\s–\s6 grudnia 2026/ })).toBeInTheDocument();
  });

  it('nawigacja tygodni: następny pusty z podpowiedzią, „Dziś” wraca', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Następny tydzień' }));
    expect(await screen.findByText(/W tym tygodniu nie masz terminów/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /30 listopada\s–\s6 grudnia 2026/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dziś' }));
    expect(await screen.findByRole('button', { name: /Trening personalny/ })).toBeInTheDocument();
  });

  it('plik .ics: same numery, skróty dopiero po zaznaczeniu', async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), 'blob:x')) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Pobierz .ics' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const plain = (await blobs[0]!.text()).replace(/\r\n /g, '');
    expect(plain).toContain('SUMMARY:Trening personalny · 1/1');
    expect(plain).toContain('GT-ABCD-EFGH');
    expect(plain).not.toContain('Jan');

    await user.click(screen.getByRole('checkbox', { name: /Dopisz moje skróty/ }));
    await user.click(screen.getByRole('button', { name: 'Pobierz .ics' }));
    await waitFor(() => expect(blobs).toHaveLength(2));
    expect((await blobs[1]!.text()).replace(/\r\n /g, '')).toContain('GT-ABCD-EFGH · Jan');
    click.mockRestore();
  });
});
