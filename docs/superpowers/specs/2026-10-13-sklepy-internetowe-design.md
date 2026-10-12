# Online shops: products, protein recipes and the fewest shops to buy them — design

Date: 2026-10-13 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Requests

1. Products of nine Polish online shops — guiltfree.pl, fitironsklep.pl, myprotein.pl, beketo.pl,
   diet-food.pl, cocoa.pl, cocofarm.com.pl, feel-fit.pl, bezmiesnymiesny.pl — "in a format similar
   to the products already in the app".
2. Protein recipes made with those products, in the same format as the existing recipes.
3. Every such product and recipe marked with its online shop, with a link to the shop.
4. Recipes grouped so they can be bought in the fewest shops: a physical shop plus an online shop,
   or online shops only.

## What exists (analysis)

- **Products** are Open Food Facts records (`Product` in `src/food/lib/types.ts`): barcode `code`,
  name, brand keys, pack size, categories (OFF tags), nutrition per 100 g, scores, `stores` (chain
  keys, labels in `dictionaries.stores`), one `price`. They come from one gzip file
  (`data/food/products.json.gz`) built by `npm run food:data` from a raw OFF dump that is not in git,
  fetched and indexed by `src/food/data.ts`. Everything downstream — Produkty (filters, facets,
  search), ready protein products, recipe ingredient candidates, the diary — consumes the indexed
  product list.
- **Recipes** (`src/food/recipes`) name ingredient roles. `store` ingredients must be found in
  products of ONE chain (`resolveRecipe(recipe, candidates, store)`); `bestVariant` takes the first
  chain in the ranking that covers the whole recipe; "one shop is the requirement" is an explicit
  rule. `staple` is in every shop, `pantry` at home. Store chips, the nearby page, the diary pool and
  `scripts/food/check-recipes.ts` all assume one chain per recipe.
- **Restaurants** (previous feature) set the pattern for third-party data: official sources only,
  one JSON per source in `src/food/<area>/data/`, a data test that checks the physics of the numbers,
  a lazily imported chunk.

## Decisions

### 1. Online shop data

| Topic | Decision | Why |
| --- | --- | --- |
| Collection | Research agents read each shop's public product data — platform feeds the shop exposes (Shopify `products.json`, WooCommerce Store API), JSON-LD, sitemaps, product pages — obeying `robots.txt`, one request per second, no login | The same standard as the restaurant data: the shop's own published numbers, gathered politely |
| What is copied | Facts only: name, brand, pack size, nutrition per 100 g, regular price, product URL, vegan flag when stated, EAN. **No descriptions, no images** | Nutrition values and prices are facts; marketing text and photos are the shops' copyrighted work (and images would need new CSP origins and third-party requests) |
| Scope | Food and drink only; supplements (vitamins, creatine, pre-workouts, capsules), accessories and bundles excluded; one entry per product line, more flavours only when nutrition differs by > 10 % | A food diary, not a supplement catalogue; 30 flavours of one whey would bury everything else |
| Storage | `src/food/online/data/<shop>.json`, one per shop, plus a static registry `src/food/online/shops.ts` (id, name, home page) | Small, reviewable, independent of the OFF pipeline (a rebuilt OFF dataset cannot drop them) |
| Loading | `loadDataset` imports `online/catalog` (its own chunk) together with the OFF gzip and merges before indexing | Every screen that knows products knows these too, with zero changes downstream |
| Merge | A shop product whose EAN matches an OFF product becomes an **offer on that product** (store key added, offer link, the shop's price when OFF has none). Otherwise a new `Product` with `code` = EAN, or `<shop>-<slug>` without one; categories mapped from the shop category to OFF tags (`bialko` → `en:protein-powders`, `makaron` → `en:pastas`, …) | One product, several places to buy it; OFF-based features (category filters, ready protein groups, ingredient matchers) work on the new products unchanged |
| Model | `Product.online?: OnlineOffer[]` (`{ shop, url, price, checked }`); the shop id is also a store key in `stores` and `dictionaries.stores` | Optional field: OFF products and the pipeline stay as they are |
| Data checks (test) | Registry and files agree; unique URLs; nutrition physics as for restaurants (4/4/9 energy within ±15 % or ±25 kcal under 170, sugars ≤ carbs, saturated ≤ fat, protein + carbs + fat ≤ 100 g); products the shop itself gets wrong are listed in the file's `inconsistent` and kept | Transcription slips show up as impossible numbers |

### 2. Showing the shop

| Where | What |
| --- | --- |
| Product card | „Sklep internetowy: GuiltFree” line |
| Product detail | Block „Kup w sklepie internetowym” — one link per offer (product page, opens in a new tab, `rel="noopener noreferrer"`), price and date checked |
| Produkty filters | Toggle **„W sklepach internetowych”** next to „Z ceną”; the shop names are in the existing „Sklep” facet |
| Recipe ingredient | The chosen product's line says „sklep internetowy · Myprotein” with a link to its page |
| Recipe card | Shop line names every shop of the basket, online ones marked and linked to the shop |
| Footer | Source line: „Sklepy internetowe: dane ze stron sklepów, sprawdzone …” |

### 3. Recipes with online products

New protein recipes built around what the shops actually sell (konjac pasta, zero sauces and syrups,
protein powders and bars, plant-based meat, keto bread and flours…), in the existing format and
held to THE RULE on typical values. New ingredient definitions match the shops' products by name and
bounds, like the existing ones. The exact list follows the data (spec appendix, filled in during
implementation).

### 4. The fewest shops — baskets

| Topic | Decision | Why |
| --- | --- | --- |
| Basket | One shop, or two shops where **at least one is online**. Never two physical shops | The request's own example; one trip to one shop stays the rule for physical shops, an online order is the natural complement |
| Minimality | A recipe's baskets are its **smallest** ones: if one shop covers it, pairs are not offered | "W minimalnej ilości sklepów" |
| Order | One physical shop (by the existing ranking), one online shop, physical + online, online + online | Fresh food from a shop nearby is easiest; delivery fills the gap |
| Resolution | `resolveRecipe` takes a basket (string or list): a `store` ingredient may come from any basket shop, the physical one first; staples come from the physical shop of the basket (typical values without one); each resolved item records which shop it is bought in | One resolver, one rule check, same swap sheet |
| Card | „Wszystko kupisz w: Biedronka” or „Kupisz w 2 sklepach: Biedronka + Diet-Food (sklep internetowy)”; chips switch between the recipe's baskets | Same interaction as today's shop chips |
| Grouping | Przepisy gets **„Układ: Czas · Sklepy”** (`?uklad=sklepy`). „Sklepy” groups recipes by basket, greedily: the basket that covers the most recipes first, then the next among the rest — the fewest groups for the whole list. Each group header names its shops with links | "Grupować przepisy tak, żeby można było w minimalnej ilości sklepów kupić" — one shopping plan covers a whole group |
| Store filter | `?sklep=X` keeps recipes with a minimal basket containing X | A chosen shop shows what it makes possible, alone or with one online order |
| Diary and nearby | Unchanged: suggestions and „W pobliżu” use single physical shops only | „Co teraz?” cannot wait for a delivery; a recipe that needs an order is planned on the Przepisy page |

## Error handling

- The online chunk fails to load → the dataset loads without online products (logged, not fatal);
  a retry of the dataset retries both.
- A shop link is always the shop's own https URL from the data (test).
- A recipe with no basket at all (an ingredient nobody sells) is not shown, as today.

## Testing

- Pure: merge (EAN match, new product, two shops one product, categories, dictionaries), data checks
  per shop file, baskets (single, physical + online, online + online, never two physical, minimal),
  resolver with baskets (pools, staples, item shop, rule), grouping (greedy cover, ties stable),
  filter toggle, new ingredient matchers, new recipes pass THE RULE on typical values.
- Components: product card and detail with offers, filter toggle, recipe card with a two-shop basket
  and links, grouped layout.
- Gates: typecheck, tests, lint (no new warnings), build; a look at 360 px.

## Out of scope

- Images and descriptions from the shops; live prices or stock; delivery costs.
- Online shops in „Co teraz?” and „W pobliżu”.
- Updating the shop data automatically (a manual re-run of the research is documented in README).
