import type { Activity } from '../../diet/activity';
import { formatNumber } from '../../lib/format';

/**
 * The goal's activity part in words - one source for the balance card, „Kroki i ruch” and the
 * cheat-meal simulation. Signs are explicit: „+120 kcal” adds to the goal, „−160 kcal” takes off.
 */

export const signedKcal = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(Math.round(n)), 0)} kcal`;
const num = (n: number) => formatNumber(Math.round(n), 0);
const sessionName = (a: Activity) => (a.training.plannedName ? `„${a.training.plannedName}”` : 'trening');

/** What already changed the goal: „+60 kcal za kroki (12 000 zamiast 10 000)” … */
export function activityParts(a: Activity): string[] {
  const parts: string[] = [];
  if (a.steps.kcal !== 0)
    parts.push(`${signedKcal(a.steps.kcal)} za kroki (${num(a.steps.actual ?? 0)} zamiast ${num(a.steps.planned)})`);
  const t = a.training;
  if (t.kcal !== 0) {
    if (t.trained && t.source === 'plan' && t.planned > 0)
      parts.push(`${signedKcal(t.kcal)}: ${sessionName(a)} zrobiony (${num(t.done)} kcal, plan zakładał ${num(t.planned)})`);
    else if (t.trained && t.source === 'profile')
      parts.push(`${signedKcal(t.kcal)} za trening (${num(t.done)} kcal; profil zakłada średnio ${num(t.planned)} kcal dziennie)`);
    else if (t.trained) parts.push(`${signedKcal(t.kcal)} za trening spoza planu`);
    else if (t.kcal > 0) parts.push(`${signedKcal(t.kcal)}: dodatkowy trening`);
    else if (t.source === 'plan') parts.push(`${signedKcal(t.kcal)}: ${sessionName(a)} z planu bez wykonania`);
    else parts.push(`${signedKcal(t.kcal)}: bez treningu (profil zakłada średnio ${num(t.planned)} kcal dziennie)`);
  }
  if (a.other > 0) parts.push(`${signedKcal(a.other)} za cardio i przekąski ruchowe`);
  return parts;
}

/** What may still come off today: steps short of the target, the planned session ahead. */
export function pendingParts(a: Activity): string[] {
  const parts: string[] = [];
  if (a.steps.pending < 0)
    parts.push(`${num(Math.max(0, a.steps.planned - (a.steps.actual ?? 0)))} kroków do celu (${signedKcal(a.steps.pending)})`);
  if (a.training.pending < 0) parts.push(`${sessionName(a)} z planu jeszcze przed tobą (${signedKcal(a.training.pending)})`);
  return parts;
}

/** The sentence under the balance: what activity did to today's goal, and what may still drop. */
export function activityLine(a: Activity): string | null {
  const parts = activityParts(a);
  const pending = pendingParts(a);
  const head = parts.length ? `Ruch: ${signedKcal(a.kcal)} do celu — ${parts.join(' · ')}.` : null;
  const tail = pending.length
    ? `Jeśli do wieczora tego nie będzie, cel spadnie najwyżej o ${num(-a.pending)} kcal: ${pending.join(' · ')}.`
    : null;
  return [head, tail].filter(Boolean).join(' ') || null;
}
