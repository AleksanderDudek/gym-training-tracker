import { useId, useMemo, useState } from 'react';
import { plural } from '@gt/food/lib/format';
import { LOCALE, pluralEn, text } from '@gt/i18n';
import type { LibraryItem, LibraryKind, ProgramBody, ProgramStep } from '../../lib/data';
import { LIBRARY_KINDS } from '../../lib/data';
import { L } from '../../lib/labels';
import { DEFAULT_TIME, MAX_DAY, MAX_STEPS, MAX_WEEK, dayOf, duplicateWeek, isMissing, parseTime, programSummary, sortSteps, weekOf, weeksOf } from '../../lib/program';
import './program.css';

/**
 * Kreator programu: oś dni, na której leżą elementy biblioteki („dzień 1, 7:00 → trening A”).
 * Program nie jedzie do telefonu w całości — „Uruchom program” rozpisuje go na zalecenia z datą
 * „pokaż od” (`LaunchProgram.tsx`). Dzień w danych liczy się od 0, prowadzący widzi go od 1.
 */

const T = text({
  pl: {
    lead: 'Program to oś dni: każdy krok to element twojej biblioteki, który podopieczny dostanie danego dnia o danej godzinie. Tygodnie liczą się od dnia startu.',
    sum: (w: number, n: number) => `${w} ${plural(w, 'tydzień', 'tygodnie', 'tygodni')} · ${n} ${plural(n, 'krok', 'kroki', 'kroków')}`,
    empty: 'Program jest pusty. Dodaj pierwszy krok niżej: dzień, godzinę i element z biblioteki.',
    missing: (n: number) =>
      `${n} ${plural(n, 'krok odsyła', 'kroki odsyłają', 'kroków odsyła')} do elementów, których nie ma już w bibliotece. Usuń je albo podmień — przy uruchomieniu zostaną pominięte.`,
    week: (n: number) => `Tydzień ${n}`,
    days: (a: number, b: number) => `dni ${a}–${b}`,
    copy: (n: number) => `Powiel do tygodnia ${n}`,
    copied: (n: number, w: number) => `Dodano ${n} ${plural(n, 'krok', 'kroki', 'kroków')} do tygodnia ${w}.`,
    copiedNone: (w: number) => `Tydzień ${w} ma już te kroki.`,
    copiedDropped: (n: number) => `${n} ${plural(n, 'krok nie zmieścił', 'kroki nie zmieściły', 'kroków nie zmieściło')} się w programie.`,
    day: (n: number) => `Dzień ${n}`,
    notInLib: 'Brak w bibliotece',
    edit: 'Zmień krok',
    remove: 'Usuń krok',
    newStep: 'Nowy krok',
    editStep: 'Zmiana kroku',
    weekField: 'Tydzień',
    weekdayField: 'Dzień tygodnia',
    weekdayOpt: (n: number) => (n === 1 ? '1 (jak dzień startu)' : String(n)),
    dayField: 'Dzień programu',
    eq: (d: number) => `= dzień ${d} programu`,
    weekHint: 'Uruchomisz program w poniedziałek — dzień 1 każdego tygodnia to poniedziałek.',
    time: 'Godzina',
    item: 'Element biblioteki',
    pickItem: 'Wybierz…',
    noItems: 'W bibliotece nie ma jeszcze nic do wysłania. Zapisz najpierw trening, plan, formularz albo zalecenie.',
    add: 'Dodaj krok',
    save: 'Zapisz krok',
    cancel: 'Anuluj',
    needItem: 'Wybierz element biblioteki.',
    needTime: 'Wpisz godzinę (GG:MM).',
    dup: 'Taki krok już jest.',
    full: `Najwyżej ${MAX_STEPS} kroków w programie.`,
    note: 'Notatka do programu (tylko dla ciebie)',
  },
  en: {
    lead: 'A program is a timeline: each step is an item from your library the client gets on a given day at a given time. Weeks count from the start day.',
    sum: (w: number, n: number) => `${w} ${pluralEn(w, 'week', 'weeks')} · ${n} ${pluralEn(n, 'step', 'steps')}`,
    empty: 'The program is empty. Add the first step below: day, time and a library item.',
    missing: (n: number) =>
      `${n} ${pluralEn(n, 'step points', 'steps point')} to items no longer in the library. Remove or replace them — they will be skipped at launch.`,
    week: (n: number) => `Week ${n}`,
    days: (a: number, b: number) => `days ${a}–${b}`,
    copy: (n: number) => `Copy to week ${n}`,
    copied: (n: number, w: number) => `Added ${n} ${pluralEn(n, 'step', 'steps')} to week ${w}.`,
    copiedNone: (w: number) => `Week ${w} already has these steps.`,
    copiedDropped: (n: number) => `${n} ${pluralEn(n, 'step did', 'steps did')} not fit in the program.`,
    day: (n: number) => `Day ${n}`,
    notInLib: 'Not in the library',
    edit: 'Edit step',
    remove: 'Remove step',
    newStep: 'New step',
    editStep: 'Editing a step',
    weekField: 'Week',
    weekdayField: 'Day of week',
    weekdayOpt: (n: number) => (n === 1 ? '1 (same as start day)' : String(n)),
    dayField: 'Program day',
    eq: (d: number) => `= program day ${d}`,
    weekHint: 'Launch the program on a Monday and day 1 of every week is a Monday.',
    time: 'Time',
    item: 'Library item',
    pickItem: 'Pick…',
    noItems: 'Nothing sendable in the library yet. Save a workout, plan, form or advice first.',
    add: 'Add step',
    save: 'Save step',
    cancel: 'Cancel',
    needItem: 'Pick a library item.',
    needTime: 'Enter a time (HH:MM).',
    dup: 'This step already exists.',
    full: `At most ${MAX_STEPS} steps in a program.`,
    note: 'Program note (only for you)',
  },
});

export const emptyProgram = (): ProgramBody => ({ kind: 'program', steps: [], note: '' });

/** Liczba wpisywana z klawiatury: pole może być chwilę puste, wartość idzie dalej dopiero poprawna. */
function NumInput({ id, value, min, max, onValue }: { id: string; value: number; min: number; max: number; onValue: (n: number) => void }) {
  const [txt, setTxt] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setTxt(String(value));
  }
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={txt}
      onChange={(e) => {
        const raw = e.target.value;
        setTxt(raw);
        const n = Number(raw);
        if (raw === '' || !Number.isInteger(n)) return;
        const c = Math.min(max, Math.max(min, n));
        if (c !== n) setTxt(String(c));
        setSeen(c);
        onValue(c);
      }}
      onBlur={() => setTxt(String(value))}
    />
  );
}

type Draft = { day: number; time: string; itemId: string };

export function ProgramForm({ value, onChange, items }: { value: ProgramBody; onChange: (v: ProgramBody) => void; items: LibraryItem[] }) {
  const uid = useId();
  const steps = useMemo(() => sortSteps(value.steps), [value.steps]);
  const weeks = useMemo(() => weeksOf(value.steps), [value.steps]);
  const sum = useMemo(() => programSummary(value.steps, items), [value.steps, items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const sendable = useMemo(
    () =>
      LIBRARY_KINDS.filter((k) => k !== 'program')
        .map((k) => ({ kind: k, items: items.filter((i) => i.kind === k).sort((a, b) => a.title.localeCompare(b.title, LOCALE)) }))
        .filter((g) => g.items.length),
    [items],
  );
  const [draft, setDraft] = useState<Draft>({ day: 0, time: DEFAULT_TIME, itemId: '' });
  const [editing, setEditing] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const setSteps = (next: ProgramStep[]) => onChange({ ...value, steps: sortSteps(next) });
  const { week, weekday } = weekOf(draft.day);
  const upd = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErr(null);
  };

  const commit = () => {
    if (!draft.itemId) return setErr(T.needItem);
    if (!parseTime(draft.time)) return setErr(T.needTime);
    const step: ProgramStep = { day: draft.day, time: draft.time, itemId: draft.itemId };
    const others = steps.filter((_, i) => i !== editing);
    if (others.some((s) => s.day === step.day && s.time === step.time && s.itemId === step.itemId)) return setErr(T.dup);
    if (editing === null && steps.length >= MAX_STEPS) return setErr(T.full);
    setSteps([...others, step]);
    setEditing(null);
    setErr(null);
    setMsg(null);
  };

  const remove = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
    if (editing === index) setEditing(null);
    else if (editing !== null && editing > index) setEditing(editing - 1);
  };

  const copyWeek = (w: number) => {
    const r = duplicateWeek(value.steps, w);
    onChange({ ...value, steps: r.steps });
    setEditing(null);
    setMsg([r.added ? T.copied(r.added, w + 1) : T.copiedNone(w + 1), r.dropped ? T.copiedDropped(r.dropped) : ''].filter(Boolean).join(' '));
  };

  return (
    <div className="sz-prog">
      <p className="small soft">{T.lead}</p>
      {steps.length ? (
        <div className="sz-prog-sum">
          <strong>{T.sum(sum.weeks, steps.length)}</strong>
          <span className="small soft">{sum.byKind.map(([k, n]) => `${L.kind[k]} × ${n}`).join(' · ')}</span>
        </div>
      ) : null}
      {sum.missing ? (
        <div className="note warn" role="alert">
          {T.missing(sum.missing)}
        </div>
      ) : null}
      {msg ? (
        <p className="small" role="status">
          {msg}
        </p>
      ) : null}

      {!steps.length ? <p className="soft">{T.empty}</p> : null}
      <div className="sz-prog-weeks">
        {weeks.map((g) => (
          <section key={g.week} className="sz-prog-week" aria-labelledby={`${uid}-w${g.week}`}>
            <header>
              <span>
                <h3 id={`${uid}-w${g.week}`} style={{ display: 'inline' }}>
                  {T.week(g.week)}
                </h3>{' '}
                <span className="small soft">{T.days((g.week - 1) * 7 + 1, g.week * 7)}</span>
              </span>
              {g.week < MAX_WEEK ? (
                <button type="button" className="btn ghost small" onClick={() => copyWeek(g.week)}>
                  {T.copy(g.week + 1)}
                </button>
              ) : null}
            </header>
            <ol>
              {g.steps.map(({ step, index }) => {
                const item = byId.get(step.itemId);
                const gone = isMissing(step, items);
                return (
                  <li key={`${index}-${step.day}-${step.time}-${step.itemId}`} className={`sz-prog-step${editing === index ? ' editing' : ''}`}>
                    <span className="day">{T.day(step.day + 1)}</span>
                    <span className="time">{step.time}</span>
                    <span className="what">
                      {gone ? (
                        <span className="missing">{T.notInLib}</span>
                      ) : (
                        <>
                          <span className="chip">{L.kind[item!.kind]}</span>
                          <strong>{item!.title}</strong>
                        </>
                      )}
                    </span>
                    <span className="tools">
                      <button
                        type="button"
                        aria-label={`${T.edit}: ${T.day(step.day + 1)}, ${step.time}`}
                        onClick={() => {
                          setEditing(index);
                          setDraft({ day: step.day, time: step.time, itemId: gone ? '' : step.itemId });
                          setErr(null);
                        }}
                      >
                        ✎
                      </button>
                      <button type="button" aria-label={`${T.remove}: ${T.day(step.day + 1)}, ${step.time}`} onClick={() => remove(index)}>
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <fieldset className="sz-prog-form">
        <legend>{editing === null ? T.newStep : T.editStep}</legend>
        <div className="sz-prog-when">
          <label className="field">
            <span>{T.weekField}</span>
            <NumInput id={`${uid}-week`} value={week} min={1} max={MAX_WEEK} onValue={(w) => upd({ day: dayOf(w, weekday) })} />
          </label>
          <label className="field">
            <span>{T.weekdayField}</span>
            <select id={`${uid}-weekday`} value={weekday} onChange={(e) => upd({ day: dayOf(week, Number(e.target.value)) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n} disabled={dayOf(week, n) !== (week - 1) * 7 + n - 1}>
                  {T.weekdayOpt(n)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{T.dayField}</span>
            <NumInput id={`${uid}-day`} value={draft.day + 1} min={1} max={MAX_DAY + 1} onValue={(d) => upd({ day: d - 1 })} />
          </label>
          <label className="field">
            <span>{T.time}</span>
            <input id={`${uid}-time`} type="time" value={draft.time} onChange={(e) => upd({ time: e.target.value })} />
          </label>
        </div>
        <p className="sz-prog-eq">
          {T.eq(draft.day + 1)} · {T.weekHint}
        </p>
        {sendable.length ? (
          <label className="field">
            <span>{T.item}</span>
            <select id={`${uid}-item`} value={draft.itemId} onChange={(e) => upd({ itemId: e.target.value })}>
              <option value="">{T.pickItem}</option>
              {sendable.map((g) => (
                <optgroup key={g.kind} label={L.kind[g.kind as LibraryKind]}>
                  {g.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ) : (
          <p className="note">{T.noItems}</p>
        )}
        {err ? (
          <p className="err" role="alert">
            {err}
          </p>
        ) : null}
        <div className="row">
          <button type="button" className="btn ghost" onClick={commit} disabled={!sendable.length}>
            {editing === null ? T.add : T.save}
          </button>
          {editing !== null ? (
            <button
              type="button"
              className="btn link"
              onClick={() => {
                setEditing(null);
                setErr(null);
              }}
            >
              {T.cancel}
            </button>
          ) : null}
        </div>
      </fieldset>

      <label className="field">
        <span>{T.note}</span>
        <textarea id={`${uid}-note`} maxLength={2000} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </label>
    </div>
  );
}
