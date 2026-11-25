// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdSecret } from '@gymtracker/link';
import { freshState } from '../../engine/plan';
import { acceptInvite } from '../../link/accept';
import { invitePreview } from '../../link/rpc';
import { clearLink, linkState, messagesOf, unreadMessages, updateLink } from '../../link/store';
import type { LinkConnection, StoredMessage } from '../../link/store';
import { forgetKeys, markEnded, refreshMessages, syncAll } from '../../link/sync';
import { fakeSztab } from '../../test/linkServer';
import type { FakeSztab } from '../../test/linkServer';
import type { AppState, LogEntry } from '../../types';
import { ChatPage, POLL_MS } from './Chat';
import { byDay, lastReadId, nearLimit, recentSessions, whenOf } from './chatThread';

/**
 * Rozmowa z prowadzącym na telefonie: czyste funkcje wątku i strona przeciw Sztabowi w pamięci —
 * odszyfrowanie, „przeczytane” w obie strony, kolejka bez sieci, dołączony trening, odpytywanie
 * tylko na widocznej karcie, rozmowa po zakończeniu współpracy.
 */

const msg = (over: Partial<StoredMessage>): StoredMessage => ({
  id: 'm',
  connectionId: 'c',
  author: 'client',
  text: 'x',
  ref: null,
  at: 0,
  serverAt: null,
  readAt: null,
  ...over,
});

const entry = (date: string, workout: string): LogEntry => ({ date, workout, ready: 'ok', items: [] }) as unknown as LogEntry;

describe('wątek — czyste funkcje', () => {
  it('chwila wiadomości: czas serwera, a niewysłana — chwila napisania', () => {
    expect(whenOf(msg({ at: 5, serverAt: '2026-11-25T10:00:00.000Z' }))).toBe(Date.parse('2026-11-25T10:00:00.000Z'));
    expect(whenOf(msg({ at: 5, serverAt: null }))).toBe(5);
    expect(whenOf(msg({ at: 5, serverAt: 'zepsute' }))).toBe(5);
  });

  it('dni po kolei, bez sortowania; ten sam dzień — jedna grupa', () => {
    const a = new Date(2026, 10, 24, 9).getTime();
    const b = new Date(2026, 10, 24, 22).getTime();
    const c = new Date(2026, 10, 25, 7).getTime();
    const groups = byDay([a, b, c], (x) => x);
    expect(groups).toEqual([
      { day: '2026-11-24', items: [a, b] },
      { day: '2026-11-25', items: [c] },
    ]);
    expect(byDay([], (x: number) => x)).toEqual([]);
  });

  it('„przeczytane” pod ostatnią naszą wiadomością sprzed `readUpTo`', () => {
    const list = [
      msg({ id: 'a', serverAt: '2026-11-25T10:00:00.000Z' }),
      msg({ id: 'b', author: 'coach', serverAt: '2026-11-25T10:01:00.000Z' }),
      msg({ id: 'c', serverAt: '2026-11-25T10:02:00.000Z' }),
      msg({ id: 'd', serverAt: '2026-11-25T10:03:00.000Z' }),
      msg({ id: 'e', serverAt: null }),
    ];
    expect(lastReadId(list, '2026-11-25T10:02:00+00:00')).toBe('c');
    expect(lastReadId(list, '2026-11-25T11:00:00.000Z')).toBe('d');
    expect(lastReadId(list, '2026-11-25T09:00:00.000Z')).toBeNull();
    expect(lastReadId(list, null)).toBeNull();
    expect(lastReadId(list, undefined)).toBeNull();
  });

  it('treningi do dołączenia: dziesięć najnowszych, z nazwą przyciętą', () => {
    const log = Array.from({ length: 12 }, (_, i) => entry(new Date(Date.UTC(2026, 10, i + 1, 18)).toISOString(), `Trening ${i + 1}`));
    log.push(entry('zła data', 'Zepsuty'));
    const r = recentSessions(log);
    expect(r).toHaveLength(10);
    expect(r[0]).toEqual({ kind: 'session', at: log[11]!.date, label: 'Trening 12' });
    expect(r.at(-1)!.label).toBe('Trening 3');
    expect(recentSessions([entry('2026-11-01T10:00:00Z', ` ${'x'.repeat(200)} `)])[0]!.label).toHaveLength(120);
  });

  it('licznik znaków dopiero blisko granicy', () => {
    expect(nearLimit('x'.repeat(100))).toBe(false);
    expect(nearLimit('x'.repeat(3600))).toBe(true);
  });
});

let server: FakeSztab;
let conn: LinkConnection;

async function connect(): Promise<LinkConnection> {
  const inv = await server.invite(['training'], ['training']);
  const r = await acceptInvite({
    preview: (await invitePreview(inv.id))!,
    fingerprint: inv.fingerprint,
    chosen: ['training'],
    replace: [],
    scopes: ['training'],
    secret: newIdSecret(),
  });
  if (!r.ok) throw new Error(r.reason);
  return r.connection;
}

function page(state: AppState = freshState(), id: string = conn.id) {
  const onToast = vi.fn();
  render(<ChatPage id={id} state={state} onToast={onToast} />);
  return { onToast };
}

const setVisibility = (v: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
};

const pulls = () => server.names().filter((n) => n === 'client_messages').length;

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  conn = await connect();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setVisibility('visible');
});

describe('strona rozmowy', () => {
  it('wiadomość prowadzącego przychodzi odszyfrowana i otwarta rozmowa oznacza ją jako przeczytaną — u nas i na serwerze', async () => {
    await server.message(conn.id, 'Jak kolano po wczorajszym?');
    page();
    expect(await screen.findByText('Jak kolano po wczorajszym?')).toBeInTheDocument();
    expect(screen.getByText(/Rozmowa z: Anna Kowalska · trener/)).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'Rozmowa' })).toBeInTheDocument();
    expect(screen.getByText('Dziś')).toBeInTheDocument();
    await waitFor(() => expect(server.connections.get(conn.id)!.messages[0]!.readAt).not.toBeNull());
    expect(unreadMessages(linkState())).toEqual([]);
    expect(screen.getByText(/Szyfrowane end-to-end/)).toBeInTheDocument();
  });

  it('wysłana wiadomość dochodzi do prowadzącego zaszyfrowana; po jego odczycie stoi „Przeczytane”', async () => {
    const user = userEvent.setup();
    page();
    await waitFor(() => expect(pulls()).toBeGreaterThan(0));
    const box = screen.getByRole('textbox', { name: 'Wiadomość do: Anna Kowalska' });
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled();
    await user.type(box, 'Kolano lepiej, robię dalej plan.');
    await user.click(screen.getByRole('button', { name: 'Wyślij' }));
    expect(box).toHaveValue('');
    expect(screen.getByText('Kolano lepiej, robię dalej plan.')).toBeInTheDocument();
    await waitFor(() => expect(messagesOf(linkState(), conn.id)[0]!.serverAt).not.toBeNull());
    const sent = messagesOf(linkState(), conn.id)[0]!;
    expect(await server.readMessage(conn.id, sent.id)).toMatchObject({ v: 1, text: 'Kolano lepiej, robię dalej plan.', ref: null });
    expect(screen.queryByText(/czeka na sieć/)).not.toBeInTheDocument();
    expect(screen.queryByText('Przeczytane')).not.toBeInTheDocument();

    server.readByCoach(conn.id);
    await act(async () => {
      await refreshMessages(conn.id);
    });
    expect(screen.getByText('Przeczytane')).toBeInTheDocument();
  });

  it('bez sieci: „czeka na sieć”, a po synchronizacji idzie i znacznik znika', async () => {
    const user = userEvent.setup();
    const { onToast } = page();
    await waitFor(() => expect(pulls()).toBeGreaterThan(0));
    server.setOffline(true);
    await user.type(screen.getByRole('textbox'), 'Bez zasięgu w piwnicy');
    await user.click(screen.getByRole('button', { name: 'Wyślij' }));
    expect(await screen.findByText(/czeka na sieć/)).toBeInTheDocument();
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Brak sieci — wiadomość pójdzie, gdy wróci.'));
    expect(server.connections.get(conn.id)!.messages).toHaveLength(0);

    server.setOffline(false);
    await act(async () => {
      await syncAll(() => freshState());
    });
    await waitFor(() => expect(screen.queryByText(/czeka na sieć/)).not.toBeInTheDocument());
    expect(server.connections.get(conn.id)!.messages).toHaveLength(1);
    const id = server.connections.get(conn.id)!.messages[0]!.id;
    expect(await server.readMessage(conn.id, id)).toMatchObject({ text: 'Bez zasięgu w piwnicy' });
  });

  it('„Dołącz trening”: wybrany trening jedzie jako odniesienie i widać go w dymku', async () => {
    const user = userEvent.setup();
    const state = { ...freshState(), log: [entry('2026-11-20T18:00:00.000Z', 'Dół B'), entry('2026-11-24T18:30:00.000Z', 'Góra A')] };
    page(state);
    await waitFor(() => expect(pulls()).toBeGreaterThan(0));
    const attach = screen.getByRole('button', { name: 'Dołącz trening' });
    expect(attach).toHaveAttribute('aria-expanded', 'false');
    await user.click(attach);
    const list = screen.getByRole('list', { name: 'Ostatnie treningi' });
    const options = within(list).getAllByRole('button');
    expect(options.map((b) => b.textContent)).toEqual([expect.stringMatching(/^Góra A/), expect.stringMatching(/^Dół B/)]);
    await user.click(options[0]!);
    expect(screen.queryByRole('list', { name: 'Ostatnie treningi' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Usuń odniesienie: Trening: Góra A/ })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'Ostatnia seria ciężko');
    await user.click(screen.getByRole('button', { name: 'Wyślij' }));
    await waitFor(() => expect(server.connections.get(conn.id)!.messages).toHaveLength(1));
    const id = server.connections.get(conn.id)!.messages[0]!.id;
    expect(await server.readMessage(conn.id, id)).toMatchObject({
      text: 'Ostatnia seria ciężko',
      ref: { kind: 'session', at: '2026-11-24T18:30:00.000Z', label: 'Góra A' },
    });
    expect(within(screen.getByRole('log')).getByText(/^Trening: Góra A/)).toBeInTheDocument();
    // Po wysłaniu odniesienie znika z pola.
    expect(screen.queryByRole('button', { name: /Usuń odniesienie/ })).not.toBeInTheDocument();
  });

  it('odniesienie da się zdjąć przed wysłaniem', async () => {
    const user = userEvent.setup();
    page({ ...freshState(), log: [entry('2026-11-24T18:30:00.000Z', 'Góra A')] });
    await user.click(screen.getByRole('button', { name: 'Dołącz trening' }));
    await user.click(screen.getByRole('button', { name: /^Góra A/ }));
    await user.click(screen.getByRole('button', { name: /Usuń odniesienie/ }));
    expect(screen.queryByRole('button', { name: /Usuń odniesienie/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dołącz trening' })).toBeInTheDocument();
  });

  it('bez treningów w dzienniku nie ma czego dołączać', async () => {
    page();
    await waitFor(() => expect(pulls()).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Dołącz trening' })).not.toBeInTheDocument();
  });

  it('licznik znaków pojawia się blisko granicy 4000', async () => {
    page();
    const box = screen.getByRole('textbox');
    expect(box).toHaveAttribute('maxLength', '4000');
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      set.call(box, 'x'.repeat(3700));
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(screen.getByText('3700 / 4000 znaków')).toBeInTheDocument();
  });

  it('pyta o nowe co 20 s, ale tylko na widocznej karcie; powrót na kartę — od razu', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    page();
    await waitFor(() => expect(pulls()).toBe(1));
    await server.message(conn.id, 'Pamiętaj o rozgrzewce');
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS);
    });
    expect(await screen.findByText('Pamiętaj o rozgrzewce')).toBeInTheDocument();
    await waitFor(() => expect(pulls()).toBe(2));

    setVisibility('hidden');
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 3);
    });
    expect(pulls()).toBe(2);

    await server.message(conn.id, 'Jutro 18:00?');
    act(() => setVisibility('visible'));
    expect(await screen.findByText('Jutro 18:00?')).toBeInTheDocument();
    await waitFor(() => expect(server.connections.get(conn.id)!.messages.every((m) => m.readAt)).toBe(true));
  });

  it('po wyjściu ze strony przestaje pytać', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const view = render(<ChatPage id={conn.id} state={freshState()} onToast={vi.fn()} />);
    await waitFor(() => expect(pulls()).toBe(1));
    view.unmount();
    vi.advanceTimersByTime(POLL_MS * 2);
    expect(pulls()).toBe(1);
  });

  it('współpraca zakończona: rozmowa do przeczytania, bez pola i bez pytania serwera', async () => {
    await server.message(conn.id, 'Powodzenia dalej!');
    await syncAll(() => freshState());
    markEnded(conn.id, 'coach');
    const before = pulls();
    page();
    expect(screen.getByText('Powodzenia dalej!')).toBeInTheDocument();
    expect(screen.getByText(/Współpraca zakończona — rozmowę można już tylko przeczytać/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(pulls()).toBe(before);
  });

  it('nasza niewysłana wiadomość w zakończonej współpracy mówi, że nie poszła', () => {
    updateLink((s) => {
      s.messages.push(msg({ id: 'x1', connectionId: conn.id, text: 'Za późno', at: Date.now() }));
    });
    markEnded(conn.id, 'client');
    page();
    expect(screen.getByText(/niewysłana — współpraca się zakończyła/)).toBeInTheDocument();
  });

  it('nieznana współpraca — mówi, że jej tu nie ma', () => {
    page(freshState(), 'nie-ma-takiej');
    expect(screen.getByText('Nie ma takiej współpracy na tym telefonie.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('pusta rozmowa zachęca do pierwszej wiadomości', async () => {
    page();
    expect(screen.getByText(/Jeszcze nic tu nie ma/)).toBeInTheDocument();
  });
});

describe('pobieranie wiadomości', () => {
  it('dwa pobrania naraz nie dublują wiadomości', async () => {
    await server.message(conn.id, 'Raz');
    await Promise.all([refreshMessages(conn.id), refreshMessages(conn.id), syncAll(() => freshState())]);
    expect(messagesOf(linkState(), conn.id).map((m) => m.text)).toEqual(['Raz']);
  });
});
