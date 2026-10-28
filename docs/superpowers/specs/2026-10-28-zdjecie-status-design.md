# Meal photo: model status, visible analysis, recovery after the phone closes the app — design

Date: 2026-10-28 · Status: built · Decided autonomously on request ("aplikacja pozwala zrobić zdjęcie,
po czym przekierowuje na widok bez żadnej informacji … nie widzę rozpoznanego i dodanego dania /
makro / kalorii … chcę być pewien, że mamy zainstalowany model lub że się instaluje (i na jakim
etapie jest) … jeśli model nie jest zainstalowany, chcę status albo możliwość pobrania … chcę też
wiedzieć, co się dzieje z moim zdjęciem i analizą … masz wolną rękę … Pick recommended. I am away
from machine").

Builds on `2026-10-27-zdjecie-posilku-design.md`.

## What was wrong

- **The deployed flow works on a desktop browser**: the live site (GitHub Pages), Chromium at
  360 px, gallery photo of pad thai → „To chyba: Pad thai” in 7 s, model served (200, 54.6 MB).
- **On a phone, the likely cause of "a view with no information"**: tapping „Zrób zdjęcie” called
  `warmUp()`, which loaded the model into memory (≈ 0.2 GB: a 160 MB WebAssembly heap plus the 55 MB file, measured) *while the camera app was in front*.
  A background browser tab holding that much is the first thing Android's low-memory killer (and
  iOS's) ends. Coming back from the camera, the browser reloads the page: the photo never arrives,
  the sheet is gone, and the diary shows as if nothing happened. The same can happen during the
  analysis itself. Nothing on screen said any of this.
- **No model status**: the background download (2026-10-27) had no visible state. The notice said
  „ok. 59 MB” or „już pobrany”, but not "downloading 40 %", "waiting for Wi-Fi" or "failed", and there
  was no way to start the download by hand.
- **The result needed two more taps before any calories showed**: a sure guess was only a marked
  chip; the plate (kcal, macros) appeared only after tapping it.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Camera and memory | Opening the camera or gallery no longer loads the model. If the model is not saved yet, it starts the *download into the copy* (streamed through the service worker, a few MB of memory); the model is loaded only after the photo has arrived | Takes those 0.2 GB out of the moment the phone is most likely to close the tab |
| Model status | One shared state (`src/food/photo/modelState.ts`, `useSyncExternalStore`): checking · in the phone · downloading n % (MB of MB) · not yet (with why: mobile data / offline / not started) · failed (offline / no space / error) · this browser cannot keep it. Fed by the background download, the photo's own download and a quick look in the cache when the photo screen opens | The owner wants to know whether the model is installed and how far it is |
| Status on screen | A card at the top of „Zdjęcie” with the state in words, a progress bar while downloading, and „Pobierz teraz (ok. 59 MB)” / „Spróbuj ponownie” when it is not there. Downloading never blocks the camera: a photo taken meanwhile waits for it | Status or a way to start the download, as asked |
| Manual download | Allowed on mobile data too (the button names the size: that is the consent); closing the sheet does not cancel a download in progress | Background download skips mobile data on purpose; the person may still want it |
| Analysis steps | While a photo is processed, a checklist: photo received → model (from the phone / downloading n %) → starting the model → recognising, with elapsed seconds after 3 s | "Co się dzieje z moim zdjęciem i analizą" |
| Sure result | A sure first guess (≥ 0.6, or a sure family is *not* enough) goes straight onto the plate, so kcal, range and macros show at once; the text says it was added and can be changed; the screen scrolls to the result | The owner expected to see the dish and its numbers; nothing is logged before „Dodaj do dziennika” |
| Chips | Each suggestion shows kcal for a typical portion (when calories are shown) and the first one its confidence | Easier to choose between near-synonyms |
| Errors | Named reasons with a way forward: offline without the model, out of memory, other (technical detail under „Szczegóły”), each with „Spróbuj ponownie” on the same photo | Generic „Nie udało się” told nothing |
| Recovery | Before opening the camera/gallery the app writes a small marker on the device (`localStorage`); when the photo arrives it keeps the photo in a local cache (`gt-photo-pending`) until the result is shown. If the app starts again within 30 minutes with a marker left, „Dodaj zjedzone” opens on „Zdjęcie” and says what happened: the phone closed the app while the camera was open (the photo did not arrive — try again, or take it with the camera app and pick it „Z galerii”), or during the analysis (the photo is kept — „Spróbuj ponownie”). After two interrupted analyses it suggests searching instead. It never retries by itself | A crash loop is worse than a question; the photo is not lost |
| Marker cleanup | Cleared on a result, on an error, when the sheet closes, and on `pagehide` (a reload by hand, which also deletes the kept photo). A *camera* marker also goes on the picker's `cancel` and whenever the page is in front again (`focus` / `visibilitychange`) — a page the phone killed comes back as a new start, never as a focus — while a photo being read keeps its marker. The explanation is shown once: showing it consumes the marker (the kept photo stays for „Spróbuj ponownie” until the sheet closes) | Only an app closed by the system leaves the marker; older Safari fires no `cancel`; swiping the app away after reading the explanation must not bring it back |
| Review fixes | A sheet closed while the photo is being kept no longer starts the model afterwards; a closed sheet or a model that fails after its download (memory) no longer shows "download failed" — the page itself looks in the copy (`settleModel`); a finished save no longer ends a worker another request still waits on; the live regions announce state changes, not every second or percent | Found by an independent review of the first commit |
| Privacy | The kept photo stays on the device and is deleted as above | Same rule as before: nothing leaves the phone |

### Considered, not done now

- ONNX Runtime's `enableCpuMemArena: false` / `enableMemPattern: false`: measured in Chromium
  (WASM, one thread, session + 3 runs, two runs each way) — the WebAssembly heap peaks at 160 MB
  either way, same time, same output. No gain, so left out. The heap is 160 MB plus the 55 MB model
  buffer, less than the 0.5 GB the first design estimated for the whole tab.

- A model section in Settings (status, delete to free 59 MB): the photo screen covers the request;
  the shared state makes it a small addition later.
- Downscaling the photo before decoding: the full-size bitmap is ≈ 48 MB for 12 MP, small next to
  the session, and a different resampler could shift the measured accuracy.
- Keeping the plate (portions, scales) across a reload: the result appears in a few seconds again.
