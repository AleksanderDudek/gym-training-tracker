import { say } from '../../i18n';
import type { FocusId } from './assess';
import type { NutrientKey } from './norms';
import type { Eats } from './types';

/**
 * What each diet focus asks for: the nutrient to raise (foods are ranked by it), what to limit,
 * how to eat it so it is absorbed, a few weekly habits to count, and when and what to retest.
 * The advice is the food-first part of the guidelines in `docs/research/badania-laboratoryjne.md`;
 * doses of anything except the public vitamin D guideline are left to a doctor.
 */

export type HabitId =
  | 'fattyFish'
  | 'legumes'
  | 'nuts'
  | 'seeds'
  | 'greens'
  | 'wholeGrains'
  | 'oats'
  | 'oilSwap'
  | 'noSweetDrinks'
  | 'noAlcohol'
  | 'water'
  | 'vitCWithIron'
  | 'teaApart'
  | 'redMeat'
  | 'b12Food'
  | 'b12Supplement'
  | 'vitDSupplement'
  | 'brazilNut'
  | 'veggiesHalf'
  | 'walkAfterMeal'
  | 'dairy'
  | 'movement'
  | 'fruitVeg';

export interface Habit {
  id: HabitId;
  label: string;
  /** Times a week that count as done. */
  perWeek: number;
  /** Who it is for; absent: everyone. */
  eats?: readonly Eats[];
}

export const HABITS: Record<HabitId, Habit> = {
  fattyFish: { id: 'fattyFish', label: say('Tłusta ryba (śledź, makrela, łosoś, sardynki)', 'Oily fish (herring, mackerel, salmon, sardines)'), perWeek: 2, eats: ['all'] },
  legumes: { id: 'legumes', label: say('Strączki (soczewica, ciecierzyca, fasola, tofu)', 'Legumes (lentils, chickpeas, beans, tofu)'), perWeek: 4 },
  nuts: { id: 'nuts', label: say('Garść orzechów (30 g)', 'A handful of nuts (30 g)'), perWeek: 7 },
  seeds: { id: 'seeds', label: say('Pestki dyni lub słonecznika (30 g)', 'Pumpkin or sunflower seeds (30 g)'), perWeek: 5 },
  greens: { id: 'greens', label: say('Zielone warzywa liściaste (szpinak, jarmuż, natka, rukola)', 'Leafy greens (spinach, kale, parsley, rocket)'), perWeek: 7 },
  wholeGrains: { id: 'wholeGrains', label: say('Pełne ziarno zamiast białego (kasza, chleb żytni razowy)', 'Whole grains instead of white (groats, rye wholemeal bread)'), perWeek: 7 },
  oats: { id: 'oats', label: say('Owsianka albo kasza jęczmienna (beta-glukan)', 'Porridge or barley (beta-glucan)'), perWeek: 5 },
  oilSwap: { id: 'oilSwap', label: say('Olej rzepakowy lub oliwa zamiast masła i smalcu', 'Rapeseed or olive oil instead of butter and lard'), perWeek: 7 },
  noSweetDrinks: { id: 'noSweetDrinks', label: say('Dzień bez słodkich napojów i soków', 'A day without sweet drinks and juice'), perWeek: 7 },
  noAlcohol: { id: 'noAlcohol', label: say('Dzień bez alkoholu', 'A day without alcohol'), perWeek: 7 },
  water: { id: 'water', label: say('1,5–2 l wody w ciągu dnia', '1.5–2 l of water over the day'), perWeek: 7 },
  vitCWithIron: { id: 'vitCWithIron', label: say('Warzywo lub owoc z witaminą C do posiłku z żelazem', 'A vitamin C vegetable or fruit with the iron meal'), perWeek: 7 },
  teaApart: { id: 'teaApart', label: say('Herbata i kawa godzinę przed lub dwie po posiłku', 'Tea and coffee an hour before or two after meals'), perWeek: 7 },
  redMeat: { id: 'redMeat', label: say('Wołowina, wieprzowina lub podroby (razem do 500 g w tygodniu)', 'Beef, pork or offal (up to 500 g a week in all)'), perWeek: 3, eats: ['all'] },
  b12Food: { id: 'b12Food', label: say('Produkt z B12: jaja, nabiał, ryba lub mięso', 'A B12 food: eggs, dairy, fish or meat'), perWeek: 7, eats: ['all', 'vege'] },
  b12Supplement: { id: 'b12Supplement', label: say('Suplement B12 lub produkt nią wzbogacany', 'A B12 supplement or a fortified food'), perWeek: 7, eats: ['vegan'] },
  vitDSupplement: { id: 'vitDSupplement', label: say('Witamina D według zalecenia', 'Vitamin D as recommended'), perWeek: 7 },
  brazilNut: { id: 'brazilNut', label: say('Jeden orzech brazylijski (nie więcej niż dwa)', 'One Brazil nut (no more than two)'), perWeek: 5 },
  veggiesHalf: { id: 'veggiesHalf', label: say('Pół talerza warzyw w obiedzie', 'Half a plate of vegetables at the main meal'), perWeek: 7 },
  walkAfterMeal: { id: 'walkAfterMeal', label: say('10–15 minut spaceru po posiłku', 'A 10–15 minute walk after a meal'), perWeek: 5 },
  dairy: { id: 'dairy', label: say('Chudy nabiał (jogurt, kefir, twaróg)', 'Low-fat dairy (yoghurt, kefir, quark)'), perWeek: 7, eats: ['all', 'vege'] },
  movement: { id: 'movement', label: say('Trening albo 30 minut szybkiego marszu', 'A workout or 30 minutes of brisk walking'), perWeek: 4 },
  fruitVeg: { id: 'fruitVeg', label: say('Pięć porcji warzyw i owoców', 'Five portions of vegetables and fruit'), perWeek: 7 },
};

export interface FocusDef {
  id: FocusId;
  title: string;
  /** What the plan aims at, in the result's own terms. */
  goal: string;
  /** The nutrients foods are ranked by, the main one first; none for pattern focuses (glucose, liver). */
  raise: NutrientKey[];
  /** Eaten with the main food, it helps (vitamin C for plant iron). */
  pair?: NutrientKey;
  /** Shown as a short list of what to put on the plate when `raise` is empty. */
  favor?: string[];
  limit: string[];
  tips: string[];
  /** Said instead of a food list for vegans, when food cannot do it. */
  vegan?: string;
  habits: HabitId[];
  retest: string[];
  retestWeeks: number;
}

export const FOCUS: Record<FocusId, FocusDef> = {
  iron: {
    id: 'iron',
    title: say('Uzupełnij żelazo', 'Top up iron'),
    goal: say('Ferrytyna co najmniej 30 ng/ml i hemoglobina w normie', 'Ferritin of at least 30 ng/ml and haemoglobin in range'),
    raise: ['iron'],
    pair: 'vitC',
    limit: [
      say('Herbata, kawa i kakao do posiłku z żelazem — taniny i polifenole hamują wchłanianie', 'Tea, coffee and cocoa with the iron meal — tannins and polyphenols block absorption'),
      say('Nabiał, suplement wapnia i otręby w tym samym posiłku co główne źródło żelaza', 'Dairy, calcium supplements and bran in the same meal as the main iron source'),
    ],
    tips: [
      say('Żelazo z mięsa, ryb i podrobów (hemowe) wchłania się kilka razy lepiej niż z roślin.', 'Iron from meat, fish and offal (haem iron) is absorbed several times better than from plants.'),
      say('Do roślinnych źródeł dodaj witaminę C: paprykę, natkę, kiszoną kapustę, cytrusy, porzeczki.', 'Add vitamin C to plant sources: peppers, parsley, sauerkraut, citrus, blackcurrants.'),
      say('Strączki namocz i ugotuj, pieczywo wybieraj na zakwasie — mniej fitynianów, więcej żelaza dla ciebie.', 'Soak and cook legumes, choose sourdough bread — fewer phytates, more iron for you.'),
      say('Suplement żelaza tylko po rozmowie z lekarzem: nadmiar szkodzi, a niedobór ma przyczynę, którą trzeba znać.', 'An iron supplement only after talking to a doctor: too much harms, and a deficit has a cause worth knowing.'),
    ],
    habits: ['redMeat', 'legumes', 'vitCWithIron', 'teaApart'],
    retest: ['ferritin', 'hgb', 'mcv'],
    retestWeeks: 12,
  },
  b12: {
    id: 'b12',
    title: say('Więcej witaminy B12', 'More vitamin B12'),
    goal: say('B12 powyżej 300 pg/ml', 'B12 above 300 pg/ml'),
    raise: ['vitB12'],
    limit: [],
    tips: [
      say('B12 jest tylko w produktach zwierzęcych: rybach, mięsie, jajach i nabiale.', 'B12 is only in animal foods: fish, meat, eggs and dairy.'),
      say('Jeśli jesz te produkty, a B12 i tak jest niska, przyczyną bywa wchłanianie (leki na zgagę, metformina) — to sprawa dla lekarza.', 'If you eat them and B12 is still low, absorption is often the cause (heartburn drugs, metformin) — that is for a doctor.'),
    ],
    vegan: say(
      'Na diecie wegańskiej B12 z jedzenia nie wystarczy: potrzebny jest suplement albo produkty nią wzbogacane (napoje roślinne, płatki drożdżowe). Dawkę dobierz z lekarzem lub farmaceutą.',
      'On a vegan diet, food will not give enough B12: a supplement or fortified foods (plant drinks, nutritional yeast) are needed. Choose the dose with a doctor or pharmacist.',
    ),
    habits: ['b12Food', 'b12Supplement', 'fattyFish'],
    retest: ['b12', 'mcv'],
    retestWeeks: 12,
  },
  folate: {
    id: 'folate',
    title: say('Więcej folianów', 'More folate'),
    goal: say('Kwas foliowy w normie, homocysteina poniżej 15 µmol/l', 'Folate in range, homocysteine under 15 µmol/l'),
    raise: ['folate'],
    limit: [say('Alkohol — zwiększa straty folianów', 'Alcohol — it increases folate losses')],
    tips: [
      say('Foliany giną przy długim gotowaniu: część zielonych warzyw jedz na surowo albo krótko na parze.', 'Folate is lost in long cooking: eat some greens raw or briefly steamed.'),
      say('Planujesz ciążę? Zalecany jest suplement kwasu foliowego — porozmawiaj z lekarzem.', 'Planning a pregnancy? A folic acid supplement is recommended — talk to your doctor.'),
      say(
        'Bierzesz acenokumarol lub warfarynę? Nie zwiększaj nagle zielonych warzyw (dużo witaminy K) — jedz ich podobnie co tydzień, a zmianę ustal z lekarzem.',
        'On acenocoumarol or warfarin? Do not suddenly eat more greens (rich in vitamin K) — keep the amount steady week to week and agree a change with your doctor.',
      ),
    ],
    habits: ['greens', 'legumes', 'fruitVeg'],
    retest: ['folate', 'homocysteine', 'mcv'],
    retestWeeks: 8,
  },
  vitD: {
    id: 'vitD',
    title: say('Podnieś witaminę D', 'Raise vitamin D'),
    goal: say('25(OH)D w przedziale 30–50 ng/ml', '25(OH)D between 30 and 50 ng/ml'),
    raise: ['vitD'],
    limit: [],
    tips: [
      say(
        'Jedzenie daje mało witaminy D — nawet tłusta ryba dwa razy w tygodniu nie wystarczy. NCEZ (PZH) zaleca dorosłym 800–2000 j.m. dziennie od września do kwietnia; polskie wytyczne z 2023 r. — 1000–2000 j.m. przez cały rok, jeśli latem mało słońca (seniorom i przy otyłości więcej).',
        'Food gives little vitamin D — even oily fish twice a week is not enough. NCEZ (PZH) advises adults 800–2000 IU a day from September to April; the 2023 Polish guidelines — 1000–2000 IU all year with little summer sun (more for seniors and with obesity).',
      ),
      say('Przy wyniku poniżej 20 ng/ml dawkę leczniczą ustala lekarz.', 'Below 20 ng/ml a doctor sets the treatment dose.'),
      say('Witamina D rozpuszcza się w tłuszczu — przyjmuj ją z posiłkiem, w którym jest tłuszcz.', 'Vitamin D dissolves in fat — take it with a meal that has fat in it.'),
      say('Od maja do września 15 minut słońca na odkryte ręce i nogi między 10 a 15.', 'From May to September, 15 minutes of sun on bare arms and legs between 10 and 15.'),
    ],
    habits: ['vitDSupplement', 'fattyFish'],
    retest: ['vitD'],
    retestWeeks: 12,
  },
  magnesium: {
    id: 'magnesium',
    title: say('Więcej magnezu', 'More magnesium'),
    goal: say('Magnez w surowicy w normie', 'Serum magnesium in range'),
    raise: ['magnesium'],
    limit: [say('Alkohol — zwiększa utratę magnezu z moczem', 'Alcohol — it raises magnesium loss in urine')],
    tips: [
      say('Najwięcej magnezu mają pestki dyni, kakao, kasza gryczana, orzechy i strączki.', 'Pumpkin seeds, cocoa, buckwheat, nuts and legumes have the most magnesium.'),
      say('Woda mineralna z magnezem powyżej 50 mg/l to łatwe dodatkowe źródło.', 'Mineral water with over 50 mg/l of magnesium is an easy extra source.'),
    ],
    habits: ['seeds', 'nuts', 'wholeGrains', 'legumes'],
    retest: ['magnesium'],
    retestWeeks: 8,
  },
  zinc: {
    id: 'zinc',
    title: say('Więcej cynku', 'More zinc'),
    goal: say('Cynk w normie', 'Zinc in range'),
    raise: ['zinc'],
    limit: [],
    tips: [
      say('Cynk z mięsa i ryb wchłania się lepiej niż ze zbóż i strączków.', 'Zinc from meat and fish is absorbed better than from grains and legumes.'),
      say('Namaczanie i kiełkowanie strączków oraz pieczywo na zakwasie zwiększają wchłanianie.', 'Soaking and sprouting legumes and sourdough bread improve absorption.'),
    ],
    habits: ['seeds', 'legumes', 'nuts'],
    retest: ['zinc'],
    retestWeeks: 12,
  },
  selenium: {
    id: 'selenium',
    title: say('Więcej selenu', 'More selenium'),
    goal: say('Selen w normie', 'Selenium in range'),
    raise: ['selenium'],
    limit: [
      say(
        'Więcej niż dwa orzechy brazylijskie dziennie i orzechy razem z suplementem selenu — łatwo przekroczyć bezpieczne 255 µg dziennie (EFSA 2023)',
        'More than two Brazil nuts a day, or nuts on top of a selenium supplement — it is easy to exceed the safe 255 µg a day (EFSA 2023)',
      ),
    ],
    tips: [say('Jeden orzech brazylijski daje zwykle całą dzienną porcję selenu.', 'One Brazil nut usually gives a whole day’s selenium.')],
    habits: ['brazilNut', 'fattyFish'],
    retest: ['selenium'],
    retestWeeks: 12,
  },
  potassium: {
    id: 'potassium',
    title: say('Więcej potasu z jedzenia', 'More potassium from food'),
    goal: say('Potas w normie', 'Potassium in range'),
    raise: ['potassium'],
    limit: [],
    tips: [
      say('Potas jest w warzywach, owocach, strączkach i ziemniakach — pięć porcji dziennie to podstawa.', 'Potassium is in vegetables, fruit, legumes and potatoes — five portions a day is the basis.'),
      say('Bez suplementów potasu i „soli potasowej” na własną rękę — przy chorych nerkach i niektórych lekach to groźne.', 'No potassium supplements or “potassium salt” on your own — with weak kidneys and some medicines that is dangerous.'),
    ],
    habits: ['fruitVeg', 'legumes'],
    retest: ['potassium'],
    retestWeeks: 4,
  },
  ldl: {
    id: 'ldl',
    title: say('Obniż cholesterol LDL', 'Lower LDL cholesterol'),
    goal: say('LDL poniżej 115 mg/dl (twój cel zależy od ryzyka — ustal go z lekarzem)', 'LDL under 115 mg/dl (your target depends on risk — agree it with your doctor)'),
    raise: ['fiber'],
    limit: [
      say('Tłuszcze nasycone: tłuste mięso i wędliny, masło, smalec, tłuste sery, śmietana', 'Saturated fat: fatty meat and cold cuts, butter, lard, full-fat cheese, cream'),
      say('Wyroby cukiernicze z tłuszczem palmowym i kokosowym, fast food', 'Pastries with palm or coconut fat, fast food'),
    ],
    tips: [
      say('Beta-glukan z owsa i jęczmienia (3 g dziennie, czyli ok. 3 porcji) obniża LDL — to oświadczenie zatwierdzone przez EFSA.', 'Beta-glucan from oats and barley (3 g a day, about 3 portions) lowers LDL — an EFSA-approved claim.'),
      say('Zamiana masła na olej rzepakowy lub oliwę i garść orzechów dziennie to dwie zmiany o największym efekcie.', 'Swapping butter for rapeseed or olive oil and a handful of nuts a day are the two changes with the biggest effect.'),
      say('Sterole roślinne (2 g dziennie, np. w margarynach z dodatkiem steroli) obniżają LDL o 7–10 %.', 'Plant sterols (2 g a day, e.g. in sterol-enriched spreads) lower LDL by 7–10 %.'),
    ],
    habits: ['oats', 'oilSwap', 'nuts', 'legumes', 'fattyFish'],
    retest: ['ldl', 'nonHdl', 'chol', 'tg'],
    retestWeeks: 8,
  },
  tg: {
    id: 'tg',
    title: say('Obniż triglicerydy', 'Lower triglycerides'),
    goal: say('Triglicerydy poniżej 150 mg/dl', 'Triglycerides under 150 mg/dl'),
    raise: ['epaDha'],
    limit: [
      say('Słodkie napoje i soki, słodycze, biała mąka', 'Sweet drinks and juice, sweets, white flour'),
      say('Alkohol — nawet niewielkie ilości podnoszą triglicerydy', 'Alcohol — even small amounts raise triglycerides'),
    ],
    tips: [
      say('Spadek masy ciała o 5–10 % obniża triglicerydy o około 20 %.', 'Losing 5–10 % of body weight lowers triglycerides by about 20 %.'),
      say('Tłusta ryba dwa razy w tygodniu pomaga; dawki omega-3 działające jak lek (2–4 g) to już suplement — ustal go z lekarzem.', 'Oily fish twice a week helps; omega-3 doses that act like a drug (2–4 g) are supplement territory — agree them with your doctor.'),
    ],
    habits: ['noSweetDrinks', 'noAlcohol', 'fattyFish', 'movement'],
    retest: ['tg', 'ldl'],
    retestWeeks: 8,
  },
  hdl: {
    id: 'hdl',
    title: say('Podnieś HDL', 'Raise HDL'),
    goal: say('HDL powyżej 40 mg/dl (mężczyźni) lub 45 mg/dl (kobiety)', 'HDL above 40 mg/dl (men) or 45 mg/dl (women)'),
    raise: [],
    favor: [
      say('Oliwa, olej rzepakowy, orzechy, awokado zamiast tłuszczów nasyconych', 'Olive and rapeseed oil, nuts, avocado instead of saturated fats'),
      say('Pełne ziarno zamiast białego pieczywa i słodyczy', 'Whole grains instead of white bread and sweets'),
    ],
    limit: [say('Cukry proste i rafinowane węglowodany', 'Simple sugars and refined carbohydrates')],
    tips: [say('HDL najbardziej podnosi regularny ruch, spadek masy ciała i rzucenie palenia.', 'Regular activity, weight loss and quitting smoking raise HDL the most.')],
    habits: ['movement', 'oilSwap', 'nuts'],
    retest: ['hdl'],
    retestWeeks: 12,
  },
  glucose: {
    id: 'glucose',
    title: say('Wyrównaj cukier', 'Steady blood sugar'),
    goal: say('Glukoza na czczo poniżej 100 mg/dl, HbA1c poniżej 5,7 %', 'Fasting glucose under 100 mg/dl, HbA1c under 5.7 %'),
    raise: ['fiber'],
    limit: [
      say('Słodkie napoje, soki i słodycze', 'Sweet drinks, juice and sweets'),
      say('Białe pieczywo, biały ryż i makaron w dużych porcjach', 'White bread, white rice and pasta in large portions'),
    ],
    tips: [
      say('Spadek masy ciała o 5–7 % zmniejsza ryzyko cukrzycy o ponad połowę (badanie DPP).', 'Losing 5–7 % of body weight more than halves the risk of diabetes (the DPP trial).'),
      say('Białko i warzywa na początku posiłku, węglowodany na końcu — cukier po posiłku rośnie wolniej.', 'Protein and vegetables first, carbohydrates last — blood sugar rises more slowly after the meal.'),
      say('Krótki spacer po posiłku obniża cukier po jedzeniu.', 'A short walk after a meal lowers blood sugar after eating.'),
    ],
    habits: ['veggiesHalf', 'noSweetDrinks', 'wholeGrains', 'walkAfterMeal', 'movement'],
    retest: ['glucose', 'hba1c'],
    retestWeeks: 12,
  },
  uric: {
    id: 'uric',
    title: say('Obniż kwas moczowy', 'Lower uric acid'),
    goal: say('Kwas moczowy poniżej 6 mg/dl', 'Uric acid under 6 mg/dl'),
    raise: [],
    favor: [
      say('Chudy nabiał — wiąże się z niższym kwasem moczowym', 'Low-fat dairy — linked to lower uric acid'),
      say('Białko z jaj, nabiału i strączków zamiast podrobów i dużych porcji mięsa', 'Protein from eggs, dairy and legumes instead of offal and large meat portions'),
    ],
    limit: [
      say('Słodkie napoje i soki (fruktoza)', 'Sweet drinks and juice (fructose)'),
      say('Alkohol, zwłaszcza piwo (także bezalkoholowe)', 'Alcohol, beer especially (alcohol-free too)'),
      say('Podroby, sardynki, śledzie i owoce morza w dużych ilościach', 'Offal, sardines, herring and seafood in large amounts'),
    ],
    tips: [say('Picie wody i stopniowy spadek masy ciała obniżają kwas moczowy; głodówki go podnoszą.', 'Drinking water and gradual weight loss lower uric acid; crash diets raise it.')],
    habits: ['water', 'noSweetDrinks', 'noAlcohol', 'dairy'],
    retest: ['uricAcid'],
    retestWeeks: 8,
  },
  liver: {
    id: 'liver',
    title: say('Odciąż wątrobę', 'Ease the liver'),
    goal: say('ALT i GGTP w normie', 'ALT and GGT in range'),
    raise: [],
    favor: [
      say('Warzywa, pełne ziarno, ryby, oliwa — wzorzec śródziemnomorski', 'Vegetables, whole grains, fish, olive oil — the Mediterranean pattern'),
      say('Kawa bez cukru wiąże się z lepszymi wynikami wątroby', 'Coffee without sugar is linked to better liver results'),
    ],
    limit: [
      say('Alkohol', 'Alcohol'),
      say('Słodkie napoje, soki i słodycze (fruktoza)', 'Sweet drinks, juice and sweets (fructose)'),
    ],
    tips: [
      say('Przy stłuszczeniu wątroby spadek masy ciała o 7–10 % to najskuteczniejsze leczenie.', 'With fatty liver, losing 7–10 % of body weight is the most effective treatment.'),
      say('ALT i AST rosną po ciężkim treningu — kontrolne badanie zrób po kilku dniach przerwy.', 'ALT and AST rise after hard training — do the retest after a few days off.'),
    ],
    habits: ['noAlcohol', 'noSweetDrinks', 'veggiesHalf', 'movement'],
    retest: ['alt', 'ast', 'ggt'],
    retestWeeks: 12,
  },
  omega3: {
    id: 'omega3',
    title: say('Więcej omega-3', 'More omega-3'),
    goal: say('Indeks omega-3 co najmniej 8 %', 'Omega-3 index of 8 % or more'),
    raise: ['epaDha', 'ala'],
    limit: [],
    tips: [
      say('Tłusta ryba dwa razy w tygodniu daje zalecane 250 mg EPA i DHA dziennie.', 'Oily fish twice a week gives the recommended 250 mg of EPA and DHA a day.'),
      say('ALA z siemienia lnianego i orzechów włoskich zamienia się w EPA i DHA tylko w małej części.', 'ALA from linseed and walnuts turns into EPA and DHA only in small part.'),
    ],
    vegan: say(
      'Bez ryb EPA i DHA daje olej z alg (suplement). Siemię lniane i orzechy włoskie dają ALA, z którego organizm robi niewiele EPA i DHA.',
      'Without fish, algae oil (a supplement) gives EPA and DHA. Linseed and walnuts give ALA, which the body turns into little EPA and DHA.',
    ),
    habits: ['fattyFish', 'nuts'],
    retest: ['omega3'],
    retestWeeks: 16,
  },
  inflammation: {
    id: 'inflammation',
    title: say('Wycisz stan zapalny', 'Calm inflammation'),
    goal: say('hs-CRP poniżej 3 mg/l', 'hs-CRP under 3 mg/l'),
    raise: ['fiber', 'epaDha'],
    limit: [
      say('Przetworzone mięso, słodycze, słodkie napoje', 'Processed meat, sweets, sweet drinks'),
      say('Alkohol', 'Alcohol'),
    ],
    tips: [
      say('Wzorzec śródziemnomorski, spadek masy ciała, sen i ruch obniżają hs-CRP.', 'The Mediterranean pattern, weight loss, sleep and activity lower hs-CRP.'),
      say('Jedno badanie to za mało: hs-CRP powtarza się po 2 tygodniach, bez infekcji.', 'One test is not enough: hs-CRP is repeated after 2 weeks, without an infection.'),
    ],
    habits: ['fruitVeg', 'fattyFish', 'nuts', 'oilSwap'],
    retest: ['hsCrp'],
    retestWeeks: 12,
  },
  hydration: {
    id: 'hydration',
    title: say('Pij więcej', 'Drink more'),
    goal: say('Ciężar właściwy moczu poniżej 1,025', 'Urine specific gravity under 1.025'),
    raise: [],
    favor: [say('Woda, herbata bez cukru, zupy, warzywa i owoce', 'Water, unsweetened tea, soups, vegetables and fruit')],
    limit: [],
    tips: [say('Jasnosłomkowy mocz to dobry codzienny znak. W dni treningowe pij więcej.', 'Pale straw urine is a good daily sign. Drink more on training days.')],
    habits: ['water'],
    retest: ['uSg'],
    retestWeeks: 2,
  },
};

/** The habits of a focus that fit what the person eats. */
export function habitsFor(focus: FocusDef, eats: Eats): Habit[] {
  return focus.habits.map((id) => HABITS[id]).filter((h) => !h.eats || h.eats.includes(eats));
}
