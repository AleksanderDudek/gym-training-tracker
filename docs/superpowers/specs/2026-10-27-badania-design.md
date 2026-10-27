# Lab results („Badania”) and a diet built on them — design

Date: 2026-10-27 · Status: decided autonomously on request ("czy jest jakiś lekki LLM … który jest
w stanie działać autonomicznie do zadanego prompta? … wrzucić go do aplikacji PWA, żeby był w stanie
przetwarzać dokumenty i wybierać z nich określony rodzaj danych … wyniki badań krwi / moczu … widok
personalizowanej diety w celu uzupełnienia tych braków … po kilku-kilkunastu tygodniach poprawić
wyniki … makroskładniki, witaminy, minerały, to co literatura medyczna sugeruje jako poziom zdrowia
… podstawowe, realne scenariusze badań … i premium … Diagnostyka … NFZ … masz wolną rękę … Pick
recommended. I am away from machine. Plan it out and then finish on your own").

Research behind the numbers: `docs/research/badania-laboratoryjne.md` (guidelines, NFZ lists,
Diagnostyka naming, result formats) and `src/food/labs/data/nutrients.json` (USDA FoodData Central).

## 1. The question: a light LLM in the PWA?

### What exists (2026)

| Engine | Runs on | Model size | Fit for lab results |
| --- | --- | --- | --- |
| WebLLM (MLC) | WebGPU | Qwen2.5-1.5B / Llama-3.2-1B / Gemma 2 2B: 0.9–1.5 GB | Works on a recent laptop, slow or out of memory on mid-range phones |
| Transformers.js (ONNX Runtime Web) | WASM / WebGPU | SmolLM2-360M, Qwen2.5-0.5B: 300–500 MB | Small enough, too weak to read a table without inventing numbers |
| MediaPipe LLM Inference | WebGPU | Gemma 3 1B: ~550 MB (int4) | Same trade-off as WebLLM |
| wllama (llama.cpp in WASM) | CPU | any GGUF | Slowest; minutes per page on a phone |
| Chrome built-in AI (Prompt API, Gemini Nano) | Chrome desktop only | downloaded by Chrome | No Android, no iPhone — most users of this app |

### Decision: no LLM in the first version — a deterministic reader with a confirmation screen

| Why | |
| --- | --- |
| The documents are already structured | A result is a row: name, value, unit, reference range, sometimes a flag. A dictionary of names plus a number/range grammar reads it exactly, in milliseconds, offline, with a 0-byte model. |
| A wrong digit is a health risk | Small models confuse columns and invent numbers (a reference limit becomes the result). A parser either reads the row or says it could not. |
| Download and battery | 0.5–1.5 GB is 100× the whole app; many phones have no WebGPU. |
| Privacy | Everything runs on the device; nothing is sent anywhere — same as the rest of the diet tab. |
| Verifiable | Unit tests cover every format; an LLM's output would need the same checks anyway. |

The reader sits behind one interface (`labs/read/` → `ReadResult`), so a model can be added later
as a fallback for rows the parser did not recognise, with a grounding rule: a number it returns is
accepted only if the same digits appear in that row of the source text. Recorded as "considered".

### How documents get in

| Source | How it is read | Notes |
| --- | --- | --- |
| PDF from Diagnostyka (or any lab portal) | pdf.js text layer (`pdfjs-dist`, lazy, own server), items grouped into rows by their y position | The main path for Diagnostyka; their results are text PDFs |
| Photo of a paper printout (typical NFZ) | Tesseract.js OCR with Polish data (lazy, own server, ~5 MB at the first photo), rows from word boxes | Slower (5–20 s); every row still goes through the same parser |
| Pasted text | Lines as pasted | Copy from a lab portal or IKP |
| Typed by hand | Marker picker + value + unit | Always available; also edits any read row |

Measured on a Diagnostyka-style printout („SPRAWOZDANIE Z BADANIA”, the layout from their own
annotated sample): the PDF gave 19 of 19 results and the collection date in 0.2 s. A 1600 px
picture of the same page at 1× lost decimal commas (4,01 → 401, vitamin D 18,6 → 186), read "58"
as "s8" and misspelt names; enlarged 2× before OCR, the same 19 rows came out exact in 1.8 s. So:

- photos are scaled so letters are about 30 px (up to 3×, at most 12 MP — the iPhone canvas limit);
- OCR text gets digit repairs (O→0, S→5, l→1, B→8 inside numbers) and names may have one typo
  (two from 10 letters);
- any read: a value with no decimals far above a printed range with decimals is flagged as a lost
  comma, not selected, with a one-tap „Popraw na 4,01”.

Every read ends on a review screen: each recognised row with its value, unit, the lab's range and
the app's verdict, editable, with a checkbox; unrecognised rows are listed separately; the date
of collection is detected or asked for. Nothing is saved before „Zapisz”. The file itself is never
stored — only the confirmed values.

## 2. The feature

### Where it lives

A diet sub-page `#/jedzenie/badania` („Badania”), a fifth tile in the diary's sub-navigation. Three
views in the address (`?widok=`): **Dieta pod wyniki** (default once results exist), **Wyniki**
(all reports, each marker's history), **Co zbadać** (what to test and how to prepare). Adding is a
sheet (`?dodaj=pdf|zdjecie|tekst|recznie`).

### Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Markers | ~60 in a catalog (`labs/markers.ts`): blood count, iron, vitamins, minerals, lipids, glucose, liver, kidney, thyroid, inflammation, urine; each with aliases as Polish labs write them, units with conversions, a fallback range by sex, the guideline target where one exists, retest weeks, and what diet can do | One source for parsing, verdicts and plans |
| Verdict | The lab's printed range first (method-specific); the catalog range when none; a guideline target on top where it differs ("w normie laboratorium, poniżej celu" — e.g. vitamin D 20–30 ng/ml, LDL above the general-population target) | Labs differ; guidelines say more than "within range" |
| Doctor first | Red-flag values (critical potassium/sodium, glucose ≥ 126 fasting or HbA1c ≥ 6.5 %, eGFR < 60, ALT > 3× upper limit, abnormal TSH, high ferritin with high iron, very low haemoglobin, protein/glucose/blood in urine…) get „Porozmawiaj z lekarzem” at the top, and no diet plan for that marker | The app is not a diagnosis; some of these are not diet problems |
| High-protein rule | eGFR < 60 or creatinine above range shows a warning on the diet view: the tab's protein-forward recipes are not for this without a doctor | THE RULE of the tab can harm kidneys that are already failing |
| Focus | At most three diet focuses („cele”), ordered by priority, from rules over the latest value of each marker (and combinations: low haemoglobin + low MCV → iron; high MCV → B12/folate) | Three things are doable for 12 weeks; ten are a list nobody follows |
| Each focus | What it means, the daily target (Polish norms 2020 by sex and age), foods ranked by amount per portion (USDA FoodData Central), a ready "example for today" that reaches the target, what to limit, absorption tips, weekly habits, retest date and what to retest | Concrete enough to act on in a shop |
| Food data | ~130 foods eaten in Poland, per 100 g, from USDA FoodData Central SR Legacy (CC0), unfortified items (US milk/flour are fortified, Polish are not); recipes get micronutrients through ingredient mapping | Open Food Facts has macros only; USDA is public domain and complete |
| Eating style | „Jem wszystko / bez mięsa / wegańsko” on the diet view; foods outside the style are not proposed; vegan + B12 says food is not enough | Recommending liver to a vegan is useless |
| Conflicts | Uric acid high → no organ meat in iron lists; LDL high + keto profile → a note; vitamin K foods → a note for warfarin/acenocoumarol users; Brazil nuts capped at 2 a day (selenium UL) | Fixing one marker must not break another |
| Vitamin D | Diet lists fish and eggs, and says plainly that food rarely fixes a deficit; quotes the Polish guideline for adults; a dose for deficiency is for the doctor | Honest about what diet can do |
| Habits | Weekly habits per focus („Tłusta ryba 2× w tygodniu”, „Strączki 4×”, „Garść orzechów codziennie”) with a +1 for today, counted per ISO week in the day rows | Adherence over weeks is what moves a marker |
| Retest | Start date = the day the plan was started; retest = start + the longest retest time among the focuses (ferritin/vit D/B12 ~12 weeks, lipids 8, HbA1c 12); the page shows the date and what to ask for | The user's goal: a better result after weeks |
| Recipes | "Przepisy, które pomagają": the tab's recipes ranked by the focus nutrient per serving, opening the recipe in Przepisy (`?przepis=`) | The tab already has protein recipes; now they serve a lab goal too |
| What to test | Scenarios: **NFZ podstawowe** (from a GP), **NFZ program profilaktyczny**, **Rozszerzone** (paid, e.g. Diagnostyka), **Premium**; each lists markers and why they matter for diet; a personal hint ("you have low haemoglobin but no ferritin — ask for it"); preparation rules | People don't know what to ask for |
| Storage | Dexie v5: table `labs` (one row per report: date, lab, source, results); `DayRow.labHabits`; labs preferences in the profile-free row `labs:prefs`; in the backup and the reset | Same privacy and backup as the diary |
| Safety copy | A short permanent line: informational, not a diagnosis; pregnancy has other ranges; under 18 has other ranges | |
| CSS | New area `fd-lab-` | `src/food/css.test.ts` |
| Language | Every string Polish and English (`text`/`say`) | `docs/i18n.md` |

### Safety thresholds

The doctor-first values follow `docs/research/badania-laboratoryjne.md` §4. Some are the
research's "app policy" (conservative, not verbatim from one guideline) and are listed there for a
clinician to review before a public launch: potassium < 3.0 or > 6.0 urgent, TG ≥ 500, eGFR < 60
(doctor) and < 30 (no plan at all), ALT/AST > 3× the upper limit, ferritin < 15, B12 < 180, vitamin D
< 10 or > 100, HbA1c ≥ 9 urgent, TSH < 0.1 or > 10 urgent, ketones with glucose urgent. Under 18 no
plan is made.

### Considered, not done now

- An on-device LLM fallback for unrecognised rows (see §1).
- Micronutrients from the diary: logged products have macros only, so the app cannot count a day's
  iron honestly; habits are counted instead.
- Reading results from IKP or lab portals directly: no public API; the file or a screenshot is how
  people get them out.
- Supplement doses: only the public vitamin D guideline is quoted; anything else is for a doctor or
  pharmacist.
- IKP's CDA XML documents (structured, with lab codes) — patients' access to the raw XML is
  unverified; the PDF inside or a screenshot covers it for now.
- Medicines (anticoagulants, ACE inhibitors) as a profile field: the advice carries the warnings
  in text (vitamin K consistency, no potassium salt) instead of asking about medicines.
- A "Normy żywienia 2024" refresh: its PDF returned 404 on 2026-10-27; the 2020 values are used.
