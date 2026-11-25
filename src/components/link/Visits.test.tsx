// @vitest-environment jsdom
import { StrictMode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret } from '@gymtracker/link';
import { fakeSztab } from '../../test/linkServer';
import type { FakeSztab } from '../../test/linkServer';
import { acceptInvite } from '../../link/accept';
import { invitePreview } from '../../link/rpc';
import { clearLink, linkState, reloadLink, updateLink } from '../../link/store';
import { forgetKeys } from '../../link/sync';
import { linkVisitsPath } from '../../routing';
import { LinkNotice } from '../LinkEntry';
import { VisitsPage } from './Visits';

/**
 * Strona wizyt pod jsdom, przeciw Sztabowi w pamięci: wolny termin → potwierdzenie → rezerwacja →
 * „Twoje wizyty” → odwołanie; „ktoś był szybszy”; limit wizyt; link do rozmowy; plik .ics; kopia
 * bez sieci; zakończona współpraca; jedna linia na ekranie Dziś.
 */

let server: FakeSztab;
const HOUR = 3_600_000;

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  window.location.hash = '#/sesja';
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function connect() {
  const inv = await server.invite(['training'], ['training']);
  const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: ['training'], secret: newIdSecret() });
  if (!r.ok) throw new Error(r.reason);
  return r.connection;
}

function page(id: string) {
  const onToast = vi.fn();
  // Tryb ścisły jak w aplikacji (`main.tsx`): podwójne montowanie nie może zgubić odpowiedzi serwera.
  const view = render(
    <StrictMode>
      <VisitsPage id={id} onToast={onToast} />
    </StrictMode>,
  );
  return { onToast, ...view };
}

/** Sekcja strony po nagłówku: „Twoje wizyty” albo „Wolne terminy”. */
const section = (name: string): HTMLElement => screen.getByRole('heading', { level: 2, name }).closest('.grp') as HTMLElement;

/** Inna współpraca tego prowadzącego, która zajęła miejsce w terminie. */
function takenByOther(slotId: string) {
  const any = [...server.connections.values()][0]!;
  server.connections.set('other', { ...any, id: 'other', tokenHash: null, bookings: [{ id: crypto.randomUUID(), slotId, cancelledAt: null, cancelledBy: null }] });
}

describe('wizyty', () => {
  it('wolny termin → potwierdzenie → rezerwacja w „Twoich wizytach” → odwołanie', async () => {
    const c = await connect();
    const slot = server.slot({ title: 'Trening personalny', place: 'Studio, ul. Długa 5', capacity: 2, note: 'Weź ręcznik.' });
    const user = userEvent.setup();
    const { onToast } = page(c.id);

    expect(await screen.findByText('wolne miejsca: 2 z 2')).toBeInTheDocument();
    expect(within(section('Twoje wizyty')).getByText('Nie masz zaplanowanych wizyt.')).toBeInTheDocument();
    const free = section('Wolne terminy');
    expect(within(free).getByText('Studio, ul. Długa 5')).toBeInTheDocument();
    expect(within(free).getByText('Weź ręcznik.')).toBeInTheDocument();

    await user.click(within(free).getByRole('button', { name: 'Zarezerwuj' }));
    const ask = within(free).getByRole('group', { name: 'Zarezerwować ten termin?' });
    expect(server.connections.get(c.id)!.bookings).toHaveLength(0);
    await user.click(within(ask).getByRole('button', { name: 'Tak, rezerwuję' }));

    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Zarezerwowane. Wizyta jest w „Twoich wizytach”.'));
    expect(server.connections.get(c.id)!.bookings).toEqual([expect.objectContaining({ slotId: slot.id, cancelledAt: null })]);
    const yours = section('Twoje wizyty');
    await waitFor(() => expect(within(yours).getByText('Trening personalny')).toBeInTheDocument());
    // Zarezerwowany termin nie wisi już w wolnych, a kopia na telefonie ma rezerwację.
    expect(within(section('Wolne terminy')).queryByText('Trening personalny')).not.toBeInTheDocument();
    expect(linkState().connections[0]!.visits?.bookings).toHaveLength(1);

    await user.click(within(yours).getByRole('button', { name: 'Odwołaj' }));
    await user.click(within(within(yours).getByRole('group', { name: 'Odwołać tę wizytę?' })).getByRole('button', { name: 'Tak, odwołaj' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Wizyta odwołana.'));
    expect(server.connections.get(c.id)!.bookings[0]).toMatchObject({ cancelledBy: 'client' });
    expect(await within(section('Twoje wizyty')).findByText('Odwołana przez ciebie')).toBeInTheDocument();
    expect(within(section('Twoje wizyty')).queryByRole('button', { name: 'Odwołaj' })).not.toBeInTheDocument();
    // Miejsce wróciło do wolnych.
    expect(await within(section('Wolne terminy')).findByText('Trening personalny')).toBeInTheDocument();
  });

  it('ktoś był szybszy: komunikat po polsku, termin odświeżony jako komplet', async () => {
    const c = await connect();
    const slot = server.slot({ title: 'Konsultacja', capacity: 1 });
    const user = userEvent.setup();
    page(c.id);
    const free = await screen.findByText('Konsultacja').then(() => section('Wolne terminy'));
    takenByOther(slot.id);
    await user.click(within(free).getByRole('button', { name: 'Zarezerwuj' }));
    await user.click(within(free).getByRole('button', { name: 'Tak, rezerwuję' }));
    expect(await within(free).findByRole('alert')).toHaveTextContent('Ktoś był szybszy — termin już zajęty.');
    expect(await within(free).findByText('komplet')).toBeInTheDocument();
    expect(within(free).queryByRole('button', { name: 'Zarezerwuj' })).not.toBeInTheDocument();
    expect(server.connections.get(c.id)!.bookings).toHaveLength(0);
  });

  it('dziesięć zaplanowanych: podpowiedź i bez rezerwacji; odmowa serwera too_many po polsku', async () => {
    const c = await connect();
    const conn = server.connections.get(c.id)!;
    for (let i = 0; i < 10; i++) {
      const s = server.slot({ title: `Wizyta ${i + 1}`, startsAt: new Date(Date.now() + (30 + i) * HOUR).toISOString(), endsAt: new Date(Date.now() + (31 + i) * HOUR).toISOString() });
      conn.bookings.push({ id: crypto.randomUUID(), slotId: s.id, cancelledAt: null, cancelledBy: null });
    }
    server.slot({ title: 'Jedenasta', startsAt: new Date(Date.now() + 60 * HOUR).toISOString(), endsAt: new Date(Date.now() + 61 * HOUR).toISOString() });
    page(c.id);
    const free = await screen.findByText('Jedenasta').then(() => section('Wolne terminy'));
    expect(within(free).getByText('Masz już 10 zaplanowanych wizyt — odwołaj którąś, żeby zarezerwować nową.')).toBeInTheDocument();
    const eleventh = () => within(within(free).getByText('Jedenasta').closest('li')!);
    expect(eleventh().getByRole('button', { name: 'Zarezerwuj' })).toBeDisabled();

    // Serwer liczy po swojemu (np. rezerwacja z drugiego telefonu, której ta kopia jeszcze nie zna).
    conn.bookings.splice(0, 1);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Odśwież' }));
    await waitFor(() => expect(eleventh().getByRole('button', { name: 'Zarezerwuj' })).toBeEnabled());
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith('/rpc/client_book')
          ? Promise.resolve(new Response(JSON.stringify({ code: 'P0001', message: 'too_many' }), { status: 400 }))
          : server.fetch(input, init),
      ),
    );
    await user.click(eleventh().getByRole('button', { name: 'Zarezerwuj' }));
    await user.click(eleventh().getByRole('button', { name: 'Tak, rezerwuję' }));
    expect(await within(free).findByRole('alert')).toHaveTextContent('Masz już 10 zaplanowanych wizyt. Odwołaj którąś, żeby zarezerwować nową.');
  });

  it('link do rozmowy: przy twojej wizycie „Dołącz do rozmowy”, przy wolnym terminie tylko słowo', async () => {
    const c = await connect();
    const mine = server.slot({ title: 'Konsultacja online', place: 'https://meet.example.com/abc-def' });
    server.connections.get(c.id)!.bookings.push({ id: crypto.randomUUID(), slotId: mine.id, cancelledAt: null, cancelledBy: null });
    server.slot({ title: 'Druga online', place: 'https://meet.example.com/xyz', startsAt: new Date(Date.now() + 50 * HOUR).toISOString(), endsAt: new Date(Date.now() + 51 * HOUR).toISOString() });
    page(c.id);
    const join = await screen.findByRole('link', { name: 'Dołącz do rozmowy' });
    expect(join).toHaveAttribute('href', 'https://meet.example.com/abc-def');
    expect(join).toHaveAttribute('rel', 'noopener noreferrer');
    const free = section('Wolne terminy');
    await within(free).findByText('Druga online');
    expect(within(free).getByText('Rozmowa wideo')).toBeInTheDocument();
    expect(within(free).queryByRole('link')).not.toBeInTheDocument();
  });

  it('„Dodaj do kalendarza”: plik .ics z tytułem, prowadzącym, miejscem i czasem w UTC', async () => {
    const c = await connect();
    const ICS_ID = '5b0c2f4e-2d7a-4c1e-9a3b-7f6e5d4c3b2a';
    const s = server.slot({ title: 'Trening personalny', place: 'Studio; sala 2, ul. Długa 5' });
    server.connections.get(c.id)!.bookings.push({ id: ICS_ID, slotId: s.id, cancelledAt: null, cancelledBy: null });
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), 'blob:x')) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const { onToast } = page(c.id);
    await user.click(await screen.findByRole('button', { name: 'Dodaj do kalendarza' }));
    expect(onToast).toHaveBeenCalledWith('Plik gotowy — otwórz go, żeby dodać wizytę do kalendarza.');
    expect(click).toHaveBeenCalled();
    const ics = await blobs[0]!.text();
    expect(ics).toContain(`UID:wizyta-${ICS_ID}@gym-tracker\r\n`);
    expect(ics).toContain('SUMMARY:Trening personalny — Anna Kowalska\r\n');
    expect(ics).toContain('LOCATION:Studio\\; sala 2\\, ul. Długa 5\r\n');
    const utc = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    expect(ics).toContain(`DTSTART:${utc(s.startsAt)}`);
    expect(ics).toContain('TRIGGER:-PT60M');
    click.mockRestore();
  });

  it('bez sieci: wizyty z ostatniego sprawdzenia i uwaga, bez wolnych terminów', async () => {
    const c = await connect();
    const s = server.slot({ title: 'Trening personalny' });
    server.connections.get(c.id)!.bookings.push({ id: crypto.randomUUID(), slotId: s.id, cancelledAt: null, cancelledBy: null });
    const first = page(c.id);
    await waitFor(() => expect(linkState().connections[0]!.visits?.bookings).toHaveLength(1));
    first.unmount();

    server.setOffline(true);
    page(c.id);
    expect(await screen.findByText(/^Bez sieci\. Wizyty z ostatniego sprawdzenia/)).toBeInTheDocument();
    expect(within(section('Twoje wizyty')).getByText('Trening personalny')).toBeInTheDocument();
    expect(within(section('Wolne terminy')).getByText('Wolne terminy pokażę, gdy wróci sieć.')).toBeInTheDocument();
  });

  it('prowadzący odwołał termin: wizyta zostaje na liście jako odwołana przez prowadzącego', async () => {
    const c = await connect();
    const s = server.slot({ title: 'Trening personalny' });
    server.connections.get(c.id)!.bookings.push({ id: crypto.randomUUID(), slotId: s.id, cancelledAt: null, cancelledBy: null });
    s.cancelledAt = new Date().toISOString();
    page(c.id);
    const yours = section('Twoje wizyty');
    expect(await within(yours).findByText('Odwołana przez prowadzącego')).toBeInTheDocument();
    expect(within(yours).queryByRole('button', { name: 'Odwołaj' })).not.toBeInTheDocument();
  });

  it('współpraca zakończona przez prowadzącego: strona mówi o tym zamiast terminów', async () => {
    const c = await connect();
    server.endByCoach(c.id);
    page(c.id);
    expect(await screen.findByText(/Ta współpraca się zakończyła/)).toBeInTheDocument();
    expect(linkState().connections[0]!.status).toBe('ended');
  });

  it('nieznana współpraca: notka, bez pytania serwera', () => {
    page('nie-ma');
    expect(screen.getByText('Nie ma takiej współpracy na tym telefonie.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('uwaga na ekranie Dziś', () => {
  it('wizyta w ciągu doby — jedna linia z godziną i tytułem, prowadzi do wizyt; dalsza i odwołana — nic', async () => {
    const c = await connect();
    const start = Date.now() + 3 * HOUR;
    const booking = {
      id: 'b1',
      slotId: 's1',
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + HOUR).toISOString(),
      title: 'Trening personalny',
      place: null,
      note: null,
      cancelledAt: null,
      cancelledBy: null,
    };
    updateLink((s) => {
      s.connections[0]!.visits = { at: Date.now(), bookings: [{ ...booking, id: 'b0', startsAt: new Date(start + 48 * HOUR).toISOString() }] };
    });
    const { rerender } = render(<LinkNotice />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    updateLink((s) => {
      s.connections[0]!.visits!.bookings.push(booking);
    });
    rerender(<LinkNotice />);
    const hm = new Date(start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const link = screen.getByRole('link', { name: new RegExp(`^Wizyta (dziś|jutro) o ${hm} — Trening personalny$`) });
    expect(link).toHaveAttribute('href', linkVisitsPath(c.id));

    updateLink((s) => {
      s.connections[0]!.visits!.bookings[1]!.cancelledAt = new Date().toISOString();
    });
    rerender(<LinkNotice />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('zepsuta kopia wizyt w zapisie nie wywraca ekranu', () => {
    localStorage.setItem(
      'gt-link',
      JSON.stringify({
        connections: [
          {
            id: 'c1',
            inviteId: 'i1',
            coachId: 'k1',
            coach: { name: 'Anna', profession: 'trainer' },
            areas: ['training'],
            scopes: [],
            pseudonym: 'X',
            coachKey: {},
            status: 'active',
            visits: { at: 'wczoraj', bookings: 5 },
          },
        ],
      }),
    );
    reloadLink();
    expect(linkState().connections[0]!.visits).toBeUndefined();
    render(<LinkNotice />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
