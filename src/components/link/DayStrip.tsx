import { addDays } from '@gymtracker/link/coaching';
import { LOCALE, text } from '../../i18n';
import './dayStrip.css';

/**
 * Pasek ostatnich dni nad nawykami i jadłospisem od prowadzącego: dzień, ile z ilu, wybór dnia.
 * Do tyłu najwyżej tydzień — tyle, żeby dopisać zapomniane wczoraj, a nie przepisywać historię.
 */

export const BACK_DAYS = 6;

const T = text({
  pl: {
    today: 'Dziś',
    of: (done: number, due: number) => `${done}/${due}`,
    free: 'wolne',
    label: (day: string, done: number, due: number) => (due ? `${day}: ${done} z ${due}` : `${day}: nic do zrobienia`),
  },
  en: {
    today: 'Today',
    of: (done: number, due: number) => `${done}/${due}`,
    free: 'free',
    label: (day: string, done: number, due: number) => (due ? `${day}: ${done} of ${due}` : `${day}: nothing to do`),
  },
});

/** Dni do wyboru: od `first` (ale najwyżej `BACK_DAYS` wstecz) do dziś, od najstarszego. */
export function recentDays(today: string, first: string): string[] {
  const from = first > addDays(today, -BACK_DAYS) ? first : addDays(today, -BACK_DAYS);
  const out: string[] = [];
  for (let d = from > today ? today : from; d <= today; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Dzień `YYYY-MM-DD` po ludzku (południe lokalne — bez przeskoku strefy). */
export const dayText = (day: string, opts: Intl.DateTimeFormatOptions): string => new Date(`${day}T12:00:00`).toLocaleDateString(LOCALE, opts);

/** Na początek nagłówka: „Wtorek, 24 listopada”. */
export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function DayStrip({
  days,
  today,
  value,
  onChange,
  count,
  label,
}: {
  days: readonly string[];
  today: string;
  value: string;
  onChange: (day: string) => void;
  count: (day: string) => { done: number; due: number };
  label: string;
}) {
  if (days.length < 2) return null;
  return (
    <div className="lk-strip" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((d) => {
        const { done, due } = count(d);
        const long = dayText(d, { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <button
            key={d}
            type="button"
            className={`lk-strip-day${due && done >= due ? ' lk-strip-full' : ''}`}
            aria-pressed={d === value}
            aria-label={T.label(d === today ? `${T.today}, ${long}` : long, done, due)}
            onClick={() => onChange(d)}
          >
            <span className="lk-strip-wd">{d === today ? T.today : dayText(d, { weekday: 'short' })}</span>
            <span className="lk-strip-num">{Number(d.slice(8))}</span>
            <span className="lk-strip-count">{due ? T.of(done, due) : T.free}</span>
          </button>
        );
      })}
    </div>
  );
}
