# Meal photo: a catalog of 947 dishes — design

Date: 2026-10-30 · Status: built · Owner's request: "I want this model to be able to handle any
picture really" → chose **"Broad catalog"** (≈ 1000 dishes from cuisines worldwide plus catch-all
types, measured before and after) over catch-all types only. Plan:
`docs/superpowers/plans/2026-10-30-katalog-dan-plan.md`.

## What was built

- **947 dishes** (was 351): 564 new named dishes in eight regions — Central/Eastern Europe (65),
  Mediterranean (61), East Asia (59), South and Southeast Asia (71), Middle East, Africa and the
  Caucasus (57), the Americas (86), Britain/German-speaking/Nordic/Benelux/Balkans (60), everyday
  food, bakery, sweets, snacks, drinks and single foods (105) — and **32 catch-all types**
  („Zupa krem — inna”, „Gulasz, potrawka — inne”, „Obiad na talerzu — inny”, „Ciasto — inne”…).
- Every dish has USDA values per 100 g as served (392 one FNDDS food, 20 one SR food, 535 composed
  from USDA ingredients in grams as served), a typical portion and the scales that apply — the same
  rules and tests as the first 351.
- Regions are files: `src/food/photo/catalog/<region>.ts` (entries) and
  `scripts/food/dish-sources/<region>.ts` (USDA sources), shared helpers in each folder's `kit.ts`.
  `npm run food:find-usda -- <words>` finds FNDDS/SR foods with kcal/100 g.
- The app loads only the values (`data/dishes.json`, 168 KB — less than the old 184 KB for 351
  dishes); where each value comes from is in `data/dish-sources.json`, read by the tests only.
- The phone downloads 1.5 MB of phrase vectors instead of 0.5 MB (2002 phrases, int8); ranking
  2002 × 768 is a few milliseconds.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| How to cover "any picture" | Many named dishes + catch-all types, the same image model | An on-device model that describes any photo in words needs WebGPU and 300 MB–1 GB — phones crash on the current 0.2 GB already |
| Catch-all types | Marked `generic`; rank with a handicap of 0.008 in cosine, so a named dish that fits about as well goes first; the screen says „Nie znam dokładnie tego dania — to chyba zupa krem”, the item stays *wstępnie* | Measured: without the handicap they come first on 2.3 % of photos of named dishes, with it 0.5 %, top-1 unchanged |
| Who did the work | Eight parallel agents, one region each, own files, checked by the same build and tests; merged and the index files regenerated from the region files | Disjoint files merge without conflicts beyond the registration lines |
| Values reviewed | Flagged by the agents and an outlier sweep per dish group; biltong (eye of round instead of tenderloin: 403 → 326 kcal) and saganaki (pan-fried: 473 → 441) corrected | The rest of the flagged ones are documented stand-ins (e.g. gouda for oscypek) within a plausible range |

## Measured

Commons photos searched by each dish's first prompt, one or two per dish; the shipped image model in
Node, the app's ranking with the handicap. The labels are as noisy as Commons search, so the numbers
compare catalogs, they are not absolute accuracy.

| Photos | Catalog | Top-1 | Top-5 | kcal/100 g within 25 % | Mean kcal error |
| --- | --- | --- | --- | --- | --- |
| 564 of the old 351 dishes | old (351) | 65.1 % | 85.5 % | 78.9 % | 19 % |
| | new (947) | 55.5 % | 77.5 % | 74.3 % | 23 % |
| 474 of new dishes | old (351) — not in it | 0 % | 0 % | 43.7 % | 39 % |
| | new (947) | 60.1 % | 78.7 % | 76.6 % | 16 % |

- The old dishes lose ten points of top-1, mostly to near-twins that look the same and count about
  the same: gulasz ↔ pörkölt, steak ↔ steak frites, fried rice ↔ pineapple fried rice, naan ↔ roti,
  panna cotta ↔ crème caramel. The estimate loses far less (kcal within 25 %: −4.6 points).
- The new dishes go from always wrong to right in most cases; their kcal error halves.
- Over both sets (1038 photos) the estimate is within 25 % for 75.4 % of photos instead of 62.8 %.

### Considered, not done now

- Tuning prompts against these test photos: one or two photos per dish, a tuned catalog would only
  learn the test set. Only clear collisions were fixed (ramen, "rice cakes" = Korean tteok, a fried
  cheese "in a bun" that took sandwiches).
- Grouping near-twins into one entry: they differ in values often enough (pho 62 vs bún bò Huế 65 is
  close, steak 250 vs steak frites 230 is not identical) and the chips show the others.
