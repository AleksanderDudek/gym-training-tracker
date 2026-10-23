# Restaurant chains research — batch `piekarnie-slodycze`

Bakeries, patisseries, chocolate cafés and ice-cream parlours. Checked 2026-10-23. Only the chains' own
sources count (website, PDF, product pages, app/API on the chain's domain); aggregators (FatSecret,
Wolt, Glovo, …) were ignored even where they show numbers.

OSM brand names: from the name-suggestion-index (`data/brands/shop/bakery.json`, `shop/pastry.json`,
`amenity/ice_cream.json`, `amenity/cafe.json`, …) where the chain is listed, plus `brand`/`name` values
and their counts from taginfo.openstreetmap.org (global).

Summary: 7 chains transcribed — Gorąco Polecam (119 items), Fit Cake (120), Putka (118), Lajkonik (114),
Lubaszka (59), Oskroba (21), Asprod (18); per-100 g computations for Oskroba, Lubaszka, Lajkonik and
Asprod. Allergens only: Cukiernia Sowa, Lukullus. Nutrition only in an app: Good Lood. Announced but not
yet published: Pan Precel. No public nutrition data: E.Wedel, Grycan, Lody Bosko, Blikle, Vincent (no
website found), Charlotte, Buczek, Chleboteka, Olsza, Kandulski, Manufaktura Mojej Mamy, Pellowski, UMAM,
Krasnolód, Lody z Cytadeli.

## Gorąco Polecam. Smaki z piekarni (Enata Bread)

- **Status: transcribed** — `goraco-polecam.json`, 119 items.
- Source: https://goraco-polecam.pl/wp-content/uploads/2026/06/informacja-produktowa-W-14-SZSZ-1.pdf
  („Tabela wartości odżywczych i alergenów”, linked in the footer of goraco-polecam.pl; table dated
  2026-05-20). Pages 1–4: per 100 g and per portion (kJ, kcal, fat, saturates, carbohydrates, sugars,
  protein, salt) plus portion weight; pages 5–46: ingredients and allergens. No fibre.
- Breads and baguettes are given as 70 g portions; other products as one piece (inferred from the
  weights). Left out: catering „mini” items, cups of spreads, some breads/rolls, to stay ≤ 120.
- Chain's own inconsistencies (kept as published, listed in `source.inconsistent`): Koszyk z jabłkami
  (288 kcal vs ≈ 240 kcal from macros, same per 100 g), Ice cappuccino (sugars 22.6 g > carbs 22.5 g).
- Note: goracopolecam.pl (no hyphen) does not resolve; goracopolecam.com is a placeholder; the official
  site is goraco-polecam.pl.
- OSM: NSI `shop=bakery` brand „Gorąco Polecam” (Q113228125); taginfo brand „Gorąco Polecam” ×96,
  name „Gorąco Polecam” ×113.

## Fit Cake

- **Status: transcribed** — `fit-cake.json`, 120 items.
- Source: category pages under https://fitcake.pl/oferta-fit-cake/ (ciasta, monoporcje,
  ciasta-i-przekaski-proteinowe, sniadania, desery-w-sloikach, lody, batony, napoje); each product shows
  „Porcja = N kcal B: … W: … T: …”. No portion weight, sugars or salt; saturates/fibre only on a few
  items. Each item carries the URL of its category page. ~420 entries on the site in total.
- Carbohydrates as published: for erythritol-sweetened sweets they are net of polyols/fibre (some items
  say „W (netto)”), bowls say „W (brutto)”.
- Left out: low-FODMAP variants and part of the cakes, keto-base monoportions (base and cream values
  mixed on the page), flavour grids of lattes, club sandwiches (per 150 g in another layout), seasonal
  dishes, cakes for two; items whose energy disagrees with the macros (Pani Walewska, Malinowy
  chruśniak, Donut a’la Snickers bez laktozy, several monoportions) were not selected.
- OSM: not in NSI; taginfo name „Fit Cake” ×32 (plus „Fit Cake <town>” variants), „FitCake” ×3; brand
  „Fit Cake” ×2, „FIT CAKE” ×1. Brands used: „Fit Cake”, „FitCake”.

## Oskroba

- **Status: transcribed** — `oskroba.json`, 21 items (rolls, doughnuts, sweet buns, puff pastries,
  muffins, one savoury pastry).
- Source: product pages under https://www.oskroba.pl/produkty (each item has its page URL). Pages give
  nutrition per 100 g (energy, fat/saturates, carbohydrates/sugars, protein, salt; no fibre) and the
  piece weight in the description („… (50 g)”); per-piece values computed (`computed: true`).
- Left out: breads, chałka, bułka wyborowa, strucle, babki, cookies in packs (weight of a whole loaf or
  pack, not a portion); items with no weight (Bułka śniadaniowa, Bułka orkiszowa z ziarnami, Mini
  snack ×2, Pączki na wagę).
- Chain's own inconsistency: Ciastko półfrancuskie z kapustą i grzybami (219 kcal/100 g vs ≈ 288 from
  macros), kept and listed.
- OSM: NSI `shop=bakery` brand „Oskroba” (Q109323856); taginfo brand „Oskroba” ×89, name „Oskroba” ×106,
  „Piekarnia Oskroba” ×10.

## Cukiernia Sowa

- **Status: allergens only** (no usable nutrition).
- Checked: https://www.cukierniasowa.pl/ footer → „Wykaz składników i alergenów”
  (https://www.cukierniasowa.pl/upload/other/informacja/Karta-ze-składnikami-Cukiernia-Sowa-23072026.pdf,
  148 pages, 23.07.2026): ingredients and allergens for all products; a nutrition declaration per 100 g
  appears for only 7 products (Chleb mocy 400 g, one high-protein sandwich, five no-added-sugar cakes),
  without portion weights for the cakes — fewer than 10 usable items, so nothing transcribed.
- OSM: NSI `shop=pastry` brand „Cukiernia Sowa” (Q113232449); taginfo brand „Cukiernia Sowa” ×100,
  name „Cukiernia Sowa” ×129.

## Putka (Piekarnie Cukiernie Putka)

- **Status: transcribed** — `putka.json`, 118 items (breakfast menu, sandwiches/bagels, salads, cold
  soups, pizzas, zapiekanki, savoury snacks, yoghurts/porridges, sweet buns).
- Source: product pages https://www.putka.pl/produkt/… listed under https://www.putka.pl/produkty/
  (each item has its page URL). Every page has a nutrition table per 100 g and per portion (energy,
  fat/saturates, carbohydrates/sugars, fibre, protein, salt) plus %RI. Per-portion column used; the
  portion is usually the whole product.
- Chain's own errors (items left out, not transcribed): Pizza Góralska 530 g (kJ/kcal swapped, „6387
  kcal”), Pizza Salami Picante (118 kcal vs ≈ 487 from macros), Sałatka Śledziowa z Buraczkami (1594 vs
  ≈ 380), Sałatka z Kurczakiem 330 g (677 vs ≈ 460), Grzebień z Jabłkiem (344 vs ≈ 440); duplicate
  pages with different numbers (Bajgiel z Humusem, Razowy z Pastą Jajeczną) skipped.
- Not transcribed for the size limit: cakes and dessert pastries (~110 pages), breads/rolls, juices,
  some sandwiches/snacks/second pizza sizes. ~365 product pages exist.
- OSM: NSI `shop=bakery` brand „Putka” (Q113093586); taginfo brand „Putka” ×259, name „Putka” ×272,
  „Piekarnia Putka” ×4.

## Lubaszka (Galerie Wypieków Lubaszka)

- **Status: transcribed** — `lubaszka.json`, 59 items (sandwiches, focaccias, savoury pastries, 2 salads,
  pizza pieces, single cakes and sweet buns, rolls).
- Source: product pages https://lubaszka.pl/produkt/… (list from https://lubaszka.pl/nasze-produkty/,
  138 products via the site's WP REST API `wp-json/wp/v2/product`). Each page: „MASA NETTO” and
  „Wartość odżywcza w 100 g produktu” (energy, fat/saturates, carbohydrates/sugars, fibre, protein,
  salt). Per-piece values computed (`computed: true`); each item has its page URL.
- Left out: breads, baguette/bułka paryska (300–330 g), chałka, whole cakes, babki, strucle, packs of
  cookies and preserves (whole-product weight), breakfast dishes and coffees (no weight/no values),
  incomplete tables (Kanapka z hummusem, Kanapka farmerska, Bułka z czosnkiem: no energy).
- OSM: NSI `shop=bakery` brand „Galeria Wypieków Lubaszka” (Q108586693); taginfo brand „Galeria Wypieków
  Lubaszka” ×84, name same ×80, name „Lubaszka” ×7.

## Lajkonik Piekarnia i Kawiarnia (Lajkonik PiK)

- **Status: transcribed** — `lajkonik.json`, 114 items (rolls, cakes/desserts, sweet pastries,
  sandwiches, snacks, salads, tortillas, drinks).
- Source: https://lajkonik-pik.pl/wp-content/uploads/2026/10/TABELA-WARTOSCI-ODZYWCZYCH_ALERGENY_WWW_pazdziernik.2026.xlsx-Arkusz1.pdf
  (linked from https://lajkonik-pik.pl/menu/ as „tabela wartości odżywczych”, October 2026): product
  weight plus per 100 g energy, fat/saturates, carbohydrates/sugars, protein, salt, and allergens. No
  fibre. Per-piece/per-portion values computed (`computed: true`).
- Left out: breads and baguette (whole loaves), Ciasto makowe 700 g, lactose-free/oat/soy variants of
  drinks; Bułka prosto z pieca (294 kcal/100 g vs ≈ 241 from macros — chain's inconsistency).
- OSM: not in NSI; no `brand` tag; taginfo name „Lajkonik” ×29 (the name is also used by unrelated
  places, e.g. „Lajkonik Polski Sklep”, a hotel). Brand used: „Lajkonik”.

## Asprod

- **Status: transcribed** — `asprod.json`, 18 items (5 salads, 4 pancake dishes, 9 chocolate bars).
- Source: https://asprod.com.pl/wp-content/uploads/2026/08/Skladniki-i-alergeny-2026.pdf („Składniki i
  alergeny”, 20.08.2026, linked in the asprod.com.pl footer, section „Informacje”). Ingredients and
  allergens for everything; a per-100 g nutrition declaration only for salads, pancakes, pierogi and
  chocolates; weight next to the name. Per-portion values computed (`computed: true`).
- Bread and cakes: ingredients/allergens only. Left out: pierogi (no portion weight), lollipops (no
  values), „Zestaw pralin” (PDF layout leaves it unclear which product the table belongs to).
- OSM: NSI `shop=bakery` brand „Asprod” (Q111784377); taginfo brand „Asprod” ×23, name „Asprod” ×34,
  „Asprod Piekarnia-Cukiernia” ×3.

## Pijalnia Czekolady E.Wedel

- **Status: no public nutrition data.**
- Checked: https://wedelpijalnie.pl/karta-menu (full menu: chocolate drinks, desserts, breakfasts, sets,
  coffees — names, descriptions, prices, no kcal), https://wedelpijalnie.pl/nasze-produkty (no values).
  Packaged E.Wedel retail chocolates are a different product line and were not used.
- OSM: not in NSI; taginfo name „Pijalnia Czekolady E. Wedel” ×11, „Pijalnia czekolady E. Wedel” ×5,
  „Pijalnia Czekolady E.Wedel” ×4 (also brand ×1), „Pijalnia Czekolady Wedel” ×2, „E. Wedel” ×6,
  „E.Wedel” ×2. Suggested brands: „Pijalnia Czekolady E. Wedel”, „Pijalnia Czekolady E.Wedel”,
  „Pijalnia Czekolady Wedel”, „E. Wedel”, „E.Wedel”.

## Grycan

- **Status: no public nutrition data** (for the parlours).
- Checked: menu PDF https://grycan.pl/wp-content/uploads/2026/10/Menu-21-10-2026.pdf (26 pages, linked on
  grycan.pl, no energy values), https://grycan.pl/oferta/lody/w-kulkach/, /oferta/lody/w-pudelkach/,
  /oferta/lodziarnie/desery-lodowe/ (no values).
- OSM: NSI `amenity=ice_cream` brand „Grycan” (Q97372889); taginfo brand „Grycan” ×91, name ×108.

## Good Lood

- **Status: no public nutrition data on the web** — the site (https://www.goodlood.com/) says ingredients,
  nutrition and allergens are shown only in the Good Lood mobile app; nothing on the website or in its
  files (only legal PDFs at files.goodlood.com). The app could not be inspected here.
- OSM: NSI `amenity=ice_cream` brand „Good Lood” (Q122978001); taginfo brand „Good Lood” ×21, name ×35.

## Lody Bosko

- **Status: no public nutrition data.** Checked https://www.lodybosko.pl/ and /menu (flavours and prices
  only).
- OSM: not in NSI; taginfo name „Lody Bosko” ×2 (no brand tag). Suggested brand: „Lody Bosko”.

## A. Blikle

- **Status: no public nutrition data.** Checked https://blikle.pl/ and a product page
  (https://blikle.pl/produkty/rogal-z-bialym-makiem/): description only, no nutrition/allergen table.
- OSM: NSI `shop=pastry` brand „Blikle” (Q9174325); taginfo brand „Blikle” ×8, name „Blikle” ×6,
  „A. Blikle” ×4, „A.Blikle” ×2.

## Vincent Boulangerie Patisserie

- **Status: no public nutrition data / no official website found.** vincent-boulangerie.pl does not
  resolve (DNS); vincent.pl is an unrelated packaging company; searches found only press items and city
  guides (Nowy Świat 64, Chmielna 21, Jana Pawła II 82, Sadyba Best Mall).
- OSM: NSI `shop=bakery` brand „Vincent” (Q113308366); taginfo brand „Vincent” ×15 (the word is also used
  by unrelated brands abroad; NSI limits it to PL).

## Charlotte (chleb i wino)

- **Status: no public nutrition data.** Checked https://bistrocharlotte.com/pl/ and a venue menu
  (https://bistrocharlotte.com/pl/lokale/charlotte-plac-zbawiciela-warszawa): dishes, ingredients and
  prices, no kcal or allergen table.
- OSM: not in NSI; taginfo name „Charlotte Menora” ×2, plain „Charlotte” is ambiguous (×164 worldwide,
  mostly streets). Suggested brands: „Charlotte Chleb i Wino”, „Charlotte Menora” (low confidence).

## Piekarnia i Cukiernia Buczek

- **Status: no public nutrition data.** Checked https://piekarniabuczek.pl/ (shop), a product page
  (https://piekarniabuczek.pl/product/bagietka-pszenna/) and the WooCommerce product feed (100 products,
  no „kcal” anywhere).
- OSM: not in NSI; taginfo name „Piekarnia Buczek” ×2 („Buczek” alone ×80 is mostly place names).
  Suggested brand: „Piekarnia Buczek”.

## Chleboteka

- **Status: no public nutrition data.** Checked https://chleboteka.pl/ and
  https://chleboteka.pl/nasze-produkty/ (descriptions only).
- OSM: not in NSI; taginfo name „Chleboteka” ×10. Suggested brand: „Chleboteka”.

## Pan Precel

- **Status: no public nutrition data yet.** https://panprecel.pl/ has a button „Tabele alergenów i
  wartości odżywczych” whose script shows „Tabele w PDF pojawią się tu niebawem” — no PDF published as of
  2026-10-23.
- OSM: not in NSI; taginfo name „Pan Precel” ×9, brand „Pan Precel” ×1.

## Cukiernia Olsza

- **Status: no public nutrition data.** Checked https://cukierniaolsza.pl/ and its catalogue PDFs
  (cukiernia-olsza-katalog-jesien-zima-2024-25.pdf, cukiernia-olsza-katalog-torty-2022.pdf): no energy
  values.
- OSM: NSI `shop=pastry` brand „Cukiernia Olsza” (Q136687456); taginfo brand ×4, name ×9.

## Lukullus

- **Status: allergens only.** https://cukiernialukullus.pl/produkty/… product pages (e.g.
  /produkty/ciastka/dziad-drozdzowy/) list allergens, no nutrition.
- OSM: NSI `shop=pastry` brand „Lukullus” (Q113232484); taginfo brand „Lukullus” ×4, name ×21 (some are
  German „Polnische Spezialitäten Lukullus” shops).

## Cukiernia Kandulski

- **Status: no public nutrition data.** Checked https://kandulski.pl/ and a product page
  (https://kandulski.pl/produkt/rogal-swietomarcinski/).
- OSM: not in NSI; taginfo name „Kandulski” ×4, „Cukiernia Kandulski” ×3. Suggested brands: „Cukiernia
  Kandulski”, „Kandulski”.

## Manufaktura Mojej Mamy

- **Status: no public nutrition data.** Checked https://manufakturamojejmamy.pl/ (no product/nutrition
  pages).
- OSM: not in NSI; taginfo name „Manufaktura Mojej Mamy” ×4, „Piekarnia-Cukiernia Manufaktura Mojej Mamy”
  ×1.

## Pellowski

- **Status: no public nutrition data.** Checked https://pellowski.net/, category
  /kategoria-produktu/wyroby-cukiernicze/, a product page (/produkt/marcjanek/) and the WooCommerce
  product feed (no „kcal”).
- OSM: not in NSI; taginfo name „Pellowski” ×28, „Piekarnia Pellowski” ×1, „Pellowski Express” ×1.
  Suggested brands: „Pellowski”, „Piekarnia Pellowski”.

## UMAM (Cukiernia Gdańska)

- **Status: no usable nutrition data.** The online shop (WooCommerce feed, first 100 products) has
  per-100 g tables for only 3 packaged items (two jam sets, a chocolate-bar set); the café menu has no
  values.
- OSM: not in NSI; no matching `name`/`brand` found on taginfo („UMAM” collides with „Umami”). Suggested
  brand: „UMAM” (low confidence).

## Krasnolód

- **Status: no public nutrition data.** https://krasnolod.pl/ and /lody.php (flavour list only).
- OSM: not in NSI; taginfo name „Krasnolód” ×8, brand ×1.

## Lody z Cytadeli (Lody Naturalne z Cytadeli)

- **Status: no public nutrition data.** https://lodyzcytadeli.pl/ (flavours, locations).
- OSM: not in NSI; taginfo name „Lody Naturalne z Cytadeli” ×2, „LODY Naturalne z Cytadeli” ×2, „Lody
  naturalne z Cytadeli” ×1 (variants „przy Cytadeli” too). Suggested brand: „Lody Naturalne z Cytadeli”.
