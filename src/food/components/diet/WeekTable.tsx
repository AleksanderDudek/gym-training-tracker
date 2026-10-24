import { LOCALE, pluralEn, text } from '../../../i18n';
import { addDays } from '../../diet/model';
import type { Finding, Findings, WeekRow } from '../../diet/weeks';
import { formatNumber, plural } from '../../lib/format';

interface Props {
  rows: WeekRow[];
  found: Findings;
  /** The step goal the steps column counts days against (the gym's `STEP_GOAL`). */
  stepsGoal: number;
  /** Energy in a kilogram (`Profile.kcalPerKg`) — what a food difference means on the scale. */
  kcalPerKg: number;
  /** Calories on screen: without them („Bez liczenia kalorii”) the food column and the food gaps go. */
  showKcal: boolean;
}

const num = (n: number) => formatNumber(Math.round(n), 0);

/** „13 Oct” — the English week label names the month. */
const DAY_MONTH = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayMonth = (date: string) => DAY_MONTH.format(new Date(`${date}T12:00:00Z`));

const T = text({
  pl: {
    title: 'Tydzień po tygodniu',
    lead: 'Jedzenie to średnia z pełnych dni, waga — zmiana z ważeń w tygodniu (potrzeba co najmniej 3).',
    noFindings: 'Wnioski pokażę, gdy różnica między tygodniami będzie wyraźnie większa niż szum wagi.',
    thisWeek: 'ten tydzień',
    /** „13–19.10”, across months „28.09–4.10”. */
    range: (monday: string, sunday: string) => {
      const [, m1, d1] = monday.split('-').map(Number);
      const [, m2, d2] = sunday.split('-').map(Number);
      return m1 === m2 ? `${d1}–${d2}.${String(m2).padStart(2, '0')}` : `${d1}.${String(m1).padStart(2, '0')}–${d2}.${String(m2).padStart(2, '0')}`;
    },
    scroll: 'Tabela tygodni – przewiń w bok',
    head: { week: 'Tydzień', weight: 'Waga', food: 'Jedzenie', steps: 'Kroki', workouts: 'Treningi' },
    fewWeighIns: 'Za mało ważeń w tym tygodniu (potrzeba 3)',
    fewWeighInsSr: ' za mało ważeń',
    days: (n: number) => `${n} ${plural(n, 'dzień', 'dni', 'dni')}`,
    stepsGoal: (goal: string, n: number) => `${goal}+: ${n} ${plural(n, 'dzień', 'dni', 'dni')}`,
    perWeek: '/tydz.',
    weeks: (n: number) => `${n} ${plural(n, 'tydzień', 'tygodnie', 'tygodni')}`,
    findingsTitle: 'Co idzie w parze z postępem',
    more: {
      eating: () => 'jedzenie w celu przez większość dni',
      workouts: (t: number) => `co najmniej ${t} ${plural(t, 'trening', 'treningi', 'treningów')} w tygodniu`,
      steps: (t: number) => `średnio co najmniej ${num(t)} kroków dziennie`,
      snacks: (t: number) =>
        `co najmniej ${t} ${plural(t, 'przekąska ruchowa', 'przekąski ruchowe', 'przekąsek ruchowych')} w tygodniu`,
      outings: (t: number) => `co najmniej ${t} ${plural(t, 'wyjście', 'wyjścia', 'wyjść')} na cardio w tygodniu`,
    },
    body: (more: string, moreWeeks: string, less: string, lessWeeks: string) =>
      `Średnio ${more} (${moreWeeks}) · w pozostałych ${less} (${lessWeeks}).`,
    faster: 'W tych tygodniach waga szła wyraźnie szybciej w stronę celu.',
    slower: 'W tych tygodniach waga szła wyraźnie wolniej w stronę celu.',
    gap: (kcal: string, lower: boolean, kg: string) =>
      ` W tych tygodniach jedzenie było średnio o ${kcal} kcal dziennie ${lower ? 'niższe' : 'wyższe'} — to samo w sobie ok. ${kg} kg tygodniowo.`,
    caveat: 'To skojarzenia z Twoich tygodni, nie dowód.',
  },
  en: {
    title: 'Week by week',
    lead: 'Food is the average of complete days, weight is the change from the week’s weigh-ins (at least 3 needed).',
    noFindings: 'I’ll show findings when the difference between weeks is clearly bigger than the scale’s noise.',
    thisWeek: 'this week',
    /** „13–19 Oct”, across months „28 Sept – 4 Oct”. */
    range: (monday: string, sunday: string) =>
      monday.slice(5, 7) === sunday.slice(5, 7)
        ? `${Number(monday.slice(8))}–${dayMonth(sunday)}`
        : `${dayMonth(monday)} – ${dayMonth(sunday)}`,
    scroll: 'Weeks table – scroll sideways',
    head: { week: 'Week', weight: 'Weight', food: 'Food', steps: 'Steps', workouts: 'Workouts' },
    fewWeighIns: 'Too few weigh-ins this week (3 needed)',
    fewWeighInsSr: ' too few weigh-ins',
    days: (n: number) => `${n} ${pluralEn(n, 'day', 'days')}`,
    stepsGoal: (goal: string, n: number) => `${goal}+: ${n} ${pluralEn(n, 'day', 'days')}`,
    perWeek: '/wk',
    weeks: (n: number) => `${n} ${pluralEn(n, 'week', 'weeks')}`,
    findingsTitle: 'What goes with progress',
    more: {
      eating: () => 'eating on goal most days',
      workouts: (t: number) => `at least ${t} ${pluralEn(t, 'workout', 'workouts')} a week`,
      steps: (t: number) => `at least ${num(t)} steps a day on average`,
      snacks: (t: number) => `at least ${t} ${pluralEn(t, 'exercise snack', 'exercise snacks')} a week`,
      outings: (t: number) => `at least ${t} cardio ${pluralEn(t, 'session', 'sessions')} a week`,
    },
    body: (more: string, moreWeeks: string, less: string, lessWeeks: string) =>
      `On average ${more} (${moreWeeks}) · in the other weeks ${less} (${lessWeeks}).`,
    faster: 'In those weeks your weight moved clearly faster toward your goal.',
    slower: 'In those weeks your weight moved clearly slower toward your goal.',
    gap: (kcal: string, lower: boolean, kg: string) =>
      ` In those weeks you ate ${kcal} kcal a day ${lower ? 'less' : 'more'} on average — that alone is about ${kg} kg a week.`,
    caveat: 'These are associations from your weeks, not proof.',
  },
});

/** „−0,4 kg”: the sign always, so a gain never reads as a loss. */
const signedKg = (n: number) => `${n > 0.005 ? '+' : n < -0.005 ? '−' : ''}${formatNumber(Math.abs(n), 1)} kg`;
const pace = (kg: number) => `${signedKg(kg)}${T.perWeek}`;

/** „13–19.10”, across months „28.09–4.10”; the current week is „ten tydzień”. */
function weekLabel(r: WeekRow): string {
  if (!r.complete) return T.thisWeek;
  return T.range(r.monday, addDays(r.monday, 6));
}

/** „co najmniej 3 treningi w tygodniu” — the side of a finding with more of the habit. */
const moreText = (f: Finding): string => T.more[f.factor](f.threshold ?? 0);

function FindingItem({ f, kcalPerKg, showKcal }: { f: Finding; kcalPerKg: number; showKcal: boolean }) {
  const gap = showKcal && f.kcalGap !== null && Math.abs(f.kcalGap) >= 50 ? f.kcalGap : null;
  return (
    <li className="fd-diet-finding">
      <p className="fd-diet-fhead">
        <strong>{moreText(f)}</strong>
      </p>
      <p className="fd-diet-fbody">
        {T.body(pace(f.more.change), T.weeks(f.more.weeks), pace(f.less.change), T.weeks(f.less.weeks))}{' '}
        {f.helps ? T.faster : T.slower}
        {gap !== null && T.gap(num(Math.abs(gap)), gap < 0, formatNumber((Math.abs(gap) * 7) / kcalPerKg, 2))}
      </p>
    </li>
  );
}

/**
 * „Tydzień po tygodniu”: waga, jedzenie z pełnych dni, kroki i treningi tydzień po tygodniu — bez
 * ocen i kolorów — a pod tabelą, tylko gdy różnica jest wyraźnie większa niż szum wagi, co idzie
 * w parze z postępem.
 */
export function WeekTable({ rows, found, stepsGoal, kcalPerKg, showKcal }: Props) {
  if (!rows.length) return null;
  const any = found.findings.length > 0;
  return (
    <section className="grp" aria-labelledby="fd-diet-weeks-title">
      <h2 id="fd-diet-weeks-title">{T.title}</h2>
      <p className="tight fd-diet-soft">
        {T.lead}
        {!any && ` ${T.noFindings}`}
      </p>
      <div className="fd-diet-scroll" tabIndex={0} role="region" aria-label={T.scroll}>
        <table className="fd-diet-weeks">
          <thead>
            <tr>
              <th scope="col">{T.head.week}</th>
              <th scope="col" className="n">
                {T.head.weight}
              </th>
              {showKcal && (
                <th scope="col" className="n">
                  {T.head.food}
                </th>
              )}
              <th scope="col" className="n">
                {T.head.steps}
              </th>
              <th scope="col" className="n">
                {T.head.workouts}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.monday}>
                <th scope="row">{weekLabel(r)}</th>
                <td className="n">
                  {r.weight ? (
                    signedKg(r.weight.change)
                  ) : (
                    <span className="fd-diet-soft" title={T.fewWeighIns}>
                      –<span className="sr-only">{T.fewWeighInsSr}</span>
                    </span>
                  )}
                </td>
                {showKcal && (
                  <td className="n">
                    {r.eaten ? (
                      <>
                        {num(r.eaten.avg)}
                        <small>{T.days(r.eaten.days)}</small>
                      </>
                    ) : (
                      <span className="fd-diet-soft">–</span>
                    )}
                  </td>
                )}
                <td className="n">
                  {r.steps ? (
                    <>
                      {num(r.steps.avg)}
                      <small>{T.stepsGoal(num(stepsGoal), r.steps.goalDays)}</small>
                    </>
                  ) : (
                    <span className="fd-diet-soft">–</span>
                  )}
                </td>
                <td className="n">{r.workouts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {any && (
        <>
          <h3 className="fd-diet-wsub">{T.findingsTitle}</h3>
          <ul className="fd-diet-findings">
            {found.findings.map((f) => (
              <FindingItem key={f.factor} f={f} kcalPerKg={kcalPerKg} showKcal={showKcal} />
            ))}
          </ul>
          <p className="tight fd-diet-soft">{T.caveat}</p>
        </>
      )}
    </section>
  );
}
