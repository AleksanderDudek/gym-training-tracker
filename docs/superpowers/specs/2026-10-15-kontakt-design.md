# Contact button („Kontakt”) — design

Date: 2026-10-15 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request

"Add a button close to the share comment/message button that is another way of contacting. It
should contain: my private Instagram address; for PL my Discord server
https://discord.gg/U6jCW6tvg; another link for supporting (depending on whether it is PL or
another country)."

## What exists

- The app bar has „Napisz do autora” (a speech bubble, `TopBar` → `FeedbackDialog`) on every
  screen — only when the feedback server is configured (`VITE_API_URL`).
- Ustawienia has „Uwagi i błędy” with the same „Napisz do autora”.
- Support goes to one address, `SUPPORT_URL = https://buycoffee.to/uriel` (a Polish service):
  the thin strip under the app bar and the „Rada dnia” banner at the bottom of the tabs.
- The author's other app (Teleo) uses buycoffee.to for Polish users and
  `https://buymeacoffee.com/atd_uriel` for everyone else (owner request 2026-10-05).
- The UI is Polish only; there is no language setting.
- The CSP test lists every outside host the code names; plain links go in its `NAVIGATION` set.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Entry | An „@” button in the app bar right before the speech bubble, label „Kontakt z autorem”; **always** shown (no server needed), except during a session | Next to the other way of writing to the author, as asked; links need no server; during a set the bar keeps only the clock |
| Window | A sheet like „Napisz do autora” (bottom sheet on phones, centred on wide screens), Escape and backdrop close it, focus goes to the first link and back to the button | Same pattern the app already uses for contacting the author |
| Contents | Instagram (everyone) · Discord server (Poland only — the server is Polish) · support (Poland: buycoffee.to; elsewhere: buymeacoffee.com) · „Napisz do autora” when the feedback server exists | What was asked, plus the in-app message as the first alternative |
| Poland or not | Poland when a preferred browser language is Polish **or** the time zone is `Europe/Warsaw` | No country is known without asking for location; language + zone is private, instant and covers Poles abroad and foreigners in Poland well enough for a link choice |
| Support everywhere | The strip and the banner use the same country rule (their visible address follows the link) | One person should not see two different jars |
| Instagram address | One constant `INSTAGRAM_URL`. It was not known at first (not in the request, the repo, other projects or the GitHub profile), so the row stayed hidden while it was `null`. The owner then gave `https://instagram.com/aleksanderdudek` (2026-10-15): first row, for everyone | No guessing someone's account |
| Links | New tab, `rel="noopener noreferrer"`, visible host under each name | Standard for outside links; the user sees where they go |
| Settings | Ustawienia gets a „Kontakt” section with the same links | Discoverable without hunting for an icon |
| CSP | instagram.com, discord.gg and buymeacoffee.com join the navigation-only hosts | Links only, nothing is fetched |

## Testing

Country rule (languages, time zone, empty), links per country (Discord only in Poland, the right
jar, Instagram hidden while unknown and first when set), the app-bar button (absent in a
session), the sheet (opens, focus, Escape, links, „Napisz do autora” hands over), the support
strip and banner per country, the CSP list.

## Out of scope

A language switch, geolocation, any counting of clicks.
