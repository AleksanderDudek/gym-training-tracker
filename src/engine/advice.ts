import type { ActivePlan, AppState, PlanTemplate } from '../types';
import { GRACE_DAYS, dayKey, daysBetween, planWeekdays } from './schedule';
import type { PlanStats } from './schedule';

export type AdviceKind = 'due' | 'makeup' | 'rest' | 'layoff' | 'slower' | 'faster' | 'end';

export interface Advice {
  kind: AdviceKind;
  level: 'good' | 'warn' | 'plain';
  title: string;
  text: string;
  /** Propozycja zmiany częstotliwości — do przycisku w widoku planu. */
  freq?: number;
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
      title: 'Dziś jest termin',
      text: 'Trening zrobiony co do dnia daje najwięcej punktów i przedłuża serię.',
    });
  } else if (stats.due) {
    const behind = daysBetween(stats.due.date, today);
    // Dzisiejszy dzień wlicza się do okna, więc przy zaległości równej oknu zostaje ostatni dzień.
    const left = GRACE_DAYS - behind + 1;
    out.push({
      kind: 'makeup',
      level: 'warn',
      title: `Zaległy termin sprzed ${behind === 1 ? 'jednego dnia' : `${behind} dni`}`,
      text:
        (left <= 1
          ? 'Dziś ostatni dzień na nadrobienie.'
          : `Na nadrobienie zostały ${left} dni, licząc dzisiejszy.`) +
        ' Potem termin przepada, ale sam trening nie — wejdzie na kolejny termin.',
    });
  } else if (stats.next) {
    const wait = daysBetween(today, stats.next.date);
    out.push({
      kind: 'rest',
      level: 'plain',
      title: wait === 1 ? 'Jutro następny termin' : `Wolne przez ${wait} dni`,
      text: 'Trening zrobiony dziś policzy się jako dodatkowy. Przerwa też pracuje — to w niej rośnie siła.',
    });
  } else {
    out.push({
      kind: 'end',
      level: 'good',
      title: 'Plan dobiegł końca',
      text: 'Zamknij go i wybierz kolejny wariant. Punkty i odznaki zostają.',
    });
  }

  if (gap !== null && gap >= 11) {
    out.push({
      kind: 'layoff',
      level: 'warn',
      title: `Przerwa ${gap} dni`,
      text: 'Pierwszy trening po powrocie nie musi być ciężki. Skoki na cięższy kettlebell i tak są wstrzymane.',
    });
  }

  const perWeek = planWeekdays(template, plan).length;
  const adherence = stats.adherence ?? 100;

  if (stats.elapsed >= 6 && adherence < 60 && perWeek > 2) {
    out.push({
      kind: 'slower',
      level: 'warn',
      title: `Realizacja ${adherence}% — plan jest za gęsty`,
      text: `Z ${stats.elapsed} terminów wyszło ${stats.done}. Wariant ${perWeek - 1}× w tygodniu wytrzymasz, a plan przestanie być listą wyrzutów.`,
      freq: perWeek - 1,
    });
  } else if (stats.elapsed >= 8 && adherence >= 95 && perWeek < 6) {
    out.push({
      kind: 'faster',
      level: 'good',
      title: `Realizacja ${adherence}% — masz zapas`,
      text: `Ani jeden termin nie leży. Wariant ${perWeek + 1}× w tygodniu doda jeden trening i nie ruszy zasad progresji.`,
      freq: perWeek + 1,
    });
  }

  return out;
}
