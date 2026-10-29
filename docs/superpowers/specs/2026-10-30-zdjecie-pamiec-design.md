# Meal photo: no model while the camera runs, food on the stove is not "no food" — design

Date: 2026-10-30 · Status: built · Decided autonomously on request ("when the process crashes and
I hit retry the picture is gone, nothing happens … the model didn't recognize my dish at the pan at
all … make best decision from user perspective").

Builds on `2026-10-29-zdjecie-aparat-design.md` and `2026-10-29-zdjecie-szacunek-design.md`.

## What was found

- **Recovery itself works** in Chromium: the renderer killed (CDP `Page.crash`) four times in a row
  while the model read the photo — each start came back on „Zdjęcie” with the photo kept and
  „Spróbuj ponownie”, and the last retry gave the result.
- **A crash before the shutter left no trace.** Since 2026-10-29 the model loaded into memory while
  the viewfinder was open, so a live camera and the model shared the tab's memory. A tab killed
  then had no marker and no photo: the app started on the diary as if nothing had happened — the
  owner's "picture is gone, nothing happens".
- **Food in pans is mostly recognised.** 22 Commons photos of food in pans and woks: paella, pierogi,
  potato pancakes, shakshuka, scrambled eggs, sausages right; best cosine 0.106–0.181. Centre crops
  and a three-view average changed nothing worth the extra runs. But a wok on the stove scored
  0.106 — right at the 0.105 "no food" line — so a slightly worse shot got „Na tym zdjęciu nie widzę
  jedzenia” for real food.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Model and camera | The model is not loaded while the viewfinder runs. It loads after the shutter, when the camera is already off. Shutter → answer 1.8 s instead of 1.3 s on a laptop; on a phone a few seconds more | A lost photo costs far more than a few seconds; the steps on screen show what is happening |
| Marker while framing | Opening the viewfinder leaves the recovery marker; closing it without a photo removes it; the shot replaces it with the photo's own | A tab killed while framing comes back on „Zdjęcie” with „Zrób zdjęcie” ready and one sentence of what happened |
| "No food" | Only below a best cosine of **0.085** (screens, rooms, streets measured 0.051–0.092). Between 0.085 and **0.12** — where food on the stove and a few other things (a cat on a sofa, 0.115–0.121) overlap — the screen guesses: „Słabo widać tu jedzenie — może to …? Sprawdź i popraw poniżej”, the dish goes on the plate as *wstępnie* with the wide range, whatever the ranking's confidence | Calling real food "no food" leaves the person with nothing; a wrong guess is one tap to replace or remove |
| „To jednak jedzenie” | Shows the guesses as weak ones too | The model still could not see it well |

### Considered, not done now

- Test-time augmentation (centre crop, square crop, their average): no consistent gain on the pan
  set, and two or three runs of the model per photo.
- Prompts with "in a frying pan": needs re-running the 1.1 GB text model; recognition in pans was
  already right where the dish is in the catalog.
- Preloading on phones that report much memory (`navigator.deviceMemory`): Chrome caps the value at 8
  and the tab's limit depends on what else runs — not a safe signal.
