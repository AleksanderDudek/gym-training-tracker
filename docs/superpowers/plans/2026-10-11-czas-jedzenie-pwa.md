# Session clock, food (Produkty PL) and PWA rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure workouts part by part with a clock in the top bar (plus time achievements),
move every Produkty PL feature into the gym tracker as a "Jedzenie" tab in the app's own design,
and rebuild the toolchain on React 19 / Vite 8 with `vite-plugin-pwa` `injectManifest`.

**Architecture:** Spec: `docs/superpowers/specs/2026-10-11-czas-jedzenie-pwa-design.md` (read it
first — decisions are not repeated here). Gym logic stays in pure `src/engine/*` modules mutated
on a cloned `AppState` in `App.tsx`. Food lives in `src/food/**` (pure modules ported from
`~/Projects/produkty-pl/src`, components rewritten in the gym tracker's design system), loaded
lazily, talking to gym data only through `src/food/bridge.ts`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 5 (+ jsdom, Testing Library,
fake-indexeddb), vite-plugin-pwa 2 + Workbox 7, Dexie 4, Leaflet 1.9, lucide-react, fflate,
@fontsource, oxlint. Package manager: **npm** (keep `package-lock.json`).

## Conventions every task follows

- Branch: `feat/czas-jedzenie-pwa` (already created). Commit messages in Polish, conventional
  prefix (`feat:`, `fix:`, `chore:`, `docs:`, `test:`), ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- New gym-tracker code: Polish comments in the existing tone, semicolons, single quotes, 2 spaces,
  trailing commas, ~120 columns. UI copy in Polish. Ported Produkty PL modules keep their English
  comments but are reformatted to this style (`npx prettier@3 --write --semi --single-quote
  --trailing-comma all --print-width 120 <files>` — no config file is added).
- Relative imports without `.ts`/`.tsx` suffixes.
- Gates before every commit: `npm run typecheck` and `npm test` green (and `npm run build` from
  Task 1.3 on). Never commit with failing tests.
- Do not touch `~/Projects/produkty-pl` (read only).

## File map

| Path | Responsibility |
| --- | --- |
| `vite.config.ts` | React, PWA (injectManifest + manifest), CSP, food data plugin, Vitest |
| `vite/csp.ts` | CSP string builder + `transformIndexHtml` plugin |
| `vite/foodData.ts` | emits `data/products.<sha12>.json.gz`, `virtual:food-data`, dev middleware |
| `src/sw.ts`, `tsconfig.sw.json` | the service worker (precache, routes, push) |
| `src/components/UpdateBar.tsx` | "Nowa wersja — Odśwież" (prompt update) |
| `src/engine/clock.ts` (+ test) | session clock: begin, parts, ends, timeline, stats |
| `src/components/SessionClock.tsx` | the app-bar pill and part strip |
| `src/components/Guided.tsx` | transition card between parts |
| `src/engine/metrics.ts`, `src/engine/badges.ts` | time metrics, group `czas` |
| `src/routing.ts` (+ test) | tabs Dziś · Trening · Jedzenie · Osiągnięcia · Profil, sections, hash query |
| `src/components/Sections.tsx` | section switch reused by Trening and Jedzenie |
| `src/food/{lib,recipes,nearby,diet}/**` | ported pure modules + tests |
| `src/food/hooks/**` | dataset loader, hash URL state, diet live queries, geolocation, shops |
| `src/food/bridge.ts` | `GymBridge` context (weights, steps, height, movement, toast) |
| `src/food/diet/body.ts` (+ test) | merge gym weights/steps into diet `DayRow`s; migration |
| `src/food/FoodRoot.tsx` | lazy entry: picks the food page for a route |
| `src/food/components/**`, `src/food/food.css` | rewritten food UI |
| `src/food/TodayFoodCard.tsx` | food card on Dziś |
| `scripts/food/**`, `data/food/products.json.gz` | data pipeline and the committed dataset |

---

## Phase 1 — Toolchain and PWA (sequential, one agent)

### Task 1.1: Upgrade to React 19, Vite 8, Vitest 5, TypeScript 6

**Files:** `package.json`, `package-lock.json`, `tsconfig.json`, any file the compiler flags.

- [ ] **Step 1:** Install:
  ```bash
  npm install react@^19.2 react-dom@^19.2
  npm install -D vite@^8 @vitejs/plugin-react@^6 vitest@^5 typescript@~6.0 @types/react@^19 @types/react-dom@^19 oxlint
  ```
- [ ] **Step 2:** `npm run typecheck`; fix every error (React 19: `useRef<T>()` needs an argument,
  global `JSX` → `React.JSX`/`import type { JSX } from 'react'`, `ReactElement` props default to
  `unknown`; TS 6: drop options it rejects, keep `strict`, `noUncheckedIndexedAccess`). Keep
  behaviour identical — no refactors.
- [ ] **Step 3:** `npm test` — all existing tests green (605+). Vitest 5 may need
  `test.css: true` kept; keep `vitest/config` `defineConfig`.
- [ ] **Step 4:** Add `"lint": "oxlint"` script and `.oxlintrc.json` with plugins
  `react`, `typescript`, `oxc` and rules `react/rules-of-hooks: error`,
  `react/only-export-components: off`. Run `npm run lint`; fix errors only (warnings may stay).
- [ ] **Step 5:** `npm run dev` starts; open `http://localhost:5173/` once (curl the page) to make
  sure it serves. Commit `chore: React 19, Vite 8, Vitest 5 i TypeScript 6`.

### Task 1.2: Self-hosted fonts

**Files:** `index.html`, `src/main.tsx`, `package.json`.

- [ ] **Step 1:** `npm install @fontsource/oswald @fontsource/ibm-plex-sans`.
- [ ] **Step 2:** Remove the three Google Fonts `<link>`s (preconnect ×2 + stylesheet) from
  `index.html`. In `src/main.tsx` before `./styles.css`:
  ```ts
  // Kroje pisma z paczki, nie z Google Fonts: działają offline od pierwszej wizyty, nie wysyłają
  // nikogo do cudzego serwera, a obrazki do udostępnienia dostają prawdziwe litery.
  import '@fontsource/oswald/500.css';
  import '@fontsource/oswald/600.css';
  import '@fontsource/ibm-plex-sans/400.css';
  import '@fontsource/ibm-plex-sans/500.css';
  import '@fontsource/ibm-plex-sans/600.css';
  ```
- [ ] **Step 3:** `npm run build`; confirm `dist/assets/*latin*-500-normal*.woff2` exist. Commit
  `feat: kroje pisma z aplikacji zamiast z Google Fonts`.

### Task 1.3: vite-plugin-pwa with injectManifest, own service worker, CSP

**Files:** create `src/sw.ts`, `tsconfig.sw.json`, `vite/csp.ts`, `src/csp.test.ts`,
`src/components/UpdateBar.tsx`; modify `vite.config.ts`, `src/main.tsx`, `src/App.tsx`,
`package.json` (scripts), `tsconfig.json` (`types` += `vite-plugin-pwa/react`,
`vite-plugin-pwa/client`; exclude `src/sw.ts`), `src/styles.css` (update bar);
delete `public/sw.js`, `public/manifest.webmanifest`, `scripts/precache.mjs`.

- [ ] **Step 1:** `npm install -D vite-plugin-pwa@^2 workbox-window@^7.4 workbox-core@^7.4 workbox-precaching@^7.4 workbox-routing@^7.4 workbox-strategies@^7.4 workbox-expiration@^7.4 workbox-cacheable-response@^7.4`.
- [ ] **Step 2: CSP builder with a failing test.** `vite/csp.ts`:
  ```ts
  /** Origins the app talks to. One list: the CSP and its test read the same thing. */
  export const ORIGINS = {
    img: ['https://images.openfoodfacts.org', 'https://tile.openstreetmap.org', 'https://i.ytimg.com'],
    connect: ['https://overpass-api.de', 'https://overpass.private.coffee', 'https://images.openfoodfacts.org', 'https://tile.openstreetmap.org'],
    frame: ['https://www.youtube-nocookie.com', 'https://www.youtube.com'],
  } as const;

  export function csp(apiUrl?: string): string {
    const api = apiUrl ? new URL(apiUrl).origin : null;
    return [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      `img-src 'self' data: blob: ${ORIGINS.img.join(' ')}`,
      `connect-src 'self' ${[...ORIGINS.connect, ...(api ? [api] : [])].join(' ')}`,
      `frame-src ${ORIGINS.frame.join(' ')}`,
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');
  }
  ```
  plus a `cspPlugin(apiUrl)` Vite plugin (`apply: 'build'`, `transformIndexHtml` inserting
  `<meta http-equiv="Content-Security-Policy" content="…">` right after `<meta charset="utf-8" />`).
  Test `src/csp.test.ts`: every `https://host` literal found in `src/**/*.{ts,tsx}` (excluding
  `*.test.*`, share-target links `wa.me|twitter.com|facebook.com|buycoffee.to|aleksanderdudek.github.io`
  which are navigation, and push endpoint hosts used only in tests) is present in the CSP; the
  API origin is added when given. Run — fails before the module exists, passes after.
- [ ] **Step 3: The service worker** `src/sw.ts`:
  ```ts
  /// <reference lib="webworker" />
  import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
  import { NavigationRoute, registerRoute } from 'workbox-routing';
  import { CacheFirst } from 'workbox-strategies';
  import { ExpirationPlugin } from 'workbox-expiration';
  import { CacheableResponsePlugin } from 'workbox-cacheable-response';

  declare const self: ServiceWorkerGlobalScope;
  ```
  Port the header comment of `public/sw.js` (rewritten for the new strategies), then:
  `precacheAndRoute(self.__WB_MANIFEST)`, `cleanupOutdatedCaches()`,
  `registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))`;
  dataset: `CacheFirst` cache `gt-food-data`, match same-origin `/data/products.` + `.json.gz`,
  `ExpirationPlugin({ maxEntries: 1 })`, `CacheableResponsePlugin({ statuses: [200] })`;
  OFF images `CacheFirst` `off-images` 400 / 30 days; OSM tiles `CacheFirst` `osm-tiles` 500 / 7 days
  (both statuses `[200]`); `self.addEventListener('message', e => e.data?.type === 'SKIP_WAITING' && self.skipWaiting())`;
  `push` and `notificationclick` handlers copied verbatim from `public/sw.js`. No `skipWaiting()`
  on install (prompt mode). `tsconfig.sw.json`: `lib: ["ES2022", "WebWorker"]`, `types: []`,
  `include: ["src/sw.ts"]`, strict. `typecheck` script: `tsc --noEmit && tsc --noEmit -p tsconfig.sw.json`.
- [ ] **Step 4: Plugin config** in `vite.config.ts` (keep `base: './'`):
  ```ts
  VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    registerType: 'prompt',
    injectRegister: false,
    manifest: { /* contents of public/manifest.webmanifest, plus shortcuts:
      Przekąska (./#/przekaski/dodaj), Jedzenie dziś (./#/jedzenie), Przepisy (./#/przepisy),
      Sklepy w pobliżu (./#/w-poblizu), Osiągnięcia (./#/osiagniecia) */ },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', 'assets/*latin*.woff2'],
      globIgnores: ['data/**'],
    },
    devOptions: { enabled: false },
  })
  ```
  and `cspPlugin(process.env.VITE_API_URL)`. `build` script: `npm run typecheck && vite build`.
  Delete `public/sw.js`, `public/manifest.webmanifest`, `scripts/precache.mjs`; remove the
  manifest `<link>` from `index.html` only if the plugin injects one (check built `dist/index.html`).
- [ ] **Step 5: Registration + update bar.** Remove the `navigator.serviceWorker.register` block
  from `main.tsx`. `UpdateBar.tsx` uses `useRegisterSW` from `virtual:pwa-register/react`:
  `onRegisteredSW(url, r)` → `r.update()` hourly (`setInterval`) and on `visibilitychange` to
  visible. Props `{ hold: boolean }` — when `needRefresh && !hold` render a fixed bar above the
  bottom nav: text "Nowa wersja aplikacji." + button "Odśwież" (`updateServiceWorker(true)`) +
  close "Później" (hides until next start). `App.tsx` renders `<UpdateBar hold={!!state.session} />`
  — never during a session. Styles: `.updatebar` in `styles.css` with existing tokens
  (`--steel` background, white text, 44 px targets, `bottom: calc(80px + env(safe-area-inset-bottom))`).
- [ ] **Step 6:** `npm run build` → assert `dist/sw.js` exists, contains `index.html` in its
  precache list and no `self.__WB_MANIFEST`; `dist/index.html` has the CSP meta and a manifest link;
  `dist/manifest.webmanifest` exists. `npm run preview` and load it once (curl) to confirm 200.
  Commit `feat: service worker z vite-plugin-pwa (injectManifest), aktualizacja na żądanie i CSP`.

---

## Phase 2A — Session clock (one agent; may run parallel to Phase 2B in a separate worktree)

### Task 2A.1: Types and the pure clock engine (TDD)

**Files:** modify `src/types.ts`; create `src/engine/clock.ts`, `src/engine/clock.test.ts`.

- [ ] **Step 1: Types** (in `src/types.ts`, with Polish doc comments):
  ```ts
  /** Zegar sesji: start treningu i części (bloki) z początkiem i końcem jako chwile w ms. */
  export interface SessionClock {
    begin: number;
    parts: Record<number, { start?: number; end?: number }>;
  }
  /** Część zapisanego treningu, w sekundach od jego startu. */
  export interface LogTimePart {
    block: number;
    ex: ExerciseId[];
    /** Początek części. Brak — część bez zaznaczonego startu (widok listy). */
    at?: number;
    end: number;
  }
  export interface LogTime {
    /** Cały trening w sekundach: od „Zaczynam” do zamknięcia. */
    secs: number;
    parts: LogTimePart[];
  }
  ```
  `Session.clock?: SessionClock`, `LogEntry.time?: LogTime`, `AppState['cfg'].clock?: boolean`
  (brak = pokazany).
- [ ] **Step 2: Failing tests** `src/engine/clock.test.ts` covering, with a hand-built `Session`
  and `Step[]` (use `sessionSteps` only where convenient):
  - `startClock(s, 1000, 1)` sets `{ begin: 1000, parts: { 1: { start: 1000 } } }`; second call
    is a no-op.
  - `startPart(s, 2, 5000)` sets start; keeps an existing earlier start; creates a clock with
    `begin = now` when missing.
  - `settlePart(s, steps, block, now)`: sets `end` when every exercise of the block is skipped,
    done or has its sets; removes `end` when an undo reopened it; never sets end on a block
    with no start *and* no clock.
  - `waitingPart(s, steps, cursor)` → the cursor's block when the clock exists and that block
    has no start; `null` without a clock, when started, or when `cursor < 0`.
  - `timeOf(s, blocks, now)` → `secs` rounded; parts sorted by `at` then `end`; parts never
    started and never ended are left out; a started, unfinished part ends at `now`; parts with
    `end < start` are dropped; `null` without a clock.
  - `transitions(t)` → gaps between consecutive started parts (`next.at - prev.end`, only ≥ 0).
  - `summary(t)` → `{ secs, work, gaps, longest: { block, ex, secs } | null }`.
  - `timed(t)` true only for 180 ≤ secs ≤ 14 400.
  - `durationText(secs)` → `"45 s"`, `"12 min"`, `"1 h 05 min"`.
- [ ] **Step 3:** Run `npx vitest run src/engine/clock.test.ts` — FAIL (module missing).
- [ ] **Step 4: Implement** `src/engine/clock.ts`:
  ```ts
  import type { Block } from './blocks';
  import { loggedSets } from './steps';
  import type { Step } from './steps';
  import type { LogTime, LogTimePart, Session } from '../types';

  export const TIMED_MIN = 3 * 60;
  export const TIMED_MAX = 4 * 3600;
  /** Przejście do tylu sekund liczy się jako płynne. */
  export const SMOOTH_GAP = 4 * 60;

  export function startClock(s: Session, now: number, firstBlock: number | null): void {
    if (s.clock) return;
    s.clock = { begin: now, parts: firstBlock === null ? {} : { [firstBlock]: { start: now } } };
  }

  export function startPart(s: Session, block: number, now: number): void {
    s.clock ??= { begin: now, parts: {} };
    const p = s.clock.parts[block] ?? {};
    s.clock.parts[block] = { ...p, start: p.start ?? now };
  }

  export const blockDone = (steps: readonly Step[], s: Session, block: number): boolean =>
    steps.filter((st) => st.block === block).every((st) => s.skip[st.ex] || s.done[st.ex] || loggedSets(s, st.ex) >= st.set);

  export function settlePart(s: Session, steps: readonly Step[], block: number, now: number): void {
    if (!s.clock) return;
    const p = s.clock.parts[block] ?? {};
    if (blockDone(steps, s, block)) s.clock.parts[block] = { ...p, end: p.end ?? now };
    else if (p.end !== undefined) {
      const { end: _gone, ...rest } = p;
      s.clock.parts[block] = rest;
    }
  }

  export function waitingPart(s: Session, steps: readonly Step[], cursor: number): number | null {
    if (!s.clock || cursor < 0) return null;
    const block = steps[cursor]!.block;
    return s.clock.parts[block]?.start === undefined ? block : null;
  }

  export function timeOf(s: Session, blocks: readonly Block[], now: number): LogTime | null {
    const c = s.clock;
    if (!c) return null;
    const sec = (ms: number) => Math.max(0, Math.round((ms - c.begin) / 1000));
    const parts: LogTimePart[] = [];
    blocks.forEach((b) => {
      const p = c.parts[b.n];
      if (!p || (p.start === undefined && p.end === undefined)) return;
      const end = p.end ?? now;
      if (p.start !== undefined && end < p.start) return;
      parts.push({ block: b.n, ex: [...b.ids], ...(p.start !== undefined ? { at: sec(p.start) } : {}), end: sec(end) });
    });
    parts.sort((a, b) => (a.at ?? a.end) - (b.at ?? b.end) || a.end - b.end);
    return { secs: sec(now), parts };
  }

  export function transitions(t: LogTime): { block: number; ex: string[]; secs: number }[] {
    const started = t.parts.filter((p) => p.at !== undefined);
    const out: { block: number; ex: string[]; secs: number }[] = [];
    for (let i = 1; i < started.length; i++) {
      const gap = started[i]!.at! - started[i - 1]!.end;
      if (gap >= 0) out.push({ block: started[i]!.block, ex: started[i]!.ex, secs: gap });
    }
    return out;
  }

  export function summary(t: LogTime) {
    const work = t.parts.reduce((n, p) => n + (p.at !== undefined ? p.end - p.at : 0), 0);
    const gaps = transitions(t);
    const longest = gaps.reduce<(typeof gaps)[number] | null>((m, g) => (!m || g.secs > m.secs ? g : m), null);
    return { secs: t.secs, work, gaps: gaps.reduce((n, g) => n + g.secs, 0), longest };
  }

  export const timed = (t: LogTime | undefined): t is LogTime => !!t && t.secs >= TIMED_MIN && t.secs <= TIMED_MAX;

  export function durationText(secs: number): string {
    if (secs < 60) return `${secs} s`;
    const min = Math.round(secs / 60);
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
  }
  ```
  Write Polish doc comments for each export (what and why).
- [ ] **Step 5:** Tests PASS; typecheck. Commit `feat: zegar sesji — start, części, przejścia i podsumowanie czasu`.

### Task 2A.2: Wire the clock into App and the guided session

**Files:** `src/App.tsx`, `src/components/Guided.tsx`, `src/components/SessionClock.tsx` (new),
`src/components/TopBar.tsx`, `src/components/views.tsx` (Settings toggle), `src/styles.css`.

- [ ] **Step 1: App handlers** (all on `clone(state)`, `now = Date.now()`; steps =
  `sessionSteps(state, current)`; blocks = `blocksOf(current.items)`):
  - `beginSession()` (guided "Zaczynam"): `startClock(s, now, steps[cursorOf(steps, s)]?.block ?? null)`.
  - `startNextPart(block)`: `startPart(s, block, now)`; `skipRest(s)`.
  - `logSet`, `undoLastSet`, `skipExercise`, `saveExercise`, `clearExercise`: after the existing
    mutation call `settlePart(s, steps, blockOf(id), now)` where `blockOf` finds the step's block
    for that exercise. In list-view handlers (`saveExercise`, `clearExercise`, `skipExercise`
    when `cfg.view === 'list'`) first `startClock(s, Date.parse(s.started), null)`.
  - `finishSession`: `const time = timeOf(session, blocks, now)`; add `...(time ? { time } : {})`
    to the log entry; confirm dialog adds a line `Czas: <durationText>` when timed; the summary
    dialog adds `Czas: 52 min · ćwiczenia 41 min · przejścia 11 min` and, when present,
    `najdłuższe przejście 3:40 przed <ex names>` (use `formatClock` from `Timer.tsx`); the session
    share subject gets a line `<durationText> na treningu` when `timed(time)`.
  - `restoreExtras`: drop `cfg.clock` unless boolean; drop `session.clock` unless
    `typeof begin === 'number'` and `parts` is an object of `{start?, end?}` numbers.
- [ ] **Step 2: Top bar pill.** `SessionClock.tsx` exports `ClockPill({ begin })`: re-renders every
  1 s while `document.visibilityState === 'visible'` (interval cleared when hidden, resumed on
  `visibilitychange`), shows `formatClock(Math.floor((Date.now() - begin) / 1000))`,
  `role="timer"`, `aria-label="Czas treningu: N min"` (minutes only, so it is not re-announced),
  class `.clock-pill` (tabular-nums, `--surface-2` background, 999px radius, min-height 32 px,
  `--display` font 17 px). `TopBar` gets `clock?: number | null` and renders the pill before the
  feedback button. `App` passes `clock={inSession && state.cfg.clock !== false ? state.session!.clock?.begin ?? null : null}`.
  Subtitle in guided view becomes `Część ${partNo} z ${parts} · seria ${n} z ${total}` once the
  clock exists.
- [ ] **Step 3: Guided flow.** In `GuidedSession`: `begun = !!session.clock || anyLogged`;
  `Start`'s "Zaczynam" calls a new prop `onBegin` (App's `beginSession`) and `unlockSound()`;
  Start also shows the part list (`blocksOf`): "1. Przysiad · 3 × 8", "2. Para: A + B", "3. Obwód:
  5 stacji × 3 rundy", and a checkbox "Pokaż czas treningu w pasku" bound to `cfg.clock`
  (`onClockPref`). `waiting = waitingPart(session, steps, cursor)`; render order:
  `waiting !== null` → `<TransitionPanel>`; else resting → `<RestPanel>`; else `<SetPanel>`.
  `TransitionPanel` shows: heading "Przejście", a count-up since the latest `end` among parts
  (`role="timer"`), the running rest (if any) as "Zalecana przerwa" countdown with bar and
  "+30 s", the next part preview (names with tags, `targetText` per exercise, weight), the
  pending effort questions (move `EffortAsk` rendering above it), and a wide primary button
  `Start: <name>` / `Start: para` / `Start: obwód` → `onStartPart(block)`. Above SetPanel/RestPanel
  render `<PartStrip>` from `SessionClock.tsx`: a row of segments (done / current / upcoming) and
  "Część 2 z 6 · na tym ćwiczeniu 04:12". The end-of-rest beep logic stays as is.
- [ ] **Step 4: Settings.** In `SettingsView` add a switch row "Czas treningu w pasku" (on by
  default) with hint "Liczy się zawsze — przełącznik tylko pokazuje albo chowa licznik." → `onClockPref`.
- [ ] **Step 5:** `npm run typecheck && npm test`; `npm run dev` and walk a session manually is done
  later in Phase 5 with the browser. Commit `feat: czasomierz w pasku i trening część po części z przejściami`.

### Task 2A.3: Time in history, preview and achievements

**Files:** `src/engine/metrics.ts` (+test), `src/engine/badges.ts` (+test), `src/types.ts`
(`AchGroup` += `'czas'`), `src/components/Profile.tsx`, `src/components/Workouts.tsx`.

- [ ] **Step 1: Failing tests** in `metrics.test.ts`: a log with timed entries (`time.secs` 30 min,
  50 min, 2 min (ignored), 5 h (ignored)) gives `metrics(state).time` =
  `{ minutes: 80, timed: 2, longest: 50, smooth: <n>, weeks120: <n> }`; `smooth` counts entries
  with ≥ 3 started parts and every transition ≤ `SMOOTH_GAP`; `weeks120` counts Monday–Sunday
  weeks (local, via `dayKey`) whose timed minutes sum ≥ 120. In `badges.test.ts`: the four
  families exist in group `czas` with the spec's tiers, and `syncBadges` awards `czas-suma:1`
  after 60 timed minutes.
- [ ] **Step 2:** Implement `time` in `Metrics` (helper `timeMetrics(log)` in `metrics.ts`).
- [ ] **Step 3:** Add the four `AchDef`s (spec table) in a `/* ---- Czas na treningu ---- */`
  section after cardio, `fmt` for `czas-suma` and `czas-rekord` (`"5 h"`, `"45 min"`), art from
  `ART_NAMES` (`stopwatch`, `calendarCheck`, `wave`, `hourglass`), Polish `desc` and a dry
  `quip` in the app's tone. `GROUP_LABEL.czas = 'Czas na treningu'`, a `GROUP_NOTE` explaining
  "liczone z treningów z zegarem, od „Zaczynam” do zamknięcia; poniżej 3 minut i ponad 4 godziny
  się nie liczy", add `'czas'` to `GROUPS` after `'cardio'`.
- [ ] **Step 4: Profile history** — each history item shows `durationText(time.secs)` when timed;
  its details list parts: name(s), part duration, and the transition before it.
  **Workout preview** — next to the existing time estimate: "Twój średni czas: X (z N ostatnich)"
  from the last ≤ 5 timed log entries with this `wid`.
- [ ] **Step 5:** Tests + typecheck green. Commit `feat: odznaki czasu na treningu, czas w historii i podglądzie`.

---

## Phase 2B — Food domain port (one agent, worktree; parallel to 2A)

### Task 2B.1: Dependencies, test setup, dataset and data plugin

**Files:** `package.json`, `vite.config.ts`, `vite/foodData.ts`, `src/food/data.ts` (+test),
`src/vite-env.d.ts`, `src/test/setup.ts`, `data/food/products.json.gz`.

- [ ] **Step 1:** `npm install dexie@^4 dexie-react-hooks@^4 leaflet@^1.9 lucide-react fflate@^0.8`
  and `npm install -D @types/leaflet jsdom fake-indexeddb @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event tsx @types/node`.
- [ ] **Step 2:** `mkdir -p data/food && gzip -9 -c ~/Projects/produkty-pl/public/data/products.json > data/food/products.json.gz`.
- [ ] **Step 3: Plugin** `vite/foodData.ts` (`foodData(): Plugin`): reads
  `data/food/products.json.gz` if present; `version` = first 12 hex of sha256 of the gz bytes;
  `generatedAt` = regex `"generatedAt":"([^"]+)"` on the first 200 chars of the gunzipped text
  (`zlib.gunzipSync`); `fileName = data/products.${version}.json.gz`.
  `resolveId/load` for `virtual:food-data` → `export default { url, version, generatedAt }`
  (`url` relative, e.g. `'data/products.abc123def456.json.gz'`, or all `null` when the file is
  missing). `configureServer`: middleware answering `/<fileName>` with the bytes
  (`Content-Type: application/gzip`). `generateBundle`: `this.emitFile({ type: 'asset', fileName, source })`.
  Declare the module in `src/vite-env.d.ts`.
- [ ] **Step 4: Loader, test first.** `src/food/data.ts`:
  `inflate(bytes: Uint8Array): Promise<string>` — gzip magic `1f 8b` → `DecompressionStream('gzip')`
  when available else fflate `gunzipSync`; otherwise decode as UTF-8 (a host that already
  decoded it). `loadDataset(): Promise<{ dataset: Dataset; products: IndexedProduct[] }>` —
  module-level promise cache (one fetch per page life), `fetch(import.meta.env.BASE_URL + url)`,
  `JSON.parse`, `indexProducts(...)`; rejects with Polish messages ("Dane produktów nie są dołączone
  do tej wersji aplikacji.", "Nie udało się pobrać danych produktów (HTTP 404).").
  Tests (node env): gz bytes and plain bytes both inflate to the same text; missing url rejects.
- [ ] **Step 5:** `src/test/setup.ts`: import `@testing-library/jest-dom/vitest`,
  `fake-indexeddb/auto`; when `typeof window !== 'undefined'`: Testing Library `configure({ asyncUtilTimeout: 4000 })`,
  `afterEach(cleanup)`, and the `HTMLDialogElement` shim from Produkty PL's setup.
  `vite.config.ts` test: `setupFiles: ['src/test/setup.ts']`.
- [ ] **Step 6:** Tests green. Commit `feat: dane produktów w repozytorium i wtyczka, która je wydaje`.

### Task 2B.2: Port the pure modules with their tests

**Files:** `src/food/lib/**`, `src/food/recipes/**`, `src/food/nearby/**`, `src/food/diet/**`
from `~/Projects/produkty-pl/src/{lib,recipes,nearby,diet}/**` (all files incl. tests).

- [ ] **Step 1:** Copy the four folders. Strip `.ts`/`.tsx` from relative imports
  (`sed -E -i '' "s#(from '\.{1,2}/[^']+)\.tsx?'#\1'#g"`), fix paths that pointed to `../hooks`
  or `../lib` from their new location, run prettier (conventions above).
- [ ] **Step 2:** `npm run typecheck` — Produkty PL compiled without `strict` and without
  `noUncheckedIndexedAccess`; fix every error properly (narrowing, `?? fallback`, guarded
  indexing). `!` only where the invariant is local and obvious. No behaviour changes.
- [ ] **Step 3:** Test files that render or touch `window`/`localStorage` get
  `// @vitest-environment jsdom` on line 1. `npm test` — all ported tests pass.
- [ ] **Step 4:** Commit `feat: logika produktów, przepisów, sklepów w pobliżu i diety z Produkty PL`.

### Task 2B.3: Hooks and the hash-aware URL state

**Files:** `src/food/hash.ts` (+test), `src/food/hooks/{useUrlState,useViewState,useDataset,useDiet,useGeolocation,useNearbyShops,useDebouncedDraft}.ts` (+ ported tests).

- [ ] **Step 1: Failing tests** `src/food/hash.test.ts` (jsdom): `hashPath('#/produkty?q=a')` →
  `'#/produkty'`; `hashQuery('#/produkty?q=a&ns=b')` → params with q, ns; `hashWith('#/produkty', params)`
  → `'#/produkty?q=a'` or `'#/produkty'` when empty.
- [ ] **Step 2:** Implement `hash.ts`. Port `useUrlState` replacing every `location.search` read
  with `hashQuery(location.hash)` and writes with
  `history.replaceState/pushState(state, '', hashWith(hashPath(location.hash), params))`;
  keep the `DETAIL_ENTRY` back-closing behaviour and the `popstate` listener.
- [ ] **Step 3:** `useDataset` → wraps `loadDataset()` into `{ status: 'loading' | 'error' | 'ready' }`
  with a `retry()`. Port `useDiet`, `useGeolocation`, `useNearbyShops`, `useDebouncedDraft`,
  `useViewState` unchanged except imports. Drop Produkty PL's `useRoute`.
- [ ] **Step 4:** Port the hooks' tests (adapt `useDataset.test` to the new loader by mocking
  `../data`). Green. Commit `feat: stan stron jedzenia w adresie po #, wczytywanie danych i hooki diety`.

### Task 2B.4: Data pipeline scripts

**Files:** `scripts/food/**` from `~/Projects/produkty-pl/scripts/**`; `package.json` scripts;
`.gitignore` (`data/food/raw/`).

- [ ] **Step 1:** Copy scripts (+ `lib/*.test.ts`), keep `.ts` suffix imports *only* if run by
  `tsx` needs them (tsx resolves suffix-less imports — strip them for consistency). Paths:
  raw inputs `data/food/raw/`, output `data/food/products.json.gz` written with
  `zlib.gzipSync(json, { level: 9 })`; no `manifest.json`. `check-recipes.ts` reads the gz.
- [ ] **Step 2:** npm scripts: `food:taxonomies`, `food:prices`, `food:prepare`, `food:data`
  (all three), `food:extract-priced`, `food:check-recipes`. Add `scripts` to `tsconfig.json`
  include only if it typechecks with `types: ["node"]` — otherwise a `tsconfig.scripts.json`
  added to the typecheck script.
- [ ] **Step 3:** `npm run food:check-recipes` runs against the committed gz and prints coverage.
  Tests green. Commit `chore: przygotowanie danych produktów jako skrypty npm`.

---

## Phase 3 — Navigation rebuild and food shell (one agent, after 2A and 2B are merged)

### Task 3.1: Routes, tabs and sections (TDD)

**Files:** `src/types.ts`, `src/routing.ts`, `src/routing.test.ts`, `src/components/icons.tsx`,
`src/components/Sections.tsx`, `src/components/Design.tsx`, `src/components/PlanView.tsx`,
`src/components/Plans.tsx`, `src/App.tsx`, `src/styles.css`.

- [ ] **Step 1: Failing routing tests:**
  - `TABS` keys/labels: `train/Dziś`, `work/Trening`, `food/Jedzenie`, `ach/Osiągnięcia`, `prog/Profil`.
  - `parseHash('#/jedzenie')` → `{ kind: 'food', section: 'diary' }`; `#/przepisy` → recipes;
    `#/produkty?q=skyr` → products (query ignored); `#/w-poblizu` → nearby;
    `#/jedzenie/plan|postep|profil` → `{ kind: 'diet', page: 'plan' | 'progress' | 'profile' }`.
  - `activeTab`: `#/plan`, `#/plany/*`, `#/treningi*`, `#/cwiczenia*` → `work`; all food → `food`.
  - `screenOf`: section roots have `parent: null` and titles Plan / Treningi / Ćwiczenia /
    Jedzenie / Przepisy / Produkty / W pobliżu; diet pages title Plan posiłków / Postęp /
    Profil diety with parent `#/jedzenie`.
  - `tabHref('work')` → last visited section of that tab (full hash incl. query), else `#/plan`
    when `hasPlan` is true, else `#/treningi`; `tabHref('food')` → last or `#/jedzenie`.
  - `isTabRoot` true for all seven section roots.
- [ ] **Step 2:** Implement: `parseHash` and `norm` work on `hashPath`; `useRoute`'s `hashchange`
  handler compares paths without query — same path: only `setRoute`, no trail push, no scroll;
  it records `lastSection[tab] = full old hash` when leaving a section root (kept in memory and
  `sessionStorage` `gt:sections`). New `icons.tsx` icon `food` (apple with a leaf, 24×24 grid,
  same stroke rules). `TABS` path for `work`/`food` resolved at render via `tabHref`.
- [ ] **Step 3: Sections component** `Sections.tsx`: `<nav className="seg sect-switch" aria-label>`
  with `<a aria-current>` items — replace the inline switch in `Design.tsx`; add it to the top of
  `PlanView` (both with and without a running plan) with items Plan / Treningi / Ćwiczenia.
  Existing tab-switch tests/markup keep working.
- [ ] **Step 4:** Tests green; commit `feat: zakładki Dziś · Trening · Jedzenie · Osiągnięcia · Profil i sekcje`.

### Task 3.2: Food shell, bridge and lazy loading

**Files:** `src/food/bridge.ts`, `src/food/diet/body.ts` (+test), `src/food/FoodRoot.tsx`,
`src/food/food.css`, `src/App.tsx`.

- [ ] **Step 1: Bridge** `src/food/bridge.ts`:
  ```ts
  export interface GymBridge {
    weights: readonly { day: string; kg: number }[];
    setWeight(kg: number, day: string): void;
    heightCm: number | null;
    setHeight(cm: number): void;
    stepsOn(day: string): number | null;
    setSteps(day: string, steps: number): void;
    moveOn(day: string): { trained: boolean; workoutKcal: number | null; cardioKcal: number | null };
    toast(message: string): void;
  }
  export const BridgeContext = createContext<GymBridge | null>(null);
  export function useBridge(): GymBridge { /* throws when missing */ }
  ```
- [ ] **Step 2: Failing tests** `src/food/diet/body.test.ts`: `mergeBody(days, bridge)` puts gym
  weight over `DayRow.weightKg` for the same date, adds rows for gym-only dates, uses gym steps
  over `DayRow.steps`, keeps diet values where the gym has none; `weightsToMigrate(dietDays, gymWeights)`
  returns diet weigh-ins on dates the gym lacks, valid range 30–300 kg only.
- [ ] **Step 3:** Implement `body.ts`; make every diet screen/hook that reads `days` read the merged
  rows (one place: the history/day hooks in `useDiet.ts` take an optional merge function — or a
  `useMergedHistory` wrapper — so pure diet modules stay unchanged).
- [ ] **Step 4: App wiring.** `App.tsx`: `const FoodRoot = lazy(() => import('./food/FoodRoot'))`;
  bridge built from state: `weights` = `state.body`, `setWeight` → existing `setBodyWeight` on a
  clone + commit + toast, `heightCm` = `cfg.height ?? null`, `setHeight` → existing `setHeight`,
  `stepsOn` = steps for the day from `cardioOf(state)` (manual + watch, max per day like the app's
  own counting), `setSteps` → existing `logCardio({ kind: 'steps', steps }, day, null)`,
  `moveOn` from the log and `dayBurn(state, day)`. Render
  `<BridgeContext.Provider><Suspense fallback={loading quip}><FoodRoot route={route} /></Suspense></BridgeContext.Provider>`
  for food routes. One-time weight migration on first food render: when `!state.foodMigrated`,
  read `db.days`, apply `weightsToMigrate`, set `state.foodMigrated = dayKey(now)` (new optional
  `AppState` field, validated in `restoreExtras`).
- [ ] **Step 5:** `FoodRoot.tsx` renders `<Sections>` (Dziennik / Przepisy / Produkty / W pobliżu)
  on section roots and a placeholder `<div className="wrap">` per page until Phase 4 replaces them;
  imports `./food.css` (empty file with a header comment for now). Commit
  `feat: zakładka Jedzenie — szkielet, most do danych treningowych i migracja ważeń`.

---

## Phase 4 — Food UI in the gym tracker's design (three agents in parallel, distinct folders)

Rules for all three (read `src/styles.css` tokens and `src/components/ui.tsx` first):
- Rewrite, don't wrap: no Tailwind classes. Use existing primitives (`.wrap`, `.grp`, `.btn`,
  `.btn.ghost`, `.btn.sm`, `.btn.wide`, `.fld`, `.seg`, `.chip(s)`, `.hint`, `.tag`, `.empty`,
  `Segmented`, `EmptyState`, `Modal`) and add area classes prefixed `fd-` in the area's own CSS
  file (`src/food/components/<area>/<area>.css`, imported by the area's page). Colours only from
  tokens; Nutri-Score/NOVA/Eco-Score keep official colours.
- 640 px column, 44 px targets, 17 px inputs, `h2` for sections (the app bar holds `h1`),
  bottom sheets for filters/pickers/dialogs (`role="dialog"`, focus trapped, Escape and Back close).
- Icons: `lucide-react`, `size={20}` (`strokeWidth={2}`), `aria-hidden` unless meaningful.
- Behaviour, copy and features identical to Produkty PL unless the spec says otherwise.
- Port the page tests (`*.test.tsx` from Produkty PL) adapting queries to the new markup
  (roles/labels/text first); keep their assertions about behaviour.
- Each agent commits only its folder (+ its route case in `FoodRoot.tsx`).

### Task 4.1 (agent E): Product browser
Source: `App.tsx` `Browser`, `components/{ActiveFilters,FacetList,FilterDrawer,FilterPanel,Footer,Pagination,PriceTag,ProductCard,ProductDetail,ProductImage,ProductTable,RangeInput,ScoreBadge,StatusScreen,Toolbar}.tsx`.
Target: `src/food/components/products/**` + shared `src/food/components/common/{ProductImage,PriceTag,ScoreBadge,StatusScreen}.tsx`.
Search field + sort + view toggle + "Filtry (n)" button under the section switch; results line;
active filter chips; cards (2 columns at 320 px, 3 from 480 px) or sideways-scrolling table;
pagination; detail as a full-height sheet driven by `p=` (push; Back closes); filters sheet with a
"Pokaż N produktów" button; footer with data sources and licences.
Commit `feat: produkty w zakładce Jedzenie`.

### Task 4.2 (agent F): Recipes and Nearby
Source: `components/recipes/**`, `components/nearby/**`. Target: `src/food/components/recipes/**`,
`src/food/components/nearby/**` (import shared ones from `../common`, created by agent E — if not
there yet, create them exactly per Task 4.1's names and let E reuse).
Recipes: filters (czas, rodzaj, sklep) as chips; recipe cards with tier badge, per-serving macros,
shop line with switcher, ingredient swaps (sheet), red rule-break note, ready products list.
Nearby: Leaflet map (import `leaflet/dist/leaflet.css` in the page), radius slider, status lines,
long-press/"Ustaw środek mapy jako moją lokalizację", recipes doable in one shop.
Commit `feat: przepisy białkowe i sklepy w pobliżu w zakładce Jedzenie`.

### Task 4.3 (agent G): Diet (Dziennik + subpages) and the Dziś card
Source: `components/diet/**`. Target: `src/food/components/diet/**`, `src/food/TodayFoodCard.tsx`.
Dziennik root = TodayView (bilans, macro bars, plan lines with tick/skip/swap, auto day, "Co
teraz?", "Dodaj zjedzone" picker sheet, quick kcal) + cards linking to `#/jedzenie/plan`,
`#/jedzenie/postep`, `#/jedzenie/profil`; no profile → onboarding card to Profil diety. Weight and
steps fields write through `useBridge()`; a "Ruch dziś" line from `moveOn(today)`. ProfileView
edits height through the bridge; "Twoje dane" keeps Excel import and diet backup. ProgressView's
weight chart reads merged weights. `TodayFoodCard`: kcal eaten / goal bar, protein bar, button
"Dodaj zjedzone" → `#/jedzenie?dodaj=1` (Dziennik opens the picker when `dodaj=1`); rendered by
`SessionHome` via `lazy` only when `localStorage['gt:diet']` is set (set it when a diet profile is
saved or found).
Commit `feat: dziennik jedzenia, plan, postęp i profil diety w zakładce Jedzenie`.

---

## Phase 5 — Integration, data safety, docs, verification (controller)

### Task 5.1: One backup, one reset
- [ ] `exportData` becomes async: adds `diet: await exportAll()` (dynamic import of
  `./food/diet/store`) when the diet DB has any rows; `importData` restores `parsed.diet` with
  `restoreAll` when present (toast mentions it); `resetAll` also `clearAll()` and removes
  `gt:diet`. Test the pure parts (JSON shape) where feasible. Commit `feat: jedna kopia zapasowa treningu i diety`.

### Task 5.2: README and docs
- [ ] README: stack line (React 19, Vite 8), commands (`food:*`, `lint`), "Zakładki" table and
  subpages for the new structure, new sections "Czas treningu" (clock, parts, transitions,
  achievements) and "Jedzenie" (diary, recipes, products, nearby, data, privacy, licences:
  ODbL/CC BY-SA, OSM), PWA section rewritten (injectManifest, prompt update, fonts, CSP),
  test count. Commit `docs: czas treningu, zakładka Jedzenie i nowe PWA w README`.

### Task 5.3: Verification
- [ ] `npm run lint && npm run typecheck && npm test && npm run build`.
- [ ] `npm run preview` + Chrome DevTools MCP at 390×844: walk Dziś → start workout → Zaczynam →
  log sets → transition card → Start → finish (time in summary) → Osiągnięcia (group Czas) →
  Trening sections → Jedzenie sections (dataset loads, filter, open product, Back closes,
  recipes, nearby without geolocation, diary with weight write-through) → offline reload
  (DevTools offline) → no console errors. Screenshots of key screens.
- [ ] Final code review (subagent) over `main...HEAD`; fix findings; merge into `main` locally
  with `--no-ff` (`Merge branch 'feat/czas-jedzenie-pwa': …`). **Do not push** — pushing to
  `main` deploys to GitHub Pages; leave that to the user.
