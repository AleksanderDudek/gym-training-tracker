# openGym vs GYM TRACKER — feature comparison

State as of **5 November 2026**. The openGym figures come from its repository at `8fb98b1`
(commit of 4 Nov 2026, release v1.4.4), the README, NOTICE, ROADMAP, CHANGELOG, `docs/` and
`frontend/src`, plus opengym.ch, the App Store listing and the GitHub API (all listed under
Sources, with the date each was read). The GYM TRACKER figures come from this repository at
`277c660` (v3.0.0): the README plus checks in `src/`. Parts of section 3 describe work decided
this round and implemented on branch `feat/katalog-cwiczen` (spec `docs/superpowers/specs/2026-11-05-katalog-cwiczen-design.md`).

## TL;DR

- **Both are free, ad-free strength trackers built around privacy, but the architecture is the
  opposite.** openGym is a self-hosted client–server app (React + a small Node API, Docker) with
  native phone and watch apps and multi-device sync. GYM TRACKER is a static PWA with no backend
  for data; everything lives in the browser.
- **openGym wins** on reach and platform: an exercise catalogue of 5,632 exercises with licensed
  animations, App Store + Android apps, Apple Watch / Wear OS / Amazfit apps, widgets and Live
  Activity, two-way Apple Health / Health Connect, sync, self-hosting, 20 languages, imports from
  Strong / Hevy / FitNotes, plate math from the plates you own, and an open-source licence.
- **GYM TRACKER wins** on coaching logic and breadth: an automatic progression engine that
  measures the starting level, an evidence-based plan advisor, 86 ready plan variants with deadlines,
  a coach app with end-to-end encryption (Sztab), gamification, and a whole nutrition side
  that openGym does not have at all.
- **The "same animation in every app" is Gym visual**, a commercial stock library sold per item.
  openGym's licence covers openGym only. GYM TRACKER cannot reuse it; it takes the 1,324
  MIT-licensed exercise texts from the original dataset and draws muscles with MuscleMap (MIT)
  outlines instead.

## At a glance

Legend: ✅ has it · ⚠️ partial / planned / with limits · ❌ doesn't have it.

| Area | Feature | openGym | GYM TRACKER | Edge |
| --- | --- | --- | --- | --- |
| **Business** | Price | ✅ Free, "no paid tier"; Buy Me a Coffee, Ko-fi, GitHub Sponsors | ✅ 0 zł, no ads, optional "buy me an espresso" donation | tie |
| | Licence | ✅ AGPL-3.0 + app-store exception; contributors sign a CLA; media licensed separately | ⚠️ Public repository with no licence file (all rights reserved by default) | openGym |
| | Account / login | ✅ Optional: phone app works alone; on a server, passkeys (password sign-in per instance) | ✅ None | depends |
| | Sync across devices | ✅ Own server, field-by-field merge of concurrent edits | ⚠️ Export/import one file; encrypted share with a coach is not sync | openGym |
| | Self-hosting | ✅ Docker Compose (amd64 + arm64), Helm, Kubernetes, NixOS module, guides for HTTPS/Tailscale | ⚠️ Static `dist/` on any file host; reminders need a Cloudflare Worker, coach link needs the Sztab database | openGym |
| | Ads / telemetry | ✅ None; App Store label "Data Not Collected" | ✅ None; no analytics in `src/` | tie |
| | Languages | ✅ 20 per README (EN + 19 locale files); site and App Store list 19 | ⚠️ 2 (PL, EN) | openGym |
| **Platforms** | iOS / Android native | ✅ Capacitor apps: App Store (iPhone, iPad, Watch); signed Android APK (315–760 MB); Google Play closed test; F-Droid build planned | ⚠️ Installable web app (PWA) + "Zdrowie" companion (Android APK, iOS via TestFlight) | openGym |
| | Works offline | ✅ Phone app standalone; web shows an offline banner and syncs later | ✅ Fully, from the first visit (service worker) | tie |
| | Watch app | ✅ Apple Watch (sets with the Crown, RPE/RIR, rest, HR per set, complications); Wear OS beta; Amazfit (Zepp OS); Garmin built, not in store yet | ⚠️ Garmin Connect IQ app sends steps, HR, stress, Body Battery; no set logging on the wrist | openGym |
| | Widgets / lock screen | ✅ iPhone widgets + Live Activity (log a set, skip rest); rest timer in the notification shade | ❌ | openGym |
| | Health integrations | ✅ Apple Health and Health Connect both ways (workouts out; weigh-ins, HR in); signed webhooks | ⚠️ Apple Health / Health Connect read-only via companion; Garmin watch app | openGym |
| **Exercises** | Library size | ✅ 6,554 catalogue entries: 5,632 exercises + 922 female-figure variants | ⚠️ 114 curated exercises, 7 movement patterns, 16 muscle groups; +1,324 MIT catalogue exercises (searchable, addable to workouts) | openGym |
| | Exercise media | ✅ Gym visual stills and animations (180 px in repo/server, up to 360 px in the HD APK) | ✅ Own animated mannequin (Gustaw/Gosia) drawn from joint angles + curated YouTube videos | split |
| | Body maps | ✅ MuscleMap outlines: per exercise, a mini map on every plan session and on Home, Stats map in 3 modes (volume, recovery, untrained) | ⚠️ "Muscles this week" front/back card (own simple shapes); per-exercise map on MuscleMap outlines on every exercise page and in the in-workout technique sheet | openGym |
| **Training** | Progression engine | ✅ Rules per routine or exercise: linear, Greyskull LP, double, triple, add time; stall → deload; larger engine planned (v1.4.7) | ✅ Calibration sets, per-equipment weight ladders, double progression gated on reps in reserve, control test every 6 sessions, bell-by-bell weight change, load ratio, detraining rules | split |
| | Plans | ⚠️ Routine per weekday or A/B/C rotation; 4 starter plans; programmes (v1.4.4); opt-in AI coach drafts a week | ✅ 54 classic 12-week variants, 16 goal plans, 6 sport profiles (16 plans), custom 4–48-week plans; calendar deadlines, 3-day grace window | GYM TRACKER |
| | Plan advisor | ⚠️ Structural Balance ratios (Poliquin, Thibaudeau, ATG); opt-in AI coach | ✅ Fractional sets per muscle per session and week, frequency, 48 h, order, push:pull, deload, duration — against ACSM and cited studies | GYM TRACKER |
| | Guided session | ✅ Today's workout starts itself, weights pre-filled, card or list view | ✅ Set by set and part by part with a transition card; survives a reload; wake lock | tie |
| | Rest timer | ✅ Per exercise, up to 15 min, screen flash, notification shade, on the watch | ✅ ACSM defaults; +30 s when sets fade, shorter in circuits as you improve | tie |
| | PR detection / e1RM | ✅ PRs flagged during the session; e1RM curve per exercise; ↑ = ↓ on each set vs last time | ⚠️ e1RM (Epley) trend and records on each exercise's history page; period-record badges; no live PR flag in the set | openGym |
| | Plate math | ✅ Plates per side from the plates you own (barbell, EZ, trap bar, Smith); dumbbell sets, machine stacks | ⚠️ "kg per side" on the pre-workout card, 20 kg bar assumed (`platesPerSide`); no plate breakdown or inventory | openGym |
| | Multi-gym equipment | ✅ Each gym keeps its own plates, dumbbells, bars, stacks; phone can switch by location | ⚠️ Three equipment sets (none / kettlebell / gym) per workout; editable kettlebell ladder | openGym |
| | Supersets / circuits | ⚠️ Supersets, drop sets, rest-pause, pyramids; circuits / AMRAP / EMOM planned (v1.4.7) | ⚠️ Pairs (rules checked across the library) and circuits with rounds; no drop sets | split |
| | Warm-up sets | ✅ Warm-up ramps | ✅ Bar × 10, ~50% × 5, ~75% × 3 for heavy barbell lifts | tie |
| | Deload | ✅ Planned deloads; a stall triggers one | ✅ Lighter week every 4–8 weeks (−40% sets, levels untouched); rules after 11 / 21 / 42 days off | tie |
| | Effort input | ✅ RIR or RPE column, colour-coded | ⚠️ 3-step reserve scale (by design: people misjudge by ~1 rep) | split |
| | Backup exercise swap | ✅ Planned backup swaps in with one tap, keeps sets and reps | ✅ Each gym exercise has a substitute; "Zamień" swaps for today, progression goes to what was done | tie |
| | Edit past workouts | ✅ Edit any saved workout, log one done on paper, move its date; records re-read | ⚠️ Notes editable in history; a session done elsewhere can be ticked off; logged sets not editable (not found in README/`src`) | openGym |
| | Units | ✅ kg or lb, per exercise | ⚠️ kg only | openGym |
| | Import from other apps | ✅ FitNotes, Strong, Hevy (CSV or API key), Liftosaur/Liftoff plans, Apple Health weight | ❌ Own backup file only | openGym |
| | Coach / trainer | ⚠️ Opt-in AI coach (own provider key); trainer role on the roadmap (v1.4.10) | ✅ GYM TRACKER Sztab: app for trainers, dietitians, physios, doctors; end-to-end encrypted plans and recommendations | GYM TRACKER |
| | Gamification | ⚠️ Week streak, challenges, yearly "Wrapped" recap, seasonal themes | ✅ Points, badge families, avatar XP, share cards | GYM TRACKER |
| | Exercise "snacks" | ❌ | ✅ | GYM TRACKER |
| **Body & health** | Body weight | ✅ Chart against a goal line, weekly rate | ✅ 7-day average and week-on-week change | tie |
| | Measurements and photos | ✅ Many fields (left/right, custom); photo timeline with before/after slider | ✅ Waist, hips, chest, arm, thigh; photos with before/after, kept on the device | tie |
| | Steps / cardio | ⚠️ Cardio by time and speed inside a workout; other data via Health apps | ✅ Steps, treadmill, bike, dance; watch and phone data | GYM TRACKER |
| | Nutrition | ❌ None ("openNutrition, the sister app" is a "later, ideas" item in ROADMAP) | ✅ Food diary, ~40k Polish products, barcode, on-device photo recognition, meal prep, lab results | GYM TRACKER |
| | Calendar export | ⚠️ Calendar feed planned (v1.4.5) | ✅ `.ics` file and Google Calendar template | GYM TRACKER |
| **Data & privacy** | Where data lives | Phone (standalone) or JSON files in `./data` on your own server; passkey private keys never reach it | Browser (localStorage + IndexedDB); servers see only ciphertext (watch, phone, coach) or reminder texts | tie |
| | Export | ✅ Full JSON, CSV, plan file, PDF print | ✅ Full JSON backup, 3 CSVs, Excel report for a dietitian or doctor | tie |
| | AI | ⚠️ Opt-in AI coach and MCP server, your own key (Anthropic, OpenAI, Gemini, Ollama) | ⚠️ On-device dish recognition from photos only; no chat coach | split |

**Count of the "Edge" column** (42 rows): openGym 16, tie 12, GYM TRACKER 8, split 5,
depends 1. That is a rough count, not a score: the rows don't carry equal weight, and the
table is training-heavy on purpose. GYM TRACKER's nutrition side (see the Fitatu report) is
one row here.

## 1. What openGym is

**Positioning.** "The gym tracker you host yourself": no account on someone else's server, no
subscription, no ads, no telemetry; `docker compose up` and it runs. An in-browser demo with
example data is at opengym.ch/demo.

**Stack** (README, `docs/ARCHITECTURE.md`):

- `frontend/`: React 19 + Vite, React Router, Zustand. Training logic is pure functions in
  `frontend/src/lib/` with tests beside them.
- `api/`: plain `node:http` with three dependencies (`@simplewebauthn/server`, `web-push`,
  `undici`). Data is JSON under `./data` (`db.json`, `state-<user>.json`); a database is the one
  planned compatibility break. OpenAPI spec in `api/openapi.yaml`.
- `web/`: nginx serves the build and proxies `/api` so passkeys work on one origin.
- **Sync:** one document per profile with a server revision; a stale write gets 409 and the
  current document; every field carries its own stamp, so the merge keeps the newest edit of each
  and deletions stay deleted.
- **Self-hosting:** Docker images on GHCR and GitLab (amd64, arm64), Helm chart, Kubernetes
  manifests, a NixOS flake/module, guides for Cloudflare Tunnel, Caddy, Traefik, nginx, LAN HTTPS
  and a Mac with Tailscale.
- **Phone apps:** the same code wrapped with Capacitor. iPhone/iPad on the App Store (with the
  Apple Watch app); Android as a signed APK in three sizes (Standard 180 px animations ~315 MB,
  Plus 240 px ~424 MB, HD 360 px ~760 MB); Google Play in closed testing; an F-Droid build without
  Google services planned for v1.4.5 (the animations marked as non-free assets).
- **Watches:** Apple Watch (shipped); Wear OS (beta since v1.4.4); Zepp OS 3+ for Amazfit
  (v1.4.4, paired through your own server); Garmin Connect IQ (`frontend/garmin`, compiles and
  passes its checks, store listing and the phone bridge still to do).
- **Optional extras, off by default:** AI coach with your own provider key, a local MCP server,
  signed webhooks (Home Assistant, n8n, ntfy). "Modules" switch whole areas of the app off.

**Licence.** Code under AGPL-3.0 with an additional permission (section 7) that allows
distribution through app stores whose terms would otherwise conflict, as long as the source stays
available under the AGPL. Contributors sign a CLA that lets openGym relicense their work. The
exercise media are not covered by the AGPL (see section 2).

**Features by area** (README "Features", verified against `frontend/src/lib/`):

- *Planning:* routine per weekday or a rotation; 4 starter plans; mini body map on each session;
  move a session without touching the plan; supersets, warm-up, drop sets, rest-pause, timed
  holds, cardio, rest per exercise, planned deloads; own exercises with photo/GIF/video (location
  data stripped).
- *Training:* guided session with pre-filled weights, rest timer, live PRs; RIR/RPE; plate math
  from owned plates (`plates.js`) and per-gym inventories (`gym-inventory.js`, `gym-auto.js`);
  per-side reps; swipe a set left to delete (with Undo) or right to copy (`use-swipe-row.js`);
  pyramids; backup exercise per slot; machine stacks with odd steps; live session volume.
- *Progress:* progression rules (linear, Greyskull LP, double, triple, time) that explain each
  target; e1RM curves; Structural Balance ratios (`structuralBalance.js`); activity heatmap;
  muscle map (volume, recovery, untrained); body weight vs goal; progress photos; lifts as % of
  body weight; edit any past workout.
- *Accounts and data:* passkeys, pairing codes/QR, field-level merge; imports from FitNotes,
  Strong, Hevy (CSV or API key), Liftosaur/Liftoff, Apple Health weight; JSON and CSV export;
  plan sharing and PDF; optional admin dashboard and invite-only sign-up.
- *Phone and wrist:* rest timer in the notification shade, reminders, Health Connect / Apple
  Health both ways, a geofenced gym reminder, Apple Watch app, iPhone widgets and Live Activity,
  AirPods Pro 3 heart rate on iOS 26, gym check-in QR/barcode card.

**Languages.** 20 per the README (English + 19 locale files in `frontend/src/locales`: ar, bn,
de, es, fr, hi, hu, it, ko, pl, pt, pt-BR, ru, sv, th, tr, uk, zh, zh-TW); opengym.ch and the App
Store say 19. The site says exercise instructions are translated in 12 languages and exercise
names in 7.

**Catalogue** (`catalogue/exercises/*.json`, counted at `8fb98b1`):

| Slice | Entries | Text licence |
| --- | --- | --- |
| All entries | 6,554 | |
| `"textSource": "exercisedb"` | 1,324 | MIT (ExerciseDB v1 via hasaneyldrm/exercises-dataset) |
| openGym's own text (not ExerciseDB, not a variant) | 4,308 | AGPL-3.0 |
| `variantOf` (same exercise on a female figure) | 922 | AGPL-3.0 |
| Entries with a `femaleVariant` link | 935 | — |

5,632 = 6,554 − 922, the figure on the site. NOTICE adds a catch: in openGym's copy, "every
description, the muscle-map corrections and all translations" are openGym's own (AGPL), even on
the 1,324 ExerciseDB entries. Only the original names, muscles and instructions stay MIT.

## 2. Why "all these apps use the same exercise animation with muscles marked"

**They buy the same stock media.** The animated figure with the working muscles highlighted
comes from **Gym visual** (gymvisual.com, © Aliaksandr Makatserchyk), a commercial library of
exercise illustrations, GIFs and videos that markets itself to app developers, trainers and
YouTube creators and adds new items weekly. openGym's README and NOTICE name it as the source of
every still and animation in its catalogue. The MIT dataset hasaneyldrm/exercises-dataset, which
redistributes ExerciseDB v1, puts `"attribution": "© Gym visual — https://gymvisual.com/"` on
each of its 1,324 entries. ExerciseDB's own site does not name the source of its GIFs.

**How Gym visual sells it** (price rules page, read 5 Nov 2026), in USD, per item, per order:

| Type | 1–9 items | 10+ items |
| --- | --- | --- |
| Illustration | $3.00 | $0.75 |
| Animated GIF | $3.60 | $0.90 |
| Video (1–4 / 5+) | $10 | $6 |

"Interested for a pack? Contact us." No pack or app-wide price is published. As arithmetic only,
not a quote: 1,324 GIFs at the 10+ rate would be about $1,190.

**What the licence allows** (Non-Exclusive Commercial Royalty-Free License, "N-CRFL"): pay once,
use in perpetuity, worldwide, including in Android and iOS apps and on websites. It is granted to
one account owner (person or organisation) and is non-transferable. It does **not** allow
reselling or redistributing the media, making it available for download, assigning rights to
third parties, using it in products that "antagonize Gym visual business model", or training,
prompting or generating content with AI.

**What openGym's licence allows.** From NOTICE.md and `catalogue/media/NOTICE.md`: the media is
licensed to openGym only; the repository, the websites and self-hosted servers carry it at
180×180 px at most, larger only inside the app packages; there is no public API, CDN or media
pack; "Third parties have no rights to reuse, extract, or integrate these media assets into
independent apps, websites, or commercial products"; a non-commercial fork may keep the
unmodified 180 px files with the notice, anything else needs its own licence; and the media "may
not be used to train, prompt or feed any AI system". The MIT dataset has the same carve-out: its
LICENSE file ends with a "MEDIA EXCEPTION" saying the MIT grant covers code, structure and
instruction text/translations only, and the 180×180 media in `images/` and `videos/` is © Gym
visual under Gym visual's terms.

**So:** the look repeats across apps because per-item prices are low enough for any app to buy
the same set, and because free sources (ExerciseDB v1, the MIT dataset, openGym) ship 180 px
copies with permission. That permission does not pass on to anyone downstream.

**The small body maps are a different thing.** The front and back figures with lit muscles that
openGym shows on sessions, exercises and Stats come from **MuscleMap** by Melih Colpan
(github.com/melihcolpan/MuscleMap, MIT): a SwiftUI SDK with male and female bodies, front and
back views and 22 base muscle groups. openGym converted its Swift path data to JSON
(`frontend/src/lib/body-paths.js`) and dropped the sub-group shapes.

## 3. What GYM TRACKER takes from openGym this round, and how

Decided and implemented this round (spec of 5 Nov 2026, branch `feat/katalog-cwiczen`).

**(a) 1,324 MIT exercises, from the original source.** Names, body part, equipment, target and
secondary muscles, and step-by-step instructions in English and Polish, imported from
**hasaneyldrm/exercises-dataset** at commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`
(`data/exercises.json`, pinned and checked by SHA-256 in `scripts/catalog/build.ts`). Not from
openGym's files: in openGym's copy the descriptions, muscle corrections and translations are
AGPL. The dataset's LICENSE puts "instruction text/translations" under MIT, so its Polish steps
can be used; all 1,324 entries have them (checked). The dataset has no Polish names, so the Polish
names are GYM TRACKER's own translation. Plan in short: lazy-loaded data files outside the main
bundle; ids `kat-<id>`; an exercise enters the progression engine only when added to a workout;
the dataset's 21 targets and 39 secondary names map onto GYM TRACKER's 16 muscle groups, so
catalogue exercises count in the advisor and "Muscles this week"; duplicates of library exercises
point to the library version. Attribution and the MIT text go with the app.

**(b) Muscle-map outlines from MuscleMap (MIT)** at commit
`d53ddf4d480b65979f1008b203e6b6eda0e67e54`: a front/back map with primary and secondary
muscles on every exercise page, in GYM TRACKER's own colours, with the male or female body
following the user's avatar. This gives the "highlighted muscles" effect people know from other
apps without any Gym visual media.

**(c) Not taken:**

- **Gym visual media.** Licensed to openGym only; GYM TRACKER would need its own paid licence,
  and the licence forbids redistribution and download. GYM TRACKER's repository is public, so
  committing purchased files to it is a question to put to Gym visual first.
- **openGym's 4,308 AGPL exercise texts and its Polish translations** (`catalogue/i18n/pl.json`,
  5,632 entries). GYM TRACKER's repository is public with no licence; importing AGPL text would
  oblige the whole app to be offered under the AGPL. That is an owner decision, left open.
- **openGym code.** Same AGPL reason. Ideas below are re-implemented, not copied.

## 4. Ideas worth borrowing

Ranked by value to GYM TRACKER users against effort. "Has" marks what GYM TRACKER already does in
some form.

| # | openGym feature | GYM TRACKER today | Effort / value |
| --- | --- | --- | --- |
| 1 | **Import from Strong, Hevy, FitNotes** (CSV; Hevy by API key) | ❌ | Medium effort (parsers + name matching, which the 1,324-exercise catalogue now makes possible) / high value: history is the main reason people don't switch |
| 2 | **Plate math from the plates you own** (+ dumbbell sets, odd machine stacks) | ⚠️ Has "kg per side", 20 kg bar fixed | Low effort / high value: used on every barbell set |
| 3 | **Live PR flag and ↑ = ↓ vs the same set last time** | ⚠️ Has records and e1RM on the history page | Low effort / high value: feedback at the moment of effort, data already in the log |
| 4 | **Mini body map on each plan session and workout card** | ⚠️ Has the weekly map; MuscleMap outlines arrive this round | Low effort / medium-high value: "Leg Day is legs" before opening it |
| 5 | **Edit a saved workout** (sets, date), log one done on paper | ⚠️ Notes only; manual tick-off for deadlines | Medium effort / medium-high value; state is derived from history, so a recompute follows naturally |
| 6 | Per-gym equipment inventories, switch by location | ⚠️ Three equipment sets | Medium effort / medium value; location needs care in a privacy-first PWA |
| 7 | Structural Balance ratios (e.g. bench vs row, squat vs deadlift) | ⚠️ Push:pull set ratio in the advisor | Medium effort / medium value; strength ratios need e1RM on several lifts |
| 8 | Per-set swipe gestures (left delete with Undo, right copy) | ❌ | Low-medium effort / medium value, mainly for the list view; guided flow needs fewer edits |
| 9 | Modules: switch whole areas (e.g. food) off | Not checked | Medium effort / medium value for training-only users |
| 10 | Set logging on the wrist | ⚠️ Garmin app sends health data only | High effort / medium value; Connect IQ app already exists |
| 11 | Drop sets, rest-pause | ❌ | Low-medium effort / low-medium value; progression would have to ignore them |
| 12 | kg / lb per exercise | ❌ | Low effort / low value for a Polish audience |
| — | Backup exercise when a machine is taken | ✅ Has it ("Zamień", substitute per gym exercise) | — |
| — | Warm-up ramps, deloads, timed holds, progress photos, CSV export | ✅ Has them | — |

Not recommended: a 10-step RPE scale (GYM TRACKER's 3-step scale is a deliberate choice, see
README "Jak działa progresja"), and a rest timer on the lock screen, which a PWA cannot do without
native code.

## 5. Analysis

**Positioning.** openGym is a strength log for people who want to own their server, with a
well-built native shell and a large catalogue. GYM TRACKER is a coach in the browser: it decides
loads, writes plans with deadlines and checks them against research, and adds nutrition. They
compete for the same lifter, but openGym is closer to Strong/Hevy (log what you planned, see your
numbers) and GYM TRACKER closer to a programme with a trainer.

**Where openGym is structurally ahead (hard to close):** native apps in the stores, watch apps
that log sets, Live Activity and widgets; multi-device sync; 20 languages with a translation
community; a 5,632-exercise catalogue with licensed media; an open licence and a large community
(19.6k GitHub stars in under four months).

**Where openGym is ahead but the gap is cheap to close:** plate math, live PR flags, body map on
session cards, edit past workouts, imports (ideas 1–5).

**Where GYM TRACKER is ahead:** automatic level finding and progression with test sets; the
advisor; 86 ready plan variants (54 classic, 16 goal, 16 profile) with a calendar and grace windows; the Sztab coach app (openGym's trainer
role is a roadmap item for February); nutrition, labs and the Polish food data; exercise snacks;
gamification. openGym's own v1.4.7 "progression engine" and its AI coach aim at the first two.

**Risks to GYM TRACKER's position:**

- openGym ships every one to two weeks and has a contributor base; the gap on progression and
  plans may narrow.
- Without imports, people with years of Strong/Hevy history have no way in.
- The 1,324 catalogue exercises have text and muscle maps but no animation; the gorilla
  mannequin covers only exercises with a movement pattern.

## Caveats

- openGym was not tested by hand (the demo was not opened). The openGym column reflects its
  repository, docs, site and App Store listing.
- Languages: the README says 20, opengym.ch and the App Store 19.
- opengym.ch contradicts itself on the App Store (the banner says it is there; the download
  section says it is "waiting for Apple's thumbs up"). The App Store listing exists (v1.4.4).
- That ExerciseDB v1's GIFs are Gym visual is inferred from the MIT dataset's per-entry
  attribution and openGym's NOTICE; ExerciseDB's site does not say. "Many apps" use Gym visual is
  not counted, only shown by its own marketing and these datasets.
- Gym visual pack and enterprise prices are not public.
- The GYM TRACKER column is the repository at `277c660`; the catalogue import and muscle map
  (section 3) were not in it yet.

## Licensing appendix

| Source | What | Licence | Used by GYM TRACKER | Why |
| --- | --- | --- | --- | --- |
| hasaneyldrm/exercises-dataset @ `7455efae` (`data/exercises.json`) | 1,324 exercises: names (EN), body part, equipment, muscles, instructions EN + PL | MIT (code, structure, instruction text and translations) | ✅ Yes | Permissive; keep the copyright and permission notice |
| Same dataset, `images/` and `videos/` | 180 px stills and GIFs | © Gym visual, not MIT ("MEDIA EXCEPTION") | ❌ No | Needs own Gym visual licence |
| ExerciseDB v1 (AscendAPI, exercisedb.dev) | Origin of the 1,324 texts | Not stated on the site; API plans priced on request | ❌ Not directly | Taken through the MIT dataset instead |
| Gym visual (gymvisual.com) | Exercise illustrations, GIFs, videos | Commercial N-CRFL, per item ($0.75–$10), one owner, no redistribution, no AI | ❌ No | Paid; public repo conflicts with "no download / redistribution" unless agreed |
| MuscleMap @ `d53ddf4d` (melihcolpan) | Front/back body outlines, male and female | MIT | ✅ Yes | Permissive; same "lit muscles" effect without stock media |
| openGym code (`frontend/`, `api/`, watch apps) | App code | AGPL-3.0 + app-store exception | ❌ No | Would force AGPL on GYM TRACKER |
| openGym catalogue, own entries (4,308 + 922 variants) | Names, descriptions, steps, muscle maps | AGPL-3.0 | ❌ No | Same; owner decision, left open |
| openGym edits of the 1,324 ExerciseDB entries | Descriptions, muscle corrections | AGPL-3.0 | ❌ No | Original MIT source used instead |
| openGym `catalogue/i18n/pl.json` | Polish names and steps (5,632 entries) | AGPL-3.0 | ❌ No | Polish names translated in-house; Polish steps from the MIT dataset |
| openGym media (`catalogue/media/`) | Gym visual stills and animations | Licensed to openGym only | ❌ No | NOTICE forbids reuse, extraction and AI use |
| lean-qr, jsQR, @capacitor-mlkit/barcode-scanning | openGym's QR/barcode stack | MIT / Apache-2.0 / Apache-2.0 | ❌ Not considered | Not needed; GYM TRACKER has its own scanner |
| YouTube videos (existing) | Technique videos on exercise pages | YouTube terms, embedded | ✅ Already, embed only | Embedding, no copies |

## Sources

openGym (read 5 November 2026):

- Repository at `8fb98b16861a2728652302a7e6e30c50548493a0` (committed 2026-11-04):
  `README.md`, `NOTICE.md`, `ROADMAP.md`, `CHANGELOG.md` (v1.4.4, 2026-11-03), `catalogue/README.md`,
  `catalogue/media/NOTICE.md`, `catalogue/exercises/*.json` (counts), `docs/GARMIN.md`,
  `docs/WEAR_OS.md`, `docs/ZEPP_OS.md`, `docs/DATA_IMPORTS.md`, `docs/NIX.md`, `frontend/src/lib/`
  (`plates.js`, `measurements.js`, `structuralBalance.js`, `exercise-substitutes.js`,
  `watch-settings.js`), `frontend/src/locales/`: <https://github.com/DuarteSantos8/openGym>
- GitHub API: 19,577 stars, 2,609 forks, 248 open issues, created 18 Jul 2026, AGPL-3.0
- Website: <https://opengym.ch>
- App Store listing (4.9 / 26 ratings, v1.4.4, 406.8 MB, "Data Not Collected"): <https://apps.apple.com/app/id6822275400>

Media and datasets (read 5 November 2026):

- Gym visual home: <https://gymvisual.com/>
- Gym visual price rules: <https://gymvisual.com/content/6-price-rules>
- Gym visual licence (N-CRFL): <https://gymvisual.com/content/9-license>
- Gym visual terms and conditions: <https://gymvisual.com/content/3-terms-and-conditions-of-use>
- hasaneyldrm/exercises-dataset README and LICENSE at `7455efae` (commit 2026-07-16): <https://github.com/hasaneyldrm/exercises-dataset>
- ExerciseDB: <https://exercisedb.dev/>
- MuscleMap README at `d53ddf4d` (commit 2026-10-24): <https://github.com/melihcolpan/MuscleMap>

GYM TRACKER:

- `README.md` at `277c660` sections: Języki, Profil, Współpraca z prowadzącym, Zegarek Garmin,
  Zdrowie z telefonu, Atlas i sprzęt, Tor ruchu, Prowadzenie sesji i przerwy, Sylwetka,
  Kolejność pary i przygotowanie stanowiska, Treningi plany i doradca, Jak działa progresja,
  PWA, Zapis danych
- `src/data/exercises.ts` (114 entries in `EX`), `src/engine/structure.ts` (`platesPerSide`),
  `src/engine/history.ts` (e1RM), `src/components/MuscleWeek.tsx`
- Plan for this round: `docs/superpowers/specs/2026-11-05-katalog-cwiczen-design.md`,
  `scripts/catalog/build.ts`
