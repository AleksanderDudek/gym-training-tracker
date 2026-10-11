import type { Nutrients } from './types';

/** One line of a planned day: "½ opak. Teriyaki", 640 kcal, and its macros when known. */
export interface PlanItem extends Nutrients {
  text: string;
  /** Chains that sell it, when the plan says (the pizzas do). */
  stores: string[];
}

export interface PlanVariant {
  /** 1-based, as in the workbook. */
  index: number;
  items: PlanItem[];
  /** The variant's own totals as the plan states them. */
  totals: Nutrients;
}

export interface Plan {
  id: string;
  name: string;
  /** YYYY-MM-DD of day 1. */
  startDate: string;
  /** Template key per day from the start ("1A", "2A", ...); repeats after the last. */
  days: string[];
  templates: Record<string, PlanVariant[]>;
  /** Every distinct item, for swaps and logging. */
  foods: PlanItem[];
  /** The plan's own notes about its variants, shown beside the picker. */
  notes: string[];
}

/** What the user did with a planned day: which variant, what was swapped or skipped. */
export interface DayChoices {
  variant?: number;
  /** Item index -> what replaced it. */
  swaps?: Record<number, PlanItem>;
  skipped?: number[];
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** The template of a date, or null before the plan starts. The plan repeats after its last day. */
export function templateFor(plan: Plan, date: string): string | null {
  const index = daysBetween(plan.startDate, date);
  if (index < 0 || plan.days.length === 0) return null;
  return plan.days[index % plan.days.length] ?? null;
}

export interface PlannedItem extends PlanItem {
  index: number;
  /** The original line when this one was swapped in. */
  replaced: PlanItem | null;
  skipped: boolean;
}

export interface PlannedDay {
  template: string;
  variant: number;
  variants: number;
  items: PlannedItem[];
}

/** A date's planned items with the user's variant, swaps and skips applied. */
export function plannedDay(plan: Plan, date: string, choices: DayChoices = {}): PlannedDay | null {
  const template = templateFor(plan, date);
  const variants = template ? plan.templates[template] : undefined;
  const first = variants?.[0];
  if (!template || !variants || !first) return null;
  const variant = variants.find((v) => v.index === choices.variant) ?? first;
  return {
    template,
    variant: variant.index,
    variants: variants.length,
    items: variant.items.map((item, index) => {
      const swap = choices.swaps?.[index];
      return {
        ...(swap ?? item),
        index,
        replaced: swap ? item : null,
        skipped: choices.skipped?.includes(index) ?? false,
      };
    }),
  };
}

/** The planned calories of a day: what the plan would have you eat, skips excluded. */
export function plannedKcal(day: PlannedDay | null): number | null {
  if (!day) return null;
  return day.items.filter((i) => !i.skipped).reduce((sum, i) => sum + i.kcal, 0);
}
