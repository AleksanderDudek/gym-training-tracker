# Restaurant chains — batch `pizza` (checked 2026-10-23)

Only the chains' own sources were used (website, PDF, the site's own API). Aggregators were not consulted for numbers.

## Domino's Pizza (dominospizza.pl) — allergens only

- The site (behind Cloudflare; read with a headless browser) links only „Informacje o alergenach” →
  <https://www.dominospizza.pl/DominosPizza/media/files/alergeny.pdf> (allergen matrix, „Wrzesień 2026”, no energy or macros).
- FAQ says allergen info is on that page and in every venue; nothing about calories.
- Online menu: the product list API (`/iapi/products/getproductlist/…`) carries name, description, price, images — no nutrition fields. None of the 298 JS chunks of the site contains „kcal”, „kalor”, „wartości odżywcze” or similar, so the ordering UI has no nutrition view.
- OSM brands: `Domino's`, `Domino's Pizza`; some ex-105 venues are signed „Domino's Pizza & 105”.

## Papa John's (papajohns.pl) — no public nutrition data

- There is a „Kaloria i skład” page (<https://papajohns.pl/warszawa/nutrition>, same for /wroclaw/nutrition) whose UI shows weight and „Wartość odżywcza na 100g” from each variation's `characteristics`.
- In the site's own API (`https://api.papajohns.pl/catalog/goods`, `catalog/good?id=…`) and in the server-rendered state, `characteristics` is empty for every one of the 308 variations (Warsaw and Wrocław) — the page renders with no numbers.
- OSM brands: `Papa John's`, `Papa Johns`.

## Gruby Benek (grubybenek.pl) — allergens only

- „Wykaz alergenów” → <http://grubybenek.home.pl/wydazenia/GB%20Wykaz%20alergen%C3%B3w%202026.10.pdf> (one page, allergen matrix only, created 2026-10-08).
- Online ordering is Restaumatic; menu pages carry no nutrition.
- OSM brands: `Gruby Benek`.

## Biesiadowo (biesiadowo.pl) — transcribed: `biesiadowo`, 98 items

- Source: „Tabela wartości odżywczych” page linked in the site footer, <https://biesiadowo.pl/wartosci> (HTML table, no date). It gives per 100 g and per portion: pizzas at 26, 32, 42 and 57 cm; burgers and fries; zapiekanki (small/large); kebab-style dishes (Talerzowiec, Bułkowiec, Tortillowiec); pierogi, lasagne, spaghetti, wings, soups, kids' menu; desserts. Energy, fat, saturates, carbohydrates, sugars, protein, salt — no fibre, no pizza weights.
- Transcribed the per-portion columns as published: pizzas at 32 cm (53), plus the five pizzas the table has only at 26 cm and „4 pory roku” (only 57 cm has numbers); all other dishes. Other pizza sizes left out to stay within the item limit.
- Oddities kept as published: sugars nearly equal to carbohydrates in most pizzas, zapiekanki and fries; Pucharek lodowy salt 4.3 g per portion vs 0.001 g/100 g; two different pizzas „Kurczę blade” and „Kurcze blade”.
- `source.inconsistent`: Mucząca krówka (26 cm) — fat 954.13 g per portion (9.58 g/100 g in the same table).
- OSM brands (taginfo): `brand=Biesiadowo` (20), `name=Biesiadowo` (28), `Pizzeria Biesiadowo` (2).

## Pizzeria 105 / Stopiątka (105.pl — pizzeria105.pl no longer resolves) — incomplete (no protein, per 100 g only)

- „Lista alergenów” on <https://105.pl/> links a PDF „Księga wykazu składników i alergenów oraz wartości odżywczych Pizzeria 105 in Italia — Jesień 2026” (84 pages, created 2026-09-14).
- Values are per 100 g only: kJ/kcal, fat, saturates, carbohydrates, sugars. The table ends at „cukry”: no protein and no salt column (not clipped — nothing beyond the page edge), and no portion weight or pizza size anywhere. Unusable (protein missing, no portion).
- The site says part of the venues already trade as „Domino's Pizza & 105” (Nowy Targ, Przemyśl, Jarosław, Piastów, Grudziądz, Krosno, Kielce).
- OSM brands: `Pizzeria 105` (brand and name), `Pizzeria Stopiątka`; converted venues `Domino's Pizza & 105` / `Domino's and Pizzeria 105`.

## Pizzatopia (pizzatopia.com — pizzatopia.pl is a parked home.pl domain) — no public nutrition table

- <https://pizzatopia.com/menu/> gives macros for exactly one pizza („high protein”: 972 kcal, 74 g protein, 119 g carbohydrates, 21 g fat, no portion weight); every other pizza is build-your-own. One item is far below the 10-item minimum.
- <https://pizzatopia.com/menu/info-o-alergenach/> is a short allergen note („szczegółowe informacje … dostępne u obsługi”).
- OSM brands: `Pizzatopia`.

## Tutti Santi (tuttisanti.pl) — no public nutrition data

- The site has no nutrition or allergen page. Ordering is UpMenu (https://zamow.tuttisanti.pl/ → tuttisanti.orderwebsite.com); the rendered menu (e.g. /poznan) shows names, descriptions and prices only — no „kcal” anywhere outside UpMenu's generic translation strings.
- OSM: no `brand` tag in use; `name=Tutti Santi` (19), `Pizzeria Tutti Santi`.

## Express Pizza (expresspizza.pl) — allergens only

- Footer „Informacja o alergenach” → <https://expresspizza.pl/alergeny.png> (allergen matrix for 24 pizzas and garlic sauce). Menu page has no nutrition.
- OSM: no `brand` tag in use; `name=Express Pizza` (66), `Express pizza` (12) — the name is generic, so map matches may include unrelated pizzerias.

## Fabbrica, formerly Fabryka Pizzy (fabbrica.pl) — allergens only

- Footer links „Książka alergenów” <https://cs.cdn-upm.com/assets/33b78e17-d1e7-11e3-ac27-00163edcb8a0/50533a95-2634-4952-b634-3fe67c09cc39/alergeny2024.pdf> (61 pages, June 2024: ingredients and allergens per dish, no energy or macros). The UpMenu menu (/menu) has no nutrition (the „nutrition calculator” strings in the page are UpMenu's generic translations, not used).
- OSM: see taginfo note below.

## Pizzanova (pizzanova.com.pl) — no public nutrition data

- <https://pizzanova.com.pl/tabela-kalorycznosci.html> exists but is an unfilled template („SZABLON — do uzupełnienia”, noindex, every value „—”); its footer link is commented out. <https://pizzanova.com.pl/assets/Karteczki/skladniki-pizzanova.pdf> is the build-your-own ingredient card (no numbers).

## Ciao Napoli (ciaonapoli.pl) — no public nutrition data

- One-page site with menu photos and links to delivery platforms; no nutrition or allergen information. Its own ordering link (ciao-napoli.skubacz.pl) returns 404.

## Pizza Fresca (pizzafresca.pl) — transcribed: `pizza-fresca`, 30 items

- Source: home page <https://pizzafresca.pl/> — „Wartości odżywcze i alergeny — menu w punktach” (10 pizzas of the four counters) and „Wartości odżywcze — menu restauracji” (20 numbered pizzas of the Szafrana restaurant; same table on <https://pizzafresca.pl/szafrana/>). Whole pizza: kcal, protein, fat, carbohydrates, weight („wyliczone z receptur i kart produktów dostawców”). No sugars, saturates, fibre, salt, no size in cm.
- Restaurant pizzas are only numbered; names built as „Pizza rossa NO. n” / „Pizza bianca NO. n” from the menu section heading. Some numbers repeat counter pizzas (NO. 1 = Margherita, NO. 3 = Salami piccante, NO. 6 = Spicy Honey, NO. 11 = Fresca).
- OSM: see taginfo note below.

## OSM brand names (taginfo, worldwide counts, 2026-10-23)

| Chain | `brand=` | `name=` |
| --- | --- | --- |
| Domino's Pizza | `Domino's` (10598), `Domino's Pizza` (117), `Domino's and Pizzeria 105` (1) | `Domino's`, `Domino's Pizza`, `Domino's Pizza & 105` (1) |
| Papa John's | `Papa John's` (3081), `Papa Johns` (3) | `Papa John's`, `Papa Johns` |
| Gruby Benek | — | `Gruby Benek` (27), `Pizzeria Gruby Benek Lublin` (1) |
| Biesiadowo | `Biesiadowo` (20) | `Biesiadowo` (28), `Pizzeria Biesiadowo` (2) |
| Tutti Santi | — | `Tutti Santi` (19), `Pizzeria Tutti Santi` (1) |
| Express Pizza | — | `Express Pizza` (66), `Express pizza` (12) — generic name |
| Pizzeria 105 | `Pizzeria 105` (27), `Pizzeria Stopiątka` (1) | `Pizzeria 105` (62), `Pizzeria 105 Stopiątka` (1) |
| Fabbrica | — | `Fabryka Pizzy` (9); `Fabbrica` (49) and `La Fabbrica` (52) are mostly unrelated Italian places |
| Pizzatopia | `Pizzatopia` (1) | `Pizzatopia` (7), `PizzaTopia` (1) |
| Pizzanova | — | `Pizzanova` (2) |
| Ciao Napoli | — | `Ciao Napoli` (10) |
| Pizza Fresca | — | `Pizza Fresca` (11) — generic name, may include pizzerias outside Kraków |

The name-suggestion-index raw files could not be downloaded from this machine (connection reset), so the table is from taginfo only.
