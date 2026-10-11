import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { Sections } from '../components/Sections';
import { LOADING, daySeed, pick } from '../engine/quips';
import { FOOD_SECTION_PATH, SECTIONS } from '../routing';
import type { DietPage, FoodSection, Route } from '../types';
import './food.css';

/**
 * Zakładka Jedzenie — wejście do całej paczki jedzenia. App wczytuje ten plik leniwie, więc
 * ekrany treningu nie pobierają Dexie, Leafleta ani kodu bazy produktów. Każda strona ma tu
 * jeszcze własną paczkę: mapa i jej biblioteka przychodzą dopiero z „W pobliżu”, a baza diety
 * z dziennika i jego podstron.
 *
 * Strony nie dostają propsów: dane treningowe biorą z mostu (`useBridge`), dietę z hooków
 * `useDiet` (warianty `useMerged*`), bazę produktów z `useDataset`, a stan strony z adresu
 * (`useUrlState`, zapytanie w hashu).
 */

export type FoodRoute = Extract<Route, { kind: 'food' } | { kind: 'diet' }>;

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
  progress: lazy(() => import('./components/diet/DietProgressPage')),
  profile: lazy(() => import('./components/diet/DietProfilePage')),
};

export default function FoodRoot({ route }: { route: FoodRoute }) {
  const Page = route.kind === 'food' ? SECTION_PAGE[route.section] : DIET_PAGE[route.page];
  // Klucz za ścieżką: `useUrlState` przypina stronę do ścieżki z chwili montażu, więc nowa
  // ścieżka to zawsze nowy egzemplarz strony, nigdy ten sam przeniesiony pod inny adres.
  const path = route.kind === 'food' ? FOOD_SECTION_PATH[route.section] : `diet:${route.page}`;
  return (
    <>
      {route.kind === 'food' && (
        <div className="wrap">
          <Sections aria-label="Sekcje zakładki Jedzenie" items={SECTIONS.food} current={FOOD_SECTION_PATH[route.section]} />
        </div>
      )}
      <Suspense fallback={<div className="empty">{pick(LOADING, daySeed())}</div>}>
        <Page key={path} />
      </Suspense>
    </>
  );
}
