import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Modal, useModal } from '../../../components/ui';
import { FOOD_PATH } from '../../../routing';
import { hashWith } from '../../hash';
import { db } from '../../diet/db';
import { addDays, dayGoal, mondayOf, shortDay } from '../../diet/model';
import { activityKcalOf, useActivity } from '../../hooks/useActivity';
import { plannedDay, plannedKcal, type Plan } from '../../diet/plan';
import { ACTIVE_PLAN } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { diaryToParams, planPageFromParams, planPageToParams } from '../../diet/url';
import { useMergedHistory, type History } from '../../hooks/useDiet';
import { usePrepPlans } from '../../hooks/usePrep';
import { useUrlState } from '../../hooks/useUrlState';
import { formatDate, formatNumber } from '../../lib/format';
import { pluralEn, text } from '../../../i18n';
import { PrepSection } from '../prep/PrepSection';
import { DT } from './dietText';
import { ImportWorkbook } from './ImportWorkbook';
import { Loading, Onboarding } from './Onboarding';
import { useDietBase } from './useDietPage';
import './diet.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const T = text({
  pl: {
    mealPlan: 'Plan posiłków',
    fromWorkbook: 'Plan z arkusza',
    noPlan:
      'Wczytaj swój arkusz z planem: dni wzorcowe z wariantami, potrawy z kaloriami i makro, parametry z panelu. Plik jest czytany w przeglądarce i nigdzie nie jest wysyłany. W dni planu z zakupami dziennik pokazuje plan z zakupami.',
    removeTitle: 'Usunąć plan?',
    removeBody: 'Zapisy jedzenia i pomiary zostaną.',
    remove: 'Usuń plan',
    meta: (start: string, end: string, days: number, templates: number) =>
      `${start} – ${end} · ${days} dni · ${templates} dni wzorcowych · po końcu plan się powtarza`,
    importAgain: 'Wczytaj ponownie',
    weekFrom: (monday: string) => `Tydzień od ${monday}`,
    prevWeek: 'Poprzedni tydzień',
    nextWeek: 'Następny tydzień',
    day: 'Dzień',
    template: 'Wzór',
    goal: 'Cel',
    eaten: 'Zjedzone',
    templateVariant: (template: string, variant: number) => `${template} · wariant ${variant}`,
    overGoal: ' – ponad cel',
    tapDay: 'Stuknij dzień, żeby go otworzyć: odhaczyć, zamienić pozycje albo wybrać inny wariant.',
    notes: 'Uwagi z planu',
    templates: 'Dni wzorcowe i warianty',
    variants: (n: number) => `${n} ${n === 1 ? 'wariant' : 'wariantów'}`,
    variant: (index: number) => `Wariant ${index}`,
  },
  en: {
    mealPlan: 'Meal plan',
    fromWorkbook: 'Plan from a workbook',
    noPlan:
      'Import your plan workbook: template days with options, dishes with calories and macros, the panel’s settings. The file is read in your browser and never sent anywhere. On the days of a Plan & shopping, the diary shows that plan.',
    removeTitle: 'Delete the plan?',
    removeBody: 'Food logs and measurements stay.',
    remove: 'Delete plan',
    meta: (start: string, end: string, days: number, templates: number) =>
      `${start} – ${end} · ${days} ${pluralEn(days, 'day', 'days')} · ${templates} template ${pluralEn(templates, 'day', 'days')} · the plan repeats after its end`,
    importAgain: 'Import again',
    weekFrom: (monday: string) => `Week from ${monday}`,
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    day: 'Day',
    template: 'Template',
    goal: 'Goal',
    eaten: 'Eaten',
    templateVariant: (template: string, variant: number) => `${template} · option ${variant}`,
    overGoal: ' – over the goal',
    tapDay: 'Tap a day to open it: tick items off, swap them or pick another option.',
    notes: 'Notes from the plan',
    templates: 'Template days and options',
    variants: (n: number) => `${n} ${pluralEn(n, 'option', 'options')}`,
    variant: (index: number) => `Option ${index}`,
  },
});

/** Adres dnia w dzienniku: dziś bez zapytania, inny dzień z `?dzien=`. */
const diaryHref = (date: string, today: string): string =>
  hashWith(FOOD_PATH, diaryToParams({ date: date === today ? null : date, add: false }));

/**
 * Plan posiłków — podstrona dziennika. Na górze plan z zakupami (meal prep): bieżący albo formularz
 * nowego (`?nowy=1`, Wstecz go zamyka). Pod nim plan z arkusza (w Produktach PL widok „Plan”): plan
 * jako tydzień, czym każdy dzień miał być i czym był, uwagi z planu i dni wzorcowe z wariantami.
 * Oglądany tydzień siedzi w adresie (`?dzien=`), jak dzień w dzienniku.
 */
export default function DietPlanPage() {
  const [state, update, closeEntry] = useUrlState(planPageFromParams, planPageToParams);
  const { profile, plan, clock } = useDietBase();
  const prepPlans = usePrepPlans();
  const today = clock.date;
  const date = state.date ?? today;
  const from = profile ? [mondayOf(date), mondayOf(today)].sort()[0]! : null;
  const history = useMergedHistory(from);

  if (profile === undefined || plan === undefined || prepPlans === undefined) return <Loading />;
  if (!profile) return <Onboarding what={T.mealPlan} />;
  return (
    <>
      <PrepSection
        profile={profile}
        plans={prepPlans}
        today={today}
        wanted={state.plan}
        formOpen={state.form}
        onOpenForm={() => update({ form: true }, { push: true })}
        onCloseForm={() => closeEntry({ form: false })}
      />
      {!plan ? (
        <NoPlan />
      ) : !history ? (
        <Loading />
      ) : (
        <PlanView
          profile={profile}
          plan={plan}
          date={date}
          today={today}
          history={history}
          onDate={(next) => update({ date: next === today ? null : next })}
        />
      )}
    </>
  );
}

function NoPlan() {
  return (
    <div className="grp">
      <h2>{T.fromWorkbook}</h2>
      <p>{T.noPlan}</p>
      <ImportWorkbook />
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
  const activity = useActivity(profile, today);
  const monday = mondayOf(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const end = addDays(plan.startDate, plan.days.length - 1);

  const remove = async () => {
    if (await ask(T.removeTitle, <p>{T.removeBody}</p>, T.remove))
      await db.plans.delete(ACTIVE_PLAN);
  };

  return (
    <>
      <div className="grp">
        <div className="today-tag light">{T.fromWorkbook}</div>
        <h2 className="today-name">{plan.name}</h2>
        <p>{T.meta(formatDate(plan.startDate), formatDate(end), plan.days.length, Object.keys(plan.templates).length)}</p>
        <div className="fd-diet-acts">
          <ImportWorkbook label={T.importAgain} />
          <button type="button" className="btn ghost sm" onClick={() => void remove()}>
            <Trash2 {...ICON} /> {T.remove}
          </button>
        </div>
      </div>

      <section className="grp" aria-labelledby="fd-diet-week-title">
        <div className="fd-diet-weekhead">
          <h2 id="fd-diet-week-title">{T.weekFrom(formatDate(monday))}</h2>
          <button
            type="button"
            className="fd-diet-icon-btn"
            onClick={() => onDate(addDays(date, -7))}
            aria-label={T.prevWeek}
          >
            <ChevronLeft {...ICON} />
          </button>
          <button
            type="button"
            className="fd-diet-icon-btn"
            onClick={() => onDate(addDays(date, 7))}
            aria-label={T.nextWeek}
          >
            <ChevronRight {...ICON} />
          </button>
        </div>
        <div className="fd-diet-scroll">
          <table className="fd-diet-week">
            <thead>
              <tr>
                <th scope="col">{T.day}</th>
                <th scope="col">{T.template}</th>
                <th scope="col" className="n">
                  Plan
                </th>
                <th scope="col" className="n">
                  {T.goal}
                </th>
                <th scope="col" className="n">
                  {T.eaten}
                </th>
              </tr>
            </thead>
            <tbody>
              {week.map((d) => {
                const choices = history.days.get(d)?.choices;
                const planned = plannedDay(plan, d, choices);
                const eaten = history.eaten.get(d);
                const goal = dayGoal(profile, history.eaten, d, today, activityKcalOf(activity)).kcal;
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
                    <td>{planned ? T.templateVariant(planned.template, planned.variant) : '–'}</td>
                    <td className="n">{planned ? formatNumber(plannedKcal(planned) ?? 0, 0) : '–'}</td>
                    <td className="n soft">{d >= today ? formatNumber(goal, 0) : ''}</td>
                    <td className={`n${over ? ' over' : ''}`}>
                      {eaten !== undefined ? formatNumber(eaten, 0) : ''}
                      {over && <span className="sr-only">{T.overGoal}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tight">{T.tapDay}</p>
      </section>

      {plan.notes.length > 0 && (
        <section className="grp" aria-labelledby="fd-diet-notes-title">
          <h2 id="fd-diet-notes-title">{T.notes}</h2>
          <ul className="fd-diet-bullets">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grp" aria-labelledby="fd-diet-templates-title">
        <h2 id="fd-diet-templates-title">{T.templates}</h2>
        {Object.entries(plan.templates).map(([key, variants]) => (
          <details key={key} className="gsel fd-diet-template">
            <summary>
              {key} · {T.variants(variants.length)}
              <i>
                {formatNumber(Math.min(...variants.map((v) => v.totals.kcal)), 0)}–
                {formatNumber(Math.max(...variants.map((v) => v.totals.kcal)), 0)} kcal
              </i>
            </summary>
            <ol className="fd-diet-variants">
              {variants.map((v) => (
                <li key={v.index}>
                  <p className="fd-diet-name">
                    {T.variant(v.index)}{' '}
                    <span className="fd-diet-meta fd-diet-nums">
                      · {formatNumber(v.totals.kcal, 0)} kcal · {DT.p} {formatNumber(v.totals.protein ?? 0, 0)} · {DT.c}{' '}
                      {formatNumber(v.totals.carbs ?? 0, 0)} · {DT.f} {formatNumber(v.totals.fat ?? 0, 0)}
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
