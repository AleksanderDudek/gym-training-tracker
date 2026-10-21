# Steps and health from the phone — implementation plan

Spec: `docs/superpowers/specs/2026-10-21-zdrowie-telefon-design.md`. Branch: `feat/zdrowie-telefon`.

Three independent streams after task 0. The PWA stream runs in the main checkout; the Android and
iOS streams run in their own worktrees (they start from `main`: fast-forward to
`feat/zdrowie-telefon` first) and touch only `health/android`, `health/ios` and the Android
workflow. Merged back into the feature branch at the end.

## Task 0 — shared ground (done before the streams)

- [x] Spec with every decision.
- [x] `health/vectors.json`: key, IV, derived `box`/`enc`/`mac`, a phone payload and its sealed blob,
  computed with `node:crypto`. Same key and IV as the watch vector, so the box matches too.

## Stream A — PWA

1. **Engine `src/engine/phone.ts`** (+ `phone.test.ts`)
   - `parsePhonePayload(v, nowMs)`: requires `v: 1`, `k: 'phone'`, `os` in `ios|android`, `t` like the
     watch; rows checked field by field against `PHONE_LIMITS`; a row with no number is dropped;
     ≤ 31 days, ≤ 50 workouts.
   - `mergePhone(state, p, got)`, `restorePhone(v)`, `phoneEntries(data, watchRides)` (steps per day,
     cycling with distance → `bike`, `src: 'phone'`, dropped when a watch ride starts within 600 s).
   - Export the shared helpers from `watch.ts` instead of copying them (`num`, `rows`, `merged`,
     `byDay`, `actRow`, `localDayOf`, `EPOCH_MIN`, `DAY`).
   - `parsePayload` (watch) rejects any payload with `k`.
2. **Types**: `PhoneDay`, `PhoneData`, `AppState.phone`, `Cardio.src?: 'watch' | 'phone'`.
3. **`cardioOf`**: highest of typed / watch / phone per day, ties typed → watch → phone; phone rides
   deduped against watch rides. `deviceStepsOn(state, day)` → `{ steps, src } | null` for the forms
   and toasts (replaces `watchStepsOn` at call sites).
4. **Browser layer**: `src/mailbox.ts` (generic `pullBox`, `forgetBox`, `readBox` with a parser),
   `src/garmin.ts` rebuilt on it with the same exports, new `src/phone.ts` (`gt-phone-key`,
   `HEALTH_IOS_URL`, `HEALTH_ANDROID_URL`, `phoneConfigured`, `pullPhone`, `forgetPhone`,
   `platformOf(ua)`).
5. **App wiring** (`App.tsx`): restore/export `phone`; one pull effect for both sources;
   `applyPhone` (badges, level, revoke like the watch); `checkPhone`; reset forgets the phone.
6. **UI**
   - `components/Phone.tsx` — „Zdrowie z telefonu" card in Settings (after the Garmin card):
     connect / paste key / steps per platform / copy key / „Sprawdź teraz" / show key / disconnect.
   - `Cardio.tsx` — „z telefonu" label, no delete; step and ride warnings name the source;
     `PhoneHealthDays` („Z telefonu": resting HR, HR range/avg, sleep h/min, weight) + `PHONE_NOTE`.
   - Weight card — „Telefon ma nowsze ważenie: 82,4 kg, 21.10. [Wpisz do dziennika]".
   - `Character.tsx` — any device step day needs active minutes.
7. **Tests**: engine (parse, ranges, merge, restore, entries, dedupe), `cardioOf` three-way max,
   mailbox/phone `readPull` incl. the shared vector, Phone card (render, connect, copy, wrong key),
   Cardio list label and health rows, weight offer.
8. **Build/CI**: `VITE_HEALTH_IOS_URL`, `VITE_HEALTH_ANDROID_URL` in `deploy.yml` and `vite-env.d.ts`.
9. **Docs**: README section „Zdrowie z telefonu" (+ pointers from „Kroki, cardio i kalorie" and the
   Garmin section, file map, data list, test count); `server/api/README.md` note that phone
   companions use the same mailboxes.

## Stream B — Android companion (`health/android`)

Gradle 8.14.3 wrapper (generate with the cached distribution), AGP 8.13.0, Kotlin 2.2.x,
compile/target 36, minSdk 28, Java 17 bytecode. Package `io.github.aleksanderdudek.gymtracker.zdrowie`.

- `Seal.kt` — derive keys, seal (IV injectable), mirrors `src/watchseal.ts`.
- `Payload.kt` — `Day`/`Ride` data, JSON writer (no org.json in main code), `build(days, rides, t, os)`
  dropping oldest days until the sealed blob ≤ 11 000 chars.
- `Sleep.kt` — merge sleep intervals minus awake, assign to wake-up local day (pure).
- `HealthReader.kt` — Health Connect: availability, granted permissions, `aggregateGroupByPeriod`
  per local day for granted metrics only, resting HR, sleep sessions with stages, weight (last of
  day), cycling sessions with distance aggregated over the session.
- `Sender.kt` — POST `{box, blob}` to `API_URL/garmin/push` (HttpURLConnection), result kinds
  ok / tooOften / rejected / offline.
- `Keys.kt` (prefs), `SyncWorker.kt`, `Sync.kt` (read → build → seal → send, last result stored),
  `MainActivity.kt` (one screen), `RationaleActivity.kt` (privacy text), manifest (permissions,
  `<queries>`, rationale filter, `VIEW_PERMISSION_USAGE` alias, no backup).
- Unit tests: vector (`../../vectors.json`), payload (shape, trimming, nulls omitted), sleep merge.
- `./gradlew testDebugUnitTest assembleDebug` must pass.
- `.github/workflows/zdrowie-android.yml`: tests on changes under `health/android`, signed release
  APK attached to a GitHub Release on tag `zdrowie-android-v*` when signing secrets exist.

## Stream C — iOS companion (`health/ios`)

XcodeGen `project.yml`, iOS 17, bundle `io.github.aleksanderdudek.gymtracker.zdrowie`,
HealthKit + background delivery entitlements, `NSHealthShareUsageDescription` (Polish),
`BGTaskSchedulerPermittedIdentifiers`, `UIBackgroundModes: fetch`.

- `Seal.swift` (CommonCrypto AES-CBC, CryptoKit HMAC), `Payload.swift`, `Sleep.swift` — pure.
- `HealthReader.swift` — statistics collection per local day (steps, distance, floors, exercise
  time, HR min/avg/max, resting HR, body mass most recent), sleep samples, cycling workouts with
  distance.
- `Sender.swift`, `KeyStore.swift` (Keychain), `Sync.swift` (throttle 15 min unless forced),
  `App.swift` (observer queries + background delivery at launch, BG refresh), `ContentView.swift`.
- XCTest target for the pure parts, plus `check.sh`: compiles the pure files and a test runner with
  the macOS `swiftc` and checks `../vectors.json` — runs without Xcode. Type-check the rest against
  the macOS SDK where possible (`#if os(iOS)` around UIKit/BackgroundTasks).

## Finish

- Review each stream (code-reviewer agent), fix findings.
- `npm run typecheck && npm run lint && npm test && npm run build`; Android tests and build; Swift check.
- `health/README.md` (Polish): why, how it works, build and publish per platform, turning the card on.
- Merge `feat/zdrowie-telefon` into `main` locally. No push.
