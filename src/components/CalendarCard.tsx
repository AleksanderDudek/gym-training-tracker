import { useEffect, useState } from 'react';
import { NO_DIET, upcoming, type CalEvent, type DietCalendar } from '../engine/calendar';
import { localDay } from '../engine/reminders';
import { addDays, weekdayOf } from '../engine/schedule';
import { hasDiet } from '../food/dietFlag';
import { LANG, text } from '../i18n';
import { CALENDAR_PATH } from '../routing';
import type { AppState } from '../types';
import { Icon } from './icons';

/**
 * Wspólne kawałki kalendarza i jego karta na ekranie Dziś. Karta jest mała: najbliższe trzy
 * wydarzenia jednym wierszem każde i odnośnik do strony. Zakupy i badanie przychodzą z bazy diety
 * tylko u kogoś, kto prowadzi dietę (`gt:diet`) — kto tylko trenuje, nie wczytuje Dexie.
 */

export const CT = text({
  pl: {
    weekdays: ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'],
    today: 'dziś',
    tomorrow: 'jutro',
    status: {
      train: { planned: 'zaplanowany', open: 'do nadrobienia', done: 'zrobiony', missed: 'opuszczony' },
      shop: { planned: '', open: '', done: '', missed: '' },
      lab: { planned: 'termin z planu pod wyniki', open: '', done: '', missed: '' },
    },
    kind: { train: 'trening', shop: 'zakupy', lab: 'badanie' },
    tag: 'Kalendarz',
    cardEmpty: 'Treningi z planu, zakupy i badania w jednym kalendarzu — także w Kalendarzu Google.',
    cardLink: 'Kalendarz i Kalendarz Google',
    cardList: 'Najbliższe wydarzenia',
  },
  en: {
    weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    today: 'today',
    tomorrow: 'tomorrow',
    status: {
      train: { planned: 'planned', open: 'to make up', done: 'done', missed: 'missed' },
      shop: { planned: '', open: '', done: '', missed: '' },
      lab: { planned: 'date from your plan for the results', open: '', done: '', missed: '' },
    },
    kind: { train: 'workout', shop: 'shopping', lab: 'lab test' },
    tag: 'Calendar',
    cardEmpty: 'Workouts from your plan, shopping and lab tests in one calendar — in Google Calendar too.',
    cardLink: 'Calendar and Google Calendar',
    cardList: 'Coming up',
  },
});

/**
 * Zakupy i badanie z bazy diety. `undefined`, póki baza odpowiada; bez zgody (`enabled`) albo przy
 * błędzie — pusta część diety, a kalendarz pokazuje same treningi.
 */
export function useDietCalendar(enabled: boolean): DietCalendar | undefined {
  const [data, setData] = useState<DietCalendar | undefined>(enabled ? undefined : NO_DIET);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    import('../food/calendar')
      .then((m) => m.loadDietCalendar())
      .then(
        (d) => live && setData(d),
        () => live && setData(NO_DIET),
      );
    return () => {
      live = false;
    };
  }, [enabled]);
  return data;
}

/** Krótki dzień: „dziś”, „jutro”, „śr 5.11”. */
export function dayShort(date: string, today: string): string {
  if (date === today) return CT.today;
  if (date === addDays(today, 1)) return CT.tomorrow;
  const [, mm, dd] = date.split('-');
  return `${CT.weekdays[weekdayOf(date) - 1]} ${Number(dd)}${LANG === 'pl' ? '.' : '/'}${Number(mm)}`;
}

/** Godzina bez zera z przodu: „9:30”. */
export const timeShort = (at: string): string => at.replace(/^0/, '');

/**
 * Znak wydarzenia: kształt mówi, co to jest — hantla (trening), wózek (zakupy), probówka
 * (badanie) — a ptaszek i krzyżyk mówią, że trening się odbył albo przepadł. Kolor tylko
 * pomaga; nic nie zależy od samego koloru.
 */
export function Mark({ ev, size = 14 }: { ev: Pick<CalEvent, 'kind' | 'status'>; size?: number }) {
  const cls = `cal-mark cal-mark-${ev.kind} cal-mark-${ev.status}`;
  if (ev.kind === 'train' && (ev.status === 'done' || ev.status === 'missed')) {
    return (
      <span className={cls} aria-hidden="true">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          {ev.status === 'done' ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />}
        </svg>
      </span>
    );
  }
  return (
    <span className={cls} aria-hidden="true">
      <Icon name={ev.kind === 'train' ? 'session' : ev.kind === 'shop' ? 'cart' : 'flask'} size={size} />
    </span>
  );
}

export function CalendarCard({ state }: { state: AppState }) {
  const diet = useDietCalendar(hasDiet());
  const today = localDay();
  const next = upcoming(state, diet ?? null, today).slice(0, 3);

  return (
    <div className="grp snackcard cal-card">
      <div className="today-tag light">{CT.tag}</div>
      {next.length ? (
        <ul className="cal-next" aria-label={CT.cardList}>
          {next.map((e) => (
            <li key={`${e.id}-${e.kind}`}>
              <Mark ev={e} />
              <span className="cal-next-day">{dayShort(e.date, today)}</span>
              <span className="cal-next-what">{e.title}</span>
              {e.at && <span className="cal-next-at">{timeShort(e.at)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="tight">{CT.cardEmpty}</p>
      )}
      <a className="vidlink" href={CALENDAR_PATH}>
        <Icon name="calendar" size={18} />
        {CT.cardLink}
      </a>
    </div>
  );
}
