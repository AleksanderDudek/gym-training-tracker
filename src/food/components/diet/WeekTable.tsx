import { LOCALE, pluralEn, text } from '../../../i18n';
import type { GoalDirection } from '../../diet/energy';
import { addDays, shortDay } from '../../diet/model';
import { MIN_WEEKS, onGoal, type DayFacts, type Finding, type Findings, type WeekRow } from '../../diet/weeks';
import { formatNumber, plural } from '../../lib/format';

interface Props {
  rows: WeekRow[];
  found: Findings;
  direction: GoalDirection;
  stepsGoal: number;
  today: string;
  /** Energy in a kilogram (`Profile.kcalPerKg`) — what a food difference means on the scale. */
  kcalPerKg: number;
}

const num = (n: number) => formatNumber(Math.round(n), 0);

/** „13 Oct” — the English week label names the month. */
const DAY_MONTH = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayMonth = (date: string) => DAY_MONTH.format(new Date(`${date}T12:00:00Z`));

const T = text({
  pl: {
    thisWeek: 'ten tydzień',
    /** „13–19.10”, across months „28.09–4.10”. */
    range: (monday: string, sunday: string) => {
      const [, m1, d1] = monday.split('-').map(Number);
      const [, m2, d2] = sunday.split('-').map(Number);
      return m1 === m2 ? `${d1}–${d2}.${String(m2).padStart(2, '0')}` : `${d1}.${String(m1).padStart(2, '0')}–${d2}.${String(m2).padStart(2, '0')}`;
    },
    noFood: 'bez zapisów jedzenia',
    food: (eaten: string, goal: string) => `${eaten} kcal (cel ${goal})`,
    steps: (n: number, goalMet: boolean) =>
      `${num(n)} ${plural(n, 'krok', 'kroki', 'kroków')}${goalMet ? ' – cel kroków' : ''}`,
    workouts: (n: number) => (n === 1 ? 'trening' : `${n} treningi`),
    snacks: (n: number) => `${n} ${plural(n, 'przekąska ruchowa', 'przekąski ruchowe', 'przekąsek ruchowych')}`,
    ongoing: ' (dzień trwa)',
    more: {
      eating: () => 'jedzenie w celu przez większość dni',
      workouts: (t: number) => `co najmniej ${t} ${plural(t, 'trening', 'treningi', 'treningów')} w tygodniu`,
      steps: (t: number) => `średnio co najmniej ${num(t)} kroków dziennie`,
      snacks: (t: number) =>
        `co najmniej ${t} ${plural(t, 'przekąska ruchowa', 'przekąski ruchowe', 'przekąsek ruchowych')} w tygodniu`,
      outings: (t: number) => `co najmniej ${t} ${plural(t, 'wyjście', 'wyjścia', 'wyjść')} na cardio w tygodniu`,
    },
    weeks: (n: number) => `${n} ${plural(n, 'tydzień', 'tygodnie', 'tygodni')}`,
    perWeek: '/tydz.',
    strength: { weak: 'słaby', moderate: 'umiarkowany', clear: 'wyraźny' },
    flat: 'bez wyraźnej różnicy',
    helps: 'sprzyja celowi',
    hurts: 'nie sprzyja celowi',
    body: (more: string, moreWeeks: string, less: string, lessWeeks: string, strength: string) =>
      `Średnio ${more} (${moreWeeks}) · w pozostałych ${less} (${lessWeeks}). Związek ${strength}.`,
    gap: (kcal: string, lower: boolean, kg: string) =>
      ` W tych tygodniach jedzenie było średnio o ${kcal} kcal dziennie ${lower ? 'niższe' : 'wyższe'} — to samo w sobie ok. ${kg} kg tygodniowo.`,
    title: 'Co działa u ciebie',
    lead: 'Tydzień po tygodniu: jedzenie, ruch i waga. Waga to trend z ważeń od poniedziałku do następnego poniedziałku — z jednego ważenia trendu nie widać.',
    scroll: 'Tabela tygodni – przewiń w bok',
    head: {
      week: 'Tydzień',
      weight: 'Waga',
      food: 'Jedzenie',
      steps: 'Kroki',
      workouts: 'Treningi',
      snacks: 'Przekąski ruchowe',
      cardio: 'Cardio',
      minutes: 'Minuty ruchu',
    },
    fewWeighIns: 'Za mało ważeń: potrzeba dwóch, co najmniej cztery dni od siebie',
    fewWeighInsSr: ' za mało ważeń',
    days: (n: number) => plural(n, 'dzień', 'dni', 'dni'),
    stepsGoal: (n: number) => `cel: ${n}×`,
    legend: 'Legenda siatki dni',
    onGoal: 'jedzenie w celu',
    offGoal: 'poza celem',
    unlogged: 'bez zapisów',
    training: 'trening',
    stepsMet: 'cel kroków',
    snack: 'przekąska ruchowa',
    note: 'Jedzenie: średnia z dni z zapisami, pod nią różnica wobec celu dnia i liczba dni. Kroki: średnia i ile dni z celem. Obie bez dzisiejszego dnia, który jeszcze trwa. Cardio: bieżnia, rower, taniec oraz biegi i marsze z zegarka od 10 minut.',
    findingsTitle: 'Co idzie w parze z postępem',
    noFindings: (min: number, weeks: string) =>
      `Porównanie tygodni pojawi się po ${min} pełnych tygodniach z co najmniej dwoma ważeniami (np. w poniedziałek i w piątek), w których coś się różniło – liczba treningów, kroków, przekąsek ruchowych albo jedzenie. Teraz: ${weeks}.`,
    caveat:
      'To skojarzenia z twoich tygodni, nie dowód: punktów jest mało, a waga skacze od wody. Najwięcej robi jedzenie – jeśli w „lepszych” tygodniach było go mniej, to ono mogło zrobić różnicę.',
  },
  en: {
    thisWeek: 'this week',
    /** „13–19 Oct”, across months „28 Sept – 4 Oct”. */
    range: (monday: string, sunday: string) =>
      monday.slice(5, 7) === sunday.slice(5, 7)
        ? `${Number(monday.slice(8))}–${dayMonth(sunday)}`
        : `${dayMonth(monday)} – ${dayMonth(sunday)}`,
    noFood: 'no food logged',
    food: (eaten: string, goal: string) => `${eaten} kcal (goal ${goal})`,
    steps: (n: number, goalMet: boolean) => `${num(n)} ${pluralEn(n, 'step', 'steps')}${goalMet ? ' – step goal' : ''}`,
    workouts: (n: number) => (n === 1 ? 'workout' : `${n} workouts`),
    snacks: (n: number) => `${n} ${pluralEn(n, 'exercise snack', 'exercise snacks')}`,
    ongoing: ' (today, still going)',
    more: {
      eating: () => 'eating on goal most days',
      workouts: (t: number) => `at least ${t} ${pluralEn(t, 'workout', 'workouts')} a week`,
      steps: (t: number) => `at least ${num(t)} steps a day on average`,
      snacks: (t: number) => `at least ${t} ${pluralEn(t, 'exercise snack', 'exercise snacks')} a week`,
      outings: (t: number) => `at least ${t} cardio ${pluralEn(t, 'session', 'sessions')} a week`,
    },
    weeks: (n: number) => `${n} ${pluralEn(n, 'week', 'weeks')}`,
    perWeek: '/wk',
    strength: { weak: 'weak', moderate: 'moderate', clear: 'clear' },
    flat: 'no clear difference',
    helps: 'helps your goal',
    hurts: 'works against your goal',
    body: (more: string, moreWeeks: string, less: string, lessWeeks: string, strength: string) =>
      `On average ${more} (${moreWeeks}) · in the other weeks ${less} (${lessWeeks}). The link is ${strength}.`,
    gap: (kcal: string, lower: boolean, kg: string) =>
      ` In those weeks you ate ${kcal} kcal a day ${lower ? 'less' : 'more'} on average — that alone is about ${kg} kg a week.`,
    title: 'What works for you',
    lead: 'Week by week: food, activity and weight. Weight is the trend of your weigh-ins from one Monday to the next — a single weigh-in shows no trend.',
    scroll: 'Weeks table – scroll sideways',
    head: {
      week: 'Week',
      weight: 'Weight',
      food: 'Food',
      steps: 'Steps',
      workouts: 'Workouts',
      snacks: 'Exercise snacks',
      cardio: 'Cardio',
      minutes: 'Active minutes',
    },
    fewWeighIns: 'Too few weigh-ins: you need two, at least four days apart',
    fewWeighInsSr: ' too few weigh-ins',
    days: (n: number) => pluralEn(n, 'day', 'days'),
    stepsGoal: (n: number) => `goal: ${n}×`,
    legend: 'Day grid legend',
    onGoal: 'eating on goal',
    offGoal: 'off goal',
    unlogged: 'nothing logged',
    training: 'workout',
    stepsMet: 'step goal',
    snack: 'exercise snack',
    note: 'Food: the average of the logged days, below it the difference from the day’s goal and the number of days. Steps: the average and how many days hit the goal. Both leave out today, which isn’t over yet. Cardio: treadmill, bike, dance, and runs and walks from the watch of 10 minutes or more.',
    findingsTitle: 'What goes with your progress',
    noFindings: (min: number, weeks: string) =>
      `The comparison shows up after ${min} full weeks with at least two weigh-ins each (e.g. Monday and Friday) in which something differed – the number of workouts, steps, exercise snacks, or the eating. So far: ${weeks}.`,
    caveat:
      'These are patterns in your weeks, not proof: there are few data points and weight jumps around with water. Food does the most – if you ate less in the “better” weeks, that may be what made the difference.',
  },
});
/** „−0,4 kg”: the sign always, so a gain never reads as a loss. */
const signedKg = (n: number) => `${n > 0.005 ? '+' : n < -0.005 ? '−' : ''}${formatNumber(Math.abs(n), 1)} kg`;
const signedKcal = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`;

/** „13–19.10”, across months „28.09–4.10”; the current week is „ten tydzień”. */
function weekLabel(r: WeekRow): string {
  if (!r.complete) return T.thisWeek;
  return T.range(r.monday, addDays(r.monday, 6));
}

type Food = 'ok' | 'off' | 'none';

const foodOf = (d: DayFacts, direction: GoalDirection): Food =>
  d.eaten === null ? 'none' : onGoal(d.eaten, d.goal, direction) ? 'ok' : 'off';

/** A day in words for screen readers and the tooltip: „pn 13.10: 1 950 kcal (cel 2 000) · 9 800 kroków · trening”. */
function dayText(d: DayFacts, stepsGoal: number, today: string): string {
  const parts = [
    d.eaten === null ? T.noFood : T.food(num(d.eaten), num(d.goal)),
    d.steps !== null ? T.steps(d.steps, d.steps >= stepsGoal) : null,
    d.workouts ? T.workouts(d.workouts) : null,
    d.snacks ? T.snacks(d.snacks) : null,
    d.outings ? `cardio${d.outings > 1 ? ` ×${d.outings}` : ''}` : null,
  ];
  return `${shortDay(d.date)}${d.date === today ? T.ongoing : ''}: ${parts.filter(Boolean).join(' · ')}`;
}

/** The week's seven days: food as the cell, habits as marks — shapes, not only colours. */
function DayGrid({
  days,
  direction,
  stepsGoal,
  today,
}: {
  days: DayFacts[];
  direction: GoalDirection;
  stepsGoal: number;
  today: string;
}) {
  return (
    <span className="fd-diet-wgrid" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => {
        const d = days[i];
        if (!d) return <span key={i} className="fd-diet-wday fd-diet-wfuture" />;
        return (
          <span key={d.date} className="fd-diet-wday" title={dayText(d, stepsGoal, today)}>
            <i className={`fd-diet-wfood fd-diet-wf-${foodOf(d, direction)}`} />
            <i className={`fd-diet-wm fd-diet-wtrain${d.workouts ? '' : ' fd-diet-wm-off'}`} />
            <i className={`fd-diet-wm fd-diet-wsteps${d.steps !== null && d.steps >= stepsGoal ? '' : ' fd-diet-wm-off'}`} />
            <i className={`fd-diet-wm fd-diet-wsnack${d.snacks ? '' : ' fd-diet-wm-off'}`} />
            <i className={`fd-diet-wm fd-diet-wcardio${d.outings ? '' : ' fd-diet-wm-off'}`} />
          </span>
        );
      })}
    </span>
  );
}

/** „co najmniej 3 treningi w tygodniu” — the side of a finding with more of the habit. */
function moreText(f: Finding): string {
  return T.more[f.factor](f.threshold ?? 0);
}

const weeksWord = T.weeks;
const pace = (kg: number) => `${signedKg(kg)}${T.perWeek}`;
const STRENGTH: Record<Finding['strength'], string> = T.strength;

function FindingItem({ f, kcalPerKg }: { f: Finding; kcalPerKg: number }) {
  const verdict = f.helps === null ? T.flat : f.helps ? T.helps : T.hurts;
  const tone = f.helps === null ? 'flat' : f.helps ? 'good' : 'bad';
  const gap = f.kcalGap !== null && Math.abs(f.kcalGap) >= 50 ? f.kcalGap : null;
  return (
    <li className="fd-diet-finding">
      <p className="fd-diet-fhead">
        <strong>{moreText(f)}</strong> <span className={`fd-diet-fchip fd-diet-w${tone}`}>{verdict}</span>
      </p>
      <p className="fd-diet-fbody">
        {T.body(
          pace(f.more.change),
          weeksWord(f.more.weeks),
          pace(f.less.change),
          weeksWord(f.less.weeks),
          STRENGTH[f.strength],
        )}
        {gap !== null && T.gap(num(Math.abs(gap)), gap < 0, formatNumber((Math.abs(gap) * 7) / kcalPerKg, 2))}
      </p>
    </li>
  );
}

/**
 * „Co działa u ciebie”: tydzień po tygodniu jedzenie, ruch i waga — z siatką dni, w której widać
 * treningi, kroki, przekąski ruchowe i cardio — a pod nią, co z tego idzie w parze z postępem.
 */
export function WeekTable({ rows, found, direction, stepsGoal, today, kcalPerKg }: Props) {
  if (!rows.length) return null;
  return (
    <section className="grp" aria-labelledby="fd-diet-weeks-title">
      <h2 id="fd-diet-weeks-title">{T.title}</h2>
      <p className="tight fd-diet-soft">{T.lead}</p>
      <div className="fd-diet-scroll" tabIndex={0} role="region" aria-label={T.scroll}>
        <table className="fd-diet-weeks">
          <thead>
            <tr>
              <th scope="col">{T.head.week}</th>
              <th scope="col" className="n">
                {T.head.weight}
              </th>
              <th scope="col" className="n">
                {T.head.food}
              </th>
              <th scope="col" className="n">
                {T.head.steps}
              </th>
              <th scope="col" className="n">
                {T.head.workouts}
              </th>
              <th scope="col" className="n">
                {T.head.snacks}
              </th>
              <th scope="col" className="n">
                {T.head.cardio}
              </th>
              <th scope="col" className="n">
                {T.head.minutes}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.monday}>
                <th scope="row">
                  <span className="fd-diet-wlabel">{weekLabel(r)}</span>
                  <DayGrid days={r.days} direction={direction} stepsGoal={stepsGoal} today={today} />
                  <span className="sr-only">{r.days.map((d) => dayText(d, stepsGoal, today)).join('. ')}</span>
                </th>
                <td className="n">
                  {r.weight ? (
                    <span className={`fd-diet-wchange fd-diet-w${r.verdict}`}>{signedKg(r.weight.change)}</span>
                  ) : (
                    <span className="fd-diet-soft" title={T.fewWeighIns}>
                      –<span className="sr-only">{T.fewWeighInsSr}</span>
                    </span>
                  )}
                </td>
                <td className="n">
                  {r.eaten ? (
                    <>
                      {num(r.eaten.avg)}
                      <small>
                        {signedKcal(r.eaten.avg - r.eaten.goal)} · {r.eaten.days} {T.days(r.eaten.days)}
                      </small>
                    </>
                  ) : (
                    <span className="fd-diet-soft">–</span>
                  )}
                </td>
                <td className="n">
                  {r.steps ? (
                    <>
                      {num(r.steps.avg)}
                      <small>{T.stepsGoal(r.steps.goalDays)}</small>
                    </>
                  ) : (
                    <span className="fd-diet-soft">–</span>
                  )}
                </td>
                <td className="n">{r.workouts}</td>
                <td className="n">{r.snacks}</td>
                <td className="n">{r.outings}</td>
                <td className="n">{num(r.activeMin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="fd-diet-wlegend" aria-label={T.legend}>
        <li>
          <i className="fd-diet-wfood fd-diet-wf-ok" aria-hidden /> {T.onGoal}
        </li>
        <li>
          <i className="fd-diet-wfood fd-diet-wf-off" aria-hidden /> {T.offGoal}
        </li>
        <li>
          <i className="fd-diet-wfood fd-diet-wf-none" aria-hidden /> {T.unlogged}
        </li>
        <li>
          <i className="fd-diet-wm fd-diet-wtrain" aria-hidden /> {T.training}
        </li>
        <li>
          <i className="fd-diet-wm fd-diet-wsteps" aria-hidden /> {T.stepsMet}
        </li>
        <li>
          <i className="fd-diet-wm fd-diet-wsnack" aria-hidden /> {T.snack}
        </li>
        <li>
          <i className="fd-diet-wm fd-diet-wcardio" aria-hidden /> cardio
        </li>
      </ul>
      <p className="tight fd-diet-soft">{T.note}</p>

      <h3 className="fd-diet-wsub">{T.findingsTitle}</h3>
      {found.findings.length ? (
        <ul className="fd-diet-findings">
          {found.findings.map((f) => (
            <FindingItem key={f.factor} f={f} kcalPerKg={kcalPerKg} />
          ))}
        </ul>
      ) : (
        <p className="tight">{T.noFindings(MIN_WEEKS, weeksWord(found.weeks))}</p>
      )}
      <p className="tight fd-diet-soft">{T.caveat}</p>
    </section>
  );
}
