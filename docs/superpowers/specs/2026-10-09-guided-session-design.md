# Guided sessions, rests, circuits, trainer workouts and daily weigh-in — design

Date: 2026-10-09 · Status: decided autonomously on request ("pick recommended"), based on the
trainer plans the user shared (plan of 10 Feb 2026 and the May circuit version).

## Requests

1. Workouts based on the two trainer plans (3 series per exercise; the May one as a circuit ×3).
2. Planned breaks inside a session, counted down.
3. The session shows the current exercise to do; the break is counted (predefined).
4. Same for the user's own workouts.
5. Should breaks adjust across sessions? Follow best practice.
6. The app asks for current body weight (daily morning weigh-in).

## What exists (analysis)

- A session is a list of collapsible cards; all sets of an exercise are typed at once. No cursor,
  no "now/next", no rest countdown (rest exists only as text: "przerwa 2–3 min").
- Rest comes from the exercise type (`energy.ts` profiles, ACSM 2009: multi-joint 120 s,
  isolation 75 s, ballistic 45–60 s); pairs use `PAIR_REST = 75`.
- `Timer.tsx` counts down/up per timed set; state is component-local.
- Set count, reps and load come from per-exercise progression (`plan()`), shared by all
  workouts. `judge()` compares logged rows to that global prescription.
- No circuits (`blocks.ts` comment rules them out), no per-workout rest.
- Body weight: one entry per day; nothing asks for it after the first entry; no trend shown;
  no weigh-in reminder.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Set count per workout | **Not overridden.** Sets/reps/load stay with progression | Ballistic and bodyweight exercises progress by adding sets; a fixed count would break `judge()` and silently stall them. Progression already prescribes 3 sets for almost every exercise in the trainer plans |
| Rest | Workout may set `rest` (s) for straight sets; otherwise rest comes from the exercise type as today | Trainer's "2 min between sets" becomes data; default stays evidence-based |
| Circuits | New block kind: consecutive items with `circuit: true`; rounds = most sets among its stations; 20 s station change; workout `roundRest` (default 120 s) | Matches "obwód × 3" without fighting progression; a station with fewer sets just sits out later rounds |
| Guided mode | Default session view: one set at a time, "Zrobione" logs it, rest countdown starts; list view one tap away | Directly requested; list view keeps the old flow |
| Rest adjustment | **Strength rests never shrink automatically.** They grow +30 s (max +60 s) after sessions where reps faded ≥20 % from the first to the last set at the same load, and return to base once a session ends without fade. **Circuit round rest shrinks** 15 s per clean session (floor 60 s) and grows 15 s after a session with fade or "Na maksa" (cap base + 60 s). All derived from history | Strength: progression comes from load and reps; longer rest preserves volume (Schoenfeld 2016, Grgic 2018; ACSM 2009). Circuits: shortening rest at the same work is the standard density progression for conditioning |
| Weigh-in | Card on "Dziś" until today's weight is in (or "Nie dziś"); 7-day average and weekly change shown instead of daily noise; trend line in profile; optional 07:00 push "waga" (off by default) | Daily fluctuations of 1–2 kg are water; the average is what moves. The card asks every morning without nagging; push stays opt-in for existing subscribers |
| Trainer plans | Two built-in library workouts plus four new bodyweight exercises (jump squat, crunch, lying leg raise, V-up). Order adjusted to pass the advisor (explosive first; circuit alternates body parts); pull-ups from "Dodatkowo" added | Public library stays consistent with the advisor; changes are explained in the workout description |

## Engine (pure, tested)

- `blocks.ts`: `Block.kind` gains `'circuit'`; `blocksOf` groups consecutive `circuit` items.
  Tags: pairs "2A/2B", circuit stations "3A…3G".
- `rests.ts` (new):
  - `CIRCUIT_MOVE = 20`, `ROUND_REST = 120`, `REST_STEP = 30`, `ROUND_STEP = 15`, `ROUND_FLOOR = 60`.
  - `baseRest(workout, id)` — `workout.rest ?? restSecs(id)`.
  - `fadeOf(reps[])` — fade between first and last set at the same load (≥ 20 % counts).
  - `restBump(state, id)` — +30 s per most-recent consecutive faded session of this exercise
    (from `prog[id].hist`), max 2 steps.
  - `roundRest(state, workout)` — density progression over this workout's log entries.
  - `restAfter(state, workout, step, next)` — seconds of rest after a given step, plus a reason
    string for the UI ("o 30 s dłużej: ostatnio ostatnia seria wyraźnie słabsza").
- `steps.ts` (new): `sessionSteps(state, workout)` → ordered list of
  `{ ex, set, of, block, tag, round? }`. Straight: A1…An. Pair: A1 B1 A2 B2…, the longer one
  finishes alone. Circuit: round by round, stations with fewer sets skip later rounds.
  `cursorOf(steps, session)` — first step whose set is not yet logged and whose exercise is not
  skipped (derived from `session.res`, so reload-safe).
- `LogEntry.wid?` — workout id, stored from now on (name match as fallback) for circuit history.
- Estimates: `reviewWorkout` and `plannedBurn` use the same rests (workout `rest`, circuits:
  station changes + round rests) so the preview time is honest.
- Advisor: circuit stations must not put the same primary muscle back to back
  (`circuit-repeat` tip); order rules apply between blocks, not inside a circuit.

## Session state

`Session` gains:
- `rest?: { until: number; secs: number; why?: string }` — running break; persisted, so a reload
  or a locked phone keeps the countdown.
- `effortFor?: ExerciseId` — exercise whose effort is still to be asked (after its last set).

Per-set logging appends to `session.res[id].rows` (effort `solid` until asked); the exercise
becomes `done` after its last set and the effort answer. Finishing mid-exercise logs the sets done
so far. The list view reads the same `res`, so switching views never loses anything.

## Guided UI (`components/Guided.tsx`)

- Step 0: readiness + "Przygotowanie stanowiska i rozgrzewka" + "Zaczynam".
- Set screen: tag, name, "Seria 2 z 3" (or "Runda 2 z 3 · stacja 3 z 7"), target
  ("10 powt. · 16 kg"), rep stepper pre-filled with the target, load select for weighted
  exercises, Timer for timed ones, "Zrobione", technique hint collapsed, "Pomiń ćwiczenie".
- Rest screen: big countdown, why-line when adjusted, "+30 s", "Pomiń przerwę", next set preview;
  effort question for the exercise just finished; beep + vibration at zero.
- Screen Wake Lock while guided; AudioContext unlocked on the first tap.
- Top bar progress: "Seria 7 z 21".
- `cfg.view?: 'guided' | 'list'` remembers the choice.

## Builder (own workouts)

- "Przerwa między seriami": Auto / 60 / 90 / 120 / 180 s → `rest`.
- "Obwód": whole workout as a circuit (all items `circuit: true`), "Przerwa między rundami"
  60 / 90 / 120 / 180 s → `roundRest`; pairing buttons hidden in circuit mode.

## Trainer workouts (library)

1. **"3 serie, 2 min przerwy — od trenera"** (gym, full): swing2, squat_jump, bench, goblet,
   chinup, pushup, core; `rest: 120`.
2. **"Obwód × 3 — od trenera"** (gym, full): circuit squat_jump, pushup, crunch, squat_back,
   legraise_floor, lateral, vup; then chinup as straight sets; `roundRest: 120`.

New exercises: `squat_jump` (explosive), `crunch`, `legraise_floor`, `vup` — bodyweight, in
`NO_EQUIPMENT`, with muscles, hints, jokes and animation where a move exists.

Treadmill walk (2 km/h, 2 h) stays a cardio entry — no change needed.

## Weigh-in

- `body.ts`: `avgWeight(state, day, n = 7)`, `weightTrend(state, day)` → `{ today, avg, prevAvg, delta }`.
- `WeighCard` on "Dziś" after the training card: input + "Zapisz" + "Nie dziś"
  (`cfg.weighSkip = day`); after saving shows today, 7-day average and change vs the previous week.
  Copy tells *when* to weigh (rano, po toalecie, przed jedzeniem) and never judges the number.
- Profile `BodyCard`: Trendline of the last 30 weigh-ins, averages line; copy no longer says
  "wystarczy wpisać raz".
- Reminder `waga` at 07:00 (pref `weigh`, default off), skipped for today once weighed;
  `REMINDER_WEIGH` texts follow the reminder tone rules; weight words allowed, body/food judgments not.

## Testing

- `rests.test.ts`: base/override, fade detection, bump steps and cap, never below base,
  circuit density progression (shrink, floor, grow, cap).
- `steps.test.ts`: straight, pair with unequal sets, circuit rounds with a station sitting out,
  cursor after logged rows and skips.
- `blocks`/`structure`/`design` tests: circuit grouping, tags, estimates, advisor rules.
- Session handlers: set logging, done after effort, finishing mid-exercise.
- New exercises/workouts pass the existing catalog, scene, joke and advisor tests.
- `body`: averages and trend; reminders: weigh item, skipped once weighed; quips tone.
- Browser check of the guided flow, rest countdown and weigh-in card.

## Out of scope

- Per-workout fixed reps/loads (trainer's 10/10/10 stays a starting point; progression decides).
- Rising load per set (pyramids).
- Background notifications when a rest ends with the app closed (Wake Lock keeps it open).
