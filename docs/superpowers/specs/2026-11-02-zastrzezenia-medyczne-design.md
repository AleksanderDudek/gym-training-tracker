# Medical and dietary disclaimers — design

Date: 2026-11-02 · Status: decided autonomously on request ("chcę też, żeby istniało wskazanie
odnośnie diety, planów żywieniowych itp., że nie zastępują one konsultacji lekarskiej, dietetycznej
… każdy organizm jest indywidualny i wymaga opieki specjalisty … zbadaj best practices odnośnie
medycznych disclaimerów … masz wolną rękę … Pick recommended. I am away from machine").

## 1. What exists (audit, 2026-11-02)

| Area | Disclaimer today | Gap |
| --- | --- | --- |
| Training | `components/Health.tsx` — `HealthNote` on intro, plan catalogue, plan start, workout preview; `HealthCard` (PAR-Q+ / ACSM list) in Settings | Good; the card is buried at the end of Settings |
| Diet profile | „Aplikacja nie zastępuje dietetyka ani lekarza.” — only inside the collapsed „Jak liczę cel” | Not visible at the point of decision |
| Diary, meal plans, prep plans | none | Advice (kcal left, plans, weekly ±100 kcal) with no note |
| Badania | small `.disclaimer` at the bottom; doctor cards per finding | Lead copy says „ułożę dietę pod to, czego brakuje” — reads like an individual treatment plan |
| Eating disorders | none (only the „Bez liczenia kalorii” mode) | No safeguard text, no help contacts |
| Acknowledgment | none anywhere | Nobody is ever asked to read it once |
| Help contacts | none | No „where to go” |

Safeguards already in the engine (kept, referenced in the copy): no deficit under 18 or in pregnancy,
BMI < 18.5 blocks loss, kcal floor (BMR, ≥ 1500/1200), loss ≤ 1 %/week, lab plan blocked for under 18
and eGFR < 30, urgent lab findings → „Najpierw lekarz”.

## 2. Best practices (research)

1. **Clear and conspicuous, near the claim** (FTC .com Disclosures: proximity, prominence,
   unavoidability, repetition, plain language). A disclaimer in Settings or a footer alone does
   not count for advice shown elsewhere.
2. **Layered**: a one-line note next to each kind of advice, one full page, and a one-time
   acknowledgment before the first use of the riskier part (diet targets, lab results). Repeating
   the long version everywhere causes disclaimer blindness.
3. **Actionable, not only defensive**: say *who* should see a specialist first (chronic disease,
   medication, pregnancy, under 18, eating disorders), *when* to stop and get help (red flags), and
   *where* (GP, emergency number, helplines). „We don't replace a doctor” with nothing after it
   protects nobody — the same principle `Health.tsx` already follows for training.
4. **Intended purpose and wording** (EU MDR, MDCG 2019-11 Rev.1): whether software is a medical
   device follows from the purpose the maker states across *all* copy. A disclaimer does not undo a
   medical claim made elsewhere, so the copy must avoid diagnose/treat/cure verbs and individual
   „treatment” framing, and present lab-based suggestions as general nutrition information to
   discuss with a doctor.
5. **Eating-disorder safeguards** (Beat, NEDA, NHS app experience): screen-like questions at
   sign-up are contested, but advocates agree on: neutral language, an easy way to stop counting,
   no unhealthy goals (engine already blocks), and pointing to support.
6. **Versioned acknowledgment**: store which version was accepted so a material change can ask
   again.

Sources: MDCG 2019-11 Rev.1 commentary (openregulatory.com/mdcg/mdcg-2019-11,
sanolabs.eu/blog/wellness-app-vs-medical-device-eu-mdr), FTC health-app guidance (Sidley 2023,
WashU Becker), Beat / NHS app coverage, NFZ dietitian access (mp.pl/pacjent „Porada dietetyka
w ramach NFZ”, gov.pl opieka koordynowana), helplines 116 123 / 116 111 (NFZ „telefony wsparcia”).

## 3. Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | One source of text stays `components/Health.tsx`; it gains food and lab notes | Same rule as training: one place to change wording |
| 2 | New page **„Zdrowie i bezpieczeństwo”** at `#/zdrowie` (route `health`, parent Settings) with sections: what the app is / is not, every body is different, training, food & diet, relationship with food, lab results, when to get help now, where to get help (PL), your data | Full version must be reachable from every note; Settings card becomes a summary with a link |
| 3 | One-time **acknowledgment card** („Zanim skorzystasz z podpowiedzi o jedzeniu”, button „Rozumiem”) at the top of the diary (also the no-profile onboarding), the diet profile and Badania; stored as `gt:health-ack` = version in `localStorage` | Unavoidable but not blocking: content stays usable (no modal gate that breaks deep links and E2E). Versioned so wording changes can ask again |
| 4 | Short note with „Więcej” link under food advice: diary, diet profile (above save — not hidden in „Jak liczę cel”), onboarding, meal plan, my plans; lab note replaces the old Badania disclaimer | Proximity principle; one line, not paragraphs |
| 5 | Not added to recipes, products, „W pobliżu”, meal photo | These show data/estimates (already labelled as such), not a plan for the person; more notes = blindness |
| 6 | Eating-disorder line under „Bez liczenia kalorii” in the profile + section on the page | Point of decision; the mode already exists and is the safe exit |
| 7 | Help contacts: GP (POZ; NFZ dietitian via POZ in coordinated care for some chronic diseases), 112, 116 123 (adults in emotional crisis), 116 111 (children and youth). No opening hours | Hours differ between sources and change; numbers are stable |
| 8 | Badania lead reworded from „ułożę dietę pod to, czego brakuje” to general food information to discuss with a doctor | MDR intended-purpose wording (§2.4) |
| 9 | English copy says the contacts are Polish and that 112 works across the EU | App ships in PL and EN |
| 10 | The acknowledgment is not a legal consent and the page says the app is not a medical device | Honest scope; no checkbox-terms theatre |

## 4. Out of scope / for the user

- Legal review of the wording (this is product copy following public guidance, not legal advice).
- App-store / Connect IQ listings already say „nie jest wyrobem medycznym”; website copy outside
  the repo was not checked.
- `privacy.html` unchanged (already says the data is not medical advice).
