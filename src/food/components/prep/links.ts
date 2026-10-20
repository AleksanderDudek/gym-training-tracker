import { dietPath } from '../../../routing';
import { planPageToParams, shoppingToParams } from '../../diet/url';
import { hashWith } from '../../hash';
import type { PrepPlan } from '../../prep/types';

/** The plan page showing this plan with shopping (`#/jedzenie/plan?plan=3`). */
export const planHref = (plan: Pick<PrepPlan, 'id'>): string =>
  hashWith(dietPath('plan'), planPageToParams({ date: null, add: false, form: false, plan: plan.id ?? null }));

/** The shopping list of this plan (`#/jedzenie/zakupy?plan=3`). */
export const shoppingHref = (plan: Pick<PrepPlan, 'id'>): string =>
  hashWith(dietPath('shopping'), shoppingToParams({ plan: plan.id ?? null }));
