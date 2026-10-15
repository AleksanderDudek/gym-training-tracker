# GYM TRACKER — demo videos per user need

Screen recordings of the app, one per user need. Each is a 25–45 s phone-screen video recorded
with Playwright, and each has a description for post-production. The material is raw: no
captions, voice-over or music yet. That is the post-production step, for example in Claude
Desktop.

## What is in this folder

| File | What it is |
| --- | --- |
| `NN-slug.mp4` | The video: 780×1688 (a 390×844 phone screen at 2×), 30 fps, H.264 High, BT.709, no audio. |
| `NN-slug.md` | The description: the need, persona, problem and how the app helps, a timeline of beats with this take's real timestamps, captions and voice-over in Polish and English, edit notes, tap coordinates with zoom boxes, hook, closing card and music. |
| `NN-slug.jpg` | Contact sheet: one still per beat with its time range. Claude Desktop can read images but not video, so this is how it "sees" each beat. |
| `README.md` | This file: the needs analysis, the index and the shared post-production guide. |

The `.mp4` and `.jpg` files are not in git. They are rebuilt by `npm run demo:videos` (see
[Re-recording](#re-recording)). The descriptions are committed.

## Why people use the app — the angles

GYM TRACKER is a Polish, phone-first app for strength training with automatic progression,
plus a food diary built around real Polish products, recipes and restaurant menus. It has no
account and no backend: data stays on the phone. Its users fall into two families of needs.

**Training**

| # | Need, in the user's words | Who | What answers it |
| --- | --- | --- | --- |
| 01 | „Nie wiem, kiedy dołożyć ciężaru” — *I never know when to go heavier* | gym regular stuck at the same weights | guided session with pre-filled targets, rest timer, effort question; the engine decides reps vs. weight |
| 02 | „Chcę zacząć od zera, w domu, bez sprzętu” — *start from zero at home* | beginner, no gym | 30/60/90-day goal plans filtered by equipment, started in three taps |
| 03 | „Nie wiem, jak dobrze zrobić to ćwiczenie” — *am I doing it right?* | beginner afraid of bad form | exercise atlas: key cues, difficulty stages, animated figure frame by frame |
| 04 | „Chcę własny trening, ale czy on ma sens?” — *my own workout, but is it sound?* | experienced, likes control | workout creator with a live advisor: sets per muscle, order by the rules |
| 05 | „Siedzę cały dzień przy biurku” — *I sit all day* | office worker | movement snacks and steps, counted toward XP and badges |
| 06 | „Potrzebuję motywacji, żeby nie odpuścić” — *I need motivation* | needs visible wins | badges with real dates, trophy shelf, numbers in human terms, a character that levels up |
| 07 | „Zawsze rzucam po dwóch tygodniach” — *I always quit after two weeks* | on-and-off trainee | a plan with dates, points, rank and a journal, that forgives and lets you make up a missed day |

**Food**

| # | Need, in the user's words | Who | What answers it |
| --- | --- | --- | --- |
| 08 | „Jestem na redukcji — kalorie i białko” — *cutting: calories and protein* | lifter on a cut | diary with a target that adapts to the week, „Co teraz?” suggestions, weight forecast |
| 09 | „Jem na mieście, np. w KFC” — *I eat out* | busy, eats out | menus of 18 chains from their own tables, rated against your diet, logged in one tap |
| 10 | „Robię zakupy w jednym sklepie” — *I shop at one store* | shops at Biedronka | high-protein recipes made from real products of one store, ingredient swaps, shopping plans by store |
| 11 | „Który skyr ma najwięcej białka?” — *which product has the most protein?* | label reader | 32,000 Polish products: search, sort, table, filters, full label with price |
| 12 | „Jem ciągle to samo” — *I eat the same things* | creature of habit | favourites with a star, one-tap „+ Zjadłem”, first in search |

**Not recorded: 13 „Co kupię tu, w pobliżu?”** (*what can I buy around here?*). The „W pobliżu”
page finds shops on a map through the public OpenStreetMap Overpass servers. On the recording
day (2026-10-15) all of them returned errors (406, 500, 502, 504), so there was no real data to
show. The scenario is in the design notes. Record it on a day the servers answer; the recorder
caches their response for later takes.

Things the app does that are not filmed: the Excel meal plan (it needs a real dietitian's
workbook), Garmin sync and reminders (they need the private server), and sharing (the system
share sheet is not part of the page).

## Videos

<!-- videos:start -->
| Video | Need | Length |
| --- | --- | --- |
| [01-kiedy-dolozyc-ciezar](01-kiedy-dolozyc-ciezar.md) | When to add weight — the app decides | 30.8 s |
| [02-start-od-zera-w-domu](02-start-od-zera-w-domu.md) | Starting from zero, at home, no equipment | 31.8 s |
| [03-technika-cwiczenia](03-technika-cwiczenia.md) | How to do the exercise right | 31.0 s |
| [04-wlasny-trening-z-doradca](04-wlasny-trening-z-doradca.md) | Your own workout, checked as you build it | 32.6 s |
| [05-ruch-przy-biurku](05-ruch-przy-biurku.md) | Moving more at a desk job | 31.4 s |
| [06-motywacja-odznaki](06-motywacja-odznaki.md) | Motivation you can see | 30.8 s |
| [07-plan-pilnuje-terminow](07-plan-pilnuje-terminow.md) | A plan that keeps you on schedule | 30.9 s |
| [08-redukcja-kalorie-bialko](08-redukcja-kalorie-bialko.md) | Cutting: calories and protein under control | 32.6 s |
| [09-jem-na-miescie](09-jem-na-miescie.md) | Eating out without wrecking the diet | 33.2 s |
| [10-przepisy-z-jednego-sklepu](10-przepisy-z-jednego-sklepu.md) | High-protein recipes from the shop you go to | 31.8 s |
| [11-ktory-skyr-ma-najwiecej-bialka](11-ktory-skyr-ma-najwiecej-bialka.md) | Which skyr has the most protein? | 30.2 s |
| [12-ulubione-szybki-wybor](12-ulubione-szybki-wybor.md) | Favourites: what I eat most, one tap away | 30.7 s |
<!-- videos:end -->

## Post-production guide

Shared rules for every video. Each video's `.md` adds its own hook, captions, voice-over,
zoom targets and music.

**Format**
- The source is a portrait phone screen, 780×1688 (ratio ≈ 0.46).
- **9:16 (Reels, TikTok, Shorts, 1080×1920):** scale the video to 1920 px high (≈ 887×1920) and centre it on a background of the app's colour `#D7D9D3`. Captions go in the side margins or over the top 12% / bottom 15%. Keep them clear of the app's own header (top ≈ 7%) and tab bar (bottom ≈ 8%).
- **4:5 (feed, 1080×1350) or 16:9 (1920×1080):** put the video in a phone frame mockup at ~85% of the height. Text goes beside the phone in 16:9, above and below it in 4:5.
- To zoom, use the box from the "Taps" table. It is in source pixels, so scale it with the video.
- The grey rings are touches and are part of the picture. Do not add another cursor.

**Length.** The source is 25–45 s, and the edit must stay in that range. Trim pauses inside a beat, not across a tap: the viewer must see both the tap and its result. Video 01 contains time cuts (the rest timer jumps), marked in its edit notes.

**Brand** (from the app's own tokens)
- **Background:** `#D7D9D3`.
- **Ink:** `#1E2320`.
- **Cards:** `#FAFAF8`.
- **Accents:** orange `#d97757`, gold `#d9a157`, green `#2C6849`, blue `#6a9bcc`.
- **Type:** captions in **Oswald** (the app's display face, uppercase, slight letter-spacing); body text in **IBM Plex Sans**.

**Captions**
- At most two lines of about 28 characters.
- Each caption stays on screen for at least 1.2 s.
- Polish by default (the app is Polish); the English lines are there for an English cut or subtitles.

**Voice-over.** About 2.5 words a second, calm and friendly. The lines are written to fit their beats; if a line runs long, shorten the line rather than stretching the beat.

**Structure.** Each video opens on its hook caption (first ~3 s, over the first beat) and ends on a closing card (last 2–3 s). The suggested closing card is the app name plus the line from the `.md` — „GYM TRACKER — …”.

**Music.** Each `.md` names a mood and tempo. Keep it under the voice-over (−18 to −20 LUFS for the bed).

**Data and names**
- **People:** none. Everything on screen belongs to a fictional demo person: 7 weeks of training generated through the app's own engine, plus a food diary.
- **Brands:** shop and restaurant names (KFC, Subway, Biedronka, Lidl…) and product photos are real app content. The photos come from Open Food Facts (CC BY-SA). Check how a brand appears before using the clip in paid ads.
- **YouTube:** the exercise pages list third-party technique videos. These takes do not show them.

**Working in Claude Desktop.** Attach the video's `.md` and `.jpg` and give the path to its `.mp4`. Ask for the cut you want (for example "9:16 with Polish captions and the voice-over script"). The timeline, zoom boxes and stills cover everything that needs to be known about the footage.

## Re-recording

```bash
npm run demo:videos                 # build, then record every video (≈ 1 min each)
npm run demo:videos -- 03 08        # only these
npm run demo:videos -- --skip-build # reuse dist/ when the app has not changed
npm run demo:seed                   # rebuild the demo person — only after a change to the data model
```

**Requirements:** ffmpeg and ffprobe on the PATH, and Playwright's Chromium (`npx playwright install chromium`).

**How a take works**
- Each video gets a fresh browser profile, so takes are independent.
- The demo data is imported through the app's own „Importuj plik”.
- The clock is set to the scenario's moment on 2026-10-15, so a re-record shows the same day.
- The take is checked against the 25–45 s limit, and a take outside it fails.
- Product photos and map data come from a disk cache (`node_modules/.cache/demo-videos`), fetched for real the first time.

**Where things live**
- Scenarios: `scripts/demo-videos/scenarios/`. Each holds its own copy (captions, voice-over, edit notes), so its description and its take always match.
- Design notes: `docs/superpowers/specs/2026-10-15-filmy-demo-design.md`.
