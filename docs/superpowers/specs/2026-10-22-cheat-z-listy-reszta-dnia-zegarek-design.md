# Cheat meal from the list, the rest of the day in variants, and a watch link you can understand — design

Date: 2026-10-22 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request (translated from Polish)

1. The cheat meal can also be searched in restaurant chains and in the product list, or added from
   favourites.
2. A bigger list of what can still be eaten — not one meal, but 2, 3 or more whose sum gives what
   is left.
3. A better experience with the Garmin integration: Bluetooth must be on, the right Garmin app
   installed, and so on. The user should not wonder why the data did not arrive on a given day:
   the time of the last transfer, when the next one is due, and whether it came. Maybe the watch
   and Bluetooth need switching on, maybe the data comes only in 30 minutes. A great experience.

## What exists (analysis)

- **Cheat meal sheet** (`CheatMealSheet.tsx`): typed name, kcal and macros; simulation underneath;
  rest-of-day food = up to 3 single suggestions.
- **„Dodaj zjedzone”** (`FoodPicker.tsx`): `searchFoods` finds own sets and foods, plan items,
  recipes, restaurant menus (lazy chunk) and products; favourites first; the „Zestaw” mode builds a
  set of several parts with grams and a live total (`SetBuilder`).
- **Rest of the day**: „Co teraz?” ranks single foods for what is left (`suggest`); „Propozycja dnia”
  (`autoDay`) composes a whole day by slots (Śniadanie 30 %, Obiad 30 %, Kolacja 30 %, Przekąska 10 %).
  Nothing composes several meals for the **remaining** budget.
- **Watch**: the watch app sends every 30 minutes in the background through Garmin Connect on the
  phone (Bluetooth), only after it was opened once and with the key in its settings; its own screen
  says „Sent HH:MM”, „No phone nearby”, „Wrong key”. The web app pulls on open and on return,
  stores `state.watch.t` (when the watch made the package) and `got` (when this browser received
  it), and the Garmin card says only „Ostatnie dane z zegarka: dziś 14:32”. No next time, no
  „late”, no checklist; the cardio screen and the Today card say nothing about the link. The phone
  companion (GYM TRACKER Zdrowie) has the same gap (hourly).

## Decisions

### 1. Cheat meal from the list

| Topic | Decision | Why |
| --- | --- | --- |
| Modes | The sheet opens on **„Z listy”** (search) with **„Wpisz makro”** next to it (`Segmented`) | Most cheat meals are a chain's menu or a known product; typing macros stays for the rest |
| Search | The same search as „Dodaj zjedzone” (`searchFoods`): restaurant menus, products, recipes, own food and sets; **favourites on top**, and shown before anything is typed | One search everywhere; favourites are the quickest |
| Several items | A cheat meal can have several parts with grams (pizza + cola + dessert), live total — the set builder extracted into a shared `PartsPicker` used by „Zestaw” and the cheat meal | A cheat meal is rarely one thing |
| Numbers | The parts' total fills the cheat meal; „Wpisz makro” starts from that total and can correct it | One source of numbers for the simulation |
| Name | Typed, or generated from the parts (as for sets: „Pizza + Cola”) | |
| Saved | `PlannedCheat.items` keeps the parts' names (and amounts) for the card; eaten, it is one entry, as before | The card shows what it is; the diary keeps one line |

### 2. The rest of the day in variants

| Topic | Decision | Why |
| --- | --- | --- |
| Engine | `restOfDay(foods, ctx, meals, seed)`: the last *meals* slots of the day (by the hour: lunch, dinner, snack…), each slot gets its share of **what is still left after the meals already picked**, so the last meal absorbs the error and the sum lands on the remaining kcal; protein follows the same way | `autoDay` splits a full day by fixed shares; the remaining budget needs the sum to fit |
| Variants | `restVariants(…, count = 3)`: three different sets (no food repeated within a set; sets differ), ordered by how close the sum is to what is left (kcal first, protein second) | "2–3 or more whose sum gives what is left" — choice, not one guess |
| In „Co teraz?” | Two views (`Segmented`): **„Reszta dnia”** (variants; default when 2+ meals are left) and **„Jeden posiłek”** (the existing ranked list). Each variant: its meals with slot, food, macros, „Zjadłem”, and the sum against what is left („980 z 1 000 kcal, 85 g białka”); „Inne warianty” rerolls | The day view answers "what could the rest of today look like"; the single list stays for "what now" |
| In the cheat-meal sheet | Under the verdict, two variants for the meals after the cheat meal (or single suggestions when one meal is left) | The consequences of the cheat meal, in food |

### 3. The watch link you can understand

| Topic | Decision | Why |
| --- | --- | --- |
| Status model | `deviceStatus(...)` (pure): `setup` (key saved, nothing received), `ok` (last package within the cadence + 15 min), `late` (overdue by up to 6 h), `stale` (more than 6 h), `bad` (package does not open with this key), `offline` (could not ask the server), plus the last package time, the expected next one and today's data | One model for every place that talks about the link |
| Cadence | Watch: 30 min; phone app: 60 min | What the senders do |
| Garmin card | Status header with a coloured dot: „Działa — ostatnia paczka dziś 14:32 (12 min temu), następna ok. 15:02”; today's steps from the watch and their time („rosną z każdą paczką”); after „Sprawdź teraz” whether a **new** package came or not and why; a checklist „Dane nie przychodzą?” ordered by the state | The user sees when, what next, whether it came — and what to do |
| Checklist (watch) | Bluetooth on and the watch connected to Garmin Connect (watch close to the phone); Garmin Connect installed, logged in and allowed to run in the background (Android: battery optimisation off; iPhone: background refresh on); GYM TRACKER opened once on the watch; the key pasted in its settings (Connect IQ Store app for the beta, Garmin Connect after release); phone online; Do Not Disturb / power saving / airplane mode on the watch off; the watch screen of GYM TRACKER tells the last send — START sends now | Everything that can break the chain watch → Bluetooth → Garmin Connect → internet → server |
| Elsewhere | The cardio screen shows one status line above „Z zegarka” (and „Z telefonu”); the Today „Kroki i cardio” card shows a line **only when late or stale** — never noise when all is well | The places where missing data is noticed |
| Phone card | The same status block with its own checklist (Health Connect permissions incl. background, battery optimisation off for GYM TRACKER Zdrowie, Garmin Connect writing to Health Connect, open the app) | Same question, same answer |
| Watch app | Its screen adds the next send time („Next ~15:02”); „No phone nearby” becomes „No phone — Bluetooth?”, in Polish „Brak telefonu — Bluetooth?” | The watch is where people look first; needs a new upload of the watch app |

## Decisions made during implementation

| Topic | Decision | Why |
| --- | --- | --- |
| Rest of the day too big for the slots | Extra items („Dodatkowo”, up to 3) join while more than 250 kcal and 15 % of the rest is left; variants also show for one meal when more than 900 kcal is left | On demo data two slots gave ~1000 of 2300 kcal — portions are 300–700 kcal |
| Shared search | „Zestaw” and the cheat meal use one `PartsPicker` (search, parts with grams, total) | One behaviour, one place to fix |
| Status thresholds | Measured from when the next package was due: late after 15 min overdue, stale after 6 h overdue | A late morning package should not alarm at once |
| Status line on Today | Only late/stale, and only after this visit asked the server | Right after opening, the saved data is still the old package — the line would flash |
| Watch next-send time | The background run also saves its time (`Sync.LAST_RUN`); the screen takes the later of it and `getLastTemporalEventTime()` | The SDK returns null for the latter after each app start — exactly when someone looks |
| Watch strings | Plain „-” instead of „—” | The watch font may lack the long dash; the web checklist quotes the watch text exactly |
| Links to the cards | `#/ustawienia?karta=zegarek` / `telefon`, the card scrolls into view below the sticky bar | Routes live in the hash |
| Empty mailbox with saved data | „Nothing sent for over a week” (the server keeps a package at most 7 days) | Accurate reason |

Not verified: the new watch screen layout on small devices (Instinct 2, vívoactive 3) and a real
background run; a new watch build must be uploaded (beta, then production).
