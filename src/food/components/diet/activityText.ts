import { text } from '../../../i18n';
import type { Activity } from '../../diet/activity';
import { formatNumber } from '../../lib/format';

/**
 * The goal's activity part in words - one source for the balance card, „Kroki i ruch” and the
 * cheat-meal simulation. Signs are explicit: „+120 kcal” adds to the goal, „−160 kcal” takes off.
 */

export const signedKcal = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(Math.round(n)), 0)} kcal`;
const num = (n: number) => formatNumber(Math.round(n), 0);

const T = text({
  pl: {
    session: 'trening',
    quoted: (name: string) => `„${name}”`,
    worth: (worth: string) => `; w rachunku jak ${worth} — rozpis w „Kroki i cardio”`,
    steps: (kcal: string, actual: string, planned: string, worth: string) =>
      `${kcal} za kroki (${actual} zamiast ${planned}${worth})`,
    planDone: (kcal: string, session: string, done: string, planned: string) =>
      `${kcal}: ${session} zrobiony (${done} kcal, plan zakładał ${planned})`,
    profileDone: (kcal: string, done: string, planned: string) =>
      `${kcal} za trening (${done} kcal; profil zakłada średnio ${planned} kcal dziennie)`,
    offPlan: (kcal: string) => `${kcal} za trening spoza planu`,
    extra: (kcal: string) => `${kcal}: dodatkowy trening`,
    planSkipped: (kcal: string, session: string) => `${kcal}: ${session} z planu bez wykonania`,
    profileSkipped: (kcal: string, planned: string) =>
      `${kcal}: bez treningu (profil zakłada średnio ${planned} kcal dziennie)`,
    other: (kcal: string) => `${kcal} za cardio i przekąski ruchowe`,
    stepsToGo: (steps: string, kcal: string) => `${steps} kroków do celu (${kcal})`,
    sessionAhead: (session: string, kcal: string) => `${session} z planu jeszcze przed tobą (${kcal})`,
    head: (kcal: string, parts: string) => `Ruch: ${kcal} do celu — ${parts}.`,
    tail: (kcal: string, parts: string) =>
      `Jeśli do wieczora tego nie będzie, cel spadnie najwyżej o ${kcal} kcal: ${parts}.`,
  },
  en: {
    session: 'workout',
    quoted: (name: string) => `“${name}”`,
    worth: (worth: string) => `; counted as ${worth} — breakdown in “Steps & cardio”`,
    steps: (kcal: string, actual: string, planned: string, worth: string) =>
      `${kcal} for steps (${actual} instead of ${planned}${worth})`,
    planDone: (kcal: string, session: string, done: string, planned: string) =>
      `${kcal}: ${session} done (${done} kcal, the plan assumed ${planned})`,
    profileDone: (kcal: string, done: string, planned: string) =>
      `${kcal} for a workout (${done} kcal; your profile assumes ${planned} kcal a day on average)`,
    offPlan: (kcal: string) => `${kcal} for an unplanned workout`,
    extra: (kcal: string) => `${kcal}: an extra workout`,
    planSkipped: (kcal: string, session: string) => `${kcal}: planned ${session} not done`,
    profileSkipped: (kcal: string, planned: string) =>
      `${kcal}: no workout (your profile assumes ${planned} kcal a day on average)`,
    other: (kcal: string) => `${kcal} for cardio and exercise snacks`,
    stepsToGo: (steps: string, kcal: string) => `${steps} steps to go (${kcal})`,
    sessionAhead: (session: string, kcal: string) => `planned ${session} still ahead (${kcal})`,
    head: (kcal: string, parts: string) => `Activity: ${kcal} to the goal — ${parts}.`,
    tail: (kcal: string, parts: string) =>
      `If that doesn’t happen by tonight, the goal drops by at most ${kcal} kcal: ${parts}.`,
  },
});

const sessionName = (a: Activity) => (a.training.plannedName ? T.quoted(a.training.plannedName) : T.session);

/**
 * The steps' worth when it differs from the count by 3 %+: a run, the measured distance or floors
 * made them count for more (or a treadmill logged on its own, for less). The breakdown lives on the
 * gym's steps screen.
 */
const worthNote = (a: Activity): string => {
  const { actual, worth } = a.steps;
  if (actual === null || worth === null || Math.abs(worth - actual) < 0.03 * Math.max(actual, 1)) return '';
  return T.worth(num(worth));
};

/** What already changed the goal: „+60 kcal za kroki (12 000 zamiast 10 000)” … */
export function activityParts(a: Activity): string[] {
  const parts: string[] = [];
  if (a.steps.kcal !== 0)
    parts.push(T.steps(signedKcal(a.steps.kcal), num(a.steps.actual ?? 0), num(a.steps.planned), worthNote(a)));
  const t = a.training;
  if (t.kcal !== 0) {
    if (t.trained && t.source === 'plan' && t.planned > 0)
      parts.push(T.planDone(signedKcal(t.kcal), sessionName(a), num(t.done), num(t.planned)));
    else if (t.trained && t.source === 'profile') parts.push(T.profileDone(signedKcal(t.kcal), num(t.done), num(t.planned)));
    else if (t.trained) parts.push(T.offPlan(signedKcal(t.kcal)));
    else if (t.kcal > 0) parts.push(T.extra(signedKcal(t.kcal)));
    else if (t.source === 'plan') parts.push(T.planSkipped(signedKcal(t.kcal), sessionName(a)));
    else parts.push(T.profileSkipped(signedKcal(t.kcal), num(t.planned)));
  }
  if (a.other > 0) parts.push(T.other(signedKcal(a.other)));
  return parts;
}

/** What may still come off today: steps short of the target, the planned session ahead. */
export function pendingParts(a: Activity): string[] {
  const parts: string[] = [];
  if (a.steps.pending < 0)
    parts.push(
      T.stepsToGo(num(Math.max(0, a.steps.planned - (a.steps.worth ?? a.steps.actual ?? 0))), signedKcal(a.steps.pending)),
    );
  if (a.training.pending < 0) parts.push(T.sessionAhead(sessionName(a), signedKcal(a.training.pending)));
  return parts;
}

/** The sentence under the balance: what activity did to today's goal, and what may still drop. */
export function activityLine(a: Activity): string | null {
  const parts = activityParts(a);
  const pending = pendingParts(a);
  const head = parts.length ? T.head(signedKcal(a.kcal), parts.join(' · ')) : null;
  const tail = pending.length ? T.tail(num(-a.pending), pending.join(' · ')) : null;
  return [head, tail].filter(Boolean).join(' ') || null;
}
