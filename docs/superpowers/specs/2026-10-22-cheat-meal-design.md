# Cheat meal planning and a daily goal that follows real activity — design

Date: 2026-10-22 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request (translated from Polish)

1. Planning a cheat meal: a separate button; you type the cheat meal's macros; underneath, the app
   simulates the consequences — whether you stay within today's goal, how much you go over, and
   what it means for the rest of the day's meals.
2. The parts of the app should work together: the diet assumes daily activity (steps). The app
   should check the calories against what really happened. If a planned training did not happen,
   the calories really available must be corrected — also in the simulation.
3. The daily goal should change when a day had more steps or extra trainings that burned more.

## What exists (analysis)

- **Expenditure** (`diet/energy.ts`): `tdee = BMR × activityMultiplier + walking above baseSteps
  at targetSteps + extraWeeklyKcal/7 + kcalCorrection`. The multiplier presets say what they
  assume: 1.2 "no trainings", 1.28 "desk job + 2 trainings a week" (default), 1.375 "1–3 trainings",
  1.55 "3–5 trainings". `dailyKcal` is the goal for a pace, set in the profile.
- **Day goal** (`model.ts dayGoal`): `dailyKcal`, optionally corrected by this week's balance
  (`weeklyAdjustment`: past days' eaten − goal, spread over the days left to Sunday, capped at
  10 % a day). Used by the diary, the Today card, the meal-plan week and the progress page.
- **Activity in the diet today**: steps come from the gym data through the bridge (`stepsOn`); the
  "Kroki i ruch" card shows workout and cardio kcal from the gym engine (`moveOn`) **"only as
  information — the activity multiplier already assumes trainings"**. Nothing adjusts the goal.
- **Gym engine** knows: logged workouts and their active kcal (`workoutBurn`), cardio entries
  (steps, treadmill, bike, dance) and exercise snacks (`dayBurn`), the active training plan's
  calendar (`snapshot().schedule.days`: date, workout, status) and an estimate for a planned
  session (`plannedBurn`).
- **Rest of the day**: `remainingOf(targets, eaten)`, `mealsLeftAt(hour)` (4/3/2/1 meals),
  `suggest(pool, ctx)` ranks foods for what is left ("Co teraz?").
- **Day rows** (Dexie `days`, not indexed beyond `date`) hold optional extras (`choices`,
  `autoSeed`, `note`); import goes through `cleanDay`, the profile through `cleanProfile`.

## Decisions

### A. A goal that follows real activity („Cel dopasowany do ruchu”)

| Topic | Decision | Why |
| --- | --- | --- |
| Principle | The goal already contains the **planned** activity. Only the **difference** between planned and real activity is added or subtracted | The multiplier assumes trainings and steps; adding all burned calories on top would count them twice (the reason the diary refused to do it so far). The difference does not |
| Planned steps | `targetSteps` from the diet profile | That is what `tdee` assumes |
| Steps → kcal | The diet's own walking formula: (steps above `baseSteps`) / 1000 × kg × `kcalPer1000StepsPerKg`, at the weight of that day | Same model as the goal, so a day exactly at the target changes nothing |
| Planned training | With an **active training plan**: the session scheduled that day (gym plan calendar), at the gym engine's estimate for it (`plannedBurn`). Without a plan: the profile's assumption spread evenly — sessions a week from the multiplier preset (0 / 2 / 2 / 4) × a typical session (mean of the last 10 logged workouts, else 250 kcal) / 7 | The plan is the user's real plan ("we assumed a plan, but no training happened that day"); without one the profile's assumption is the only plan there is |
| Real training | Logged workouts (gym engine kcal) + other exercise: cardio other than steps (treadmill, bike, dance) and exercise snacks | Steps already count through the step formula; the rest is extra work |
| Today vs a closed day | **Closed days** (before today): the full difference. **Today**: what already happened counts at once — steps above the target, trainings done (their real kcal minus the planned estimate), extra cardio. What may still be missing — steps short of the target, a planned training not done yet — is shown as "may still drop by…" and counts only once the day is over, or in the simulation when the user says so | Steps accumulate during the day and a training is often in the evening; subtracting them at 8 a.m. would make the morning goal absurd |
| Future days | No change | Nothing happened yet |
| Sanity cap | The difference is clamped to −30 % … +60 % of `dailyKcal` | A typo (50 000 steps) must not double the goal; a marathon day still fits |
| Weekly balance | Closed days are judged against their own adjusted goal | A lazy Monday eaten to plan is a surplus; an active one eaten to plan is not |
| Switch | `Profile.adaptActivity` (absent = **on**), next to "correct by this week" in the diet profile | The user asked for it; the switch keeps the old behaviour available |
| Where | Diary balance (a "Ruch" line with the breakdown), the "Kroki i ruch" card (text replaced: what was planned, what happened, what it does to the goal), the Today card, the meal-plan week and the progress page — one `dayGoal` | One goal everywhere |
| Bridge | `moveOn(day)` gains: `otherKcal` (cardio without steps + exercise snacks), `planned` (`{ name, kcal } \| null` — session in the active plan that day), `planActive`, `typicalWorkoutKcal` | Everything comes from the gym data; the diet stays pure |

### B. Cheat meal

| Topic | Decision | Why |
| --- | --- | --- |
| Entry point | A third button in the diary's balance card: **„Cheat meal”** | Next to „Dodaj zjedzone” and „Ulubione”, where the day's decisions are |
| Input | Name (optional, placeholder "Pizza ze znajomymi"), kcal (required), protein, carbs, fat (optional — unknown is not zero) | Often only the calories are known |
| Simulation (live, under the fields) | Today's goal **after activity** (with the user's assumptions for the rest of the day) − eaten so far − the cheat meal → what is left for the remaining meals (`mealsLeftAt(hour)` − 1, the cheat meal being one of them), per meal kcal and protein; or how much over the goal and by what share. Protein, carbs and fat left; carbs and fat over the profile's limits flagged (keto, low-carb) | "Will I fit, how much over, what does it mean for the other meals" |
| Rest-of-day food | Up to 3 suggestions for the remaining budget (the existing `suggest`), and — when the day has a plan (meal prep or a workbook plan) — how much of the remaining plan fits: "zmniejsz pozostałe porcje z planu do ok. 60 %" or "pomiń jeden posiłek" | Concrete, not just numbers |
| Activity assumptions (today only) | Steps until evening: **to the target** (default when below it) / as now / own number. Planned training not done yet: **will happen** (default) / **won't happen today**. No training planned: none (default) / an extra one (typical kcal) | "If there was no training, correct the available calories — in the simulation too" |
| Beyond today | Over the goal: with the weekly correction on — how the surplus spreads over the days left this week (the real `weeklyAdjustment`, capped at 10 %); on Sunday it does not carry over. Off — it stays in the balance. Always: ≈ kg in the forecast (surplus / `kcalPerKg`), and what would offset it: ≈ N extra steps or one more training | The question behind a cheat meal is "how bad is it" |
| Save | **„Zaplanuj”** stores the cheat meal on that day (`DayRow.cheat`); **„Zjedzone teraz”** logs it straight into „Zjedzone” | Planning a Saturday pizza on Wednesday, or logging one tonight |
| Planned cheat meal in the diary | A card under the balance: its numbers and the consequence line, „Zjedzone” (logs it and clears the plan), „Zmień”, „Usuń”. „Co teraz?” and the remaining kcal **reserve** it: left = goal − eaten − cheat meal, one meal fewer | The rest of the day is planned around it |
| Other days | The diary's day switcher decides the day; a future day uses that day's goal, no activity | Same sheet for today and for Saturday |

## Out of scope / known limitations

- Activity days follow the gym's day key (UTC) while the diet uses local dates — the existing,
  documented limitation between 00:00 and 02:00 Polish time.
- Without a weighing the gym engine gives no training kcal; then only steps adjust the goal.
- The cheat meal is one per day.

## Decisions made during implementation

| Topic | Decision | Why |
| --- | --- | --- |
| No training plan, no logged trainings | The profile's weekly assumption applies only to someone who logs trainings in the app (a typical training exists in the last 90 days). Otherwise no training difference at all | Found by an existing test: a diet-only user would lose ~70 kcal on every closed day "without training" — a missing log is not a missing training |
| Planned session without an estimate | 250 kcal (about an hour of strength training) | `plannedBurn` needs a weighing; without one the plan still says a session is due |
| Rounding | Activity differences round to 10 kcal, like the weekly correction | Steadier numbers; ±5 kcal is noise |
| Leftover of the weekly spread | Reported only from 50 kcal | Smaller leftovers come from rounding, not the 10 % cap, and the sentence names the cap |
| "Offset with trainings" | Offered only to someone who logs trainings | A "typical training" of a person who never logged one is invented |
| Cards drawn outside the app's bridge | The activity hook returns no activity (goal as before) | The Today card can be rendered without the provider (tests) and must not crash |
| Steps "as now" with nothing logged | The option says „0 — nic jeszcze nie wpisane” | "0" alone reads like a measurement |
| Cheat meal and the balance bars | The bars keep showing what is eaten; the planned cheat meal has its own card and is reserved in „Co teraz?” | A plan is not an entry — the bars stay the truth of the day |
