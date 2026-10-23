# Restaurant chains research — batch `restauracje-burgery`

Checked 2026-10-23. Only the chains' own websites, PDFs and ordering pages were used. Aggregators
(fatsecret, Fitatu, Wolt, pyszne.pl) were not used; for Sphinx and Kuchnia Marché, web searches found
nothing except aggregator entries.
Statuses: **transcribed**, **kcal only**, **allergens only**, **no public nutrition data**,
**chain not operating / closed**, **local chain, no website**.
OSM names come from the name-suggestion-index (NSI, `data/brands/amenity/*`) where the chain is
listed, otherwise from taginfo `brand`/`name` values (global counts in brackets).

## Transcribed

### Dobra Buła: transcribed (`dobra-bula`, 39 items)

- Source: <https://dobrabula.pl/wp-content/uploads/2025/10/Tabela-Alergenow-i-wartosci-odzywczych_0625-1.pdf>.
  This is the "Tabela alergenów i wartości odżywczych" linked from the dobrabula.pl home page. The file
  name says 0625 (June 2025) and it was uploaded in October 2025.
- The table gives values per 100 g and per portion, plus the average portion weight. It covers energy,
  fat, saturated fat, carbohydrates, sugars, protein and salt, but not fibre. All numbers are whole numbers.
- Transcribed per portion: 15 burgers, 10 mini burgers, 7 sides and 7 sauces. The 5 buns were skipped
  because they are bun swaps for the burgers, not separate items.
- `source.inconsistent` (checked against the rendered PDF):
  - Krążki cebulowe: saturated fat 31 g with total fat 15 g.
  - Sos Pika: 41 kcal, but the macros give about 99 kcal.
  - Sos Estragonowy: 125 kcal, but the macros give about 75 kcal.
- In the Ser Bekon Burger row, the per-100 g energy repeats the per-portion value (806). The per-portion
  values agree with each other.
- OSM: `Dobra Buła` (NSI: not listed; taginfo brand 9, name 11).

### Burgermeister: transcribed (`burgermeister`, 38 items)

- Source: <https://burgermeister.com/downloads/2026/Burgermeister-Nutrition-Facts-2026_PL.pdf>.
  This is the Polish "Informacje żywieniowe" table dated August 2026, linked from
  burgermeister.com/menu/?lang=pl. A German version with the same numbers is also linked from the menu
  page, so the market is PL.
- Values are per piece or per portion. The table gives energy, protein, fat, carbohydrates, sugars,
  fibre and salt, but not saturated fat. It gives grams only for fries and two extras.
- Skipped: Lieferandomeister (a burger for Lieferando, a German delivery platform), water and beer.
  The word "Milkshake" was added to the shake names.
- The PL and DE tables swap the names of two rows. PL has "Smażona cebula" at 65 kcal and "Grillowane
  pieczarki" at 30 kcal; DE has Grilled Mushrooms at 65 kcal and Grilled Onions at 30 kcal. The PL names
  were kept, and the swap is explained in `source.note`.
- Polish venues: Szczecin (al. Wyzwolenia 12/14) and Łódź Manufaktura (Drewnowska 58), from
  burgermeister.com/standorte/.
- OSM: `Burgermeister` (NSI fast_food, locationSet `de`; taginfo brand 30, name 50).

## Not transcribed

### Kuchnia Marché: no public nutrition data

- kuchniamarche.pl has no menu at all. The restaurant pages (/restauracje/<venue>/) give only the address
  and opening hours.
- OSM: `Kuchnia Marché` (NSI: not listed; taginfo name 15).

### Sphinx: allergens only

- menu.sphinx.pl has a menu per restaurant (e.g. /menu/SP2/menu-glowne/burger/, /shoarma/, /salaty/).
  It gives portion weights and prices, with no kcal.
- <https://menu.sphinx.pl/assets/Allergies-TG.pdf?v=20261015> is the "Informacja o składnikach oraz
  alergenach" PDF (86 pages, version 03.08.2026). It has ingredients and allergens only, no energy or
  macros. Nothing on www.sphinx.pl either. The README's "no full macros" still holds.
- OSM: `Sphinx` (NSI restaurant, locationSet `pl`; taginfo brand 24).

### Manekin: no public nutrition data

- Each venue page links menu PDFs, e.g.
  <https://manekin.pl/ybyckoax/2024/04/MTR-menu-zima-2027-ze-sniadaniami-ver.-08.10.pdf>. They give dish
  weights and prices but no kcal; allergen information is available from staff on request.
- OSM: `Manekin` (NSI: not listed; taginfo name 19, brand 1). "Manekin" is also a prefix of
  "Manekineko" (karaoke and Japanese restaurants abroad).

### Hard Rock Cafe: no public nutrition data in PL; kcal only in other markets

- The Polish venue pages (cafe.hardrock.com/warsaw, /krakow, /gdansk, /wroclaw) link English menu PDFs,
  e.g. <https://cafe.hardrock.com/warsaw/files/5511/online_WWA_ENG_EATS_J220258_-_HRC_US_-_03_26_-_M3_-_V1.pdf>.
  They have no nutrition and say "Additional nutritional information is available upon request".
- UK and US venue menus print kcal only, e.g. cafe.hardrock.com/london/files/5330/KIDS_MENU_OPL.pdf.
  No international table with protein, carbohydrates and fat was found, so no other market's numbers
  could be used.
- OSM: `Hard Rock Cafe` (NSI restaurant, worldwide; taginfo brand 153, name 173).

### Olimp: no public nutrition data

- olimprest.pl (Gastromall Group) runs self-service restaurants that sell food by weight (one price per
  100 g). The menu changes and has no fixed portions; the site has no menu and no nutrition.
- OSM: `Olimp` (NSI: not listed). On taginfo, the brand "Olimp" (4) is mostly the supplements brand, and
  the name "Olimp" (133) is ambiguous.

### Makarun: per 100 g only, no portion weight (not transcribed)

- <https://makarun.pl/tabela/> is the "Tabela wartości odżywczych" page (last modified 2022-03-02). It
  gives kcal, protein, carbohydrates and fat for 20 sauces, "na 100 g dla porcji sos + makaron".
- All 20 venue menus were checked (makarun.pl/punkt/…). They give only "małe / duże" sizes and prices,
  no grams, so no portion can be computed.
- OSM: `Makarun` (NSI: not listed; taginfo name 13).

### Pierogarnia Stary Młyn: allergens only

- <https://www.pierogarnie.com/karta_alergenow/> links the allergen tables:
  <https://www.pierogarnie.com/wp-content/uploads/2026/10/2026-jz-alergeny-tabela-final-3.pdf> and a
  breakfast table. The menu PDFs for each venue (…/2026/10/menu-2026-02jz-<city>-web.pdf) have no kcal.
- OSM: `Pierogarnia Stary Młyn` (taginfo name 5) and `Stary Młyn` (name 113, but ambiguous because it
  also names mills; brand 1). Not in NSI.

### Pita Bros: no public nutrition data

- pitabros.pl (Wix) has history, venues (Wola, Fabryka Norblina, …) and the menu as images. No kcal or
  macros.
- OSM: `Pita Bros` (NSI: not listed; taginfo name 4).

### Green Way: no public nutrition data; single venue

- greenway.pl: only the Sopot venue remains (Bohaterów Monte Cassino 47). The site shows sample dishes
  and no nutrition.
- OSM: `Green Way` (NSI: not listed). On taginfo the name "Green Way" (195) is mostly street names.

### Chinkalnia: no public nutrition data

- chinkalnia.pl redirects to khinkalnya.com/pl/. The restaurant list (/pl/restorany/) and the venue
  pages have no menu and no nutrition.
- OSM: `Chinkalnia` (NSI: not listed; taginfo name 20, plus "Chinkalnia Express" and "Restauracja
  Chinkalnia").

### Whiskey in the Jar: allergens only

- Menus are at menu.witj.pl/food-qr-<city>-pl/ (warszawa, gdn, wro, lodz, browar). They link an
  allergen table, e.g. <https://menu.witj.pl/wp-content/uploads/2025/09/alergeny_2025-09_wawa.pdf>. No kcal.
- OSM: `Whiskey in the Jar` (NSI: not listed; taginfo name 5, plus "Whiskey in the Jar - Stary Browar").

### SurfBurger: no public nutrition data

- surfburger.pl/menu/ is a menu board with an order link. No kcal.
- OSM: `SurfBurger` (taginfo name 3) and `Surf Burger` (name 7). Not in NSI.

### Craft Burger: no public nutrition data

- craftburger.pl does not resolve. The chain's site is craft-burger.pl, which uses papu.io ordering.
  Venues: Gdańsk Blizbora 7a, Gdańsk al. Jana Pawła II 1D, Gdynia Strzelców 1U. The meal pages give
  descriptions and prices only.
- OSM: `Craft Burger` (NSI: not listed; taginfo name 11, brand 1). The name is generic, so it also
  matches chains abroad.

### Mr. Pancake (FoodX): no public nutrition data

- foodx.pl/mrpancake/ is a brand page. Ordering is at foodx<city>.goorder.pl (a GoPOS app), with no
  nutrition fields.
- OSM: `Mr. Pancake` (taginfo name 2), `Mr Pancake` (3), `FoodX` (1), plus "Mr. Pancake & Pizza Boyz".
  Not in NSI.

### The Mexican: no public nutrition data

- themexican.pl does not resolve. The site is mexican.pl (Mex Polska), with venues in Łódź Manufaktura,
  Poznań, Sopot, Warszawa (2) and Wrocław. The venue menus have no kcal.
- OSM: `The Mexican` (NSI: not listed; taginfo name 16, generic).

### Spoko Taco: no public nutrition data

- spokotaco.pl/menu gives portion weights (e.g. tacos 2 szt. 200 g) and prices. No kcal.
- OSM: `Spoko Taco` (no taginfo values yet; not in NSI).

### Pyra Bar: allergens only

- The venue pages (pyrabar.pl/pyrabar-poznan/, -gdansk/, -gdynia/) list allergens for each dish. The
  menu PDF (<https://pyrabar.pl/docs/menu%20POZ_pl.pdf>) has no kcal.
- OSM: `Pyra Bar` (taginfo name 3) and `Pyrabar`. Not in NSI.

### Zapiecek: no public nutrition data

- zapiecek.eu redirects to its online shop (zapiecek.eu/sklep/…), which has categories and prices with
  no kcal or allergens. Venues are in Warsaw.
- OSM: `Zapiecek` (NSI: not listed; taginfo name 55, partly unrelated inns) and `Pierogarnia Zapiecek` (1).

### Bierhalle: no public nutrition data

- <https://bierhalle.pl/wp-content/uploads/2026/07/menu_bierhalle-pl.pdf> is a 4-page menu with
  allergen markings and no kcal.
- OSM: `Bierhalle` (NSI: not listed; taginfo name 21, some in Germany/Austria).

### Pijalnia Wódki i Piwa (Mex Polska): no public nutrition data

- pwip.com.pl has no nutrition. Its menu page (pwip.com.pl/menu/) returned HTTP 500 on 2026-10-23.
- OSM: `Pijalnia Wódki i Piwa` (NSI bar, locationSet `pl`; taginfo brand 22, name 25).

### Cybermachina: no public nutrition data

- cybermachina.pl/menu/ is a drinks and potions menu with no kcal.
- OSM: `Cybermachina` (NSI: not listed; taginfo name 10, plus "CyberMachina" and "Cybermachina Game Pub").

### Billy's American Restaurant: kcal and macros for 3 dishes only (not transcribed, under 10 items)

- <https://billys.com.pl/menu-trojmiasto/> has a "Strefa Fit" section with kcal, protein, fat and
  carbohydrates:
  - FIT BURGER (480 g): 499 kcal, 48 g protein, 8 g fat, 49 g carbohydrates.
  - GOLD'S GYM: 1538 kcal, 162 g protein, 38 g fat, 137 g carbohydrates.
  - MUSCLE BEACH: 1238 kcal, 86 g protein, 48 g fat, 105 g carbohydrates.
- The rest of the menu has no nutrition. Three items are below the 10-item minimum.
- OSM: `Billy's American Restaurant`; `Billy's` (taginfo name 28) is ambiguous. Not in NSI.

### Lepione: no public nutrition data

- lepione.pl ("Restauracja z jedzeniem na wagę") is a contact page only. Food is sold by weight, with no
  menu and no fixed portions.
- OSM: `Lepione` (NSI: not listed; taginfo name 9).

### Pasta Miasta: no public nutrition data; operating status unclear

- pastamiasta.pl now has only a catering offer page (/oferta-cateringowa.html) and links to Czerwony
  Piec and Grupa Semolina. There is no venue list and no menu.
- OSM: `Pasta Miasta` (NSI: not listed; taginfo name 1).
