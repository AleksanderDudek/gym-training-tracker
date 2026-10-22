// Every recipe passes its rule on TYPICAL values (catalog.test.ts), so it does
// not depend on a lucky product to be high-protein; each store's actual
// products are then checked again. Grams are for the WHOLE recipe: a pot of
// chili is cooked for three, and the card divides it into servings.

import { say } from '../../i18n';
import type { IngredientId } from './ingredients';
import { isProteinForward, type Macros } from './macros';

export type RecipeKind = 'gotowiec' | 'shake' | 'miska' | 'slone' | 'obiad' | 'mix';

export interface RecipeItem {
  ingredient: IngredientId;
  /** For the whole recipe, all of its servings together. */
  grams: number;
  /** A household measure, so nobody needs a scale for a shake. */
  measure?: string;
  /**
   * The amount is one pack of the chosen product ("1 baton" is the bar's own
   * weight: bars are 35-65 g, drinks 250-500 ml); `grams` is the typical pack,
   * used until a product with a readable size is known.
   */
  pack?: true;
}

export interface Recipe {
  id: string;
  name: string;
  kind: RecipeKind;
  minutes: number;
  tool: string;
  description: string;
  items: RecipeItem[];
  steps: string[];
  /** How many people it feeds; 1 when absent. Home cooking is often for two or for the week. */
  servings?: number;
  /**
   * The open cookbook page a classic was reworked from (title and https address); the card links it.
   * `lang` marks a title that is not Polish, so a screen reader reads it in its own language.
   */
  inspiredBy?: { title: string; url: string; lang?: string };
}

export function servingsOf(recipe: Recipe): number {
  return recipe.servings ?? 1;
}

export const KIND_LABELS: Record<RecipeKind, string> = {
  // Bought and eaten as it is: no cooking, no dishes.
  gotowiec: say('Gotowiec', 'Ready to eat'),
  mix: say('Szybki mix', 'Quick mix'),
  shake: say('Shake', 'Shake'),
  // Skyr bowls, puddings, pancakes and a baked cheesecake: what they share is
  // that they are sweet, not that they are eaten with a spoon.
  miska: say('Na słodko', 'Sweet'),
  slone: say('Na słono', 'Savoury'),
  obiad: say('Obiad', 'Dinner'),
};

/** The tool of a gotowiec: at most a spoon or a fork, straight from the pack. */
export const NO_DISHES = say('Bez naczyń', 'No dishes');

/**
 * Gotowce have their own rule. A no-dishes set is often a carbohydrate snack
 * with a protein part - the banana and the bar - and THE RULE (more protein
 * than carbs) would leave out exactly the sets people eat on the way. What
 * keeps them in a protein tab is a floor: a proper protein snack's worth.
 */
export const GOTOWIEC_MIN_PROTEIN = 15;

/** The rule a recipe is held to, per serving: THE RULE, or the gotowiec's protein floor. */
export function passesRule(recipe: Pick<Recipe, 'kind'>, serving: Macros): boolean {
  return recipe.kind === 'gotowiec' ? serving.protein >= GOTOWIEC_MIN_PROTEIN : isProteinForward(serving);
}

/**
 * Bought in one shop and eaten as they are: no cooking and no dishes, at most a
 * spoon or a fork from the pack. First in the catalog - at one minute they are
 * the quickest thing here.
 */
const GOTOWCE: Recipe[] = [
  {
    id: 'banan-baton',
    name: say('Banan i baton białkowy', 'Banana and a protein bar'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Szybkie węglowodany z banana i białko z batonu – przed treningiem albo w drodze.',
      'Quick carbs from the banana, protein from the bar – before training or on the go.',
    ),
    items: [
      { ingredient: 'banana', grams: 120, measure: say('1 banan', '1 banana') },
      { ingredient: 'proteinBar', grams: 45, measure: say('1 baton', '1 bar'), pack: true },
    ],
    steps: [say('Obierz banana, otwórz baton – i tyle.', "Peel the banana, open the bar – that's it.")],
  },
  {
    id: 'napoj-banan',
    name: say('Napój proteinowy i banan', 'Protein drink and a banana'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Butelka białka i owoc do ręki – śniadanie w biegu albo coś zaraz po treningu.',
      'A bottle of protein and a piece of fruit – breakfast on the run or something right after training.',
    ),
    items: [
      { ingredient: 'proteinDrink', grams: 250, measure: say('1 butelka', '1 bottle'), pack: true },
      { ingredient: 'banana', grams: 120, measure: say('1 banan', '1 banana') },
    ],
    steps: [
      say('Wstrząśnij butelkę i pij, banana zjedz obok.', 'Shake the bottle and drink; eat the banana alongside.'),
    ],
  },
  {
    id: 'skyr-borowki-kubek',
    name: say('Skyr z borówkami prosto z kubka', 'Skyr with blueberries straight from the pot'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Kubek białka i garść owoców, jedzone łyżeczką z opakowania.',
      'A pot of protein and a handful of fruit, eaten with a teaspoon from the pack.',
    ),
    items: [
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'blueberries', grams: 75, measure: say('garść świeżych', 'a handful, fresh') },
    ],
    steps: [
      say(
        'Wsyp borówki do kubka skyru i jedz łyżeczką.',
        'Tip the blueberries into the skyr pot and eat with a teaspoon.',
      ),
    ],
  },
  {
    id: 'serek-bulka',
    name: say('Serek wiejski z bułką grahamką', 'Cottage cheese with a wholemeal roll'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Klasyk z osiedlowego sklepu: ponad 25 g białka i coś do pogryzienia.',
      'A corner-shop classic: over 25 g of protein and something to chew on.',
    ),
    items: [
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 pack') },
      { ingredient: 'roll', grams: 60, measure: say('1 bułka', '1 roll') },
    ],
    steps: [
      say(
        'Otwórz serek i jedz łyżeczką, zagryzając bułką.',
        'Open the cottage cheese and eat it with a teaspoon, taking bites of the roll.',
      ),
    ],
  },
  {
    id: 'serek-pomidorki',
    name: say('Serek wiejski z pomidorkami koktajlowymi', 'Cottage cheese with cherry tomatoes'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Na słono i bez noża: pomidorki koktajlowe je się w całości.',
      'Savoury and no knife needed: cherry tomatoes are eaten whole.',
    ),
    items: [
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 pack') },
      {
        ingredient: 'tomato',
        grams: 150,
        measure: say('garść pomidorków koktajlowych', 'a handful of cherry tomatoes'),
      },
    ],
    steps: [
      say(
        'Opłucz pomidorki i jedz na zmianę z serkiem.',
        'Rinse the tomatoes and eat them in turns with the cottage cheese.',
      ),
    ],
  },
  {
    id: 'jogurt-jablko',
    name: say('Jogurt proteinowy i jabłko', 'Protein yoghurt and an apple'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Słodka przekąska do torby: kubek z łyżeczką i owoc.',
      'A sweet snack for your bag: a pot, a teaspoon and a piece of fruit.',
    ),
    items: [
      { ingredient: 'proteinYogurt', grams: 200, measure: say('1 kubek', '1 pot') },
      { ingredient: 'apple', grams: 150, measure: say('1 jabłko', '1 apple') },
    ],
    steps: [
      say(
        'Jogurt jedz łyżeczką z kubka, jabłko obok.',
        'Eat the yoghurt from the pot with a teaspoon, the apple alongside.',
      ),
    ],
  },
  {
    id: 'kurczak-wafle',
    name: say('Kurczak w plastrach na waflach ryżowych', 'Sliced chicken on rice cakes'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Chuda wędlina z piersi na chrupiących waflach – kanapki bez talerza i bez noża.',
      'Lean sliced breast on crunchy rice cakes – sandwiches with no plate and no knife.',
    ),
    items: [
      { ingredient: 'chicken', grams: 100, measure: say('1 opakowanie plastrów', '1 pack of slices') },
      { ingredient: 'riceCakes', grams: 30, measure: say('3 wafle', '3 rice cakes') },
    ],
    steps: [
      say(
        'Połóż plastry na waflach i jedz jak kanapki.',
        'Lay the slices on the rice cakes and eat them like sandwiches.',
      ),
    ],
  },
  {
    id: 'losos-pieczywo',
    name: say('Łosoś wędzony na pieczywie chrupkim', 'Smoked salmon on crispbread'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Ponad 20 g białka i tłuszcze z ryby – kolacja, po której nie ma czego zmywać.',
      'Over 20 g of protein and the good fats of fish – a supper with no washing-up.',
    ),
    items: [
      { ingredient: 'smokedSalmon', grams: 100, measure: say('1 opakowanie', '1 pack') },
      { ingredient: 'crispbread', grams: 30, measure: say('3 kromki', '3 slices') },
    ],
    steps: [say('Rozłóż plastry łososia na kromkach.', 'Lay the salmon slices on the crispbread.')],
  },
  {
    id: 'tunczyk-wafle',
    name: say('Tuńczyk z puszki z waflami ryżowymi', 'Tinned tuna with rice cakes'),
    kind: 'gotowiec',
    minutes: 2,
    tool: NO_DISHES,
    description: say(
      'Puszka z otwieraczem i paczka wafli – białkowy obiad w podróży.',
      'A ring-pull tin and a pack of rice cakes – a protein lunch on the road.',
    ),
    items: [
      { ingredient: 'tuna', grams: 120, measure: say('1 puszka, odsączona', '1 tin, drained') },
      { ingredient: 'riceCakes', grams: 30, measure: say('3 wafle', '3 rice cakes') },
    ],
    steps: [
      say('Otwórz puszkę i odlej zalewę.', 'Open the tin and pour off the liquid.'),
      say('Nakładaj tuńczyka widelcem na wafle.', 'Fork the tuna onto the rice cakes.'),
    ],
  },
  {
    id: 'baton-napoj',
    name: say('Baton białkowy i napój proteinowy', 'Protein bar and a protein drink'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Najwięcej białka bez gotowania – po treningu, gdy do domu daleko.',
      'The most protein with no cooking – after training, when home is far away.',
    ),
    items: [
      { ingredient: 'proteinBar', grams: 45, measure: say('1 baton', '1 bar'), pack: true },
      { ingredient: 'proteinDrink', grams: 250, measure: say('1 butelka', '1 bottle'), pack: true },
    ],
    steps: [say('Wypij napój, zjedz baton.', 'Drink the drink, eat the bar.')],
  },
  {
    id: 'kefir-bulka',
    name: say('Kefir z bułką grahamką', 'Kefir with a wholemeal roll'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Śniadanie w drodze po polsku: chłodny kefir z butelki i bułka.',
      'A Polish breakfast on the go: cold kefir from the bottle and a roll.',
    ),
    items: [
      { ingredient: 'kefir', grams: 400, measure: say('1 butelka', '1 bottle') },
      { ingredient: 'roll', grams: 60, measure: say('1 bułka', '1 roll') },
    ],
    steps: [say('Pij kefir z butelki, zagryzaj bułką.', 'Drink the kefir from the bottle, taking bites of the roll.')],
  },
];

/**
 * Made with products that are usually ordered online (src/food/online): protein mixes, keto
 * bread and pasta, plant-based "meat". Each still meets its rule on typical values; where it is
 * bought - a shop, a shop and an online order, or two orders - is decided by the baskets.
 */
const FROM_ONLINE_SHOPS: Recipe[] = [
  {
    id: 'kabanosy-roslinne-serek',
    name: say('Roślinne kabanosy i serek wiejski', 'Plant-based kabanos and cottage cheese'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Roślinne kabanosy mają tyle białka co mięsne, a serek dokłada drugie tyle – bez gotowania.',
      'Plant-based kabanos sticks have as much protein as meat ones, and the cottage cheese adds as much again – no cooking.',
    ),
    items: [
      { ingredient: 'plantDeli', grams: 80, measure: say('pół opakowania kabanosów', 'half a pack of kabanos') },
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 pack') },
    ],
    steps: [
      say(
        'Jedz kabanosy na zmianę z serkiem prosto z opakowania.',
        'Eat the kabanos in turns with the cottage cheese, straight from the pack.',
      ),
    ],
  },
  {
    id: 'chipsy-bialkowe-napoj',
    name: say('Chipsy białkowe i napój proteinowy', 'Protein crisps and a protein drink'),
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: say(
      'Słona przekąska z białkiem zamiast zwykłych chipsów, do tego butelka białka.',
      'A salty snack with protein instead of ordinary crisps, plus a bottle of protein.',
    ),
    items: [
      { ingredient: 'proteinCrisps', grams: 30, measure: say('1 paczka', '1 bag'), pack: true },
      { ingredient: 'proteinDrink', grams: 250, measure: say('1 butelka', '1 bottle'), pack: true },
    ],
    steps: [say('Otwórz paczkę i butelkę – i tyle.', "Open the bag and the bottle – that's it.")],
  },
  {
    id: 'jogurt-maslo-w-proszku',
    name: say('Jogurt proteinowy z masłem orzechowym w proszku', 'Protein yoghurt with peanut butter powder'),
    kind: 'miska',
    minutes: 2,
    tool: say('Łyżka', 'Spoon'),
    description: say(
      'Smak masła orzechowego za ułamek jego tłuszczu: proszek ma białka jak odżywka.',
      'The taste of peanut butter for a fraction of its fat: the powder has as much protein as a protein supplement.',
    ),
    items: [
      { ingredient: 'proteinYogurt', grams: 200, measure: say('1 kubek', '1 pot') },
      { ingredient: 'peanutPowder', grams: 15, measure: say('1 czubata łyżka', '1 heaped tbsp') },
      { ingredient: 'raspberries', grams: 50, measure: say('pół garści', 'half a handful') },
    ],
    steps: [
      say('Wmieszaj proszek w jogurt na gładki krem.', 'Stir the powder into the yoghurt until smooth and creamy.'),
      say('Posyp malinami.', 'Top with raspberries.'),
    ],
  },
  {
    id: 'ciasto-w-kubku',
    name: say('Białkowe ciasto w kubku', 'Protein mug cake'),
    kind: 'miska',
    minutes: 3,
    tool: say('Kubek i mikrofala', 'Mug and microwave'),
    description: say(
      'Ciepłe ciasto w półtorej minuty: mieszanka, odrobina mleka i mikrofala.',
      'Warm cake in a minute and a half: the mix, a splash of milk and the microwave.',
    ),
    items: [
      { ingredient: 'mugCake', grams: 40, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'milk', grams: 60, measure: say('4 łyżki', '4 tbsp') },
    ],
    steps: [
      say(
        'Wymieszaj w dużym kubku mieszankę z mlekiem na gęste ciasto bez grudek.',
        'In a large mug, mix the powder with the milk into a thick, smooth batter.',
      ),
      say(
        'Piecz w mikrofali 60–90 sekund na pełnej mocy – ma zostać lekko wilgotne w środku.',
        'Microwave on full power for 60–90 seconds – it should stay slightly moist in the middle.',
      ),
    ],
  },
  {
    id: 'shake-roslinny-banan',
    name: say(
      'Wegański shake z białkiem roślinnym, bananem i kakao',
      'Vegan shake with plant protein, banana and cocoa',
    ),
    kind: 'shake',
    minutes: 3,
    tool: say('Blender lub shaker', 'Blender or shaker'),
    description: say(
      'Bez nabiału: białko z grochu, ryżu albo pestek dyni, banan dla smaku i kakao.',
      'Dairy-free: pea, rice or pumpkin seed protein, a banana for flavour, and cocoa.',
    ),
    items: [
      { ingredient: 'plantProtein', grams: 40, measure: say('1,5 miarki', '1.5 scoops') },
      { ingredient: 'banana', grams: 100, measure: say('mały banan', 'a small banana') },
      { ingredient: 'cocoa', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'water', grams: 300, measure: say('1,5 szklanki zimnej wody', '1.5 cups of cold water') },
    ],
    steps: [
      say('Zmiksuj wszystko przez 30 sekund.', 'Blend everything for 30 seconds.'),
      say(
        'W shakerze: banana rozgnieć widelcem albo zjedz obok.',
        'In a shaker: mash the banana with a fork or eat it alongside.',
      ),
    ],
  },
  {
    id: 'skyr-maliny-syrop-zero',
    name: say('Skyr z malinami i syropem zero', 'Skyr with raspberries and zero syrup'),
    kind: 'miska',
    minutes: 2,
    tool: say('Łyżka', 'Spoon'),
    description: say(
      'Deser z ponad 20 g białka: syrop bez cukru daje smak karmelu czy wanilii za 1 kcal.',
      'A dessert with over 20 g of protein: sugar-free syrup gives a caramel or vanilla taste for 1 kcal.',
    ),
    items: [
      { ingredient: 'skyr', grams: 200, measure: say('duży kubek', 'a large pot') },
      { ingredient: 'raspberries', grams: 80, measure: say('garść', 'a handful') },
      { ingredient: 'zeroSyrup', grams: 15, measure: say('1 łyżka', '1 tbsp') },
    ],
    steps: [
      say('Przełóż skyr do miseczki albo jedz z kubka.', 'Spoon the skyr into a bowl or eat it from the pot.'),
      say('Dodaj maliny i polej syropem.', 'Add the raspberries and drizzle with the syrup.'),
    ],
  },
  {
    id: 'kurczak-chili-ryz-konjac',
    name: say(
      'Kurczak w sosie słodkie chili zero z ryżem konjac',
      'Chicken in zero sweet chilli sauce with konjac rice',
    ),
    kind: 'obiad',
    minutes: 15,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Smak słodko-ostrego dania z chińskiej budki: sos bez cukru, ryż konjac prawie bez kalorii.',
      'The taste of a sweet-and-spicy takeaway: sugar-free sauce and konjac rice with almost no calories.',
    ),
    items: [
      {
        ingredient: 'konjac',
        grams: 200,
        measure: say('1 opakowanie ryżu konjac, odsączone', '1 pack of konjac rice, drained'),
      },
      { ingredient: 'chickenFillet', grams: 150, measure: say('1 mały filet', '1 small fillet') },
      { ingredient: 'pepper', grams: 100, measure: say('1 mała papryka', '1 small pepper') },
      { ingredient: 'zeroSauce', grams: 40, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
    ],
    steps: [
      say(
        'Przepłucz ryż konjac i podsmaż go 2 minuty na suchej patelni.',
        'Rinse the konjac rice and fry it in a dry pan for 2 minutes.',
      ),
      say(
        'Na oleju usmaż pokrojonego kurczaka z papryką, aż się zrumieni.',
        'Fry the chopped chicken and pepper in the oil until browned.',
      ),
      say(
        'Dodaj sos, wymieszaj z ryżem i podgrzej jeszcze minutę.',
        'Add the sauce, mix with the rice and heat for another minute.',
      ),
    ],
  },
  {
    id: 'tosty-szynka-roslinna',
    name: say('Tosty białkowe z roślinną szynką i pomidorem', 'Protein toast with plant-based ham and tomato'),
    kind: 'slone',
    minutes: 6,
    tool: say('Toster lub patelnia', 'Toaster or frying pan'),
    description: say(
      'Chleb keto ma trzy razy więcej białka niż zwykły – z roślinną szynką to ponad 40 g na talerz.',
      'Keto bread has three times the protein of ordinary bread – with plant-based ham that is over 40 g a plate.',
    ),
    items: [
      { ingredient: 'proteinBread', grams: 80, measure: say('3 kromki', '3 slices') },
      { ingredient: 'plantDeli', grams: 60, measure: say('pół opakowania', 'half a pack') },
      { ingredient: 'tomato', grams: 100, measure: say('1 pomidor', '1 tomato') },
    ],
    steps: [
      say('Opiecz kromki w tosterze albo na suchej patelni.', 'Toast the slices in a toaster or a dry pan.'),
      say(
        'Połóż szynkę i plastry pomidora, dopraw pieprzem.',
        'Top with the ham and tomato slices and season with pepper.',
      ),
    ],
  },
  {
    id: 'tosty-twarozek-rzodkiewka',
    name: say('Tosty białkowe z twarożkiem i rzodkiewką', 'Protein toast with quark spread and radish'),
    kind: 'slone',
    minutes: 5,
    tool: say('Toster i miska', 'Toaster and bowl'),
    description: say(
      'Klasyczny twarożek ze szczypiorkiem na chlebie, który sam ma 29 g białka w 100 g.',
      'Classic quark and chive spread on a bread that has 29 g of protein per 100 g on its own.',
    ),
    items: [
      { ingredient: 'proteinBread', grams: 80, measure: say('3 kromki', '3 slices') },
      { ingredient: 'quark', grams: 150, measure: say('pół kostki', 'half a pack') },
      { ingredient: 'radish', grams: 50, measure: say('4 rzodkiewki', '4 radishes') },
      { ingredient: 'chives', grams: 5, measure: say('kilka źdźbeł', 'a few stems') },
    ],
    steps: [
      say(
        'Rozgnieć twaróg z odrobiną wody, wymieszaj z posiekanym szczypiorkiem, dopraw solą i pieprzem.',
        'Mash the quark with a splash of water, mix in the chopped chives and season with salt and pepper.',
      ),
      say(
        'Opiecz kromki, posmaruj twarożkiem i połóż plasterki rzodkiewki.',
        'Toast the slices, spread with the quark and top with sliced radish.',
      ),
    ],
  },
  {
    id: 'nalesniki-bialkowe-mieszanka',
    name: say(
      'Białkowe naleśniki z mieszanki ze skyrem i borówkami',
      'Protein pancakes from a mix with skyr and blueberries',
    ),
    kind: 'miska',
    minutes: 12,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Naleśniki, które same są białkowe – mieszanka ma ponad połowę białka. Skyr zamiast bitej śmietany.',
      'Pancakes that are high-protein in themselves – the mix is over half protein. Skyr instead of whipped cream.',
    ),
    items: [
      { ingredient: 'proteinPancakeMix', grams: 50, measure: say('5 łyżek', '5 tbsp') },
      { ingredient: 'milk', grams: 100, measure: say('pół szklanki', 'half a cup') },
      { ingredient: 'skyr', grams: 100, measure: say('pół kubka', 'half a pot') },
      { ingredient: 'blueberries', grams: 50, measure: say('pół garści', 'half a handful') },
    ],
    steps: [
      say(
        'Wymieszaj mieszankę z mlekiem na gładkie ciasto i odstaw na 2 minuty.',
        'Mix the powder with the milk into a smooth batter and leave for 2 minutes.',
      ),
      say(
        'Smaż małe placki na lekko natłuszczonej patelni po 1–2 minuty z każdej strony.',
        'Fry small pancakes in a lightly greased pan for 1–2 minutes on each side.',
      ),
      say('Podawaj ze skyrem i borówkami.', 'Serve with skyr and blueberries.'),
    ],
  },
  {
    id: 'wrap-keto-kebab',
    name: say('Wrap keto z roślinnym kebabem i warzywami', 'Keto wrap with plant-based kebab and vegetables'),
    kind: 'slone',
    minutes: 10,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Kebab bez mięsa w niskowęglowodanowej tortilli – więcej białka niż tłuszczu, mimo sosu.',
      'A meat-free kebab in a low-carb tortilla – more protein than fat, even with the sauce.',
    ),
    items: [
      { ingredient: 'ketoTortilla', grams: 40, measure: say('1 placek', '1 wrap') },
      { ingredient: 'plantMeat', grams: 80, measure: say('pół opakowania', 'half a pack') },
      { ingredient: 'tomato', grams: 60, measure: say('pół pomidora', 'half a tomato') },
      { ingredient: 'cucumber', grams: 60, measure: say('kawałek ogórka', 'a piece of cucumber') },
    ],
    steps: [
      say(
        'Podsmaż roślinny kebab na suchej patelni 3–4 minuty, aż się zrumieni.',
        'Fry the plant-based kebab in a dry pan for 3–4 minutes until browned.',
      ),
      say('Ogrzej tortillę 20 sekund na tej samej patelni.', 'Warm the tortilla in the same pan for 20 seconds.'),
      say('Ułóż kebab i pokrojone warzywa, zawiń.', 'Add the kebab and chopped vegetables and roll it up.'),
    ],
  },
  {
    id: 'konjac-kurczak-pomidory',
    name: say('Makaron konjac z kurczakiem w sosie pomidorowym', 'Konjac noodles with chicken in tomato sauce'),
    kind: 'obiad',
    minutes: 15,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Talerz makaronu za kilkanaście kalorii: konjac ma ich prawie zero, białko daje kurczak.',
      'A plate of noodles for a dozen or so calories: konjac has almost none, and the chicken brings the protein.',
    ),
    items: [
      { ingredient: 'konjac', grams: 200, measure: say('1 opakowanie, odsączone', '1 pack, drained') },
      { ingredient: 'chickenFillet', grams: 150, measure: say('1 mały filet', '1 small fillet') },
      { ingredient: 'passata', grams: 150, measure: say('3/4 szklanki', '3/4 cup') },
      { ingredient: 'garlic', grams: 5, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'parmesan', grams: 10, measure: say('1 łyżka tartego', '1 tbsp, grated') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
    ],
    steps: [
      say(
        'Przepłucz konjac pod zimną wodą i podsmaż go 2 minuty na suchej patelni, żeby odparował.',
        'Rinse the konjac under cold water and fry it in a dry pan for 2 minutes to dry it out.',
      ),
      say(
        'Na oleju zrumień pokrojonego kurczaka z czosnkiem, wlej passatę i duś 5 minut.',
        'Brown the chopped chicken with the garlic in the oil, pour in the passata and simmer for 5 minutes.',
      ),
      say('Wymieszaj z makaronem, posyp parmezanem.', 'Toss with the noodles and sprinkle with parmesan.'),
    ],
  },
  {
    id: 'keto-penne-boczek',
    name: say('Keto penne z roślinnym boczkiem i pomidorami', 'Keto penne with plant-based bacon and tomatoes'),
    kind: 'obiad',
    minutes: 15,
    tool: say('Garnek i patelnia', 'Pot and frying pan'),
    description: say(
      'Makaron, który ma 36 g białka w 100 g, i boczek bez mięsa – obiad z ponad 50 g białka.',
      'Pasta with 36 g of protein per 100 g and meat-free bacon – a dinner with over 50 g of protein.',
    ),
    items: [
      { ingredient: 'ketoPasta', grams: 80, measure: say('1/3 opakowania', '1/3 of a pack') },
      { ingredient: 'plantDeli', grams: 100, measure: say('1 opakowanie boczku', '1 pack of bacon') },
      { ingredient: 'cannedTomatoes', grams: 200, measure: say('pół puszki', 'half a tin') },
      { ingredient: 'onion', grams: 50, measure: say('pół cebuli', 'half an onion') },
      { ingredient: 'garlic', grams: 5, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
    ],
    steps: [
      say('Ugotuj makaron według opakowania.', 'Cook the pasta as the pack says.'),
      say(
        'Na oleju zeszklij cebulę z czosnkiem, dodaj pokrojony boczek i smaż 2 minuty.',
        'Soften the onion and garlic in the oil, add the chopped bacon and fry for 2 minutes.',
      ),
      say(
        'Wlej pomidory, duś 5 minut, wymieszaj z makaronem.',
        'Pour in the tomatoes, simmer for 5 minutes and toss with the pasta.',
      ),
    ],
  },
  {
    id: 'pizza-keto-pepperoni',
    name: say('Pizza na keto spodzie z roślinnym pepperoni', 'Keto-base pizza with plant-based pepperoni'),
    kind: 'obiad',
    minutes: 15,
    tool: say('Piekarnik', 'Oven'),
    description: say(
      'Gotowy spód keto, passata, pepperoni bez mięsa i parmezan – pizza, w której białko wygrywa.',
      'A ready keto base, passata, meat-free pepperoni and parmesan – a pizza where protein wins.',
    ),
    items: [
      { ingredient: 'ketoPizzaBase', grams: 100, measure: say('1 spód', '1 base') },
      { ingredient: 'plantDeli', grams: 60, measure: say('pół opakowania pepperoni', 'half a pack of pepperoni') },
      { ingredient: 'passata', grams: 60, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'parmesan', grams: 15, measure: say('1,5 łyżki tartego', '1.5 tbsp, grated') },
    ],
    steps: [
      say('Rozgrzej piekarnik do 220°C.', 'Heat the oven to 220°C.'),
      say(
        'Posmaruj spód passatą, ułóż pepperoni i posyp parmezanem.',
        'Spread the base with passata, add the pepperoni and sprinkle with parmesan.',
      ),
      say('Piecz 8–10 minut, aż brzegi się zrumienią.', 'Bake for 8–10 minutes until the edges are golden.'),
    ],
  },
];

/** A Wikibooks cookbook page a classic was reworked from; a title in another language than Polish says so. */
function wikibooks(title: string, url: string): NonNullable<Recipe['inspiredBy']> {
  const lang = new URL(url).hostname.split('.')[0]!;
  return lang === 'pl' ? { title, url } : { title, url, lang };
}

/**
 * Polish classics reworked to be high-protein, inspired by the open cookbook on Wikibooks
 * („Książka kucharska”, CC BY-SA 4.0): the dish and its idea from there, the amounts, the swaps
 * (skyr for sour cream, turkey for pork, lean quark, no sugar) and the text written here. Each card
 * links the page it started from.
 */
const CLASSICS: Recipe[] = [
  {
    id: 'pyry-z-gzikiem',
    name: say('Pyry z gzikiem', 'Pyry z gzikiem (potatoes with herby quark)'),
    kind: 'obiad',
    minutes: 30,
    servings: 2,
    tool: say('Garnek', 'Pot'),
    description: say(
      'Wielkopolska klasyka: ziemniaki w mundurkach i gzik – chudy twaróg rozrobiony skyrem zamiast śmietany, z rzodkiewką, cebulką i szczypiorem.',
      'A Greater Poland classic: jacket potatoes and gzik – low-fat quark loosened with skyr instead of sour cream, with radish, onion and chives.',
    ),
    inspiredBy: wikibooks('Gzik', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Gzik'),
    items: [
      { ingredient: 'potato', grams: 350, measure: say('3–4 ziemniaki', '3–4 potatoes') },
      { ingredient: 'quark', grams: 400, measure: say('2 kostki', '2 packs') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'radish', grams: 100, measure: say('pęczek', 'a bunch') },
      { ingredient: 'chives', grams: 15, measure: say('pół pęczka', 'half a bunch') },
      { ingredient: 'onion', grams: 40, measure: say('pół małej cebuli', 'half a small onion') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Wyszoruj ziemniaki i ugotuj w mundurkach w osolonej wodzie, ok. 20 minut.',
        'Scrub the potatoes and boil them in their skins in salted water, about 20 minutes.',
      ),
      say(
        'W tym czasie rozgnieć twaróg widelcem ze skyrem na gładki gzik. Dodaj drobno pokrojoną cebulę, rzodkiewkę i szczypiorek, dopraw solą i pieprzem.',
        'Meanwhile, mash the quark with the skyr using a fork until smooth. Add the finely chopped onion, radish and chives, and season with salt and pepper.',
      ),
      say(
        'Podawaj gorące pyry, przekrojone na pół, z dużą porcją gziku.',
        'Serve the hot potatoes halved, with a generous helping of gzik.',
      ),
    ],
  },
  {
    id: 'leniwe-z-twarogu',
    name: say('Leniwe z chudego twarogu ze skyrem', 'Leniwe (lazy quark dumplings) with skyr'),
    kind: 'miska',
    minutes: 35,
    servings: 2,
    tool: say('Miska i duży garnek', 'Bowl and large pot'),
    description: say(
      'Leniwe jak u babci, tylko z chudego twarogu i z mniejszą ilością mąki. Podane ze skyrem i cynamonem zamiast masła z bułką tartą.',
      "Lazy dumplings like Grandma's, only with low-fat quark and less flour. Served with skyr and cinnamon instead of butter and breadcrumbs.",
    ),
    inspiredBy: wikibooks('Leniwe pierogi', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Leniwe_pierogi'),
    items: [
      { ingredient: 'quark', grams: 500, measure: say('2 i pół kostki', '2½ packs') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'flour', grams: 120, measure: say('3/4 szklanki', '3/4 cup') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'cinnamon', grams: 2, measure: say('szczypta', 'a pinch') },
      { ingredient: 'saltPepper', grams: 1, measure: say('szczypta soli', 'a pinch of salt') },
    ],
    steps: [
      say(
        'Zmiel albo dokładnie rozgnieć twaróg, wbij jajka, dodaj szczyptę soli i mąkę. Zagnieć krótko – im krócej, tym leniwe delikatniejsze. Jeśli ciasto klei się do rąk, dosyp łyżkę mąki.',
        'Mince or thoroughly mash the quark, crack in the eggs, add a pinch of salt and the flour. Knead briefly – the shorter, the lighter the dumplings. If the dough sticks to your hands, add a spoonful of flour.',
      ),
      say(
        'Podziel ciasto na 3–4 części, z każdej uformuj wałek grubości kciuka, lekko spłaszcz i pokrój ukośnie na kluski.',
        'Divide the dough into 3–4 pieces, roll each into a thumb-thick log, flatten slightly and cut diagonally into dumplings.',
      ),
      say(
        'Wrzucaj partiami do osolonego wrzątku, a gdy wypłyną, gotuj jeszcze 2 minuty. Wyjmuj łyżką cedzakową.',
        'Drop them in batches into salted boiling water and, once they float, cook for 2 more minutes. Lift out with a slotted spoon.',
      ),
      say('Podawaj ze skyrem i cynamonem.', 'Serve with skyr and cinnamon.'),
    ],
  },
  {
    id: 'ryba-po-grecku',
    name: say('Ryba po grecku z dorszem', 'Ryba po grecku (cod under carrot and tomato)'),
    kind: 'obiad',
    minutes: 50,
    servings: 3,
    tool: say('Patelnia i garnek', 'Frying pan and pot'),
    description: say(
      'Świąteczna klasyka na co dzień: pieczony dorsz albo mintaj pod warstwą marchwi i cebuli duszonych w passacie – bez smażenia w panierce.',
      'A Christmas classic for every day: baked cod or pollock under a layer of carrot and onion stewed in passata – no frying in batter.',
    ),
    inspiredBy: wikibooks('Ryba po grecku', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Ryba_po_grecku'),
    items: [
      { ingredient: 'whiteFish', grams: 600, measure: say('600 g filetów', '600 g of fillets') },
      { ingredient: 'carrot', grams: 300, measure: say('3 marchewki', '3 carrots') },
      { ingredient: 'onion', grams: 150, measure: say('1 duża cebula', '1 large onion') },
      { ingredient: 'passata', grams: 300, measure: say('300 g', '300 g') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      {
        ingredient: 'spices',
        grams: 4,
        measure: say('liść laurowy, 3 ziela angielskie, papryka słodka', 'bay leaf, 3 allspice berries, sweet paprika'),
      },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Nagrzej piekarnik do 200°C. Filety osusz, dopraw solą i pieprzem, ułóż w naczyniu żaroodpornym i piecz 12–15 minut.',
        'Heat the oven to 200°C. Pat the fillets dry, season with salt and pepper, lay them in an ovenproof dish and bake for 12–15 minutes.',
      ),
      say(
        'W tym czasie zetrzyj marchew na grubych oczkach, cebulę pokrój w piórka i zeszklij na oleju. Dodaj marchew, liść laurowy i ziele angielskie i duś pod przykryciem 10 minut.',
        'Meanwhile, coarsely grate the carrots, slice the onion thinly and soften it in the oil. Add the carrots, bay leaf and allspice, cover and simmer for 10 minutes.',
      ),
      say(
        'Wlej passatę, dopraw papryką, solą i pieprzem i duś jeszcze 5 minut.',
        'Pour in the passata, season with paprika, salt and pepper and simmer for 5 more minutes.',
      ),
      say(
        'Przykryj rybę warzywami. Najlepsza po schłodzeniu, ale ciepła też smakuje.',
        'Cover the fish with the vegetables. Best chilled, but good warm too.',
      ),
    ],
  },
  {
    id: 'bigos-z-indykiem',
    name: say('Bigos z indykiem i pieczarkami', "Bigos (hunter's stew) with turkey and mushrooms"),
    kind: 'obiad',
    minutes: 100,
    servings: 4,
    tool: say('Duży garnek z grubym dnem', 'Large heavy-based pot'),
    description: say(
      'Bigos z kiszonej i świeżej kapusty, z chudym indykiem zamiast boczku i kiełbasy. Dusi się długo, ale sam – a na drugi dzień jest jeszcze lepszy.',
      'Bigos of sauerkraut and fresh cabbage, with lean turkey instead of bacon and sausage. It stews for a long time, but on its own – and it is even better the next day.',
    ),
    inspiredBy: wikibooks('Bigos', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Bigos'),
    items: [
      { ingredient: 'turkeyFillet', grams: 600, measure: say('600 g piersi', '600 g of breast') },
      { ingredient: 'sauerkraut', grams: 600, measure: say('600 g', '600 g') },
      { ingredient: 'whiteCabbage', grams: 400, measure: say('ćwierć główki', 'a quarter of a head') },
      { ingredient: 'mushrooms', grams: 300, measure: say('1 opakowanie', '1 pack') },
      { ingredient: 'onion', grams: 150, measure: say('1 duża cebula', '1 large onion') },
      { ingredient: 'passata', grams: 200, measure: say('200 g', '200 g') },
      {
        ingredient: 'spices',
        grams: 6,
        measure: say(
          'liść laurowy, ziele angielskie, majeranek, papryka wędzona',
          'bay leaf, allspice, marjoram, smoked paprika',
        ),
      },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'water', grams: 300, measure: say('półtorej szklanki', '1½ cups') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Kapustę kiszoną odciśnij i posiekaj, świeżą poszatkuj. Włóż obie do garnka z wodą, liściem laurowym i zielem angielskim i gotuj pod przykryciem 30 minut.',
        'Squeeze and chop the sauerkraut, shred the fresh cabbage. Put both in the pot with the water, bay leaf and allspice, cover and cook for 30 minutes.',
      ),
      say(
        'Indyka pokrój w kostkę i obsmaż na połowie oleju. Na reszcie podsmaż cebulę i pokrojone pieczarki.',
        'Dice the turkey and brown it in half the oil. Fry the onion and sliced mushrooms in the rest.',
      ),
      say(
        'Dodaj mięso, cebulę i pieczarki do kapusty, wlej passatę, dodaj majeranek i paprykę i duś na małym ogniu jeszcze godzinę, mieszając co jakiś czas.',
        'Add the meat, onion and mushrooms to the cabbage, pour in the passata, add the marjoram and paprika and simmer over a low heat for another hour, stirring now and then.',
      ),
      say(
        'Dopraw solą i pieprzem. Odgrzewany następnego dnia jest najlepszy.',
        'Season with salt and pepper. Reheated the next day, it is at its best.',
      ),
    ],
  },
  {
    id: 'ogorkowa-z-kurczakiem',
    name: say('Zupa ogórkowa z kurczakiem', 'Sour gherkin soup with chicken'),
    kind: 'obiad',
    minutes: 50,
    servings: 4,
    tool: say('Duży garnek', 'Large pot'),
    description: say(
      'Ogórkowa na wywarze z piersi kurczaka, z ziemniakami i marchewką, zabielona skyrem zamiast śmietany. Mięso zostaje w zupie – to ono daje białko.',
      'Gherkin soup on a chicken breast stock, with potatoes and carrot, finished with skyr instead of cream. The meat stays in the soup – it is what brings the protein.',
    ),
    // i18n-ignore: the linked cookbook page's own (Polish) title
    inspiredBy: wikibooks('Zupa ogórkowa', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Zupa_og%C3%B3rkowa'),
    items: [
      { ingredient: 'chickenFillet', grams: 500, measure: say('2 piersi', '2 breasts') },
      { ingredient: 'brinedCucumber', grams: 400, measure: say('5–6 ogórków', '5–6 gherkins') },
      { ingredient: 'potato', grams: 300, measure: say('3 ziemniaki', '3 potatoes') },
      { ingredient: 'carrot', grams: 200, measure: say('2 marchewki', '2 carrots') },
      { ingredient: 'skyr', grams: 200, measure: say('1 kubek', '1 pot') },
      { ingredient: 'dill', grams: 15, measure: say('pół pęczka', 'half a bunch') },
      { ingredient: 'water', grams: 1500, measure: say('1,5 litra', '1.5 litres') },
      {
        ingredient: 'spices',
        grams: 3,
        measure: say('liść laurowy i 3 ziela angielskie', 'bay leaf and 3 allspice berries'),
      },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Piersi zalej zimną wodą, dodaj liść laurowy i ziele angielskie i gotuj na małym ogniu 20 minut. Wyjmij mięso i pokrój w kostkę.',
        'Cover the breasts with cold water, add the bay leaf and allspice and simmer over a low heat for 20 minutes. Lift out the meat and dice it.',
      ),
      say(
        'Do wywaru wrzuć pokrojone ziemniaki i startą marchew i gotuj 10 minut. Dodaj starte ogórki kiszone i gotuj jeszcze 10 minut.',
        'Add the diced potatoes and grated carrot to the stock and cook for 10 minutes. Add the grated gherkins and cook for 10 more minutes.',
      ),
      say(
        'Zdejmij garnek z ognia. Skyr wymieszaj z chochlą zupy i dopiero wtedy wlej do garnka – nie zwarzy się.',
        'Take the pot off the heat. Mix the skyr with a ladle of soup and only then pour it into the pot – it will not curdle.',
      ),
      say(
        'Dodaj mięso i koperek. Dopraw pieprzem, a solą ostrożnie, bo ogórki są słone.',
        'Add the meat and dill. Season with pepper, and go easy on the salt – the gherkins are salty.',
      ),
    ],
  },
  {
    id: 'potrawka-z-kurczaka',
    name: say('Potrawka z kurczaka z marchewką i pieczarkami', 'Chicken fricassee with carrots and mushrooms'),
    kind: 'obiad',
    minutes: 40,
    servings: 3,
    tool: say('Garnek z pokrywką', 'Pot with a lid'),
    description: say(
      'Domowa potrawka w jasnym sosie: kurczak duszony z marchewką i pieczarkami, sos zagęszczony skyrem i odrobiną mąki ziemniaczanej, a nie śmietaną z masłem.',
      'A home-style fricassee in a pale sauce: chicken braised with carrots and mushrooms, the sauce thickened with skyr and a little potato starch rather than cream and butter.',
    ),
    inspiredBy: wikibooks('Kurczak w potrawce', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Kurczak_w_potrawce'),
    items: [
      { ingredient: 'chickenFillet', grams: 600, measure: say('2–3 piersi', '2–3 breasts') },
      { ingredient: 'carrot', grams: 250, measure: say('2–3 marchewki', '2–3 carrots') },
      { ingredient: 'mushrooms', grams: 250, measure: say('1 opakowanie', '1 pack') },
      { ingredient: 'onion', grams: 100, measure: say('1 cebula', '1 onion') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'potatoStarch', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'dill', grams: 10, measure: say('garść', 'a handful') },
      { ingredient: 'oil', grams: 10, measure: say('łyżka', '1 tbsp') },
      { ingredient: 'water', grams: 400, measure: say('2 szklanki', '2 cups') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Kurczaka pokrój w kostkę i obsmaż krótko na oleju. Dodaj cebulę, marchew w plasterkach i pokrojone pieczarki.',
        'Dice the chicken and brown it briefly in the oil. Add the onion, sliced carrots and sliced mushrooms.',
      ),
      say(
        'Wlej wodę, przykryj i duś na małym ogniu 20 minut.',
        'Pour in the water, cover and simmer over a low heat for 20 minutes.',
      ),
      say(
        'Zmniejsz ogień. Skyr wymieszaj z mąką ziemniaczaną i chochlą sosu, wlej do garnka i podgrzewaj, mieszając, aż sos zgęstnieje – skrobia nie pozwoli mu się zwarzyć.',
        'Turn the heat down. Mix the skyr with the potato starch and a ladle of the sauce, pour it into the pot and heat, stirring, until the sauce thickens – the starch stops it curdling.',
      ),
      say('Dopraw solą i pieprzem, posyp koperkiem.', 'Season with salt and pepper and sprinkle with dill.'),
    ],
  },
  {
    id: 'golabki-z-indykiem',
    name: say('Gołąbki z indykiem w sosie pomidorowym', 'Golabki (cabbage rolls) with turkey in tomato sauce'),
    kind: 'obiad',
    minutes: 90,
    servings: 4,
    tool: say('Duży garnek', 'Large pot'),
    description: say(
      'Gołąbki z mielonym indykiem i garścią ryżu, duszone w passacie. Mięsa jest dużo, ryżu mało – dlatego białka wychodzi więcej niż węglowodanów.',
      'Cabbage rolls with minced turkey and a handful of rice, braised in passata. Lots of meat, little rice – which is why there is more protein than carbs.',
    ),
    inspiredBy: wikibooks(
      // i18n-ignore: the linked cookbook page's own (Polish) title
      'Gołąbki z kapustą i pomidorami',
      'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Go%C5%82%C4%85bki_z_kapust%C4%85_i_pomidorami',
    ),
    items: [
      { ingredient: 'whiteCabbage', grams: 700, measure: say('liście z 1 główki', 'leaves from 1 head') },
      { ingredient: 'turkeyMince', grams: 600, measure: say('600 g', '600 g') },
      { ingredient: 'rice', grams: 50, measure: say('ćwierć szklanki suchego', '1/4 cup, uncooked') },
      { ingredient: 'onion', grams: 120, measure: say('1 cebula', '1 onion') },
      { ingredient: 'passata', grams: 500, measure: say('1 butelka', '1 bottle') },
      { ingredient: 'spices', grams: 5, measure: say('majeranek, bazylia, papryka', 'marjoram, basil, paprika') },
      { ingredient: 'water', grams: 300, measure: say('półtorej szklanki', '1½ cups') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Ryż ugotuj al dente. Główkę kapusty sparz we wrzątku i zdejmuj kolejne zmiękczone liście; ze zgrubiałych ścinaj nerw.',
        'Cook the rice al dente. Blanch the cabbage head in boiling water and peel off the softened leaves one by one; shave down the thick rib of the tougher ones.',
      ),
      say(
        'Wymieszaj mięso z ryżem, posiekaną cebulą, majerankiem, solą i pieprzem. Na każdy liść nałóż łyżkę farszu i zawiń jak kopertę.',
        'Mix the meat with the rice, chopped onion, marjoram, salt and pepper. Put a spoonful of filling on each leaf and fold it up like an envelope.',
      ),
      say(
        'Ułóż gołąbki ciasno w garnku wyłożonym resztą liści, zalej passatą z wodą i bazylią, przykryj i duś na małym ogniu 50 minut.',
        'Pack the rolls tightly into the pot lined with the remaining leaves, pour over the passata mixed with the water and basil, cover and simmer over a low heat for 50 minutes.',
      ),
    ],
  },
  {
    id: 'mielone-z-indyka-mizeria',
    name: say(
      'Mielone z indyka z ziołami i mizerią na skyrze',
      'Herby turkey patties with mizeria (skyr cucumber salad)',
    ),
    kind: 'obiad',
    minutes: 35,
    servings: 3,
    tool: say('Patelnia i miska', 'Frying pan and bowl'),
    description: say(
      'Kotlety mielone z indyka z koperkiem, szczypiorem i czosnkiem, z płatkami owsianymi zamiast bułki. Do tego mizeria na skyrze zamiast śmietany.',
      'Turkey patties with dill, chives and garlic, with oats instead of bread. On the side, mizeria – cucumber salad made with skyr instead of sour cream.',
    ),
    inspiredBy: wikibooks(
      // i18n-ignore: the linked cookbook page's own (Polish) title
      'Kotlety mielone z farszem z ziół',
      'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Kotlety_mielone_z_farszem_z_zi%C3%B3%C5%82',
    ),
    items: [
      { ingredient: 'turkeyMince', grams: 600, measure: say('600 g', '600 g') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'oats', grams: 40, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'onion', grams: 80, measure: say('1 mała cebula', '1 small onion') },
      { ingredient: 'chives', grams: 10, measure: say('garść', 'a handful') },
      { ingredient: 'dill', grams: 15, measure: say('garść', 'a handful') },
      { ingredient: 'garlic', grams: 5, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'cucumber', grams: 400, measure: say('2 ogórki', '2 cucumbers') },
      { ingredient: 'skyr', grams: 200, measure: say('1 kubek', '1 pot') },
      { ingredient: 'saltPepper', grams: 3, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Zetrzyj cebulę na tarce, posiekaj zioła i czosnek. Wymieszaj z mięsem, jajkiem, płatkami, solą i pieprzem i odstaw na 10 minut, żeby płatki wchłonęły wilgoć.',
        'Grate the onion, chop the herbs and garlic. Mix with the meat, egg, oats, salt and pepper and leave for 10 minutes so the oats soak up the moisture.',
      ),
      say(
        'Mokrymi dłońmi uformuj 9 kotletów i smaż na rozgrzanym oleju po 5–6 minut z każdej strony.',
        'With wet hands, shape 9 patties and fry them in hot oil for 5–6 minutes on each side.',
      ),
      say(
        'Ogórki pokrój w cienkie plasterki, posól, po kilku minutach odlej sok i wymieszaj ze skyrem i odrobiną koperku.',
        'Slice the cucumbers thinly and salt them; after a few minutes pour off the juice and mix with the skyr and a little dill.',
      ),
    ],
  },
  {
    id: 'szaszlyki-z-indyka',
    name: say('Szaszłyki z indyka z papryką i tzatziki na skyrze', 'Turkey and pepper skewers with skyr tzatziki'),
    kind: 'obiad',
    minutes: 40,
    servings: 2,
    tool: say('Grill, patelnia grillowa albo piekarnik', 'Barbecue, griddle pan or oven'),
    description: say(
      'Szaszłyki z indyka, papryki, cukinii i pieczarek bez boczku. Do nich tzatziki ze skyru, ogórka i czosnku.',
      'Skewers of turkey, pepper, courgette and mushrooms, no bacon. With tzatziki made from skyr, cucumber and garlic.',
    ),
    inspiredBy: wikibooks(
      // i18n-ignore: the linked cookbook page's own (Polish) title
      'Szaszłyki z indyka i kukurydzy',
      'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Szasz%C5%82yki_z_indyka_i_kukurydzy',
    ),
    items: [
      { ingredient: 'turkeyFillet', grams: 500, measure: say('500 g piersi', '500 g of breast') },
      { ingredient: 'pepper', grams: 200, measure: say('1 duża papryka', '1 large pepper') },
      { ingredient: 'zucchini', grams: 200, measure: say('1 mała cukinia', '1 small courgette') },
      { ingredient: 'onion', grams: 100, measure: say('1 czerwona cebula', '1 red onion') },
      { ingredient: 'mushrooms', grams: 150, measure: say('8 pieczarek', '8 mushrooms') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      {
        ingredient: 'spices',
        grams: 4,
        measure: say('tymianek, papryka, czosnek granulowany', 'thyme, paprika, garlic granules'),
      },
      { ingredient: 'skyr', grams: 200, measure: say('1 kubek', '1 pot') },
      { ingredient: 'cucumber', grams: 150, measure: say('pół ogórka', 'half a cucumber') },
      { ingredient: 'garlic', grams: 5, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Indyka pokrój w kostkę 3 cm, wymieszaj z olejem, przyprawami i solą i odstaw na 15 minut.',
        'Cut the turkey into 3 cm cubes, mix with the oil, spices and salt and leave for 15 minutes.',
      ),
      say(
        'Nadziewaj na patyczki na zmianę z kawałkami papryki, cukinii, cebuli i pieczarkami.',
        'Thread onto skewers, alternating with pieces of pepper, courgette and onion and the mushrooms.',
      ),
      say(
        'Grilluj albo piecz w 220°C ok. 15 minut, obracając w połowie.',
        'Grill or bake at 220°C for about 15 minutes, turning halfway.',
      ),
      say(
        'Ogórek zetrzyj, odciśnij i wymieszaj ze skyrem, przeciśniętym czosnkiem, solą i pieprzem.',
        'Grate the cucumber, squeeze it out and mix with the skyr, crushed garlic, salt and pepper.',
      ),
    ],
  },
  {
    id: 'salatka-gyros',
    name: say('Sałatka gyros na skyrze', 'Layered gyros salad with skyr'),
    kind: 'slone',
    minutes: 40,
    servings: 4,
    tool: say('Patelnia i szklana salaterka', 'Frying pan and glass salad bowl'),
    description: say(
      'Warstwowa sałatka gyros z kurczakiem, kiszonymi ogórkami, papryką, pomidorami i kapustą pekińską – z czosnkowym sosem na skyrze zamiast majonezu z ketchupem.',
      'A layered gyros salad with chicken, fermented gherkins, pepper, tomatoes and Chinese leaf – with a garlic skyr sauce instead of mayonnaise and ketchup.',
    ),
    // i18n-ignore: the linked cookbook page's own (Polish) title
    inspiredBy: wikibooks('Sałatka gyros', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Sa%C5%82atka_gyros'),
    items: [
      { ingredient: 'chickenFillet', grams: 500, measure: say('2 piersi', '2 breasts') },
      { ingredient: 'spices', grams: 8, measure: say('2 łyżeczki przyprawy gyros', '2 tsp gyros seasoning') },
      { ingredient: 'oil', grams: 10, measure: say('łyżka', '1 tbsp') },
      { ingredient: 'brinedCucumber', grams: 200, measure: say('3 ogórki', '3 gherkins') },
      { ingredient: 'pepper', grams: 150, measure: say('1 papryka', '1 pepper') },
      { ingredient: 'tomato', grams: 200, measure: say('2 pomidory', '2 tomatoes') },
      { ingredient: 'pekingCabbage', grams: 250, measure: say('pół małej główki', 'half a small head') },
      { ingredient: 'skyr', grams: 300, measure: say('2 kubki', '2 pots') },
      { ingredient: 'garlic', grams: 5, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Kurczaka pokrój w paski, obtocz w przyprawie gyros i usmaż na oleju na rumiano. Wystudź.',
        'Cut the chicken into strips, coat in the gyros seasoning and fry in the oil until golden. Leave to cool.',
      ),
      say(
        'Skyr wymieszaj z przeciśniętym czosnkiem, solą i pieprzem.',
        'Mix the skyr with the crushed garlic, salt and pepper.',
      ),
      say(
        'Układaj warstwami: kurczak, ogórki w kostce, sos, papryka, pomidory, sos i na wierzchu poszatkowana kapusta.',
        'Layer up: chicken, diced gherkins, sauce, pepper, tomatoes, sauce and shredded cabbage on top.',
      ),
      say('Schłodź przynajmniej 15 minut przed podaniem.', 'Chill for at least 15 minutes before serving.'),
    ],
  },
  {
    id: 'sledz-w-skyrze',
    name: say('Śledź w skyrze z jabłkiem i cebulą', 'Herring in skyr with apple and onion'),
    kind: 'slone',
    minutes: 30,
    servings: 2,
    tool: say('Miska', 'Bowl'),
    description: say(
      'Śledzie z cebulą jak w starych przepisach, ale w sosie ze skyru z kwaskowatym jabłkiem i koperkiem zamiast oleju z cukrem albo tłustej śmietany.',
      'Herring with onion as in the old recipes, but in a skyr sauce with tart apple and dill instead of oil with sugar or rich cream.',
    ),
    // i18n-ignore: the linked cookbook page's own (Polish) title
    inspiredBy: wikibooks('Śledzie w ziołach', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/%C5%9Aledzie_w_zio%C5%82ach'),
    items: [
      { ingredient: 'herring', grams: 300, measure: say('1 opakowanie filetów', '1 pack of fillets') },
      { ingredient: 'skyr', grams: 250, measure: say('półtora kubka', '1½ pots') },
      { ingredient: 'apple', grams: 150, measure: say('1 kwaskowate jabłko', '1 tart apple') },
      { ingredient: 'onion', grams: 80, measure: say('1 mała cebula', '1 small onion') },
      { ingredient: 'dill', grams: 10, measure: say('garść', 'a handful') },
      { ingredient: 'saltPepper', grams: 1, measure: say('pieprz do smaku', 'pepper to taste') },
    ],
    steps: [
      say(
        'Filety śledziowe osusz i pokrój na kawałki; jeśli są bardzo słone, wymocz je wcześniej w wodzie.',
        'Pat the herring fillets dry and cut them into pieces; if they are very salty, soak them in water first.',
      ),
      say(
        'Cebulę pokrój w piórka, jabłko w kostkę, posiekaj koperek.',
        'Slice the onion thinly, dice the apple and chop the dill.',
      ),
      say(
        'Wymieszaj skyr z cebulą, jabłkiem, koperkiem i pieprzem, dodaj śledzie i schłodź przez 20 minut.',
        'Mix the skyr with the onion, apple, dill and pepper, add the herring and chill for 20 minutes.',
      ),
    ],
  },
  {
    id: 'jajka-sos-szczypiorkowy',
    name: say('Jajka w sosie szczypiorkowym na skyrze', 'Eggs in a skyr chive sauce'),
    kind: 'slone',
    minutes: 25,
    servings: 2,
    tool: say('Garnek i miska', 'Pot and bowl'),
    description: say(
      'Wielkanocna klasyka na każdy dzień: jajka na twardo w gęstym sosie ze skyru, szczypioru i odrobiny cytryny – bez śmietany i żółtka w sosie.',
      'An Easter classic for every day: hard-boiled eggs in a thick sauce of skyr, chives and a little lemon – no cream or yolk in the sauce.',
    ),
    inspiredBy: wikibooks(
      'Jajka w sosie szczypiorkowym',
      'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Jajka_w_sosie_szczypiorkowym',
    ),
    items: [
      { ingredient: 'egg', grams: 300, measure: say('6 jajek', '6 eggs') },
      { ingredient: 'skyr', grams: 200, measure: say('1 kubek', '1 pot') },
      { ingredient: 'chives', grams: 20, measure: say('pęczek', 'a bunch') },
      { ingredient: 'lemon', grams: 10, measure: say('łyżeczka soku', '1 tsp of juice') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Jajka gotuj 9–10 minut od zagotowania wody, przelej zimną wodą i obierz.',
        'Boil the eggs for 9–10 minutes once the water boils, rinse in cold water and peel.',
      ),
      say(
        'Skyr wymieszaj z drobno posiekanym szczypiorem, sokiem z cytryny, solą i pieprzem.',
        'Mix the skyr with the finely chopped chives, lemon juice, salt and pepper.',
      ),
      say(
        'Przekrój jajka wzdłuż, ułóż na talerzu i polej sosem.',
        'Halve the eggs lengthways, arrange on a plate and pour over the sauce.',
      ),
    ],
  },
  {
    id: 'placki-z-cukinii',
    name: say('Placki z cukinii z twarogiem i koperkiem', 'Courgette fritters with quark and dill'),
    kind: 'slone',
    minutes: 35,
    servings: 2,
    tool: say('Patelnia i tarka', 'Frying pan and grater'),
    description: say(
      'Placki z tartej cukinii z chudym twarogiem, jajkami i koperkiem – twaróg zamiast większości mąki daje im białko. Podane ze skyrem.',
      'Fritters of grated courgette with low-fat quark, eggs and dill – quark in place of most of the flour gives them protein. Served with skyr.',
    ),
    inspiredBy: wikibooks('Placki z cukinii', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Placki_z_cukinii'),
    items: [
      { ingredient: 'zucchini', grams: 500, measure: say('1 duża cukinia', '1 large courgette') },
      { ingredient: 'quark', grams: 200, measure: say('1 kostka', '1 pack') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'flour', grams: 40, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'dill', grams: 15, measure: say('garść', 'a handful') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Cukinię zetrzyj na grubych oczkach, posól i odstaw na 10 minut, potem mocno odciśnij z wody.',
        'Coarsely grate the courgette, salt it and leave for 10 minutes, then squeeze out the water firmly.',
      ),
      say(
        'Wymieszaj z rozgniecionym twarogiem, jajkami, mąką, koperkiem i pieprzem.',
        'Mix with the mashed quark, eggs, flour, dill and pepper.',
      ),
      say(
        'Nakładaj łyżką na rozgrzany olej i smaż po 3–4 minuty z każdej strony, aż się zrumienią.',
        'Spoon into the hot oil and fry for 3–4 minutes on each side until golden.',
      ),
      say('Podawaj ze skyrem.', 'Serve with skyr.'),
    ],
  },
  {
    id: 'sernik-na-zimno',
    name: say('Sernik na zimno z truskawkami, bez cukru', 'No-bake strawberry cheesecake, sugar-free'),
    kind: 'miska',
    minutes: 40,
    servings: 8,
    tool: say('Blender, garnuszek i forma 20–22 cm', 'Blender, small pan and 20–22 cm tin'),
    description: say(
      'Sernik na zimno z chudego twarogu i skyru na żelatynie, z truskawkami. Bez spodu z biszkoptów, masła i cukru – słodzik zamiast cukru pudru.',
      'A no-bake cheesecake of low-fat quark and skyr set with gelatine, with strawberries. No biscuit base, butter or sugar – sweetener instead of icing sugar.',
    ),
    inspiredBy: wikibooks('Sernik truskawkowy', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Sernik_truskawkowy'),
    items: [
      { ingredient: 'quark', grams: 800, measure: say('4 kostki', '4 packs') },
      { ingredient: 'skyr', grams: 300, measure: say('2 kubki', '2 pots') },
      { ingredient: 'gelatin', grams: 25, measure: say('2,5 łyżki', '2.5 tbsp') },
      { ingredient: 'strawberries', grams: 400, measure: say('2 szklanki', '2 cups') },
      { ingredient: 'sweetener', grams: 60, measure: say('6 łyżek, do smaku', '6 tbsp, to taste') },
      { ingredient: 'lemon', grams: 20, measure: say('sok z połowy cytryny', 'juice of half a lemon') },
      { ingredient: 'water', grams: 100, measure: say('pół szklanki', 'half a cup') },
    ],
    steps: [
      say(
        'Żelatynę zalej zimną wodą na 5 minut, potem podgrzej, mieszając, aż się rozpuści – nie gotuj.',
        'Soak the gelatine in cold water for 5 minutes, then heat it, stirring, until it dissolves – do not boil.',
      ),
      say(
        'Zmiksuj twaróg ze skyrem, słodzikiem i sokiem z cytryny na gładką masę. Do żelatyny dodaj 2 łyżki masy, wymieszaj i wlej z powrotem, cały czas miksując.',
        'Blend the quark with the skyr, sweetener and lemon juice until smooth. Stir 2 tablespoons of the mixture into the gelatine, then pour it back in while blending.',
      ),
      say(
        'Połowę truskawek pokrój i wymieszaj z masą, przelej do formy, a na wierzchu ułóż resztę owoców.',
        'Chop half the strawberries and fold them into the mixture, pour into the tin and arrange the rest of the fruit on top.',
      ),
      say(
        'Schładzaj w lodówce co najmniej 4 godziny, najlepiej przez noc.',
        'Chill in the fridge for at least 4 hours, ideally overnight.',
      ),
    ],
  },
  {
    id: 'twarog-z-awokado',
    name: say('Pasta z twarogu i awokado z pieczarkami', 'Quark and avocado spread with mushrooms'),
    kind: 'slone',
    minutes: 25,
    servings: 2,
    tool: say('Patelnia i miska', 'Frying pan and bowl'),
    description: say(
      'Kremowa pasta z chudego twarogu i awokado z podsmażonymi pieczarkami i cebulką. Do kanapek albo prosto z miski.',
      'A creamy spread of low-fat quark and avocado with fried mushrooms and onion. For sandwiches or straight from the bowl.',
    ),
    // i18n-ignore: the linked cookbook page's own (Polish) title
    inspiredBy: wikibooks('Twaróg z awokado', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Twar%C3%B3g_z_awokado'),
    items: [
      { ingredient: 'quark', grams: 200, measure: say('1 kostka', '1 pack') },
      { ingredient: 'avocado', grams: 150, measure: say('1 dojrzałe awokado', '1 ripe avocado') },
      { ingredient: 'mushrooms', grams: 150, measure: say('8 pieczarek', '8 mushrooms') },
      { ingredient: 'onion', grams: 50, measure: say('pół cebuli', 'half an onion') },
      { ingredient: 'oil', grams: 5, measure: say('łyżeczka', '1 tsp') },
      { ingredient: 'lemon', grams: 10, measure: say('łyżeczka soku', '1 tsp of juice') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Pieczarki i cebulę pokrój w drobną kostkę i podsmaż na oleju, aż odparuje woda. Wystudź.',
        'Finely dice the mushrooms and onion and fry in the oil until the water has cooked off. Leave to cool.',
      ),
      say(
        'Awokado rozgnieć widelcem z sokiem z cytryny, dodaj twaróg i rozetrzyj na gładko.',
        'Mash the avocado with the lemon juice using a fork, add the quark and work it until smooth.',
      ),
      say(
        'Wmieszaj pieczarki z cebulą, dopraw solą i pieprzem.',
        'Stir in the mushrooms and onion, and season with salt and pepper.',
      ),
    ],
  },
  {
    id: 'racuchy-bialkowe',
    name: say('Białkowe racuchy z jabłkami', 'Protein racuchy (apple pancakes)'),
    kind: 'miska',
    minutes: 30,
    servings: 2,
    tool: say('Patelnia i miska', 'Frying pan and bowl'),
    description: say(
      'Racuchy z jabłkami i cynamonem na mieszance do białkowych naleśników i skyrze zamiast mąki i kwaśnego mleka. Mieszankę kupisz w sklepie internetowym.',
      'Fluffy apple and cinnamon pancakes made with protein pancake mix and skyr instead of flour and soured milk. You can buy the mix online.',
    ),
    inspiredBy: wikibooks('Racuszki (Polish Pancakes)', 'https://en.wikibooks.org/wiki/Cookbook:Racuszki_(Polish_Pancakes)'),
    items: [
      { ingredient: 'proteinPancakeMix', grams: 100, measure: say('1 szklanka', '1 cup') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'apple', grams: 200, measure: say('2 jabłka', '2 apples') },
      { ingredient: 'cinnamon', grams: 2, measure: say('szczypta', 'a pinch') },
      { ingredient: 'oil', grams: 10, measure: say('łyżka', '1 tbsp') },
    ],
    steps: [
      say(
        'Wymieszaj mieszankę ze skyrem i jajkiem na gęste ciasto; jeśli za gęste, dodaj łyżkę wody.',
        'Mix the powder with the skyr and egg into a thick batter; if it is too thick, add a spoonful of water.',
      ),
      say(
        'Jabłka obierz, pokrój w cienkie plasterki albo zetrzyj na grubych oczkach, wmieszaj do ciasta z cynamonem.',
        'Peel the apples, slice them thinly or grate them coarsely, and stir them into the batter with the cinnamon.',
      ),
      say(
        'Smaż małe racuchy na rozgrzanym oleju po 2–3 minuty z każdej strony, na średnim ogniu.',
        'Fry small pancakes in hot oil for 2–3 minutes on each side over a medium heat.',
      ),
    ],
  },
];

export const RECIPES: Recipe[] = [
  ...GOTOWCE,
  {
    id: 'bialko-woda',
    name: say('Białko z wodą', 'Protein shake with water'),
    kind: 'mix',
    minutes: 1,
    tool: say('Shaker', 'Shaker'),
    description: say(
      'Najprostszy możliwy posiłek białkowy – po treningu albo w drodze.',
      'The simplest protein meal there is – after training or on the go.',
    ),
    items: [
      { ingredient: 'whey', grams: 30, measure: say('1 miarka', '1 scoop') },
      { ingredient: 'water', grams: 300, measure: say('1,5 szklanki', '1.5 cups') },
    ],
    steps: [
      say('Wlej zimną wodę do shakera, wsyp białko.', 'Pour cold water into the shaker and add the protein powder.'),
      say('Zakręć i mocno potrząśnij przez 15 sekund.', 'Screw on the lid and shake hard for 15 seconds.'),
    ],
  },
  {
    id: 'bialko-mleko',
    name: say('Białko z mlekiem', 'Protein shake with milk'),
    kind: 'mix',
    minutes: 1,
    tool: say('Shaker', 'Shaker'),
    description: say(
      'Gęstszy i bardziej sycący od wersji na wodzie, smakuje jak koktajl mleczny.',
      'Thicker and more filling than the water version – it tastes like a milkshake.',
    ),
    items: [
      { ingredient: 'whey', grams: 30, measure: say('1 miarka', '1 scoop') },
      { ingredient: 'milk', grams: 300, measure: say('1,5 szklanki', '1.5 cups') },
    ],
    steps: [
      say('Wlej zimne mleko do shakera, wsyp białko.', 'Pour cold milk into the shaker and add the protein powder.'),
      say('Zakręć i potrząsaj przez 15–20 sekund.', 'Screw on the lid and shake for 15–20 seconds.'),
    ],
  },
  {
    id: 'skyr-maliny',
    name: say('Skyr z białkiem i malinami', 'Skyr with protein powder and raspberries'),
    kind: 'miska',
    minutes: 3,
    tool: say('Miska i łyżka', 'Bowl and spoon'),
    description: say(
      'Gęsty, kremowy deser na łyżkę – maliny z zamrażarki robią się jak sos.',
      'A thick, creamy spoon dessert – raspberries from the freezer turn into a sauce.',
    ),
    items: [
      { ingredient: 'skyr', grams: 200, measure: say('duży kubek', 'a large pot') },
      { ingredient: 'whey', grams: 15, measure: say('pół miarki', 'half a scoop') },
      { ingredient: 'raspberries', grams: 100, measure: say('garść', 'a handful') },
    ],
    steps: [
      say(
        'Wymieszaj skyr z białkiem na gładki krem.',
        'Stir the protein powder into the skyr until smooth and creamy.',
      ),
      say(
        'Dodaj mrożone maliny. Poczekaj kilka minut albo podgrzej je 30 sekund w mikrofali – puszczą sok.',
        'Add the frozen raspberries. Wait a few minutes or microwave them for 30 seconds – they will release their juice.',
      ),
    ],
  },
  {
    id: 'shake-truskawkowy',
    name: say('Shake truskawkowy ze skyrem', 'Strawberry skyr shake'),
    kind: 'shake',
    minutes: 3,
    tool: say('Blender', 'Blender'),
    description: say(
      'Gęsty, owocowy koktajl z cynamonem – jak milkshake, a ma ponad 40 g białka.',
      'A thick, fruity shake with cinnamon – like a milkshake, but with over 40 g of protein.',
    ),
    items: [
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'whey', grams: 30, measure: say('1 miarka', '1 scoop') },
      { ingredient: 'water', grams: 200, measure: say('szklanka', '1 cup') },
      { ingredient: 'strawberries', grams: 150, measure: say('2 garści', '2 handfuls') },
      { ingredient: 'cinnamon', grams: 1, measure: say('szczypta', 'a pinch') },
    ],
    steps: [
      say(
        'Wrzuć wszystko do blendera – mrożone truskawki dadzą gęstość i chłód.',
        'Put everything in the blender – frozen strawberries make it thick and cold.',
      ),
      say(
        'Miksuj 30–40 sekund do gładkości. Za gęsty? Dolej odrobinę wody.',
        'Blend for 30–40 seconds until smooth. Too thick? Add a splash of water.',
      ),
    ],
  },
  {
    id: 'lody-maliny',
    name: say('Lody z malin i skyru', 'Raspberry skyr ice cream'),
    kind: 'miska',
    minutes: 3,
    tool: say('Blender', 'Blender'),
    description: say(
      'Mrożone maliny zmiksowane ze skyrem dają konsystencję lodów włoskich.',
      'Frozen raspberries blended with skyr give you the texture of soft-serve ice cream.',
    ),
    items: [
      { ingredient: 'raspberries', grams: 150, measure: say('1,5 garści', '1.5 handfuls') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'whey', grams: 25, measure: say('niepełna miarka', 'just under a scoop') },
    ],
    steps: [
      say(
        'Zmiksuj prosto zamrożone maliny ze skyrem i białkiem, zgarniając masę ze ścianek.',
        'Blend the raspberries straight from frozen with the skyr and protein powder, scraping down the sides.',
      ),
      say('Jedz od razu – po 10 minutach to już koktajl.', 'Eat it straight away – after 10 minutes it is a smoothie.'),
    ],
  },
  {
    id: 'kefir-shake',
    name: say('Kefir z białkiem i truskawkami', 'Kefir with protein powder and strawberries'),
    kind: 'shake',
    minutes: 2,
    tool: say('Blender lub shaker', 'Blender or shaker'),
    description: say(
      'Lekko kwaśny, orzeźwiający – dobry na śniadanie albo po treningu.',
      'Slightly sour and refreshing – good for breakfast or after training.',
    ),
    items: [
      { ingredient: 'kefir', grams: 300, measure: say('1 mała butelka', '1 small bottle') },
      { ingredient: 'whey', grams: 25, measure: say('niepełna miarka', 'just under a scoop') },
      { ingredient: 'strawberries', grams: 100, measure: say('garść', 'a handful') },
    ],
    steps: [
      say('Zmiksuj wszystko przez 20 sekund.', 'Blend everything for 20 seconds.'),
      say(
        'W shakerze bez owoców też działa – wtedy dodaj je osobno.',
        'It also works in a shaker without the fruit – then add it separately.',
      ),
    ],
  },
  {
    id: 'kawa-proteinowa',
    name: say('Mrożona kawa proteinowa', 'Iced protein coffee'),
    kind: 'shake',
    minutes: 3,
    tool: say('Shaker', 'Shaker'),
    description: say(
      'Kawa mrożona jak z kawiarni, tylko zamiast syropu – 25 g białka.',
      'Iced coffee like a café one, only instead of syrup – 25 g of protein.',
    ),
    items: [
      { ingredient: 'coffee', grams: 100, measure: say('podwójne espresso', 'a double espresso') },
      { ingredient: 'milk', grams: 150, measure: say('3/4 szklanki', '3/4 cup') },
      {
        ingredient: 'whey',
        grams: 25,
        measure: say('niepełna miarka (najlepiej waniliowe)', 'just under a scoop (vanilla is best)'),
      },
      { ingredient: 'ice', grams: 100, measure: say('garść kostek', 'a handful of cubes') },
    ],
    steps: [
      say(
        'Zaparz kawę i wystudź ją chwilę albo od razu wlej na lód.',
        'Brew the coffee and let it cool for a moment, or pour it straight over ice.',
      ),
      say(
        'Wstrząśnij mleko z białkiem w shakerze i wlej na kawę z lodem.',
        'Shake the milk with the protein powder in the shaker and pour it over the iced coffee.',
      ),
    ],
  },
  {
    id: 'jogurt-borowki',
    name: say('Jogurt proteinowy z borówkami', 'Protein yoghurt with blueberries'),
    kind: 'miska',
    minutes: 1,
    tool: say('Łyżka', 'Spoon'),
    description: say(
      'Zero przygotowania: gotowy kubek białka i garść owoców.',
      'Zero prep: a ready pot of protein and a handful of fruit.',
    ),
    items: [
      { ingredient: 'proteinYogurt', grams: 200, measure: say('1 kubek', '1 pot') },
      { ingredient: 'blueberries', grams: 50, measure: say('pół garści', 'half a handful') },
    ],
    steps: [say('Wsyp borówki do jogurtu i jedz.', 'Tip the blueberries into the yoghurt and eat.')],
  },
  {
    id: 'pudding-kakaowy',
    name: say('Kakaowy pudding twarogowy', 'Cocoa quark pudding'),
    kind: 'miska',
    minutes: 5,
    tool: say('Miska i widelec (lub blender)', 'Bowl and fork (or blender)'),
    description: say(
      'Smakuje jak budyń czekoladowy, a ma blisko 60 g białka.',
      'Tastes like chocolate pudding, with nearly 60 g of protein.',
    ),
    items: [
      { ingredient: 'quark', grams: 200, measure: say('1 kostka', '1 pack') },
      { ingredient: 'whey', grams: 20, measure: say('2/3 miarki', '2/3 scoop') },
      { ingredient: 'cocoa', grams: 10, measure: say('2 łyżeczki', '2 tsp') },
      { ingredient: 'milk', grams: 50, measure: say('3 łyżki', '3 tbsp') },
    ],
    steps: [
      say(
        'Rozgnieć twaróg widelcem z mlekiem (albo zmiksuj – będzie gładszy).',
        'Mash the quark with the milk using a fork (or blend it – it will be smoother).',
      ),
      say(
        'Wmieszaj białko i kakao. Najlepszy po 10 minutach w lodówce.',
        'Stir in the protein powder and cocoa. Best after 10 minutes in the fridge.',
      ),
    ],
  },
  {
    id: 'owsianka-nocna',
    name: say('Nocna owsianka białkowa', 'Protein overnight oats'),
    kind: 'miska',
    minutes: 5,
    tool: say('Słoik', 'Jar'),
    description: say(
      'Robisz wieczorem w 5 minut, rano jest gotowa. Owsa jest mało na tyle, żeby białko wygrało.',
      'Make it in 5 minutes in the evening and it is ready in the morning. There are just few enough oats for protein to win.',
    ),
    items: [
      { ingredient: 'oats', grams: 35, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'whey', grams: 25, measure: say('niepełna miarka', 'just under a scoop') },
      { ingredient: 'milk', grams: 100, measure: say('pół szklanki', 'half a cup') },
      { ingredient: 'raspberries', grams: 50, measure: say('pół garści', 'half a handful') },
    ],
    steps: [
      say('Wymieszaj w słoiku płatki, skyr, białko i mleko.', 'In a jar, mix the oats, skyr, protein powder and milk.'),
      say(
        'Na wierzch wsyp maliny, zakręć i wstaw na noc do lodówki.',
        'Top with the raspberries, close the lid and leave in the fridge overnight.',
      ),
    ],
  },
  {
    id: 'serek-pomidor',
    name: say('Serek wiejski z pomidorem i szczypiorkiem', 'Cottage cheese with tomato and chives'),
    kind: 'slone',
    minutes: 3,
    tool: say('Miska', 'Bowl'),
    description: say('Klasyk na słono: świeży, chrupiący, sycący.', 'A savoury classic: fresh, crunchy, filling.'),
    items: [
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 pack') },
      { ingredient: 'tomato', grams: 120, measure: say('1 pomidor', '1 tomato') },
      { ingredient: 'chives', grams: 5, measure: say('kilka źdźbeł', 'a few stems') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say('Pokrój pomidor w kostkę, posiekaj szczypiorek.', 'Dice the tomato and chop the chives.'),
      say(
        'Wymieszaj z serkiem, dopraw solą i pieprzem.',
        'Mix with the cottage cheese and season with salt and pepper.',
      ),
    ],
  },
  {
    id: 'tunczyk-salatka',
    name: say('Sałatka z tuńczykiem i serkiem wiejskim', 'Tuna and cottage cheese salad'),
    kind: 'slone',
    minutes: 5,
    tool: say('Miska', 'Bowl'),
    description: say(
      'Prawie 50 g białka z puszki i kubka, bez gotowania.',
      'Almost 50 g of protein from a tin and a tub, no cooking.',
    ),
    items: [
      { ingredient: 'tuna', grams: 120, measure: say('1 puszka, odsączona', '1 tin, drained') },
      { ingredient: 'cottage', grams: 150, measure: say('pół dużego opakowania', 'half a large pack') },
      { ingredient: 'cucumber', grams: 100, measure: say('pół ogórka', 'half a cucumber') },
      { ingredient: 'tomato', grams: 100, measure: say('1 mały pomidor', '1 small tomato') },
    ],
    steps: [
      say('Odsącz tuńczyka, pokrój ogórek i pomidor.', 'Drain the tuna, chop the cucumber and tomato.'),
      say(
        'Wymieszaj wszystko z serkiem, dopraw pieprzem.',
        'Mix everything with the cottage cheese and season with pepper.',
      ),
    ],
  },
  {
    id: 'kurczak-serek',
    name: say('Kurczak z serkiem wiejskim i ogórkiem', 'Chicken with cottage cheese and cucumber'),
    kind: 'slone',
    minutes: 3,
    tool: say('Talerz', 'Plate'),
    description: say(
      'Gotowa pierś w plastrach, serek i ogórek – obiad białkowy w 3 minuty.',
      'Ready-sliced breast, cottage cheese and cucumber – a protein lunch in 3 minutes.',
    ),
    items: [
      { ingredient: 'chicken', grams: 100, measure: say('1 opakowanie plastrów', '1 pack of slices') },
      { ingredient: 'cottage', grams: 150, measure: say('pół dużego opakowania', 'half a large pack') },
      { ingredient: 'cucumber', grams: 100, measure: say('pół ogórka', 'half a cucumber') },
    ],
    steps: [
      say('Pokrój ogórek w plasterki.', 'Slice the cucumber.'),
      say(
        'Ułóż na talerzu z plastrami kurczaka i serkiem, dopraw pieprzem.',
        'Arrange on a plate with the chicken slices and cottage cheese, and season with pepper.',
      ),
    ],
  },
  {
    id: 'omlet-bialkowy',
    name: say('Omlet z białek ze szpinakiem', 'Egg-white omelette with spinach'),
    kind: 'slone',
    minutes: 7,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Puszysty, chudy omlet z białek – ciepłe śniadanie gotowe w 7 minut.',
      'A fluffy, lean egg-white omelette – a warm breakfast ready in 7 minutes.',
    ),
    items: [
      { ingredient: 'eggWhites', grams: 130, measure: say('białka z 4 jaj', 'whites of 4 eggs') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'spinach', grams: 50, measure: say('garść', 'a handful') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Roztrzep białka z całym jajkiem, solą i pieprzem.',
        'Whisk the egg whites with the whole egg, salt and pepper.',
      ),
      say(
        'Wrzuć szpinak na rozgrzaną patelnię na 1 minutę, zalej jajkami.',
        'Put the spinach in the hot pan for 1 minute, then pour in the eggs.',
      ),
      say('Smaż pod przykryciem 3–4 minuty na małym ogniu.', 'Cook, covered, for 3–4 minutes over a low heat.'),
    ],
  },
  // ── Szybkie, na słono (do 7 minut) ──────────────────────────────────────
  {
    id: 'losos-serek',
    name: say('Łosoś wędzony z serkiem wiejskim i ogórkiem', 'Smoked salmon with cottage cheese and cucumber'),
    kind: 'slone',
    minutes: 4,
    tool: say('Talerz', 'Plate'),
    description: say(
      'Śniadanie jak z hotelowego bufetu: wędzony łosoś, chłodny serek z koperkiem i chrupiący ogórek.',
      'A hotel-buffet breakfast: smoked salmon, cool cottage cheese with dill and crunchy cucumber.',
    ),
    items: [
      {
        ingredient: 'smokedSalmon',
        grams: 80,
        measure: say('pół opakowania (ok. 4 plastry)', 'half a pack (about 4 slices)'),
      },
      { ingredient: 'cottage', grams: 150, measure: say('pół dużego opakowania', 'half a large pack') },
      { ingredient: 'cucumber', grams: 100, measure: say('pół ogórka', 'half a cucumber') },
      { ingredient: 'dill', grams: 3, measure: say('kilka gałązek', 'a few sprigs') },
      { ingredient: 'saltPepper', grams: 1, measure: say('pieprz do smaku', 'pepper to taste') },
    ],
    steps: [
      say('Pokrój ogórek w półplasterki, posiekaj koperek.', 'Cut the cucumber into half-moons and chop the dill.'),
      say(
        'Wymieszaj serek z koperkiem i pieprzem, obok ułóż łososia i ogórek.',
        'Mix the cottage cheese with the dill and pepper, and arrange the salmon and cucumber alongside.',
      ),
    ],
  },
  {
    id: 'roladki-twarozek',
    name: say('Roladki z szynki drobiowej z twarożkiem', 'Poultry ham rolls with quark spread'),
    kind: 'slone',
    minutes: 5,
    tool: say('Miska i widelec', 'Bowl and fork'),
    description: say(
      'Plastry piersi z indyka lub kurczaka zwinięte z twarożkiem ze szczypiorkiem – ponad 50 g białka bez gotowania.',
      'Slices of turkey or chicken breast rolled up with quark and chives – over 50 g of protein with no cooking.',
    ),
    items: [
      { ingredient: 'chicken', grams: 100, measure: say('1 opakowanie plastrów', '1 pack of slices') },
      { ingredient: 'quark', grams: 150, measure: say('3/4 kostki', '3/4 pack') },
      { ingredient: 'radish', grams: 50, measure: say('4–5 rzodkiewek', '4–5 radishes') },
      { ingredient: 'chives', grams: 5, measure: say('kilka źdźbeł', 'a few stems') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Rozgnieć twaróg widelcem z posiekanym szczypiorkiem, drobno pokrojoną rzodkiewką, solą i pieprzem. Za suchy? Dodaj łyżkę wody.',
        'Mash the quark with a fork with the chopped chives, finely chopped radish, salt and pepper. Too dry? Add a spoonful of water.',
      ),
      say(
        'Na każdy plaster nałóż łyżkę twarożku i zwiń w rulon.',
        'Put a spoonful of the quark on each slice and roll it up.',
      ),
    ],
  },

  // ── Chwilę dłużej (8–20 minut) ──────────────────────────────────────────
  {
    id: 'jajecznica-losos',
    name: say('Jajecznica na białkach z wędzonym łososiem', 'Egg-white scrambled eggs with smoked salmon'),
    kind: 'slone',
    minutes: 8,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Kremowa jajecznica z dwóch jaj i samych białek, a na koniec łosoś i szczypiorek. Śniadanie na blisko 40 g białka.',
      'Creamy scrambled eggs from two whole eggs plus whites, finished with salmon and chives. A breakfast with nearly 40 g of protein.',
    ),
    items: [
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      {
        ingredient: 'eggWhites',
        grams: 150,
        measure: say('białka z 4–5 jaj (lub z kartonu)', 'whites of 4–5 eggs (or from a carton)'),
      },
      { ingredient: 'smokedSalmon', grams: 50, measure: say('2–3 plastry', '2–3 slices') },
      { ingredient: 'chives', grams: 5, measure: say('kilka źdźbeł', 'a few stems') },
      { ingredient: 'oil', grams: 3, measure: say('łyżeczka', '1 tsp') },
    ],
    steps: [
      say(
        'Roztrzep jajka z białkami i szczyptą pieprzu – bez soli, łosoś jest słony.',
        'Whisk the eggs with the whites and a pinch of pepper – no salt, the salmon is salty.',
      ),
      say(
        'Wlej na lekko natłuszczoną patelnię i mieszaj na małym ogniu 3–4 minuty, aż się zetnie, ale zostanie wilgotna.',
        'Pour into a lightly greased pan and stir over a low heat for 3–4 minutes until set but still moist.',
      ),
      say(
        'Zdejmij z ognia, wmieszaj pokrojonego łososia i posyp szczypiorkiem.',
        'Take off the heat, stir in the chopped salmon and sprinkle with chives.',
      ),
    ],
  },
  {
    id: 'omlet-twarozek',
    name: say('Omlet z twarożkiem i pomidorem', 'Omelette with quark and tomato'),
    kind: 'slone',
    minutes: 10,
    tool: say('Patelnia z pokrywką', 'Frying pan with a lid'),
    description: say(
      'Puszysty omlet z jaj i białek, w środku ciepły twaróg i pomidor. Sycący, a tłuszczu niewiele.',
      'A fluffy omelette of eggs and whites with warm quark and tomato inside. Filling, with little fat.',
    ),
    items: [
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'eggWhites', grams: 100, measure: say('białka z 3 jaj', 'whites of 3 eggs') },
      { ingredient: 'quark', grams: 100, measure: say('pół kostki', 'half a pack') },
      { ingredient: 'tomato', grams: 100, measure: say('1 mały pomidor', '1 small tomato') },
      { ingredient: 'chives', grams: 5, measure: say('kilka źdźbeł', 'a few stems') },
      { ingredient: 'oil', grams: 3, measure: say('łyżeczka', '1 tsp') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say('Roztrzep jajka z białkami, solą i pieprzem.', 'Whisk the eggs with the whites, salt and pepper.'),
      say(
        'Wlej na natłuszczoną, rozgrzaną patelnię i smaż pod przykryciem 3–4 minuty na małym ogniu.',
        'Pour into a greased, hot pan and cook, covered, for 3–4 minutes over a low heat.',
      ),
      say(
        'Na połowę omletu wyłóż pokruszony twaróg i plastry pomidora, przykryj drugą połową i podgrzej jeszcze minutę. Posyp szczypiorkiem.',
        'Scatter the crumbled quark and tomato slices over one half, fold the other half over and heat for another minute. Sprinkle with chives.',
      ),
    ],
  },
  {
    id: 'twarozek-rzodkiewka',
    name: say('Twarożek z rzodkiewką i jajkiem na twardo', 'Quark spread with radish and hard-boiled eggs'),
    kind: 'slone',
    minutes: 12,
    tool: say('Garnek i miska', 'Pot and bowl'),
    description: say(
      'Polskie śniadanie w wersji białkowej: twaróg ze szczypiorkiem, chrupiąca rzodkiewka i dwa jajka – ponad 50 g białka.',
      'A Polish breakfast, high-protein style: quark with chives, crunchy radish and two eggs – over 50 g of protein.',
    ),
    items: [
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'quark', grams: 200, measure: say('1 kostka', '1 pack') },
      { ingredient: 'radish', grams: 80, measure: say('6–7 rzodkiewek', '6–7 radishes') },
      { ingredient: 'chives', grams: 10, measure: say('pół pęczka', 'half a bunch') },
      { ingredient: 'milk', grams: 30, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Ugotuj jajka na twardo – 9 minut od zagotowania – i przelej zimną wodą.',
        'Hard-boil the eggs – 9 minutes once the water boils – and rinse in cold water.',
      ),
      say(
        'W tym czasie rozgnieć twaróg z mlekiem, posiekanym szczypiorkiem, solą i pieprzem.',
        'Meanwhile, mash the quark with the milk, chopped chives, salt and pepper.',
      ),
      say(
        'Dodaj pokrojoną rzodkiewkę, na wierzch połóż jajka przekrojone na ćwiartki.',
        'Add the sliced radish and top with the eggs, cut into quarters.',
      ),
    ],
  },
  {
    id: 'krewetki-czosnkowe',
    name: say('Krewetki czosnkowe z cukinią', 'Garlic prawns with courgette'),
    kind: 'obiad',
    minutes: 12,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Krewetki na oliwie z czosnkiem i chili, cukinia pokrojona jak makaron i odrobina parmezanu.',
      'Prawns in olive oil with garlic and chilli, courgette cut like noodles and a little parmesan.',
    ),
    items: [
      { ingredient: 'shrimp', grams: 200, measure: say('1 opakowanie, rozmrożone', '1 pack, thawed') },
      { ingredient: 'zucchini', grams: 250, measure: say('1 mała cukinia', '1 small courgette') },
      { ingredient: 'garlic', grams: 10, measure: say('3 ząbki', '3 cloves') },
      { ingredient: 'oil', grams: 8, measure: say('łyżka', '1 tbsp') },
      { ingredient: 'lemon', grams: 15, measure: say('sok z ćwiartki cytryny', 'juice of a quarter of a lemon') },
      { ingredient: 'parmesan', grams: 10, measure: say('1 łyżka tartego', '1 tbsp, grated') },
      { ingredient: 'spices', grams: 1, measure: say('szczypta chili', 'a pinch of chilli') },
    ],
    steps: [
      say(
        'Pokrój cukinię w cienkie paski (obieraczką albo nożem). Krewetki rozmroź i osusz ręcznikiem.',
        'Cut the courgette into thin ribbons (with a peeler or a knife). Thaw the prawns and pat them dry with kitchen paper.',
      ),
      say(
        'Na rozgrzanej oliwie podsmaż czosnek z chili przez 30 sekund, wrzuć krewetki i smaż po 2 minuty z każdej strony, aż zróżowieją.',
        'Fry the garlic and chilli in the hot oil for 30 seconds, add the prawns and fry for 2 minutes on each side until pink.',
      ),
      say(
        'Dodaj cukinię na 2–3 minuty, skrop sokiem z cytryny i posyp parmezanem.',
        'Add the courgette for 2–3 minutes, then sprinkle with lemon juice and parmesan.',
      ),
    ],
  },
  {
    id: 'placki-twarogowe',
    name: say('Placki twarogowe z borówkami', 'Quark pancakes with blueberries'),
    kind: 'miska',
    minutes: 15,
    tool: say('Patelnia i miska', 'Frying pan and bowl'),
    description: say(
      'Puszyste placuszki z twarogu, białek i odrobiny owsa. Smakują jak racuchy, a mają ponad 60 g białka.',
      'Fluffy little pancakes of quark, egg whites and a few oats. They taste like Polish racuchy, with over 60 g of protein.',
    ),
    items: [
      { ingredient: 'quark', grams: 150, measure: say('3/4 kostki', '3/4 pack') },
      { ingredient: 'eggWhites', grams: 100, measure: say('białka z 3 jaj', 'whites of 3 eggs') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'oats', grams: 30, measure: say('3 łyżki', '3 tbsp') },
      {
        ingredient: 'whey',
        grams: 15,
        measure: say('pół miarki (najlepiej waniliowe)', 'half a scoop (vanilla is best)'),
      },
      { ingredient: 'blueberries', grams: 100, measure: say('garść', 'a handful') },
      { ingredient: 'oil', grams: 3, measure: say('łyżeczka do smażenia', '1 tsp for frying') },
    ],
    steps: [
      say(
        'Zmiksuj albo rozgnieć widelcem twaróg z jajkiem, białkami, płatkami i białkiem w proszku na gęste ciasto.',
        'Blend, or mash with a fork, the quark with the egg, egg whites, oats and protein powder into a thick batter.',
      ),
      say(
        'Nakładaj łyżką małe placki na lekko natłuszczoną patelnię i smaż na średnim ogniu po 2 minuty z każdej strony.',
        'Spoon small pancakes into a lightly greased pan and fry over a medium heat for 2 minutes on each side.',
      ),
      say(
        'Podawaj z borówkami – mrożone podgrzej chwilę na patelni, puszczą sok.',
        'Serve with the blueberries – warm frozen ones briefly in the pan and they will release their juice.',
      ),
    ],
  },
  {
    id: 'kurczak-papryka',
    name: say('Kurczak z patelni z papryką i cukinią', 'Pan-fried chicken with pepper and courgette'),
    kind: 'obiad',
    minutes: 15,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Szybki obiad z jednej patelni: zrumieniona pierś, słodka papryka i cukinia z czosnkiem. Prawie 50 g białka.',
      'A quick one-pan dinner: browned chicken breast, sweet pepper and courgette with garlic. Almost 50 g of protein.',
    ),
    items: [
      { ingredient: 'chickenFillet', grams: 200, measure: say('1 mały filet', '1 small fillet') },
      { ingredient: 'pepper', grams: 150, measure: say('1 papryka', '1 pepper') },
      { ingredient: 'zucchini', grams: 150, measure: say('pół cukinii', 'half a courgette') },
      { ingredient: 'onion', grams: 50, measure: say('pół cebuli', 'half an onion') },
      { ingredient: 'garlic', grams: 5, measure: say('1–2 ząbki', '1–2 cloves') },
      { ingredient: 'oil', grams: 7, measure: say('pół łyżki', '½ tbsp') },
      {
        ingredient: 'spices',
        grams: 3,
        measure: say('łyżeczka (papryka słodka, oregano)', '1 tsp (sweet paprika, oregano)'),
      },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Pokrój kurczaka w kostkę, obtocz w przyprawach i soli.',
        'Dice the chicken and toss it in the spices and salt.',
      ),
      say(
        'Rozgrzej oliwę i smaż kurczaka 5–6 minut, aż się zrumieni ze wszystkich stron.',
        'Heat the oil and fry the chicken for 5–6 minutes until browned all over.',
      ),
      say(
        'Dodaj cebulę, paprykę i cukinię pokrojone w paski i smaż jeszcze 5 minut. Na koniec wrzuć przeciśnięty czosnek na 30 sekund.',
        'Add the onion, pepper and courgette cut into strips and fry for 5 more minutes. Finally, add the crushed garlic for 30 seconds.',
      ),
    ],
  },
  {
    id: 'makaron-tunczyk',
    name: say('Makaron z soczewicy z tuńczykiem i pomidorami', 'Lentil pasta with tuna and tomatoes'),
    kind: 'obiad',
    minutes: 15,
    tool: say('Garnek i patelnia', 'Pot and frying pan'),
    description: say(
      'Makaron z soczewicy ma dwa razy więcej białka niż pszenny – z tuńczykiem i sosem pomidorowym to pełny obiad.',
      'Lentil pasta has twice the protein of wheat pasta – with tuna and tomato sauce it is a full dinner.',
    ),
    items: [
      { ingredient: 'lentilPasta', grams: 50, measure: say('mała garść (suchy)', 'a small handful (dry)') },
      { ingredient: 'tuna', grams: 120, measure: say('1 puszka, odsączona', '1 tin, drained') },
      { ingredient: 'cannedTomatoes', grams: 200, measure: say('pół puszki', 'half a tin') },
      { ingredient: 'onion', grams: 40, measure: say('pół małej cebuli', 'half a small onion') },
      { ingredient: 'garlic', grams: 5, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'oil', grams: 5, measure: say('łyżeczka', '1 tsp') },
      { ingredient: 'parmesan', grams: 10, measure: say('1 łyżka tartego', '1 tbsp, grated') },
      { ingredient: 'spices', grams: 1, measure: say('oregano lub bazylia', 'oregano or basil') },
    ],
    steps: [
      say(
        'Ugotuj makaron według opakowania (zwykle 6–8 minut).',
        'Cook the pasta as the pack says (usually 6–8 minutes).',
      ),
      say(
        'W tym czasie zeszklij cebulę z czosnkiem na oliwie, dodaj pomidory i oregano, duś 5 minut.',
        'Meanwhile, soften the onion and garlic in the olive oil, add the tomatoes and oregano and simmer for 5 minutes.',
      ),
      say(
        'Wmieszaj tuńczyka, podgrzej i połącz z makaronem. Posyp parmezanem.',
        'Stir in the tuna, heat through and toss with the pasta. Sprinkle with parmesan.',
      ),
    ],
  },
  {
    id: 'burrito-bowl',
    name: say('Burrito bowl z indykiem', 'Turkey burrito bowl'),
    kind: 'obiad',
    minutes: 20,
    tool: say('Patelnia i garnek', 'Frying pan and pot'),
    description: say(
      'Wszystko, co w burrito najlepsze, ale w misce: przyprawiony indyk, fasola, odrobina ryżu i skyr zamiast śmietany.',
      'All the best bits of a burrito, but in a bowl: spiced turkey, beans, a little rice and skyr instead of sour cream.',
    ),
    items: [
      { ingredient: 'turkeyMince', grams: 200, measure: say('pół opakowania', 'half a pack') },
      { ingredient: 'rice', grams: 30, measure: say('2 łyżki (suchy)', '2 tbsp (uncooked)') },
      { ingredient: 'beans', grams: 50, measure: say('3 łyżki', '3 tbsp') },
      { ingredient: 'pepper', grams: 100, measure: say('pół papryki', 'half a pepper') },
      { ingredient: 'tomato', grams: 100, measure: say('1 mały pomidor', '1 small tomato') },
      { ingredient: 'skyr', grams: 60, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'lemon', grams: 10, measure: say('sok z ćwiartki limonki', 'juice of a quarter of a lime') },
      {
        ingredient: 'spices',
        grams: 3,
        measure: say('łyżeczka (kmin, papryka, chili)', '1 tsp (cumin, paprika, chilli)'),
      },
      { ingredient: 'oil', grams: 3, measure: say('łyżeczka', '1 tsp') },
    ],
    steps: [
      say('Ugotuj ryż (ok. 12 minut).', 'Cook the rice (about 12 minutes).'),
      say(
        'Na oliwie podsmaż mięso, rozbijając je łopatką, aż straci różowy kolor. Dodaj przyprawy, sól i paprykę w kostkę, smaż jeszcze 3 minuty.',
        'Fry the mince in the olive oil, breaking it up with a spatula, until no longer pink. Add the spices, salt and diced pepper and fry for 3 more minutes.',
      ),
      say(
        'Ułóż w misce ryż, mięso, odsączoną fasolę i pokrojonego pomidora. Skrop limonką i dodaj skyr.',
        'Arrange the rice, meat, drained beans and chopped tomato in a bowl. Squeeze over the lime and add the skyr.',
      ),
    ],
  },

  // ── Dłużej, w domu (ponad 20 minut, zwykle na kilka porcji) ─────────────
  {
    id: 'losos-brokuly',
    name: say('Łosoś pieczony z brokułami i sosem koperkowym', 'Baked salmon with broccoli and dill sauce'),
    kind: 'obiad',
    minutes: 25,
    servings: 2,
    tool: say('Piekarnik i blacha', 'Oven and baking tray'),
    description: say(
      'Łosoś i brokuły pieką się razem na jednej blasze. Sos ze skyru z koperkiem zamiast majonezu.',
      'Salmon and broccoli bake together on one tray. A skyr and dill sauce instead of mayonnaise.',
    ),
    items: [
      { ingredient: 'salmonFillet', grams: 300, measure: say('2 kawałki po 150 g', '2 pieces, 150 g each') },
      { ingredient: 'broccoli', grams: 400, measure: say('1 duży brokuł', '1 large head of broccoli') },
      { ingredient: 'oil', grams: 5, measure: say('łyżeczka', '1 tsp') },
      { ingredient: 'garlic', grams: 5, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'lemon', grams: 20, measure: say('sok z połowy cytryny', 'juice of half a lemon') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'dill', grams: 10, measure: say('pół pęczka', 'half a bunch') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Nagrzej piekarnik do 200°C. Brokuł podziel na różyczki, wymieszaj z oliwą, solą i pieprzem i rozłóż na blasze.',
        'Heat the oven to 200°C. Cut the broccoli into florets, toss with the olive oil, salt and pepper and spread on the tray.',
      ),
      say(
        'Ułóż obok łososia skórą do dołu, posól i skrop cytryną. Piecz 15–18 minut, aż ryba łatwo się rozdziela.',
        'Lay the salmon alongside, skin side down, salt it and sprinkle with lemon. Bake for 15–18 minutes until the fish flakes easily.',
      ),
      say(
        'W tym czasie wymieszaj skyr z posiekanym koperkiem, przeciśniętym czosnkiem, solą i odrobiną soku z cytryny.',
        'Meanwhile, mix the skyr with the chopped dill, crushed garlic, salt and a little lemon juice.',
      ),
    ],
  },
  {
    id: 'kurczak-curry',
    name: say('Kurczak curry na skyrze ze szpinakiem', 'Chicken and spinach skyr curry'),
    kind: 'obiad',
    minutes: 30,
    servings: 2,
    tool: say('Patelnia z wysokim brzegiem', 'Deep frying pan'),
    description: say(
      'Kremowe curry bez śmietany i mleka kokosowego: skyr daje gęstość i jeszcze więcej białka. Z odrobiną ryżu.',
      'A creamy curry with no cream or coconut milk: skyr makes it thick and adds even more protein. With a little rice.',
    ),
    items: [
      { ingredient: 'chickenFillet', grams: 400, measure: say('2 filety', '2 fillets') },
      { ingredient: 'onion', grams: 100, measure: say('1 cebula', '1 onion') },
      { ingredient: 'garlic', grams: 10, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'curry', grams: 8, measure: say('2 łyżeczki', '2 tsp') },
      { ingredient: 'cannedTomatoes', grams: 200, measure: say('pół puszki', 'half a tin') },
      { ingredient: 'spinach', grams: 100, measure: say('2 garści', '2 handfuls') },
      { ingredient: 'skyr', grams: 200, measure: say('1 duży kubek', '1 large pot') },
      { ingredient: 'oil', grams: 10, measure: say('łyżka', '1 tbsp') },
      { ingredient: 'rice', grams: 80, measure: say('1 woreczek (suchy)', '1 bag (uncooked)') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say('Ugotuj ryż. Kurczaka pokrój w kostkę i posól.', 'Cook the rice. Dice the chicken and salt it.'),
      say(
        'Na oleju zeszklij cebulę, dodaj czosnek i curry, smaż minutę. Wrzuć kurczaka i smaż 5 minut.',
        'Soften the onion in the oil, add the garlic and curry powder and fry for a minute. Add the chicken and fry for 5 minutes.',
      ),
      say(
        'Dodaj pomidory i duś pod przykryciem 10 minut. Wmieszaj szpinak, a gdy zwiędnie, zdejmij z ognia.',
        'Add the tomatoes, cover and simmer for 10 minutes. Stir in the spinach and, once it wilts, take off the heat.',
      ),
      say(
        'Skyr wmieszaj dopiero poza ogniem, żeby się nie zważył. Podawaj z ryżem.',
        'Stir in the skyr only off the heat so it does not curdle. Serve with the rice.',
      ),
    ],
  },
  {
    id: 'dorsz-pomidory',
    name: say('Dorsz zapiekany w pomidorach z cukinią', 'Cod baked in tomatoes with courgette'),
    kind: 'obiad',
    minutes: 35,
    servings: 2,
    tool: say('Naczynie żaroodporne', 'Ovenproof dish'),
    description: say(
      'Chuda biała ryba zapiekana w pomidorach z czosnkiem i oregano. Lekko, a na porcję ponad 50 g białka.',
      'Lean white fish baked in tomatoes with garlic and oregano. Light, with over 50 g of protein a serving.',
    ),
    items: [
      { ingredient: 'whiteFish', grams: 500, measure: say('2–3 filety, rozmrożone', '2–3 fillets, thawed') },
      { ingredient: 'cannedTomatoes', grams: 400, measure: say('1 puszka', '1 tin') },
      { ingredient: 'zucchini', grams: 300, measure: say('1 cukinia', '1 courgette') },
      { ingredient: 'onion', grams: 80, measure: say('1 mała cebula', '1 small onion') },
      { ingredient: 'garlic', grams: 10, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'oil', grams: 10, measure: say('łyżka', '1 tbsp') },
      { ingredient: 'parmesan', grams: 20, measure: say('2 łyżki tartego', '2 tbsp, grated') },
      { ingredient: 'spices', grams: 3, measure: say('łyżeczka oregano', '1 tsp oregano') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Nagrzej piekarnik do 200°C. Na oliwie zeszklij cebulę z czosnkiem, dodaj pomidory i oregano, duś 5 minut.',
        'Heat the oven to 200°C. Soften the onion and garlic in the olive oil, add the tomatoes and oregano and simmer for 5 minutes.',
      ),
      say(
        'Wlej sos do naczynia, ułóż na nim cukinię w plasterkach i rybę, posól i popieprz.',
        'Pour the sauce into the dish, lay the sliced courgette and the fish on top, and season with salt and pepper.',
      ),
      say(
        'Posyp parmezanem i piecz 18–20 minut, aż ryba będzie biała i krucha.',
        'Sprinkle with parmesan and bake for 18–20 minutes until the fish is white and flaky.',
      ),
    ],
  },
  {
    id: 'chili-indyk',
    name: say('Chili z indyka', 'Turkey chilli'),
    kind: 'obiad',
    minutes: 40,
    servings: 3,
    tool: say('Duży garnek', 'Large pot'),
    description: say(
      'Gęste, rozgrzewające chili z mielonego indyka. Fasoli jest tylko trochę, żeby białko wygrało – następnego dnia smakuje jeszcze lepiej.',
      'A thick, warming chilli of minced turkey. Only a few beans, so protein wins – it tastes even better the next day.',
    ),
    items: [
      { ingredient: 'turkeyMince', grams: 500, measure: say('1 opakowanie', '1 pack') },
      { ingredient: 'onion', grams: 150, measure: say('1 duża cebula', '1 large onion') },
      { ingredient: 'pepper', grams: 300, measure: say('2 papryki', '2 peppers') },
      { ingredient: 'garlic', grams: 15, measure: say('3 ząbki', '3 cloves') },
      { ingredient: 'cannedTomatoes', grams: 400, measure: say('1 puszka', '1 tin') },
      { ingredient: 'beans', grams: 120, measure: say('pół puszki, odsączonej', 'half a tin, drained') },
      {
        ingredient: 'spices',
        grams: 10,
        measure: say('łyżka (kmin, papryka wędzona, chili)', '1 tbsp (cumin, smoked paprika, chilli)'),
      },
      { ingredient: 'oil', grams: 10, measure: say('łyżka', '1 tbsp') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'W dużym garnku rozgrzej olej, zeszklij posiekaną cebulę, dodaj mięso i smaż, rozbijając je łopatką, aż straci różowy kolor.',
        'Heat the oil in a large pot, soften the chopped onion, add the mince and fry, breaking it up with a spatula, until no longer pink.',
      ),
      say(
        'Dodaj czosnek i przyprawy, smaż minutę, aż zapachną. Wrzuć paprykę w kostkę.',
        'Add the garlic and spices and fry for a minute until fragrant. Add the diced peppers.',
      ),
      say(
        'Dodaj pomidory, przykryj i duś 20 minut na małym ogniu. Na ostatnie 5 minut wsyp odsączoną fasolę i dopraw solą.',
        'Add the tomatoes, cover and simmer for 20 minutes over a low heat. Add the drained beans for the last 5 minutes and season with salt.',
      ),
    ],
  },
  {
    id: 'kurczak-pieczony',
    name: say('Pieczony filet z kurczaka z warzywami', 'Roast chicken fillets with vegetables'),
    kind: 'obiad',
    minutes: 45,
    servings: 2,
    tool: say('Piekarnik i blacha', 'Oven and baking tray'),
    description: say(
      'Kurczak z papryką, cukinią i czerwoną cebulą z jednej blachy. Robisz raz, jesz dwa razy – świetny do pudełka.',
      'Chicken with peppers, courgette and red onion from one tray. Cook once, eat twice – great for a lunch box.',
    ),
    items: [
      { ingredient: 'chickenFillet', grams: 500, measure: say('2 duże filety', '2 large fillets') },
      { ingredient: 'pepper', grams: 300, measure: say('2 papryki', '2 peppers') },
      { ingredient: 'zucchini', grams: 300, measure: say('1 cukinia', '1 courgette') },
      { ingredient: 'onion', grams: 150, measure: say('2 czerwone cebule', '2 red onions') },
      { ingredient: 'garlic', grams: 15, measure: say('3 ząbki', '3 cloves') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'lemon', grams: 20, measure: say('sok z połowy cytryny', 'juice of half a lemon') },
      {
        ingredient: 'spices',
        grams: 6,
        measure: say('2 łyżeczki (papryka, czosnek, zioła)', '2 tsp (paprika, garlic, herbs)'),
      },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Nagrzej piekarnik do 200°C. Filety natrzyj połową oliwy, przyprawami, solą i sokiem z cytryny; najlepiej odstaw na 15 minut.',
        'Heat the oven to 200°C. Rub the fillets with half the oil, the spices, salt and lemon juice; ideally leave them for 15 minutes.',
      ),
      say(
        'Warzywa pokrój w duże kawałki, wymieszaj z resztą oliwy i czosnkiem i rozłóż na blasze, a na wierzchu połóż filety.',
        'Cut the vegetables into large pieces, toss with the rest of the oil and the garlic, spread on the tray and lay the fillets on top.',
      ),
      say(
        'Piecz 25 minut, aż sok z kurczaka będzie przezroczysty. Odstaw na 5 minut przed krojeniem – zostanie soczysty.',
        'Roast for 25 minutes until the chicken juices run clear. Rest for 5 minutes before slicing – it stays juicy.',
      ),
    ],
  },
  {
    id: 'pulpety-indyk',
    name: say('Pulpety z indyka w sosie pomidorowym', 'Turkey meatballs in tomato sauce'),
    kind: 'obiad',
    minutes: 45,
    servings: 3,
    tool: say('Garnek z pokrywką', 'Pot with a lid'),
    description: say(
      'Delikatne pulpety z indyka gotowane w sosie pomidorowym z czosnkiem. Płatki owsiane zamiast bułki.',
      'Tender turkey meatballs simmered in a garlicky tomato sauce. Oats instead of bread.',
    ),
    items: [
      { ingredient: 'turkeyMince', grams: 500, measure: say('1 opakowanie', '1 pack') },
      { ingredient: 'eggWhites', grams: 60, measure: say('białka z 2 jaj', 'whites of 2 eggs') },
      { ingredient: 'oats', grams: 30, measure: say('3 łyżki', '3 tbsp') },
      { ingredient: 'onion', grams: 100, measure: say('1 cebula', '1 onion') },
      { ingredient: 'garlic', grams: 10, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'passata', grams: 500, measure: say('1 butelka', '1 bottle') },
      {
        ingredient: 'spices',
        grams: 6,
        measure: say('2 łyżeczki (majeranek, papryka, bazylia)', '2 tsp (marjoram, paprika, basil)'),
      },
      { ingredient: 'oil', grams: 5, measure: say('łyżeczka', '1 tsp') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Połowę cebuli zetrzyj na tarce i wymieszaj z mięsem, białkami, płatkami, solą, pieprzem i połową przypraw. Mokrymi dłońmi uformuj 15–18 kulek.',
        'Grate half the onion and mix it with the meat, egg whites, oats, salt, pepper and half the spices. With wet hands, shape 15–18 balls.',
      ),
      say(
        'W garnku zeszklij resztę cebuli z czosnkiem na oliwie, wlej passatę z resztą przypraw i zagotuj.',
        'In the pot, soften the rest of the onion with the garlic in the olive oil, pour in the passata with the rest of the spices and bring to the boil.',
      ),
      say(
        'Włóż pulpety do sosu, przykryj i gotuj na małym ogniu 25 minut, delikatnie mieszając raz czy dwa.',
        'Add the meatballs to the sauce, cover and simmer over a low heat for 25 minutes, stirring gently once or twice.',
      ),
    ],
  },
  {
    id: 'sernik-proteinowy',
    name: say('Sernik proteinowy pieczony', 'Baked protein cheesecake'),
    kind: 'miska',
    minutes: 70,
    servings: 8,
    tool: say('Piekarnik, forma 20–22 cm i blender', 'Oven, 20–22 cm tin and blender'),
    description: say(
      'Prawdziwy pieczony sernik, tylko bez spodu i cukru: twaróg, jajka i białko w proszku. Kawałek ma ponad 30 g białka.',
      'A real baked cheesecake, just without the base or sugar: quark, eggs and protein powder. A slice has over 30 g of protein.',
    ),
    items: [
      { ingredient: 'quark', grams: 1000, measure: say('1 kg (4–5 kostek)', '1 kg (4–5 packs)') },
      { ingredient: 'egg', grams: 150, measure: say('3 jajka', '3 eggs') },
      { ingredient: 'eggWhites', grams: 90, measure: say('białka z 3 jaj', 'whites of 3 eggs') },
      { ingredient: 'whey', grams: 60, measure: say('2 miarki (waniliowe)', '2 scoops (vanilla)') },
      { ingredient: 'sweetener', grams: 40, measure: say('4 łyżki, do smaku', '4 tbsp, to taste') },
      { ingredient: 'potatoStarch', grams: 20, measure: say('2 łyżki', '2 tbsp') },
      {
        ingredient: 'lemon',
        grams: 20,
        measure: say('sok i skórka z połowy cytryny', 'juice and zest of half a lemon'),
      },
    ],
    steps: [
      say(
        'Nagrzej piekarnik do 160°C, dno formy wyłóż papierem do pieczenia.',
        'Heat the oven to 160°C and line the base of the tin with baking paper.',
      ),
      say(
        'Zmiksuj twaróg na gładką masę. Dodaj jajka, białka, białko w proszku, słodzik, mąkę ziemniaczaną oraz sok i skórkę z cytryny; zmiksuj krótko, tylko do połączenia.',
        'Blend the quark until smooth. Add the eggs, egg whites, protein powder, sweetener, potato starch and the lemon juice and zest; blend briefly, just until combined.',
      ),
      say(
        'Przelej do formy i piecz 50–55 minut, aż brzegi się zetną, a środek lekko drga. Wystudź w uchylonym piekarniku, potem schłodź w lodówce, najlepiej przez noc.',
        'Pour into the tin and bake for 50–55 minutes until the edges are set and the centre still wobbles slightly. Cool in the oven with the door ajar, then chill in the fridge, ideally overnight.',
      ),
    ],
  },
  {
    id: 'gulasz-wolowy',
    name: say('Chudy gulasz wołowy z pieczarkami', 'Lean beef goulash with mushrooms'),
    kind: 'obiad',
    minutes: 90,
    servings: 3,
    tool: say('Garnek z grubym dnem', 'Heavy-based pot'),
    description: say(
      'Wołowina duszona do miękkości z papryką, pieczarkami i słodką papryką. Dusi się długo, ale sama – pracy jest kwadrans.',
      'Beef braised until tender with peppers, mushrooms and sweet paprika. It takes a long time, but cooks itself – the work is a quarter of an hour.',
    ),
    items: [
      { ingredient: 'leanBeef', grams: 600, measure: say('600 g, np. udziec', '600 g, e.g. topside') },
      { ingredient: 'onion', grams: 200, measure: say('2 cebule', '2 onions') },
      { ingredient: 'pepper', grams: 200, measure: say('1 duża papryka', '1 large pepper') },
      { ingredient: 'mushrooms', grams: 250, measure: say('1 opakowanie', '1 pack') },
      { ingredient: 'garlic', grams: 10, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'passata', grams: 200, measure: say('pół butelki', 'half a bottle') },
      {
        ingredient: 'spices',
        grams: 8,
        measure: say(
          '2 łyżeczki (papryka słodka i ostra, kminek, majeranek)',
          '2 tsp (sweet and hot paprika, caraway, marjoram)',
        ),
      },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'water', grams: 400, measure: say('2 szklanki', '2 cups') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Pokrój wołowinę w kostkę 2–3 cm, osusz i obsmaż partiami na rozgrzanym oleju, aż się zrumieni. Przełóż do garnka.',
        'Cut the beef into 2–3 cm cubes, pat dry and brown in batches in hot oil. Transfer to the pot.',
      ),
      say(
        'Na tej samej patelni zeszklij cebulę, dodaj czosnek i przyprawy, a po minucie przełóż do mięsa. Wlej wodę i duś pod przykryciem 50 minut.',
        'In the same pan, soften the onion, add the garlic and spices, and after a minute add it all to the meat. Pour in the water, cover and simmer for 50 minutes.',
      ),
      say(
        'Dodaj paprykę, pieczarki i passatę i duś jeszcze 25–30 minut, aż mięso będzie miękkie. Dopraw solą i pieprzem.',
        'Add the peppers, mushrooms and passata and simmer for another 25–30 minutes until the meat is tender. Season with salt and pepper.',
      ),
    ],
  },
  ...FROM_ONLINE_SHOPS,
  ...CLASSICS,
];
