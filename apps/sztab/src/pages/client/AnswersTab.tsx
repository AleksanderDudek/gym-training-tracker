import { useState } from 'react';
import { isoWeek } from '@gymtracker/link';
import type { FormQuestion, SnapshotV1 } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import { Link, Loading, ago, fmtDate } from '../../components/ui';
import type { Connection, SentAssignment } from '../../lib/data';
import { answerRows, answerText, chartSeries, dayIn, dayLabel, expectedPeriods, formStatus, periodLabel, sentForms } from '../../lib/forms';
import type { AnswerRow, FormStatus, SentForm, SeriesPoint } from '../../lib/forms';
import './AnswersTab.css';

/**
 * Zakładka „Odpowiedzi” podopiecznego: każdy wysłany (i niewycofany) formularz z odpowiedziami
 * z części `coaching` paczki. Wartości sprawdza `cleanAnswers` przeciw pytaniom formularza — to dane
 * z telefonu. „Dziś” liczy się w strefie telefonu (`s.tz`), tak jak telefon zamyka okresy.
 */

const T = text({
  pl: {
    noneTitle: 'Nie wysłano jeszcze żadnego formularza',
    noneText:
      'Formularzem zadasz wywiad na start, cotygodniowy check-in albo codzienną skalę bólu. Ułóż go w bibliotece (są gotowe wzory) i wyślij przyciskiem „Wyślij podopiecznemu”.',
    newForm: 'Formularz w bibliotece',
    age: (when: string) => `Paczka z telefonu: ${when}. Odpowiedź przychodzi kilka sekund po wysłaniu, gdy telefon ma sieć.`,
    tz: (tz: string, day: string) => `Dni liczone w strefie podopiecznego (${tz}) — u niego dziś: ${day}.`,
    intake: 'Wywiad na start',
    repeat: { once: 'Jednorazowy', daily: 'Codziennie' } as Record<'once' | 'daily', string>,
    weekly: (wd: string) => `Co tydzień, od ${wd}`,
    weekdays: ['poniedziałku', 'wtorku', 'środy', 'czwartku', 'piątku', 'soboty', 'niedzieli'],
    sent: (d: string) => `wysłany ${d}`,
    share: (done: number, all: number, weekly: boolean) =>
      `odpowiedzi: ${done} z ${all} ${weekly ? (all === 1 ? 'tygodnia' : 'tygodni') : all === 1 ? 'dnia' : 'dni'}`,
    status: {
      once: { answered: 'Jest odpowiedź', waiting: 'Czeka na odpowiedź' },
      daily: { answered: 'Za dziś: jest odpowiedź', waiting: 'Za dziś: czeka', overdue: 'Zaległy: wczoraj bez odpowiedzi' },
      weekly: {
        answered: (next: string) => `Za ten tydzień: jest odpowiedź · następny od ${next}`,
        waiting: 'Za ten tydzień: czeka',
        overdue: (due: string) => `Zaległy: termin minął ${due}`,
        upcoming: (due: string) => `Na ten tydzień: czeka od ${due}`,
      },
    },
    empty: { once: 'Jeszcze bez odpowiedzi. Formularz czeka na telefonie podopiecznego.', repeat: 'Jeszcze bez odpowiedzi. Pierwsza pojawi się tu kilka sekund po wysłaniu z telefonu.' },
    week: 'Tydzień',
    day: 'Dzień',
    thisWeek: 'ten tydzień',
    today: 'dziś',
    question: 'Pytanie',
    answer: 'Odpowiedź',
    answeredAt: (d: string) => `odpowiedź z ${d}`,
    more: (n: number) => `Pokaż wszystkie (${n})`,
    fewer: (n: number) => `Pokaż tylko ostatnie ${n}`,
    caption: (title: string) => `Odpowiedzi: ${title}`,
    last: 'ostatnio',
    avg: 'średnio',
    chartDesc: (from: string, to: string, lo: string, hi: string, last: string) => `Od ${from} do ${to}: najmniej ${lo}, najwięcej ${hi}, ostatnio ${last}.`,
  },
  en: {
    noneTitle: 'No forms sent yet',
    noneText: 'A form lets you run a starting interview, a weekly check-in or a daily pain scale. Build it in the library (there are ready templates) and send it with “Send to client”.',
    newForm: 'Form in the library',
    age: (when: string) => `Package from the phone: ${when}. An answer arrives a few seconds after it is sent, when the phone is online.`,
    tz: (tz: string, day: string) => `Days are counted in the client’s time zone (${tz}) — today for them: ${day}.`,
    intake: 'Starting interview',
    repeat: { once: 'Once', daily: 'Daily' } as Record<'once' | 'daily', string>,
    weekly: (wd: string) => `Weekly, from ${wd}`,
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    sent: (d: string) => `sent ${d}`,
    share: (done: number, all: number, weekly: boolean) => `answers: ${done} of ${all} ${weekly ? (all === 1 ? 'week' : 'weeks') : all === 1 ? 'day' : 'days'}`,
    status: {
      once: { answered: 'Answered', waiting: 'Waiting for an answer' },
      daily: { answered: 'Today: answered', waiting: 'Today: waiting', overdue: 'Overdue: no answer yesterday' },
      weekly: {
        answered: (next: string) => `This week: answered · next from ${next}`,
        waiting: 'This week: waiting',
        overdue: (due: string) => `Overdue: was due ${due}`,
        upcoming: (due: string) => `This week: due from ${due}`,
      },
    },
    empty: { once: 'No answer yet. The form is waiting on the client’s phone.', repeat: 'No answers yet. The first one appears here a few seconds after it is sent from the phone.' },
    week: 'Week',
    day: 'Day',
    thisWeek: 'this week',
    today: 'today',
    question: 'Question',
    answer: 'Answer',
    answeredAt: (d: string) => `answered ${d}`,
    more: (n: number) => `Show all (${n})`,
    fewer: (n: number) => `Show only the latest ${n}`,
    caption: (title: string) => `Answers: ${title}`,
    last: 'latest',
    avg: 'average',
    chartDesc: (from: string, to: string, lo: string, hi: string, last: string) => `From ${from} to ${to}: lowest ${lo}, highest ${hi}, latest ${last}.`,
  },
});

const browserTz = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
};

const fmtNum = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
const fmtAt = (at: number) => new Date(at).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AnswersTab({ c, s, sent }: { c: Connection; s: SnapshotV1; sent: SentAssignment[] | undefined }) {
  const [now] = useState(() => Date.now());
  if (!sent) return <Loading />;
  const forms = sentForms(sent);
  if (!forms.length)
    return (
      <section className="card empty">
        <h3>{T.noneTitle}</h3>
        <p>{T.noneText}</p>
        <Link to="/biblioteka/nowy/form" className="btn blue">
          + {T.newForm}
        </Link>
      </section>
    );
  const today = dayIn(s.tz, now);
  return (
    <div className="stack sz-answers">
      <p className="small soft">
        {T.age(ago(new Date(s.at).toISOString()))}
        {s.tz && s.tz !== browserTz() ? ` ${T.tz(s.tz, dayLabel(today))}` : ''}
      </p>
      {forms.map((f) => (
        <FormAnswers key={f.id} uid={`${c.id.slice(0, 8)}-${f.id}`} f={f} rows={answerRows(f.form, f.id, s.coaching)} today={today} sentDay={dayIn(s.tz, f.sentAt)} />
      ))}
    </div>
  );
}

function statusText(f: SentForm, st: FormStatus): { label: string; tone: 'ok' | 'warn' | 'muted' } {
  const tone = st.kind === 'answered' ? 'ok' : st.kind === 'overdue' ? 'warn' : 'muted';
  const due = st.due ? dayLabel(st.due) : '';
  switch (f.form.repeat) {
    case 'once':
      return { label: st.kind === 'answered' ? T.status.once.answered : T.status.once.waiting, tone };
    case 'daily':
      return { label: st.kind === 'answered' ? T.status.daily.answered : st.kind === 'overdue' ? T.status.daily.overdue : T.status.daily.waiting, tone };
    case 'weekly': {
      const w = T.status.weekly;
      const label = st.kind === 'answered' ? w.answered(due) : st.kind === 'overdue' ? w.overdue(due) : st.kind === 'upcoming' ? w.upcoming(due) : w.waiting;
      return { label, tone };
    }
  }
}

function FormAnswers({ uid, f, rows, today, sentDay }: { uid: string; f: SentForm; rows: AnswerRow[]; today: string; sentDay: string }) {
  const answered = new Set(rows.map((r) => r.period));
  const st = statusText(f, formStatus(f.form, answered, today, sentDay));
  const expected = expectedPeriods(f.form, answered, today, sentDay);
  const done = expected.filter((p) => answered.has(p)).length;
  const charts = f.form.questions.map((q) => ({ q, series: chartSeries(q, rows) })).filter((x) => x.series.length >= 2);
  const repeat = f.form.repeat === 'weekly' ? T.weekly(T.weekdays[(f.form.weekday ?? 1) - 1]!) : T.repeat[f.form.repeat];
  return (
    <section className="card sz-answers-form" aria-labelledby={`ans-${uid}`}>
      <div className="stack sz-answers-head">
        <h2 id={`ans-${uid}`}>{f.form.title}</h2>
        <div className="row small">
          {f.form.intake ? <span className="chip sz-answers-intake">{T.intake}</span> : null}
          <span className="chip">{repeat}</span>
          <span className={`chip ${st.tone}`}>{st.label}</span>
          <span className="soft">{T.sent(fmtDate(new Date(f.sentAt).toISOString(), LOCALE))}</span>
          {f.form.repeat !== 'once' && expected.length ? <span className="soft">· {T.share(done, expected.length, f.form.repeat === 'weekly')}</span> : null}
        </div>
      </div>
      {!rows.length ? (
        <p className="soft">{f.form.repeat === 'once' ? T.empty.once : T.empty.repeat}</p>
      ) : (
        <>
          {charts.length ? (
            <div className="sz-answers-charts">
              {charts.map(({ q, series }) => (
                <AnswerChart key={q.id} id={`ch-${uid}-${q.id}`} q={q} series={series} />
              ))}
            </div>
          ) : null}
          {f.form.repeat === 'once' ? <OnceTable f={f} row={rows[0]!} /> : <PeriodTable f={f} rows={rows} today={today} />}
        </>
      )}
    </section>
  );
}

function OnceTable({ f, row }: { f: SentForm; row: AnswerRow }) {
  return (
    <div className="stack">
      <p className="small soft">{T.answeredAt(fmtAt(row.at))}</p>
      <div className="scroll-x">
        <table className="tbl sz-answers-once">
          <caption className="sr">{T.caption(f.form.title)}</caption>
          <thead>
            <tr>
              <th scope="col">{T.question}</th>
              <th scope="col">{T.answer}</th>
            </tr>
          </thead>
          <tbody>
            {f.form.questions.map((q) => (
              <tr key={q.id}>
                <th scope="row">{q.label}</th>
                <td>{answerText(q, row.values[q.id]) || <span className="soft">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const numeric = (q: FormQuestion) => q.type === 'number' || q.type === 'scale';

/** Tyle ostatnich okresów widać od razu; resztę — po „Pokaż wszystkie”. */
const ROWS = { weekly: 12, daily: 14 };

function PeriodTable({ f, rows, today }: { f: SentForm; rows: AnswerRow[]; today: string }) {
  const [all, setAll] = useState(false);
  const weekly = f.form.repeat === 'weekly';
  const current = weekly ? isoWeek(today) : today;
  const limit = weekly ? ROWS.weekly : ROWS.daily;
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div className="stack">
      <div className="scroll-x">
        <table className="tbl sz-answers-tbl">
          <caption className="sr">{T.caption(f.form.title)}</caption>
          <thead>
            <tr>
              <th scope="col">{weekly ? T.week : T.day}</th>
              {f.form.questions.map((q) => (
                <th key={q.id} scope="col" className={numeric(q) ? 'n' : undefined}>
                  {q.label}
                  {q.type === 'number' && q.unit ? <span className="soft"> ({q.unit})</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.period}>
                <th scope="row">
                  {periodLabel(r.period)}
                  {r.period === current ? <span className="soft"> · {weekly ? T.thisWeek : T.today}</span> : null}
                </th>
                {f.form.questions.map((q) => {
                  const v = r.values[q.id];
                  const cell = q.type === 'number' && typeof v === 'number' ? fmtNum(v) : answerText(q, v);
                  return (
                    <td key={q.id} className={numeric(q) ? 'n' : q.type === 'text' ? 'sz-answers-text' : undefined}>
                      {cell || <span className="soft">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit ? (
        <button type="button" className="btn link small sz-answers-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? T.fewer(limit) : T.more(rows.length)}
        </button>
      ) : null}
    </div>
  );
}

function AnswerChart({ id, q, series }: { id: string; q: FormQuestion; series: SeriesPoint[] }) {
  const W = 320;
  const H = 128;
  const pad = { l: 34, r: 10, t: 10, b: 22 };
  const values = series.map((p) => p.value);
  let lo = q.type === 'scale' ? (q.min ?? 0) : Math.floor(Math.min(...values));
  let hi = q.type === 'scale' ? (q.max ?? 10) : Math.ceil(Math.max(...values));
  if (hi <= lo) {
    lo -= 1;
    hi += 1;
  }
  const t0 = Date.parse(series[0]!.day);
  const t1 = Date.parse(series[series.length - 1]!.day);
  const x = (day: string) => pad.l + ((Date.parse(day) - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const last = series[series.length - 1]!;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const unit = q.type === 'number' && q.unit ? ` ${q.unit}` : '';
  const desc = T.chartDesc(periodLabel(series[0]!.period), periodLabel(last.period), fmtNum(Math.min(...values)) + unit, fmtNum(Math.max(...values)) + unit, fmtNum(last.value) + unit);
  return (
    <figure className="sz-answers-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <title id={`${id}-t`}>{q.label}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {[lo, hi].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="sz-answers-grid" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end">
              {fmtNum(v)}
            </text>
          </g>
        ))}
        <path d={line} className="sz-answers-line" />
        {series.map((p) => (
          <circle key={p.period} cx={x(p.day)} cy={y(p.value)} r={p === last ? 4 : 2.5} className="sz-answers-dot" />
        ))}
        <text x={pad.l} y={H - 5}>
          {periodLabel(series[0]!.period)}
        </text>
        <text x={W - pad.r} y={H - 5} textAnchor="end">
          {periodLabel(last.period)}
        </text>
      </svg>
      <figcaption>
        <strong>{q.label}</strong>
        <span className="soft">
          {' '}
          · {T.last}: {fmtNum(last.value)}
          {unit} · {T.avg}: {fmtNum(avg)}
          {unit}
        </span>
      </figcaption>
    </figure>
  );
}
