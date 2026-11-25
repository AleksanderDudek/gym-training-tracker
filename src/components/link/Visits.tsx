import { useCallback, useEffect, useRef, useState } from 'react';
import { agoText } from '../../deviceStatus';
import { LOCALE, text } from '../../i18n';
import { cancelVisitReminder, scheduleVisitReminder } from '../../link/notify';
import { clientBook, clientCancelBooking, clientSlots, isRpcError } from '../../link/rpc';
import type { Booking, Slot } from '../../link/rpc';
import { connectionOf, linkState, subscribeLink, updateLink, useLink } from '../../link/store';
import type { LinkConnection } from '../../link/store';
import { pullOne } from '../../link/sync';
import { VISIT_LIMIT, freeSeats, plannedCount, slotDays, splitBookings, videoLink } from '../../link/visits';
import { useNow } from '../DeviceStatus';
import { W } from '../Link.words';
import { downloadIcs, visitIcs, visitIcsName } from './visitIcs';
import './visits.css';

/**
 * Wizyty u prowadzącego (`#/wspolpraca/<id>/wizyty`): twoje rezerwacje (nadchodzące, odwołane,
 * ostatnie 14 dni), wolne terminy po dniach z rezerwacją po potwierdzeniu, odwołanie i plik .ics.
 *
 * Przy otwarciu pyta Sztab (`client_slots`) i zapisuje rezerwacje u siebie (`LinkConnection.visits`),
 * więc bez sieci pokazuje ostatnio sprawdzone wizyty, a ekran Dziś przypomina o wizycie w ciągu doby.
 * Wolnych terminów bez sieci nie pokazuje — i tak nie dałoby się ich zarezerwować.
 */

const T = text({
  pl: {
    notFound: 'Nie ma takiej współpracy na tym telefonie.',
    ended: 'Ta współpraca się zakończyła — wizyt u tego prowadzącego już tu nie zarezerwujesz.',
    lead: (name: string, prof: string) => `Wizyty u: ${name} (${prof.toLowerCase()}). Rezerwujesz i odwołujesz tutaj — prowadzący widzi tylko twoje ID.`,
    checking: 'Sprawdzam terminy…',
    checked: (ago: string) => `Sprawdzone: ${ago}.`,
    offline: (ago: string) => `Bez sieci. Wizyty z ostatniego sprawdzenia (${ago}).`,
    offlineNone: 'Bez sieci — nie mam jeszcze zapisanych wizyt.',
    refresh: 'Odśwież',
    yours: 'Twoje wizyty',
    noneYours: 'Nie masz zaplanowanych wizyt.',
    recent: 'Ostatnie 14 dni',
    now: 'Trwa teraz',
    byYou: 'Odwołana przez ciebie',
    byCoach: 'Odwołana przez prowadzącego',
    join: 'Dołącz do rozmowy',
    video: 'Rozmowa wideo',
    addCal: 'Dodaj do kalendarza',
    cancel: 'Odwołaj',
    cancelQ: 'Odwołać tę wizytę?',
    cancelText: 'Prowadzący zobaczy, że ją odwołałeś, a miejsce wróci do wolnych.',
    cancelYes: 'Tak, odwołaj',
    no: 'Nie',
    cancelled: 'Wizyta odwołana.',
    free: 'Wolne terminy',
    freeHint: 'Na 60 dni naprzód.',
    loading: 'Wczytuję wolne terminy…',
    freeOffline: 'Wolne terminy pokażę, gdy wróci sieć.',
    noneFree: 'Prowadzący nie ma teraz wolnych terminów. Zajrzyj później albo napisz do niego.',
    seats: (free: number, cap: number) => (cap === 1 ? 'wolne' : `wolne miejsca: ${free} z ${cap}`),
    full: 'komplet',
    book: 'Zarezerwuj',
    bookQ: 'Zarezerwować ten termin?',
    bookText: (when: string, title: string) => `${when} — ${title}.`,
    bookYes: 'Tak, rezerwuję',
    booked: 'Zarezerwowane. Wizyta jest w „Twoich wizytach”.',
    limit: `Masz już ${VISIT_LIMIT} zaplanowanych wizyt — odwołaj którąś, żeby zarezerwować nową.`,
    icsSaved: 'Plik gotowy — otwórz go, żeby dodać wizytę do kalendarza.',
    errors: {
      slot_full: 'Ktoś był szybszy — termin już zajęty.',
      slot_missing: 'Tego terminu już nie ma — prowadzący go odwołał albo zmienił.',
      slot_past: 'Ten termin już się zaczął — wybierz inny.',
      already_booked: 'Ten termin masz już zarezerwowany.',
      too_many: `Masz już ${VISIT_LIMIT} zaplanowanych wizyt. Odwołaj którąś, żeby zarezerwować nową.`,
      booking_missing: 'Tej wizyty nie da się już odwołać — właśnie się zaczyna albo prowadzący ją odwołał.',
      ended: 'Współpraca się zakończyła — nic się nie zmieniło.',
      offline: 'Brak sieci — nic się nie zmieniło. Spróbuj jeszcze raz.',
      other: 'Coś poszło nie tak po stronie serwera. Spróbuj jeszcze raz za chwilę.',
    } as Record<string, string>,
  },
  en: {
    notFound: 'There’s no such connection on this phone.',
    ended: 'This connection has ended — you can’t book appointments with this coach here any more.',
    lead: (name: string, prof: string) => `Appointments with ${name} (${prof.toLowerCase()}). You book and cancel here — the coach only sees your ID.`,
    checking: 'Checking the slots…',
    checked: (ago: string) => `Checked: ${ago}.`,
    offline: (ago: string) => `Offline. Appointments from the last check (${ago}).`,
    offlineNone: 'Offline — no saved appointments yet.',
    refresh: 'Refresh',
    yours: 'Your appointments',
    noneYours: 'No appointments planned.',
    recent: 'Last 14 days',
    now: 'Happening now',
    byYou: 'Cancelled by you',
    byCoach: 'Cancelled by the coach',
    join: 'Join the call',
    video: 'Video call',
    addCal: 'Add to calendar',
    cancel: 'Cancel',
    cancelQ: 'Cancel this appointment?',
    cancelText: 'Your coach will see that you cancelled, and the seat goes back to the free list.',
    cancelYes: 'Yes, cancel',
    no: 'No',
    cancelled: 'Appointment cancelled.',
    free: 'Free slots',
    freeHint: 'For the next 60 days.',
    loading: 'Loading free slots…',
    freeOffline: 'Free slots will show when you’re back online.',
    noneFree: 'Your coach has no free slots right now. Check later or send them a message.',
    seats: (free: number, cap: number) => (cap === 1 ? 'free' : `free seats: ${free} of ${cap}`),
    full: 'full',
    book: 'Book',
    bookQ: 'Book this slot?',
    bookText: (when: string, title: string) => `${when} — ${title}.`,
    bookYes: 'Yes, book it',
    booked: 'Booked. It’s now in “Your appointments”.',
    limit: `You already have ${VISIT_LIMIT} planned appointments — cancel one to book another.`,
    icsSaved: 'File ready — open it to add the appointment to your calendar.',
    errors: {
      slot_full: 'Someone was quicker — this slot is taken.',
      slot_missing: 'This slot is gone — your coach cancelled or changed it.',
      slot_past: 'This slot has already started — pick another one.',
      already_booked: 'You’ve already booked this slot.',
      too_many: `You already have ${VISIT_LIMIT} planned appointments. Cancel one to book another.`,
      booking_missing: 'This appointment can’t be cancelled any more — it’s starting now or your coach cancelled it.',
      ended: 'The connection has ended — nothing changed.',
      offline: 'No connection — nothing changed. Try again.',
      other: 'Something went wrong on the server. Try again in a moment.',
    } as Record<string, string>,
  },
});

const F = {
  time: new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }),
  day: new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }),
  short: new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'long' }),
};

const span = (x: { startsAt: string; endsAt: string }): string => `${F.time.format(new Date(x.startsAt))}–${F.time.format(new Date(x.endsAt))}`;
const when = (x: { startsAt: string; endsAt: string }): string => `${F.short.format(new Date(x.startsAt))}, ${span(x)}`;

/** `RRRR-MM-DD` (czas telefonu) → „środa, 2 grudnia”. */
const dayTitle = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  return F.day.format(new Date(y!, m! - 1, d!));
};

const errorText = (e: unknown): string => T.errors[isRpcError(e) ? e.code : 'other'] ?? T.errors.other!;

const Note = ({ text: t }: { text: string }) => (
  <div className="wrap">
    <p className="lead">{t}</p>
  </div>
);

type Net = { kind: 'loading' } | { kind: 'ok'; slots: Slot[] } | { kind: 'offline' };
type Ask = { kind: 'book' | 'cancel'; id: string } | null;

export function VisitsPage({ id, onToast }: { id: string; onToast: (m: string) => void }) {
  const s = useLink();
  const c = connectionOf(s, id);
  const now = useNow(subscribeLink);
  const [net, setNet] = useState<Net>({ kind: 'loading' });
  const [checking, setChecking] = useState(true);
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ where: 'book' | 'cancel'; text: string } | null>(null);
  const alive = useRef(true);
  // Tryb ścisły Reacta montuje dwa razy: po ponownym zamontowaniu strona znowu „żyje”.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Pytanie o terminy; rezerwacje idą do zapisu (kopia bez sieci), wolne terminy — tylko na ekran. */
  const refresh = useCallback(async (): Promise<void> => {
    const conn = connectionOf(linkState(), id);
    if (!conn?.token || conn.status !== 'active') return;
    try {
      const r = await clientSlots(conn.id, conn.token);
      updateLink((x) => {
        const mine = x.connections.find((y) => y.id === conn.id);
        if (mine) mine.visits = { at: Date.now(), bookings: r.bookings };
      });
      if (alive.current) setNet({ kind: 'ok', slots: r.slots });
    } catch (e) {
      // Token nie przeszedł: może prowadzący zakończył współpracę — `pullOne` to sprawdzi i zapisze.
      if ((isRpcError(e, 'bad_token') || isRpcError(e, 'ended')) && (await pullOne(conn)) === 'ended') return;
      if (alive.current) setNet({ kind: 'offline' });
    } finally {
      if (alive.current) setChecking(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!c) return <Note text={T.notFound} />;
  if (c.status !== 'active' || !c.token) return <Note text={T.ended} />;

  const bookings = c.visits?.bookings ?? [];
  const { upcoming, past } = splitBookings(bookings, now);
  const full = plannedCount(bookings, now) >= VISIT_LIMIT;
  const days = net.kind === 'ok' ? slotDays(net.slots, bookings, now) : [];

  const act = async (where: 'book' | 'cancel', f: (conn: LinkConnection & { token: string }) => Promise<unknown>, done: string) => {
    const conn = connectionOf(linkState(), id);
    if (!conn?.token) return;
    setBusy(true);
    setError(null);
    try {
      await f(conn as LinkConnection & { token: string });
      onToast(done);
    } catch (e) {
      if (alive.current) setError({ where, text: errorText(e) });
    } finally {
      if (alive.current) {
        setBusy(false);
        setAsk(null);
      }
    }
    // Po rezerwacji i po odmowie (ktoś był szybszy) — świeże miejsca i nasze wizyty.
    if (alive.current) setChecking(true);
    await refresh();
  };
  // Przy włączonych powiadomieniach: przypomnienie 2 godziny przed wizytą z kolejki serwera aplikacji
  // (w tle — rezerwacja i odwołanie nie czekają na nie i nie psują się bez niego).
  const book = (slot: Slot) =>
    act(
      'book',
      async (x) => {
        const booking = await clientBook(x.id, x.token, slot.id);
        void scheduleVisitReminder(x.id, { id: booking, startsAt: slot.startsAt });
      },
      T.booked,
    );
  const cancel = (b: Booking) =>
    act(
      'cancel',
      async (x) => {
        await clientCancelBooking(x.id, x.token, b.id);
        void cancelVisitReminder(x.id, b.id);
      },
      T.cancelled,
    );
  const addToCalendar = (b: Booking) => {
    downloadIcs(visitIcsName(b), visitIcs(b, c.coach.name, new Date()));
    onToast(T.icsSaved);
  };

  const status = checking
    ? T.checking
    : net.kind === 'offline'
      ? c.visits
        ? T.offline(agoText(c.visits.at, now))
        : T.offlineNone
      : c.visits
        ? T.checked(agoText(c.visits.at, now))
        : '';

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead(c.coach.name, W.profession[c.coach.profession])}</p>
        <div className="lk-visit-status">
          <p className="hint" role="status">
            {status}
          </p>
          <button
            className="btn ghost sm"
            onClick={() => {
              setChecking(true);
              void refresh();
            }}
            disabled={checking}
            aria-busy={checking}
          >
            {T.refresh}
          </button>
        </div>
      </div>

      <div className="grp">
        <h2>{T.yours}</h2>
        {error?.where === 'cancel' && (
          <p className="link-error" role="alert">
            {error.text}
          </p>
        )}
        {!upcoming.length && <p className="tight">{T.noneYours}</p>}
        {upcoming.length > 0 && (
          <ul className="lk-visit-list">
            {upcoming.map((b) => {
              const started = Date.parse(b.startsAt) <= now;
              return (
                <li key={b.id} className={`lk-visit-item${b.cancelledAt ? ' is-cancelled' : ''}`}>
                  <p className="lk-visit-when">{when(b)}</p>
                  <p className="lk-visit-title">{b.title}</p>
                  {b.cancelledAt ? (
                    <p className="lk-visit-flag">{b.cancelledBy === 'client' ? T.byYou : T.byCoach}</p>
                  ) : started ? (
                    <p className="lk-visit-flag is-now">{T.now}</p>
                  ) : null}
                  <Place place={b.place} live={!b.cancelledAt} />
                  {b.note && <p className="lk-visit-note">{b.note}</p>}
                  {!b.cancelledAt &&
                    (ask?.kind === 'cancel' && ask.id === b.id ? (
                      <div className="lk-visit-ask" role="group" aria-label={T.cancelQ}>
                        <p>
                          <b>{T.cancelQ}</b> {T.cancelText}
                        </p>
                        <div className="btnrow">
                          <button className="btn sm" disabled={busy} onClick={() => void cancel(b)}>
                            {T.cancelYes}
                          </button>
                          <button className="btn ghost sm" disabled={busy} onClick={() => setAsk(null)}>
                            {T.no}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="btnrow">
                        <button className="btn ghost sm" onClick={() => addToCalendar(b)}>
                          {T.addCal}
                        </button>
                        {!started && (
                          <button className="btn ghost sm" disabled={busy} onClick={() => setAsk({ kind: 'cancel', id: b.id })}>
                            {T.cancel}
                          </button>
                        )}
                      </div>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
        {past.length > 0 && (
          <>
            <h3 className="lk-visit-sub">{T.recent}</h3>
            <ul className="lk-visit-list lk-visit-past">
              {past.map((b) => (
                <li key={b.id} className={`lk-visit-item${b.cancelledAt ? ' is-cancelled' : ''}`}>
                  <p className="lk-visit-when">{when(b)}</p>
                  <p className="lk-visit-title">{b.title}</p>
                  {b.cancelledAt && <p className="lk-visit-flag">{b.cancelledBy === 'client' ? T.byYou : T.byCoach}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="grp">
        <h2>{T.free}</h2>
        <p className="tight">{T.freeHint}</p>
        {error?.where === 'book' && (
          <p className="link-error" role="alert">
            {error.text}
          </p>
        )}
        {full && <p className="hint">{T.limit}</p>}
        {net.kind === 'loading' && <p className="tight">{T.loading}</p>}
        {net.kind === 'offline' && <p className="tight">{T.freeOffline}</p>}
        {net.kind === 'ok' && !days.length && <p className="tight">{T.noneFree}</p>}
        {days.map((d) => (
          <section key={d.day} className="lk-visit-day" aria-labelledby={`lk-visit-day-${d.day}`}>
            <h3 id={`lk-visit-day-${d.day}`}>{dayTitle(d.day)}</h3>
            <ul className="lk-visit-list">
              {d.slots.map((slot) => {
                const seats = freeSeats(slot);
                return (
                  <li key={slot.id} className={`lk-visit-item${seats ? '' : ' is-full'}`}>
                    <div className="lk-visit-row">
                      <span className="lk-visit-time">{span(slot)}</span>
                      <span className="lk-visit-seats">{seats ? T.seats(seats, slot.capacity) : T.full}</span>
                    </div>
                    <p className="lk-visit-title">{slot.title}</p>
                    <Place place={slot.place} live={false} />
                    {slot.note && <p className="lk-visit-note">{slot.note}</p>}
                    {seats > 0 &&
                      (ask?.kind === 'book' && ask.id === slot.id ? (
                        <div className="lk-visit-ask" role="group" aria-label={T.bookQ}>
                          <p>
                            <b>{T.bookQ}</b> {T.bookText(when(slot), slot.title)}
                          </p>
                          <div className="btnrow">
                            <button className="btn sm" disabled={busy} onClick={() => void book(slot)}>
                              {T.bookYes}
                            </button>
                            <button className="btn ghost sm" disabled={busy} onClick={() => setAsk(null)}>
                              {T.no}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="btnrow">
                          <button className="btn sm" disabled={busy || full} onClick={() => setAsk({ kind: 'book', id: slot.id })}>
                            {T.book}
                          </button>
                        </div>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

/** Miejsce wizyty: adres sali albo link do rozmowy — klikalny tylko przy twojej, nieodwołanej wizycie. */
function Place({ place, live }: { place: string | null; live: boolean }) {
  const link = videoLink(place);
  if (link && live)
    return (
      <a className="vidlink" href={link} target="_blank" rel="noopener noreferrer">
        {/* Nazwa serwera przy linku: podmieniony adres (phishing) widać, zanim się kliknie. */}
        {T.join} ({new URL(link).hostname})
      </a>
    );
  if (link) return <p className="lk-visit-place">{T.video}</p>;
  return place ? <p className="lk-visit-place">{place}</p> : null;
}
