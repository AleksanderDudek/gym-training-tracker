import { say } from '../../i18n';

/**
 * What to test, in the four ways Polish adults really get tested — from the GP for free, in the
 * NFZ health check, and in paid packages — and how to prepare. Sources:
 * `docs/research/badania-laboratoryjne.md` §1–2 (the POZ list in Dz.U. 2023 poz. 1427 with its
 * 2022 and 2025 changes, „Moje Zdrowie” from Dz.U. 2025 poz. 584, Diagnostyka's packages as
 * listed on 2026-10-27). Packages change, so they are named as examples, never priced.
 */

export interface Scenario {
  id: 'nfz' | 'bilans' | 'extended' | 'premium';
  title: string;
  /** Who orders it, who pays, how to get it. */
  how: string;
  /** Marker ids, in the order a person would read them. */
  markers: readonly string[];
  /** Tests sometimes included, depending on age or answers. */
  maybe?: readonly string[];
  note: string;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'nfz',
    title: say('Podstawowe — od lekarza rodzinnego (NFZ)', 'Basic — from your GP (NFZ, free)'),
    how: say(
      'Bezpłatnie, na skierowanie lekarza POZ. Powiedz, że chcesz sprawdzić dietę — lekarz wybiera z listy.',
      'Free, on a GP referral. Say you want to check your diet — the doctor picks from the list.',
    ),
    markers: ['hgb', 'mcv', 'ferritin', 'b12', 'folate', 'glucose', 'hba1c', 'chol', 'ldl', 'hdl', 'tg', 'creatinine', 'egfr', 'alt', 'ggt', 'uricAcid', 'tsh', 'potassium', 'crp', 'uSg'],
    note: say(
      'Od lipca 2022 lekarz rodzinny może zlecić także ferrytynę, witaminę B12 i kwas foliowy. Witaminy D, magnezu, insuliny i homocysteiny na tej liście nie ma.',
      'Since July 2022 a GP can also order ferritin, vitamin B12 and folate. Vitamin D, magnesium, insulin and homocysteine are not on the list.',
    ),
  },
  {
    id: 'bilans',
    title: say('„Moje Zdrowie” — bilans zdrowia dorosłego (NFZ)', '“Moje Zdrowie” — adult health check (NFZ)'),
    how: say(
      'Od 20. roku życia: co 5 lat do 49 lat, co 3 lata od 50. Ankieta w IKP lub mojeIKP albo w przychodni, potem skierowanie i wizyta z planem zdrowotnym (także porada dietetyka).',
      'From age 20: every 5 years up to 49, every 3 years from 50. A questionnaire in IKP or mojeIKP or at the clinic, then a referral and a visit with a health plan (dietitian advice too).',
    ),
    markers: ['hgb', 'glucose', 'creatinine', 'egfr', 'chol', 'ldl', 'hdl', 'nonHdl', 'tg', 'tsh', 'uSg'],
    maybe: ['alt', 'ast', 'ggt', 'lpa'],
    note: say(
      'Zależnie od ankiety dochodzą próby wątrobowe, a raz w życiu (między 20. a 40. rokiem) lipoproteina (a). HbA1c, ferrytyny i witaminy D w bilansie nie ma.',
      'Depending on the questionnaire, liver tests are added, and once in life (between 20 and 40) lipoprotein(a). HbA1c, ferritin and vitamin D are not part of it.',
    ),
  },
  {
    id: 'extended',
    title: say('Rozszerzone — witaminy i minerały (płatne)', 'Extended — vitamins and minerals (paid)'),
    how: say(
      'W laboratorium bez skierowania, np. pakiety Diagnostyki „badanie niedoboru witamin i minerałów”, „badania na anemię”, „dla wegan i wegetarian”.',
      'At a lab without a referral, e.g. Diagnostyka’s packages for vitamin and mineral deficiency, anaemia, or vegans and vegetarians.',
    ),
    markers: ['vitD', 'ferritin', 'iron', 'b12', 'folate', 'homocysteine', 'magnesium', 'zinc', 'calcium'],
    note: say(
      'Witaminę D najczęściej bada się prywatnie. Weganom i wegetarianom co rok przyda się B12, ferrytyna i witamina D.',
      'Vitamin D is most often tested privately. Vegans and vegetarians benefit from B12, ferritin and vitamin D every year.',
    ),
  },
  {
    id: 'premium',
    title: say('Premium — pełny obraz metabolizmu (płatne)', 'Premium — the full metabolic picture (paid)'),
    how: say(
      'Np. pakiety Diagnostyki „kompleksowe badania krwi”, „przed dietą – kompleksowy”, „badania na insulinooporność”; indeks omega-3 jest w ALAB.',
      'E.g. Diagnostyka’s comprehensive blood tests, the complete pre-diet package or the insulin resistance package; the omega-3 index is at ALAB.',
    ),
    markers: ['hba1c', 'insulin', 'homaIr', 'apob', 'lpa', 'hsCrp', 'ft4', 'ft3', 'antiTpo', 'holotc', 'selenium', 'omega3'],
    note: say(
      'Daje więcej szczegółów, ale nie zastępuje podstaw: morfologia, lipidogram, glukoza i kreatynina zostają punktem wyjścia. HOMA-IR to wskaźnik pomocniczy, nie rozpoznanie.',
      'More detail, but no replacement for the basics: blood count, lipids, glucose and creatinine stay the starting point. HOMA-IR is a supporting index, not a diagnosis.',
    ),
  },
];

/** How to prepare so the result says something about the diet, not about the morning. */
export const PREPARE: readonly string[] = [
  say(
    'Na czczo: 8–12 godzin bez jedzenia (woda wolno), rano między 7 a 10. Insulina i HOMA-IR — przed 9.',
    'Fasting: 8–12 hours without food (water is fine), in the morning between 7 and 10. Insulin and HOMA-IR — before 9.',
  ),
  say(
    'Dwa dni bez ciężkiego treningu: po nim rosną CK, AST, ALT i kreatynina. Dzień wcześniej bez dużej porcji mięsa i bez kreatyny.',
    'Two days without hard training: CK, AST, ALT and creatinine rise after it. The day before, no large meat meal and no creatine.',
  ),
  say(
    'Biotynę (suplementy na włosy i paznokcie) odstaw 2–3 dni przed badaniem — zaburza TSH, fT4 i wiele innych oznaczeń. Suplementy B12 — 3 dni przed aktywną B12.',
    'Stop biotin (hair and nail supplements) 2–3 days before — it skews TSH, fT4 and many other tests. B12 supplements — 3 days before active B12.',
  ),
  say('Dwa dni bez alkoholu.', 'Two days without alcohol.'),
  say(
    'Po infekcji odczekaj 2–4 tygodnie: stan zapalny podnosi ferrytynę i CRP, a obniża żelazo.',
    'After an infection, wait 2–4 weeks: inflammation raises ferritin and CRP and lowers iron.',
  ),
  say(
    'Mocz: pierwsza poranna porcja ze środkowego strumienia, nie w czasie miesiączki.',
    'Urine: the first morning sample, midstream, not during a period.',
  ),
  say(
    'Kontrolę rób w tym samym laboratorium, o tej samej porze — wtedy zmiana jest zmianą, a nie różnicą metod.',
    'Retest at the same lab, at the same time of day — then a change is a change, not a difference in methods.',
  ),
];
