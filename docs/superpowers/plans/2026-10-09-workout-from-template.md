# Own Workout From an Existing One — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Copy any workout, then remove/replace/add exercises from the library with minimum taps.
**Spec:** `docs/superpowers/specs/2026-10-09-workout-from-template-design.md`.

- [ ] **Task 1 — engine `similar.ts`** (TDD): `workoutGear`, `fitsGear`, `similarTo`; tests in
      `similar.test.ts`. Commit `feat: podobne ćwiczenia i sprzęt treningu z jego ćwiczeń`.
- [ ] **Task 2 — routes**: `workoutNewPath(from?, add?)`, `workoutEditPath(id, add?)`, `add` on
      `workoutEdit`; tests in `routing.test.ts`. Commit `feat: adresy kreatora z ćwiczeniem do dodania`.
- [ ] **Task 3 — builder**: `add` prop, "Zamień" panel with suggestions + picker, flags kept on
      replace, header "Na podstawie", save `gear` + `base`; `Workout.base` type; App passes `add`.
- [ ] **Task 4 — entry points**: card button, preview "Twoja wersja", atlas "Dodaj do treningu".
      Commit `feat: własna wersja treningu — zamiana w miejscu, z karty i z atlasu`.
- [ ] **Task 5 — docs + verification**: README section + file map; typecheck, tests, build,
      browser check, code review; commit.
