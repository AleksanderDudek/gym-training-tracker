# Restaurant nutrition research — batch `lokalne` (local chains)

Checked: 2026-10-23. Scope: local chains (2–10 venues in one city) that have a website.
Method (quick sweep): fetched each home page and its menu/offer pages (static HTML and, for
JavaScript sites, a headless Chromium render), scanned the text and linked PDFs for `kcal`,
`białko`, `tłuszcz`, `węglowodany`, `wartości odżywcze`, and ran domain-restricted web searches
(`kcal`, `kcal białko węglowodany tłuszcze wartości odżywcze`) over all the domains.

**Result: no chain in this batch publishes a nutrition table (energy + macros) on its own site.
Nothing was transcribed; no chain file was added.**

OSM names: only Awiteks is in the name-suggestion-index (`shop=bakery`, brand `Awiteks`,
Q62054190). For the others the plain chain name is given (the usual `name` tag); matching is
prefix- and diacritics-insensitive, so the plain name also finds "<name> <city/street>".

## No public nutrition data (site reachable)

| Chain (OSM name) | City | Site | What was checked / seen |
|---|---|---|---|
| Amitoramen | Gdańsk | https://amitoramen.pl/menu/ | Next.js menu page; "Alergeny i skład" button points to `/listy-alergenow.pdf`, which returns 404. No kcal. |
| Aïoli (`Aioli`) | Warszawa, Katowice, Łódź… | https://aioli.com.pl/menu/ | City menus (Katowice, Chmielna, Świętokrzyska) list ingredients and prices only. https://aioli.com.pl/app/uploads/2026/05/WYKAZ-ALERGENOW-2026.pdf is an allergen matrix only (**allergens only**). |
| BankCook | Poznań | https://bankcook.pl/menu/ | Menu, lunch, shop pages: dishes and prices; ordering via Bolt/Glovo. No kcal. |
| Batida | Warszawa | https://batida.pl/ | Shopify shop; product pages (e.g. /products/kremowka-francuska) give description/allergen note, no nutrition table. |
| Tel Aviv Urban Food (`Tel Aviv`) | Warszawa | https://telaviv.pl/ | Near-empty WordPress page ("Tel Aviv Urban Food by Malka"); no menu content. |
| Bernard | Wrocław | https://restauracja.bernard.wroclaw.pl/ | Restaurant and /bistro pages: menu without nutrition. |
| Brand Sushi (`Brand Sushi Bar`) | Poznań | https://brandsushi.pl/brandmenu-brand-sushi-menu/ | Menu page and price-list PDF (BRAND_SUSHI_CENNIK_2025_2.pdf, 12 pp.) — prices and descriptions only. Ordering on UpMenu. |
| Bułkę przez Bibułkę | Warszawa | https://bulkeprzezbibulke.pl/menu/ | Menu with allergen markings (**allergens only**); catering PDF without nutrition. |
| Bydło i Powidło (also `BIP Burgers`) | — | https://www.bydloipowidlo.pl/zamow-online/menu | UpMenu ordering page (now branded "BIP Burgers"): items with allergens and prices, no kcal (UpMenu's generic "nutrition calculator" strings are present but unused). |
| Chimera | Kraków | https://chimera.com.pl/nasze-menu | Salad-bar menu, gallery; no nutrition. |
| Fawor | Poznań | https://fawor.pl/ | Bakery/patisserie category pages (bułki, chleby, ciasta…) with descriptions and weights only. Old e-shop product pages (`/produkt/...`, per-100 g labels) still appear in search results but return 404; `/sklep/` is 404. |
| Ferment Group | — | https://fermentgroup.pl/ | Group landing page (places, HoReCa, shop); no menus with nutrition. |
| Frontiera | Poznań | https://www.frontiera.pl/restauracja/pizzeria-classica | Restaumatic ordering menu; prices and ingredients, no kcal. |
| Gessler | Warszawa | https://gessler.pl/ | Group site (Wódka Gessler, Na Widelcu, Przy Chmielnej, Na Kanapce); /menu-warszawa returns 404. No nutrition. |
| Hashi Sushi | Gdynia/Trójmiasto | https://www.hashisushi.pl/menu | Menu sections (PL/EN) and gdynia.hashisushi.pl ordering; allergens only, no kcal. |
| Hoshi Sushi | Rzeszów | https://hoshisushi.pl/ | Ordering platform landing (2 venues); allergen labels in the platform, no kcal. |
| Izumi Sushi | — | https://izumisushi.pl/izumi-omakase/ | Omakase reservation site; product pages without nutrition. |
| Jack's Bar | — | https://jacksbar.pl/menu/ | Menu, no nutrition. |
| Kinki Ramen | Kraków | https://kinkiramen.pl/ | Menu published as JPG images (menu-kinki-pl.jpg); no nutrition. |
| Kufle i Kapsle | Warszawa | https://kufleikapsle.pl/menu/ | Beer bar menus per venue; no nutrition. |
| Le Cedre | — | https://le-cedre-1.upmenusite.com/menu | UpMenu menu: set menus with gram weights of components, prices; no kcal. |
| Mak Kwak (also `Szaszłykarnia Merkury`) | Szczecin | http://makkwak.pl/ | Kebab bars + Szaszłykarnia Merkury location pages; no menu nutrition. |
| Marco Polo | Szczecin | https://www.marcopolo.szczecin.pl/ | Restaumatic ordering menu; no kcal. |
| Mateusz Gessler (`Warszawa Wschodnia`) | Warszawa | https://www.mateuszgessler.com.pl/restauracje/ | Restaurant pages and online-order page; no nutrition. |
| Megadolce | — | https://www.megadolce.pl/ | Bakery one-page site (WordPress); no products with nutrition. |
| Mielżyński | — | https://mielzynski.pl/ | Wine bar/shop site behind an age gate; no food nutrition. |
| Must Bake | — | https://mustbake.pl/ | Cake shop; product pages give ingredients/allergens only (e.g. /ciasta/malinowa-chmurka-13.html). |
| My Asia Foods (`My Asiafoods`) | Gdańsk | https://myasiafoods.pl/ | Ordering page (order.app.hd.digital) says the restaurant is not accepting orders; no nutrition. |
| Mąka i Woda | Warszawa | https://makaiwoda.pl/ | About/bakery pages only; no menu nutrition. |
| Oliwa i Ogień | Wrocław | https://oliwaiogien.pl/menu | Menu with ingredients; no nutrition. |
| Pierogarnia Mandu (`Mandu`) | Gdańsk, Gdynia | https://pierogarnia-mandu.pl/gdansk-centrum/menu/ | Menu with allergen notes (**allergens only**). |
| Pikawa | Gdańsk | https://pikawa.pl/kawiarnia-pikawa-gdansk-menu/ | Café menu; no nutrition. |
| Pizza King | — | https://www.pizza-king.pl/menu-tygodniowe/ | Weekly/weekend/news menus; no kcal. |
| Peperoni Pizza (`Peperoni`) | Szczecin | https://srodmiescie.pizzapeperoni.pl/menu-pizza/ | Menus per district subdomain; product pages without nutrition. |
| Słodki Chłopak | — | https://slodkichlopak.pl/o-nas/menu/ | Patisserie menu and shop; no nutrition. |
| Tajskie Niebo | Poznań, Luboń, Swarzędz | https://www.tajskieniebo.pl/menu | UpMenu ordering; no kcal. |
| Toni Pepperoni | Szczecin | http://tonipepperoni.pl/menu/ | Menu with prices/ingredients; no nutrition. |
| Uki Uki (`ukiuki`) | — | https://ukiuki.pl/menu/ | Site is now a content/SEO blog about sushi; no priced menu, no nutrition. |
| Warszawska Grupa Restauracyjna | Warszawa | https://warszawskagruparestauracyjna.pl/ | Group site (several restaurant concepts); no menus with nutrition. |
| Weranda (`Weranda Family`) | — | https://werandafamily.com/ | Restaurants/catering group site; no nutrition. |
| Woo Thai | — | https://woothai.pl/restaurant/en/ | Restaurant page/menu; no kcal. |
| Woosabi | Wrocław, Gdańsk, Kraków | https://woosabi.pl/ | Location pages + shop; no nutrition. |
| Awiteks (NSI brand `Awiteks`) | Kraków | https://www.awiteks.pl/ | Bakery company site (history, events, loyalty card); no product nutrition. |
| Cukiernia Małek (`Małek`) | — | https://cukierniamalek.pl/ | Cake shop categories (torty, ciasta); no nutrition. |

## Chain not operating / site not in use

| Chain (OSM name) | Site | Evidence |
|---|---|---|
| Pesto (`Pesto Pizza & Pasta`) | https://www.pesto.szczecin.pl/ | Restaumatic page shows "Restauracja PESTO (zamknięte)". |
| Kebab Drwal | https://kebabdrwal.pl/ | "Nowa strona internetowa jest w przygotowaniu" — placeholder, venues Gdańsk/Gdynia/Wejherowo. No menu. |
| Fatboy (`Fatboy Street Food`) | https://www.fatboystreetfood.pl/ | Returns the site builder's 404 page. |
| Fiszka | http://fiszka.pl/ | home.pl parking page (domain not in use). |
| Pierożak | http://pierozak.pl/ | Hosting placeholder ("domena … nie może zostać wyświetlona"). |
| Pierogarnia Krakowiacy | https://pierogarniakrakowiacy.pl/ | GoDaddy parked domain. |
| Polish Lody | https://polishlody.pl/ | Redirects to premium.pl — domain for sale. |

## Local chain, no working website (domain does not resolve)

These domains have no DNS (no NS/A records on 2026-10-23); one web search each found no other
official site. OSM name to use: the plain chain name.

| Chain (OSM name) | Domain tried | Note |
|---|---|---|
| Gyozilla (`Gyozilla Ramen`) | gyozilla.pl | Only third-party listings (Gdańsk). |
| Neon Noodle Bar | neonnoodlebar.pl | No match found (closest: Neon Streetfood Bar, Gdynia). |
| Oliwa do Ognia | oliwadoognia.pl | Gdańsk pizzeria, third-party listings only. |
| PiwPaw | piwpaw.pl | Resolves (216.185.152.159) but HTTP/HTTPS time out. |
| Pizzaiolo | pizzaiolo.pl | Resolves to 127.0.0.1. |
| Pizzatino | pizzatino.pl | No match found. |
| SAM (`SAM`) | samwarszawa.pl | Warsaw bakery-bistro; third-party listings only. |
| Sushi 77 (`77 Sushi`) | sushi77.pl | Only delivery-platform listings. |
| Tapas de Rucola | tapasderucola.pl | Sopot; third-party listings only. |
| Toan Pho | toanpho.pl | No match found. |
| Vegan Ramen Shop | vegan-ramen-shop.pl | Warsaw; reviews say the menu has no allergen info; delivery via Wolt. |
| Damascus | damascus.com.pl | Only a Wolt listing (Białystok). |
