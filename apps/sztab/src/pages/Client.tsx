import { Fragment, useMemo, useState } from 'react';
import { formatPseudonym, shortPseudonym } from '@gymtracker/link';
import type { AssignmentKind, Scope, SnapshotV1 } from '@gymtracker/link';
import { MARKERS } from '@gt/food/labs/markers';
import { MEASURES, measureName } from '@gt/engine/measures';
import { LOCALE, num, text } from '@gt/i18n';
import { AreaChips, Dialog, Failure, Link, Loading, ago, fmtDate, toast, useLoad } from '../components/ui';
import { loadAliases, saveAlias } from '../lib/aliases';
import { endConnection, getConnection, listAssignments, readSnapshot, withdrawAssignment } from '../lib/data';
import type { Connection, SentAssignment } from '../lib/data';
import { L } from '../lib/labels';
import { foodDays, overview } from '../lib/metrics';
import type { Overview } from '../lib/metrics';
import { navigate, useLocation } from '../lib/router';
import { useReady } from '../session';
import { SendDialog } from './Send';

const T = text({
  pl: {
    back: 'Podopieczni',
    alias: 'Twój skrót (tylko na tym komputerze)',
    aliasPh: 'np. Jan, wtorki 18:00',
    copyId: 'Kopiuj pełny numer',
    copied: 'Numer skopiowany',
    sees: 'Widzisz',
    note: 'Notatka z zaproszenia',
    data: (s: string) => `dane z: ${s}`,
    noData: 'Podopieczny jeszcze nic nie wysłał. Dane przyjdą, gdy otworzy GYM TRACKERa.',
    unreadable: 'Paczka jest, ale nie otwiera się kluczem z tego sejfu. Jeśli zakładałeś konto od nowa, poproś o nowe zaproszenie.',
    tabs: { overview: 'Przegląd', training: 'Trening', food: 'Jedzenie', body: 'Ciało', labs: 'Badania', sent: 'Zalecenia' },
    notShared: (what: string) => `Podopieczny nie udostępnia: ${what}. Zakres zmienia on sam, w GYM TRACKERze.`,
    send: 'Wyślij',
    quick: { plan: 'Wyślij plan', targets: 'Ustaw cele', labs: 'Zleć badania', note: 'Zalecenie', workout: 'Wyślij trening' } as Record<AssignmentKind, string>,
    end: 'Zakończ współpracę',
    endTitle: 'Zakończyć współpracę?',
    endText: 'Paczka danych i wysłane zalecenia znikną od razu, a podopieczny dostanie informację w aplikacji. Wrócić można tylko nowym zaproszeniem.',
    endYes: 'Tak, zakończ',
    cancel: 'Anuluj',
    ended: 'Współpraca zakończona',
    endedBy: { client: 'Podopieczny zakończył współpracę', coach: 'Zakończyłeś tę współpracę' },
    perWeek: 'Treningi / tydz.',
    perWeekSub: (n: number) => `plan: ${n}`,
    adherence: (p: number) => `realizacja ${p}%`,
    weight: 'Waga · śr. 7 dni',
    weightSub: (d: string) => `${d} kg / tydz.`,
    protein: 'Białko · śr. 7 dni',
    kcal: 'Kalorie · śr. 7 dni',
    goal: (n: string) => `cel ${n}`,
    steps: 'Kroki · śr. 7 dni',
    plan: 'Plan',
    planWeek: (w: number, all: number) => `tydzień ${w} z ${all}`,
    missed: (n: number) => `opuszczone: ${n}`,
    next: (d: string) => `następny: ${d}`,
    noPlan: 'Bez uruchomionego planu.',
    weightChart: 'Waga, 8 tygodni',
    lastSessions: 'Ostatnie treningi',
    exercises: 'Ćwiczenia',
    flags: {
      stale: 'Ostatnie dane mają ponad tydzień.',
      adherence: 'Realizacja planu poniżej 60%.',
      no_training: 'Brak treningów od dwóch tygodni.',
      weight_fast: 'Waga zmienia się szybciej niż 1% masy na tydzień.',
      protein_low: 'Białko poniżej 80% celu.',
    } as Record<string, string>,
    date: 'Data',
    workout: 'Trening',
    minutes: 'Czas',
    tonnage: 'Tonaż',
    sets: 'Serie',
    min: (n: number) => `${n} min`,
    t: (kg: number) => `${num(kg / 1000, 1)} t`,
    deload: 'lżejszy',
    sessions: 'Sesje',
    last: 'Ostatnio',
    e1rm: 'Maks. szac.',
    trend: 'Kierunek',
    tooEarly: 'za wcześnie',
    day: 'Dzień',
    kcalCol: 'kcal',
    pCol: 'B',
    cCol: 'W',
    fCol: 'T',
    drinks: 'Napoje',
    partial: 'niepełny',
    entries: 'Wpisy',
    measures: 'Obwody',
    weighings: 'Ważenia',
    marker: 'Badanie',
    result: 'Wynik',
    range: 'Zakres laboratorium',
    noLabs: 'Brak wyników badań w udostępnionym okresie.',
    sentEmpty: 'Nic jeszcze nie wysłałeś.',
    receipt: { seen: 'przeczytane', started: 'uruchomione', done: 'zrobione', declined: 'odrzucone' },
    waiting: 'czeka na odczyt',
    withdraw: 'Wycofaj',
    withdrawn: 'wycofane',
    unreadableAssignment: 'nie da się odczytać',
    comment: 'Komentarz podopiecznego',
    notFound: 'Nie ma takiej współpracy.',
    since: (d: string) => `od ${d}`,
    endedNote: 'Paczka danych, zalecenia i potwierdzenia zostały usunięte z serwera przy zakończeniu. Zostaje tylko ten wpis: numer, obszary i daty.',
  },
  en: {
    back: 'Clients',
    alias: 'Your alias (this computer only)',
    aliasPh: 'e.g. John, Tuesdays 6 pm',
    copyId: 'Copy full number',
    copied: 'Number copied',
    sees: 'You see',
    note: 'Invite note',
    data: (s: string) => `data from: ${s}`,
    noData: 'The client has not sent anything yet. Data arrives when they open GYM TRACKER.',
    unreadable: 'There is a data package, but this vault’s key does not open it. If you recreated your account, ask for a new invite.',
    tabs: { overview: 'Overview', training: 'Training', food: 'Food', body: 'Body', labs: 'Labs', sent: 'Advice' },
    notShared: (what: string) => `The client does not share: ${what}. Only they can change it, in GYM TRACKER.`,
    send: 'Send',
    quick: { plan: 'Send plan', targets: 'Set targets', labs: 'Order lab tests', note: 'Advice', workout: 'Send workout' } as Record<AssignmentKind, string>,
    end: 'End collaboration',
    endTitle: 'End the collaboration?',
    endText: 'The data package and sent advice disappear at once, and the client is told in the app. Coming back needs a new invite.',
    endYes: 'Yes, end it',
    cancel: 'Cancel',
    ended: 'Collaboration ended',
    endedBy: { client: 'The client ended the collaboration', coach: 'You ended this collaboration' },
    perWeek: 'Workouts / week',
    perWeekSub: (n: number) => `plan: ${n}`,
    adherence: (p: number) => `adherence ${p}%`,
    weight: 'Weight · 7-day avg',
    weightSub: (d: string) => `${d} kg / week`,
    protein: 'Protein · 7-day avg',
    kcal: 'Calories · 7-day avg',
    goal: (n: string) => `target ${n}`,
    steps: 'Steps · 7-day avg',
    plan: 'Plan',
    planWeek: (w: number, all: number) => `week ${w} of ${all}`,
    missed: (n: number) => `missed: ${n}`,
    next: (d: string) => `next: ${d}`,
    noPlan: 'No plan running.',
    weightChart: 'Weight, 8 weeks',
    lastSessions: 'Recent workouts',
    exercises: 'Exercises',
    flags: {
      stale: 'The latest data is over a week old.',
      adherence: 'Plan adherence below 60%.',
      no_training: 'No workouts for two weeks.',
      weight_fast: 'Weight changes faster than 1% of body mass per week.',
      protein_low: 'Protein below 80% of target.',
    } as Record<string, string>,
    date: 'Date',
    workout: 'Workout',
    minutes: 'Time',
    tonnage: 'Tonnage',
    sets: 'Sets',
    min: (n: number) => `${n} min`,
    t: (kg: number) => `${num(kg / 1000, 1)} t`,
    deload: 'lighter',
    sessions: 'Sessions',
    last: 'Last',
    e1rm: 'Est. max',
    trend: 'Direction',
    tooEarly: 'too early',
    day: 'Day',
    kcalCol: 'kcal',
    pCol: 'P',
    cCol: 'C',
    fCol: 'F',
    drinks: 'Drinks',
    partial: 'incomplete',
    entries: 'Entries',
    measures: 'Measurements',
    weighings: 'Weigh-ins',
    marker: 'Test',
    result: 'Result',
    range: 'Lab range',
    noLabs: 'No lab results in the shared period.',
    sentEmpty: 'You have not sent anything yet.',
    receipt: { seen: 'read', started: 'started', done: 'done', declined: 'declined' },
    waiting: 'not read yet',
    withdraw: 'Withdraw',
    withdrawn: 'withdrawn',
    unreadableAssignment: 'cannot be read',
    comment: 'Client’s comment',
    notFound: 'No such collaboration.',
    since: (d: string) => `since ${d}`,
    endedNote: 'The data package, advice and receipts were removed from the server when it ended. Only this entry remains: number, areas and dates.',
  },
});

type Tab = keyof typeof T.tabs;
const TAB_SCOPE: Partial<Record<Tab, Scope>> = { training: 'training', food: 'food', body: 'body', labs: 'labs' };

export function ClientPage({ id }: { id: string }) {
  const { key, user } = useReady();
  const { query } = useLocation();
  const tab = ((Object.keys(T.tabs) as Tab[]).find((t) => t === query.get('t')) ?? 'overview') as Tab;
  const conn = useLoad(() => getConnection(id), [id]);
  const c = conn.data;
  const snap = useLoad(async () => (c && c.status === 'active' ? readSnapshot(key, c) : null), [c]);
  const sent = useLoad(async () => (c ? listAssignments(key, c) : []), [c]);
  const [alias, setAlias] = useState<string | null>(null);
  const [sending, setSending] = useState<AssignmentKind | null>(null);
  const [ending, setEnding] = useState(false);

  if (conn.error) return <Failure error={conn.error} retry={conn.reload} />;
  if (conn.data === undefined) return <Loading />;
  if (!c) return <p>{T.notFound}</p>;

  const aliasNow = alias ?? loadAliases(user.id)[c.pseudonym] ?? '';
  const s = snap.data?.snapshot ?? null;
  const ov = s ? overview(s) : null;
  const sentCount = sent.data?.filter((a) => !a.withdrawnAt).length ?? 0;

  return (
    <>
      <div className="stack">
        <Link to="/podopieczni" className="crumb">
          ← {T.back}
        </Link>
        <div className="page-head">
          <div className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 14 }}>
              <h1 className="pid big" title={formatPseudonym(c.pseudonym)}>
                {shortPseudonym(c.pseudonym)}
              </h1>
              <button
                type="button"
                className="btn link small"
                onClick={() => void navigator.clipboard?.writeText(formatPseudonym(c.pseudonym)).then(() => toast(T.copied), () => undefined)}
              >
                {T.copyId}
              </button>
            </div>
            <div className="row">
              <AreaChips areas={c.areas} />
              {c.status === 'active' ? (
                <>
                  <span className="chip">
                    {T.sees}: {c.scopes.map((x) => L.scopeShort[x]).join(', ') || '—'}
                  </span>
                  <span className="chip blue">{T.data(ago(snap.data?.at ?? c.lastPushAt))}</span>
                </>
              ) : (
                <span className="chip muted">{c.endedBy ? T.endedBy[c.endedBy] : T.ended}</span>
              )}
              {c.label ? <span className="chip muted">{c.label}</span> : null}
              <span className="small soft">{T.since(fmtDate(c.createdAt, LOCALE))}</span>
            </div>
          </div>
          {c.status === 'active' ? (
            <div className="row">
              <button type="button" className="btn blue" onClick={() => setSending('note')}>
                {T.send}
              </button>
            </div>
          ) : null}
        </div>
        <label className="field" style={{ maxWidth: 420 }}>
          <span className="small">{T.alias}</span>
          <input
            id="alias"
            type="text"
            maxLength={60}
            placeholder={T.aliasPh}
            value={aliasNow}
            onChange={(e) => setAlias(e.target.value)}
            onBlur={(e) => saveAlias(user.id, c.pseudonym, e.target.value)}
          />
        </label>
      </div>

      {c.status === 'active' ? (
        <>
          <nav className="tabs" aria-label={T.back}>
            {(Object.keys(T.tabs) as Tab[]).map((t) => (
              <Link key={t} to={`/podopieczni/${c.id}${t === 'overview' ? '' : `?t=${t}`}`} current={tab === t}>
                {T.tabs[t]}
                {t === 'sent' && sentCount ? <span className="count">{sentCount}</span> : null}
              </Link>
            ))}
          </nav>
          {snap.error ? <Failure error={snap.error} retry={snap.reload} /> : null}
          {tab !== 'sent' && !snap.data && !snap.error ? <Loading /> : null}
          {tab !== 'sent' && snap.data && !snap.data.snapshot ? (
            <div className="note gold">{snap.data.unreadable ? T.unreadable : T.noData}</div>
          ) : null}
          {tab !== 'sent' && TAB_SCOPE[tab] && !c.scopes.includes(TAB_SCOPE[tab]) ? (
            <div className="note">{T.notShared(L.scope[TAB_SCOPE[tab]!].toLowerCase())}</div>
          ) : null}
          {s && ov && tab === 'overview' ? <OverviewTab s={s} ov={ov} c={c} onSend={setSending} /> : null}
          {s && ov && tab === 'training' && s.training ? <TrainingTab ov={ov} /> : null}
          {s && tab === 'food' && s.food ? <FoodTab s={s} /> : null}
          {s && ov && tab === 'body' && s.body ? <BodyTab s={s} ov={ov} /> : null}
          {s && tab === 'labs' && s.labs ? <LabsTab s={s} /> : null}
          {tab === 'sent' ? <SentTab list={sent.data} error={sent.error} reload={sent.reload} /> : null}
          <section className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn danger" onClick={() => setEnding(true)}>
              {T.end}
            </button>
          </section>
        </>
      ) : (
        <div className="note">{T.endedNote}</div>
      )}

      {sending ? <SendDialog connection={c} initialKind={sending} onClose={() => setSending(null)} onSent={sent.reload} /> : null}
      {ending ? (
        <Dialog title={T.endTitle} onClose={() => setEnding(false)}>
          <p>{T.endText}</p>
          <div className="row">
            <button
              type="button"
              className="btn danger"
              onClick={() =>
                void endConnection(c.id).then(() => {
                  toast(T.ended);
                  navigate('/podopieczni');
                })
              }
            >
              {T.endYes}
            </button>
            <button type="button" className="btn ghost" onClick={() => setEnding(false)}>
              {T.cancel}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

const kg = (n: number | null, d = 1) => (n === null ? '—' : num(n, d));
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${num(Math.abs(n), 1)}`;

function OverviewTab({ s, ov, c, onSend }: { s: SnapshotV1; ov: Overview; c: Connection; onSend: (k: AssignmentKind) => void }) {
  const quick = (['plan', 'targets', 'labs', 'note'] as const).filter((k) =>
    c.areas.some((a) => ({ training: ['plan', 'targets', 'note'], nutrition: ['targets', 'labs', 'note'], rehab: ['plan', 'note'], insight: ['labs', 'note'] })[a].includes(k)),
  );
  return (
    <div className="stack" style={{ gap: 14 }}>
      {ov.flags.length ? (
        <div className="stack">
          {ov.flags.map((f) => (
            <div key={f} className="note warn">
              {T.flags[f]}
            </div>
          ))}
        </div>
      ) : null}
      <div className="kpis">
        {s.training ? (
          <div className="card kpi">
            <span className="label">{T.perWeek}</span>
            <span className="value">{ov.perWeek === null ? '—' : num(ov.perWeek, 1)}</span>
            <span className={`sub ${ov.plan && ov.plan.adherence !== null ? (ov.plan.adherence >= 80 ? 'good' : 'warn') : ''}`}>
              {ov.plan ? `${T.perWeekSub(ov.plan.daysPerWeek)}${ov.plan.adherence !== null ? ` · ${T.adherence(ov.plan.adherence)}` : ''}` : T.noPlan}
            </span>
          </div>
        ) : null}
        {s.body ? (
          <div className="card kpi">
            <span className="label">{T.weight}</span>
            <span className="value">{ov.weight.avg === null ? '—' : `${kg(ov.weight.avg)} kg`}</span>
            <span className="sub">{ov.weight.delta === null ? '' : T.weightSub(signed(ov.weight.delta))}</span>
          </div>
        ) : null}
        {ov.food ? (
          <>
            <div className="card kpi">
              <span className="label">{T.protein}</span>
              <span className="value">{ov.food.protein === null ? '—' : `${Math.round(ov.food.protein)} g`}</span>
              <span className={`sub ${ov.food.targetProtein && ov.food.protein !== null && ov.food.protein < ov.food.targetProtein * 0.8 ? 'warn' : ''}`}>
                {ov.food.targetProtein ? T.goal(`${Math.round(ov.food.targetProtein)} g`) : ''}
              </span>
            </div>
            <div className="card kpi">
              <span className="label">{T.kcal}</span>
              <span className="value">{ov.food.kcal === null ? '—' : num(Math.round(ov.food.kcal))}</span>
              <span className="sub">{ov.food.targetKcal ? T.goal(num(Math.round(ov.food.targetKcal))) : ''}</span>
            </div>
          </>
        ) : null}
        {s.movement && ov.steps !== null ? (
          <div className="card kpi">
            <span className="label">{T.steps}</span>
            <span className="value">{num(Math.round(ov.steps))}</span>
          </div>
        ) : null}
      </div>
      <div className="grid cols-2">
        {s.body && ov.weight.series.length > 1 ? (
          <section className="card">
            <h2>{T.weightChart}</h2>
            <WeightChart series={ov.weight.series} />
          </section>
        ) : null}
        {s.training ? (
          <section className="card">
            <h2>{T.plan}</h2>
            {ov.plan ? (
              <div className="stack small">
                <strong style={{ fontSize: 15 }}>{ov.plan.name}</strong>
                <span>{T.planWeek(ov.plan.week, ov.plan.weeks)}</span>
                <span>{T.missed(ov.plan.missed)}</span>
                {ov.plan.next ? <span>{T.next(fmtDate(ov.plan.next, LOCALE))}</span> : null}
              </div>
            ) : (
              <p className="soft">{T.noPlan}</p>
            )}
            <h3>{T.lastSessions}</h3>
            <div className="stack small">
              {ov.sessions.slice(0, 5).map((r) => (
                <div key={r.date} className="row between">
                  <span>
                    {fmtDate(r.date, LOCALE)} · {r.name}
                  </span>
                  <span className="soft num">
                    {r.minutes ? T.min(r.minutes) : ''} {r.tonnage ? `· ${T.t(r.tonnage)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      {quick.length ? (
        <div className="row">
          {quick.map((k, i) => (
            <button key={k} type="button" className={`btn ${i === 0 ? 'blue' : 'ghost'}`} onClick={() => onSend(k)}>
              {T.quick[k]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WeightChart({ series }: { series: { day: string; kg: number }[] }) {
  const W = 560;
  const H = 140;
  const pad = { l: 40, r: 12, t: 10, b: 22 };
  const lo = Math.floor(Math.min(...series.map((p) => p.kg)) - 0.5);
  const hi = Math.ceil(Math.max(...series.map((p) => p.kg)) + 0.5);
  const t0 = Date.parse(series[0]!.day);
  const t1 = Date.parse(series[series.length - 1]!.day) || t0 + 1;
  const x = (d: string) => pad.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - pad.t - pad.b);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  const last = series[series.length - 1]!;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series[0]!.kg} → ${last.kg} kg`}>
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end">
            {num(v, 1)}
          </text>
        </g>
      ))}
      <path d={`${line} L${x(last.day)} ${H - pad.b} L${pad.l} ${H - pad.b} Z`} fill="var(--blue-bg)" />
      <path d={line} fill="none" stroke="var(--blue-ink)" strokeWidth="2" />
      <circle cx={x(last.day)} cy={y(last.kg)} r="3.5" fill="var(--blue-ink)" />
      <text x={pad.l} y={H - 6}>
        {fmtDate(series[0]!.day, LOCALE)}
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end">
        {fmtDate(last.day, LOCALE)}
      </text>
    </svg>
  );
}

function TrainingTab({ ov }: { ov: Overview }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card flat scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>{T.date}</th>
              <th>{T.workout}</th>
              <th className="n">{T.minutes}</th>
              <th className="n">{T.sets}</th>
              <th className="n">{T.tonnage}</th>
            </tr>
          </thead>
          <tbody>
            {ov.sessions.map((r) => (
              <tr key={r.date}>
                <td className="small">{fmtDate(r.date, LOCALE)}</td>
                <td>
                  {r.name} {r.deload ? <span className="chip muted">{T.deload}</span> : null}
                  {r.note ? <div className="small soft">„{r.note}”</div> : null}
                </td>
                <td className="n">{r.minutes ? T.min(r.minutes) : '—'}</td>
                <td className="n">{r.sets}</td>
                <td className="n">{r.tonnage ? T.t(r.tonnage) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card flat scroll-x">
        <h2 style={{ padding: '14px 16px 0' }}>{T.exercises}</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>{T.exercises}</th>
              <th className="n">{T.sessions}</th>
              <th>{T.last}</th>
              <th className="n">{T.e1rm}</th>
              <th>{T.trend}</th>
            </tr>
          </thead>
          <tbody>
            {ov.exercises.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td className="n">{e.sessions}</td>
                <td className="small">{fmtDate(e.last, LOCALE)}</td>
                <td className="n">{e.e1rm ? `${e.e1rm} kg` : '—'}</td>
                <td className="small">
                  {e.trend ? (
                    <span style={{ color: e.trend.dir === 'up' ? 'var(--ok)' : e.trend.dir === 'down' ? 'var(--warn)' : undefined }}>
                      {e.trend.dir === 'up' ? '↑' : e.trend.dir === 'down' ? '↓' : '→'} {e.trend.pct > 0 ? '+' : ''}
                      {Math.round(e.trend.pct)}%
                    </span>
                  ) : (
                    <span className="soft">{T.tooEarly}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FoodTab({ s }: { s: SnapshotV1 }) {
  const days = useMemo(() => foodDays(s).slice(0, 30), [s]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="card flat scroll-x">
      <table className="tbl">
        <thead>
          <tr>
            <th>{T.day}</th>
            <th className="n">{T.kcalCol}</th>
            <th className="n">{T.pCol}</th>
            <th className="n">{T.cCol}</th>
            <th className="n">{T.fCol}</th>
            <th className="n">{T.drinks}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <Fragment key={d.date}>
              <tr className="link" onClick={() => setOpen(open === d.date ? null : d.date)} aria-expanded={open === d.date}>
                <td className="small">
                  {fmtDate(d.date, LOCALE)} {d.partial ? <span className="chip muted">{T.partial}</span> : null}
                </td>
                <td className="n">
                  {num(Math.round(d.kcal))}
                  {d.targetKcal ? <span className="soft small"> / {num(Math.round(d.targetKcal))}</span> : null}
                </td>
                <td className="n">
                  {Math.round(d.protein)}
                  {d.targetProtein ? <span className="soft small"> / {Math.round(d.targetProtein)}</span> : null}
                </td>
                <td className="n">{Math.round(d.carbs)}</td>
                <td className="n">{Math.round(d.fat)}</td>
                <td className="n">{d.drinksMl ? `${num(d.drinksMl / 1000, 1)} l` : '—'}</td>
              </tr>
              {open === d.date ? (
                <tr>
                  <td colSpan={6} style={{ background: 'var(--surface-2)' }}>
                    <div className="stack small">
                      {d.entries.map((e, i) => (
                        <div key={i} className="row between">
                          <span>
                            <span className="soft mono">{e.time}</span> {e.name} <span className="soft">{e.amount}</span>
                          </span>
                          <span className="num">
                            {Math.round(e.kcal)} kcal · {e.protein === null ? '—' : Math.round(e.protein)} g B
                          </span>
                        </div>
                      ))}
                      {d.note ? <span className="soft">„{d.note}”</span> : null}
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BodyTab({ s, ov }: { s: SnapshotV1; ov: Overview }) {
  const body = [...(s.body?.body ?? [])].reverse();
  const measures = [...(s.body?.measures ?? [])].reverse();
  return (
    <div className="grid cols-2">
      <section className="card">
        <h2>{T.weightChart}</h2>
        {ov.weight.series.length > 1 ? <WeightChart series={ov.weight.series} /> : null}
        <h3>{T.weighings}</h3>
        <div className="stack small">
          {body.slice(0, 20).map((b) => (
            <div key={b.day} className="row between">
              <span>{fmtDate(b.day, LOCALE)}</span>
              <span className="num">{num(b.kg, 1)} kg</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>{T.measures}</h2>
        <div className="stack small">
          {measures.slice(0, 12).map((m) => (
            <div key={m.day} className="row between">
              <span>{fmtDate(m.day, LOCALE)}</span>
              <span className="num soft">
                {MEASURES.filter((k) => m[k] !== undefined)
                  .map((k) => `${measureName(k)}: ${num(m[k]!, 1)} cm`)
                  .join(' · ')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LabsTab({ s }: { s: SnapshotV1 }) {
  const visits = [...(s.labs?.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  if (!visits.length) return <p className="soft">{T.noLabs}</p>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {visits.map((v) => (
        <section key={v.date + (v.lab ?? '')} className="card flat scroll-x">
          <h2 style={{ padding: '14px 16px 0' }}>
            {fmtDate(v.date, LOCALE)} {v.lab ? <span className="soft small">· {v.lab}</span> : null}
          </h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>{T.marker}</th>
                <th className="n">{T.result}</th>
                <th>{T.range}</th>
              </tr>
            </thead>
            <tbody>
              {v.results.map((r) => {
                const m = MARKERS[r.marker];
                const out =
                  r.value !== null && r.ref ? (r.ref[0] !== null && r.value < r.ref[0] ? 'low' : r.ref[1] !== null && r.value > r.ref[1] ? 'high' : null) : null;
                return (
                  <tr key={r.marker}>
                    <td>{m?.name ?? r.marker}</td>
                    <td className="n" style={{ color: out ? 'var(--warn)' : undefined, fontWeight: out ? 600 : undefined }}>
                      {r.printed} {out === 'low' ? '↓' : out === 'high' ? '↑' : ''}
                    </td>
                    <td className="small soft">{r.ref ? `${r.ref[0] ?? ''}–${r.ref[1] ?? ''} ${m?.unit ?? ''}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function SentTab({ list, error, reload }: { list: SentAssignment[] | undefined; error: string | null; reload: () => void }) {
  if (error) return <Failure error={error} retry={reload} />;
  if (!list) return <Loading />;
  if (!list.length) return <p className="soft">{T.sentEmpty}</p>;
  return (
    <section className="card flat scroll-x">
      <table className="tbl">
        <tbody>
          {list.map((a) => {
            const b = a.envelope?.body;
            const title = !b ? T.unreadableAssignment : b.kind === 'plan' ? b.plan.name : b.kind === 'workout' ? b.workout.name : b.kind === 'note' ? b.title : L.kind[b.kind];
            return (
              <tr key={a.id}>
                <td>
                  <strong>{title}</strong>
                  <div className="small soft">
                    {L.kind[a.kind] === L.area[a.area] ? L.kind[a.kind] : `${L.kind[a.kind]} · ${L.area[a.area]}`} · {fmtDate(a.createdAt, LOCALE)}
                  </div>
                  {a.receipt?.comment ? (
                    <div className="small" style={{ marginTop: 4 }}>
                      {T.comment}: „{a.receipt.comment}”
                    </div>
                  ) : null}
                </td>
                <td className="small">
                  {a.withdrawnAt ? (
                    <span className="chip muted">{T.withdrawn}</span>
                  ) : a.receipt ? (
                    <span className={`chip ${a.receipt.status === 'declined' ? 'warn' : 'ok'}`}>
                      {T.receipt[a.receipt.status]} · {ago(a.receipt.updatedAt)}
                    </span>
                  ) : (
                    <span className="chip muted">{T.waiting}</span>
                  )}
                </td>
                <td className="n">
                  {!a.withdrawnAt ? (
                    <button type="button" className="btn ghost small" onClick={() => void withdrawAssignment(a.id).then(reload)}>
                      {T.withdraw}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
