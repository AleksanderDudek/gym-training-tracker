import { say } from '../../i18n';
import type { Sex } from '../diet/types';
import { MARKERS } from './markers';
import { judge, type Latest, type Verdict } from './verdict';

/**
 * From the newest results to what the page says: which ones need a doctor before anything else,
 * which ones food can move (the diet focuses), and which are fine. The rules are explicit and
 * small on purpose — every one is a sentence in `docs/research/badania-laboratoryjne.md` — and
 * nothing here is a diagnosis: the strongest thing the app says is „porozmawiaj z lekarzem”.
 */

export type FocusId =
  | 'iron'
  | 'b12'
  | 'folate'
  | 'vitD'
  | 'magnesium'
  | 'zinc'
  | 'selenium'
  | 'potassium'
  | 'ldl'
  | 'tg'
  | 'hdl'
  | 'glucose'
  | 'uric'
  | 'liver'
  | 'omega3'
  | 'inflammation'
  | 'hydration';

/** urgent: see a doctor soon, no diet advice for it; doctor: tell the doctor, food may still help. */
export type Severity = 'urgent' | 'doctor' | 'diet' | 'watch' | 'ok';

export interface Finding {
  marker: string;
  latest: Latest;
  verdict: Verdict;
  severity: Severity;
  /** Why, when the rule says more than the verdict (a red flag, a pattern). */
  note: string | null;
}

export interface Focus {
  id: FocusId;
  /** Markers behind it, most important first. */
  markers: string[];
  /** Lower is more important. */
  priority: number;
}

export interface Assessment {
  findings: Finding[];
  /** At most three, most important first. */
  focus: Focus[];
  /** More focuses the results would justify, after the first three. */
  more: Focus[];
  /** eGFR under 60 or creatinine above range: the tab's high-protein rule is not for this person without a doctor. */
  proteinCaution: boolean;
  /** eGFR under 30 or under 18: the app makes no diet plan at all. */
  blocked: boolean;
  /** CRP above 10: iron and ferritin are not reliable now; retest after the infection. */
  inflamed: boolean;
  /** Tests worth asking for, given what is there and what is missing. */
  missing: { marker: string; why: string }[];
}

export interface Person {
  sex: Sex;
  age: number | null;
  pregnancy: boolean;
  eats: 'all' | 'vege' | 'vegan';
  /** The diet profile is keto or low-carb: a high LDL gets a note about it. */
  lowCarb: boolean;
}

const FOCUS_PRIORITY: Record<FocusId, number> = {
  iron: 1,
  b12: 2,
  glucose: 3,
  ldl: 4,
  tg: 5,
  vitD: 6,
  folate: 7,
  liver: 8,
  uric: 9,
  potassium: 10,
  magnesium: 11,
  omega3: 12,
  zinc: 13,
  selenium: 14,
  inflammation: 15,
  hdl: 16,
  hydration: 17,
};

const T = {
  urgentPotassium: say('Potas tak daleko od normy może zaburzać pracę serca — skontaktuj się z lekarzem jeszcze dziś.', 'Potassium this far out of range can upset the heart rhythm — contact a doctor today.'),
  urgentSodium: say('Sód tak daleko od normy wymaga pilnej oceny lekarza.', 'Sodium this far out of range needs a doctor urgently.'),
  urgentGlucose: say('Glukoza od 200 mg/dl to wynik do pilnej konsultacji z lekarzem.', 'Glucose of 200 mg/dl or more needs a doctor soon.'),
  diabetes: say('Wynik w zakresie cukrzycy — potrzebne potwierdzenie i opieka lekarza; dieta pomaga, ale nie zastępuje leczenia.', 'In the diabetes range — it needs confirming and a doctor’s care; diet helps but does not replace treatment.'),
  prediabetes: say('Stan przedcukrzycowy: dieta, ruch i spadek masy ciała to tu podstawowe leczenie. Powiedz o wyniku lekarzowi.', 'Prediabetes: diet, activity and weight loss are the main treatment. Tell your doctor about it.'),
  anaemia: say('Niedokrwistość — przyczynę ustala lekarz (najczęściej to brak żelaza, ale nie zawsze).', 'Anaemia — a doctor finds the cause (most often a lack of iron, but not always).'),
  severeAnaemia: say('Hemoglobina poniżej 10 g/dl — do lekarza bez odkładania.', 'Haemoglobin under 10 g/dl — see a doctor without delay.'),
  ironPattern: say('Małe krwinki (niskie MCV) pasują do niedoboru żelaza.', 'Small red cells (low MCV) fit iron deficiency.'),
  b12Pattern: say('Duże krwinki (wysokie MCV) pasują do niedoboru B12 lub kwasu foliowego.', 'Large red cells (high MCV) fit a lack of B12 or folate.'),
  ironOverload: say('Wysoka ferrytyna z wysokim wysyceniem transferyny może oznaczać nadmiar żelaza — do lekarza; nie dodawaj żelaza.', 'High ferritin with high transferrin saturation may mean iron overload — see a doctor; do not add iron.'),
  highFerritin: say('Wysoka ferrytyna bywa skutkiem stanu zapalnego, stłuszczenia wątroby lub nadmiaru żelaza — warto omówić z lekarzem.', 'High ferritin can come from inflammation, fatty liver or iron overload — worth discussing with a doctor.'),
  ldlVeryHigh: say('LDL od 190 mg/dl może być rodzinny (hipercholesterolemia rodzinna) — dieta pomaga, ale to wynik dla lekarza.', 'LDL of 190 mg/dl or more may run in the family (familial hypercholesterolaemia) — diet helps, but this is for a doctor.'),
  tgVeryHigh: say('Triglicerydy od 500 mg/dl grożą zapaleniem trzustki — do lekarza.', 'Triglycerides of 500 mg/dl or more risk pancreatitis — see a doctor.'),
  liverHigh: say('Enzymy wątroby powyżej trzykrotności normy — do lekarza przed zmianą diety.', 'Liver enzymes over three times the limit — see a doctor before changing the diet.'),
  liverTraining: say('ALT i AST rosną na kilka dni po ciężkim treningu. Jeśli trenowałeś w ostatnich dniach, powtórz badanie po 5–7 dniach przerwy.', 'ALT and AST rise for a few days after hard training. If you trained in the last days, retest after a 5–7 day break.'),
  kidney: say('Nerki pracują słabiej niż powinny — to wynik dla lekarza. Dieta wysokobiałkowa tylko za jego zgodą.', 'The kidneys work less well than they should — this is for a doctor. A high-protein diet only with their consent.'),
  creatinineMuscle: say('Kreatynina bywa wyższa u osób umięśnionych, po treningu i przy suplementacji kreatyną.', 'Creatinine runs higher in muscular people, after training and with creatine supplements.'),
  thyroid: say('Odchylenia hormonów tarczycy leczy lekarz. Biotyna w suplementach zaburza wynik — odstaw ją na 2–3 dni przed badaniem.', 'Thyroid deviations are treated by a doctor. Biotin in supplements skews the result — stop it 2–3 days before the test.'),
  infection: say('CRP powyżej 10 mg/l to zwykle infekcja. Wtedy ferrytyna i żelazo są niewiarygodne — powtórz je po wyzdrowieniu.', 'CRP above 10 mg/l usually means an infection. Ferritin and iron are unreliable then — retest after recovery.'),
  urine: say('Nieprawidłowy wynik moczu — omów go z lekarzem (ślad białka lub krwi bywa po ciężkim wysiłku).', 'An abnormal urine result — discuss it with a doctor (a trace of protein or blood can follow hard exercise).'),
  ketones: say('Ketony w moczu są spodziewane na diecie keto, przy głodówce i po długim wysiłku. Bez tego — do lekarza.', 'Urine ketones are expected on keto, when fasting and after long exercise. Otherwise — see a doctor.'),
  blood: say('Odchylenie w morfologii — ocenia je lekarz.', 'A blood count deviation — a doctor reads it.'),
  calcium: say('Wapń we krwi nie zależy od diety — odchylenie to sprawa dla lekarza.', 'Blood calcium does not depend on diet — a deviation is for a doctor.'),
  potassiumHigh: say('Wysoki potas: nie zwiększaj produktów bogatych w potas, dopóki nie porozmawiasz z lekarzem.', 'High potassium: do not add potassium-rich foods until you have talked to a doctor.'),
  potassiumLow: say('Niski potas bywa skutkiem leków (np. moczopędnych) lub biegunki — powiedz lekarzowi.', 'Low potassium can come from medicines (e.g. diuretics) or diarrhoea — tell your doctor.'),
  b12Low: say('B12 poniżej 180 pg/ml to niedobór — przyczynę i leczenie (czasem zastrzyki) ustala lekarz.', 'B12 under 180 pg/ml is a deficiency — a doctor finds the cause and treatment (sometimes injections).'),
  ferritinLow: say('Ferrytyna poniżej 15 ng/ml: zapasy żelaza są puste. Lekarz ustali przyczynę i zwykle zaleci żelazo w tabletkach — dieta pomaga, ale sama rzadko wystarcza.', 'Ferritin under 15 ng/ml: iron stores are empty. A doctor finds the cause and usually prescribes iron tablets — diet helps but rarely suffices alone.'),
  vitDSevere: say('Poniżej 10 ng/ml to ciężki niedobór — do lekarza.', 'Below 10 ng/ml is a severe deficiency — see a doctor.'),
  folateLow: say('Kwas foliowy poniżej 3 ng/ml — powiedz lekarzowi.', 'Folate under 3 ng/ml — tell your doctor.'),
  hba1cHigh: say('HbA1c od 9 % — do lekarza bez odkładania.', 'HbA1c of 9 % or more — see a doctor without delay.'),
  hypo: say('Glukoza poniżej 55 mg/dl — do lekarza.', 'Glucose under 55 mg/dl — see a doctor.'),
  cholVeryHigh: say('Cholesterol powyżej 300 mg/dl może być rodzinny — do lekarza.', 'Cholesterol above 300 mg/dl may run in the family — see a doctor.'),
  mineral: say('Wynik tak daleko od normy to sprawa dla lekarza, nie dla diety.', 'A result this far from range is for a doctor, not for diet.'),
  selenium: say('Selen powyżej 200 µg/l — odstaw suplementy z selenem i powiedz lekarzowi.', 'Selenium above 200 µg/l — stop selenium supplements and tell your doctor.'),
  uricHigh: say('Kwas moczowy powyżej 10 mg/dl — powiedz lekarzowi, zwłaszcza przy bólu stawów lub kamicy.', 'Uric acid above 10 mg/dl — tell your doctor, especially with joint pain or kidney stones.'),
  kidneySevere: say('eGFR poniżej 30 — dietę ustala lekarz nefrolog z dietetykiem; aplikacja nie układa tu planu.', 'eGFR under 30 — the diet is set by a nephrologist with a dietitian; the app makes no plan here.'),
  thyroidUrgent: say('TSH poniżej 0,1 lub powyżej 10 — do lekarza bez odkładania.', 'TSH below 0.1 or above 10 — see a doctor without delay.'),
  ketoGlucose: say('Ketony razem z glukozą w moczu lub wysokim cukrem we krwi — pilnie do lekarza.', 'Ketones together with urine glucose or high blood sugar — see a doctor urgently.'),
  ck: say('CK rośnie na kilka dni po treningu siłowym. Powtórz badanie po 5–7 dniach bez ciężkiego treningu.', 'CK rises for a few days after strength training. Retest after 5–7 days without hard training.'),
  vitAHigh: say('Wysoka witamina A — odstaw suplementy z witaminą A i powiedz lekarzowi.', 'High vitamin A — stop vitamin A supplements and tell your doctor.'),
  vitEHigh: say('Wysoka witamina E — odstaw suplementy z witaminą E i powiedz lekarzowi.', 'High vitamin E — stop vitamin E supplements and tell your doctor.'),
  minor: say('Niewielkie odchylenie — pokaż je lekarzowi przy okazji.', 'A small deviation — show it to your doctor when you can.'),
  under18: say('Zakresy w aplikacji są dla dorosłych. U osoby poniżej 18 lat wyniki ocenia lekarz.', 'The app’s ranges are for adults. Under 18, results are for a doctor to read.'),
  b12Absorption: say('Przy diecie z produktami zwierzęcymi niska B12 często znaczy złe wchłanianie (leki na zgagę, metformina, żołądek) — powiedz lekarzowi.', 'With animal foods in the diet, low B12 often means poor absorption (heartburn drugs, metformin, the stomach) — tell your doctor.'),
  vitDLow: say('Poniżej 20 ng/ml to niedobór — dawkę leczniczą witaminy D ustala lekarz.', 'Below 20 ng/ml is a deficiency — a doctor sets the treatment dose of vitamin D.'),
  vitDHigh: say('Witamina D powyżej 100 ng/ml — odstaw suplement i powiedz lekarzowi.', 'Vitamin D above 100 ng/ml — stop the supplement and tell your doctor.'),
  homaNote: say('HOMA-IR to wskaźnik pomocniczy; insulinooporność rozpoznaje lekarz na podstawie całego obrazu.', 'HOMA-IR is a supporting index; a doctor diagnoses insulin resistance from the whole picture.'),
  hba1cNote: say('HbA1c od 6,5 % to zakres cukrzycy — potrzebna ocena lekarza.', 'HbA1c of 6.5 % or more is the diabetes range — a doctor needs to see it.'),
  homocysteineHigh: say('Homocysteina powyżej 30 µmol/l — do lekarza.', 'Homocysteine above 30 µmol/l — see a doctor.'),
  pregnancy: say('W ciąży zakresy wielu badań są inne — omów wyniki z lekarzem prowadzącym.', 'In pregnancy many ranges differ — discuss results with your doctor.'),
  lpa: say('Lp(a) zależy od genów, nie od diety. Wysoka to powód, by tym bardziej pilnować LDL — powiedz lekarzowi.', 'Lp(a) is set by genes, not diet. A high one is a reason to watch LDL even more — tell your doctor.'),
};

const missingWhy = {
  ferritin: say('Hemoglobina lub MCV są niskie, a bez ferrytyny nie wiadomo, czy brakuje żelaza.', 'Haemoglobin or MCV is low, and without ferritin it is unclear whether iron is short.'),
  b12: say('MCV jest wysokie — B12 i kwas foliowy pokażą, czego brakuje.', 'MCV is high — B12 and folate show what is short.'),
  b12vegan: say('Na diecie bez produktów zwierzęcych B12 warto sprawdzać co rok.', 'Without animal foods, B12 is worth checking every year.'),
  vitD: say('W Polsce większość dorosłych ma za mało witaminy D jesienią i zimą.', 'In Poland most adults are low in vitamin D in autumn and winter.'),
  hba1c: say('Glukoza jest podwyższona — HbA1c pokaże średni cukier z 3 miesięcy.', 'Glucose is raised — HbA1c shows the 3-month average.'),
  lipids: say('Lipidogram to podstawa oceny ryzyka sercowego; przy diecie keto szczególnie.', 'A lipid panel is the basis of heart risk; on keto especially.'),
  egfr: say('Przy diecie wysokobiałkowej warto znać wydolność nerek.', 'On a high-protein diet, kidney function is worth knowing.'),
};

/** Rules that change a single finding: red flags first, then patterns. */
function classify(id: string, latest: Latest, verdict: Verdict, person: Person, all: Map<string, Latest>): { severity: Severity; note: string | null } {
  const v = latest.value;
  const { level, target, times } = verdict;
  const marker = MARKERS[id]!;
  const valueOf = (m: string) => all.get(m)?.value ?? null;
  // A detection limit counts on its side: "<3" is below 3, ">90" is above 90.
  const below = (limit: number) => v !== null && (v < limit || (v <= limit && latest.cmp === '<'));
  const above = (limit: number) => v !== null && (v > limit || (v >= limit && latest.cmp === '>'));
  const out = (severity: Severity, note: string | null = null) => ({ severity, note });

  switch (id) {
    case 'potassium':
      if (below(3) || above(6)) return out('urgent', T.urgentPotassium);
      if (level === 'high') return out('doctor', T.potassiumHigh);
      if (level === 'low') return out('doctor', T.potassiumLow);
      return out('ok');
    case 'sodium':
      if (v !== null && (v < 125 || v > 155)) return out('urgent', T.urgentSodium);
      return out(level === 'ok' ? 'ok' : 'doctor', level === 'ok' ? null : T.blood);
    case 'glucose':
      if (v !== null && v >= 200 && latest.cmp !== '<') return out('urgent', T.urgentGlucose);
      if (below(55)) return out('doctor', T.hypo);
      if (v !== null && v >= 126) return out('doctor', T.diabetes);
      if (v !== null && v >= 100) return out('diet', T.prediabetes);
      if (level === 'low') return out('doctor', T.blood);
      return out('ok');
    case 'hba1c':
      if (v !== null && v >= 9) return out('urgent', T.hba1cHigh);
      if (v !== null && v >= 6.5) return out('doctor', T.hba1cNote);
      if (v !== null && v >= 5.7) return out('diet', T.prediabetes);
      return out('ok');
    case 'insulin':
    case 'homaIr':
      return level === 'high' ? out('watch', T.homaNote) : out('ok');
    case 'hgb': {
      if (below(10)) return out('urgent', T.severeAnaemia);
      if (level === 'low') {
        const mcv = valueOf('mcv');
        const pattern = mcv !== null && mcv < 80 ? T.ironPattern : mcv !== null && mcv > 100 ? T.b12Pattern : null;
        return out('doctor', pattern ? `${T.anaemia} ${pattern}` : T.anaemia);
      }
      return level === 'high' ? out('doctor', T.blood) : out('ok');
    }
    case 'mcv':
      if (level === 'low') return out('watch', T.ironPattern);
      if (level === 'high') return out('watch', T.b12Pattern);
      return out('ok');
    case 'wbc':
    case 'plt':
    case 'hct':
    case 'rbc':
    case 'mch':
    case 'mchc':
    case 'rdw':
      if (level === 'ok' || level === 'unknown') return out('ok');
      if (id === 'wbc' && v !== null && (v < 3 || v > 15)) return out('doctor', T.blood);
      if (id === 'plt' && v !== null && (v < 100 || v > 500)) return out('doctor', T.blood);
      return out('watch', T.minor);
    case 'ferritin': {
      const tsat = valueOf('tsat');
      if (level === 'high' && tsat !== null && tsat > 45) return out('doctor', T.ironOverload);
      if (level === 'high') return out('doctor', T.highFerritin);
      if (below(15)) return out('doctor', T.ferritinLow);
      if (level === 'low') return out('diet');
      if (target === 'below') return out('watch');
      return out('ok');
    }
    case 'tsat':
      if (level === 'high' && (valueOf('ferritin') ?? 0) > 200) return out('doctor', T.ironOverload);
      return level === 'low' ? out('watch') : out('ok');
    case 'iron':
    case 'tibc':
    case 'uibc':
    case 'transferrin':
      // Serum iron alone moves with the time of day and the last meal: it supports ferritin, it never leads.
      return level === 'ok' || level === 'unknown' ? out('ok') : out('watch');
    case 'b12':
      if (below(180)) return out('doctor', T.b12Low);
      if (level === 'low') return out('diet', person.eats === 'all' ? T.b12Absorption : null);
      if (target === 'below') return out('watch');
      return out('ok');
    case 'homocysteine':
      if (v !== null && v > 30) return out('doctor', T.homocysteineHigh);
      return level === 'high' ? out('diet') : out('ok');
    case 'vitD':
      if (above(100)) return out('doctor', T.vitDHigh);
      if (below(10)) return out('doctor', T.vitDSevere);
      if (v !== null && v < 20) return out('diet', T.vitDLow);
      if (level === 'low' || target === 'below') return out('diet');
      return out('ok');
    case 'folate':
      if (below(3)) return out('doctor', T.folateLow);
      return level === 'low' ? out('diet') : out('ok');
    case 'magnesium':
      if (v !== null && (v < 1.2 || v > 2.9)) return out('doctor', T.mineral);
      return level === 'low' ? out('diet') : level === 'high' ? out('doctor', T.minor) : out('ok');
    case 'zinc':
      if (v !== null && v < 50) return out('doctor', T.mineral);
      return level === 'low' ? out('diet') : level === 'high' ? out('watch', T.minor) : out('ok');
    case 'selenium':
      if (v !== null && v > 200) return out('doctor', T.selenium);
      return level === 'low' ? out('diet') : level === 'high' ? out('watch', T.minor) : out('ok');
    case 'vitA':
    case 'vitE':
      if (level === 'high') return out('doctor', id === 'vitA' ? T.vitAHigh : T.vitEHigh);
      return level === 'low' ? out('doctor', T.minor) : out('ok');
    case 'ck':
      return level === 'high' ? out('watch', T.ck) : out('ok');
    case 'alp':
    case 'totalProtein':
    case 'albumin':
      return level === 'ok' || level === 'unknown' ? out('ok') : out('doctor', T.minor);
    case 'calcium':
    case 'phosphorus':
      return level === 'ok' || level === 'unknown' ? out('ok') : out('doctor', T.calcium);
    case 'chol':
      if (v !== null && v > 300) return out('doctor', T.cholVeryHigh);
      return level === 'high' || target === 'above' ? out('diet') : out('ok');
    case 'nonHdl':
    case 'apob':
      return level === 'high' || target === 'above' ? out('diet') : out('ok');
    case 'ldl':
      if (v !== null && v >= 190) return out('doctor', T.ldlVeryHigh);
      return level === 'high' || target === 'above' ? out('diet') : out('ok');
    case 'tg':
      if (v !== null && v >= 500) return out('doctor', T.tgVeryHigh);
      return level === 'high' ? out('diet') : target === 'above' ? out('watch') : out('ok');
    case 'lpa':
      return level === 'high' ? out('doctor', T.lpa) : out('ok');
    case 'alt':
    case 'ast':
    case 'ggt':
      if (times !== null && level === 'high' && times > 3) return out('doctor', T.liverHigh);
      if (level === 'high') return out('diet', id === 'ggt' ? null : T.liverTraining);
      if (target === 'above') return out('watch');
      return out('ok');
    case 'bilirubin':
      if (v !== null && v > 2) return out('doctor', T.blood);
      return level === 'high' ? out('watch', T.blood) : out('ok');
    case 'egfr':
      if (v !== null && v < 30 && latest.cmp !== '>') return out('urgent', T.kidneySevere);
      if (v !== null && v < 60 && latest.cmp !== '>') return out('doctor', T.kidney);
      return out('ok');
    case 'creatinine':
      return level === 'high' ? out('doctor', `${T.kidney} ${T.creatinineMuscle}`) : out('ok');
    case 'urea':
      if (times !== null && level === 'high' && times > 2) return out('doctor', T.minor);
      return level === 'high' ? out('watch') : out('ok');
    case 'uricAcid':
      if (v !== null && v > 10) return out('doctor', T.uricHigh);
      return level === 'high' ? out('diet') : target === 'above' ? out('watch') : out('ok');
    case 'tsh':
      if (v !== null && (v < 0.1 || v > 10)) return out('urgent', T.thyroidUrgent);
      return level === 'ok' || level === 'unknown' ? out('ok') : out('doctor', T.thyroid);
    case 'ft4':
    case 'ft3':
    case 'antiTpo':
      return level === 'ok' || level === 'unknown' ? out('ok') : out('doctor', T.thyroid);
    case 'crp':
      if (v !== null && v > 10) return out('doctor', T.infection);
      return level === 'high' ? out('watch') : out('ok');
    case 'hsCrp':
      if (v !== null && v > 10) return out('doctor', T.infection);
      return level === 'high' ? out('diet') : out('ok');
    case 'uSg':
      return level === 'high' ? out('diet') : out('ok');
    case 'uKetones': {
      if (level !== 'high') return out('ok');
      const urineGlucose = all.get('uGlucose');
      if ((urineGlucose && urineGlucose.qual !== null && urineGlucose.qual !== 'neg') || (valueOf('glucose') ?? 0) >= 200)
        return out('urgent', T.ketoGlucose);
      return out(person.lowCarb ? 'ok' : 'doctor', T.ketones);
    }
    case 'uProtein':
    case 'uBlood':
      if (level === 'high' && latest.qual === 'trace') return out('watch', T.urine);
      return level === 'high' ? out('doctor', T.urine) : out('ok');
    case 'uGlucose':
    case 'uLeuko':
    case 'uNitrite':
      return level === 'high' ? out('doctor', T.urine) : out('ok');
    default:
      if (level === 'ok' || level === 'unknown') return target ? out('watch') : out('ok');
      return out(marker.diet === 'no' ? 'doctor' : 'diet');
  }
}

/** Doctor findings food can still support, on the side `feedsFocus` allows. */
const DOCTOR_AND_DIET = ['glucose', 'hba1c', 'ldl', 'chol', 'tg', 'potassium', 'b12', 'ferritin', 'vitD', 'folate', 'uricAcid'];

/** Markers whose focus raises something feed it only when low; those that lower something, only when high. */
const RAISES = new Set(['ferritin', 'tsat', 'iron', 'hgb', 'b12', 'holotc', 'folate', 'vitD', 'magnesium', 'zinc', 'selenium', 'potassium', 'omega3', 'hdl']);

function feedsFocus(f: Finding): boolean {
  const { level, target } = f.verdict;
  if (RAISES.has(f.marker)) return level === 'low' || (level === 'ok' && target === 'below');
  // Glucose under range is a hypo, not a reason to cut sugar; diabetes-range values still get the food side.
  if (f.marker === 'glucose') return (f.latest.value ?? 0) >= 100;
  return level === 'high' || (level === 'ok' && target === 'above');
}

/** Which focus a finding feeds, if any. */
const FOCUS_OF: Record<string, FocusId> = {
  ferritin: 'iron',
  tsat: 'iron',
  iron: 'iron',
  hgb: 'iron',
  b12: 'b12',
  holotc: 'b12',
  folate: 'folate',
  homocysteine: 'folate',
  vitD: 'vitD',
  magnesium: 'magnesium',
  zinc: 'zinc',
  selenium: 'selenium',
  potassium: 'potassium',
  ldl: 'ldl',
  nonHdl: 'ldl',
  chol: 'ldl',
  apob: 'ldl',
  tg: 'tg',
  hdl: 'hdl',
  glucose: 'glucose',
  hba1c: 'glucose',
  insulin: 'glucose',
  homaIr: 'glucose',
  uricAcid: 'uric',
  alt: 'liver',
  ggt: 'liver',
  ast: 'liver',
  omega3: 'omega3',
  hsCrp: 'inflammation',
  uSg: 'hydration',
};

export function assess(latest: Map<string, Latest>, person: Person): Assessment {
  const findings: Finding[] = [];
  for (const [id, value] of latest) {
    const marker = MARKERS[id];
    if (!marker) continue;
    const verdict = judge(marker, value, person.sex);
    const { severity, note } = classify(id, value, verdict, person, latest);
    findings.push({ marker: id, latest: value, verdict, severity, note });
  }
  const order: Record<Severity, number> = { urgent: 0, doctor: 1, diet: 2, watch: 3, ok: 4 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const byId = new Map(findings.map((f) => [f.marker, f]));
  const sev = (id: string) => byId.get(id)?.severity;
  const inflamed = (latest.get('crp')?.value ?? latest.get('hsCrp')?.value ?? 0) > 10;

  const focus = new Map<FocusId, Focus>();
  const add = (id: FocusId, marker: string, bump = 0) => {
    const f = focus.get(id);
    if (f) {
      if (!f.markers.includes(marker)) f.markers.push(marker);
    } else focus.set(id, { id, markers: [marker], priority: FOCUS_PRIORITY[id] + bump });
  };
  for (const f of findings) {
    const id = FOCUS_OF[f.marker];
    if (!id || !feedsFocus(f)) continue;
    if (f.severity === 'diet' || (f.severity === 'watch' && f.verdict.level !== 'ok')) add(id, f.marker);
    else if (f.severity === 'watch') add(id, f.marker, 20);
    // A doctor finding that food can still support: diabetes-range glucose, LDL ≥ 190, empty iron stores.
    else if (f.severity === 'doctor' && DOCTOR_AND_DIET.includes(f.marker)) add(id, f.marker);
  }
  // Anaemia with small cells, or low ferritin: iron. Haemoglobin alone without ferritin is not enough.
  if (byId.get('hgb')?.verdict.level === 'low' && (latest.get('mcv')?.value ?? 100) < 80) add('iron', 'hgb');
  if (focus.has('iron') && !['ferritin', 'tsat'].some((m) => focus.get('iron')!.markers.includes(m)) && !latest.has('ferritin')) {
    // Only haemoglobin or serum iron: keep it, but behind everything that is better founded.
    focus.get('iron')!.priority += 20;
  }
  // Good stores: a low serum iron alone is the time of day, not a deficit.
  const ferritin = byId.get('ferritin');
  if (ferritin && ferritin.severity === 'ok' && !focus.get('iron')?.markers.includes('hgb')) focus.delete('iron');
  // High ferritin or overload: never an iron focus.
  if (byId.get('ferritin')?.verdict.level === 'high' || byId.get('tsat')?.severity === 'doctor') focus.delete('iron');
  // Infection: iron markers say nothing now.
  if (inflamed && focus.has('iron')) focus.delete('iron');
  // Large cells: B12 and folate, if their own results do not already say otherwise.
  if (byId.get('mcv')?.verdict.level === 'high' || (sev('hgb') === 'doctor' && (latest.get('mcv')?.value ?? 0) > 100)) {
    if (!latest.has('b12')) add('b12', 'mcv', 20);
    if (!latest.has('folate')) add('folate', 'mcv', 20);
  }
  // TG high with low omega-3 index or none: fish carries both.
  if (focus.has('tg') && focus.has('omega3')) focus.get('omega3')!.priority += 10;

  const egfr = latest.get('egfr');
  const egfrLow = (limit: number) => !!egfr && egfr.value !== null && egfr.value < limit && egfr.cmp !== '>';
  const proteinCaution = egfrLow(60) || byId.get('creatinine')?.verdict.level === 'high';
  // Weak kidneys: no potassium-rich advice; very weak ones or a minor: no plan at all.
  if (proteinCaution) focus.delete('potassium');
  const blocked = egfrLow(30) || (person.age !== null && person.age < 18);
  if (blocked) focus.clear();
  const sorted = [...focus.values()].sort((a, b) => a.priority - b.priority);

  const missing: Assessment['missing'] = [];
  const has = (m: string) => latest.has(m);
  if (((byId.get('hgb')?.verdict.level === 'low') || byId.get('mcv')?.verdict.level === 'low') && !has('ferritin'))
    missing.push({ marker: 'ferritin', why: missingWhy.ferritin });
  if (byId.get('mcv')?.verdict.level === 'high' && !has('b12')) missing.push({ marker: 'b12', why: missingWhy.b12 });
  if (person.eats === 'vegan' && !has('b12')) missing.push({ marker: 'b12', why: missingWhy.b12vegan });
  if (!has('vitD')) missing.push({ marker: 'vitD', why: missingWhy.vitD });
  if ((byId.get('glucose')?.severity === 'diet' || byId.get('glucose')?.severity === 'doctor') && !has('hba1c'))
    missing.push({ marker: 'hba1c', why: missingWhy.hba1c });
  if (!has('ldl') && !has('chol')) missing.push({ marker: 'ldl', why: missingWhy.lipids });
  if (!has('egfr') && !has('creatinine')) missing.push({ marker: 'egfr', why: missingWhy.egfr });

  return { findings, focus: sorted.slice(0, 3), more: sorted.slice(3), proteinCaution, blocked, inflamed, missing: dedupe(missing) };
}

function dedupe<T extends { marker: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => !seen.has(x.marker) && seen.add(x.marker));
}

export const PREGNANCY_NOTE = T.pregnancy;
