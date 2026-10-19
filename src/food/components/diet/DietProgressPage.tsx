import { useMemo } from 'react';
import { useBridge } from '../../bridge';
import { withGymSteps } from '../../diet/body';
import { macroStatus, totals, type DayTotals, type Status } from '../../diet/day';
import { dayReaching, forecast, goalDirection } from '../../diet/energy';
import { addDays, dayGoal, forecastInputs, lastWeighing, projectFromWeighing, shortDay } from '../../diet/model';
import type { Plan } from '../../diet/plan';
import { DIET_PROFILES } from '../../diet/profiles';
import type { Profile } from '../../diet/types';
import { useMergedHistory, type History } from '../../hooks/useDiet';
import { formatDate, formatNumber } from '../../lib/format';
import { Loading, Onboarding } from './Onboarding';
import { useDietBase } from './useDietPage';
import { WeightChart, type ChartPoint } from './WeightChart';
import './diet.css';

/** Dwa lata to najdalej, jak sięga prognoza: dalej model nie mówi nic użytecznego. */
const HORIZON = 730;

const kg = (n: number) => `${formatNumber(n, 1)} kg`;

/**
 * Postęp — podstrona dziennika: waga z dziennika wagi (jednego dla treningów i diety), prognoza,
 * kalorie z dwóch tygodni i makro z ostatniego tygodnia.
 */
export default function DietProgressPage() {
  const { profile, plan, clock } = useDietBase();
  const today = clock.date;
  const from = profile ? [profile.startDate, addDays(today, -14)].sort()[0]! : null;
  const history = useMergedHistory(from);

  if (profile === undefined || plan === undefined) return <Loading />;
  if (!profile) return <Onboarding what="Postęp" />;
  if (!history) return <Loading />;
  return <ProgressView profile={profile} plan={plan} today={today} history={history} />;
}

const STATUS_WORD: Record<Status, string> = { brak: 'za mało', ok: 'w normie', nadmiar: 'za dużo' };

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
    goal: dayGoal(body, history.eaten, date, today).kcal,
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
            <span>Teraz · {model.weighing ? `ważenie ${shortDay(model.weighing.date)}` : 'brak ważenia'}</span>
          </div>
          <div className="tile">
            <b>{kg(Math.abs(lost))}</b>
            <span>{lost >= 0 ? 'Mniej o' : 'Więcej o'}</span>
          </div>
          <div className="tile">
            <b>{direction === 'keep' ? 'utrzymanie' : toGo > 0 ? kg(toGo) : 'cel osiągnięty'}</b>
            <span>Do celu · cel {kg(profile.targetWeightKg)}</span>
          </div>
        </div>
      </div>

      <section className="grp" aria-labelledby="fd-diet-chart-title">
        <h2 id="fd-diet-chart-title">Waga</h2>
        <WeightChart
          start={profile.startDate}
          today={today}
          points={points}
          measured={measured}
          target={profile.targetWeightKg}
        />
        <ul className="fd-diet-bullets">
          {direction === 'keep' ? (
            <li>Cel to utrzymanie wagi – linia planu pokazuje, dokąd prowadzi cel kalorii.</li>
          ) : (
            <li>
              Według planu cel{' '}
              {model.planReach ? (
                <strong>{formatDate(model.planReach)}</strong>
              ) : (
                'nie zostanie osiągnięty w ciągu dwóch lat'
              )}
              .
            </li>
          )}
          {model.weighing && direction !== 'keep' && (
            <li>
              Od ostatniego ważenia, jedząc według planu:{' '}
              {model.projectedReach ? (
                <strong>{formatDate(model.projectedReach)}</strong>
              ) : (
                'cel poza zasięgiem dwóch lat – sprawdź cel kalorii w profilu diety'
              )}
              .
            </li>
          )}
        </ul>
        {modelToday !== undefined && model.weighing && (
          <p className="tight">
            Z zapisów jedzenia wynikałoby dziś {kg(modelToday)}; waga pokazuje {kg(current)}. Woda i jelita potrafią
            przesunąć wynik o 1–2 kg – patrz na trend, nie na jeden dzień.
          </p>
        )}
      </section>

      <section className="grp" aria-labelledby="fd-diet-kcal-title">
        <h2 id="fd-diet-kcal-title">Kalorie – ostatnie 14 dni</h2>
        <ol className="fd-diet-fortnight" aria-label="Zjedzone kalorie dzień po dniu">
          {fortnight.map((d) => {
            const over = d.eaten !== null && d.eaten > d.goal * 1.05;
            const text = `${shortDay(d.date)}: ${d.eaten === null ? 'brak zapisów' : `${formatNumber(d.eaten, 0)} kcal`}, cel ${formatNumber(d.goal, 0)}${over ? ' – ponad cel' : ''}`;
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
        <p className="tight fd-diet-soft">Kreska przerywana: cel dnia · pomarańczowy słupek: ponad cel.</p>
      </section>

      <section className="grp" aria-labelledby="fd-diet-macro-title">
        <h2 id="fd-diet-macro-title">Makroskładniki – średnia z ostatniego tygodnia</h2>
        {average && weekStatus ? (
          <>
            <p className="tight">
              Kalorie z {week.length} {week.length === 1 ? 'dnia' : 'dni'} z zapisami, makroskładniki z{' '}
              {complete.length} {complete.length === 1 ? 'dnia' : 'dni'} z pełnymi danymi – wobec celów profilu „
              {dietProfile.label}”.
            </p>
            <dl className="fd-diet-avg">
              {(
                [
                  ['kcal', 'Kalorie', `${average.kcal} / ${targets.kcal}`],
                  ['protein', 'Białko', `${average.protein} / ${targets.protein.target} g`],
                  ['carbs', 'Węglowodany', `${average.carbs} / ${targets.carbs.max ?? targets.carbs.target} g`],
                  ['fat', 'Tłuszcz', `${average.fat} / ${targets.fat.target} g`],
                ] as const
              ).map(([key, label, value]) =>
                key !== 'kcal' && complete.length === 0 ? (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd className="fd-diet-soft">brak danych – wpisy mają tylko kalorie</dd>
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
          <p className="tight">Brak zapisów z ostatniego tygodnia.</p>
        )}
      </section>
    </>
  );
}
