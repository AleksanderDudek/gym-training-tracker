import { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTION_TYPES } from '@gymtracker/link';
import type { FormBody, FormQuestion, FormRepeat, QuestionType } from '@gymtracker/link';
import { plural } from '@gt/engine/quips';
import { text } from '@gt/i18n';
import { FORM_TEMPLATES, MAX_OPTIONS, MAX_QUESTIONS, MIN_OPTIONS, duplicateQuestion, formIssues, fromTemplate, moveQuestion, newQuestion, retype } from '../../lib/forms';
import type { FormTemplate } from '../../lib/forms';
import './FormEditor.css';

/**
 * Kreator formularza: wywiad na start, check-in, skala bólu, własne mierniki. Pytania mają stałe
 * numery (`q1`, `q2`…) — odpowiedź trzyma numer, nie treść, więc przestawianie i poprawki treści
 * nie mieszają historii. Sprawdzenie na żywo to `cleanForm`, ta sama funkcja co na telefonie;
 * podgląd obok pokazuje, jak formularz wygląda u podopiecznego.
 */

const T = text({
  pl: {
    templates: 'Zacznij od gotowego',
    templatesHint: 'Gotowy formularz to punkt wyjścia — każde pytanie zmienisz, dodasz albo usuniesz.',
    questionsN: (n: number) => `${n} ${plural(n, ['pytanie', 'pytania', 'pytań'])}`,
    repeatShort: { once: 'jednorazowo', daily: 'codziennie', weekly: 'co tydzień' } as Record<FormRepeat, string>,
    replace: (name: string) => `Zastąpić obecny formularz wzorem „${name}”? Twoje pytania znikną.`,
    replaceYes: 'Zastąp',
    cancel: 'Anuluj',
    title: 'Tytuł formularza',
    titleHint: 'Podopieczny widzi go na liście zaleceń i na ekranie Dziś.',
    intro: 'Wstęp (opcjonalnie)',
    introHint: 'Po co ten formularz i ile zajmie.',
    repeat: 'Jak często',
    repeats: { once: 'Jednorazowy', daily: 'Codziennie', weekly: 'Co tydzień' } as Record<FormRepeat, string>,
    repeatHint: {
      once: 'Jedna odpowiedź. Podopieczny może ją później poprawić.',
      daily: 'Jedna odpowiedź na dzień — poprawka z tego samego dnia zastępuje poprzednią.',
      weekly: 'Jedna odpowiedź na tydzień (pon.–niedz.). Telefon przypomina od wybranego dnia do niedzieli, a odpowiedzieć można w dowolny dzień tygodnia.',
    } as Record<FormRepeat, string>,
    weekday: 'Czeka od',
    weekdays: ['poniedziałku', 'wtorku', 'środy', 'czwartku', 'piątku', 'soboty', 'niedzieli'],
    intake: 'Wywiad na start',
    intakeHint: 'Telefon pokazuje go na wierzchu, dopóki podopieczny nie odpowie.',
    questions: 'Pytania',
    count: (n: number) => `${n} z ${MAX_QUESTIONS}`,
    noQuestions: 'Dodaj pierwsze pytanie albo zacznij od gotowego formularza.',
    add: 'Dodaj pytanie',
    types: { text: 'Tekst', number: 'Liczba', scale: 'Skala', choice: 'Jeden wybór', multi: 'Kilka wyborów', yesno: 'Tak / nie' } as Record<QuestionType, string>,
    type: (n: number) => `Rodzaj pytania ${n}`,
    label: 'Treść pytania',
    help: 'Podpowiedź (opcjonalnie)',
    helpPh: 'np. rano, na czczo',
    required: 'Wymagane',
    up: (n: number) => `Pytanie ${n} wyżej`,
    down: (n: number) => `Pytanie ${n} niżej`,
    duplicate: 'Duplikuj',
    duplicateN: (n: number) => `Duplikuj pytanie ${n}`,
    remove: 'Usuń',
    removeN: (n: number) => `Usuń pytanie ${n}`,
    unit: 'Jednostka (np. kg, h)',
    min: 'Najmniej (opcjonalnie)',
    max: 'Najwięcej (opcjonalnie)',
    from: 'Od',
    to: 'Do',
    scaleHint: (a: number, b: number) => `Telefon pokaże przyciski od ${a} do ${b}. Końce skali opisz w podpowiedzi, np. „0 — wcale, 10 — bardzo”.`,
    options: 'Odpowiedzi do wyboru',
    multiHint: 'Podopieczny może zaznaczyć kilka.',
    option: (n: number) => `Odpowiedź ${n}`,
    removeOption: (n: number) => `Usuń odpowiedź ${n}`,
    addOption: 'Dodaj odpowiedź',
    optionsLimit: `Od ${MIN_OPTIONS} do ${MAX_OPTIONS} odpowiedzi.`,
    todo: (n: number) => `Do uzupełnienia: ${n}`,
    ready: (n: number, req: number) => `Gotowe: ${n} ${plural(n, ['pytanie', 'pytania', 'pytań'])}, wymagane: ${req}.`,
    preview: 'Podgląd na telefonie',
    previewEmpty: 'Tu pojawią się pytania.',
    untitled: 'Bez tytułu',
    intakeBadge: 'Wywiad na start',
    reqMark: 'wymagane',
    yes: 'Tak',
    no: 'Nie',
    send: 'Wyślij odpowiedź',
    every: {
      once: 'Jednorazowo',
      daily: 'Codziennie — odpowiedź za dziś',
      weekly: (wd: string) => `Co tydzień, od ${wd}`,
    },
  },
  en: {
    templates: 'Start from a ready form',
    templatesHint: 'A ready form is a starting point — change, add or remove any question.',
    questionsN: (n: number) => `${n} ${n === 1 ? 'question' : 'questions'}`,
    repeatShort: { once: 'once', daily: 'daily', weekly: 'weekly' } as Record<FormRepeat, string>,
    replace: (name: string) => `Replace the current form with “${name}”? Your questions will be lost.`,
    replaceYes: 'Replace',
    cancel: 'Cancel',
    title: 'Form title',
    titleHint: 'The client sees it in the list and on the Today screen.',
    intro: 'Introduction (optional)',
    introHint: 'What the form is for and how long it takes.',
    repeat: 'How often',
    repeats: { once: 'Once', daily: 'Daily', weekly: 'Weekly' } as Record<FormRepeat, string>,
    repeatHint: {
      once: 'One answer. The client can correct it later.',
      daily: 'One answer a day — a correction on the same day replaces the earlier one.',
      weekly: 'One answer a week (Mon–Sun). The phone reminds from the chosen day until Sunday, and the client can answer on any day of the week.',
    } as Record<FormRepeat, string>,
    weekday: 'Due from',
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    intake: 'Starting interview',
    intakeHint: 'The phone keeps it on top until the client answers.',
    questions: 'Questions',
    count: (n: number) => `${n} of ${MAX_QUESTIONS}`,
    noQuestions: 'Add the first question or start from a ready form.',
    add: 'Add a question',
    types: { text: 'Text', number: 'Number', scale: 'Scale', choice: 'Single choice', multi: 'Multiple choice', yesno: 'Yes / no' } as Record<QuestionType, string>,
    type: (n: number) => `Question ${n} type`,
    label: 'Question text',
    help: 'Hint (optional)',
    helpPh: 'e.g. in the morning, before eating',
    required: 'Required',
    up: (n: number) => `Move question ${n} up`,
    down: (n: number) => `Move question ${n} down`,
    duplicate: 'Duplicate',
    duplicateN: (n: number) => `Duplicate question ${n}`,
    remove: 'Remove',
    removeN: (n: number) => `Remove question ${n}`,
    unit: 'Unit (e.g. kg, h)',
    min: 'Lowest (optional)',
    max: 'Highest (optional)',
    from: 'From',
    to: 'To',
    scaleHint: (a: number, b: number) => `The phone shows buttons from ${a} to ${b}. Describe both ends in the hint, e.g. “0 — not at all, 10 — very”.`,
    options: 'Answers to choose from',
    multiHint: 'The client can tick several.',
    option: (n: number) => `Answer ${n}`,
    removeOption: (n: number) => `Remove answer ${n}`,
    addOption: 'Add answer',
    optionsLimit: `${MIN_OPTIONS} to ${MAX_OPTIONS} answers.`,
    todo: (n: number) => `To complete: ${n}`,
    ready: (n: number, req: number) => `Ready: ${n} ${n === 1 ? 'question' : 'questions'}, ${req} required.`,
    preview: 'Preview on the phone',
    previewEmpty: 'Questions will appear here.',
    untitled: 'Untitled',
    intakeBadge: 'Starting interview',
    reqMark: 'required',
    yes: 'Yes',
    no: 'No',
    send: 'Send answer',
    every: {
      once: 'Once',
      daily: 'Daily — answer for today',
      weekly: (wd: string) => `Weekly, from ${wd}`,
    },
  },
});

export const emptyForm = (): FormBody => ({ kind: 'form', title: '', intro: '', questions: [], repeat: 'once', weekday: null, intake: false });

const numOrNull = (v: string): number | null => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function FormForm({ value, onChange }: { value: FormBody; onChange: (v: FormBody) => void }) {
  // Pole do zaznaczenia po następnym renderze (nowe pytanie, kopia, usunięcie, wzór).
  const focusNext = useRef<string | null>(null);
  const [pending, setPending] = useState<FormTemplate | null>(null);
  const issues = useMemo(() => formIssues(value), [value]);
  const blank = !value.title.trim() && !value.intro.trim() && !value.questions.length;
  const qs = value.questions;

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });
  const setFocus = (id: string) => {
    focusNext.current = id;
  };

  const set = (patch: Partial<FormBody>) => onChange({ ...value, ...patch });
  const setQs = (questions: FormQuestion[]) => set({ questions });
  const setQ = (i: number, patch: Partial<FormQuestion>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setRepeat = (repeat: FormRepeat) =>
    set({ repeat, weekday: repeat === 'weekly' ? (value.weekday ?? 1) : null, intake: repeat === 'once' ? value.intake : false });
  const use = (t: FormTemplate) => {
    onChange(fromTemplate(t));
    setPending(null);
    setFocus('form-title');
  };
  const add = (type: QuestionType) => {
    if (qs.length >= MAX_QUESTIONS) return;
    const q = newQuestion(type, qs);
    setQs([...qs, q]);
    setFocus(`fq-${q.id}-label`);
  };
  const remove = (i: number) => {
    const next = qs.filter((_, j) => j !== i);
    setQs(next);
    const near = next[Math.min(i, next.length - 1)];
    setFocus(near ? `fq-${near.id}-label` : 'fq-add-text');
  };

  return (
    <div className="sz-form">
      <details className="sz-form-templates" open={blank}>
        <summary>
          {T.templates} <span className="soft small">· {FORM_TEMPLATES.length}</span>
        </summary>
        <p className="small soft">{T.templatesHint}</p>
        <div className="sz-form-tpls">
          {FORM_TEMPLATES.map((t) => (
            <button key={t.key} type="button" className="sz-form-tpl" onClick={() => (blank ? use(t) : setPending(t))}>
              <strong>{t.name}</strong>
              <span>{t.desc}</span>
              <span className="soft small">
                {T.questionsN(t.body.questions.length)} · {T.repeatShort[t.body.repeat]}
              </span>
            </button>
          ))}
        </div>
        {pending ? (
          <div className="note gold row between" role="alert">
            <span>{T.replace(pending.name)}</span>
            <span className="row">
              <button type="button" className="btn small" onClick={() => use(pending)}>
                {T.replaceYes}
              </button>
              <button type="button" className="btn ghost small" onClick={() => setPending(null)}>
                {T.cancel}
              </button>
            </span>
          </div>
        ) : null}
      </details>

      <div className="sz-form-layout">
        <div className="stack sz-form-edit">
          <div className="field">
            <label className="sz-form-flabel" htmlFor="form-title">
              {T.title}
            </label>
            <input
              id="form-title"
              type="text"
              maxLength={120}
              aria-describedby="form-title-hint"
              value={value.title}
              onChange={(e) => set({ title: e.target.value })}
            />
            <p className="hint" id="form-title-hint">
              {T.titleHint}
            </p>
          </div>
          <div className="field">
            <label className="sz-form-flabel" htmlFor="form-intro">
              {T.intro}
            </label>
            <textarea id="form-intro" maxLength={2000} rows={3} aria-describedby="form-intro-hint" value={value.intro} onChange={(e) => set({ intro: e.target.value })} />
            <p className="hint" id="form-intro-hint">
              {T.introHint}
            </p>
          </div>

          <fieldset className="sz-form-set">
            <legend>{T.repeat}</legend>
            <div className="row">
              {(['once', 'daily', 'weekly'] as const).map((r) => (
                <label key={r} className="chip sz-form-pick">
                  <input type="radio" name="form-repeat" value={r} checked={value.repeat === r} onChange={() => setRepeat(r)} />
                  {T.repeats[r]}
                </label>
              ))}
            </div>
            <p className="small soft">{T.repeatHint[value.repeat]}</p>
            {value.repeat === 'weekly' ? (
              <label className="field sz-form-narrow">
                <span>{T.weekday}</span>
                <select id="form-weekday" value={value.weekday ?? 1} onChange={(e) => set({ weekday: Number(e.target.value) })}>
                  {T.weekdays.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {value.repeat === 'once' ? (
              <label className="check">
                <input id="form-intake" type="checkbox" checked={value.intake} onChange={(e) => set({ intake: e.target.checked })} />
                <span>
                  {T.intake}
                  <span className="hint">{T.intakeHint}</span>
                </span>
              </label>
            ) : null}
          </fieldset>

          <div className="row between">
            <h3>{T.questions}</h3>
            <span className="small soft num">{T.count(qs.length)}</span>
          </div>
          {!qs.length ? <p className="soft">{T.noQuestions}</p> : null}
          <ol className="sz-form-qs">
            {qs.map((q, i) => (
              <QuestionRow
                key={q.id}
                q={q}
                n={i + 1}
                last={i === qs.length - 1}
                full={qs.length >= MAX_QUESTIONS}
                onChange={(patch) => setQ(i, patch)}
                onType={(type) => setQs(qs.map((x, j) => (j === i ? retype(x, type) : x)))}
                onMove={(d) => setQs(moveQuestion(qs, i, d))}
                onDuplicate={() => {
                  const next = duplicateQuestion(qs, i);
                  setQs(next);
                  if (next[i + 1]) setFocus(`fq-${next[i + 1]!.id}-label`);
                }}
                onRemove={() => remove(i)}
              />
            ))}
          </ol>
          <div className="sz-form-add" role="group" aria-labelledby="fq-add-h">
            <span id="fq-add-h" className="small">
              {T.add}:
            </span>
            {QUESTION_TYPES.map((t) => (
              <button key={t} id={`fq-add-${t}`} type="button" className="btn ghost small" disabled={qs.length >= MAX_QUESTIONS} onClick={() => add(t)}>
                + {T.types[t]}
              </button>
            ))}
          </div>

          <div className={`note ${issues.length ? 'gold' : 'blue'} sz-form-check`}>
            <p role="status">
              <strong>{issues.length ? T.todo(issues.length) : T.ready(qs.length, qs.filter((q) => q.required).length)}</strong>
            </p>
            {issues.length ? (
              <ul>
                {issues.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <FormPreview form={value} />
      </div>
    </div>
  );
}

function QuestionRow({
  q,
  n,
  last,
  full,
  onChange,
  onType,
  onMove,
  onDuplicate,
  onRemove,
}: {
  q: FormQuestion;
  n: number;
  last: boolean;
  full: boolean;
  onChange: (patch: Partial<FormQuestion>) => void;
  onType: (t: QuestionType) => void;
  onMove: (d: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const id = (part: string) => `fq-${q.id}-${part}`;
  return (
    <li className="sz-form-q">
      <div className="sz-form-qhead">
        <span className="sz-form-idx" aria-hidden="true">
          {n}
        </span>
        <label className="sz-form-type">
          <span className="sr">{T.type(n)}</span>
          <select id={id('type')} value={q.type} onChange={(e) => onType(e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {T.types[t]}
              </option>
            ))}
          </select>
        </label>
        <span className="sz-form-tools">
          <button type="button" aria-label={T.up(n)} title={T.up(n)} disabled={n === 1} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" aria-label={T.down(n)} title={T.down(n)} disabled={last} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" aria-label={T.duplicateN(n)} disabled={full} onClick={onDuplicate}>
            {T.duplicate}
          </button>
          <button type="button" aria-label={T.removeN(n)} onClick={onRemove}>
            {T.remove}
          </button>
        </span>
      </div>
      <label className="field">
        <span>
          {T.label} <span className="sr">{n}</span>
        </span>
        <input id={id('label')} type="text" maxLength={200} aria-invalid={!q.label.trim() || undefined} value={q.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <label className="field">
        <span className="small">
          {T.help} <span className="sr">{n}</span>
        </span>
        <input id={id('help')} type="text" maxLength={300} placeholder={T.helpPh} value={q.help} onChange={(e) => onChange({ help: e.target.value })} />
      </label>
      {q.type === 'number' ? (
        <div className="grid cols-3">
          <label className="field">
            <span className="small">{T.unit}</span>
            <input id={id('unit')} type="text" maxLength={12} value={q.unit} onChange={(e) => onChange({ unit: e.target.value })} />
          </label>
          <label className="field">
            <span className="small">{T.min}</span>
            <input id={id('min')} type="number" step="any" value={q.min ?? ''} onChange={(e) => onChange({ min: numOrNull(e.target.value) })} />
          </label>
          <label className="field">
            <span className="small">{T.max}</span>
            <input id={id('max')} type="number" step="any" value={q.max ?? ''} onChange={(e) => onChange({ max: numOrNull(e.target.value) })} />
          </label>
        </div>
      ) : null}
      {q.type === 'scale' ? (
        <div className="stack">
          <div className="grid cols-2 sz-form-narrow2">
            <label className="field">
              <span className="small">{T.from}</span>
              <input id={id('min')} type="number" step={1} value={q.min ?? ''} onChange={(e) => onChange({ min: numOrNull(e.target.value) })} />
            </label>
            <label className="field">
              <span className="small">{T.to}</span>
              <input id={id('max')} type="number" step={1} value={q.max ?? ''} onChange={(e) => onChange({ max: numOrNull(e.target.value) })} />
            </label>
          </div>
          <p className="small soft">{T.scaleHint(q.min ?? 0, q.max ?? 10)}</p>
        </div>
      ) : null}
      {q.type === 'choice' || q.type === 'multi' ? (
        <fieldset className="sz-form-set">
          <legend className="small">{T.options}</legend>
          <ol className="sz-form-options">
            {q.options.map((o, j) => (
              <li key={j}>
                <input
                  id={id(`o${j}`)}
                  type="text"
                  maxLength={80}
                  aria-label={T.option(j + 1)}
                  aria-invalid={!o.trim() || undefined}
                  value={o}
                  onChange={(e) => onChange({ options: q.options.map((x, k) => (k === j ? e.target.value : x)) })}
                />
                <button
                  type="button"
                  className="btn ghost small"
                  aria-label={T.removeOption(j + 1)}
                  disabled={q.options.length <= MIN_OPTIONS}
                  onClick={() => onChange({ options: q.options.filter((_, k) => k !== j) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <div className="row">
            <button type="button" className="btn ghost small" disabled={q.options.length >= MAX_OPTIONS} onClick={() => onChange({ options: [...q.options, ''] })}>
              + {T.addOption}
            </button>
            <span className="small soft">
              {q.type === 'multi' ? `${T.multiHint} ` : ''}
              {T.optionsLimit}
            </span>
          </div>
        </fieldset>
      ) : null}
      <label className="check sz-form-req">
        <input id={id('req')} type="checkbox" checked={q.required} onChange={(e) => onChange({ required: e.target.checked })} />
        {T.required}
      </label>
    </li>
  );
}

/** Jak to zobaczy podopieczny: te same kontrolki co w GYM TRACKERze, tylko na niby. */
function FormPreview({ form }: { form: FormBody }) {
  const wd = form.weekday ?? 1;
  return (
    <aside className="sz-form-preview" aria-label={T.preview}>
      <p className="sz-form-ptag">{T.preview}</p>
      <div className="sz-form-phone">
        {form.intake ? <p className="sz-form-pbadge">{T.intakeBadge}</p> : null}
        <p className="sz-form-ptitle">{form.title.trim() || T.untitled}</p>
        <p className="sz-form-pmeta">{form.repeat === 'weekly' ? T.every.weekly(T.weekdays[wd - 1]!) : T.every[form.repeat]}</p>
        {form.intro.trim() ? <p className="sz-form-pintro">{form.intro}</p> : null}
        {!form.questions.length ? <p className="sz-form-pmeta">{T.previewEmpty}</p> : null}
        {form.questions.map((q) => (
          <div key={q.id} className="sz-form-pq">
            <p className="sz-form-plabel">
              {q.label.trim() || '…'}
              {q.required ? (
                <span className="sz-form-preq" title={T.reqMark}>
                  {' '}
                  *
                </span>
              ) : null}
            </p>
            {q.help.trim() ? <p className="sz-form-phelp">{q.help}</p> : null}
            <PreviewControl q={q} />
          </div>
        ))}
        {form.questions.length ? <span className="sz-form-pbtn">{T.send}</span> : null}
      </div>
    </aside>
  );
}

function PreviewControl({ q }: { q: FormQuestion }) {
  switch (q.type) {
    case 'text':
      return <span className="sz-form-pbox tall" />;
    case 'number':
      return (
        <span className="sz-form-prow">
          <span className="sz-form-pbox" />
          {q.unit ? <span>{q.unit}</span> : null}
        </span>
      );
    case 'scale': {
      const min = q.min ?? 0;
      const max = q.max ?? 10;
      const steps = max > min && max - min <= 20 ? Array.from({ length: max - min + 1 }, (_, i) => min + i) : [];
      return (
        <span className="sz-form-pscale">
          {steps.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </span>
      );
    }
    case 'choice':
    case 'multi':
      return (
        <span className="sz-form-popts">
          {q.options
            .filter((o) => o.trim())
            .map((o, i) => (
              <span key={i}>
                <span className={q.type === 'choice' ? 'sz-form-pradio' : 'sz-form-pcheck'} />
                {o}
              </span>
            ))}
        </span>
      );
    case 'yesno':
      return (
        <span className="sz-form-pscale two">
          <span>{T.yes}</span>
          <span>{T.no}</span>
        </span>
      );
  }
}
