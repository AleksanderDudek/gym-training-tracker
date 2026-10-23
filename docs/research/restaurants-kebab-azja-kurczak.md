# Restaurant chains research — batch `kebab-azja-kurczak`

Checked 2026-10-23. Only the chains' own sites, PDFs and ordering front-ends were used
(no aggregators). "OSM brands" are the values the app should match against the `brand`
(or `name`) tag of OpenStreetMap venues; sources: name-suggestion-index
(`data/brands/amenity/fast_food.json`, `restaurant.json`) and taginfo for Poland
(taginfo.geofabrik.de, europe:poland), counts in brackets.

Summary: 1 of 19 chains publishes full macros — **Berlin Döner Kebap** (transcribed).
Three publish kcal only (Zahir Kebab, Am Am Kebab, Mango Mama); Thai Wok publishes full values
for 5 snacks per 100 g without portion weights (not usable); the rest publish allergens or nothing.

## Berlin Döner Kebap — transcribed

- File: `src/food/restaurants/data/berlin-doner-kebap.json`, 122 items, market PL.
- Official site is https://www.berlindonerkebap.com (the listed `berlindoner.pl` is a parked
  Hostinger domain).
- Source: https://www.berlindonerkebap.com/uploads/menu/pdfy/tabela_kaloryczna_072026.pdf
  ("tabela kaloryczności dań", 07.2026, linked as "SPRAWDŹ KALORYCZNOŚĆ" from every menu page;
  7 pages, a Google Sheets export with real text). Per 100 g and per portion: energy, fat,
  saturates, carbohydrates, sugars, fibre, protein, salt, plus the average portion weight.
  Per-portion columns transcribed; per-100 g × weight agrees with them for every row.
- Kebabs marked "bez sosu" come with separate sauce rows (80 g for rollo/bun, 60 g for box and
  Berlin Gemüse, 90 g for plates); the file keeps the dishes without sauce plus the 40 g sauce
  portions from the sauce list, and says so in `source.note`.
- Left out to stay near 120 items: repeated "plus sos" rows, some variants (Cezar/Farmer in bun
  and box, Bacon Cheese Grilled, Fryt Lolek, Sztosik bez frytek, falafel/halloumi specials in bun
  and box), nachos, extra fries types, toppings, minor sauces. Table typos fixed in names
  ("KEBAR W BUŁCE", "SOS LAGODNY", "SOS TZATZYKI").
- Chain's own inconsistency: "Kebap kurczak" (150 g meat portion) has sugars 0.3 g > carbs 0.1 g —
  kept, listed in `source.inconsistent`. Other oddities in rows not transcribed: hot sauce 90 g
  sugars 32.1 > carbs 32.0; the 60 g sauce rows under Berlin Gemüse carry the 80 g portion values.
- Allergens: https://www.berlindonerkebap.com/uploads/menu/pdfy/alergeny_bdk_marzec_2024.pdf.
- Some items on the website menu (Rollo MEGA, Rollo Deluxe, Rollo Hot Chili) are not in the table.
- OSM brands: `Berlin Döner Kebap` (NSI Q126195313; brand 40, name 49), names also
  `Berlin Doner Kebap` (8), `Berlin Doner Kebab` (2), `Berlin Döner Kebab` (1). Used:
  `["Berlin Döner Kebap", "Berlin Döner Kebab"]` (matching folds diacritics). Bare "Berlin Doner" /
  "Berlin Döner" deliberately not used (also "Berlin Doner & Grill", "Berlin Döner De-Tat").

## Bafra Kebab — allergens only

- https://bafrakebab.pl/menu/ links https://bafrakebab.pl/wp-content/uploads/tabela_alergenow_bafra_kebab.pdf
  (image PDF: allergens and portion weights, e.g. Rollo Standard 427 g) and a price list
  (cennik-pionowy-.pdf); no energy or macros anywhere on the site.
- OSM brands: `Bafra Kebab` (NSI Q130582122; brand 55 + "Bafra kebab" 2; name 100), name `Bafra` (30).

## Zahir Kebab — kcal only

- https://zahirkebab.pl/tabela-wartosci-ozdywczych/ — columns DANIE / ROZMIAR / MIĘSO / SOS / KCAL
  only. Menu pages (https://zahirkebab.pl/menu/, /menu-fit/) show "Tabela wartości odżywczych: KCAL"
  and allergens, no macros.
- OSM brands: `Zahir Kebab` (NSI Q116148750; brand 60, name 91), name `Zahir` (3).

## Kebab King — no public nutrition data found

- https://kebabking.pl/ (and www.) answers every request, also from a headless browser, with a
  reCAPTCHA "Bot Verification" page; no nutrition or allergen document of the chain is indexed by
  search. Status can be re-checked by hand in a normal browser.
- OSM brands: `Kebab King` (NSI Q113093758; brand 47, name 50). Variants "Kebab King Star",
  "Kebab King Royal", "Kebab King Bar" exist (may be independents); "Kebab Kingdom" is a different
  name and does not match.

## Am Am Kebab — kcal only

- Own site https://amamkebab.pl/ (Dolci Sapori Sp. z o.o., trailers/franchise): the menu on the home
  page gives portion weight and kcal per item (e.g. Pita NORMAL 315 g 485 kcal, Grosik Box 455 g
  805 kcal), no protein/carbs/fat; no PDF. The orlygastronomii.pl listing was not needed.
- OSM brands (not in NSI): name `Am Am Kebab` (18), `AM AM Kebab` (4), `AmAm Kebab` (2),
  `Am Am` (2); brand `Am Am Kebab` (1).

## Sevi Kebab — allergens only

- https://sevikebab.pl/alergeny/ (allergen table), https://sevikebab.pl/menu/ (no nutrition).
- OSM brands (not in NSI): name `Sevi Kebab` (9).

## Amrit Kebab — local chain, no website

- No official site found: amrit.pl is a parked domain; amritkebab.pl, amrit-kebab.pl, amrit.com.pl,
  amritoriental.pl do not resolve. Press mentions "Amrit Oriental Food" (first Amrit Kebab 2007);
  no nutrition data.
- OSM brands (not in NSI, nothing tagged in Poland except an unrelated-looking "Amrit Joy"):
  suggest `Amrit Kebab`, `Amrit`.

## Kura Warzyw — allergens only

- https://kurawarzyw.pl/wp-content/uploads/2026/10/KW_alergeny_tabliczka_compressed.pdf —
  allergen grid only (vegan kebab). No nutrition page.
- OSM brands (not in NSI): `Kura Warzyw` (brand 1, name 5).

## Koku Sushi — allergens only

- https://kokusushi.pl/menu/ (menu as images); allergen menus via https://linktr.ee/kokusushi_alergeny
  (Google Drive PDFs/JPGs, "Obowiązuje od 19.08.2025r.") — allergens only.
- OSM brands (not in NSI): name `Koku Sushi` (28), `KOKU Sushi` (12), `Koku Sushi Point` (2).

## Sushi Kushi — allergens only

- https://cs.cdn-upm.com/themes/51bce6db-ec9c-11e3-ac27-00163edcb8a0/assets-1018/alergeny.pdf
  (20-page allergen grid, linked from https://www.sushikushi.com/). The UpMenu ordering site shows
  no nutrition.
- OSM brands (not in NSI): name `Sushi Kushi` (11), also "Sushi Kushi & Ramen Shop …".

## Sushi World — allergens only

- https://sushiworld.pl/alergeny/ (allergen list per dish). City ordering sites (ChoiceQR, e.g.
  https://krakow.sushiworld.pl/) carry a `kcal` field that is 0 for all 128 products.
- OSM brands (not in NSI): name `Sushi World` (6).

## Ninja Sushi — no public nutrition data

- https://ninjasushi.pl/ product data has `calories`/`proteins`/`fats`/`carbohydrates` fields, but
  they are 0 for all 252 products (same on the Ukrainian ninjasushi.com.ua, 181 products). Only
  weights and ingredients are published.
- OSM brands (not in NSI): name `Ninja Sushi` (1).

## Hana Sushi — no public nutrition data

- Menu pages https://hanasushi.pl/menu-hana-sushi-warszawa/, …-katowice/, …-lodz/ — names, prices,
  descriptions; no nutrition, no allergen table.
- OSM brands (not in NSI): name `Hana Sushi` (5; generic name, may include unrelated venues).

## Thai Wok — kcal and macros for 5 snacks per 100 g only; not usable

- https://thaiwok.pl/tabela-wartosci-odzywczych/ says "Tabela wartości odżywczych w trakcie
  aktualizacji" and lists only 5 snacks per 100 g (2 sajgonki, gyoza, 2 baozi); the menu
  (https://thaiwok.pl/menu/) gives no portion weights, so there are no per-portion values and
  fewer than 10 items. Allergens: https://thaiwok.pl/wp-content/uploads/2024/09/alergeny-2024.pdf.
- OSM brands (not in NSI): name `Thai Wok` (15), `WOKy by Thai Wok` (1).

## Thai Thai — no public nutrition data

- https://www.thaithai.pl/ (React SPA); the menu data in the site bundle has name, description and
  price only.
- OSM brands (not in NSI): name `Thai Thai` (4).

## Kurcze Pieczone — no public nutrition data

- https://kurczepieczone.pl/menu — descriptions and prices only; no nutrition or allergen document.
- OSM brands (not in NSI): name `Kurcze Pieczone` (24), `Kurcze pieczone` (4), `KurczePieczone` (1)
  (generic phrase, may include independents).

## Solleim — allergens only

- https://www.solleim.com/menu (Next.js, menu descriptions only); ordering on UpMenu
  (https://www.solleimtogo.com/menu-1/…) with an allergen table page
  https://www.solleimtogo.com/tabela-alergenow; no nutrition values in the menu data.
- OSM brands (not in NSI): name `Solleim` (5), `Solleim Express` (1).

## Mango Mama — kcal only

- https://cs.cdn-upm.com/themes/fcb15122-bd38-11e6-b913-525400841de1/assets-105/qr_menueng_kalorie_alergeny_2.pdf
  (linked from https://www.mangomama.pl/): "Kaloryczność dań" table (kcal per dish only) and
  allergen recipes.
- OSM brands (not in NSI): name `Mango Mama` (6).

## Thali — no public nutrition data

- https://thali.pl/ and venue menus (ChoiceQR, e.g. https://ruska.thali.pl/menu): the `kcal` field is
  0 for all 43 products; weights mostly empty.
- OSM brands (not in NSI): name `Thali` (5), `Thali Express` (2), `Thali Wrocław` (1) (generic word,
  "Thali" may match unrelated Indian restaurants).
