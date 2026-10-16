# Polish classics as protein recipes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Executed inline in the planning session (the user is away and asked for an autonomous finish).

**Goal:** 16 Polish classics reworked into protein recipes that pass THE RULE. Each can be bought
in one physical store, or in a physical store plus an online shop. Each credits the Wikibooks page
it came from.

**Architecture:** Spec: `docs/superpowers/specs/2026-10-16-przepisy-klasyki-design.md`.
- New ingredients go in `src/food/recipes/ingredients.ts`.
- A `CLASSICS` group with `inspiredBy` goes in `src/food/recipes/catalog.ts`.
- `RecipeCard` gets a source line.

**Tech Stack:** TypeScript, React 19, Vitest 5.

## Tasks

- [x] Analysis:
  - the przepisy-open set (format, licence, attribution);
  - the catalog, THE RULE, ingredient roles and baskets;
  - which classics can pass THE RULE on typical values.
- [x] Ingredients:
  - turkey fillet, sauerkraut, brined cucumbers, white and Peking cabbage, carrot, potato,
    avocado, wheat flour, herring fillets and gelatin;
  - matchers checked against the product base (candidates per store).
- [x] `Recipe.inspiredBy` and the `CLASSICS` group (16 recipes): own descriptions, steps and
  measures; THE RULE checked on typical values.
- [x] Herring changed from `store` to `staple` after `food:check-recipes` showed its only basket
  was Selgros.
- [x] `RecipeCard`:
  - a source line with the Wikibooks link and the licence link (new tab, screen-reader note);
  - the `fd-rec-source` style.
- [x] Tests:
  - the Wikibooks addresses;
  - the matchers (in and out), turkey fillet without a matcher;
  - the card's source line;
  - the CSP navigation hosts.
- [x] README: the classics paragraph and the test count.
- [x] Gates:
  - `npm run typecheck`;
  - `npm run lint` (43 warnings, as before);
  - `npm test`;
  - `npm run build`;
  - `npm run food:check-recipes`.
- [x] Code review (subagent) and its fixes:
  - matcher tests whose rejected products fit the macro bounds, so the name exclusion is tested;
  - a quark pack is 200 g, an egg 50 g, passata in grams;
  - more flour in leniwe;
  - the potrawka sauce is heated, not boiled;
  - `lang="en"` on an English source title;
  - sauerkraut in either word order.
- [x] Commit, local merge into `main` (no push).
