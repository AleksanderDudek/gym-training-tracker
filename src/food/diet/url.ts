import { isCalendarDate } from './validate';

export const DIET_VIEWS = ['dzis', 'plan', 'postep', 'profil'] as const;
export type DietView = (typeof DIET_VIEWS)[number];

export const VIEW_LABELS: Record<DietView, string> = {
  dzis: 'Dziś',
  plan: 'Plan',
  postep: 'Postęp',
  profil: 'Profil',
};

/** The diet tab's state in its query string: which view, which day (none: today). */
export interface DietState {
  view: DietView;
  date: string | null;
}

export const DEFAULT_DIET_STATE: DietState = { view: 'dzis', date: null };

export function dietToParams(state: DietState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== 'dzis') params.set('widok', state.view);
  if (state.date) params.set('dzien', state.date);
  return params;
}

export function dietFromParams(params: URLSearchParams): DietState {
  const view = params.get('widok');
  const date = params.get('dzien');
  return {
    view: view && (DIET_VIEWS as readonly string[]).includes(view) ? (view as DietView) : 'dzis',
    // A real date only: 2026-13-45 matches the pattern and would break every date computed from it.
    date: isCalendarDate(date) ? date : null,
  };
}
