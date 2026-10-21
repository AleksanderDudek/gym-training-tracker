# Steps and health from the phone (Apple Health, Health Connect) — design

Date: 2026-10-21 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request (translated from Polish)

Return to the integration with the native Android and iOS apps. If the steps, health data and so
on can be read, show them in this app too.

## What exists (analysis)

- **The app is a PWA on GitHub Pages** with no accounts; all data lives in the browser
  (`AppState` in IndexedDB, diet in Dexie). A Cloudflare Worker (`server/api`) holds push
  subscriptions, feedback and the Garmin mailboxes — nothing it can read about people.
- **Steps today**: typed by hand (`#/cardio/kroki`, one entry per day, a new one replaces the old)
  or sent by the Garmin watch app. `cardioOf(state)` derives the watch entries on the fly from
  `state.watch` (numbers, not entries) and keeps the **higher** of the typed and the watch number
  per day; rides with distance become `bike` entries, runs and walks do not (their steps are already
  in the day's steps). Calories, active minutes, XP, badges and the diet's step-based energy all read
  `cardioOf`/`stepsOn`, so anything added there flows everywhere.
- **Garmin path** (`garmin/`, `src/garmin.ts`, `src/watchseal.ts`, `src/engine/watch.ts`,
  `server/api/garmin.ts`): a 32-byte key made in the browser, pasted into the watch app; the watch
  seals a week of data (AES-256-CBC + HMAC-SHA256, keys derived with HMAC labels) and posts it to
  `/garmin/push`; the PWA pulls `/garmin/pull` on open and on return to the tab, verifies, decrypts,
  validates every row against ranges and merges day by day. The Worker keeps only the newest blob
  per mailbox, at most 12 000 base64 characters, for at most 7 days of silence. The mailbox is
  source-agnostic: the server never knows what is inside.
- **Health shown today**: „Z zegarka" on the cardio screen — resting HR, HR range, stress, Body
  Battery, sleep score — numbers without judgement, no points.
- **Weight**: a journal (`state.body`, one weighing per day) that calories read for the day of the
  movement; the diet shares it through the bridge.
- **The earlier verdict** (Garmin spec, 2026-10-08): "A PWA cannot read Apple Health or Health
  Connect. A native wrapper would end the GitHub Pages distribution model."

## Platform facts (checked 2026-10-21)

- **No browser API reads HealthKit or Health Connect**, installed PWA included. Google Fit's APIs
  are being shut down; Health Connect is the Android store for health data (built into Android 14+,
  an app on 9–13). Only native code reads either.
- **Health Connect** (`androidx.health.connect:connect-client` 1.1.0 stable): per-type read
  permissions; aggregates per local day (`aggregateGroupByPeriod`, deduplicated across writing apps
  by the user's app priority); reads 30 days before the first grant without the history permission;
  background reads need `READ_HEALTH_DATA_IN_BACKGROUND` and a feature check, then WorkManager
  (hourly). The permission screen appears only if the app shows a privacy rationale
  (`ACTION_SHOW_PERMISSIONS_RATIONALE`, and `VIEW_PERMISSION_USAGE` on Android 14+).
- **HealthKit**: statistics collection queries per local day (deduplicated across sources by the
  user's source priority); observer queries with background delivery wake the app at most hourly for
  steps; protected data cannot be read while the phone is locked. The HealthKit capability needs an
  Apple Developer Program membership (99 USD/year) for anything beyond local experiments, and
  TestFlight/App Store for anyone else.
- **Garmin Connect, Fitbit, Samsung Health, Withings, Oura… write into Apple Health and Health
  Connect.** One phone integration therefore covers most wearables and smart scales, not just the
  phone's own pedometer.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| **A. Wrap the whole PWA in Capacitor** (+ health plugin) | One codebase; reads health directly, no server | Data forks: the native WebView has its own storage, separate from the PWA people already use; web push reminders, service worker and install flow do not work in WKWebView; App Store rejects thin web wrappers (4.2); every feature now ships in three places |
| **B. Companion app → encrypted mailbox → PWA** | The PWA stays the only home of the data; reuses the proven Garmin envelope, Worker and merge rules; server still learns nothing; tiny native surface (read, seal, send); works with the PWA on any device, desktop included | Two small native apps to build and publish; data arrives at most hourly |
| C. iOS Shortcuts / URL hand-off | No native code | Shortcuts cannot encrypt; a URL opens Safari, whose storage is separate from the home-screen PWA on iOS; nothing on Android |

**Chosen: B.** It is the Garmin architecture with a phone in place of the watch, so the privacy
model, the server and every downstream rule already exist and are tested.

## Decisions

### Data path and privacy

| Topic | Decision | Why |
| --- | --- | --- |
| Companion | **„GYM TRACKER Zdrowie"**: a native app per platform — iOS (Swift, SwiftUI, HealthKit) in `health/ios`, Android (Kotlin, Health Connect, WorkManager) in `health/android`. One screen: key, permission, „Wyślij teraz", last send, disconnect | Native SDKs are the only way in; a single-purpose app is small enough to audit and keeps the PWA untouched |
| Envelope | **Exactly the Garmin envelope** (`src/watchseal.ts`): same key size, same derivation labels, AES-256-CBC + HMAC-SHA256, encrypt-then-MAC | Proven, already verified by the PWA; one shared test vector checks all three implementations |
| Key | A **separate key** for the phone, made in a new card „Zdrowie z telefonu", stored as `gt-phone-key` in localStorage, never exported | Watch and phone are connected and disconnected independently; one key per mailbox means they never overwrite each other |
| Pairing | Copy the key in the PWA, paste it in the companion (SwiftUI `PasteButton` on iOS — no paste prompt; a paste button on Android). No custom-scheme deep link | A custom URL scheme can be registered by any other app and would hand it the key to health data; verified links (Universal/App Links) need files at the domain root, which a project page on GitHub Pages does not control. Same phone: three taps |
| Server | **No change.** The companion posts to the existing `/garmin/push`; the PWA pulls `/garmin/pull` with the phone mailbox | The mailbox stores opaque blobs and does not care who writes; no Worker redeploy, no new attack surface. The path name is historical and documented |
| Key storage in the companion | iOS: Keychain, `AfterFirstUnlockThisDeviceOnly` (background wakes can read it, it never leaves the device or goes to backups). Android: app-private SharedPreferences, backup and device transfer disabled for the whole app | Platform norms for a secret the app needs in the background |
| Payload marker | Phone payloads carry `"k": "phone"`; the Garmin parser rejects any payload with `k`, the phone parser requires it | A key pasted into the wrong device would otherwise feed one parser the other's data |
| Data minimisation | Only what the app shows or counts: steps, distance, floors, exercise minutes, resting HR, HR min/avg/max, sleep minutes, weight, cycling workouts with distance. No raw samples, no other workout types, no location | GDPR art. 5(1)(c); the server never reads it anyway, but the phone should not send more than the app uses |

### Payload (phone v1, plaintext JSON inside the envelope)

```json
{
  "v": 1, "k": "phone", "os": "ios", "t": 1792540800,
  "d": [{ "day": "2026-10-20", "steps": 9120, "m": 7340, "floors": 12, "active": 35,
          "rhr": 52, "hrMin": 48, "hrAvg": 71, "hrMax": 142, "sleep": 432, "kg": 82.4 }],
  "a": [{ "start": 1792501200, "sport": 2, "sec": 3600, "m": 25000 }]
}
```

- `day` is the phone's **local** date. Every field except `day` is optional; missing or `null` means
  not measured or not permitted. A row with no number at all is dropped.
- `steps`, `m` (metres), `floors`, `active` (exercise minutes; iOS only) — sums of the day.
- `rhr` — resting HR of the day; `hrMin`/`hrAvg`/`hrMax` — from all HR samples of the day.
- `sleep` — minutes asleep in the night that **ends** on that day (sleep stages merged across
  sources, awake time excluded). Same meaning as Garmin's "sleep of last night".
- `kg` — the last weighing of the day, one decimal.
- `a` — cycling workouts with distance only, `sport` in the FIT numbering (2 = cycling), so the
  watch's `SPORT_CYCLING` rule applies unchanged.
- Ranges (outside = sensor error, row field dropped): steps 0–100 000, m 0–300 000, floors 0–1 000,
  active 0–1 440, HR 25–250, sleep 0–1 440, kg 30–300; workouts 60 s–24 h, up to 1 000 km.
  At most 31 days and 50 workouts per payload.
- The companion sends the **last 14 days**, newest kept first if the sealed blob would exceed
  11 000 characters (the Worker's limit is 12 000).

### How it counts in the app

| Topic | Decision | Why |
| --- | --- | --- |
| State | `state.phone` (`PhoneData`: `t`, `got`, `os`, `days`, `acts`), merged like `state.watch`: a newer payload replaces day by day, older days stay as history | Same model as the watch, same restore/import filtering |
| Steps | `cardioOf` keeps the **highest** of typed, watch and phone for the day; ties keep typed, then watch, then phone | Phone and watch measure the same walking (and Apple Health often already contains the watch's steps); adding them would double count. Typed wins ties because only it can be deleted |
| Rides | Phone cycling workouts with distance become `bike` entries (`src: 'phone'`) **unless a watch ride starts within 10 minutes** — Garmin Connect copies the same ride into Apple Health/Health Connect | No double counting when both sources are connected |
| Runs, walks, other workouts | Not imported | Their steps are already in the day's steps (the watch rule) |
| Health numbers | Shown on the cardio screen as „Z telefonu", seven days, newest first: resting HR, HR range and average, sleep (`7 h 12 min`), weight — no points, no judgement, with a note like the watch's | Same rule as the watch: the doctor judges, not the app |
| Weight | **Never written automatically.** When the phone's newest weighing is newer than the journal's last entry (within 14 days), „Waga i wzrost" offers „Wpisz do dziennika" for that day | Calories depend on weight history; a silent import could overwrite a deliberate entry. One tap keeps the user in charge |
| Entry list | Phone entries show „· z telefonu" and no delete button, like watch entries | They are derived; the phone would send them again |
| Character mood | A phone step day counts as an active day only with active minutes, like the watch | The phone counts steps every day, also around the flat |
| Pull | On open and on return to the tab, at most once a minute, never during a workout — one effect for watch and phone | The watch rule, unchanged |
| Card visibility | „Zdrowie z telefonu" in Settings when the build knows the server **and** at least one companion URL (`VITE_HEALTH_IOS_URL`, `VITE_HEALTH_ANDROID_URL`). The card shows the instructions for the device it is opened on (both on a desktop) | Like the Garmin card: no card for an app that cannot be installed yet |
| Reset | „Usuń wszystkie dane" also disconnects the phone (forgets the mailbox), as it does the watch | Otherwise the phone would send the last two weeks back |

### Companion apps

| Topic | Decision | Why |
| --- | --- | --- |
| iOS target | iOS 17+, SwiftUI, async HealthKit query descriptors, project generated by **XcodeGen** (`project.yml`) | A readable project file in git instead of a hand-edited `.pbxproj`; iOS 17 covers ~95 % of active iPhones |
| iOS sync | Observer queries with background delivery (steps hourly; workouts, sleep, weight immediate) registered at launch, plus a `BGAppRefreshTask` and a sync on every foreground; at most one send per 15 minutes unless the user taps „Wyślij teraz" | Background delivery is the documented way to wake on new health data; refresh tasks are a backstop |
| Android target | minSdk 28, target/compile 36, Kotlin, plain Views + `androidx.activity` (no Compose) | Health Connect needs API 28+ as an app and is built in from 34; Views keep the app small and the build fast |
| Android sync | WorkManager periodic work every hour with a network constraint when background reads are available and granted; otherwise on every app open and with the button | The pattern in the Health Connect docs |
| Server address | Built in (`https://gym-tracker-api.instrukcje-app.workers.dev`, the same as the watch), overridable at build time | Users never type it |
| Distribution | Android: signed APK from a GitHub Release, built by a tag workflow (`zdrowie-android-v*`) when signing secrets exist; Play later. iOS: TestFlight/App Store from Xcode (needs the paid Apple program) | Sideloading is the fastest route to the author's own phone; the store paths are documented |
| Tests | One shared vector file (`health/vectors.json`: key, IV, payload → derived keys and blob) checked by vitest, by JUnit (Android) and by a Swift test runnable on macOS; payload building and sleep merging are pure functions with their own tests | The envelope must match byte for byte across three languages; health-store calls stay thin |

## Known limitations

- Data arrives at most about hourly (platform limits), not live.
- The iOS app cannot be compiled on this machine (no Xcode); its pure parts (envelope, payload,
  sleep merging) are compiled and tested with the macOS Swift toolchain, the HealthKit and UI parts
  are type-checked where the macOS SDK allows. A first device build may need small fixes.
- One phone per key: two phones on the same key would overwrite each other's payload.
- HealthKit cannot be read while the iPhone is locked; a background wake then waits for the next one.
- HRV, SpO₂, blood pressure and energy burned are not imported: different devices report them
  differently (HRV as SDNN on iOS, RMSSD on Android) and the app computes its own calories.

## Decisions made during implementation

| Topic | Decision | Why |
| --- | --- | --- |
| Restoring `watch`/`phone` from a save or import | The payload time is bounded by now + 1 day and workout starts by that time, for the watch too | A hand-edited file with a time far in the future would block every later payload (older ones change nothing), and a start outside the calendar made `toISOString` throw on every screen with movement (found in review; the watch had the same gap) |
| Local phone day vs UTC `today` | „Z telefonu" and the weight offer accept the phone's day up to one day after the UTC `today` | After Polish midnight the phone is already a day ahead; the morning weigh-in would otherwise be hidden until 01:00–02:00 |
| Export | The numbers that already arrived (`watch`, `phone`) stay in the export, as before for the watch; the keys never do | They are part of the person's history, like steps typed by hand; the key is what opens new data |
| Weight offer after deleting the weighing it created | The offer comes back | The phone still has a newer weighing; dismissing it would need more state for little gain |
| Android: ride distance | Taken from the app that recorded the ride first; from all sources only if that is zero. Two copies of one ride (starts within 10 min) → the longer one is sent | Otherwise a higher-priority phone pedometer could report a few hundred metres of „walking" instead of the ride |
| Android: clipboard | Cleared after a valid key is pasted | The key should not linger for other apps |
| Android: throttle and retries | 15 minutes from the last *successful* send; a failure retries on the next open; the hourly job cancels itself when background permission is revoked | Failures should not wait a quarter of an hour; no work without permission |
| Android: release build | Not shrunk (no R8), ~11 MB | Health Connect keep rules could not be verified without a device |
| iOS: language mode | Swift 5 with complete concurrency checking; code also compiles clean in Swift 6 | A future SDK annotation change gives a warning, not a broken build |
| iOS: sleep | Union of asleep intervals minus union of awake intervals; a night belongs to the local day it ends; same-day naps add to it | iPhone and Apple Watch both write the same night |
| iOS: cycling distance | `statistics(for: .distanceCycling)`, falling back to `totalDistance` | Some apps still write workouts the old way |
| iOS: read errors | A failed query for one type leaves that field empty; only a locked phone (`errorDatabaseInaccessible`) stops the send; nothing at all → nothing sent, „Zdrowie nie oddało żadnych danych — sprawdź dostęp" | HealthKit never says whether read access was denied |
| iOS: day keys | Always Gregorian `yyyy-mm-dd`, whatever calendar the phone uses | The PWA expects Gregorian dates |
| iOS: device | iPhone only, `UIRequiredDeviceCapabilities: healthkit`, Polish system buttons (`CFBundleLocalizations: pl`) | iPad has no Health data for most people; „Wklej" should read in Polish |
| No emulator run | Not attempted | No Android system image installed and 20 GiB free on a 96 % full disk; an image with an AVD takes ~8 GB |
