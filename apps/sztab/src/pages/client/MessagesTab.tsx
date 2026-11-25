import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { MESSAGE_MAX, addDays, localDay } from '@gymtracker/link/coaching';
import type { MessageRef } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import { Failure, Link, Loading, fmtDate } from '../../components/ui';
import { listMessages, markRead, sendMessage } from '../../lib/data';
import type { Connection, Message } from '../../lib/data';
import { linkClick, useLocation } from '../../lib/router';
import { useReady } from '../../session';
import {
  POLL_MS,
  byDay,
  clearSessionRef,
  clearUnread,
  firstUnread,
  hasUnread,
  lastReadOwn,
  messagesHref,
  nearLimit,
  peekSessionRef,
  stashSessionRef,
  useUnreadCount,
  visible,
  whenOf,
} from './messages';
import './MessagesTab.css';

const T = text({
  pl: {
    log: 'Rozmowa z podopiecznym',
    you: 'Ty',
    client: 'Podopieczny',
    today: 'Dziś',
    yesterday: 'Wczoraj',
    fresh: 'Nowe',
    readAt: (t: string) => `przeczytane ${t}`,
    sending: 'wysyłam…',
    empty: 'Napisz pierwszą wiadomość — podopieczny zobaczy ją przy następnym otwarciu GYM TRACKERa.',
    ended: 'Współpraca zakończona — rozmowa jest tylko do odczytu.',
    e2e: 'Szyfrowane end-to-end: treść czytacie tylko ty i podopieczny, serwer przechowuje szyfrogram.',
    label: 'Wiadomość',
    placeholder: 'Napisz do podopiecznego…',
    send: 'Wyślij wiadomość',
    shortcut: (mod: string) => `${mod}+Enter — wyślij`,
    counter: (n: number, max: number) => `${n} / ${max} znaków`,
    session: 'Trening',
    assignment: 'Zalecenie',
    about: 'Dotyczy',
    remove: (what: string) => `Usuń odniesienie: ${what}`,
    comment: 'Skomentuj',
    commentAria: (name: string, date: string) => `Skomentuj trening ${name} z ${date}`,
    unread: (n: number): string => (n === 1 ? 'nieprzeczytana wiadomość' : 'nieprzeczytane wiadomości'),
    loadFailed: (why: string) => `Nie udało się wczytać rozmowy (${why}).`,
    sendFailed: (why: string) => `Wiadomość nie poszła (${why}). Tekst wrócił do pola — spróbuj jeszcze raz.`,
  },
  en: {
    log: 'Conversation with the client',
    you: 'You',
    client: 'Client',
    today: 'Today',
    yesterday: 'Yesterday',
    fresh: 'New',
    readAt: (t: string) => `read ${t}`,
    sending: 'sending…',
    empty: 'Write the first message — the client will see it the next time they open GYM TRACKER.',
    ended: 'The collaboration has ended — the conversation is read-only.',
    e2e: 'End-to-end encrypted: only you and the client can read it, the server stores ciphertext.',
    label: 'Message',
    placeholder: 'Write to the client…',
    send: 'Send message',
    shortcut: (mod: string) => `${mod}+Enter — send`,
    counter: (n: number, max: number) => `${n} / ${max} characters`,
    session: 'Workout',
    assignment: 'Advice',
    about: 'About',
    remove: (what: string) => `Remove reference: ${what}`,
    comment: 'Comment',
    commentAria: (name: string, date: string) => `Comment on workout ${name} from ${date}`,
    unread: (n: number) => (n === 1 ? 'unread message' : 'unread messages'),
    loadFailed: (why: string) => `Could not load the conversation (${why}).`,
    sendFailed: (why: string) => `The message was not sent (${why}). The text is back in the box — try again.`,
  },
});

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const timeText = (iso: string | number) => new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

function dayTitle(day: string, today: string): string {
  if (day === today) return T.today;
  if (day === addDays(today, -1)) return T.yesterday;
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Date(`${day}T12:00:00`).toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Odniesienie słowami: „Trening: Góra A · 24 lis 2026”. */
function refText(r: MessageRef): string {
  if (r.kind === 'session') return `${T.session}: ${r.label || T.session} · ${fmtDate(r.at, LOCALE)}`;
  return `${T.assignment}: ${r.label || T.assignment}`;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Zakładka nieprzeczytanych przy „Wiadomościach” w nagłówku podopiecznego. */
export function UnreadBadge({ connectionId }: { connectionId: string }) {
  const n = useUnreadCount(connectionId);
  if (!n) return null;
  return (
    <span className="count sz-msg-badge">
      {n}
      <span className="sr"> {T.unread(n)}</span>
    </span>
  );
}

/**
 * „Skomentuj” przy treningu: otwiera rozmowę z tym treningiem jako odniesieniem. Nazwa i data treningu
 * idą przez pamięć karty (`stashSessionRef`), nie przez adres — adres zostaje w historii i w logach serwera.
 */
export function CommentSessionLink({ connectionId, at, name }: { connectionId: string; at: string; name: string }) {
  const href = messagesHref(connectionId);
  return (
    <a
      href={href}
      className="btn ghost small"
      aria-label={T.commentAria(name, fmtDate(at, LOCALE))}
      onClick={(e) => {
        // Tylko zwykłe kliknięcie w tej karcie — nowa karta (Ctrl, środkowy przycisk) otwiera samą rozmowę.
        if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) stashSessionRef(connectionId, at, name);
        linkClick(e, href);
      }}
    >
      {T.comment}
    </a>
  );
}

/** Wiadomość jeszcze w drodze — na ekranie od razu, z prawdziwym numerem, gdy serwer ją przyjął. */
type Outgoing = Message & { sending: boolean };

/**
 * Zakładka „Wiadomości” podopiecznego: rozmowa od najstarszej, z dniami i godzinami. Szyfruje
 * i odszyfrowuje `lib/data.ts` kluczem współpracy — tu trafia już tekst. Co 20 s (tylko na widocznej
 * karcie) pyta o nowe i oznacza wiadomości podopiecznego jako przeczytane.
 */
export function MessagesTab({ c }: { c: Connection }) {
  const { key } = useReady();
  const active = c.status === 'active';
  const [list, setList] = useState<Message[]>();
  const [error, setError] = useState<string | null>(null);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [freshFrom, setFreshFrom] = useState<string | null | undefined>(undefined);

  // Jedno pobieranie naraz; prośba w trakcie — jeszcze raz zaraz po nim (np. po wysłaniu).
  const alive = useRef(true);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const load = useCallback((): Promise<void> => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const run = async () => {
      do {
        again.current = false;
        try {
          const msgs = await listMessages(key, c);
          if (!alive.current) return;
          setList(msgs);
          setError(null);
          setFreshFrom((f) => (f === undefined ? firstUnread(msgs) : f));
          setOutgoing((o) => o.filter((x) => !msgs.some((m) => m.id === x.id)));
          // Nieudane oznaczenie nie jest błędem rozmowy — następne pobranie spróbuje znowu.
          if (active && visible() && hasUnread(msgs)) await markRead(c).then(() => clearUnread(c.id), () => undefined);
        } catch (e) {
          if (alive.current) setError(T.loadFailed(errorText(e)));
        }
      } while (again.current && alive.current);
    };
    running.current = run().finally(() => {
      running.current = null;
    });
    return running.current;
  }, [key, c, active]);

  useEffect(() => {
    alive.current = true;
    void load();
    if (!active) {
      return () => {
        alive.current = false;
      };
    }
    const t = window.setInterval(() => {
      if (visible()) void load();
    }, POLL_MS);
    const onVisibility = () => {
      if (visible()) void load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive.current = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load, active]);

  // Wysłana, a już na liście z serwera — tylko raz.
  const shown: Outgoing[] = [
    ...(list ?? []).map((m) => ({ ...m, sending: false })),
    ...outgoing.filter((x) => !list?.some((m) => m.id === x.id)),
  ];

  // Na dół przy wejściu i przy nowej wiadomości — chyba że ktoś czyta wyżej (wtedy tylko po własnej).
  const logRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastId = shown.at(-1)?.id;
  const lastMine = shown.at(-1)?.author === 'coach';
  const ready = list !== undefined;
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el && (atBottom.current || lastMine)) el.scrollTop = el.scrollHeight;
  }, [lastId, lastMine, ready]);

  if (list === undefined && !error) return <Loading />;

  const today = localDay();
  const readOwn = lastReadOwn(shown);
  const groups = byDay(shown, whenOf);

  return (
    <section className="card sz-msg">
      {error ? <Failure error={error} retry={() => void load()} /> : null}
      <div
        ref={logRef}
        className="sz-msg-log"
        role="log"
        aria-label={T.log}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {!shown.length ? (
          <p className="sz-msg-empty soft">{active ? T.empty : T.ended}</p>
        ) : (
          groups.map((g) => (
            <section key={g.day} className="sz-msg-day" aria-label={dayTitle(g.day, today)}>
              <h3 className="sz-msg-daytitle" aria-hidden="true">
                <span>{dayTitle(g.day, today)}</span>
              </h3>
              {g.items.map((m) => (
                <Bubble key={m.id} m={m} fresh={m.id === freshFrom} read={m.id === readOwn?.id} />
              ))}
            </section>
          ))
        )}
      </div>
      {active ? (
        <Composer
          c={c}
          onSending={(m) => setOutgoing((o) => [...o, m])}
          onSent={(temp, id) => {
            setOutgoing((o) => o.map((x) => (x.id === temp ? { ...x, id, sending: false } : x)));
            void load();
          }}
          onFailed={(temp) => setOutgoing((o) => o.filter((x) => x.id !== temp))}
        />
      ) : shown.length ? (
        <div className="note">{T.ended}</div>
      ) : null}
      <p className="small soft sz-msg-e2e">{T.e2e}</p>
    </section>
  );
}

function Bubble({ m, fresh, read }: { m: Outgoing; fresh: boolean; read: boolean }) {
  const mine = m.author === 'coach';
  return (
    <>
      {fresh ? (
        <div className="sz-msg-new" role="separator">
          <span>{T.fresh}</span>
        </div>
      ) : null}
      <div className={`sz-msg-bubble ${mine ? 'mine' : 'theirs'}${m.sending ? ' sending' : ''}`}>
        <span className="sr">{mine ? T.you : T.client}: </span>
        {m.ref ? <RefChip r={m.ref} /> : null}
        <p className="sz-msg-text">{m.text}</p>
        <p className="sz-msg-meta">
          <time dateTime={m.createdAt}>{timeText(m.createdAt)}</time>
          {m.sending ? ` · ${T.sending}` : null}
          {read && m.readAt ? <span className="sz-msg-read"> · {T.readAt(timeText(m.readAt))}</span> : null}
        </p>
      </div>
    </>
  );
}

/** Odniesienie w dymku prowadzi do zakładki, z której pochodzi: treningów albo zaleceń. */
function RefChip({ r }: { r: MessageRef }) {
  const { path } = useLocation();
  return (
    <Link to={`${path}?t=${r.kind === 'session' ? 'training' : 'sent'}`} className="sz-msg-ref">
      {refText(r)}
    </Link>
  );
}

function Composer({
  c,
  onSending,
  onSent,
  onFailed,
}: {
  c: Connection;
  onSending: (m: Outgoing) => void;
  onSent: (temp: string, id: string) => void;
  onFailed: (temp: string) => void;
}) {
  const { key } = useReady();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Trening z „Skomentuj” — z pamięci karty, czytany raz: po otwarciu rozmowy znika stamtąd od razu.
  const [attached, setAttached] = useState<MessageRef | null>(() => peekSessionRef(c.id));
  const area = useRef<HTMLTextAreaElement>(null);
  const focusOnOpen = useRef(attached !== null);
  useEffect(() => {
    clearSessionRef(c.id);
    if (focusOnOpen.current) area.current?.focus();
  }, [c.id]);

  // Odniesienie zdjęte albo wysłane.
  const dropRef = () => {
    setAttached(null);
    clearSessionRef(c.id);
  };

  const send = async () => {
    const clean = draft.trim();
    if (!clean || busy) return;
    const temp = `tmp-${Date.now()}`;
    const ref = attached;
    setBusy(true);
    setError(null);
    setDraft('');
    onSending({ id: temp, author: 'coach', text: clean.slice(0, MESSAGE_MAX), ref, createdAt: new Date().toISOString(), readAt: null, sending: true });
    try {
      const id = await sendMessage(key, c, clean, ref);
      if (ref) dropRef();
      onSent(temp, id);
    } catch (e) {
      onFailed(temp);
      setDraft((d) => d || clean);
      setError(T.sendFailed(errorText(e)));
    } finally {
      setBusy(false);
      area.current?.focus();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <form
      className="sz-msg-compose"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {error ? <Failure error={error} /> : null}
      {attached ? (
        <div className="sz-msg-attached">
          <span className="small soft">{T.about}:</span>
          <span className="chip blue">{refText(attached)}</span>
          <button type="button" className="sz-msg-x" aria-label={T.remove(refText(attached))} onClick={dropRef}>
            ×
          </button>
        </div>
      ) : null}
      <label className="sr" htmlFor="sz-msg-input">
        {T.label}
      </label>
      <textarea
        id="sz-msg-input"
        ref={area}
        rows={3}
        maxLength={MESSAGE_MAX}
        placeholder={T.placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        aria-describedby="sz-msg-hint"
      />
      <div className="row between">
        <span id="sz-msg-hint" className="small soft">
          {nearLimit(draft) ? (
            <span className={draft.length >= MESSAGE_MAX ? 'sz-msg-full' : undefined} aria-live="polite">
              {T.counter(draft.length, MESSAGE_MAX)}
            </span>
          ) : (
            T.shortcut(isMac ? '⌘' : 'Ctrl')
          )}
        </span>
        <button type="submit" className="btn blue" disabled={!draft.trim() || busy}>
          {T.send}
        </button>
      </div>
    </form>
  );
}
