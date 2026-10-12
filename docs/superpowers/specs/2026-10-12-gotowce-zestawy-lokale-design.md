# Ready-to-eat sets, own sets and restaurant chains in Jedzenie — design

Date: 2026-10-12 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Requests (all about the Jedzenie tab)

1. „Dodać potrawy bez naczyń (gotowce?)” — meals that need no cookware: bought and eaten as they
   are.
2. „Albo gotowy set np. Banan + batonik” — a ready set of foods, e.g. a banana and a bar, logged as
   one thing.
3. „Dodaj popularne sieci gastronomiczne wraz z ich makroskładnikami, kalorycznością itp. tak jak
   dla produktów (Starbucks, McDonald's, Costa Coffee, KFC, Pizza Hut i inne znane sieci
   gastronomiczne występujące w Polsce)”.

## What exists (analysis)

- **Food model.** Everything edible is a `Food` (`src/food/diet/foods.ts`): key, name, detail,
  `source` (`product | recipe | plan | custom`), amount label, nutrients for that amount, per-100 g
  macros when grams can be changed, chains that sell it, `atHome`, `everywhere`, `role`
  (`main | light | addon`). The diary pool (`diet/pool.ts`) is recipes (resolved per shop), ready
  protein products, plan lines and the user's own foods. Suggestions, „Ułóż dzień”, swaps and the
  „Dodaj zjedzone” picker all work on `Food`.
- **Eaten = snapshot.** `Entry` rows (Dexie `produkty-pl-dieta`, version 1: `profile`, `days`,
  `entries`, `plans`, `foods`) copy name, amount and macros, so history never changes when data
  does. Own foods (`foods` table) are name + kcal + optional macros, made from „Tylko kalorie →
  Zapisz jako moje jedzenie”, listed and deleted in Profil diety → Twoje dane.
- **Pairs already exist** inside the engine: `combine()` in `diet/suggest.ts` builds „A + B” foods
  for swapping big plan items — but only as transient swap options; a person cannot make or keep
  one.
- **Recipes** (`src/food/recipes`): a catalog of 30-odd recipes made of ingredient roles
  (`store` must be found in one chain's products, `staple` is in every shop, `pantry` is at home),
  resolved against the 29 k-product dataset per chain, with THE RULE of the tab: per serving more
  protein than carbs and more than fat. Each recipe names a `tool` („Patelnia”, „Blender”,
  „Łyżka”…). None is „no dishes at all”, and the banana + bar the user names would fail the rule
  (it is a carb snack with a protein bar).
- **Products** (`#/produkty`): Open Food Facts browser. Restaurant food is not in it — the dataset
  has five Starbucks retail drinks and nothing from the menus.
- **IA.** Jedzenie has four sections in a segmented switch: Dziennik · Przepisy · Produkty ·
  W pobliżu. At 320 px that is 68 px per item; the CSS already shrinks the type for four
  (`.sect-switch[data-n="4"]`). Drill-down subpages (`#/jedzenie/plan|postep|profil`) have a back
  arrow and no switch.

## Decisions

### 1. „Gotowce” — no-dishes sets in the recipe catalog

| Topic | Decision | Why |
| --- | --- | --- |
| What a gotowiec is | A recipe of kind **`gotowiec`** („Gotowiec”): 2–3 ready-to-eat things bought in one shop and eaten from the pack — no cooking, no bowl, no blender. `tool: 'Bez naczyń'`, 1 minute, one-line „how” | The recipe machinery already does the hard part: one shop that sells everything, real products instead of typical values, swapping a product, nearby shops, the diary pool. A separate „sets catalog” would duplicate all of it |
| The rule | Gotowce have their own, stated rule: **at least 15 g of protein per set** (on typical values in the test, on the chosen products on the card). Protein recipes keep THE RULE unchanged | „Banan + baton” is a carb snack with a protein bar — the protein-over-carbs rule would exclude the user's own example. 15 g is a meaningful protein snack (a bar alone gives ~15–20 g) and still keeps the tab's protein character. Mixing rules silently would break the page's promise, so each card says which rule it meets |
| Pack-sized items | `RecipeItem.pack: true` — the amount is **the chosen product's pack** („1 baton” = the bar's real weight, „1 butelka” = the drink's real volume); catalog grams are the typical pack, used until a product is known | Bars are 35–65 g and drinks 250–500 ml; „60 g of a 45 g bar” is a number nobody eats |
| Where | Same list as recipes (quick tier, they take 1 minute), new chip **Rodzaj: Gotowiec**. The page lead names both rules | Filters, store chips, nearby and the pool work unchanged |
| Catalog | 11 sets (kefir z bułką added during implementation), e.g. Banan + baton białkowy (the user's example), Napój proteinowy + banan, Skyr naturalny + borówki, Serek wiejski + bułka grahamka, Jogurt proteinowy + jabłko, Kurczak w plastrach + wafle ryżowe, Twarożek + pomidorki, Łosoś wędzony + pieczywo chrupkie, Tuńczyk + wafle ryżowe, Baton białkowy + napój proteinowy | Things Polish shops (incl. Żabka) actually sell, eaten without dishes |
| New ingredients | `banana`, `apple` (staples, typical values from USDA FoodData Central, no product match — fruit entries in OFF are inconsistent), `grahamRoll` (staple, typical from the dataset median), `riceCakes`, `crispbread`, `proteinBar`, `proteinDrink` (store ingredients with matchers; bar and drink reuse the „ready products” claims) | Same pattern as existing ingredients |

### 2. „Moje zestawy” — the user's own sets

| Topic | Decision | Why |
| --- | --- | --- |
| Model | New Dexie table **`sets`** (DB version 2): `{ id, name, parts: SetPart[] }`, each part a **snapshot** (name, amount label, kcal, macros, original food key) | The same reason entries are snapshots: a set that silently changes when the dataset is rebuilt (or vanishes when it fails to load) would log different numbers for the same breakfast |
| As a Food | `set:<id>`, source **`set`**, detail „zestaw · Banan + Baton…”, amount „1 zestaw”, nutrients = sum (a macro unknown in any part is unknown in the sum — same as `combine()`), role by kcal (≥ 350 main) | One shape for search, suggestions and logging |
| Making one | „Dodaj zjedzone” gets a third mode, **„Zestaw”**: name field, „Dodaj składnik” search (everything the picker finds — products, recipes, plan, own food, restaurant items), each part with grams when it has per-100 g values, a live total; **„Dodaj”** logs it, with **„Zapisz jako mój zestaw”** ticked by default | Mirrors „Tylko kalorie → Zapisz jako moje jedzenie”. Making a set at the moment it is eaten is when people do it (MyFitnessPal/Yazio „save meal”) |
| Logging | One diary entry, name = set name, amount label = parts („Banan 120 g + Baton 50 g”), `source: 'set'`, `key: 'set:<id>'` | One food, one line; the entry list stays readable. Parts are in the amount label |
| Finding | Own sets come first in the picker (with own foods, plan and recipes) and enter the suggestion pool; availability like own food (score 0.3, where „Twój zestaw”) | A set is a habit — it should be one tap away |
| Managing | Profil diety → Twoje dane → **Moje zestawy**: list with totals and delete (same as Moje jedzenie). No in-place editing in v1 — delete and make again | Consistent with own foods; YAGNI |
| Backup | `sets` added to the diet backup (`exportAll`, `restoreAll` with `cleanSet`, `clearAll`, `hasFoodData`, `dietBackup`). Backup `version` stays 1, `sets` optional | Old backups restore (no sets), new backups restore in this build; an older build ignores the extra field |

### 3. Restaurant chains („Lokale”)

| Topic | Decision | Why |
| --- | --- | --- |
| Data source | **Only official data of each chain** (Polish website, nutrition table/PDF, product pages), transcribed per portion with portion weight when published, plus sugars, fibre, saturated fat and salt when published. Each chain records its source URL, date checked and market (`PL` preferred; another market only when the Polish menu publishes nothing, shown on screen). Chains without official full macros are left out | Numbers on a diet screen must be traceable; aggregators (fatsecret, ilewazy) are user-entered and drift |
| Storage | One JSON per chain in `src/food/restaurants/data/`, loaded through `import.meta.glob` into one lazily imported module (`restaurants/catalog.ts`) | Small (tens of kB gzipped), versioned in git, reviewable diffs; a separate chunk keeps the diary's first render light |
| Data checks (test) | Valid schema and category; unique item ids per chain; Atwater check (4·B + 4·W + 9·T within ±15 % or ±25 kcal under 170 kcal) unless the item is listed in the chain's `source.note` as inconsistent in the source; sugars ≤ carbs, saturated ≤ fat; `checked` is a date; every chain has a source URL | Catches transcription errors the way the products pipeline drops physically impossible values |
| As a Food | `restaurant:<chain>:<item>`, source **`restaurant`**, detail „McDonald's · Burgery”, amount = the menu portion („1 szt. · 217 g”), fixed (no gram editing — a portion is what is served) | Logged in one tap like any food |
| Where in the app | **`#/lokale`** — a drill-down from Produkty (entry card at the top of Produkty: „Sieci gastronomiczne — McDonald's, KFC, Starbucks i N innych”), back arrow to Produkty; **`#/lokale/<chain>`** for one chain's menu, back arrow to Lokale | A fifth item in the section switch does not fit 320 px (54 px per item; „Dziennik” and „W pobliżu” would break). Restaurant food is „products from a restaurant” — the user asked for it „like products”, so it lives under Produkty |
| Lokale page | Lead with the data note, search across all chains (`?q=`), list of chains (name, kind, number of items, market note) | Search answers „how much is a Big Mac”, the list answers „what's at KFC” |
| Chain page | Source line (link, date, market), **„Najwięcej białka”** — the 3 items with the most protein per kcal among items with ≥ 15 g protein, category chips (`?kat=`), sort (menu order / most protein / fewest kcal / protein per kcal, `?sort=`), rows with kcal, B·W·T and the diet profile verdict when a profile exists; tap opens a sheet (`?p=`, Back closes) with the full nutrition table per portion and per 100 g and **„Dodaj do dziennika”** (today, toast) | Mirrors the product browser (state in the address, Back closes the sheet), plus the one thing a person on a diet asks at a counter: what is the best protein option here |
| Diary search | „Dodaj zjedzone” searches restaurant items too (chain name + item name, accent-insensitive), shown after own foods and before Open Food Facts products, at most 12 | „big mac”, „latte grande” are typed in the diary, not browsed |
| Suggestions | Restaurant items are **not** in the suggestion pool | Without knowing which restaurants are near, „Co teraz? — Twister z KFC” would be noise. Nearby restaurants are out of scope (below) |

### Copy and design

- Polish UI, the app's tone: dry where numbers are, no jokes on data screens.
- Existing primitives only (`.grp`, `.btn`, `.chips`, `.seg`, `Sheet`, `Segmented`, `.fld`);
  new CSS in `src/food/components/restaurants/restaurants.css` with the area prefix **`fd-rest-`**
  (enforced by `src/food/css.test.ts`); set builder classes stay `fd-diet-`.
- Category labels: Burgery, Kanapki i wrapy, Kurczak, Pizza, Sałatki i bowle, Śniadania,
  Frytki i dodatki, Desery, Kawa i napoje gorące, Napoje zimne, Sosy, Dania, Zupy.

## Error handling

- Restaurant chunk fails to load → the Lokale page shows the existing status screen with retry;
  the picker searches without restaurants (no error in the picker).
- Unknown chain or item in the address → Lokale list / chain page without the sheet (as products
  do with an unknown code).
- Set with no parts cannot be added; a part with unknown macros makes the set's macro unknown,
  shown as „makro nieznane” (as entries do).
- Restore: a set row that cannot be read is dropped and counted like any other row.

## Testing

- Pure: `restaurants/catalog.test.ts` (data checks above), `restaurants/food.test.ts`,
  `restaurants/search.test.ts`, `restaurants/url.test.ts`; recipes: gotowiec rule, `pack`
  amounts, new ingredient matchers, catalog rule per kind; diet: `setFood`, `cleanSet`,
  backup round trip with sets, DB upgrade v1 → v2 keeps data; picker search ordering.
- Components (jsdom): picker „Zestaw” mode (build, log, save), Moje zestawy list/delete, Lokale
  search and chain page (sort, category, sheet, add to diary), Produkty entry card, routing of
  `#/lokale` and `#/lokale/<id>` (title, parent).
- Gates: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`; a look in the browser.

## Out of scope

- Restaurants near the user (Overpass `amenity=fast_food|cafe` with brand) and restaurant items
  in „Co teraz?” — a natural next step once the data proves useful.
- Editing a saved set in place; sets inside the meal plan; scaling a restaurant portion.
- Allergens of restaurant items (chains publish them, but the request is about macros and
  calories).

## Implementation notes (decided while building)

| Topic | Decision | Why |
| --- | --- | --- |
| Chains found | 18 chains, 1189 positions: McDonald's, KFC, Burger King, MAX, Popeyes, Subway, Pasibus, Starbucks, Costa, Green Caffè Nero, Pizza Hut (table of 05/2019, said on screen through the source title), T-Pizza, Da Grasso, Salad Story, ORLEN Stop Cafe, Circle K, bp, Żabka Café | Every chain with official full macros reachable on 2026-10-12. Without: Domino's, Sphinx, Shell, Bobby Burger (no macros published); Tim Hortons, Dunkin', Krispy Kreme (not in Poland); North Fish (bankrupt) |
| Source errors | `source.inconsistent` lists positions the chain's own table gets wrong (energy vs macros, sugars > carbs); `MenuItem.inconsistent` also flags any energy mismatch. Flagged positions stay, are marked in the list and the sheet, and never reach „Najwięcej białka” | Which number is wrong is unknowable; hiding them loses real menu items, showing them silently misleads |
| Kind `sklep` | Żabka Café is a shop, not a fuel station | Honest grouping on the chain list |
| Chain page title | „Menu” in the app bar, the chain name large in the content | Routing does not load data; same rule as the exercise page |
| Search ranking | Restaurant and product hits are ranked together by name closeness (the name itself, starts with, word starts, contains), punctuation-insensitive; restaurant positions are ranked across all chains before the cap of 12 | „banan” must find the banana before „Ciasto bananowe”, „latte” must reach Starbucks |
| Set grams | A part with per-100 g values and an empty or zero gram field blocks „Dodaj” | It would otherwise silently become a whole pack |
| Drinks | Portion labels of drinks keep the chain's size words; the sheet labels grams of drinks „g (ml)” | Chains weigh drinks in grams or measure them in ml, and the data does not say which |
