import { NotebookPen, Plus } from 'lucide-react';
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
          {plans.length ? `${plans.length} ${plural(plans.length, 'plan', 'plany', 'planów')} z zakupami` : 'Nie masz jeszcze planów'}
        </h2>
        <p className="tight">
          {plans.length
            ? 'Plan z własną nazwą zostaje, dopóki go nie usuniesz; bez nazwy — dwanaście najnowszych. Zakończony plan powtórzysz, zmieniając mu daty.'
            : 'Plan z zakupami układa jedzenie na 5–14 dni pod Twój cel i jeden sklep — z listą zakupów i gotowaniem na zapas.'}
        </p>
        <a className="btn" href={NEW_PLAN}>
          <Plus {...ICON} /> Nowy plan
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
    ? 'zakończony'
    : plan.settings.start > today
      ? `od ${shortDate(plan.settings.start)}`
      : `trwa · dzień ${daysBetween(plan.settings.start, today) + 1} z ${plan.settings.days}`;
  const name = planName(plan);

  const choose = () =>
    void setInDiary(plan.id).then(
      () => bridge.toast(`Dziennik idzie za planem „${name}” w jego dni.`),
      () => bridge.toast('Nie udało się zapisać zmiany na tym urządzeniu — spróbuj jeszcze raz.'),
    );

  return (
    <li className={`fd-prep-plan${ended ? ' fd-prep-plan-ended' : ''}`}>
      <a className="fd-prep-plan-link" href={planHref(plan)}>
        <span className="fd-prep-name">{name}</span>
        <span className="fd-prep-meta">
          {rangeLabel(plan.settings.start, end)} · {plan.settings.days} dni · {shops}
        </span>
        <span className={`fd-prep-tag ${ended ? 'fd-prep-tag-soft' : 'fd-prep-tag-best'}`}>{status}</span>
      </a>
      {owner && (
        <div className="fd-prep-plan-note">
          <p className="fd-prep-meta">
            W {hidden.length} {plural(hidden.length, 'dzień', 'dni', 'dni')} dziennik pokazuje „{planName(owner)}”.
          </p>
          <button type="button" className="btn ghost sm" onClick={choose} aria-label={`Ustaw w dzienniku: ${name}`}>
            <NotebookPen {...ICON} /> Ustaw w dzienniku
          </button>
        </div>
      )}
    </li>
  );
}
