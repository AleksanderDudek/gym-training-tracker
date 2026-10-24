# „W pobliżu” from the app's own OpenStreetMap data — design

Date: 2026-10-24 · Status: decided autonomously on request ("Can the logic of requests to the map
server be optimized? Caching while waiting for results? Maybe the logic is generally too heavy or
suboptimal? How to make it faster? … Analyze current system. Use best practices. Pick recommended.
I am away from machine. Plan it out and then finish on your own").

## What was measured

- Live Overpass, central Warsaw, 1.25 km: **35 s** for the places answer (462 kB) on a busy day;
  overpass-api.de answering **502 "at capacity — retry with exponential backoff"** at once, again
  while this was planned; the backup hanging for 60 s; other public instances failing.
- Two views asked two different questions and kept two caches: using both cost two requests, and
  the shops view waited for the 3.3 MB products download before asking at all.
- The Geofabrik extract of Poland (2.1 GB, 2026-10-22) filtered with osmium: **15 s**; 152,502
  features → **99,144 named places and shops** (71,123 nodes, 27,974 ways, 47 relations; the rest
  were closed ways exported twice, untagged or unnamed). As a TSV: 8.3 MB, 2.7 MB gzipped.
- Cut into an adaptive quadtree with at most 500 places per cell: **~590 cells**, median 4 kB
  gzipped, the largest ~15 kB. A 1 km circle needs 1–5 cells (10–50 kB) instead of a 462 kB answer.

## How it was decided

A panel of four independent designs (live-but-lean tiles on Overpass; a full static dataset; static
for chains + live for the rest; an edge cache in the Cloudflare Worker), scored by three judges
(user experience and speed; robustness, privacy and compliance; engineering cost). All three put
the full static dataset first (8, 8, 7 of 10), the edge cache last (2). The lead synthesis and its
decisions follow, with the changes made while implementing.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Source in Poland | The app's own copy of OSM data for **both views**; no Overpass request at all while that copy can be read (when the app's server cannot give it, Overpass as abroad) | The only way the first answer in a new place stops depending on overloaded volunteer servers; complete counts („bez danych”, „i N innych”) at once; works offline for areas seen |
| Source abroad / at the border | Overpass as before (pauses, retries, saved answers), **one union query and one cache for both views**; at the border the Polish side at once and the rest live | Abroad cannot be prebuilt for every country; one question serves both views |
| Data in the repo | `data/osm/places-pl.tsv` (sorted raw tags, 9 columns, centre of each object) + `meta.json`, from `npm run food:osm` (Geofabrik extract → osmium tags-filter → export → normaliser) | Text with sorted rows gives small git deltas on refresh; no chain or menu matching in the data, so new chains never need a data rebuild |
| One rule | `src/food/nearby/osmTags.ts` (no imports) defines which objects count; queries, parsers, the osmium filter and the script all use it; golden test of the query strings | Poland (copy) and abroad (Overpass) can never disagree |
| Build | `vite/osmPlaces.ts` cuts the TSV into gzipped leaves named by content hash under `data/osm/v1/t/`, an index at a fixed URL and `LICENSE.txt`; `virtual:osm-places` gives only the index URL | A data-only deploy changes no JS and no `sw.js`: no update prompt; unchanged cells keep their URL and stay cached |
| Which cells a position asks for | Chosen from the position **rounded to 0.001°** with radius + ~85 m; what is complete measured from the exact position on the device | The server learns no more than Overpass did (the rounded circle); privacy invariant tested |
| Cell size | At most 500 places, depth ≤ 12 (finest ≈ 0.57 × 0.73 km) | Small files in cities, few files in the countryside |
| Caching | SW: leaves CacheFirst (`gt-osm`, 400 entries, 90 days since last use — the `Date` header is stripped, purge on quota), index and `LICENSE.txt` StaleWhileRevalidate (`gt-osm-index`); memory LRU of 96 decoded leaves, the leaves on screen pinned; one request per leaf however many ask; the first visit's files re-fetched through the SW once it takes over (`src/swWarm.ts`) | Instant on return; bounded trail of viewed areas; offline right after the first visit |
| New data version | A leaf 404 re-reads the index past the SW and selects again; offline, an older cached version of the same cell is used and said so | A deploy never leaves a known area empty |
| Loading | The page asks at mount, before the products gate, nearest leaves first, never aborted, rendered in 30 ms batches; „na razie: N miejsc w promieniu …” while incomplete | The answer appears in a fraction of a second, without the map flickering |
| Map | An open popup survives pin redraws (`popupKeeper`) | Data now arrives in pieces |
| Live etiquette | 429/406 → 30 s pause per server; no request while offline, retry on `online` | Kinder to the servers; faster recovery |
| Refresh | `npm run food:osm` locally; the "Dane OSM" GitHub workflow is **manual (workflow_dispatch) only**, with a commented weekly schedule | A weekly bot committing to `main` would change how the owner pushes (`pull --rebase` first); the owner can enable it with one line |
| Staleness | Date always in the credit line; a note when data is older than **60 days**; build warning past **45 days** | Manual refresh cadence |
| ODbL | Credit „© autorzy OpenStreetMap · licencja ODbL · stan z …” in both views; `LICENSE.txt` beside the leaves; `data/osm/README.md` offers the whole database and the script in the public repo | Attribution and the offer of the derived database |
| Reset | „Usuń dane jedzenia” also clears `gt-osm`, `produkty-pl:osm` and the legacy `produkty-pl:places` (missing before) | No forgotten trail |
| Tests | The static layer is off under Vitest (`virtual:osm-places` → `{index:null}`): existing page tests keep testing the live path; static behaviour tested with explicit mocks | The rarely-run live path does not rot |

## Round 3 — after verifying the fixes (2026-10-24)

A verification workflow (one agent per earlier finding plus a regression hunter) confirmed all 18
fixes of the second round and found five regressions and some leftovers. Decisions:

| Topic | Decision | Why |
| --- | --- | --- |
| Overpass side of the privacy invariant | `useAround` too decides from the rounded centre: its effect depends on it, a saved answer counts only if it holds the radius + rounding reach around it, the retry count is per rounded place | Whether a request goes out no longer depends on where inside the ~100 m cell the user stands; GPS jitter neither cancels nor repeats a search |
| Automatic tries | Every static failure (index or leaf, network or server error) is tried again by itself 30 s, 1 min, 2 min later; **one try per failure** (a try still running is not counted as a new failure); none while hidden or offline; at once on `online`; a failure belongs to its place | One 503 no longer keeps a visit on Overpass; a locked phone no longer fires all tries at once; a reconnect no longer spends a slot (Chromium renders the `online` store change before the handler's state) |
| Handing over | „Spróbuj ponownie” retries both sides after an index failure; a READY Overpass list stays on screen for the same place until the app's data is ready | The button could only re-ask Overpass; the list vanished when the index came back |
| Slow links | Deadline for the headers only (10 s index, 20 s leaf), then 10 s of silence ends a body; error bodies are not read | A 10 km view on EDGE (~250 kB) used to be cut and restarted forever |
| Border band | Coverage from the rounded circle + reach may say „partial” while the exact circle is complete: then the app's state is shown as ready (Overpass is still asked — the privacy rule) | No Overpass error, countdown or „Szukam…” over a complete list |
| Progress and credit | „Na razie: N … w promieniu R” counts only within R (floored); the credit follows what is on screen: „stan z …” for the app's data, „z serwera Overpass” for Overpass's (fresh or saved) | The note overstated; „na żywo” stood next to a days-old saved answer |
| Service worker | Navigation denylist relative to the worker's scope (privacy.html with a query, `data/`); `LICENSE.txt` cached beside the index | Works under any base path; the licence opens offline after one view |
| First visit | Shared `src/swWarm.ts`: products database, the shop chunk (its address from `import.meta.url`) and the OSM files fetched before the takeover are fetched again through the worker | Products and „Zjedz teraz” menus were missing offline after a first visit |
| Data completeness | The refresh lists the extract's objects that themselves match and compares them with the rows (same keep-rule); more than 50 missing fails the refresh, 1–50 warns (also as GitHub annotations); osmium's geometry errors are only context | Errors were counted for objects that were not missing, and some losses printed no error at all |
| Leaves at once | At most 8 leaf requests on their way, nearest first; a slot is not held during the retry pause | Beyond 6 per host a browser on HTTP/1.1 queues requests with their header deadline already running: on EDGE 9 of 34 leaves were cut and fetched again |
| Relations osmium does not build | Matching `site`/`building` relations become rows at the bbox centre of their member nodes and member ways' nodes — Overpass's `out center` (member relations count for nothing there either); a relation already represented by a member row of the same kind and label (brand, else name) is skipped | 3 places were missing from the copy (now 99,147 rows, the known gap empty); the Makro hall in Sosnowiec stays one pin, not two |

A second adversarial review of round 3 (7 lenses; every finding then given to a reproducer and a
skeptic) confirmed 19 findings, all reproduced. Decisions from it:

| Topic | Decision | Why |
| --- | --- | --- |
| Retry after a stall | A URL whose request failed on its way is fetched next with `cache: 'reload'` (the in-load retry, a later automatic try, the button, the index too) until it succeeds; first requests and the first-visit re-fetch keep the default mode | Chromium joins a default-mode request to the HTTP-cache entry the service worker's stalled fetch is still writing: retries never reached the server for minutes |
| Products after places | „Zjedz teraz” asks for the products database only once the places are in (`useDataset(enabled)`), and the database is fetched at priority `low`; „Zakupy i przepisy” still loads it at once | On a slow link the 3.3 MB went first and the 9 kB index and the leaves queued behind it; in Chromium `priority: 'high'` alone is the default and gave nothing |
| Words while the products load or fail | „Wczytuję produkty sklepów…” instead of counting chain shops as without menu; „Nie udało się wczytać produktów sklepów.” / „…menu sieci.” with „Spróbuj ponownie”; „Na razie” counts the places with a menu so far | The status line is read out: counts that change by themselves after the page looks finished, or advice to widen the radius that cannot help, were wrong |
| Border words from both sides | When the Polish side itself failed, the page shows the app's own failure words; „po polskiej stronie” only while that side is on screen; the stale-data and older-version notes also at the border | The notes claimed a Polish side that had not loaded |
| Hold only this place's answer | The ready Overpass answer held while the app's data comes back must be one fetched for the current rounded place (`useAround` returns `readyHere`); an empty answer counts too | Right after a move the previous place's answer started a new Overpass search — or not, by where in the cell the user stood; an empty answer is genuine (same rules, same map) |
| Reset leaves no trail | „Usuń wszystkie dane” forgets the first visit's queued re-fetches and the in-memory leaves, and sweeps `gt-osm` and its expiration rows again once the leaves still on their way have landed | The worker saved the viewed area right after the reset |
| Pipeline log | A relation `type` from the map is one line before it is printed | A line break in it could inject a GitHub Actions workflow command |

## Not done now

- Request caps per hour and holding a stale saved position while GPS locates (abroad only; little gain).
- live-lean's IndexedDB tile store, CSV/streamed parts and hedging (only if abroad speed becomes the complaint).
- Background download of all of Poland on Wi-Fi (~3 MB) for offline everywhere; per-country extracts.

## Checked

End-to-end in Chromium (Playwright, 360 px, the built app with the real data; Overpass and map
tiles blocked unless said):

| Case | Result |
| --- | --- |
| Warsaw 1 km, cold, "4G" (50 ms, 15 Mbit/s) | answer **0.27 s** after the status line says „Szukam lokali” (1.26 s from opening the page, app start included); 5 files, **52 kB on the wire** + the index 9.4 kB (round 3 re-measured with CDP `encodedDataLength`; the first run's „90 kB” was not wire bytes); **0 Overpass requests**; switching to „Zakupy i przepisy” loads nothing new (73 shops with data) |
| Same, "slow" (300 ms, 2 Mbit/s, CPU ×4) | **1.8 s** after „Szukam” (7.1 s from opening, mostly the app start) |
| Warm (service worker) | 0.6 s from opening the page |
| Kraków 1 km / Warsaw 10 km | 9 files, 55 kB, 1.3 s / 34 files, 265 kB, 1.8–1.9 s from opening (0.83–0.89 s after „Szukam”) |
| Warsaw 10 km on "EDGE" (400 ms, 200 kbit/s) | before round 3: 9 of 34 files cut by the header deadline while queued (HTTP/1.1, 6 connections) and fetched again; with 8 files at a time: **none cut or repeated**, ~28 s after „Szukam” (the link shared with the 3 MB products database) |
| Offline | an area seen before works offline — also right after the very first visit (files fetched before the service worker took over are fetched again through it); a new area says „Bez internetu nie mam jeszcze danych tej okolicy — pobiorę je, gdy wróci połączenie.” and loads at once when the connection is back |
| Berlin | one Overpass request; credit „… · z serwera Overpass” (round 3 wording; was „na żywo z serwera Overpass”) |
| Słubice 10 km | 2 files + 1 Overpass request; credit „… stan z 22 października 2026” while the Polish side is shown, „… · z serwera Overpass” once Overpass's whole circle is (round 3 wording) |
| Open popup, 34 files arriving on the slow profile | stays open |
| Data-only rebuild (one row removed) | `dist/assets` and `sw.js` byte-identical; one leaf file renamed |
| Build | 587 leaves (depths 6–12), median 4.1 kB, p90 10.8 kB, max 14.5 kB, 3.04 MB in all; index 20.6 kB (9.4 kB gzipped); +1 s build time |

Before: the same Warsaw circle took 3–35 s from Overpass (462 kB), or failed with 502.
