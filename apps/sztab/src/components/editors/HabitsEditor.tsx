import { useState } from 'react';
import { HABIT_TIMES, cleanHabits, localDay } from '@gymtracker/link';
import type { HabitItem, HabitTime, HabitsBody } from '@gymtracker/link';
import { text } from '@gt/i18n';
import './HabitsEditor.css';

/**
 * Kreator nawyków i suplementów: codzienna lista punktów na wybrane dni tygodnia, z porą i dawką.
 * Telefon pokazuje dzisiejsze punkty do odhaczenia, Sztab — realizację 7 i 30 dni.
 *
 * Gotowe nawyki to tylko skróty do listy — bez obietnic, co suplement robi; dawkę ustala prowadzący.
 */

const ALL = [1, 2, 3, 4, 5, 6, 7];
const WORK = [1, 2, 3, 4, 5];
const WEEKEND = [6, 7];
export const MAX_HABITS = 20;

const T = text({
  pl: {
    title: 'Nazwa listy nawyków',
    titlePh: 'np. Codzienne nawyki, Suplementy',
    items: 'Punkty',
    itemN: (n: number) => `Punkt ${n}`,
    label: 'Co',
    labelPh: 'np. Woda, Kreatyna, Spacer',
    dose: 'Ile (opcjonalnie)',
    dosePh: 'np. 5 g, 2 l, 30 min',
    when: 'Pora',
    times: { morning: 'rano', midday: 'w południe', evening: 'wieczorem', any: 'dowolnie' } as Record<HabitTime, string>,
    days: 'Dni',
    wd: ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'],
    wdLong: ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'],
    every: 'codziennie',
    work: 'dni robocze',
    weekend: 'weekend',
    up: (n: number) => `Punkt ${n} wyżej`,
    down: (n: number) => `Punkt ${n} niżej`,
    remove: (n: number) => `Usuń punkt ${n}`,
    add: 'Dodaj punkt',
    noItems: 'Dodaj pierwszy punkt — własny albo z gotowych niżej.',
    presets: 'Gotowe nawyki',
    presetsHint: 'Skróty do listy. Dawkę, porę i dni zmienisz w punkcie po dodaniu.',
    presetAdd: (s: string) => `Dodaj: ${s}`,
    until: 'Do kiedy (opcjonalnie)',
    untilHint: 'Ostatni dzień listy. Puste — bez końca.',
    clearUntil: 'Bez końca',
    note: 'Komentarz dla podopiecznego',
    notePh: 'np. Kreatynę popijaj wodą, porę możesz zmienić.',
    before: 'Zanim zapiszesz albo wyślesz',
    max: (n: number) => `Najwyżej ${n} punktów na liście.`,
    p: {
      title: 'Nazwij listę.',
      items: 'Dodaj co najmniej jeden punkt.',
      label: (n: number) => `Punkt ${n}: wpisz, co robić.`,
      days: (n: number) => `Punkt ${n}: zaznacz co najmniej jeden dzień.`,
      tooMany: (n: number) => `Lista ma więcej niż ${n} punktów — telefon pokaże tylko pierwsze ${n}.`,
      past: 'Data końca już minęła — telefon nie pokaże z tej listy nic na dziś.',
    },
  },
  en: {
    title: 'Habit list name',
    titlePh: 'e.g. Daily habits, Supplements',
    items: 'Items',
    itemN: (n: number) => `Item ${n}`,
    label: 'What',
    labelPh: 'e.g. Water, Creatine, Walk',
    dose: 'How much (optional)',
    dosePh: 'e.g. 5 g, 2 l, 30 min',
    when: 'Time of day',
    times: { morning: 'morning', midday: 'midday', evening: 'evening', any: 'any time' } as Record<HabitTime, string>,
    days: 'Days',
    wd: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    wdLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    every: 'every day',
    work: 'weekdays',
    weekend: 'weekend',
    up: (n: number) => `Move item ${n} up`,
    down: (n: number) => `Move item ${n} down`,
    remove: (n: number) => `Remove item ${n}`,
    add: 'Add item',
    noItems: 'Add the first item — your own or one of the ready ones below.',
    presets: 'Ready habits',
    presetsHint: 'Shortcuts for the list. Change the amount, time and days in the item after adding.',
    presetAdd: (s: string) => `Add: ${s}`,
    until: 'Until (optional)',
    untilHint: 'The list’s last day. Empty — no end.',
    clearUntil: 'No end',
    note: 'Comment for the client',
    notePh: 'e.g. Take creatine with water, any time of day is fine.',
    before: 'Before you save or send',
    max: (n: number) => `At most ${n} items per list.`,
    p: {
      title: 'Name the list.',
      items: 'Add at least one item.',
      label: (n: number) => `Item ${n}: say what to do.`,
      days: (n: number) => `Item ${n}: pick at least one day.`,
      tooMany: (n: number) => `The list has more than ${n} items — the phone shows only the first ${n}.`,
      past: 'The end date has passed — the phone will show nothing from this list today.',
    },
  },
});

/** Gotowe punkty: nazwa i dawka po ludzku, bez twierdzeń o działaniu. */
export const HABIT_PRESETS: readonly HabitItem[] = text<HabitItem[]>({
  pl: [
    { label: 'Sen', dose: '7–9 h', when: 'evening', days: ALL },
    { label: 'Woda', dose: '2 l', when: 'any', days: ALL },
    { label: 'Kreatyna', dose: '5 g', when: 'any', days: ALL },
    { label: 'Witamina D', dose: '', when: 'morning', days: ALL },
    { label: '10 000 kroków', dose: '', when: 'any', days: ALL },
    { label: 'Rozciąganie', dose: '10 min', when: 'evening', days: ALL },
    { label: 'Bez ekranu godzinę przed snem', dose: '', when: 'evening', days: ALL },
    { label: 'Warzywa do każdego posiłku', dose: '', when: 'any', days: ALL },
  ],
  en: [
    { label: 'Sleep', dose: '7–9 h', when: 'evening', days: ALL },
    { label: 'Water', dose: '2 l', when: 'any', days: ALL },
    { label: 'Creatine', dose: '5 g', when: 'any', days: ALL },
    { label: 'Vitamin D', dose: '', when: 'morning', days: ALL },
    { label: '10,000 steps', dose: '', when: 'any', days: ALL },
    { label: 'Stretching', dose: '10 min', when: 'evening', days: ALL },
    { label: 'No screens an hour before bed', dose: '', when: 'evening', days: ALL },
    { label: 'Vegetables with every meal', dose: '', when: 'any', days: ALL },
  ],
});

export const emptyHabits = (): HabitsBody => ({ kind: 'habits', title: '', items: [], note: '', until: null });

export const newHabit = (): HabitItem => ({ label: '', dose: '', when: 'any', days: [...ALL] });

/**
 * Co poprawić przed zapisem. `errors` puste ⇔ `cleanHabits` przepuści listę (to samo sprawdza
 * telefon); `warnings` nie blokują, ale mówią, czego telefon nie pokaże.
 */
export function habitsProblems(b: HabitsBody, today: string = localDay()): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!b.title.trim()) errors.push(T.p.title);
  if (!b.items.length) errors.push(T.p.items);
  b.items.slice(0, MAX_HABITS).forEach((it, i) => {
    if (!it.label.trim()) errors.push(T.p.label(i + 1));
    if (!it.days.some((d) => Number.isInteger(d) && d >= 1 && d <= 7)) errors.push(T.p.days(i + 1));
  });
  if (b.items.length > MAX_HABITS) warnings.push(T.p.tooMany(MAX_HABITS));
  if (b.until && b.until < today) warnings.push(T.p.past);
  return { errors, warnings };
}

const sameDays = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((d) => b.includes(d));

let seq = 0;
const nextKey = () => `h${++seq}`;
const fit = (keys: readonly string[], n: number): string[] => {
  const out = keys.slice(0, n);
  while (out.length < n) out.push(nextKey());
  return out;
};

export function HabitsForm({ value, onChange }: { value: HabitsBody; onChange: (v: HabitsBody) => void }) {
  // Klucze wierszy jadą razem z wierszami: po „wyżej” fokus zostaje na przesuniętym punkcie.
  const [stored, setKeys] = useState<string[]>(() => fit([], value.items.length));
  let keys = stored;
  if (keys.length !== value.items.length) {
    // Lista podmieniona z zewnątrz (wczytana z biblioteki) — klucze dopasowane jeszcze w tym renderze.
    keys = fit(keys, value.items.length);
    setKeys(keys);
  }

  const set = (patch: Partial<HabitsBody>) => onChange({ ...value, ...patch });
  const setItem = (i: number, patch: Partial<HabitItem>) => set({ items: value.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const add = (item: HabitItem) => {
    if (value.items.length >= MAX_HABITS) return;
    setKeys([...keys, nextKey()]);
    set({ items: [...value.items, { ...item, days: [...item.days] }] });
  };
  const remove = (i: number) => {
    setKeys(keys.filter((_, j) => j !== i));
    set({ items: value.items.filter((_, j) => j !== i) });
  };
  const move = (i: number, d: number) => {
    const items = [...value.items];
    [items[i], items[i + d]] = [items[i + d]!, items[i]!];
    const k = [...keys];
    [k[i], k[i + d]] = [k[i + d]!, k[i]!];
    setKeys(k);
    set({ items });
  };
  const problems = habitsProblems(value);
  const full = value.items.length >= MAX_HABITS;
  const has = (p: HabitItem) => value.items.some((x) => x.label.trim().toLowerCase() === p.label.toLowerCase());

  return (
    <div className="stack sz-habits" style={{ gap: 16 }}>
      <label className="field">
        <span>{T.title}</span>
        <input id="habits-title" type="text" maxLength={120} placeholder={T.titlePh} value={value.title} onChange={(e) => set({ title: e.target.value })} />
      </label>

      <div className="stack">
        <h3>{T.items}</h3>
        {!value.items.length ? <p className="soft">{T.noItems}</p> : null}
        <ol className="ex-list sz-habits-list">
          {value.items.map((it, i) => (
            <li key={keys[i]} className="ex-row sz-habits-item">
              <span className="idx">{i + 1}</span>
              <div className="stack sz-habits-body" role="group" aria-label={T.itemN(i + 1)}>
                <div className="sz-habits-fields">
                  <label className="field sz-habits-label">
                    <span>{T.label}</span>
                    <input type="text" maxLength={120} placeholder={T.labelPh} value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                  </label>
                  <label className="field sz-habits-dose">
                    <span>{T.dose}</span>
                    <input type="text" maxLength={60} placeholder={T.dosePh} value={it.dose} onChange={(e) => setItem(i, { dose: e.target.value })} />
                  </label>
                  <label className="field sz-habits-when">
                    <span>{T.when}</span>
                    <select value={it.when} onChange={(e) => setItem(i, { when: e.target.value as HabitTime })}>
                      {HABIT_TIMES.map((t) => (
                        <option key={t} value={t}>
                          {T.times[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <fieldset className="sz-habits-days">
                  <legend>{T.days}</legend>
                  <div className="row">
                    {T.wd.map((d, k) => (
                      <label key={d} className="chip sz-habits-day" title={T.wdLong[k]}>
                        <input
                          type="checkbox"
                          aria-label={T.wdLong[k]}
                          checked={it.days.includes(k + 1)}
                          onChange={(e) =>
                            setItem(i, { days: e.target.checked ? [...new Set([...it.days, k + 1])].sort((a, b) => a - b) : it.days.filter((x) => x !== k + 1) })
                          }
                        />
                        <span aria-hidden="true">{d}</span>
                      </label>
                    ))}
                    <span className="sz-habits-quick">
                      {(
                        [
                          [T.every, ALL],
                          [T.work, WORK],
                          [T.weekend, WEEKEND],
                        ] as const
                      ).map(([label, days]) => (
                        <button
                          key={label}
                          type="button"
                          className="btn ghost small"
                          aria-pressed={sameDays(it.days, days)}
                          onClick={() => setItem(i, { days: [...days] })}
                        >
                          {label}
                        </button>
                      ))}
                    </span>
                  </div>
                </fieldset>
              </div>
              <span className="tools">
                <button type="button" aria-label={T.up(i + 1)} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label={T.down(i + 1)} disabled={i === value.items.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button type="button" aria-label={T.remove(i + 1)} onClick={() => remove(i)}>
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
        <div className="row">
          <button type="button" className="btn ghost" disabled={full} onClick={() => add(newHabit())}>
            {T.add}
          </button>
          {full ? <span className="small soft">{T.max(MAX_HABITS)}</span> : null}
        </div>
      </div>

      <div className="stack sz-habits-presets">
        <h3>{T.presets}</h3>
        <p className="small soft">{T.presetsHint}</p>
        <div className="row">
          {HABIT_PRESETS.map((p) => {
            const name = [p.label, p.dose].filter(Boolean).join(' ');
            return (
              <button key={p.label} type="button" className="btn ghost small" aria-label={T.presetAdd(name)} disabled={full || has(p)} onClick={() => add(p)}>
                + {name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="field">
          <label htmlFor="habits-until">
            <span className="sz-habits-strong">{T.until}</span>
          </label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="habits-until" type="date" aria-describedby="habits-until-hint" value={value.until ?? ''} onChange={(e) => set({ until: e.target.value || null })} />
            {value.until ? (
              <button type="button" className="btn ghost small" onClick={() => set({ until: null })}>
                {T.clearUntil}
              </button>
            ) : null}
          </div>
          <p id="habits-until-hint" className="hint">
            {T.untilHint}
          </p>
        </div>
      </div>

      <label className="field">
        <span>{T.note}</span>
        <textarea id="habits-note" maxLength={2000} placeholder={T.notePh} value={value.note} onChange={(e) => set({ note: e.target.value })} />
      </label>

      {problems.errors.length || problems.warnings.length ? (
        <div className={`note ${problems.errors.length ? 'gold' : 'warn'} sz-habits-problems`} role="status" aria-live="polite">
          <strong>{T.before}</strong>
          <ul>
            {[...problems.errors, ...problems.warnings].map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Ta sama decyzja co `bodyReady` — dla testów i dla tych, którzy wolą jedno pytanie. */
export const habitsReady = (b: HabitsBody): boolean => cleanHabits(b as unknown as Record<string, unknown>) !== null;
