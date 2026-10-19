import type { Profile } from '../../diet/types';
import { currentPlan } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';
import { PrepForm } from './PrepForm';
import { PrepPlanView } from './PrepPlanView';

interface Props {
  profile: Profile;
  plans: PrepPlan[];
  today: string;
  /** The form is open (`?nowy=1`): the next plan is being made. */
  formOpen: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
}

/**
 * Plan z zakupami na górze planu posiłków: bieżący plan albo formularz nowego. Bez planu formularz
 * stoi od razu — to jedyne, co tu można zrobić; z planem otwiera go „Następny plan”, a Wstecz zamyka.
 */
export function PrepSection({ profile, plans, today, formOpen, onOpenForm, onCloseForm }: Props) {
  const current = currentPlan(plans, today);
  if (formOpen || !current)
    return (
      <PrepForm
        profile={profile}
        plans={plans}
        today={today}
        current={current}
        onDone={onCloseForm}
        onCancel={current ? onCloseForm : undefined}
      />
    );
  return <PrepPlanView plan={current as PrepPlan & { id: number }} profile={profile} today={today} onNext={onOpenForm} />;
}
