import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { Sections } from '../components/Sections';
import { LOADING, daySeed, pick } from '../engine/quips';
import { FOOD_SECTION_PATH, SECTIONS, type FoodRoute } from '../routing';
import type { DietPage, FoodSection } from '../types';
import { say } from '../i18n';
import './food.css';

/**
 * Zakładka Jedzenie — wejście do całej paczki jedzenia. App wczytuje ten plik leniwie, więc
 * ekrany treningu nie wczytują Dexie, Leafleta ani kodu bazy produktów. Każda strona ma tu
 * jeszcze własną paczkę: mapa i jej biblioteka przychodzą dopiero z „W pobliżu”, a baza diety
 * z dziennika i jego podstron.
 *
 * Strony nie dostają propsów: dane treningowe biorą z mostu (`useBridge`), dietę z hooków
 * `useDiet` (warianty `useMerged*`), bazę produktów z `useDataset`, a stan strony z adresu
 * (`useUrlState`, zapytanie w hashu).
 */

/** Strona jedzenia: domyślny eksport bez propsów, w osobnej paczce. */
type LazyPage = LazyExoticComponent<ComponentType>;

const SECTION_PAGE: Record<FoodSection, LazyPage> = {
  diary: lazy(() => import('./components/diet/DiaryPage')),
  recipes: lazy(() => import('./components/recipes/RecipesPage')),
  products: lazy(() => import('./components/products/ProductsPage')),
  nearby: lazy(() => import('./components/nearby/NearbyPage')),
};

const DIET_PAGE: Record<DietPage, LazyPage> = {
  plan: lazy(() => import('./components/diet/DietPlanPage')),
  plans: lazy(() => import('./components/prep/PlansPage')),
  progress: lazy(() => import('./components/diet/DietProgressPage')),
  profile: lazy(() => import('./components/diet/DietProfilePage')),
  shopping: lazy(() => import('./components/prep/ShoppingPage')),
};

/** Lokale: lista sieci i menu jednej z nich — jedyna strona jedzenia z propsem (sieć z adresu). */
const RestaurantsPage = lazy(() => import('./components/restaurants/RestaurantsPage'));
const ChainPage = lazy(() => import('./components/restaurants/ChainPage'));

function page(route: FoodRoute) {
  switch (route.kind) {
    case 'food': {
      const Page = SECTION_PAGE[route.section];
      return <Page key={FOOD_SECTION_PATH[route.section]} />;
    }
    case 'diet': {
      const Page = DIET_PAGE[route.page];
      return <Page key={`diet:${route.page}`} />;
    }
    case 'restaurants':
      return route.chain ? (
        <ChainPage key={`lokale:${route.chain}`} chainId={route.chain} />
      ) : (
        <RestaurantsPage key="lokale" />
      );
  }
}

export default function FoodRoot({ route }: { route: FoodRoute }) {
  return (
    <>
      {route.kind === 'food' && (
        <div className="wrap">
          <Sections aria-label={say('Sekcje zakładki Jedzenie', 'Food tab sections')} items={SECTIONS.food} current={FOOD_SECTION_PATH[route.section]} />
        </div>
      )}
      <Suspense fallback={<div className="empty">{pick(LOADING, daySeed())}</div>}>
        {/* Klucz za ścieżką: `useUrlState` przypina stronę do ścieżki z chwili montażu, więc nowa
            ścieżka to zawsze nowy egzemplarz strony, nigdy ten sam przeniesiony pod inny adres. */}
        {page(route)}
      </Suspense>
    </>
  );
}
