# Meal from a photo — which image model runs in the browser (benchmark)

Date: 2026-10-27 · Status: done; shipped model differs (licence, see "Shipped") · Used by: `docs/superpowers/specs/2026-10-27-zdjecie-posilku-design.md`

Question: which zero-shot CLIP-style image encoder should the PWA ship so that a photo of a meal is
recognised **on the user's device** (free for any number of users), in **every modern browser
including iPhone Safari without WebGPU** (ONNX Runtime Web, WASM backend), with the best accuracy
on dishes from all over the world.

Approach evaluated: the text embeddings of our dish list are computed once at build time; only the
image encoder ships to the browser. Recognition = cosine similarity between the photo's embedding
and each dish embedding; the top 5 are shown.

## Shipped: SigLIP 2 q4f16, not MobileCLIP-B (licence)

The recommendation below was made on accuracy, size and memory. Checking the licences before
shipping changed it: **Apple's MobileCLIP weights are under the Apple Machine Learning Research
Model License** (`apple/MobileCLIP-B`, `apple/MobileCLIP2-*` on Hugging Face: `apple-amlr`) —
"exclusively for Research Purposes … does not include any commercial exploitation, product
development or use in any commercial product or service". The `Xenova/mobileclip_b` export copies
the code licence, but the weights are Apple's. A public app cannot ship them.

The app ships **SigLIP 2 base/16** (`google/siglip2-base-patch16-224`, Apache-2.0) —
`onnx-community/siglip2-base-patch16-224-ONNX` @ `ba1f3b0843f24bc5417d38e19c37b287d719b2f4`,
`onnx/vision_model_q4f16.onnx` (54 630 849 bytes, sha256 `a0740d40…5de27ed`). q4f16 scored the same
as q4 (below) and is 9 MB smaller; the app runs it in Chromium and WebKit (Playwright, WASM, one
thread): ≈ 1 s a photo after a ≈ 1.3 s load from a local server, offline from the service worker's copy.

Accuracy **on the app's own catalog** (351 dishes, 682 phrases, a dish scores by its best phrase;
set 2 truth allows the catalog's kinds, e.g. any pierogi; pad see ew, missing from the catalog,
counts chow mein / pad thai):

| image vectors | template | set 1 top-1 / top-5 | set 2 top-1 / top-5 |
| --- | --- | --- | --- |
| q4 · Node | `plain` | 80.9 / 96.4 | 71.9 / 96.9 |
| q4 · Chromium | `plain` | 81.3 / 96.8 | 76.0 / 96.9 |
| q4f16 · Node | `plain` | 81.1 / 96.4 | 71.9 / 96.9 |
| q4 · Node | `food` | 79.1 / 96.3 | 72.9 / 97.9 |
| q4 · Node | `plain` + Polish name as an extra phrase | 80.7 / 95.9 | 72.9 / 97.9 |
| fp32 · Node (reference) | `plain` | 84.0 / 97.2 | 77.1 / 100 |

`plain` ("a photo of {}.") is kept; Polish names through the multilingual tokenizer did not help
beyond noise. Confidence with softmax at the model's logit scale 112.67 (q4, Chromium, 904 photos):
top probability ≥ 0.6 for 73 % of photos, 93 % right; < 0.4 for 12 %, 36 % right (top-5 85 %).
Most remaining misses are near-synonyms inside the catalog (schabowy → schabowy z ziemniakami 4×,
hamburger → cheeseburger 4×, garlic bread → focaccia 3×, pizza → pizza salami 2×).
Scripts: `bench/catalog_text.mjs`, `bench/catalog_score.mjs` in the scratchpad.

## Recommendation (by measurement, before the licence check)

**MobileCLIP-B, 4-bit (bnb4) image encoder — `Xenova/mobileclip_b`, file `onnx/vision_model_bnb4.onnx`
(52.3 MB), WASM backend, prompt template `a photo of {}, a type of food.`**

| | Expected (measured here, 267 dishes in one run) |
| --- | --- |
| Food-101 photos (808) | **top-1 ≈ 82–83 %, top-5 ≈ 97 %** (Node 81.7 / 96.8, Chromium WASM 83.2 / 96.8) |
| Dishes outside Food-101: Polish + global (96) | **top-1 ≈ 81–83 %, top-5 ≈ 98 %** (Node 83.3 / 97.9, Chromium 81.3 / 97.9) |
| Download (image encoder only) | 52.3 MB (+ the ONNX Runtime WASM binary, 14.3 MB raw / 3.7 MB gzip) |
| Time per photo, Chromium WASM, 1 thread (M-series Mac) | 0.88 s; 0.26–0.31 s with 4 threads (needs cross-origin isolation) |
| Time per photo, WebKit (JavaScriptCore, Safari's engine), 1 thread | 0.81 s; works without WebGPU |
| Peak renderer memory | ≈ 0.5–0.6 GB |

Why this one:

- Accuracy is in the top group (fp32 MobileCLIP-B and SigLIP2 are 1–3 points better on set 1, but
  they are 345–372 MB and need 1.5–1.8 GB of renderer memory — too much for a phone tab).
- It is the **smallest** of the accurate encoders and has the **lowest memory** of them, and it is
  as good as or better than the 4-bit SigLIP2 (63 MB) on the dishes outside Food-101.
- It runs in WebKit and Chromium on plain WASM (no WebGPU, no threads needed), and its output in the
  browser matches Node (accuracy measured on the full set inside Chromium is the same).

Close alternatives, all browser-safe:

| Option | When to prefer it |
| --- | --- |
| **MobileCLIP-S2 fp16** — `Xenova/mobileclip_s2`, `onnx/vision_model_fp16.onnx`, 71.7 MB | ~1.7× faster (0.52 s/photo 1 thread, 0.15 s with 4 threads, 0.45 s WebKit); about 1 point lower top-1 (Chromium 82.1 / 96.4 on set 1, 81.3 / 96.9 on set 2). Pick it if phones turn out too slow with MobileCLIP-B. fp16 weights are fine in WASM. |
| **SigLIP2 base/16 q4** — `onnx-community/siglip2-base-patch16-224-ONNX`, `onnx/vision_model_q4.onnx`, 63.3 MB | Same set-1 accuracy (83.2–83.7 / 97.3–97.6), a little worse on set 2 (77–79 %). Its text encoder is multilingual (Gemma tokenizer), which may help if dish names are ever embedded in Polish — not tested. |
| **MobileCLIP-S0 fp16** — 22.9 MB | Tiny and fast (0.17 s, 1 thread) but ~10 points lower top-1 (72 / 92). A "lite" fallback only. |

Do **not** use any 8-bit (`q8`/`_quantized`, `int8`, `uint8`) MobileCLIP-S0/S1/S2 or SigLIP2 file —
they are broken (see Pitfalls) — and remember that transformers.js picks `q8` **by default on WASM**.

## Method

- **Runtime.** The repo's `@huggingface/transformers` **4.3.1** (bundled onnxruntime-web
  1.31.0-dev, onnxruntime-node 1.30.0), imported read-only from `node_modules`. Node runs use
  onnxruntime-node on the CPU (Apple Silicon, 11 cores, default threads). Browser runs use headless
  Chromium (Playwright 1.63) with `device: 'wasm'` and `--disable-gpu`, and Playwright WebKit for
  Safari's engine; the page and the model files are served over http from a scratchpad folder
  (never from the repo, never from a CDN).
- **Set 1 — Food-101.** `ethz/food101` validation split, stratified: 8 images × 101 classes = 808
  images (validation is stored as 101 contiguous blocks of 250; 8 consecutive rows from the middle
  of each block, via the datasets-server rows API — no 5 GB download).
- **Set 2 — dishes Food-101 lacks (or that matter here).** 96 photos from Wikimedia Commons (CC BY,
  CC BY-SA, CC0, FAL, public domain; local evaluation only, never shipped), 6–8 per dish, picked by
  hand from contact sheets (no packaging, menus or street scenes): pierogi, bigos, żurek, kotlet
  schabowy with potatoes, gołąbki, placki ziemniaczane, rosół, naleśniki, shawarma wrap, pad see ew,
  poke bowl, burrito bowl, plus bibimbap and falafel plate (both are actually Food-101 classes; kept
  because the brief listed them and scored against the Food-101 label). Each file's source URL,
  licence and author are recorded in `data/extra/_labels.csv` in the scratchpad.
- **Label set: 267 dishes in one zero-shot run** — the 101 Food-101 classes, the 12 extra dishes,
  and 154 other common foods (Polish/Central European, Italian, East and South Asian, Mexican,
  Middle Eastern, American, breakfast plates and single foods such as "an apple", "a bowl of
  oatmeal", "grilled chicken breast with rice"). Set-1 accuracy below is therefore **267-way**,
  harder than the usual 101-way Food-101 figure, which is also given for comparison with the papers.
  Polish names carry a short English gloss ("pierogi, Polish dumplings"; "zurek, Polish sour rye
  soup with sausage and egg"), because the CLIP/MobileCLIP text encoders are English-only; diacritics
  were dropped in the prompts.
- **Prompt templates.** `food` = "a photo of {}, a type of food." (the CLIP paper's Food-101
  prompt), `plate` = "a photo of a plate of {}." (phrases that already start with "a/an" use the
  plain form), `plain` = "a photo of {}.", and `ensemble` = the mean of the three L2-normalised text
  embeddings, re-normalised.
- **Metrics.** top-1 / top-5 per set; size of the image-encoder file the browser downloads; Node
  median ms per image (preprocessing + encoder, first 3 images excluded); Chromium/WASM median ms per
  image over 24 images (16 from set 1, 8 from set 2, first two excluded), load time and peak renderer
  RSS; and the mean cosine between the browser embedding and the Node fp32 embedding of the same
  image (catches broken quantisation or preprocessing drift).
- **Noise.** Set 1 has 808 images (± ~1.4 points standard error around 80 %), set 2 only 96
  (± ~4 points). Differences of 1–2 points on set 1 and < 8 points on set 2 are not meaningful.

## Results

Accuracy from Node (fp32 / fp16 give identical results, so quantisation is the only accuracy lever).
"Chromium WASM" is single-threaded, which is what a page without cross-origin isolation gets — the
app currently has no COOP/COEP headers. Timings are from an Apple-Silicon Mac; a phone will be
roughly 2–4× slower.

| model · precision | encoder MB | set 1 top-1 / top-5 (`food`) | set 2 top-1 / top-5 (`food`) | best template on set 1: top-1 / top-5 · set 2 top-1 / top-5 | Food-101 101-way top-1 | Node ms/img | Chromium WASM 1 thread ms/img | renderer RSS MB | browser vs Node fp32 cos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mobileclip_s0 · fp32 | 45.5 | 72.4 / 92.2 | 75.0 / 93.8 | `ensemble` 72.5 / 92.1 · 71.9 / 93.8 | 80.9 | 30 | 168 | 454 | 0.992 |
| mobileclip_s0 · fp16 | 22.9 | 72.3 / 92.1 | 75.0 / 93.8 | `ensemble` 72.5 / 92.1 · 71.9 / 93.8 | 80.7 | 37 | 174 | 544 | 0.992 |
| mobileclip_s0 · q8 | 11.8 | **0.7 / 2.8** | 0.0 / 0.0 | broken | 1.5 | 62 | 196 | 359 | 0.07 |
| mobileclip_s0 · q4 | 36.7 | 70.4 / 91.5 | 70.8 / 95.8 | `food` | 79.2 | 51 | – | – | – |
| mobileclip_s1 · fp32 | 86.0 | 79.0 / 95.7 | 79.2 / 94.8 | `ensemble` 79.5 / 95.7 · 77.1 / 94.8 | 85.6 | 49 | 325 | 574 | 0.994 |
| mobileclip_s1 · fp16 | 43.2 | 79.1 / 95.7 | 79.2 / 94.8 | `ensemble` 79.3 / 95.7 · 77.1 / 94.8 | 85.6 | 112 | 332 | 648 | 0.994 |
| mobileclip_s1 · q8 | 22.4 | **0.0 / 0.9** | 0.0 / 0.0 | broken | 1.2 | 107 | 385 | 481 | 0.02 |
| mobileclip_s1 · q4 | 70.1 | 78.1 / 95.5 | 77.1 / 94.8 | `food` | 84.8 | 57 | – | – | – |
| mobileclip_s2 · fp32 | 143.0 | 81.9 / 96.2 | 80.2 / 96.9 | `food` | 88.5 | 73 | 521 | 764 | 0.995 |
| **mobileclip_s2 · fp16** | **71.7** | **81.9 / 96.0** | **80.2 / 96.9** | `food` (`plain` 85.4 on set 2) | 88.5 | 198 | **521** | **563** | 0.995 |
| mobileclip_s2 · q8 | 36.7 | **0.4 / 1.6** | 0.0 / 0.0 | broken | 0.9 | 147 | 589 | 528 | 0.01 |
| mobileclip_s2 · q4 | 118.7 | 81.2 / 96.4 | 79.2 / 95.8 | `food` | 88.6 | 113 | – | – | – |
| mobileclip_b · fp32 | 345.6 | 83.3 / 97.5 | 83.3 / 97.9 | `food` | 89.6 | 93 | 866 | 1770 | 0.996 |
| mobileclip_b · fp16 | 173.0 | 83.3 / 97.5 | 83.3 / 97.9 | `food` | 89.6 | 238 | 862 | 1494 | 0.996 |
| mobileclip_b · q8 | 87.5 | 77.2 / 93.8 | 68.8 / 92.7 | `food` | 85.4 | 39 | 853 | 775 | 0.89 |
| mobileclip_b · q4 | 57.6 | 80.1 / 96.7 | 80.2 / 97.9 | `food` | 87.9 | 264 | 924 | 552 | 0.970 |
| **mobileclip_b · bnb4** | **52.3** | **81.7 / 96.8** | **83.3 / 97.9** | `ensemble` 81.8 / 96.8 · 81.3 / 97.9 | 87.9 | 326 | **880** | **492** | 0.972 |
| clip_b32 · fp32 | 351.7 | 74.8 / 93.6 | 64.6 / 89.6 | `food` | 84.3 | 28 | 210 | 1763 | 0.988 |
| clip_b32 · fp16 | 176.1 | 74.8 / 93.7 | 64.6 / 89.6 | `food` | 84.3 | 75 | 219 | 1551 | 0.988 |
| clip_b32 · q8 | 89.1 | 71.2 / 92.6 | 56.3 / 87.5 | `food` | 80.3 | 14 | 251 | 658 | 0.92 |
| clip_b32 · q4 | 63.6 | 70.0 / 92.1 | 69.8 / 88.5 | `food` | 80.2 | 93 | 315 | 661 | 0.955 |
| clip_b32 · q4f16 | 53.3 | 70.0 / 92.1 | 69.8 / 88.5 | `food` | 80.2 | 96 | 329 | 607 | 0.955 |
| clip_b16 · fp32 | 345.1 | 80.0 / 97.6 | 78.1 / 96.9 | `food` | 87.7 | 89 | 910 | 1800 | 0.987 |
| clip_b16 · fp16 | 172.8 | 80.0 / 97.6 | 78.1 / 96.9 | `food` | 87.7 | 247 | 821 | 1254 | 0.987 |
| clip_b16 · q8 | 87.5 | 77.4 / 95.2 | 66.7 / 91.7 | `food` | 85.8 | 38 | 817 | 755 | 0.94 |
| siglip_b16 · fp32 | 371.8 | 77.2 / 95.7 | 22.9 / 55.2 | `plain` 83.9 / 97.4 · 72.9 / 94.8 | 84.3 | 91 | 841 | 1571 | 0.983 |
| siglip_b16 · fp16 | 186.1 | 77.4 / 95.7 | 22.9 / 55.2 | `plain` 83.9 / 97.4 · 72.9 / 94.8 | 84.3 | 233 | 862 | 1580 | 0.983 |
| siglip_b16 · q8 | 99.5 | 78.5 / 95.3 | 22.9 / 59.4 | `plain` 84.0 / 97.3 · 76.0 / 93.8 | 84.4 | 39 | 837 | 822 | 0.975 |
| siglip_b16 · q4 | 63.3 | 76.5 / 94.6 | 22.9 / 56.3 | `ensemble` 83.0 / 97.2 · 57.3 / 86.5 | 82.9 | 265 | 919 | 595 | 0.966 |
| siglip_b16 · q4f16 | 54.6 | 76.5 / 94.6 | 22.9 / 56.3 | `ensemble` 83.0 / 97.2 · 57.3 / 86.5 | 82.9 | 305 | 920 | 605 | 0.966 |
| siglip2_b16 · fp32 | 371.8 | 85.1 / 97.9 | 79.2 / 99.0 | `plain` 85.9 / 98.3 · 84.4 / 97.9 | 92.1 | 88 | 852 | 1667 | 0.988 |
| siglip2_b16 · fp16 | 186.0 | 85.3 / 97.9 | 79.2 / 99.0 | `plain` 85.9 / 98.3 · 84.4 / 97.9 | 92.1 | 189 | 862 | 1586 | 0.988 |
| siglip2_b16 · q8 | 94.6 | **34.9 / 60.1** | 31.3 / 52.1 | broken | 45.2 | 38 | 807 | 777 | 0.71 |
| siglip2_b16 · q4 | 63.3 | 82.5 / 97.0 | 75.0 / 97.9 | `plain` 83.7 / 97.3 · 77.1 / 96.9 | 89.4 | 267 | 917 | 558 | 0.964 |
| siglip2_b16 · q4f16 | 54.6 | 82.5 / 97.0 | 75.0 / 97.9 | `plain` 83.7 / 97.3 · 77.1 / 96.9 | 89.4 | 333 | 925 | 574 | 0.964 |
| swin_food101 · fp32 (supervised) | 352.4 | – | – | – | 91.5 | 100 | 746 | 1532 | – |
| swin_food101 · q8 | 93.3 | – | – | – | 91.1 | 49 | 776 | 793 | – |
| swin_food101 · q4 | 60.4 | – | – | – | 91.2 | 269 | 831 | 533 | – |
| swin_food101 · q4f16 | 52.7 | – | – | – | 91.2 | 318 | – | – | – |

Notes on the table:

- **The supervised reference** (`onnx-community/swin-finetuned-food101-ONNX`) scores 91.5 % on its
  own 101 classes; zero-shot SigLIP2 restricted to the same 101 labels scores 92.1 % and
  MobileCLIP-B 89.6 %. The classifier cannot name anything outside Food-101 (no pierogi, no oatmeal),
  so it brings nothing a zero-shot encoder does not.
- **Node ms/img** for 4-bit and fp16 files is slow because onnxruntime-node dequantises / casts on
  the CPU; it says nothing about the browser. Node load times (warm, from disk) were 30–400 ms for
  every encoder and are not a useful differentiator (the browser figures are below).
- OpenAI CLIP B/32 is the fastest ViT but clearly the weakest on dishes outside Food-101; CLIP B/16
  is dominated by MobileCLIP-B (same cost, lower accuracy, no good 4-bit file). SigLIP v1 is
  dominated by SigLIP2 and is very prompt-sensitive (see Pitfalls).

### Browser details (Chromium unless noted, 24 images)

| configuration | load ms | ms/photo | renderer RSS MB |
| --- | --- | --- | --- |
| mobileclip_b bnb4 · 1 thread · plain WASM | 301 | 880 | 492 |
| mobileclip_b bnb4 · 4 threads · COOP/COEP | 362 | 261 | 512 |
| mobileclip_b bnb4 · WebKit · 1 thread | 252 | 810 | n/a |
| mobileclip_b bnb4 · WebKit · 4 threads · COOP/COEP | 487 | 677 | n/a |
| mobileclip_s2 fp16 · 1 thread · plain WASM | 614 | 521 | 563 |
| mobileclip_s2 fp16 · 1 thread · asyncify WASM (transformers.js default build) | 715 | 506 | 1017 |
| mobileclip_s2 fp16 · 4 threads · COOP/COEP | 507 | 149 | 800 |
| mobileclip_s2 fp16 · WebKit · 1 thread | 331 | 453 | n/a |
| siglip2 q4 · 1 thread · plain / asyncify | 368 / 531 | 917 / 934 | 558 / 908 |
| siglip2 q4 · 4 threads · COOP/COEP | 316 | 260 | 684 |
| siglip2 q4 · WebKit · 1 thread | 252 | 878 | n/a |
| mobileclip_s0 fp16 · 4 threads · COOP/COEP / WebKit 1 thread | 266 / 198 | 56 / 155 | 634 / n/a |

Full-set accuracy **measured inside Chromium** (WASM, 4 threads; canvas-based resize instead of
sharp) — the same as Node, so the browser preprocessing is fine:

| | set 1 top-1 / top-5 (`food`) | set 2 top-1 / top-5 (`food`) | set 1 / set 2 top-1, best other template |
| --- | --- | --- | --- |
| mobileclip_b bnb4 | 83.2 / 96.8 | 81.3 / 97.9 | `ensemble` 82.4 · `plain` 83.3 on set 2 |
| mobileclip_s2 fp16 | 82.1 / 96.4 | 81.3 / 96.9 | `plain` 81.1 / 83.3 |
| siglip2_b16 q4 | 82.7 / 96.8 | 72.9 / 97.9 | `plain` 83.2 / 79.2 |

Where MobileCLIP-B bnb4 goes wrong (Chromium, `food`):

- Set 2: żurek 3/6 (→ mushroom / cabbage soup), placki 4/6 (→ schabowy), shawarma 4/7 (→ gyros
  pita, döner plate), pierogi 5/7 (→ dumplings, kopytka), rosół 5/7 (→ chicken soup); bigos,
  naleśniki and pad see ew were 100 %. Every set-2 dish except żurek had the right answer in the
  top 5 for ≥ 6 of 7 photos.
- Set 1, weakest classes: hamburger 2/8 (5× "cheeseburger"), ravioli 2/8, mac and cheese 2/8,
  chicken curry 3/8 (→ thai green curry, butter chicken), grilled salmon 4/8 (→ "salmon fillet with
  vegetables"). **Many "errors" are near-synonyms in the label list** — the catalog should merge or
  group such pairs (hamburger/cheeseburger, rosół/chicken soup, schabowy/chicken schnitzel), or
  treat them as equally good, because nutritionally they are close and the top-5 list covers them.

### Confidence

With softmax over `100 · cosine` (MobileCLIP-B bnb4, Chromium, both sets, 904 photos):

| top-1 probability | share of photos | top-1 correct |
| --- | --- | --- |
| ≥ 0.7 | 82 % | 90.7 % |
| ≥ 0.5 | 94 % | 85.8 % |
| < 0.4 | 4 % | 34 % |

A sensible mapping for the UI's confidence word: ≥ 0.7 "pewne", 0.4–0.7 "prawdopodobnie",
< 0.4 "niepewne" (open the search first). Shipping the text matrix as int8 (per-row scale) changed
top-1 by −0.4 points and top-5 by +0.1 — negligible.

## How to build it

### Files the browser downloads (self-hosted, cached by the service worker on first use)

From `https://huggingface.co/Xenova/mobileclip_b` (pin a revision when copying):

- `config.json`, `preprocessor_config.json` (small; transformers.js reads them),
- `onnx/vision_model_bnb4.onnx` — 52.3 MB (52 287 607 bytes; gzip barely helps, ~3–8 %),
- plus the ONNX Runtime WASM runtime from `node_modules/onnxruntime-web/dist`:
  `ort-wasm-simd-threaded.wasm` + `.mjs` (14.3 MB raw, 3.7 MB gzip) — **the plain build, not the
  `.asyncify` one** transformers.js picks by default (26.9 MB, +~450 MB RAM at run time, needed only
  for WebGPU).

```js
import { env, AutoProcessor, CLIPVisionModelWithProjection, RawImage } from '@huggingface/transformers';
env.allowRemoteModels = false;              // never fetch from huggingface.co at run time
env.localModelPath = '/models/';            // e.g. /models/Xenova/mobileclip_b/onnx/vision_model_bnb4.onnx
env.backends.onnx.wasm.wasmPaths = {        // otherwise it loads the runtime from cdn.jsdelivr.net
  mjs: '/ort/ort-wasm-simd-threaded.mjs',
  wasm: '/ort/ort-wasm-simd-threaded.wasm',
};
const processor = await AutoProcessor.from_pretrained('Xenova/mobileclip_b');
const model = await CLIPVisionModelWithProjection.from_pretrained('Xenova/mobileclip_b', {
  dtype: 'bnb4',   // ALWAYS explicit: the WASM default is q8
  device: 'wasm',
});
const { image_embeds } = await model(await processor(await RawImage.fromBlob(photoBlob)));
// L2-normalise image_embeds (512 floats), dot with each normalised dish embedding, sort.
```

### Preprocessing the browser must replicate (done by `AutoProcessor` from `preprocessor_config.json`)

MobileCLIP-B: convert to RGB → resize so the **shortest edge is 224** (bilinear, `resample: 2`) →
**center-crop 224 × 224** → scale to 0–1 (× 1/255) → **no mean/std normalisation**
(`do_normalize: false`) → NCHW float32 `[1, 3, 224, 224]`. Output `image_embeds`: 512 floats,
not normalised.

(For reference: MobileCLIP-S0/S1/S2 use 256 × 256 with the same rules; OpenAI CLIP uses 224, bicubic,
mean `[0.4815, 0.4578, 0.4082]`, std `[0.2686, 0.2613, 0.2758]`; SigLIP/SigLIP2 squash to 224 × 224
without crop, mean = std = 0.5, and take `pooler_output`.)

### Precomputing the text embeddings (build step, Node)

- Model: `Xenova/mobileclip_b` text side — `AutoTokenizer` + `CLIPTextModelWithProjection`,
  `onnx/text_model.onnx` (fp32, 254 MB; downloaded at build time only, never shipped).
- Tokenizer call: `tokenizer(texts, { padding: 'max_length', truncation: true })` (77 tokens, CLIP
  BPE, lower-cased).
- Text: `a photo of {name}, a type of food.` with an **English** dish name; for local dishes add a
  short gloss ("pierogi, Polish dumplings"). The ensemble of three templates did not help
  MobileCLIP-B, so one embedding per dish is enough.
- Output `text_embeds`: **512** floats → **L2-normalise** → store as float32 (≈ 2 KB per dish) or
  int8 with a per-row scale (≈ 0.5 KB per dish; tested, no loss). 300 dishes ≈ 600 KB float32 /
  150 KB int8.
- Scoring in the browser: `cos = dot(img_norm, text_norm)`; ranking uses `cos` alone. For a
  probability use `softmax(100 · cos)` — logit scale **100** (the CLIP convention; the learned
  value is not in the ONNX export and it only changes the probabilities, never the ranking). No bias
  (that is SigLIP-only: SigLIP2 base/16 would use `sigmoid(112.67 · cos − 16.77)`, SigLIP base/16
  `sigmoid(117.33 · cos − 12.93)`).
- **The text and image sides must come from the same repo and the same model** — embeddings of
  different MobileCLIP sizes are not interchangeable.

## Pitfalls hit

1. **8-bit MobileCLIP-S0/S1/S2 is broken.** `vision_model_quantized` / `_int8` / `_uint8` give
   chance-level results (top-1 < 1.5 %, cosine to fp32 ≈ 0.01–0.07) in Node *and* in the browser.
   The S-models are conv/re-parameterised (FastViT-style) and dynamic int8 quantisation destroys
   them. SigLIP2's q8 is also badly damaged (35 % top-1, cos 0.71); MobileCLIP-B / CLIP / SigLIP v1
   q8 lose 3–15 points. **transformers.js uses `q8` by default on `device: 'wasm'`**, so an
   unspecified `dtype` silently ships a broken model. Always pass `dtype`.
2. **q8 is not faster in WASM anyway** (ViT-B q8 ≈ fp32 speed single-threaded) and 4-bit is not
   faster either — the win of 4-bit is download size and memory, not speed.
3. **fp16 files work on WASM** (ORT inserts casts; same accuracy as fp32, same speed), so fp16 is a
   free 2× download saving for the conv models (S0/S1/S2), where `q4` barely shrinks the file
   (only MatMuls get quantised: S2 q4 is 118.7 MB vs fp16 71.7 MB).
4. **fp32 ViT-B encoders need 1.5–1.8 GB of renderer memory** in Chromium; the 4-bit files need
   ~0.5–0.6 GB. On iPhone Safari a tab that large is likely to be killed — this rules out every
   fp32/fp16 base-size model, whatever its accuracy.
5. **transformers.js 4.x loads the ONNX Runtime WASM from `cdn.jsdelivr.net` by default** and picks
   the `.asyncify` build (26.9 MB, WebGPU-capable) except on Safari < 26 without WebGPU. Self-host
   and set `env.backends.onnx.wasm.wasmPaths` to the plain `ort-wasm-simd-threaded.{mjs,wasm}`
   (14.3 MB, and ~450 MB less RAM in the test). The plain build ran every model here, including the
   `bnb4` (`MatMulBnb4`) and `q4` (`MatMulNBits`) contrib ops.
6. **Threads need cross-origin isolation.** Without COOP/COEP headers ORT Web runs one thread.
   With them MobileCLIP-B bnb4 goes from 0.88 s to 0.26 s per photo in Chromium (WebKit only
   0.81 → 0.68 s). Adding `Cross-Origin-Opener-Policy: same-origin` +
   `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`) is a cheap speed-up if
   nothing else on the page breaks.
7. **SigLIP is prompt-sensitive.** SigLIP v1 with "…, a type of food." collapsed to 23 % on set 2
   (it then prefers generic labels), while "a photo of {}." gave 73 %. SigLIP models must be fed
   `padding: 'max_length'`, `max_length: 64` (SigLIP2 additionally lower-cased text) — otherwise
   embeddings are wrong.
8. **`bnb4` vs WebGPU.** `MatMulBnb4` has no WebGPU kernel as far as I know, so if WebGPU is
   later enabled as a speed-up, either keep the bnb4 model on WASM or switch to the `q4` file
   (`MatMulNBits` does run on WebGPU) — q4 is 1.6 points lower on set 1 here. WebGPU itself was not
   measured (headless, no GPU).
9. **Wikimedia Commons and the HF datasets-server rate-limit hard (HTTP 429).** The fetch scripts
   back off and honour `Retry-After`; category listings are mixed with street scenes, menus and
   packaging, so set 2 was hand-picked from contact sheets.
10. **Node's default model cache is inside `node_modules/@huggingface/transformers/.cache`.** The
    benchmark set `env.cacheDir` to the scratchpad so nothing was written into the repo; the build
    script for text embeddings should do the same (or use a gitignored folder).

## Not tested / caveats

- Real phones (iPhone/Android). Timings above are an M-series Mac; WebKit (JavaScriptCore) via
  Playwright is the closest stand-in for iPhone Safari and ran everything without WebGPU.
- Real user photos: Food-101 and Commons images are mostly well-lit, one dish, close-up. Mixed
  plates, half-eaten food and packaging will score lower; the plate UI (several dishes per photo)
  will rely on top-5, not top-1.
- MobileCLIP2 (`plhery/mobileclip2-onnx`, `RuteNL/MobileCLIP2-*-OpenCLIP-ONNX`) exist only as
  community OpenCLIP exports without the transformers.js layout (no `preprocessor_config.json`
  / dtype variants) — skipped; worth a look later since MobileCLIP2 reports better zero-shot scores.
- Polish-language prompts for SigLIP2's multilingual text encoder.

## Benchmark scripts (scratchpad, not in the repo)

All under `/private/tmp/claude-501/-Users-pl2mac0030-kb/42fdd4fe-a437-44d2-8439-fe110763b6ab/scratchpad/food-models/`:

- `bench/fetch_food101.py` — stratified Food-101 validation sample via the datasets-server rows API.
- `bench/commons_findcat.py`, `bench/commons_fetch.py`, `bench/contact.py`, `bench/select_extra.py`
  — Wikimedia Commons candidates, contact sheets, the hand-picked set 2 with `_labels.csv`
  (source URL, licence, author).
- `bench/labels.mjs` — the 267-dish label set and the prompt templates.
- `bench/common.mjs` — model registry, loading via the repo's transformers.js, cache dir.
- `bench/embed_text.mjs` — text embeddings per model × template (the build step prototype).
- `bench/embed_images.mjs`, `bench/run_matrix.sh` — Node image embeddings + timings per model × dtype.
- `bench/score.mjs`, `bench/report.mjs`, `bench/calibrate.mjs` — accuracy tables, confidence and
  int8-text check.
- `bench/serve.mjs`, `www/index.html`, `bench/browser_bench.mjs`, `bench/run_browser.sh` — local
  http server (with a `/iso/` COOP/COEP path), the WASM test page, the Playwright driver
  (`BROWSER=webkit`, `FULL=1` for full-set accuracy in the browser).
- `bench/logit_params.py` — reads SigLIP `logit_scale`/`logit_bias` from safetensors headers via
  HTTP range requests.
- Results: `results/scores.json`, `results/browser.jsonl`, `results/text_*.json`, `results/img_*.json`.
