import { useEffect, useMemo } from 'react';
import { markDiet } from '../../dietFlag';
import { buildPool } from '../../diet/pool';
import { useClock, useCustomFoods, useNearbyChains, usePlan, useProfile } from '../../hooks/useDiet';
import { useDataset, type DatasetResult } from '../../hooks/useDataset';
import type { Plan } from '../../diet/plan';
import type { Profile } from '../../diet/types';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { chainsWithFood } from '../../recipes/chains';
import { recipeIndex } from '../../recipes/resolve';

/**
 * Wspólny początek stron dziennika: profil, plan i zegar. Znaleziony profil stawia znacznik
 * `gt:diet` — także profil z Produktów PL, który przyszedł razem z domeną — więc karta jedzenia
 * pojawi się na ekranie Dziś bez osobnego zapisu.
 */
export function useDietBase() {
  const profile = useProfile();
  const plan = usePlan();
  const clock = useClock();
  useEffect(() => {
    if (profile) markDiet(true);
  }, [profile]);
  return { profile, plan, clock };
}

// Stałe, a nie nowe tablice co render: `recipeIndex` i `chainsWithFood` pamiętają wynik po tożsamości listy.
const NO_PRODUCTS: IndexedProduct[] = [];
const NO_DICT: Dictionaries = { categories: {}, labels: {}, allergens: {}, additives: {}, brands: {}, stores: {} };

export interface FoodPool {
  data: DatasetResult;
  products: IndexedProduct[];
  dict: Dictionaries;
  pool: ReturnType<typeof buildPool>;
  nearby: ReturnType<typeof useNearbyChains>;
}

/**
 * Wszystko, z czego da się ułożyć dzień: przepisy i gotowe produkty z sieci w pobliżu, pozycje
 * planu i własne jedzenie. W Produktach PL dieta czekała na bazę produktów razem z całą stroną;
 * tu dziennik działa od razu (bilans, plan i zapisy bazy nie potrzebują), a przepisy i produkty
 * dochodzą do puli, gdy baza się wczyta. Bez bazy w tej wersji zostają plan i własne jedzenie.
 */
export function useFoodPool(profile: Profile | null, plan: Plan | null, nowMs: number): FoodPool {
  const data = useDataset();
  const custom = useCustomFoods();
  const products = data.status === 'ready' ? data.products : NO_PRODUCTS;
  const dict = data.status === 'ready' ? data.dataset.dictionaries : NO_DICT;

  const { candidates, ranking } = recipeIndex(products);
  const knownChains = chainsWithFood(products);
  const preferred = profile?.preferredStore ?? null;
  const nearby = useNearbyChains(knownChains, preferred, nowMs);

  const chains = useMemo(
    () => (nearby.chains.length ? nearby.chains.map((c) => c.chain) : preferred ? [preferred] : []),
    [nearby, preferred],
  );
  const pool = useMemo(
    () => buildPool({ products, dict, candidates, chains, fallbackRanking: ranking, plan, custom: custom ?? [] }),
    [products, dict, candidates, chains, ranking, plan, custom],
  );
  return { data, products, dict, pool, nearby };
}

/**
 * Sieci od najlepszej pod przepisy, z nazwami — lista do wyboru sklepu w profilu diety. Póki baza
 * produktów się wczytuje, lista jest pusta (zostaje „dowolny sklep” i sklep już wybrany).
 */
export function useStoreList(): { key: string; name: string }[] {
  const data = useDataset();
  const products = data.status === 'ready' ? data.products : NO_PRODUCTS;
  const dict = data.status === 'ready' ? data.dataset.dictionaries : NO_DICT;
  const { ranking } = recipeIndex(products);
  return useMemo(() => ranking.map((key) => ({ key, name: dict.stores[key] ?? key })), [ranking, dict]);
}
