import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Connection, Message } from '../src/lib/data';
import {
  POLL_MS,
  REF_TTL_MS,
  byDay,
  clearSessionRef,
  clearUnread,
  firstUnread,
  hasUnread,
  lastReadOwn,
  messagesHref,
  nearLimit,
  peekSessionRef,
  refreshUnread,
  sessionRef,
  stashSessionRef,
  whenOf,
} from '../src/pages/client/messages';

/**
 * Wiadomości w Sztabie: czyste funkcje zakładki i sama zakładka na podstawionych funkcjach danych —
 * rozmowa z dniami, „przeczytane”, oznaczanie przeczytanych, wysyłka z odniesieniem z „Skomentuj”,
 * odpytywanie tylko na widocznej karcie, współpraca zakończona.
 */

// Teksty po polsku bez względu na język maszyny — zanim cokolwiek wczyta `@gt/i18n`.
vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

const KEY = { fake: 'key' } as unknown as CryptoKey;

vi.mock('../src/session', () => ({
  useReady: () => ({ key: KEY, user: { id: 'coach-1' }, coach: { id: 'coach-1', display_name: 'Anna', profession: 'trainer' } }),
}));

const db = vi.hoisted(() => ({
  messages: [] as Message[],
  unread: {} as Record<string, number>,
  sendFails: false,
}));

vi.mock('../src/lib/data', async (orig) => {
  const real = await orig<typeof import('../src/lib/data')>();
  return {
    ...real,
    listMessages: vi.fn(async () => db.messages.map((m) => ({ ...m }))),
    markRead: vi.fn(async () => {
      for (const m of db.messages) if (m.author === 'client' && !m.readAt) m.readAt = new Date().toISOString();
    }),
    sendMessage: vi.fn(async (_key: CryptoKey, _c: Connection, text: string, ref: Message['ref']) => {
      if (db.sendFails) throw new Error('Failed to fetch');
      const id = `srv-${db.messages.length + 1}`;
      db.messages.push({ id, author: 'coach', text: text.trim(), ref, createdAt: new Date().toISOString(), readAt: null });
      return id;
    }),
    unreadCounts: vi.fn(async () => ({ ...db.unread })),
  };
});

const data = await import('../src/lib/data');
const { CommentSessionLink, MessagesTab, UnreadBadge } = await import('../src/pages/client/MessagesTab');

const conn = (over: Partial<Connection> = {}): Connection => ({
  id: 'c1',
  inviteId: 'i1',
  pseudonym: 'ABCDEFGHJKMNPQRSTVWX',
  areas: ['training'],
  scopes: ['training'],
  clientKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
  status: 'active',
  endedBy: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  endedAt: null,
  lastPushAt: null,
  label: null,
  ...over,
});

const m = (over: Partial<Message>): Message => ({
  id: 'm',
  author: 'client',
  text: 'x',
  ref: null,
  createdAt: '2026-11-25T10:00:00.000Z',
  readAt: null,
  ...over,
});

const setVisibility = (v: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('wiadomości — czyste funkcje', () => {
  it('dni po kolei, w kolejności rozmowy', () => {
    const list = [
      m({ id: 'a', createdAt: new Date(2026, 10, 24, 9).toISOString() }),
      m({ id: 'b', createdAt: new Date(2026, 10, 24, 21).toISOString() }),
      m({ id: 'c', createdAt: new Date(2026, 10, 25, 8).toISOString() }),
    ];
    expect(byDay(list, whenOf).map((g) => [g.day, g.items.map((x) => x.id)])).toEqual([
      ['2026-11-24', ['a', 'b']],
      ['2026-11-25', ['c']],
    ]);
  });

  it('„przeczytane” tylko pod ostatnią przeczytaną wiadomością prowadzącego', () => {
    const list = [
      m({ id: 'a', author: 'coach', readAt: '2026-11-25T10:05:00Z' }),
      m({ id: 'b', author: 'client', readAt: '2026-11-25T10:06:00Z' }),
      m({ id: 'c', author: 'coach', readAt: '2026-11-25T10:07:00Z' }),
      m({ id: 'd', author: 'coach', readAt: null }),
    ];
    expect(lastReadOwn(list)?.id).toBe('c');
    expect(lastReadOwn([m({ author: 'coach' })])).toBeNull();
  });

  it('pierwsza nieprzeczytana od podopiecznego', () => {
    const list = [m({ id: 'a', readAt: 'x' }), m({ id: 'b', author: 'coach' }), m({ id: 'c' }), m({ id: 'd' })];
    expect(firstUnread(list)).toBe('c');
    expect(hasUnread(list)).toBe(true);
    expect(firstUnread([m({ readAt: 'x' })])).toBeNull();
    expect(hasUnread([m({ author: 'coach' })])).toBe(false);
  });

  it('„Skomentuj”: trening idzie przez pamięć karty, nie przez adres; przeterminowany i cudzy odpadają', () => {
    sessionStorage.clear();
    expect(messagesHref('c1')).toBe('/podopieczni/c1?t=messages');
    const t = Date.parse('2026-11-25T10:00:00Z');
    stashSessionRef('c1', '2026-11-24T18:30:00.000Z', 'Góra A & B', t);
    expect(peekSessionRef('c1', t + 1000)).toEqual({ kind: 'session', at: '2026-11-24T18:30:00.000Z', label: 'Góra A & B' });
    // Podejrzenie nie kasuje (tryb ścisły Reacta liczy stan dwa razy), kasuje dopiero `clearSessionRef`.
    expect(peekSessionRef('c1', t + 2000)).not.toBeNull();
    expect(peekSessionRef('c2', t + 1000)).toBeNull();
    expect(peekSessionRef('c1', t + REF_TTL_MS + 1)).toBeNull();
    clearSessionRef('c1');
    expect(peekSessionRef('c1', t + 1000)).toBeNull();
    sessionStorage.setItem('sztab.komentarz.c1', 'zepsute{');
    expect(peekSessionRef('c1', t)).toBeNull();
  });

  it('zepsute odniesienie odpada, nazwa przycięta', () => {
    expect(sessionRef(null, 'x')).toBeNull();
    expect(sessionRef('wczoraj', 'x')).toBeNull();
    expect(sessionRef('2026-11-24T18:30:00Z', null)).toEqual({ kind: 'session', at: '2026-11-24T18:30:00Z', label: '' });
    expect(sessionRef('2026-11-24T18:30:00Z', 'y'.repeat(300))!.label).toHaveLength(120);
  });

  it('licznik znaków dopiero blisko granicy', () => {
    expect(nearLimit('x'.repeat(3499))).toBe(false);
    expect(nearLimit('x'.repeat(3500))).toBe(true);
  });
});

describe('zakładka „Wiadomości”', () => {
  beforeEach(() => {
    db.messages = [];
    db.unread = {};
    db.sendFails = false;
    vi.clearAllMocks();
    sessionStorage.clear();
    history.replaceState(null, '', '/podopieczni/c1?t=messages');
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pusta rozmowa: zachęta do pierwszej wiadomości i słowo o szyfrowaniu', async () => {
    render(<MessagesTab c={conn()} />);
    expect(await screen.findByText(/Napisz pierwszą wiadomość — podopieczny zobaczy ją przy następnym otwarciu GYM TRACKERa\./)).toBeInTheDocument();
    expect(screen.getByText(/Szyfrowane end-to-end/)).toBeInTheDocument();
    expect(data.markRead).not.toHaveBeenCalled();
  });

  it('rozmowa z dniami; nowe od podopiecznego oznaczone jako przeczytane; „przeczytane” pod ostatnią naszą', async () => {
    const now = new Date();
    const y = new Date(now.getTime() - 86_400_000);
    db.messages = [
      m({ id: 'a', author: 'coach', text: 'Jak kolano?', createdAt: y.toISOString(), readAt: y.toISOString() }),
      m({ id: 'b', author: 'client', text: 'Lepiej, dzięki', createdAt: now.toISOString(), ref: { kind: 'session', at: y.toISOString(), label: 'Góra A' } }),
      m({ id: 'c', author: 'coach', text: 'To dobrze', createdAt: now.toISOString() }),
    ];
    render(<MessagesTab c={conn()} />);
    const log = await screen.findByRole('log', { name: 'Rozmowa z podopiecznym' });
    expect(within(log).getByText('Wczoraj')).toBeInTheDocument();
    expect(within(log).getByText('Dziś')).toBeInTheDocument();
    expect(within(log).getByText('Jak kolano?')).toBeInTheDocument();
    expect(within(log).getByRole('link', { name: /^Trening: Góra A/ })).toHaveAttribute('href', '/podopieczni/c1?t=training');
    expect(within(log).getAllByText(/przeczytane/)).toHaveLength(1);
    expect(within(log).getByRole('separator')).toHaveTextContent('Nowe');
    await waitFor(() => expect(data.markRead).toHaveBeenCalledTimes(1));
  });

  it('wysyłka Ctrl+Enter: od razu na ekranie, potem z serwera; pole puste', async () => {
    const user = userEvent.setup();
    render(<MessagesTab c={conn()} />);
    const box = await screen.findByRole('textbox', { name: 'Wiadomość' });
    expect(screen.getByRole('button', { name: 'Wyślij wiadomość' })).toBeDisabled();
    await user.type(box, 'Jutro lżej, deload.');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(data.sendMessage).toHaveBeenCalledWith(KEY, expect.objectContaining({ id: 'c1' }), 'Jutro lżej, deload.', null);
    expect(box).toHaveValue('');
    await waitFor(() => expect(data.listMessages).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText('Jutro lżej, deload.')).toHaveLength(1);
    expect(screen.queryByText(/wysyłam/)).not.toBeInTheDocument();
  });

  it('samo Enter nie wysyła — to nowa linijka', async () => {
    const user = userEvent.setup();
    render(<MessagesTab c={conn()} />);
    const box = await screen.findByRole('textbox', { name: 'Wiadomość' });
    await user.type(box, 'Raz{Enter}dwa');
    expect(data.sendMessage).not.toHaveBeenCalled();
    expect(box).toHaveValue('Raz\ndwa');
  });

  it('„Skomentuj”: trening z pamięci karty jedzie jako odniesienie, w adresie go nie ma; po wysłaniu znika', async () => {
    stashSessionRef('c1', '2026-11-24T18:30:00.000Z', 'Góra A');
    const user = userEvent.setup();
    render(<MessagesTab c={conn()} />);
    const box = await screen.findByRole('textbox', { name: 'Wiadomość' });
    expect(screen.getByText(/^Trening: Góra A · /)).toBeInTheDocument();
    expect(box).toHaveFocus();
    // Przeczytane raz — z pamięci karty znika od razu.
    expect(sessionStorage.length).toBe(0);
    expect(location.search).toBe('?t=messages');
    await user.type(box, 'Świetne tempo w ostatniej serii.');
    await user.click(screen.getByRole('button', { name: 'Wyślij wiadomość' }));
    expect(data.sendMessage).toHaveBeenCalledWith(KEY, expect.anything(), 'Świetne tempo w ostatniej serii.', {
      kind: 'session',
      at: '2026-11-24T18:30:00.000Z',
      label: 'Góra A',
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Usuń odniesienie/ })).not.toBeInTheDocument());
    expect(location.search).toBe('?t=messages');
  });

  it('odniesienie nie wraca z historii ani po ponownym otwarciu rozmowy', async () => {
    stashSessionRef('c1', '2026-11-20T17:00:00.000Z', 'Dół B');
    const first = render(<MessagesTab c={conn()} />);
    expect(await screen.findByRole('button', { name: /Usuń odniesienie: Trening: Dół B/ })).toBeInTheDocument();
    first.unmount();
    await act(async () => {
      history.pushState(null, '', '/podopieczni/c1?t=training');
      history.back();
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    render(<MessagesTab c={conn()} />);
    await screen.findByRole('textbox', { name: 'Wiadomość' });
    expect(screen.queryByRole('button', { name: /Usuń odniesienie/ })).not.toBeInTheDocument();
  });

  it('odniesienie da się zdjąć przed wysłaniem', async () => {
    stashSessionRef('c1', '2026-11-24T18:30:00.000Z', 'Góra A');
    const user = userEvent.setup();
    render(<MessagesTab c={conn()} />);
    await user.click(await screen.findByRole('button', { name: /Usuń odniesienie: Trening: Góra A/ }));
    expect(screen.queryByText(/^Trening: Góra A/)).not.toBeInTheDocument();
    expect(location.search).toBe('?t=messages');
    await user.type(screen.getByRole('textbox', { name: 'Wiadomość' }), 'Ogólnie');
    await user.click(screen.getByRole('button', { name: 'Wyślij wiadomość' }));
    expect(data.sendMessage).toHaveBeenCalledWith(KEY, expect.anything(), 'Ogólnie', null);
  });

  it('wysyłka się nie udała: tekst wraca do pola, błąd na ekranie, dymek znika', async () => {
    db.sendFails = true;
    const user = userEvent.setup();
    render(<MessagesTab c={conn()} />);
    const box = await screen.findByRole('textbox', { name: 'Wiadomość' });
    await user.type(box, 'Nie dojdzie');
    await user.click(screen.getByRole('button', { name: 'Wyślij wiadomość' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Wiadomość nie poszła \(Failed to fetch\)/);
    expect(box).toHaveValue('Nie dojdzie');
    expect(within(screen.getByRole('log')).queryByText('Nie dojdzie')).not.toBeInTheDocument();
  });

  it('licznik znaków blisko 4000', async () => {
    render(<MessagesTab c={conn()} />);
    const box = await screen.findByRole('textbox', { name: 'Wiadomość' });
    expect(box).toHaveAttribute('maxLength', '4000');
    expect(screen.getByText(/Ctrl\+Enter — wyślij|⌘\+Enter — wyślij/)).toBeInTheDocument();
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      set.call(box, 'x'.repeat(3800));
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(screen.getByText('3800 / 4000 znaków')).toBeInTheDocument();
  });

  it('co 20 s pyta o nowe, tylko na widocznej karcie; po wyjściu przestaje', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const view = render(<MessagesTab c={conn()} />);
    await waitFor(() => expect(data.listMessages).toHaveBeenCalledTimes(1));
    db.messages.push(m({ id: 'n1', text: 'Jestem po treningu' }));
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS);
    });
    expect(await screen.findByText('Jestem po treningu')).toBeInTheDocument();
    await waitFor(() => expect(data.markRead).toHaveBeenCalledTimes(1));

    setVisibility('hidden');
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 3);
    });
    expect(data.listMessages).toHaveBeenCalledTimes(2);

    await act(async () => setVisibility('visible'));
    await waitFor(() => expect(data.listMessages).toHaveBeenCalledTimes(3));

    view.unmount();
    vi.advanceTimersByTime(POLL_MS * 3);
    expect(data.listMessages).toHaveBeenCalledTimes(3);
  });

  it('nie oznacza przeczytanych, gdy karta jest w tle', async () => {
    setVisibility('hidden');
    db.messages = [m({ id: 'u', text: 'Halo?' })];
    render(<MessagesTab c={conn()} />);
    expect(await screen.findByText('Halo?')).toBeInTheDocument();
    expect(data.markRead).not.toHaveBeenCalled();
  });

  it('współpraca zakończona: tylko do odczytu, bez pola i bez odpytywania', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    db.messages = [m({ id: 'a', author: 'coach', text: 'Powodzenia!' })];
    render(<MessagesTab c={conn({ status: 'ended', endedBy: 'client', endedAt: '2026-11-25T12:00:00Z' })} />);
    expect(await screen.findByText('Powodzenia!')).toBeInTheDocument();
    expect(screen.getByText(/Współpraca zakończona — rozmowa jest tylko do odczytu/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    vi.advanceTimersByTime(POLL_MS * 2);
    expect(data.listMessages).toHaveBeenCalledTimes(1);
    expect(data.markRead).not.toHaveBeenCalled();
  });

  it('błąd wczytania — komunikat z ponowieniem', async () => {
    vi.mocked(data.listMessages).mockRejectedValueOnce(new Error('JWT expired'));
    const user = userEvent.setup();
    render(<MessagesTab c={conn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wczytać rozmowy (JWT expired).');
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

describe('przy zakładce i przy treningu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVisibility('visible');
  });

  it('znaczek nieprzeczytanych gaśnie, gdy rozmowa je przeczyta', async () => {
    db.unread = { c1: 2, other: 5 };
    db.messages = [m({ id: 'a', text: 'Pytanie' }), m({ id: 'b', text: 'I jeszcze jedno' })];
    const badge = render(<UnreadBadge connectionId="c1" />);
    expect(await badge.findByText('2')).toBeInTheDocument();
    expect(badge.container).toHaveTextContent('2 nieprzeczytane wiadomości');
    badge.unmount();

    const both = render(
      <>
        <span data-testid="badge">
          <UnreadBadge connectionId="c1" />
        </span>
        <MessagesTab c={conn()} />
      </>,
    );
    db.unread = { other: 5 };
    expect(await both.findByText('Pytanie')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('badge')).toBeEmptyDOMElement());
  });

  it('„Skomentuj” prowadzi do rozmowy; nazwa i data treningu nie trafiają do adresu', async () => {
    sessionStorage.clear();
    history.replaceState(null, '', '/podopieczni/c1?t=training');
    // Przejście przewija stronę do góry — jsdom tego nie umie.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<CommentSessionLink connectionId="c1" at="2026-11-24T18:30:00.000Z" name="Góra A" />);
    const link = screen.getByRole('link', { name: /^Skomentuj trening Góra A z / });
    expect(link).toHaveTextContent('Skomentuj');
    expect(link).toHaveAttribute('href', '/podopieczni/c1?t=messages');
    // Ctrl+klik (nowa karta) nie zostawia odniesienia w tej karcie.
    await user.keyboard('{Control>}');
    await user.click(link);
    await user.keyboard('{/Control}');
    expect(peekSessionRef('c1')).toBeNull();
    await user.click(link);
    expect(location.pathname + location.search).toBe('/podopieczni/c1?t=messages');
    expect(peekSessionRef('c1')).toEqual({ kind: 'session', at: '2026-11-24T18:30:00.000Z', label: 'Góra A' });
    clearSessionRef('c1');
  });

  it('licznik: odpowiedź serwera sprzed oznaczenia jako przeczytane nie zapala znaczka z powrotem', async () => {
    let answer: (v: Record<string, number>) => void = () => undefined;
    vi.mocked(data.unreadCounts).mockImplementationOnce(() => new Promise((r) => (answer = r)));
    db.unread = { c9: 0 };
    const badge = render(<UnreadBadge connectionId="c9" />);
    // Pierwsze pytanie (z zamontowania) jeszcze leci, gdy rozmowa oznacza wiadomości jako przeczytane.
    await waitFor(() => expect(data.unreadCounts).toHaveBeenCalled());
    act(() => clearUnread('c9'));
    await act(async () => answer({ c9: 3 }));
    expect(badge.container).toBeEmptyDOMElement();
    // Następne pytanie już się liczy.
    db.unread = { c9: 1 };
    await act(() => refreshUnread());
    expect(badge.container).toHaveTextContent('1');
  });
});
