# Selgros products — design

Date: 2026-10-16 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request

„Dodaj też produkty z sieci Selgros, makro itp. w taki sam sposób.” — Selgros's products with
their nutrition, prices and so on, added the same way as the online shops' products.

## What exists

- **Product base:** Open Food Facts (~29k products sold in Poland) plus Open Prices. Chains come from OFF store tags and from private labels. `storeKey` already knows `selgros` (and `makro`), but only ~10 OFF products carry the tag.
- **Online shops:** each one is a JSON file in `src/food/online/data`, read from the shop's own product pages. The files are merged into the base at load time by EAN, in a separate chunk (`shopData`) that the service worker keeps on first use. Every product gets an *online offer*: "kup w sklepie internetowym", the link and `shopOnly`.
- **Selgros:**
  - Selgros24.pl, its online shop, is closed.
  - selgros.pl has a product finder (`/znajdz-produkt`, ~17k food items in 11 departments).
  - Its grid is filled by a search the page runs through selgros.pl itself. Each record carries the title, brand, category path, **the EAN of the base unit**, **nutrition per 100 g**, the 14 allergens, the regular and promo prices, and stock per hall.
  - Product pages work at `/znajdz-produkt/product/<article number>`.
  - `robots.txt` forbids `/search` only.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Model | **A chain you walk into, with its own data**: a new data contract `src/food/chains` (`ChainData`), merged at load time like the shops, but without an online offer. The product gets `stores: ['selgros']`, the chain's shelf price and a link to its page there (`pages`) | Selgros is not delivered. Its products must behave like Biedronka's (filters, recipes in one store, „W pobliżu”), not like an order |
| Source | The finder's own data, read by Playwright the way a visitor's browser reads it (department pages one after another, a 1.5 s pause, every page saved so a run resumes). The site's search key is **not** extracted to call the search directly | Same facts the page shows; no use of a private key outside the page; gentle on the site |
| Fields | EAN, article number, name (capitals turned into a sentence, the brand keeps its spelling), brand, net pack size from the title (the page's „Waga” is gross), OFF category tags worked out from the chain's category path and the name (only tags the base's dictionary knows), allergens as OFF tags, nutrition per 100 g, regular gross price (`perKg` for goods sold by weight). No descriptions, no photos | Facts only, like the shops. Photos are on a third-party image host and stay out (CSP, hotlinking) |
| Kept | Only products with a checksum-valid EAN and a complete label (kcal, protein, carbs, fat) that is plausible (≤100 g in 100 g, ≤900 kcal, sugars ≤ carbs, saturated ≤ fat). A label whose energy does not add up is kept and listed in `inconsistent` (marked, never used in recipes) | Same rules as the shops and menus; the data test re-checks them |
| Merge | By EAN. A known product gains the store, the page link, the price when it had none, the chain's label when its own was incomplete, and its allergens when it had none. A new product gets everything | No duplicates; OFF stays the first source |
| Departments | Food only: dairy, meat and fish, dry goods, sweets and snacks, preserves, ready meals and frozen, fruit and vegetables, bread, drinks, coffee and tea, vegetarian. No alcohol, no non-food, no „Dla dzieci” (mostly toys, a few hundred baby foods) | What this app is about |
| Hall | Prices and stock of one hall (the finder's default) are read; the price says „Selgros, <hala>” and its date | Honest about where a price comes from |
| Ranking | Cash & carry halls (Selgros, Makro) go **after** the supermarkets in the default store ranking of recipes. Chosen on purpose (filter, „W pobliżu”, profile) they work like any store | A hall covers a lot, but nobody's default shop is one (customer card, catering packs) |
| W pobliżu | The Overpass query adds `shop=wholesale` with brand Selgros or Makro | OpenStreetMap tags halls as wholesale; without this they never show up |
| Size | One product per line in the file. The page address is built from a template (`productUrl` + article number), so it is not stored per product. The file joins the existing `shopData` chunk (no new precache entry, same service-worker route) | ~12k products must not double the download |
| Refresh | `npm run food:selgros` (crawl what is missing, then write `src/food/chains/data/selgros.json`; `--fresh` starts over, `--limit=N` is a trial) | Repeatable, like `food:data` |
| Makro | Recognised as a cash & carry chain (ranking, „W pobliżu”), **no product data**: makro.pl answers 403 to any automated visit (a script and a headless browser alike, `robots.txt` included), checked 2026-10-16 | The request named "selgros, makro itp."; a site that shuts automated visitors out is not worked around |

## Testing

- The finder record reader: nutrition, kJ fallback, bounds, EAN check digit, allergens, categories, names and brands, pack size.
- The merge: a new product, a known EAN, an incomplete label, a price per kg, a marked label, chain plus online shop together, the page address.
- The data file: registry against the files, store key, valid and unique EANs and ids, tags, allergens, plausible numbers, energy that adds up.
- The views: the product detail (the chain's page link, the price from the hall, barcode, no OFF link for a new product), the online filter (a chain is not online), the data footer.
- The recipe ranking (halls after supermarkets) and the Overpass query.

## Out of scope

Promotions and per-hall prices, photos, Makro's products (its site refuses automated visits), other wholesalers.
