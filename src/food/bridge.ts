import { createContext, useContext } from 'react';

/**
 * Most między zakładką Jedzenie a danymi treningowymi: jedno ciało, jedno źródło prawdy.
 *
 * Dieta potrzebuje wagi, wzrostu, kroków i tego, czy był trening — a to wszystko gym tracker
 * już zapisuje (`state.body`, `cfg.height`, wpisy kroków i zegarek, dziennik treningów). Zamiast
 * drugiej kopii w IndexedDB ekrany jedzenia czytają i piszą przez ten most, a App buduje go
 * ze swojego stanu. Moduły diety zostają czyste: scalone dni podaje `useMergedHistory`.
 *
 * Plik leży w głównej paczce (App podaje kontekst), więc nie importuje niczego z jedzenia
 * poza typami — Dexie, Leaflet i baza produktów zostają w paczce zakładki Jedzenie.
 */
export interface GymBridge {
  /** Ważenia z dziennika wagi, rosnąco po dniu. */
  weights: readonly { day: string; kg: number }[];
  /** Ważenie z danego dnia (`yyyy-mm-dd`); drugie tego samego dnia zastępuje pierwsze. */
  setWeight(kg: number, day: string): void;
  /** Wzrost z profilu; `null`, gdy nikt go nie wpisał. */
  heightCm: number | null;
  setHeight(cm: number): void;
  /** Kroki z dnia według treningów: wpis ręczny albo zegarek (wyższa liczba); `null`, gdy brak. */
  stepsOn(day: string): number | null;
  /** Kroki dnia jako zwykły wpis kroków — liczy się do odznak, doświadczenia i kalorii jak każdy inny. */
  setSteps(day: string, steps: number): void;
  /**
   * Ruch dnia z treningów. Kalorie są `null`, dopóki nie ma żadnego ważenia — bez wagi aplikacja
   * ich nie liczy. Cel diety zakłada ruch z planu, więc dieta dolicza tylko różnicę między ruchem
   * zaplanowanym a zrobionym (`diet/activity.ts`) — nigdy całych spalonych kalorii.
   */
  moveOn(day: string): MoveDay;
  /** Krótka wiadomość na dole ekranu — ta sama, co po zapisie w treningach. */
  toast(message: string): void;
}

export interface MoveDay {
  /** Był trening siłowy (wpis w dzienniku treningów). */
  trained: boolean;
  /** Aktywne kalorie treningów siłowych tego dnia. */
  workoutKcal: number | null;
  /** Aktywne kalorie kroków i cardio razem — do zdania „Ruch dziś”. */
  cardioKcal: number | null;
  /** Ruch poza krokami: bieżnia, rower, taniec i przekąski ruchowe. Kroki dieta liczy sama. */
  otherKcal: number | null;
  /** Trening, który plan treningowy wyznaczył na ten dzień, i jego szacunek; `null` — bez treningu w planie. */
  planned: { name: string; kcal: number | null } | null;
  /** Czy jest aktywny plan treningowy. Bez niego dieta porównuje z założeniem profilu. */
  planActive: boolean;
  /** Typowy trening tej osoby (średnia z ostatnich), kcal; `null` bez historii albo ważenia. */
  typicalWorkoutKcal: number | null;
  /** Treningi siłowe zapisane tego dnia. */
  workouts: number;
  /** Przekąski ruchowe tego dnia. */
  snacks: number;
  /** Wyjścia na cardio od 10 minut: bieżnia, rower, taniec oraz biegi i marsze z zegarka. */
  outings: number;
  /** Minuty ruchu w przeliczeniu na umiarkowany, tak jak liczą je treningi. */
  activeMin: number;
  /**
   * Ile kroków zwykłego marszu spaliłoby tyle, co kroki dnia z drogą z urządzenia, biegami
   * i piętrami — w tej walucie dieta liczy chodzenie. `null` w dniu bez kroków.
   */
  stepsWorth: number | null;
}

export const BridgeContext = createContext<GymBridge | null>(null);

/** Most z kontekstu. Bez niego ekran jedzenia nie ma skąd wziąć danych — to błąd montażu, nie stan. */
export function useBridge(): GymBridge {
  const bridge = useContext(BridgeContext);
  // i18n-ignore: a developer's mounting error, never shown to a user
  if (!bridge) throw new Error('useBridge: brak BridgeContext.Provider — ekran jedzenia musi stać pod mostem z App.');
  return bridge;
}
