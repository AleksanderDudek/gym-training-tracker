# Barcode scanner with a comparison, and a map server that is busy — design

Date: 2026-10-23 · Status: decided autonomously on request ("the search says OpenStreetMap is
handling too much traffic and fails / I want … search by scanning product code label … immediate
results about macro … a fast comparison of products by scanning a few products into a simple cache
… which is better for his goal … the cache either deletes itself after an hour OR can be removed
manually fast … Analyze current system. Use best practices. Pick recommended. I am away from
machine. Plan it out and then finish on your own").

## 1. „Serwer map jest przeciążony”

### What was measured

- The „Zjedz teraz” places query for central Warsaw (1.25 km) took **35.3 s** on overpass-api.de
  (462 kB). The client cut every request at 30 s, moved to overpass.private.coffee (which hung for
  60 s), retried the first once — and showed "overloaded" for an answer that was coming.
- At other moments the main server answered at once with **502 "This Overpass API server is
  currently at capacity … Retry your request using exponential backoff"**. During this work it also
  refused connections outright for a while; the backup hung. Other public instances
  (kumi.systems, maps.mail.ru, osm.jp) timed out or failed as well.

### Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Timeout | 50 s per request, 2 min for everything | The answer that took 35 s must not be thrown away |
| Retries | Servers take turns, each asked twice; 429/502/503/504 asked again only after `Retry-After` (capped at 30 s) or a growing pause; timeouts and dropped connections just pass the turn | What the server itself asks for; no hammering of a full server |
| Feedback | The page is told of each pause (`onWait`): "ponawiam za 6 s…", after 12 s "serwer odpowiada wolno — czekam (25 s)…"; the countdown sits outside the `role="status"` region | A long wait is never silent; a screen reader is not read a number every second |
| Fallback | Answers are kept on the device for a week (fresh for a day as before, at most four); an older or smaller answer covering the point shows at once while a new one loads, and stays after a failure with its age („Pokazuję lokale zapisane wczoraj”) | Restaurants move less often than the public servers are busy; last week's map beats an error |
| Auto retry | After a failure the page tries again after 30 s, 1 min, 2 min, not while hidden, then leaves it to the button | Growing pauses, bounded, no background traffic |
| Query | `out tags center qt` | The server skips sorting by id; the client sorts anyway |

### Considered, not done now

A prebuilt dataset of chain venues (only chains with menus or product data matter for the default
answer) hosted with the app would make „Zjedz teraz” instant and independent of Overpass. It needs
a country-wide extract (Geofabrik's Poland is 2.1 GB, or heavy Overpass queries), a refresh routine,
~1–2 MB of tiles and a merge with live results. Worth doing if failures persist after this change;
the client-side handling above is needed either way, because independent places come only live.

## 2. Barcode scanner with a comparison

### What exists

- The products dataset: 29,255 products, every code numeric — 28,049 EAN-13, 1,093 EAN-8, a few
  GTIN-14; UPC-A stored with a leading zero; 538 short codes padded with zeros (Open Food Facts'
  normalisation). 21,395 have energy and protein.
- The search field already finds a typed barcode; nothing read it from a camera.

### Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Entry | A barcode button next to the product search; the sheet lives in the address (`#/produkty?skan=1`, `?skan=lista`); app shortcut „Skanuj produkt”; „Porównaj” in every product card; a scan button in „Dodaj zjedzone” | Scanning is searching; a shop is where it is used — one tap from the home screen; comparing is not limited to what was scanned; logging by barcode is the most used diary shortcut |
| Reader | Native `BarcodeDetector` when it reads EAN-13 (Chrome on Android and macOS), else the `barcode-detector` ponyfill (zxing-cpp in WASM, 1.1 MB) loaded only then, from the app's own server; the SW caches it at the first scan | iPhone and Firefox have no native reader; no CDN: CSP, privacy, a shop without signal |
| CSP | `script-src 'self' 'wasm-unsafe-eval'`; `connect-src` + world.openfoodfacts.org | WASM compilation only, no JS `eval`; the CSP test now forces the API host into the policy |
| Camera | Back camera, 1280×720 ideal, a frame every 180 ms, checksum checked (UPC-E by its long form), the same code reported once while in view, vibration and a green flash; off when the sheet closes, a product card covers it or the page hides; torch where available | Fast and battery-light; nothing runs unseen; the picture never leaves the device |
| Typed code | Always under the camera; digits only, at least 8 | Refused or missing camera, a creased label |
| Lookup | Dataset first in every shape a code can have (as given, UPC-A with 0, UPC-E expanded, GTIN-14 without 0, padded to 13); then Open Food Facts API v2 (only the code is sent, the result marked „z Open Food Facts”); a shop's own code (prefix 2) goes nowhere | Instant and offline for most; the open database for the rest |
| Result | Per 100 g and per pack, the diet profile's verdict, one pack against what is left today, „Zjadłem 150 g”, the star, details; the comparison standing („2. z 3 na Twój cel — najlepszy jest …”) right under the name | "Immediate results about macro"; the verdict without scrolling |
| Ranking | The profile's verdict first (a product that "does not fit" never wins on one number), then protein per 100 kcal (cut, balanced, athletic) or carbohydrates per 100 kcal (low carb, keto), then lower energy; incomplete labels last and never winners; no profile → balanced, said so | Ratios are the same per 100 g and per pack; consistent with the diary's fit |
| Extras | Values per 100 g or per pack; price per 10 g protein when a price is known (Open Prices, noted) | What protein shopping compares |
| Cache | `localStorage` `produkty-pl:porownanie`; newest first, a re-scan moves to the front; at most 10; **expires an hour after the last addition** (sliding: each scan gives the trip another hour), shown as a time; one tap „Wyczyść” with „Cofnij” for 8 s, × per product (does not extend the hour); expiry checked on read, by a timer while open, on return to the page; other tabs follow (`storage` event) | "Deletes itself after an hour OR removed manually fast"; a longer shopping trip does not lose its first scans |
| Snapshot | Items are stored whole (name, numbers, price, source) | Works before the dataset loads and for Open Food Facts products |

### Checked

Unit tests for codes, Open Food Facts parsing, ranking, the cache (expiry, undo, limits, broken
storage), the hook's retries; component tests in Polish and English with a typed code (jsdom has no
camera); and a real Chromium run with a fake camera showing two EAN-13 codes: native reader first
result in ~1.3 s, the WASM fallback (native detector removed) loads `zxing_reader-*.wasm` from the
app and reads both — the comparison names the winner.
