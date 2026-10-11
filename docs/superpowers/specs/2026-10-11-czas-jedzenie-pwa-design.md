# Session clock, session flow, food (Produkty PL) and PWA rebuild — design

Date: 2026-10-11 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away — plan it out and then finish on your own").

## Requests

1. A clock that runs from the start of a workout to its end, shown in the top bar of the workout
   view. It should show how much time passes between finishing one exercise and starting the
   next, and how long a workout really takes. New achievements that measure time spent training.
2. A workout should run as a session: exercise after exercise, with time measured.
3. Bring every feature of `~/Projects/produkty-pl` into the gym tracker, fitted to its design.
   Analyse both projects and rebuild the gym tracker's structure with UI/UX best practice so the
   products fit in.
4. The gym tracker should use `vite-plugin-pwa` with its own service worker (`injectManifest`)
   and the best current technology.

## What exists (analysis)

### Gym tracker (this repo)

- React 18, Vite 5, TypeScript 5.6, Vitest 2; one global `styles.css` with design tokens
  (`--bg`, `--surface`, `--ink`, accents `--c-orange/blue/green/gold` with `-ink` text variants,
  Oswald + IBM Plex Sans from Google Fonts). Hash routes (`#/sesja`, …) because GitHub Pages is
  static; `base: './'`.
- Five bottom tabs: Dziś · Treningi (+ atlas section) · Plan · Osiągnięcia · Profil. Settings in
  the app bar. Sticky `TopBar` with title/subtitle; in a session it shows the workout name and
  "Seria 3 z 18".
- State: one JSON `AppState` in `localStorage` (`kb-trener-v3`), saved via `queueSave`.
  `App.tsx` owns all mutations (`clone` → mutate → `commit`).
- Guided session (`Guided.tsx`) already goes set by set: readiness + warm-up → "Zaczynam" → set
  panel → rest countdown (stored as an absolute `until`) → next set; effort asked after an
  exercise's last set. Blocks (`blocks.ts`): straight sets, pairs (A/B alternating) and circuits.
  `Session.started` exists, but nothing measures duration, per-exercise time or the gaps between
  exercises. `LogEntry` stores only the finish `date`.
- Achievements: `badges.ts` families with tiers, grouped (`dorobek`, `partie`, `szczyty`,
  `utrzymanie`, `przekaski`, `cardio`, `terminy`, `cwiczenia`), values from `metrics.ts`.
- PWA: hand-written `public/sw.js` (network-first page, cache-first assets, fonts SWR, Web Push
  handlers) patched after build by `scripts/precache.mjs`; registered in `main.tsx` with
  immediate `skipWaiting`. Static `public/manifest.webmanifest`.
- Body data the food side also needs: daily weigh-ins (`state.body`), height (`cfg.height`),
  steps (manual `cardio` entries + Garmin `watch`), workouts and their kcal (`burn.ts`).

### Produkty PL (`~/Projects/produkty-pl`)

- React 19, Vite 8, TS 6, Vitest 5, Tailwind 4, `vite-plugin-pwa` 2 (generateSW), Dexie, Leaflet,
  lucide-react, fflate. Path routes (`/`, `/przepisy`, `/w-poblizu`, `/dieta`) and per-page state
  in the query string (`useUrlState`). Pure logic in `lib/`, `recipes/`, `nearby/`, `diet/`
  (well tested); components only display.
- Four features: product browser (≈29 k Polish products from Open Food Facts, prices from Open
  Prices; filters, facets, sort, cards/table, detail), high-protein recipes (shop-resolved
  ingredients, swaps, tiers, ready products), "W pobliżu" (geolocation + Overpass shops on a
  Leaflet map → recipes doable in one nearby shop), "Dieta" (profile + energy model, diet
  profiles, food log, Excel plan import, suggestions, swaps, progress/forecast; Dexie DB
  `produkty-pl-dieta`).
- Dataset `public/data/products.json` is 24.6 MB (3.26 MB gzipped) and **not in git**; the site
  was deployed from a laptop. The diet keeps its own weight and steps per day.
- Same origin as the gym tracker (`aleksanderdudek.github.io`), so its IndexedDB and
  `localStorage` (`produkty-pl:*`) are readable from the gym tracker.

## Decisions

### 1–2. Session clock and the session flow

| Topic | Decision | Why |
| --- | --- | --- |
| Unit of "exercise after exercise" | The **part** (część) = one block: a straight-sets exercise, a pair, or a circuit | Pairs and circuits interleave exercises by design; timing them per exercise would invent numbers |
| Clock start | Guided view: the "Zaczynam" tap (after readiness and warm-up). List view: the session start | "From the start of the training"; the first moment the person actually begins |
| Part start | Explicit **"Start: <name>"** on a transition card between parts; the first part starts with "Zaczynam" | The gap between exercises (walking to the rack, loading plates) is only measurable if the next exercise's start is a moment the person marks; one tap per exercise is the price the request asks for |
| Part end | The moment the last set of the part is logged, or its remaining exercises are skipped | The last "Zrobione" is when the work ended |
| Transition | `next.start − previous.end`, counted up live on the transition card next to the recommended rest countdown (kind `next`), which keeps its beep | The number the user asked for, next to what the plan recommends |
| Rest inside a part | Unchanged (set rests, pair 75 s, circuit moves and round rests) | Already evidence-based; only the part boundary changes |
| Display | Elapsed time pill in the app bar during a session (`role="timer"`, tabular figures, updates every second only while visible); subtitle keeps "Część 2 z 6 · seria 3 z 18". In-content strip shows parts done/current/next and time on the current part | Requested placement; the bar is visible on every session screen |
| Toggle | `cfg.clock` (default on) — switch in Settings and on the session start screen. Hiding the pill does not stop measuring | "Can be switched on"; the numbers behind achievements must not depend on a display preference |
| Pause | None | A real workout includes interruptions; "how long it really takes" |
| Outliers | Durations under 3 min or over 4 h are stored but excluded from time stats and achievements | A forgotten "Zamknij trening" must not produce a 14-hour workout record |
| Storage | `Session.clock = { begin: ms; parts: Record<blockNo, { start?: ms; end?: ms }> }`; `LogEntry.time = { secs; parts: { block; ex: ExerciseId[]; at: secsFromBegin; secs }[] }` (parts without a start — list view — have no `at`/transition) | Absolute instants survive reloads and a locked phone (same as `rest.until`); the log keeps compact seconds |
| Summary | Finish dialog adds "Czas: 52 min · ćwiczenia 41 min · przejścia 11 min · najdłuższe przejście 3:40 przed …". History in the profile shows each workout's duration and its timeline. Workout preview shows "Twój średni czas: …" from the last timed sessions next to the estimate | The number is useful where decisions are made: planning the next workout |
| Share card | "52 min" line added to the session share subject when timed | Small, free |

**Achievements** — new group `czas` ("Czas na treningu"), values from timed log entries only
(3 min – 4 h):

| id | Name | Value | Tiers |
| --- | --- | --- | --- |
| `czas-suma` | Godziny na treningu | total minutes | 60, 300, 600, 1 500, 3 000, 6 000, 15 000, 30 000 (shown as hours) |
| `czas-tydzien` | Dwie godziny w tygodniu | Mon–Sun weeks with ≥ 120 min of training | 1, 4, 12, 26, 52, 104 |
| `czas-plynnie` | Bez przestojów | timed workouts with ≥ 3 parts where every transition was ≤ 4 min | 1, 5, 15, 30, 60, 100 |
| `czas-rekord` | Najdłuższy trening | longest single workout, minutes | 30, 45, 60, 90, 120 |

No achievement rewards a *short* workout: in strength training rest is not a lever (see
`rests.ts`); rewarding speed would push people to cut rests. Smooth transitions are the only
"speed" rewarded — that is time nobody prescribed.

### 3. Food inside the gym tracker

**Information architecture** (Material 3 and Apple HIG: 3–5 bottom destinations):

| Bottom tab | Sections (top switch) / subpages | Was |
| --- | --- | --- |
| Dziś `#/sesja` | today's workout or session, weigh-in, **food card** (kcal and protein vs goal, "Dodaj zjedzone"), snacks, cardio | Dziś |
| Trening | **Plan** `#/plan` · **Treningi** `#/treningi` · **Ćwiczenia** `#/cwiczenia` | Treningi + Plan tabs |
| Jedzenie | **Dziennik** `#/jedzenie` · **Przepisy** `#/przepisy` · **Produkty** `#/produkty` · **W pobliżu** `#/w-poblizu`; subpages `#/jedzenie/plan`, `#/jedzenie/postep`, `#/jedzenie/profil` (back arrow) | new (Produkty PL) |
| Osiągnięcia | unchanged (+ group "Czas na treningu") | same |
| Profil | unchanged | same |

- Plan joins Treningi: both answer "what do I train"; today's due workout is already on Dziś.
  That frees the slot for Jedzenie without a sixth tab (below the 44 px target at 320 px).
- Each tab remembers its last section (iOS-style per-tab stack); first visit: Trening → Plan when
  a plan runs, else Treningi; Jedzenie → Dziennik.
- The diet's four inner tabs (Dziś/Plan/Postęp/Profil) become the Dziennik root plus three
  drill-down subpages — no second row of tabs under the section switch.
- Page state stays in the address, inside the hash: `#/produkty?q=skyr&ns=a`. Typing replaces the
  history entry; opening a product pushes one (Back closes the sheet), as in Produkty PL.
  The router compares paths without the query, so filters don't count as navigation.

**Design**: one design system. The Tailwind markup is rewritten with the gym tracker's tokens and
primitives (`.grp`, `.btn`, `.fld`, `.seg`, `.chip`, `.hint`, `.sect-switch`, bottom-sheet
dialogs) in `src/food/food.css`, loaded with the food chunk. The 640 px column applies: filters
always open in a bottom sheet (no desktop sidebar); the table view scrolls sideways. Nutri-Score,
NOVA and Eco-Score keep their official colours (they are standards, not decoration). Icons:
`lucide-react` (same 24 px stroke grid as the app's own icons), only inside food screens.

**Code layout**: `src/food/{lib,recipes,nearby,diet,hooks,components}` — the pure modules move
as they are (with their tests, reformatted to the repo style: semicolons, no `.ts` import
suffixes); components are rewritten. The whole food area is lazy-loaded (`React.lazy`) — gym
screens never load or run Leaflet, Dexie or the dataset code. (The service worker precaches every
chunk for offline use, so the bytes are on the device after install; nothing on a gym screen
imports them.)

**Dataset**: `data/food/products.json.gz` (3.3 MB) is committed — CI builds from git, and the
gzip is a tenth of the JSON. A Vite plugin (`vite/foodData.ts`) emits it as
`data/products.<sha12>.json.gz` and exposes `virtual:food-data` `{ url, version, generatedAt }`;
dev serves the same file from middleware. The browser fetches the gzip and inflates it with
`DecompressionStream` (fflate fallback); a gzip magic-byte check also accepts a server that
already decoded it. The content-hashed name replaces Produkty PL's `manifest.json` + `?v=`
(cache-first forever, one copy kept). The dataset is fetched only when a food screen needs it —
unlike the code chunks it is left out of the precache (`globIgnores: ['data/**']`).
The data pipeline (`scripts/food/*`, `npm run food:data`) moves too; raw inputs stay out of git.

**One body, one source of truth** — the gym tracker's records:

| Diet needs | Source after the merge |
| --- | --- |
| Weight per day | `state.body` (weigh-ins). The diet's weight field writes through the app's `setWeight`; reads merge `state.body` over the diet's own `DayRow.weightKg` (older entries) |
| Steps per day | Gym tracker steps (manual entry or Garmin) for the day, falling back to the diet's own `DayRow.steps`; the diet's steps field writes a gym tracker steps entry (so it counts for cardio badges and XP like any other) |
| Height | `cfg.height`; the diet profile edits it in place |
| Training that day | From the workout log (read-only); "Ruch dziś" line shows workout + cardio kcal from `burn.ts` as information — not added to the calorie goal (the activity multiplier already assumes training; adding it would count twice) |

- Weigh-ins found in the diet DB (old Produkty PL data, a restored diet backup or an imported
  Excel plan) are moved into `state.body` on every entry into the food area: days without a gym
  tracker weigh-in take the diet's value, days with one keep the gym value. Once the gym state is
  saved, every weigh-in is removed from the diet DB — weight has one source, and a weigh-in deleted
  in the profile does not come back from the diet's copy. A failed save leaves them for next time.
- The diet DB keeps its name `produkty-pl-dieta` (same origin: existing Produkty PL data appears
  automatically) and `produkty-pl:*` `localStorage` keys for position/radius/shop cache.
- Backup is one file: Settings → Eksport writes `AppState` plus `diet` (the diet backup) whenever
  the diet DB holds anything — decided by its content, not by the `gt:diet` flag; an unreadable DB
  still exports the training data, with a toast saying the food diary is missing. Import restores
  both; "Usuń wszystkie dane" clears both, plus the saved shop position and the `osm-tiles` and
  `off-images` caches (tiles reveal which areas were viewed). The diet's own backup buttons stay
  under Profil diety → Twoje dane.

### 4. Toolchain and PWA

| Topic | Decision | Why |
| --- | --- | --- |
| Versions | React 19, Vite 8, `@vitejs/plugin-react` 6, Vitest 5, TypeScript 6, `vite-plugin-pwa` 2, Workbox 7, npm (lockfile kept) | Same stack Produkty PL already runs on; current majors |
| Service worker | `strategies: 'injectManifest'`, `src/sw.ts` (TypeScript, Workbox modules): precache of the shell (JS, CSS, HTML, icons, fonts, manifest) with `cleanupOutdatedCaches`; navigation → precached `index.html`; dataset gzip cache-first (1 entry); Open Food Facts images cache-first (400 / 30 days); OSM tiles cache-first (500 / 7 days, only tiles viewed); Overpass and the app server network-only; Web Push + notification click ported unchanged | Precache gives offline from the first visit without the post-build patch script; one TypeScript file for every rule |
| Updates | `registerType: 'prompt'`: the new version waits; a bar "Nowa wersja aplikacji — Odśwież" appears, **never during a running session** (it waits for the session to close). Update check on start, on return to the app and hourly. Registered in `main.tsx` outside React (`src/pwa.ts`), before the first render; a root error boundary (`RootBoundary`) shows "Coś poszło nie tak" and asks for a newer version, and its "Odśwież" sends `SKIP_WAITING` to a waiting (or installing) version before reloading | A reload in the middle of a set or in a shop loses the place; old chunks stay valid until the user agrees. Navigation is served from the precache, so a release that crashes on start would otherwise survive every redeploy until the app is fully closed |
| Manifest | Generated by the plugin (one source): existing icons, `start_url ./#/sesja`, shortcuts Przekąska, Jedzenie dziś, Przepisy, Sklepy w pobliżu | `public/manifest.webmanifest` and `scripts/precache.mjs` removed |
| Fonts | Self-hosted with `@fontsource` (Oswald 500/600, IBM Plex Sans 400/500/600, latin + latin-ext), precached | Offline from the first visit, no third-party request (GDPR), share images get the real fonts |
| CSP | Build-time `<meta>` CSP: `default-src 'self'`; images from OFF, OSM tiles, YouTube thumbnails; connect to Overpass, OFF images, OSM tiles and `VITE_API_URL`'s origin; frames from YouTube (nocookie); `style-src 'self' 'unsafe-inline'` (Leaflet and share images) | Same hardening Produkty PL had, extended to the gym tracker's origins; a test checks every `https://` origin used in `src` is allowed |
| Lint | `oxlint` added as `npm run lint` | Fast, zero-config, already used by Produkty PL |

## Error handling

- Render crash anywhere outside the food tab → root error boundary: a bare static screen (no app
  state), an update check, and "Odśwież" that activates a waiting fixed version. Storage is never
  cleared. The food tab keeps its own boundary (`LoadBoundary`) so the rest of the app stays.
- Dataset missing at build → `virtual:food-data` has `url: null`; food screens show
  "Dane produktów nie są dołączone do tej wersji". Fetch/inflate/parse failure → retry button.
- Overpass failures keep Produkty PL's behaviour (fallback server, cached day, honest status).
- Clock: a reload restores everything from `session.clock`; a missing part start (list view)
  yields no transition, never a negative one; clocks with `end < start` are ignored.
- Storage: diet writes stay in IndexedDB; gym state keeps the existing save-broken banner.

## Testing

- Pure engine: `clock.ts` (starts, ends, undo, skip, timeline, transitions, outliers),
  time metrics and the four families, routing (new tabs, sections, hash query), food data URL
  and gzip/plain detection, bridge merging (weights, steps, height), all ported Produkty PL
  logic tests (filters, sort, URL state, recipes, nearby, diet).
- Components: ported page tests under jsdom (`@vitest-environment jsdom`), adapted to the new
  markup through roles and labels.
- Build: `npm run build` produces `sw.js` with a precache manifest, the hashed dataset and the
  CSP; preview checked in a browser (offline reload, update prompt, push handlers present).

## Out of scope

- Moving diet data from IndexedDB into `AppState` (it is large and per-day; the bridge is enough).
- A server-side dataset or API; scanning barcodes with the camera.
- Pausing the session clock.
