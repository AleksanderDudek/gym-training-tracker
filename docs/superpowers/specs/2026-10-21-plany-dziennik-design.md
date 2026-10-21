# Named plans, moving dates, a recipe picker and a cleaner diary — design

Date: 2026-10-21 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request (translated from Polish)

1. A list of meal-prep plans, each with its own name.
2. A plan's dates can be changed.
3. The plan that is set has its own place in the diary, when there is one.
4. Swapping a recipe in a plan opens a list of the recipes that fit (a window to choose from) —
   it makes the diet easier to personalise.
5. Improve the DZIENNIK (diary) view:
   - favourites open in a popup with their list, instead of the whole list on the page;
   - what was eaten sits directly under the favourites;
   - the weight question is at the very top.

## What exists (analysis)

- **Meal-prep plans** (`src/food/prep`, Dexie table `prep`, DB version 4) are snapshots: settings,
  goal, day targets, meals, batches, shopping list, ticks. They have no name. The newest twelve are
  kept (`KEEP_PLANS`), older ones are deleted when a plan is made.
- **Which plan the diary follows**: `planCovering` — of the plans covering a date, the one created
  last. `openPlans` lists the plans the diary still follows from today on; the plan page shows one of
  them (`?plan=`), with a two-tab switch („Teraz” / „Następny”). A plan that has ended cannot be
  opened at all.
- **Dates** are fixed at creation: `settings.start`, `dayTargets[].date`, `meals[].date`,
  `batches[].date`, `batches[].boxes[].date`, `shopping[].freeze[].date`. Cooking blocks depend only on
  the day index (`cookingBlocks`), so every date of a plan can be moved by the same offset.
- **Swapping a recipe** („Wymień”) replaces it at once with the best-scored candidate of the same
  role (`swapCandidate`) and puts the old one on the plan's `avoid` list. The user never sees what
  else would fit.
- **Diary** (`DiaryPage`, top to bottom): day switcher; balance (`MacroBars`) with „Dodaj zjedzone”;
  the favourites card listing up to eight favourites inline (with „Pokaż wszystkie”); links to Plan
  posiłków / Postęp / Profil diety; the plan of the day (meal prep, Excel plan, or „Propozycja dnia”);
  „Zjedzone”; „Co teraz?”; and at the very bottom „Waga, kroki i ruch” with the weight field.

## Decisions

### 1. Named plans and the list of plans

| Topic | Decision | Why |
| --- | --- | --- |
| Name | `PrepPlan.name?: string`, at most 60 characters, trimmed. A plan without one is shown under a **generated name**: the style and the shop („Sportowy · Biedronka”). The dates are always shown next to the name, never baked into it | A name that contains dates goes stale the moment the dates move |
| Where it is set | An optional „Nazwa planu” field in the plan form (placeholder: the generated name), and „Zmień nazwę” on the plan page (a sheet with one field) | Naming is optional; a plan made in a hurry still gets a readable label |
| List page | New subpage **„Moje plany”** (`#/jedzenie/plany`, back to Plan posiłków): every saved plan, ordered by start date with the newest first, each row with its name, dates, days and shops and a status — *trwa* (dzień n z N), *następny* (od …), *zakończony*, or *zasłonięty przez „X”* when another plan owns its days in the diary. Tapping a row opens the plan | A list of plans is a screen of its own; ended plans become reachable again (to look back, or to reuse) |
| Opening any plan | The plan page shows the plan asked for (`?plan=`) whatever its dates; without `?plan=` it shows the one running today, else the next one, else the form for a new plan (as before) | Today only open plans could be shown; a list that leads nowhere for ended plans would be broken. With nothing running or ahead, making the next plan is still the likeliest intent |
| Keeping plans | Plans **with a name** are never deleted automatically; the twelve newest **unnamed** plans are kept, as before | Naming a plan is the user saying „keep this one”; unnamed ones are routine weekly plans |
| Entry points | „Moje plany (N)” link at the top of the plan page, next to the current/next switch | One tap from where plans are made |

### 2. Changing dates

| Topic | Decision | Why |
| --- | --- | --- |
| What moves | „Zmień daty” moves the **whole plan** to a new first day: every date in the plan shifts by the same number of days (start, day targets, meals, cooking days and boxes, freezing reminders). Length, recipes, portions and ticks stay | Cooking blocks are defined by the day index, so a shift keeps the plan valid; changing the length means different portions and a different list — that is a new plan („Następny plan”) |
| Range | Any first day from 13 days ago to 90 days ahead | Enough to postpone a plan, pull it forward, or reuse an old one for a future week |
| Ticks | Kept. A sheet shows a checkbox „Wyczyść odhaczone na liście zakupów” — **on** when the plan is moved to start after its old end (a reuse: the shopping is new), off otherwise | Postponing by two days does not unbuy the food; reusing last month's plan does need a fresh list |
| Diary entries | Untouched: what was eaten stays on the day it was eaten | Entries are the truth; a plan is a proposal |
| Precedence after a move | A moved plan becomes the newest decision for its new days (`setAt`, below) | The user just chose these dates for it |

### 3. The plan the diary follows („ustawiony plan”)

| Topic | Decision | Why |
| --- | --- | --- |
| Precedence | New field `PrepPlan.setAt?: string` (ISO): set when a plan is created, moved, or chosen with „Ustaw w dzienniku”. For a date, the diary follows the covering plan with the latest `setAt ?? createdAt` | With moving dates and a list, „created last” no longer says which plan the user chose. One rule, explainable in one line |
| „Ustaw w dzienniku” | On the plan page (and as the status action in the list) when the plan is hidden on some of its days by another plan | Overlapping plans are now possible; the user decides which one they follow |
| Place in the diary | The plan has a fixed section, **right after „Zjedzone”**, titled with the plan's name („Plan na dziś · Sportowy · Biedronka”, linking to the plan). When no plan covers the viewed day but one starts later, the section says so in one line („Plan „X” zaczyna się w pon. 27 paź.”) with a link; with no plans at all it falls back to the Excel plan or „Propozycja dnia”, as before | „Swoje miejsce w dzienniku” — always in the same spot, recognisable by its name |

### 4. Swapping a recipe from a list

| Topic | Decision | Why |
| --- | --- | --- |
| Interaction | „Wymień” opens a sheet **„Wymień: <danie>”** with every recipe that can play that role in this plan; choosing one swaps it everywhere from today on (as before: eaten days and cooked boxes stay) | „A window with what is possible” — the user picks, the planner only ranks |
| Which recipes | The same rules as the automatic swap: available in the plan's basket and keeping its rule, not excluded, not „nie pasuje” in the style, fits the role (batch dish for boxes, quick one-serving recipe for fresh meals), not already in the plan, and for boxes under a carb limit only „pasuje świetnie”. Recipes swapped out earlier **are listed** (marked „wcześniej wymienione”) — choosing one deliberately brings it back | The rules are what keeps a plan cookable and on target; hiding a recipe the user wants back would be paternalistic |
| Order and labels | By the planner's score (fit, protein per kcal, size close to the meal, speed, favourite, shared packs). The first is marked **„Najlepiej pasuje”**; each row shows kcal and B·W·T per serving, minutes, „pasuje do stylu” for great fits, a star for favourites, and „wspólne zakupy” when it shares ingredients with the rest of the plan | The score is the planner's recommendation made visible; the numbers let the user judge |
| Search | A filter field when the list has more than eight recipes | The catalog has 70+ recipes; a box role can have 20 candidates |
| Avoid list | The recipe swapped out is still added to `avoid` (so „Inny plan” does not bring it back); the recipe chosen is removed from it | Keeps the old guarantee, lets the user override it |
| Empty | „Nie ma innego przepisu na <posiłek> w tym koszyku” with the hints the form uses (another shop, an online shop, fewer exclusions) | Same message as before, now inside the sheet |

### 5. The diary

New order, top to bottom:

1. Day switcher (it says which day everything below belongs to).
2. **Weight question** — see below.
3. Balance (`MacroBars`) with two actions: **„Dodaj zjedzone”** and **„Ulubione (N)”**.
4. **„Zjedzone”** — directly under the actions.
5. **Plan of the day** — meal prep (with its name), Excel plan, or „Propozycja dnia”.
6. „Co teraz?”.
7. „Kroki i ruch” (steps and the day's activity; the weight moved to the top).
8. Links: Plan posiłków · Moje plany · Postęp · Profil diety.

| Topic | Decision | Why |
| --- | --- | --- |
| Weight question | A compact card at the top: on today (and past days) without a weigh-in — „Ile dziś ważysz?” with a kg field and „Zapisz”, a hint with the last weigh-in („ostatnio 82,4 kg, 2 dni temu”) and the advice „rano, po toalecie, przed jedzeniem”. With a weigh-in — one line „Waga: 82,4 kg” with „Zmień”. Future days — nothing | Daily morning weigh-ins under the same conditions are what makes a trend usable (and the check-in needs them); a question answered once a day should not take the top of the screen all day |
| Favourites | „Ulubione (N)” opens a sheet with the full list, most used first, each row with „+ Zjadłem”; logging keeps the sheet open (several can be logged) and confirms with the toast; a filter field over eight favourites; the empty state explains how to star food. Disabled on future days | The list was pushing the day's content down; a sheet is one tap away and has room for all of them |
| Eaten | Right under the actions, so „what I just added” appears where the user tapped | Requested; also the natural reading order: balance → what made it |
| Links | Moved to the bottom; the weight card links to „Postęp”, the plan section to its plan | The top of the diary is for today's numbers; navigation is still one scroll away and the two most used targets get contextual links |
| Steps | Stay in „Kroki i ruch” lower down | Steps are entered in the evening or come from the watch; weight is the morning question |

### 6. Code

| Topic | Decision | Why |
| --- | --- | --- |
| Data | `name?` and `setAt?` on `PrepPlan` (no DB version change: no index); `cleanPrepPlan` keeps them when valid; backups carry them | Optional fields keep old plans and old backups valid |
| Pure logic | `prep/dates.ts` (`shiftPlan`), `prep/store.ts` (`planName`, precedence by `setAt`, `renamePlan`, `movePlan`, `setInDiary`, pruning that spares named plans), `prep/select.ts` + `prep/generate.ts` (`swapOptions`, `swapRecipe(…, to)`) | Tested without the UI |
| Screens | `components/prep/PlansPage.tsx` (list), sheets in `components/prep/` (`RenameSheet`, `DatesSheet`, `SwapSheet`), diary pieces in `components/diet/` (`WeighCard`, `FavoritesSheet`) | The existing areas and CSS prefixes (`fd-prep-`, `fd-diet-`) |
| Route | `DietPage` gains `plans` → `#/jedzenie/plany`, title „Moje plany”, parent Plan posiłków | Same pattern as „Lista zakupów” |
