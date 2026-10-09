# Own workout from an existing one — design

Date: 2026-10-09 · Status: decided autonomously on request ("pick recommended").

## Request

Create my training from an existing one: remove exercises and add my own choices from the library.

## What exists

- Preview of a built-in workout has "Skopiuj i zmień pod siebie" → builder with a copy
  ("… — moja wersja"); own workouts have "Edytuj". Builder can remove (×), add (searchable
  picker over all 114 exercises), reorder (↑↓), pair (↔), set sets, rest and circuit.
- Gaps found:
  1. The workout card in the library has only "Zacznij" and "Podgląd" — the copy action is one
     screen deeper and easy to miss.
  2. Replacing one exercise means remove + add at the end + move it back up with arrows; pair and
     circuit flags are lost on the way. Swap suggestions exist only for machine stations.
  3. The exercise atlas has no way to put the exercise into a workout.
  4. Saved copies have no equipment tag (`gear`) and no link to the workout they came from, so the
     setup card falls back to defaults and the user cannot tell what the copy was based on.

## Decisions (template → tweak, the usual pattern)

| Topic | Decision |
| --- | --- |
| Entry point | Workout card gets "Zmień pod siebie" (built-in) / "Edytuj" (own) next to "Zacznij" |
| Replace | Builder item gets "Zamień": suggestions of similar exercises (same movement group, shared primary muscles, equipment that fits the workout, not already in it) plus the full picker; replacement keeps position, pair and circuit flags |
| From the atlas | Exercise page gets "Dodaj do treningu": pick one of own workouts or a new one → builder opens with the exercise already appended; nothing is saved until "Zapisz trening" |
| Copy metadata | Saved workout stores `base` (source id) and `gear` derived from its exercises (none / kb / gym); preview of an own copy says "Twoja wersja: …" with a link |
| Original | Built-in workouts never change; plans keep using the original |

## Engine

- `src/engine/similar.ts`:
  - `workoutGear(ids)` — `none` if every exercise needs no equipment, `kb` if only kettlebell and
    bodyweight, otherwise `gym`.
  - `fitsGear(id, gear)` — can this exercise be done with that equipment set.
  - `similarTo(id, { exclude, gear, limit = 6 })` — candidates ranked by: station alternatives,
    same movement group, shared primary muscles, shared secondary muscles; equipment must fit;
    excluded ids and the exercise itself never appear.
- `routing.ts`: `workoutNewPath(from?, add?)` → `#/treningi/nowy/<from|->/<add>`,
  `workoutEditPath(id, add?)` → `#/treningi/<id>/edytuj/<add>`; route `workoutEdit` gains `add`.

## UI

- `WorkoutCard`: third button.
- `WorkoutBuilder`: `add` prop appends once; "Zamień" panel per item; header line
  "Na podstawie: X — oryginał zostaje bez zmian"; save writes `gear` and `base`.
- `WorkoutPreview`: "Twoja wersja: X" for own workouts with `base`.
- `ExercisePage`: "Dodaj do treningu" card.

## Testing

- `similar.test.ts`: gear derivation, fit rules, suggestions (squat family for a squat, no barbell
  in a kettlebell workout, no duplicates/excluded, station alternatives first).
- `routing.test.ts`: new paths round-trip, old paths still parse.
- Browser check: copy from card → replace → save → preview shows base; atlas → add → builder.
