import { Layers } from 'lucide-react';
import { text } from '../../../i18n';
import { dietPath } from '../../../routing';
import type { Profile } from '../../diet/types';
import { openPlans, shownPlan } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';
import { planHref } from './links';
import { PlanSwitch } from './PlanSwitch';
import { PrepForm } from './PrepForm';
import { PrepPlanView } from './PrepPlanView';

const MY_PLANS = text({ pl: (n: number) => `Moje plany (${n})`, en: (n: number) => `My plans (${n})` });

interface Props {
  profile: Profile;
  plans: PrepPlan[];
  today: string;
  /** The plan asked for in the address (`?plan=`). */
  wanted: number | null;
  /** The form is open (`?nowy=1`): the next plan is being made. */
  formOpen: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
}

/**
 * Plan z zakupami na górze planu posiłków: plan, który trwa (albo najbliższy ułożony), z przełącznikiem,
 * gdy następny tydzień jest już ułożony — albo formularz nowego. Bez planu formularz stoi od razu;
 * z planem otwiera go „Następny plan”, a Wstecz zamyka. Następny plan zaczyna się po ostatnim ułożonym.
 */
export function PrepSection({ profile, plans, today, wanted, formOpen, onOpenForm, onCloseForm }: Props) {
  const open = openPlans(plans, today);
  const shown = shownPlan(plans, today, wanted);
  // Every plan on the device, ended and named ones too: one tap from where plans are made.
  const all = plans.length > 0 && (
    <p className="wrap fd-prep-all">
      <a href={dietPath('plans')}>
        <Layers size={18} strokeWidth={2} aria-hidden /> {MY_PLANS(plans.length)}
      </a>
    </p>
  );
  if (formOpen || !shown)
    return (
      <>
        {all}
        <PrepForm
          profile={profile}
          plans={plans}
          today={today}
          after={open.at(-1) ?? null}
          onDone={onCloseForm}
          onCancel={shown ? onCloseForm : undefined}
        />
      </>
    );
  return (
    <>
      {all}
      <PlanSwitch plans={open} shown={shown} today={today} href={planHref} />
      <PrepPlanView
        key={shown.id}
        plan={shown as PrepPlan & { id: number }}
        plans={plans}
        profile={profile}
        today={today}
        onNext={onOpenForm}
      />
    </>
  );
}
