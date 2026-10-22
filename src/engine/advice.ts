import type { ActivePlan, AppState, PlanTemplate } from '../types';
import { spreadDays } from './planedit';
import { GRACE_DAYS, dayKey, daysBetween, planWeekdays } from './schedule';
import type { PlanStats } from './schedule';
import { text } from '../i18n';

const T = text({
  pl: {
    dueTitle: 'Dziś jest termin',
    dueText: 'Trening zrobiony co do dnia daje najwięcej punktów i przedłuża serię.',
    makeupTitle: (behind: number) => `Zaległy termin sprzed ${behind === 1 ? 'jednego dnia' : `${behind} dni`}`,
    lastDay: 'Dziś ostatni dzień na nadrobienie.',
    daysLeft: (left: number) => `Na nadrobienie zostały ${left} dni, licząc dzisiejszy.`,
    makeupAfter: ' Potem termin przepada, ale sam trening nie — wejdzie na kolejny termin.',
    restTitle: (wait: number) => (wait === 1 ? 'Jutro następny termin' : `Wolne przez ${wait} dni`),
    restText: 'Trening zrobiony dziś policzy się jako dodatkowy. Przerwa też pracuje — to w niej rośnie siła.',
    endTitle: 'Plan dobiegł końca',
    endText: 'Zamknij go i wybierz kolejny wariant. Punkty i odznaki zostają.',
    layoffTitle: (gap: number) => `Przerwa ${gap} dni`,
    layoffText: 'Pierwszy trening po powrocie nie musi być ciężki. Skoki na cięższe obciążenie i tak są wstrzymane.',
    slowerTitle: (adherence: number) => `Realizacja ${adherence}% — plan jest za gęsty`,
    slowerText: (elapsed: number, done: number, perWeek: number) =>
      `Z ${elapsed} terminów wyszło ${done}. ${perWeek}× w tygodniu wytrzymasz, a plan przestanie być listą wyrzutów.`,
    fasterTitle: (adherence: number) => `Realizacja ${adherence}% — masz zapas`,
    fasterText: (perWeek: number) =>
      `Ani jeden termin nie leży. ${perWeek}× w tygodniu doda jeden trening i nie ruszy zasad progresji.`,
  },
  en: {
    dueTitle: 'Due today',
    dueText: 'A workout done on the day earns the most points and keeps your streak going.',
    makeupTitle: (behind: number) => `Overdue by ${behind === 1 ? 'one day' : `${behind} days`}`,
    lastDay: 'Today is the last day to catch up.',
    daysLeft: (left: number) => `${left} days left to catch up, including today.`,
    makeupAfter: ' After that the deadline is missed, but the workout isn’t lost — it moves to the next deadline.',
    restTitle: (wait: number) => (wait === 1 ? 'Next deadline tomorrow' : `${wait} days off`),
    restText: 'A workout done today counts as an extra. Rest works too — that’s when strength grows.',
    endTitle: 'The plan is finished',
    endText: 'Close it and pick the next variant. Your points and badges stay.',
    layoffTitle: (gap: number) => `${gap}-day break`,
    layoffText: 'Your first workout back doesn’t have to be hard. Jumps to heavier weights are paused anyway.',
    slowerTitle: (adherence: number) => `${adherence}% done — the plan is too packed`,
    slowerText: (elapsed: number, done: number, perWeek: number) =>
      `You made ${done} of ${elapsed} deadlines. ${perWeek}× a week is something you can keep up, and the plan stops being a list of guilt trips.`,
    fasterTitle: (adherence: number) => `${adherence}% done — you have room for more`,
    fasterText: (perWeek: number) =>
      `Not a single deadline missed. ${perWeek}× a week adds one workout and leaves the progression rules alone.`,
  },
});

export type AdviceKind = 'due' | 'makeup' | 'rest' | 'layoff' | 'slower' | 'faster' | 'end';

export interface Advice {
  kind: AdviceKind;
  level: 'good' | 'warn' | 'plain';
  title: string;
  text: string;
  /** Propozycja zmiany częstotliwości planu klasycznego — inny wariant z konfiguratora. */
  freq?: number;
  /** Propozycja nowych dni planu z celem, z profilem albo własnego — zmiana od dziś. */
  days?: number[];
}

/**
 * Co aplikacja ma do powiedzenia o najbliższym treningu. Reguły celowo patrzą na
 * regularność, a nie na wyniki: częstotliwość, którą ktoś realnie utrzymuje, jest wart
 * więcej niż częstotliwość, którą kiedyś wybrał w katalogu.
 */
export function advise(
  state: AppState,
  template: PlanTemplate,
  plan: ActivePlan,
  stats: PlanStats,
  today: string,
): Advice[] {
  const out: Advice[] = [];
  // Przerwa liczona w dniach kalendarzowych względem `today`, a nie względem zegara —
  // ta sama data ma dawać tę samą podpowiedź niezależnie od godziny i strefy.
  const last = state.log[state.log.length - 1];
  const gap = last ? daysBetween(dayKey(last.date), today) : null;

  if (stats.due && stats.due.date === today) {
    out.push({
      kind: 'due',
      level: 'good',
      title: T.dueTitle,
      text: T.dueText,
    });
  } else if (stats.due) {
    const behind = daysBetween(stats.due.date, today);
    // Dzisiejszy dzień wlicza się do okna, więc przy zaległości równej oknu zostaje ostatni dzień.
    const left = GRACE_DAYS - behind + 1;
    out.push({
      kind: 'makeup',
      level: 'warn',
      title: T.makeupTitle(behind),
      text: (left <= 1 ? T.lastDay : T.daysLeft(left)) + T.makeupAfter,
    });
  } else if (stats.next) {
    const wait = daysBetween(today, stats.next.date);
    out.push({
      kind: 'rest',
      level: 'plain',
      title: T.restTitle(wait),
      text: T.restText,
    });
  } else {
    out.push({
      kind: 'end',
      level: 'good',
      title: T.endTitle,
      text: T.endText,
    });
  }

  if (gap !== null && gap >= 11) {
    out.push({
      kind: 'layoff',
      level: 'warn',
      title: T.layoffTitle(gap),
      text: T.layoffText,
    });
  }

  const weekdays = planWeekdays(template, plan);
  const perWeek = weekdays.length;
  const adherence = stats.adherence ?? 100;
  // Plan klasyczny ma gotowy wariant rzadszy i gęstszy w konfiguratorze. Plan z celem,
  // z profilem i własny dostają nowe dni od dziś: rotacja treningów idzie dalej, zmienia się
  // tylko to, w które dni wypada — tak, żeby przerwy były jak najrówniejsze.
  const classic = (template.kind ?? 'classic') === 'classic';
  const change = (d: 1 | -1): Pick<Advice, 'freq' | 'days'> =>
    classic ? { freq: perWeek + d } : { days: spreadDays(weekdays, d) };

  if (stats.elapsed >= 6 && adherence < 60 && perWeek > 2) {
    out.push({
      kind: 'slower',
      level: 'warn',
      title: T.slowerTitle(adherence),
      text: T.slowerText(stats.elapsed, stats.done, perWeek - 1),
      ...change(-1),
    });
  } else if (stats.elapsed >= 8 && adherence >= 95 && perWeek < 6) {
    out.push({
      kind: 'faster',
      level: 'good',
      title: T.fasterTitle(adherence),
      text: T.fasterText(perWeek + 1),
      ...change(1),
    });
  }

  return out;
}
