# Guided Session, Rests, Circuits, Trainer Workouts, Weigh-in — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Sessions guide one set at a time with counted, evidence-based rests (adaptive across
sessions), circuits exist as a block type, two trainer workouts join the library, and the app asks
for body weight every morning.

**Architecture:** Pure engine modules (`rests.ts`, `steps.ts`, circuit-aware `blocks.ts`) drive a
new `Guided.tsx` view; session state gains a persisted rest deadline; per-set logging reuses
`session.res`, so list and guided views stay interchangeable. Spec:
`docs/superpowers/specs/2026-10-09-guided-session-design.md`.

**Tech Stack:** React 18 + TS, Vitest, Web APIs (Wake Lock, Web Audio, Vibration).

**Conventions:** Polish comments/UI/commits; gender-neutral copy; no shaming words; engine never
imports React; every task ends green (`npm run typecheck && npm test`) and commits.

**Note on code in this plan:** engine tasks carry full signatures and test cases; UI tasks carry
component contracts. The implementation lands task by task with TDD; the code is in the commits.

---

### Task 1: Circuit blocks

**Files:** `src/types.ts`, `src/engine/blocks.ts`, `src/engine/structure.test.ts`

- [ ] Types: `Workout.items: { ex; pair?: boolean; circuit?: boolean }[]`; `Workout.rest?: number`
      ("przerwa po serii, s — nadpisuje rodzaj ćwiczenia"), `Workout.roundRest?: number`.
- [ ] Tests (append to structure.test.ts):
  - `blocksOf([{ex:a},{ex:b,circuit:true},{ex:c,circuit:true},{ex:d}])` → straight a, circuit [b,c], straight d.
  - Circuit ignores `pair` inside it; a pair after a circuit starts a new block.
  - `tagOf(circuit block, 2)` → "2C".
- [ ] `Block.kind: 'straight' | 'pair' | 'circuit'`; circuit joins while previous block is circuit;
      tag letters `ABCDEFGHIJ`.
- [ ] Commit `feat: obwód jako rodzaj bloku treningu`.

### Task 2: Rests (`src/engine/rests.ts`)

**Exports**
```ts
export const CIRCUIT_MOVE = 20, ROUND_REST = 120, REST_STEP = 30, REST_STEPS_MAX = 2,
  ROUND_STEP = 15, ROUND_FLOOR = 60, ROUND_CAP = 60, FADE = 0.2;
export const restSecs = (id) => profileOf(id).rest;               // rodzaj pracy
export const baseRest = (w: Workout, id) => w.rest ?? restSecs(id);
export function faded(reps: number[]): boolean;                   // (first-last)/first >= FADE, n>=2
export function restBump(state, id): number;                      // 0 | 30 | 60 from prog[id].hist tail
export function roundRestOf(state, w: Workout): { secs: number; why: string | null };
export interface RestPlan { secs: number; why: string | null; kind: 'set' | 'pair' | 'move' | 'round' | 'next' }
export function restBetween(state, w, a: Step, b: Step | null): RestPlan | null;
```
- [ ] Tests (`rests.test.ts`):
  - baseRest: workout override wins; default equals energy profile.
  - faded: [10,10,8] → true; [10,10,9] → false; [10] → false; [8,10] → false.
  - restBump: hist tail 0/1/2/3 faded sessions → 0/30/60/60; a clean session after faded → 0.
  - roundRestOf: no history → 120; 2 clean → 90; floor 60 after many; faded session → +15; cap 180;
    uses `wid` and falls back to workout name.
  - restBetween: same exercise next set → base + bump with why when bumped; pair partner → PAIR_REST;
    circuit station → CIRCUIT_MOVE; circuit round end → roundRest; last step → null;
    next block → base rest of the finished exercise.
- [ ] Commit `feat: przerwy — z rodzaju ćwiczenia, z treningu i dopasowane do historii`.

### Task 3: Steps (`src/engine/steps.ts`)

```ts
export interface Step { ex: ExerciseId; set: number; of: number; block: number; tag: string;
  kind: Block['kind']; round?: number; rounds?: number }
export function sessionSteps(state, w: Workout): Step[];          // sets from plan(state, id)
export function cursorOf(steps: Step[], s: Session): number;       // -1 when all done/skipped
export const loggedSets = (s: Session, id) => s.res[id]?.rows.length ?? 0;
```
- [ ] Tests (`steps.test.ts`): straight A×3 then B×3; pair A×3,B×4 → A1 B1 A2 B2 A3 B3 B4;
      circuit S1×3,S2×3,S3×2 → rounds with S3 missing in round 3, `round/rounds` set;
      cursor after 2 logged sets of A → index 2; skipped exercise jumps; all done → -1.
- [ ] Commit `feat: kolejka serii sesji — pod rząd, para i obwód`.

### Task 4: Honest estimates and advisor for circuits

**Files:** `src/engine/energy.ts` (`setsEnergy(..., restOverride?)`), `src/engine/design.ts`
(`reviewWorkout(state, ids, kind, pairs, opts?: { circuit?: boolean[]; rest?: number; roundRest?: number })`),
`src/engine/burn.ts` (`plannedBurn` uses workout rest and circuit rests), `src/engine/structure.ts`
(`circuitProblems(ids)`: same primary muscle back to back), callers in Workouts.tsx/Plans.tsx.

- [ ] Tests: circuit time = work + moves + round rests; workout rest override changes time;
      `circuitProblems` flags consecutive same-muscle stations.
- [ ] Commit `feat: czas i kalorie z przerwami treningu i obwodu`.

### Task 5: Session state and handlers

**Files:** `src/types.ts` (`Session.rest?`, `Session.effortFor?`, `LogEntry.wid?`, `cfg.view?`),
`src/App.tsx` (`logSet`, `undoSet`, `setEffort`, `startRest`, `extendRest`, `skipRest`, finish
logs partial results with effort `solid`, store `wid`), `src/engine/session.ts` (pure helpers
`addSet(session, id, row, total)`, `finishable`), tests.

- [ ] Tests (`session.test.ts`): addSet appends; last set sets `effortFor`; effort answer marks done;
      undo removes last row and clears done; partial result survives finish path helper.
- [ ] Commit `feat: zapis serii po jednej i przerwa zapisana w sesji`.

### Task 6: Guided view

**Files:** `src/components/Guided.tsx`, `src/coach.ts` (wake lock + beep + vibrate, feature-detected),
`src/components/views.tsx` (view switch), `src/App.tsx` (top bar progress), `src/styles.css`.

- [ ] Contract: props `{ state, workout, planned, onReady, onLogSet, onUndo, onEffort, onSkip,
      onRest(+30|skip), onFinish, onCancel, onSwap, onToast, onView }`.
- [ ] Screens: start (readiness + prep), set, rest (countdown from `session.rest.until`, why,
      next preview, effort for finished exercise), done (finish button).
- [ ] Browser check on 390 px: start → set → rest countdown → next → finish.
- [ ] Commit `feat: prowadzenie sesji — teraz ta seria, potem odliczana przerwa`.

### Task 7: Builder options

**Files:** `src/components/Workouts.tsx`: rest select (Auto/60/90/120/180), circuit toggle +
round rest select; save writes `rest`, `roundRest`, `circuit` flags; preview shows circuit cue.
`src/components/Structure.tsx`: `cueFor` for circuit; `CircuitHead`.

- [ ] Commit `feat: przerwa i obwód we własnym treningu`.

### Task 8: New exercises and trainer workouts

**Files:** `src/data/exercises.ts` (squat_jump, crunch, legraise_floor, vup; NO_EQUIPMENT),
`src/data/muscles.ts`, `src/data/exjokes.ts` (EX_JOKES + WORKOUT_JOKES), `src/data/anim.ts`,
`src/engine/design.ts` (EXPLOSIVE has squat_jump), `src/data/workouts.ts` (two workouts with
`rest`/`roundRest`/`circuit`), `src/data/scenes.ts` (two scenes).

- [ ] All existing catalog/scene/joke/advisor tests pass for the new entries (advisor `['ok']`).
- [ ] Commit `feat: treningi od trenera — 3 serie z 2 min przerwy i obwód × 3`.

### Task 9: Weigh-in

**Files:** `src/engine/body.ts` (`avgWeight`, `weightTrend`), `src/components/Weigh.tsx`
(`WeighCard`), `SessionHome.tsx`, `Cardio.tsx` BodyCard (trend + copy), `types.ts`
(`cfg.weighSkip?`, `ReminderPrefs.weigh?`), `engine/reminders.ts` (`waga` 07:00), `quips.ts`
(`REMINDER_WEIGH`), `Reminders.tsx` (toggle), tests (body, reminders, quips).

- [ ] Commit `feat: ważenie co rano — karta na Dziś, średnia z 7 dni i przypomnienie`.

### Task 10: Docs and verification

- [ ] README: sections for guided session, rests and their adjustment, circuits, trainer workouts,
      weigh-in; file map; test count; exercise count (114).
- [ ] `npm run typecheck && npm test && npm run build`; browser check; code review agent.
