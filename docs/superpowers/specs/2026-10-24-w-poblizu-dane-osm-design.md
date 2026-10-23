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
| Source in Poland | The app's own copy of OSM data for **both views**; no Overpass request at all | The only way the first answer in a new place stops depending on overloaded volunteer servers; complete counts („bez danych”, „i N innych”) at once; works offline for areas seen |
| Source abroad / at the border | Overpass as before (pauses, retries, saved answers), **one union query and one cache for both views**; at the border the Polish side at once and the rest live | Abroad cannot be prebuilt for every country; one question serves both views |
| Data in the repo | `data/osm/places-pl.tsv` (sorted raw tags, 9 columns, centre of each object) + `meta.json`, from `npm run food:osm` (Geofabrik extract → osmium tags-filter → export → normaliser) | Text with sorted rows gives small git deltas on refresh; no chain or menu matching in the data, so new chains never need a data rebuild |
| One rule | `src/food/nearby/osmTags.ts` (no imports) defines which objects count; queries, parsers, the osmium filter and the script all use it; golden test of the query strings | Poland (copy) and abroad (Overpass) can never disagree |
| Build | `vite/osmPlaces.ts` cuts the TSV into gzipped leaves named by content hash under `data/osm/v1/t/`, an index at a fixed URL and `LICENSE.txt`; `virtual:osm-places` gives only the index URL | A data-only deploy changes no JS and no `sw.js`: no update prompt; unchanged cells keep their URL and stay cached |
| Which cells a position asks for | Chosen from the position **rounded to 0.001°** with radius + ~85 m; what is complete measured from the exact position on the device | The server learns no more than Overpass did (the rounded circle); privacy invariant tested |
| Cell size | At most 500 places, depth ≤ 12 (finest ≈ 0.57 × 0.73 km) | Small files in cities, few files in the countryside |
| Caching | SW: leaves CacheFirst (`gt-osm`, 400 entries, 90 days, purge on quota), index StaleWhileRevalidate; memory LRU of 40 decoded leaves; one request per leaf however many ask | Instant on return; bounded trail of viewed areas |
| New data version | A leaf 404 re-reads the index past the SW and selects again; offline, an older cached version of the same cell is used and said so | A deploy never leaves a known area empty |
| Loading | The page asks at mount, before the products gate, nearest leaves first, never aborted, rendered in 30 ms batches; „na razie: N miejsc w promieniu …” while incomplete | The answer appears in a fraction of a second, without the map flickering |
| Map | An open popup survives pin redraws (`popupKeeper`) | Data now arrives in pieces |
| Live etiquette | 429/406 → 30 s pause per server; no request while offline, retry on `online` | Kinder to the servers; faster recovery |
| Refresh | `npm run food:osm` locally; the "Dane OSM" GitHub workflow is **manual (workflow_dispatch) only**, with a commented weekly schedule | A weekly bot committing to `main` would change how the owner pushes (`pull --rebase` first); the owner can enable it with one line |
| Staleness | Date always in the credit line; a note when data is older than **60 days**; build warning past **45 days** | Manual refresh cadence |
| ODbL | Credit „© autorzy OpenStreetMap · licencja ODbL · stan z …” in both views; `LICENSE.txt` beside the leaves; `data/osm/README.md` offers the whole database and the script in the public repo | Attribution and the offer of the derived database |
| Reset | „Usuń dane jedzenia” also clears `gt-osm`, `produkty-pl:osm` and the legacy `produkty-pl:places` (missing before) | No forgotten trail |
| Tests | The static layer is off under Vitest (`virtual:osm-places` → `{index:null}`): existing page tests keep testing the live path; static behaviour tested with explicit mocks | The rarely-run live path does not rot |

## Not done now

- Request caps per hour and holding a stale saved position while GPS locates (abroad only; little gain).
- live-lean's IndexedDB tile store, CSV/streamed parts and hedging (only if abroad speed becomes the complaint).
- Background download of all of Poland on Wi-Fi (~3 MB) for offline everywhere; per-country extracts.

## Checked

End-to-end in Chromium (Playwright, 360 px, the built app with the real data; Overpass and map
tiles blocked unless said):

| Case | Result |
| --- | --- |
| Warsaw 1 km, cold, "4G" (50 ms, 15 Mbit/s) | answer **0.29 s** after the status line says „Szukam lokali” (1.2 s from opening the page, app start included); 5 files, 90 kB; **0 Overpass requests**; switching to „Zakupy i przepisy” loads nothing new (73 shops with data) |
| Same, "slow" (300 ms, 2 Mbit/s, CPU ×4) | **2.0 s** after „Szukam” (7.4 s from opening, mostly the app start) |
| Warm (service worker) | 0.6 s from opening the page |
| Kraków 1 km / Warsaw 10 km | 9 files, 89 kB, 1.2 s / 34 files, 391 kB, 1.9 s from opening |
| Offline | an area seen before works offline — also right after the very first visit (files fetched before the service worker took over are fetched again through it); a new area says „Bez internetu nie mam jeszcze danych tej okolicy — pobiorę je, gdy wróci połączenie.” and loads at once when the connection is back |
| Berlin | one Overpass request; credit „na żywo z serwera Overpass” |
| Słubice 10 km | 2 files + 1 Overpass request; credit „… stan z 22 października 2026 · przy granicy na żywo z serwera Overpass” |
| Open popup, 34 files arriving on the slow profile | stays open |
| Data-only rebuild (one row removed) | `dist/assets` and `sw.js` byte-identical; one leaf file renamed |
| Build | 587 leaves (depths 6–12), median 4.1 kB, p90 10.8 kB, max 14.5 kB, 3.04 MB in all; index 20.6 kB (9.4 kB gzipped); +1 s build time |

Before: the same Warsaw circle took 3–35 s from Overpass (462 kB), or failed with 502.
