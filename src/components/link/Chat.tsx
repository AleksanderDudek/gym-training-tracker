import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { MESSAGE_MAX, addDays, localDay } from '@gymtracker/link/coaching';
import type { MessageRef } from '@gymtracker/link/coaching';
import { LOCALE, text } from '../../i18n';
import { connectionOf, linkState, messagesOf, unreadMessages, useLink } from '../../link/store';
import type { LinkState, StoredMessage } from '../../link/store';
import { markMessagesRead, refreshMessages, sendMessage } from '../../link/sync';
import { linkAssignmentPath } from '../../routing';
import type { AppState } from '../../types';
import { T as LT } from '../Link.text';
import { W } from '../Link.words';
import { byDay, lastReadId, nearLimit, recentSessions, whenOf } from './chatThread';
import './chat.css';

const T = text({
  pl: {
    lead: (name: string, prof: string) => `Rozmowa z: ${name} · ${prof.toLowerCase()}`,
    e2e: 'Szyfrowane end-to-end: treść czytacie tylko wy dwoje, serwer po drodze widzi szyfrogram.',
    empty: 'Jeszcze nic tu nie ma. Napisz, jeśli masz pytanie albo chcesz dać znać, jak idzie — prowadzący przeczyta to u siebie w Sztabie.',
    log: 'Rozmowa',
    you: 'Ty',
    today: 'Dziś',
    yesterday: 'Wczoraj',
    waiting: 'czeka na sieć',
    notSent: 'niewysłana — współpraca się zakończyła',
    read: 'Przeczytane',
    label: (name: string) => `Wiadomość do: ${name}`,
    placeholder: 'Napisz wiadomość…',
    send: 'Wyślij',
    counter: (n: number, max: number) => `${n} / ${max} znaków`,
    attach: 'Dołącz trening',
    attachList: 'Ostatnie treningi',
    remove: (what: string) => `Usuń odniesienie: ${what}`,
    session: 'Trening',
    assignment: 'Zalecenie',
    ended: 'Współpraca zakończona — rozmowę można już tylko przeczytać.',
    later: 'Brak sieci — wiadomość pójdzie, gdy wróci.',
    gone: 'Współpraca się zakończyła — wiadomość nie poszła.',
  },
  en: {
    lead: (name: string, prof: string) => `Conversation with: ${name} · ${prof.toLowerCase()}`,
    e2e: 'End-to-end encrypted: only the two of you can read it, the server in between sees ciphertext.',
    empty: 'Nothing here yet. Write if you have a question or want to say how it’s going — your coach will read it in Sztab.',
    log: 'Conversation',
    you: 'You',
    today: 'Today',
    yesterday: 'Yesterday',
    waiting: 'waiting for network',
    notSent: 'not sent — the collaboration ended',
    read: 'Read',
    label: (name: string) => `Message to: ${name}`,
    placeholder: 'Write a message…',
    send: 'Send',
    counter: (n: number, max: number) => `${n} / ${max} characters`,
    attach: 'Attach a workout',
    attachList: 'Recent workouts',
    remove: (what: string) => `Remove reference: ${what}`,
    session: 'Workout',
    assignment: 'Advice',
    ended: 'The collaboration has ended — the conversation is read-only now.',
    later: 'No network — the message goes out when it’s back.',
    gone: 'The collaboration has ended — the message was not sent.',
  },
});

/** Jak często otwarta rozmowa pyta o nowe (tylko na widocznej karcie). */
export const POLL_MS = 20_000;

const visible = () => document.visibilityState === 'visible';

const timeText = (ms: number) => new Date(ms).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });

function dayTitle(day: string, today: string): string {
  if (day === today) return T.today;
  if (day === addDays(today, -1)) return T.yesterday;
  const d = new Date(`${day}T12:00:00`);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Odniesienie słowami: „Trening: Góra A · 24 lis”. */
function refText(r: MessageRef): string {
  if (r.kind === 'session') {
    const at = Date.parse(r.at);
    return `${T.session}: ${r.label || T.session}${Number.isNaN(at) ? '' : ` · ${shortDate(at)}`}`;
  }
  return `${T.assignment}: ${r.label || T.assignment}`;
}

function RefChip({ r, s }: { r: MessageRef; s: LinkState }) {
  const label = refText(r);
  // Zalecenie, które jest na tym telefonie (i nie wycofane), otwiera się stuknięciem.
  if (r.kind === 'assignment' && s.assignments.some((a) => a.id === r.id && !a.withdrawn)) {
    return (
      <a className="lk-chat-ref" href={linkAssignmentPath(r.id)}>
        {label}
      </a>
    );
  }
  return <span className="lk-chat-ref">{label}</span>;
}

/**
 * Rozmowa z prowadzącym (`#/wspolpraca/<id>/wiadomosci`). Wiadomości odszyfrowuje `link/sync.ts`;
 * tu tylko je pokazujemy, oznaczamy jako przeczytane i co 20 s pytamy o nowe, póki karta jest
 * widoczna. Nasza wiadomość trafia na ekran od razu, a bez sieci czeka („czeka na sieć”).
 */
export function ChatPage({ id, state, onToast }: { id: string; state: AppState; onToast: (m: string) => void }) {
  const s = useLink();
  const c = connectionOf(s, id);
  const active = c?.status === 'active';
  const list = useMemo(() => messagesOf(s, id), [s, id]);
  const unread = active ? unreadMessages(s, id).length : 0;

  // Pobieranie co 20 s, tylko na widocznej karcie; powrót na kartę — od razu, i wtedy też „przeczytane”.
  useEffect(() => {
    if (!active) return;
    let busy = false;
    const tick = () => {
      if (busy || !visible()) return;
      busy = true;
      void refreshMessages(id).finally(() => {
        busy = false;
      });
    };
    const onVisibility = () => {
      if (!visible()) return;
      tick();
      if (unreadMessages(linkState(), id).length) void markMessagesRead(id);
    };
    tick();
    const t = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [id, active]);

  // Otwarta rozmowa czyta to, co przyszło — przy wejściu i przy każdej nowej wiadomości prowadzącego.
  useEffect(() => {
    if (unread && visible()) void markMessagesRead(id);
  }, [id, unread]);

  // Na dół przy wejściu; potem tylko, gdy ktoś był na dole albo sam właśnie napisał.
  const atBottom = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      const el = document.scrollingElement ?? document.documentElement;
      atBottom.current = el.scrollHeight - el.scrollTop - window.innerHeight < 160;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const lastId = list.at(-1)?.id;
  const lastMine = list.at(-1)?.author === 'client';
  useLayoutEffect(() => {
    if (!atBottom.current && !lastMine) return;
    const el = document.scrollingElement ?? document.documentElement;
    el.scrollTop = el.scrollHeight;
  }, [lastId, lastMine]);

  if (!c) {
    return (
      <div className="wrap">
        <p className="lead">{LT.notFound}</p>
      </div>
    );
  }

  const today = localDay();
  const readId = lastReadId(list, c.readUpTo);
  const groups = byDay(list, whenOf);
  const coach = c.coach.name;

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead(coach, W.profession[c.coach.profession])}</p>
      </div>
      <div className="grp lk-chat">
        {/* Pole „log” stoi od początku, także puste — czytnik ekranu ogłosi pierwszą wiadomość. */}
        <div className="lk-chat-log" role="log" aria-label={T.log}>
          {list.length ? (
            groups.map((g) => (
              <section key={g.day} className="lk-chat-day" aria-label={dayTitle(g.day, today)}>
                <h3 className="lk-chat-daytitle" aria-hidden="true">
                  <span>{dayTitle(g.day, today)}</span>
                </h3>
                {g.items.map((m) => (
                  <Bubble key={m.id} m={m} s={s} coach={coach} ended={!active} read={m.id === readId} />
                ))}
              </section>
            ))
          ) : (
            <p className="lk-chat-empty">{active ? T.empty : T.ended}</p>
          )}
        </div>
        {active ? <Composer id={id} coach={coach} state={state} onToast={onToast} /> : list.length ? <p className="lk-chat-note">{T.ended}</p> : null}
        <p className="hint lk-chat-e2e">{T.e2e}</p>
      </div>
    </>
  );
}

function Bubble({ m, s, coach, ended, read }: { m: StoredMessage; s: LinkState; coach: string; ended: boolean; read: boolean }) {
  const mine = m.author === 'client';
  const waiting = mine && m.serverAt === null;
  return (
    <>
      <div className={`lk-chat-msg ${mine ? 'mine' : 'theirs'}${waiting ? ' waiting' : ''}`}>
        <span className="sr-only">{mine ? T.you : coach}: </span>
        {m.ref ? <RefChip r={m.ref} s={s} /> : null}
        <p className="lk-chat-text">{m.text}</p>
        <p className="lk-chat-meta">
          <time dateTime={new Date(whenOf(m)).toISOString()}>{timeText(whenOf(m))}</time>
          {waiting ? <span className="lk-chat-wait"> · {ended ? T.notSent : T.waiting}</span> : null}
        </p>
      </div>
      {read ? <p className="lk-chat-read">{T.read}</p> : null}
    </>
  );
}

function Composer({ id, coach, state, onToast }: { id: string; coach: string; state: AppState; onToast: (m: string) => void }) {
  const [draft, setDraft] = useState('');
  const [ref, setRef] = useState<Extract<MessageRef, { kind: 'session' }> | null>(null);
  const [picking, setPicking] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const sessions = useMemo(() => recentSessions(state.log, 10), [state.log]);

  // Pole rośnie z tekstem (do ok. ośmiu linijek), potem przewija się samo.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [draft]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    setDraft('');
    setRef(null);
    setPicking(false);
    void sendMessage(id, clean, ref).then((r) => {
      if (r === 'later') onToast(T.later);
      else if (r === 'gone') onToast(T.gone);
    });
  };

  return (
    <form className="lk-chat-compose" onSubmit={submit}>
      {ref ? (
        <p className="lk-chat-attached">
          <span className="lk-chat-ref">{refText(ref)}</span>
          <button type="button" className="lk-chat-x" aria-label={T.remove(refText(ref))} onClick={() => setRef(null)}>
            ×
          </button>
        </p>
      ) : null}
      <label className="sr-only" htmlFor="lk-chat-input">
        {T.label(coach)}
      </label>
      <textarea
        id="lk-chat-input"
        ref={area}
        className="lk-chat-input"
        rows={2}
        maxLength={MESSAGE_MAX}
        placeholder={T.placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-describedby={nearLimit(draft) ? 'lk-chat-count' : undefined}
      />
      {nearLimit(draft) ? (
        <p id="lk-chat-count" className="lk-chat-count" aria-live="polite">
          {T.counter(draft.length, MESSAGE_MAX)}
        </p>
      ) : null}
      <div className="btnrow lk-chat-actions">
        {sessions.length && !ref ? (
          <button type="button" className="btn ghost sm" aria-expanded={picking} aria-controls="lk-chat-sessions" onClick={() => setPicking((p) => !p)}>
            {T.attach}
          </button>
        ) : null}
        <button type="submit" className="btn sm lk-chat-send" disabled={!draft.trim()}>
          {T.send}
        </button>
      </div>
      {picking && !ref ? (
        <ul id="lk-chat-sessions" className="lk-chat-sessions" aria-label={T.attachList}>
          {sessions.map((x) => (
            <li key={x.at}>
              <button
                type="button"
                onClick={() => {
                  setRef(x);
                  setPicking(false);
                  area.current?.focus();
                }}
              >
                <span>{x.label || T.session}</span>
                <span className="lk-chat-when">{shortDate(Date.parse(x.at))}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
