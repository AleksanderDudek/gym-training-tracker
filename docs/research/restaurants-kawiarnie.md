# Restaurant chains research — batch `kawiarnie`

Checked 2026-10-23. Rule: only the chain's own sources (site, PDF, app/site API). Aggregators
(fatsecret, fitatu, kalorie.pl, delivery apps) were ignored even where they had numbers.
Starbucks, Costa Coffee and Green Caffè Nero were already in the repo and were not redone.

## So!Coffee

- Status: **transcribed** — `so-coffee`, 119 items (17 listed in `source.inconsistent`: the chain's own per-100 values do not add up — mostly milk drinks with energy 17–39 % below the macros, two drinks with sugars > carbohydrates, four pastrami/strips/pulled-pork sandwiches with energy 30–45 % above).
- Source: https://socoffee.pl/wp-content/uploads/2026/09/wartosci-odzywcze.pdf
  („Wartości odżywcze”, linked in the site menu; „Data aktualizacji 16.09.2026”, 6 pages).
- The table gives values **per 100 ml/g** plus the portion (ml or g), so every item is computed
  per portion (`computed: true`). One size per drink (hot 330 ml, cold 400 ml). Autumn 2026 offer
  included; summer 2026 offer, teas, juices, per-100 add-ons and airport-only food (Kraków Balice,
  Rzeszów) left out. In drinks the table writes 0,5 g/100 ml for trace fat/protein/salt, so computed
  salt in coffees (~1.5–2 g) is inflated — kept as published and explained in the note.
- Allergen/ingredient list (not used): https://socoffee.pl/wp-content/uploads/2026/09/informacje-o-skladnikach-produktu-i-alergenach.pdf

## Etno Cafe

- Status: **no public nutrition data**.
- Checked: https://etnocafe.pl/ , /kawiarnie/ (12 cafés: Wrocław ×10, Warszawa, Łódź), café pages,
  /regulaminy/, /kawa/; the menu PDFs on cdn.sanity.io linked from the café pages
  (e.g. https://cdn.sanity.io/files/68nx9iqu/production/08c4b2ca18e6b121bc9884ecc596a3d0aeebf84e.pdf,
  2023, and 2025 image menus) — prices only, no kcal, no allergens.

## Columbus Coffee

- Status: **no public nutrition data / web presence gone**.
- columbuscoffee.pl does not resolve (NXDOMAIN on 2026-10-23); no other official site found.
  Latest press found (money.pl, c. 2018) described ~21 cafés, 10 in Szczecin.

## Cofix

- Status: **no public nutrition data**.
- cofix.pl redirects to https://cofix.global/pl-pl/main/warsaw/ (empty page); the Polish menu page
  https://cofix.global/pl-pl/menu/ is an iframe of https://warsaw.cofix.global , which returned a
  server error page on 2026-10-23. Press (wiadomoscihandlowe.pl, 04.2025): 6 cafés in Poland after
  the master franchisee's bankruptcy.

## The White Bear Coffee

- Status: **no public nutrition data**.
- Official site is https://thewhitebearcoffee.pl/ (not whitebearcoffee.pl). /menu/ and /menu-2/
  show only a price card (SVG, winter 2023/24). Locations page lists ~20+ cafés (Białystok ×5, Ełk,
  Giżycko, Kalisz, Kraków, Legnica, Łódź, Łomża, Lublin, Nysa, Olsztyn, Siedlce, Suwałki,
  Szczecinek, Warszawa).

## Tchibo (cafés in Tchibo shops)

- Status: **transcribed** — `tchibo`, 94 items (drinks with milk 3.2 %, cakes, sandwiches, syrups/whipped cream; `Hibiscus Tonic` listed as inconsistent: 151 kcal vs ~79 kcal from its carbohydrates).
- Source: https://www.tchibo.pl/documents/alergeny-tchibo.pdf („Tabela alergenów i wartości
  odżywczych”, v.13_23.09.2024), linked as „Tabela alergenów i wartości odżywczych” on
  https://www.tchibo.pl/c/sklepy-kawiarnia . Per-portion columns used. Newest table the chain links
  (2024).

## Lviv Croissants

- Status: **no public nutrition data**.
- Checked https://lvivcroissants.com/pl/ menu category pages (słodkie/wytrawne croissanty, napoje)
  — ingredients only; the two Google Docs linked from the site are the loyalty-programme and GDPR
  rules.

## Pożegnanie z Afryką

- Status: **no public nutrition data**.
- https://pozegnanie.com/ (shop) and the café page https://pozegnanie.com/swtomasza (Kraków,
  św. Tomasza 21; menu link is only an image). No nutrition or allergen tables.

## Coffeedesk (cafés)

- Status: **no public nutrition data**.
- https://kawiarnia.coffeedesk.pl/ — 6 Warsaw cafés; each /menu/ page is an image/PDF price list
  (e.g. https://kawiarnia.coffeedesk.pl/wp-content/uploads/2026/03/Coffeedesk-Menu-Palma-B2.pdf).

## Crazy Bubble

- Status: **allergens only**.
- https://crazybubble.pl/bubbleteapl/bubbletea-alergeny.pdf (8 pages, 10.09.2026): allergens per
  base/syrup/topping, no energy or macros. Product and app pages have no nutrition.

## BubbleJoy

- Status: **transcribed** — `bubblejoy`, 44 items (20 fruit teas, 12 milk teas without the milk base, 12 toppings); all consistent.
- Source: https://bubblejoy.pl/spis-kalorycznosci.pdf („Spis kaloryczności bubbletea”, PDF created
  21.03.2024, linked on https://bubblejoy.pl/ as „Wartości odżywcze, alergeny i kaloryczność”).
  Per 100 ml and per portion (drinks 500 ml = „Mała 0,5 l”, toppings 40 g); per-portion columns used.
- Milk drinks („Napoje mleczne”): the table covers only tea + flavour; the milk/soy base is added
  in varying amounts and is published separately per 100 ml only, so those items are labelled
  „bez napoju do wyboru” in the portion. No tapioca pearls in the table.

## Boboq

- Status: **no public nutrition data** for served drinks.
- boboq.pl redirects to https://bubbletea-sklep.pl/ (BOBOQ POLAND sp. z o.o., online shop with
  ingredients for home/gastronomy). Only a blog post with rough claims („bubble tea light ok. 50 kcal”,
  „40 g kawioru to 40 kcal”) —
  https://bubbletea-sklep.pl/pl/blog/Polskie-Bubble-tea-ma-malo-kalorii-/8 — no table per drink.

## BuBu Bubble Tea

- Status: **no public nutrition data**.
- https://bubutea.pl/ — menu as images (flavour lists), franchise site https://franczyza.bubutea.pl/ ;
  no nutrition or allergen tables. The mobile app (App Store / Google Play) was not inspected.

## Match Matcha

- Status: **no public nutrition data / official site down**.
- matchmatcha.pl answered HTTP 500 (and a TLS hostname mismatch on www) on 2026-10-23. The chain is
  listed in Westfield Mokotów, Westfield Arkadia and Galeria Wileńska (Warsaw); no nutrition source
  found.

## Urban Coffee

- Status: **no public nutrition data** (local chain, 3 cafés in Kraków).
- https://urbancoffee.pl/ links menus hosted on GlobalTips (https://globaltips.io/t/082784?menu etc.);
  the menu API returns names and prices only.

## Kaferdam

- Status: **local café, no nutrition data** — https://kaferdam.com/ is a one-page newsletter site for a
  single café in Poznań (Grobla); not a chain.

## Petit Paris (Poznań)

- Status: **no public nutrition data** (local chain, 5 bistro-bakeries in Poznań: Stary Browar,
  Sołacz, Park Wilsona, Posnania, Baranowo).
- Official site https://petitparis.com.pl/ ; menus are JPG price lists (e.g. /menu-petit-paris-stary-browar/).
  Not to be confused with the Sopot restaurant at petitparis.pl.

## Dinette

- Status: **no public nutrition data** (Wrocław restaurant + Di Bakery, Michelin Guide).
- https://dinette.pl/ — breakfast/lunch/bar/bakery menus as PDFs with prices only
  (e.g. https://dinette.pl/wp-content/uploads/2021/09/2026.07_D24_menu.pdf).

## OSM brand names

From the name-suggestion-index (NSI, `data/brands/...`) and Geofabrik's Poland taginfo
(`name`/`brand` values, counts in brackets, 2026-10-23). Matching in the app folds case,
diacritics and punctuation, so „So!Coffee” = „So! Coffee” = „So Coffee”.

| Chain | NSI | Values seen in Poland |
| --- | --- | --- |
| So!Coffee | — | name: So! Coffee (19), So Coffee (11), SO! Coffee (3), SO! COFFEE (3), So!Coffee (1) |
| Etno Cafe | — | name: Etno Cafe (3), Etno Café (1), Etno Cafè (1) |
| Columbus Coffee | — (NSI „Columbus Café” is the French chain) | name: Columbus Coffee (3) |
| Cofix | amenity/cafe „Cofix” (IL, RU only) | name: Cofix (2), Cofix Kawiarnia (1) |
| The White Bear Coffee | — | name: The White Bear Coffee (8), White Bear Coffee (6), The White Bear (2) |
| Tchibo | shop/coffee „Tchibo” (PL incl.) | brand: Tchibo (37); name: Tchibo (44) |
| Lviv Croissants | amenity/fast_food „Lviv Croissants” (match: „Lwowskie croissanty”) | brand: Lviv Croissants (4); name: Lviv Croissants (9) |
| Pożegnanie z Afryką | — | name: Pożegnanie z Afryką (6), Pożegnanie Z Afryką (1) |
| Coffeedesk | — | brand: Coffeedesk (1); name: CoffeeDesk (3), Coffeedesk (2), Coffeedesk Kawiarnia - Nowy Świat (1) |
| Crazy Bubble | — | name: Crazy Bubble (31), Crazy bubble (4) |
| BubbleJoy | — | name: Bubble Joy (3), BubbleJoy (1), bubblejoy! (2) |
| Boboq | — | name: BoboQ / Boboq / BoBoQ (3 each), BoboQ Fresh, BoboQ Lounge |
| BuBu Bubble Tea | — | none found (only an unrelated „BuBu Coffee”) — suggest „BuBu Tea”, „BuBu Bubble Tea” |
| Match Matcha | — | none found — suggest „Match Matcha” |
| Urban Coffee | — | name: Urban Coffee (3) |
| Kaferdam | — | name: Kaferdam (1) |
| Petit Paris | — | name: Petit Paris (3), Petit Paris Sołacz (1) |
| Dinette | — | name: Dinette (2) |
