# Named plans, moving dates, recipe picker, diary — implementation plan

Spec: `docs/superpowers/specs/2026-10-21-plany-dziennik-design.md`. Branch `feat/plany-dziennik`.

## Task 1 — data layer (prep)

- `types.ts`: `PrepPlan.name?`, `PrepPlan.setAt?`; `NAME_MAX = 60`.
- `dates.ts`: `shiftPlan(plan, start)` moves every date by the offset; `MOVE_BACK = 13`, `MOVE_AHEAD = 90`.
- `store.ts`: `planName(plan)`; precedence by `setAt ?? createdAt` (`bySet`) in `planCovering` /
  `openPlans`; `shownPlan` opens any plan by id, else running, else next, else latest; `nextPlanFrom`;
  pruning keeps named plans; `renamePlan`, `movePlan` (with `clearTicks`), `setInDiary`; `startPlan`
  sets `setAt`.
- `validate.ts`: keep `name` (trimmed, ≤ 60) and `setAt` (string).
- Tests: `dates.test.ts`, `store.test.ts` additions, validate round trip.

## Task 2 — swap picker logic

- `select.ts`: `swapOptions(ctx, choices, role, out)` → ranked list with `avoided` flag;
  `swapCandidate` = first not avoided.
- `generate.ts`: `swapChoices(plan, role, out, input, from)` (options for the UI, with per-serving
  macros, minutes, fit, favourite, shared) and `swapRecipe(..., to?)`.
- Tests in `generate.test.ts`.

## Task 3 — plan screens

- Route `plans` (`#/jedzenie/plany`, „Moje plany”), `FoodRoot` lazy page, `PlansPage.tsx`.
- Plan page: name as heading, „Zmień nazwę” (`RenameSheet`), „Zmień daty” (`DatesSheet`),
  „Ustaw w dzienniku” when hidden, „Moje plany (N)” link; form field „Nazwa planu”.
- „Wymień” opens `SwapSheet`.
- Tests in `Prep.test.tsx` / new `Plans.test.tsx`.

## Task 4 — diary (parallel agent, worktree)

- `WeighCard` at the top; „Ulubione (N)” sheet (`FavoritesSheet`); „Zjedzone” under the actions;
  plan section with the plan name and the „starts later” line; „Kroki i ruch”; links at the bottom
  (with „Moje plany”).
- Update `DiaryPage.test.tsx`.

## Task 5 — verify and finish

- typecheck, lint (baseline 43), full tests, `food:check-prep`, Playwright 360 px look at the diary,
  the plan page, the list and the sheets; README (feature text, file tree, test counts); commit,
  merge into `main` locally, no push.
