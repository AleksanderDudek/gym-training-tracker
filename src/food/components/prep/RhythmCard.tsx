import { CalendarClock } from 'lucide-react';
import { useId, useState } from 'react';
import { text } from '../../../i18n';
import { Segmented } from '../../../components/ui';
import { useBridge } from '../../bridge';
import { plural } from '../../lib/format';
import { rangeLabel, shortDate } from '../../prep/format';
import { EVERY_MAX_DAYS, cleanRhythm, shopPeriod, weekdayOf, type ShopRhythm } from '../../shop/rhythm';
import { saveShopping } from '../../shop/store';

const T = text({
  pl: {
    title: 'Kiedy robisz zakupy',
    unset: 'Nie ustawione — na razie liczę do soboty, 10:00. Ustaw swój rytm, a lista policzy się na właściwą liczbę dni.',
    set: 'Ustaw',
    change: 'Zmień',
    done: 'Gotowe',
    kind: 'Rytm zakupów',
    weekdays: 'W stałe dni',
    every: 'Co kilka dni',
    days: 'Dni zakupów',
    gap: 'Co ile dni',
    gapOption: (n: number) => (n === 1 ? 'codziennie' : `co ${n} dni`),
    from: 'Najbliższe zakupy',
    at: 'Godzina',
    onDays: (names: string, at: string) => `${names}, ${at}`,
    daily: (at: string) => `Codziennie, ${at}`,
    everyN: (n: number, at: string) => `Co ${n} dni, ${at}`,
    and: ' i ',
    next: (date: string, days: number, range: string) =>
      `Następne: ${date} · lista na ${days} ${plural(days, 'dzień', 'dni', 'dni')} (${range})`,
    failed: 'Nie udało się zapisać rytmu zakupów.',
    short: ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'],
    long: ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'],
  },
  en: {
    title: 'When you shop',
    unset: 'Not set — for now I count up to Saturday, 10:00. Set your rhythm and the list covers the right number of days.',
    set: 'Set',
    change: 'Change',
    done: 'Done',
    kind: 'Shopping rhythm',
    weekdays: 'On fixed days',
    every: 'Every few days',
    days: 'Shopping days',
    gap: 'How often',
    gapOption: (n: number) => (n === 1 ? 'every day' : `every ${n} days`),
    from: 'Next shopping',
    at: 'Time',
    onDays: (names: string, at: string) => `${names}, ${at}`,
    daily: (at: string) => `Every day, ${at}`,
    everyN: (n: number, at: string) => `Every ${n} days, ${at}`,
    and: ' and ',
    next: (date: string, days: number, range: string) => `Next: ${date} · list for ${days} ${days === 1 ? 'day' : 'days'} (${range})`,
    failed: 'Couldn’t save the shopping rhythm.',
    short: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    long: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
});

/** „wtorek i piątek”, „poniedziałek, środa i piątek”. */
function dayNames(days: readonly number[]): string {
  const names = days.map((d) => T.long[d - 1]!);
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')}${T.and}${names[names.length - 1]}`;
}

/** Rytm jednym zdaniem: „Sobota, 10:00”, „Wtorek i piątek, 17:00”, „Co 10 dni, 18:00”. */
export function rhythmText(r: ShopRhythm): string {
  if (r.kind === 'weekdays') {
    const names = dayNames(r.days);
    return T.onDays(names.charAt(0).toUpperCase() + names.slice(1), r.at);
  }
  return r.days === 1 ? T.daily(r.at) : T.everyN(r.days, r.at);
}

interface Props {
  /** Zapisany rytm; null — jeszcze nieustawiony (lista liczy się z domyślnej soboty). */
  saved: ShopRhythm | null;
  rhythm: ShopRhythm;
  today: string;
}

/**
 * Karta rytmu zakupów na liście z dziennika: kiedy są następne zakupy i na ile dni lista. Każda
 * zmiana zapisuje się od razu w profilu diety (`saveShopping`) — lista pod kartą liczy się na nowo.
 */
export function RhythmCard({ saved, rhythm: stored, today }: Props) {
  const bridge = useBridge();
  const [open, setOpen] = useState(false);
  const id = useId();
  // Zmiana widoczna od razu, zanim IndexedDB odpowie; nowy zapisany rytm ją zastępuje.
  const [draft, setDraft] = useState<ShopRhythm | null>(null);
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    setDraft(null);
  }
  const rhythm = draft ?? stored;
  const period = shopPeriod(rhythm, today);
  const save = (next: ShopRhythm) => {
    const clean = cleanRhythm(next);
    if (!clean) return;
    setDraft(clean);
    saveShopping(clean).catch(() => {
      setDraft(null);
      bridge.toast(T.failed);
    });
  };
  const toKind = (kind: ShopRhythm['kind']) => {
    if (kind === rhythm.kind) return;
    save(
      kind === 'every'
        ? { kind: 'every', days: 7, from: period.shop, at: rhythm.at }
        : { kind: 'weekdays', days: [weekdayOf(period.shop)], at: rhythm.at },
    );
  };
  const toggleDay = (day: number) => {
    if (rhythm.kind !== 'weekdays') return;
    const on = rhythm.days.includes(day);
    // Ostatniego dnia nie da się odznaczyć: rytm bez dni to brak zakupów.
    if (on && rhythm.days.length === 1) return;
    save({ ...rhythm, days: on ? rhythm.days.filter((d) => d !== day) : [...rhythm.days, day].sort((a, b) => a - b) });
  };

  return (
    <section className="grp fd-prep-rhythm" aria-labelledby={`${id}-title`}>
      <div className="fd-prep-rhythm-top">
        <h2 id={`${id}-title`}>
          <CalendarClock size={18} strokeWidth={2} aria-hidden className="fd-prep-ico" /> {T.title}
        </h2>
        <button type="button" className="btn ghost sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? T.done : saved || draft ? T.change : T.set}
        </button>
      </div>
      {saved || draft ? <p className="tight fd-prep-rhythm-now">{rhythmText(rhythm)}</p> : <p className="tight">{T.unset}</p>}
      <p className="tight fd-prep-soft">{T.next(shortDate(period.shop), period.days, rangeLabel(period.shop, period.until))}</p>

      {open && (
        <div className="fd-prep-rhythm-edit">
          <Segmented<ShopRhythm['kind']>
            label={T.kind}
            value={rhythm.kind}
            onChange={toKind}
            options={[
              { key: 'weekdays', label: T.weekdays },
              { key: 'every', label: T.every },
            ]}
          />
          {rhythm.kind === 'weekdays' ? (
            <div className="chips fd-prep-days" role="group" aria-label={T.days}>
              {T.short.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={rhythm.days.includes(i + 1)}
                  aria-label={T.long[i]}
                  onClick={() => toggleDay(i + 1)}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : (
            <div className="fd-prep-fields">
              <label className="fld">
                <span>{T.gap}</span>
                <select value={rhythm.days} onChange={(e) => save({ ...rhythm, days: Number(e.target.value) })}>
                  {Array.from({ length: EVERY_MAX_DAYS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {T.gapOption(n)}
                    </option>
                  ))}
                </select>
              </label>
              {/* Najbliższy dzień rytmu, nie zapisane „od”: rytm co N dni liczy się od dowolnego swojego dnia. */}
              <label className="fld">
                <span>{T.from}</span>
                <input type="date" value={period.shop} min={today} onChange={(e) => e.target.value && save({ ...rhythm, from: e.target.value })} />
              </label>
            </div>
          )}
          <label className="fld fd-prep-rhythm-at">
            <span>{T.at}</span>
            <input type="time" value={rhythm.at} onChange={(e) => e.target.value && save({ ...rhythm, at: e.target.value })} />
          </label>
        </div>
      )}
    </section>
  );
}
