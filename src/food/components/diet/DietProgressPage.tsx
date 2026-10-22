import { useMemo, type ReactNode } from 'react';
import { pluralEn, text } from '../../../i18n';
import { useBridge } from '../../bridge';
import { withGymSteps } from '../../diet/body';
import { macroStatus, totals, type DayTotals, type Status } from '../../diet/day';
import { dayReaching, forecast, goalDirection } from '../../diet/energy';
import { addDays, dayGoal, forecastInputs, lastWeighing, mondayOf, projectFromWeighing, shortDay } from '../../diet/model';
import { findings, weekRows, type DayFacts } from '../../diet/weeks';
import { activityKcalOf, useActivity } from '../../hooks/useActivity';
import type { Plan } from '../../diet/plan';
import { DIET_PROFILES } from '../../diet/profiles';
import type { Profile } from '../../diet/types';
import { useMergedHistory, type History } from '../../hooks/useDiet';
import { formatDate, formatNumber } from '../../lib/format';
import { Loading, Onboarding } from './Onboarding';
import { useDietBase } from './useDietPage';
import { WeekTable } from './WeekTable';
import { WeightChart, type ChartPoint } from './WeightChart';
import { DT } from './dietText';
import './diet.css';

const T = text({
  pl: {
    progress: 'Postęp',
    status: { brak: 'za mało', ok: 'w normie', nadmiar: 'za dużo' } as Record<Status, string>,
    now: 'Teraz',
    weighedOn: (day: string) => `ważenie ${day}`,
    noWeighing: 'brak ważenia',
    less: 'Mniej o',
    more: 'Więcej o',
    keeping: 'utrzymanie',
    reached: 'cel osiągnięty',
    toGo: (goal: string) => `Do celu · cel ${goal}`,
    weight: 'Waga',
    keepLine: 'Cel to utrzymanie wagi – linia planu pokazuje, dokąd prowadzi cel kalorii.',
    planReach: (date: ReactNode): ReactNode => <>Według planu cel {date}.</>,
    planNever: 'Według planu cel nie zostanie osiągnięty w ciągu dwóch lat.',
    fromWeighing: (date: ReactNode): ReactNode => <>Od ostatniego ważenia, jedząc według planu: {date}.</>,
    fromWeighingNever:
      'Od ostatniego ważenia, jedząc według planu: cel poza zasięgiem dwóch lat – sprawdź cel kalorii w profilu diety.',
    model: (model: string, scale: string) =>
      `Z zapisów jedzenia wynikałoby dziś ${model}; waga pokazuje ${scale}. Woda i jelita potrafią przesunąć wynik o 1–2 kg – patrz na trend, nie na jeden dzień.`,
    kcalTitle: 'Kalorie – ostatnie 14 dni',
    kcalList: 'Zjedzone kalorie dzień po dniu',
    dayKcal: (day: string, eaten: string | null, goal: string, over: boolean) =>
      `${day}: ${eaten === null ? 'brak zapisów' : `${eaten} kcal`}, cel ${goal}${over ? ' – ponad cel' : ''}`,
    kcalLegend: 'Kreska przerywana: cel dnia · pomarańczowy słupek: ponad cel.',
    macroTitle: 'Makroskładniki – średnia z ostatniego tygodnia',
    macroLead: (days: number, complete: number, label: string) =>
      `Kalorie z ${days} ${days === 1 ? 'dnia' : 'dni'} z zapisami, makroskładniki z ${complete} ${complete === 1 ? 'dnia' : 'dni'} z pełnymi danymi – wobec celów profilu „${label}”.`,
    kcal: 'Kalorie',
    noMacros: 'brak danych – wpisy mają tylko kalorie',
    noWeek: 'Brak zapisów z ostatniego tygodnia.',
  },
  en: {
    progress: 'Progress',
    status: { brak: 'too little', ok: 'on target', nadmiar: 'too much' } as Record<Status, string>,
    now: 'Now',
    weighedOn: (day: string) => `weigh-in ${day}`,
    noWeighing: 'no weigh-in yet',
    less: 'Down by',
    more: 'Up by',
    keeping: 'maintenance',
    reached: 'goal reached',
    toGo: (goal: string) => `To go · goal ${goal}`,
    weight: 'Weight',
    keepLine: 'Your goal is to keep your weight – the plan line shows where your calorie goal leads.',
    planReach: (date: ReactNode): ReactNode => <>On plan, you reach your goal on {date}.</>,
    planNever: 'On plan, you won’t reach your goal within two years.',
    fromWeighing: (date: ReactNode): ReactNode => <>From your last weigh-in, eating to plan: {date}.</>,
    fromWeighingNever:
      'From your last weigh-in, eating to plan: the goal is more than two years away – check the calorie goal in your diet profile.',
    model: (model: string, scale: string) =>
      `Your food log points to ${model} today; the scale shows ${scale}. Water and digestion can shift it by 1–2 kg – watch the trend, not a single day.`,
    kcalTitle: 'Calories – last 14 days',
    kcalList: 'Calories eaten day by day',
    dayKcal: (day: string, eaten: string | null, goal: string, over: boolean) =>
      `${day}: ${eaten === null ? 'nothing logged' : `${eaten} kcal`}, goal ${goal}${over ? ' – over the goal' : ''}`,
    kcalLegend: 'Dashed line: the day’s goal · orange bar: over the goal.',
    macroTitle: 'Macros – average of the last week',
    macroLead: (days: number, complete: number, label: string) =>
      `Calories from ${days} logged ${pluralEn(days, 'day', 'days')}, macros from ${complete} ${pluralEn(complete, 'day', 'days')} with full data – against the targets of “${label}”.`,
    kcal: 'Calories',
    noMacros: 'no data – the entries have calories only',
    noWeek: 'Nothing logged in the last week.',
  },
});

/** Dwa lata to najdalej, jak sięga prognoza: dalej model nie mówi nic użytecznego. */
const HORIZON = 730;

/** Tygodnie w tabeli „Co działa u ciebie”, z bieżącym: kwartał — dość, żeby porównać, i wciąż o teraz. */
const WEEKS = 12;

const kg = (n: number) => `${formatNumber(n, 1)} kg`;

/**
 * Postęp — podstrona dziennika: waga z dziennika wagi (jednego dla treningów i diety), prognoza,
 * kalorie z dwóch tygodni i makro z ostatniego tygodnia.
 */
export default function DietProgressPage() {
  const { profile, plan, clock } = useDietBase();
  const today = clock.date;
  // Historia na prognozę (od startu), dwa tygodnie kalorii i dwanaście tygodni tabeli.
  const from = profile ? [profile.startDate, addDays(today, -14), addDays(mondayOf(today), -7 * (WEEKS - 1))].sort()[0]! : null;
  const history = useMergedHistory(from);

  if (profile === undefined || plan === undefined) return <Loading />;
  if (!profile) return <Onboarding what={T.progress} />;
  if (!history) return <Loading />;
  return <ProgressView profile={profile} plan={plan} today={today} history={history} />;
}

const STATUS_WORD: Record<Status, string> = T.status;

function ProgressView({
  profile,
  plan,
  today,
  history,
}: {
  profile: Profile;
  plan: Plan | null;
  today: string;
  history: History;
}) {
  const bridge = useBridge();
  // Wzrost z treningów ma pierwszeństwo przed zapisanym w profilu diety (to ta sama osoba, a profil
  // treningowy jest źródłem prawdy) — podstawowa przemiana, a z nią cała prognoza, liczy się z niego.
  const body = useMemo(
    () => ({ ...profile, heightCm: bridge.heightCm ?? profile.heightCm }),
    [profile, bridge.heightCm],
  );
  const { stepsOn } = bridge;
  const activity = useActivity(profile, today);
  const model = useMemo(() => {
    // Kroki z treningów także w dniach bez wiersza diety — inaczej prognoza przyjęłaby tam plan kroków.
    const inputs = withGymSteps(forecastInputs(body, plan, history, today, HORIZON), stepsOn);
    const series = forecast(body, inputs);
    const weighing = lastWeighing(history.days.values());
    const projection = projectFromWeighing(body, inputs, weighing);
    const projected = [...projection].map(([date, w]) => ({ date, plan: w, real: w }));
    const direction = goalDirection(body);
    return {
      series,
      weighing,
      projection,
      planReach: dayReaching(body.targetWeightKg, series, 'plan', direction),
      projectedReach: dayReaching(body.targetWeightKg, projected, 'real', direction),
    };
  }, [body, plan, history, today, stepsOn]);

  const measured = [...history.days.values()]
    .flatMap((d) => (d.weightKg == null ? [] : [{ date: d.date, kg: d.weightKg }]))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Wykres do celu (i trochę za nim), co najmniej miesiąc naprzód od dziś.
  const reach = [model.planReach, model.projectedReach]
    .filter((d): d is string => d !== null)
    .sort()
    .at(-1);
  const chartEnd = [addDays(today, 30), reach ? addDays(reach, 7) : addDays(today, 90)].sort().at(-1)!;
  const points: ChartPoint[] = model.series
    .filter((p) => p.date <= chartEnd)
    .map((p) => ({ date: p.date, plan: p.plan, projection: model.projection.get(p.date) ?? null }));

  // Tydzień po tygodniu: jedzenie wobec celu dnia, ruch z treningów i trend wagi.
  const weeks = useMemo(() => {
    const first = addDays(mondayOf(today), -7 * (WEEKS - 1));
    const goalActivity = activityKcalOf(activity);
    const days: DayFacts[] = [];
    for (let date = first; date <= today; date = addDays(date, 1)) {
      const move = bridge.moveOn(date);
      days.push({
        date,
        eaten: history.eaten.get(date) ?? null,
        goal: dayGoal(body, history.eaten, date, today, goalActivity).kcal,
        steps: bridge.stepsOn(date),
        workouts: move.workouts,
        snacks: move.snacks,
        outings: move.outings,
        activeMin: move.activeMin,
      });
    }
    const weighIns = [...history.days.values()].flatMap((d) => (d.weightKg == null ? [] : [{ date: d.date, kg: d.weightKg }]));
    const direction = goalDirection(body);
    const rows = weekRows({ days, weighIns, today, stepsGoal: body.targetSteps, direction });
    return { rows, found: findings(rows, direction), direction };
  }, [body, history, today, activity, bridge]);

  const current = model.weighing?.kg ?? profile.startWeightKg;
  const lost = profile.startWeightKg - current;
  const direction = goalDirection(profile);
  // Do celu w stronę celu: przy przybieraniu cel jest nad obecną wagą.
  const toGo = direction === 'gain' ? profile.targetWeightKg - current : current - profile.targetWeightKg;
  const modelToday = model.series.find((p) => p.date === today)?.real;

  // Ostatnie dwa tygodnie wobec celu każdego dnia.
  const fortnight = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((date) => ({
    date,
    eaten: history.eaten.get(date) ?? null,
    goal: dayGoal(body, history.eaten, date, today, activityKcalOf(activity)).kcal,
  }));
  const maxKcal = Math.max(...fortnight.map((d) => Math.max(d.eaten ?? 0, d.goal))) * 1.1;

  // Tydzień makro: średnia z dni z zapisami, nie z siedmiu. Kalorie liczą każdy dzień z zapisami;
  // makro tylko dni, w których każdy wpis je ma — obiad zapisany jako „650 kcal” to nie 0 g białka.
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 7)).filter((d) => history.eaten.has(d));
  const byDate = new Map<string, DayTotals>();
  for (const date of week) byDate.set(date, totals(history.entries.filter((e) => e.date === date)));
  const complete = week.filter((d) => byDate.get(d)?.unknownMacros === 0);
  const mean = (days: string[], pick: (t: DayTotals) => number) =>
    Math.round(days.reduce((sum, d) => sum + pick(byDate.get(d)!), 0) / days.length);
  const average: DayTotals | null = week.length
    ? {
        kcal: mean(week, (t) => t.kcal),
        protein: complete.length ? mean(complete, (t) => t.protein) : 0,
        carbs: complete.length ? mean(complete, (t) => t.carbs) : 0,
        fat: complete.length ? mean(complete, (t) => t.fat) : 0,
        unknownMacros: week.length - complete.length,
      }
    : null;
  const dietProfile = DIET_PROFILES[body.dietProfile];
  const targets = dietProfile.targets(body.dailyKcal, body.targetWeightKg);
  const weekStatus = average ? macroStatus(targets, average, true) : null;
  const firstDay = fortnight[0]!;

  return (
    <>
      <div className="wrap">
        <div className="tiles fd-diet-stats">
          <div className="tile">
            <b>{kg(profile.startWeightKg)}</b>
            <span>Start · {formatDate(profile.startDate)}</span>
          </div>
          <div className="tile">
            <b>{kg(current)}</b>
            <span>
              {T.now} · {model.weighing ? T.weighedOn(shortDay(model.weighing.date)) : T.noWeighing}
            </span>
          </div>
          <div className="tile">
            <b>{kg(Math.abs(lost))}</b>
            <span>{lost >= 0 ? T.less : T.more}</span>
          </div>
          <div className="tile">
            <b>{direction === 'keep' ? T.keeping : toGo > 0 ? kg(toGo) : T.reached}</b>
            <span>{T.toGo(kg(profile.targetWeightKg))}</span>
          </div>
        </div>
      </div>

      <section className="grp" aria-labelledby="fd-diet-chart-title">
        <h2 id="fd-diet-chart-title">{T.weight}</h2>
        <WeightChart
          start={profile.startDate}
          today={today}
          points={points}
          measured={measured}
          target={profile.targetWeightKg}
        />
        <ul className="fd-diet-bullets">
          {direction === 'keep' ? (
            <li>{T.keepLine}</li>
          ) : (
            <li>
              {model.planReach ? T.planReach(<strong>{formatDate(model.planReach)}</strong>) : T.planNever}
            </li>
          )}
          {model.weighing && direction !== 'keep' && (
            <li>
              {model.projectedReach
                ? T.fromWeighing(<strong>{formatDate(model.projectedReach)}</strong>)
                : T.fromWeighingNever}
            </li>
          )}
        </ul>
        {modelToday !== undefined && model.weighing && (
          <p className="tight">{T.model(kg(modelToday), kg(current))}</p>
        )}
      </section>

      <WeekTable
        rows={weeks.rows}
        found={weeks.found}
        direction={weeks.direction}
        stepsGoal={body.targetSteps}
        today={today}
        kcalPerKg={body.kcalPerKg}
      />

      <section className="grp" aria-labelledby="fd-diet-kcal-title">
        <h2 id="fd-diet-kcal-title">{T.kcalTitle}</h2>
        <ol className="fd-diet-fortnight" aria-label={T.kcalList}>
          {fortnight.map((d) => {
            const over = d.eaten !== null && d.eaten > d.goal * 1.05;
            const text = T.dayKcal(
              shortDay(d.date),
              d.eaten === null ? null : formatNumber(d.eaten, 0),
              formatNumber(d.goal, 0),
              over,
            );
            return (
              <li key={d.date} title={text}>
                <i className="fd-diet-goal" style={{ bottom: `${(d.goal / maxKcal) * 100}%` }} aria-hidden />
                {d.eaten !== null ? (
                  <i
                    className={`fd-diet-fbar${over ? ' over' : ''}`}
                    style={{ height: `${(d.eaten / maxKcal) * 100}%` }}
                    aria-hidden
                  />
                ) : (
                  <i className="fd-diet-fbar fd-diet-none" aria-hidden />
                )}
                <span className="sr-only">{text}</span>
              </li>
            );
          })}
        </ol>
        <div className="fd-diet-axis">
          <span>{shortDay(firstDay.date)}</span>
          <span>{shortDay(today)}</span>
        </div>
        <p className="tight fd-diet-soft">{T.kcalLegend}</p>
      </section>

      <section className="grp" aria-labelledby="fd-diet-macro-title">
        <h2 id="fd-diet-macro-title">{T.macroTitle}</h2>
        {average && weekStatus ? (
          <>
            <p className="tight">{T.macroLead(week.length, complete.length, dietProfile.label)}</p>
            <dl className="fd-diet-avg">
              {(
                [
                  ['kcal', T.kcal, `${average.kcal} / ${targets.kcal}`],
                  ['protein', DT.protein, `${average.protein} / ${targets.protein.target} g`],
                  ['carbs', DT.carbs, `${average.carbs} / ${targets.carbs.max ?? targets.carbs.target} g`],
                  ['fat', DT.fat, `${average.fat} / ${targets.fat.target} g`],
                ] as const
              ).map(([key, label, value]) =>
                key !== 'kcal' && complete.length === 0 ? (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd className="fd-diet-soft">{T.noMacros}</dd>
                  </div>
                ) : (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd className="fd-diet-avg-val">{value}</dd>
                    <dd className={`fd-diet-note fd-diet-${weekStatus[key].status}`}>
                      {STATUS_WORD[weekStatus[key].status]}
                      {key !== 'kcal' && weekStatus[key].status !== 'ok' && ` – ${weekStatus[key].note}`}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </>
        ) : (
          <p className="tight">{T.noWeek}</p>
        )}
      </section>
    </>
  );
}
