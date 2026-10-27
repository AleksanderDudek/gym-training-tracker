# Meal from a photo („Zdjęcie” in „Dodaj zjedzone”) — design

Date: 2026-10-27 · Status: built · Decided autonomously on request ("czy ten webLLM jest w stanie wyliczyć
kalorie posiłku ze zdjęcia? … najważniejsze to jest, żeby LLM był darmowy dla dużej ilości
użytkowników … na 100% działało w przeglądarce … potem najważniejsza jest dokładność … wszystkie
potrawy, a nie tylko polskie … zostawiłbym suwak … prostą metrykę np. dla tłuszczu — jak tłuste to
jest? … dla cukru — jak słodkie to jest? … analogicznie dla innych parametrów … masz wolną rękę …
Pick recommended. I am away from machine. Plan it out and then finish on your own").

Research: `docs/research/zdjecie-posilku-modele.md` (models measured in Node and in Chromium with
the WASM backend), the dish catalog `src/food/photo/dishes.ts` (USDA FNDDS / SR Legacy).

## Priorities, in the owner's order

1. **Free for any number of users** → inference on the user's device; no API bill that grows with users.
2. **Works in every browser** → WebAssembly (ONNX Runtime Web), WebGPU only as a speed-up when present;
   no model that needs WebGPU, no model of hundreds of MB that a phone tab cannot hold.
3. **Accuracy** → the model only *recognises*; calories come from a catalog of dishes with known
   values, and the person sets what a photo cannot show: the portion and the hidden fat, sugar, sauce.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Model type | A CLIP-style image encoder (zero-shot), not a generative LLM | Small (tens of MB), runs on WASM everywhere, ~1–3 s; the label set is ours, so it can be every dish in the catalog, from any cuisine |
| Which model | **SigLIP 2 base/16 224 px, image half, 4-bit weights + fp16** (`onnx-community/siglip2-base-patch16-224-ONNX`, `onnx/vision_model_q4f16.onnx`, 54.6 MB, Apache-2.0), prompt `a photo of {phrase}.` | The benchmark's top pick, MobileCLIP-B, is ~1–4 points better, but Apple licenses its weights (Apple ML Research Model License) "exclusively for Research Purposes … does not include … use in any commercial product or service" — not shippable in a public app. SigLIP 2 is the next best on accuracy and memory and is Apache-2.0 (licence text served next to the model). q4f16 = q4 in accuracy, 9 MB smaller, measured in Chromium and WebKit |
| Measured on our catalog | 351 dishes / 682 phrases, best phrase per dish: Food-101 photos **top-1 ≈ 81 %, top-5 ≈ 96–97 %**; Polish and other dishes outside Food-101 **72–76 % / 97 %** (96 photos, ± 4 points). Most misses are near-synonyms in the catalog (schabowy vs schabowy z ziemniakami, hamburger vs cheeseburger, pizza vs pizza salami), which the top 5 covers | `docs/research/zdjecie-posilku-modele.md`, section "Shipped" |
| Confidence | Softmax over dishes at the model's logit scale (112.67). ≥ 0.6 → „To chyba:” with the first dish marked (73 % of photos, 93 % right); dishes sharing the first word reaching 0.6 together → „To chyba pierogi — wybierz rodzaj:”; otherwise „Nie jestem pewien” | Measured on 904 photos; the family case is frequent (five kinds of pierogi) and "not sure" read wrong there |
| Runtime | `onnxruntime-web` 1.31.1 (`/wasm` entry, plain SIMD build, one thread) used directly; transformers.js only in the build script | The app needs a resize, a normalisation and one `session.run`; transformers.js would add its loader, a CDN default and the larger asyncify runtime (+450 MB RAM). No COOP/COEP on GitHub Pages, so no threads |
| Build | `vite/photoModel.ts` downloads the pinned revision once into `~/.cache/gym-tracker` (CI: `actions/cache`), checks SHA-256 and size, and emits `models/<version>/vision.onnx` + `LICENSE.txt`; `npm run food:dish-embeddings` writes the phrase vectors (int8, 0.5 MB) next to the catalog, and a test fails if the catalog changes without them | A 55 MB binary stays out of git; a tampered or truncated download can never ship |
| Loading | **In the background after start** (owner's request after the first release: the feature should be ready as soon as possible after install): 5 s after start, then at idle, under the service worker (first visit: right after it takes over), the worker fetches the four files into the `gt-photo-model` copy without loading the model, and ends. Not on Save-Data, a known `cellular` connection or 2G (Network Information API; Safari reports nothing, so it downloads) — there it only checks the copy and downloads on the next `change` of the connection; offline it checks and waits for `online`. A photo taken meanwhile waits for the background download instead of starting a second one, and shows its progress. Otherwise the download starts when the person taps „Zrób zdjęcie” / „Z galerii”; the notice says „ok. 59 MB” until the copy is known to hold the model, then „Model … jest już pobrany”. The model is loaded (0.5 GB) only for a photo, and the worker ends when the sheet closes | 59 MB unasked is fine on Wi-Fi and unknown connections, not on metered data; precaching it instead would block every app update on the model download and could not skip mobile data |
| Text side | Dish-name embeddings precomputed at build time and shipped as a small file | Only the image encoder goes to the browser; adding a dish needs no new model |
| Hosting | Model files from the app's own server, cached by the service worker (background download or first use), never precached | No CDN (privacy, CSP, availability) |
| Where it runs | A Web Worker | The page stays responsive while the encoder runs |
| Privacy | The photo never leaves the device; nothing is uploaded | Same rule as lab results and the scanner |
| Dishes | ~300 from all over the world (all Food-101 classes, Polish and Central European, Asian, Mexican, Middle Eastern, everyday plates), each with values per 100 g as served, a typical portion and which scales apply | "Wszystkie potrawy"; the photo model's labels line up with the catalog |
| Suggestions | Top 5 as chips (tap = on the plate), the dish search always under them, the other picker modes one tab away | A wrong first guess costs one tap, not a wrong entry |
| Plate | Several dishes on one photo: each a row with its own portion and scales, one total | Dinner is rarely one thing |
| Portion | A slider in steps of ¼ of a typical portion (¼–3×), with grams and words („mała · zwykła · duża”) | Owner's choice; people know "a big plate" better than grams |
| Scales | Shown only when they matter for the dish: **Jak tłuste?** (chude · zwykłe · tłuste · bardzo tłuste), **Jak słodkie?** (bez cukru · lekko · zwykłe · bardzo słodkie), **Ile sosu?** (bez · trochę · zwykle · dużo); each step moves fat / sugar / sauce grams by a dish-specific amount | The owner's "simple metric"; hidden fat and sugar are where photo estimates fail most |
| Result | Central estimate logged; an honest range shown („ok. 720 kcal, 620–830”) | No false precision |
| Memory | The last portion and scales per dish are remembered on the device and preselected next time | "My schabowy is always fatty" is answered once |
| Entry | A normal diary entry (new source `dish`, key `dish:<id>`), name with the choices („Schabowy z ziemniakami · tłuste”) | History, favourites and the day's balance work unchanged |
| Without calories | „Bez liczenia kalorii” hides the numbers and keeps portions and scales | Same rule as the rest of the diary |

### Considered, not done now

- More scales („Ile mięsa?”, „Ile ziemniaków/ryżu?”): the portion slider already scales the whole
  dish, and the three scales cover where photo estimates fail most (oil, sugar, sauce). A side-vs-main
  split would need per-part recipes for every dish; left for when people ask for it.
- MobileCLIP-B / MobileCLIP 2: better scores, research-only licence. SigLIP 2 at full precision:
  +3 points, but 186–372 MB and 1.6 GB of tab memory.
- Threads (COOP/COEP headers, ~3× faster): GitHub Pages cannot send headers; a service-worker
  workaround would change every response of the app — not for this feature alone.
- WebGPU: the q4 file would run there; not measured (no GPU in the test runs), WASM is fast enough
  (~1 s a photo on a laptop, a few seconds on a phone).

- A generative vision model in the browser (WebLLM + Phi-3.5-vision, SmolVLM, Moondream): needs WebGPU
  or hundreds of MB to GBs and estimates grams badly — fails priorities 2 and 3.
- A cloud vision API: better recognition, but costs per photo and sends the photo away — fails priority 1.
- Portion from depth or a reference object in the photo: not reliable on a single phone photo.
