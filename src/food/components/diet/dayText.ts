import { text } from '../../../i18n';
import type { DayState } from '../../diet/day';
import { pauseOn } from '../../diet/target';
import type { Profile, WeekCheck } from '../../diet/types';
import { formatNumber } from '../../lib/format';
import { dayMonthLong } from './dietFormat';

/**
 * The day in one sentence (spec §4.1): „Zostało ok. 650 kcal i 54 g białka” on the Today card and
 * on the diary's day card alike, the calm „ponad cel” line, the planned bigger meal set aside, and
 * the one-line notices the Today card links to the diary. Numbers: targets as stored, „ok.” amounts
 * already rounded to 10 (`dayState`), grams whole.
 */

const n = (value: number): string => formatNumber(Math.round(value), 0);

const T = text({
  pl: {
    start: (kcal: string, g: string) => `Na dziś: ${kcal} kcal i ${g} g białka`,
    left: (kcal: string, g: string) => `Zostało ok. ${kcal} kcal i ${g} g białka`,
    leftProteinDone: (kcal: string) => `Zostało ok. ${kcal} kcal — białko na dziś już jest`,
    within: (g: string) => `Kalorie na dziś w zakresie celu, białka jeszcze ${g} g`,
    withinDone: 'Kalorie na dziś w zakresie celu, białko też już jest',
    enough: (g: string) => `Na dziś kalorii już wystarczy, białka jeszcze ${g} g`,
    enoughAll: 'Na dziś kalorii i białka już wystarczy',
    over: (kcal: string) => `To ok. ${kcal} kcal ponad cel — jeden dzień nie zmienia trendu.`,
    overPlanned: (kcal: string) =>
      `Z zaplanowanym większym posiłkiem to ok. ${kcal} kcal ponad cel — jeden dzień nie zmienia trendu.`,
    reserved: (kcal: string) => `Liczę już z zaplanowanym większym posiłkiem (${kcal} kcal).`,
    proteinOnly: (g: string) => `Białka jeszcze ${g} g`,
    proteinOnlyDone: 'Białko na dziś już jest',
    noticeLink: 'Liczenie kalorii jest teraz prostsze — zobacz, co się zmieniło',
    changedLink: (to: string, from: string) => `Od dziś cel: ${to} kcal (było ${from})`,
    askLink: 'Propozycja nowego celu czeka w dzienniku',
    reachedLink: 'Waga docelowa osiągnięta',
    pauseLink: (date: string) => `Przerwa w liczeniu do ${date}.`,
    rowG: (eaten: string, target: string) => `${eaten} z ${target} g`,
    rowKcal: (eaten: string, target: string) => `${eaten} z ${target} kcal`,
  },
  en: {
    start: (kcal: string, g: string) => `Today: ${kcal} kcal and ${g} g protein`,
    left: (kcal: string, g: string) => `About ${kcal} kcal and ${g} g protein left`,
    leftProteinDone: (kcal: string) => `About ${kcal} kcal left — protein done for today`,
    within: (g: string) => `Calories for today are within your target, ${g} g protein to go`,
    withinDone: 'Calories for today are within your target, and protein’s done too',
    enough: (g: string) => `That’s enough calories for today, ${g} g protein to go`,
    enoughAll: 'That’s enough calories and protein for today',
    over: (kcal: string) => `That’s about ${kcal} kcal over the target — one day doesn’t change the trend.`,
    overPlanned: (kcal: string) =>
      `With the planned bigger meal that’s about ${kcal} kcal over the target — one day doesn’t change the trend.`,
    reserved: (kcal: string) => `This already counts the planned bigger meal (${kcal} kcal).`,
    proteinOnly: (g: string) => `${g} g protein to go`,
    proteinOnlyDone: 'Protein done for today',
    noticeLink: 'Calorie counting is simpler now — see what changed',
    changedLink: (to: string, from: string) => `New target from today: ${to} kcal (was ${from})`,
    askLink: 'A suggested new target is waiting in the diary',
    reachedLink: 'Target weight reached',
    pauseLink: (date: string) => `Counting paused until ${date}.`,
    rowG: (eaten: string, target: string) => `${eaten} of ${target} g`,
    rowKcal: (eaten: string, target: string) => `${eaten} of ${target} kcal`,
  },
});

/** What the day says: the headline and the two optional lines under the bars. */
export interface DayLines {
  headline: string;
  /** „To ok. 300 kcal ponad cel — …” (or the planned-meal variant); only over the band. */
  over: string | null;
  /** „Liczę już z zaplanowanym większym posiłkiem (900 kcal).” while a planned meal is set aside. */
  reserved: string | null;
}

/**
 * Today's headline from where the day stands (`dayState`): the whole target before anything is
 * eaten, what is left, within the target, or enough — with protein in the same sentence. Without
 * calories on screen only protein is left to say.
 */
export function dayLines(s: DayState, shown: boolean): DayLines {
  if (!shown) return { headline: s.proteinDone ? T.proteinOnlyDone : T.proteinOnly(n(s.protein)), over: null, reserved: null };
  const reserved = s.planned !== null && s.kind !== 'over' ? T.reserved(n(s.planned)) : null;
  switch (s.kind) {
    case 'start':
      return { headline: T.start(n(s.target), n(s.protein)), over: null, reserved };
    case 'left':
      return { headline: s.proteinDone ? T.leftProteinDone(n(s.kcal)) : T.left(n(s.kcal), n(s.protein)), over: null, reserved };
    case 'within':
      return { headline: s.proteinDone ? T.withinDone : T.within(n(s.protein)), over: null, reserved };
    case 'over':
      return {
        headline: s.proteinDone ? T.enoughAll : T.enough(n(s.protein)),
        over: s.overPlanned ? T.overPlanned(n(s.kcal)) : T.over(n(s.kcal)),
        reserved: null,
      };
  }
}

/** „To ok. 300 kcal ponad cel — …” for a closed day judged on what was eaten (kcal over, rounded to 10). */
export const overLine = (kcal: number): string => T.over(n(kcal));

/** A bar's value in words: „96 z 150 g”. */
export const gramsOf = (eaten: number, target: number): string => T.rowG(n(eaten), n(target));

/** A bar's value in words: „1240 z 2100 kcal”. */
export const kcalOf = (eaten: number, target: number): string => T.rowKcal(n(eaten), n(target));

/** Statuses of a Monday check that put a card on the diary (until it is answered). */
const CARD_STATUSES: ReadonlySet<WeekCheck['status']> = new Set(['changed', 'ask', 'suggested', 'reached']);

/**
 * The Monday check waiting for an answer, or null (spec §4.2): an unanswered `changed`, `ask`,
 * `suggested` or `reached`, while the target is still the one the card is about — a target changed
 * another way since (the profile, a break) hides it. Without calories on screen only the numberless
 * `reached` card is left. The diary's card and the Today card's link both read this.
 */
export function waitingCheck(p: Profile, shown: boolean): WeekCheck | null {
  const c = p.lastCheck;
  if (!c || c.answer !== null || !CARD_STATUSES.has(c.status)) return null;
  if (!shown && c.status !== 'reached') return null;
  if (c.status === 'changed' && p.dailyKcal !== c.to) return null;
  if ((c.status === 'ask' || c.status === 'suggested') && p.dailyKcal !== c.from) return null;
  if (c.status === 'reached' && p.dailyKcal !== c.to && p.dailyKcal !== c.from) return null;
  return c;
}

/**
 * The Today card's one notice line, all leading to the diary: the upgrade notice first, then a
 * Monday card waiting for an answer, then an active break. Null when there is nothing to say.
 */
export function todayLink(p: Profile, today: string, shown: boolean): string | null {
  if (p.notice === 'show') return T.noticeLink;
  const check = waitingCheck(p, shown);
  if (check?.status === 'changed') return T.changedLink(n(check.to), n(check.from));
  if (check?.status === 'ask' || check?.status === 'suggested') return T.askLink;
  if (check?.status === 'reached') return T.reachedLink;
  const pause = pauseOn(p, today);
  return pause ? T.pauseLink(dayMonthLong(pause.to)) : null;
}
