# Garmin watch sync — design

Date: 2026-10-08 · Status: approved in conversation (architecture, privacy model, conflict rule)

## Goal

Garmin watch numbers reach GYM TRACKER without typing: daily steps, rides, heart rate,
stress, Body Battery and sleep score. For every app user with a Garmin watch, not only the author.

## Constraints that shaped the design

- **Garmin's official Health API is closed to us.** Business entities only, and new
  applications have been paused since spring 2026 ("Under Construction"). Unofficial
  Garmin Connect logins are out: they store the user's password and break Garmin's terms.
- **A PWA cannot read Apple Health or Health Connect.** A native wrapper would end the
  GitHub Pages distribution model.
- **The app has no accounts and keeps all data in the browser.** The existing Cloudflare
  Worker (`server/api`) holds nothing about people. Heart rate, sleep and stress are
  special-category health data (GDPR art. 9), so the server must not be able to read them.

## Decisions

| Topic | Decision |
| --- | --- |
| Data path | Own Connect IQ watch app → existing Worker → PWA |
| Privacy | End-to-end encrypted mailbox; the Worker stores only data it cannot read |
| Pairing | App generates a 256-bit secret; user pastes it into the watch app's settings in Garmin Connect Mobile |
| Transport | The watch sends a snapshot of the latest 7 days every 30 min; the Worker keeps only the newest package per mailbox |
| Steps conflict | Typed and watch steps are both kept; **the higher number counts** for that day |
| Rides | Watch cycling activities with distance become `bike` entries |
| Runs/walks | Not imported as entries: their steps are already in the daily steps (double counting) |
| HR / stress / Body Battery / sleep | Shown on the cardio screen as "Z zegarka", without XP or badges |
| Minimum watch | Connect IQ 3.2: background `Storage` writes, AES-256, HMAC-SHA256 |

## Architecture

```
PWA (browser)                         Worker (Cloudflare, D1)            Watch (Connect IQ ≥ 3.2)
─────────────                         ───────────────────────            ────────────────────────
Settings → "Połącz zegarek"
  S = 32 random bytes (hex, 64 chars)
  kept in localStorage, never exported
  user copies S ─────────────── pasted into watch app settings (Garmin Connect Mobile) ──► S

  box = hex(HMAC(S,"gt-box"‖01))[0..32]                                   same derivation
  enc = HMAC(S,"gt-enc"‖01)  (AES-256 key)
  mac = HMAC(S,"gt-mac"‖01)  (HMAC key)
                                                                        every 30 min (background):
                                                                        collect 7 days → JSON
                                       ◄── POST /garmin/push ─────────── seal → {box, blob}
                                       upsert row (box, blob, updated)
  on open / back to tab:
  POST /garmin/pull {box} ───────────► {blob, updated} | 404
  verify HMAC, decrypt, validate
  → state.watch (merged) → cardioOf() derives entries → calories, XP, badges
                                       cron: delete rows silent > 7 days
```

### Envelope (watch seals, app opens)

- Plaintext: ASCII JSON (payload v1 below), PKCS#7 padded to 16 bytes, because Connect IQ
  CBC needs whole blocks.
- `envelope = 0x01 ‖ iv(16) ‖ AES-256-CBC(enc, iv, plaintext) ‖ HMAC-SHA256(mac, 0x01 ‖ iv ‖ ct)`
- `blob = base64(envelope)` (standard alphabet, padded).
- Encrypt-then-MAC. The app checks the tag with `crypto.subtle.verify` (constant time) before
  decrypting. WebCrypto's AES-CBC removes the PKCS#7 padding.
- Key derivation is HKDF-Expand with a single block and no Extract step, which RFC 5869
  allows because S is already uniformly random. Connect IQ has HMAC but no HKDF.
- Replays are ignored: the app applies a payload only if its `t` is newer than the last one applied.

### Payload v1 (plaintext JSON)

```json
{
  "v": 1,
  "t": 1791460000,
  "d": [["2026-10-08", 9120, 7340, 12, 35]],
  "a": [[1791450000, 2, 3600, 25000]],
  "h": [["2026-10-08", 52, 48, 71, 142, 31, 25, 88, 82]]
}
```

- `t` — sync time, unix seconds.
- `d` — up to 8 days (today + 7): day, steps, distance m, floors climbed, active minutes.
- `a` — up to 20 activities from the last 14 days: start (unix s), `Activity.Sport`, duration s, distance m.
- `h` — up to 8 days: day, 7-day average resting HR, HR min, avg, max, average stress,
  Body Battery min, max, sleep score.
- Any number may be `null` (sensor missing, older watch). The app drops invalid items one
  at a time instead of rejecting the whole payload.

## Components

### Worker (`server/api`)

- Table `garmin (box PK, blob, updated, created, ip_hash)` with indexes on `(ip_hash, created)` and `updated`.
- `POST /garmin/push {box, blob}`
  - Validates: box `^[0-9a-f]{32}$`; blob is base64, 80–12 000 chars.
  - 429 if the same box was written less than 60 s ago.
  - Creating a new box: 429 if the same IP hash created ≥ 20 boxes in the last hour.
  - Replies `200 {"ok":true}`, because the watch's JSON response handling expects a body.
- `POST /garmin/pull {box}` → `200 {blob, updated}` or 404. CORS for the app origin, as today.
- `POST /garmin/forget {box}` → 204, deletes the row.
- `tick` additionally deletes boxes with `updated` older than 7 days.
- `Store` gets `putBox`, `getBox`, `removeBox`, `recentBoxes`, `pruneBoxes` (memory + D1).
- Cost: 48 writes per watch per day, against the 100k/day D1 free tier ≈ 2 000 active watches.

### PWA

- `src/garmin.ts` (browser layer, like `push.ts`)
  - Secret lifecycle in `localStorage` (`gt-garmin-key`).
  - Key derivation, `seal` (reference implementation of the watch side, used by tests) and `open`.
  - `pullWatch()`, throttled to once per 60 s.
  - `forgetWatch()`.
  - Configured only when the build has `VITE_API_URL` and `VITE_GARMIN_APP_URL` (the Connect IQ
    store link), in the same way reminders need `VITE_VAPID_PUBLIC_KEY`.
- `src/engine/watch.ts` (pure)
  - `parsePayload` (validation, ranges).
  - `mergeWatch(state, payload)`: newer `t` wins. Days replace their own day and older days
    are kept. Activities upsert by start; health upserts by day.
  - `watchCardio(state)`: derived `steps` and `bike` entries, marked `src: 'watch'`.
  - `validWatchData` for loading and import.
- `src/engine/cardio.ts`
  - `cardioOf(state)` becomes the **effective** list: manual entries + watch rides + one steps
    entry per day, whichever of manual/watch is higher (a tie keeps the manual entry).
  - `removeCardio` works on `state.cardio` only, so watch entries cannot be deleted.
  - Everything downstream (burn, XP, badges, stats) is unchanged.
- `AppState.watch?: WatchData` is persisted and exported (it is the user's data, not a secret).
- UI
  - `GarminCard` in Settings: connect, show/copy key, paste an existing key from another
    device, setup steps, last sync, "Sprawdź teraz", disconnect.
  - Cardio list rows from the watch: "z zegarka", no delete button.
  - Steps and bike forms: a note when the watch already reported that day.
  - "Z zegarka" group on the cardio screen: 7 days of resting HR, HR range, stress, Body
    Battery and sleep, with a dry medical note from `Health.tsx`.
- `App.tsx`: pulls on open and on return to the tab. On new data: merge, revoke/sync badges,
  announce badges and level-ups as with a manual entry.

### Watch app (`garmin/`)

- Monkey C, `type="watch-app"` with a glance, `minApiLevel 3.2.0`.
- Permissions: Background, Communications, SensorHistory, UserProfile.
- Foreground: registers a 30-min temporal event, shows status (key missing / last send / error)
  and "Wyślij teraz".
- Background (`:background`): aggregates HR, stress and Body Battery samples since the last run
  into per-day buckets in `Application.Storage`. It reads steps history, activities,
  `averageRestingHeartRate` and sleep score (Complications, only if present), builds the JSON,
  seals it and POSTs it. `Background.exit(code)` passes the result to the foreground.
- Every API newer than 3.2 is guarded with `has` checks. Sleep score is also wrapped in try/catch.
- The API URL is a hidden property set at build time; the key is a user setting.

## Error handling

| Case | Behaviour |
| --- | --- |
| No phone nearby / no network | Watch: request fails; the next run resends the full 7-day snapshot. App: silent, retries on the next open |
| Wrong or mistyped key on watch | Watch writes to a box nobody reads; app card says "Jeszcze nic nie przyszło" with the setup steps |
| Tampered or garbage blob | HMAC fails → app ignores it, card shows "Dane z zegarka nie dały się odczytać — sprawdź klucz" |
| Older watch without stress/BB/sleep | `null` fields; UI shows "—" |
| Watch steps lower than typed | Typed number counts (max rule); form note explains |
| Watch steps for a day go down (watch reset) | Newest snapshot replaces the day; badges revoked like a manual correction |
| Disconnect | Box deleted, key forgotten; data already received stays in history |

## Testing

- `server/api/garmin.test.ts`: validation, upsert, pull/forget, per-box and per-IP limits,
  CORS, prune in `tick`.
- `src/garmin.test.ts`: derivation and envelope checked against an independent `node:crypto`
  implementation; round trip; tampering rejected; fixed test vector shared with the Monkey C test.
- `src/engine/watch.test.ts`: parsing ranges, merge ordering, max rule, ride mapping, no deletion
  of watch entries, badge and XP effects.
- Watch: `(:test)` vector test in `garmin/test/`, run in the Connect IQ simulator. Not in CI,
  because the SDK needs a Garmin login.

## Out of scope

- Runs and walks as separate entries (steps already contain them).
- XP or badges from heart rate, stress or sleep.
- Writing data back to Garmin.
- Syncing app data across devices (pasting the same key on a second device only gives it the same watch data).
- Changing the 19:30 reminder (treadmill and dance still need typing).

## Unverified until compiled

The Connect IQ SDK is not installed here (downloading devices needs a Garmin login), so the
watch app is written against the API docs and has not been compiled. First build: follow
`garmin/README.md` and run the `(:test)` vector in the simulator before publishing.

## Changes after review (2026-10-08)

- **Sleep score dropped.** The compiler rejects `Toybox.Complications` in a `watch-app`
  (`ComplicationSubscriber` is valid only for watch faces), so the watch sends `null` in the
  sleep slot. Payload v1 is unchanged and the app still renders sleep if it ever arrives.
- **`/garmin/push` errors are JSON.** Connect IQ reports a non-JSON body as −400 when JSON was
  requested, which would hide 429/400 from the watch.
- **Activity start times** before 2000 are shifted by the FIT epoch (a Garmin firmware bug), and
  up to 300 history items are scanned.
- **Modal queue** in `useModal`: a background watch pull no longer replaces an open dialog (which
  used to leave the awaiting code hanging). Pulls landing during a session are ignored.
- **Reset disconnects the watch**, so "Usuń wszystkie dane" is not undone by the next pull.
- **Character mood**: a watch day counts as activity only when it yields movement minutes.
