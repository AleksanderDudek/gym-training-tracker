import { planById } from '../data/plans';
import type { ActivePlan, AppState, PlanTemplate } from '../types';
import { buildSchedule, dayKey, logDays, planStats } from './schedule';
import type { PlanStats, Schedule } from './schedule';
import { rankFor, scorePlan } from './score';
import type { RankState, Score } from './score';

/**
 * Jedno wyliczenie stanu planu na dziś: kalendarz, statystyki, punkty i stopień.
 * Wszystko wyprowadzane, nic zapamiętane — widok, silnik odznak i ekran treningu
 * patrzą na te same liczby, bo pochodzą z jednego wywołania.
 */
export interface Snapshot {
  template: PlanTemplate;
  plan: ActivePlan;
  schedule: Schedule;
  stats: PlanStats;
  score: Score;
  /** Punkty z tego planu razem z dorobkiem z planów zamkniętych. */
  points: number;
  rank: RankState;
  today: string;
}

export function snapshot(
  state: AppState,
  today: string = dayKey(Date.now()),
): Snapshot | null {
  const plan = state.plan;
  const template = plan ? planById(plan.templateId) : undefined;
  if (!plan || !template) return null;

  const schedule = buildSchedule(template, plan, logDays(state), today);
  const stats = planStats(schedule, today);
  const score = scorePlan(schedule);
  const points = state.award.banked + score.points;

  return { template, plan, schedule, stats, score, points, rank: rankFor(points), today };
}

/**
 * Zamknięcie planu. Punkty z kalendarza przechodzą do trwałego dorobku, bo po skasowaniu
 * planu nie ma już z czego ich odtworzyć — a dorobek ma przeżyć każdą zmianę wariantu.
 */
export function bankPoints(state: AppState, today: string = dayKey(Date.now())): number {
  const snap = snapshot(state, today);
  if (!snap) return 0;
  state.award.banked += snap.score.points;
  return snap.score.points;
}
