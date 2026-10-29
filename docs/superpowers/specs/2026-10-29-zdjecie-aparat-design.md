# Meal photo: the camera inside the app, photos only with the model, download on first start — design

Date: 2026-10-29 · Status: built · Decided autonomously on request ("teraz pozwala dodawać zdjęcia,
jak nie ma modelu — to trzeba naprawić … przy pierwszym uruchomieniu aplikacji model powinien się
sam pobierać … lepsze działanie w połączeniu z robieniem zdjęć i przekazywaniem ich od razu.
Pojawiały się błędy w rodzaju: zdjęcie zrobione, ale coś nie tak, dodaj z galerii sam — to trochę
słabe … masz wolną rękę … Pick recommended. I am away from machine").

Builds on `2026-10-28-zdjecie-status-design.md` and `2026-10-29-zdjecie-szacunek-design.md`.

## What was wrong

- **The system camera loses the photo.** „Zrób zdjęcie” was a file input with `capture`: the
  browser hands over to the phone's camera app and goes to the background. Android (and iOS) close
  a background tab they need memory for, and the photo never comes back — the app could only say so
  afterwards („Telefon zamknął aplikację … wybierz je z galerii”).
- **Photos before the model.** The buttons worked while the model was missing or still
  downloading; the photo then waited, or failed offline.
- **No download on the first start in two cases**: on mobile data (skipped on purpose) and before
  the service worker took over the page (files fetched then never reached its copy, so the
  download waited for `controllerchange`).

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Camera | „Zrób zdjęcie” opens a live viewfinder **inside the sheet** (`getUserMedia`, back camera, as the barcode scanner does), with a round shutter, a torch where there is one, „Z galerii” and „Anuluj”. The frame goes straight to recognition; the camera stops first | The page never goes to the background, so the phone has no reason to close it; one tap from shutter to result |
| Warm start | While the viewfinder is open the model is loaded into memory (`preload`), so the result comes about a second after the shutter instead of after loading | The page is in front, so this memory is safe now; it was not with the system camera |
| Fallback | No camera permission, no camera, camera busy or no `getUserMedia`: the screen says why and offers the system camera (the old file input) and the gallery. Those still leave the recovery marker | Every phone can still take a photo |
| Photos only with the model | „Zrób zdjęcie” and „Z galerii” are disabled until the model is on the phone. While downloading they say so with the percentage; when it is missing the primary button is „Pobierz model (ok. 59 MB)”. The dish search works meanwhile. Where the browser cannot keep the model at all (no Cache API) photos stay allowed and download it each time | Owner: "pozwala dodawać zdjęcia, jak nie ma modelu — to trzeba naprawić" |
| First start | The background download starts ~2 s after the first screen, at idle, **also before the service worker controls the page and also on mobile data**. Only „Oszczędzanie danych” (an explicit setting) and no network stop it; it resumes on `online` | Owner: "przy pierwszym uruchomieniu model powinien się sam pobierać". 59 MB on mobile data is the owner's call; the card shows it happening |
| Without the service worker | The photo worker writes the files into `gt-photo-model` itself when the page is not controlled (the service worker's `CacheFirst` reads the same cache later). After a save it removes older versions of those files from the cache (entries the worker wrote are not known to the expiration plugin) | The first start is exactly when the page is not controlled yet |
| Recovery | Kept, for the fallback paths. After the first interrupted analysis the app retries the kept photo by itself once; after a second it asks. The camera-interruption text points to the in-app camera instead of "do it yourself from the gallery" | "Przekazywanie od razu"; a bounded retry cannot loop |

| Review fixes | The preloaded model is released when the viewfinder closes without a photo (before the gallery or the phone's camera opens) and while the page is hidden; a frame finishing after the sheet closed goes nowhere; the shutter waits for the video's first picture; a cut or wrong model download is deleted from the copy instead of counting as the model; a download that has not moved for 30 s offers „Spróbuj ponownie” (`restartDownload`); the service worker's write of the model is awaited up to 30 s; the background tries 3 more times | Found by an independent review; each has a test |
| Checked on the built app | Chromium, fake camera with a Commons pad thai photo: first visit → model in the copy after 3.4 s without a tap; second visit „Jest w telefonie”, no download; shutter → answer in 1.3 s, camera off. With the service worker blocked the same, the photo worker writing and reading the copy. A 200 with a 1 MB body for the model leaves nothing in the copy; the next start downloads all 54,630,849 bytes. Older file versions in the copy are removed after a save | |

### Considered, not done now

- `ImageCapture.takePhoto()` for full-resolution stills: Chrome only, slower, and the model reads
  224 × 224; a video frame at 1280 × 960 is plenty.
- Downloading over mobile data only after asking: the owner asked for the download on first start;
  „Oszczędzanie danych” remains the way to opt out.
