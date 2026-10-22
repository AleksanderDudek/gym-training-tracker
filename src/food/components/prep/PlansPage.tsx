import { NotebookPen, Plus } from 'lucide-react';
import { pluralEn, text } from '../../../i18n';
import { dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { daysBetween } from '../../diet/model';
import { planPageToParams } from '../../diet/url';
import { hashWith } from '../../hash';
import { useClock } from '../../hooks/useDiet';
import { usePrepPlans } from '../../hooks/usePrep';
import { plural } from '../../lib/format';
import { rangeLabel, shortDate } from '../../prep/format';
import { hiddenDays, planCovering, planEnd, planName, setInDiary } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';
import { Loading } from '../diet/Onboarding';
import { planHref } from './links';
import './prep.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const T = text({
  pl: {
    count: (n: number) => `${n} ${plural(n, 'plan', 'plany', 'planów')} z zakupami`,
    none: 'Nie masz jeszcze planów',
    lead: 'Plan z własną nazwą zostaje, dopóki go nie usuniesz; bez nazwy — dwanaście najnowszych. Zakończony plan powtórzysz, zmieniając mu daty.',
    intro: 'Plan z zakupami układa jedzenie na 5–14 dni pod Twój cel i jeden sklep — z listą zakupów i gotowaniem na zapas.',
    add: 'Nowy plan',
    ended: 'zakończony',
    from: (date: string) => `od ${date}`,
    running: (day: number, days: number) => `trwa · dzień ${day} z ${days}`,
    follows: (name: string) => `Dziennik idzie za planem „${name}” w jego dni.`,
    saveFailed: 'Nie udało się zapisać zmiany na tym urządzeniu — spróbuj jeszcze raz.',
    days: (n: number) => `${n} dni`,
    owner: (n: number, name: string) => `W ${n} ${plural(n, 'dzień', 'dni', 'dni')} dziennik pokazuje „${name}”.`,
    setLabel: (name: string) => `Ustaw w dzienniku: ${name}`,
    set: 'Ustaw w dzienniku',
  },
  en: {
    count: (n: number) => `${n} ${pluralEn(n, 'plan', 'plans')} with shopping`,
    none: 'You have no plans yet',
    lead: 'A plan with its own name stays until you delete it; of the unnamed ones, the twelve newest stay. Repeat an ended plan by changing its dates.',
    intro: 'A plan & shopping sets out your food for 5–14 days for your goal and one shop — with a shopping list and batch cooking.',
    add: 'New plan',
    ended: 'ended',
    from: (date: string) => `from ${date}`,
    running: (day: number, days: number) => `running · day ${day} of ${days}`,
    follows: (name: string) => `The diary follows “${name}” on its days.`,
    saveFailed: 'Couldn’t save the change on this device — try again.',
    days: (n: number) => `${n} days`,
    owner: (n: number, name: string) => `On ${n} ${pluralEn(n, 'day', 'days')} the diary shows “${name}”.`,
    setLabel: (name: string) => `Set in diary: ${name}`,
    set: 'Set in diary',
  },
});

/** Formularz następnego planu na stronie planu posiłków (`?nowy=1`). */
const NEW_PLAN = hashWith(dietPath('plan'), planPageToParams({ date: null, add: false, form: true, plan: null }));

/**
 * Moje plany — każdy plan z zakupami na tym urządzeniu: te, które trwają i czekają, i te zakończone
 * (do podejrzenia albo do powtórzenia przez „Zmień daty”). Najpóźniej zaczynające się na górze.
 * Przy każdym: nazwa, daty, sklepy i stan — także to, że w części dni dziennik idzie za innym planem.
 */
export default function PlansPage() {
  const plans = usePrepPlans();
  const { date: today } = useClock();
  if (!plans) return <Loading />;
  const sorted = [...plans].sort(
    (a, b) => b.settings.start.localeCompare(a.settings.start) || (b.setAt ?? b.createdAt).localeCompare(a.setAt ?? a.createdAt),
  );
  return (
    <>
      <section className="grp" aria-labelledby="fd-prep-plans-title">
        <h2 id="fd-prep-plans-title">
          {plans.length ? T.count(plans.length) : T.none}
        </h2>
        <p className="tight">{plans.length ? T.lead : T.intro}</p>
        <a className="btn" href={NEW_PLAN}>
          <Plus {...ICON} /> {T.add}
        </a>
      </section>
      {plans.length > 0 && (
        <ul className="wrap fd-prep-plans">
          {sorted.map((p) => (
            <PlanRow key={p.id} plan={p as PrepPlan & { id: number }} plans={plans} today={today} />
          ))}
        </ul>
      )}
    </>
  );
}

function PlanRow({ plan, plans, today }: { plan: PrepPlan & { id: number }; plans: PrepPlan[]; today: string }) {
  const bridge = useBridge();
  const end = planEnd(plan);
  const ended = end < today;
  const hidden = ended ? [] : hiddenDays(plans, plan).filter((d) => d >= today);
  const owner = hidden.length ? planCovering(plans, hidden[0]!) : null;
  const shops = plan.shops.map((s) => s.name).join(' + ');
  const status = ended
    ? T.ended
    : plan.settings.start > today
      ? T.from(shortDate(plan.settings.start))
      : T.running(daysBetween(plan.settings.start, today) + 1, plan.settings.days);
  const name = planName(plan);

  const choose = () =>
    void setInDiary(plan.id).then(
      () => bridge.toast(T.follows(name)),
      () => bridge.toast(T.saveFailed),
    );

  return (
    <li className={`fd-prep-plan${ended ? ' fd-prep-plan-ended' : ''}`}>
      <a className="fd-prep-plan-link" href={planHref(plan)}>
        <span className="fd-prep-name">{name}</span>
        <span className="fd-prep-meta">
          {rangeLabel(plan.settings.start, end)} · {T.days(plan.settings.days)} · {shops}
        </span>
        <span className={`fd-prep-tag ${ended ? 'fd-prep-tag-soft' : 'fd-prep-tag-best'}`}>{status}</span>
      </a>
      {owner && (
        <div className="fd-prep-plan-note">
          <p className="fd-prep-meta">
            {T.owner(hidden.length, planName(owner))}
          </p>
          <button type="button" className="btn ghost sm" onClick={choose} aria-label={T.setLabel(name)}>
            <NotebookPen {...ICON} /> {T.set}
          </button>
        </div>
      )}
    </li>
  );
}
