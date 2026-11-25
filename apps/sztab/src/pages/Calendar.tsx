import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { shortPseudonym } from '@gymtracker/link';
import type { Profession } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import { Dialog, Failure, Loading, toast, useLoad } from '../components/ui';
import { loadAliases } from '../lib/aliases';
import type { Aliases } from '../lib/aliases';
import {
  DURATIONS,
  EXPORT_DAYS,
  MAX_CAPACITY,
  MAX_MINUTES,
  MAX_NOTE,
  MAX_PLACE,
  MAX_TITLE,
  MAX_WEEKS,
  MIN_MINUTES,
  activeBookings,
  addDays,
  defaultStart,
  draftProblems,
  draftRows,
  icsFileName,
  slotsIcs,
  startOfWeek,
  timeKey,
  videoLink,
  weekGrid,
} from '../lib/calendar';
import type { DraftProblem, SlotDraft } from '../lib/calendar';
import { bookClient, cancelBooking, cancelSlot, createSlots, listBookings, listConnections, listSlots } from '../lib/data';
import type { BookingRow, Connection, SlotRow } from '../lib/data';
import { useReady } from '../session';
import './calendar.css';

/**
 * Kalendarz wizyt prowadzącego (`/kalendarz`): tydzień od poniedziałku (na wąskim ekranie lista
 * dni), terminy z zajętymi miejscami, szczegóły terminu z zapisanymi, zapis podopiecznego przez
 * prowadzącego, odwołanie rezerwacji albo całego terminu, nowy termin (także co tydzień) i plik .ics.
 *
 * Godziny, tytuły i miejsca leżą w bazie jawnie (nie są danymi o zdrowiu) i widzą je wszyscy
 * podopieczni przy wolnych terminach — formularz o tym mówi. Kto jest kim, zostaje w przeglądarce:
 * przy rezerwacjach numer i prywatny skrót z `aliases.ts`.
 */

const T = text({
  pl: {
    title: 'Kalendarz',
    lead: 'Twoje terminy i wizyty. Podopieczni widzą wolne terminy w GYM TRACKERze na 60 dni naprzód i sami rezerwują albo odwołują.',
    add: 'Nowy termin',
    prev: 'Poprzedni tydzień',
    next: 'Następny tydzień',
    today: 'Dziś',
    weekNav: 'Wybór tygodnia',
    week: (range: string) => `Tydzień: ${range}`,
    addOn: (day: string) => `Nowy termin: ${day}`,
    emptyWeek: 'W tym tygodniu nie masz terminów. Dodaj pierwszy przyciskiem „Nowy termin” albo „+” przy dniu.',
    seats: (used: number, cap: number) => `zajęte ${used} z ${cap}`,
    video: 'rozmowa wideo',
    cancelledShort: 'odwołany',
    unknown: 'podopieczny spoza listy',
    // Szczegóły terminu
    when: 'Kiedy',
    minutes: (n: number) => `${n} min`,
    place: 'Miejsce',
    videoLink: 'Link do rozmowy',
    openVideo: 'Otwórz link do rozmowy',
    note: 'Notatka',
    booked: (n: number, cap: number) => `Zapisani: ${n} z ${cap}`,
    nobody: 'Nikt się jeszcze nie zapisał.',
    overLimit: (n: number) => `ponad limit o ${n}`,
    cancelBooking: 'Odwołaj',
    cancelBookingQ: (who: string) => `Odwołać rezerwację: ${who}?`,
    cancelBookingText: 'Podopieczny zobaczy w GYM TRACKERze, że wizytę odwołał prowadzący.',
    cancelBookingYes: 'Tak, odwołaj',
    no: 'Nie',
    bookingCancelled: 'Rezerwacja odwołana',
    gone: 'Odwołane rezerwacje',
    goneBy: { client: 'odwołał podopieczny', coach: 'odwołałeś ty' },
    signUp: 'Zapisz podopiecznego',
    pick: 'Podopieczny',
    pickNone: 'Wybierz z listy',
    signUpBtn: 'Zapisz',
    signedUp: 'Podopieczny zapisany',
    fullHint: 'Termin jest pełny — zapiszesz ponad limit miejsc. Telefon nie pozwoli na to podopiecznym, tobie tak.',
    noCandidates: 'Wszyscy trwający podopieczni są już zapisani albo nie masz jeszcze podopiecznych.',
    already: 'Ten podopieczny jest już zapisany na ten termin.',
    actionFailed: 'Nie udało się. Sprawdź połączenie i spróbuj jeszcze raz.',
    cancelSlot: 'Odwołaj termin',
    cancelSlotQ: 'Odwołać cały termin?',
    cancelSlotText: (n: number) =>
      n
        ? `Zapisani (${n}) zobaczą w GYM TRACKERze, że wizytę odwołał prowadzący. Termin zniknie z wolnych, a przywrócić go się nie da — najwyżej dodać nowy.`
        : 'Termin zniknie z wolnych terminów u podopiecznych. Przywrócić go się nie da — najwyżej dodać nowy.',
    cancelSlotYes: 'Tak, odwołaj termin',
    slotCancelled: 'Termin odwołany',
    cancelledAt: (d: string) => `Odwołany ${d}. Zapisani widzą wizytę jako odwołaną przez prowadzącego.`,
    started: 'Ten termin już się zaczął albo minął — zapisów i odwołań się tu nie zmienia.',
    // Nowy termin
    newTitle: 'Nowy termin',
    date: 'Data',
    start: 'Początek',
    length: 'Długość (minuty)',
    lengthPresets: 'Szybki wybór długości',
    titleLabel: 'Tytuł',
    titleHint: 'Widzą go wszyscy twoi podopieczni przy wolnych terminach. Bez nazwisk i danych o zdrowiu.',
    capacity: 'Liczba miejsc',
    capacityHint: 'Więcej niż jedno — zajęcia w małej grupie.',
    placeLabel: 'Miejsce albo link do rozmowy (opcjonalnie)',
    placeHint: 'Adres sali, np. „Studio, ul. Długa 5”, albo link https:// do rozmowy wideo — podopieczny dostanie przycisk „Dołącz do rozmowy”.',
    noteLabel: 'Notatka dla podopiecznych (opcjonalnie)',
    noteHint: 'Np. „Weź ręcznik i wygodne buty”. Widzą ją wszyscy przy wolnych terminach — bez danych o zdrowiu.',
    repeat: 'Powtarzaj co tydzień',
    weeks: 'Przez ile tygodni (2–12)',
    preview: (dates: string, time: string) => `Terminy: ${dates} — zawsze o ${time}.`,
    create: (n: number) => (n > 1 ? `Dodaj ${n} terminy` : 'Dodaj termin'),
    created: (n: number) => (n > 1 ? `Dodano terminy: ${n}` : 'Termin dodany'),
    createFailed: 'Nie udało się zapisać terminu. Sprawdź połączenie i spróbuj jeszcze raz.',
    problem: {
      date: 'Podaj datę.',
      time: 'Podaj godzinę początku.',
      past: 'Ten termin już minął — wybierz późniejszą datę albo godzinę.',
      minutes: `Długość od ${MIN_MINUTES} minut do 12 godzin (${MAX_MINUTES} minut).`,
      title: `Tytuł jest potrzebny, najwyżej ${MAX_TITLE} znaków.`,
      capacity: `Liczba miejsc od 1 do ${MAX_CAPACITY}.`,
      place: `Miejsce może mieć najwyżej ${MAX_PLACE} znaków.`,
      link: 'Link do rozmowy musi być pełnym adresem zaczynającym się od https://.',
      note: `Notatka może mieć najwyżej ${MAX_NOTE} znaków.`,
      weeks: `Powtarzanie: od 2 do ${MAX_WEEKS} tygodni.`,
    } as Record<DraftProblem, string>,
    defaultTitle: {
      trainer: 'Trening personalny',
      dietitian: 'Konsultacja dietetyczna',
      physio: 'Wizyta fizjoterapeutyczna',
      doctor: 'Konsultacja',
      other: 'Konsultacja',
    } as Record<Profession, string>,
    // Plik .ics
    icsTitle: 'Plik .ics',
    icsText: `Terminy od teraz na ${Math.round(EXPORT_DAYS / 7)} tygodni, z zapisanymi. Otwórz go w Kalendarzu Apple albo w Outlooku; do Google zaimportujesz go na calendar.google.com (Ustawienia → Importuj i eksportuj). Ponowny import nadpisuje te same terminy, a odwołane oznacza jako odwołane.`,
    icsAliases: 'Dopisz moje skróty przy numerach',
    icsAliasesHint: 'Skróty mogą zawierać imiona. Kalendarz w chmurze (np. Google) je zobaczy — bez zaznaczenia plik ma same numery.',
    icsBtn: 'Pobierz .ics',
    icsName: 'Wizyty — GYM TRACKER Sztab',
    icsEmpty: 'Na najbliższe tygodnie nie masz terminów — plik byłby pusty.',
    icsSaved: (n: number) => `Plik gotowy: terminy ${n}.`,
  },
  en: {
    title: 'Calendar',
    lead: 'Your time slots and appointments. Clients see free slots in GYM TRACKER up to 60 days ahead and book or cancel them themselves.',
    add: 'New slot',
    prev: 'Previous week',
    next: 'Next week',
    today: 'Today',
    weekNav: 'Choose a week',
    week: (range: string) => `Week: ${range}`,
    addOn: (day: string) => `New slot: ${day}`,
    emptyWeek: 'No slots this week. Add the first one with “New slot” or the “+” next to a day.',
    seats: (used: number, cap: number) => `${used} of ${cap} taken`,
    video: 'video call',
    cancelledShort: 'cancelled',
    unknown: 'client not on your list',
    when: 'When',
    minutes: (n: number) => `${n} min`,
    place: 'Place',
    videoLink: 'Call link',
    openVideo: 'Open the call link',
    note: 'Note',
    booked: (n: number, cap: number) => `Booked: ${n} of ${cap}`,
    nobody: 'Nobody has booked yet.',
    overLimit: (n: number) => `${n} over the limit`,
    cancelBooking: 'Cancel',
    cancelBookingQ: (who: string) => `Cancel the booking: ${who}?`,
    cancelBookingText: 'The client will see in GYM TRACKER that the coach cancelled the appointment.',
    cancelBookingYes: 'Yes, cancel',
    no: 'No',
    bookingCancelled: 'Booking cancelled',
    gone: 'Cancelled bookings',
    goneBy: { client: 'cancelled by the client', coach: 'cancelled by you' },
    signUp: 'Book a client',
    pick: 'Client',
    pickNone: 'Pick from the list',
    signUpBtn: 'Book',
    signedUp: 'Client booked',
    fullHint: 'This slot is full — you’ll book over the limit. Clients can’t do that from the phone; you can.',
    noCandidates: 'All active clients are already booked, or you have no clients yet.',
    already: 'This client is already booked for this slot.',
    actionFailed: 'That didn’t work. Check your connection and try again.',
    cancelSlot: 'Cancel slot',
    cancelSlotQ: 'Cancel the whole slot?',
    cancelSlotText: (n: number) =>
      n
        ? `Booked clients (${n}) will see in GYM TRACKER that the coach cancelled the appointment. The slot leaves the free list and can’t be restored — only added again.`
        : 'The slot leaves the clients’ free list. It can’t be restored — only added again.',
    cancelSlotYes: 'Yes, cancel the slot',
    slotCancelled: 'Slot cancelled',
    cancelledAt: (d: string) => `Cancelled ${d}. Booked clients see it as cancelled by the coach.`,
    started: 'This slot has started or is over — bookings can’t be changed here.',
    newTitle: 'New slot',
    date: 'Date',
    start: 'Start',
    length: 'Length (minutes)',
    lengthPresets: 'Quick length choice',
    titleLabel: 'Title',
    titleHint: 'All your clients see it next to free slots. No names and no health data.',
    capacity: 'Seats',
    capacityHint: 'More than one — a small group session.',
    placeLabel: 'Place or call link (optional)',
    placeHint: 'A gym address, e.g. “Studio, 5 Long St”, or an https:// video call link — the client gets a “Join the call” button.',
    noteLabel: 'Note for clients (optional)',
    noteHint: 'E.g. “Bring a towel and comfy shoes”. Everyone sees it next to free slots — no health data.',
    repeat: 'Repeat weekly',
    weeks: 'For how many weeks (2–12)',
    preview: (dates: string, time: string) => `Slots: ${dates} — always at ${time}.`,
    create: (n: number) => (n > 1 ? `Add ${n} slots` : 'Add slot'),
    created: (n: number) => (n > 1 ? `Slots added: ${n}` : 'Slot added'),
    createFailed: 'Couldn’t save the slot. Check your connection and try again.',
    problem: {
      date: 'Enter a date.',
      time: 'Enter a start time.',
      past: 'That time has passed — pick a later date or time.',
      minutes: `Length from ${MIN_MINUTES} minutes to 12 hours (${MAX_MINUTES} minutes).`,
      title: `A title is needed, up to ${MAX_TITLE} characters.`,
      capacity: `Seats from 1 to ${MAX_CAPACITY}.`,
      place: `The place can have up to ${MAX_PLACE} characters.`,
      link: 'The call link must be a full address starting with https://.',
      note: `The note can have up to ${MAX_NOTE} characters.`,
      weeks: `Repeat: from 2 to ${MAX_WEEKS} weeks.`,
    } as Record<DraftProblem, string>,
    defaultTitle: {
      trainer: 'Personal training',
      dietitian: 'Dietary consultation',
      physio: 'Physiotherapy visit',
      doctor: 'Consultation',
      other: 'Consultation',
    } as Record<Profession, string>,
    icsTitle: '.ics file',
    icsText: `Slots from now for ${Math.round(EXPORT_DAYS / 7)} weeks, with who’s booked. Open it in Apple Calendar or Outlook; to add it to Google, import it at calendar.google.com (Settings → Import & export). Importing again updates the same slots and marks cancelled ones as cancelled.`,
    icsAliases: 'Add my aliases next to the numbers',
    icsAliasesHint: 'Aliases may contain names. A cloud calendar (e.g. Google) will see them — unticked, the file has numbers only.',
    icsBtn: 'Download .ics',
    icsName: 'Appointments — GYM TRACKER Sztab',
    icsEmpty: 'No slots in the coming weeks — the file would be empty.',
    icsSaved: (n: number) => `File ready: ${n} slots.`,
  },
});

const F = {
  time: new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }),
  dow: new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }),
  dayMonth: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }),
  long: new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }),
  full: new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  range: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }),
  stamp: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
};

const hm = (iso: string): string => F.time.format(new Date(iso));
const span = (s: Pick<SlotRow, 'startsAt' | 'endsAt'>): string => `${hm(s.startsAt)}–${hm(s.endsAt)}`;

/** Kto jest zapisany: krótki numer i — gdy jest — prywatny skrót prowadzącego. */
function whoOf(connections: readonly Connection[], aliases: Aliases, withAlias = true): (connectionId: string) => string {
  const byId = new Map(connections.map((c) => [c.id, c]));
  return (id) => {
    const c = byId.get(id);
    if (!c) return T.unknown;
    const alias = withAlias ? aliases[c.pseudonym] : undefined;
    return alias ? `${shortPseudonym(c.pseudonym)} · ${alias}` : shortPseudonym(c.pseudonym);
  };
}

function download(name: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Calendar() {
  const { coach, user } = useReady();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [openId, setOpenId] = useState<string | null>(null);
  /** Otwarty formularz nowego terminu: dzień (`RRRR-MM-DD`), `''` — bez wybranego dnia, `null` — zamknięty. */
  const [newOn, setNewOn] = useState<string | null>(null);
  const aliases = useMemo(() => loadAliases(user.id), [user.id]);
  const weekMs = week.getTime();
  const load = useLoad(async () => {
    const [slots, connections] = await Promise.all([listSlots(week, addDays(week, 7)), listConnections()]);
    return { weekMs, slots, connections, bookings: await listBookings(slots.map((s) => s.id)) };
    // `week` i `weekMs` to ta sama chwila.
  }, [weekMs]);
  // Dane poprzedniego tygodnia nie udają nowego, zanim ten się wczyta.
  const data = load.data?.weekMs === weekMs ? load.data : undefined;
  const now = new Date();
  const days = weekGrid(week, data?.slots ?? [], now);
  const thisWeek = startOfWeek(now).getTime() === weekMs;
  const open = data?.slots.find((s) => s.id === openId) ?? null;
  const who = useMemo(() => whoOf(data?.connections ?? [], aliases), [data, aliases]);
  const range = F.range.formatRange(week, addDays(week, 6));
  const closeSlot = useCallback(() => setOpenId(null), []);
  const closeNew = useCallback(() => setNewOn(null), []);
  const reload = load.reload;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{T.title}</h1>
          <p className="lead">{T.lead}</p>
        </div>
        <button type="button" className="btn blue" onClick={() => setNewOn('')}>
          {T.add}
        </button>
      </div>

      <section className="card sz-cal" aria-labelledby="sz-cal-range">
        <div className="sz-cal-bar">
          <div className="row" role="group" aria-label={T.weekNav}>
            <button type="button" className="btn ghost small" onClick={() => setWeek(addDays(week, -7))} aria-label={T.prev}>
              <span aria-hidden="true">‹</span>
              <span className="sz-cal-navword">{T.prev}</span>
            </button>
            <button type="button" className="btn ghost small" onClick={() => setWeek(startOfWeek(new Date()))} disabled={thisWeek}>
              {T.today}
            </button>
            <button type="button" className="btn ghost small" onClick={() => setWeek(addDays(week, 7))} aria-label={T.next}>
              <span className="sz-cal-navword">{T.next}</span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <h2 id="sz-cal-range" className="sz-cal-range" aria-live="polite">
            <span className="sr">{T.week(range)}</span>
            <span aria-hidden="true">{range}</span>
          </h2>
        </div>
        {load.error ? <Failure error={T.actionFailed} retry={reload} /> : null}
        {!data && !load.error ? <Loading /> : null}
        {data && !data.slots.length ? <p className="note">{T.emptyWeek}</p> : null}
        {data ? (
          <ol className="sz-cal-week">
            {days.map((d) => (
              <li key={d.key} className={`sz-cal-day${d.today ? ' is-today' : ''}${d.past ? ' is-past' : ''}${d.slots.length ? '' : ' is-empty'}`}>
                <div className="sz-cal-dayhead">
                  <h3>
                    <span className="sz-cal-dow">{F.dow.format(d.date)}</span> <span className="sz-cal-date">{F.dayMonth.format(d.date)}</span>
                  </h3>
                  {!d.past ? (
                    <button type="button" className="sz-cal-add" aria-label={T.addOn(F.long.format(d.date))} onClick={() => setNewOn(d.key)}>
                      <span aria-hidden="true">+</span>
                    </button>
                  ) : null}
                </div>
                {d.slots.length ? (
                  <ul className="sz-cal-slots">
                    {d.slots.map((s) => (
                      <li key={s.id}>
                        <SlotCard slot={s} used={activeBookings(s.id, data.bookings).length} now={now} onOpen={() => setOpenId(s.id)} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <IcsExport aliases={aliases} />

      {open && data ? (
        <SlotDialog
          key={open.id}
          slot={open}
          bookings={data.bookings.filter((b) => b.slotId === open.id)}
          connections={data.connections}
          who={who}
          onClose={closeSlot}
          onChanged={reload}
        />
      ) : null}
      {newOn !== null ? (
        <NewSlotDialog
          day={newOn || null}
          profession={coach.profession}
          coachId={coach.id}
          onClose={closeNew}
          onCreated={(first) => {
            setNewOn(null);
            const target = startOfWeek(first);
            if (target.getTime() === weekMs) reload();
            else setWeek(target);
          }}
        />
      ) : null}
    </>
  );
}

function SlotCard({ slot, used, now, onOpen }: { slot: SlotRow; used: number; now: Date; onOpen: () => void }) {
  const cancelled = !!slot.cancelledAt;
  const ended = Date.parse(slot.endsAt) <= now.getTime();
  const link = videoLink(slot.place);
  const cls = ['sz-cal-slot', cancelled ? 'is-cancelled' : '', ended ? 'is-ended' : '', !cancelled && used >= slot.capacity ? 'is-full' : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} onClick={onOpen} aria-haspopup="dialog">
      <span className="sz-cal-time">{span(slot)}</span>
      <span className="sz-cal-title">{slot.title}</span>
      <span className="sz-cal-meta">
        <span className="sz-cal-seats">
          <span aria-hidden="true">
            {used}/{slot.capacity}
          </span>
          <span className="sr">{T.seats(used, slot.capacity)}</span>
        </span>
        {cancelled ? (
          <span className="sz-cal-flag">{T.cancelledShort}</span>
        ) : link ? (
          <span className="sz-cal-place">{T.video}</span>
        ) : slot.place ? (
          <span className="sz-cal-place">{slot.place}</span>
        ) : null}
      </span>
    </button>
  );
}

/* ── Szczegóły terminu ─────────────────────────────────────────────────────────────── */

function SlotDialog({
  slot,
  bookings,
  connections,
  who,
  onClose,
  onChanged,
}: {
  slot: SlotRow;
  bookings: BookingRow[];
  connections: Connection[];
  who: (connectionId: string) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Klucz z sejfu otwiera pieczęć tokenu powiadomień — czytaną świeżo przy każdym zapisie i odwołaniu.
  const { key } = useReady();
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const [askSlot, setAskSlot] = useState(false);
  const [askBooking, setAskBooking] = useState<string | null>(null);
  const active = bookings.filter((b) => !b.cancelledAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const gone = bookings.filter((b) => b.cancelledAt).sort((a, b) => (b.cancelledAt ?? '').localeCompare(a.cancelledAt ?? ''));
  const cancelled = !!slot.cancelledAt;
  const started = Date.parse(slot.startsAt) <= Date.now();
  const editable = !cancelled && !started;
  const candidates = connections.filter((c) => c.status === 'active' && !active.some((b) => b.connectionId === c.id));
  const full = active.length >= slot.capacity;
  const link = videoLink(slot.place);
  const minutes = Math.round((Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000);

  const run = async (f: () => Promise<unknown>, done: string, mapErr?: (e: unknown) => string | null) => {
    setBusy(true);
    setErr(null);
    try {
      await f();
      toast(done);
      setAskSlot(false);
      setAskBooking(null);
      setPick('');
      onChanged();
    } catch (e) {
      setErr(mapErr?.(e) ?? T.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = (e: unknown) => (e instanceof Error && /bookings_one_active|duplicate key/.test(e.message) ? T.already : null);

  return (
    <Dialog title={slot.title} onClose={onClose}>
      <dl className="sz-cal-facts">
        <div>
          <dt>{T.when}</dt>
          <dd>
            {F.full.format(new Date(slot.startsAt))}, {span(slot)} ({T.minutes(minutes)})
          </dd>
        </div>
        {link ? (
          <div>
            <dt>{T.videoLink}</dt>
            <dd>
              <a href={link} target="_blank" rel="noopener noreferrer" className="sz-cal-link">
                {T.openVideo}
              </a>
              <span className="soft small sz-cal-url">{link}</span>
            </dd>
          </div>
        ) : slot.place ? (
          <div>
            <dt>{T.place}</dt>
            <dd>{slot.place}</dd>
          </div>
        ) : null}
        {slot.note ? (
          <div>
            <dt>{T.note}</dt>
            <dd className="sz-cal-note">{slot.note}</dd>
          </div>
        ) : null}
      </dl>
      {cancelled ? <p className="note warn">{T.cancelledAt(F.stamp.format(new Date(slot.cancelledAt!)))}</p> : null}
      {!cancelled && started ? <p className="note">{T.started}</p> : null}

      <section className="stack" aria-labelledby="sz-cal-booked">
        <h3 id="sz-cal-booked">
          {T.booked(active.length, slot.capacity)}
          {active.length > slot.capacity ? <span className="chip warn sz-cal-over">{T.overLimit(active.length - slot.capacity)}</span> : null}
        </h3>
        {!active.length ? <p className="soft small">{T.nobody}</p> : null}
        {active.length ? (
          <ul className="sz-cal-people">
            {active.map((b) => (
              <li key={b.id}>
                {askBooking === b.id ? (
                  <div className="sz-cal-ask" role="group" aria-label={T.cancelBookingQ(who(b.connectionId))}>
                    <p>
                      <strong>{T.cancelBookingQ(who(b.connectionId))}</strong> {T.cancelBookingText}
                    </p>
                    <div className="row">
                      <button type="button" className="btn danger small" disabled={busy} onClick={() => void run(() => cancelBooking(key, b), T.bookingCancelled)}>
                        {T.cancelBookingYes}
                      </button>
                      <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAskBooking(null)}>
                        {T.no}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="row between">
                    <span className="sz-cal-who">{who(b.connectionId)}</span>
                    {editable ? (
                      <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAskBooking(b.id)}>
                        {T.cancelBooking}
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {gone.length ? (
          <details className="sz-cal-gone">
            <summary>
              {T.gone} ({gone.length})
            </summary>
            <ul className="sz-cal-people">
              {gone.map((b) => (
                <li key={b.id} className="soft small">
                  {who(b.connectionId)} · {b.cancelledBy ? T.goneBy[b.cancelledBy] : ''} {b.cancelledAt ? F.stamp.format(new Date(b.cancelledAt)) : ''}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {editable ? (
        <form
          className="stack sz-cal-signup"
          onSubmit={(e) => {
            e.preventDefault();
            const c = candidates.find((x) => x.id === pick);
            if (c) void run(() => bookClient(key, slot, c), T.signedUp, duplicate);
          }}
        >
          <h3>{T.signUp}</h3>
          {candidates.length ? (
            <>
              <div className="row sz-cal-signup-row">
                <label className="field">
                  <span>{T.pick}</span>
                  <select id="sz-cal-pick" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">{T.pickNone}</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {who(c.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn blue" disabled={busy || !pick}>
                  {T.signUpBtn}
                </button>
              </div>
              {full ? <p className="small soft">{T.fullHint}</p> : null}
            </>
          ) : (
            <p className="soft small">{T.noCandidates}</p>
          )}
        </form>
      ) : null}

      {err ? (
        <p className="err" role="alert">
          {err}
        </p>
      ) : null}

      {editable ? (
        askSlot ? (
          <div className="sz-cal-ask" role="group" aria-label={T.cancelSlotQ}>
            <p>
              <strong>{T.cancelSlotQ}</strong> {T.cancelSlotText(active.length)}
            </p>
            <div className="row">
              <button type="button" className="btn danger" disabled={busy} onClick={() => void run(() => cancelSlot(key, slot.id), T.slotCancelled)}>
                {T.cancelSlotYes}
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setAskSlot(false)}>
                {T.no}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button type="button" className="btn danger small" disabled={busy} onClick={() => setAskSlot(true)}>
              {T.cancelSlot}
            </button>
          </div>
        )
      ) : null}
    </Dialog>
  );
}

/* ── Nowy termin ───────────────────────────────────────────────────────────────────── */

const FIELD_PROBLEMS: Record<string, DraftProblem[]> = {
  date: ['date', 'past'],
  time: ['time'],
  minutes: ['minutes'],
  title: ['title'],
  capacity: ['capacity'],
  place: ['place', 'link'],
  note: ['note'],
  weeks: ['weeks'],
};

/** Pole formularza: etykieta, kontrolka, podpowiedź i błąd pod spodem — nazwa pola to sama etykieta. */
function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error: ReactNode; children: ReactNode }) {
  return (
    <div className="field sz-cal-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error}
    </div>
  );
}

function NewSlotDialog({
  day,
  profession,
  coachId,
  onClose,
  onCreated,
}: {
  day: string | null;
  profession: Profession;
  coachId: string;
  onClose: () => void;
  onCreated: (first: Date) => void;
}) {
  const [d, setD] = useState<SlotDraft>(() => ({
    ...defaultStart(day, new Date()),
    minutes: 60,
    title: T.defaultTitle[profession],
    capacity: 1,
    place: '',
    note: '',
    repeat: false,
    weeks: 4,
  }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const problems = draftProblems(d, new Date());
  const rows = problems.length ? [] : draftRows(d);
  const set = <K extends keyof SlotDraft>(k: K, v: SlotDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: number): number | '' => (Number.isFinite(v) ? v : '');

  /** Komunikat pola, gdy formularz już raz wysłano — z `aria-describedby`. */
  const problemOf = (field: keyof typeof FIELD_PROBLEMS): DraftProblem | undefined =>
    tried ? FIELD_PROBLEMS[field]!.find((p) => problems.includes(p)) : undefined;
  const fieldProps = (field: keyof typeof FIELD_PROBLEMS, hint?: boolean) => {
    const p = problemOf(field);
    const ids = [hint ? `sz-slot-${field}-hint` : '', p ? `sz-slot-${field}-err` : ''].filter(Boolean).join(' ');
    return { id: `sz-slot-${field}`, 'aria-invalid': p ? true : undefined, 'aria-describedby': ids || undefined };
  };
  const errOf = (field: keyof typeof FIELD_PROBLEMS) => {
    const p = problemOf(field);
    return p ? (
      <span className="err" id={`sz-slot-${field}-err`}>
        {T.problem[p]}
      </span>
    ) : null;
  };

  const submit = async () => {
    setTried(true);
    setErr(null);
    if (problems.length || !rows.length) return;
    setBusy(true);
    try {
      const made = await createSlots(coachId, rows);
      toast(T.created(made.length || rows.length));
      onCreated(rows[0]!.startsAt);
    } catch {
      setErr(T.createFailed);
      setBusy(false);
    }
  };

  return (
    <Dialog title={T.newTitle} onClose={onClose}>
      <form
        className="stack sz-cal-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid cols-2">
          <Field id="sz-slot-date" label={T.date} error={errOf('date')}>
            <input type="date" value={d.date} onChange={(e) => set('date', e.target.value)} {...fieldProps('date')} />
          </Field>
          <Field id="sz-slot-time" label={T.start} error={errOf('time')}>
            <input type="time" step={300} value={d.time} onChange={(e) => set('time', e.target.value)} {...fieldProps('time')} />
          </Field>
        </div>
        <Field id="sz-slot-minutes" label={T.length} error={errOf('minutes')}>
          <div className="row sz-cal-length">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_MINUTES}
              max={MAX_MINUTES}
              step={5}
              value={num(d.minutes)}
              onChange={(e) => set('minutes', e.target.valueAsNumber)}
              {...fieldProps('minutes')}
            />
            <div className="row" role="group" aria-label={T.lengthPresets}>
              {DURATIONS.map((m) => (
                <button key={m} type="button" className="btn ghost small" aria-pressed={d.minutes === m} onClick={() => set('minutes', m)}>
                  {T.minutes(m)}
                </button>
              ))}
            </div>
          </div>
        </Field>
        <Field id="sz-slot-title" label={T.titleLabel} hint={T.titleHint} error={errOf('title')}>
          <input type="text" maxLength={MAX_TITLE} value={d.title} onChange={(e) => set('title', e.target.value)} {...fieldProps('title', true)} />
        </Field>
        <Field id="sz-slot-capacity" label={T.capacity} hint={T.capacityHint} error={errOf('capacity')}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CAPACITY}
            value={num(d.capacity)}
            onChange={(e) => set('capacity', e.target.valueAsNumber)}
            className="sz-cal-narrow"
            {...fieldProps('capacity', true)}
          />
        </Field>
        <Field id="sz-slot-place" label={T.placeLabel} hint={T.placeHint} error={errOf('place')}>
          <input type="text" maxLength={MAX_PLACE} value={d.place} onChange={(e) => set('place', e.target.value)} {...fieldProps('place', true)} />
        </Field>
        <Field id="sz-slot-note" label={T.noteLabel} hint={T.noteHint} error={errOf('note')}>
          <textarea maxLength={MAX_NOTE} rows={2} value={d.note} onChange={(e) => set('note', e.target.value)} {...fieldProps('note', true)} />
        </Field>
        <label className="check">
          <input id="sz-slot-repeat" type="checkbox" checked={d.repeat} onChange={(e) => set('repeat', e.target.checked)} />
          <span>{T.repeat}</span>
        </label>
        {d.repeat ? (
          <Field id="sz-slot-weeks" label={T.weeks} error={errOf('weeks')}>
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={MAX_WEEKS}
              value={num(d.weeks)}
              onChange={(e) => set('weeks', e.target.valueAsNumber)}
              className="sz-cal-narrow"
              {...fieldProps('weeks')}
            />
          </Field>
        ) : null}
        {d.repeat && rows.length > 1 ? (
          <p className="note blue small" aria-live="polite">
            {T.preview(rows.map((r) => F.dayMonth.format(r.startsAt)).join(', '), timeKey(rows[0]!.startsAt))}
          </p>
        ) : null}
        {err ? (
          <p className="err" role="alert">
            {err}
          </p>
        ) : null}
        <button type="submit" className="btn blue" disabled={busy}>
          {T.create(d.repeat && rows.length ? rows.length : 1)}
        </button>
      </form>
    </Dialog>
  );
}

/* ── Plik .ics ─────────────────────────────────────────────────────────────────────── */

function IcsExport({ aliases }: { aliases: Aliases }) {
  const [withAliases, setWithAliases] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const save = async () => {
    setBusy(true);
    setErr(false);
    try {
      const now = new Date();
      const [slots, connections] = await Promise.all([listSlots(now, addDays(now, EXPORT_DAYS)), listConnections()]);
      if (!slots.length) {
        toast(T.icsEmpty);
        return;
      }
      const bookings = await listBookings(slots.map((s) => s.id));
      const ics = slotsIcs(slots, bookings, whoOf(connections, aliases, withAliases), { stamp: now, name: T.icsName });
      download(icsFileName(now), ics);
      toast(T.icsSaved(slots.length));
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card sz-cal-export" aria-labelledby="sz-cal-ics">
      <h2 id="sz-cal-ics">{T.icsTitle}</h2>
      <p className="soft small">{T.icsText}</p>
      <label className="check">
        <input id="sz-cal-ics-aliases" type="checkbox" checked={withAliases} onChange={(e) => setWithAliases(e.target.checked)} />
        <span>
          {T.icsAliases}
          <span className="hint">{T.icsAliasesHint}</span>
        </span>
      </label>
      {err ? (
        <p className="err" role="alert">
          {T.actionFailed}
        </p>
      ) : null}
      <div>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void save()}>
          {T.icsBtn}
        </button>
      </div>
    </section>
  );
}

