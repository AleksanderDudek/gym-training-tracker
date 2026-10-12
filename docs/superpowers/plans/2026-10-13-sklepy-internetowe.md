# Online shops, their recipes and baskets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Executed inline in the planning session (the user is away and asked for an autonomous finish).

**Goal:** Products of nine Polish online shops in the product base (with links to the shops),
protein recipes made with them, and recipes resolved and grouped by the fewest shops to buy them.

**Architecture:** Spec: `docs/superpowers/specs/2026-10-13-sklepy-internetowe-design.md`. Shop data
is static JSON merged into the OFF dataset at load time (`src/food/online/*`, `src/food/data.ts`),
so every product feature sees it. The recipe resolver generalises from one store to a basket of up
to two shops; the Przepisy page gains a grouped layout.

**Tech Stack:** React 19, TypeScript 6, Vite 8 (`import.meta.glob`), Vitest 5, jsdom.

## Conventions

As in `docs/superpowers/plans/2026-10-12-gotowce-zestawy-lokale.md`: branch
`feat/sklepy-internetowe`, Polish commits with conventional prefixes and the Co-Authored-By line,
no prettier on existing component files, `fd-` CSS prefixes per area, gates before each commit
(`npm run typecheck`, `npm test`), lint/build before merge, local merge without push.

## Tasks

### Task 1: Data model, registry, merge, loading
- [ ] `lib/types.ts`: `OnlineOffer`, `Product.online?`.
- [ ] `online/shops.ts`: registry of the shops with data; `isOnlineShop(key)`.
- [ ] `online/types.ts` (file schema), `online/catalog.ts` (glob), `online/merge.ts` (pure
  `mergeOnline(dataset, shops)`), category → OFF tag map.
- [ ] `data.ts`: import the online chunk with the dataset; merge; a failed chunk is not fatal.
- [ ] Tests: merge (EAN match, new product, two shops, dictionaries, price), data checks per file,
  registry ⇔ files, https URLs.

### Task 2: Showing the shop
- [ ] `ProductCard` line, `ProductDetail` offers block, filter toggle `online`
  („W sklepach internetowych”), `DataFooter` source line. Tests.

### Task 3: Baskets
- [ ] `recipes/baskets.ts`: `basketsFor(recipe, candidates, physical, online)` (minimal, ordered,
  never two physical), `groupByBasket(recipes, basketsOf)` (greedy cover).
- [ ] `resolve.ts`: basket input, staples from the physical shop, `ResolvedItem.shop`,
  `ResolvedRecipe.stores`; physical-only ranking (`storeRanking` skips online keys) and
  `recipeIndex().online`.
- [ ] Tests.

### Task 4: Recipe UI
- [ ] `RecipeCard`: basket line with online links, basket chips; `IngredientLine`: online shop link.
- [ ] `RecipesPage`: store filter over baskets, store chips incl. online shops, `?uklad=sklepy`
  grouped layout. `url.ts` state. Tests.
- [ ] `check-recipes.ts` prints baskets.

### Task 5: Ingredients and recipes from the shops' products
- [ ] After the data lands: ingredient matchers for the shops' products, 8–12 recipes passing
  THE RULE on typical values, coverage checked with `npm run food:check-recipes`.

### Task 6: Docs, gates, review, merge
- [ ] README (Jedzenie: sklepy internetowe, przepisy, układ według sklepów; structure, test counts).
- [ ] Lint, typecheck, tests, build, browser check at 360 px; code review subagent; fixes; merge.
