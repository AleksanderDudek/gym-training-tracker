# Meal photo: always an estimate, "not food", a check against the database — design

Date: 2026-10-29 · Status: built · Decided autonomously on request ("nie podało mi kalorii nawet
szacunkowych dla zdjęcia … powinno się skupić: 1. rozpoznanie zdjęcia, 2. oszacowanie kalorii
i makro, 3. można odnieść szacunkowe wartości biorąc pod uwagę produkty z bazy, które mają zbliżony
opis … masz wolną rękę … Pick recommended. I am away from machine").

Builds on `2026-10-27-zdjecie-posilku-design.md` and `2026-10-28-zdjecie-status-design.md`.

## What was wrong

- **No number unless the model was sure.** Below 0.6 the screen said „Nie jestem pewien — wybierz”
  and showed chips; kcal and macros appeared only after a tap. On real photos that is common:
  Commons photos taken like phone photos (28, a dozen dishes) reached 0.6 far less often than the
  Food-101 benchmark, and e.g. pierogi at a restaurant came out as „langosz”.
- **A photo with no food got dishes anyway.** A screen, a room or a cat still gets five dishes,
  each "probable" after the softmax; nothing said that the photo shows no food.
- **The catalog was the only source of values**, although the app has products, recipes and
  restaurant menus with real labels.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Always a number | After every recognised photo the first dish goes onto the plate: kcal (with range) and macros show at once. When the model is not sure, the item is marked *wstępne*: its range covers the other likely dishes (those with ≥ 10 % of the probability, each at its usual portion), and tapping another suggestion *replaces* it instead of adding a second dish. Touching the portion, a scale or the database check confirms it | The owner's order: recognise, then estimate — an estimate that waits for a tap is not one |
| The answer at the top | Right under the photo, one card: what it is („Pad thai — pewne, 86 %” / „Najpewniej pad thai (34 %), może też: pho, ramen”), then the plate's total in large type with the range and B/W/T, and what to do next | The number must be visible without scrolling |
| Not food | SigLIP 2's own calibrated match, `sigmoid(112.67 · cos − 16.77)`, is near 0 when no dish phrase fits. Measured (Node, the shipped q4f16 weights, 28 Commons food photos and 15 other): food photos' best cosine 0.128–0.190 (one museum "salad plate" — ceramics — 0.088); screens, rooms, trams, cats 0.051–0.121. Below **0.105** the screen says it sees no food, puts nothing on the plate and offers „To jednak jedzenie — pokaż propozycje” | One number the model already has; no new model, no extra download |
| Check against the database | Under each dish on the plate: „Podobne w bazie” — products, recipes, restaurant positions and the person's own foods whose name matches the dish (full name, then fewer words), with kcal/100 g, the range of those values next to the catalog's, and „Użyj” on each. Chosen values replace the catalog's per 100 g for that dish; the portion in grams and the fat/sugar/sauce steps still apply. The entry says where its values come from | Point 3 of the request; real labels are often better than a generic USDA dish, and the person decides |
| Search | The diary's own `searchFoods` (same pool as „Szukaj”), only foods with values per 100 g, within 0.5–2× the dish's kcal/100 g, second copies (same name and kcal) dropped | Same results as typing the name; on the built app „Schabowy” otherwise brought „Panierka … Schabowy” (breadcrumbs, 374 kcal/100 g) |
| Checked on the built app | Commons photos at 360 px: spaghetti bolognese → 543 kcal (326–760), database 116–132 kcal/100 g vs the catalog's 143; schabowy → 718 kcal, database 97–119 vs 156; a tram → „nie widzę jedzenia”. Restaurant pierogi still come out as „Langosz — pewne (75 %)”: recognition errors remain the model's, the chips and the search fix them in one tap | |
| Logging | Unchanged: nothing goes into the diary before „Dodaj do dziennika” | An estimate is a proposal |

### Considered, not done now

- A probability-weighted mix of dishes as the logged value: a blend of pad thai and pho is no
  dish; the range carries the doubt, the central value stays one recognisable dish.
- "Not food" prompts in the dish table: needs re-running the 1.1 GB text model; the calibrated
  match already separates the measured sets.
