import { useMemo, useState } from 'react';
import {
  ALARM_MIN,
  EXPORT_WEEKS,
  TRAIN_TIMES,
  calendarEvents,
  calendarIcs,
  googleLinks,
  icsName,
  trainTimeOf,
  upcoming,
  type CalEvent,
  type CalKind,
} from '../engine/calendar';
import { plural } from '../engine/quips';
import { localDay } from '../engine/reminders';
import { addDays, mondayOf } from '../engine/schedule';
import { deviceTimeZone, pushConfigured } from '../push';
import { LOCALE, pluralEn, text } from '../i18n';
import { dietPath, SETTINGS_PATH } from '../routing';
import type { AppState } from '../types';
import { CT, Mark, dayShort, timeShort, useDietCalendar } from './CalendarCard';

/**
 * Kalendarz (`#/kalendarz`): miesiąc od poniedziałku, lista na dwa tygodnie i eksport. Z Google
 * aplikacja się nie łączy — nie ma konta ani serwera z harmonogramem. Przyciski otwierają
 * wypełniony formularz wydarzenia w Kalendarzu Google, a plik .ics niesie terminy na 12 tygodni
 * do każdego kalendarza. Strona mówi wprost, że po zmianie planu trzeba to zrobić jeszcze raz.
 */

const T = text({
  pl: {
    lead: 'Treningi z planu, zakupy i badania w jednym miejscu. Stuknij dzień, żeby zobaczyć, co w nim jest.',
    prev: 'Poprzedni miesiąc',
    next: 'Następny miesiąc',
    thisMonth: 'Wróć do dziś',
    nothing: 'Nic w tym dniu.',
    legend: 'Znaki w kalendarzu',
    legendItems: {
      planned: 'trening z planu',
      done: 'trening zrobiony',
      missed: 'trening opuszczony',
      shop: 'zakupy',
      lab: 'badanie',
    },
    todayMark: 'dziś',
    soon: 'Najbliższe 14 dni',
    soonEmpty: 'Przez najbliższe dwa tygodnie nic nie jest zaplanowane.',
    noPlan: 'Bez planu kalendarz pokazuje tylko zapisane treningi. Plan rozpisze terminy na konkretne dni.',
    setPlan: 'Ustaw plan',
    noShop: 'Zakupy pojawią się tu, gdy ustawisz, kiedy je robisz — na liście zakupów.',
    shopLink: 'Lista zakupów',
    labLink: 'Badania',
    google: 'Kalendarz Google i inne',
    googleLead:
      'Aplikacja nie łączy się z twoim kontem Google i nic tam nie wysyła. Przycisk otwiera w Kalendarzu Google formularz nowego wydarzenia, już wypełniony — sprawdzasz go i zapisujesz. Przypomni o nim Google, według twoich ustawień powiadomień.',
    trainAt: 'Godzina treningu w kalendarzu',
    add: {
      train: 'Dodaj treningi do Kalendarza Google',
      shop: 'Dodaj zakupy do Kalendarza Google',
      lab: 'Dodaj badanie do Kalendarza Google',
    } as Record<CalKind, string>,
    newTab: '(otwiera się w nowej karcie)',
    nothingToAdd: 'Na razie nie ma czego dodać: ustaw plan treningów albo rytm zakupów.',
    ics: 'Pobierz plik .ics',
    icsSaved: (n: number) => `Plik gotowy: ${n} ${plural(n, ['wydarzenie', 'wydarzenia', 'wydarzeń'])}.`,
    icsEmpty: 'Przez najbliższe 12 tygodni nie ma nic zaplanowanego — plik byłby pusty.',
    honest: 'Kalendarz Google nie widzi zmian na bieżąco. Po zmianie planu, dni treningów albo rytmu zakupów dodaj wydarzenia jeszcze raz, a stare usuń.',
    icsHow: (weeks: number, train: number, shop: number) =>
      `Plik .ics ma ${weeks} tygodni: każdy termin osobno, z przypomnieniem (trening ${train} min przed, zakupy ${shop} min przed, badanie wieczorem dzień przed). Na telefonie otwórz go w Kalendarzu Apple albo w Outlooku. Do Google zaimportujesz go na komputerze: calendar.google.com → Ustawienia → Importuj i eksportuj → Importuj. Ponowny import tego pliku nadpisuje te same terminy.`,
    fallback: 'Gdy formularz Google się nie otworzy albo nie pokaże powtarzania, użyj pliku .ics.',
    push: 'Przypomnienie z aplikacji o zakupach i badaniu kontrolnym włączysz w ustawieniach, w karcie Przypomnienia.',
    pushLink: 'Ustawienia',
    dayLabel: (day: string, what: string) => (what ? `${day}: ${what}` : day),
  },
  en: {
    lead: 'Workouts from your plan, shopping and lab tests in one place. Tap a day to see what’s on it.',
    prev: 'Previous month',
    next: 'Next month',
    thisMonth: 'Back to today',
    nothing: 'Nothing on this day.',
    legend: 'Calendar marks',
    legendItems: {
      planned: 'workout from your plan',
      done: 'workout done',
      missed: 'workout missed',
      shop: 'shopping',
      lab: 'lab test',
    },
    todayMark: 'today',
    soon: 'Next 14 days',
    soonEmpty: 'Nothing is planned for the next two weeks.',
    noPlan: 'Without a plan the calendar only shows workouts you’ve logged. A plan puts deadlines on specific days.',
    setPlan: 'Set up a plan',
    noShop: 'Shopping shows up here once you set when you shop — on the shopping list.',
    shopLink: 'Shopping list',
    labLink: 'Lab results',
    google: 'Google Calendar and others',
    googleLead:
      'The app doesn’t connect to your Google account and sends nothing there. The button opens a new event form in Google Calendar, already filled in — you check it and save it. Google reminds you about it, following your notification settings.',
    trainAt: 'Workout time in the calendar',
    add: {
      train: 'Add workouts to Google Calendar',
      shop: 'Add shopping to Google Calendar',
      lab: 'Add the lab test to Google Calendar',
    },
    newTab: '(opens in a new tab)',
    nothingToAdd: 'There’s nothing to add yet: set up a training plan or a shopping rhythm.',
    ics: 'Download .ics file',
    icsSaved: (n: number) => `File ready: ${n} ${pluralEn(n, 'event', 'events')}.`,
    icsEmpty: 'Nothing is planned for the next 12 weeks — the file would be empty.',
    honest: 'Google Calendar doesn’t see changes as they happen. After you change the plan, the training days or the shopping rhythm, add the events again and delete the old ones.',
    icsHow: (weeks: number, train: number, shop: number) =>
      `The .ics file covers ${weeks} weeks: each date as its own event, with a reminder (workout ${train} min before, shopping ${shop} min before, lab test the evening before). On a phone, open it in Apple Calendar or Outlook. To add it to Google, import it on a computer: calendar.google.com → Settings → Import & export → Import. Importing the file again updates the same dates.`,
    fallback: 'If the Google form doesn’t open or doesn’t show the repeat, use the .ics file.',
    push: 'App reminders for shopping and the follow-up lab test are in Settings, on the Reminders card.',
    pushLink: 'Settings',
    dayLabel: (day: string, what: string) => (what ? `${day}: ${what}` : day),
  },
});

const pad = (n: number): string => String(n).padStart(2, '0');

/** Pierwszy dzień miesiąca: `2026-11-01`. */
const monthOf = (date: string): string => `${date.slice(0, 7)}-01`;

const shiftMonth = (first: string, n: number): string => {
  const [y, m] = first.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
};

const lastOfMonth = (first: string): string => addDays(shiftMonth(first, 1), -1);

const utc = (date: string): Date => new Date(`${date}T12:00:00Z`);
const monthTitle = (first: string): string =>
  new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utc(first));
const dayTitle = (date: string): string =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utc(date));

/** Co powiedzieć o wydarzeniu poza tytułem: stan, godzina, notatka. */
const detail = (e: CalEvent): string =>
  [CT.status[e.kind][e.status], e.at && timeShort(e.at), e.note].filter(Boolean).join(' · ');

/** Dzień w kalendarzu czytnikowi ekranu: „wtorek, 3 listopada: trening zaplanowany, zakupy”. */
const spoken = (date: string, list: CalEvent[]): string =>
  T.dayLabel(
    dayTitle(date),
    list.map((e) => [CT.kind[e.kind], CT.status[e.kind][e.status]].filter(Boolean).join(' ')).join(', '),
  );

/** Znaki dnia w siatce: jeden na rodzaj; przy treningu ważniejsze, że się odbył albo przepadł. */
function marksOf(list: CalEvent[]): CalEvent[] {
  const out: CalEvent[] = [];
  for (const kind of ['train', 'shop', 'lab'] as const) {
    const of = list.filter((e) => e.kind === kind);
    if (!of.length) continue;
    out.push(of.find((e) => e.status === 'done') ?? of.find((e) => e.status === 'missed') ?? of[0]!);
  }
  return out;
}

/** Lista wydarzeń. `links` — odnośniki do listy zakupów i badań; w liście na dwa tygodnie bez nich, żeby była krótka. */
function EventList({ list, today, links = false }: { list: CalEvent[]; today: string; links?: boolean }) {
  return (
    <ul className="cal-events">
      {list.map((e) => (
        <li key={`${e.id}-${e.kind}`} className={`cal-ev cal-ev-${e.status}`}>
          <Mark ev={e} size={18} />
          <div>
            <span className="cal-ev-title">{e.title}</span>
            {detail(e) && <span className="cal-ev-detail">{detail(e)}</span>}
            {links && e.kind === 'shop' && e.date >= today && (
              <a className="cal-ev-link" href={dietPath('shopping')}>
                {T.shopLink}
              </a>
            )}
            {links && e.kind === 'lab' && (
              <a className="cal-ev-link" href={dietPath('labs')}>
                {T.labLink}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Pobranie tekstu jako pliku .ics — tak samo jak CSV: adres z chwilą zwłoki dla Safari. */
function downloadIcs(name: string, ics: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function CalendarPage({
  state,
  onTrainAt,
  onToast,
}: {
  state: AppState;
  onTrainAt: (at: string) => void;
  onToast: (m: string) => void;
}) {
  const today = localDay();
  const [month, setMonth] = useState(() => monthOf(today));
  const [picked, setPicked] = useState(today);
  // Strona kalendarza wczytuje bazę diety zawsze — ale `loadDietCalendar` nie otwiera jej,
  // gdy jej nie ma, więc kto tylko trenuje, nie dostaje pustej bazy.
  const diet = useDietCalendar(true);

  const first = mondayOf(month);
  const last = lastOfMonth(month);
  const gridEnd = addDays(mondayOf(last), 6);
  const events = useMemo(
    () => calendarEvents(state, diet ?? null, first, gridEnd, today),
    [state, diet, first, gridEnd, today],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);
  // Wybrany dzień spoza widocznego miesiąca liczy się osobno.
  const pickedList = useMemo(
    () => byDay.get(picked) ?? calendarEvents(state, diet ?? null, picked, picked, today),
    [byDay, picked, state, diet, today],
  );
  const soon = useMemo(() => upcoming(state, diet ?? null, today), [state, diet, today]);
  const links = useMemo(() => googleLinks(state, diet ?? null, today, deviceTimeZone()), [state, diet, today]);
  const trainAt = trainTimeOf(state);

  const cells: (string | null)[] = [];
  for (let d = first; d <= gridEnd; d = addDays(d, 1)) cells.push(d >= month && d <= last ? d : null);

  const soonDays = [...new Set(soon.map((e) => e.date))];

  const saveIcs = () => {
    const { text: ics, count } = calendarIcs(state, diet ?? null, today, new Date());
    if (!count) {
      onToast(T.icsEmpty);
      return;
    }
    downloadIcs(icsName(today), ics);
    onToast(T.icsSaved(count));
  };

  const kinds = (['train', 'shop', 'lab'] as const).filter((k) => links[k]);

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
      </div>

      <section className="grp cal-month" aria-labelledby="cal-month-title">
        <div className="cal-head">
          <button type="button" className="cal-nav" aria-label={T.prev} onClick={() => setMonth(shiftMonth(month, -1))}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h2 id="cal-month-title" aria-live="polite">
            {monthTitle(month)}
          </h2>
          <button type="button" className="cal-nav" aria-label={T.next} onClick={() => setMonth(shiftMonth(month, 1))}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="cal-grid">
          {CT.weekdays.map((w) => (
            <span key={w} className="cal-wd" aria-hidden="true">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`x${i}`} className="cal-blank" />;
            const list = byDay.get(d) ?? [];
            return (
              <button
                key={d}
                type="button"
                className={`cal-day${d === today ? ' cal-today' : ''}${d < today ? ' cal-past' : ''}`}
                aria-pressed={d === picked}
                aria-current={d === today ? 'date' : undefined}
                aria-label={spoken(d, list)}
                onClick={() => setPicked(d)}
              >
                <span className="cal-num">{Number(d.slice(8))}</span>
                <span className="cal-marks">
                  {marksOf(list).map((e) => (
                    <Mark key={e.kind} ev={e} size={12} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        {month !== monthOf(today) && (
          <button
            type="button"
            className="btn ghost sm cal-back"
            onClick={() => {
              setMonth(monthOf(today));
              setPicked(today);
            }}
          >
            {T.thisMonth}
          </button>
        )}
        <ul className="cal-legend" aria-label={T.legend}>
          <li>
            <Mark ev={{ kind: 'train', status: 'planned' }} /> {T.legendItems.planned}
          </li>
          <li>
            <Mark ev={{ kind: 'train', status: 'done' }} /> {T.legendItems.done}
          </li>
          <li>
            <Mark ev={{ kind: 'train', status: 'missed' }} /> {T.legendItems.missed}
          </li>
          <li>
            <Mark ev={{ kind: 'shop', status: 'planned' }} /> {T.legendItems.shop}
          </li>
          <li>
            <Mark ev={{ kind: 'lab', status: 'planned' }} /> {T.legendItems.lab}
          </li>
          <li>
            <span className="cal-legend-today" aria-hidden="true" />{' '}
            {T.todayMark}
          </li>
        </ul>
      </section>

      <section className="grp cal-picked" aria-live="polite">
        <h2>{dayTitle(picked)}</h2>
        {pickedList.length ? <EventList list={pickedList} today={today} links /> : <p className="tight">{T.nothing}</p>}
      </section>

      <section className="grp cal-soon">
        <h2>{T.soon}</h2>
        {soonDays.length ? (
          soonDays.map((d) => (
            <div key={d} className="cal-soon-day">
              <h3>{dayShort(d, today)}</h3>
              <EventList list={soon.filter((e) => e.date === d)} today={today} />
            </div>
          ))
        ) : (
          <p className="tight">{T.soonEmpty}</p>
        )}
        {!state.plan && (
          <p className="hint cal-hint">
            {T.noPlan} <a href="#/plan">{T.setPlan}</a>
          </p>
        )}
        {diet && !diet.shop && (
          <p className="hint cal-hint">
            {T.noShop} <a href={dietPath('shopping')}>{T.shopLink}</a>
          </p>
        )}
      </section>

      <section className="grp cal-export">
        <h2>{T.google}</h2>
        <p>{T.googleLead}</p>
        {state.plan && (
          <label className="rem-time">
            <span>{T.trainAt}</span>
            <select value={trainAt} onChange={(e) => onTrainAt(e.target.value)}>
              {(TRAIN_TIMES.includes(trainAt) ? TRAIN_TIMES : [...TRAIN_TIMES, trainAt].sort()).map((t) => (
                <option key={t} value={t}>
                  {timeShort(t)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="cal-actions">
          {kinds.map((k) => (
            <a key={k} className="btn ghost wide" href={links[k]} target="_blank" rel="noopener noreferrer">
              {T.add[k]}
              <span className="sr-only"> {T.newTab}</span>
            </a>
          ))}
          {!kinds.length && <p className="tight">{T.nothingToAdd}</p>}
          <button type="button" className="btn wide" onClick={saveIcs}>
            {T.ics}
          </button>
        </div>
        <p className="hint">{T.honest}</p>
        <p className="hint">{T.icsHow(EXPORT_WEEKS, ALARM_MIN.train, ALARM_MIN.shop)}</p>
        <p className="hint">{T.fallback}</p>
        {pushConfigured() && (
          <p className="hint">
            {T.push} <a href={SETTINGS_PATH}>{T.pushLink}</a>
          </p>
        )}
      </section>
    </>
  );
}
