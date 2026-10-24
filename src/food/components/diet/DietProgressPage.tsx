import { useMemo } from 'react';
import { pluralEn, text } from '../../../i18n';
import { STEP_GOAL } from '../../../engine/cardio';
import { useBridge } from '../../bridge';
import { totals, type DayTotals } from '../../diet/day';
import { addDays, mondayOf, shortDay } from '../../diet/model';
import { DIET_PROFILES } from '../../diet/profiles';
import { directionOf, hidesKcal, isComplete, snap05, targetOn } from '../../diet/target';
import { paceOver, reachRange, trendSeries, type PaceFit, type WeighIn } from '../../diet/trend';
import type { GoalBy, Profile } from '../../diet/types';
import { findings, weekRows, type DayFacts } from '../../diet/weeks';
import { useHistory, type History } from '../../hooks/useDiet';
import { formatDate, formatNumber, plural } from '../../lib/format';
import { dayMonth, monthRange, paceWord } from './dietFormat';
import { Loading, Onboarding } from './Onboarding';
import { useDietBase } from './useDietPage';
import { WeekTable } from './WeekTable';
import { WeightChart } from './WeightChart';
import './diet.css';

const T = text({
  pl: {
    progress: 'Postęp',
    nowTitle: 'Teraz (trend)',
    lastWeighIn: (day: string) => `ostatnie ważenie ${day}`,
    noWeighIn: 'brak ważenia',
    sinceTitle: 'Od startu',
    since: (date: string) => `od ${date}`,
    toGoTitle: 'Do celu',
    reached: 'cel osiągnięty',
    keeping: 'utrzymanie',
    targetWeight: (kg: string) => `waga docelowa ${kg}`,
    weight: 'Waga',
    pace: (weeks: number, kg: string, se: string) => `Tempo z ostatnich ${weeks} tygodni: ${kg} na tydzień (±${se}).`,
    noPace:
      'Za mało ważeń, żeby policzyć tempo — potrzebuję co najmniej 5 z 2 tygodni. Najlepiej waż się rano, kilka razy w tygodniu.',
    // „ok.” (około) takes the genitive: około tygodnia, około 3 tygodni, około 10 tygodni.
    planWeeks: (pace: string, weeks: number) =>
      `Przy zakładanym tempie (${pace} na tydzień) to ok. ${weeks} ${weeks === 1 ? 'tygodnia' : 'tygodni'}.`,
    planLater: 'Prognozę z Twoich danych pokażę po pierwszym dopasowaniu celu.',
    reach: (range: string) => `W tym tempie waga docelowa: ok. ${range}.`,
    reachEarliest: (month: string) => `W tym tempie waga docelowa najwcześniej: ${month}.`,
    reachFar: 'Przy tym tempie waga docelowa jest dalej niż 2 lata.',
    keepLine: 'Cel to utrzymanie wagi.',
    historyTitle: 'Cel kalorii — zmiany',
    historyRow: (date: string, kcal: string, who: string) => `${date} · ${kcal} kcal · ${who}`,
    who: {
      setup: 'start',
      user: 'Twoja zmiana',
      check: 'dopasowanie z wagi i zapisów',
      migration: 'przejście na nowe liczenie',
      break: 'przerwa',
      safety: 'bezpieczne minimum',
    } as Record<GoalBy, string>,
    kcalTitle: 'Kalorie – ostatnie 14 dni',
    kcalList: 'Zjedzone kalorie dzień po dniu',
    dayKcal: (day: string, eaten: string | null, goal: string, partial: boolean) =>
      `${day}: ${eaten === null ? 'brak zapisów' : `${eaten} kcal`}, cel ${goal}${partial ? ' – dzień niepełny' : ''}`,
    kcalLegend: 'Kreska: cel dnia · jasny słupek: dzień niepełny.',
    proteinTitle: 'Białko – ostatnie 7 dni',
    protein: (avg: string, target: string, n: number) =>
      `Średnio ${avg} g dziennie (cel ${target} g), z ${n} ${plural(n, 'dnia', 'dni', 'dni')} z pełnymi danymi.`,
    carbs: (avg: string, max: string) => `Węglowodany: średnio ${avg} g (limit ${max} g).`,
    noWeek: 'Brak zapisów z ostatniego tygodnia.',
  },
  en: {
    progress: 'Progress',
    nowTitle: 'Now (trend)',
    lastWeighIn: (day: string) => `last weigh-in ${day}`,
    noWeighIn: 'no weigh-in yet',
    sinceTitle: 'Since the start',
    since: (date: string) => `since ${date}`,
    toGoTitle: 'To go',
    reached: 'target reached',
    keeping: 'maintenance',
    targetWeight: (kg: string) => `target weight ${kg}`,
    weight: 'Weight',
    pace: (weeks: number, kg: string, se: string) => `Pace over the last ${weeks} weeks: ${kg} a week (±${se}).`,
    noPace:
      'Too few weigh-ins to work out a pace — I need at least 5 over 2 weeks. Weigh yourself in the morning, a few times a week.',
    planWeeks: (pace: string, weeks: number) =>
      `At the planned pace (${pace} a week) that’s about ${weeks} ${pluralEn(weeks, 'week', 'weeks')}.`,
    planLater: 'I’ll show a forecast from your data after the first fit of your target.',
    reach: (range: string) => `At this pace, the target weight: around ${range}.`,
    reachEarliest: (month: string) => `At this pace, the target weight at the earliest: ${month}.`,
    reachFar: 'At this pace the target weight is more than 2 years away.',
    keepLine: 'Your goal is to keep your weight.',
    historyTitle: 'Calorie target — changes',
    historyRow: (date: string, kcal: string, who: string) => `${date} · ${kcal} kcal · ${who}`,
    who: {
      setup: 'start',
      user: 'your change',
      check: 'fitted from weight and logs',
      migration: 'switch to the new counting',
      break: 'break',
      safety: 'safe minimum',
    } as Record<GoalBy, string>,
    kcalTitle: 'Calories – last 14 days',
    kcalList: 'Calories eaten day by day',
    dayKcal: (day: string, eaten: string | null, goal: string, partial: boolean) =>
      `${day}: ${eaten === null ? 'nothing logged' : `${eaten} kcal`}, target ${goal}${partial ? ' – incomplete day' : ''}`,
    kcalLegend: 'Line: the day’s target · light bar: incomplete day.',
    proteinTitle: 'Protein – last 7 days',
    protein: (avg: string, target: string, n: number) =>
      `${avg} g a day on average (target ${target} g), from ${n} ${pluralEn(n, 'day', 'days')} with full data.`,
    carbs: (avg: string, max: string) => `Carbs: ${avg} g on average (limit ${max} g).`,
    noWeek: 'Nothing logged in the last week.',
  },
});

/** Weeks in „Tydzień po tygodniu”, the current one included: a quarter — enough to compare, still about now. */
const WEEKS = 12;
/** The observed pace: least squares over the last 4 weeks, today included (spec §2.6). */
const PACE_DAYS = 28;
/** The chart goes back at least this far: the weeks the pace is worked out from. */
const CHART_DAYS = 28;
/** The forecast line goes at most a year ahead. */
const PROJECTION_DAYS = 365;
/** Two years: beyond it the plan arithmetic says nothing useful either. */
const FAR_DAYS = 730;
/** Changes of the target listed, newest first. */
const HISTORY = 6;

const kg = (n: number) => `${formatNumber(n, 1)} kg`;
/** „−1,6 kg”, „+0,4 kg”: the sign always, so a gain never reads as a loss. */
const signedKg = (n: number) => `${n >= 0.05 ? '+' : n <= -0.05 ? '−' : ''}${formatNumber(Math.abs(n), 1)} kg`;
/** The observed pace as a weight change a week, to 0.05 kg: „−0,5 kg” is losing. */
function weekKg(pace: number): string {
  const p = snap05(pace);
  return p === 0 ? '0 kg' : `${p > 0 ? '−' : '+'}${formatNumber(Math.abs(p), 2)} kg`;
}

/**
 * Postęp — podstrona dziennika: trend wagi z dziennika wagi (jednego dla treningów i diety), tempo
 * z ostatnich 4 tygodni z jego niepewnością i to, kiedy przy nim przyjdzie waga docelowa, historia
 * celu kalorii, tydzień po tygodniu, kalorie z dwóch tygodni wobec celu każdego dnia i białko
 * z ostatniego tygodnia.
 */
export default function DietProgressPage() {
  const { profile, clock } = useDietBase();
  const today = clock.date;
  // Twelve weeks for the table; the fortnight and the protein week sit inside them.
  const history = useHistory(profile ? addDays(mondayOf(today), -7 * (WEEKS - 1)) : null);

  if (profile === undefined) return <Loading />;
  if (!profile) return <Onboarding what={T.progress} />;
  if (!history) return <Loading />;
  return <ProgressView profile={profile} today={today} history={history} />;
}

type Reach =
  | { kind: 'keep' }
  | { kind: 'done' }
  | { kind: 'plan'; weeks: number }
  | { kind: 'far' }
  | { kind: 'range'; early: string; late: string | null };

/**
 * When the target weight comes (spec §2.6): before the burn is tied to data, plan arithmetic at the
 * planned pace; after, a month range from the observed pace ± 2 SE (`reachRange`) — or the plan
 * sentence when the pace points away or is under 0.1 kg a week. With it, the pace the forecast line
 * is drawn at; none for keeping weight or a target already reached.
 */
function reachOf(
  profile: Profile,
  trendKg: number,
  fit: PaceFit | null,
  today: string,
): { reach: Reach; pace: number | null } {
  const direction = directionOf(profile.goalPace);
  if (direction === 'keep') return { reach: { kind: 'keep' }, pace: null };
  const toGo = direction === 'gain' ? profile.targetWeightKg - trendKg : trendKg - profile.targetWeightKg;
  if (toGo < 0.05) return { reach: { kind: 'done' }, pace: null };
  if (profile.anchored && fit) {
    const r = reachRange({ trendKg, targetKg: profile.targetWeightKg, pace: fit.pace, se: fit.se, today });
    if (r.kind !== 'plan') return { reach: r, pace: fit.pace };
  }
  const weeks = toGo / Math.abs(profile.goalPace);
  if (weeks * 7 > FAR_DAYS) return { reach: { kind: 'far' }, pace: profile.goalPace };
  return { reach: { kind: 'plan', weeks: Math.max(1, Math.round(weeks)) }, pace: profile.goalPace };
}

/** A straight line from today's trend at a pace (kg a week, + losing), to the target weight or a year ahead. */
function projectionOf(trendKg: number, target: number, pace: number | null, today: string): WeighIn[] {
  if (pace === null || Math.abs(pace) < 1e-9) return [];
  const days = Math.min(PROJECTION_DAYS, Math.round((Math.abs(trendKg - target) / Math.abs(pace)) * 7));
  if (days < 1) return [];
  return [
    { day: today, kg: trendKg },
    { day: addDays(today, days), kg: trendKg - (pace * days) / 7 },
  ];
}

function ProgressView({ profile, today, history }: { profile: Profile; today: string; history: History }) {
  const bridge = useBridge();
  const { weights, stepsOn, moveOn } = bridge;
  const showKcal = !hidesKcal(profile);
  const direction = directionOf(profile.goalPace);

  const series = useMemo(() => trendSeries(weights).filter((p) => p.day <= today), [weights, today]);
  const fit = useMemo(() => paceOver(weights, addDays(today, 1 - PACE_DAYS), today), [weights, today]);
  const lastWeighIn = series.at(-1) ?? null;
  const trendKg = lastWeighIn?.trend ?? profile.startWeightKg;
  const target = profile.targetWeightKg;
  const { reach, pace } = reachOf(profile, trendKg, fit, today);
  const toGo = direction === 'gain' ? target - trendKg : trendKg - target;

  // The chart: from the diet's start, at least the pace's four weeks back; the trend runs on to today.
  const start = [profile.startDate, addDays(today, -CHART_DAYS)].sort()[0]!;
  const before = series.filter((p) => p.day < start).at(-1);
  const trendLine: WeighIn[] = [
    ...(before ? [{ day: start, kg: before.trend }] : []),
    ...series.filter((p) => p.day >= start).map((p) => ({ day: p.day, kg: p.trend })),
  ];
  if (lastWeighIn && trendLine.at(-1)?.day !== today) trendLine.push({ day: today, kg: trendKg });
  const measured = weights.filter((w) => w.day >= start && w.day <= today);
  const projection = projectionOf(trendKg, target, pace, today);

  // Week by week: the day's own target, whether the day counts, the gym's steps and sessions.
  const weeks = useMemo(() => {
    const first = addDays(mondayOf(today), -7 * (WEEKS - 1));
    const days: DayFacts[] = [];
    for (let date = first; date <= today; date = addDays(date, 1)) {
      const move = moveOn(date);
      const eaten = history.eaten.get(date) ?? null;
      const goal = targetOn(profile, date);
      days.push({
        date,
        eaten,
        goal,
        complete: date < today && isComplete(eaten, history.days.get(date)?.partial, goal),
        steps: stepsOn(date),
        workouts: move.workouts,
        snacks: move.snacks,
        outings: move.outings,
      });
    }
    const rows = weekRows({ days, weighIns: weights, today, stepsGoal: STEP_GOAL, weeks: WEEKS });
    return { rows, found: findings(rows, direction) };
  }, [profile, history, today, weights, stepsOn, moveOn, direction]);

  // The last two weeks against each day's own target; a day that does not count is a light bar.
  // Today is still going: only the person's own „Nie wszystko zapisane” marks it.
  const fortnight = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((date) => {
    const eaten = history.eaten.get(date) ?? null;
    const goal = targetOn(profile, date);
    const partial = history.days.get(date)?.partial;
    const part = eaten !== null && (date < today ? !isComplete(eaten, partial, goal) : partial === true);
    return { date, eaten, goal, part };
  });
  const maxKcal = Math.max(...fortnight.map((d) => Math.max(d.eaten ?? 0, d.goal))) * 1.1;

  // Protein over the week before today: complete days whose every entry has its macros — a dinner
  // logged as „650 kcal” is not 0 g of protein.
  const full: DayTotals[] = Array.from({ length: 7 }, (_, i) => addDays(today, i - 7)).flatMap((date) => {
    const eaten = history.eaten.get(date);
    if (eaten === undefined || !isComplete(eaten, history.days.get(date)?.partial, targetOn(profile, date))) return [];
    const t = totals(history.entries.filter((e) => e.date === date));
    return t.unknownMacros === 0 ? [t] : [];
  });
  const mean = (pick: (t: DayTotals) => number) => Math.round(full.reduce((s, t) => s + pick(t), 0) / full.length);
  const targets = DIET_PROFILES[profile.dietProfile].targets(targetOn(profile, today), target);

  const changes = [...profile.goals].sort((a, b) => b.from.localeCompare(a.from)).slice(0, HISTORY);

  return (
    <>
      <div className="wrap">
        <div className="tiles fd-diet-stats">
          <div className="tile">
            <b>{kg(trendKg)}</b>
            <span>
              {T.nowTitle} · {lastWeighIn ? T.lastWeighIn(dayMonth(lastWeighIn.day)) : T.noWeighIn}
            </span>
          </div>
          <div className="tile">
            <b>{signedKg(trendKg - profile.startWeightKg)}</b>
            <span>
              {T.sinceTitle} · {T.since(formatDate(profile.startDate))}
            </span>
          </div>
          <div className="tile">
            <b>{direction === 'keep' ? T.keeping : toGo < 0.05 ? T.reached : kg(toGo)}</b>
            <span>
              {T.toGoTitle} · {T.targetWeight(kg(target))}
            </span>
          </div>
        </div>
      </div>

      <section className="grp" aria-labelledby="fd-diet-chart-title">
        <h2 id="fd-diet-chart-title">{T.weight}</h2>
        {lastWeighIn && (
          <WeightChart start={start} today={today} measured={measured} trend={trendLine} projection={projection} target={target} />
        )}
        <ul className="fd-diet-bullets">
          <li>
            {fit
              ? T.pace(
                  Math.min(4, Math.max(2, Math.round(fit.spanDays / 7))),
                  weekKg(fit.pace),
                  formatNumber(Math.max(0.05, snap05(2 * fit.se)), 2),
                )
              : T.noPace}
          </li>
          {reach.kind !== 'done' && (
            <li>
              {reach.kind === 'keep'
                ? T.keepLine
                : reach.kind === 'far'
                  ? T.reachFar
                  : reach.kind === 'range'
                    ? reach.late
                      ? T.reach(monthRange(reach.early, reach.late))
                      : T.reachEarliest(monthRange(reach.early, null))
                    : `${T.planWeeks(paceWord(profile.goalPace), reach.weeks)}${profile.anchored ? '' : ` ${T.planLater}`}`}
            </li>
          )}
        </ul>
      </section>

      {showKcal && changes.length > 0 && (
        <section className="grp" aria-labelledby="fd-diet-history-title">
          <h2 id="fd-diet-history-title">{T.historyTitle}</h2>
          <ul className="fd-diet-history">
            {changes.map((g) => (
              <li key={g.from}>{T.historyRow(dayMonth(g.from), formatNumber(g.kcal, 0), T.who[g.by])}</li>
            ))}
          </ul>
        </section>
      )}

      <WeekTable rows={weeks.rows} found={weeks.found} stepsGoal={STEP_GOAL} kcalPerKg={profile.kcalPerKg} showKcal={showKcal} />

      {showKcal && (
        <section className="grp" aria-labelledby="fd-diet-kcal-title">
          <h2 id="fd-diet-kcal-title">{T.kcalTitle}</h2>
          <ol className="fd-diet-fortnight" aria-label={T.kcalList}>
            {fortnight.map((d) => {
              const line = T.dayKcal(
                shortDay(d.date),
                d.eaten === null ? null : formatNumber(d.eaten, 0),
                formatNumber(d.goal, 0),
                d.part,
              );
              return (
                <li key={d.date} title={line}>
                  <i className="fd-diet-goal" style={{ bottom: `${(d.goal / maxKcal) * 100}%` }} aria-hidden />
                  {d.eaten !== null ? (
                    <i
                      className={`fd-diet-fbar${d.part ? ' fd-diet-part' : ''}`}
                      style={{ height: `${(d.eaten / maxKcal) * 100}%` }}
                      aria-hidden
                    />
                  ) : (
                    <i className="fd-diet-fbar fd-diet-none" aria-hidden />
                  )}
                  <span className="sr-only">{line}</span>
                </li>
              );
            })}
          </ol>
          <div className="fd-diet-axis">
            <span>{shortDay(fortnight[0]!.date)}</span>
            <span>{shortDay(today)}</span>
          </div>
          <p className="tight fd-diet-soft">{T.kcalLegend}</p>
        </section>
      )}

      <section className="grp" aria-labelledby="fd-diet-protein-title">
        <h2 id="fd-diet-protein-title">{T.proteinTitle}</h2>
        {full.length ? (
          <>
            <p className="tight">{T.protein(formatNumber(mean((t) => t.protein), 0), formatNumber(targets.protein.target, 0), full.length)}</p>
            {targets.carbs.max !== null && (
              <p className="tight">{T.carbs(formatNumber(mean((t) => t.carbs), 0), formatNumber(targets.carbs.max, 0))}</p>
            )}
          </>
        ) : (
          <p className="tight">{T.noWeek}</p>
        )}
      </section>
    </>
  );
}
