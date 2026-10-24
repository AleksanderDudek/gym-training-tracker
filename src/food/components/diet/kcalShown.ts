import { createContext, useContext } from 'react';

/**
 * Whether calories are on screen (spec §4.10): `false` in „Bez liczenia kalorii” mode
 * (`hidesKcal(profile)`). `DiaryPage` and `TodayFoodCard` provide it; sheets and other portals
 * inherit it through the React tree. Without a provider calories are shown.
 */
export const KcalShown = createContext(true);

export const useKcalShown = (): boolean => useContext(KcalShown);
