import { useState } from 'react';
import type { FormEvent } from 'react';
import { addDays, cleanAnswers, localDay, weekdayOf } from '@gymtracker/link/coaching';
import type { AnswerValue } from '@gymtracker/link/coaching';
import type { FormBody, FormQuestion } from '@gymtracker/link';
import { LOCALE, text } from '../../i18n';
import { answersOf, useLink } from '../../link/store';
import type { StoredAnswer } from '../../link/store';
import { saveAnswer, setAssignmentStatus } from '../../link/sync';
import { periodToday } from '../../link/today';
import type { Coached } from '../../link/today';
import type { AppState } from '../../types';
import './form.css';

/**
 * Formularz od prowadzącego na stronie zalecenia: pytania, odpowiedź za dzisiejszy okres (raz,
 * dzień albo tydzień ISO — `formPeriod`), poprawka tego okresu i historia wcześniejszych.
 *
 * Odpowiedź sprawdza `cleanAnswers` — ta sama funkcja, którą Sztab czyta ją z paczki. Zapis
 * (`saveAnswer`) zostaje na telefonie i idzie do prowadzącego w części `coaching` paczki kilka
 * sekund później. Liczby jak w reszcie aplikacji: pole tekstowe z klawiaturą dziesiętną
 * (`inputMode="decimal"`), bo `type=number` gubi polski przecinek w Safari.
 */

const T = text({
  pl: {
    intake: 'Wywiad na start',
    intakeText: 'Odpowiedz, zanim zaczniecie — prowadzący dobierze plan do twoich odpowiedzi. Ten formularz zostaje na ekranie Dziś, dopóki nie wyślesz odpowiedzi.',
    every: { once: 'Jednorazowo', daily: 'Codziennie' } as Record<'once' | 'daily', string>,
    weekly: (wd: string) => `Co tydzień, od ${wd}`,
    weekdays: ['poniedziałku', 'wtorku', 'środy', 'czwartku', 'piątku', 'soboty', 'niedzieli'],
    on: (wd: string, date: string) => `od ${wd}, ${date}`,
    periodDaily: (d: string) => `Odpowiedź za dziś, ${d}`,
    periodWeekly: (d: string) => `Odpowiedź za ten tydzień (${d})`,
    early: (when: string) => `Na ten tydzień czeka ${when} — możesz odpowiedzieć już teraz.`,
    requiredNote: 'Pytania z gwiazdką (*) są wymagane.',
    required: '(wymagane)',
    missing: 'Odpowiedz na to pytanie.',
    number: 'Wpisz liczbę.',
    between: (lo: string, hi: string) => `Wpisz liczbę od ${lo} do ${hi}.`,
    atLeast: (lo: string) => `Wpisz liczbę nie mniejszą niż ${lo}.`,
    atMost: (hi: string) => `Wpisz liczbę nie większą niż ${hi}.`,
    range: (lo: string, hi: string) => `od ${lo} do ${hi}`,
    fix: 'Uzupełnij zaznaczone pytania.',
    send: 'Wyślij odpowiedź',
    update: 'Wyślij poprawkę',
    cancel: 'Anuluj',
    saved: 'Odpowiedź zapisana — idzie do prowadzącego.',
    done: {
      once: 'Odpowiedź poszła do prowadzącego',
      daily: 'Odpowiedź za dziś poszła do prowadzącego',
      weekly: 'Odpowiedź za ten tydzień poszła do prowadzącego',
    } as Record<FormBody['repeat'], string>,
    answeredAt: (d: string) => `Wysłana ${d}.`,
    edit: 'Popraw odpowiedź',
    editHint: {
      once: 'Poprawka zastąpi poprzednią odpowiedź.',
      daily: 'Poprawka z dzisiaj zastąpi poprzednią.',
      weekly: 'Do niedzieli poprawka zastąpi poprzednią.',
    } as Record<FormBody['repeat'], string>,
    nextDaily: 'Następna odpowiedź — jutro.',
    nextWeekly: (when: string) => `Następna odpowiedź ${when}.`,
    history: (n: number) => `Wcześniejsze odpowiedzi (${n})`,
    yes: 'Tak',
    no: 'Nie',
  },
  en: {
    intake: 'Starting interview',
    intakeText: 'Answer before you start — your coach will fit the plan to your answers. This form stays on the Today screen until you send your answer.',
    every: { once: 'Once', daily: 'Daily' } as Record<'once' | 'daily', string>,
    weekly: (wd: string) => `Weekly, from ${wd}`,
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    on: (wd: string, date: string) => `from ${wd}, ${date}`,
    periodDaily: (d: string) => `Answer for today, ${d}`,
    periodWeekly: (d: string) => `Answer for this week (${d})`,
    early: (when: string) => `This week’s answer is due ${when} — you can answer now already.`,
    requiredNote: 'Questions marked with an asterisk (*) are required.',
    required: '(required)',
    missing: 'Please answer this question.',
    number: 'Enter a number.',
    between: (lo: string, hi: string) => `Enter a number from ${lo} to ${hi}.`,
    atLeast: (lo: string) => `Enter a number of at least ${lo}.`,
    atMost: (hi: string) => `Enter a number of at most ${hi}.`,
    range: (lo: string, hi: string) => `from ${lo} to ${hi}`,
    fix: 'Complete the marked questions.',
    send: 'Send answer',
    update: 'Send correction',
    cancel: 'Cancel',
    saved: 'Answer saved — it is on its way to your coach.',
    done: {
      once: 'Your answer went to your coach',
      daily: 'Today’s answer went to your coach',
      weekly: 'This week’s answer went to your coach',
    } as Record<FormBody['repeat'], string>,
    answeredAt: (d: string) => `Sent ${d}.`,
    edit: 'Correct the answer',
    editHint: {
      once: 'A correction replaces the earlier answer.',
      daily: 'A correction today replaces the earlier one.',
      weekly: 'Until Sunday a correction replaces the earlier one.',
    } as Record<FormBody['repeat'], string>,
    nextDaily: 'Next answer — tomorrow.',
    nextWeekly: (when: string) => `Next answer ${when}.`,
    history: (n: number) => `Earlier answers (${n})`,
    yes: 'Yes',
    no: 'No',
  },
});

/* ── Daty okresów (UTC na samych datach, jak w protokole) ──────────────────────────── */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WEEK = /^(\d{4})-W(\d{2})$/;
const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const mondayOf = (day: string) => addDays(day, 1 - weekdayOf(day));

function periodStart(period: string): string | null {
  if (DAY.test(period)) return period;
  const m = period.match(WEEK);
  return m ? addDays(mondayOf(`${m[1]}-01-04`), (Number(m[2]) - 1) * 7) : null;
}

/** „23–29 lis” dla tygodnia, „25 lis” dla dnia. */
function periodText(period: string): string {
  const start = periodStart(period);
  if (!start) return '';
  const f = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return DAY.test(period) ? f.format(utc(start)) : f.formatRange(utc(start), utc(addDays(start, 6)));
}

const longDate = (day: string) => new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utc(day));
/** „od czwartku, 26 listopada”. */
const fromDay = (day: string) => T.on(T.weekdays[weekdayOf(day) - 1]!, longDate(day));
const fmtNum = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: 6, useGrouping: false });

/* ── Szkic odpowiedzi ──────────────────────────────────────────────────────────────── */

/** Stan pól: liczba jako wpisany tekst (z przecinkiem), reszta już w kształcie odpowiedzi. */
type Draft = Record<string, string | number | boolean | number[] | null>;

function toDraft(form: FormBody, values: Record<string, AnswerValue> | undefined): Draft {
  const out: Draft = {};
  for (const q of form.questions) {
    const v = values?.[q.id] ?? null;
    if (q.type === 'number') out[q.id] = typeof v === 'number' ? fmtNum(v) : '';
    else if (q.type === 'text') out[q.id] = typeof v === 'string' ? v : '';
    else if (q.type === 'multi') out[q.id] = Array.isArray(v) ? v : [];
    else out[q.id] = v as Draft[string];
  }
  return out;
}

function toRaw(form: FormBody, draft: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of form.questions) {
    const v = draft[q.id];
    if (q.type === 'number') {
      const t = typeof v === 'string' ? v.trim().replace(',', '.') : '';
      out[q.id] = t === '' ? null : Number(t);
    } else out[q.id] = v;
  }
  return out;
}

const filled = (q: FormQuestion, v: Draft[string] | undefined): boolean =>
  q.type === 'text' || q.type === 'number' ? typeof v === 'string' && v.trim() !== '' : q.type === 'multi' ? Array.isArray(v) && v.length > 0 : v !== null && v !== undefined;

function numberProblem(q: FormQuestion): string {
  const lo = q.min !== null ? fmtNum(q.min) : null;
  const hi = q.max !== null ? fmtNum(q.max) : null;
  return lo && hi ? T.between(lo, hi) : lo ? T.atLeast(lo) : hi ? T.atMost(hi) : T.number;
}

/** Pytania, które trzeba poprawić: wymagane bez odpowiedzi i liczby spoza zakresu. */
function problems(form: FormBody, draft: Draft): Record<string, string> {
  const clean = cleanAnswers(form, toRaw(form, draft), { partial: true }) ?? {};
  const out: Record<string, string> = {};
  for (const q of form.questions) {
    const has = filled(q, draft[q.id]);
    if (has && (clean[q.id] ?? null) === null) out[q.id] = q.type === 'number' ? numberProblem(q) : T.missing;
    else if (!has && q.required) out[q.id] = T.missing;
  }
  return out;
}

/** Odpowiedź słowami — do potwierdzenia i historii. */
function answerText(q: FormQuestion, v: AnswerValue | undefined): string {
  if (v === null || v === undefined) return '—';
  switch (q.type) {
    case 'choice':
      return typeof v === 'number' ? (q.options[v] ?? '—') : '—';
    case 'multi':
      return Array.isArray(v) ? v.map((i) => q.options[i]).filter(Boolean).join(', ') || '—' : '—';
    case 'yesno':
      return v === true ? T.yes : v === false ? T.no : '—';
    case 'number':
      return typeof v === 'number' ? `${v.toLocaleString(LOCALE, { maximumFractionDigits: 2 })}${q.unit ? ` ${q.unit}` : ''}` : '—';
    case 'scale':
      return typeof v === 'number' ? `${v} / ${q.max ?? 10}` : '—';
    case 'text':
      return typeof v === 'string' && v ? v : '—';
  }
}

/* ── Strona ────────────────────────────────────────────────────────────────────────── */

export function FormAssignment({ stored, state, onToast }: { stored: Coached<FormBody>; state: AppState; onToast: (m: string) => void }) {
  const s = useLink();
  const form = stored.a.body;
  const today = localDay();
  const period = periodToday(form, today);
  const mine = answersOf(s, stored.id);
  const current = mine.find((a) => a.period === period) ?? null;
  const history = mine.filter((a) => a.period !== period).sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(form, undefined));
  const [tried, setTried] = useState(false);
  const uid = `f${stored.id.replace(/[^\w-]/g, '').slice(0, 12)}`;
  const open = editing || !current;
  const errors = tried ? problems(form, draft) : {};

  const wd = form.weekday ?? 1;
  const dueThis = addDays(mondayOf(today), wd - 1);
  const every = form.repeat === 'weekly' ? T.weekly(T.weekdays[wd - 1]!) : T.every[form.repeat];
  const periodLine = form.repeat === 'daily' ? T.periodDaily(longDate(today)) : form.repeat === 'weekly' ? T.periodWeekly(periodText(period)) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const bad = problems(form, draft);
    const values = cleanAnswers(form, toRaw(form, draft));
    if (Object.keys(bad).length || !values) {
      setTried(true);
      const first = form.questions.find((q) => bad[q.id]);
      if (first) document.getElementById(`${uid}-${first.id}`)?.focus();
      return;
    }
    saveAnswer(stored, period, values, () => state);
    void setAssignmentStatus(stored.id, form.repeat === 'once' ? 'done' : 'started');
    setEditing(false);
    setTried(false);
    onToast(T.saved);
  };

  const startEdit = (a: StoredAnswer) => {
    setDraft(toDraft(form, a.values));
    setTried(false);
    setEditing(true);
  };

  return (
    <>
      {form.intake && !current ? (
        <div className="grp lk-form-intake">
          <h2>{T.intake}</h2>
          <p>{T.intakeText}</p>
        </div>
      ) : null}
      <div className="grp">
        <p className="tight lk-form-every">
          {every}
          {periodLine ? ` · ${periodLine}` : ''}
        </p>
        {form.intro ? <p className="link-text lk-form-intro">{form.intro}</p> : null}
        {form.repeat === 'weekly' && !current && today < dueThis ? <p className="tight">{T.early(fromDay(dueThis))}</p> : null}
      </div>

      {open ? (
        <form className="grp lk-form" onSubmit={submit} noValidate aria-label={form.title}>
          {form.questions.some((q) => q.required) ? <p className="hint">{T.requiredNote}</p> : null}
          {form.questions.map((q) => (
            <Question
              key={q.id}
              q={q}
              id={`${uid}-${q.id}`}
              value={draft[q.id] ?? null}
              error={errors[q.id] ?? null}
              onChange={(v) => setDraft((d) => ({ ...d, [q.id]: v }))}
            />
          ))}
          {tried && Object.keys(errors).length ? (
            <p className="link-error lk-form-fix" role="alert">
              {T.fix}
            </p>
          ) : null}
          <div className="btnrow lk-form-actions">
            <button className="btn" type="submit">
              {current ? T.update : T.send}
            </button>
            {current ? (
              <button className="btn ghost" type="button" onClick={() => setEditing(false)}>
                {T.cancel}
              </button>
            ) : null}
          </div>
          {current ? <p className="hint lk-form-edit-hint">{T.editHint[form.repeat]}</p> : null}
        </form>
      ) : (
        <div className="grp lk-form-done" role="status">
          <h2>
            <span className="lk-form-ok" aria-hidden="true">
              ✓
            </span>{' '}
            {T.done[form.repeat]}
          </h2>
          <p className="tight">{T.answeredAt(new Date(current!.at).toLocaleString(LOCALE, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</p>
          <Summary form={form} values={current!.values} />
          {form.repeat === 'daily' ? <p className="tight">{T.nextDaily}</p> : null}
          {form.repeat === 'weekly' ? <p className="tight">{T.nextWeekly(fromDay(addDays(dueThis, 7)))}</p> : null}
          <button className="btn ghost sm lk-form-editbtn" type="button" onClick={() => startEdit(current!)}>
            {T.edit}
          </button>
        </div>
      )}

      {history.length ? (
        <details className="grp lk-form-history">
          <summary className="link-summary">{T.history(history.length)}</summary>
          {history.map((a) => (
            <div key={a.period} className="lk-form-past">
              <h3>{periodText(a.period)}</h3>
              <Summary form={form} values={a.values} />
            </div>
          ))}
        </details>
      ) : null}
    </>
  );
}

function Summary({ form, values }: { form: FormBody; values: Record<string, AnswerValue> }) {
  const clean = cleanAnswers(form, values, { partial: true }) ?? {};
  return (
    <dl className="lk-form-sum">
      {form.questions.map((q) => (
        <div key={q.id}>
          <dt>{q.label}</dt>
          <dd>{answerText(q, clean[q.id])}</dd>
        </div>
      ))}
    </dl>
  );
}

function Question({
  q,
  id,
  value,
  error,
  onChange,
}: {
  q: FormQuestion;
  id: string;
  value: Draft[string];
  error: string | null;
  onChange: (v: Draft[string]) => void;
}) {
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const describedBy = [q.help ? helpId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined;
  const label = (
    <>
      {q.label}
      {q.required ? (
        <>
          {' '}
          <span className="lk-form-req" aria-hidden="true">
            *
          </span>
          <span className="sr-only">{T.required}</span>
        </>
      ) : null}
    </>
  );
  const help = q.help ? (
    <p className="lk-form-help" id={helpId}>
      {q.help}
    </p>
  ) : null;
  const err = error ? (
    <p className="lk-form-err" id={errId}>
      {error}
    </p>
  ) : null;
  const invalid = error ? true : undefined;

  switch (q.type) {
    case 'text':
      return (
        <div className="lk-form-q">
          <label className="lk-form-label" htmlFor={id}>
            {label}
          </label>
          {help}
          <textarea
            id={id}
            rows={3}
            maxLength={2000}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {err}
        </div>
      );
    case 'number': {
      const range = q.min !== null && q.max !== null ? T.range(fmtNum(q.min), fmtNum(q.max)) : null;
      return (
        <div className="lk-form-q">
          <label className="lk-form-label" htmlFor={id}>
            {label}
          </label>
          {help}
          <div className="lk-form-num">
            <input
              id={id}
              type="text"
              inputMode="decimal"
              className="num"
              autoComplete="off"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              placeholder={range ?? ''}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
            />
            {q.unit ? <span>{q.unit}</span> : null}
          </div>
          {err}
        </div>
      );
    }
    case 'scale': {
      const min = q.min ?? 0;
      const max = q.max ?? 10;
      const steps = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
      return (
        <fieldset className="lk-form-q" aria-describedby={describedBy}>
          <legend className="lk-form-label">{label}</legend>
          {help}
          <div className="lk-form-scale">
            {steps.map((n, i) => (
              <label key={n} className="lk-form-tile">
                <input
                  id={i === 0 ? id : `${id}-${i}`}
                  type="radio"
                  name={id}
                  value={n}
                  checked={value === n}
                  aria-invalid={invalid}
                  onChange={() => onChange(n)}
                />
                <span>{n}</span>
              </label>
            ))}
          </div>
          {err}
        </fieldset>
      );
    }
    case 'choice':
    case 'multi': {
      const multi = q.type === 'multi';
      const picked = multi ? (Array.isArray(value) ? value : []) : null;
      return (
        <fieldset className="lk-form-q" aria-describedby={describedBy}>
          <legend className="lk-form-label">{label}</legend>
          {help}
          {q.options.map((o, i) => (
            <label key={i} className="check-row lk-form-opt">
              <input
                id={i === 0 ? id : `${id}-${i}`}
                type={multi ? 'checkbox' : 'radio'}
                name={id}
                value={i}
                aria-invalid={invalid}
                checked={multi ? picked!.includes(i) : value === i}
                onChange={(e) =>
                  onChange(multi ? (e.target.checked ? [...picked!, i].sort((a, b) => a - b) : picked!.filter((x) => x !== i)) : i)
                }
              />
              <span>{o}</span>
            </label>
          ))}
          {err}
        </fieldset>
      );
    }
    case 'yesno':
      return (
        <div className="lk-form-q" role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
          <p className="lk-form-label" id={`${id}-label`}>
            {label}
          </p>
          {help}
          <div className="seg lk-form-yn">
            {([true, false] as const).map((b) => (
              <button
                key={String(b)}
                id={b ? id : `${id}-no`}
                type="button"
                aria-pressed={value === b}
                onClick={() => onChange(value === b ? null : b)}
              >
                {b ? T.yes : T.no}
              </button>
            ))}
          </div>
          {err}
        </div>
      );
  }
}
