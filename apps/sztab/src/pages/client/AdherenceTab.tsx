import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { weekdayOf } from '@gymtracker/link';
import type { HabitTime, ReceiptStatus, SnapshotV1 } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import { Loading } from '../../components/ui';
import { adherence, lightOf } from '../../lib/adherence';
import type { HabitCell, HabitsAdherence, Light, MealDayCell, MealsAdherence, Rate } from '../../lib/adherence';
import type { Connection, SentAssignment } from '../../lib/data';
import './AdherenceTab.css';

/**
 * Zakładka „Realizacja” podopiecznego: odhaczone nawyki i posiłki z części `coaching` paczki,
 * zestawione z obowiązującymi listami (ten sam wybór co lista „Do przejrzenia”: `lib/coached.ts`).
 * Rachunki w `lib/adherence.ts` — w strefie telefonu. Zaplanowane i odrzucone — tylko wzmianka.
 * Stan nie zależy od samego koloru: każda kratka ma znak i słowo dla czytnika, światła — podpis.
 */

const T = text({
  pl: {
    emptyTitle: 'Nic tu jeszcze nie ma',
    emptyText: 'Wyślij listę nawyków albo jadłospis. Gdy podopieczny zacznie odhaczać w GYM TRACKERze, zobaczysz tu dzień po dniu, co zrobił.',
    dataTo: (d: string) => `Ostatnia paczka z telefonu jest z ${d} — późniejsze dni są bez danych, a nie opuszczone.`,
    habits: 'Nawyki',
    meals: 'Jadłospis',
    sent: (d: string) => `wysłane ${d}`,
    until: (d: string) => `do ${d}`,
    noEnd: 'bez daty końca',
    start: (d: string) => `cykl od ${d}`,
    cycle: (n: number) => `${n} ${n === 1 ? 'dzień' : 'dni'} w cyklu`,
    status: { seen: 'przeczytane', started: 'w trakcie', done: 'zrobione', declined: 'odrzucone' } as Record<ReceiptStatus, string>,
    waiting: 'czeka na odczyt',
    week: '7 dni',
    month: '30 dni',
    snapDay: 'Dzień paczki',
    of: (done: number, due: number) => `${done} z ${due}`,
    noData: 'za mało danych',
    light: { green: 'dobrze', yellow: 'średnio', red: 'słabo' } as Record<Light, string>,
    notReported: 'Telefon jeszcze nie przysłał odhaczeń tej listy — przyjdą z następną paczką danych.',
    item: 'Punkt',
    grid: (title: string) => `${title}: ostatnie 14 dni`,
    when: { morning: 'rano', midday: 'w południe', evening: 'wieczorem', any: 'o dowolnej porze' } as Record<HabitTime, string>,
    cell: { done: 'zrobione', missed: 'pominięte', pending: 'jeszcze nie (dzień trwał)', unknown: 'brak danych', off: 'nie w planie' } as Record<HabitCell, string>,
    legend: 'Znaki',
    wd: ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'],
    day: 'Dzień',
    planDay: 'Dzień jadłospisu',
    eaten: 'Zjedzone',
    rating: 'Ocena',
    skipped: 'Pominięte',
    dayN: (n: number) => `Dzień ${n}`,
    partial: 'w trakcie',
    unknown: 'brak danych',
    beforeStart: (d: string) => `Jadłospis zaczyna się ${d}.`,
    mealsCaption: (title: string) => `${title}: ostatnie 14 dni, od najnowszego`,
    lightsHint: 'Światła dnia: od 80% zielone, od 50% żółte, niżej czerwone. Procenty liczą pełne dni przed ostatnią paczką.',
    oldApp:
      'Telefon podopiecznego ma starszą wersję GYM TRACKERa, która nie odsyła odhaczeń — brak danych z tej wersji aplikacji. Realizacja pojawi się po aktualizacji.',
    oldAppShort: 'brak danych z tej wersji aplikacji',
    scheduledHead: 'Zaplanowane (podopieczny jeszcze ich nie widzi):',
    scheduled: (kind: string, title: string, when: string) => `${kind}: „${title}” — od ${when}`,
    declinedHead: 'Nie liczą się:',
    declined: (kind: string, title: string) => `${kind}: „${title}” — odrzucone przez podopiecznego`,
  },
  en: {
    emptyTitle: 'Nothing here yet',
    emptyText: 'Send a habit list or a meal plan. Once the client starts ticking in GYM TRACKER, you will see here what they did, day by day.',
    dataTo: (d: string) => `The phone’s latest data is from ${d} — later days have no data yet, they are not missed.`,
    habits: 'Habits',
    meals: 'Meal plan',
    sent: (d: string) => `sent ${d}`,
    until: (d: string) => `until ${d}`,
    noEnd: 'no end date',
    start: (d: string) => `cycle from ${d}`,
    cycle: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} in the cycle`,
    status: { seen: 'seen', started: 'in progress', done: 'done', declined: 'declined' } as Record<ReceiptStatus, string>,
    waiting: 'not opened yet',
    week: '7 days',
    month: '30 days',
    snapDay: 'Latest day',
    of: (done: number, due: number) => `${done} of ${due}`,
    noData: 'not enough data',
    light: { green: 'good', yellow: 'fair', red: 'poor' } as Record<Light, string>,
    notReported: 'The phone has not sent ticks for this list yet — they come with the next data package.',
    item: 'Item',
    grid: (title: string) => `${title}: last 14 days`,
    when: { morning: 'morning', midday: 'midday', evening: 'evening', any: 'any time' } as Record<HabitTime, string>,
    cell: { done: 'done', missed: 'missed', pending: 'not yet (day in progress)', unknown: 'no data', off: 'not planned' } as Record<HabitCell, string>,
    legend: 'Marks',
    wd: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    day: 'Day',
    planDay: 'Meal plan day',
    eaten: 'Eaten',
    rating: 'Rating',
    skipped: 'Skipped',
    dayN: (n: number) => `Day ${n}`,
    partial: 'in progress',
    unknown: 'no data',
    beforeStart: (d: string) => `The meal plan starts on ${d}.`,
    mealsCaption: (title: string) => `${title}: last 14 days, newest first`,
    lightsHint: 'Day lights: from 80% green, from 50% yellow, below that red. Percentages count full days before the latest data package.',
    oldApp: 'The client’s phone runs an older GYM TRACKER version that does not send ticks back — no data from this app version. Adherence appears after the update.',
    oldAppShort: 'no data from this app version',
    scheduledHead: 'Scheduled (the client cannot see them yet):',
    scheduled: (kind: string, title: string, when: string) => `${kind}: “${title}” — from ${when}`,
    declinedHead: 'Not counted:',
    declined: (kind: string, title: string) => `${kind}: “${title}” — declined by the client`,
  },
});

const MARK: Record<HabitCell, string> = { done: '✓', missed: '✕', pending: '…', unknown: '?', off: '–' };

/** Dzień `YYYY-MM-DD` po ludzku — bez przesunięcia strefy przeglądarki. */
const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string =>
  new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

const fmtMs = (ms: number): string => new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms));

export function AdherenceTab({ c, s, sent }: { c: Connection; s: SnapshotV1; sent: SentAssignment[] | undefined }) {
  void c;
  const a = useMemo(() => (sent ? adherence(s, sent) : null), [s, sent]);
  if (!a) return <Loading />;
  const kind = (k: 'habits' | 'meals') => (k === 'habits' ? T.habits : T.meals);
  const notCounted =
    a.scheduled.length || a.declined.length ? (
      <div className="stack small soft">
        {a.scheduled.length ? (
          <div>
            <span>{T.scheduledHead}</span>
            <ul>
              {a.scheduled.map((x) => (
                <li key={x.id}>{T.scheduled(kind(x.body.kind), x.body.title, fmtWhen(x.visibleAt))}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {a.declined.length ? (
          <div>
            <span>{T.declinedHead}</span>
            <ul>
              {a.declined.map((x) => (
                <li key={x.id}>{T.declined(kind(x.body.kind), x.body.title)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    ) : null;
  if (!a.habits.length && !a.meals.length) {
    return (
      <div className="stack sz-adh" style={{ gap: 16 }}>
        <section className="card">
          <div className="empty">
            <h3>{T.emptyTitle}</h3>
            <p>{T.emptyText}</p>
          </div>
        </section>
        {notCounted}
      </div>
    );
  }
  const silent = a.noCoaching;
  return (
    <div className="stack sz-adh" style={{ gap: 16 }}>
      {silent ? <p className="note">{T.oldApp}</p> : a.snapDay < a.today ? <p className="note">{T.dataTo(fmtDay(a.snapDay, { day: 'numeric', month: 'long' }))}</p> : null}
      {a.habits.map((h) => (
        <HabitsCard key={h.id} h={h} days={a.days} silent={silent} />
      ))}
      {a.meals.map((m) => (
        <MealsCard key={m.id} m={m} silent={silent} />
      ))}
      {notCounted}
      <p className="small soft">{T.lightsHint}</p>
    </div>
  );
}

const fmtWhen = (ms: number): string => new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

function StatusChip({ status }: { status: ReceiptStatus | null }) {
  if (!status) return <span className="chip muted">{T.waiting}</span>;
  return <span className={`chip ${status === 'declined' ? 'warn' : 'ok'}`}>{T.status[status]}</span>;
}

function LightBadge({ light }: { light: Light }) {
  return (
    <span className={`sz-adh-light sz-adh-${light}`}>
      <i aria-hidden="true" />
      {T.light[light]}
    </span>
  );
}

function Kpi({ label, r, silent = false }: { label: string; r: Rate; silent?: boolean }) {
  const light = lightOf(r.done, r.due);
  return (
    <div className="kpi sz-adh-kpi">
      <span className="label">{label}</span>
      <span className="value">{r.pct === null ? '—' : `${r.pct}%`}</span>
      <span className="sub">{light ? <LightBadge light={light} /> : silent ? T.oldAppShort : T.noData}</span>
      {r.due ? <span className="sub">{T.of(r.done, r.due)}</span> : null}
    </div>
  );
}

function Head({ kind, title, status, meta, children }: { kind: string; title: string; status: ReceiptStatus | null; meta: string[]; children: ReactNode }) {
  return (
    <div className="sz-adh-head">
      <div className="stack" style={{ gap: 4 }}>
        <span className="small soft">{kind}</span>
        <h2>{title}</h2>
        <div className="row small soft">
          <span>{meta.join(' · ')}</span>
          <StatusChip status={status} />
        </div>
      </div>
      <div className="sz-adh-kpis">{children}</div>
    </div>
  );
}

function HabitsCard({ h, days, silent }: { h: HabitsAdherence; days: readonly string[]; silent: boolean }) {
  return (
    <section className="card" aria-label={`${T.habits}: ${h.title}`}>
      <Head kind={T.habits} title={h.title} status={h.status} meta={[T.sent(fmtMs(h.sentAt)), h.body.until ? T.until(fmtDay(h.body.until)) : T.noEnd]}>
        <Kpi label={T.week} r={h.week} silent={silent} />
        <Kpi label={T.month} r={h.month} silent={silent} />
        {h.snapDay ? (
          <div className="kpi sz-adh-kpi">
            <span className="label">{T.snapDay}</span>
            <span className="value">{T.of(h.snapDay.done, h.snapDay.due)}</span>
          </div>
        ) : null}
      </Head>
      {!h.reported && !silent ? <p className="note small">{T.notReported}</p> : null}
      <div className="scroll-x">
        <table className="tbl sz-adh-grid">
          <caption className="sr">{T.grid(h.title)}</caption>
          <thead>
            <tr>
              <th scope="col">{T.item}</th>
              {days.map((d) => (
                <th key={d} scope="col" className="sz-adh-day" title={fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}>
                  <span>{T.wd[weekdayOf(d) - 1]}</span>
                  <span>{Number(d.slice(8))}</span>
                </th>
              ))}
              <th scope="col" className="n">
                {T.week}
              </th>
              <th scope="col" className="n">
                {T.month}
              </th>
            </tr>
          </thead>
          <tbody>
            {h.rows.map((r) => (
              <tr key={r.index}>
                <th scope="row" className="sz-adh-item">
                  <span>{r.item.label}</span>
                  <span className="small soft">{[r.item.dose, T.when[r.item.when]].filter(Boolean).join(' · ')}</span>
                </th>
                {r.cells.map((cell, i) => (
                  <td key={days[i]} className={`sz-adh-cell sz-adh-${cell}`} title={`${fmtDay(days[i]!, { weekday: 'short', day: 'numeric', month: 'short' })}: ${T.cell[cell]}`}>
                    <span aria-hidden="true">{MARK[cell]}</span>
                    <span className="sr">{T.cell[cell]}</span>
                  </td>
                ))}
                <td className="n">{r.week.pct === null ? '—' : `${r.week.pct}%`}</td>
                <td className="n">{r.month.pct === null ? '—' : `${r.month.pct}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sz-adh-legend small soft" aria-label={T.legend}>
        {(Object.keys(MARK) as HabitCell[]).map((k) => (
          <span key={k}>
            <b className={`sz-adh-mark sz-adh-${k}`} aria-hidden="true">
              {MARK[k]}
            </b>{' '}
            {T.cell[k]}
          </span>
        ))}
      </p>
    </section>
  );
}

function mealName(m: MealsAdherence, d: MealDayCell, i: number): string {
  const x = m.body.days[d.index!]!.meals[i]!;
  return x.slot ? `${x.slot} (${x.name})` : x.name;
}

function MealsCard({ m, silent }: { m: MealsAdherence; silent: boolean }) {
  const rows = [...m.days].reverse().filter((d) => d.state !== 'before');
  return (
    <section className="card" aria-label={`${T.meals}: ${m.title}`}>
      <Head
        kind={T.meals}
        title={m.title}
        status={m.status}
        meta={[T.sent(fmtMs(m.sentAt)), T.cycle(m.body.days.length), T.start(fmtDay(m.startDay))]}
      >
        <Kpi label={T.week} r={m.week} silent={silent} />
        <Kpi label={T.month} r={m.month} silent={silent} />
      </Head>
      {!m.reported && !silent && rows.length ? <p className="note small">{T.notReported}</p> : null}
      {!rows.length ? (
        <p className="note">{T.beforeStart(fmtDay(m.startDay, { day: 'numeric', month: 'long' }))}</p>
      ) : (
        <div className="scroll-x">
          <table className="tbl sz-adh-meals">
            <caption className="sr">{T.mealsCaption(m.title)}</caption>
            <thead>
              <tr>
                <th scope="col">{T.day}</th>
                <th scope="col">{T.planDay}</th>
                <th scope="col" className="n">
                  {T.eaten}
                </th>
                <th scope="col">{T.rating}</th>
                <th scope="col">{T.skipped}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.day} className={d.state === 'unknown' ? 'sz-adh-later' : undefined}>
                  <td className="small">{fmtDay(d.day, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td>{m.body.days[d.index!]!.label || T.dayN(d.index! + 1)}</td>
                  <td className="n">{d.state === 'unknown' ? '—' : T.of(d.done, d.due)}</td>
                  <td>
                    {d.light ? <LightBadge light={d.light} /> : <span className="small soft">{d.state === 'partial' ? T.partial : T.unknown}</span>}
                  </td>
                  <td className="small">{d.missed.map((i) => mealName(m, d, i)).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
