# Chains from the list: menus with nutrition — design

Date: 2026-10-23 · Status: decided autonomously on request ("update the list of dishes with the
ones from these places … get each one's table of dishes with macros and calories … Analyze current
system. Use best practices. Pick recommended. I am away from machine. Plan it out and then finish
on your own"). Input: a list of 420 restaurant and food-service chains in Poland (research of
2026-10-22).

## What exists

- 18 chains with per-portion menus transcribed from the chains' own tables
  (`restaurants/data/*.json`), each checked by `catalog.test.ts`; the rule is official sources only,
  no aggregators, and the chain's own errors listed in `source.inconsistent`, never "fixed".
- „Zjedz teraz” matches OpenStreetMap venues to these menus by `osm.brands`.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Scope | Every national and regional chain from the list, plus a quick sweep of local chains with a website; local chains without a site are recorded as such | 420 chains: most local ones have no published data; the national ones matter for the map |
| Method | Six parallel research agents by kind (pizza, kebab/Asian/chicken, cafés, bakeries and sweets, restaurants and burgers, local chains), the repo's transcription rules, one research log per batch in `docs/research/` | Disjoint new files merge without conflicts; the logs keep the evidence |
| What counts | Energy plus protein, carbohydrates and fat per portion from the chain's own source; per 100 g only when the portion weight is published (computed and flagged) | The app rates dishes by these four |
| Chains without data | A registry (`restaurants/unpublished.ts`, 66 chains) with what they do publish (allergens, kcal, per 100 g only, nothing); the place card on the map says so | "This chain publishes no nutrition values" is a fact the user can act on; "unknown menu" is not |
| Generic names | Local chains with common names get `osm.near` (a point and a radius); generic names are left out of the registry (Express Pizza, Hana Sushi, Thali, Green Way, Olimp, Billy's, Zapiecek, Charlotte, Vincent…) | A pizzeria called „Pizza Fresca” in Gdańsk is not Kraków's chain |
| Map coverage | The places query also asks for `shop=bakery|pastry|coffee` and `amenity=ice_cream` | Bakery chains and Tchibo cafés are tagged that way |

## Result

15 new chains (1 153 items): Berlin Döner Kebap, Biesiadowo, Pizza Fresca, So!Coffee, Tchibo,
BubbleJoy, Dobra Buła, Burgermeister, Gorąco Polecam, Fit Cake, Putka, Lajkonik, Galeria Wypieków
Lubaszka, Oskroba, Asprod — 33 chains, 2 342 items. The menu chunk grew from ~49 to ~96 kB gzip
(loaded only with Lokale, food search or „Zjedz teraz”).

Not done: chains whose data lives only in a mobile app (Good Lood) or behind a bot check (Kebab King
— worth one look by hand); Pan Precel announced tables "soon".
