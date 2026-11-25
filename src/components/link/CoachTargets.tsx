import { useEffect, useRef, useState } from 'react';
import type { AssignmentBody } from '@gymtracker/link';
import { hasDiet } from '../../food/dietFlag';
import type { CoachAsk, CoachEdit } from '../../food/diet/coach';
import { num, text } from '../../i18n';
import { connectionOf, useLink } from '../../link/store';
import type { StoredAssignment } from '../../link/store';
import { setAssignmentStatus } from '../../link/sync';
import { FOOD_PATH, dietPath } from '../../routing';
import type { AppState } from '../../types';
import '../coach.css';

/**
 * „Ustaw jako moje cele” na karcie celów od prowadzącego: najpierw mówi, co się zmieni (te same reguły
 * co zapis profilu diety — `diet/coach.ts`), a dopiero po „Tak, ustaw” zapisuje i robi z zalecenia
 * „w trakcie”. Kalorie i waga docelowa trafiają do profilu diety; białko, kroki, treningi w tygodniu
 * i tempo — tylko do wiadomości, bo aplikacja nie ma na nie osobnych ustawień (białko liczy sama).
 * Kod diety (Dexie) wczytuje się dopiero po stuknięciu.
 */

type TargetsBody = Extract<AssignmentBody, { kind: 'targets' }>;

const kg = (n: number) => num(n, n % 1 ? 1 : 0);
/** Tempo w zapisie prowadzącego: ujemne — chudnięcie (profil diety trzyma odwrotny znak). */
const rate = (n: number) => num(n, 2);

const T = text({
  pl: {
    apply: 'Ustaw jako moje cele',
    loading: 'Sprawdzam twój profil diety…',
    changes: 'Co się zmieni w profilu diety',
    kcal: (from: number, to: number) => `Cel kalorii: ${num(from)} → ${num(to)} kcal dziennie, od dziś`,
    kcalFloor: (asked: number, set: number) =>
      `Prowadzący proponuje ${num(asked)} kcal, a to mniej niż twoja przemiana podstawowa — ustawię ${num(set)}. Niżej zejdziesz w profilu diety, zaznaczając, że cel jest uzgodniony z lekarzem albo dietetykiem.`,
    kcalMax: (asked: number, set: number) => `Prowadzący proponuje ${num(asked)} kcal — aplikacja przyjmuje najwyżej ${num(set)}.`,
    weight: (from: number, to: number) => `Waga docelowa: ${kg(from)} → ${kg(to)} kg`,
    pace: (from: number, to: number) => `Tempo: ${rate(-from)} → ${rate(-to)} kg na tydzień (wynika z celu kalorii)`,
    info: 'Tylko do wiadomości',
    protein: (asked: number, app: number | null) =>
      `Białko: ${num(asked)} g dziennie — aplikacja liczy białko sama, z rodzaju diety i wagi docelowej${app === null ? '' : ` (u ciebie ${num(app)} g)`}.`,
    steps: (n: number) => `Kroki: ${num(n)} dziennie — aplikacja nie ma własnego celu kroków.`,
    perWeek: (n: number) => `Treningi: ${n} w tygodniu — tyle dni wyznacza plan treningowy.`,
    rateKcal: (r: number) => `Tempo: ${rate(r)} kg na tydzień — aplikacja wylicza tempo z celu kalorii.`,
    rateProfile: (r: number) => `Tempo: ${rate(r)} kg na tydzień — ustawisz je w profilu diety.`,
    kcalMinor: (n: number) => `Cel kalorii ${num(n)} kcal — poniżej 18 lat aplikacja nie zmienia celu kalorii. Porozmawiaj o nim z prowadzącym.`,
    weightMin: (w: number) => `Waga docelowa ${kg(w)} kg — poniżej zdrowej wagi dla twojego wzrostu, więc jej nie ustawiam.`,
    weightSide: (w: number) => `Waga docelowa ${kg(w)} kg — nie pasuje do kierunku celu (chudnięcie albo przybieranie). Ustawisz ją w profilu diety.`,
    weightKeep: (w: number) => `Waga docelowa ${kg(w)} kg — przy takim celu kalorii waga się utrzymuje, więc waga docelowa zostaje bez zmian. Ustawisz ją w profilu diety.`,
    nothing: 'Twój profil diety już ma te cele — nic do zmiany.',
    confirm: 'Tak, ustaw',
    cancel: 'Anuluj',
    close: 'Zamknij',
    noDiet: 'Kalorie i wagę docelową ustawisz, gdy założysz profil diety w zakładce Jedzenie. Potem wróć tutaj i przyjmij cele jednym przyciskiem.',
    openDiet: 'Załóż profil diety',
    toast: 'Cele od prowadzącego ustawione.',
    done: (kcal: number | null) =>
      kcal === null ? 'Ustawione — zmiany widać w profilu diety.' : `Ustawione — cel ${num(kcal)} kcal dziennie widać w dzienniku jedzenia.`,
    openDiary: 'Otwórz dziennik',
    openProfile: 'Profil diety',
    failed: 'Nie udało się zapisać celów. Spróbuj jeszcze raz.',
  },
  en: {
    apply: 'Make these my targets',
    loading: 'Checking your diet profile…',
    changes: 'What changes in your diet profile',
    kcal: (from: number, to: number) => `Calorie target: ${num(from)} → ${num(to)} kcal a day, from today`,
    kcalFloor: (asked: number, set: number) =>
      `Your coach suggests ${num(asked)} kcal, which is below your basal metabolic rate — I’ll set ${num(set)}. You can go lower in the diet profile by ticking that the target is agreed with a doctor or dietitian.`,
    kcalMax: (asked: number, set: number) => `Your coach suggests ${num(asked)} kcal — the app takes at most ${num(set)}.`,
    weight: (from: number, to: number) => `Goal weight: ${kg(from)} → ${kg(to)} kg`,
    pace: (from: number, to: number) => `Pace: ${rate(-from)} → ${rate(-to)} kg a week (follows from the calorie target)`,
    info: 'For your information',
    protein: (asked: number, app: number | null) =>
      `Protein: ${num(asked)} g a day — the app works protein out itself, from the diet style and goal weight${app === null ? '' : ` (yours: ${num(app)} g)`}.`,
    steps: (n: number) => `Steps: ${num(n)} a day — the app has no step target of its own.`,
    perWeek: (n: number) => `Workouts: ${n} a week — your training plan sets the days.`,
    rateKcal: (r: number) => `Pace: ${rate(r)} kg a week — the app works the pace out from the calorie target.`,
    rateProfile: (r: number) => `Pace: ${rate(r)} kg a week — you can set it in the diet profile.`,
    kcalMinor: (n: number) => `Calorie target ${num(n)} kcal — under 18 the app does not change the calorie target. Talk it over with your coach.`,
    weightMin: (w: number) => `Goal weight ${kg(w)} kg — below a healthy weight for your height, so I won’t set it.`,
    weightSide: (w: number) => `Goal weight ${kg(w)} kg — it doesn’t match the direction of your goal (losing or gaining). You can set it in the diet profile.`,
    weightKeep: (w: number) => `Goal weight ${kg(w)} kg — this calorie target keeps your weight steady, so the goal weight stays as it is. You can set it in the diet profile.`,
    nothing: 'Your diet profile already has these targets — nothing to change.',
    confirm: 'Yes, set them',
    cancel: 'Cancel',
    close: 'Close',
    noDiet: 'You can set calories and a goal weight once you create a diet profile in the Food tab. Then come back here and take the targets with one tap.',
    openDiet: 'Create a diet profile',
    toast: 'Targets from your coach are set.',
    done: (kcal: number | null) =>
      kcal === null ? 'Done — the changes are in your diet profile.' : `Done — the ${num(kcal)} kcal a day target is in your food diary.`,
    openDiary: 'Open the diary',
    openProfile: 'Diet profile',
    failed: 'The targets could not be saved. Try again.',
  },
});

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'noDiet' }
  | { kind: 'confirm'; edit: CoachEdit }
  | { kind: 'saving'; edit: CoachEdit }
  | { kind: 'done'; edit: CoachEdit }
  | { kind: 'error' };

/** Co z celów zostaje tylko do wiadomości — z liczbą białka aplikacji po zmianie, gdy już ją znamy. */
function infoLines(b: TargetsBody, edit: CoachEdit | null): string[] {
  return [
    edit?.kept.kcal === 'minor' && b.kcal !== null ? T.kcalMinor(Math.round(b.kcal)) : null,
    edit?.kept.weight === 'min' && b.weightGoal !== null ? T.weightMin(b.weightGoal) : null,
    edit?.kept.weight === 'side' && b.weightGoal !== null ? T.weightSide(b.weightGoal) : null,
    edit?.kept.weight === 'keep' && b.weightGoal !== null ? T.weightKeep(b.weightGoal) : null,
    b.protein !== null ? T.protein(Math.round(b.protein), edit ? edit.protein : null) : null,
    b.steps !== null ? T.steps(Math.round(b.steps)) : null,
    b.workoutsPerWeek !== null ? T.perWeek(Math.round(b.workoutsPerWeek)) : null,
    b.weeklyRate !== null ? (b.kcal !== null ? T.rateKcal(b.weeklyRate) : T.rateProfile(b.weeklyRate)) : null,
  ].filter((x): x is string => !!x);
}

function changeLines(b: TargetsBody, edit: CoachEdit): string[] {
  return [
    edit.kcal ? T.kcal(edit.kcal.from, edit.kcal.to) : null,
    edit.kcalAdjusted === 'floor' && b.kcal !== null && edit.kcal ? T.kcalFloor(Math.round(b.kcal), edit.kcal.to) : null,
    edit.kcalAdjusted === 'max' && b.kcal !== null && edit.kcal ? T.kcalMax(Math.round(b.kcal), edit.kcal.to) : null,
    edit.weight ? T.weight(edit.weight.from, edit.weight.to) : null,
    edit.pace ? T.pace(edit.pace.from, edit.pace.to) : null,
  ].filter((x): x is string => !!x);
}

export function CoachTargets({
  stored,
  body,
  state,
  onToast,
}: {
  stored: StoredAssignment;
  body: TargetsBody;
  state: AppState;
  onToast: (m: string) => void;
}) {
  const s = useLink();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const panel = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Po każdej zmianie panelu fokus idzie na jego pierwsze zdanie; po „Anuluj” — z powrotem na przycisk.
  const focus = useRef<'panel' | 'button' | null>(null);
  useEffect(() => {
    if (focus.current === 'panel') panel.current?.focus();
    if (focus.current === 'button') button.current?.focus();
    focus.current = null;
  });

  const active = connectionOf(s, stored.connectionId)?.status === 'active';
  const ask: CoachAsk = { kcal: body.kcal, weightGoal: body.weightGoal };
  const applicable = ask.kcal !== null || ask.weightGoal !== null;
  const weighIns = state.body ?? [];
  const go = (next: Phase) => {
    focus.current = 'panel';
    setPhase(next);
  };

  if (!active) return null;
  if (!applicable) {
    const info = infoLines(body, null);
    return info.length ? (
      <div className="grp">
        <h3>{T.info}</h3>
        <ul className="lk-coach-info">
          {info.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    ) : null;
  }

  const open = async () => {
    setPhase({ kind: 'loading' });
    if (!hasDiet()) return go({ kind: 'noDiet' });
    try {
      const [store, coach] = await Promise.all([import('../../food/diet/store'), import('../../food/diet/coach')]);
      const today = store.now().date;
      const profile = await store.readProfile({ today, weighIns });
      if (!profile) return go({ kind: 'noDiet' });
      go({ kind: 'confirm', edit: coach.coachEdit(profile, ask, { today, kgNow: coach.kgNowOf(profile, weighIns, today) }) });
    } catch {
      go({ kind: 'error' });
    }
  };

  const confirm = async (preview: CoachEdit) => {
    setPhase({ kind: 'saving', edit: preview });
    try {
      const store = await import('../../food/diet/store');
      const edit = await store.applyCoachTargets(ask, { today: store.now().date, weighIns });
      if (!edit) return go({ kind: 'noDiet' });
      if (stored.status === 'new' || stored.status === 'seen' || stored.status === 'declined') void setAssignmentStatus(stored.id, 'started');
      onToast(T.toast);
      go({ kind: 'done', edit });
    } catch {
      go({ kind: 'error' });
    }
  };

  const cancel = () => {
    focus.current = 'button';
    setPhase({ kind: 'idle' });
  };

  const edit = phase.kind === 'confirm' || phase.kind === 'saving' ? phase.edit : null;
  const changes = edit ? changeLines(body, edit) : [];
  const info = edit ? infoLines(body, edit) : [];

  if (phase.kind === 'idle' || phase.kind === 'loading' || phase.kind === 'error')
    return (
      <div className="wrap">
        {phase.kind === 'error' ? (
          <p className="link-error" ref={panel} tabIndex={-1} role="alert">
            {T.failed}
          </p>
        ) : null}
        <div className="btnrow">
          <button ref={button} type="button" className="btn" disabled={phase.kind === 'loading'} onClick={() => void open()}>
            {phase.kind === 'loading' ? T.loading : T.apply}
          </button>
        </div>
      </div>
    );

  return (
    <div className="grp lk-coach-confirm" role="group" aria-label={T.apply}>
      {phase.kind === 'noDiet' ? (
        <>
          <p className="tight" ref={panel} tabIndex={-1}>
            {T.noDiet}
          </p>
          <a className="btn ghost sm" href={FOOD_PATH}>
            {T.openDiet}
          </a>
        </>
      ) : phase.kind === 'done' ? (
        <>
          <p className="tight" ref={panel} tabIndex={-1} role="status">
            {T.done(phase.edit.kcal ? phase.edit.kcal.to : null)}
          </p>
          <a className="btn ghost sm" href={phase.edit.kcal ? FOOD_PATH : dietPath('profile')}>
            {phase.edit.kcal ? T.openDiary : T.openProfile}
          </a>
        </>
      ) : edit ? (
        <>
          {edit.changed ? (
            <>
              <h3 ref={panel} tabIndex={-1}>
                {T.changes}
              </h3>
              <ul className="lk-coach-changes">
                {changes.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="tight" ref={panel} tabIndex={-1}>
              {T.nothing}
            </p>
          )}
          {info.length ? (
            <>
              <p className="lk-coach-note">{T.info}</p>
              <ul className="lk-coach-info">
                {info.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="btnrow">
            {edit.changed ? (
              <button type="button" className="btn" disabled={phase.kind === 'saving'} onClick={() => void confirm(edit)}>
                {T.confirm}
              </button>
            ) : null}
            <button type="button" className="btn ghost" disabled={phase.kind === 'saving'} onClick={cancel}>
              {edit.changed ? T.cancel : T.close}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
