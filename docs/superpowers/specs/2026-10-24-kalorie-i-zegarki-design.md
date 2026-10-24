# Kalorie i zegarki — final spec

Repo `/Users/pl2mac0030/kb`, branch `feat/kalorie-i-zegarki` (= `main` 75f742b). Paths are relative to the repo. Status: decided without the owner, as delegated. The owner wrote: „Chcę też, żeby ludzie mieli możliwość zweryfikowania, czy ich model zegarka jest obsługiwany. Znowu chcę mieć jak najlepsze doświadczenie użytkownika. Dalej nie przekonuje mnie przelicznik kalorii i temat liczenia kalorii w aplikacji.”

**Base:** the "simple" calorie design (8 / 7.5 / 7.5), with every non-contradicting graft from "evidence" and "migration", the weaknesses all three judges named fixed, and the watch-check design with the critique applied.

A copy of this file: `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/final/final-spec.md`

Evidence produced for this spec (scratch, not repo code):
- `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/final/sim-final.mjs` and `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/final/sim-final.out.txt`: the exact Monday rule below against the variants the judges proposed (600 runs × 9 scenarios, start-of-diet water drop, AR(1) scale noise, partial days, under-logging).
- `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/final/numbers-final.mjs`: every number used in the examples and tests.
- Watch prototypes and drafts from the watch design: `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/proto/` (`find.ts`, `gen.ts`, `extra.ts`, `garmin.json`, `find.cases.ts`) and `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/watch-check/` (`WatchCheck.text.tsx`, `WatchCheck.words.ts`, `other-catalogs.draft.tsx`, `description-en.txt`).

---

## 0. The decisions in one screen

1. **One calorie target per day, the same all week.** It never moves during the day, never changes after midnight, and every past day keeps the target it had (goal history in the profile row).
2. **Activity never changes food.** Steps, workouts, cardio and the watch stay in the gym part as information. The usual week is part of the starting estimate; real activity reaches the target through the scale. Diet users no longer see kcal on the Today screen's training and cardio cards.
3. **Starting estimate: NASEM 2023 with four plain activity levels, default „Głównie siedzę” (inactive).** Steps are only a hint, never a preselection. The default man gets **2100 kcal** at −0,5 kg/tydz.
4. **A calm Monday check for everyone.**
   - It uses a 28-day window and an honest (autocorrelation-aware) standard error.
   - It waits 14 days after a start, a large change or a break.
   - A day counts when 60 % of its target is logged, and the user can override that per day.
   - It either leaves the target alone or moves it by **exactly 100 kcal**.
   - After any change it does not turn back for 4 weeks unless the gap reaches 200.
   - It never cuts while you lose faster than planned, and never raises while you lose slower.
5. **Raises and weight-driven moves apply automatically with a one-tap „Zostaw”; cuts from a lower burn are asked first** („Czy zapisujesz prawie wszystko, co jesz?”). „Zostaw” is respected: the pace becomes what the kept target implies, and nothing comes back in that direction for 4 weeks.
6. **One ±100 kcal band judges every day on every screen.** Inside it the day is „w zakresie celu”. „Ponad cel” appears only above +100, always with „jeden dzień nie zmienia trendu”. A planned bigger meal is set aside in every „Zostało”.
7. **Fewer numbers, calm words.** The Today card says one sentence („Zostało ok. 650 kcal i 54 g białka”) over two bars. No verdict colours, no pay-back, no „cheat”: it is now „Większy posiłek”.
8. **Safety rails:**
   - hard minimum 1500 M / 1200 K;
   - floor max(BMR, hard minimum), below it only with „Ten cel jest ustalony z lekarzem albo dietetykiem”;
   - pace ≤ 1 % of body weight a week (gain ≤ 0,5 %);
   - no deficit under 18, at BMI < 18,5 or in pregnancy/breastfeeding;
   - „Bez liczenia kalorii” (forced under 18; never cuts silently);
   - „Przerwa” = maintenance.
9. **Existing users keep their target to the kcal.** The owner keeps 1860 (if that is his number), his intended pace, his history and every old field in the stored row, and gets a one-time notice. The first Monday check runs at least 7 days after the upgrade.
10. **Watch check: „Czy mój zegarek jest obsługiwany?”**
    - It is the first view of the Garmin card and lives at `#/zegarek`.
    - It knows 485 names and answers „Obsługiwany” / „Obsługiwany, bez części danych” / „Nieobsługiwany” / „To nie Garmin”, each ending in one next step.
    - **The store link is fixed first, in its own commit. The live link is a 404 for everyone today.**

**Owner actions (outside the round):**
1. Today, independent of this work: `gh workflow run Deploy`.
   - The repo variable `GARMIN_APP_URL` is already the production page, so a rebuild alone fixes the 404.
   - After the round: push `main` and deploy again. The code default from C0 then makes the variable unnecessary; `gh variable delete GARMIN_APP_URL` is optional.
2. Before linking `#/zegarek` from the store listing:
   - check background sync on one real Garmin, ideally a 32 kB model (Forerunner 55, Instinct 2 or fēnix 6);
   - tick „Przebieg w tle na zegarku” in `garmin/README.md`;
   - check the Polish Garmin Connect menu path „Ustawienia → Połączone aplikacje”.
3. Paste `garmin/store/description-en.txt` and the Polish `listing.md` text into apps-developer.garmin.com by hand (this may trigger a review).

---

## 1. Principles

1. **One number answers the daily question.** „Zostało ok. 650 kcal i 54 g białka” — nothing else to add up.
2. **Stable beats clever.** The target changes at most once a week, by a fixed 100 kcal, at a predictable moment, always with a reason and an undo.
3. **The scale is the referee, not the watch.** Per-person activity estimates err by 20–90 %. Weight trend plus logged food measures what really happens, activity included.
4. **Protein is a minimum to reach, calories a ceiling to notice.** Neither is ever coloured as a failure; ±100 kcal is still on target.
5. **No compensation mechanics.** A big day is not paid back, a quiet day is not earned back, and food is never priced in steps.
6. **Honest precision.** Targets are in 50s, „left/over” is rounded to 10 with „ok.”, forecasts are month ranges, and uncertainty is shown only where it helps (details, ±).
7. **Nobody's number changes behind their back.** Past days are frozen, changes are announced, cuts from a lower burn are asked, and no-numbers mode never cuts.
8. **Respect what the person knows:** partial-day override, „Zostaw”, „Nie zawsze”, doctor-agreed targets, pregnancy switch.
9. **Fewer settings, safer defaults.** Every remaining switch protects the user.
10. **Every answer ends in a next step.** In the watch check: connect, use the phone, or type steps.

---

## 2. The calorie model

### 2.1 Starting estimate („spalanie”)

`eer(p, kg) = c − a·max(age, 19) + h·heightCm + w·kg`. Source: NASEM 2023, *Dietary Reference Intakes for Energy*, doi 10.17226/26818. Two judges cross-checked all 24 coefficients.

| sex | `activityLevel` | c | a | h | w |
|---|---|---|---|---|---|
| M | `inactive` | 753.07 | 10.83 | 6.50 | 14.10 |
| M | `low` | 581.47 | 10.83 | 8.30 | 14.94 |
| M | `active` | 1004.82 | 10.83 | 6.52 | 15.91 |
| M | `very` | −517.88 | 10.83 | 15.61 | 19.11 |
| K | `inactive` | 584.90 | 7.01 | 5.72 | 11.71 |
| K | `low` | 575.77 | 7.01 | 6.60 | 12.14 |
| K | `active` | 710.25 | 7.01 | 6.54 | 12.34 |
| K | `very` | 511.83 | 7.01 | 9.07 | 12.56 |

- `burnOf(p, kg) = eer(p, kg) + p.burnOffset`.
  - `burnOffset` (±1 500) is what the Monday check has learned.
  - It is 0 for new profiles; the upgrade sets it for existing ones.
- **Weight** is the display trend (§2.6) on that day; before any weigh-in it is `startWeightKg`.
- **Levels follow NASEM 2023 ch. 7.** Low active is about PAL 1.53–1.68, roughly an extra hour of walking a day.
  - Every new profile defaults to `inactive`.
  - **Steps never preselect a level.** The 14-day step average is shown next to the question as a hint; NASEM says step data "may not be optimal" for assigning a category.
  - A stored level always wins.
- Mifflin-St Jeor BMR (`energy.ts bmr`, unchanged) is kept only for the floor and the plausibility check.

### 2.2 The daily target

```
deficit(pace)   = pace × kcalPerKg / 7                 kcalPerKg = 7 500 (hidden profile field)
hardMin(p)      = p.sex === 'M' ? 1500 : 1200
floorOf(p, kg)  = max(ceil50(bmr(p, kg)), hardMin(p))  ceil50: "never below BMR" is literally true
minTargetOf(p, kg) = p.belowFloorOk ? hardMin(p) : floorOf(p, kg)     (doctor/dietitian-agreed targets)
targetFor(p, kg, pace = p.goalPace) = round50(burnOf(p, kg) − deficit(safePace(p, kg, pace)))
                                      then, if safePace > 0: max(that, minTargetOf(p, kg))
maintenanceOf(p, kg) = max(round50(burnOf(p, kg)), hardMin(p))
impliedPace(p, kg, kcal) = (burnOf(p, kg) − kcal) × 7 / kcalPerKg       (kg/week, + = losing)
snap05(x) = round(x × 20) / 20
```

- **A manual target is a pace, too.** Saving one sets `goalPace = clamp(snap05(impliedPace(p, kgNow, kcal)), safePace range)`. The Monday check then fits around it like around any chip, instead of drifting back to an old pace.
- **Pace** (`goalPace`) is in kg/week, positive = losing.
  - Chips: loss 0,25 / 0,5 / 0,75; „utrzymanie”; gain 0,25.
  - A stored pace that matches no chip (a migrated 0,4, a kept implied 0,65) shows as an extra chip „(obecne)”.
- `safePace`:
  - loss ≤ 1 % of the weight a week, gain ≤ 0,5 %;
  - 0 for loss when age < 18, BMI < 18,5 (trend or target weight) or `pregnancy`;
  - 0 for gain under 18 too.
- **Rounding:**
  - chip, setup and maintenance targets round to 50;
  - Monday moves are exactly ±100 with no re-rounding (a migrated 1860 becomes 1760 or 1960);
  - manual targets keep what was typed, rounded to 10.
- **Stored range** is 800–6 000, for compatibility; past history entries are never re-clamped.
  - App-set and new manual targets are never below `hardMin`.
  - Below `floorOf` only with `belowFloorOk` (the doctor/dietitian checkbox).
  - The Monday check never lowers below `minTargetOf`.

| person (−0,5 kg/tydz.) | burn | target | floor |
|---|---|---|---|
| M 35 y, 175 cm, 80 kg, inactive (default) | 2640 | **2100** | 1750 |
| same, „Codziennie ok. godziny ruchu” (low) | 2850 | **2300** | 1750 |
| K 30 y, 165 cm, 65 kg, inactive | 2080 | **1550** | 1400 |
| K 60 y, 155 cm, 58 kg, inactive | 1730 | **1200** (raw 1194, floor) | 1200 |
| M 45 y, 185 cm, 110 kg, inactive | 3019 | **2500** | 2050 |

**The day's target is a lookup, never a calculation.**
- `targetOn(p, date)` is the kcal of the last `goals` entry with `from ≤ date`. Dates before the first entry use the first entry.
- `goals` may hold one future entry: the end of a break.
- `dailyKcal` mirrors `targetOn(p, today)`. The normaliser recomputes it on every read (§3.3) and every store write writes it. `prep/`, `suggest`, „Zjedz teraz” and the backup keep reading it.

**Within a day nothing moves.** Logged food lowers „Zostało”, and that is all. The only same-day changes are the user's: a profile save or a Monday-card answer.

**After midnight** yesterday keeps `targetOn(yesterday)`. Late watch syncs, new weigh-ins or a new check never touch a past day.

### 2.3 Judging a day

- **The band:** `BAND = 100`. `kcalStatus(target, counted)` with `d = counted − target`:
  - `d < −100` → `left` (`round10(−d)`);
  - `|d| ≤ 100` → `within`;
  - `d > 100` → `over` (`round10(d)`).

  It is one helper, used by the Today card, the day card, „Co teraz?”, FoodPicker, „Większy posiłek”, „Zjedz teraz”, the scanner and the 14-day chart. It replaces today's four thresholds (0, 5 %, 50 kcal, 15 %).
- **„Zostało” always comes from `dayNeeds`** (`diet/now.ts`, API unchanged) with `goalKcal = targetOn(p, date)`. It counts eaten food plus a planned bigger meal. This fixes C9 (Today card vs „Co teraz?”).
- **Complete day:** one rule everywhere (calibration, weeks table, 14-day chart). `isComplete(eaten, partial, target)`:
  - `partial === true` → no;
  - `partial === false` → yes if anything is logged;
  - otherwise `eaten ≥ 0.6 × target`.

  A day with no entries is „bez zapisów”, and today never counts. `DayRow.partial` is set by two footer buttons in „Zjedzone” (§4.2).
  - Why 60 % and not 50 %: in simulation, a 50 % threshold with forgotten meals left the target 75 kcal too low; at 60 % the bias is +8 (science judge).

### 2.4 The Monday check

- `weeklyCheck()` is a pure function in `src/food/diet/calibrate.ts`.
- `runWeeklyCheck()` (store) runs it in one Dexie `rw` transaction over `profile`, `entries` and `days` (entries and days read only). It re-reads the row, so two tabs or three components apply it only once.
- `useWeeklyCheck()` triggers it from the Today card, the diary and „Zjedz teraz”.

**When it runs:** on the first app open with `lastCheck.week < mondayOf(today)`, except on a Monday before 04:00 local time (Sunday dinner may still be logged). A missed Monday runs on the first open later that week.

```ts
export const CHECK = {
  window: 28,               // days [M−28, M−1]
  minWeighIns: 5, minSpan: 14,
  minCompleteShare: 0.75,   // of non-paused days in [first weigh-in, last weigh-in)
  completeDay: 0.6,
  settleDays: 14, majorChange: 300,
  confidence: 1.5,          // believe only the part of the error beyond 1.5 honest SE
  residualFloorKg: 0.35, r1Max: 0.6, r1Default: 0.3, r1MinN: 10,
  beliefStep: 150, offsetLimit: 1500,
  deadBand: 100, step: 100,
  holdDays: 28, holdEscape: 200, userCooldown: 14,
  paceGuard: 0.1,           // kg/week
  noisy: 150,               // "scale jumps" note when 1.5·SE ≥ 150 kcal
  plausible: [0.8, 2.5],    // × BMR at the trend weight
  quietMin: { weighIns: 3, completeDays: 7 },  // no Monday text below this (28-day window)
  reachedAskAgainDays: 28, reachedBeyondKg: 1,
} as const;
```

**Honest standard error** (`trend.ts leastSquares`):
- residual SD with n − 2, floored at 0.35 kg;
- lag-1 autocorrelation r₁ of the residuals in date order, clamped to [0, 0.6]; 0.3 when n < 10; 0 when all residuals are 0;
- `SE_b = s / √Sxx × √((1 + r₁)/(1 − r₁))`;
- intake SE: `sd(intake) / √n × √max(0, 1 − n/N)`, where N = non-paused span days;
- `SE = √((ρ·SE_b)² + SE_I²)`.

**Algorithm** (`M = mondayOf(today)`; every exit writes `lastCheck`; `kgNow` = display trend at M−1, else `startWeightKg`):

```
if p.lastCheck && p.lastCheck.week ≥ M            → null (no-op)
if isMonday(today) && hour < 4                     → null
base: from = to = p.dailyKcal, answer = null

1  if p.age < 18 || p.pregnancy                     → 'off'
2  if a pause covers today or any day in [M−7, M−1] → 'paused'
3  floor-up (safety, ignores data, holds, autoAdjust and no-numbers):
     floor = minTargetOf(p, kgNow)                  (= floorOf unless belowFloorOk)
     if p.dailyKcal < floor                         → 'changed', reason 'floor-up',
        to = min(floor, cur + 100), applied (setTarget by 'check')
4  reached (needs a weigh-in in the last 14 days; trendNow = display trend):
     reachedNow = (goalPace > 0 && trendNow ≤ targetWeightKg) || (goalPace < 0 && trendNow ≥ targetWeightKg)
     allowed    = !p.reached || M ≥ p.reached.askAgain || trend moved ≥ 1 kg further past p.reached.kg
     if reachedNow && allowed → 'reached', reason 'reached', to = maintenanceOf(p, trendNow), goalPace → 0,
        settle {from: today+14, why 'change'}, reached = {at: M, kg: trendNow, prevPace, prevKcal, askAgain: null}
        autoAdjust on: applied (setTarget 'check'); off: proposal only
        → return (no calibration this week)
5  data:
     start = max(M−28, p.settle.from)
     W = weigh-ins in [start, M−1] (one per day, gym weight log via the bridge)
     if |W| < 5 or span(W) < 14 → p.settle.from > M−28 ? 'settling' (settle = p.settle.why) : 'data'
                                   missing = {weighIns, completeDays} counted over [M−28, M−1]
     spanDays = non-paused days in [first, last); complete = spanDays with isComplete
     if |complete| < 0.75·|spanDays| → 'data'
6  estimate:
     line = leastSquares(W); trendKg = line.at(last); intake = mean(eaten on complete days)
     obs = intake − line.slope·ρ
     if obs ∉ [0.8, 2.5]·bmr(trendKg) → 'implausible'
     prior = burnOf(p, trendKg); err = obs − prior
     sure = sign(err)·max(0, |err| − 1.5·SE); belief = clamp(sure, ±150)
     offset' = clamp(p.burnOffset + belief, ±1500); anchored = true
     idealOld = targetFor(p, trendKg); ideal = targetFor({…p, burnOffset: offset'}, trendKg)
     gap = ideal − cur; dir = sign(gap); pace = −line.slope·7 (observed, + = losing)
7  decide (offset' stored on every exit below except 'ask'):
     |gap| < 100                                        → 'same' (note 'floor' if the raw ideal is below minTargetOf, 'noisy' if 1.5·SE ≥ 150)
     hold active (M < hold.until) and (hold.dir = 0 or (hold.dir = dir and |gap| < 200)) → 'same', note 'held'
     dir < 0 and pace > goalPace + 0.1                  → 'same', note 'pace'   (never cut while ahead of plan)
     dir > 0 and pace < goalPace − 0.1                  → 'same', note 'pace'   (never raise while behind plan)
     dir < 0 and hidesKcal(p)                           → 'same', note 'quiet'  (no-numbers mode never cuts)
     next = cur + dir·100 (ideal is clamped to minTargetOf, so a cut of 100 never crosses it)
     burnPart = ideal − idealOld
     reason = (dir > 0 ? burnPart ≥ 50 : burnPart ≤ −50) ? 'burn' : 'weight'
     dir < 0 and burnPart ≤ −50 → 'ask' (to = next, offsetAfter = offset'; nothing applied, offset NOT stored)
     !p.autoAdjust               → 'suggested' (to = next)
     otherwise                   → 'changed': setTarget(next, today, 'check'), hold {dir: −dir, until: M+28}
```

Why each part, one line each:
- **28 days, ≥ 5 weigh-ins over ≥ 14 days, 75 % complete days, plausibility:** the existing tested check-in maths; only inputs and thresholds change.
- **Honest SE at 1.5:** with day-to-day correlated water, the naive "2 SE" is only about 1.15 honest SE (science judge). Honest 2 SE was calmest but slow when the start is 300 off (§2.11).
- **Prior = NASEM + learned offset,** never a model at `targetSteps`: daily activity is out of the target, so systematic activity cannot be counted twice.
- **Belief cap 150, dead band 100, fixed step 100:** overlapping windows are not independent, and "bez zmian albo o 100 kcal" is easy to say.
- **Real intake, never adherence:** eating 150 over the target and losing slower does not lower the target.
- **14-day settle** after a start, a user change ≥ 300 kcal, a change of direction, the reached switch and a break. With 7 days, early water and glycogen gave 21–33 % of new dieters a wrong first raise (three judges' runs); with 14 days and honest SE, 8 % (§2.11).
- **Hold 4 weeks / escape 200 after any applied change:** cuts reversals by a third to a half without slowing convergence.
- **Pace guard:** never cuts food while the person already loses faster than planned (eating-disorder safety). It also fixes the case where the first move goes the wrong way when the start is too low: 18 % → 10 %.
- **Ask before a burn-based cut:** under-logging and forgotten meals bias the burn estimate down (Carbon's practice). Raises and weight-driven moves are applied with an undo.
- **Reached → maintenance by default,** asked again after 4 weeks or 1 kg further: continuing a deficit past the goal is the unsafe default.

**Holds** (one at a time, latest wins; `hold.until` exclusive):

| event | hold |
|---|---|
| automatic change in direction d | `{dir: −d, until: M + 28}` (no turning back unless gap ≥ 200) |
| „Zostaw” on a change in direction d | `{dir: d, until: today + 28}` |
| „Nie zawsze — zostaw” on a cut | `{dir: −1, until: M + 28}` |
| „Tak — ustaw” on a cut | `{dir: +1, until: M + 28}` |
| „Nie teraz” on a suggestion in direction d | `{dir: d, until: today + 28}` |
| „Ustaw” on a suggestion in direction d | `{dir: −d, until: today + 28}` |
| any user target change from the profile | `{dir: 0, until: today + 14}` (no burn-based change for 2 weeks) |

**Answers** (`answerCheck(answer, today)`, one transaction; `kgNow` = display trend):

| status | answer | effect |
|---|---|---|
| `changed` (burn/weight) | `ok` „Dobrze” | hide |
| `changed` (burn/weight) | `keep` „Zostaw {from} kcal” | `setTarget(from, today, 'user')`; `goalPace = snap05(impliedPace(p, kgNow, from))`; hold. Offered only if the implied pace is within `safePace` and `from ≥ minTargetOf`. |
| `changed` (floor-up) | `keep` „Zostaw — ustalony z lekarzem albo dietetykiem” | only if `from ≥ hardMin`: `belowFloorOk = true`, `setTarget(from, today, 'user')` |
| `ask` | `yes` „Tak — ustaw {to} kcal” | `burnOffset = offsetAfter`; `setTarget(to, today, 'check')`; hold |
| `ask` | `no` „Nie zawsze — zostaw {from} kcal” | nothing learned; hold |
| `suggested` | `set` / `later` | apply `to` / hide; hold |
| `reached` (applied) | `ok` / `continue` „Chcę dalej chudnąć” („…przybierać”) | hide / restore `prevPace` and `prevKcal` (`setTarget 'user'`), `reached.askAgain = M + 28` |
| `reached` (proposal, autoAdjust off) | `set` „Przejdź na utrzymanie” / `continue` „Jeszcze nie” | apply maintenance / `askAgain` |

The card also hides if the target changed another way that week: `dailyKcal !== to` for `changed`, `dailyKcal !== from` for `ask`/`suggested`.

### 2.5 Anchoring

- The burn estimate is tied to data after the upgrade, or after the first check that reached step 6 (`anchored = true`).
- From then on, editing sex, age, height or activity level **rebases** `burnOffset`, so that `burnOf` at `kgNow` stays the same: `burnOffset = clamp(round(burnOf(old, kgNow) − eer(new, kgNow)), ±1500)`.
- The target only changes if the pace or the manual number changes.
- Without this, the migrated owner re-picking „Dużo ruchu” would get +400 kcal on top of a data-learned offset.
- Before anchoring, edits move the estimate with the formula.
- When anchored, the level question sits in a closed „Odpowiedzi do pierwszego szacunku” with an explanation, so there is no control that silently does nothing.

### 2.6 Weight trend, pace, reach

- **Display trend:** an exponential moving average per weigh-in, gap-aware.
  - `trend₀ = kg₀`, `trendᵢ = trendᵢ₋₁ + αᵢ·(clamp(kgᵢ, trendᵢ₋₁ ± 3) − trendᵢ₋₁)`, `αᵢ = 1 − 0.9^(days since previous)`.
  - The ±3 kg step clamp guards against typos (`validWeight` only checks 30–300).
  - Used by „Teraz (trend)”, the chart, the profile, `kgNow` and the reached check.
  - The lag is about 9 days, which is why it is labelled „trend”.
- **Pace:** `paceOver(weighIns, from, to)` is least squares over the last 28 days with the honest SE.
  - It needs ≥ 5 weigh-ins spanning ≥ 14 days.
  - It returns `{pace (kg/wk, + losing), se, weighIns, spanDays}`.
  - It is the same method as the check. Progress shows `pace ± 2·SE` rounded to 0,05.
- **Reach:**
  - Before the person is `anchored`: plan arithmetic only, `weeks = |trend − target| / |goalPace|`.
  - After: a month range from the observed pace ± 2 SE (`reachRange`). early = distance / (pace + 2SE), late = distance / (pace − 2SE).
  - late is `null` when pace − 2SE ≤ 0.05 („najwcześniej …”).
  - Beyond 730 days → „dalej niż 2 lata”.
  - A pace pointing away, or |pace| < 0.1 → the plan sentence.
- The gym's „Średnia z 7 dni” (`engine/body.ts`) stays as it is (out of scope).

### 2.7 What activity does and does not do

| Does | Does not |
|---|---|
| The usual week (one question) sets the starting estimate. | Change any day's target: steps, workouts, cardio, exercise snacks, rides, watch data. |
| Persistent extra movement shows in the weight trend, and the Monday check raises the target (simulation S8: +250 kcal of new walking returns within 4–6 weeks). | Create „pending” amounts, caps, or „cel spadnie najwyżej o …”. |
| Gym screens keep their kcal (Cardio page, workout summary) and say the diary does not add them. | Show kcal on the Today screen's training and cardio cards for diet users, or on the diary's steps card. |
| The diary keeps the steps field. | Price food in steps or sessions („odrobić ruchem” is gone). |
| One step goal: the gym's `STEP_GOAL` 8 000. | The diet's `targetSteps` 10 000 / `baseSteps` 4 000. |

### 2.8 Fate of each existing mechanism

| Mechanism (where) | Fate | Why |
|---|---|---|
| Activity-adjusted goal (`diet/activity.ts`, `useActivity`, `activityText.ts`, `adaptActivity`, `stepsWorth`) | **Deleted** at I2/I3 | per-person error 20–90 %, 28 % compensation, contradictions C1–C4, C15–C18 |
| Weekly balance (`weeklyAdjustment`, `adaptWeekly`, „rozkładam to na N dni”) | **Deleted** | daily target moves; rewards partial logging (C8); pay-back framing; silent cap (C7) |
| Pending („Jeśli do wieczora…”) | **Deleted** | belonged to the activity goal |
| `kcalCorrection` | **Superseded** by `burnOffset` (new name, new meaning); the old key stays in the row untouched | a revert reads the old value correctly |
| Check-in in the meal-prep form (`prep/checkin.ts`) | **Moved** to the Monday check for everyone; `checkin.ts` keeps only the stored-plan types | almost nobody reached it; it counted activity twice |
| Cheat meal | **Renamed „Większy posiłek”**; week, scale-grams, offset and activity texts removed; `DayRow.cheat` key unchanged | ED association (Ganson 2022); offset was compensation |
| Forecast (plan line, „real” line, projection, „Z zapisów jedzenia wynikałoby…”) | **Replaced** by trend + observed pace ± + month range | one honest estimate |
| Weeks table („Co działa u ciebie”) | **Kept as „Tydzień po tygodniu”**: complete-day food average, per-week weight change from ≥ 3 weigh-ins, steps, workouts; neutral | useful view without verdict noise |
| Findings | **Kept, stricter**: ≥ 8 finished weeks, ≥ 3 weeks per group, \|diff\| ≥ 0,1 kg/wk and ≥ 2,6 × Welch SE (corrects for comparing 5 habits); strength words removed; shown only when one qualifies | UX/eng keep; science's multiple-comparison concern handled by 2,6 instead of 2 |
| Macro statuses (green/gold/orange, „za mało/za dużo”, „brakuje … białka” from breakfast, fat-minimum warning) | **Replaced** by neutral progress and the band | judgemental, below label/logging accuracy |
| Profile tiles (BMR, „Spalanie dzienne”, „Deficyt”, „Tempo · cel ok. (data)”) | **Deleted**: one result line + „Jak liczę cel” | fewer numbers |
| Multiplier select „× 1.28”, advanced fields | **Replaced** by 4 plain levels; `kcalPerKg` stays internal | jargon |
| `goalSince` | **Replaced** by `goals`; old key stays in the row | past days need their own target |
| „Plan na dziś: X kcal” under the balance | **Deleted** | duplicate (C11) |
| `PrepPlanView` „cel w profilu się zmienił” | shown only at ≥ 200 kcal difference or a different diet style | weekly ±100 would trigger it constantly |
| Diary weigh-in prompt (not skippable, „Ile ważyłeś”) | **One shared skip** with the Today screen („Nie dziś”), neutral words | C19, masculine form |

### 2.9 Safety rules

| Rule | Enforced in | Behaviour |
|---|---|---|
| Hard minimum 1500 M / 1200 K | `target.ts`, profile validation, upgrade, normaliser | never set by the app; manual entry below is an error; a migrated target below is raised to it (notice bullet) |
| Floor `max(ceil50(BMR), hardMin)` | `targetFor`, check, profile | chips under it disabled; manual between hardMin and floor only with „Ten cel jest ustalony z lekarzem albo dietetykiem” (`belowFloorOk`, then `minTargetOf` = hardMin); the check never cuts below `minTargetOf`; floor-up +100/week works without any data |
| Pace | `safePace` | loss ≤ 1 %/wk, gain ≤ 0,5 %/wk; chips above disabled with the reason |
| Pace guard | check | no cut while losing faster than plan + 0,1 kg/wk; no raise while slower than plan − 0,1 |
| Under 18 (age 14–17) | normaliser, upgrade, profile, `hidesKcal`, check | `goalPace` 0, target maintenance, no-numbers forced and locked, no target weight or pace in the form, check `off` |
| BMI < 18,5 (trend or target weight) | `safePace`, profile, upgrade | no deficit; „Schudnąć” disabled; target weight below `minHealthyKg(height)` rejected; an upgraded deficit becomes maintenance |
| Pregnancy / breastfeeding (`pregnancy`, offered for K) | `safePace`, check, profile | no deficit, check `off`, advice line |
| „Bez liczenia kalorii” | `hidesKcal(p) = p.hideKcal ∥ p.age < 18`; React context `KcalShown` | matrix §4.10; the check still learns and raises, never cuts |
| „Przerwa” (7 or 14 days, max 28, last 12 kept) | `pauses`, goals, check | target = maintenance for the break; a future goals entry returns the previous target; the check pauses and settles 14 days after |
| No food reminders, no streaks, no compensation | — | unchanged policy |
| Neutral language | all new copy | no „cheat”, „odrobić”, „nadmiar”, „za dużo”, no orange for kcal, gender-neutral forms, capitalised „Twój/Ci/Ciebie” |

### 2.10 Worked examples

**A. The owner upgrades.** Default-like profile: M 35, 175 cm, 80 kg, ×1,28, 10 000 steps, 4 000 base, 0,4, extra 0, correction 0, `dailyKcal` 1860; upgrade on Saturday 2026-10-24.
- Old burn: 1 723,75 × 1,28 + 192 = **2 398,4**.
- Level from ×1,28 → `inactive`. NASEM inactive at 80 kg = 2 639,5, so `burnOffset` = **−241**.
- Implied pace: (2 398,4 − 1 860) × 7 / 7 500 = 0,5025, snapped to **0,5**.
- Target **1860, unchanged**: targetFor would give 1850, and |Δ| < 100.
- `lastCheck.week = mondayOf(today + 6) = 2026-10-26`, so the first check runs on **Monday 2026-11-02** (9 days later), on his existing 28 days of history.
- With `kcalCorrection` −120 instead: offset −361, pace 0,4 (0,39 is more than 0,1 from every chip, so it is rounded to 0,05).
- If he later re-picks „Dużo ruchu”: the offset is rebased to −641, and burn and target stay the same. Without anchoring it would be +400 kcal.

**B. Marek** (report-ui persona: M 35, 180 cm, 89 kg, ×1,28, base 2 040): old burn 2 575,2, NASEM 2 798,9 → offset −224; pace 0,4995 → 0,5; target **2040** kept.

**C. The same week, old vs new** (report-model §3: eaten Mon 1 950, Tue 1 900, Wed 1 900, Thu 1 860, Fri 2 300, Sat 2 400):

| | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| old target | 1 950 | 1 760 | 1 920 | 1 740 | 1 700 | 2 790 | 1 710 |
| **new target** | **1 860** | **1 860** | **1 860** | **1 860** | **1 860** | **1 860** | **1 860** |
| new verdict | w zakresie (+90) | w zakresie | w zakresie | w zakresie | ok. 440 ponad cel | ok. 540 ponad cel | not lowered |

**D. Partial logging.** Tuesday has only a 400 kcal breakfast.
- Old: Wednesday goes from 1 920 to 2 140.
- New: Wednesday stays. Tuesday shows „Mało zapisów jak na cały dzień — …” with „To był cały dzień”, and it is excluded from the check and the averages.

**E. Long ride** (2,5 h).
- Old: goal 2 980 behind a silent cap, while the gym said ≈ 1 685.
- New:
  - the target is unchanged;
  - the Cardio page still shows ≈ 1 685 and says the diary does not add it;
  - Today shows no kcal for the ride;
  - „Co teraz?” and „Większy posiłek” help plan a hungry day.

**F. A Monday cut** (test A1). M 35/175 inactive, pace 0,5, offset 0, target 2100; 28 daily weigh-ins 80,000 − 0,025·i; 2 100 kcal logged every day.
- Trend 79,325, prior 2 630,0, observed 2 287,5, err −342,5, SE 61,4, belief −150 → ideal 1 950 → **`ask`, to 2 000**.
- „Tak” → 2 000 and offset −150.
- „Nie zawsze” → 2 100 stays, nothing is learned, and there is no cut for 4 weeks unless the gap reaches 200.

**G. „Zostaw” on a raise.** The owner: offset −241, belief +150 → −91; burn at 80 kg 2 548,5.
- Ideal at 0,5 = 2 000, so the target goes from 1 860 to **1 960**.
- „Zostaw 1860 kcal” → pace = (2 548,5 − 1 860)·7/7 500 = 0,643 → **0,65**, within the 0,8 limit.
- Ideal at 0,65 = 1 850, so next Monday is „bez zmian”, and no raise comes back for 4 weeks unless the gap reaches 200.
- Toast: „Cel zostaje: 1860 kcal. Przy nim tempo wyjdzie ok. −0,65 kg na tydzień.”

**H. First weeks of a new user** (starts Wed 2026-10-28):
- week 1: no Monday text;
- weeks 2–4: a „settling” line once there are ≥ 3 weigh-ins and ≥ 7 complete days;
- the first data-backed check runs on Mon 2026-11-30 (day 33).

### 2.11 Simulation evidence (600 runs per scenario; M 95 kg → −0,5 kg/wk; `sim-final.out.txt`)

Columns: changes per 16 weeks · up/down reversals · first change in the wrong direction · \|target − ideal\| at week 12 (median/p90) · real pace weeks 8–16 (kg/wk).

| scenario | simple as specified (naive SE, 2 SE, settle 7, 50 %) | **final rule** |
|---|---|---|
| S1 prior right, water 1,5 kg | 2.3 · 0.78 · 20 % · 50/100 · 0.48 | **1.9 · 0.50 · 13 % · 0/100 · 0.48** |
| S2 prior right, water 2,5 kg | 2.4 · 0.89 · 23 % · 50/100 · 0.47 | **1.9 · 0.55 · 8 % · 0/100 · 0.49** |
| S3 prior 300 too high | 4.1 · 0.46 · 0 % · 50/150 · 0.43 | **3.7 · 0.18 · 0 % · 50/150 · 0.42** |
| S4 prior 300 too low | 3.2 · 0.71 · 2 % · 0/100 · 0.51 | **2.6 · 0.44 · 10 % · 50/100 · 0.53** |
| S5 15 % of days logged at 60–80 % | 2.9 · 0.64 · 7 % · 100/100 · 0.55 | **2.3 · 0.34 · 3 % · 50/100 · 0.54** |
| S5b same, half answer „Nie zawsze” | 2.2 · 0.43 · 7 % · 0/100 · 0.52 | **1.8 · 0.24 · 3 % · 0/100 · 0.52** |
| S6 logs 20 % low, eats until the log says done | 4.2 changes · pace 0.38 | **4.0 changes · pace 0.37** (self-corrects toward 0.5; gaps are in real-intake units, not meaningful) |
| S7 weighs 2×/week | 1.6 · 0.40 · 13 % · 0/100 · 0.48 | **1.2 · 0.15 · 5 % · 0/100 · 0.49** |
| S8 +250 kcal/day new activity from week 6 | 2.7 · 0.76 · 40 % · 50/150 · 0.58 | **2.3 · 0.56 · 41 % · 50/150 · 0.59** |

Honest 2 SE (no hold, no pace guard) was calmer: S1 1.5 changes and 0.32 reversals. But it was slow:
- S3 week-12 gap 150/250;
- S8 150/250;
- S4 first move wrong in 32 % of runs.

The final rule keeps the 1.5-SE convergence and buys back the calm with the hold and the pace guard.

---

## 3. Data model and migration

### 3.1 `Profile` v2 (Dexie `profile` row `me`; no Dexie version change, no new table)

| field | type | new-profile default | rule |
|---|---|---|---|
| `version` | `2` | 2 | absent → legacy row, upgraded |
| `sex`, `age`, `heightCm`, `startWeightKg`, `targetWeightKg`, `startDate`, `dietProfile`, `preferredStore`, `kcalPerKg` | as today | as today (target weight: none until chosen, §4.5) | ranges unchanged |
| `activityLevel` | `ActivityLevel` | `'inactive'` | enum |
| `goalPace` | number | 0,5 lose / 0 keep / −0,25 gain (lowered to `safePace`) | [−0,5, 1]; forced 0 under 18, pregnancy; loss → 0 at BMI < 18,5 |
| `dailyKcal` | number | `targetFor(...)` (2000 until package A switches the default) | [800, 6000]; mirror of `targetOn(today)` |
| `goals` | `GoalChange[]` | `[{from: today, kcal, by: 'setup'}]` | sorted, unique `from`, kcal [800, 6000] (history is never re-clamped; new entries ≥ hardMin), ≤ 200 newest |
| `burnOffset` | number | 0 | [−1500, 1500] |
| `anchored` | boolean | false | true after upgrade or first data-backed check |
| `autoAdjust` | boolean | true | „Dopasowuj cel co tydzień” |
| `hideKcal` | boolean | false (true when chosen in onboarding) | effective true under 18 |
| `pregnancy` | boolean | false | only offered for K |
| `belowFloorOk` | boolean | false | doctor/dietitian checkbox |
| `pauses` | `Pause[]` | `[]` | `from ≤ to`, ≤ 28 days each, last 12 |
| `hold` | `Hold \| null` | null | — |
| `settle` | `Settle` | `{from: startDate + 14, why: 'start'}` | — |
| `lastCheck` | `WeekCheck \| null` | `{week: mondayOf(today), status: 'setup', …}` | validated field by field, else null |
| `reached` | `Reached \| null` | null | — |
| `notice` | `'show' \| 'seen' \| null` | null | `'show'` set only by the upgrade |

```ts
// src/food/diet/types.ts
export type ActivityLevel = 'inactive' | 'low' | 'active' | 'very';
export type GoalBy = 'setup' | 'user' | 'check' | 'migration' | 'break' | 'safety';
export interface GoalChange { from: string; kcal: number; by: GoalBy }
export interface Pause { from: string; to: string; kcal: number }      // inclusive dates; kcal = target to return to
export interface Hold { dir: -1 | 0 | 1; until: string }               // until exclusive
export interface Settle { from: string; why: 'start' | 'change' | 'pause' }
export interface Reached { at: string; kg: number; prevPace: number; prevKcal: number; askAgain: string | null }
export type CheckStatus = 'setup' | 'migrated' | 'changed' | 'ask' | 'suggested' | 'reached'
  | 'same' | 'data' | 'settling' | 'implausible' | 'paused' | 'off';
export type CheckReason = 'burn' | 'weight' | 'floor-up' | 'reached';
export type CheckNote = 'held' | 'noisy' | 'floor' | 'pace' | 'quiet';
export interface CheckFacts {
  from: string; to: string;            // window actually used
  weeks: number;                       // clamp(round(span/7), 2, 4)
  weighIns: number; completeDays: number; spanDays: number;
  pace: number; paceSe: number;        // kg/wk, + = losing
  intake: number;                      // mean of complete days, round10
  burn: number; burnSe: number;        // observed, round50; ±max(50, round50(2·SE))
  before: number; after: number;       // burnOf before/after this check, round50
  trendKg: number;
}
export interface WeekCheck {
  week: string; status: CheckStatus; from: number; to: number;
  reason: CheckReason | null; note: CheckNote | null; settle: Settle['why'] | null;
  facts: CheckFacts | null; missing: { weighIns: number; completeDays: number } | null;
  floor: number | null; offsetAfter: number | null; goalPace: number;
  answer: 'ok' | 'keep' | 'yes' | 'no' | 'set' | 'later' | 'continue' | null;
}
/** Old-model keys: stay in stored rows untouched; read only by the upgrade. */
export interface LegacyFields {
  activityMultiplier?: number; baseSteps?: number; targetSteps?: number; kcalPer1000StepsPerKg?: number;
  extraWeeklyKcal?: number; kcalCorrection?: number; adaptWeekly?: boolean; adaptActivity?: boolean; goalSince?: string;
}
// db.ts
export interface ProfileRow extends Profile, LegacyFields { id: 'me' }
```

**Expand → migrate → contract:**
- P0 adds the v2 fields as required and keeps today's legacy fields in `Profile` (required, filled by `completeProfile`), so old code still compiles.
- I2 removes them from `Profile`; from then on they live only in `LegacyFields`.

### 3.2 `DayRow.partial?: boolean`

- `true`: the user says the day is incomplete.
- `false`: the user says it is complete.
- absent: the 60 % rule decides.

It is written by `markDay(date, partial | undefined)`, and `cleanDay` keeps it. `DayRow.cheat` keeps its key.

### 3.3 One normaliser for every entry point

`cleanProfile(input, ctx: { today: string; weightKg?: number; fresh?: boolean }): Profile & LegacyFields` (`diet/validate.ts`) is the only way a profile enters the app.

**Entry points:**
- `useProfile()`: on every read and render, in memory.
- `restoreAll`: `fresh: false`, `weightKg = startWeightKg`.
- `importWorkbook`: `fresh: true`.
- tests.

**Legacy vs v2:** legacy input (no `version: 2`) goes through `upgradeProfile` first (§3.4); v2 input gets field validation only.

**v2 validation:**
- Ranges: `PROFILE_RANGES` gains `goalPace` [−0,5, 1] and `burnOffset` [−1500, 1500].
- Enums and booleans are checked.
- `goals`:
  - sorted and de-duplicated by `from` (last wins);
  - kcal clamped to [800, 6000];
  - an empty list becomes `[{from: startDate, kcal: dailyKcal, by: 'setup'}]`.
- **Old-tab edit:** pre-upgrade code that changes the target also writes the legacy `goalSince`. When `goalSince` is newer than the newest goals entry and `dailyKcal ≠ targetOn(goalSince)`, append `{from: goalSince, kcal: dailyKcal, by: 'user'}`.
- Then `dailyKcal = targetOn(today)`. This also moves the mirror across a scheduled break end without any write.
- Pauses are clipped to 28 days, sorted, and the last 12 kept.
- `hold`, `settle`, `reached` and `lastCheck` are checked field by field; an invalid one becomes null or the default.
- age < 18 → `goalPace` 0.

**Other guarantees:**
- **Legacy keys pass through,** validated against their old ranges; invalid ones are dropped. Unknown keys are dropped.
- **Idempotent:** `cleanProfile(cleanProfile(x)) ≡ cleanProfile(x)` (tested).
- `saveProfile(p)` merges into the stored row inside a transaction (`{...stored, ...p, id: 'me'}`), so no write path drops a legacy key.

### 3.4 Upgrade (existing users)

`upgradeProfile(row, { weightKg, today, fresh })` (`diet/upgrade.ts`):

1. Read the legacy values, with legacy defaults where missing: ×1,28, 4 000, 10 000, 0,4, 0, 7 500, correction 0.
2. `activityLevel = activityFromMultiplier(m)`:
   - < 1,33 → inactive (covers 1,2 and 1,28);
   - < 1,46 → low (1,375);
   - < 1,64 → active (1,55);
   - else very (1,725).
3. `oldBurn` = the old `tdee` at `weightKg`: multiplier, walking at `targetSteps`, `extraWeeklyKcal/7`, `kcalCorrection`.
4. `burnOffset = clamp(round(oldBurn − eer(level, weightKg)), ±1500)`.
5. `goalPace` = (oldBurn − dailyKcal) × 7 / kcalPerKg:
   - snapped to the nearest of {0,75, 0,5, 0,25, 0, −0,25} if within 0,1, else rounded to 0,05;
   - clamped to [−0,5, 1].
6. `goals = [{from: min(startDate, today), kcal: dailyKcal, by: 'migration'}]`. **`dailyKcal` is unchanged and not rounded.**
7. `anchored = true`; `settle = {from: startDate + 14, why: 'start'}`; `lastCheck = {week: mondayOf(today + 6), status: 'migrated', from = to = dailyKcal}`. The first check is therefore ≥ 7 days later, because the run condition is `lastCheck.week < mondayOf(today)`.
8. `notice = fresh ? null : 'show'`; `autoAdjust = true`, `hideKcal = false`, `pregnancy = false`, `belowFloorOk = false`, `pauses = []`, `hold = null`, `reached = null`, `version = 2`.
   - With `fresh` (workbook import of a new profile): `goals[0].by = 'setup'`, `lastCheck.status = 'setup'`, `lastCheck.week = mondayOf(today)`, `anchored = false`.
9. **Safety exceptions.** Each adds a second goals entry `{from: today, …, by: 'safety'}` and a notice bullet:
   - age < 18 → pace 0, maintenance;
   - BMI < 18,5 with a deficit → maintenance;
   - `dailyKcal < hardMin` → `hardMin`.

   A target between `hardMin` and the BMR floor is **kept**. The notice offers „Podnieś do {floor} kcal” / „Zostaw — ustalony z lekarzem albo dietetykiem”. If unanswered, the Monday floor-up raises it by 100 a week.
10. Return `{...row, ...newFields}`, leaving the legacy keys untouched.

**Persistence:**
- `useProfile()` returns the upgraded profile in memory immediately, then calls `persistUpgrade(ctx)` once. This is a `rw` transaction that writes only if the stored row is still legacy.
- `ctx.weightKg` is the latest gym weigh-in from `useContext(BridgeContext)`, else `startWeightKg`. The result moves by less than 10 kcal either way.
- Writing at first read (not "on the first user action") keeps the upgrade date, the notice and the first-check date stable across days.
- Revert safety comes from the untouched legacy keys and the unchanged `dailyKcal`: old code reads the row exactly as before.

### 3.5 New profiles

- `completeProfile(partial)` returns v2.
- The default `dailyKcal` is `targetFor(merged, merged.startWeightKg)`. Package A switches it from 2000; tests always pass `dailyKcal` explicitly.
- The default man gets 2100 with a `setup` goal.
- `lastCheck = {week: mondayOf(today), status: 'setup'}`.

### 3.6 Store API (`src/food/diet/store.ts`; each is one transaction)

```ts
completeProfile(partial: Partial<Profile>): Profile                                  // P0 (default switch: A)
saveProfile(profile: Profile): Promise<void>                                         // P0: merges into the row
saveProfileEdit(next: Profile): Promise<void>                                        // A: thin wrapper used by the profile page
persistUpgrade(ctx: { weightKg: number; today: string }): Promise<void>              // A
runWeeklyCheck(input: { weighIns: readonly WeighIn[]; today: string; hour: number }): Promise<WeekCheck | null> // A
answerCheck(answer: NonNullable<WeekCheck['answer']>, ctx: { today: string; kgNow: number }): Promise<void>   // A
dismissNotice(): Promise<void>                                                       // P0
resolveFloor(choice: 'raise' | 'keep', ctx: { today: string; kgNow: number }): Promise<void> // A (notice choices)
markDay(date: string, partial: boolean | undefined): Promise<void>                   // P0
startPause(days: 7 | 14, ctx: { today: string; kgNow: number }): Promise<void>       // A
endPause(ctx: { today: string; kgNow: number }): Promise<void>                       // A
eatCheat(...)                                                                        // default name say('Większy posiłek', 'Bigger meal')
```

- **`startPause`:**
  - adds the pause `{from: today, to: today + days − 1, kcal: dailyKcal}`;
  - `setTarget(maintenanceOf(p, kgNow), today, 'break')`;
  - adds the future entry `{from: to + 1, kcal: pause.kcal, by: 'break'}`;
  - `settle = {from: to + 15, why: 'pause'}`.
- **`endPause`:**
  - sets `to = yesterday` (or drops the pause if it started today);
  - removes `break` entries with `from > today`;
  - `setTarget(pause.kcal, today, 'break')`;
  - `settle = {from: today + 14, why: 'pause'}`.
- **`setTarget(p, kcal, from, by)`:** removes entries with `from ≥` the given date, appends the new one, keeps 200, and sets `dailyKcal`.

### 3.7 Backup, restore, clear

- The backup format stays `version: 1`. The profile inside may be v1 or v2; `restoreAll` normalises it.
- `cleanDay` keeps `partial`.
- `clearAll` is unchanged.
- The remembered watch model (`gt-garmin-model`) is cleared by „Usuń wszystkie dane” (W2).

### 3.8 No „old way” toggle

- The old per-day adjustment and weekly spread produced C1–C17, and keeping both would double code and tests.
- The user's levers instead: „Zostaw”, „Nie zawsze”, a manual target, „Dopasowuj cel co tydzień” off, „Bez liczenia kalorii”, „Przerwa”.
- Rollback is at code level, kept safe by §3.3–3.4.

---

## 4. Screens, with exact strings

**Conventions:**
- All text via `text({ pl, en })` / `say()`.
- Numbers via `formatNumber` (Polish CLDR: „1950”, „10 000”; English „1,950”).
- Targets as stored; „ok.” values `round10`; grams whole; kg one decimal; paces up to 2 decimals (`paceText`).
- New and touched Polish strings use capitalised „Twój/Twoja/Ci/Ciebie” and gender-neutral forms (no „zjadłeś”, „głodny”, „ważyłeś”).
- No colour carries a verdict: one neutral bar fill, and the protein bar fills when done.
- Shared helpers live in `src/food/components/diet/dietFormat.ts` (P0):
  - `kcalText(n)`;
  - `okKcal(n)` („ok. 650 kcal”);
  - `paceWord(pace)` („−0,5 kg” / „utrzymanie” / „+0,25 kg”);
  - `dayMonth(date)` („31.10” / "31 Oct");
  - `dayMonthLong(date)` („7 listopada” / "7 November");
  - `monthRange(early, late)`;
  - `howHref` (`#/jedzenie/profil?jak=1`).

### 4.1 Today card — `src/food/TodayFoodCard.tsx`

```
JEDZENIE
Zostało ok. 650 kcal i 54 g białka                 ← h2.today-name
Białko   [██████░░░░]                              ← aria-valuetext „96 z 150 g”
Kalorie  [██████░░░░]                              ← aria-valuetext „1240 z 2100 kcal”
(optional) To ok. 300 kcal ponad cel — jeden dzień nie zmienia trendu.
(optional) Liczę już z zaplanowanym większym posiłkiem (900 kcal).
(optional, one line) Od dziś cel: 2050 kcal (było 1950) →
[Dodaj zjedzone]
```

- **Data:** `needs = dayNeeds({profile, goalKcal: targetOn(p, today), eaten, cheat, mealsAhead})`; `state = dayState(needs, eaten)` (P0, `diet/day.ts`).
- **Placeholder:** `FoodCardPlaceholder` while `useWeeklyCheck` is pending, for at most 3 s; then the stored target. The card never blocks on a failing check.
- **Notice line priority** (all link to `FOOD_PATH`):
  1. change notice;
  2. Monday card waiting (`changed`/`ask`/`suggested`/`reached`, `answer === null`);
  3. active break.
- **Removed:** „Dziś 1420 z 1940 kcal”; the visible „98 / 164 g”; „… ponad cel.” from +1 kcal; orange; any week or activity influence.

Strings (`src/food/components/diet/dayText.ts`, shared with the diary):

| key | PL | EN |
|---|---|---|
| `start(kcal, g)` | `Na dziś: ${kcal} kcal i ${g} g białka` | `Today: ${kcal} kcal and ${g} g protein` |
| `left(kcal, g)` | `Zostało ok. ${kcal} kcal i ${g} g białka` | `About ${kcal} kcal and ${g} g protein left` |
| `leftProteinDone(kcal)` | `Zostało ok. ${kcal} kcal — białko na dziś już jest` | `About ${kcal} kcal left — protein done for today` |
| `within(g)` | `Kalorie na dziś w zakresie celu, białka jeszcze ${g} g` | `Calories for today are within your target, ${g} g protein to go` |
| `withinDone` | `Kalorie na dziś w zakresie celu, białko też już jest` | `Calories for today are within your target, and protein’s done too` |
| `enough(g)` | `Na dziś kalorii już wystarczy, białka jeszcze ${g} g` | `That’s enough calories for today, ${g} g protein to go` |
| `enoughAll` | `Na dziś kalorii i białka już wystarczy` | `That’s enough calories and protein for today` |
| `over(kcal)` | `To ok. ${kcal} kcal ponad cel — jeden dzień nie zmienia trendu.` | `That’s about ${kcal} kcal over the target — one day doesn’t change the trend.` |
| `overPlanned(kcal)` | `Z zaplanowanym większym posiłkiem to ok. ${kcal} kcal ponad cel — jeden dzień nie zmienia trendu.` | `With the planned bigger meal that’s about ${kcal} kcal over the target — one day doesn’t change the trend.` |
| `reserved(kcal)` | `Liczę już z zaplanowanym większym posiłkiem (${kcal} kcal).` | `This already counts the planned bigger meal (${kcal} kcal).` |
| `proteinOnly(g)` (no-numbers) | `Białka jeszcze ${g} g` | `${g} g protein to go` |
| `proteinOnlyDone` (no-numbers) | `Białko na dziś już jest` | `Protein done for today` |
| `noticeLink` | `Liczenie kalorii jest teraz prostsze — zobacz, co się zmieniło` | `Calorie counting is simpler now — see what changed` |
| `changedLink(to, from)` | `Od dziś cel: ${to} kcal (było ${from})` | `New target from today: ${to} kcal (was ${from})` |
| `askLink` | `Propozycja nowego celu czeka w dzienniku` | `A suggested new target is waiting in the diary` |
| `reachedLink` | `Waga docelowa osiągnięta` | `Target weight reached` |
| `pauseLink(date)` | `Przerwa w liczeniu do ${date}.` | `Counting paused until ${date}.` |

**Which headline:**
- nothing eaten and no planned meal → `start`;
- `left` kind → `left` / `leftProteinDone`;
- `within` → `within` / `withinDone`;
- `over` → `enough` / `enoughAll`, plus `over` (or `overPlanned` when the excess exists only with the planned meal);
- the `reserved` line whenever a bigger meal is planned and the day is not over.

### 4.2 Diary — `src/food/components/diet/DiaryPage.tsx`

**Order (today):**
1. DayNav
2. **change notice**
3. **Monday card** (or the quiet line, Mon–Tue)
4. break line
5. WeighCard
6. **day card**
7. planned bigger meal
8. Zjedzone (+ partial footer)
9. plan or suggestion for the day
10. „Co teraz?”
11. **Kroki**
12. links

`<Loading/>` while `useWeeklyCheck` is pending, for at most 3 s.

**Day card** (`MacroBars.tsx` rewritten; keeps the exports `MacroBars` and `Bar`):

```
Zostało ok. 650 kcal i 54 g białka            ← same headline functions as the Today card
Białko    96 z 150 g      [bar]
Kalorie   1240 z 2100 kcal [bar]
(over / reserved lines as on the Today card)
2 wpisy mają tylko kalorie – suma białka może być zaniżona.
▸ Węglowodany i tłuszcz   (closed; open by default for keto / low carb)
[Dodaj zjedzone] [Ulubione (5)] [Większy posiłek]
```

| key | PL | EN |
|---|---|---|
| row values | `${e} z ${t} g` · `${e} z ${t} kcal` | `${e} of ${t} g` · `${e} of ${t} kcal` |
| `pastHead(eaten, target)` | `Zjedzone ${eaten} kcal · cel ${target}` | `Eaten ${eaten} kcal · target ${target}` |
| `futureHead(kcal, g)` | `Cel na ten dzień: ${kcal} kcal i ${g} g białka` | `Target for that day: ${kcal} kcal and ${g} g protein` |
| `unknown(n)` | `${n} ${wpis ma / wpisy mają / wpisów ma} tylko kalorie – suma białka może być zaniżona.` | `${n} ${entry has / entries have} calories only – the protein total may be too low.` |
| `carbsFat` | `Węglowodany i tłuszcz` | `Carbs and fat` |
| `limit(e, max)` / `overLimit(e, max, over)` | `${e} z ${max} g (limit)` / `${e} z ${max} g — ${over} g ponad limit` | `${e} of ${max} g (limit)` / `${e} of ${max} g — ${over} g over the limit` |
| bigger-meal button | `Większy posiłek` (lucide `UtensilsCrossed`, replaces `Pizza`) | `Bigger meal` |

**Removed:** `goalMoved` and the weekly explanation; the activity line; „Plan na dziś”; `fd-diet-brak/nadmiar` on kcal and protein; „brakuje … białka”; „za mało jedzenia też spowalnia”; the fat-minimum warning.

**Monday card** (`WeekCheckCard.tsx`, new). It is shown when all of these hold:
- viewing today;
- `answer === null`;
- status is `changed`, `ask`, `suggested` or `reached`;
- the target has not changed since (§2.4);
- numbers are shown. Exception: the numberless `reached` variant is shown in no-numbers mode too.

```
Od dziś cel: 2050 kcal (było 1950)                              ← h2
Ostatnie 4 tygodnie: waga −0,6 kg na tydzień (plan: −0,5 kg), średnio zapisane 1960 kcal dziennie.
Z zapisów i wagi wychodzi, że spalasz więcej, niż zakładał szacunek — stąd 100 kcal więcej.
▸ Szczegóły
[Dobrze] [Zostaw 1950 kcal]                                       Jak liczę cel →
```

| key | PL | EN |
|---|---|---|
| `titleChanged(to, from)` | `Od dziś cel: ${to} kcal (było ${from})` | `New target from today: ${to} kcal (was ${from})` |
| `titleProposal(to, from)` (ask, suggested) | `Propozycja: ${to} kcal zamiast ${from}` | `Suggestion: ${to} kcal instead of ${from}` |
| `titleReached` | `Waga docelowa osiągnięta` | `Target weight reached` |
| `facts(weeks, kg, plan, intake)` | `Ostatnie ${weeks} tygodnie: waga ${kg} na tydzień (plan: ${plan}), średnio zapisane ${intake} kcal dziennie.` | `The last ${weeks} weeks: weight ${kg} a week (plan: ${plan}), ${intake} kcal a day logged on average.` |
| plan word | `−0,5 kg` · `utrzymanie` · `+0,25 kg` | `−0.5 kg` · `maintenance` · `+0.25 kg` |
| `burnUp` | `Z zapisów i wagi wychodzi, że spalasz więcej, niż zakładał szacunek — stąd 100 kcal więcej.` | `Your logs and weight show you burn more than the estimate assumed — hence 100 kcal more.` |
| `burnDown` (ask) | `Z zapisów i wagi wychodzi, że spalasz trochę mniej, niż zakładał szacunek.` | `Your logs and weight show you burn a little less than the estimate assumed.` |
| `weightDown` | `Ważysz mniej, więc spalasz trochę mniej — 100 kcal mniej utrzyma tempo.` | `You weigh less, so you burn a little less — 100 kcal less keeps the pace.` |
| `weightUp` | `Ważysz więcej, więc spalasz trochę więcej — 100 kcal więcej utrzyma tempo.` | `You weigh more, so you burn a little more — 100 kcal more keeps the pace.` |
| `floorUp(floor)` / `floorUpTo(floor)` | `Cel był poniżej Twojego bezpiecznego minimum (${floor} kcal), więc podnoszę go o 100 kcal.` / `…, więc podnoszę go do minimum.` | `Your target was below your safe minimum (${floor} kcal), so I’m raising it by 100 kcal.` / `…, so I’m raising it to the minimum.` |
| `askQuestion` | `Czy zapisujesz prawie wszystko, co jesz?` | `Do you log almost everything you eat?` |
| `askHint` | `Dni zapisane tylko w części możesz oznaczyć w „Zjedzone” jako niepełne — wtedy nie liczą się do dopasowania.` | `You can mark partly logged days as incomplete under “Eaten” — then they don’t count when I fit your target.` |
| `reachedBody(trend, target, maint)` | `Trend wagi: ${trend} kg, waga docelowa: ${target} kg. Od dziś cel to utrzymanie: ${maint} kcal dziennie. Przez pierwsze dni waga może pokazać trochę więcej — to woda i glikogen, nie tłuszcz.` | `Weight trend: ${trend} kg, target weight: ${target} kg. From today the target is maintenance: ${maint} kcal a day. For the first few days the scale may show a little more — that’s water and glycogen, not fat.` |
| `reachedProposal(trend, target, maint)` | `Trend wagi: ${trend} kg, waga docelowa: ${target} kg. Na utrzymanie wystarczy ok. ${maint} kcal dziennie.` | `Weight trend: ${trend} kg, target weight: ${target} kg. About ${maint} kcal a day keeps it there.` |
| `reachedPlain` (no-numbers) | `Od dziś dziennik podpowiada posiłki na utrzymanie wagi.` | `From today the diary suggests meals for keeping your weight.` |
| buttons | `Dobrze` · `Zostaw ${from} kcal` · `Zostaw — ustalony z lekarzem albo dietetykiem` · `Tak — ustaw ${to} kcal` · `Nie zawsze — zostaw ${from} kcal` · `Ustaw ${to} kcal` · `Nie teraz` · `Chcę dalej chudnąć` · `Chcę dalej przybierać` · `Przejdź na utrzymanie` · `Jeszcze nie` | `OK` · `Keep ${from} kcal` · `Keep it — agreed with a doctor or dietitian` · `Yes — set ${to} kcal` · `Not always — keep ${from} kcal` · `Set ${to} kcal` · `Not now` · `I want to keep losing` · `I want to keep gaining` · `Switch to maintenance` · `Not yet` |
| toasts | `Cel zostaje: ${from} kcal. Przy nim tempo wyjdzie ok. ${pace} na tydzień.` · `Cel zostaje: ${from} kcal.` · `Nowy cel: ${to} kcal.` · `Utrzymanie: ${to} kcal dziennie.` · `Wracam do poprzedniego celu: ${kcal} kcal. Zapytam znowu za 4 tygodnie.` | `Target stays at ${from} kcal. At that, the pace comes to about ${pace} a week.` · `Target stays at ${from} kcal.` · `New target: ${to} kcal.` · `Maintenance: ${to} kcal a day.` · `Back to your previous target: ${kcal} kcal. I’ll ask again in 4 weeks.` |
| link | `Jak liczę cel →` (`howHref`) | `How I work out the target →` |

**Buttons per status:**

| status | buttons |
|---|---|
| `changed` (burn/weight) | Dobrze / Zostaw (if allowed) |
| `changed` (floor-up) | Dobrze / Zostaw — ustalony z lekarzem… (if `from ≥ hardMin`) |
| `ask` | Tak — ustaw / Nie zawsze — zostaw, plus `askHint` |
| `suggested` | Ustaw / Nie teraz |
| `reached` (applied) | Dobrze / Chcę dalej chudnąć (or przybierać) |
| `reached` (proposal) | Przejdź na utrzymanie / Jeszcze nie |

**Body:** `facts` plus one reason sentence (`burnUp` / `weightDown` / `weightUp` / `floorUp*`). For `ask`: `burnDown` plus `askQuestion`.

**„Szczegóły”** (closed `<details>` on the card and on the `same` quiet line; no arrows inside the `<dl>`):

| key | PL | EN |
|---|---|---|
| summary | `Szczegóły` | `Details` |
| `rowBurn(obs, se)` | `Spalanie z zapisów i wagi: ok. ${obs} kcal (±${se})` | `Burn from your logs and weight: about ${obs} kcal (±${se})` |
| `rowEstimate(before, after)` | `Szacunek w celu: ${before} kcal — bez zmian` / `Szacunek w celu: przed ${before} kcal, po ${after} kcal` | `Estimate behind the target: ${before} kcal — unchanged` / `…: before ${before} kcal, after ${after} kcal` |
| `rowData(n, c, s)` | `Dane: ${n} ${ważenie/ważenia/ważeń}, pełne zapisy z ${c} z ${s} dni` | `Data: ${n} ${weigh-in/weigh-ins}, full logs on ${c} of ${s} days` |
| `rowPeriod(from, to)` | `Okres: ${from}–${to}` | `Period: ${from}–${to}` |

**Quiet line.** One soft `p`, shown when all of these hold:
- it is Monday or Tuesday of the check week;
- viewing today;
- numbers are shown;
- [M−28, M−1] holds ≥ 3 weigh-ins and ≥ 7 complete days.

| key | PL | EN |
|---|---|---|
| `same(t, facts)` | `Ten tydzień: cel bez zmian (${t} kcal). ${facts}` | `This week: target unchanged (${t} kcal). ${facts}` |
| note `noisy` | `Waga mocno skacze z dnia na dzień — ważenie codziennie rano da pewniejszy wynik.` | `Your weight jumps a lot from day to day — weighing every morning gives a surer result.` |
| note `held` | `Cel zmienił się niedawno — z kolejną zmianą poczekam kilka tygodni.` | `Your target changed recently — I’ll wait a few weeks before another change.` |
| note `floor(f)` | `Niżej niż ${f} kcal nie schodzę — to bezpieczne minimum. Tempo może być trochę wolniejsze i to jest w porządku.` | `I won’t go below ${f} kcal — that’s the safe minimum. The pace may be a little slower, and that’s fine.` |
| note `pace` (loss: cut / raise blocked) | `Chudniesz szybciej, niż zakłada plan — celu nie obniżam.` / `Chudniesz wolniej, niż zakłada plan — celu nie podnoszę.` | `You’re losing faster than planned — I won’t lower the target.` / `You’re losing slower than planned — I won’t raise the target.` |
| note `pace` (gain) | `Przybierasz wolniej, niż zakłada plan — celu nie obniżam.` / `Przybierasz szybciej, niż zakłada plan — celu nie podnoszę.` | `You’re gaining slower than planned — I won’t lower the target.` / `You’re gaining faster than planned — I won’t raise the target.` |
| note `pace` (keep) | `Waga spada — celu nie obniżam.` / `Waga rośnie — celu nie podnoszę.` | `Your weight is going down — I won’t lower the target.` / `Your weight is going up — I won’t raise the target.` |
| `data(t, n, d)` | `Ten tydzień: cel bez zmian (${t} kcal). Do dopasowania potrzebuję co najmniej 5 ważeń z 2 tygodni i pełnych zapisów z ¾ dni — teraz ${n} ${ważenie/ważenia/ważeń} i pełne zapisy z ${d} ${dnia/dni}.` | `This week: target unchanged (${t} kcal). To fit it I need at least 5 weigh-ins over 2 weeks and full logs on ¾ of the days — so far ${n} ${weigh-in/weigh-ins} and full logs on ${d} ${day/days}.` |
| `settleStart(t)` | `Ten tydzień: cel bez zmian (${t} kcal). Dopasowanie zacznę po ok. 4–5 tygodniach ważenia i zapisów — pierwsze 2 tygodnie to głównie woda.` | `This week: target unchanged (${t} kcal). I’ll start fitting it after about 4–5 weeks of weigh-ins and logs — the first 2 weeks are mostly water.` |
| `settleChange(t)` | `Ten tydzień: cel bez zmian (${t} kcal). Po zmianie celu pierwsze 2 tygodnie to głównie woda — dopasowanie wróci za 2–3 tygodnie.` | `This week: target unchanged (${t} kcal). After a change of target the first 2 weeks are mostly water — fitting resumes in 2–3 weeks.` |
| `settlePause(t)` | `Ten tydzień: cel bez zmian (${t} kcal). Po przerwie dopasowanie wróci, gdy zbiorą się 2 tygodnie nowych danych.` | `This week: target unchanged (${t} kcal). After a break, fitting resumes once there are 2 weeks of new data.` |
| `implausible(t)` | `Ten tydzień: cel bez zmian (${t} kcal). Zapisy i waga tym razem do siebie nie pasują — to się zdarza przy wahaniach wody albo dniach zapisanych w części. Sprawdzę znowu za tydzień.` | `This week: target unchanged (${t} kcal). Your logs and weight don’t match this time — it happens with water swings or partly logged days. I’ll check again next week.` |

**Change notice** (`ChangeNotice.tsx`, new; shown to upgraded users while `notice === 'show'`):

| | PL | EN |
|---|---|---|
| title | `Liczenie kalorii jest teraz prostsze` | `Calorie counting is simpler now` |
| 1 | `Jeden cel na każdy dzień: ${target} kcal. Nie zmienia się w ciągu dnia ani po północy.` | `One target for every day: ${target} kcal. It doesn’t change during the day or after midnight.` |
| 2 | `Kroki i treningi nie zmieniają już celu. Kalorie z ruchu to szacunek z dużym błędem, a Twój zwykły ruch jest już w celu.` | `Steps and workouts no longer change the target. Calories from activity are a rough estimate, and your usual activity is already in the target.` |
| 3 | `Nadwyżka z jednego dnia nie obniża kolejnych, a ±100 kcal to wciąż cel — jeden dzień nie zmienia trendu.` | `A surplus on one day no longer lowers the next ones, and ±100 kcal is still on target — one day doesn’t change the trend.` |
| 4 | `W poniedziałki sprawdzam wagę i zapisy z ostatnich 4 tygodni. Gdy się nie zgadzają, zmieniam cel o 100 kcal i mówię dlaczego. Gdy wychodzi, że spalasz mniej, niż liczyłem, zanim obniżę cel, pytam.` | `On Mondays I look at your weight and logs from the last 4 weeks. If they don’t match, I change the target by 100 kcal and tell you why. If it looks like you burn less than I assumed, I ask before lowering it.` |
| 5 | `„Cheat meal” to teraz „Większy posiłek”, a porównanie tygodni na stronie Postęp pokazuje tylko pewne wnioski.` | `“Cheat meal” is now “Bigger meal”, and the week comparison on the Progress page shows only clear findings.` |
| age | `Poniżej 18 lat nie liczę kalorii ani nie ustawiam deficytu — dziennik pokazuje białko i podpowiada posiłki.` | `Under 18 I don’t count calories or set a deficit — the diary shows protein and suggests meals.` |
| BMI | `Przy BMI poniżej 18,5 nie prowadzę deficytu — cel to teraz utrzymanie: ${target} kcal.` | `With a BMI under 18.5 I don’t keep a deficit — your target is now maintenance: ${target} kcal.` |
| hard minimum | `Poprzedni cel był niższy niż ${min} kcal — mniej nie ustawiam. Cel to teraz ${min} kcal.` | `Your previous target was below ${min} kcal — I don’t set less. Your target is now ${min} kcal.` |
| below floor | `Twój cel jest niższy niż Twoja podstawowa przemiana materii (${floor} kcal).` + `Podnieś do ${floor} kcal` · `Zostaw — ustalony z lekarzem albo dietetykiem` | `Your target is below your basal metabolic rate (${floor} kcal).` + `Raise to ${floor} kcal` · `Keep it — agreed with a doctor or dietitian` |
| actions | `Rozumiem` · link `Ustawienia w profilu diety` | `Got it` · `Settings in your diet profile` |

In no-numbers mode, bullet 1 drops „: ${target} kcal” and bullet 4 drops „o 100 kcal”.

**Break line:**

| | PL | EN |
|---|---|---|
| line | `Przerwa do ${date}: cel to utrzymanie wagi (${kcal} kcal), a dopasowanie czeka.` | `Break until ${date}: your target is maintenance (${kcal} kcal) and fitting waits.` |
| no-numbers | `Przerwa do ${date}: dopasowanie czeka.` | `Break until ${date}: fitting waits.` |
| button / toast | `Zakończ przerwę` · `Przerwa zakończona. Cel: ${kcal} kcal.` | `End the break` · `Break over. Target: ${kcal} kcal.` |

**Zjedzone** (`EatenCard`):
- heading `Zjedzone · ${kcal} kcal` (no-numbers: `Zjedzone`);
- each line `640 kcal · B 41 · W 43 · T 31` (no-numbers: `B 41 g`);
- a footer for today and past days with entries:

| state | PL | EN |
|---|---|---|
| default | button `Nie wszystko zapisane` | `Not everything logged` |
| `partial === true` | `Dzień niepełny — nie liczy się do dopasowania celu ani średnich.` + `Cofnij` | `Incomplete day — it doesn’t count towards fitting your target or the averages.` + `Undo` |
| closed day under 60 %, unset | `Mało zapisów jak na cały dzień — ten dzień nie liczy się do dopasowania celu ani średnich.` + `To był cały dzień` | `Not much logged for a whole day — this day doesn’t count towards fitting your target or the averages.` + `That was the whole day` |
| `partial === false` | `Liczę jako pełny dzień.` + `Cofnij` | `Counted as a complete day.` + `Undo` |
| `nothingYet` | `Nic jeszcze nie zapisane. Odhacz pozycję planu albo dodaj jedzenie — liczy się to, co naprawdę zjedzone.` | `Nothing logged yet. Tick off a plan item or add food — what counts is what you really ate.` |

**WeighCard** (one skippable prompt, shared with the Today screen through the bridge):

| state | PL | EN |
|---|---|---|
| today, no weigh-in | `Ile dziś ważysz?` + field + `Zapisz` + `Nie dziś` (`bridge.skipWeigh()`) | `What do you weigh today?` · `Not today` |
| today, skipped here or on Today | `Bez ważenia dziś.` + `Dodaj wagę` | `No weigh-in today.` · `Add weight` |
| past day, no weigh-in | `Waga tego dnia: bez ważenia.` + `Dodaj` (form title `Waga tego dnia`) | `Weight that day: no weigh-in.` · `Add` · `Weight that day` |
| has weight | unchanged (`Waga: 80,4 kg` · `Zmień` · `Postęp`) | unchanged |

**„Co teraz?”** uses `dayNeeds` with `goalKcal = targetOn(date)`. Rest variants are shown only when more than 100 remains.

| key | PL | EN |
|---|---|---|
| `left(kcal, g, meals, reserved)` | `Zostało ok. ${kcal} kcal i ${g} g białka na ${meals} ${posiłek/posiłki}${reserved ? ' — po zaplanowanym większym posiłku' : ''}. Najlepsze oznaczone gwiazdką.` | `About ${kcal} kcal and ${g} g protein left for ${meals} ${meal/meals}${reserved ? ' — after the planned bigger meal' : ''}. The best are starred.` |
| `within` | `Kalorie na dziś w zakresie celu — jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego z białkiem.` | `Calories for today are within your target — if you’d like something more, pick something light with protein.` |
| `enough` | `Na dziś kalorii już wystarczy — jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego z białkiem.` | `That’s enough calories for today — if you’d like something more, pick something light with protein.` |
| `enoughWithMeal` | `Z zaplanowanym większym posiłkiem kalorii na dziś wystarczy — reszta dnia lekko i z białkiem.` | `With the planned bigger meal, that’s enough calories for today — keep the rest of the day light, with protein.` |
| `mealCoversRest` | `Na resztę dnia zostaje zaplanowany większy posiłek.` | `The planned bigger meal takes the rest of the day.` |
| no-numbers `left` / `enough` | `Na ${meals} ${posiłek/posiłki}: białka jeszcze ${g} g. Najlepsze oznaczone gwiazdką.` / `Na dziś wystarczy — jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego z białkiem.` | `For ${meals} ${meal/meals}: ${g} g protein to go. The best are starred.` / `That’s enough for today — if you’d like something more, pick something light with protein.` |

Removed: `used` and `usedWithCheat` (with „jeśli jesteś głodny”).

**Kroki** (was „Kroki i ruch”, `MoveCard`):
- title `Kroki` / `Steps`;
- the steps field and hint are kept;
- one note:
  - PL: `Ruch nie zmienia celu jedzenia. Twój zwykły ruch jest już w celu, a gdy ruszasz się więcej przez kilka tygodni, pokaże to waga — wtedy cel sam urośnie.`
  - EN: `Activity doesn’t change your food target. Your usual activity is already in it, and if you move more for a few weeks, the scale shows it — then the target grows by itself.`
- **Removed:** „Ruch dziś: …”, „Cel a ruch: …”, „Do wieczora może jeszcze ubyć …”, „Cel zakłada 10 000 kroków …”, `notAdapted`, `futureGoal`.

**Planned bigger meal card:**
- title `Zaplanowany większy posiłek` / `Planned bigger meal`;
- an unnamed meal shows `Większy posiłek` / `Bigger meal`;
- dropped toast `Większy posiłek usunięty z planu dnia.` / `Bigger meal removed from the day’s plan.`;
- verdict from `cheatText` (§4.4);
- icon `UtensilsCrossed`.

**Plan cards** (`PlanDayCard`, `PrepDayCard`, `AutoDayCard`, `RestVariants`): unchanged in numbers mode; in no-numbers mode their kcal parts are hidden and protein stays.

**Shared words:**
- `dietText.ts`:
  - `ate`: `Zjadłem` → `Zjedzone`;
  - `ateFood(name)` → `Zjedzone: ${name}` (EN unchanged, „Eaten”);
  - new `savedPlain(name)`: `Zapisane: ${name}.` / `Saved: ${name}.`;
  - new `bigMeal`: `Większy posiłek` / `Bigger meal`.
- FavoritesSheet:
  - `hint(day)`: `„Zjedzone” zapisuje od razu ${day}, w ilości z gwiazdki.`;
  - `ateFav(name)`: `Zjedzone z ulubionych: ${name}`.
- PrepDayCard: `eat` / `eatLabel(name)` → `Zjedzone` / `Zjedzone: ${name}`.

### 4.3 Adding food — `FoodPicker.tsx`

- New props:
  - `left: number | null` (= `needs.remaining.kcal`, with the planned meal already set aside);
  - `reserved: boolean`.
- In numbers mode, a line under the chosen item:

| key | PL | EN |
|---|---|---|
| `afterLeft(kcal, past, reserved)` | `Po tym zostanie ok. ${kcal} kcal na ${past ? 'ten dzień' : 'dziś'}${reserved ? ' — po zaplanowanym większym posiłku' : ''}.` | `After this, about ${kcal} kcal left for ${past ? 'that day' : 'today'}${reserved ? ', after the planned bigger meal' : ''}.` |
| `afterFull` (−100 ≤ after ≤ 100) | `To wypełni cel na dziś.` | `That fills today’s target.` |
| `afterOver(kcal)` | `To ok. ${kcal} kcal ponad cel na dziś.` | `That’s about ${kcal} kcal over today’s target.` |

- **No-numbers mode:**
  - the line and the „Tylko kalorie” tab are hidden;
  - `MacroLine` (`SuggestionList.tsx`, used by every diet list including PartsPicker and SwapDialog) shows `B ${g} g`;
  - the toast is `DT.savedPlain`.
- Unchanged: search, favourites, sets, barcode and tap counts.

### 4.4 „Większy posiłek” — `CheatMealSheet.tsx`, `cheatText.ts`, `diet/cheat.ts`

- The target is `targetOn(date)`.
- **Removed:**
  - the „Ruch do końca dnia” fieldset (`moveLegend` … `onlySimulation`);
  - „Ruch w celu …”;
  - `weekCapped`, `weekSpread`, `sunday`, `off`;
  - the grams-on-the-scale line;
  - `offset` („Żeby to odrobić ruchem…”);
  - `fatOver`;
  - carbs-over for diets without a carb limit.
- `simulateCheat` input becomes `{ cheat, targets, eaten, mealsLeft, plannedLeftKcal }`; the result drops `week`, `kg` and `offset`.
- **Verdicts on the band:**
  - `over`: more than 100 over;
  - `full`: |left| ≤ 100;
  - `tight`: rest meals > 0 and left < 250 × rest meals;
  - `fits`, with the `last` wording when no meals remain.

| key | PL | EN |
|---|---|---|
| title / subtitle | `Większy posiłek` / `Wybierz z listy albo wpisz makro — zobaczysz, ile zostaje na resztę dnia` | `Bigger meal` / `Pick from the list or enter the macros — you’ll see what’s left for the rest of the day` |
| `over(kcal)` | `To ok. ${kcal} kcal ponad cel dnia. Jeden taki dzień nie zmienia trendu — jutro jedz po prostu jak zwykle.` | `That’s about ${kcal} kcal over the day’s target. One day like that doesn’t change the trend — tomorrow, just eat as usual.` |
| `full` | `Mieści się — to wypełnia cel dnia.` | `It fits — that fills the day’s target.` |
| `last(kcal)` | `Mieści się: to ostatni posiłek dnia, zostaje jeszcze ok. ${kcal} kcal.` | `It fits: this is the last meal of the day, with about ${kcal} kcal to spare.` |
| `tight(kcal, meals, each)` | `Mieści się na styk: zostaje ok. ${kcal} kcal na ${meals}${each}, czyli raczej przekąski.` | `It just fits: about ${kcal} kcal left for ${meals}${each}, so snacks rather than meals.` |
| `fits(kcal, meals, each)` | `Mieści się: zostaje ok. ${kcal} kcal na ${meals}${each}.` | `It fits: about ${kcal} kcal left for ${meals}${each}.` |
| `scale` (when over) | `Waga przez dzień–dwa może pokazać więcej — to woda i sól, nie tłuszcz.` | `The scale may show more for a day or two — that’s water and salt, not fat.` |
| protein, plan texts | unchanged | unchanged |
| result rows | `Cel na dziś` / `Cel tego dnia` · `Zjedzone` · `Większy posiłek` · `Razem` | `Today’s target` / `Target that day` · `Eaten` · `Bigger meal` · `Total` |
| parts picker | `W większym posiłku` · `Szukaj do większego posiłku` · `Usuń z większego posiłku` | `In the bigger meal` · `Search for the bigger meal` · `Remove from the bigger meal` |
| planned toast | `Większy posiłek zaplanowany: ${label} · ${kcal}. Reszta dnia liczy się już z nim.` | `Bigger meal planned: ${label} · ${kcal}. The rest of the day now counts with it.` |
| button `eatenNow` | `Zjedzone teraz` | `Eaten now` |

The button and the sheet are hidden in no-numbers mode.

### 4.5 Diet profile, „Jak liczę cel”, onboarding — `DietProfilePage.tsx`, `Onboarding.tsx`, `diet/edit.ts`

**Layout** (about 10 visible controls instead of 17–22):
1. **„Zacznij od profilu” / „Ty”:**
   - Płeć, Wiek, Wzrost (shared with training);
   - new profile: „Ile ważysz teraz” (sets `startWeightKg`);
   - existing profile: read-only `Waga teraz`, plus a closed „Start diety” (Waga na starcie, Start).
2. **„Twój cel”:**
   - three choices;
   - „Waga docelowa” for lose/gain: empty and required for a new profile, prefilled for an existing one;
   - for keep, `targetWeightKg = trend` (one decimal);
   - K only: „Jestem w ciąży lub karmię piersią”;
   - under 18 the section is replaced by `under18`.
3. **„Twój zwykły tydzień”:**
   - 4 radio cards, with `inactive` preselected for new profiles;
   - the steps hint when ≥ 7 of the last 14 days have steps;
   - anchored: inside a closed „Odpowiedzi do pierwszego szacunku” with `anchored`.
4. **„Tempo”** (lose/gain):
   - chips by direction (plus „(obecne)”), unsafe ones disabled with the reason beneath;
   - the result line;
   - the estimate line (not anchored) or the last-check line;
   - a closed „Ustaw cel ręcznie”.

   For keep: the result line and the manual details only.
5. **„Jak liczę cel”**: closed; opened and scrolled to by `?jak=1`.
6. **„Ustawienia liczenia”**: Dopasowuj cel co tydzień; Bez liczenia kalorii (forced and disabled under 18); Przerwa.
7. Sposób odżywiania (5 cards, macro line at the current target) — unchanged.
8. Sklep — unchanged.
9. Save bar — unchanged.
10. DataSection — unchanged.

**Save** (`applyProfileEdit(prev, draft, ctx)` in `diet/edit.ts`, then `saveProfileEdit`):
- Anchored, and sex/age/height/level changed → rebase `burnOffset` at `kgNow` (§2.5).
- New target:
  - the manual value if set, with `goalPace = clamp(snap05(impliedPace(draft, kgNow, manual)), safePace range)`;
  - else `targetFor(draft, kgNow)`.

  It is recomputed only when the direction, pace, manual value or (unanchored) body/level changed. Otherwise it is kept, so a migrated 1860 never re-rounds.
- Target changed → `setTarget(kcal, today, 'user')` and `hold = {dir: 0, until: today + 14}`. If |Δ| ≥ 300 or the direction changed → `settle = {from: today + 14, why: 'change'}`.
- Validation blocks the save and moves focus to the first invalid field:
  - target weight below `minHealthyKg`;
  - target weight on the wrong side of the trend for the direction;
  - manual < hardMin;
  - manual < floor without the checkbox.
- Under 18 → `goalPace` 0 and `hidesKcal`; pregnancy → `goalPace` 0.
- New profile: `goals = [{from: today, kcal, by: 'setup'}]`, `lastCheck` setup, `settle` start.

| key | PL | EN |
|---|---|---|
| `lead` | `Z tych kilku odpowiedzi liczę Twój dzienny cel kalorii i białka. Wszystko zostaje na tym urządzeniu. Masz arkusz z planem? Wczytaj go — parametry i plan posiłków przyjdą razem.` | `From these few answers I work out your daily calorie and protein target. Everything stays on this device. Got a workbook with a plan? Import it — the settings and the meal plan come along.` |
| `weightNowField` / `weightNow(kg)` / `noWeighIns(kg)` | `Ile ważysz teraz` / `Waga teraz: ${kg} kg (trend z ważeń).` / `Bez ważeń — liczę z wagi na starcie (${kg} kg).` | `Your weight now` / `Weight now: ${kg} kg (trend from your weigh-ins).` / `No weigh-ins — I use your starting weight (${kg} kg).` |
| `startTitle` | `Start diety` | `Diet start` |
| `goalTitle` / options | `Twój cel` / `Schudnąć` · `Utrzymać wagę` · `Przybrać` | `Your goal` / `Lose weight` · `Keep my weight` · `Gain weight` |
| `targetWeight` / `targetMissing` | `Waga docelowa` / `Wpisz wagę docelową.` | `Target weight` / `Enter your target weight.` |
| `targetSideLoss` / `targetSideGain` | `Przy tym celu waga docelowa powinna być niższa niż obecna.` / `…wyższa niż obecna.` | `For this goal the target weight should be below your current weight.` / `…above your current weight.` |
| `minTarget(kg)` | `Najniższa waga docelowa przy Twoim wzroście to ${kg} kg (BMI 18,5).` | `The lowest target weight for your height is ${kg} kg (BMI 18.5).` |
| `pregnancy` / hint | `Jestem w ciąży lub karmię piersią` / `W ciąży i podczas karmienia nie ustawiam deficytu ani nie dopasowuję celu z wagi. Potrzeby są wtedy wyższe — ile jeść, ustal z lekarzem lub położną.` | `I’m pregnant or breastfeeding` / `During pregnancy and breastfeeding I don’t set a deficit or fit the target to your weight. Your needs are higher then — agree how much to eat with your doctor or midwife.` |
| `levelTitle` | `Twój zwykły tydzień` | `Your usual week` |
| inactive | `Głównie siedzę` — `Praca przy biurku, dojazdy autem lub komunikacją; treningi do 2–3 razy w tygodniu.` | `Mostly sitting` — `Desk job, commuting by car or public transport; workouts up to 2–3 times a week.` |
| low | `Codziennie ok. godziny ruchu` — `Spacery, rower do pracy albo trening prawie każdego dnia.` | `About an hour of activity every day` — `Walks, cycling to work or a workout almost every day.` |
| active | `Dużo ruchu` — `Praca na nogach albo codziennie półtorej godziny treningu, w tym intensywnego.` | `A lot of activity` — `On your feet at work, or an hour and a half of training a day, some of it hard.` |
| very | `Bardzo dużo ruchu` — `Praca fizyczna albo ponad 2 godziny intensywnego treningu dziennie.` | `A great deal of activity` — `Physical work, or over 2 hours of hard training a day.` |
| `stepsHint(avg)` | `Twoja średnia z ostatnich 2 tygodni: ${avg} kroków dziennie.` | `Your average over the last 2 weeks: ${avg} steps a day.` |
| `anchoredTitle` / `anchored` | `Odpowiedzi do pierwszego szacunku` / `Spalanie liczę już z Twoich danych, więc zmiana tutaj nie przesunie celu. Jeśli Twój ruch zmienił się na stałe, waga pokaże to w 3–5 tygodni i cel dopasuje się sam — szybciej możesz ustawić cel ręcznie.` | `Answers for the first estimate` / `I already work out your burn from your data, so changing this won’t move the target. If your activity changed for good, the scale shows it in 3–5 weeks and the target adjusts by itself — or set the target yourself.` |
| `paceTitle` / chips | `Tempo` / `utrzymanie`, `−0,25 kg/tydz.` …, `${pace} (obecne)` | `Pace` / `maintenance`, `−0.25 kg/wk` …, `${pace} (current)` |
| `paceLimited(floor)` | `Szybsze tempo byłoby dla Ciebie za szybkie (ponad 1% masy ciała na tydzień) albo zeszłoby poniżej bezpiecznego minimum ${floor} kcal.` | `A faster pace would be too fast for you (over 1% of body weight a week) or go below the safe minimum of ${floor} kcal.` |
| `result(kcal, g)` | `Cel: ${kcal} kcal dziennie · białko co najmniej ${g} g` | `Target: ${kcal} kcal a day · protein at least ${g} g` |
| `estimate` | `To pierwszy szacunek — u większości ludzi trafia z dokładnością do ok. 300 kcal. Po 4–5 tygodniach ważenia i zapisów dopasuję go do Ciebie.` | `This is a first estimate — for most people it’s within about 300 kcal. After 4–5 weeks of weigh-ins and logs I’ll fit it to you.` |
| `lastCheck(date, changed)` | `Ostatnie sprawdzenie: ${date} — ${changed ? 'cel zmieniony' : 'cel bez zmian'}.` | `Last check: ${date} — ${changed ? 'target changed' : 'target unchanged'}.` |
| `manual` / field / `implied(pace)` | `Ustaw cel ręcznie` / `Dziennie (kcal)` / `Tempo przy tym celu: ok. ${pace} na tydzień` | `Set the target yourself` / `Daily (kcal)` / `Pace at this target: about ${pace} a week` |
| `minError(min)` | `Najniżej ${min} kcal.` | `At least ${min} kcal.` |
| `belowFloor(floor)` + checkbox | `To mniej niż Twoja podstawowa przemiana materii (${floor} kcal) — trudno wtedy dostarczyć wszystkie składniki i łatwo stracić mięśnie.` + `Ten cel jest ustalony z lekarzem albo dietetykiem` | `That’s below your basal metabolic rate (${floor} kcal) — it’s hard to get every nutrient and easy to lose muscle.` + `This target is agreed with a doctor or dietitian` |
| `under18` | `Poniżej 18 lat nie ustawiam deficytu ani nie pokazuję kalorii — jedzenie ma wspierać wzrost i trening. Dziennik pokaże białko i podpowie posiłki.` | `Under 18 I don’t set a deficit or show calories — food should support growing and training. The diary shows protein and suggests meals.` |
| `lowBmi` | `Przy BMI poniżej 18,5 nie ustawiam deficytu — wybierz utrzymanie albo przybieranie.` | `With a BMI under 18.5 I don’t set a deficit — pick maintenance or gaining.` |
| `settingsTitle` | `Ustawienia liczenia` | `Counting settings` |
| `autoAdjust` | `Dopasowuj cel co tydzień — w poniedziałki, o 100 kcal, zawsze z wyjaśnieniem; zanim obniżę cel z powodu niższego spalania, pytam. Wyłączone: tylko podpowiadam.` | `Fit the target every week — on Mondays, by 100 kcal, always with an explanation; I ask before lowering it because you seem to burn less. Off: I only suggest.` |
| `hideKcal` | `Bez liczenia kalorii — dziennik pokaże białko i podpowie posiłki, ale bez kalorii.` | `No calorie counting — the diary shows protein and suggests meals, but no calories.` |
| `pause` | `Przerwa` — `Na urlop albo chorobę: cel to utrzymanie wagi, a dopasowanie czeka.` · `Przerwa na tydzień` · `Na 2 tygodnie` · active `Przerwa do ${date}.` · `Zakończ przerwę` | `Break` — `For a holiday or illness: your target is maintenance and fitting waits.` · `A week’s break` · `2 weeks` · `Break until ${date}.` · `End the break` |

**„Jak liczę cel”:**

| # | PL | EN |
|---|---|---|
| 1 | `Na start: ze wzoru NASEM 2023 (płeć, wiek, wzrost, waga i Twój zwykły tydzień) wychodzi, ile spalasz. Wzór powstał z pomiarów metodą podwójnie znakowanej wody, ale u jednej osoby myli się zwykle o ok. 250–350 kcal — dlatego to tylko punkt startu.` | `To start: the NASEM 2023 equation (sex, age, height, weight and your usual week) gives how much you burn. It was built from doubly labelled water measurements, but for one person it’s typically off by about 250–350 kcal — so it’s only a starting point.` |
| 2 | `Od tego odejmuję tyle, ile wymaga tempo: ${pace} tygodniowo to ok. ${deficit} kcal dziennie.` (keep: `Przy utrzymaniu niczego nie odejmuję.`; gain: `…dodaję…`) | `From that I take what your pace needs: ${pace} a week is about ${deficit} kcal a day.` (keep: `For maintenance I take nothing off.`; gain: `…I add…`) |
| 3 | `W poniedziałki porównuję zapisane jedzenie z trendem wagi z ostatnich 4 tygodni. Wierzę tylko tej części różnicy, której waga i zapisy są pewne, i zmieniam cel najwyżej o 100 kcal na tydzień. Gdy ważysz mniej, obniżam cel od razu — tyle mniej spalasz. Gdy wychodzi, że spalasz mniej, niż liczyłem, najpierw pytam, czy zapisujesz prawie wszystko. Nie obniżam go, gdy chudniesz szybciej, niż zakłada plan.` | `On Mondays I compare your logged food with your weight trend over the last 4 weeks. I only trust the part of the difference your weight and logs are sure of, and I change the target by at most 100 kcal a week. When you weigh less, I lower it straight away — you burn that much less. When it looks like you burn less than I assumed, I first ask whether you log almost everything. I don’t lower it while you’re losing faster than planned.` |
| 4 | `Pierwsze 2 tygodnie po starcie, po dużej zmianie celu i po przerwie pomijam — waga zmienia się wtedy głównie przez wodę.` | `I skip the first 2 weeks after the start, a big change of target and a break — weight then changes mostly through water.` |
| 5 | `Kroki, treningi i zegarek nie zmieniają celu: kalorie z ruchu to szacunek z błędem 20–30% i większym, a ciało część z nich oddaje, oszczędzając gdzie indziej. Więcej ruchu na dłużej widać w wadze — i stamtąd trafia do celu.` | `Steps, workouts and the watch don’t change the target: activity calories are an estimate that’s 20–30% off or more, and the body gives some of them back by saving elsewhere. More activity over time shows on the scale — and reaches the target from there.` |
| 6 | `Bezpieczeństwo: nie schodzę poniżej Twojej podstawowej przemiany materii (chyba że cel jest ustalony z lekarzem albo dietetykiem) i nigdy poniżej 1500 kcal (mężczyźni) i 1200 kcal (kobiety). Tempo ograniczam do 1% masy ciała na tydzień, a poniżej 18 lat, przy BMI poniżej 18,5 i w ciąży nie ustawiam deficytu.` | `Safety: I don’t go below your basal metabolic rate (unless your target is agreed with a doctor or dietitian), and never below 1,500 kcal (men) or 1,200 kcal (women). Pace is capped at 1% of body weight a week, and under 18, with a BMI below 18.5 or in pregnancy I don’t set a deficit.` |
| 7 | `Teraz liczę, że spalasz ok. ${burn} kcal dziennie.` | `Right now I reckon you burn about ${burn} kcal a day.` |
| foot | `Aplikacja nie zastępuje dietetyka ani lekarza.` | `The app doesn’t replace a dietitian or a doctor.` |

Bullet 7 and the result line are hidden in no-numbers mode.

**Removed from the profile:**
- the multiplier levels („× 1.28”) and `customFactor`;
- `targetSteps`, `advanced` and its 5 fields, `correctionHint`;
- the 4 tiles and `countedFor`;
- the kcal on each chip;
- the warnings box (`belowBmr`, `tooFew`, `tooFast`, `gainTooFast`, `surplus`, `deficit`, `keepMoves`), replaced by disabled chips and inline errors. A manual pace over 1 % shows, without blocking:
  - PL: `Przy tym celu tempo wychodzi ponad 1% masy ciała na tydzień — zwykle za szybko, by utrzymać mięśnie.`
  - EN: `At this target the pace is over 1% of body weight a week — usually too fast to keep your muscle.`
- both adapt checkboxes.

**Onboarding** (`Onboarding.tsx`, the diary without a profile):

| key | PL | EN |
|---|---|---|
| `lead` | `Zapisujesz, co jesz, a dziennik pokazuje, ile zostało na dziś — kalorii i białka.` | `You log what you eat, and the diary shows what’s left for today — calories and protein.` |
| bullet 3 | `Cel jest jeden na cały dzień, a co tydzień dopasowuję go do Twojej wagi.` | `There’s one target for the whole day, and every week I fit it to your weight.` |
| `data` | `Cel liczę z kilku odpowiedzi w profilu diety. Wagę, wzrost i kroki biorę z treningów — wpisujesz je raz. Wszystko zostaje na tym urządzeniu.` | `I work out your target from a few answers in the diet profile. Weight, height and steps come from training — you enter them once. Everything stays on this device.` |
| buttons | `Ustaw profil diety` (primary) · `Bez liczenia kalorii` (secondary → `#/jedzenie/profil?tryb=bez-liczb`, the profile opens with the switch on) | `Set up your diet profile` · `No calorie counting` |
| `plainHint` | `Dziennik pokaże białko i podpowie posiłki, bez kalorii. Zmienisz to w profilu.` | `The diary shows protein and suggests meals, without calories. You can change it in the profile.` |

### 4.6 Progress — `DietProgressPage.tsx`, `WeekTable.tsx`, `WeightChart.tsx`, `diet/weeks.ts`

**Layout:**
1. three tiles;
2. weight chart with the pace and reach lines;
3. „Cel kalorii — zmiany”;
4. „Tydzień po tygodniu” (plus findings, when any qualify);
5. „Kalorie – ostatnie 14 dni”;
6. „Białko – ostatnie 7 dni”.

| key | PL | EN |
|---|---|---|
| tile 1 | `Teraz (trend)` · `${kg} kg` · `ostatnie ważenie ${day}` / `brak ważenia` | `Now (trend)` · `last weigh-in ${day}` / `no weigh-in yet` |
| tile 2 | `Od startu` · signed kg · `od ${date}` | `Since the start` · `since ${date}` |
| tile 3 | `Do celu` · kg / `cel osiągnięty` / `utrzymanie` · `waga docelowa ${kg}` | `To go` · `target reached` / `maintenance` · `target weight ${kg}` |
| chart aria / legend | `Wykres wagi: ${n} pomiarów, trend${proj ? ', prognoza' : ''} i waga docelowa ${kg} kg.` / `pomiary · trend · prognoza · waga docelowa` | `Weight chart: ${n} weigh-ins, the trend${proj ? ', a forecast' : ''} and the target weight ${kg} kg.` / `weigh-ins · trend · forecast · target weight` |
| `pace(weeks, kg, se)` | `Tempo z ostatnich ${weeks} tygodni: ${kg} na tydzień (±${se}).` | `Pace over the last ${weeks} weeks: ${kg} a week (±${se}).` |
| `noPace` | `Za mało ważeń, żeby policzyć tempo — potrzebuję co najmniej 5 z 2 tygodni. Najlepiej waż się rano, kilka razy w tygodniu.` | `Too few weigh-ins to work out a pace — I need at least 5 over 2 weeks. Weigh yourself in the morning, a few times a week.` |
| `planWeeks(pace, weeks)` | `Przy zakładanym tempie (${pace} na tydzień) to ok. ${weeks} tygodni. Prognozę z Twoich danych pokażę po pierwszym dopasowaniu celu.` | `At the planned pace (${pace} a week) that’s about ${weeks} weeks. I’ll show a forecast from your data after the first fit of your target.` |
| `reach(range)` / `reachEarliest(month)` | `W tym tempie waga docelowa: ok. ${range}.` / `W tym tempie waga docelowa najwcześniej: ${month}.` | `At this pace, the target weight: around ${range}.` / `At this pace, the target weight at the earliest: ${month}.` |
| `reachFar` / `keepLine` | `Przy tym tempie waga docelowa jest dalej niż 2 lata.` / `Cel to utrzymanie wagi.` | `At this pace the target weight is more than 2 years away.` / `Your goal is to keep your weight.` |
| months (nominative) | styczeń, luty, marzec, kwiecień, maj, czerwiec, lipiec, sierpień, wrzesień, październik, listopad, grudzień — `luty–kwiecień 2027`, `grudzień 2026 – luty 2027`, `marzec 2027` | `February–April 2027`, `December 2026 – February 2027`, `March 2027` |
| history | `Cel kalorii — zmiany`; `${date} · ${kcal} kcal · ${who}`; who: `start` / `Twoja zmiana` / `dopasowanie z wagi i zapisów` / `przejście na nowe liczenie` / `przerwa` / `bezpieczne minimum` | `Calorie target — changes`; `start` / `your change` / `fitted from weight and logs` / `switch to the new counting` / `break` / `safe minimum` |
| weeks | `Tydzień po tygodniu`; lead `Jedzenie to średnia z pełnych dni, waga — zmiana z ważeń w tygodniu (potrzeba co najmniej 3).`; when no finding qualifies the lead adds `Wnioski pokażę, gdy różnica między tygodniami będzie wyraźnie większa niż szum wagi.`; heads `Tydzień · Waga · Jedzenie · Kroki · Treningi`; food cell `${avg}` + small `${n} ${dzień/dni}`; weight `–` with title `Za mało ważeń w tym tygodniu (potrzeba 3)` | `Week by week`; `Food is the average of complete days, weight is the change from the week’s weigh-ins (at least 3 needed).`; `I’ll show findings when the difference between weeks is clearly bigger than the scale’s noise.`; `Week · Weight · Food · Steps · Workouts`; `Too few weigh-ins this week (3 needed)` |
| findings | title `Co idzie w parze z postępem`; habit texts as today; `Średnio ${more} (${moreWeeks}) · w pozostałych ${less} (${lessWeeks}).`; `W tych tygodniach waga szła wyraźnie szybciej w stronę celu.` / `…wolniej w stronę celu.`; food-gap sentence as today; caveat `To skojarzenia z Twoich tygodni, nie dowód.` | `What goes with progress`; `On average ${more} (${moreWeeks}) · in the other weeks ${less} (${lessWeeks}).`; `In those weeks your weight moved clearly faster toward your goal.` / `…clearly slower toward your goal.`; `These are associations from your weeks, not proof.` |
| 14 days | `dayKcal(day, eaten, goal, partial)`: `${day}: ${eaten === null ? 'brak zapisów' : eaten + ' kcal'}, cel ${goal}${partial ? ' – dzień niepełny' : ''}`; legend `Kreska: cel dnia · jasny słupek: dzień niepełny.` | `…, target ${goal}${partial ? ' – incomplete day' : ''}`; `Line: the day’s target · light bar: incomplete day.` |
| protein | `Białko – ostatnie 7 dni`; `Średnio ${avg} g dziennie (cel ${t} g), z ${n} ${dnia/dni} z pełnymi danymi.`; keto/low carb adds `Węglowodany: średnio ${avg} g (limit ${max} g).`; none `Brak zapisów z ostatniego tygodnia.` | `Protein – last 7 days`; `${avg} g a day on average (target ${t} g), from ${n} ${day/days} with full data.`; `Carbs: ${avg} g on average (limit ${max} g).`; `Nothing logged in the last week.` |

- **Chart:**
  - raw weigh-ins as faint dots;
  - the EMA trend line;
  - a dashed straight projection from today's trend at the pace used for the reach text, at most 365 days ahead;
  - the target weight line;
  - `WeightChart` props: `{ start, today, measured, trend, projection, target }`.
- **`weeks.ts`:**
  - `DayFacts.goal = targetOn(d)`, plus `DayFacts.complete`;
  - food average over complete days before today;
  - per-week weight change = least-squares slope from Monday to the next Monday, with ≥ 3 weigh-ins spanning ≥ 4 days;
  - `verdict` removed; steps goal `STEP_GOAL`;
  - findings rule as in §2.8: `MIN_WEEKS = 8`, `MIN_GROUP = 3`, `diff ≥ 0.1`, `|diff| ≥ 2.6·√(s²₁/n₁ + s²₂/n₂)`;
  - `strength` and `WEAK_R` removed;
  - table columns snacks/cardio/minutes and the day grid removed.
- **No-numbers mode:** the history, the 14-day chart and the weeks „Jedzenie” column are hidden.
- **Removed:** the plan line; `planReach`, `planNever`, `fromWeighing*`; „Z zapisów jedzenia wynikałoby…”; the day grid; good/bad colours; the „Makroskładniki” status words; orange bars.

### 4.7 Meal plan page and meal prep

- **`DietPlanPage.tsx`:**
  - the `Cel` column shows `targetOn(profile, d)` for d ≥ today;
  - the over styling and `overGoal` are removed;
  - the column is hidden in no-numbers mode.
- **`PrepForm.tsx` „Cel planu”:**
  - remove the radio fieldset, `check.reason`, `working`, `kcalLegend`, `fitted`, `recommended`, `asProfile`, `willSave` and the toast `readyGoal`;
  - keep `goalLine` (pace `goalPace`, weight = trend);
  - add `Cel z profilu diety. Dopasowuje się w poniedziałki — plan bierze dzisiejszy.` / `The target from your diet profile. It’s fitted on Mondays — the plan uses today’s.`;
  - new plans get `PrepGoal.source = 'profile'` and `checkIn = null`.
- **`prep/targets.ts`:** `planTargets({ profile, kcal, dates })` gives every date the same targets.
- **`prep/checkin.ts`:** only the legacy `CheckIn` type and statuses remain, for stored plans and their validator.
- **`PrepPlanView.tsx`:**
  - the stale note shows only when |plan kcal − `targetOn(today)`| ≥ 200 or the diet style differs;
  - „(dopasowany do postępów)” stays for old plans.

### 4.8 „Zjedz teraz” and the scanner

**`useEatNow`:** `goalKcal = targetOn(profile, today)`; it calls `useWeeklyCheck`; no activity; the planned bigger meal is reserved; `hidesKcal` is exposed.

**`EatNow.tsx`:**

| key | PL | EN |
|---|---|---|
| `budget` | unchanged (`ok. ${kcal} kcal i ${g} g białka na ten posiłek — zostało ${left} kcal na ${n} posiłki.`, round10) | unchanged |
| `done(eaten, goal)` (remaining ≤ 100) | `Na dziś kalorii już wystarczy (${eaten} z ${goal} kcal). Jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego.` | `That’s enough calories for today (${eaten} of ${goal} kcal). If you’d like something more, pick something light.` |
| `budgetPlain(g)` | `Na ten posiłek: coś z ok. ${g} g białka.` | `For this meal: something with about ${g} g protein.` |
| `donePlain` | `Na dziś wystarczy — jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego.` | `That’s enough for today — if you’d like something more, pick something light.` |

**`ScanSheet.tsx`** (on the band):

| condition | PL | EN |
|---|---|---|
| left ≤ 100 | `Na dziś: kalorii już wystarczy.` | `For today: that’s enough calories.` |
| after ≥ −100 | `Na dziś: mieści się — zostało ok. ${left} kcal.` | `For today: it fits — about ${left} kcal left.` |
| after < −100 | `Na dziś: ok. ${by} kcal więcej, niż zostało (ok. ${left} kcal).` | `For today: about ${by} kcal more than is left (about ${left} kcal).` |

The line is hidden in no-numbers mode.

### 4.9 Gym side

- **`SessionHome.tsx` training card,** when `hasDiet()`: `burnTime(min)`. Without a diet it is unchanged.
  - PL: `Na Twoim poziomie to ok. ${min} min serii z przerwami.`
  - EN: `At your level that’s about ${min} min of sets with rests.`
- **`Cardio.tsx` `CardioCard`,** when `hasDiet()`:
  - the heading is `T.cardSteps(steps, null)` / `T.cardEntries(n)` (no kcal);
  - the `cardBurn` / `cardNoKg` line is hidden.
- **Cardio page,** when `hasDiet()`, under the lead, `notFood`:
  - PL: `Te kalorie to szacunek (±20–30%). Dziennik jedzenia ich nie dolicza — cel jedzenia dopasowuje się co tydzień do Twojej wagi.`
  - EN: `These calories are an estimate (±20–30%). The food diary doesn’t add them — your food target adjusts weekly to your weight.`
- **„Jak liczymy” last paragraph:** „Kalorie nie są zaleceniem żywieniowym — ile i co jeść, ustala się z dietetykiem.” becomes:
  - PL: `Kalorie nie są zaleceniem żywieniowym. Dziennik jedzenia nie dolicza ich do celu — cel jedzenia dopasowuje się co tydzień do wagi i zapisów.`
  - EN: `Calories are not nutrition advice. The food diary doesn’t add them to your target — the food target adjusts weekly to your weight and logs.`
- **Unchanged:** every gym kcal formula, the workout summary, `Health.tsx`.

### 4.10 No-numbers mode (`hidesKcal(p)`)

| surface | numbers mode | no-numbers mode |
|---|---|---|
| Today card | headline + 2 bars | protein headline + protein bar |
| Day card | §4.2 | protein row only, no carbs/fat, no partial line |
| Lists (`MacroLine`), Zjedzone | kcal · B · W · T | `B ${g} g` |
| „Co teraz?” | kcal + protein | protein only |
| Monday card, quiet lines | shown | hidden; the numberless `reached` card is shown; the check never cuts |
| Change notice | with target | without numbers |
| „Większy posiłek” | shown | hidden |
| FoodPicker after-line, „Tylko kalorie” | shown | hidden |
| Toasts | `· 120 kcal` | none |
| Plan cards (plan, prep, auto day, rest variants) | kcal | protein only |
| Progress history, 14-day chart, weeks food column | shown | hidden |
| Profile result line, how bullet 7 | shown | hidden |
| Zjedz teraz budget / scanner „Na dziś” | shown | `budgetPlain` / hidden |
| Product, recipe, restaurant pages, meal-prep planner | unchanged | unchanged (food data) |

The `KcalShown` context (`components/diet/kcalShown.ts`, default `true`) is provided by `DiaryPage` and `TodayFoodCard`; portals inherit it.

### 4.11 Watch check — „Czy mój zegarek jest obsługiwany?”

**Placement:**
- the first view of the Garmin card when there is no key (`Garmin.tsx`);
- `#/zegarek`:
  - an alias of Settings + the watch card;
  - `?model=<id|text>` prefills the check;
  - a device link skips the automatic intro for that visit, without setting `introSeen`;
- a quiet, dismissible link on the steps form and the Cardio page;
- the phone card's Garmin sentence links to it;
- the first item of „Dane nie przychodzą?” when no model is remembered.

Not in the intro, on Today, or on the privacy page.

**One main action per state:**

| state | main action | quiet |
|---|---|---|
| idle | „Sprawdź” | „Połącz bez sprawdzania” · „Mam już klucz z innego urządzenia” |
| supported | „Połącz zegarek” | „Mam już klucz z innego urządzenia” |
| not supported | the phone route („Zdrowie z telefonu” → or „Wpisz kroki →”) | „Połącz mimo to” · „Mam już klucz z innego urządzenia” |

**Layout (360 px):**
```
Zegarek Garmin
<intro>
Jaki masz zegarek?
[ np. Forerunner 265, fēnix 7, Venu 3   ×] [Sprawdź]
  ┌ Forerunner® 265          obsługiwany ┐   (≤ 8 options; ≤ 5 when innerHeight < 700; "i N więcej — dopisz numer modelu")
Popularne: [Forerunner 55][Forerunner 165][Forerunner 265][Venu 3][vívoactive 5][fēnix 7]   (only while empty and no result)
┃ <h3 tabindex=-1>Forerunner® 265 · ✓ Obsługiwany</h3>
┃ Przyjdą same: kroki, przejazdy rowerem, tętno, stres i Body Battery.
┃ [Połącz zegarek]
┃ ▸ Więcej   (same-answer names, phone note, Connect IQ version, APAC note, „Coś nie działa? Napisz do autora”)
▸ Gdzie znajdę nazwę modelu?
▸ Wszystkie obsługiwane zegarki — 118 modeli   (rendered on first open)
Lista według danych Garmina z października 2026.
[Mam już klucz z innego urządzenia]
```

**Negative card, top to bottom:**
1. the heading;
2. **„Podobna nazwa, inna odpowiedź” directly under it, as a question:** „Masz może [fēnix® 5 Plus]? To inny model — obsługiwany, bez części danych.”;
3. the reason;
4. the „Zamiast tego — telefon” box with its primary link;
5. „Połącz mimo to”.

**Four visual states.** Each has an icon and a word; colour only supports them (tokens `--ok`, `--warn`, `--c-orange-ink`, `--ink-soft`).

| state | words | icon |
|---|---|---|
| `ok` | „Obsługiwany” | CircleCheck |
| `part` | „Obsługiwany, bez części danych” | CircleAlert |
| `no` | „Nieobsługiwany” / „Jeszcze nieobsługiwany” | CircleX |
| `other` | „To nie Garmin” / „Nie znam …” | CircleHelp |

- "Works after an update" is a field (`newest`), shown in „Więcej” and as connection step 1, never a headline.
- Connect IQ versions never appear in headlines.

**Interaction and accessibility:**
- **Combobox:** WAI-ARIA (`role=combobox`, `aria-autocomplete=list`, `aria-expanded`, `aria-controls`, `aria-activedescendant`), built on the `ExercisePicker` / `.picker*` pattern.
- **Suggestions** from 2 characters (typing mode, `useDeferredValue`), with nothing auto-highlighted.
- **Keys:** ↓/↑ move; Enter picks the highlight or submits; Escape closes, then clears; Tab closes.
- **Mouse:** options use `onMouseDown preventDefault`.
- **Focus:** every selection moves focus to the result `h3`. The field does **not** select its text on focus.
- **Screen readers:** a polite `sr-only` count, announced after 500 ms without typing.
- **Inputs:** targets ≥ 44 px; `enterKeyHint="search"`; autocomplete, autocorrect and spellcheck off.
- A remembered model or `?model=` shows its result on load without moving focus.
- **CSS:** new `.wc-*` classes in `src/styles.css` next to `dev-*`; no new colour tokens.
- **Icons:** lucide-react, inside the lazy chunk.

**Ranking (typing mode):**
1. supported Garmin models, popular before others;
2. then unsupported Garmin;
3. then other brands.

Within a group, by score. As a result, „fo” no longer starts with Forerunner 10, „ve” no longer with COROS/Fitbit, and „ga” no longer with GarminActive.

**Matching.** Port `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/proto/find.ts` into `src/watches/find.ts`: pure, no DOM, no i18n.
- **Normalising:**
  - fold case and diacritics (NFD + ł→l); drop ®™©; "+" → plus;
  - split at letter–digit boundaries; join `wi fi` / `vivo active`;
  - generation words → genN; sizes → `47mm`; `m` after a number → music;
  - APAC words set a region flag.
- **Synonyms** (also with Polish endings): fr/foreathlete→forerunner, feniks/phoenix→fenix, instynkt/instinkt→instinct, va/vivoaktive/vivoactiv→vivoactive, square→sq.
- Noise words are ignored; soft words cost a little.
- **Per-word scores:**
  - exact 1;
  - number vs size/genN 0.9;
  - Polish ending 0.95;
  - prefix of the last word in typing mode 0.75 (0.6 for numbers);
  - typo 0.6 (OSA: 1 edit for 4–7 letters, 2 for 8+, **never in a word with a digit**).
- Exact matches drop typo-only ones; glued words are split.

**Fixes required by the critique** (each a test):
- **Noise words:** add `stary, stara, stare, starego, nowy, nowa, nowe, jakiś, jakis, chyba, to, jest`. „stary garmin” = prompt (not Star Wars); „mój zegarek to fenix 7” = fēnix 7.
- **Synonyms:** add `muzyka → music`, `szafir → sapphire`. „forerunner 255 muzyka” = Forerunner® 255 Music.
- **Glued suffix:** `sm` right after a number → `s music`. „forerunner255sm” = Forerunner® 255s Music.
- When every match is a typo → answer kind `guess`, never a verdict.
- The title keeps every number the person typed („265” → „Forerunner® 265”).
- „nie wiem” / „nie znam” / „nie pamiętam” → answer kind `help`, which opens and focuses „Gdzie znajdę nazwę modelu?”.
- **`extra.ts`:**
  - Xiaomi aliases „mi band”, „smart band”, „xiaomi smart band”, „redmi watch” (open line) → „mi smart band 9” = other brand Xiaomi;
  - a brand-only query titles with the brand's watch line („samsung” → „Samsung Galaxy Watch”, not „Samsung Gear”).
- APAC never changes the headline unless the query has a region word or a „Dual Power” name (locked by test).

**API:**
- `suggest(q, limit): { hits, total }`;
- `answer(q): Answer` (`prompt | help | one | line | guess | unknown`);
- `answerFor(key)`;
- list helpers.

Answer rules are otherwise as in the watch design: the family is every hit within 1.2 of the top score; line view when only line words were typed and the answers differ; guess by dropping one word; unknown with the 3 numerically nearest models.

**Data.**
- `src/watches/garmin.json` is generated by `scripts/garmin/watches.ts`:
  - run with `npm run garmin:watches`; flags `--store` and `--check`;
  - devices folder `CIQ_DEVICES`, default `~/Library/Application Support/Garmin/ConnectIQ/Devices`; the SDK version comes from `current-sdk.cfg`;
  - inputs: `garmin/manifest.xml`, the SDK `compiler.json` + `<id>.api.debug.xml`, and the committed trimmed store catalog `garmin/store-devices.json` (343 entries).
- **Capabilities** come from the newest part with Polish (the global version); the API must be listed and CIQ must be ≥ 3.3:
  - stress `getStressHistory`;
  - Body Battery `getBodyBatteryHistory`;
  - rides `getUserActivityHistory`.
- `newest`, `apac.lacks`, aliases and unsupported reasons are as in the watch design.
- **New field `bg: 32 | 64`** (background memory).
- Output is deterministic. `--write-manifest` and `--verify-store` are out of this round.
- **Hand-kept `src/watches/extra.ts`:** noCiq, notWatch, notYet (MARQ Gen 3 ×6), the 4 refused APAC parts, 17 brands with `open: true`, Apple Watch with `only: 'ios'`, `NICKNAMES`, `POPULAR = ['fr55','fr165','fr265','venu3','vivoactive5','fenix7']`.
- **Classes today:**
  - 111 full;
  - fēnix 5 Plus ×3 without Body Battery (stress and rides on the newest firmware);
  - 4 without stress, Body Battery or rides (D2 Air, FR 645 Music, vívoactive 3 Music, Venu Mercedes-Benz);
  - APAC gaps;
  - 58 unsupported SDK devices.

**Remembered model.**
- Stored as `localStorage['gt-garmin-model'] = {key, name, v, lacks?, newest?, bg?}` via `src/watches/remember.ts` (`rememberedWatch`, `rememberWatch`, `forgetWatchModel`).
- Every access is in try/catch, and the shape is checked on read.
- Not exported; cleared by „Usuń wszystkie dane”.
- Shown as the user's own choice („Wybrany model”).

**Store link (C0, first commit).**
- `src/garmin.ts`:
  - `export const GARMIN_STORE_URL = 'https://apps.garmin.com/apps/681b79f1-3575-4375-9836-a5ec600abab4'`;
  - `GARMIN_APP_URL = String(import.meta.env.VITE_GARMIN_APP_URL || GARMIN_STORE_URL)`;
  - **keep the name `garminConfigured`**; it now checks only `apiConfigured()`;
  - add a comment that the variable only overrides the default.
- Test: the default is `681b79f1…` and never contains `c08428fa`.
- `src/csp.test.ts` NAVIGATION gains `'apps.garmin.com'`.
- `.github/workflows/deploy.yml`: comment updated.
- `garmin/store/README.md`: the production row gets the URL.

**Strings.** The full catalogs are based on `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/watch-check/WatchCheck.text.tsx` and `WatchCheck.words.ts`. **These keys change or are new;** everything else stays exactly as in the drafts:

| key | PL | EN |
|---|---|---|
| `verdict.ok` / `.part` / `.no` / `.notYet` / `.other` | `Obsługiwany` / `Obsługiwany, bez części danych` / `Nieobsługiwany` / `Jeszcze nieobsługiwany` / `To nie Garmin` | `Supported` / `Supported, without some data` / `Not supported` / `Not supported yet` / `Not a Garmin` |
| `short` (list rows) | `obsługiwany` · `bez części danych` · `nieobsługiwany` · `jeszcze nie` · `to nie Garmin` | `supported` · `without some data` · `not supported` · `not yet` · `not a Garmin` |
| removed | `verdict.update`, `verdict.notWatch`, `short.update`, `short.notWatch` | — |
| `lacks(list)` | `Ten model nie udostępnia aplikacjom ${list}.` | `This model doesn’t share ${list} with apps.` |
| `ciqLine(ciq)` (in „Więcej”) | `Connect IQ ${ciq}.` | `Connect IQ ${ciq}.` |
| `newest(list, many)` | `${List} ${przyjdą/przyjdzie}, gdy zegarek ma najnowsze oprogramowanie — starsze wersje nie udostępniają ${ich/tego} aplikacjom.` | unchanged wording with "don’t share" |
| `more` | `Więcej` | `More` |
| `otherQuestion(name, short)` | `Masz może ${name}? To inny model — ${short}.` (name is a button) | `Do you have the ${name}? That’s a different model — ${short}.` |
| `oldCiq(name, ciq)` | `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} ma Connect IQ ${ciq}, a potrzeba co najmniej 3.2 — dopiero od tej wersji aplikacja może zapisywać dane w tle. Nowszej wersji Garmin dla tego modelu nie wydał.` | `The GYM TRACKER watch app doesn’t run on it: the ${name} has Connect IQ ${ciq}, and 3.2 or newer is needed — only from that version can an app save data in the background. Garmin hasn’t released a newer version for this model.` |
| `noBackground(name, ciq)` | `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} ma Connect IQ ${ciq} — to za mało dla aplikacji, która sama wysyła dane w tle.` | `The GYM TRACKER watch app doesn’t run on it: the ${name} has Connect IQ ${ciq} — not enough for an app that sends data in the background by itself.` |
| `noApps(name)` | `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} obsługuje tylko tarcze zegarka, bez aplikacji Connect IQ.` | `The GYM TRACKER watch app doesn’t run on it: the ${name} only supports watch faces, no Connect IQ apps.` |
| `noCiq(name)` | `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} nie obsługuje aplikacji Connect IQ.` | `The GYM TRACKER watch app doesn’t run on it: the ${name} doesn’t support Connect IQ apps.` |
| `band(name)` | `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} to opaska bez aplikacji Connect IQ.` | `The GYM TRACKER watch app doesn’t run on it: the ${name} is a fitness band with no Connect IQ apps.` |
| `bike(name)` / `handheld(name)` / `scale(name)` | `Aplikacja GYM TRACKER na zegarku na nim nie działa: ${name} to licznik rowerowy, a aplikacja działa na zegarkach.` / `…: ${name} to nawigacja turystyczna, a aplikacja działa na zegarkach.` / `…: ${name} to waga.` | `The GYM TRACKER watch app doesn’t run on it: the ${name} is a bike computer, and the app runs on watches.` / `…: the ${name} is a handheld GPS, and the app runs on watches.` / `…: the ${name} is a scale.` |
| `notYet` | `Ten zegarek jest nowszy niż lista modeli, z którą zbudowano aplikację na zegarek. Obsługa jest planowana.` | `This watch is newer than the model list the watch app was built with. Support is planned.` |
| `asianNote(list)` | `Kupiony w Azji (wersja APAC, bez polskiego w menu)? Według danych Garmina ta wersja może nie przysyłać: ${list}.` | `Bought in Asia (APAC version, no Polish in the menus)? According to Garmin’s data that version may not send: ${list}.` |
| `asianCard(have, none)` | `To wersja azjatycka (APAC). Według danych Garmina ma starsze oprogramowanie: przyjdą ${have}, ale ${none} może nie przychodzić. Wersja europejska jest obsługiwana w pełni.` | `This is the Asian version (APAC). According to Garmin’s data it has older software: ${have} arrive, but ${none} may not. The European version is fully supported.` |
| `source` | `Lista według danych Garmina z października 2026.` | `List based on Garmin’s data from October 2026.` |
| `whereText` | `Aplikacja Garmin Connect pokazuje nazwę na liście urządzeń. Na zegarku szukaj jej w ustawieniach, w części o systemie (menu różni się między modelami). Stoi też na pudełku.` | `The Garmin Connect app shows the name in your device list. On the watch, look in the settings, in the system section (menus vary between models). It’s on the box too.` |
| `feedback` | `Coś nie działa? Napisz do autora` | `Something not working? Write to the author` |
| `popular` chips | 6 (above) | 6 |
| Garmin card `intro` | draft value (`…a na większości zegarków także stres i Body Battery…`) | draft value |
| `connectNoCheck` / `connectAnyway` / `haveKey` | `Połącz bez sprawdzania` / `Połącz mimo to` / unchanged | `Connect without checking` / `Connect anyway` |
| `yourWatch(name, short)` / `change` | `Wybrany model: ${name} — ${short}.` / `Zmień model` | `Chosen model: ${name} — ${short}.` / `Change model` |
| `install(link)` (step 1) | `Zainstaluj na zegarku aplikację GYM TRACKER z ${link}. Jeśli sklep pisze, że zegarek trzeba zaktualizować, zsynchronizuj go z Garmin Connect albo podłącz do Garmin Express na komputerze.` | `Install the GYM TRACKER app on your watch from the ${link}. If the store says the watch needs an update, sync it with Garmin Connect or connect it to Garmin Express on a computer.` |
| `updateFirst` (step 0 when `newest`) | draft value | draft value |
| checklist `checkModel` (first, no remembered model) | `Czy Twój model jest obsługiwany? Sprawdź →` | `Is your model supported? Check →` |
| checklist `bg32` (remembered `bg: 32`, waiting) | `Ten model ma mało pamięci na pracę w tle i nie był jeszcze sprawdzony na prawdziwym zegarku. Jeśli dane nie przychodzą, napisz — to pomoże.` + `Napisz do autora` | `This model has little memory for background work and hasn’t been tested on a real watch yet. If data isn’t arriving, write — it helps.` + `Write to the author` |
| checklist key item | `…Te same ustawienia są też w aplikacji Connect IQ Store: urządzenie → GYM TRACKER → Ustawienia.` (beta sentence removed) | `…The same settings are also in the Connect IQ Store app: device → GYM TRACKER → Settings.` |
| entry link `watchCheck` + dismiss | `Masz zegarek? Sprawdź, czy kroki mogą przychodzić same →` + aria `Nie pokazuj więcej` (`localStorage['gt-watch-link-hidden']`, try/catch) | `Got a watch? Check whether your steps can arrive by themselves →` + `Don’t show again` |
| `watchGaps(name, list)` („Z zegarka”, remembered model with lacks) | `${name} nie udostępnia aplikacjom ${list} — dlatego ich tu nie ma.` | `${name} doesn’t share ${list} with apps — that’s why they’re missing here.` |
| Phone card Garmin sentence | `Masz zegarek Garmin? Garmin Connect przekaże jego dane przez telefon — razem ze snem i wagą. Aplikacja GYM TRACKER na zegarku dokłada stres i Body Battery, a oba połączenia mogą działać naraz.` + link `Sprawdź swój model →` | `Got a Garmin watch? Garmin Connect passes its data on through your phone — with sleep and weight. The GYM TRACKER watch app adds stress and Body Battery, and both connections can run at once.` + `Check your model →` |

- The entry link shows only when `garminConfigured()`, no watch and no phone is connected, and it has not been dismissed.
- The checklist item and the result card's „Napisz do autora” use the existing feedback card (`views.tsx` passes `onFeedback`).

**Store texts.** W2 prepares them; the owner publishes them after the real-watch check.
- `garmin/store/description-en.txt` ← the draft. It adds `#/zegarek`, "118 models", and "stress and Body Battery on most models".
- `garmin/store/listing.md`, Polish lines:
  - „• tętno (najniższe, średnie, najwyższe), średnie tętno spoczynkowe, a na większości modeli także stres i Body Battery”
  - „1. W GYM TRACKER: Ustawienia → Zegarek Garmin. Sprawdź swój model, potem Połącz zegarek i Kopiuj klucz.”
  - „Działa ze 118 modelami zegarków Garmin (Connect IQ 3.2 lub nowszy) i z telefonem z iOS albo Androidem. Sprawdź swój i to, co wyśle: https://aleksanderdudek.github.io/gym-training-tracker/#/zegarek”

---

## 5. Unchanged, and out of scope

**Unchanged:**
- logging flows: search, sets, favourites, barcode, 2-tap favourites;
- product, recipe and restaurant data and pages;
- protein targets per diet style (`profiles.ts`) and the five style cards;
- the suggestion engine (`suggest.ts`, `restVariants`, `autoDay`), the `dayNeeds` API and meals-left-by-hour;
- the single weight log through the bridge;
- gym energy maths (`engine/energy.ts`, and `burn.ts` except the three functions deleted at I3);
- gym screens apart from §4.9 and §4.11;
- badges (never kcal);
- backup format v1; workbook import format;
- the meal-prep generator, apart from targets and check-in;
- Dexie schema (v4);
- no food reminders;
- the known UTC/local day mismatch;
- the gym's 7-day weight average;
- the watch app itself.

**Out of scope:**
- moving calories between days, or more food on training days;
- an opt-in very-active-day bonus;
- ranges on screen;
- protein portions;
- a new Dexie table;
- no-numbers mode for product/recipe/restaurant pages and the planner;
- gendered verbs in untouched strings;
- adolescent energy equations;
- lean-mass protein;
- a first step larger than 100;
- the watch reporting its own part number (needs a new watch-app version and a store review);
- MARQ Gen 3 in the manifest;
- generator `--write-manifest` / `--verify-store`;
- renaming the store title "GymTracker".

---

## 6. Implementation

### 6.0 Team, timeline, rules

**Team:** six engineers, about three working days.
- **Lead:** C0, P0, then A, then integration.
- **B**, **C**, **D:** calorie UI.
- **W1**, **W2:** watch.

**Start:** C0 and P0 land on day 1 morning. Everyone else starts from the P0 commit. Worktree agents start from `main` and must fast-forward to `feat/kalorie-i-zegarki` first.

With five engineers, one person does W1 then W2; the calorie packages are unaffected.

**Rules for everyone:**
- strings only via `text({pl,en})` / `say()`;
- food CSS classes are `fd-` prefixed; each package edits only its block of `diet.css` (P0 creates the blocks); `prep.css` is D's; `styles.css` is W2's;
- no prettier on component files;
- slow page tests get `15_000` timeouts;
- run vitest from the repo root;
- every merge passes `npm test`, `npm run typecheck`, `npm run lint`, `node scripts/i18n-scan.mjs` (0) and `npm run build`;
- never a bare `git stash`.

★ marks a test that must fail on 75f742b because the behaviour differs, not only because a module is new.

### 6.1 C0 — store link (Lead, first commit, merged to `main` immediately)

- **Owns:** `src/garmin.ts`, `src/garmin.test.ts`, `src/csp.test.ts`, `.github/workflows/deploy.yml` (comment), `garmin/store/README.md`.
- **Work and tests:** as in §4.11 „Store link”.
- ★ `GARMIN_APP_URL` defaults to `…681b79f1…` without the env variable.
- ★ `garminConfigured()` is true with only the API configured.

### 6.2 P0 — contract (Lead, ~0.5 day, one commit before anyone branches)

The Lead owns these files for this commit; ownership then passes to the packages as listed in 6.3.
- `src/food/diet/types.ts` — v2 types (§3.1), legacy fields still in `Profile`, `LegacyFields`.
- `src/food/diet/db.ts` — `DayRow.partial`, `ProfileRow extends Profile, LegacyFields`.
- `src/food/diet/target.ts` (new, **complete**) + `target.test.ts`: `NASEM_2023`, `BAND`, `COMPLETE_DAY`, `PACE_CHIPS`, `r10/r50/c50`, `eer`, `burnOf`, `hardMinOf`, `floorOf`, `minTargetOf`, `bmiOf`, `minHealthyKg`, `safety`, `safePace`, `targetFor`, `maintenanceOf`, `impliedPace`, `snap05`, `directionOf`, `targetOn`, `setTarget`, `hidesKcal`, `pauseOn`, `isComplete`, `kcalStatus`, `activityFromMultiplier`, `currentWeight`.
- `src/food/diet/trend.ts` (new, **complete**) + `trend.test.ts`: `WeighIn`, `trendSeries`, `trendOn`, `leastSquares` (honest SE), `paceOver`, `reachRange`.
- `src/food/diet/day.ts` — add `DayState` and `dayState(needs, eaten)` (+ tests in `day.test.ts`).
- `src/food/diet/store.ts`:
  - implemented: `completeProfile` v2 (default `dailyKcal` still 2000), `saveProfile` merge, `dismissNotice`, `markDay`, the `eatCheat` default name;
  - stubs with final signatures: `persistUpgrade`, `runWeeklyCheck` (returns null), `answerCheck`, `resolveFloor`, `startPause`, `endPause`, `saveProfileEdit` (= `saveProfile`).
- `src/food/diet/energy.test.ts` — the inline `Profile` literal → `completeProfile`.
- `src/food/diet/edit.ts` (new stub: `applyProfileEdit` = recompute target + `setTarget`).
- `src/food/hooks/useWeeklyCheck.ts` (new stub, returns `'ready'`).
- `src/food/components/diet/dietFormat.ts`, `kcalShown.ts` (new, complete).
- `src/food/components/diet/CheatMealSheet.tsx` — props `activity` and `eatenByDate` become optional (interface only).
- `src/food/bridge.ts` — optional `weighSkipped?(): boolean` and `skipWeigh?(): void`. `src/App.tsx` implements them (`cfg.weighSkip === dayKey(Date.now())` / sets it). `src/food/test/bridge.tsx` gets defaults.
- Split `src/food/components/diet/diet.en.test.tsx` into `diary.en.test.tsx`, `profile.en.test.tsx`, `progress.en.test.tsx` and `bigmeal.en.test.tsx` (mechanical; the original is deleted).
- `src/food/components/diet/diet.css` — append empty blocks `/* — C: profil, większy posiłek — */` and `/* — D: postęp, tygodnie, plan — */`.
- `src/watches/types.ts`, `find.ts`, `list.ts`, `extra.ts`, `garmin.json`:
  - the prototypes from `/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/proto/`, copied verbatim (types split out of `find.ts`);
  - `garmin.json` loaded by `import` instead of `readFileSync`;
  - this lets W2 build against the API.

**P0 tests** (all in owned files):
- **`targetFor`:**
  - M35/175/80 inactive 0,5 → **2100**; low → **2300**;
  - K30/165/65 inactive → **1550**;
  - K60/155/58 inactive → **1200** (raw 1194, floor).
- **Floors:** 1750 / 1400 / 1200.
- **`safePace`:** age 17 → 0; BMI 18,0 → 0 for loss; 60 kg at 0,75 → 0,6; 80 kg at −0,5 → −0,4; pregnancy → 0.
- **`kcalStatus(2000, ·)`:** 1880 → left 120; 1900 → within; 2080 → within; 2101 → over 100; 2150 → over 150.
- **`isComplete`, target 2000:** 1199 no; 1200 yes; partial true at 1800 no; partial false at 500 yes; nothing logged no.
- **`targetOn`,** goals `[{2026-10-01:1950},{2026-10-19:1850}]`: 10-18 → 1950; 10-19 → 1850; 09-01 → 1950.
- **`setTarget`** drops later entries and keeps 200.
- **`trendSeries`:** (d0 80, d1 81) → 80,1; (d0 80, d7 81) → 80,522; (d0 80, d1 90) → 80,3.
- **`leastSquares`:** 28 exact daily points → SE·7500 = 61,41; n < 10 uses r₁ 0,3.
- **`paceOver`:** null below 5 weigh-ins or 14 days.
- **`reachRange`:** month boundaries and the 730-day cut.
- **`activityFromMultiplier`:** 1,2/1,28 → inactive; 1,375/1,4 → low; 1,55 → active; 1,725 → very.
- **`dayState`:**
  - target 2000, eaten 1240, protein 96 g of 150 → left 760, protein 54;
  - planned meal 900 + eaten 650 → left 450, reserved;
  - eaten 2050 → within; 2150 → over 150.

### 6.3 Packages (parallel, disjoint ownership)

#### A — Model core, Monday check, data (Lead, ~1.5 days)

**Owns:**
- `src/food/diet/calibrate.ts` (new) + `calibrate.test.ts`;
- `src/food/diet/upgrade.ts` (new) + `upgrade.test.ts`;
- `src/food/diet/validate.ts` + `validate.test.ts`;
- `src/food/diet/store.ts` (after P0) + `store.test.ts`;
- `src/food/diet/plan-import.ts` + `plan-import.test.ts` (`Partial<Profile & LegacyFields>`);
- `src/food/hooks/useDiet.ts` + `useDiet.test.tsx`;
- `src/food/hooks/useWeeklyCheck.ts` + `useWeeklyCheck.test.tsx` (new);
- `src/food/backup.test.ts`.

**Work:** §2.4 and §3.3–3.6. `useWeeklyCheck(profile, clock)` returns `'ready' | 'pending'`. It:
- runs once per Monday per tab (a module-level promise keyed by Monday);
- reads weigh-ins from `useContext(BridgeContext)`; with no bridge it returns `'ready'` and runs no check;
- times out to `'ready'` after 3 s;
- catches and logs failures.

**Tests:**
- **A1** (F in §2.10) → status `ask`, `to` 2000, reason `burn`, `offsetAfter` −150, `dailyKcal` 2100, `burnOffset` 0.
  - `yes` → 2000, offset −150, last goal `{today, 2000, 'check'}`, hold `{+1, M+28}`.
  - ★ (old: diary users never got a weekly check).
- **A2** intake = target + 150 daily, weight following the true burn = prior → `same` (non-adherence is not punished).
- **A3** an exact 28-point line → no `noisy`; 6 weigh-ins over 14 days with ±0,8 kg scatter → `noisy` only when 1,5·SE ≥ 150.
- **A4** dead band:
  - gap 60 → `same`;
  - burn up so ideal = cur + 250 → `changed` +100, applied, hold `{−1, M+28}`;
  - cur 1860 with ideal 1750 → `ask` to **1760**.
- **A5** floor:
  - man 80 kg (floor 1750), cur 1800, raw ideal 1600 → `same` with note `floor`;
  - floor-up: cur 1650 with zero weigh-ins → `changed` to 1750, reason `floor-up` ★;
  - `belowFloorOk` → no floor-up.
- **A6** idempotent:
  - same week again → null;
  - `lastCheck.week` in the future → null;
  - two parallel `runWeeklyCheck` → one `check` goals entry.
- **A7** settle:
  - user change −400 on M−5 → settle `{M+9, 'change'}` → `settling`;
  - a −200 change → no settle, but hold `{0, +14}` → `same` with note `held`.
- **A8** pauses:
  - pause [M−10, M−3] → `paused`;
  - pause covering today → `paused`;
  - zero weigh-ins → `data` with `missing.weighIns` 0.
- **A9** reached:
  - loss goal, trend 74,9 ≤ 75 → `reached`, `goalPace` 0, target `maintenanceOf` applied, settle change ★;
  - `continue` → previous pace and target, `askAgain` M+28;
  - next Monday with trend 74,6 → no reached; trend 73,8 → reached again.
- **A10** age 16 → `off`; pregnancy → `off`.
- **A11** hold: after a raise, next Monday gap −150 → `same` `held`; gap −250 → `ask`.
- **A12** pace guard:
  - goal 0,5, observed 0,75 kg/wk, ideal 150 below → `same` with note `pace` ★;
  - observed 0,3, ideal 150 above → `same` `pace`.
- **A13** no-numbers:
  - burn-down → `same` with note `quiet`, `burnOffset` updated, `dailyKcal` unchanged;
  - burn-up → `changed`.
- **A14** `keep` on a raise (example G: offset after −91, 1860→1960 at 80 kg):
  - `dailyKcal` 1860, `goalPace` 0,65, hold `{+1}`;
  - the same data next Monday → `same`;
  - a keep that would imply more than 0,8 kg/wk is not offered.
- **A15** `no` on `ask` → `burnOffset` unchanged, hold `{−1, M+28}`.
- **A16** Monday 03:00 → null; Tuesday 01:00 after a missed Monday → runs.
- **A17** upgrade of an owner-like row (×1,28 / 4000 / 10000 / 0,4 / 0 / 7500 / corr 0 / 1860 / 80 kg / today 2026-10-24) → ★:
  - `version` 2, `dailyKcal` 1860, goals `[{startDate, 1860, 'migration'}]`;
  - level `inactive`, `burnOffset` −241, `goalPace` 0,5, `anchored`;
  - `lastCheck {week '2026-10-26', 'migrated'}`, `notice 'show'`;
  - legacy keys present and equal;
  - with corr −120 → offset −361, pace 0,4;
  - Marek → −224, 0,5, 2040.
- **A18** upgrade safety:
  - age 16 → pace 0 plus a `safety` maintenance entry;
  - BMI 18 with a deficit → maintenance;
  - K at 1100 → 1200 `safety`;
  - man at 1600 with floor 1750 → kept, notice offers the floor choice; `resolveFloor('raise')` → 1750.
- **A19** normaliser ★ (old: rebuilt from defaults, dropped unknown keys):
  - a legacy backup is upgraded (`fresh: false`);
  - unsorted or duplicate goals are fixed and `dailyKcal = targetOn(today)`;
  - a v2 row whose `dailyKcal` and `goalSince` an old tab changed → a `user` entry appended from `goalSince`;
  - a row read on the day after a scheduled break end → `dailyKcal` = the returned target, no `user` entry;
  - a 1100 kcal history entry is not re-clamped;
  - a 40-day pause → 28;
  - a malformed `lastCheck` → null;
  - unknown keys dropped, legacy keys kept;
  - `cleanProfile(cleanProfile(x))` deep-equals `cleanProfile(x)`.
- **A20** `completeProfile({})` → 2100 with a `setup` goal, settle start+14 ★ (old 2000).
- **A21** `useProfile` on a legacy row → v2 at once; the stored row becomes v2 exactly once; legacy keys kept.
- **A22** `useWeeklyCheck`: runs on Monday 09:00, not at 03:00; once on Tuesday after a missed Monday; a throwing check → `'ready'`.
- **A23** `importWorkbook` on a fresh DB → v2 with the workbook's `dailyKcal`, `goals[0].by 'setup'`, `notice null`, `lastCheck 'setup'`.
- **A24** `restoreAll` of an owner-shaped v1 backup → v2; entries and days byte-identical; `DayRow.partial` kept.
- **A25** `startPause(7)` for the default man at 80 kg:
  - target 2650 from today; a future entry back to the old target on day 8; settle `{to+15, 'pause'}`;
  - `endPause` on day 3 → the old target today, the future entry removed.

#### B — Today card and diary (~2 days)

**Owns:**
- `src/food/TodayFoodCard.tsx` + `TodayFoodCard.test.tsx`;
- `src/food/components/diet/DiaryPage.tsx` + `DiaryPage.test.tsx`;
- `MacroBars.tsx`, `WeighCard.tsx`;
- `FoodPicker.tsx` + `FoodPicker.test.tsx`;
- `SuggestionList.tsx`, `FavoritesSheet.tsx`, `RestVariants.tsx`, `AutoDayCard.tsx`, `PlanDayCard.tsx`, `dietText.ts`;
- new: `dayText.ts` + `dayText.test.ts`, `WeekCheckCard.tsx` + `WeekCheckCard.test.tsx`, `ChangeNotice.tsx`;
- `src/food/components/prep/PrepDayCard.tsx`;
- `diary.en.test.tsx`;
- `diet.css` outside the C and D blocks.

**Work:**
- Stops importing `activityText`, `useActivity`, `macroStatus`, `dayGoal` and `useMergedHistory` (deleted later at I2).
- CSS:
  - remove the kcal/protein uses of `.fd-diet-brak/nadmiar` (keep `.fd-diet-ok` for favourites);
  - add `.fd-diet-headline`, `.fd-diet-weekcard`, `.fd-diet-weekline`, `.fd-diet-notice`, `.fd-diet-pause`, `.fd-diet-partial`.

**Tests:**
- **B1** Today card, target 2000, eaten 650 kcal / 40 g → „Zostało ok. 1350 kcal i 110 g białka” ★ (old: „Dziś 650 z 2000 kcal” + „Zostało 1350 kcal i 110 g białka.”).
- **B2** a bridge with 15 000 steps and a 300 kcal workout, nothing eaten → „Na dziś: 2000 kcal i 150 g białka” ★.
- **B3** band:
  - eaten 2080 → „Kalorie na dziś w zakresie celu, białka jeszcze …”, no „ponad cel” ★ (old: „80 kcal ponad cel.”);
  - eaten 2300 with protein met → „Na dziś kalorii i białka już wystarczy” + „To ok. 300 kcal ponad cel — jeden dzień nie zmienia trendu.”;
  - no `.fd-diet-nadmiar`.
- **B4** planned bigger meal 900, eaten 650 → „Zostało ok. 450 kcal …” + „Liczę już z zaplanowanym większym posiłkiem (900 kcal).” ★ (old card ignored the meal).
- **B5** diary on yesterday: eaten 1940 = target 1940, bridge steps 5400 → „Zjedzone 1940 kcal · cel 1940”, no „ponad cel” ★ (old target 1590).
- **B6** ate 2600 on Monday, viewing Tuesday → „Na dziś: 2000 kcal …”, no „Cel na dziś obniżony” ★ (replaces „nadwyżka z początku tygodnia obniża dzisiejszy cel”).
- **B7** Tuesday with only 400 kcal: viewing Tuesday shows „Mało zapisów jak na cały dzień …” + „To był cały dzień”; Wednesday's target stays 2000 ★ (old +220).
- **B8** Monday card `changed` 1950→2050:
  - title, facts and reason render;
  - „Zostaw 1950 kcal” → the toast starts „Cel zostaje: 1950 kcal.”, `dailyKcal` 1950, last goal `user`;
  - the Today link disappears.
- **B9** `ask` card: the question and both buttons; „Nie zawsze — zostaw 1950 kcal” → target unchanged.
- **B10** notice `show` → bullets with 1860; „Rozumiem” → `seen`, and the Today link is gone.
- **B11** the button reads „Większy posiłek”; no „Cheat meal” anywhere in the diary ★.
- **B12** Kroki card: the note is present; no „Cel a ruch”, „Ruch dziś:” or „Cel zakłada” ★.
- **B13** `hideKcal` ★:
  - no `/kcal/` in the Today card or the day card;
  - eaten lines show „B 41 g”;
  - no bigger-meal button;
  - toast „Zapisane: Skyr.”
- **B14** FoodPicker with `left` 800 and a 260 kcal item → „Po tym zostanie ok. 540 kcal na dziś.” ★.
- **B15** partial footer: „Nie wszystko zapisane” → `DayRow.partial` true and the line; „Cofnij” → unset.
- **B16** WeighCard ★:
  - „Nie dziś” calls `bridge.skipWeigh` and collapses the card to „Bez ważenia dziś.”;
  - a past day shows „Waga tego dnia: bez ważenia.”;
  - no „Ile ważyłeś”.
- **B17** suggestion buttons read „Zjedzone” (aria „Zjedzone: …”) ★ (old „Zjadłem”).
- **B18** a due Monday check: the Today card shows the placeholder until it finishes; a failing check → the stored target after the fallback.
- **B19** `dayText` and `diary.en.test.tsx`: English renders without Polish letters.

#### C — Profile, onboarding, „Większy posiłek” (~1.5–2 days)

**Owns:**
- `src/food/components/diet/DietProfilePage.tsx` + `DietProfilePage.test.tsx`;
- `Onboarding.tsx`, `profile.en.test.tsx`;
- `CheatMealSheet.tsx`, `cheatText.ts`, `CheatMeal.test.tsx`, `bigmeal.en.test.tsx`;
- `src/food/diet/cheat.ts` + `cheat.test.ts`;
- `src/food/diet/edit.ts` + `edit.test.ts`;
- the C block of `diet.css` (`.fd-diet-level`, `.fd-diet-levels`, `.fd-diet-paceline`, `.fd-diet-goalpick`, `.fd-diet-how`).

**Tests:**
- **C1** no „Podstawowe spalanie (BMR)”, „× 1.28”, „Zaawansowane”, „Kroki dziennie (plan)” or „Dopasowuj cel do ruchu” ★.
- **C2** new profile M 35/175, weight 80, „Schudnąć”, target 75 ★ (old: default 2000, no chip selected):
  - „Głównie siedzę” is checked;
  - chip „−0,5 kg/tydz.” → „Cel: 2100 kcal dziennie · białko co najmniej 150 g”;
  - save → goals `[{today, 2100, 'setup'}]`, `lastCheck` setup.
- **C3** age 16 → no goal choice, target weight or chips; `under18` shown; saved `goalPace` 0 and `hidesKcal`.
- **C4** 175 cm / 56 kg → „Schudnąć” disabled with `lowBmi`; a target of 55 kg at 175 cm → `minTarget` (57 kg).
- **C5** manual target for a man at 80 kg:
  - 1400 → „Najniżej 1500 kcal.”, save blocked, focus on the field ★;
  - 1600 → the checkbox is required; ticked → saved with `belowFloorOk` true.
- **C6** anchored profile, level inactive → active → `burnOffset` −241 → −641, `dailyKcal` unchanged, the anchored note shown ★ (old: the multiplier moved the goal).
- **C7** „Przerwa na tydzień” → maintenance from today and the diary's break line; „Zakończ przerwę” → back.
- **C8** a bridge with 14 days of 8 400 steps → „Głównie siedzę” still checked, hint „Twoja średnia z ostatnich 2 tygodni: 8400 kroków dziennie.” ★.
- **C9** a migrated 1860 profile opened and saved unchanged → 1860, no new goals entry.
- **C10** K 60/155/58 → „−0,75 kg/tydz.” disabled with `paceLimited`.
- **C11** pregnancy → „Schudnąć” disabled; saved `goalPace` 0.
- **C12** onboarding „Bez liczenia kalorii” → the profile opens with the switch on ★.
- **C13** bigger-meal sheet:
  - title „Większy posiłek”; no „Ruch do końca dnia”, „odrobić”, „Tydzień:” or „W prognozie wagi” ★;
  - the over sentence is exact;
  - +80 over → „Mieści się — to wypełnia cel dnia.” ★ (old `edge`).
- **C14** the `simulateCheat` result has no `week` / `kg` / `offset`; verdict thresholds follow the band.
- **C15** `applyProfileEdit`:
  - user change −400 → settle change + hold `{0, +14}`;
  - direction change → settle;
  - unchanged edits keep the target.

#### D — Progress, weeks, plan page, meal prep, „Zjedz teraz”, scanner (~2 days)

**Owns:**
- `src/food/components/diet/DietProgressPage.tsx`, `WeekTable.tsx`, `WeightChart.tsx`, `DietPlanPage.tsx`, `DietSubpages.test.tsx`, `progress.en.test.tsx`;
- `src/food/diet/weeks.ts` + `weeks.test.ts`;
- `src/food/prep/targets.ts`, `checkin.ts`, `types.ts`, `validate.ts`, `generate.ts`; deletes `src/food/prep/checkin.test.ts`; `generate.test.ts` if affected; `src/food/test/prep.ts`;
- `src/food/components/prep/PrepForm.tsx`, `PrepPlanView.tsx`, `prep.css`, `Prep.test.tsx`, `Plans.test.tsx`, `prep.en.test.tsx`;
- `src/food/hooks/useEatNow.ts`;
- `src/food/components/nearby/EatNow.tsx`, `EatNow.test.tsx`, `eat.en.test.tsx`; `src/food/nearby/eat.test.ts`;
- `src/food/components/products/ScanSheet.tsx`, `ScanSheet.test.tsx`;
- the D block of `diet.css` (`.fd-diet-history`, `.fd-diet-part`, `.fd-diet-trend`).

**Tests:**
- **D1** „Teraz (trend)” equals the EMA; no „Z zapisów jedzenia wynikałoby” or „ponad cel” ★.
- **D2** reach ★ (old: exact day):
  - unanchored → „Przy zakładanym tempie (−0,5 kg na tydzień) to ok. 10 tygodni.”;
  - anchored, with an observed pace of 0,5 ± 0,1 and 5 kg to go → a month range.
- **D3** goals change on day 7 → the 14-day sr text says „cel 1950”, then „cel 1850” ★.
- **D4** weeks: a 400 kcal day is excluded from „Jedzenie”; a week with 2 weigh-ins shows „–” ★ (old allowed 2).
- **D5** findings:
  - 7 finished weeks → no findings section ★ (old: 4);
  - 8+ weeks with a noisy difference → none;
  - a large, consistent difference → one finding, with no strength word.
- **D6** PrepForm: no „dopasowany do Twojego tempa” radio; the new sentence is present; `planTargets` is identical for every date ★.
- **D7** DietPlanPage: `Cel` = `targetOn(d)` on future days ★ (old: shrinking re-spread).
- **D8** PrepPlanView: the stale note is hidden at Δ 100 and shown at Δ 250 ★.
- **D9** „Zjedz teraz”:
  - 15 000 steps → the same budget as without ★;
  - eaten 1990 of 2000 → „Na dziś kalorii już wystarczy (1990 z 2000 kcal)…”;
  - `hideKcal` → „Na ten posiłek: coś z ok. 35 g białka.”
- **D10** scanner: left 90 → „Na dziś: kalorii już wystarczy.” ★ (old: „mieści się — zostało 90 kcal”); `hideKcal` → no „Na dziś”.

#### W1 — Watch data and search engine (~2 days)

**Owns:**
- `scripts/garmin/watches.ts`, `scripts/garmin/lib.ts`, `scripts/garmin/lib.test.ts` (new);
- `garmin/store-devices.json` (new);
- `src/watches/garmin.json`, `garmin.test.ts`, `words.ts`, `words.test.ts`, `types.ts`, `extra.ts`, `list.ts`, `list.test.ts`, `find.ts`, `find.test.ts`, `find.snapshot.test.ts`, `remember.ts`, `remember.test.ts`;
- `package.json` (`"garmin:watches": "tsx scripts/garmin/watches.ts"`);
- `garmin/build.sh` (`--check` before `store` / `beta`);
- `garmin/README.md` (adding devices, `CIQ_DEVICES`).

**Tests:**
- **Manifest:** manifest ids = supported ids; the failure lists missing and extra ids and says `npm run garmin:watches`. `appId` and `minCiq` match.
- **Data shape:** fields valid; part numbers unique; snapshot of the non-full ids.
- **`lib.test.ts`:**
  - `expand()` on all 24 multi-name names;
  - classification of Edge, FR45, FR235, vívoactive 3;
  - capabilities on fixtures (fēnix 5 Plus, Venu Mercedes-Benz, Instinct 2 Dual Power as APAC);
  - alias rules; determinism; `bg`.
- **Generated coverage:**
  - every name and alias in `garmin.json` and `extra.ts` answers its own model or a same-answer family;
  - every manifest id is findable by its name;
  - no supported name answers `unknown` or not supported.
- **Hand-written pairs:** vívoactive 3 / 3 Music / 3 Music LTE; fēnix 5 / 5 Plus; 5S / 5S Plus; 5X / 5X Plus; FR 645 / 645 Music; Instinct / Instinct 2; Instinct Solar (1st gen) / Instinct 2 Solar; epix / epix Gen 2; MARQ Gen 3 / Gen 2 / Athlete; D2 Air / D2 Air X10; Venu / Venu Mercedes-Benz; FR 935 / FR 945; FR 45 / FR 55; Approach S62 / S70; vívoactive / vívoactive 4; Descent Mk1 / Mk2.
- **Critique queries:**
  - „stary garmin” → prompt; „stary forerunner” → line;
  - „mój zegarek to fenix 7”, „forerunner 255 muzyka”, „forerunner255sm” → one model each;
  - „265” → titled „Forerunner® 265”;
  - „nie wiem” → help;
  - „mi smart band 9” → other brand; „samsung” → titled „Samsung Galaxy Watch”;
  - all-typo → guess;
  - „instinct 2” → headline supported (APAC only in the note); „instinct 2 dual power” → APAC card.
- **Ranking:** „fo”, „ve”, „vi”, „in” and „ga” start with supported Garmin models.
- **Snapshot:** the prototype's 86 cases (`/private/tmp/claude-501/-Users-pl2mac0030-kb/2af188c8-de8e-4890-b2c7-f25bd4d9a014/scratchpad/design/proto/find.cases.ts`), kept as `find.snapshot.test.ts`.
- **`remember.test.ts`:** storage that throws; bad shapes.

The matcher stays pure and lazy, typos are never allowed in words with digits, and the work is timeboxed to the fixes listed.

#### W2 — Watch UI, wiring, gym calorie texts (~2 days)

**Owns:**
- new `src/components/WatchCheck.tsx` (default export, lazy; props `onConnect?`, `onFeedback?`, `onShown?`, `initial?`, `compact?`), `WatchCheck.text.tsx`, `WatchCheck.words.ts`, `WatchCheck.test.tsx`, `WatchCheck.en.test.tsx`;
- `src/components/Garmin.tsx`, `views.tsx`, `DeviceStatus.tsx`, `DeviceStatus.test.tsx`, `Phone.tsx`, `Phone.test.tsx`, `shell.en.test.tsx`;
- `src/components/Cardio.tsx`, `Cardio.text.tsx`, `SessionHome.tsx`, `cardio.en.test.tsx`, `training.en.test.tsx`, new `Cardio.links.test.tsx`, new `dietQuiet.test.tsx`;
- `src/routing.ts` (`WATCH_PATH`, `TAB_BY_PATH.zegarek = 'set'`, `isDeviceLink`) + `routing.test.ts`;
- `src/App.tsx` (`showIntro` respects `isDeviceLink`; `resetAll` calls `forgetWatchModel()`);
- `src/styles.css`;
- `garmin/store/description-en.txt`, `garmin/store/listing.md`.

**Work:** §4.9 and §4.11, plus:
- `Garmin.tsx` lazy-loads `WatchCheck` with a small error boundary (`checkFailed` + the store link);
- `useScrollHere` also scrolls for `#/zegarek`;
- `goToCard(device)` in `DeviceStatus.tsx` (scroll + hash replace).

**Tests:**
- **Combobox and focus:**
  - ARIA attributes; arrows, Enter and Escape;
  - a chip moves focus to the heading;
  - the field does not select its text on focus;
  - ≤ 5 options at innerHeight 650;
  - the count is announced after 500 ms.
- **Cards:**
  - every card type;
  - Android / iPhone / desktop phone boxes (`userAgent` stub as in `Phone.test.tsx`);
  - the unknown card's store link = the production default;
  - feedback only with `onFeedback`;
  - line view; Dual Power card; fēnix 5 Plus text;
  - `initial` as an id and as text;
  - storage that throws;
  - the full list opens and selects.
- **Garmin card:**
  - idle, positive and negative states, one main action each;
  - connected line „Wybrany model: …”;
  - update step;
  - `#/zegarek?model=fr265` on mount, with no intro on a fresh profile.
- **Entry points:**
  - entry links shown, hidden and dismissed;
  - the phone card sentence links to the check ★;
  - the checklist's first item without a remembered model, and the `bg32` note;
  - the checklist key item without the beta sentence ★.
- **Gym calorie texts:**
  - with `gt:diet` set, the training card line has no „kcal” and the Cardio card heading is „Dziś 7200 kroków” ★; without the flag, both unchanged;
  - the Cardio page shows `notFood` with the flag ★;
  - „Jak liczymy” has the new sentence.
- English smoke test without Polish letters.

### 6.4 Integration (Lead)

**I1 — merge order:** C0 (main) → P0 → **A → D → C → B → W1 → W2**, each rebased on the previous one, with the full gate after each merge.

**I2 — delete dead code** (and update their tests):
- `src/food/diet/activity.ts` + `activity.test.ts`;
- `src/food/hooks/useActivity.ts`;
- `src/food/components/diet/activityText.ts` + `activityText.test.ts`;
- from `day.ts`: `weeklyAdjustment`, `Adjustment`, `macroStatus`, the week texts (+ `day.test.ts`);
- from `model.ts`: `dayGoal`, `plannedKcalOn`, `forecastInputs`, `projectFromWeighing`, `lastWeighing` (+ `model.test.ts`);
- from `energy.ts`: `tdee`, `paceKgPerWeek`, `suggestedKcal`, `forecast`, `dayReaching`, `ForecastInput/Point` (+ `energy.test.ts`). `upgrade.ts` keeps a private copy of the old `tdee`;
- from `body.ts`: `withGymSteps` (+ `body.test.ts`);
- legacy fields out of `Profile`; `MODEL_DEFAULTS` reduced to `{ kcalPerKg: 7500 }` (`upgrade.ts` keeps its own legacy defaults); legacy `PROFILE_RANGES` → `LEGACY_RANGES` (pass-through only); the `completeProfile` legacy defaults;
- any straggler test relying on the default 2000.

**I3 — bridge and engine cleanup:**
- remove `planned`, `planActive`, `typicalWorkoutKcal`, `otherKcal` and `stepsWorth` from `MoveDay` (`src/food/bridge.ts`);
- `App.tsx` `moveOn` loses them (one `dayBurn` per day, no plan snapshot);
- update `src/food/test/bridge.tsx`;
- delete `stepsWorthOn` (`src/engine/cardio.ts` + its tests in `cardio.test.ts`), `beyondStepsBurn` and `typicalWorkoutBurn` (`src/engine/burn.ts`); their only consumer was the diet bridge;
- `plannedBurn` stays.

**I4 — docs and ledger:**
- Rewrite the README „Jedzenie” section: one target, the Monday check, the band, „Większy posiłek”, safety.
- Add the watch-check paragraph to „Zegarek Garmin”, correcting the „stoi „—”” claim.
- Save this spec as `docs/superpowers/specs/2026-10-24-kalorie-i-zegarki-design.md`.
- **Ledger:** the calorie diff must be net negative, excluding tests, `src/watches/`, `scripts/garmin/`, `garmin/store-devices.json` and `WatchCheck*`. Report removed and added lines in the merge commit.

**I5 — verification:**
- **★ tests:** run every ★ test against 75f742b in a separate worktree (never a bare `git stash`). Each must fail there.
- **Upgrade rehearsal:**
  - restore a synthetic owner-shaped v1 backup: ×1,28, 10 000 steps, `kcalCorrection` 0 and −120, 8 weeks of entries and daily weigh-ins, a planned cheat meal;
  - check that the day-one target is unchanged (1860 / 1860) and the legacy keys are present;
  - check that entries, days and weights are byte-identical;
  - check that the first check, on the first Monday ≥ 7 days later, produces `same` or ±100 with a reason;
  - check that „Zostaw” restores the target and sets the implied pace.
- **Playwright** at 360 px with `vite preview`, `serviceWorkers: 'block'`, `locale: 'pl-PL'` and `en-GB`. Seeds are written, then `about:blank`, then the app is opened. Screens:
  - Today card (numbers and no-numbers, Monday placeholder);
  - diary (notice → „Rozumiem”, Monday `changed` and `ask` cards, partial footer, bigger meal);
  - profile (upgraded seed, anchored note, doctor checkbox);
  - Progress;
  - `#/zegarek` on a fresh profile: no intro, card scrolled into view, „fr 265” → Obsługiwany, `?model=vivoactive3` → Nieobsługiwany with the phone route;
  - the store link opens the production page.

  Screenshot app pages only.
- Commit on the feature branch and merge locally; no push.

---

## 7. Risks and how the design handles them

| Risk | Handling |
|---|---|
| The owner (daily user) sees a different number or loses history | `dailyKcal` kept to the kcal, intended pace kept, past days frozen, first check ≥ 7 days later, one-time notice, „Zostaw” on any change; rehearsal on an owner-shaped backup (I5). |
| A code revert after users upgraded | Every old key stays in the row untouched (normaliser pass-through, `saveProfile` merges); `dailyKcal` unchanged at upgrade; the new meaning lives under new names (`burnOffset`, `goals`). |
| Parallel work breaks the build | P0 contract with legacy fields still in the type; packages only add and switch their own files; deletions only at I2/I3; one owner per file; CSS blocks per package; English tests pre-split. |
| New users' NASEM start is far off (±250–340) | Labelled „pierwszy szacunek”; the check converges in 4–9 weeks (S3/S4); floors and the pace cap protect the downside; default `inactive` errs toward slower loss. |
| The target churns | Honest SE at 1,5, belief cap 150, dead band 100, step 100, 4-week hold with escape 200, pace guard: 1,9 changes and 0,5 reversals in 16 weeks with a correct start (simple as specified: 2,3 and 0,78). |
| Early water/glycogen inflates the burn estimate | 14-day settle after start, big changes, the reached switch and breaks; plausibility 0,8–2,5 × BMR; first change in the wrong direction 8 % with 2,5 kg of water (was 23 %). |
| Partial logging or under-logging cuts food | 60 % complete-day rule + per-day override; cuts asked first („Nie zawsze” learns nothing and holds 4 weeks); pace guard; consistent under-logging self-corrects (S6). |
| Cutting food while someone already loses fast (ED risk) | Pace guard; floor; no-numbers mode never cuts; no deficit under 18, at BMI < 18,5 or in pregnancy; neutral copy; no reminders, streaks or pay-back. |
| People expect activity to earn food | The notice, the Kroki note and „Jak liczę cel” explain; real activity raises the target through the scale (S8); „Większy posiłek” and „Co teraz?” plan hungry days without compensation. |
| A missed Monday or two tabs | Lazy run on the first open after Monday 04:00; `rw` read-check-write; `lastCheck.week` idempotence; module-level promise per tab. |
| Monday flashes the old target, or a broken check blocks the card | Placeholder while pending; 3-second fallback to the stored target; failures logged. |
| A migrated user re-describes their activity | Anchoring keeps the burn; the level sits in „Odpowiedzi do pierwszego szacunku” with the reason. |
| Hiding gym kcal on Today collides with the watch work | One owner (W2) for `SessionHome.tsx`, `Cardio.tsx`, `Cardio.text.tsx`; `App.tsx` edits sequenced P0 → W2 → I3. |
| Findings stay misleading | ≥ 8 weeks, ≥ 3 per group, 2,6 × Welch SE (multiple comparisons), no strength words, shown only when one qualifies. |
| Store link stays a 404 | C0 first and on its own; the owner can redeploy today (variable already production). |
| „Obsługiwany” for a model whose background sync never ran on a real watch | Headline says supported (store-compatible), not "works fully"; „Coś nie działa? Napisz” on positive cards; `bg32` note when such a watch waits; the owner verifies on a real watch before linking from the store listing. |
| APAC verdicts rest on parts with unknown firmware | „Według danych Garmina … może nie przysyłać”; APAC never changes the headline unless the query names a region or „Dual Power”. |
| The matcher misleads on Polish phrasing | Generated coverage tests, hand pairs, the critique queries, all-typo → guess, help for „nie wiem”, ranking with supported models first. |
| The generator needs the SDK on the owner's Mac | CI only checks manifest ids = JSON ids; `build.sh --check` is the gate; `CIQ_DEVICES` documented. |
| i18n or style drift | Scanner at 0, English tests per package, the CSS area test, English Playwright pass. |

---

## 8. Decisions

| Question | Decision | Why |
|---|---|---|
| Base design | "simple" | Highest score; the only one that reduces numbers, the owner's complaint. |
| Does activity change food? | Never, anywhere; no opt-in bonus | 20–90 % per-person error, 28 % compensation; the bonus brings the converter back. |
| Starting formula | NASEM 2023, 4 levels, default `inactive`, steps only as a hint | DLW-based with published error; NASEM itself warns against assigning levels from steps; avoids generous starts. |
| Target shape | One number per day, same all week, ±100 band in words; no ranges on screen | Simple arithmetic for „Zostało”; ranges added numbers (UX). |
| Calibration statistic | Honest SE (AR(1), 0,35 kg floor, intake SE) at 1,5 SE | Naive SE under-states noise; 2 SE was slow when the start is off (§2.11). |
| Settle | 14 days after start, ≥ 300 kcal / direction change, reached switch, break | 7 days gave 21–33 % wrong first raises in three judges' runs. |
| Step size | Exactly ±100, no larger first step | "bez zmian albo o 100 kcal" is the trust-building rule; convergence still 4–9 weeks. |
| Reversals | 4-week hold after any change, escape at a 200 gap | Cuts reversals by a third to a half without slowing convergence. |
| New rule beyond the judges | Pace guard (no cut while ahead of plan, no raise while behind) | Safety in the ED-relevant direction; cut S4 wrong first moves 18 % → 10 % at no cost elsewhere. |
| Automatic or proposed changes | Raises and weight-driven moves automatic with „Zostaw”; burn-based cuts asked first | Proposals-only left targets stale (old check-in); cuts are where under-logging bias hurts. |
| „Zostaw” | Pace becomes the kept target's implied pace (snapped 0,05); 4-week hold that direction | Otherwise the same change returns every Monday. |
| No-numbers mode and cuts | Never cuts; still learns and raises; numberless reached card | "Never lower silently" (UX). |
| Complete day | 60 % of the day's target + per-day override | 50 % left the target 75 kcal low with forgotten meals; the user knows best. |
| Goal reached | Maintenance by default with „Chcę dalej chudnąć”; asked again after 4 weeks or 1 kg further | Continuing a deficit past the goal is the unsafe default; "never ask again" was a weakness. |
| Anchoring | Body/level edits rebase `burnOffset` once the burn is data-tied; level moves into closed details | Prevents +400 kcal double counting; no silent control. |
| Below the BMR floor | Only with the doctor/dietitian checkbox; never below 1500/1200; migrated targets kept with a choice | A route for supervised plans without weakening the default. |
| Pregnancy / breastfeeding | Switch for K: no deficit, check off | The check would read pregnancy gain as "burns less" (science). |
| Break | Maintenance target for its length, check paused, 14-day settle after | A real diet break; days never count. |
| Upgrade persistence | Persist once at first read; old keys untouched; `dailyKcal` unrounded | "Write on first action" would make the upgrade date, notice and first check drift day by day; revert safety comes from the untouched keys. |
| Storage | Everything in the profile row and `DayRow.partial`; no Dexie bump, no new table | Zero upgrade/blocked-tab failure modes. |
| Old-way toggle | None | The old engine produced C1–C17; levers exist (keep, manual, auto off, no numbers, break). |
| Gym kcal on Today for diet users | Hidden (UX + science), one owner for the gym files (eng's collision concern) | One calorie concept on the diet's main screen (C1/C2). |
| Findings | Kept, ≥ 8 weeks, ≥ 3 per group, 2,6 × Welch SE, shown only when one qualifies | UX/eng keep; science's multiple-comparison worry handled by the stricter bar. |
| Weigh-in prompt | One shared skip with Today; „Waga tego dnia” | C19 and the masculine form. |
| Form of address | Capitalised „Twój/Ci/Ciebie” in new and touched strings | Most of the app already uses it (UX). |
| Onboarding | Goal question first; „Bez liczenia kalorii” as a visible second choice | The owner doubts counting itself; no pre-filled −5 kg target. |
| Watch headline wording | „Obsługiwany” / „Obsługiwany, bez części danych” / „Nieobsługiwany” / „To nie Garmin” | The owner's own question; honest while background sync is unverified on real watches (science) and keeps four states (UX). |
| `garminConfigured` name | Kept; only its check changes | App.tsx and DeviceStatus stay untouched (eng). |
| Team | 6 engineers: Lead (C0, P0, A, integration), B, C, D, W1, W2 | Disjoint ownership; sequential only where files are shared. |