import { text } from '../../../i18n';
import { rangeLabel } from '../../prep/format';
import { planEnd } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';

const T = text({
  pl: { nav: 'Plany z zakupami', now: 'Teraz', next: 'Następny' },
  en: { nav: 'Plans & shopping', now: 'Now', next: 'Next' },
});

interface Props {
  plans: PrepPlan[];
  shown: PrepPlan;
  today: string;
  /** Where a plan's tab leads: the same page for that plan. */
  href: (plan: PrepPlan) => string;
}

/**
 * Bieżący plan i ten ułożony na kolejne dni — przełącznik nad planem i nad listą zakupów, gdy są dwa
 * (albo więcej). Odnośniki, bo każdy plan ma własny adres (`?plan=`).
 */
export function PlanSwitch({ plans, shown, today, href }: Props) {
  if (plans.length < 2) return null;
  return (
    <nav className="wrap seg fd-prep-switch" aria-label={T.nav}>
      {plans.map((p) => (
        <a key={p.id} href={href(p)} aria-current={p === shown ? 'page' : undefined}>
          {p.settings.start <= today ? T.now : T.next} · {rangeLabel(p.settings.start, planEnd(p))}
        </a>
      ))}
    </nav>
  );
}
