import { useState } from 'react';
import { HABIT_TIMES } from '@gymtracker/link';
import type { HabitItem, HabitTime, HabitsBody } from '@gymtracker/link';
import { habitsFor, localDay } from '@gymtracker/link/coaching';
import { text } from '../../i18n';
import { ticksOn, useLink } from '../../link/store';
import { setAssignmentStatus, setDayTicks } from '../../link/sync';
import { sentDay } from '../../link/today';
import type { Coached } from '../../link/today';
import type { AppState } from '../../types';
import { DayStrip, cap, dayText, recentDays } from './DayStrip';
import './habits.css';

/**
 * Nawyki od prowadzącego na stronie zalecenia: punkty na wybrany dzień, pogrupowane po porze, do
 * odhaczenia jednym dotknięciem — i pasek ostatniego tygodnia, żeby dopisać zapomniane wczoraj.
 * Odhaczenia idą do prowadzącego w paczce (`setDayTicks`), pierwsze robi z zalecenia „w trakcie”.
 */

const T = text({
  pl: {
    days: 'Dni',
    todayIs: (d: string) => `Dziś, ${d}`,
    progress: (done: number, due: number) => `Zrobione ${done} z ${due}`,
    all: 'Wszystko zrobione — tak trzymaj.',
    nothing: 'Na ten dzień nic z tej listy.',
    afterEnd: 'Ten dzień jest już po końcu listy.',
    times: { morning: 'Rano', midday: 'W południe', evening: 'Wieczorem', any: 'O dowolnej porze' } as Record<HabitTime, string>,
    until: (d: string) => `Lista obowiązuje do ${d} włącznie.`,
    ended: (d: string) => `Lista skończyła się ${d}. Ostatnie dni możesz jeszcze uzupełnić.`,
    whole: 'Cała lista',
    every: 'codziennie',
    work: 'w dni robocze',
    weekend: 'w weekendy',
    wd: ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'],
    note: 'Od prowadzącego',
    back: 'Odhaczasz za wcześniejszy dzień.',
    toToday: 'Wróć do dziś',
  },
  en: {
    days: 'Days',
    todayIs: (d: string) => `Today, ${d}`,
    progress: (done: number, due: number) => `Done ${done} of ${due}`,
    all: 'All done — keep it up.',
    nothing: 'Nothing from this list on this day.',
    afterEnd: 'This day is after the list ended.',
    times: { morning: 'Morning', midday: 'Midday', evening: 'Evening', any: 'Any time' } as Record<HabitTime, string>,
    until: (d: string) => `The list runs until ${d}, inclusive.`,
    ended: (d: string) => `The list ended on ${d}. You can still fill in the last few days.`,
    whole: 'The whole list',
    every: 'every day',
    work: 'on weekdays',
    weekend: 'at weekends',
    wd: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    note: 'From your coach',
    back: 'You are ticking an earlier day.',
    toToday: 'Back to today',
  },
});

/** Dni punktu słowami: „codziennie”, „w dni robocze”, „pn, śr, pt”. */
export function daysText(days: readonly number[]): string {
  const s = [...days].sort((a, b) => a - b).join();
  if (s === '1,2,3,4,5,6,7') return T.every;
  if (s === '1,2,3,4,5') return T.work;
  if (s === '6,7') return T.weekend;
  return [...days].sort((a, b) => a - b).map((d) => T.wd[d - 1]).join(', ');
}

const longDay = (day: string) => dayText(day, { weekday: 'long', day: 'numeric', month: 'long' });
const dateOnly = (day: string) => dayText(day, { day: 'numeric', month: 'long' });

export function HabitsAssignment({ stored, state }: { stored: Coached<HabitsBody>; state: AppState }) {
  const s = useLink();
  const b = stored.a.body;
  const today = localDay();
  const days = recentDays(today, sentDay(stored));
  const [picked, setPicked] = useState(today);
  const day = days.includes(picked) ? picked : today;

  const due = habitsFor(b, day);
  const ticked = new Set(ticksOn(s, stored.id, day));
  const done = due.filter((i) => ticked.has(i));
  const toggle = (i: number) => {
    const next = new Set(ticked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setDayTicks(stored, day, due.filter((x) => next.has(x)), () => state);
    if (stored.status === 'new' || stored.status === 'seen' || stored.status === 'declined') void setAssignmentStatus(stored.id, 'started');
  };
  const count = (d: string) => {
    const list = habitsFor(b, d);
    const t = new Set(ticksOn(s, stored.id, d));
    return { done: list.filter((i) => t.has(i)).length, due: list.length };
  };
  const groups = HABIT_TIMES.map((when) => ({ when, items: due.filter((i) => b.items[i]!.when === when) })).filter((g) => g.items.length);

  return (
    <>
      <div className="grp lk-habits-head">
        <h2>{day === today ? T.todayIs(dateOnly(day)) : cap(longDay(day))}</h2>
        {due.length ? (
          <p className="tight" aria-live="polite">
            {T.progress(done.length, due.length)}
            {done.length === due.length ? ` ${T.all}` : ''}
          </p>
        ) : null}
        <DayStrip days={days} today={today} value={day} onChange={setPicked} count={count} label={T.days} />
        {day !== today ? (
          <p className="tight lk-habits-back">
            {T.back}{' '}
            <button type="button" className="lk-habits-link" onClick={() => setPicked(today)}>
              {T.toToday}
            </button>
          </p>
        ) : null}
      </div>
      {!due.length ? (
        <div className="grp">
          <p className="tight">{b.until && day > b.until ? T.afterEnd : T.nothing}</p>
        </div>
      ) : (
        groups.map((g) => (
          <div className="grp" key={g.when} role="group" aria-labelledby={`lk-habits-${g.when}`}>
            <h3 id={`lk-habits-${g.when}`} className="lk-habits-when">
              {T.times[g.when]}
            </h3>
            <ul className="lk-habits-list">
              {g.items.map((i) => (
                <li key={i}>
                  <HabitRow item={b.items[i]!} checked={ticked.has(i)} onToggle={() => toggle(i)} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <div className="grp">
        {b.until ? <p className="tight">{b.until >= today ? T.until(dateOnly(b.until)) : T.ended(dateOnly(b.until))}</p> : null}
        <details className="lk-habits-whole">
          <summary className="link-summary">{T.whole}</summary>
          <ul className="link-list">
            {b.items.map((it, i) => (
              <li key={i}>
                <b>{it.label}</b>
                {it.dose ? ` — ${it.dose}` : ''} · {T.times[it.when].toLowerCase()} · {daysText(it.days)}
              </li>
            ))}
          </ul>
        </details>
      </div>
      {b.note ? (
        <div className="grp">
          <h2>{T.note}</h2>
          <p className="link-text">{b.note}</p>
        </div>
      ) : null}
    </>
  );
}

function HabitRow({ item, checked, onToggle }: { item: HabitItem; checked: boolean; onToggle: () => void }) {
  return (
    <label className={`lk-habits-row${checked ? ' lk-habits-done' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="lk-habits-text">
        <span className="lk-habits-label">{item.label}</span>{' '}
        {item.dose ? <span className="lk-habits-dose">{item.dose}</span> : null}
      </span>
    </label>
  );
}
