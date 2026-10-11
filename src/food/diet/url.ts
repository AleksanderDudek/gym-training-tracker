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
