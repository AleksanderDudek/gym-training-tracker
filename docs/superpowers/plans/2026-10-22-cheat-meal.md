# Cheat meal and activity-adjusted goal — implementation plan

Spec: `docs/superpowers/specs/2026-10-22-cheat-meal-design.md`. Branch: `feat/cheat-meal`.

1. **Bridge** (`src/food/bridge.ts`, `App.tsx`, test stub): `moveOn` adds `otherKcal`, `planned`,
   `planActive`, `typicalWorkoutKcal`; the plan snapshot computed once per state.
2. **`diet/activity.ts`** (+ tests): `walkingKcal`, `assumedSessions`, `activityOn(profile, kg, move,
   steps, phase, assumptions?)` → `{ kcal, pending, steps, training, other, lines }` with the clamp.
3. **`dayGoal`** (+ tests): optional `activityKcal(date)`; weekly balance against adjusted closed
   days; returns the activity part. `weeklyAdjustment` takes per-day goals.
4. **Types and validation**: `Profile.adaptActivity?`, `DayRow.cheat?` (+ `cleanProfile`, `cleanDay`
   tests); `store.ts` `setCheat`, `clearCheat`, `eatCheat`.
5. **`diet/cheat.ts`** (+ tests): `simulateCheat(...)` — budget, per meal, macros, plan share,
   weekly spread, kg, offsets.
6. **Hook** `useDayActivity` / helper used by diary, Today card, plan and progress pages.
7. **UI**: `CheatMealSheet` (fields, assumptions, simulation, Zaplanuj / Zjedzone teraz),
   `CheatCard` in the diary, "Ruch" line in `MacroBars`, „Kroki i ruch” text, profile switch,
   reserved cheat meal in „Co teraz?”. CSS `fd-diet-`.
8. **Tests**: component tests for the sheet, the card, the profile switch; full suite, typecheck,
   lint, build; 360 px check with Playwright.
9. **Docs**: README (Jedzenie: cheat meal, cel dopasowany do ruchu), spec decisions from the build.
