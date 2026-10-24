# Publishing GYM TRACKER on the Connect IQ Store

Everything needed for the public release of the watch app. Garmin’s developer dashboard moved to
**https://apps-developer.garmin.com** in 2026; apps are installed only through the **Connect IQ
Store** phone app.

## What is in this folder

| Path | Use |
| --- | --- |
| `listing.md` | Text for every field of the store form (English, plus a Polish description) |
| `review-notes.md` | Note for Garmin’s reviewers: what the app does and how to test it in 3 minutes |
| `hero/hero-en.png`, `hero/hero-pl.png` | Hero image, 1440×720 (source: `hero/hero.html`) |
| `screenshots/` | Store screenshots (web app ones are ready; the watch ones take 2 minutes — see `screenshots/README.md`) |

Outside this folder:

| Path | Use |
| --- | --- |
| `bin/gymtracker.iq` | Production package — `./build.sh store` |
| `bin/gymtracker-beta.iq` | Beta package — `./build.sh beta` |
| `../public/privacy.html` | Privacy policy, live at https://aleksanderdudek.github.io/gym-training-tracker/privacy.html once deployed |
| `~/.garmin/developer_key.der` (+ `.pem`) | Developer key. **Back it up.** Every version must be signed with it |

## Beta and production are two different apps

| | Beta | Production |
| --- | --- | --- |
| App ID (manifest) | `be917461ce72434087a9d8225b2948c4` | `23e4c6b5e09245379ec788ddc26b4c2a` |
| Build | `./build.sh beta` | `./build.sh store` |
| Upload | “Beta App” ticked | “Beta App” **not** ticked |
| Who can install | only the developer account | everyone, after Garmin’s review |
| Store link | https://apps.garmin.com/apps/c08428fa-5a13-4c1f-b333-35ef62721cb3 | https://apps.garmin.com/apps/681b79f1-3575-4375-9836-a5ec600abab4 (approved 2026-10) |

Garmin cannot turn a beta into a public app, and it rejects the same app ID for both, so the
production manifest has its own ID. `./build.sh beta` swaps in the beta ID for the beta package.

## Checklist

Before submitting:

- [ ] The beta works on your watch: data reaches GYM TRACKER (`./build.sh beta`, upload as a new
      version of the beta app, install, paste the key, START, “Sprawdź teraz” in the web app).
- [ ] The privacy policy page is live (deployed from `main`).
- [ ] Watch screenshots taken (`screenshots/README.md`).
- [ ] Developer key backed up.

Submitting:

1. `cd garmin && ./build.sh store` → `bin/gymtracker.iq`.
2. https://apps-developer.garmin.com → upload `bin/gymtracker.iq`, **without** “Beta App”.
   “Signature check failed” next to “Status: Verified” on the very first upload of an app is a
   known Garmin bug with SDK 9.2.0 (CIQQA-4716); continue.
3. Fill in the details from `listing.md`: title, description, What’s new, category, price (free),
   website, privacy policy, support link; screenshots from `screenshots/` (English set for the
   English locale, Polish set for Polish if the form allows per-locale images); hero image from `hero/`.
   Trader status: not a trader (free, no payments).
4. Add `review-notes.md` as the note for reviewers, if the form has a field for it.
5. Submit. While the review is pending the app can be downloaded for testing but is not listed.

After approval:

1. Copy the store link of the **production** app.
2. The web app’s Garmin card has that link in its code (`GARMIN_STORE_URL` in `src/garmin.ts`,
   already the production page above), so a normal deploy of `main` is enough. The repository
   variable `GARMIN_APP_URL` only overrides it — for example with the beta link while testing —
   and can be deleted otherwise (`gh variable delete GARMIN_APP_URL`, then `gh workflow run Deploy`).
   The card itself appears whenever the build knows the server (`API_URL`).
3. From now on settings of the app are also in Garmin Connect (watch → Activities & Apps →
   GYM TRACKER → Settings), not only in the Connect IQ Store app.

Updates: change the code, `./build.sh store`, then upload a new version of the **production** app
in the dashboard (same app ID, same developer key).
