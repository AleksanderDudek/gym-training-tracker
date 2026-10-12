# Gotowce, own sets and restaurant chains — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Executed inline in the planning session (the user is away and asked for an autonomous finish).

**Goal:** No-dishes ready sets („gotowce”) in the recipe catalog, the user's own saved sets
(„Moje zestawy”) logged in one tap, and official nutrition of restaurant chains in Poland
browsable under Produkty and searchable in „Dodaj zjedzone”.

**Architecture:** Spec: `docs/superpowers/specs/2026-10-12-gotowce-zestawy-lokale-design.md`
(decisions are not repeated here). Gotowce are recipes of a new kind with their own rule, resolved
by the existing per-shop machinery. Sets are a new Dexie table of snapshots turned into `Food`s.
Restaurants are static JSON per chain behind a lazily imported catalog module, turned into `Food`s
for the picker and shown on two new drill-down routes.

**Tech Stack:** React 19, TypeScript 6, Vite 8 (`import.meta.glob`), Vitest 5 + jsdom +
Testing Library + fake-indexeddb, Dexie 4, lucide-react.

## Conventions

- Branch `feat/gotowce-zestawy-lokale`. Commits in Polish with conventional prefixes, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Merge locally into `main`, no push.
- Code style of `src/food`: semicolons, single quotes, 2 spaces, ~120 columns; Polish comments in
  components, English in pure modules (as the ported code has them); no import suffixes.
- CSS class prefixes per area: `fd-rest-` (restaurants), `fd-diet-` (set builder, own sets),
  `fd-rec-` (recipes). `src/food/css.test.ts` enforces uniqueness.
- Gates before each commit: `npm run typecheck`, `npm test`; before merge also `npm run lint` and
  `npm run build`.

## File map

| Path | Responsibility |
| --- | --- |
| `src/food/recipes/catalog.ts` | `RecipeKind` + `gotowiec`, `RecipeItem.pack`, 10 gotowce, `passesRule`, `GOTOWIEC_MIN_PROTEIN` |
| `src/food/recipes/ingredients.ts` | `banana`, `apple`, `grahamRoll`, `riceCakes`, `crispbread`, `proteinBar`, `proteinDrink` |
| `src/food/recipes/ready.ts` | export the bar / drink claims so ingredients reuse them |
| `src/food/recipes/resolve.ts` | pack amounts (`ResolvedItem.grams`), rule per kind |
| `src/food/diet/foods.ts` | `packGrams`, sources `set` and `restaurant`, `FoodSet`, `setFood`, `setParts` helpers |
| `src/food/diet/db.ts` | version 2 with `sets` |
| `src/food/diet/store.ts`, `validate.ts`, `src/food/backup.ts` | sets in backup / restore / clear / emptiness |
| `src/food/diet/search.ts` | pure picker search: pool, restaurants, products |
| `src/food/restaurants/types.ts` | `Chain`, `MenuItem`, categories and labels |
| `src/food/restaurants/data/*.json` | one chain per file (official data) |
| `src/food/restaurants/catalog.ts` | glob-loads and normalizes the chains (ids, per-100 g) |
| `src/food/restaurants/food.ts` | `restaurantFood(chain, item)` |
| `src/food/restaurants/url.ts` | page state ↔ query (`q`, `kat`, `sort`, `p`) |
| `src/food/restaurants/sort.ts` | sorts and „Najwięcej białka” picks |
| `src/food/hooks/useRestaurants.ts` | lazy import of the catalog |
| `src/food/components/restaurants/*` | Lokale page, chain page, item sheet, CSS |
| `src/food/components/diet/FoodPicker.tsx`, `SetBuilder.tsx` | „Zestaw” mode |
| `src/food/components/diet/DataSection.tsx` | Moje zestawy |
| `src/food/components/products/ProductsPage.tsx` | entry card to Lokale |
| `src/routing.ts`, `src/types.ts`, `src/App.tsx`, `src/food/FoodRoot.tsx` | `#/lokale`, `#/lokale/<id>` |

## Tasks

### Task 1: Gotowce in the recipe catalog

- [ ] Tests first (`catalog.test.ts`, `resolve.test.ts`): every gotowiec has kind `gotowiec`,
  tool `Bez naczyń`, 1 minute, ≥ 15 g protein on typical values (pack items at catalog grams);
  protein recipes still pass THE RULE; `passesRule` per kind; a pack item resolved with a 45 g bar
  uses 45 g, with an unreadable quantity the catalog grams; matchers: bar/drink accept the ready
  product claims and refuse a cheese/candy bar; rice cakes and crispbread bounds.
- [ ] `ready.ts`: export `isProteinBar(p, name)` and `isProteinDrink(p, name)` (current claims +
  plausibility) and use them in `GROUPS`.
- [ ] `ingredients.ts`: the seven ingredients; typical values: banana 89/1.1/22.8/0.3,
  apple 52/0.3/13.8/0.2 (USDA FDC SR Legacy), the rest from the dataset medians of their matches
  (script output recorded in the commit message).
- [ ] `catalog.ts`: `pack?: true` on `RecipeItem`, kind label `Gotowiec`, the 10 gotowce,
  `GOTOWIEC_MIN_PROTEIN = 15`, `passesRule(recipe, serving)`.
- [ ] `resolve.ts`: `ResolvedItem.grams` (pack: `packGrams(product.quantity) ?? item.grams`),
  `passes: passesRule(...)`.
- [ ] UI: `MacroSummary` takes the recipe kind and states the gotowiec rule („Białko 21 g –
  co najmniej 15 g w zestawie”; broken: „Za mało białka: … – gotowiec ma mieć co najmniej 15 g.”);
  `SwapSheet` and `IngredientLine` show `resolved.grams`; Przepisy lead names both rules.
- [ ] `scripts/food/check-recipes.ts` keeps working (rule via `passesRule`).
- [ ] Commit `feat: gotowce bez naczyń w przepisach`.

### Task 2: Restaurant data module

- [ ] Copy validated chain files from the research output into `src/food/restaurants/data/`.
- [ ] `types.ts`: `RestaurantCategory` (13 keys), `CATEGORY_LABELS`, `ChainKind` + labels,
  `MenuItem`, `ChainData` (file shape) and `Chain` (normalized: `items` with `id`, `per100`).
- [ ] `catalog.ts`: `import.meta.glob('./data/*.json', { eager: true, import: 'default' })`,
  `normalizeChain`, `CHAINS` sorted by name, `itemSlug(name, portion)`.
- [ ] `catalog.test.ts`: schema, categories, unique ids, Atwater ±15 % / ±25 kcal under 170 kcal
  unless named in `source.note`, sugars ≤ carbs, saturated ≤ fat, ISO `checked`, https source.
- [ ] `food.ts` + test: key `restaurant:<chain>:<id>`, detail, amount label „1 szt. · 217 g”,
  nutrients, role (`main` ≥ 350 kcal, drinks/sauces `light`, sauces `addon` when fat-heavy).
- [ ] `search.ts` (restaurants part) + test: tokens over folded „chain + item”.
- [ ] `url.ts` + test, `sort.ts` + test (`menu`, `protein`, `kcal`, `density`; `topProtein`).
- [ ] `hooks/useRestaurants.ts` (dynamic import, retry).
- [ ] Commit `feat: dane sieci gastronomicznych z oficjalnych tabel`.

### Task 3: Lokale routes and pages

- [ ] `types.ts`: `Route` + `{ kind: 'restaurants'; chain: string | null }`; routing: `RESTAURANTS_PATH = '#/lokale'`,
  `restaurantPath(id)`, parse, `screenOf` (Lokale → parent `#/produkty`; chain → its name is not
  known to routing, title „Lokal”, parent `#/lokale`), `activeTab` → food, `isFoodRoute(route)`;
  tests in `routing.test.ts`.
- [ ] `App.tsx`: `isFoodRoute` in the three places; page key `restaurants:<chain>`.
- [ ] `FoodRoot.tsx`: lazy `RestaurantsPage` and `ChainPage`.
- [ ] Components: `RestaurantsPage` (lead, search, chain list), `ChainPage` (source line,
  „Najwięcej białka”, category chips, sort, item rows with diet verdict), `MenuItemSheet`
  (nutrition per portion and per 100 g, „Dodaj do dziennika”), `restaurants.css` (`fd-rest-`).
- [ ] Produkty entry card.
- [ ] Component tests (jsdom).
- [ ] Commit `feat: Lokale — menu sieci gastronomicznych z makro i dodawaniem do dziennika`.

### Task 4: Own sets

- [ ] `db.ts` version 2 (`sets: '++id'`), test that a v1 database opens with its data.
- [ ] `foods.ts`: `SetPart`, `FoodSet`, `setFood`, `partOf(food)`, `setAmountLabel`; sources.
- [ ] `validate.ts`: `cleanSet`, entry sources `set`/`restaurant`; `store.ts`: export/restore/clear
  with sets, `logSet`; `backup.ts`: sets count in `hasFoodData` and `dietBackup`.
- [ ] `useDiet.ts`: `useSets`; `pool.ts`: sets in the pool; `suggest.ts`: availability for sets.
- [ ] `diet/search.ts`: `searchFoods({ query, pool, restaurants, products, dict })` used by the
  picker and the builder (own → restaurants ≤ 12 → products, ≤ 30).
- [ ] `SetBuilder` + „Zestaw” mode in `FoodPicker`; „Moje zestawy” in `DataSection`.
- [ ] Tests: pure + picker component test + data section test.
- [ ] Commit `feat: własne zestawy — „Banan + batonik” jednym stuknięciem`.

### Task 5: Docs, gates, merge

- [ ] README „Jedzenie”: gotowce, zestawy, Lokale with sources and the data note; test count.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; look at the pages in
  the browser (preview) at 360 px.
- [ ] Code review by a subagent; fix findings.
- [ ] Merge into `main` locally (`--no-ff`), no push.
