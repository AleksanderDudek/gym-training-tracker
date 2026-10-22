# Accurate step calories and „Co działa u Ciebie” — design

Date: 2026-10-22 · Status: decided autonomously on request ("Think it through. Analyze current
system. Use best practices. Pick recommended. I am away from machine. Plan it out and then finish on
your own").

## Request

1. Is the steps → kcal metric accurate? Should it include the current weight, the average speed and
   the time of walking/running?
2. Beneath the weight chart, a table of how activity, diet and weight relate over time, so the user
   sees what works for and against their goal. It marks trainings, walking, movement snacks and
   everything else the app records — visual feedback on what works best.

## What exists (analysis)

- **Gym engine** (`engine/energy.ts`, `cardioEnergy` `steps`): distance = steps × stride (41.4 % of
  height, 70 cm without height), walking at 100 steps/min, ACSM walking equation. Active kcal =
  0.1 ml O₂/kg/m × distance × the **day's weight** (`weightOn`). Weight: already in. Speed and time:
  for walking the ACSM net cost per metre is constant between ~3 and 6 km/h, so time does not change
  the active kcal (only the total with rest) — that part is right.
- **What is missing or wrong**
  - The device's **measured distance** (`WatchDay.m`, `PhoneDay.m` — Garmin calibrates stride with
    GPS runs, phones too) is ignored; the height estimate is used instead.
  - **Runs** cost about twice as much per km as walking (ACSM: 0.2 vs 0.1 ml/kg/m). Watch runs
    arrive as activities with distance and time (`WatchData.acts`, sport 1) but are dropped (their
    steps are inside the day's steps), so a 5 km run counts as 5 km of walking. Brisk walks
    (> 6 km/h) and hikes are undercounted the same way.
  - **Floors** climbed (watch and phone send them) are ignored; climbing costs extra.
  - **Double counting**: a treadmill session logged by hand is also inside the watch/phone step
    count (the wrist counts it), so it counts twice — once as steps, once as treadmill.
- **Diet**: its own walking formula — `(steps − baseSteps)/1000 × kg × 0.4` — for the goal's
  activity part (`diet/activity.ts`). It sees only the step count, so none of the above reaches it.
  The weekly check-in (`prep/checkin.ts`, `kcalCorrection`) already calibrates the whole model from
  the scale — the most accurate correction there is.
- **Progress page** (`DietProgressPage.tsx`): tiles, weight chart with forecast, 14 days of kcal,
  a week of macros. Nothing links activity to weight.

## Decisions

### 1. Step calories

| Topic | Decision | Why |
| --- | --- | --- |
| Weight | Stays: the day's weight (last weighing up to that day) | Already right; the cost scales with body mass |
| Distance | The device's measured distance for the day when its average stride is plausible (0.3–1.5 m); otherwise steps × stride from height | Measured beats estimated; a broken distance must not blow up kcal |
| Runs, brisk walks, hikes | Watch activities on foot (FIT sport 1 running, 11 walking, 17 hiking) with distance and time become **timed parts** of the day: their own speed (distance/time) through the treadmill equation (walk below 6 km/h, run above 8, blend between) for their own time. The rest of the day's distance is everyday walking | Speed and time matter exactly here: running ≈ 2× walking per km, fast walking more than slow |
| Rest of the day without device distance | Steps minus the parts' steps (run: 160 steps/min; walk: distance/stride) × stride | So a run's steps are not counted again as walking |
| Floors | Floors × 3 m of climb × 1.8 ml O₂/kg/m (the ACSM vertical term) on top | Garmin and Apple count a floor as ~3 m; ascent only, conservative |
| Treadmill logged by hand | On a day whose steps came from the watch or the phone, its distance (and its watch duplicate, if the watch recorded it: same day, duration within 15 % or 5 min) is taken out of the steps; its own entry counts it | Devices count it automatically — the old hint „wpisz jedno albo drugie” cannot work with automatic steps. Typed steps keep the hint |
| One steps entry per day | Unchanged: the parts are inside the day's steps entry (with a breakdown), not new entries | Lists, badges and XP keep their meaning |
| Diet | The bridge gives the diet the day's **steps worth** — steps of everyday walking that burn as much — and the goal's walking formula uses it (the step count stays for display; the worth is shown when it differs by 3 %+) | The diet's formula and its 0.4 coefficient stay calibrated against `targetSteps`; mixing two formulas would bias the difference |
| Activity minutes | Unchanged (steps above 5 000 at 100/min) | Out of scope; minutes are not kcal |
| Explanation | The cardio screen's „Jak liczymy” and the steps entry show distance source, parts and floors | The user asked whether it is accurate — the answer belongs on the screen |

### 2. „Co działa u Ciebie” (progress page, under the weight chart)

| Topic | Decision | Why |
| --- | --- | --- |
| Unit | **Weeks** (Mon–Sun), the last 12, newest first | A day's weight moves 1–2 kg with water; a week is the shortest window where trends mean something |
| Weight change | Least-squares slope of the weigh-ins from Monday to the next Monday (that morning closes Sunday), kg/week; needs 2+ weigh-ins over 3+ days, else „za mało ważeń” | Same method as the check-in; a slope uses every weigh-in, unlike first-vs-last |
| Verdict | Coloured by the goal's direction: losing — down is good; gaining — up is good; keeping — within ±0.2 kg is good. Changes under 0.1 kg are neutral | The user's goal decides what "works" |
| Columns | Week · its 7 days as a strip · weight change · average kcal vs the day goals (and logged days) · average steps (days at the step target) · trainings · movement snacks · cardio (sessions ≥ 10 min incl. watch runs/walks) | Everything the app records, in one row |
| Day strip | 7 cells: background = food (within goal / over / not logged); marks = training (square), steps target (dot), movement snack (triangle), cardio (diamond); every cell has a full text label for screen readers | The visual feedback the user asked for; shapes, not only colours |
| Findings | For each factor (trainings, steps, snacks, cardio, eating vs goal): weeks split into "more" and "less" at the value that balances the groups (2+ weeks each, 4+ weeks with a weight change, the current week excluded); average weight change in each group, the difference toward/against the goal, the strength (correlation r of either sign: below 0.3 weak, below 0.5 moderate, else clear) and the kcal difference between the groups („w tych tygodniach jedzenie było średnio o 180 kcal niższe”) | Plain comparison a user understands; the kcal gap shows the most common confounder — food |
| Honesty | „To skojarzenia z Twoich tygodni, nie dowód”; below 4 weeks: what is needed; small differences (< 0.1 kg/week) say „bez wyraźnej różnicy” | Few, noisy points; claiming causes would mislead |
| Data | New bridge facts per day: trainings, movement snacks, cardio sessions, activity minutes, steps worth; diet history from 12 weeks back | One source of truth: the gym data |
| Layout | Table in the existing horizontal scroller with a sticky week column; 360 px checked | Phones first |

## Decisions made during implementation

| Topic | Decision | Why |
| --- | --- | --- |
| Run steps without device distance | Parts from 7 km/h (the middle of the walk–run blend) take steps at 160/min; slower parts take distance/stride | One rule for jogging and brisk walking |
| Worth without a weighing | The worth is a ratio of two burns at the same weight (75 kg), so it does not wait for a weighing | Walking, running and climbing all scale with body mass the same way |
| Today in the table | Today's food and steps stay out of the week's averages (the day is not over); the day still shows in the grid, its label says „dzień trwa” | At 19:00 half a day pulled the week's food average 600 kcal down in the demo data |
| Weak link | A finding with r below 0.3 (either sign) is „bez wyraźnej różnicy” even when the averages differ by 0.1 kg+ | In the demo data one odd week made „4+ przekąski ruchowe” look harmful with r ≈ 0.2 |
| Food gap in kg | The food difference between the groups is also given in kg a week (gap × 7 / `kcalPerKg`) | „73 kcal a day” means nothing; „0.07 kg a week” can be set against the weight difference |
| Empty week | The next Monday's weigh-in alone does not make a week a row | It only closes the week before |

Checked at 360 px with the demo person (Playwright, `vite preview`): no page overflow, the week
column stays while the numbers scroll. Not done: activity minutes still count steps above 5 000 at
100/min (a run is not counted as vigorous); the gym's UTC day key vs the diet's local date stays a
known limitation.
