# Badania laboratoryjne — research for the "Badania" diet feature

Research date: 2026-10-27. Scope: what Polish adults realistically have on a lab printout
(NFZ/POZ for free, or paid Diagnostyka packages), how those printouts look, what each marker
means for a diet plan, and which values must stop the app and send the person to a doctor.

Conventions in this file:

- Polish names are kept verbatim (as the regulation / lab writes them, including typos such as
  "HbAlc" in the official POZ list).
- "unverified" = I could not confirm it from a primary or reliable source during this research.
- The app is informational. Every diet suggestion must be gated by the red-flag column in §4.

---

## 1. NFZ basics

### 1.1 What a lekarz POZ can order for free (current law)

Legal basis: rozporządzenie Ministra Zdrowia z dnia 24 września 2013 r. w sprawie świadczeń
gwarantowanych z zakresu podstawowej opieki zdrowotnej, consolidated text Dz.U. 2023 poz. 1427
(<https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20230001427>, PDF
<https://api.sejm.gov.pl/eli/acts/DU/2023/1427/text.pdf>), amended by Dz.U. 2025 poz. 584 of
30 April 2025, in force 5 May 2025 (<https://api.sejm.gov.pl/eli/acts/DU/2025/584/text.pdf>).
Patient-facing summary (modified 17.03.2026): <https://pacjent.gov.pl/jakie-badania-moze-zlecic-lekarz-poz>

The list is in załącznik nr 1, **część IV** (paid from the POZ capitation) and **część IVa**
("budżet powierzony" — NFZ pays the lab per test, added by Dz.U. 2022 poz. 1293, in force
1 July 2022). Verbatim, diet-relevant entries only:

**Część IV — 1. Badania hematologiczne**

1. morfologia krwi obwodowej z płytkami krwi
2. morfologia krwi obwodowej z wzorem odsetkowym i płytkami krwi
3. retikulocyty
4. odczyn opadania krwinek czerwonych (OB)

**Część IV — 2. Badania biochemiczne i immunochemiczne** (numbering as in the act)

| # | Entry (verbatim) | Diet relevance |
|---|---|---|
| 1 | sód | hydration / salt context, red flags only |
| 2 | potas | CKD / drug caution |
| 3 | wapń zjonizowany | |
| 4 | żelazo | iron status (weak alone) |
| 5 | żelazo ‒ całkowita zdolność wiązania (TIBC) | iron status |
| 6 | stężenie transferyny | iron status |
| 7 | stężenie hemoglobiny glikowanej (HbAlc) | glycaemia (sic: "HbAlc" with letter l) |
| 8 | mocznik | protein intake / kidney |
| 9 | kreatynina | kidney (eGFR is computed by the lab) |
| 10 | glukoza | glycaemia |
| 11 | test obciążenia glukozą | OGTT |
| 12 | białko całkowite | |
| 13 | proteinogram | |
| 14 | albumina | |
| 15 | białko C-reaktywne (CRP) | inflammation |
| 16 | kwas moczowy | uric acid |
| 17 | cholesterol całkowity | lipids |
| 18 | cholesterol-HDL | lipids |
| 19 | cholesterol-LDL | lipids |
| 20 | triglicerydy (TG) | lipids |
| 21 | bilirubina całkowita | liver |
| 22 | bilirubina bezpośrednia | liver |
| 23 | fosfataza alkaliczna (ALP) | liver/bone |
| 24 | aminotransferaza asparaginianowa (AST) | liver |
| 25 | aminotransferaza alaninowa (ALT) | liver / MASLD |
| 26 | gammaglutamylotranspeptydaza (GGTP) | liver / alcohol |
| 28 | kinaza kreatynowa (CK) | exercise artefact |
| 32 | hormon tyreotropowy (TSH) | thyroid |
| 35 | FT3 | thyroid |
| 36 | FT4 | thyroid |
| 38 | stężenie wapnia całkowitego w surowicy krwi | added by Dz.U. 2025 poz. 584 (from 5 May 2025) |

Also on the list but not diet-relevant: amylaza, ACP, RF, ASO, HBs, VDRL, PSA, INR, APTT, fibrynogen.

**Część IV — 3. Badania moczu**: ogólne badanie moczu z oceną właściwości fizycznych,
chemicznych oraz oceną mikroskopową osadu; ilościowe oznaczanie białka; ilościowe oznaczanie
glukozy; ilościowe oznaczanie wapnia; ilościowe oznaczanie amylazy.

**Część IVa — budżet powierzony (since 1 July 2022)**: ferrytyna; witamina B12; kwas foliowy;
anty-CCP; CRP – szybki test ilościowy (dzieci do 6 r.ż.); przeciwciała anty-HCV; antygen
H. pylori w kale; Strep-test; HIV test przesiewowy (added 2025). Ferritin, B12 and folate
arrived on 1 July 2022 (<https://www.mp.pl/pacjent/poradnik-swiadomego-pacjenta/301625,wiecej-badan-w-poz>).

**Opieka koordynowana (KOS-POZ)** — extra tests only for patients with that diagnosis, in a POZ
that signed up for opieka koordynowana (same act, Dz.U. 2023 poz. 1427, "Warunki realizacji
świadczeń opieki koordynowanej"):

- nadciśnienie / niewydolność serca / ChNS / AF: BNP (NT-proBNP), albuminuria, UACR (+ ECG/echo etc.)
- cukrzyca: albuminuria (stężenie albumin w moczu), UACR (wskaźnik albumina/kreatynina w moczu)
- choroby tarczycy: antyTPO, antyTSHR, antyTg (+ biopsja)
- every module includes **"konsultacje dietetyczne"** — i.e. a diagnosed patient can get a
  NFZ dietitian in KOS-POZ; the app could point to that.

**NOT on any POZ list (patient pays, or needs a specialist referral):**

- **witamina D 25(OH)D** — not on the list. This is the single most-asked test that people
  buy privately.
- lipoproteina (a) — only once in life inside "Moje Zdrowie" (age 20–40), see 1.2.
- apoB, insulina, HOMA-IR, homocysteina, holotranskobalamina (aktywna B12), magnez, cynk,
  selen, fosfor, witaminy A/E, omega-3 index, jod w moczu, hs-CRP, anty-TPO (except KOS-thyroid),
  cholesterol nie-HDL as an *ordered* test (labs compute it anyway when they report a lipidogram).
- eGFR is not a separate item — the lab reports it next to kreatynina (most labs do this
  automatically with CKD-EPI 2009/2021; unverified for every lab).
- "lipidogram" as a single item does not exist in część IV — the doctor ticks the four
  components separately (cholesterol całkowity, HDL, LDL, TG). Labs print them as a panel
  called "Lipidogram".

Practical consequence for the app: a typical NFZ printout of a Polish adult has
morfologia (+/- rozmaz), glukoza, often HbA1c, lipids (4 items, sometimes nie-HDL computed),
kreatynina + eGFR, ALT/AST/GGTP, TSH (+/- FT4), sód/potas, kwas moczowy, CRP, badanie ogólne moczu,
and since 2022 increasingly ferrytyna / B12 / kwas foliowy. Vitamin D is almost always private.

### 1.2 "Moje Zdrowie – bilans zdrowia osoby dorosłej" (replaced "Profilaktyka 40 PLUS")

Introduced into the POZ basket by Dz.U. 2025 poz. 584 (in force 5 May 2025;
<https://api.sejm.gov.pl/eli/acts/DU/2025/584/text.pdf>, część VI of załącznik nr 1).
Profilaktyka 40 PLUS was a pilot (art. 48e) that ended; Bilans can be done 12 months after the
last 40 PLUS test.

- **Who:** adults on a POZ doctor's list; from age 20. Frequency: **every 5 years at age
  20–49, every 3 years above 49** (age counted by year of birth only).
- **Flow:** online questionnaire KBZOD in IKP / mojeIKP or on paper at the POZ → staff
  approve it and generate the lab order within 30 days → tests → summary visit with
  **Indywidualny Plan Zdrowotny (IPZ)** → up to two educational advice visits (also by a
  dietetyk) and FIT stool test for 50+.
- **Basic lab scope (everyone):**
  1. morfologia krwi
  2. stężenie glukozy w osoczu krwi żylnej
  3. stężenie kreatyniny we krwi wraz z oszacowaną wartością eGFR
  4. lipidogram: cholesterol całkowity, LDL, HDL, **cholesterol nie-HDL**, triglicerydy
  5. TSH
  6. badanie ogólne moczu
- **Extended scope (conditional on age, sex, questionnaire answers):** ALT ("ALAT"), AST
  ("AspAT"), GGTP, PSA (men >50), anty-HCV, **lipoproteina (a) — once in life between age 20
  and 40**.
- Note: **no HbA1c, no ferritin, no vitamin D** in the Bilans. Summary visit includes BMI, WHR,
  waist circumference and blood pressure — the app could import those too.
- Secondary confirmation and IKP sign-up: <https://www.gazetaprawna.pl/biznes/zdrowie/artykuly/10644889,program-moje-zdrowie-2026-darmowe-badania-na-ikp-jak-z-nich-skorzystac.html> ;
  the ministry plans to digitise the IPZ by end of 2026 (same source; unverified on gov.pl).

Separate older programme still in the same act: **profilaktyka chorób układu krążenia (ChUK)**
— age 35–65, no CVD/diabetes/CKD/FH, once per 5 years: cholesterol całkowity, LDL, HDL, TG,
glukoza, blood pressure, BMI, SCORE2 risk based on nie-HDL (Dz.U. 2023 poz. 1427, załącznik nr 1
część II; the 2025 amendment added an FH screening item with nie-HDL "wartość wyliczana").

### 1.3 Do lab results land in IKP / mojeIKP?

- Lab results are a type of EDM ("wyniki badań laboratoryjnych wraz z opisem") that facilities
  must report to the P1 system; visible in IKP under "Historia leczenia" → "Zdarzenia medyczne"
  **only if the facility has integrated EDM** — otherwise the patient sees only the event
  (<https://pacjent.gov.pl/aktualnosc/twoja-e-dokumentacja-medyczna>, modified 25.04.2025).
- mojeIKP (mobile app) shows EDM documents in event details since March 2026: "możesz je
  wyświetlić na ekranie telefonu lub pobrać"; filter "Zdarzenia medyczne" to events with EDM
  (<https://pacjent.gov.pl/aktualnosc/twoja-dokumentacja-medyczna-w-mojeikp>, published 11.03.2026,
  modified 04.09.2026).
- **Format:** EDM documents are **PIK HL7 CDA** (Polska Implementacja Krajowa) XML files that
  reference an XSLT transform for display; they may contain an **embedded PDF** (CeZ Q&A: "IKP
  będzie umożliwiało poprawny podgląd dokumentów w standardzie PIK HL7 CDA, zawierających
  osadzony plik PDF. Funkcjonalność została już udostępniona" — <https://ezdrowie.gov.pl/pobierz/15343>).
  What exactly the patient's "Pobierz" button returns (XML, rendered HTML, or PDF) is
  **unverified**; in practice users mostly share the lab's own PDF or a screenshot.
  Implication: the importer should accept (a) a lab PDF, (b) pasted text, and ideally (c) a
  CDA XML (structured `observation` entries with LOINC/lab codes would be the most reliable
  source — unverified that patients can get the raw XML).

---

## 2. Diagnostyka (diag.pl) — packages and exact marker names

General notes:

- Diagnostyka is the largest private lab network in Poland; many POZ clinics outsource their
  NFZ tests to Diagnostyka or ALAB, so an NFZ result can come on a Diagnostyka printout too
  (the printout header then shows the clinic as "Zlecający" instead of "Badanie płatne" — see §3).
- Packages are sold online as "e-Pakiet …" (pay online, then walk into a punkt pobrań). Package
  composition below was read from each package page on 2026-10-27; packages change, so the app
  must recognise **individual markers**, never package names.
- Each single test has a numeric Diagnostyka **"Kod badania"** and a **"Kod ICD"** (this is the
  Polish ICD-9 lab-procedure code used on NFZ referrals, e.g. ferrytyna = L05) — see 2.3.
- Package overview page: <https://diag.pl/sklep/pakiety-badan/>; diet category
  <https://diag.pl/sklep/pakiety-badan/kategoria/dieta/>; elements category
  <https://diag.pl/sklep/pakiety-badan/kategoria/pierwiastki/>.

### 2.1 Packages relevant to diet (markers verbatim as listed under "Pakiet zawiera następujące badania")

| Package (URL slug under diag.pl/sklep/pakiety/) | Markers (verbatim) |
|---|---|
| **e-Pakiet badanie niedoboru witamin i minerałów** (`e-pakiet-badanie-niedoboru-witamin-i-mineralow`) | Żelazo; Wapń całkowity; Magnez; Fosfor nieorganiczny; Kwas foliowy; Witamina B12; Witamina D3 metabolit 25(OH); Cynk, ilościowo |
| **e-Pakiet badania na anemię** (`e-pakiet-badania-na-anemie`) | OB; Ferrytyna; Żelazo; Morfologia krwi; Kwas foliowy; Witamina B12 |
| **e-Pakiet dla wegan i wegetarian** (`e-pakiet-dla-wegan-i-wegetarian`) | Ferrytyna; Żelazo; Białko całkowite; Albumina; Wapń całkowity; Elektrolity (Na, K); Homocysteina; Morfologia krwi; Witamina B12; Witamina D3 metabolit 25(OH); Glukoza |
| **e-Pakiet badania na insulinooporność** (`e-pakiet-badania-na-insulinoopornosc`, kod 7828) | Ferrytyna; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Próby wątrobowe (ALT, AST, ALP, BIL, GGTP); Morfologia krwi; TSH; Kwas foliowy; Witamina B12; Hemoglobina glikowana (HbA1c); Wskaźnik insulinooporności HOMA-IR |
| **e-Pakiet przed dietą – kompleksowy (badania do dietetyka)** (`e-pakiet-przed-dieta-kompleksowy-badania-do-dietetyka`) | Kreatynina; Lipaza; Ferrytyna; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Sód; Potas; Wapń całkowity; Magnez; Próby wątrobowe (ALT, AST, ALP, BIL, GGTP); Morfologia krwi; TSH; FT4; FT3; Kwas foliowy; Witamina B12; Transferyna; Insulina; Witamina D3 metabolit 25(OH); Glukoza |
| **e-Pakiet fit & active maximum** (`e-pakiet-fit-active-maximum`) | Kreatynina; Ferrytyna; Żelazo; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Próby wątrobowe (ALT, AST, ALP, BIL, GGTP); Elektrolity (Na, K); CRP, ilościowo; Morfologia krwi; TSH; FT4; FT3; anty-TG; anty-TPO; Kwas foliowy; Witamina B12; Insulina; Witamina D3 metabolit 25(OH); Kortyzol; Leptyna; P/c. p .transglutaminazie tkankowej (anty-tTG) w kl. IgA met. CLIA; Glukoza; Hemoglobina glikowana |
| **e-Pakiet sportowy na start – rozszerzony** (`e-pakiet-sportowy-na-start-rozszerzony`) | Kreatynina; Mocz - badanie ogólne; Ferrytyna; Fibrynogen; Mocznik; Białko całkowite; Albumina; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Wapń całkowity; Magnez; Próby wątrobowe (ALT, AST, ALP, BIL, GGTP); Elektrolity (Na, K); hs CRP; Peptyd natriuretyczny; Morfologia krwi; TSH; Witamina B12; Transferyna; Witamina D3 metabolit 25(OH); Cynk, ilościowo; Glukoza |
| **e-Pakiet sportowy przed suplementacją** (`e-pakiet-sportowy-przed-suplementacja`, kod 7775) | Ferrytyna; Żelazo; Białko całkowite; Albumina; Wapń całkowity; Magnez; Witamina D3 metabolit 25(OH); Witamina A; Panel pierwiastków Zn, Se, I (cynk, selen, jod) |
| **e-Pakiet pierwiastków – podstawowy** (`e-pakiet-pierwiastkow-podstawowy`) | Żelazo; Wapń całkowity; Magnez; Fosfor nieorganiczny; Panel pierwiastków Zn, Cu, Se (cynk, miedź, selen) |
| **e-Pakiet tarczycowy rozszerzony** (`e-pakiet-tarczycowy-rozszerzony`) | TSH; FT4; P/c. p. receptorom TSH (TRAb); FT3; anty-TG; anty-TPO |
| **e-Pakiet dla kobiet** (`e-pakiet-dla-kobiet-ogolny`) | GGTP; Kreatynina; Mocz - badanie ogólne; Fibrynogen; ALT; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Magnez; CRP, ilościowo; Morfologia krwi; TSH; FSH; Witamina D3 metabolit 25(OH); Glukoza |
| **e-Pakiet dla mężczyzn** (`e-pakiet-dla-mezczyzn`) | GGTP; Kreatynina; OB; D-dimer; Fibrynogen; Mocznik; ALT; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Elektrolity (Na, K); CRP, ilościowo; Morfologia krwi; TSH; Testosteron; PSA całkowity; Glukoza; hs Troponina I, stratyfikacja ryzyka |
| **e-Pakiet dla każdego (maksimum)** (`e-pakiet-dla-kazdego-maksimum`) | Kreatynina; APTT; PT (INR); OB; Fibrynogen; Amylaza; Mocznik; Żelazo; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Wapń całkowity; Magnez; Próby wątrobowe (ALT, AST, ALP, BIL, GGTP); Elektrolity (Na, K); CRP, ilościowo; Morfologia krwi; TSH; Glukoza |
| **e-Pakiet dla każdego (premium)** (`e-pakiet-dla-kazdego-premium`) | GGTP; Kreatynina; PT (INR); Ferrytyna; ALT; Albumina; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Wapń całkowity; Magnez; CRP, ilościowo; Morfologia krwi; TSH; FT4; Witamina B12; Hemoglobina glikowana (HbA1c); Witamina D3 metabolit 25(OH); Glukoza; Lipoproteina(a) [Lp(a)] |
| **e-Pakiet kompleksowe badania krwi** (`e-pakiet-kompleksowe-badania-krwi`) — the most "check-up/premium"-like | Kreatynina; PT (INR); Ferrytyna; Albumina; Lipidogram (CHOL, HDL, nie-HDL, LDL, TG); Kwas moczowy; Wapń całkowity; Magnez; Próby wątrobowe (ALT, AST, ALP, BIL, GGTP); CRP, ilościowo; Peptyd natriuretyczny; Morfologia krwi; TSH; FT4; FT3; anty-TPO; Witamina B12; Hemoglobina glikowana (HbA1c); Witamina D3 metabolit 25(OH); Glukoza; Lipoproteina(a) [Lp(a)]; Apo B |

Other diet-category packages exist (e-Pakiet chudnij zdrowo z dietetykiem, e-Pakiet badań na
diecie ketogenicznej, celiac packages, IgG "food intolerance" panels such as IMMUNOdiagDIETA /
ImuPro / myfoodprofile, GENOdiagDIETA genetics) — IgG food panels are not evidence-based for
diet exclusion and the app should ignore them (not in scope of this research; unverified claim
here only that they exist, from the category page).

Notes that matter for parsing:

- The package page and its description sometimes spell the same marker differently:
  "Witamina D3 metabolit 25(OH)" (list) vs "witamina D metabolit 25(OH)" (description);
  "anty-TG" vs "anty-tGT"; "Hemoglobina glikowana" vs "Hemoglobina glikowana (HbA1c)";
  "FT4" vs "fT4". The single-test URL is `/sklep/badania/witamina-d-metabolit-25oh/` while the
  name is "Witamina D3 metabolit 25(OH)" (synonyms on the page: "25-hydroksy witamina D,
  kalcydiol, hydroksywitamina") — <https://diag.pl/sklep/badania/witamina-d-metabolit-25oh/>.
  **Do not confuse with "Witamina D3 metabolit 1,25(OH)2"** (`witamina-d3-metabolit-125oh2`),
  the active hormone, useless for status and often high-normal in deficiency.
- "Lipidogram (CHOL, HDL, nie-HDL, LDL, TG)" (kod 14): nie-HDL is computed (CHOL − HDL); LDL is
  **calculated** "ze wzoru poprawnego dla wartości trójglicerydów mniejszej niż 4,5 mmol/l
  (400 mg/dl)" (i.e. Friedewald-type), and **not reported when TG ≥ 400 mg/dl**; fasting not
  required (<https://diag.pl/sklep/badania/lipidogram-chol-hdl-nie-hdl-ldl-tg/>). A separate
  test "Cholesterol LDL met. bezpośrednia" exists (`cholesterol-ldl-met-bezposrednia`).
- "Próby wątrobowe (ALT, AST, ALP, BIL, GGTP)" and "Elektrolity (Na, K)" are panels: the
  printout lists the components (ALT, AST, ALP, bilirubina, GGTP; sód, potas) as rows.
- "Wskaźnik insulinooporności HOMA-IR" (kod 149) — fasting glucose + insulin, draw before 9:00,
  page recommends repeating 3–4× (<https://diag.pl/sklep/badania/wskaznik-insulinoopornosci-homa-ir/>).
  Insulin curves exist as "Insulina po obciążeniu 75 g glukozy (0, 1, 2 …)" and OGTT as
  "Test obciążenia glukozą 2pkt/3pkt/4pkt 75g …".
- "Holotranskobalamina" (kod 3491), synonym "aktywna witamina B12"; stop B12 supplements 72 h
  before (<https://diag.pl/sklep/badania/holotranskobalamina/>).
- "Morfologia krwi" (kod 3, ICD C55) is the 5-diff CBC "Morfologia krwi pełna z rozmazem
  automatycznym (tzw. morfologia 5 diff)"; parameters listed: RBC, HGB, HCT, MCV, MCH/MCHC,
  RDW, WBC, Neutrofile, Limfocyty, Monocyty, Eozynofile, Bazofile (% and absolute), PLT, MPV,
  PDW, P-LCR, PCT. Example refs on the page: "WBC 4,0–10,0 tys./µl, płytki krwi 150–400 tys./µl,
  MCV 80–92 fl, MCH 27–31 pg, MCHC 32–36 g/dl" (<https://diag.pl/sklep/badania/morfologia-krwi-pelna/>).
  Whether the actual printout row label is "HGB", "Hemoglobina" or "Hemoglobina (HGB)" is
  **unverified** — the parser must accept all three.
- **Omega-3 index: Diagnostyka does not sell one** (no such product in the diag.pl product
  sitemap <https://diag.pl/sitemaps/sitemap-products.xml>, checked 2026-10-27; only "VLCFA"
  and "IgE omega-5 gliadyna", which are unrelated). ALAB sells "Omega 3" (symbol OMEGA3):
  EPA+DHA in blood with an omega-3 index; bands <4 low, 4–8 moderate, >8 good; 10 working days
  (<https://www.alab.pl/badanie/omega-3>).
- Diagnostyka does sell: Witamina A, Witamina E, Witamina K1, Witamina C (kwas askorbinowy),
  Jod w moczu, Jod ilościowo, Selen ilościowo, Cynk w surowicy ilościowo, Apo B, Apo A1,
  Lipoproteina(a) [Lp(a)], hs-CRP ("hs CRP"), Homocysteina, Kwas foliowy w erytrocytach,
  Rozpuszczalny receptor transferyny, UIBC, TIBC, Transferyna, Wskaźnik albumina/kreatynina w
  moczu (ACR) — all present in the product sitemap above. **No "wysycenie transferyny" product**
  at Diagnostyka (it is computed from Fe and TIBC; ALAB sells "Stopień wysycenia transferyny").

### 2.2 Alternative spellings in other labs (for the alias table)

| Marker | Diagnostyka | ALAB (from alab.pl test slugs, sitemap 2026-10-27) | Hospital (WIM-PIB POZ list, 27.01.2026) | Other common forms |
|---|---|---|---|---|
| Vitamin D | Witamina D3 metabolit 25(OH) | Witamina D 25(OH); also "Witamina 25(OH)D2+D3 metodą HPLC" | — | 25(OH)D, 25-OH-D, 25-OH witamina D, Witamina D (25-OH), Vitamin 25-OH D3 / witamina 25OH-D3 (Synevo, <https://store.synevo.pl/en/p/witamina-d-badanie>), kalcydiol |
| Ferritin | Ferrytyna | Ferrytyna | Ferrytyna | FERR, Ferritin |
| B12 | Witamina B12 | Witamina B12 | Witamina B12 | Kobalamina, Vit. B12, B12 |
| Active B12 | Holotranskobalamina | Holo-transkobalamina | — | holoTC, aktywna witamina B12, Active-B12 |
| Folate | Kwas foliowy | Kwas foliowy | Kwas foliowy | Foliany, FOL, Folate |
| HbA1c | Hemoglobina glikowana (HbA1c) | Hemoglobina glikowana HbA1c (also "metodą HPLC") | Hemoglobina glikowana HbA1c (%) | HbA1c, HbAlc (regulation typo), A1c |
| Glucose | Glukoza | Glukoza | Glukoza w surowicy | Glukoza na czczo, GLU, Glukoza w osoczu |
| Lipids | Cholesterol całkowity / HDL / nie-HDL / LDL / TG (in "Lipidogram") | Cholesterol całkowity; Cholesterol HDL w surowicy; Cholesterol LDL wyliczany; Cholesterol LDL bezpośredni zmierzony; Triglicerydy | Cholesterol całkowity; Cholesterol HDL; Cholesterol LDL; Triglicerydy | CHOL, TC, HDL-C, LDL-C, non-HDL, nieHDL, TG, Trójglicerydy (old spelling, used by pacjent.gov.pl) |
| ALT | ALT | Aminotransferaza alaninowa (ALT) | Aminotransferaza alaninowa ALT | ALAT, GPT, AlAT |
| AST | AST | Aminotransferaza asparaginianowa (AST) | Aminotransferaza asparaginianowa AST | AspAT, ASPAT, GOT |
| GGT | GGTP | Gamma-glutamylotranspeptydaza (GGTP) | Gamma-glutamylotransferaza GGT | GGT, γ-GT, gammaGT |
| Creatinine | Kreatynina | Kreatynina w surowicy | Kreatynina w surowicy | CREA, eGFR printed as separate row |
| Uric acid | Kwas moczowy | Kwas moczowy w surowicy | Kwas moczowy w surowicy | UA, URIC |
| TSH | TSH | Tyreotropina (TSH) trzeciej generacji | TSH [Tyreotropina] | hTSH, TSH 3 gen. |
| fT4/fT3 | FT4, FT3 | (wolna tyroksyna/trójjodotyronina) | FT4 [wolna tyroksyna], FT3 [wolna trijodotyronina] | fT4, FT-4, FT 4 |
| anti-TPO | anty-TPO | Pc. przeciw peroksydazie tarczycowej (aTPO) | — | ATPO, TPOAb, aTPO |
| CRP | CRP, ilościowo; hs CRP | Białko C-reaktywne (CRP) ilościowe; CRP-hs wysokiej czułości | Białko C-reaktywne CRP | CRP, hsCRP |
| Iron | Żelazo | Żelazo | Żelazo | Fe |
| TIBC/UIBC | TIBC; UIBC | Całkowita zdolność wiązania żelaza (TIBC); UIBC – utajona zdolność wiązania żelaza | Żelazo całkowita zdolność wiązania żelaza TIBC (parametr wyliczany); UIBC | — |
| TSAT | (computed only) | Stopień wysycenia transferyny | — | Wysycenie transferyny żelazem, TSAT, Saturacja |
| Magnesium | Magnez | Magnez w surowicy / Magnez we krwi | — | Mg |
| Calcium | Wapń całkowity | Wapń całkowity w surowicy; Wapń zjonizowany | Wapń całkowity w surowicy | Ca, Ca2+ (ionised) |
| Phosphorus | Fosfor nieorganiczny | Fosfor nieorganiczny w surowicy | — | P, fosforany |
| Lp(a) | Lipoproteina(a) [Lp(a)] | Lipoproteina (a) (Lp(a)) | Lipoproteina (a) | Lp(a), LPA |
| apoB | Apo B | Apolipoproteina B (Apo B) | — | ApoB |
| Insulin | Insulina | Insulina | — | INS |
| Homocysteine | Homocysteina | Homocysteina (also HPLC) | — | Hcy |
| Urinalysis | Mocz - badanie ogólne | Badanie ogólne moczu | Badanie ogólne moczu | Badanie ogólne moczu z osadem, BOM |

ALAB slugs: <https://www.alab.pl/sitemap_alab_badania_pakiety.xml> (names inferred from URL
slugs, e.g. `tyreotropina-tsh-trzeciej-generacji-l69`, `stopien-wysycenia-transferyny`; exact
capitalisation/punctuation on the printout unverified). Hospital names: WIM-PIB "Lista badań
wykonywanych w Zakładzie Diagnostyki Laboratoryjnej … dla POZ", 27.01.2026
(<https://eduroam.wim.mil.pl/wp-content/uploads/2026/02/Lista-badan_metody-ZDL-DLA-POZ.pdf>).

### 2.3 ICD-9 lab codes (useful stable keys)

Polish NFZ referrals and lab catalogs use "ICD-9" lab procedure codes (letter + 2 digits);
Diagnostyka prints them as "Kod ICD" on each test page and ALAB appends them to URL slugs. They
are the same across labs, so they are a good secondary key when a name is ambiguous (e.g. in a
CDA document). Collected from the WIM list, ALAB slugs and diag.pl pages above:

C53 morfologia; C55 morfologia z rozmazem (5-diff); I99 cholesterol całkowity; K01 HDL;
K03 LDL; O49 triglicerydy; L43 glukoza; L55 HbA1c; M37 kreatynina; M45 kwas moczowy; N13 mocznik;
N45 potas; O35 sód; O77 wapń całkowity; O75 wapń zjonizowany; L23 fosfor nieorganiczny;
M87 magnez; K15 cynk; O31 selen; M07 jod; O95 żelazo; O93 TIBC/UIBC; O43 transferyna;
L05 ferrytyna; O83 witamina B12; M41 kwas foliowy; L69 TSH; O55 FT3; O69 FT4; O09 anty-TPO;
I17 ALT; I19 AST; L31 GGTP; L11 ALP; I89 bilirubina całkowita; I81 CRP; M69 Lp(a); I67 apoB;
L97 insulina; L62 homocysteina; O81 witamina A; A01 badanie ogólne moczu; I09 albumina w moczu
(nefelometria). (Vitamin D 25(OH) code not captured — unverified; commonly cited as "O..";
do not rely on it.)

---

## 3. Result printout format

### 3.1 Diagnostyka "SPRAWOZDANIE Z BADANIA" (official annotated sample)

Source: Diagnostyka's own "Jak czytać wyniki" interactive sample report
(<https://diag.pl/pacjent/poradnik-pacjenta/jak-czytac-wyniki/>, modified 2024-05-14; tooltip
texts from the page's JS bundle). Layout, top to bottom:

1. **Lab block**: "Diagnostyka S. A.", address, phone, "Nr księgi rejestrowej Podmiotu
   Leczniczego …", "Laboratorium oddziału Kraków", "Zakład Diagnostyki Laboratoryjnej (533)",
   barcode, title **"SPRAWOZDANIE Z BADANIA"**.
2. **Order block (label: value)**: "Zlecający:" (e.g. "Badanie płatne" for self-paid, otherwise
   the ordering clinic), "Oddział:", "Lekarz kier.:", "Odbiorca wyniku:" (e.g. "Odbiór
   osobisty"), "Kod kontrahenta:", "Kod oddziału:", **"Data rej.:"** (YYYY-MM-DD),
   **"Data/godz. pobrania:"** ("2014-12-15 08:32").
3. **Patient block**: "Pacjent:" (Imię i nazwisko), "Adres:", "Nr zlecenia", **"PESEL:"**,
   **"Data ur.:"** (YYYY-MM-DD), **"Płeć:"** ("Żeńska"/"Męska").
4. **Results table**, column order: **"Badanie" | "Wyniki" | "Jedn." | "Zakres referencyjny" | "LIW"**.
   Example row: `Morfologia | 99 | tys/ul | 3,8-10,0 | L`.
   - "Wyniki": "Wynik wyrażony liczbowo, opisowo lub symbolami +/-."
   - "Jedn.": units as ASCII, e.g. **"tys/ul"** (not "tys./µl") — parser must map `ul`→`µl`.
   - "Zakres referencyjny": **decimal comma, hyphen without spaces** ("3,8-10,0").
   - **"LIW"** column = flag: "H (ang. high – wysoki) oznacza przekroczenie wartości max …",
     "L (ang. low – niski) oznacza przekroczenie wartości min (w dół) …", "Brak symbolu oznacza
     wynik prawidłowy". So Diagnostyka flags are **H / L letters in a separate column**, not
     arrows or asterisks.
5. **Per-test footer**: "Badanie" (test number), "Daty / Materiał" ("Data wykonania:",
   "Data/godz. wydania:", "Materiał: Krew żylna (EDTA)"), "Autoryzował" (diagnosta name + licence
   number), "Wykonano" (lab address), "Uwagi" ("Brak uwag").
6. **Footnote**: "\* Oznacza, że zastosowano normy przynależne do przedziału wiekowego. Normy
   podane na wyniku odnoszą się do osób dorosłych, jeżeli nie wyszczególniono inaczej." — so an
   **asterisk next to a range means an age-specific range**, not an abnormal value.

Not visible in the sample but expected (unverified, from general Polish lab practice): ranges
written as "< 200", "> 40", "<5,0", "do 34" or "poniżej 1,0"; lipid rows with **target text
instead of a range** (e.g. "Pożądane: < 190 mg/dl" or a risk-category table); vitamin D rows with
an interpretation table ("niedobór < 20 ng/ml, … optymalne 30–50 …") printed in "Uwagi"; HbA1c
reported in **% and mmol/mol** on two rows; eGFR as a separate row "eGFR" with a note about the
CKD-EPI formula and "> 90" or "> 60" instead of a number when high. The parser must treat a
range cell as free text with patterns: `a-b`, `a - b`, `a–b`, `<b`, `< b`, `<=b`, `≤b`, `>a`,
`≥a`, `do b`, `powyżej a`, `poniżej b`, and blank.

Delivery format: results are available online at <https://wyniki.diag.pl/> (login with order
code / account — not tested here, no login done). Whether the downloaded PDF is text-based is
**unverified**, but it is generated from the LIS (e-lab) and electronically authorised, so a
text layer is very likely; scanned printouts (photos of paper) are the other realistic input and
need OCR. The app should never assume a column grid — parse line-by-line with the marker alias
list, then number, unit, range, optional H/L.

### 3.2 Other labs / NFZ hospital printouts

- ALAB, Synevo and hospital LIS printouts (Marcel, Eskulap, AMMS, Infomedica, LabWin…) use the
  same five logical columns (name, result, unit, reference range, flag) but flags differ:
  arrows "↑"/"↓", "H"/"L", "+"/"-", "!" or bold/asterisk are all seen in practice
  (**unverified** — I found no public annotated sample for ALAB or a hospital lab).
- Hospital printouts often prefix the material ("Kreatynina w surowicy", "Glukoza w surowicy",
  "Potas w surowicy") and append method/analyser notes (WIM list above).
- Units: almost all Polish labs report glucose, cholesterol and TG in **mg/dl** (some hospital
  labs also or only in mmol/l), creatinine in **mg/dl** (some µmol/l), iron in **µg/dl**,
  vitamin D in **ng/ml**, B12 in **pg/ml**, ferritin in **ng/ml** (= µg/l), TSH in **µIU/ml**
  (or mIU/l, identical), fT4 in **ng/dl** or **pmol/l** (lab-dependent — a real ambiguity),
  insulin in **µIU/ml** (= mIU/l). See §4 for factors.
- Decimal comma is universal on Polish printouts; thousands are not grouped. Some PDFs use a
  dot when exported from English-locale analysers (unverified) — accept both.
- Common text artefacts to normalise: "tys/ul", "tys./µl", "10^3/µl", "10*3/ul", "G/l";
  "mln/ul", "10^6/µl", "T/l"; "fl"/"fL"; "g/dl"/"g/dL"; "µIU/ml", "uIU/ml", "mIU/l", "µj.m./ml".

---

## 4. Marker table

### 4.0 How to read this section (rules for the app)

- **"Ref"** = typical adult reference interval as printed by Polish labs. These are
  illustrative only — **the app must always use the range printed on the user's own result**
  for "in/out of range", because ranges depend on analyser and lab. Where a value is labelled
  "typical (Roche cobas)" it reflects the manufacturer insert values that many Polish labs
  copy; per-lab confirmation is **unverified**.
- **"Target"** = a guideline-defined goal (cited), used for "optimise" suggestions, which may be
  stricter than "in range" (e.g. LDL, TG, vitamin D, HbA1c).
- **"Retest"** = earliest sensible re-measurement after a diet change. The plan length
  (8–16 weeks) should be set by the slowest marker in the user's focus list.
- **"Doctor first"** = values at which the app shows "skonsultuj wynik z lekarzem" and does
  **not** offer a diet plan for that marker (it may still show general healthy-eating
  content). Thresholds marked "app policy" are conservative choices for this app, informed by
  the cited guidelines and usual laboratory critical values — they are not taken verbatim from
  one guideline and should be reviewed by a clinician before launch.
- Universal doctor-first triggers regardless of value: pregnancy, age < 18, known kidney /
  liver / thyroid disease or diabetes under treatment, anticoagulants, symptoms
  (chest pain, fainting, black stools, blood in urine, unexplained weight loss).

Abbreviations: IU = international unit; ULN = upper limit of normal; SI = Système International.

### 4.1 Morfologia krwi (complete blood count)

| Marker (PL names / aliases) | Units → SI | Ref (adult) | Target | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|---|
| **Hemoglobina** — HGB, Hb | g/dl × 0.6206 = mmol/l; × 10 = g/l | women ~12–16, men ~13.5–17.5 g/dl (typical; lab-specific). WHO anaemia: < 12,0 g/dl non-pregnant women, < 13,0 g/dl men (WHO 2024 Hb guideline, <https://www.who.int/publications/i/item/9789240088542>) | within range | Indirect only: Hb falls late in iron/B12/folate deficiency; diet fixes the cause (iron, B12, folate) not Hb itself | 8–12 weeks (Hb rises ~1 g/dl per 2–3 weeks once iron is supplied — clinical rule of thumb, unverified source) | **Any anaemia** (Hb below range) → doctor first: in men and post-menopausal women iron-deficiency anaemia needs GI investigation (≈1/3 have a GI cause; BSG 2021, <https://doi.org/10.1136/gutjnl-2021-325210>). Hb < 10 g/dl → see doctor soon (app policy) |
| **Hematokryt** — HCT, Ht | % (or l/l: % ÷ 100) | women ~36–46 %, men ~40–52 % (typical) | — | dehydration raises it | with Hb | follows Hb; HCT > 52 % (men)/> 48 % (women) → doctor (app policy, polycythaemia/dehydration) |
| **Erytrocyty** — RBC, krwinki czerwone | mln/µl = 10^12/l = T/l | women ~3,9–5,2; men ~4,4–5,9 mln/µl (typical) | — | none directly | — | outside range together with Hb → doctor |
| **MCV** — średnia objętość krwinki | fl | 80–92 fl (Diagnostyka page; others 80–100) | — | low MCV → think iron deficiency; high MCV (> 100) → B12/folate deficiency, alcohol, hypothyroidism | 8–12 weeks | MCV > 100 fl or < 75 fl with anaemia → doctor (app policy) |
| **MCH** — średnia masa Hb w krwince | pg | 27–31 pg (Diagnostyka page) | — | as MCV | — | — |
| **MCHC** | g/dl | 32–36 g/dl (Diagnostyka page) | — | — | — | — |
| **RDW** (RDW-CV %, RDW-SD fl) | %, fl | RDW-CV ~11,5–14,5 % (typical) | — | rising RDW + falling MCV = early iron deficiency | — | — |
| **Leukocyty** — WBC, krwinki białe | tys/µl = 10^9/l = G/l | 4,0–10,0 tys/µl (Diagnostyka page) | — | not diet-modifiable in a useful way (severe B12/folate/copper deficiency can lower) | — | < 3,0 or > 15 tys/µl, or abnormal differential (neutrofile < 1,0) → doctor (app policy) |
| **Płytki krwi** — PLT, trombocyty | tys/µl | 150–400 tys/µl (Diagnostyka page) | — | not diet-modifiable (iron deficiency can raise PLT mildly) | — | < 100 or > 500 tys/µl → doctor (app policy) |

Morfologia source for names/params: <https://diag.pl/sklep/badania/morfologia-krwi-pelna/>.

### 4.2 Iron status (gospodarka żelazem)

| Marker | Units → SI | Ref | Target | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|---|
| **Ferrytyna** — FERR | ng/ml = µg/l (identical) | women ~13–150, men ~30–400 ng/ml (typical; Diagnostyka only says women's range is lower — <https://diag.pl/sklep/badania/ferrytyna/>) | WHO 2020: iron deficiency **< 15 µg/l** in apparently healthy adults; **< 70 µg/l** indicates deficiency if infection/inflammation is present; risk of iron overload **> 150 µg/l** menstruating women, **> 200 µg/l** men and non-menstruating women (healthy); > 500 µg/l in non-healthy adults (WHO eLENA summary <https://www.who.int/tools/elena/interventions/ferritin-concentrations>; guideline <https://iris.who.int/handle/10665/331505>). Many clinicians use < 30 µg/l as "depleted stores" (e.g. BSG 2021 accepts < 30 as iron deficiency, unverified exact wording) | Yes but slowly: haem iron (red meat, offal, fish), non-haem iron with vitamin C, separate tea/coffee/calcium from iron-rich meals (§6). Diet alone rarely refills very low stores; supplements are doctor/pharmacist territory | **8–12 weeks** minimum; ferritin is an acute-phase protein — interpret only with CRP | ferritin < 15 → doctor (cause + likely iron therapy); ferritin > 200 (M) / > 150 (F) with **wysycenie transferyny > 45 %** → doctor (haemochromatosis work-up, EASL 2022 <https://doi.org/10.1016/j.jceh.2022.11.003>); ferritin > 500 → doctor; do **not** recommend iron-rich diet when ferritin is high |
| **Żelazo** — Fe, żelazo w surowicy | µg/dl × 0,179 = µmol/l | ~50–170 µg/dl (typical, sex-dependent) | — | weak marker: huge diurnal and meal variation, do not drive diet from Fe alone | with ferritin | very high Fe with high TSAT → doctor |
| **TIBC** — całkowita zdolność wiązania żelaza | µg/dl × 0,179 = µmol/l | ~250–450 µg/dl (typical) | — | rises in iron deficiency | with ferritin | — |
| **UIBC** — utajona/nienasycona zdolność wiązania | µg/dl | ~150–350 µg/dl (typical) | — | TIBC = Fe + UIBC | — | — |
| **Transferyna** | g/l (mg/dl ÷ 100) | ~2,0–3,6 g/l (typical) | — | rises in iron deficiency | — | — |
| **Wysycenie transferyny** — TSAT, stopień wysycenia transferyny | % = Fe/TIBC × 100 (or Fe µmol/l ÷ (transferyna g/l × 25,1) × 100) | ~15–45 % (typical) | < 20 % supports iron deficiency (common clinical cut-off, unverified source); > 45 % iron overload screen (EASL 2022) | as ferritin | with ferritin | > 45 % with high ferritin → doctor |

### 4.3 B vitamins and homocysteine

| Marker | Units → SI | Ref | Target / interpretation | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|---|
| **Witamina B12** — kobalamina | pg/ml = ng/l; × 0,738 = pmol/l | ~190–900 pg/ml (typical Roche/Abbott) | NICE NG239 (2024): total B12 **< 180 ng/l** (≈ 133 pmol/l) deficiency confirmed; **180–350 ng/l** indeterminate; > 350 unlikely (<https://www.nice.org.uk/guidance/ng239/chapter/recommendations>) | animal foods only (meat, fish, eggs, dairy) + fortified foods; **vegans need a supplement** — diet cannot fix it; absorption falls with age, metformin, PPIs | 8–12 weeks (supplement effect visible in weeks; serum B12 rises before stores) | B12 < 180 pg/ml, or any value with neurological symptoms (numbness, gait), or with macrocytic anaemia → doctor (may need injections — malabsorption/pernicious anaemia) |
| **Holotranskobalamina** — aktywna witamina B12, holoTC | pmol/l | typical lower cut-off ~35–50 pmol/l (assay-dependent, unverified) | NICE NG239: active B12 **< 25 pmol/l** deficiency; **25–70** indeterminate; > 70 unlikely. Stop B12 supplements 72 h before (diag.pl) | as B12 | 8–12 weeks | < 25 pmol/l → doctor |
| **Kwas foliowy** — foliany, folate | ng/ml × 2,266 = nmol/l | ~3,9–20 ng/ml (typical) | WHO: serum folate **< 10 nmol/l (< 4 ng/ml)** = deficiency based on homocysteine (WHO 2015 "Serum and red blood cell folate concentrations for assessing folate status", <https://www.who.int/publications/i/item/WHO-NMH-NHD-EPG-15.01>) | leafy greens, legumes, liver, fortified cereals; heat-labile | 4–8 weeks (serum folate reflects recent intake — fast) | < 3 ng/ml or with macrocytic anaemia → doctor; women planning pregnancy: folic acid 0,4 mg supplement is standard advice regardless (doctor/pharmacist) |
| **Homocysteina** — Hcy | µmol/l | ~5–15 µmol/l (typical) | > 15 µmol/l = hyperhomocysteinaemia (common definition; unverified single source) | folate, B12, B6 intake; coffee/alcohol raise it; driven also by kidney function, MTHFR | 6–8 weeks | > 30 µmol/l → doctor (app policy: intermediate/severe; suggests B12/folate deficiency or kidney disease) |

### 4.4 Vitamin D

| Marker | Units → SI | Ref / target | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|
| **Witamina D 25(OH)D** — Witamina D3 metabolit 25(OH), 25-OH-D, 25(OH)D2+D3, kalcydiol | ng/ml × 2,5 = nmol/l (exact 2,496) | Polish guidelines (Płudowski et al. 2023, <https://doi.org/10.3390/nu15030695>): **< 20 ng/ml deficiency** (≤ 20 = "urgent need to start the medical intervention regimen"); **20–30 suboptimal**; **30–50 optimal** (target); 50–100 high; **> 100 ng/ml risk of intoxication** (stop/reduce supplementation). Do not confuse with 1,25(OH)2D. | Food barely moves it (oily fish, eggs, fortified margarine; Polish AI is 15 µg/d — §5). Fix is skin synthesis May–Sept or **supplement** (§5.3). | Płudowski 2023: therapy control **8–12 weeks, not later than 3 months** after starting cholecalciferol | < 10 ng/ml (app policy: severe deficiency, osteomalacia risk) or > 100 ng/ml → doctor; 10–20 → show guideline supplementation advice + suggest doctor/pharmacist |

### 4.5 Minerals and electrolytes

| Marker | Units → SI | Ref | Target | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|---|
| **Magnez** — Mg (surowica) | mg/dl × 0,411 = mmol/l | ~0,66–1,07 mmol/l (1,6–2,6 mg/dl) (typical Roche) | serum Mg is a poor marker of body stores (only ~1 % of Mg is extracellular — general physiology, unverified source) | nuts, seeds, legumes, whole grains, cocoa, leafy greens; PPIs and diuretics lower it | 8–12 weeks | < 0,5 mmol/l or > 1,2 mmol/l → doctor (app policy) |
| **Cynk** — Zn, "Cynk, ilościowo" | µg/dl × 0,153 = µmol/l | ~70–120 µg/dl (10,7–18,4 µmol/l) (typical, unverified) | — | meat, shellfish, seeds, legumes (phytate lowers absorption) | 8–12 weeks | < 50 µg/dl → doctor (app policy) |
| **Selen** — Se, "Selen ilościowo" | µg/l × 0,0127 = µmol/l | ~70–150 µg/l (typical, unverified) | — | Brazil nuts (very variable), fish, eggs (§6) | 8–12 weeks | > 200 µg/l (app policy: possible over-supplementation) → stop supplements, doctor |
| **Wapń całkowity** — Ca | mg/dl × 0,2495 = mmol/l | ~2,15–2,55 mmol/l (8,6–10,2 mg/dl) (typical; must be read with albumin) | — | serum Ca is hormonally clamped — **diet does not move it**; dietary Ca matters for bone, not for this number | — | any value outside range → doctor (hyperparathyroidism, vitamin D excess, malignancy, kidney) |
| **Wapń zjonizowany** — Ca2+ | mmol/l | ~1,15–1,35 mmol/l | — | as above | — | outside range → doctor |
| **Potas** — K | mmol/l = mEq/l | 3,5–5,1 mmol/l (typical) | — | serum K is not a diet target in healthy kidneys; dietary K (fruit, vegetables, potatoes, legumes) helps blood pressure | — | < 3,0 or > 5,5 mmol/l → doctor (app policy, arrhythmia risk); 5,1–5,5 → no high-K advice, recheck (haemolysis gives false highs) |
| **Sód** — Na | mmol/l | 135–145 mmol/l | — | serum Na does **not** reflect salt intake; do not drive salt advice from it | — | < 130 or > 150 mmol/l → doctor (app policy); 130–134 → doctor review (drugs, water intoxication) |
| **Fosfor nieorganiczny** — P, fosforany | mg/dl × 0,3229 = mmol/l | ~2,5–4,5 mg/dl (0,81–1,45 mmol/l) (typical) | — | relevant mainly in CKD (phosphate additives, processed meat, cola) | — | outside range → doctor |

### 4.6 Lipids

Polish lab-report standard: PSLD/PoLA 2024 "Guidelines … on laboratory diagnostics of lipid
metabolism disorders" (Solnica et al., Arch Med Sci 2024, <https://doi.org/10.5114/aoms/186191>)
— Table IX tells labs to print **target and alarm values** next to each lipid result; so a
Polish lipid row often has a target list instead of a classic range. Conversions from that
paper: cholesterol mg/dl × 0,026 = mmol/l; TG mg/dl × 0,011 = mmol/l. European context:
ESC/EAS 2019 + **2025 focused update** (Mach et al., Atherosclerosis 409:120479, 2025, <https://doi.org/10.1016/j.atherosclerosis.2025.120479>; erratum
<https://doi.org/10.1016/j.atherosclerosis.2026.120703>).

| Marker | Target (PSLD/PoLA 2024 Table IX) | Alarm / doctor first (same source) | Diet lever | Retest |
|---|---|---|---|---|
| **Cholesterol całkowity** — CHOL, TC | **< 190 mg/dl (4,9 mmol/l)**, fasting or not | **> 300 mg/dl (7,8 mmol/l)** suspected heFH | saturated fat ↓, fibre ↑, weight loss | 4–8 weeks (ESC/EAS 2019 re-checks lipids 8 ± 4 weeks after a change — unverified wording) |
| **Cholesterol HDL** — HDL-C | **women > 45 mg/dl (1,2 mmol/l), men > 40 mg/dl (1,0 mmol/l)** | — | activity, weight loss, stop smoking; not a treatment target | 8–12 weeks |
| **Cholesterol LDL** — LDL-C (calculated or direct) | by CV risk: **low < 115 mg/dl (3,0)**, moderate < 100 (2,6), high < 70 (1,8), very high < 55 (1,4), extreme < 40 (1,0) | **> 190 mg/dl (4,9 mmol/l) suspected heterozygous FH; > 500 mg/dl homozygous FH** — "need to seek urgent medical attention" | sat. fat → unsaturated, plant sterols 1,5–3 g/d (−7 to −10,5 %), oat/barley β-glucan 3 g/d, soluble fibre, nuts, soy (§6) | **4–6 weeks** for diet effect to plateau (sterol claim: effect "established within 2–3 weeks", §6); plan 8–12 weeks |
| **Cholesterol nie-HDL** — non-HDL-C (= CHOL − HDL) | low/moderate risk **< 130 mg/dl (3,4)**; high < 100; very high < 85; extreme < 70 | — | as LDL + TG levers | 4–8 weeks |
| **Triglicerydy** — TG, trójglicerydy | **fasting < 100 mg/dl (1,1 mmol/l)**; non-fasting < 125 (1,4). Borderline 100–150; moderate 150–500; severe 500–880; very severe > 880 | **> 880 mg/dl (10 mmol/l)** suspected chylomicronaemia, high pancreatitis risk. App policy: **≥ 500 mg/dl → doctor first** (severe band) | alcohol ↓, sugars/fructose/refined carbs ↓, weight loss, oily fish; EPA+DHA 2–4 g/d is supplement-level (§6) | **2–4 weeks** (TG responds fastest; > 20 % intra-individual variability, so confirm) |
| **Lipoproteina(a)** — Lp(a) | **< 30 mg/dl (< 75 nmol/l)**; 30–50 (75–125 nmol/l) moderate risk | **> 50 mg/dl (> 125 nmol/l) high risk; > 180 mg/dl (> 450 nmol/l) very high** — report should advise seeking medical attention | **genetic, diet does not lower it** (app must say so and not build a plan for it) | measure once in life (also in Moje Zdrowie, age 20–40) |
| **Apo B** — apolipoproteina B | low/moderate risk **< 100 mg/dl**; high < 80; very high < 65; extreme < 55 | — | as LDL | 4–8 weeks |

Unit note: mg/dl ↔ nmol/l for Lp(a) is **not a fixed conversion** (depends on isoform); the
guideline's 30 mg/dl ≈ 75 nmol/l and 50 mg/dl ≈ 125 nmol/l pairs are the accepted
approximations — the app should keep the unit as printed. LDL from Diagnostyka is calculated
and suppressed when TG ≥ 400 mg/dl (§2).

### 4.7 Glucose metabolism

Source: Polish Diabetes Association (PTD) "Zalecenia kliniczne dotyczące postępowania u osób
z cukrzycą 2023", Curr Top Diabetes 2023;3(1) — table 1.1
(<https://zpn.wum.edu.pl/sites/zpn.wum.edu.pl/files/2024-07/zalecenia-kliniczne-dotyczace-postepowania-u-osob-z-cukrzyca-20231.pdf>).
PTD has since published 2024, 2025 and 2026 editions (<https://ptdiab.pl/zalecenia-ptd>);
the diagnostic thresholds below are the long-standing ones and are expected unchanged, but the
2025/2026 text could not be opened (page renders without content) — **unverified for 2025/2026**.

| Marker | Units → SI | Ref / categories (PTD) | Target | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|---|
| **Glukoza (na czczo)** — GLU, glukoza w surowicy/osoczu | mg/dl × 0,0555 = mmol/l | **70–99 mg/dl** normal (NFG); **100–125 mg/dl IFG** (nieprawidłowa glikemia na czczo, stan przedcukrzycowy); **≥ 126 mg/dl ×2 = cukrzyca**; random **≥ 200 mg/dl + symptoms = cukrzyca** | < 100 mg/dl | weight loss, fibre, fewer refined carbs and sugary drinks, activity | 4–8 weeks (noisy — prefer HbA1c) | ≥ 126 fasting or ≥ 200 random → doctor (diagnosis must be made by a doctor); < 55 mg/dl → doctor (app policy, hypoglycaemia) |
| **Hemoglobina glikowana** — HbA1c, HbAlc, Hemoglobina glikowana (HbA1c) met. HPLC | % (NGSP) ↔ mmol/mol (IFCC): IFCC = (NGSP − 2,15) × 10,929 | **≥ 6,5 % (48 mmol/mol) = cukrzyca** (one measurement, NGSP-certified method); 5,7–6,4 % (39–47 mmol/mol) = "uzasadnione podejrzenie" → OGTT recommended | general treatment goal in diabetes ≤ 7 % (53 mmol/mol) (PTD 2023); for non-diabetics keep < 5,7 % (app framing) | as glucose | **~3 months** (reflects ~8–12 weeks of glycaemia, red-cell lifespan) | ≥ 6,5 % → doctor; ≥ 9 % → doctor soon (app policy) |
| **Test obciążenia glukozą (OGTT 75 g)** — glikemia w 120. min | mg/dl | 120 min: **< 140 normal; 140–199 IGT; ≥ 200 cukrzyca** | — | as above | 3–6 months | ≥ 140 at 120 min → doctor |
| **Insulina (na czczo)** | µIU/ml = mIU/l; × 6,0 = pmol/l | ~2,6–24,9 µIU/ml (typical Roche, unverified) | no guideline target | weight loss, activity | 8–12 weeks | not a diagnostic marker on its own; very high with low glucose → doctor |
| **HOMA-IR** (Wskaźnik insulinooporności HOMA-IR) | dimensionless = glukoza (mg/dl) × insulina (µIU/ml) / 405 | **no guideline-endorsed cut-off**; Polish young-adult reference ≤ 4,00 (HOMA1-IR, age 18–31; Płaczkowska et al., Ann Agric Environ Med 2020, <https://doaj.org/article/ac25f666ee3b4ccb98b77e28f00e010c>); labs/marketing use > 2,5 (not evidence-based) | — | as above | 8–12 weeks; Diagnostyka itself recommends repeating 3–4× | The app should present HOMA-IR as "informational only", never as a diagnosis ("insulinooporność" is not a disease entity in PTD guidelines — unverified exact wording) |

### 4.8 Liver

| Marker | Units → SI | Ref | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|
| **ALT** — ALAT, aminotransferaza alaninowa, GPT | U/l × 0,0167 = µkat/l | women ≤ ~35, men ≤ ~45–50 U/l (typical Roche, lab-specific) | MASLD (fatty liver): 7–10 % weight loss, alcohol ↓, sugary drinks/fructose ↓, Mediterranean-style diet (EASL–EASD–EASO 2024 MASLD guideline, J Hepatol 2024, <https://doi.org/10.1016/j.jhep.2024.04.031>) | **3–6 months** (follows weight loss); hard exercise raises ALT/AST/CK for days | > 3× ULN (≈ > 120 U/l), or any rise with jaundice → doctor; persistent mild rise (> ULN on 2 tests) → doctor (hepatitis B/C screening, drugs) |
| **AST** — AspAT, GOT | U/l | women ≤ ~35, men ≤ ~40–50 U/l (typical) | as ALT; AST > ALT suggests alcohol or muscle | as ALT | as ALT |
| **GGTP** — GGT, γ-GT, gamma-glutamylotranspeptydaza/-transferaza | U/l | women ≤ ~40, men ≤ ~60 U/l (typical) | **alcohol** is the big lever; weight loss | 4–8 weeks after stopping alcohol (GGT half-life ~2–3 weeks, unverified) | > 3× ULN → doctor |
| **Bilirubina całkowita** — BIL | mg/dl × 17,1 = µmol/l | ~0,3–1,2 mg/dl | fasting raises it (Gilbert syndrome); no diet plan | — | > 2 mg/dl or raised bilirubina bezpośrednia → doctor |
| **ALP** — fosfataza alkaliczna (in "Próby wątrobowe") | U/l | ~40–130 U/l (typical) | not diet-modifiable | — | outside range → doctor |

### 4.9 Kidney and uric acid

| Marker | Units → SI | Ref | Target | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|---|
| **Kreatynina** — CREA | mg/dl × 88,4 = µmol/l | women ~0,5–0,9, men ~0,7–1,2 mg/dl (typical) | — | high meat meal, creatine supplements and heavy training raise it (false "worse kidneys") — test after 24 h without meat/creatine/hard training | — | via eGFR |
| **eGFR** (CKD-EPI) | ml/min/1,73 m² | KDIGO categories: G1 ≥ 90, G2 60–89, **G3a 45–59, G3b 30–44**, G4 15–29, G5 < 15 (KDIGO 2024 CKD guideline, Kidney Int 2024;105(4S), <https://kdigo.org/guidelines/ckd-evaluation-and-management/>) | — | in CKD G3–G5: protein ~0,8 g/kg/d, avoid > 1,3 g/kg/d if progressive (KDIGO 2024, via NephJC summary <https://www.nephjc.com/news/kdigo-ckd-part2>); individualised K/P/Na with a dietitian | 3 months (CKD needs 2 values ≥ 3 months apart) | **eGFR < 60 → doctor first**; the app disables high-protein, high-potassium and supplement suggestions; eGFR < 30 → no diet plan, nephrology |
| **Mocznik** — urea (Poland reports urea, not BUN) | mg/dl × 0,1665 = mmol/l; BUN = urea × 0,467 | ~17–43 mg/dl (typical) | — | rises with high protein intake and dehydration | — | > 2× ULN → doctor |
| **Kwas moczowy** — UA | mg/dl × 59,48 = µmol/l | women ~2,4–5,7, men ~3,4–7,0 mg/dl (typical Roche) | in gout: serum urate **< 6 mg/dl (360 µmol/l)** (EULAR 2016, Richette et al., Ann Rheum Dis 2017;76:29–42, <https://doi.org/10.1136/annrheumdis-2016-209707>) | alcohol (esp. beer) ↓, fructose/sugary drinks ↓, large portions of meat/offal/seafood ↓, weight loss, dairy and coffee neutral-to-helpful (ACR 2020 gout guideline, <https://doi.org/10.1002/acr.24180>) | 4–8 weeks | > 10 mg/dl, gout attack, kidney stones → doctor (app policy); uric acid alone without symptoms → diet is fine |
| **ACR / UACR** — wskaźnik albumina/kreatynina w moczu | mg/g (or mg/mmol: mg/g ÷ 8,84) | < 30 mg/g normal (KDIGO A1) | — | — | — | ≥ 30 mg/g → doctor |

### 4.10 Thyroid

| Marker | Units → SI | Ref | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|
| **TSH** — tyreotropina, hTSH, TSH 3. generacji | µIU/ml = mIU/l | ~0,27–4,2 µIU/ml (typical Roche; lab-specific) | **not diet-modifiable** except iodine extremes (iodised salt is the Polish source; avoid kelp/iodine megadoses) and selenium excess | 6–8 weeks if repeated | **any TSH outside range → doctor** (app shows no thyroid diet); TSH < 0,1 or > 10 → doctor soon (app policy) |
| **FT4** — wolna tyroksyna, fT4 | ng/dl × 12,87 = pmol/l (**labs differ: ng/dl vs pmol/l — real ambiguity**) | ~0,93–1,7 ng/dl or 12–22 pmol/l (typical) | — | — | outside range → doctor |
| **FT3** — wolna trójjodotyronina | pg/ml × 1,536 = pmol/l | ~2,0–4,4 pg/ml or 3,1–6,8 pmol/l (typical) | very low-energy diets lower fT3 (adaptive) | — | outside range → doctor |
| **anty-TPO** — ATPO, aTPO, przeciwciała przeciw peroksydazie tarczycowej | IU/ml | < 34 IU/ml (typical Roche) | positive = autoimmune thyroiditis (Hashimoto); no evidence-based "Hashimoto diet" beyond normal healthy eating; gluten-free only if coeliac (general consensus, unverified single source) | — | positive → doctor (follow-up TSH) |

### 4.11 Inflammation

| Marker | Units | Ref / interpretation | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|
| **CRP** — białko C-reaktywne, "CRP, ilościowo" | mg/l (some labs mg/dl × 10 = mg/l) | < 5 mg/l (typical) | — | — | > 10 mg/l → probably acute infection: repeat in 2–4 weeks before interpreting ferritin/iron/lipids; > 50 mg/l → doctor (app policy) |
| **hs-CRP** — "hs CRP", CRP wysokiej czułości | mg/l | CV risk: < 1 low, 1–3 average, > 3 high (AHA/CDC 2003, Pearson et al., Circulation 2003;107:499–511, <https://doi.org/10.1161/01.CIR.0000052939.59093.45>) | weight loss, Mediterranean pattern, stop smoking | 8–12 weeks | > 10 mg/l → repeat (not chronic risk) |

### 4.12 Other vitamins, omega-3, iodine

| Marker | Units | Ref / target | Diet lever | Retest | Doctor first |
|---|---|---|---|---|---|
| **Witamina A** (retinol) | µg/dl × 0,0349 = µmol/l; mg/l | ~0,3–0,8 mg/l (typical, unverified) | liver, dairy, eggs; carotenoids from orange/green veg | 8–12 weeks | high values → doctor (stop supplements; teratogenic) |
| **Witamina E** (α-tokoferol) | mg/l × 2,32 = µmol/l | ~5–20 mg/l (typical, unverified; depends on lipids) | oils, nuts, seeds | 8–12 weeks | deficiency is rare → doctor (malabsorption) |
| **Omega-3 index** (ALAB "Omega 3"; not offered by Diagnostyka) | % EPA+DHA of RBC fatty acids | **≥ 8 % most cardioprotective, ≤ 4 % least** (Harris & von Schacky 2004, <https://doi.org/10.1016/j.ypmed.2004.02.030>); ALAB bands < 4 / 4–8 / > 8 (<https://www.alab.pl/badanie/omega-3>) | oily fish 2×/week (Polish AI 250 mg EPA+DHA), supplements | **3–4 months** (RBC lifespan ~120 days) | — |
| **Jod w moczu** | µg/l | WHO uses **population median** 100–199 µg/l as adequate; a single spot sample does **not** diagnose an individual (WHO 2013 VMNIS, <https://www.who.int/publications/i/item/WHO-NMH-NHD-EPG-13.1>) | iodised salt, fish, dairy | — | app should not build a plan from one sample |

### 4.13 Badanie ogólne moczu (urinalysis)

Typical Polish printout sections: **właściwości fizyczne** (barwa, przejrzystość, ciężar
właściwy), **badanie chemiczne** (pH, białko, glukoza, ketony, bilirubina, urobilinogen, azotyny,
leukocyty/esteraza, erytrocyty/krew), **osad** (erytrocyty, leukocyty, nabłonki, wałeczki,
bakterie, kryształy) — results often qualitative: "nieobecny/ujemny", "ślad", "+", "++",
"obecne", "pojedyncze w polu widzenia" (typical; unverified per lab).

| Item | Normal | Diet relevance | Doctor first |
|---|---|---|---|
| Ciężar właściwy (SG) | ~1,005–1,030 g/ml | > 1,025 suggests low fluid intake → the app may suggest more water | persistent < 1,005 with thirst/polyuria → doctor |
| pH | ~5,0–8,0 | very acidic urine (< 5,5) with uric acid stones: more vegetables/fruit; high meat lowers pH | — |
| Białko | nieobecne (< 15 mg/dl) | — | "+" or more (≥ 30 mg/dl) → doctor (after excluding hard exercise/fever) |
| Glukoza | nieobecna | — | **any glucose → doctor** (diabetes or SGLT2 drug) |
| Ciała ketonowe | nieobecne | expected on ketogenic diet / long fasting | ketones **with** glucose in urine or high blood glucose → urgent doctor |
| Erytrocyty / krew, leukocyty, azotyny, bakterie | nieobecne / pojedyncze | — | positive → doctor (infection, stones, kidney) |
| Bilirubina, urobilinogen | negative / normal | — | positive → doctor |

### 4.14 Default plan length

Plan length = max(retest time of each targeted marker): lipids/TG/uric acid/folate only →
**8 weeks**; vitamin D, ferritin, B12, magnesium, zinc, homocysteine, HbA1c → **12 weeks**;
ALT/MASLD with weight loss, omega-3 index → **16 weeks**. Retest date = plan start + that
length, rounded to a weekday; always show "retest before that if your doctor says so".

---

## 5. Polish dietary reference values

### 5.1 Source and edition

- **"Normy żywienia dla populacji Polski i ich zastosowanie"**, red. M. Jarosz, E. Rychlik,
  K. Stoś, J. Charzewska, NIZP-PZH, Warszawa 2020 — PDF
  <https://ncez.pzh.gov.pl/wp-content/uploads/2021/03/normy_zywienia_2020web.pdf>. Values below
  were read directly from its "Tabele zbiorcze" (tables 5, 15, 17, 18–24, PDF pages 444–460).
- **There is a newer 2024 edition** (red. E. Rychlik, K. Stoś, A. Woźniak, H. Mojska, NIZP-PZH-PIB,
  2024; first norms for molybdenum; infant 0–6 months norms removed) — announced at
  <https://www.mp.pl/pacjent/dieta/aktualnosci/370084,nowe-normy-zywienia-dla-populacji-polski>,
  but its PDF link (<https://ncez.pzh.gov.pl/wp-content/uploads/2024/12/normy-31_12.pdf>)
  returned "Strona nie została znaleziona" on 2026-10-27, so **2024 values are unverified**;
  check whether any adult value changed before shipping.
- Polish age bands are 19–30, 31–50, 51–65, 66–75, > 75 (not 19–50/51–65/66+). Where a value
  is the same across bands they are merged below. RDA = zalecane spożycie, AI = wystarczające
  spożycie, EAR = średnie zapotrzebowanie.

### 5.2 Adult values (Normy 2020)

| Nutrient (unit/day) | Type | Men 19–30 | Men 31–50 | Men 51–65 | Men 66–75 | Men > 75 | Women 19–30 | Women 31–50 | Women 51–65 | Women 66–75 | Women > 75 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Żelazo (mg) | RDA | 10 | 10 | 10 | 10 | 10 | **18** | **18** | 10 | 10 | 10 |
| Cynk (mg) | RDA | 11 | 11 | 11 | 11 | 11 | 8 | 8 | 8 | 8 | 8 |
| Magnez (mg) | RDA | 400 | 420 | 420 | 420 | 420 | 310 | 320 | 320 | 320 | 320 |
| Wapń (mg) | RDA | 1000 | 1000 | 1000 | **1200** | **1200** | 1000 | 1000 | **1200** | **1200** | **1200** |
| Fosfor (mg) | RDA | 700 | 700 | 700 | 700 | 700 | 700 | 700 | 700 | 700 | 700 |
| Potas (mg) | AI | 3500 | 3500 | 3500 | 3500 | 3500 | 3500 | 3500 | 3500 | 3500 | 3500 |
| Sód (mg) | AI | 1500 | 1500 | 1500 | 1500 | 1500 | 1500 | 1500 | 1500 | 1500 | 1500 |
| Selen (µg) | RDA | 55 | 55 | 55 | 55 | 55 | 55 | 55 | 55 | 55 | 55 |
| Jod (µg) | RDA | 150 | 150 | 150 | 150 | 150 | 150 | 150 | 150 | 150 | 150 |
| Witamina C (mg) | RDA | 90 | 90 | 90 | 90 | 90 | 75 | 75 | 75 | 75 | 75 |
| Witamina D (µg cholekalcyferolu) | AI | 15 | 15 | 15 | 15 | 15 | 15 | 15 | 15 | 15 | 15 |
| Witamina B12 / kobalamina (µg) | RDA | 2,4 | 2,4 | 2,4 | 2,4 | 2,4 | 2,4 | 2,4 | 2,4 | 2,4 | 2,4 |
| Foliany (µg równoważnika folianów, DFE) | RDA | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 |
| Witamina A (µg równoważnika retinolu) | RDA | 900 | 900 | 900 | 900 | 900 | 700 | 700 | 700 | 700 | 700 |
| Witamina E (mg równoważnika α-tokoferolu) | AI | 10 | 10 | 10 | 10 | 10 | 8 | 8 | 8 | 8 | 8 |
| Witamina K (µg filochinonu) | AI | 65 | 65 | 65 | 65 | 65 | 55 | 55 | 55 | 55 | 55 |
| Witamina B6 (mg) | RDA | 1,3 | 1,3 | 1,7 | 1,7 | 1,7 | 1,3 | 1,3 | 1,5 | 1,5 | 1,5 |
| Błonnik (g) | AI | 25 | 25 | 25 | 20¹ | 20¹ | 25 | 25 | 25 | 20¹ | 20¹ |
| EPA + DHA | AI | 250 mg/d **or** 2 portions of fish/week incl. 1 oily fish (all adults) | | | | | | | | | |
| Białko (g/kg prawidłowej masy ciała) | RDA | 0,90 (EAR 0,73) — all adults ≥ 19 | | | | | 0,90 (EAR 0,73) | | | | |

¹ "W indywidualnych przypadkach poziom zależny od wskazań lekarskich i dietetycznych."
Protein is per kg of body weight at BMI 18,5–24,9 (table footnote "Prawidłowa masa ciała");
pregnancy/lactation 1,20/1,45 g/kg (not needed for this feature). EPA+DHA AI is from table 15
("DHA + EPA: 2 porcje ryb/tydzień, w tym raz ryby tłuste lub 250 mg/dobę"); pregnant/lactating
women AI = 250 mg EPA+DHA + 100–200 mg DHA. Selenium UL quoted in the 2020 book is still the old
EFSA/SCF 300 µg/day (Normy 2020, rozdział o selenie); **EFSA lowered the adult UL to 255 µg/day in
2023** (EFSA NDA Panel, EFSA Journal 2023;21(1):7704, <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9854220/>)
— the app should use 255.

### 5.3 Vitamin D supplementation — what Polish public guidance says (app can quote)

Diet alone rarely fixes vitamin D: the Polish AI is 15 µg (600 IU) and NCEZ states that body
status "w mniejszym stopniu zależy od diety, a bardziej zależy od intensywności i długości
ekspozycji na słońce … i suplementacji".

- **NCEZ (NIZP-PZH, public nutrition education site)**: "U zdrowych osób dorosłych zaleca się
  suplementację wit. D w ilościach **20–50 µg/dobę (800–2000 j.m.)** w zależności od masy ciała
  w miesiącach **wrzesień–kwiecień** oraz przez cały rok przy niewystarczającej syntezie skórnej
  w miesiącach letnich"; dose ideally agreed with a doctor after a blood test
  (<https://ncez.pzh.gov.pl/abc-zywienia-/zasady-zdrowego-zywienia/dieta-wegetarianska-i-weganska-----gdzie-szukac-skladnikow-niedoborowych/>;
  NCEZ leaflet <https://ncez.pzh.gov.pl/wp-content/uploads/2021/03/wit-d-suplementacja.pdf>).
  This reflects the 2018 Polish recommendations.
- **Current Polish expert guidelines (Płudowski et al. 2023, <https://doi.org/10.3390/nu15030695>)**:
  - adults 19–65: no supplement needed if sunbathing with uncovered forearms and legs
    **30–45 min between 10:00 and 15:00 without sunscreen, May–end of September** ("although
    still recommended and safe"); otherwise **1000–2000 IU/day (25–50 µg) throughout the year**,
    by body weight and dietary intake;
  - 65–75 years: **1000–2000 IU/day throughout the year** (reduced skin synthesis);
  - > 75 years (and 90+): **2000–4000 IU/day throughout the year**;
  - obesity (BMI > 30): usually **double the age-appropriate dose**;
  - tolerable upper intake for prophylaxis without monitoring: **4000 IU/day** (adults with
    normal weight), **10 000 IU/day** (adults with overweight/obesity) — Table 2 of the paper;
  - deficiency treatment (≤ 20 ng/ml) is a medical regimen (e.g. 19–64 y: 4000 IU/day or weekly
    equivalents, control after 8–12 weeks) — the app should only point to a doctor/pharmacist,
    not prescribe therapeutic doses;
  - screening 25(OH)D in the whole population is **not recommended**; testing is for risk groups.
- Suggested app wording: quote NCEZ's 800–2000 j.m. (wrzesień–kwiecień) as the public baseline
  and mention the 2023 expert update (1000–2000 j.m. through the year if little sun; more for
  seniors and obesity), with "dawkę leczniczą ustala lekarz".

---

## 6. Diet-lever facts (with sources)

1. **Iron — haem vs non-haem, enhancers and inhibitors.** Iron bioavailability is ~14–18 % from
   mixed diets and **5–12 % from vegetarian diets**; phytate, polyphenols (tea, coffee, cocoa,
   red wine), calcium, ascorbic acid and muscle tissue ("meat factor") change absorption
   repeatedly in single-meal studies, with smaller effects over a varied multi-meal diet;
   iron status itself matters more than diet composition (Hurrell & Egli, Am J Clin Nutr
   2010;91:1461S, <https://doi.org/10.3945/ajcn.2010.28674F>). Haem iron (meat, fish) is
   absorbed far better (~15–35 %) than non-haem iron and is little affected by inhibitors
   (commonly cited range; see EFSA DRV for iron, <https://doi.org/10.2903/j.efsa.2015.4254> —
   exact figure not re-checked, unverified). App rules: pair plant iron with vitamin C foods;
   keep tea/coffee and dairy/calcium supplements ≥ 1–2 h away from the iron-rich meal (timing
   is common practice, unverified exact interval).
2. **Plant sterols/stanols for LDL (EU-authorised claim).** Regulation (EU) 384/2010, conditions
   amended by Reg. (EU) 686/2014: plant sterols/stanols lower blood (LDL) cholesterol; consumer
   information refers to **1,5–3 g/day**; EFSA found an average **7–10,5 % LDL reduction** at
   1,5–2,4 g/day, usually established within **2–3 weeks**; the magnitude may be stated only for
   yellow fat spreads, dairy products, mayonnaise and salad dressings
   (<https://www.legislation.gov.uk/eur/2010/384/data.html>,
   <https://www.legislation.gov.uk/eur/2014/686/article/2>).
3. **Oat / barley β-glucan for LDL.** Reg. (EU) 1160/2011: oat β-glucan lowers LDL and total
   cholesterol; beneficial effect with **3 g/day**; food must provide ≥ 1 g per quantified
   portion (<https://www.legislation.gov.uk/eur/2011/1160/data.html>). The barley β-glucan
   disease-risk claim is Reg. (EU) 1048/2012 (title verified at
   <https://www.legislation.gov.uk/eur/2012/1048/contents>; the 3 g/day condition is from memory —
   unverified). ~3 g β-glucan ≈ 70–80 g oat bran or ~ 3 portions of oats (unverified; compute from
   the food DB).
4. **Omega-3 EPA+DHA for triglycerides.** EU claim (Reg. (EU) 536/2013 amending 432/2012, title
   verified at <https://www.legislation.gov.uk/eur/2013/536/contents>): DHA + EPA contribute to
   maintenance of normal blood triglycerides at **2 g/day** (dose and the "do not exceed 5 g/day
   supplemental" warning from memory — unverified). ESC/EAS dyslipidaemia guidance uses
   **2–4 g/day** of n-3 PUFA for hypertriglyceridaemia (2019 guideline; exact wording not
   re-checked — unverified). That is **supplement level**: oily fish provides roughly
   1–2,5 g EPA+DHA per 100 g (salmon, herring, mackerel; unverified ranges — use the app's food
   DB), so the Polish AI of 250 mg/day (≈ 2 fish meals/week) is easy, while 2–4 g/day from food
   alone would need ~150–300 g oily fish every day. App: food-first for the AI, "porozmawiaj z
   lekarzem" for therapeutic doses (also bleeding risk with anticoagulants — general caution).
5. **Fructose and alcohol → uric acid and triglycerides.** EULAR 2016: patients with gout should
   avoid excess alcohol (especially beer and spirits), sugar-sweetened drinks, heavy meals and
   excessive meat and seafood, and encourage low-fat dairy; urate target < 6 mg/dl
   (<https://doi.org/10.1136/annrheumdis-2016-209707>). ACR 2020 conditionally recommends
   limiting alcohol, purine intake and high-fructose corn syrup, plus weight loss
   (<https://doi.org/10.1002/acr.24180>). The same levers (alcohol, sugars/fructose, refined
   carbohydrate, excess energy) are first-line for TG (PSLD/PoLA 2024 notes TG variability is
   driven by diet, <https://doi.org/10.5114/aoms/186191>).
6. **Brazil nuts and selenium.** Two Brazil nuts/day delivered on average **53 µg Se/day (range
   20–84 µg)** and raised plasma Se as effectively as 100 µg selenomethionine over 12 weeks
   (Thomson et al., Am J Clin Nutr 2008;87:379, <https://doi.org/10.1093/ajcn/87.2.379>) —
   content per nut is highly variable. Adult **UL 255 µg/day** (EFSA 2023,
   <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9854220/>; EFSA notes regular Brazil-nut eaters
   and high-dose supplement users are the ones who may exceed it). Polish RDA 55 µg. App: max
   1–2 nuts/day, not on top of a selenium supplement.
7. **Vitamin K and warfarin / acenocoumarol.** Keep vitamin K intake **consistent week to week**
   rather than avoiding greens: "Eat consistent amounts of vitamin K-containing food on a
   week-to-week basis. Do not eat large amounts of leafy, green vegetables or certain vegetable
   oils … talk to your doctor before you make any changes in your diet" (MedlinePlus warfarin,
   <https://medlineplus.gov/druginfo/meds/a682277.html>). In Poland acenokumarol is the more
   common VKA (unverified market fact); the same rule applies. App: if the user declares a VKA,
   suppress "eat more leafy greens/kale/spinach" suggestions and show the consistency rule.
8. **Potassium caution (CKD, ACE inhibitors/ARBs, spironolactone, potassium-sparing diuretics).**
   KDIGO 2024 recommends individualised potassium (and sodium, phosphorus, protein) management
   with a renal dietitian rather than blanket rules (summary <https://www.nephjc.com/news/kdigo-ckd-part2>;
   guideline <https://kdigo.org/guidelines/ckd-evaluation-and-management/>). App: if eGFR < 60,
   serum K > 5,0 mmol/l, or the user declares these drugs, do not push high-potassium foods or
   potassium salt substitutes ("sól potasowa"/"sól o obniżonej zawartości sodu") without a doctor.
9. **High protein with eGFR < 60.** KDIGO 2024: adults with CKD G3–G5 not on dialysis — protein
   **~0,8 g/kg/day**; avoid **> 1,3 g/kg/day** in people at risk of progression; very-low-protein
   diets only under close supervision (via <https://www.nephjc.com/news/kdigo-ckd-part2>). The
   app's gym-oriented protein targets (often 1,6–2,2 g/kg) must be capped/disabled when
   eGFR < 60 and the user told to discuss with a doctor. Note creatine supplements and a
   high-meat meal can falsely raise creatinine (lower eGFR) — suggest a repeat test without them.

---

## 7. Implications for the importer (summary for implementation)

- Inputs to support: text-layer PDF (Diagnostyka/ALAB/Synevo/hospital), pasted text, manual
  entry; photos/scans need OCR (later). IKP/mojeIKP can show EDM lab results as PIK HL7 CDA
  (possibly with embedded PDF); raw XML availability to patients is unverified.
- Parse per line: `name` (alias table §2.2, fuzzy, case/diacritics-insensitive, strip
  "w surowicy", "ilościowo", "met. …", bracketed codes), `value` (decimal comma or dot; also
  "<5", ">90", "ujemny", "+", "ślad"), `unit` (normalise `ul`→`µl`, `uIU`→`µIU`, `mln/ul`,
  `tys/ul`, `10^3/µl`), `range` (free text patterns, §3.1), `flag` (`H`/`L` in Diagnostyka's
  "LIW" column; arrows/asterisks elsewhere; an asterisk on Diagnostyka means **age-specific
  norm**, not abnormal).
- Header fields worth extracting (Diagnostyka): "Data/godz. pobrania" (= result date for the
  timeline), "Płeć", "Data ur." (for sex/age-specific targets). Never store PESEL — strip it on
  import (privacy; the app does not need it).
- Panels to expand: "Lipidogram (CHOL, HDL, nie-HDL, LDL, TG)", "Próby wątrobowe (ALT, AST, ALP,
  BIL, GGTP)", "Elektrolity (Na, K)", "Morfologia krwi" (5-diff), "Mocz - badanie ogólne",
  "Panel pierwiastków Zn, Se, I / Zn, Cu, Se".
- Traps: vitamin D 25(OH) vs 1,25(OH)2; FT4 in ng/dl vs pmol/l; HbA1c % vs mmol/mol on two rows;
  LDL missing when TG ≥ 400 mg/dl; "Hemoglobina glikowana" contains the word "Hemoglobina"
  (don't match it as Hb); "Kreatynina w moczu" / "Glukoza w moczu" / "Białko w moczu" vs serum;
  "Wapń zjonizowany" vs "Wapń całkowity"; "CRP" vs "hs CRP"; "Witamina B12" vs
  "Holotranskobalamina"; Lp(a) in mg/dl vs nmol/l (no fixed conversion).
- BASIC (NFZ) user will typically have: morfologia, glukoza, (HbA1c), lipidogram, kreatynina+eGFR,
  ALT/AST/GGTP, TSH, Na/K, kwas moczowy, CRP, mocz; since 2022 ferrytyna/B12/kwas foliowy.
  **No vitamin D on NFZ.** PREMIUM (Diagnostyka packages) adds vitamin D, ferritin, B12, magnesium,
  zinc, homocysteine, insulin/HOMA-IR, Lp(a), apoB, thyroid antibodies, selenium/iodine.
