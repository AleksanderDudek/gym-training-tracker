import { linkConfigured } from '../link/config';
import { activeConnections, newAssignments, useLink } from '../link/store';
import { formsDue, habitsToday, mealsToday, unreadByConnection } from '../link/today';
import { soonVisit } from '../link/visits';
import { LINK_PATH, go, linkAssignmentPath, linkChatPath, linkVisitsPath } from '../routing';
import { LOCALE, text } from '../i18n';
import { W, assignmentTitle } from './Link.words';

/**
 * Wejścia do współpracy z prowadzącym, w głównej paczce: karta w profilu i w ustawieniach oraz
 * uwaga na ekranie Dziś. Same strony współpracy (i kryptografia) przychodzą leniwie. Bez Sztabu
 * w buildzie nic tu się nie pokazuje.
 */

const T = text({
  pl: {
    title: 'Współpraca z prowadzącym',
    none: 'Trener, dietetyk, fizjoterapeuta albo lekarz może prowadzić cię w GYM TRACKER Sztab. Przysyła link zaproszenia, a ty decydujesz, co widzi — bez konta, bez maila i bez nazwiska.',
    some: (n: number) => (n === 1 ? 'Prowadzi cię jedna osoba.' : `Prowadzą cię ${n} osoby.`),
    who: (name: string, prof: string, areas: string) => `${name} (${prof}) — ${areas}`,
    unread: (n: number) => (n === 1 ? '1 nowe zalecenie.' : `Nowe zalecenia: ${n}.`),
    open: 'Współpraca',
    newFrom: (name: string, what: string) => `Nowe od prowadzącego — ${name}: ${what}`,
    ended: (name: string) => `Współpraca z: ${name} — zakończona przez prowadzącego. Twoich danych już nie widzi.`,
    messages: (name: string, n: number) => (n === 1 ? `Nowa wiadomość od: ${name}` : `Nowe wiadomości od: ${name} (${n})`),
    form: (title: string) => `Czeka na odpowiedź: ${title}`,
    habits: (title: string, done: number, all: number) => `${title} — dziś ${done} z ${all}`,
    meals: (title: string, done: number, all: number) => `${title} — dziś zjedzone ${done} z ${all}`,
    visit: (tomorrow: boolean, time: string, title: string) => `Wizyta ${tomorrow ? 'jutro' : 'dziś'} o ${time} — ${title}`,
  },
  en: {
    title: 'Working with a coach',
    none: 'A trainer, dietitian, physio or doctor can coach you in GYM TRACKER Sztab. They send an invitation link, and you decide what they see — no account, no email, no name.',
    some: (n: number) => (n === 1 ? 'One person is coaching you.' : `${n} people are coaching you.`),
    who: (name: string, prof: string, areas: string) => `${name} (${prof}) — ${areas}`,
    unread: (n: number) => (n === 1 ? '1 new item from your coach.' : `${n} new items from your coaches.`),
    open: 'Open',
    newFrom: (name: string, what: string) => `New from ${name}: ${what}`,
    ended: (name: string) => `${name} has ended working with you. They no longer see your data.`,
    messages: (name: string, n: number) => (n === 1 ? `New message from ${name}` : `${n} new messages from ${name}`),
    form: (title: string) => `Waiting for your answer: ${title}`,
    habits: (title: string, done: number, all: number) => `${title} — ${done} of ${all} today`,
    meals: (title: string, done: number, all: number) => `${title} — ${done} of ${all} meals eaten today`,
    visit: (tomorrow: boolean, time: string, title: string) => `Appointment ${tomorrow ? 'tomorrow' : 'today'} at ${time} — ${title}`,
  },
});

/** Karta w profilu i w ustawieniach. */
export function LinkCard() {
  const s = useLink();
  if (!linkConfigured()) return null;
  const active = activeConnections(s);
  const unread = newAssignments(s).length;
  return (
    <div className="grp">
      <h2>{T.title}</h2>
      {active.length ? (
        <>
          <p className="tight">{T.some(active.length)}</p>
          <ul className="link-list">
            {active.map((c) => (
              <li key={c.id}>{T.who(c.coach.name, W.profession[c.coach.profession], c.areas.map((a) => W.area[a]).join(', '))}</li>
            ))}
          </ul>
          {unread > 0 && <p className="tight">{T.unread(unread)}</p>}
        </>
      ) : (
        <p className="tight">{T.none}</p>
      )}
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go(LINK_PATH)}>
        {T.open}
      </button>
    </div>
  );
}

/**
 * Uwaga na ekranie Dziś — tylko gdy coś czeka: nowe zalecenie, nowa wiadomość, formularz do
 * wypełnienia, nieodhaczone nawyki albo posiłki z dzisiejszego jadłospisu, zakończenie przez
 * prowadzącego. Najwyżej trzy linie, najważniejsze pierwsze.
 */
export function LinkNotice() {
  const s = useLink();
  if (!linkConfigured()) return null;
  const live = new Set(activeConnections(s).map((c) => c.id));
  const fresh = newAssignments(s).find((a) => live.has(a.connectionId));
  const ended = s.connections.find((c) => c.endNotice);
  const coachName = (id: string) => s.connections.find((c) => c.id === id)?.coach.name ?? '';
  const visit = soonVisit(s, Date.now());
  const lines: { href: string; text: string }[] = [
    ...(visit ? [{ href: linkVisitsPath(visit.connection.id), text: T.visit(visit.tomorrow, new Date(visit.booking.startsAt).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }), visit.booking.title) }] : []),
    ...unreadByConnection(s).map((u) => ({ href: linkChatPath(u.connectionId), text: T.messages(coachName(u.connectionId), u.count) })),
    ...formsDue(s).map((f) => ({ href: linkAssignmentPath(f.id), text: T.form(f.a.body.title) })),
    ...habitsToday(s)
      .filter((h) => h.done.length < h.due.length)
      .map((h) => ({ href: linkAssignmentPath(h.x.id), text: T.habits(h.x.a.body.title, h.done.length, h.due.length) })),
    ...mealsToday(s)
      .filter((m) => m.done.length < m.due.length)
      .map((m) => ({ href: linkAssignmentPath(m.x.id), text: T.meals(m.x.a.body.title, m.done.length, m.due.length) })),
  ].slice(0, fresh ? 2 : 3);
  if (!fresh && !ended && !lines.length) return null;
  const coach = fresh ? s.connections.find((c) => c.id === fresh.connectionId) : undefined;
  return (
    <div className="wrap link-notice">
      {fresh && (
        <a className="vidlink" href={linkAssignmentPath(fresh.id)}>
          {T.newFrom(coach?.coach.name ?? fresh.a.from.name, assignmentTitle(fresh.a))}
        </a>
      )}
      {lines.map((l) => (
        <a key={l.href + l.text} className="vidlink" href={l.href}>
          {l.text}
        </a>
      ))}
      {ended && (
        <a className="vidlink dev-late" href={LINK_PATH}>
          {T.ended(ended.coach.name)}
        </a>
      )}
    </div>
  );
}
