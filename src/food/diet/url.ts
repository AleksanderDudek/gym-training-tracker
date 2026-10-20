import { isCalendarDate } from './validate';

/**
 * Stan dziennika i jego podstron w zapytaniu wewnątrz hasha (`#/jedzenie?dzien=2026-10-12`).
 * W Produktach PL zapytanie niosło też widok (`widok=plan`); tu plan posiłków, postęp i profil
 * diety mają własne adresy (`#/jedzenie/plan`…), więc w zapytaniu zostaje tylko dzień — i jednorazowe
 * `dodaj=1`, którym karta jedzenia z ekranu Dziś otwiera „Dodaj zjedzone”.
 */
export interface DiaryState {
  /** Oglądany dzień; `null` to dziś. */
  date: string | null;
  /** Otwórz „Dodaj zjedzone” po wejściu — strona zdejmuje to z adresu zaraz po otwarciu. */
  add: boolean;
}

export const DEFAULT_DIARY_STATE: DiaryState = { date: null, add: false };

export function diaryToParams(state: DiaryState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.date) params.set('dzien', state.date);
  if (state.add) params.set('dodaj', '1');
  return params;
}

export function diaryFromParams(params: URLSearchParams): DiaryState {
  const date = params.get('dzien');
  return {
    // Tylko prawdziwa data: 2026-13-45 pasuje do wzorca i zepsułaby każdą datę z niej liczoną.
    date: isCalendarDate(date) ? date : null,
    add: params.get('dodaj') === '1',
  };
}

/**
 * Plan posiłków: dzień tygodnia planu z arkusza (`?dzien=`, jak w dzienniku) i otwarty formularz
 * nowego planu z zakupami (`?nowy=1`) — dopisany do historii, więc Wstecz go zamyka.
 */
export interface PlanPageState extends DiaryState {
  form: boolean;
  /** Which plan with shopping is shown (`?plan=3`); `null`: the one running today. */
  plan: number | null;
}

export function planPageToParams(state: PlanPageState): URLSearchParams {
  const params = diaryToParams(state);
  if (state.form) params.set('nowy', '1');
  if (state.plan !== null) params.set('plan', String(state.plan));
  return params;
}

export function planPageFromParams(params: URLSearchParams): PlanPageState {
  return { ...diaryFromParams(params), form: params.get('nowy') === '1', plan: planIdOf(params) };
}

/** The list of one plan (`#/jedzenie/zakupy?plan=3`); `null`: the plan running today. */
export interface ShoppingState {
  plan: number | null;
}

export const shoppingToParams = (state: ShoppingState): URLSearchParams =>
  new URLSearchParams(state.plan === null ? '' : { plan: String(state.plan) });

export const shoppingFromParams = (params: URLSearchParams): ShoppingState => ({ plan: planIdOf(params) });

/** A plan id from the address: a positive whole number, or nothing. */
function planIdOf(params: URLSearchParams): number | null {
  const id = Number(params.get('plan'));
  return Number.isInteger(id) && id > 0 ? id : null;
}
