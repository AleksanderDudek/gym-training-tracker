# Favourites („Ulubione”) — design

Date: 2026-10-15 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request

„Chciałbym móc oznaczać produkty jako ulubione (gwiazdki), żeby mieć listę szybkiego wyboru
w przypadku rzeczy, które jem najczęściej.”

## What exists (analysis)

- Everything edible is a `Food` (`src/food/diet/foods.ts`) with a stable `key`: `product:<code>`,
  `restaurant:<chain>:<item>`, `recipe:<id>`, `custom:<id>`, `set:<id>`, `plan:<text>`. Eaten
  entries keep that key.
- „Dodaj zjedzone” (`FoodPicker`) is the one place where food is logged by search; with no query
  it lists the user's own things (sets, own foods, plan, recipes). Products open in a sheet
  (`ProductDetail`), restaurant positions in `MenuItemSheet`, eaten food is listed in the diary
  (`EatenCard`).
- The diet DB (Dexie `produkty-pl-dieta`, version 2) holds profile, days, entries, plans, own foods
  and sets; its backup goes into the app's single export file.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| What can be a favourite | **Any food**: a product, a restaurant position, a recipe, an own food, a set, a plan line — and anything already eaten (from the diary) | "Rzeczy, które jem najczęściej" are of every kind; the key already identifies them |
| Storage | New table **`favorites`** (DB version 3): `{ key, food, addedAt, uses, lastUsed }` with `food` a **snapshot** of the `Food` at the moment it was starred | Products and menus load lazily: a quick-pick list must render and log at once, offline, without the 30k-product base; same reason entries and sets are snapshots |
| Amount | The starred food's amount (a product's pack, a portion, the grams chosen in the picker when starred there). A starred product keeps its per-100 g values, so the picker can still change grams | "Jak zawsze" is the point of a favourite; changing it stays possible |
| Order of the list | **Most used first**: every log of a food with a favourite's key (from anywhere) bumps `uses` and `lastUsed`; ties by name | The list sorts itself into "what I eat most often" without the user curating it |
| Star control | A star button (`aria-pressed`, label „Dodaj do ulubionych: …” / „Usuń z ulubionych: …”, filled star when on, 44 px target) on: picker results and the chosen food, product detail, restaurant position sheet, eaten entries in the diary | Where a food is looked at, it can be starred — the standard pattern of food diaries (MyFitnessPal, Yazio, Fitatu) |
| Quick pick 1 — diary | Section **„Ulubione”** under the day's balance: favourites with a one-tap **„+ Zjadłem”** (logs at the stored amount, toast), at most 8 with „Pokaż wszystkie (N)”; with none, one sentence on how to add them | The fastest path: no sheet, no search |
| Quick pick 2 — picker | „Dodaj zjedzone” lists **Ulubione first** (with no query and among matches); a favourite's row has „+” to log at once, the name opens it to change grams | The usual entry point for logging stays complete |
| Suggestions | Favourites join the suggestion pool; a favourite gets a small bonus and the reason „Twoje ulubione” | They are by definition what this person eats |
| Managing | Profil diety → Twoje dane → **Ulubione**: the list with remove | Same place as own foods and sets |
| Backup | Favourites in the diet backup (`exportAll`, `restoreAll` with `cleanFavorite`, `clearAll`, `hasFoodData`); older backups restore without them | One backup, one reset |
| Dziś screen card | Unchanged; its „Dodaj zjedzone” opens the picker with favourites first | Keeps the gym screen calm |

## Error handling

- A favourite whose source disappeared (a product removed from the base, a deleted set) still
  logs from its snapshot.
- Restore drops unreadable favourite rows and counts them.

## Testing

Store (toggle, bump on log, sort, backup round trip, DB upgrade v2 → v3), validation, picker search
order, pool and suggestion bonus; components: star in picker / product detail / menu sheet / eaten
list, diary quick-pick (log in one tap, empty state, show all), data section list.

## Out of scope

Automatic "często jedzone" without stars, favourites on the Dziś card, syncing between devices.
