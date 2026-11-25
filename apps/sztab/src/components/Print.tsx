import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { AssignmentBody, FormQuestion, HabitTime, PlannedMeal, Profession } from '@gymtracker/link';
import { BUILTIN, EX } from '@gt/data/exercises';
import { KIND_LABEL } from '@gt/engine/design';
import { LOCALE, num, text } from '@gt/i18n';
import type { Workout, WorkoutGear } from '@gt/types';
import { L } from '../lib/labels';
import { useReady } from '../session';
import './print.css';

/**
 * Wydruk zalecenia (i PDF — przeglądarka zapisuje wydruk do pliku). Czarno na białym, A4.
 *
 * `PrintView` to sama kartka (czysta funkcja treści — testy renderują ją bez sesji),
 * `PrintLayer` kładzie ją nad aplikacją, woła `window.print()` i chowa resztę strony przy druku.
 * Kartka powstaje z odszyfrowanej treści w przeglądarce — nic nie idzie na serwer.
 */

const T = text({
  pl: {
    preview: 'Podgląd wydruku',
    print: 'Drukuj / zapisz PDF',
    close: 'Zamknij',
    coach: 'Prowadzący',
    client: 'Podopieczny',
    sent: 'Wysłano',
    printed: 'Wydruk',
    foot: 'GYM TRACKER Sztab',
    comment: 'Komentarz prowadzącego',
    ex: 'Ćwiczenie',
    sets: 'Serie',
    reps: 'Powtórzenia / czas',
    notes: 'Ciężar, uwagi',
    perSide: 'na stronę',
    pair: 'na zmianę z poprzednim',
    circuit: 'obwód',
    rest: (s: number) => `przerwa po serii: ${s} s`,
    roundRest: (s: number) => `przerwa po rundzie: ${s} s`,
    gear: { none: 'bez sprzętu', kb: 'kettlebell i masa ciała', gym: 'siłownia' } as Record<WorkoutGear, string>,
    videos: 'Wideo do ćwiczeń',
    weeks: (n: number) => `${n} tyg.`,
    perWeek: (n: number) => `${n}× w tygodniu`,
    deloads: (w: string) => `tygodnie lżejsze: ${w}`,
    level: { zero: 'ciężary od zera', base: 'ciężary podstawowe', strong: 'ciężary mocne' } as Record<string, string>,
    cycle: 'Kolejność treningów',
    cycleHint: 'Sesje idą po kolei i wracają do początku.',
    calendar: 'Rozpiska tygodni',
    week: 'Tydzień',
    lighter: 'lżejszy',
    missingWorkout: 'trening niedostępny w wydruku',
    wd: ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'],
    wdLong: ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'],
    meal: 'Posiłek',
    dish: 'Danie',
    kcal: 'kcal',
    p: 'B',
    c: 'W',
    f: 'T',
    total: 'Razem',
    dayN: (n: number) => `Dzień ${n}`,
    cycleDays: (n: number) => `Jadłospis na ${n} dni — po ostatnim dniu wraca pierwszy.`,
    from: (d: string) => `od ${d}`,
    fromSent: 'od dnia otrzymania',
    recipe: 'przepis w GYM TRACKERze',
    repeat: { once: 'Wypełnij raz.', daily: 'Wypełniaj codziennie.', weekly: 'Wypełniaj co tydzień.' } as Record<string, string>,
    weeklyFrom: (d: string) => `Co tydzień, od dnia: ${d}.`,
    intake: 'Wywiad na start.',
    required: '* — pytanie obowiązkowe',
    yes: 'Tak',
    no: 'Nie',
    pickOne: 'zaznacz jedną odpowiedź',
    pickMany: 'zaznacz wszystkie pasujące',
    range: (a: string, b: string) => `od ${a} do ${b}`,
    weekFrom: 'Tydzień od: ____________',
    habit: 'Nawyk',
    until: (d: string) => `do ${d}`,
    when: { morning: 'rano', midday: 'w ciągu dnia', evening: 'wieczorem', any: 'o dowolnej porze' } as Record<HabitTime, string>,
    targets: {
      kcal: 'Kalorie na dzień',
      protein: 'Białko na dzień',
      steps: 'Kroki na dzień',
      workoutsPerWeek: 'Treningi w tygodniu',
      weightGoal: 'Waga docelowa',
      weeklyRate: 'Tempo zmiany masy',
    },
    perWeekKg: 'kg / tydzień',
    test: 'Badanie',
    testNote: 'Uwaga',
    done: 'Zrobione',
    by: (d: string) => `Do kiedy: ${d}`,
    checklist: 'Do odhaczenia',
  },
  en: {
    preview: 'Print preview',
    print: 'Print / save PDF',
    close: 'Close',
    coach: 'Coach',
    client: 'Client',
    sent: 'Sent',
    printed: 'Printed',
    foot: 'GYM TRACKER Sztab',
    comment: 'Coach’s comment',
    ex: 'Exercise',
    sets: 'Sets',
    reps: 'Reps / time',
    notes: 'Load, notes',
    perSide: 'per side',
    pair: 'alternate with previous',
    circuit: 'circuit',
    rest: (s: number) => `rest after a set: ${s} s`,
    roundRest: (s: number) => `rest after a round: ${s} s`,
    gear: { none: 'no equipment', kb: 'kettlebell and bodyweight', gym: 'gym' } as Record<WorkoutGear, string>,
    videos: 'Exercise videos',
    weeks: (n: number) => `${n} wk`,
    perWeek: (n: number) => `${n}× a week`,
    deloads: (w: string) => `lighter weeks: ${w}`,
    level: { zero: 'loads from zero', base: 'base loads', strong: 'strong loads' } as Record<string, string>,
    cycle: 'Workout order',
    cycleHint: 'Sessions go in order and loop.',
    calendar: 'Weeks at a glance',
    week: 'Week',
    lighter: 'lighter',
    missingWorkout: 'workout not available for print',
    wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    wdLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    meal: 'Meal',
    dish: 'Dish',
    kcal: 'kcal',
    p: 'P',
    c: 'C',
    f: 'F',
    total: 'Total',
    dayN: (n: number) => `Day ${n}`,
    cycleDays: (n: number) => `A ${n}-day meal plan — after the last day it starts over.`,
    from: (d: string) => `from ${d}`,
    fromSent: 'from the day it arrives',
    recipe: 'recipe in GYM TRACKER',
    repeat: { once: 'Fill in once.', daily: 'Fill in every day.', weekly: 'Fill in every week.' } as Record<string, string>,
    weeklyFrom: (d: string) => `Every week, from: ${d}.`,
    intake: 'Starting interview.',
    required: '* — required question',
    yes: 'Yes',
    no: 'No',
    pickOne: 'pick one answer',
    pickMany: 'pick all that apply',
    range: (a: string, b: string) => `from ${a} to ${b}`,
    weekFrom: 'Week from: ____________',
    habit: 'Habit',
    until: (d: string) => `until ${d}`,
    when: { morning: 'morning', midday: 'during the day', evening: 'evening', any: 'any time' } as Record<HabitTime, string>,
    targets: {
      kcal: 'Calories per day',
      protein: 'Protein per day',
      steps: 'Steps per day',
      workoutsPerWeek: 'Workouts per week',
      weightGoal: 'Goal weight',
      weeklyRate: 'Rate of change',
    },
    perWeekKg: 'kg / week',
    test: 'Test',
    testNote: 'Note',
    done: 'Done',
    by: (d: string) => `By: ${d}`,
    checklist: 'To tick off',
  },
});

export interface PrintCoach {
  display_name: string;
  profession: Profession;
}

const longDate = (d: Date | number | string): string =>
  new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(typeof d === 'string' ? new Date(`${d}T12:00:00`) : d);

/** Tytuł treści na kartce i w nazwie pliku PDF. */
export function printTitle(b: AssignmentBody): string {
  switch (b.kind) {
    case 'workout':
      return b.workout.name || L.kind.workout;
    case 'plan':
      return b.plan.name || L.kind.plan;
    case 'note':
    case 'form':
    case 'habits':
    case 'meals':
      return b.title || L.kind[b.kind];
    default:
      return L.kind[b.kind];
  }
}

const Check = ({ round }: { round?: boolean }) => <span className={`sz-print-check${round ? ' round' : ''}`} aria-hidden="true" />;

/** Serie i zakres z ustawień ćwiczenia w atlasie — punkt wyjścia; GYM TRACKER prowadzi progresję sam. */
function doseOf(id: string): { sets: string; reps: string } {
  const e = EX[id];
  if (!e) return { sets: '', reps: '' };
  const d = e.def;
  const range = d.min === d.max ? `${d.min}` : `${d.min}–${d.max}`;
  return { sets: String(d.sets), reps: `${range}${e.unit === 'secs' ? ' s' : ''}${e.side ? ` ${T.perSide}` : ''}` };
}

function ExerciseTable({ w }: { w: Workout }) {
  return (
    <table>
      <thead>
        <tr>
          <th className="n" style={{ width: '6%' }}>
            #
          </th>
          <th style={{ width: '38%' }}>{T.ex}</th>
          <th className="n" style={{ width: '10%' }}>
            {T.sets}
          </th>
          <th style={{ width: '20%' }}>{T.reps}</th>
          <th>{T.notes}</th>
        </tr>
      </thead>
      <tbody>
        {w.items.map((it, i) => {
          const d = doseOf(it.ex);
          const tags = [it.pair ? T.pair : '', it.circuit ? T.circuit : ''].filter(Boolean).join(', ');
          return (
            <tr key={`${it.ex}-${i}`}>
              <td className="n">{i + 1}</td>
              <td>
                {EX[it.ex]?.name ?? it.ex}
                {tags ? <div className="muted">{tags}</div> : null}
              </td>
              <td className="n">{d.sets}</td>
              <td>{d.reps}</td>
              <td className="blank" />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function workoutFacts(w: Workout): string[] {
  return [w.kind ? KIND_LABEL[w.kind] : '', w.gear ? T.gear[w.gear] : '', w.rest ? T.rest(w.rest) : '', w.roundRest ? T.roundRest(w.roundRest) : ''].filter(Boolean);
}

function Facts({ items }: { items: string[] }) {
  return items.length ? (
    <p className="sz-print-facts">
      {items.map((x) => (
        <span key={x}>{x}</span>
      ))}
    </p>
  ) : null;
}

function Comment({ note }: { note: string }) {
  return note.trim() ? (
    <div className="sz-print-box">
      <strong>{T.comment}</strong>
      <p className="pre">{note}</p>
    </div>
  ) : null;
}

function Videos({ videos }: { videos: Record<string, string> }) {
  const list = Object.entries(videos);
  if (!list.length) return null;
  return (
    <>
      <h3>{T.videos}</h3>
      <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
        {list.map(([id, url]) => (
          <li key={id}>
            {EX[id]?.name ?? id}: <span className="mono">{url}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function WorkoutPrint({ b }: { b: Extract<AssignmentBody, { kind: 'workout' }> }) {
  return (
    <>
      {b.workout.desc ? <p>{b.workout.desc}</p> : null}
      <Facts items={workoutFacts(b.workout)} />
      <Comment note={b.note} />
      <ExerciseTable w={b.workout} />
      <Videos videos={b.videos} />
    </>
  );
}

const letter = (i: number) => String.fromCharCode(65 + i);

function PlanPrint({ b }: { b: Extract<AssignmentBody, { kind: 'plan' }> }) {
  const p = b.plan;
  const byId = new Map([...BUILTIN, ...b.workouts].map((w) => [w.id, w]));
  const days = [...p.weekdays].sort((x, y) => x - y);
  const deload = new Set(p.deload ?? []);
  const facts = [
    T.weeks(p.weeks),
    `${T.perWeek(days.length)} (${days.map((d) => T.wd[d - 1]).join(', ')})`,
    T.level[p.level] ?? '',
    deload.size ? T.deloads([...deload].sort((x, y) => x - y).join(', ')) : '',
  ].filter(Boolean);
  const order = [...new Set(p.cycle)];
  return (
    <>
      {p.goal ? <p>{p.goal}</p> : null}
      {p.desc ? <p className="muted">{p.desc}</p> : null}
      <Facts items={facts} />
      <Comment note={b.note} />
      <h2>{T.cycle}</h2>
      <p className="muted">{T.cycleHint}</p>
      <ol style={{ margin: '0 0 8px', paddingLeft: 0, listStyle: 'none' }}>
        {p.cycle.map((id, i) => (
          <li key={`${id}-${i}`}>
            <strong>{letter(i)}</strong> — {byId.get(id)?.name ?? T.missingWorkout}
          </li>
        ))}
      </ol>
      <h2>{T.calendar}</h2>
      <table>
        <thead>
          <tr>
            <th>{T.week}</th>
            {days.map((d) => (
              <th key={d} className="c">
                {T.wd[d - 1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: p.weeks }, (_, w) => (
            <tr key={w} className={deload.has(w + 1) ? 'deload' : undefined}>
              <td>
                {w + 1}
                {deload.has(w + 1) ? ` · ${T.lighter}` : ''}
              </td>
              {days.map((d, i) => {
                const n = w * days.length + i;
                return (
                  <td key={d} className="c">
                    <Check /> {p.cycle.length ? letter(n % p.cycle.length) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {order.map((id) => {
        const w = byId.get(id);
        const letters = p.cycle.flatMap((x, i) => (x === id ? [letter(i)] : [])).join(', ');
        return (
          <section key={id}>
            <h2>
              {letters} · {w?.name ?? T.missingWorkout}
            </h2>
            {w ? (
              <>
                {w.desc ? <p className="muted">{w.desc}</p> : null}
                <Facts items={workoutFacts(w)} />
                <ExerciseTable w={w} />
              </>
            ) : null}
          </section>
        );
      })}
      <Videos videos={b.videos} />
    </>
  );
}

const sumOf = (meals: PlannedMeal[], k: 'kcal' | 'protein' | 'carbs' | 'fat'): string => {
  const vals = meals.map((m) => m[k]).filter((v): v is number => v !== null);
  return vals.length ? num(Math.round(vals.reduce((a, v) => a + v, 0))) : '—';
};
const cell = (v: number | null) => (v === null ? '—' : num(Math.round(v)));

function MealsPrint({ b }: { b: Extract<AssignmentBody, { kind: 'meals' }> }) {
  return (
    <>
      <Facts items={[b.days.length > 1 ? T.cycleDays(b.days.length) : '', b.start ? T.from(longDate(b.start)) : T.fromSent].filter(Boolean)} />
      {b.note ? <p className="pre">{b.note}</p> : null}
      {b.days.map((d, i) => (
        <section key={i}>
          <h2>{d.label || T.dayN(i + 1)}</h2>
          <table>
            <thead>
              <tr>
                <th>{T.meal}</th>
                <th>{T.dish}</th>
                <th className="n">{T.kcal}</th>
                <th className="n">{T.p}</th>
                <th className="n">{T.c}</th>
                <th className="n">{T.f}</th>
              </tr>
            </thead>
            <tbody>
              {d.meals.map((m, j) => (
                <tr key={j}>
                  <td>{m.slot}</td>
                  <td>
                    {m.name}
                    {m.recipe ? <span className="muted"> · {T.recipe}</span> : null}
                    {m.note ? <div className="muted">{m.note}</div> : null}
                  </td>
                  <td className="n">{cell(m.kcal)}</td>
                  <td className="n">{cell(m.protein)}</td>
                  <td className="n">{cell(m.carbs)}</td>
                  <td className="n">{cell(m.fat)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>{T.total}</td>
                <td className="n">{sumOf(d.meals, 'kcal')}</td>
                <td className="n">{sumOf(d.meals, 'protein')}</td>
                <td className="n">{sumOf(d.meals, 'carbs')}</td>
                <td className="n">{sumOf(d.meals, 'fat')}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      ))}
    </>
  );
}

function Answer({ q }: { q: FormQuestion }) {
  switch (q.type) {
    case 'text':
      return (
        <div className="sz-print-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      );
    case 'number':
      return (
        <div>
          <span className="sz-print-num" aria-hidden="true" /> {q.unit}
          {q.min !== null && q.max !== null ? <span className="muted"> ({T.range(num(q.min), num(q.max))})</span> : null}
        </div>
      );
    case 'scale': {
      const lo = q.min ?? 0;
      const hi = q.max ?? 10;
      return (
        <div className="sz-print-scale">
          {Array.from({ length: hi - lo + 1 }, (_, i) => (
            <span key={i}>{lo + i}</span>
          ))}
        </div>
      );
    }
    case 'choice':
    case 'multi':
      return (
        <>
          <div className="muted">{q.type === 'choice' ? T.pickOne : T.pickMany}</div>
          <ul className="sz-print-opts">
            {q.options.map((o, i) => (
              <li key={i}>
                <Check round={q.type === 'choice'} />
                {o}
              </li>
            ))}
          </ul>
        </>
      );
    case 'yesno':
      return (
        <div className="sz-print-yesno">
          <span>
            <Check round />
            {T.yes}
          </span>
          <span>
            <Check round />
            {T.no}
          </span>
        </div>
      );
  }
}

function FormPrint({ b }: { b: Extract<AssignmentBody, { kind: 'form' }> }) {
  const wd = b.weekday ? T.wdLong[b.weekday - 1] : null;
  return (
    <>
      <Facts items={[b.intake ? T.intake : '', b.repeat === 'weekly' && wd ? T.weeklyFrom(wd) : T.repeat[b.repeat] ?? ''].filter(Boolean)} />
      {b.intro ? <p className="pre">{b.intro}</p> : null}
      <ol className="sz-print-qs">
        {b.questions.map((q) => (
          <li key={q.id}>
            <div className="sz-print-q">
              {q.label}
              {q.required ? ' *' : ''}
            </div>
            {q.help ? <div className="muted">{q.help}</div> : null}
            <Answer q={q} />
          </li>
        ))}
      </ol>
      {b.questions.some((q) => q.required) ? <p className="muted" style={{ marginTop: 10 }}>{T.required}</p> : null}
    </>
  );
}

function HabitsPrint({ b }: { b: Extract<AssignmentBody, { kind: 'habits' }> }) {
  return (
    <>
      <Facts items={[b.until ? T.until(longDate(b.until)) : ''].filter(Boolean)} />
      {b.note ? <p className="pre">{b.note}</p> : null}
      <p>
        <strong>{T.weekFrom}</strong>
      </p>
      <table>
        <thead>
          <tr>
            <th>{T.habit}</th>
            {T.wd.map((d) => (
              <th key={d} className="c">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.items.map((h, i) => (
            <tr key={i}>
              <td>
                <strong>{h.label}</strong>
                {h.dose ? ` · ${h.dose}` : ''}
                <div className="muted">{T.when[h.when]}</div>
              </td>
              {[1, 2, 3, 4, 5, 6, 7].map((d) =>
                h.days.includes(d) ? (
                  <td key={d} className="c">
                    <Check />
                  </td>
                ) : (
                  <td key={d} className="off">
                    —
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function NotePrint({ b }: { b: Extract<AssignmentBody, { kind: 'note' }> }) {
  return (
    <>
      {b.text ? <p className="pre">{b.text}</p> : null}
      {b.checklist.length ? (
        <>
          <h3>{T.checklist}</h3>
          <ul className="sz-print-checklist">
            {b.checklist.map((c, i) => (
              <li key={i}>
                <Check />
                {c}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function TargetsPrint({ b }: { b: Extract<AssignmentBody, { kind: 'targets' }> }) {
  const rows: [string, string][] = [];
  if (b.kcal !== null) rows.push([T.targets.kcal, `${num(b.kcal)} kcal`]);
  if (b.protein !== null) rows.push([T.targets.protein, `${num(b.protein)} g`]);
  if (b.steps !== null) rows.push([T.targets.steps, num(b.steps)]);
  if (b.workoutsPerWeek !== null) rows.push([T.targets.workoutsPerWeek, num(b.workoutsPerWeek)]);
  if (b.weightGoal !== null) rows.push([T.targets.weightGoal, `${num(b.weightGoal, 1)} kg`]);
  if (b.weeklyRate !== null) rows.push([T.targets.weeklyRate, `${b.weeklyRate > 0 ? '+' : b.weeklyRate < 0 ? '−' : ''}${num(Math.abs(b.weeklyRate), 2)} ${T.perWeekKg}`]);
  return (
    <>
      {rows.length ? (
        <table>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th style={{ width: '45%' }}>{k}</th>
                <td>
                  <strong>{v}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {b.note ? <p className="pre">{b.note}</p> : null}
    </>
  );
}

function LabsPrint({ b }: { b: Extract<AssignmentBody, { kind: 'labs' }> }) {
  return (
    <>
      {b.by ? (
        <p>
          <strong>{T.by(longDate(b.by))}</strong>
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>{T.test}</th>
            <th>{T.testNote}</th>
            <th className="c">{T.done}</th>
          </tr>
        </thead>
        <tbody>
          {b.tests.map((t, i) => (
            <tr key={i}>
              <td>{t.name}</td>
              <td>{t.note}</td>
              <td className="c">
                <Check />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {b.note ? <p className="pre">{b.note}</p> : null}
    </>
  );
}

function Content({ body }: { body: AssignmentBody }): ReactNode {
  switch (body.kind) {
    case 'workout':
      return <WorkoutPrint b={body} />;
    case 'plan':
      return <PlanPrint b={body} />;
    case 'meals':
      return <MealsPrint b={body} />;
    case 'form':
      return <FormPrint b={body} />;
    case 'habits':
      return <HabitsPrint b={body} />;
    case 'note':
      return <NotePrint b={body} />;
    case 'targets':
      return <TargetsPrint b={body} />;
    case 'labs':
      return <LabsPrint b={body} />;
  }
}

/** Sama kartka: nagłówek (prowadzący, daty, numer podopiecznego), treść, stopka. */
export function PrintView({
  body,
  coach,
  clientId = null,
  sentAt = null,
  printedAt,
}: {
  body: AssignmentBody;
  coach: PrintCoach;
  /** Krótki numer podopiecznego (`GT-XXXX-XXXX`) — gdy drukujesz z jego zakładki. Nigdy skrót. */
  clientId?: string | null;
  sentAt?: number | null;
  printedAt: Date;
}) {
  return (
    <>
      <header className="sz-print-head">
        <div>
          {L.kind[body.kind] !== printTitle(body) ? <div className="sz-print-kind">{L.kind[body.kind]}</div> : null}
          <h1>{printTitle(body)}</h1>
        </div>
        <dl className="sz-print-meta">
          <dt>{T.coach}</dt>
          <dd>
            {coach.display_name} · {L.profession[coach.profession]}
          </dd>
          {clientId ? (
            <>
              <dt>{T.client}</dt>
              <dd className="mono">{clientId}</dd>
            </>
          ) : null}
          {sentAt ? (
            <>
              <dt>{T.sent}</dt>
              <dd>{longDate(sentAt)}</dd>
            </>
          ) : null}
          <dt>{T.printed}</dt>
          <dd>{longDate(printedAt)}</dd>
        </dl>
      </header>
      <Content body={body} />
      <footer className="sz-print-foot">
        <span>{T.foot}</span>
        <span>{coach.display_name}</span>
      </footer>
    </>
  );
}

/**
 * Podgląd nad aplikacją i od razu okno drukowania. Przy druku zostaje tylko kartka (`print.css`);
 * tytuł strony na chwilę zmienia się na tytuł treści — przeglądarka bierze go za nazwę pliku PDF.
 */
export function PrintLayer({ body, clientId, sentAt, onClose }: { body: AssignmentBody; clientId?: string | null; sentAt?: number | null; onClose: () => void }) {
  const { coach } = useReady();
  const close = useRef(onClose);
  close.current = onClose;
  const printBtn = useRef<HTMLButtonElement>(null);
  const [printedAt] = useState(() => new Date());

  useEffect(() => {
    const html = document.documentElement;
    const prevTitle = document.title;
    const prevFocus = document.activeElement as HTMLElement | null;
    html.classList.add('sz-printing');
    document.title = [printTitle(body), clientId].filter(Boolean).join(' — ');
    printBtn.current?.focus();
    const t = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        /* Bez okna drukowania (np. zablokowane) — podgląd zostaje, przycisk działa. */
      }
    }, 120);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      html.classList.remove('sz-printing');
      document.title = prevTitle;
      prevFocus?.focus?.();
    };
    // Raz na otwarcie: treść podglądu się nie zmienia, a drugie okno drukowania byłoby uciążliwe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="sz-print-root" role="dialog" aria-modal="true" aria-label={T.preview} onMouseDown={(e) => e.target === e.currentTarget && close.current()}>
      <div className="sz-print-bar">
        <strong>{T.preview}</strong>
        <div className="row">
          <button ref={printBtn} type="button" className="btn blue small" onClick={() => window.print()}>
            {T.print}
          </button>
          <button type="button" className="btn ghost small" onClick={() => close.current()}>
            {T.close}
          </button>
        </div>
      </div>
      <article className="sz-print-sheet">
        <PrintView body={body} coach={coach} clientId={clientId} sentAt={sentAt} printedAt={printedAt} />
      </article>
    </div>,
    document.body,
  );
}
