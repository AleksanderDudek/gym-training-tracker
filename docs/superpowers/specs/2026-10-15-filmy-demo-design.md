# Demo videos per user need — design

Date: 2026-10-15 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request

Record Playwright videos that show how the app answers different user needs. Each video must be
**25–45 s (hard requirement)**. First find the angles (who uses the app and why), turn each need
into a scenario, record it, and write a description per video for post-production in Claude
Desktop. Everything goes into a separate folder, one `.md` per video.

## Needs → scenarios

From the feature map (README, routes, screens). Each scenario is one need, one persona, one story
with a beginning (the problem), a middle (the app at work) and an end (the result on screen).

| # | Need (user's words) | Persona | Shown |
| --- | --- | --- | --- |
| 01 | „Nie wiem, kiedy dołożyć ciężaru” | gym regular stuck at the same weights | guided session: target pre-filled, rest timer, effort question, summary ▲ next weight |
| 02 | „Chcę zacząć od zera, w domu, bez sprzętu” | beginner, no gym | workout library filter „Bez sprzętu”, preview, 30-day plan start |
| 03 | „Nie wiem, jak dobrze zrobić to ćwiczenie” | beginner afraid of doing it wrong | exercise atlas: animated mannequin, scrubber, „Na co uważać” |
| 04 | „Chcę własny trening, ale czy on ma sens?” | experienced, likes control | workout creator: live muscle bars, advisor, order by the rules |
| 05 | „Siedzę cały dzień przy biurku” | office worker | movement snack logged in seconds, badge, steps with live kcal |
| 06 | „Potrzebuję motywacji, żeby nie odpuścić” | needs rewards | achievements shelf, nearest badges, level, share certificate |
| 07 | „Zawsze rzucam po dwóch tygodniach” | on-and-off trainee | running plan: calendar, points, rank, today's session |
| 08 | „Jestem na redukcji — kalorie i białko” | cutting | diary: target, macro bars, „Co teraz?”, progress chart with forecast |
| 09 | „Jem na mieście, np. w KFC” | busy, eats out | restaurant menus: KFC, most protein, fits/doesn't fit, add to diary |
| 10 | „Robię zakupy w jednym sklepie” | shops at Biedronka | high-protein recipes bought in one store, ingredient swap, by-store layout |
| 11 | „Który skyr ma najwięcej białka?” | label reader | products: search, sort by protein, filters, Nutri-Score, detail with prices |
| 12 | „Jem ciągle to samo” | creature of habit | favourites: star, quick pick „+ Zjadłem”, favourites first |
| 13 | „Co kupię tu, w pobliżu?” | travelling / new area | nearby: map, radius, recipes bought in one nearby shop |

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Tool | Playwright 1.63 (pinned dev dependency; its Chromium is already on the machine), scripts in `scripts/demo-videos/`, `npm run demo:videos` | Reproducible: re-record after UI changes with one command |
| Picture | Phone portrait 390×844 CSS px at **2×** → **780×1688**, browser started with `--force-device-scale-factor=2` | Playwright's own `recordVideo` and the screencast give 1× frames (blurry text); a real device scale makes the screencast deliver sharp 2× frames |
| Capture | `page.screencast.start({ onFrame })` — frames only when the picture changes, each with its time; started after setup, stopped after the last beat | No loading screens or setup in the take; exact timing |
| Encoding | ffmpeg concat with per-frame durations → constant **30 fps**, H.264 High, CRF 16, yuv420p, faststart, no audio | Plays everywhere, edits cleanly, sharp UI text |
| Length | Each scenario paced for ~32–40 s; the runner fails a take outside 25–45 s (ffprobe) | The hard requirement is checked, not hoped for |
| Human pace | Smooth eased scrolling, a pause before each tap, typing at ~95 ms a key, time to read results | Viewers must follow every action |
| Touches | A grey ring where a finger taps (like iOS "Show touches"), drawn as a top-layer popover so it shows over dialogs too | Without a cursor, taps are invisible on a phone recording |
| Overlays | None baked in besides touches | Captions, zooms, voice-over and music belong to post-production |
| Data | A fictional demo user seeded before the camera rolls through the app's own state and diet stores (no real person, no real account) | Real screens with history, badges and a diary; nothing staged in the UI |
| Time | `page.clock.install` at a fixed local time per scenario (Europe/Warsaw, pl-PL), data dated relative to it | Same picture on every re-record; food copy depends on the hour |
| Network | Product photos, map tiles, Overpass and YouTube thumbnails served from a disk cache (`node_modules/.cache/demo-videos`), fetched for real once | No slow tile or rate limit in the middle of a take |
| Service worker | Blocked in the recording context | Always the fresh build, no update bar |
| Description | Generated per take from the scenario's copy + the take's measured beats: need, persona, problem, solution, key message, timeline (in/out, on screen, captions PL/EN, voice-over PL/EN, edit notes), taps with zoom boxes in video pixels, hook, closing card, music, contact sheet | Timestamps always match the video; Claude Desktop reads text and images, not video — the contact sheet shows every beat |
| Folder | `demo-videos/`: `NN-slug.mp4`, `NN-slug.md`, `NN-slug.jpg` (contact sheet), `README.md` (needs, index, shared post-production guide) | One place for the material, as asked |
| Git | `.md` files and scripts committed; `.mp4`/`.jpg` ignored (re-created by the script) | Binary video does not belong in the app's repository |
| Languages | Descriptions in English (instructions for the editor), captions and voice-over in Polish (the app's language) with English versions | The app and its audience are Polish; the editor works in English |

## Result (2026-10-15)

- 12 videos recorded, 30–34 s each (01–12), 780×1688, 30 fps.
- **13 not recorded:** every public Overpass server (overpass-api.de, overpass.private.coffee, and the kumi.systems and mail.ru mirrors) answered 406/500/502/504 all day. Record it once they answer; the cache keeps the answer.
- Findings while recording:
  - The ffmpeg concat demuxer holds the repeated last frame for as long again. Takes are cut with `-t`, and the file's length is checked against the take's.
  - Two flows needed exact accessible names: „Odtwórz” vs „Odtwórz: …” (YouTube thumbnails), and the group „Sklep” vs „Sklep dla: …”.
  - tsx's `__name` helper has to exist in the page for functions sent to it.
- Voice-over lines are checked against their beats at 2.5 words/s; none overruns in the final descriptions.

## Out of scope

Audio, final edits, uploading anywhere, Garmin and reminder features (they need the private server),
the Excel meal plan (needs a real workbook).
