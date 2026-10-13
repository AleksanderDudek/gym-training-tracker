// Every recipe passes its rule on TYPICAL values (catalog.test.ts), so it does
// not depend on a lucky product to be high-protein; each store's actual
// products are then checked again. Grams are for the WHOLE recipe: a pot of
// chili is cooked for three, and the card divides it into servings.

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
}

export function servingsOf(recipe: Recipe): number {
  return recipe.servings ?? 1;
}

export const KIND_LABELS: Record<RecipeKind, string> = {
  // Bought and eaten as it is: no cooking, no dishes.
  gotowiec: 'Gotowiec',
  mix: 'Szybki mix',
  shake: 'Shake',
  // Skyr bowls, puddings, pancakes and a baked cheesecake: what they share is
  // that they are sweet, not that they are eaten with a spoon.
  miska: 'Na słodko',
  slone: 'Na słono',
  obiad: 'Obiad',
};

/** The tool of a gotowiec: at most a spoon or a fork, straight from the pack. */
export const NO_DISHES = 'Bez naczyń';

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
    name: 'Banan i baton białkowy',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Szybkie węglowodany z banana i białko z batonu – przed treningiem albo w drodze.',
    items: [
      { ingredient: 'banana', grams: 120, measure: '1 banan' },
      { ingredient: 'proteinBar', grams: 45, measure: '1 baton', pack: true },
    ],
    steps: ['Obierz banana, otwórz baton – i tyle.'],
  },
  {
    id: 'napoj-banan',
    name: 'Napój proteinowy i banan',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Butelka białka i owoc do ręki – śniadanie w biegu albo coś zaraz po treningu.',
    items: [
      { ingredient: 'proteinDrink', grams: 250, measure: '1 butelka', pack: true },
      { ingredient: 'banana', grams: 120, measure: '1 banan' },
    ],
    steps: ['Wstrząśnij butelkę i pij, banana zjedz obok.'],
  },
  {
    id: 'skyr-borowki-kubek',
    name: 'Skyr z borówkami prosto z kubka',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Kubek białka i garść owoców, jedzone łyżeczką z opakowania.',
    items: [
      { ingredient: 'skyr', grams: 150, measure: '1 mały kubek' },
      { ingredient: 'blueberries', grams: 75, measure: 'garść świeżych' },
    ],
    steps: ['Wsyp borówki do kubka skyru i jedz łyżeczką.'],
  },
  {
    id: 'serek-bulka',
    name: 'Serek wiejski z bułką grahamką',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Klasyk z osiedlowego sklepu: ponad 25 g białka i coś do pogryzienia.',
    items: [
      { ingredient: 'cottage', grams: 200, measure: '1 opakowanie' },
      { ingredient: 'roll', grams: 60, measure: '1 bułka' },
    ],
    steps: ['Otwórz serek i jedz łyżeczką, zagryzając bułką.'],
  },
  {
    id: 'serek-pomidorki',
    name: 'Serek wiejski z pomidorkami koktajlowymi',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Na słono i bez noża: pomidorki koktajlowe je się w całości.',
    items: [
      { ingredient: 'cottage', grams: 200, measure: '1 opakowanie' },
      { ingredient: 'tomato', grams: 150, measure: 'garść pomidorków koktajlowych' },
    ],
    steps: ['Opłucz pomidorki i jedz na zmianę z serkiem.'],
  },
  {
    id: 'jogurt-jablko',
    name: 'Jogurt proteinowy i jabłko',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Słodka przekąska do torby: kubek z łyżeczką i owoc.',
    items: [
      { ingredient: 'proteinYogurt', grams: 200, measure: '1 kubek' },
      { ingredient: 'apple', grams: 150, measure: '1 jabłko' },
    ],
    steps: ['Jogurt jedz łyżeczką z kubka, jabłko obok.'],
  },
  {
    id: 'kurczak-wafle',
    name: 'Kurczak w plastrach na waflach ryżowych',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Chuda wędlina z piersi na chrupiących waflach – kanapki bez talerza i bez noża.',
    items: [
      { ingredient: 'chicken', grams: 100, measure: '1 opakowanie plastrów' },
      { ingredient: 'riceCakes', grams: 30, measure: '3 wafle' },
    ],
    steps: ['Połóż plastry na waflach i jedz jak kanapki.'],
  },
  {
    id: 'losos-pieczywo',
    name: 'Łosoś wędzony na pieczywie chrupkim',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Ponad 20 g białka i tłuszcze z ryby – kolacja, po której nie ma czego zmywać.',
    items: [
      { ingredient: 'smokedSalmon', grams: 100, measure: '1 opakowanie' },
      { ingredient: 'crispbread', grams: 30, measure: '3 kromki' },
    ],
    steps: ['Rozłóż plastry łososia na kromkach.'],
  },
  {
    id: 'tunczyk-wafle',
    name: 'Tuńczyk z puszki z waflami ryżowymi',
    kind: 'gotowiec',
    minutes: 2,
    tool: NO_DISHES,
    description: 'Puszka z otwieraczem i paczka wafli – białkowy obiad w podróży.',
    items: [
      { ingredient: 'tuna', grams: 120, measure: '1 puszka, odsączona' },
      { ingredient: 'riceCakes', grams: 30, measure: '3 wafle' },
    ],
    steps: ['Otwórz puszkę i odlej zalewę.', 'Nakładaj tuńczyka widelcem na wafle.'],
  },
  {
    id: 'baton-napoj',
    name: 'Baton białkowy i napój proteinowy',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Najwięcej białka bez gotowania – po treningu, gdy do domu daleko.',
    items: [
      { ingredient: 'proteinBar', grams: 45, measure: '1 baton', pack: true },
      { ingredient: 'proteinDrink', grams: 250, measure: '1 butelka', pack: true },
    ],
    steps: ['Wypij napój, zjedz baton.'],
  },
  {
    id: 'kefir-bulka',
    name: 'Kefir z bułką grahamką',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Śniadanie w drodze po polsku: chłodny kefir z butelki i bułka.',
    items: [
      { ingredient: 'kefir', grams: 400, measure: '1 butelka' },
      { ingredient: 'roll', grams: 60, measure: '1 bułka' },
    ],
    steps: ['Pij kefir z butelki, zagryzaj bułką.'],
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
    name: 'Roślinne kabanosy i serek wiejski',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Roślinne kabanosy mają tyle białka co mięsne, a serek dokłada drugie tyle – bez gotowania.',
    items: [
      { ingredient: 'plantDeli', grams: 80, measure: 'pół opakowania kabanosów' },
      { ingredient: 'cottage', grams: 200, measure: '1 opakowanie' },
    ],
    steps: ['Jedz kabanosy na zmianę z serkiem prosto z opakowania.'],
  },
  {
    id: 'chipsy-bialkowe-napoj',
    name: 'Chipsy białkowe i napój proteinowy',
    kind: 'gotowiec',
    minutes: 1,
    tool: NO_DISHES,
    description: 'Słona przekąska z białkiem zamiast zwykłych chipsów, do tego butelka białka.',
    items: [
      { ingredient: 'proteinCrisps', grams: 30, measure: '1 paczka', pack: true },
      { ingredient: 'proteinDrink', grams: 250, measure: '1 butelka', pack: true },
    ],
    steps: ['Otwórz paczkę i butelkę – i tyle.'],
  },
  {
    id: 'jogurt-maslo-w-proszku',
    name: 'Jogurt proteinowy z masłem orzechowym w proszku',
    kind: 'miska',
    minutes: 2,
    tool: 'Łyżka',
    description: 'Smak masła orzechowego za ułamek jego tłuszczu: proszek ma białka jak odżywka.',
    items: [
      { ingredient: 'proteinYogurt', grams: 200, measure: '1 kubek' },
      { ingredient: 'peanutPowder', grams: 15, measure: '1 czubata łyżka' },
      { ingredient: 'raspberries', grams: 50, measure: 'pół garści' },
    ],
    steps: ['Wmieszaj proszek w jogurt na gładki krem.', 'Posyp malinami.'],
  },
  {
    id: 'ciasto-w-kubku',
    name: 'Białkowe ciasto w kubku',
    kind: 'miska',
    minutes: 3,
    tool: 'Kubek i mikrofala',
    description: 'Ciepłe ciasto w półtorej minuty: mieszanka, odrobina mleka i mikrofala.',
    items: [
      { ingredient: 'mugCake', grams: 40, measure: '4 łyżki' },
      { ingredient: 'milk', grams: 60, measure: '4 łyżki' },
    ],
    steps: [
      'Wymieszaj w dużym kubku mieszankę z mlekiem na gęste ciasto bez grudek.',
      'Piecz w mikrofali 60–90 sekund na pełnej mocy – ma zostać lekko wilgotne w środku.',
    ],
  },
  {
    id: 'shake-roslinny-banan',
    name: 'Wegański shake z białkiem roślinnym, bananem i kakao',
    kind: 'shake',
    minutes: 3,
    tool: 'Blender lub shaker',
    description: 'Bez nabiału: białko z grochu, ryżu albo pestek dyni, banan dla smaku i kakao.',
    items: [
      { ingredient: 'plantProtein', grams: 40, measure: '1,5 miarki' },
      { ingredient: 'banana', grams: 100, measure: 'mały banan' },
      { ingredient: 'cocoa', grams: 5, measure: '1 łyżeczka' },
      { ingredient: 'water', grams: 300, measure: '1,5 szklanki zimnej wody' },
    ],
    steps: ['Zmiksuj wszystko przez 30 sekund.', 'W shakerze: banana rozgnieć widelcem albo zjedz obok.'],
  },
  {
    id: 'skyr-maliny-syrop-zero',
    name: 'Skyr z malinami i syropem zero',
    kind: 'miska',
    minutes: 2,
    tool: 'Łyżka',
    description: 'Deser z ponad 20 g białka: syrop bez cukru daje smak karmelu czy wanilii za 1 kcal.',
    items: [
      { ingredient: 'skyr', grams: 200, measure: 'duży kubek' },
      { ingredient: 'raspberries', grams: 80, measure: 'garść' },
      { ingredient: 'zeroSyrup', grams: 15, measure: '1 łyżka' },
    ],
    steps: ['Przełóż skyr do miseczki albo jedz z kubka.', 'Dodaj maliny i polej syropem.'],
  },
  {
    id: 'kurczak-chili-ryz-konjac',
    name: 'Kurczak w sosie słodkie chili zero z ryżem konjac',
    kind: 'obiad',
    minutes: 15,
    tool: 'Patelnia',
    description: 'Smak słodko-ostrego dania z chińskiej budki: sos bez cukru, ryż konjac prawie bez kalorii.',
    items: [
      { ingredient: 'konjac', grams: 200, measure: '1 opakowanie ryżu konjac, odsączone' },
      { ingredient: 'chickenFillet', grams: 150, measure: '1 mały filet' },
      { ingredient: 'pepper', grams: 100, measure: '1 mała papryka' },
      { ingredient: 'zeroSauce', grams: 40, measure: '2 łyżki' },
      { ingredient: 'oil', grams: 5, measure: '1 łyżeczka' },
    ],
    steps: [
      'Przepłucz ryż konjac i podsmaż go 2 minuty na suchej patelni.',
      'Na oleju usmaż pokrojonego kurczaka z papryką, aż się zrumieni.',
      'Dodaj sos, wymieszaj z ryżem i podgrzej jeszcze minutę.',
    ],
  },
  {
    id: 'tosty-szynka-roslinna',
    name: 'Tosty białkowe z roślinną szynką i pomidorem',
    kind: 'slone',
    minutes: 6,
    tool: 'Toster lub patelnia',
    description: 'Chleb keto ma trzy razy więcej białka niż zwykły – z roślinną szynką to ponad 40 g na talerz.',
    items: [
      { ingredient: 'proteinBread', grams: 80, measure: '3 kromki' },
      { ingredient: 'plantDeli', grams: 60, measure: 'pół opakowania' },
      { ingredient: 'tomato', grams: 100, measure: '1 pomidor' },
    ],
    steps: ['Opiecz kromki w tosterze albo na suchej patelni.', 'Połóż szynkę i plastry pomidora, dopraw pieprzem.'],
  },
  {
    id: 'tosty-twarozek-rzodkiewka',
    name: 'Tosty białkowe z twarożkiem i rzodkiewką',
    kind: 'slone',
    minutes: 5,
    tool: 'Toster i miska',
    description: 'Klasyczny twarożek ze szczypiorkiem na chlebie, który sam ma 29 g białka w 100 g.',
    items: [
      { ingredient: 'proteinBread', grams: 80, measure: '3 kromki' },
      { ingredient: 'quark', grams: 150, measure: 'pół kostki' },
      { ingredient: 'radish', grams: 50, measure: '4 rzodkiewki' },
      { ingredient: 'chives', grams: 5, measure: 'kilka źdźbeł' },
    ],
    steps: [
      'Rozgnieć twaróg z odrobiną wody, wymieszaj z posiekanym szczypiorkiem, dopraw solą i pieprzem.',
      'Opiecz kromki, posmaruj twarożkiem i połóż plasterki rzodkiewki.',
    ],
  },
  {
    id: 'nalesniki-bialkowe-mieszanka',
    name: 'Białkowe naleśniki z mieszanki ze skyrem i borówkami',
    kind: 'miska',
    minutes: 12,
    tool: 'Patelnia',
    description: 'Naleśniki, które same są białkowe – mieszanka ma ponad połowę białka. Skyr zamiast bitej śmietany.',
    items: [
      { ingredient: 'proteinPancakeMix', grams: 50, measure: '5 łyżek' },
      { ingredient: 'milk', grams: 100, measure: 'pół szklanki' },
      { ingredient: 'skyr', grams: 100, measure: 'pół kubka' },
      { ingredient: 'blueberries', grams: 50, measure: 'pół garści' },
    ],
    steps: [
      'Wymieszaj mieszankę z mlekiem na gładkie ciasto i odstaw na 2 minuty.',
      'Smaż małe placki na lekko natłuszczonej patelni po 1–2 minuty z każdej strony.',
      'Podawaj ze skyrem i borówkami.',
    ],
  },
  {
    id: 'wrap-keto-kebab',
    name: 'Wrap keto z roślinnym kebabem i warzywami',
    kind: 'slone',
    minutes: 10,
    tool: 'Patelnia',
    description: 'Kebab bez mięsa w niskowęglowodanowej tortilli – więcej białka niż tłuszczu, mimo sosu.',
    items: [
      { ingredient: 'ketoTortilla', grams: 40, measure: '1 placek' },
      { ingredient: 'plantMeat', grams: 80, measure: 'pół opakowania' },
      { ingredient: 'tomato', grams: 60, measure: 'pół pomidora' },
      { ingredient: 'cucumber', grams: 60, measure: 'kawałek ogórka' },
    ],
    steps: [
      'Podsmaż roślinny kebab na suchej patelni 3–4 minuty, aż się zrumieni.',
      'Ogrzej tortillę 20 sekund na tej samej patelni.',
      'Ułóż kebab i pokrojone warzywa, zawiń.',
    ],
  },
  {
    id: 'konjac-kurczak-pomidory',
    name: 'Makaron konjac z kurczakiem w sosie pomidorowym',
    kind: 'obiad',
    minutes: 15,
    tool: 'Patelnia',
    description: 'Talerz makaronu za kilkanaście kalorii: konjac ma ich prawie zero, białko daje kurczak.',
    items: [
      { ingredient: 'konjac', grams: 200, measure: '1 opakowanie, odsączone' },
      { ingredient: 'chickenFillet', grams: 150, measure: '1 mały filet' },
      { ingredient: 'passata', grams: 150, measure: '3/4 szklanki' },
      { ingredient: 'garlic', grams: 5, measure: '1 ząbek' },
      { ingredient: 'parmesan', grams: 10, measure: '1 łyżka tartego' },
      { ingredient: 'oil', grams: 5, measure: '1 łyżeczka' },
    ],
    steps: [
      'Przepłucz konjac pod zimną wodą i podsmaż go 2 minuty na suchej patelni, żeby odparował.',
      'Na oleju zrumień pokrojonego kurczaka z czosnkiem, wlej passatę i duś 5 minut.',
      'Wymieszaj z makaronem, posyp parmezanem.',
    ],
  },
  {
    id: 'keto-penne-boczek',
    name: 'Keto penne z roślinnym boczkiem i pomidorami',
    kind: 'obiad',
    minutes: 15,
    tool: 'Garnek i patelnia',
    description: 'Makaron, który ma 36 g białka w 100 g, i boczek bez mięsa – obiad z ponad 50 g białka.',
    items: [
      { ingredient: 'ketoPasta', grams: 80, measure: '1/3 opakowania' },
      { ingredient: 'plantDeli', grams: 100, measure: '1 opakowanie boczku' },
      { ingredient: 'cannedTomatoes', grams: 200, measure: 'pół puszki' },
      { ingredient: 'onion', grams: 50, measure: 'pół cebuli' },
      { ingredient: 'garlic', grams: 5, measure: '1 ząbek' },
      { ingredient: 'oil', grams: 5, measure: '1 łyżeczka' },
    ],
    steps: [
      'Ugotuj makaron według opakowania.',
      'Na oleju zeszklij cebulę z czosnkiem, dodaj pokrojony boczek i smaż 2 minuty.',
      'Wlej pomidory, duś 5 minut, wymieszaj z makaronem.',
    ],
  },
  {
    id: 'pizza-keto-pepperoni',
    name: 'Pizza na keto spodzie z roślinnym pepperoni',
    kind: 'obiad',
    minutes: 15,
    tool: 'Piekarnik',
    description: 'Gotowy spód keto, passata, pepperoni bez mięsa i parmezan – pizza, w której białko wygrywa.',
    items: [
      { ingredient: 'ketoPizzaBase', grams: 100, measure: '1 spód' },
      { ingredient: 'plantDeli', grams: 60, measure: 'pół opakowania pepperoni' },
      { ingredient: 'passata', grams: 60, measure: '4 łyżki' },
      { ingredient: 'parmesan', grams: 15, measure: '1,5 łyżki tartego' },
    ],
    steps: [
      'Rozgrzej piekarnik do 220°C.',
      'Posmaruj spód passatą, ułóż pepperoni i posyp parmezanem.',
      'Piecz 8–10 minut, aż brzegi się zrumienią.',
    ],
  },
];

export const RECIPES: Recipe[] = [
  ...GOTOWCE,
  {
    id: 'bialko-woda',
    name: 'Białko z wodą',
    kind: 'mix',
    minutes: 1,
    tool: 'Shaker',
    description: 'Najprostszy możliwy posiłek białkowy – po treningu albo w drodze.',
    items: [
      { ingredient: 'whey', grams: 30, measure: '1 miarka' },
      { ingredient: 'water', grams: 300, measure: '1,5 szklanki' },
    ],
    steps: ['Wlej zimną wodę do shakera, wsyp białko.', 'Zakręć i mocno potrząśnij przez 15 sekund.'],
  },
  {
    id: 'bialko-mleko',
    name: 'Białko z mlekiem',
    kind: 'mix',
    minutes: 1,
    tool: 'Shaker',
    description: 'Gęstszy i bardziej sycący od wersji na wodzie, smakuje jak koktajl mleczny.',
    items: [
      { ingredient: 'whey', grams: 30, measure: '1 miarka' },
      { ingredient: 'milk', grams: 300, measure: '1,5 szklanki' },
    ],
    steps: ['Wlej zimne mleko do shakera, wsyp białko.', 'Zakręć i potrząsaj przez 15–20 sekund.'],
  },
  {
    id: 'skyr-maliny',
    name: 'Skyr z białkiem i malinami',
    kind: 'miska',
    minutes: 3,
    tool: 'Miska i łyżka',
    description: 'Gęsty, kremowy deser na łyżkę – maliny z zamrażarki robią się jak sos.',
    items: [
      { ingredient: 'skyr', grams: 200, measure: 'duży kubek' },
      { ingredient: 'whey', grams: 15, measure: 'pół miarki' },
      { ingredient: 'raspberries', grams: 100, measure: 'garść' },
    ],
    steps: [
      'Wymieszaj skyr z białkiem na gładki krem.',
      'Dodaj mrożone maliny. Poczekaj kilka minut albo podgrzej je 30 sekund w mikrofali – puszczą sok.',
    ],
  },
  {
    id: 'shake-truskawkowy',
    name: 'Shake truskawkowy ze skyrem',
    kind: 'shake',
    minutes: 3,
    tool: 'Blender',
    description: 'Gęsty, owocowy koktajl z cynamonem – jak milkshake, a ma ponad 40 g białka.',
    items: [
      { ingredient: 'skyr', grams: 150, measure: '1 mały kubek' },
      { ingredient: 'whey', grams: 30, measure: '1 miarka' },
      { ingredient: 'water', grams: 200, measure: 'szklanka' },
      { ingredient: 'strawberries', grams: 150, measure: '2 garści' },
      { ingredient: 'cinnamon', grams: 1, measure: 'szczypta' },
    ],
    steps: [
      'Wrzuć wszystko do blendera – mrożone truskawki dadzą gęstość i chłód.',
      'Miksuj 30–40 sekund do gładkości. Za gęsty? Dolej odrobinę wody.',
    ],
  },
  {
    id: 'lody-maliny',
    name: 'Lody z malin i skyru',
    kind: 'miska',
    minutes: 3,
    tool: 'Blender',
    description: 'Mrożone maliny zmiksowane ze skyrem dają konsystencję lodów włoskich.',
    items: [
      { ingredient: 'raspberries', grams: 150, measure: '1,5 garści' },
      { ingredient: 'skyr', grams: 150, measure: '1 mały kubek' },
      { ingredient: 'whey', grams: 25, measure: 'niepełna miarka' },
    ],
    steps: [
      'Zmiksuj prosto zamrożone maliny ze skyrem i białkiem, zgarniając masę ze ścianek.',
      'Jedz od razu – po 10 minutach to już koktajl.',
    ],
  },
  {
    id: 'kefir-shake',
    name: 'Kefir z białkiem i truskawkami',
    kind: 'shake',
    minutes: 2,
    tool: 'Blender lub shaker',
    description: 'Lekko kwaśny, orzeźwiający – dobry na śniadanie albo po treningu.',
    items: [
      { ingredient: 'kefir', grams: 300, measure: '1 mała butelka' },
      { ingredient: 'whey', grams: 25, measure: 'niepełna miarka' },
      { ingredient: 'strawberries', grams: 100, measure: 'garść' },
    ],
    steps: ['Zmiksuj wszystko przez 20 sekund.', 'W shakerze bez owoców też działa – wtedy dodaj je osobno.'],
  },
  {
    id: 'kawa-proteinowa',
    name: 'Mrożona kawa proteinowa',
    kind: 'shake',
    minutes: 3,
    tool: 'Shaker',
    description: 'Kawa mrożona jak z kawiarni, tylko zamiast syropu – 25 g białka.',
    items: [
      { ingredient: 'coffee', grams: 100, measure: 'podwójne espresso' },
      { ingredient: 'milk', grams: 150, measure: '3/4 szklanki' },
      { ingredient: 'whey', grams: 25, measure: 'niepełna miarka (najlepiej waniliowe)' },
      { ingredient: 'ice', grams: 100, measure: 'garść kostek' },
    ],
    steps: [
      'Zaparz kawę i wystudź ją chwilę albo od razu wlej na lód.',
      'Wstrząśnij mleko z białkiem w shakerze i wlej na kawę z lodem.',
    ],
  },
  {
    id: 'jogurt-borowki',
    name: 'Jogurt proteinowy z borówkami',
    kind: 'miska',
    minutes: 1,
    tool: 'Łyżka',
    description: 'Zero przygotowania: gotowy kubek białka i garść owoców.',
    items: [
      { ingredient: 'proteinYogurt', grams: 200, measure: '1 kubek' },
      { ingredient: 'blueberries', grams: 50, measure: 'pół garści' },
    ],
    steps: ['Wsyp borówki do jogurtu i jedz.'],
  },
  {
    id: 'pudding-kakaowy',
    name: 'Kakaowy pudding twarogowy',
    kind: 'miska',
    minutes: 5,
    tool: 'Miska i widelec (lub blender)',
    description: 'Smakuje jak budyń czekoladowy, a ma blisko 60 g białka.',
    items: [
      { ingredient: 'quark', grams: 200, measure: '1 kostka' },
      { ingredient: 'whey', grams: 20, measure: '2/3 miarki' },
      { ingredient: 'cocoa', grams: 10, measure: '2 łyżeczki' },
      { ingredient: 'milk', grams: 50, measure: '3 łyżki' },
    ],
    steps: [
      'Rozgnieć twaróg widelcem z mlekiem (albo zmiksuj – będzie gładszy).',
      'Wmieszaj białko i kakao. Najlepszy po 10 minutach w lodówce.',
    ],
  },
  {
    id: 'owsianka-nocna',
    name: 'Nocna owsianka białkowa',
    kind: 'miska',
    minutes: 5,
    tool: 'Słoik',
    description: 'Robisz wieczorem w 5 minut, rano jest gotowa. Owsa jest mało na tyle, żeby białko wygrało.',
    items: [
      { ingredient: 'oats', grams: 35, measure: '4 łyżki' },
      { ingredient: 'skyr', grams: 150, measure: '1 mały kubek' },
      { ingredient: 'whey', grams: 25, measure: 'niepełna miarka' },
      { ingredient: 'milk', grams: 100, measure: 'pół szklanki' },
      { ingredient: 'raspberries', grams: 50, measure: 'pół garści' },
    ],
    steps: [
      'Wymieszaj w słoiku płatki, skyr, białko i mleko.',
      'Na wierzch wsyp maliny, zakręć i wstaw na noc do lodówki.',
    ],
  },
  {
    id: 'serek-pomidor',
    name: 'Serek wiejski z pomidorem i szczypiorkiem',
    kind: 'slone',
    minutes: 3,
    tool: 'Miska',
    description: 'Klasyk na słono: świeży, chrupiący, sycący.',
    items: [
      { ingredient: 'cottage', grams: 200, measure: '1 opakowanie' },
      { ingredient: 'tomato', grams: 120, measure: '1 pomidor' },
      { ingredient: 'chives', grams: 5, measure: 'kilka źdźbeł' },
      { ingredient: 'saltPepper', grams: 1, measure: 'do smaku' },
    ],
    steps: ['Pokrój pomidor w kostkę, posiekaj szczypiorek.', 'Wymieszaj z serkiem, dopraw solą i pieprzem.'],
  },
  {
    id: 'tunczyk-salatka',
    name: 'Sałatka z tuńczykiem i serkiem wiejskim',
    kind: 'slone',
    minutes: 5,
    tool: 'Miska',
    description: 'Prawie 50 g białka z puszki i kubka, bez gotowania.',
    items: [
      { ingredient: 'tuna', grams: 120, measure: '1 puszka, odsączona' },
      { ingredient: 'cottage', grams: 150, measure: 'pół dużego opakowania' },
      { ingredient: 'cucumber', grams: 100, measure: 'pół ogórka' },
      { ingredient: 'tomato', grams: 100, measure: '1 mały pomidor' },
    ],
    steps: ['Odsącz tuńczyka, pokrój ogórek i pomidor.', 'Wymieszaj wszystko z serkiem, dopraw pieprzem.'],
  },
  {
    id: 'kurczak-serek',
    name: 'Kurczak z serkiem wiejskim i ogórkiem',
    kind: 'slone',
    minutes: 3,
    tool: 'Talerz',
    description: 'Gotowa pierś w plastrach, serek i ogórek – obiad białkowy w 3 minuty.',
    items: [
      { ingredient: 'chicken', grams: 100, measure: '1 opakowanie plastrów' },
      { ingredient: 'cottage', grams: 150, measure: 'pół dużego opakowania' },
      { ingredient: 'cucumber', grams: 100, measure: 'pół ogórka' },
    ],
    steps: ['Pokrój ogórek w plasterki.', 'Ułóż na talerzu z plastrami kurczaka i serkiem, dopraw pieprzem.'],
  },
  {
    id: 'omlet-bialkowy',
    name: 'Omlet z białek ze szpinakiem',
    kind: 'slone',
    minutes: 7,
    tool: 'Patelnia',
    description: 'Puszysty, chudy omlet z białek – ciepłe śniadanie gotowe w 7 minut.',
    items: [
      { ingredient: 'eggWhites', grams: 130, measure: 'białka z 4 jaj' },
      { ingredient: 'egg', grams: 50, measure: '1 jajko' },
      { ingredient: 'spinach', grams: 50, measure: 'garść' },
      { ingredient: 'saltPepper', grams: 1, measure: 'do smaku' },
    ],
    steps: [
      'Roztrzep białka z całym jajkiem, solą i pieprzem.',
      'Wrzuć szpinak na rozgrzaną patelnię na 1 minutę, zalej jajkami.',
      'Smaż pod przykryciem 3–4 minuty na małym ogniu.',
    ],
  },
  // ── Szybkie, na słono (do 7 minut) ──────────────────────────────────────
  {
    id: 'losos-serek',
    name: 'Łosoś wędzony z serkiem wiejskim i ogórkiem',
    kind: 'slone',
    minutes: 4,
    tool: 'Talerz',
    description: 'Śniadanie jak z hotelowego bufetu: wędzony łosoś, chłodny serek z koperkiem i chrupiący ogórek.',
    items: [
      { ingredient: 'smokedSalmon', grams: 80, measure: 'pół opakowania (ok. 4 plastry)' },
      { ingredient: 'cottage', grams: 150, measure: 'pół dużego opakowania' },
      { ingredient: 'cucumber', grams: 100, measure: 'pół ogórka' },
      { ingredient: 'dill', grams: 3, measure: 'kilka gałązek' },
      { ingredient: 'saltPepper', grams: 1, measure: 'pieprz do smaku' },
    ],
    steps: [
      'Pokrój ogórek w półplasterki, posiekaj koperek.',
      'Wymieszaj serek z koperkiem i pieprzem, obok ułóż łososia i ogórek.',
    ],
  },
  {
    id: 'roladki-twarozek',
    name: 'Roladki z szynki drobiowej z twarożkiem',
    kind: 'slone',
    minutes: 5,
    tool: 'Miska i widelec',
    description:
      'Plastry piersi z indyka lub kurczaka zwinięte z twarożkiem ze szczypiorkiem – ponad 50 g białka bez gotowania.',
    items: [
      { ingredient: 'chicken', grams: 100, measure: '1 opakowanie plastrów' },
      { ingredient: 'quark', grams: 150, measure: '3/4 kostki' },
      { ingredient: 'radish', grams: 50, measure: '4–5 rzodkiewek' },
      { ingredient: 'chives', grams: 5, measure: 'kilka źdźbeł' },
      { ingredient: 'saltPepper', grams: 1, measure: 'do smaku' },
    ],
    steps: [
      'Rozgnieć twaróg widelcem z posiekanym szczypiorkiem, drobno pokrojoną rzodkiewką, solą i pieprzem. Za suchy? Dodaj łyżkę wody.',
      'Na każdy plaster nałóż łyżkę twarożku i zwiń w rulon.',
    ],
  },

  // ── Chwilę dłużej (8–20 minut) ──────────────────────────────────────────
  {
    id: 'jajecznica-losos',
    name: 'Jajecznica na białkach z wędzonym łososiem',
    kind: 'slone',
    minutes: 8,
    tool: 'Patelnia',
    description:
      'Kremowa jajecznica z dwóch jaj i samych białek, a na koniec łosoś i szczypiorek. Śniadanie na blisko 40 g białka.',
    items: [
      { ingredient: 'egg', grams: 100, measure: '2 jajka' },
      { ingredient: 'eggWhites', grams: 150, measure: 'białka z 4–5 jaj (lub z kartonu)' },
      { ingredient: 'smokedSalmon', grams: 50, measure: '2–3 plastry' },
      { ingredient: 'chives', grams: 5, measure: 'kilka źdźbeł' },
      { ingredient: 'oil', grams: 3, measure: 'łyżeczka' },
    ],
    steps: [
      'Roztrzep jajka z białkami i szczyptą pieprzu – bez soli, łosoś jest słony.',
      'Wlej na lekko natłuszczoną patelnię i mieszaj na małym ogniu 3–4 minuty, aż się zetnie, ale zostanie wilgotna.',
      'Zdejmij z ognia, wmieszaj pokrojonego łososia i posyp szczypiorkiem.',
    ],
  },
  {
    id: 'omlet-twarozek',
    name: 'Omlet z twarożkiem i pomidorem',
    kind: 'slone',
    minutes: 10,
    tool: 'Patelnia z pokrywką',
    description: 'Puszysty omlet z jaj i białek, w środku ciepły twaróg i pomidor. Sycący, a tłuszczu niewiele.',
    items: [
      { ingredient: 'egg', grams: 100, measure: '2 jajka' },
      { ingredient: 'eggWhites', grams: 100, measure: 'białka z 3 jaj' },
      { ingredient: 'quark', grams: 100, measure: 'pół kostki' },
      { ingredient: 'tomato', grams: 100, measure: '1 mały pomidor' },
      { ingredient: 'chives', grams: 5, measure: 'kilka źdźbeł' },
      { ingredient: 'oil', grams: 3, measure: 'łyżeczka' },
      { ingredient: 'saltPepper', grams: 1, measure: 'do smaku' },
    ],
    steps: [
      'Roztrzep jajka z białkami, solą i pieprzem.',
      'Wlej na natłuszczoną, rozgrzaną patelnię i smaż pod przykryciem 3–4 minuty na małym ogniu.',
      'Na połowę omletu wyłóż pokruszony twaróg i plastry pomidora, przykryj drugą połową i podgrzej jeszcze minutę. Posyp szczypiorkiem.',
    ],
  },
  {
    id: 'twarozek-rzodkiewka',
    name: 'Twarożek z rzodkiewką i jajkiem na twardo',
    kind: 'slone',
    minutes: 12,
    tool: 'Garnek i miska',
    description:
      'Polskie śniadanie w wersji białkowej: twaróg ze szczypiorkiem, chrupiąca rzodkiewka i dwa jajka – ponad 50 g białka.',
    items: [
      { ingredient: 'egg', grams: 100, measure: '2 jajka' },
      { ingredient: 'quark', grams: 200, measure: '1 kostka' },
      { ingredient: 'radish', grams: 80, measure: '6–7 rzodkiewek' },
      { ingredient: 'chives', grams: 10, measure: 'pół pęczka' },
      { ingredient: 'milk', grams: 30, measure: '2 łyżki' },
      { ingredient: 'saltPepper', grams: 1, measure: 'do smaku' },
    ],
    steps: [
      'Ugotuj jajka na twardo – 9 minut od zagotowania – i przelej zimną wodą.',
      'W tym czasie rozgnieć twaróg z mlekiem, posiekanym szczypiorkiem, solą i pieprzem.',
      'Dodaj pokrojoną rzodkiewkę, na wierzch połóż jajka przekrojone na ćwiartki.',
    ],
  },
  {
    id: 'krewetki-czosnkowe',
    name: 'Krewetki czosnkowe z cukinią',
    kind: 'obiad',
    minutes: 12,
    tool: 'Patelnia',
    description: 'Krewetki na oliwie z czosnkiem i chili, cukinia pokrojona jak makaron i odrobina parmezanu.',
    items: [
      { ingredient: 'shrimp', grams: 200, measure: '1 opakowanie, rozmrożone' },
      { ingredient: 'zucchini', grams: 250, measure: '1 mała cukinia' },
      { ingredient: 'garlic', grams: 10, measure: '3 ząbki' },
      { ingredient: 'oil', grams: 8, measure: 'łyżka' },
      { ingredient: 'lemon', grams: 15, measure: 'sok z ćwiartki cytryny' },
      { ingredient: 'parmesan', grams: 10, measure: '1 łyżka tartego' },
      { ingredient: 'spices', grams: 1, measure: 'szczypta chili' },
    ],
    steps: [
      'Pokrój cukinię w cienkie paski (obieraczką albo nożem). Krewetki rozmroź i osusz ręcznikiem.',
      'Na rozgrzanej oliwie podsmaż czosnek z chili przez 30 sekund, wrzuć krewetki i smaż po 2 minuty z każdej strony, aż zróżowieją.',
      'Dodaj cukinię na 2–3 minuty, skrop sokiem z cytryny i posyp parmezanem.',
    ],
  },
  {
    id: 'placki-twarogowe',
    name: 'Placki twarogowe z borówkami',
    kind: 'miska',
    minutes: 15,
    tool: 'Patelnia i miska',
    description: 'Puszyste placuszki z twarogu, białek i odrobiny owsa. Smakują jak racuchy, a mają ponad 60 g białka.',
    items: [
      { ingredient: 'quark', grams: 150, measure: '3/4 kostki' },
      { ingredient: 'eggWhites', grams: 100, measure: 'białka z 3 jaj' },
      { ingredient: 'egg', grams: 50, measure: '1 jajko' },
      { ingredient: 'oats', grams: 30, measure: '3 łyżki' },
      { ingredient: 'whey', grams: 15, measure: 'pół miarki (najlepiej waniliowe)' },
      { ingredient: 'blueberries', grams: 100, measure: 'garść' },
      { ingredient: 'oil', grams: 3, measure: 'łyżeczka do smażenia' },
    ],
    steps: [
      'Zmiksuj albo rozgnieć widelcem twaróg z jajkiem, białkami, płatkami i białkiem w proszku na gęste ciasto.',
      'Nakładaj łyżką małe placki na lekko natłuszczoną patelnię i smaż na średnim ogniu po 2 minuty z każdej strony.',
      'Podawaj z borówkami – mrożone podgrzej chwilę na patelni, puszczą sok.',
    ],
  },
  {
    id: 'kurczak-papryka',
    name: 'Kurczak z patelni z papryką i cukinią',
    kind: 'obiad',
    minutes: 15,
    tool: 'Patelnia',
    description:
      'Szybki obiad z jednej patelni: zrumieniona pierś, słodka papryka i cukinia z czosnkiem. Prawie 50 g białka.',
    items: [
      { ingredient: 'chickenFillet', grams: 200, measure: '1 mały filet' },
      { ingredient: 'pepper', grams: 150, measure: '1 papryka' },
      { ingredient: 'zucchini', grams: 150, measure: 'pół cukinii' },
      { ingredient: 'onion', grams: 50, measure: 'pół cebuli' },
      { ingredient: 'garlic', grams: 5, measure: '1–2 ząbki' },
      { ingredient: 'oil', grams: 7, measure: 'pół łyżki' },
      { ingredient: 'spices', grams: 3, measure: 'łyżeczka (papryka słodka, oregano)' },
      { ingredient: 'saltPepper', grams: 1, measure: 'do smaku' },
    ],
    steps: [
      'Pokrój kurczaka w kostkę, obtocz w przyprawach i soli.',
      'Rozgrzej oliwę i smaż kurczaka 5–6 minut, aż się zrumieni ze wszystkich stron.',
      'Dodaj cebulę, paprykę i cukinię pokrojone w paski i smaż jeszcze 5 minut. Na koniec wrzuć przeciśnięty czosnek na 30 sekund.',
    ],
  },
  {
    id: 'makaron-tunczyk',
    name: 'Makaron z soczewicy z tuńczykiem i pomidorami',
    kind: 'obiad',
    minutes: 15,
    tool: 'Garnek i patelnia',
    description:
      'Makaron z soczewicy ma dwa razy więcej białka niż pszenny – z tuńczykiem i sosem pomidorowym to pełny obiad.',
    items: [
      { ingredient: 'lentilPasta', grams: 50, measure: 'mała garść (suchy)' },
      { ingredient: 'tuna', grams: 120, measure: '1 puszka, odsączona' },
      { ingredient: 'cannedTomatoes', grams: 200, measure: 'pół puszki' },
      { ingredient: 'onion', grams: 40, measure: 'pół małej cebuli' },
      { ingredient: 'garlic', grams: 5, measure: '1 ząbek' },
      { ingredient: 'oil', grams: 5, measure: 'łyżeczka' },
      { ingredient: 'parmesan', grams: 10, measure: '1 łyżka tartego' },
      { ingredient: 'spices', grams: 1, measure: 'oregano lub bazylia' },
    ],
    steps: [
      'Ugotuj makaron według opakowania (zwykle 6–8 minut).',
      'W tym czasie zeszklij cebulę z czosnkiem na oliwie, dodaj pomidory i oregano, duś 5 minut.',
      'Wmieszaj tuńczyka, podgrzej i połącz z makaronem. Posyp parmezanem.',
    ],
  },
  {
    id: 'burrito-bowl',
    name: 'Burrito bowl z indykiem',
    kind: 'obiad',
    minutes: 20,
    tool: 'Patelnia i garnek',
    description:
      'Wszystko, co w burrito najlepsze, ale w misce: przyprawiony indyk, fasola, odrobina ryżu i skyr zamiast śmietany.',
    items: [
      { ingredient: 'turkeyMince', grams: 200, measure: 'pół opakowania' },
      { ingredient: 'rice', grams: 30, measure: '2 łyżki (suchy)' },
      { ingredient: 'beans', grams: 50, measure: '3 łyżki' },
      { ingredient: 'pepper', grams: 100, measure: 'pół papryki' },
      { ingredient: 'tomato', grams: 100, measure: '1 mały pomidor' },
      { ingredient: 'skyr', grams: 60, measure: '2 łyżki' },
      { ingredient: 'lemon', grams: 10, measure: 'sok z ćwiartki limonki' },
      { ingredient: 'spices', grams: 3, measure: 'łyżeczka (kmin, papryka, chili)' },
      { ingredient: 'oil', grams: 3, measure: 'łyżeczka' },
    ],
    steps: [
      'Ugotuj ryż (ok. 12 minut).',
      'Na oliwie podsmaż mięso, rozbijając je łopatką, aż straci różowy kolor. Dodaj przyprawy, sól i paprykę w kostkę, smaż jeszcze 3 minuty.',
      'Ułóż w misce ryż, mięso, odsączoną fasolę i pokrojonego pomidora. Skrop limonką i dodaj skyr.',
    ],
  },

  // ── Dłużej, w domu (ponad 20 minut, zwykle na kilka porcji) ─────────────
  {
    id: 'losos-brokuly',
    name: 'Łosoś pieczony z brokułami i sosem koperkowym',
    kind: 'obiad',
    minutes: 25,
    servings: 2,
    tool: 'Piekarnik i blacha',
    description: 'Łosoś i brokuły pieką się razem na jednej blasze. Sos ze skyru z koperkiem zamiast majonezu.',
    items: [
      { ingredient: 'salmonFillet', grams: 300, measure: '2 kawałki po 150 g' },
      { ingredient: 'broccoli', grams: 400, measure: '1 duży brokuł' },
      { ingredient: 'oil', grams: 5, measure: 'łyżeczka' },
      { ingredient: 'garlic', grams: 5, measure: '1 ząbek' },
      { ingredient: 'lemon', grams: 20, measure: 'sok z połowy cytryny' },
      { ingredient: 'skyr', grams: 150, measure: '1 mały kubek' },
      { ingredient: 'dill', grams: 10, measure: 'pół pęczka' },
      { ingredient: 'saltPepper', grams: 2, measure: 'do smaku' },
    ],
    steps: [
      'Nagrzej piekarnik do 200°C. Brokuł podziel na różyczki, wymieszaj z oliwą, solą i pieprzem i rozłóż na blasze.',
      'Ułóż obok łososia skórą do dołu, posól i skrop cytryną. Piecz 15–18 minut, aż ryba łatwo się rozdziela.',
      'W tym czasie wymieszaj skyr z posiekanym koperkiem, przeciśniętym czosnkiem, solą i odrobiną soku z cytryny.',
    ],
  },
  {
    id: 'kurczak-curry',
    name: 'Kurczak curry na skyrze ze szpinakiem',
    kind: 'obiad',
    minutes: 30,
    servings: 2,
    tool: 'Patelnia z wysokim brzegiem',
    description:
      'Kremowe curry bez śmietany i mleka kokosowego: skyr daje gęstość i jeszcze więcej białka. Z odrobiną ryżu.',
    items: [
      { ingredient: 'chickenFillet', grams: 400, measure: '2 filety' },
      { ingredient: 'onion', grams: 100, measure: '1 cebula' },
      { ingredient: 'garlic', grams: 10, measure: '2 ząbki' },
      { ingredient: 'curry', grams: 8, measure: '2 łyżeczki' },
      { ingredient: 'cannedTomatoes', grams: 200, measure: 'pół puszki' },
      { ingredient: 'spinach', grams: 100, measure: '2 garści' },
      { ingredient: 'skyr', grams: 200, measure: '1 duży kubek' },
      { ingredient: 'oil', grams: 10, measure: 'łyżka' },
      { ingredient: 'rice', grams: 80, measure: '1 woreczek (suchy)' },
      { ingredient: 'saltPepper', grams: 2, measure: 'do smaku' },
    ],
    steps: [
      'Ugotuj ryż. Kurczaka pokrój w kostkę i posól.',
      'Na oleju zeszklij cebulę, dodaj czosnek i curry, smaż minutę. Wrzuć kurczaka i smaż 5 minut.',
      'Dodaj pomidory i duś pod przykryciem 10 minut. Wmieszaj szpinak, a gdy zwiędnie, zdejmij z ognia.',
      'Skyr wmieszaj dopiero poza ogniem, żeby się nie zważył. Podawaj z ryżem.',
    ],
  },
  {
    id: 'dorsz-pomidory',
    name: 'Dorsz zapiekany w pomidorach z cukinią',
    kind: 'obiad',
    minutes: 35,
    servings: 2,
    tool: 'Naczynie żaroodporne',
    description: 'Chuda biała ryba zapiekana w pomidorach z czosnkiem i oregano. Lekko, a na porcję ponad 50 g białka.',
    items: [
      { ingredient: 'whiteFish', grams: 500, measure: '2–3 filety, rozmrożone' },
      { ingredient: 'cannedTomatoes', grams: 400, measure: '1 puszka' },
      { ingredient: 'zucchini', grams: 300, measure: '1 cukinia' },
      { ingredient: 'onion', grams: 80, measure: '1 mała cebula' },
      { ingredient: 'garlic', grams: 10, measure: '2 ząbki' },
      { ingredient: 'oil', grams: 10, measure: 'łyżka' },
      { ingredient: 'parmesan', grams: 20, measure: '2 łyżki tartego' },
      { ingredient: 'spices', grams: 3, measure: 'łyżeczka oregano' },
      { ingredient: 'saltPepper', grams: 2, measure: 'do smaku' },
    ],
    steps: [
      'Nagrzej piekarnik do 200°C. Na oliwie zeszklij cebulę z czosnkiem, dodaj pomidory i oregano, duś 5 minut.',
      'Wlej sos do naczynia, ułóż na nim cukinię w plasterkach i rybę, posól i popieprz.',
      'Posyp parmezanem i piecz 18–20 minut, aż ryba będzie biała i krucha.',
    ],
  },
  {
    id: 'chili-indyk',
    name: 'Chili z indyka',
    kind: 'obiad',
    minutes: 40,
    servings: 3,
    tool: 'Duży garnek',
    description:
      'Gęste, rozgrzewające chili z mielonego indyka. Fasoli jest tylko trochę, żeby białko wygrało – następnego dnia smakuje jeszcze lepiej.',
    items: [
      { ingredient: 'turkeyMince', grams: 500, measure: '1 opakowanie' },
      { ingredient: 'onion', grams: 150, measure: '1 duża cebula' },
      { ingredient: 'pepper', grams: 300, measure: '2 papryki' },
      { ingredient: 'garlic', grams: 15, measure: '3 ząbki' },
      { ingredient: 'cannedTomatoes', grams: 400, measure: '1 puszka' },
      { ingredient: 'beans', grams: 120, measure: 'pół puszki, odsączonej' },
      { ingredient: 'spices', grams: 10, measure: 'łyżka (kmin, papryka wędzona, chili)' },
      { ingredient: 'oil', grams: 10, measure: 'łyżka' },
      { ingredient: 'saltPepper', grams: 2, measure: 'do smaku' },
    ],
    steps: [
      'W dużym garnku rozgrzej olej, zeszklij posiekaną cebulę, dodaj mięso i smaż, rozbijając je łopatką, aż straci różowy kolor.',
      'Dodaj czosnek i przyprawy, smaż minutę, aż zapachną. Wrzuć paprykę w kostkę.',
      'Dodaj pomidory, przykryj i duś 20 minut na małym ogniu. Na ostatnie 5 minut wsyp odsączoną fasolę i dopraw solą.',
    ],
  },
  {
    id: 'kurczak-pieczony',
    name: 'Pieczony filet z kurczaka z warzywami',
    kind: 'obiad',
    minutes: 45,
    servings: 2,
    tool: 'Piekarnik i blacha',
    description:
      'Kurczak z papryką, cukinią i czerwoną cebulą z jednej blachy. Robisz raz, jesz dwa razy – świetny do pudełka.',
    items: [
      { ingredient: 'chickenFillet', grams: 500, measure: '2 duże filety' },
      { ingredient: 'pepper', grams: 300, measure: '2 papryki' },
      { ingredient: 'zucchini', grams: 300, measure: '1 cukinia' },
      { ingredient: 'onion', grams: 150, measure: '2 czerwone cebule' },
      { ingredient: 'garlic', grams: 15, measure: '3 ząbki' },
      { ingredient: 'oil', grams: 15, measure: '1,5 łyżki' },
      { ingredient: 'lemon', grams: 20, measure: 'sok z połowy cytryny' },
      { ingredient: 'spices', grams: 6, measure: '2 łyżeczki (papryka, czosnek, zioła)' },
      { ingredient: 'saltPepper', grams: 2, measure: 'do smaku' },
    ],
    steps: [
      'Nagrzej piekarnik do 200°C. Filety natrzyj połową oliwy, przyprawami, solą i sokiem z cytryny; najlepiej odstaw na 15 minut.',
      'Warzywa pokrój w duże kawałki, wymieszaj z resztą oliwy i czosnkiem i rozłóż na blasze, a na wierzchu połóż filety.',
      'Piecz 25 minut, aż sok z kurczaka będzie przezroczysty. Odstaw na 5 minut przed krojeniem – zostanie soczysty.',
    ],
  },
  {
    id: 'pulpety-indyk',
    name: 'Pulpety z indyka w sosie pomidorowym',
    kind: 'obiad',
    minutes: 45,
    servings: 3,
    tool: 'Garnek z pokrywką',
    description: 'Delikatne pulpety z indyka gotowane w sosie pomidorowym z czosnkiem. Płatki owsiane zamiast bułki.',
    items: [
      { ingredient: 'turkeyMince', grams: 500, measure: '1 opakowanie' },
      { ingredient: 'eggWhites', grams: 60, measure: 'białka z 2 jaj' },
      { ingredient: 'oats', grams: 30, measure: '3 łyżki' },
      { ingredient: 'onion', grams: 100, measure: '1 cebula' },
      { ingredient: 'garlic', grams: 10, measure: '2 ząbki' },
      { ingredient: 'passata', grams: 500, measure: '1 butelka' },
      { ingredient: 'spices', grams: 6, measure: '2 łyżeczki (majeranek, papryka, bazylia)' },
      { ingredient: 'oil', grams: 5, measure: 'łyżeczka' },
      { ingredient: 'saltPepper', grams: 2, measure: 'do smaku' },
    ],
    steps: [
      'Połowę cebuli zetrzyj na tarce i wymieszaj z mięsem, białkami, płatkami, solą, pieprzem i połową przypraw. Mokrymi dłońmi uformuj 15–18 kulek.',
      'W garnku zeszklij resztę cebuli z czosnkiem na oliwie, wlej passatę z resztą przypraw i zagotuj.',
      'Włóż pulpety do sosu, przykryj i gotuj na małym ogniu 25 minut, delikatnie mieszając raz czy dwa.',
    ],
  },
  {
    id: 'sernik-proteinowy',
    name: 'Sernik proteinowy pieczony',
    kind: 'miska',
    minutes: 70,
    servings: 8,
    tool: 'Piekarnik, forma 20–22 cm i blender',
    description:
      'Prawdziwy pieczony sernik, tylko bez spodu i cukru: twaróg, jajka i białko w proszku. Kawałek ma ponad 30 g białka.',
    items: [
      { ingredient: 'quark', grams: 1000, measure: '1 kg (4–5 kostek)' },
      { ingredient: 'egg', grams: 150, measure: '3 jajka' },
      { ingredient: 'eggWhites', grams: 90, measure: 'białka z 3 jaj' },
      { ingredient: 'whey', grams: 60, measure: '2 miarki (waniliowe)' },
      { ingredient: 'sweetener', grams: 40, measure: '4 łyżki, do smaku' },
      { ingredient: 'potatoStarch', grams: 20, measure: '2 łyżki' },
      { ingredient: 'lemon', grams: 20, measure: 'sok i skórka z połowy cytryny' },
    ],
    steps: [
      'Nagrzej piekarnik do 160°C, dno formy wyłóż papierem do pieczenia.',
      'Zmiksuj twaróg na gładką masę. Dodaj jajka, białka, białko w proszku, słodzik, mąkę ziemniaczaną oraz sok i skórkę z cytryny; zmiksuj krótko, tylko do połączenia.',
      'Przelej do formy i piecz 50–55 minut, aż brzegi się zetną, a środek lekko drga. Wystudź w uchylonym piekarniku, potem schłodź w lodówce, najlepiej przez noc.',
    ],
  },
  {
    id: 'gulasz-wolowy',
    name: 'Chudy gulasz wołowy z pieczarkami',
    kind: 'obiad',
    minutes: 90,
    servings: 3,
    tool: 'Garnek z grubym dnem',
    description:
      'Wołowina duszona do miękkości z papryką, pieczarkami i słodką papryką. Dusi się długo, ale sama – pracy jest kwadrans.',
    items: [
      { ingredient: 'leanBeef', grams: 600, measure: '600 g, np. udziec' },
      { ingredient: 'onion', grams: 200, measure: '2 cebule' },
      { ingredient: 'pepper', grams: 200, measure: '1 duża papryka' },
      { ingredient: 'mushrooms', grams: 250, measure: '1 opakowanie' },
      { ingredient: 'garlic', grams: 10, measure: '2 ząbki' },
      { ingredient: 'passata', grams: 200, measure: 'pół butelki' },
      { ingredient: 'spices', grams: 8, measure: '2 łyżeczki (papryka słodka i ostra, kminek, majeranek)' },
      { ingredient: 'oil', grams: 15, measure: '1,5 łyżki' },
      { ingredient: 'water', grams: 400, measure: '2 szklanki' },
      { ingredient: 'saltPepper', grams: 2, measure: 'do smaku' },
    ],
    steps: [
      'Pokrój wołowinę w kostkę 2–3 cm, osusz i obsmaż partiami na rozgrzanym oleju, aż się zrumieni. Przełóż do garnka.',
      'Na tej samej patelni zeszklij cebulę, dodaj czosnek i przyprawy, a po minucie przełóż do mięsa. Wlej wodę i duś pod przykryciem 50 minut.',
      'Dodaj paprykę, pieczarki i passatę i duś jeszcze 25–30 minut, aż mięso będzie miękkie. Dopraw solą i pieprzem.',
    ],
  },
  ...FROM_ONLINE_SHOPS,
];
