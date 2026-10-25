# Demo videos for the new features (13–19) — design

Date: 2026-10-25 · Status: decided autonomously on request ("zerknij w te filmiki … chcę mieć nowe
filmiki odnośnie nowych funkcjonalności, zrób je w podobny sposób, użyj marketing skills … Analyze
current system. Use best practices. Pick recommended. I am away from machine. Plan it out and then
finish on your own").

## What "the same way" means

The earlier set (01–12, 2026-10-15) is in two layers:

1. **Raw takes** from `npm run demo:videos`, which writes `demo-videos/NN-slug.{mp4,md,jpg}`. They are
   780×1688 phone recordings with a description for post-production. See
   `2026-10-15-filmy-demo-design.md`.
2. **Final cuts** outside the repo, in `~/Downloads/GYM-TRACKER/demo-videos/final/` (also on Google
   Drive): 1080×1920 at 30 fps.
   - The phone sits on the app's grey; zooms ease in and out.
   - An orange hook card (Oswald) opens the cut, dark caption pills carry one caption per beat with
     numbers in gold, and an orange ring highlights what matters.
   - The cut ends on a dark closing card.
   - Sound is a music bed from Apple Loops plus synthesized UI effects, at −16 LUFS.
   - The pipeline is `final/_postprod/render.py`, driven by `edits.py`.

The new videos reuse both layers unchanged: the same recorder, the same renderer and the same
look.

## Needs → scenarios

The features are the ones added since 2026-10-15 that a user can see. Each is framed as a need in
the user's own words, like 01–12.

| # | Need (user's words) | Feature shown |
| --- | --- | --- |
| 13 | „Głodny na mieście — co zjeść?” | W pobliżu → „Zjedz teraz”: places and dishes nearby that fit what is left of today, from the app's own OSM copy |
| 14 | „Trzy jogurty. Który wziąć?” | Barcode scanner with a comparison: macros per 100 g and per pack, a ranking for the goal, „Zjadłem” |
| 15 | „Gotuję w niedzielę. Co kupić?” | „Plan z listą zakupów”: a 7-day plan for the goal, cooking ahead, a shopping list by aisle, the plan in the diary |
| 16 | „Pizza wieczorem? A redukcja?” | „Większy posiłek”: items picked from the menus, the effect before eating, the rest of the day adapting |
| 17 | „Zostało 1650 kcal. Co zjeść?” | „Reszta dnia”: whole rest-of-day variants that add up to what is left, recalculated after eating |
| 18 | „Trzymam dietę, a waga stoi?” | Postęp: the weight trend instead of single weigh-ins, the pace ±, week by week, the Monday rule in „Jak liczę cel” |
| 19 | „Przepisujesz kroki z zegarka?” | „Czy mój zegarek jest obsługiwany?” (118 Garmin watches, typo-tolerant), connection steps, the Android phone alternative |

Not filmed:
- The English UI: the audience is Polish.
- The Monday check card: it shows only on a Monday or Tuesday with a pending check. Video 18 shows
  the rule instead.
- Live watch data: it needs a paired device and the private server.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Production | Same recorder and the same 9:16 renderer as 01–12; scenarios 13–19 in `scripts/demo-videos/scenarios/`, edits in `final/_postprod/edits_nowe.py` | "In a similar way": the new set matches the old one shot for shot |
| Authoring | One agent per scenario, working in parallel, each on its own preview port (`DEMO_PORT`); the final takes are recorded one after another on a quiet machine | Takes recorded under load drop frames and jerk |
| Seed | The existing `full` person (2026-10-15), imported through the app; the one-off „Liczenie kalorii jest teraz prostsze” notice is dismissed in `lib/seed.ts` | The data model migration works on the old backup, and a returning person has read the notice |
| Scanner camera (14) | `getUserMedia` returns a canvas stream: a blurred shelf, a label with a real EAN-13 of a real product, hand shake and a focus pull. The app's own reader decodes it (native `BarcodeDetector`, or the zxing fallback) | A real scan on camera, deterministic, with no camera hardware |
| Plan randomness (15) | `Math.random` is seeded inside the take | The planner draws recipes at random, and the copy quotes the plan's numbers |
| Watch cards (19) | The take patches the bundle's empty `VITE_API_URL` with an unreachable dummy (CSP blocks it); pairing keys are blurred | The cards exist only in a build with the API configured; no real key may appear on screen |
| Closing card | The 01–12 card plus the address and „za darmo · bez konta · bez instalacji” in small type (as in the later ads) | Viewers need to know where to go; the line comes from the user's own ads |
| Music | One Apple Loops kit per video, chosen per mood: Camden Lock, Icy Crystals, Forward Progress, Glitter Nights, Time Delay, Quiet Evolution, Neon Desert. No kit is reused from 01–12 | Variety across the feed; royalty-free inside your own soundtrack |
| Publishing copy | `final/13-19-opisy-do-publikacji.md`: a caption, a Shorts title, hashtags and a pinned comment per video, and a posting order | Ready to post; written with the social and video marketing skills |
| Git | `/demo-videos/` is ignored completely; scenarios and recorder changes are committed | The user removed the descriptions from git themselves |

## App fixes found while filming

- **The search field in the „Większy posiłek” sheet had no styling.** It was tiny, with no padding.
  It now uses the same rule as „Dodaj zjedzone” (`diet.css`).
- **„Reszta dnia” proposed food already eaten today.** For example, the morning's oatmeal came back
  as dinner, marked „zjedzone”, while its kcal still counted in the variant's sum, so the day ended
  short. The variants now draw from a pool without today's entries (`notEatenToday`, tested). The
  „zjedzone” marker could no longer appear, so it was removed.

## Found, not changed (for the user to decide)

1. **„Najwięcej białka” in „Zjedz teraz” ranks a whole 1692 kcal pizza first,** marked „pasuje”, when
   about 550 kcal are left for the meal.
2. **The count of meals left goes by the clock, not by what was eaten.** After lunch at 13:00–14:30
   it still says „na 3 posiłki” (`mealsLeftAt`).
3. **Rest-of-day slot labels with an evening bigger meal.** The remaining meals are labelled
   „Kolacja” and „Przekąska” (`restSlots`), and a „Kolacja: …” recipe can land in the Obiad slot.
4. **„Propozycja dnia” ignores a planned bigger meal.**
5. **The phone card mentions Apple Zdrowie,** although there is no iOS app yet (`Phone.tsx`
   intro/step texts).
6. **Watch and phone cards can't be seen in a local build without `VITE_API_URL`.**
7. **Rounding:** „zostało 1650 kcal” next to „z 1649 kcal” on the same screen.
