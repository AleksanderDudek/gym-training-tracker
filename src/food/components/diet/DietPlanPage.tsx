import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Modal, useModal } from '../../../components/ui';
import { FOOD_PATH } from '../../../routing';
import { hashWith } from '../../hash';
import { db } from '../../diet/db';
import { addDays, dayGoal, mondayOf, shortDay } from '../../diet/model';
import { plannedDay, plannedKcal, type Plan } from '../../diet/plan';
import { ACTIVE_PLAN } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { diaryFromParams, diaryToParams } from '../../diet/url';
import { useMergedHistory, type History } from '../../hooks/useDiet';
import { useUrlState } from '../../hooks/useUrlState';
import { formatDate, formatNumber } from '../../lib/format';
import { ImportWorkbook } from './ImportWorkbook';
import { Loading, Onboarding } from './Onboarding';
import { useDietBase } from './useDietPage';
import './diet.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

/** Adres dnia w dzienniku: dziś bez zapytania, inny dzień z `?dzien=`. */
const diaryHref = (date: string, today: string): string =>
  hashWith(FOOD_PATH, diaryToParams({ date: date === today ? null : date, add: false }));

/**
 * Plan posiłków — podstrona dziennika (w Produktach PL widok „Plan”): plan jako tydzień, czym
 * każdy dzień miał być i czym był, uwagi z planu i dni wzorcowe z wariantami. Oglądany tydzień
 * siedzi w adresie (`?dzien=`), jak dzień w dzienniku.
 */
export default function DietPlanPage() {
  const [state, update] = useUrlState(diaryFromParams, diaryToParams);
  const { profile, plan, clock } = useDietBase();
  const today = clock.date;
  const date = state.date ?? today;
  const from = profile ? [mondayOf(date), mondayOf(today)].sort()[0]! : null;
  const history = useMergedHistory(from);

  if (profile === undefined || plan === undefined) return <Loading />;
  if (!profile) return <Onboarding what="Plan posiłków" />;
  if (!history) return <Loading />;
  if (!plan) return <NoPlan />;
  return (
    <PlanView
      profile={profile}
      plan={plan}
      date={date}
      today={today}
      history={history}
      onDate={(next) => update({ date: next === today ? null : next })}
    />
  );
}

function NoPlan() {
  return (
    <div className="grp">
      <h2>Nie masz jeszcze planu</h2>
      <p>
        Wczytaj swój arkusz z planem: dni wzorcowe z wariantami, potrawy z kaloriami i makro, parametry z panelu. Plik
        jest czytany w przeglądarce i nigdzie nie jest wysyłany.
      </p>
      <p>Bez planu też się da: dziennik układa propozycję dnia z tego, co jest w sklepach w pobliżu i w domu.</p>
      <ImportWorkbook primary />
    </div>
  );
}

interface Props {
  profile: Profile;
  plan: Plan;
  date: string;
  today: string;
  history: History;
  onDate: (date: string) => void;
}

/** Plan jako tydzień: czym każdy dzień miał być, czym był, i wejście w każdy z nich. */
function PlanView({ profile, plan, date, today, history, onDate }: Props) {
  const { req, ask } = useModal();
  const monday = mondayOf(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const end = addDays(plan.startDate, plan.days.length - 1);

  const remove = async () => {
    if (await ask('Usunąć plan?', <p>Zapisy jedzenia i pomiary zostaną.</p>, 'Usuń plan'))
      await db.plans.delete(ACTIVE_PLAN);
  };

  return (
    <>
      <div className="grp">
        <h2 className="today-name">{plan.name}</h2>
        <p>
          {formatDate(plan.startDate)} – {formatDate(end)} · {plan.days.length} dni ·{' '}
          {Object.keys(plan.templates).length} dni wzorcowych · po końcu plan się powtarza
        </p>
        <div className="fd-diet-acts">
          <ImportWorkbook label="Wczytaj ponownie" />
          <button type="button" className="btn ghost sm" onClick={() => void remove()}>
            <Trash2 {...ICON} /> Usuń plan
          </button>
        </div>
      </div>

      <section className="grp" aria-labelledby="fd-diet-week-title">
        <div className="fd-diet-weekhead">
          <h2 id="fd-diet-week-title">Tydzień od {formatDate(monday)}</h2>
          <button
            type="button"
            className="fd-diet-icon-btn"
            onClick={() => onDate(addDays(date, -7))}
            aria-label="Poprzedni tydzień"
          >
            <ChevronLeft {...ICON} />
          </button>
          <button
            type="button"
            className="fd-diet-icon-btn"
            onClick={() => onDate(addDays(date, 7))}
            aria-label="Następny tydzień"
          >
            <ChevronRight {...ICON} />
          </button>
        </div>
        <div className="fd-diet-scroll">
          <table className="fd-diet-week">
            <thead>
              <tr>
                <th scope="col">Dzień</th>
                <th scope="col">Wzór</th>
                <th scope="col" className="n">
                  Plan
                </th>
                <th scope="col" className="n">
                  Cel
                </th>
                <th scope="col" className="n">
                  Zjedzone
                </th>
              </tr>
            </thead>
            <tbody>
              {week.map((d) => {
                const choices = history.days.get(d)?.choices;
                const planned = plannedDay(plan, d, choices);
                const eaten = history.eaten.get(d);
                const goal = dayGoal(profile, history.eaten, d, today).kcal;
                const over = eaten !== undefined && eaten > goal * 1.05;
                return (
                  <tr
                    key={d}
                    className={d === today ? 'today' : undefined}
                    aria-current={d === today ? 'date' : undefined}
                  >
                    <th scope="row">
                      <a href={diaryHref(d, today)}>{shortDay(d)}</a>
                    </th>
                    <td>{planned ? `${planned.template} · wariant ${planned.variant}` : '–'}</td>
                    <td className="n">{planned ? formatNumber(plannedKcal(planned) ?? 0, 0) : '–'}</td>
                    <td className="n soft">{d >= today ? formatNumber(goal, 0) : ''}</td>
                    <td className={`n${over ? ' over' : ''}`}>
                      {eaten !== undefined ? formatNumber(eaten, 0) : ''}
                      {over && <span className="sr-only"> – ponad cel</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tight">Stuknij dzień, żeby go otworzyć: odhaczyć, zamienić pozycje albo wybrać inny wariant.</p>
      </section>

      {plan.notes.length > 0 && (
        <section className="grp" aria-labelledby="fd-diet-notes-title">
          <h2 id="fd-diet-notes-title">Uwagi z planu</h2>
          <ul className="fd-diet-bullets">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grp" aria-labelledby="fd-diet-templates-title">
        <h2 id="fd-diet-templates-title">Dni wzorcowe i warianty</h2>
        {Object.entries(plan.templates).map(([key, variants]) => (
          <details key={key} className="gsel fd-diet-template">
            <summary>
              {key} · {variants.length} {variants.length === 1 ? 'wariant' : 'wariantów'}
              <i>
                {formatNumber(Math.min(...variants.map((v) => v.totals.kcal)), 0)}–
                {formatNumber(Math.max(...variants.map((v) => v.totals.kcal)), 0)} kcal
              </i>
            </summary>
            <ol className="fd-diet-variants">
              {variants.map((v) => (
                <li key={v.index}>
                  <p className="fd-diet-name">
                    Wariant {v.index}{' '}
                    <span className="fd-diet-meta fd-diet-nums">
                      · {formatNumber(v.totals.kcal, 0)} kcal · B {formatNumber(v.totals.protein ?? 0, 0)} · W{' '}
                      {formatNumber(v.totals.carbs ?? 0, 0)} · T {formatNumber(v.totals.fat ?? 0, 0)}
                    </span>
                  </p>
                  <p className="fd-diet-meta">{v.items.map((i) => i.text).join(' · ')}</p>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </section>
      <Modal req={req} />
    </>
  );
}
