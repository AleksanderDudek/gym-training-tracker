# Meal prep: a plan for the next days, a shopping list per shop, a goal that follows the journey — design

Date: 2026-10-20 · Status: decided autonomously on request ("You govern this feature. Do what you think
is best. Analyze current system. Use best practices. Pick recommended. I am away from machine. Plan it
out and then finish on your own").

## Request

- Diet plans for different diet goals, planned ahead with a shopping list, because people buy food
  about once a week.
- The plans adjust to the person: their goal and their measurements.
- "Food planned ahead and a shopping list for each shop", so the user can follow along and reach
  the goal with what certain shops sell.
- One person. Adjustable length, never shorter than the next 5 days.
- Keep the rule: one physical shop, or one physical shop plus one online shop.

## What exists (analysis)

- **Profile and targets** (`src/food/diet`): sex, age, height, weight, activity, steps, a daily
  calorie goal (`dailyKcal`, set by hand or by pace chips for losing 0.25–1 kg a week) and an eating
  style (`DietProfile`: high-protein reduction, balanced, low carb, keto, sport). Each style turns a
  calorie goal into macro targets (`targets`) and judges a food (`fit`). `dayGoal` corrects a day's
  goal by the week's balance (`adaptWeekly`). Only losing weight is supported well: the pace chips,
  the warnings and the reach date (`dayReaching`) all assume the target is below the start.
- **Measurements**: weight lives in the gym tracker's weigh-ins, steps in its entries and the watch,
  height in its profile (`GymBridge`); `useMergedHistory` lays them over the diet's days.
- **Planning a day**: an imported Excel plan (`Plan`, repeating day templates, `PlanDayCard`), or
  „Propozycja dnia” (`autoDay`): one food per slot for one day, from the pool, rerolled by a seed.
  Nothing plans several days, nothing cooks ahead, nothing makes a shopping list.
- **Recipes** (`src/food/recipes`): 73 recipes, each passing its rule per serving; 24 are cooked for
  2–8 servings. Ingredients have roles (`store`, `staple`, `pantry`). `resolveRecipe(recipe,
  candidates, basket)` picks real products from a basket (one shop, or a shop and an online shop) and
  says which shop each item comes from. `recipeIndex` ranks physical shops (Biedronka, Lidl,
  Kaufland… Selgros last) and online shops.
- **Real data** (`npm run food:check-recipes`, 2026-10-20): Biedronka alone covers 59 of the 73
  recipes, 62 with one online shop. Products carry pack sizes (`quantity`) and,
  for many, a price (Open Prices, Selgros, the online shops).
- **Storage**: Dexie `produkty-pl-dieta` version 3 (profile, days, entries, plans, foods, sets,
  favorites), one backup file, one reset. Snapshots are the rule: what was eaten, a set, a favourite
  never change when the product base does.

## Decisions

### 1. What a meal-prep plan is

| Topic | Decision | Why |
| --- | --- | --- |
| Unit | A **plan for N days** (5–14, default 7), for one person, from a start date (today before noon, otherwise tomorrow; any day up to a week ahead) | The request: at least the next 5 days, adjustable; two weeks is the most a fridge and a pantry hold for one shopping trip |
| Meals a day | 3, 4 (default) or 5. Four: śniadanie 25 % · obiad 35 % · podwieczorek 15 % · kolacja 25 %. Three: śniadanie 30 % · obiad 40 % · kolacja 30 %. Five: śniadanie 25 % · II śniadanie 10 % · obiad 30 % · podwieczorek 10 % · kolacja 25 % | The most common setting in meal planners; the shares give each meal a size |
| Cooking ahead | The plan is cut into **cooking blocks of at most 4 days**: cooked on the first day, eaten that day and the 3 after it. 7 days = 4 + 3 (two sessions, the classic Sunday and Wednesday prep); 5 = 3 + 2; 14 = 4 + 4 + 3 + 3 | USDA FSIS: cooked leftovers keep 3–4 days in the fridge. One session for a whole week would serve 6-day-old chicken |
| What is cooked ahead | **Obiad** comes from a batch recipe of the block (the same dish in every box of the block). „Gotowanie” setting: *Obiad z pudełka* (default; kolacja made fresh, ≤ 20 min) or *Obiad i kolacja z pudełka* (two batch dishes per session) | Lunch is what people box; a fresh supper keeps variety without a second pot. People who cook once want both |
| Batch recipes | Recipes cooked for 2+ servings (kind obiad, słone or słodkie) — 24 in the catalog; scaled to what the block needs (1 person, 4 days, 1¼ portions = 5 servings) | The catalog already marks home cooking by its servings; scaling down a cake for 8 is as valid as scaling up a chili for 3 |
| Fresh slots | Śniadanie: a recipe up to 15 minutes; snacks: up to 10 minutes or a gotowiec; kolacja (fresh): up to 20 minutes | What a person makes on a weekday morning |
| Variety | Two breakfasts and two snacks alternate; fresh suppers rotate through up to three; each block gets a batch dish of its own | Meal prep lives from repetition — every recipe less is a shorter list and less cooking; two alternating options keep it bearable |
| Equal boxes | All boxes of one batch have the same portion and the same side | „Podziel na 4 równe pudełka” is how meal prep is done; a pot divided 24 %/29 % is not |

### 2. Goal, targets and the journey

| Topic | Decision | Why |
| --- | --- | --- |
| Targets per day | The profile's `dailyKcal` turned into macro targets by the eating style, as in the diary. When the profile corrects by the week (`adaptWeekly`), the week's balance so far is spread **once** over the plan's days in the current week (10 % cap); later weeks start clean | Calling `dayGoal` for each future day would charge the same surplus to every day |
| Goal types | The profile's pace chips get **utrzymanie** and **+0,25 kg/tydz.** next to the four losing paces. Direction comes from the target weight vs the start weight; warnings and the reach date follow it (gain: first day at or above the target; a surplus is not a warning when the goal is to gain; gaining faster than 0.5 % of body weight a week is) | "Different types of diet goals" for a strength-training app means losing, keeping and gaining; only losing worked. 0.25–0.5 % a week is the usual lean-gain advice (Iraki et al. 2019) |
| Eating style in the plan | Recipes judged `avoid` by the style are never planned; `great` ones are preferred. Keto and low carb get fat sides, sport and balanced get carb sides (§3) | The style is the person's "eating plan" |
| The journey — check-in | Before each plan: the **check-in** compares the last 28 days of weigh-ins (linear trend) and logged intake with the energy model. Observed expenditure = mean intake − trend × energy per kg. When it differs from the model's by ≥ 100 kcal, the new goal is the profile's corrected by that error (at most ±250 kcal at a time, never below BMR, 1500 kcal for men, 1200 kcal for women). Reached the target weight → maintenance at the observed expenditure | This is how adaptive apps (MacroFactor's weekly check-in) follow a person: the scale and the log say what the formula guessed wrong. The ±250 kcal cap keeps one noisy month from swinging the goal |
| Enough data | At least 4 weigh-ins spanning 14 days, and intake logged on 75 % of those days; an observed expenditure outside 0.8–2.5 × BMR means the log is incomplete. Otherwise: "za mało danych", the profile's goal | A trend from two weigh-ins is water; half a log makes everyone look like they burn 1200 kcal |
| Who decides | The form shows the check-in as a choice, the adjusted goal **preselected** (Zalecane) with the reason in numbers; generating with it saves it in the profile, so the diary and the plan agree | "The plans adjust themselves", but a calorie goal never changes silently: one place, one number, a visible reason |
| Stale plan | A plan remembers the goal it was made for; when the profile's goal or style changes, the plan page says so and offers a new plan | Bought food stays bought; the next shopping follows the new goal |

### 3. Choosing recipes and portions (`src/food/prep`)

| Topic | Decision | Why |
| --- | --- | --- |
| Candidates | Every recipe available **in the plan's basket** that passes its rule (`resolveRecipe`), minus exclusions, minus `avoid` fits | The basket rule decides what can be bought, as everywhere else |
| Exclusions | Chips: *Bez mięsa*, *Bez ryb i owoców morza*, *Bez jajek* (vegetarian = the first two) | The most common reasons a plan is useless to someone; dairy is in most protein recipes, so "bez nabiału" would leave nothing |
| Score | Fit (great 1, ok 0.4), protein per kcal, a serving close to the slot's size, quick for fresh slots, +0.3 for a starred recipe, +0.1 per ingredient shared with recipes already chosen (max 0.3) | Shared ingredients shorten the list and finish the packs (a 500 g skyr serves breakfast and a snack) |
| Pick | Seeded: one of the four best, weighted 4-3-2-1, as „Ułóż dzień” does; „Inny plan” changes the seed | A plan is stable until the user asks for another |
| Swap one recipe | „Wymień” on a recipe of the plan replaces it everywhere with the next candidate of the same role and rebuilds portions and the list; the rest stays | Disliking the chili must not reshuffle the whole week |
| Portions | 0.5–2.5 servings in steps of ¼. Gotowce and recipes with pack items (a bar, a bottle) stay at 1 | One person needs more than a recipe's serving on 2600 kcal and less on 1600; a quarter is what a spoon can measure. A bar is a bar |
| Sides | When the recipe has no starch of its own: rice (dry) or potatoes with a box, a roll with a fresh supper or a savoury breakfast, a banana with a sweet one or a snack; oil or avocado as the fat side. Steps: rice 25 g, potatoes 100 g, roll 1, banana 1, oil 5 g, avocado ½. All are staples or pantry goods | Protein-forward recipes alone make a sport or balanced day 50 % protein; "chili + rice" is how it is eaten. Staples keep the basket rule untouched |
| Optimiser | Coordinate descent over portions and side steps (single and paired moves) on a day score: energy (main), protein below target or minimum, carbohydrates over the style's limit, fat below its minimum or over its maximum, each meal near its share, a small cost for leaving 1 serving and for each side step | Deterministic, fast (14 days × 5 meals in milliseconds), testable; a solver library would be the first dependency for a dozen variables |
| Result | Each day within ±7 % of its energy, protein at least the minimum, carbs within the keto/low-carb limit — checked by tests on every style; a day that cannot reach it is shown with its status, never hidden | The numbers the diary judges a day by |

### 4. The shopping list

| Topic | Decision | Why |
| --- | --- | --- |
| Groups | **One visit** (the physical shop, by aisle: warzywa i owoce, pieczywo, nabiał, mięso i ryby, mrożonki, suche i puszki, inne), **one order** (the online shop, with product links), **sprawdź w domu** (pantry goods: oil, spices, protein powder) | The order one walks a shop in; an online order is placed once; pantry goods are bought once a month |
| Amounts | Ingredient grams added up over the plan, then **packs of the chosen product** („3 opak. × 450 g”, 5 % short of a pack still counts as one), pieces for countable staples („14 jajek”, „3 banany”), grams otherwise | A list says what to put in the trolley, not "1350 g skyr" |
| Products | The product each recipe resolves to in the basket (the same one for every recipe that uses the ingredient); staples from the physical shop's products, or the generic name | One product per line, the one the macros were computed from |
| Prices | Packs × the product's price (per kg when sold by weight), summed per shop, "ok." and how many lines have a price; from Open Prices, Selgros and the shops' pages | An estimate, said to be one |
| Freezing | Raw meat and fish needed on day 3 or later: „zamroź po zakupach, rozmroź w lodówce dzień wcześniej” with the amount and the day | Raw poultry and minced meat keep 1–2 days in the fridge; "shop once a week" needs this line |
| Ticking | Each line has a checkbox; ticks are stored with the plan (the list works offline, in the shop, without the product base); „Udostępnij listę” sends it as text (Web Share, clipboard as fallback) | The list is used in a shop, on a phone, often without signal |

### 5. Following along

| Topic | Decision | Why |
| --- | --- | --- |
| Diary | On a day the plan covers, **„Plan na ten dzień”** shows its meals (portion, side, kcal and B·W·T) with „Zjadłem” / „Cofnij” (an entry with the slot as `planIndex`, key `recipe:<id>`), the day's planned kcal under the balance, and on a cooking day „Dziś gotujesz: …”. It replaces the Excel plan's card and „Propozycja dnia” on those days | Following along is ticking off; one plan per day on screen |
| Precedence | For a date, the most recently created plan that covers it; the Excel plan and „Propozycja dnia” fill the rest | A new plan is the newest decision; planning next week ahead does not cut the current one short |
| Next plan | The form starts on the day after the current plan ends, with the last plan's settings | Planning the next shopping trip on the last day is the weekly ritual |

### 6. Where in the app

| Topic | Decision | Why |
| --- | --- | --- |
| Plan page | `#/jedzenie/plan` („Plan posiłków”) becomes the hub: the meal-prep plan (or its form) first, the Excel plan below it („Plan z arkusza”) | "Nie masz jeszcze planu" is exactly where this belongs; the Excel plan stays as it was |
| Form | `#/jedzenie/plan?nowy=1` (Back closes it): start, days, meals, cooking, shop (nearest from „W pobliżu”, else the profile's, else the best), online shop (none by default; each says how many recipes it adds), exclusions, goal (check-in) | One screen, sensible defaults; the dataset loads while it is open |
| Plan view | Summary (dates, shops, goal, average day), „Przepisy w planie” (by role, with „Wymień”), „Gotowanie” (sessions, amounts, boxes, freezing), „Dzień po dniu” (today open), actions Lista zakupów · Inny plan · Usuń plan | What, when to cook, what to eat when |
| List page | `#/jedzenie/zakupy` („Lista zakupów”, back to the plan); also a PWA shortcut | One tap from the home screen in a shop |
| Code | Pure logic in `src/food/prep/`, screens in `src/food/components/prep/` with the CSS prefix `fd-prep-` (a sixth food area) | The pattern of every food area |

### 7. Storage

| Topic | Decision | Why |
| --- | --- | --- |
| Table | Dexie version 4: `prep` (`++id`), one row per plan — a **snapshot**: settings, shops with names, goal and check-in, day targets, chosen recipes, meals with nutrients, batches with scaled ingredients, the shopping list, ticks | The list must work offline without the 3 MB product base; a rebuilt base never changes what was bought |
| History | The 12 newest plans are kept, older ones removed when a plan is made | Small, and enough to see past weeks |
| Backup | `prep` in the diet backup, `cleanPrepPlan` on restore (whole plan or nothing), cleared by „Usuń wszystkie dane”; backups without it restore | One backup, one reset |

## Error handling

- Product base loading or failing: the form waits or offers a retry; an existing plan and its list
  render from the snapshot.
- No recipe for a role in the chosen basket and style (keto at Żabka): the form says which meal and
  suggests another shop or an online shop; no half plan is stored.
- „Wymień” with no other candidate: the button says so.
- A plan whose recipe left the catalog keeps its snapshot; cooking steps are shown only while the
  recipe exists.
- Restore drops an unreadable plan and counts it.

## Testing

- Pure: blocks; slot shares; candidates (basket rule, exclusions, fit); selection (seed, rotation,
  distinct batches, overlap bonus); optimiser (every eating style and meal count on the real catalog:
  energy ±7 %, protein ≥ minimum, carb limits; boxes equal; gotowce fixed); targets with the weekly
  balance spread once; check-in (no data, on track, slower, faster, floor, step cap, goal reached,
  implausible log); shopping (aggregation, packs, pieces, prices per kg, groups and aisles, freezing,
  pantry); aisle map covers every ingredient; goal direction and reach date for gain.
- Storage: DB upgrade v3 → v4 keeps data; backup round trip with plans; clean plan; prune to 12.
- Components: form → plan (defaults, check-in choice saves the profile, exclusions, online shop),
  plan view (sessions, days, swap, delete), list (groups, ticks persist, share), diary card (tick off,
  undo, cooking note, precedence over the Excel plan), profile chips for maintenance and gain,
  routing of `#/jedzenie/zakupy`.
- Gates: typecheck, tests, lint (no new warnings), build; a look at 360 px.

## Out of scope

- Plans for several people, a freezer inventory, leftovers tracking, live prices, delivery costs.
- The forecast using the plan's calories (they follow the same goal, within a few percent).
- Swapping a single meal on a single day (the diary's „Dodaj zjedzone” covers eating something else).
