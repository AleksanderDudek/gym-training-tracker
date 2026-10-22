# „Gdzie zjeść teraz?” — where to eat nearby, for today's goal — design

Date: 2026-10-22 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request (translated)

I'm hungry in a busy city I don't know. Within 500 m or more, where and what can I eat that fits my
goal today? An answer to that question, automatic from today's macros and where I am, so I decide
fast. It adapts to the distance from my position (or a typed address). A map with places in the
radius; a pin opens what I can eat there with a rating against my goal. Under the map the 3 best
choices for my goal now, sortable by protein, distance and whatever else is useful; tapping one opens
the place's card with the full list of what I can eat, its name and address, and one tap to open the
device's maps app with directions. Improve anything that makes it better.

## What exists (analysis)

- **„W pobliżu”** (`#/w-poblizu`): position (GPS, saved, tap on the map), radius 500 m–10 km, grocery
  shops from OpenStreetMap through Overpass (rounded position, cache per circle), a Leaflet map with
  pins per shop, recipes buyable in one shop and ready protein products. Shops only — no restaurants.
- **Restaurant menus**: 18 chains with per-portion nutrition transcribed from their own tables
  (`restaurants/data/*.json`) — fast food, cafés, pizzerias, petrol stations, Żabka Café. Searchable
  in „Dodaj zjedzone” and „Lokale”, but never placed on a map.
- **What to eat now**: the diary's `suggest` scores foods against what is left today (one meal's share
  of kcal, the protein gap, the diet profile's fit, penalties over budget) with the day's goal from
  `dayGoal` (week, activity) and a planned cheat meal reserved.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Where | „W pobliżu” gets two views: **„Zjedz teraz”** (new, default) and **„Zakupy i przepisy”** (the existing one, unchanged); `?widok=` in the address, the last choice remembered on the device. The diary's „Co teraz?” links to it („Poza domem? Gdzie zjeść w pobliżu”) | One place for "near me" — the same position, radius and map; no fifth food tab on a 360 px screen |
| The answer first | A sentence over the map: what is left („zostało 850 kcal i 60 g białka na 2 posiłki — na teraz ok. 430 kcal i 30 g białka”) and the best pick („Najlepiej: Wrap z kurczakiem · Subway, 350 m, 4 min pieszo”) | The user asked a question; the page answers it before anything else |
| Places | Overpass: `amenity` fast_food / restaurant / cafe / fuel / food_court and grocery shops, in the radius, the same rounded position, cache and fallbacks as the shops | One request covers both; the privacy promise stays |
| Matching menus | OSM `brand` (else `name`), folded, against brand names stored with each chain (`osm.brands` in its JSON) — every new chain file brings its own; shops of grocery chains offer their ready protein products; Żabka offers Żabka Café and its products | Data-driven: adding a chain adds it to the map |
| What can be eaten | Menu positions (portion as served) and ready products; ranked with the diary's own scoring for what is left now; where no single item reaches about a meal, the best pair (main + protein side, or two snacks in a shop) | Same rules as „Co teraz?”; a shop's skyr alone is not lunch |
| Rating | The diary's fit badge (świetnie / OK / unikaj) and the reasons („uzupełnia białko: 35 g z brakujących 60 g”, „zostanie 120 kcal”) | One vocabulary across the app |
| Distance | Walking time (80 m/min) on every place; the default order discounts the score by distance (−0.5 at the edge of the radius) | "It adapts to the distance" — a slightly better meal 2 km away is not better when you are hungry |
| Open now | `opening_hours` parsed for the common syntax; closed places are hidden by default („Pokaż zamknięte”), unknown hours are kept and say so | Hungry now means open now |
| Map | Pins coloured by the best fit (green great, gold OK, orange avoid), the top 3 numbered to match the list, places without menu data hidden by default („Pokaż lokale bez danych”, grey) | The map shows the answer, not every café in town |
| Pin | A popup: name, distance and walk, open/closed, the best 2 dishes with their fit, „Karta miejsca” | What the user asked for, small enough for a phone |
| List | The top 3 places (each with its best dish), „Pokaż więcej”; sort: **Najlepsze** (fit and distance), **Białko** (most protein within what is left), **Najbliżej**, **Najlżejsze** (fewest kcal that still feed) | Protein and distance were asked for; the lightest helps a day already near its goal |
| Place card | A sheet: name, chain and kind, address, distance, walk, open state; **„Prowadź”** opens directions on foot in the device's maps app (Apple Maps on iPhone/iPad, Google Maps elsewhere; Android also offers „Inna aplikacja” through `geo:`); then everything that fits, best first, with macros, fit, reasons and **„Zjadłem”** (logs it to today's diary; the ranking updates); what does not fit now folded under „Lepiej nie teraz” | Directions and logging close the loop: decide, walk, eat, record |
| Address | „Szukaj adresu” — Nominatim (OpenStreetMap) on submit only, 1 request a second at most, results to choose from; the chosen point becomes the position | Nominatim's usage policy forbids autocomplete; typing a hotel's address is the common case abroad |
| Without a diet profile | Rated for an average day (2 000 kcal, balanced profile) with a link to set up the profile | The map is still useful; the rating says what it assumes |
| Privacy | The rounded position goes to Overpass as before; a typed address to Nominatim; a tapped „Prowadź” sends the destination to Apple or Google — each said on the page | Same honesty as the shops view |
