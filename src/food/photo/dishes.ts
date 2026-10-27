import { say } from '../../i18n';
import data from './data/dishes.json';

/**
 * Dishes a meal photo can show, for estimating its calories: a photo model suggests one, the
 * person confirms it, sets the portion and answers up to three simple scales ("Jak tłuste?",
 * "Jak słodkie?", "Ile sosu?"); `estimate()` turns that into kcal and macros with an honest range.
 *
 * Values per 100 g as served are in `data/dishes.json`, built by `scripts/food/fetch-dishes.ts`
 * from USDA FNDDS 2021-2023 (mixed dishes as eaten) and SR Legacy; dishes FNDDS has no fair entry
 * for are composed there from USDA ingredients by a short recipe in grams. This file holds what the
 * data cannot: the names people use, the phrases a CLIP-style model is prompted with, the usual
 * portion, and how far each scale moves the numbers.
 *
 * Choices behind the rows:
 * - All 101 Food-101 classes (ethz/food101) are here with their class name in `food101`, so the
 *   labels of a model trained on it map one to one.
 * - The catalog value is the "usual" answer on every scale. Where the usual dish has no sugar or
 *   no sauce (black coffee, plain pancakes before syrup), the scale says so with `base`.
 * - US recipes are the default for FNDDS dishes; Polish dishes are composed to Polish recipes.
 *   Portions are Polish servings (half a 32 cm pizza, a soup plate of 350 g), not US ones.
 */

export type DishGroup =
  | 'breakfast'
  | 'soup'
  | 'main'
  | 'pasta'
  | 'rice'
  | 'sandwich'
  | 'salad'
  | 'pizza'
  | 'sushi'
  | 'dessert'
  | 'snack'
  | 'drink'
  | 'fruit'
  | 'side';

/** Per 100 g as served. Alcohol (7 kcal/g) only for drinks that have it. */
export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
  satFat: number;
  alcohol?: number;
}

export interface DishSource {
  db: 'FNDDS 2021-2023' | 'SR Legacy' | 'composed';
  /** FNDDS food code, or SR FDC id. */
  code?: number;
  /** The USDA description of that food. */
  description?: string;
  note?: string;
  /** A composed dish: grams as served of each part, USDA food or another composed part. */
  recipe?: readonly { g: number; db: string; code?: number; description: string }[];
  /** Cooked weight / raw weight, for doughs and batters that lose water. */
  yield?: number;
}

// --- Scales ---
//
// Each scale moves the catalog value (the "usual" level, unless `base` says otherwise) by whole
// steps; a step is stored per dish because a deep-fried dish varies far more than a soup. The
// weight on the plate is what the person set with the slider, so a scale changes what 100 g of
// the dish holds, not how much there is:
// - fat and sugar are added or taken away per 100 g; added oil in frying replaces water the food
//   loses, and sugar in a drink or a cake is a small share of its weight, so the weight is left as
//   it is (9 kcal per g of fat, 4 per g of sugar, which also counts as carbs);
// - sauce replaces the rest of the dish gram for gram: more sauce on the same plate means less
//   pasta, so its effect is the sauce's composition minus the rest's, not the sauce's alone.

export type FatLevel = 'lean' | 'usual' | 'fatty' | 'veryFatty';
export type SweetLevel = 'none' | 'light' | 'usual' | 'very';
export type SauceLevel = 'none' | 'little' | 'usual' | 'lots';

/**
 * Grams of fat per 100 g that one step adds or takes away; "zwykłe" is the catalog value, so the
 * four levels are -1, 0, +1 and +2 steps. Steps used:
 * - 4 g, deep-fried (chips, doughnuts, battered fish, tempura): fried foods take up 8-25 % of their
 *   weight in oil, chips about 5 % from the oven to 15-20 % from a tired fryer, doughnuts 20-25 %
 *   (Saguy & Dana 2003, Ziaiifar et al. 2008). From -4 to +8 g covers that spread.
 * - 3 g, pan-fried and breaded, fatty cuts, butter pastry and cake, egg dishes: breading soaks up
 *   5-15 % of oil, a chop differs by 3-4 g between lean and fat-on, cake recipes by a spoon of butter.
 * - 2 g, dishes cooked or dressed with oil (stews, curries, stir-fries, pasta, pizza, sandwiches):
 *   the cook's hand varies by about half a tablespoon (7 g) of oil per 350 g plate.
 * - 1 g, soups, porridge, milk drinks: a little cream or butter in a large volume, or the choice
 *   between skimmed and whole milk (3 g of fat per 100 ml apart) in a coffee that is mostly milk.
 */
export interface FatScale {
  step: number;
}

/**
 * Grams of sugar per 100 g per step. For desserts and sweetened drinks the step is about half the
 * added sugar, so "bez cukru" (-2 steps) takes all of it out and "bardzo słodkie" adds half again.
 * `base: 'none'` marks a dish whose catalog value has no added sugar (coffee, tea, plain pancakes):
 * "lekko słodkie" is then one step up, "zwykłe" two; for a mug of coffee a step of 1.7 g per 100 ml
 * is one teaspoon (4.2 g) of sugar per 250 ml.
 */
export interface SweetScale {
  step: number;
  base?: SweetLevel;
}

/**
 * Grams of sauce per 100 g per step, and which sauce. The usual amount is two steps, so "bez sosu"
 * is the dish without it and "dużo" half as much again; with `base: 'none'` (potato pancakes before
 * the sour cream) the usual is the dish alone and each level adds a step.
 */
export interface SauceScale {
  kind: SauceKind;
  step: number;
  base?: SauceLevel;
}

export interface Dish {
  /** camelCase English, the key of the dish's row in `data/dishes.json`. */
  id: string;
  label: string;
  /** English phrases for a CLIP-style model, most typical first. */
  prompts: readonly string[];
  group: DishGroup;
  per100: Per100;
  /** A typical single serving, as served. */
  portion: { g: number; label: string };
  /** Which scales apply, and how much a step moves the numbers. */
  adjust: { fat?: FatScale; sweet?: SweetScale; sauce?: SauceScale };
  source: DishSource;
  /** The Food-101 class name, when the dish is one. */
  food101?: string;
}

export const FAT_SCALE = {
  question: say('Jak tłuste?', 'How fatty?'),
  levels: [
    { id: 'lean', label: say('chude', 'lean') },
    { id: 'usual', label: say('zwykłe', 'usual') },
    { id: 'fatty', label: say('tłuste', 'fatty') },
    { id: 'veryFatty', label: say('bardzo tłuste', 'very fatty') },
  ],
} as const satisfies { question: string; levels: readonly { id: FatLevel; label: string }[] };

export const SWEET_SCALE = {
  question: say('Jak słodkie?', 'How sweet?'),
  levels: [
    { id: 'none', label: say('bez cukru', 'no sugar') },
    { id: 'light', label: say('lekko słodkie', 'lightly sweet') },
    { id: 'usual', label: say('zwykłe', 'usual') },
    { id: 'very', label: say('bardzo słodkie', 'very sweet') },
  ],
} as const satisfies { question: string; levels: readonly { id: SweetLevel; label: string }[] };

export const SAUCE_SCALE = {
  question: say('Ile sosu?', 'How much sauce?'),
  levels: [
    { id: 'none', label: say('bez sosu', 'no sauce') },
    { id: 'little', label: say('trochę', 'a little') },
    { id: 'usual', label: say('zwykle', 'usual') },
    { id: 'lots', label: say('dużo', 'a lot') },
  ],
} as const satisfies { question: string; levels: readonly { id: SauceLevel; label: string }[] };

const FAT_ORDER: readonly FatLevel[] = FAT_SCALE.levels.map((l) => l.id);
const SWEET_ORDER: readonly SweetLevel[] = SWEET_SCALE.levels.map((l) => l.id);
const SAUCE_ORDER: readonly SauceLevel[] = SAUCE_SCALE.levels.map((l) => l.id);

export type SauceKind = keyof typeof SAUCE_LABELS;

const SAUCE_LABELS = {
  tomato: say('sos pomidorowy', 'tomato sauce'),
  bolognese: say('sos mięsny', 'meat sauce'),
  cream: say('sos śmietanowy', 'cream sauce'),
  cheese: say('sos serowy', 'cheese sauce'),
  gravy: say('sos pieczeniowy', 'gravy'),
  garlic: say('sos czosnkowy', 'garlic sauce'),
  mayo: say('majonez', 'mayonnaise'),
  ketchup: say('ketchup', 'ketchup'),
  bbq: say('sos barbecue', 'barbecue sauce'),
  sweetSour: say('sos słodko-kwaśny', 'sweet and sour sauce'),
  teriyaki: say('sos teriyaki', 'teriyaki sauce'),
  soy: say('sos sojowy', 'soy sauce'),
  peanut: say('sos orzechowy', 'peanut sauce'),
  curry: say('sos curry', 'curry sauce'),
  vinaigrette: say('winegret', 'vinaigrette'),
  oliveOil: say('oliwa', 'olive oil'),
  caesar: say('sos Cezar', 'Caesar dressing'),
  ranch: say('sos ranczo', 'ranch dressing'),
  tzatziki: say('tzatziki', 'tzatziki'),
  hollandaise: say('sos holenderski', 'hollandaise'),
  sourCream: say('śmietana', 'sour cream'),
  whippedCream: say('bita śmietana', 'whipped cream'),
  salsa: say('salsa', 'salsa'),
  hoisin: say('sos hoisin', 'hoisin sauce'),
  tartar: say('sos tatarski', 'tartare sauce'),
  whiteSauce: say('beszamel', 'béchamel'),
  pesto: say('pesto', 'pesto'),
};

interface Row {
  per100: Per100;
  source: DishSource;
}
const DISH_ROWS = data.dishes as Record<string, Row>;
const SAUCE_ROWS = data.sauces as Record<string, Row>;

/** Each sauce a scale can move, with its own composition per 100 g. */
export const SAUCES: Readonly<Record<SauceKind, { label: string; per100: Per100; source: DishSource }>> = Object.fromEntries(
  Object.entries(SAUCE_LABELS).map(([kind, label]) => {
    const row = SAUCE_ROWS[kind];
    if (!row) throw new Error(`no data for sauce ${kind}`);
    return [kind, { label, per100: row.per100, source: row.source }];
  }),
) as Record<SauceKind, { label: string; per100: Per100; source: DishSource }>;

// --- Building the list ---

/** A portion: its household name (`say`) with the grams after it, „1 talerz (350 g)”. */
const p = (g: number, label: string) => ({ g, label: `${label} (${g} g)` });
/** A drink's portion in ml; 1 ml is taken as 1 g (milk 1.03, wine 0.99 - within the range). */
const ml = (g: number, label: string) => ({ g, label: `${label} (${g} ml)` });

const PLATE = say('1 talerz', '1 plate');
const SOUP = say('1 talerz', '1 bowl');
const BOWL = say('1 miska', '1 bowl');
const SMALL_BOWL = say('1 miseczka', '1 small bowl');
const SERVING = say('1 porcja', '1 serving');
const PIECE = say('1 sztuka', '1 piece');
const SLICE = say('1 kawałek', '1 slice');
const SANDWICH = say('1 kanapka', '1 sandwich');
const HALF_PIZZA = say('½ pizzy 32 cm', '½ of a 32 cm pizza');
const CUTLET = say('1 kotlet', '1 cutlet');
const MUG = say('1 kubek', '1 mug');
const CUP = say('1 filiżanka', '1 cup');
const GLASS = say('1 szklanka', '1 glass');
const BIG_GLASS = say('1 duża szklanka', '1 large glass');
const CAN = say('1 puszka', '1 can');
const WINE_GLASS = say('1 kieliszek', '1 glass');
const PIECES = (count: number) => `${count} ${say('sztuk', 'pieces')}`;
const PIECES_FEW = (count: number) => `${count} ${say('sztuki', 'pieces')}`;

const FAT_FRIED: FatScale = { step: 4 };
const FAT_RICH: FatScale = { step: 3 };
const FAT_COOKED: FatScale = { step: 2 };
const FAT_LIGHT: FatScale = { step: 1 };
const sweet = (step: number, base: SweetLevel = 'usual'): SweetScale => ({ step, base });
const sauce = (kind: SauceKind, step: number, base: SauceLevel = 'usual'): SauceScale => ({ kind, step, base });

type Entry = Omit<Dish, 'per100' | 'source'>;

const ENTRIES: readonly Entry[] = [
  // --- Food-101 ---
  { id: 'applePie', label: say('Szarlotka (apple pie)', 'Apple pie'), prompts: ['apple pie', 'a slice of apple pie', 'polish apple cake szarlotka'], group: 'dessert', portion: p(130, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(6) }, food101: 'apple_pie' },
  { id: 'babyBackRibs', label: say('Żeberka BBQ', 'Baby back ribs'), prompts: ['baby back ribs', 'barbecue pork ribs', 'glazed spare ribs'], group: 'main', portion: p(250, say('1 porcja bez kości', '1 serving off the bone')), adjust: { fat: FAT_RICH, sauce: sauce('bbq', 14) }, food101: 'baby_back_ribs' },
  { id: 'baklava', label: say('Baklawa', 'Baklava'), prompts: ['baklava', 'baklava pastry with pistachios'], group: 'dessert', portion: p(80, PIECES_FEW(2)), adjust: { fat: FAT_RICH, sweet: sweet(5) }, food101: 'baklava' },
  { id: 'beefCarpaccio', label: say('Carpaccio wołowe', 'Beef carpaccio'), prompts: ['beef carpaccio', 'thinly sliced raw beef with parmesan and arugula'], group: 'main', portion: p(125, SERVING), adjust: { fat: FAT_COOKED }, food101: 'beef_carpaccio' },
  { id: 'beefTartare', label: say('Tatar wołowy', 'Beef tartare'), prompts: ['beef tartare', 'steak tartare with raw egg yolk', 'raw minced beef with gherkins and onion'], group: 'main', portion: p(150, SERVING), adjust: { fat: FAT_RICH }, food101: 'beef_tartare' },
  { id: 'beetSalad', label: say('Sałatka z buraków i koziego sera', 'Beet salad'), prompts: ['beet salad', 'roasted beetroot salad with goat cheese'], group: 'salad', portion: p(230, SERVING), adjust: { sauce: sauce('vinaigrette', 4) }, food101: 'beet_salad' },
  { id: 'beignets', label: say('Beignets (pączki francuskie)', 'Beignets'), prompts: ['beignets', 'square fried dough with powdered sugar'], group: 'dessert', portion: p(135, PIECES_FEW(3)), adjust: { fat: FAT_FRIED, sweet: sweet(6) }, food101: 'beignets' },
  { id: 'bibimbap', label: say('Bibimbap', 'Bibimbap'), prompts: ['bibimbap', 'korean rice bowl with vegetables and a fried egg'], group: 'rice', portion: p(450, BOWL), adjust: { fat: FAT_COOKED }, food101: 'bibimbap' },
  { id: 'breadPudding', label: say('Pudding chlebowy', 'Bread pudding'), prompts: ['bread pudding', 'baked bread pudding with raisins'], group: 'dessert', portion: p(150, SERVING), adjust: { fat: FAT_COOKED, sweet: sweet(5) }, food101: 'bread_pudding' },
  { id: 'breakfastBurrito', label: say('Burrito śniadaniowe', 'Breakfast burrito'), prompts: ['breakfast burrito', 'tortilla wrap with scrambled eggs and sausage'], group: 'breakfast', portion: p(190, PIECE), adjust: { fat: FAT_RICH }, food101: 'breakfast_burrito' },
  { id: 'bruschetta', label: say('Bruschetta', 'Bruschetta'), prompts: ['bruschetta', 'toasted bread topped with tomatoes and basil'], group: 'snack', portion: p(90, say('2 kromki', '2 slices')), adjust: { fat: FAT_COOKED }, food101: 'bruschetta' },
  { id: 'caesarSalad', label: say('Sałatka Cezar', 'Caesar salad'), prompts: ['caesar salad', 'romaine lettuce with croutons and parmesan'], group: 'salad', portion: p(230, SERVING), adjust: { sauce: sauce('caesar', 6) }, food101: 'caesar_salad' },
  { id: 'cannoli', label: say('Cannoli', 'Cannoli'), prompts: ['cannoli', 'sicilian pastry tubes filled with ricotta cream'], group: 'dessert', portion: p(80, PIECE), adjust: { fat: FAT_COOKED, sweet: sweet(4) }, food101: 'cannoli' },
  { id: 'capreseSalad', label: say('Sałatka caprese', 'Caprese salad'), prompts: ['caprese salad', 'tomato and mozzarella slices with basil'], group: 'salad', portion: p(260, SERVING), adjust: { sauce: sauce('oliveOil', 2) }, food101: 'caprese_salad' },
  { id: 'carrotCake', label: say('Ciasto marchewkowe', 'Carrot cake'), prompts: ['carrot cake', 'carrot cake with cream cheese frosting'], group: 'dessert', portion: p(120, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(8) }, food101: 'carrot_cake' },
  { id: 'ceviche', label: say('Ceviche', 'Ceviche'), prompts: ['ceviche', 'raw fish marinated in lime juice with red onion'], group: 'main', portion: p(200, SERVING), adjust: {}, food101: 'ceviche' },
  { id: 'cheesecake', label: say('Cheesecake (sernik nowojorski)', 'Cheesecake'), prompts: ['cheesecake', 'slice of new york cheesecake'], group: 'dessert', portion: p(125, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(6) }, food101: 'cheesecake' },
  { id: 'cheesePlate', label: say('Deska serów', 'Cheese plate'), prompts: ['cheese plate', 'cheese board with grapes and crackers'], group: 'snack', portion: p(160, SERVING), adjust: {}, food101: 'cheese_plate' },
  { id: 'chickenCurry', label: say('Kurczak curry', 'Chicken curry'), prompts: ['chicken curry', 'indian chicken curry in a thick sauce'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED }, food101: 'chicken_curry' },
  { id: 'chickenQuesadilla', label: say('Quesadilla z kurczakiem', 'Chicken quesadilla'), prompts: ['chicken quesadilla', 'grilled tortilla with chicken and melted cheese'], group: 'main', portion: p(140, PIECE), adjust: { fat: FAT_RICH }, food101: 'chicken_quesadilla' },
  { id: 'chickenWings', label: say('Skrzydełka z kurczaka', 'Chicken wings'), prompts: ['chicken wings', 'buffalo wings with hot sauce'], group: 'main', portion: p(210, PIECES(6)), adjust: { fat: FAT_RICH }, food101: 'chicken_wings' },
  { id: 'chocolateCake', label: say('Ciasto czekoladowe', 'Chocolate cake'), prompts: ['chocolate cake', 'slice of chocolate layer cake'], group: 'dessert', portion: p(110, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(8) }, food101: 'chocolate_cake' },
  { id: 'chocolateMousse', label: say('Mus czekoladowy', 'Chocolate mousse'), prompts: ['chocolate mousse', 'chocolate mousse in a glass'], group: 'dessert', portion: p(100, say('1 pucharek', '1 cup')), adjust: { fat: FAT_RICH, sweet: sweet(5) }, food101: 'chocolate_mousse' },
  { id: 'churros', label: say('Churros', 'Churros'), prompts: ['churros', 'fried churros with sugar and chocolate dip'], group: 'dessert', portion: p(135, PIECES_FEW(3)), adjust: { fat: FAT_FRIED, sweet: sweet(6) }, food101: 'churros' },
  { id: 'clamChowder', label: say('Zupa z małży (clam chowder)', 'Clam chowder'), prompts: ['clam chowder', 'creamy new england clam chowder'], group: 'soup', portion: p(300, SOUP), adjust: { fat: FAT_LIGHT }, food101: 'clam_chowder' },
  { id: 'clubSandwich', label: say('Club sandwich', 'Club sandwich'), prompts: ['club sandwich', 'triple decker sandwich with chicken and bacon'], group: 'sandwich', portion: p(230, SANDWICH), adjust: { fat: FAT_COOKED }, food101: 'club_sandwich' },
  { id: 'crabCakes', label: say('Kotleciki krabowe', 'Crab cakes'), prompts: ['crab cakes', 'golden fried crab cakes'], group: 'main', portion: p(170, PIECES_FEW(2)), adjust: { fat: FAT_RICH }, food101: 'crab_cakes' },
  { id: 'cremeBrulee', label: say('Crème brûlée', 'Crème brûlée'), prompts: ['creme brulee', 'custard with a caramelised sugar crust'], group: 'dessert', portion: p(120, say('1 kokilka', '1 ramekin')), adjust: { fat: FAT_RICH, sweet: sweet(5) }, food101: 'creme_brulee' },
  { id: 'croqueMadame', label: say('Croque madame', 'Croque madame'), prompts: ['croque madame', 'ham and cheese toast with a fried egg on top'], group: 'sandwich', portion: p(240, PIECE), adjust: { fat: FAT_COOKED, sauce: sauce('whiteSauce', 8) }, food101: 'croque_madame' },
  { id: 'cupCakes', label: say('Babeczki (cupcakes)', 'Cupcakes'), prompts: ['cupcakes', 'cupcake with frosting'], group: 'dessert', portion: p(90, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(8) }, food101: 'cup_cakes' },
  { id: 'deviledEggs', label: say('Jajka faszerowane', 'Deviled eggs'), prompts: ['deviled eggs', 'stuffed egg halves with paprika'], group: 'snack', portion: p(120, say('4 połówki', '4 halves')), adjust: { fat: FAT_RICH }, food101: 'deviled_eggs' },
  { id: 'donuts', label: say('Donut', 'Doughnut'), prompts: ['donuts', 'glazed ring doughnut'], group: 'dessert', portion: p(75, PIECE), adjust: { fat: FAT_FRIED, sweet: sweet(6) }, food101: 'donuts' },
  { id: 'dumplings', label: say('Pierożki na parze (dim sum)', 'Steamed dumplings'), prompts: ['dumplings', 'chinese steamed dumplings', 'dim sum in a bamboo steamer'], group: 'main', portion: p(200, PIECES(8)), adjust: { fat: FAT_COOKED }, food101: 'dumplings' },
  { id: 'edamame', label: say('Edamame', 'Edamame'), prompts: ['edamame', 'steamed green soybean pods with salt'], group: 'snack', portion: p(100, say('1 miseczka, ziarna bez strąków', '1 small bowl, shelled')), adjust: {}, food101: 'edamame' },
  { id: 'eggsBenedict', label: say('Jajka po benedyktyńsku', 'Eggs Benedict'), prompts: ['eggs benedict', 'poached eggs with hollandaise on an english muffin'], group: 'breakfast', portion: p(310, PIECES_FEW(2)), adjust: { sauce: sauce('hollandaise', 5) }, food101: 'eggs_benedict' },
  { id: 'escargots', label: say('Ślimaki (escargots)', 'Escargots'), prompts: ['escargots', 'snails in garlic herb butter'], group: 'main', portion: p(85, PIECES(12)), adjust: { fat: FAT_FRIED }, food101: 'escargots' },
  { id: 'falafel', label: say('Falafel', 'Falafel'), prompts: ['falafel', 'fried chickpea falafel balls'], group: 'main', portion: p(100, say('5 kulek', '5 balls')), adjust: { fat: FAT_FRIED }, food101: 'falafel' },
  { id: 'filetMignon', label: say('Polędwica wołowa (filet mignon)', 'Filet mignon'), prompts: ['filet mignon', 'beef tenderloin steak'], group: 'main', portion: p(200, say('1 stek', '1 steak')), adjust: { fat: FAT_COOKED }, food101: 'filet_mignon' },
  { id: 'fishAndChips', label: say('Fish and chips', 'Fish and chips'), prompts: ['fish and chips', 'battered fried fish with chips'], group: 'main', portion: p(410, PLATE), adjust: { fat: FAT_FRIED, sauce: sauce('tartar', 3) }, food101: 'fish_and_chips' },
  { id: 'foieGras', label: say('Foie gras', 'Foie gras'), prompts: ['foie gras', 'seared foie gras', 'goose liver pate'], group: 'snack', portion: p(50, SERVING), adjust: {}, food101: 'foie_gras' },
  { id: 'frenchFries', label: say('Frytki', 'French fries'), prompts: ['french fries', 'chips', 'fries in a paper cone'], group: 'side', portion: p(150, SERVING), adjust: { fat: FAT_FRIED }, food101: 'french_fries' },
  { id: 'frenchOnionSoup', label: say('Zupa cebulowa', 'French onion soup'), prompts: ['french onion soup', 'onion soup with a melted cheese crouton'], group: 'soup', portion: p(300, SOUP), adjust: { fat: FAT_LIGHT }, food101: 'french_onion_soup' },
  { id: 'frenchToast', label: say('Tosty francuskie', 'French toast'), prompts: ['french toast', 'egg-soaked fried bread slices'], group: 'breakfast', portion: p(130, say('2 kromki', '2 slices')), adjust: { fat: FAT_RICH, sweet: sweet(5, 'none') }, food101: 'french_toast' },
  { id: 'friedCalamari', label: say('Kalmary w panierce', 'Fried calamari'), prompts: ['fried calamari', 'breaded squid rings'], group: 'main', portion: p(150, SERVING), adjust: { fat: FAT_FRIED }, food101: 'fried_calamari' },
  { id: 'friedRice', label: say('Smażony ryż', 'Fried rice'), prompts: ['fried rice', 'chinese egg fried rice'], group: 'rice', portion: p(300, PLATE), adjust: { fat: FAT_COOKED }, food101: 'fried_rice' },
  { id: 'frozenYogurt', label: say('Mrożony jogurt', 'Frozen yogurt'), prompts: ['frozen yogurt', 'soft serve frozen yogurt with toppings'], group: 'dessert', portion: p(150, say('1 kubeczek', '1 cup')), adjust: { sweet: sweet(5) }, food101: 'frozen_yogurt' },
  { id: 'garlicBread', label: say('Pieczywo czosnkowe', 'Garlic bread'), prompts: ['garlic bread', 'toasted bread with garlic butter'], group: 'side', portion: p(80, say('2 kromki', '2 slices')), adjust: { fat: FAT_RICH }, food101: 'garlic_bread' },
  { id: 'gnocchi', label: say('Gnocchi', 'Gnocchi'), prompts: ['gnocchi', 'potato gnocchi with sauce'], group: 'pasta', portion: p(250, PLATE), adjust: { fat: FAT_COOKED }, food101: 'gnocchi' },
  { id: 'greekSalad', label: say('Sałatka grecka', 'Greek salad'), prompts: ['greek salad', 'salad with feta cheese, olives, tomato and cucumber'], group: 'salad', portion: p(330, SERVING), adjust: { sauce: sauce('oliveOil', 2) }, food101: 'greek_salad' },
  { id: 'grilledCheeseSandwich', label: say('Grillowana kanapka z serem', 'Grilled cheese sandwich'), prompts: ['grilled cheese sandwich', 'toasted sandwich with melted cheese'], group: 'sandwich', portion: p(120, SANDWICH), adjust: { fat: FAT_RICH }, food101: 'grilled_cheese_sandwich' },
  { id: 'grilledSalmon', label: say('Łosoś z grilla', 'Grilled salmon'), prompts: ['grilled salmon', 'salmon fillet with grill marks'], group: 'main', portion: p(150, say('1 filet', '1 fillet')), adjust: { fat: FAT_COOKED }, food101: 'grilled_salmon' },
  { id: 'guacamole', label: say('Guacamole', 'Guacamole'), prompts: ['guacamole', 'avocado dip in a bowl'], group: 'snack', portion: p(100, SERVING), adjust: {}, food101: 'guacamole' },
  { id: 'gyoza', label: say('Gyoza', 'Gyoza'), prompts: ['gyoza', 'pan-fried japanese dumplings', 'potstickers'], group: 'main', portion: p(150, PIECES(6)), adjust: { fat: FAT_RICH }, food101: 'gyoza' },
  { id: 'hamburger', label: say('Hamburger', 'Hamburger'), prompts: ['hamburger', 'beef burger in a bun'], group: 'sandwich', portion: p(220, PIECE), adjust: { fat: FAT_COOKED }, food101: 'hamburger' },
  { id: 'hotAndSourSoup', label: say('Zupa kwaśno-ostra', 'Hot and sour soup'), prompts: ['hot and sour soup', 'chinese hot and sour soup'], group: 'soup', portion: p(300, SOUP), adjust: { fat: FAT_LIGHT }, food101: 'hot_and_sour_soup' },
  { id: 'hotDog', label: say('Hot dog', 'Hot dog'), prompts: ['hot dog', 'sausage in a bun with mustard'], group: 'sandwich', portion: p(110, PIECE), adjust: { fat: FAT_COOKED }, food101: 'hot_dog' },
  { id: 'huevosRancheros', label: say('Huevos rancheros', 'Huevos rancheros'), prompts: ['huevos rancheros', 'fried eggs on tortillas with salsa'], group: 'breakfast', portion: p(240, SERVING), adjust: { fat: FAT_COOKED }, food101: 'huevos_rancheros' },
  { id: 'hummus', label: say('Hummus', 'Hummus'), prompts: ['hummus', 'chickpea hummus with olive oil'], group: 'snack', portion: p(70, SERVING), adjust: { fat: FAT_RICH }, food101: 'hummus' },
  { id: 'iceCream', label: say('Lody', 'Ice cream'), prompts: ['ice cream', 'scoops of ice cream in a bowl'], group: 'dessert', portion: p(110, say('2 gałki', '2 scoops')), adjust: { fat: FAT_COOKED, sweet: sweet(5) }, food101: 'ice_cream' },
  { id: 'lasagna', label: say('Lasagne', 'Lasagna'), prompts: ['lasagna', 'baked lasagne with meat sauce and cheese'], group: 'pasta', portion: p(300, SERVING), adjust: { fat: FAT_COOKED }, food101: 'lasagna' },
  { id: 'lobsterBisque', label: say('Zupa z homara (bisque)', 'Lobster bisque'), prompts: ['lobster bisque', 'creamy seafood bisque'], group: 'soup', portion: p(300, SOUP), adjust: { fat: FAT_LIGHT }, food101: 'lobster_bisque' },
  { id: 'lobsterRollSandwich', label: say('Lobster roll', 'Lobster roll'), prompts: ['lobster roll sandwich', 'lobster salad in a buttered roll'], group: 'sandwich', portion: p(175, PIECE), adjust: { fat: FAT_RICH }, food101: 'lobster_roll_sandwich' },
  { id: 'macaroniAndCheese', label: say('Makaron z serem (mac and cheese)', 'Macaroni and cheese'), prompts: ['macaroni and cheese', 'mac and cheese'], group: 'pasta', portion: p(280, PLATE), adjust: { fat: FAT_COOKED }, food101: 'macaroni_and_cheese' },
  { id: 'macarons', label: say('Makaroniki', 'Macarons'), prompts: ['macarons', 'french macarons in pastel colours'], group: 'dessert', portion: p(45, PIECES_FEW(3)), adjust: {}, food101: 'macarons' },
  { id: 'misoSoup', label: say('Zupa miso', 'Miso soup'), prompts: ['miso soup', 'japanese miso soup with tofu and seaweed'], group: 'soup', portion: p(250, SMALL_BOWL), adjust: {}, food101: 'miso_soup' },
  { id: 'mussels', label: say('Mule', 'Mussels'), prompts: ['mussels', 'steamed mussels in white wine sauce'], group: 'main', portion: p(200, say('1 porcja bez muszli', '1 serving, shelled')), adjust: { fat: FAT_COOKED }, food101: 'mussels' },
  { id: 'nachos', label: say('Nachos', 'Nachos'), prompts: ['nachos', 'tortilla chips with melted cheese and jalapenos'], group: 'snack', portion: p(250, SERVING), adjust: { fat: FAT_RICH }, food101: 'nachos' },
  { id: 'omelette', label: say('Omlet', 'Omelette'), prompts: ['omelette', 'folded egg omelet'], group: 'breakfast', portion: p(165, say('z 3 jajek', 'of 3 eggs')), adjust: { fat: FAT_RICH }, food101: 'omelette' },
  { id: 'onionRings', label: say('Krążki cebulowe', 'Onion rings'), prompts: ['onion rings', 'battered fried onion rings'], group: 'side', portion: p(120, SERVING), adjust: { fat: FAT_FRIED }, food101: 'onion_rings' },
  { id: 'oysters', label: say('Ostrygi', 'Oysters'), prompts: ['oysters', 'raw oysters on the half shell'], group: 'main', portion: p(90, PIECES(6)), adjust: {}, food101: 'oysters' },
  { id: 'padThai', label: say('Pad thai', 'Pad thai'), prompts: ['pad thai', 'thai stir-fried rice noodles with peanuts'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED }, food101: 'pad_thai' },
  { id: 'paella', label: say('Paella', 'Paella'), prompts: ['paella', 'spanish rice with seafood in a pan'], group: 'rice', portion: p(350, PLATE), adjust: { fat: FAT_COOKED }, food101: 'paella' },
  { id: 'pancakes', label: say('Pancakes', 'Pancakes'), prompts: ['pancakes', 'stack of fluffy american pancakes'], group: 'breakfast', portion: p(150, PIECES_FEW(3)), adjust: { fat: FAT_COOKED, sweet: sweet(5, 'none') }, food101: 'pancakes' },
  { id: 'pannaCotta', label: say('Panna cotta', 'Panna cotta'), prompts: ['panna cotta', 'cream dessert with berry sauce'], group: 'dessert', portion: p(130, say('1 pucharek', '1 cup')), adjust: { fat: FAT_RICH, sweet: sweet(5) }, food101: 'panna_cotta' },
  { id: 'pekingDuck', label: say('Kaczka po pekińsku', 'Peking duck'), prompts: ['peking duck', 'sliced roast duck with pancakes and hoisin'], group: 'main', portion: p(190, SERVING), adjust: { fat: FAT_RICH, sauce: sauce('hoisin', 5) }, food101: 'peking_duck' },
  { id: 'pho', label: say('Pho', 'Pho'), prompts: ['pho', 'vietnamese beef noodle soup'], group: 'soup', portion: p(500, say('1 duża miska', '1 large bowl')), adjust: { fat: FAT_LIGHT }, food101: 'pho' },
  { id: 'pizza', label: say('Pizza margherita', 'Pizza'), prompts: ['pizza', 'cheese pizza', 'margherita pizza'], group: 'pizza', portion: p(330, HALF_PIZZA), adjust: { fat: FAT_COOKED }, food101: 'pizza' },
  { id: 'porkChop', label: say('Kotlet z kością (pork chop)', 'Pork chop'), prompts: ['pork chop', 'grilled pork chop on the bone'], group: 'main', portion: p(150, CUTLET), adjust: { fat: FAT_RICH }, food101: 'pork_chop' },
  { id: 'poutine', label: say('Poutine', 'Poutine'), prompts: ['poutine', 'fries with cheese curds and gravy'], group: 'main', portion: p(400, SERVING), adjust: { fat: FAT_RICH, sauce: sauce('gravy', 15) }, food101: 'poutine' },
  { id: 'primeRib', label: say('Antrykot pieczony (prime rib)', 'Prime rib'), prompts: ['prime rib', 'slice of roast beef rib'], group: 'main', portion: p(250, say('1 plaster', '1 slice')), adjust: { fat: FAT_FRIED }, food101: 'prime_rib' },
  { id: 'pulledPorkSandwich', label: say('Kanapka z szarpaną wieprzowiną', 'Pulled pork sandwich'), prompts: ['pulled pork sandwich', 'bbq pulled pork burger'], group: 'sandwich', portion: p(200, PIECE), adjust: { fat: FAT_COOKED }, food101: 'pulled_pork_sandwich' },
  { id: 'ramen', label: say('Ramen', 'Ramen'), prompts: ['ramen', 'japanese noodle soup with egg and pork'], group: 'soup', portion: p(550, say('1 duża miska', '1 large bowl')), adjust: { fat: { step: 1.5 } }, food101: 'ramen' },
  { id: 'ravioli', label: say('Ravioli', 'Ravioli'), prompts: ['ravioli', 'ravioli in tomato sauce'], group: 'pasta', portion: p(300, PLATE), adjust: { fat: FAT_COOKED }, food101: 'ravioli' },
  { id: 'redVelvetCake', label: say('Ciasto red velvet', 'Red velvet cake'), prompts: ['red velvet cake', 'red sponge cake with cream cheese frosting'], group: 'dessert', portion: p(110, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(8) }, food101: 'red_velvet_cake' },
  { id: 'risotto', label: say('Risotto', 'Risotto'), prompts: ['risotto', 'creamy mushroom risotto with parmesan'], group: 'rice', portion: p(320, PLATE), adjust: { fat: FAT_COOKED }, food101: 'risotto' },
  { id: 'samosa', label: say('Samosa', 'Samosa'), prompts: ['samosa', 'fried triangular indian pastry'], group: 'snack', portion: p(150, PIECES_FEW(2)), adjust: { fat: FAT_FRIED }, food101: 'samosa' },
  { id: 'sashimi', label: say('Sashimi', 'Sashimi'), prompts: ['sashimi', 'slices of raw salmon and tuna'], group: 'sushi', portion: p(120, say('8 plasterków', '8 slices')), adjust: {}, food101: 'sashimi' },
  { id: 'scallops', label: say('Przegrzebki', 'Scallops'), prompts: ['scallops', 'seared scallops'], group: 'main', portion: p(120, SERVING), adjust: { fat: FAT_COOKED }, food101: 'scallops' },
  { id: 'seaweedSalad', label: say('Sałatka z wakame', 'Seaweed salad'), prompts: ['seaweed salad', 'green wakame salad with sesame'], group: 'salad', portion: p(100, SMALL_BOWL), adjust: {}, food101: 'seaweed_salad' },
  { id: 'shrimpAndGrits', label: say('Krewetki z kaszką kukurydzianą', 'Shrimp and grits'), prompts: ['shrimp and grits', 'prawns over creamy cheese grits'], group: 'main', portion: p(365, PLATE), adjust: { fat: FAT_COOKED }, food101: 'shrimp_and_grits' },
  { id: 'spaghettiBolognese', label: say('Spaghetti bolognese', 'Spaghetti bolognese'), prompts: ['spaghetti bolognese', 'spaghetti with meat sauce'], group: 'pasta', portion: p(380, PLATE), adjust: { fat: FAT_COOKED, sauce: sauce('bolognese', 20) }, food101: 'spaghetti_bolognese' },
  { id: 'spaghettiCarbonara', label: say('Spaghetti carbonara', 'Spaghetti carbonara'), prompts: ['spaghetti carbonara', 'pasta with egg, bacon and parmesan'], group: 'pasta', portion: p(320, PLATE), adjust: { fat: FAT_RICH }, food101: 'spaghetti_carbonara' },
  { id: 'springRolls', label: say('Sajgonki', 'Spring rolls'), prompts: ['spring rolls', 'fried spring rolls', 'crispy egg rolls'], group: 'snack', portion: p(130, PIECES_FEW(2)), adjust: { fat: FAT_FRIED }, food101: 'spring_rolls' },
  { id: 'steak', label: say('Stek wołowy', 'Steak'), prompts: ['steak', 'grilled beef steak'], group: 'main', portion: p(200, say('1 stek', '1 steak')), adjust: { fat: FAT_RICH }, food101: 'steak' },
  { id: 'strawberryShortcake', label: say('Biszkopt z truskawkami i bitą śmietaną', 'Strawberry shortcake'), prompts: ['strawberry shortcake', 'sponge cake with strawberries and whipped cream'], group: 'dessert', portion: p(150, SLICE), adjust: { fat: FAT_COOKED, sweet: sweet(6) }, food101: 'strawberry_shortcake' },
  { id: 'sushi', label: say('Sushi (zestaw)', 'Sushi'), prompts: ['sushi', 'sushi platter with rolls and nigiri'], group: 'sushi', portion: p(240, say('8 kawałków', '8 pieces')), adjust: {}, food101: 'sushi' },
  { id: 'tacos', label: say('Tacos', 'Tacos'), prompts: ['tacos', 'mexican tacos with beef and cheese'], group: 'main', portion: p(210, PIECES_FEW(2)), adjust: { fat: FAT_COOKED }, food101: 'tacos' },
  { id: 'takoyaki', label: say('Takoyaki', 'Takoyaki'), prompts: ['takoyaki', 'japanese octopus balls with sauce and bonito flakes'], group: 'snack', portion: p(120, PIECES(6)), adjust: { fat: FAT_COOKED }, food101: 'takoyaki' },
  { id: 'tiramisu', label: say('Tiramisu', 'Tiramisu'), prompts: ['tiramisu', 'tiramisu dusted with cocoa'], group: 'dessert', portion: p(150, SERVING), adjust: { fat: FAT_RICH, sweet: sweet(5) }, food101: 'tiramisu' },
  { id: 'tunaTartare', label: say('Tatar z tuńczyka', 'Tuna tartare'), prompts: ['tuna tartare', 'diced raw tuna with avocado'], group: 'main', portion: p(155, SERVING), adjust: { fat: FAT_COOKED }, food101: 'tuna_tartare' },
  { id: 'waffles', label: say('Gofry', 'Waffles'), prompts: ['waffles', 'belgian waffle'], group: 'dessert', portion: p(100, say('1 gofr', '1 waffle')), adjust: { fat: FAT_COOKED, sweet: sweet(6, 'none') }, food101: 'waffles' },

  // --- Polish and Central European ---
  { id: 'pierogiRuskie', label: say('Pierogi ruskie', 'Pierogi with potato and cheese'), prompts: ['pierogi', 'polish dumplings with fried onion', 'boiled dumplings with potato and cheese filling'], group: 'main', portion: p(280, say('8 sztuk z cebulką', '8 pieces with onion')), adjust: { fat: FAT_RICH } },
  { id: 'pierogiMeat', label: say('Pierogi z mięsem', 'Pierogi with meat'), prompts: ['pierogi with meat', 'polish meat dumplings'], group: 'main', portion: p(280, PIECES(8)), adjust: { fat: FAT_RICH } },
  { id: 'pierogiCabbage', label: say('Pierogi z kapustą i grzybami', 'Pierogi with sauerkraut and mushrooms'), prompts: ['pierogi with cabbage', 'polish dumplings with sauerkraut and mushroom filling'], group: 'main', portion: p(280, PIECES(8)), adjust: { fat: FAT_RICH } },
  { id: 'pierogiFruit', label: say('Pierogi z jagodami', 'Pierogi with blueberries'), prompts: ['blueberry pierogi', 'sweet dumplings with blueberries and cream'], group: 'main', portion: p(280, PIECES(8)), adjust: { sweet: sweet(3), sauce: sauce('sourCream', 5) } },
  { id: 'bigos', label: say('Bigos', "Bigos (hunter's stew)"), prompts: ['bigos', 'polish hunters stew with sauerkraut and sausage'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'zurek', label: say('Żurek', 'Sour rye soup (zurek)'), prompts: ['zurek', 'polish sour rye soup with sausage and egg'], group: 'soup', portion: p(450, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'rosol', label: say('Rosół z makaronem', 'Chicken soup with noodles'), prompts: ['chicken noodle soup', 'clear chicken broth with noodles and carrot'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'kotletSchabowy', label: say('Kotlet schabowy', 'Breaded pork cutlet'), prompts: ['breaded pork cutlet', 'pork schnitzel', 'polish pork chop schabowy'], group: 'main', portion: p(150, CUTLET), adjust: { fat: FAT_RICH } },
  { id: 'schabowyPlate', label: say('Schabowy z ziemniakami i surówką', 'Pork cutlet with potatoes and slaw'), prompts: ['breaded pork cutlet with boiled potatoes and cabbage salad', 'polish dinner plate with schnitzel and potatoes'], group: 'main', portion: p(460, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'golabki', label: say('Gołąbki', 'Cabbage rolls'), prompts: ['stuffed cabbage rolls', 'golabki in tomato sauce'], group: 'main', portion: p(400, say('2 sztuki z sosem', '2 rolls with sauce')), adjust: { fat: FAT_COOKED, sauce: sauce('tomato', 12) } },
  { id: 'plackiZiemniaczane', label: say('Placki ziemniaczane', 'Potato pancakes'), prompts: ['potato pancakes', 'fried potato latkes'], group: 'main', portion: p(225, say('3 placki', '3 pancakes')), adjust: { fat: FAT_FRIED, sauce: sauce('sourCream', 8, 'none') } },
  { id: 'nalesnikiZSerem', label: say('Naleśniki z serem', 'Crêpes with sweet cheese'), prompts: ['crepes with sweet cottage cheese', 'rolled pancakes with white cheese filling'], group: 'main', portion: p(200, say('2 naleśniki', '2 crêpes')), adjust: { fat: FAT_COOKED, sweet: sweet(2), sauce: sauce('sourCream', 5, 'none') } },
  { id: 'nalesnikiZDzemem', label: say('Naleśniki z dżemem', 'Crêpes with jam'), prompts: ['crepes with jam', 'thin rolled pancakes with jam'], group: 'dessert', portion: p(135, say('2 naleśniki', '2 crêpes')), adjust: { fat: FAT_COOKED, sweet: sweet(5) } },
  { id: 'kopytka', label: say('Kopytka', 'Potato dumplings (kopytka)'), prompts: ['potato dumplings kopytka', 'polish gnocchi with butter'], group: 'main', portion: p(250, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'kluskiSlaskie', label: say('Kluski śląskie z sosem', 'Silesian dumplings with gravy'), prompts: ['silesian potato dumplings with gravy', 'round potato dumplings with a dimple'], group: 'main', portion: p(280, PLATE), adjust: { fat: FAT_LIGHT, sauce: sauce('gravy', 14) } },
  { id: 'barszczCzerwony', label: say('Barszcz czerwony', 'Clear beet soup'), prompts: ['clear beetroot soup', 'red borscht in a cup'], group: 'soup', portion: ml(250, MUG), adjust: {} },
  { id: 'barszczZUszkami', label: say('Barszcz z uszkami', 'Borscht with mushroom dumplings'), prompts: ['red borscht with small dumplings', 'beet soup with mushroom uszka'], group: 'soup', portion: p(300, SOUP), adjust: {} },
  { id: 'zupaPomidorowa', label: say('Zupa pomidorowa', 'Tomato soup'), prompts: ['tomato soup', 'tomato soup with rice'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'ogorkowa', label: say('Zupa ogórkowa', 'Sour cucumber soup'), prompts: ['cucumber soup', 'sour cucumber soup with potatoes'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'grochowka', label: say('Grochówka', 'Split pea soup'), prompts: ['split pea soup', 'thick pea soup with sausage'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'krupnik', label: say('Krupnik', 'Barley soup'), prompts: ['barley soup', 'soup with pearl barley and vegetables'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'kapusniak', label: say('Kapuśniak', 'Sauerkraut soup'), prompts: ['sauerkraut soup', 'cabbage soup with sausage'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'grzybowa', label: say('Zupa grzybowa', 'Mushroom soup'), prompts: ['mushroom soup', 'wild mushroom soup with noodles'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'zupaJarzynowa', label: say('Zupa jarzynowa', 'Vegetable soup'), prompts: ['vegetable soup', 'clear soup with diced vegetables'], group: 'soup', portion: p(350, SOUP), adjust: {} },
  { id: 'chlodnik', label: say('Chłodnik', 'Cold beet soup'), prompts: ['cold beet soup', 'pink chlodnik with egg and dill'], group: 'soup', portion: p(330, SOUP), adjust: {} },
  { id: 'zupaGulaszowa', label: say('Zupa gulaszowa', 'Goulash soup'), prompts: ['goulash soup', 'beef and paprika soup'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'fasolkaPoBretonsku', label: say('Fasolka po bretońsku', 'Beans in tomato sauce with sausage'), prompts: ['white beans in tomato sauce with sausage', 'bean stew with kielbasa'], group: 'main', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'gulasz', label: say('Gulasz wieprzowy', 'Pork goulash'), prompts: ['pork goulash', 'meat stew in gravy'], group: 'main', portion: p(250, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'plackiPoWegiersku', label: say('Placek po węgiersku', 'Potato pancake with goulash'), prompts: ['potato pancake topped with goulash and sour cream'], group: 'main', portion: p(420, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'kaszanka', label: say('Kaszanka z cebulą', 'Blood sausage with onion'), prompts: ['fried blood sausage with onions', 'kaszanka'], group: 'main', portion: p(190, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'kielbasaZGrilla', label: say('Kiełbasa z grilla', 'Grilled kielbasa'), prompts: ['grilled sausage', 'kielbasa on the grill'], group: 'main', portion: p(150, say('1 kiełbasa', '1 sausage')), adjust: { sauce: sauce('ketchup', 5, 'none') } },
  { id: 'parowki', label: say('Parówki', 'Frankfurters'), prompts: ['frankfurters', 'boiled hot dog sausages on a plate'], group: 'breakfast', portion: p(100, PIECES_FEW(3)), adjust: { sauce: sauce('ketchup', 5, 'none') } },
  { id: 'racuchy', label: say('Racuchy z jabłkami', 'Apple fritters'), prompts: ['apple fritters', 'yeast pancakes with apples and powdered sugar'], group: 'dessert', portion: p(200, say('4 racuchy', '4 fritters')), adjust: { fat: FAT_FRIED, sweet: sweet(4) } },
  { id: 'leniwe', label: say('Pierogi leniwe', 'Lazy cheese dumplings'), prompts: ['lazy cheese dumplings', 'cottage cheese dumplings with butter and breadcrumbs'], group: 'main', portion: p(250, PLATE), adjust: { fat: FAT_COOKED, sweet: sweet(2) } },
  { id: 'kotletMielony', label: say('Kotlet mielony', 'Fried meat patty'), prompts: ['fried minced pork patty', 'meat cutlet'], group: 'main', portion: p(200, say('2 kotlety', '2 patties')), adjust: { fat: FAT_RICH } },
  { id: 'kotletZKurczaka', label: say('Kotlet z kurczaka panierowany', 'Breaded chicken cutlet'), prompts: ['breaded chicken breast', 'chicken schnitzel'], group: 'main', portion: p(150, CUTLET), adjust: { fat: FAT_RICH } },
  { id: 'sznycelWiedenski', label: say('Sznycel wiedeński', 'Wiener schnitzel'), prompts: ['wiener schnitzel', 'breaded veal cutlet with lemon'], group: 'main', portion: p(150, CUTLET), adjust: { fat: FAT_RICH } },
  { id: 'strogonow', label: say('Strogonow wołowy', 'Beef stroganoff'), prompts: ['beef stroganoff', 'beef strips in creamy mushroom sauce'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'mizeria', label: say('Mizeria', 'Cucumber salad with sour cream'), prompts: ['cucumber salad with sour cream', 'sliced cucumbers in cream with dill'], group: 'salad', portion: p(190, SERVING), adjust: { sauce: sauce('sourCream', 10) } },
  { id: 'surowkaZKapusty', label: say('Surówka z kapusty', 'Cabbage slaw'), prompts: ['white cabbage salad', 'shredded cabbage and carrot slaw'], group: 'salad', portion: p(150, SERVING), adjust: { fat: FAT_LIGHT } },
  { id: 'surowkaZMarchewki', label: say('Surówka z marchewki', 'Carrot and apple salad'), prompts: ['grated carrot salad with apple'], group: 'salad', portion: p(150, SERVING), adjust: {} },
  { id: 'ziemniaki', label: say('Ziemniaki z koperkiem', 'Boiled potatoes'), prompts: ['boiled potatoes with dill', 'new potatoes'], group: 'side', portion: p(200, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'puree', label: say('Puree ziemniaczane', 'Mashed potatoes'), prompts: ['mashed potatoes', 'potato puree'], group: 'side', portion: p(200, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'kaszaGryczana', label: say('Kasza gryczana', 'Buckwheat groats'), prompts: ['buckwheat groats', 'cooked kasha'], group: 'side', portion: p(150, SERVING), adjust: {} },
  { id: 'salatkaJarzynowa', label: say('Sałatka jarzynowa', 'Vegetable salad with mayonnaise'), prompts: ['vegetable salad with mayonnaise', 'diced potato and vegetable salad'], group: 'salad', portion: p(200, SERVING), adjust: { sauce: sauce('mayo', 6) } },
  { id: 'sledzWSmietanie', label: say('Śledź w śmietanie', 'Herring in sour cream'), prompts: ['herring in sour cream with onion', 'marinated herring fillets'], group: 'main', portion: p(150, SERVING), adjust: { sauce: sauce('sourCream', 15) } },
  { id: 'makowiec', label: say('Makowiec', 'Poppy seed roll'), prompts: ['poppy seed roll cake', 'slice of poppy seed cake'], group: 'dessert', portion: p(80, SLICE), adjust: { sweet: sweet(5) } },
  { id: 'sernik', label: say('Sernik', 'Baked cheesecake (sernik)'), prompts: ['baked cheesecake', 'polish sernik slice'], group: 'dessert', portion: p(120, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(6) } },
  { id: 'paczek', label: say('Pączek', 'Filled doughnut'), prompts: ['doughnut with jam filling and icing', 'polish paczek'], group: 'dessert', portion: p(80, PIECE), adjust: { fat: FAT_FRIED, sweet: sweet(5) } },
  { id: 'drozdzowka', label: say('Drożdżówka z serem', 'Sweet cheese bun'), prompts: ['sweet yeast bun with cheese', 'danish pastry'], group: 'dessert', portion: p(90, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'kremowka', label: say('Kremówka (napoleonka)', 'Cream slice'), prompts: ['cream slice napoleon', 'puff pastry with custard cream'], group: 'dessert', portion: p(100, SLICE), adjust: { fat: FAT_RICH } },
  { id: 'kanapkaZSzynka', label: say('Kanapki z szynką i serem', 'Ham and cheese sandwiches'), prompts: ['open sandwiches with ham and cheese', 'bread with butter, ham, cheese and tomato'], group: 'sandwich', portion: p(150, say('2 kanapki', '2 sandwiches')), adjust: { fat: FAT_RICH } },
  { id: 'kanapkaZTwarozkiem', label: say('Kanapki z twarożkiem', 'Sandwiches with cottage cheese spread'), prompts: ['rye bread with cottage cheese spread and radish'], group: 'sandwich', portion: p(165, say('2 kanapki', '2 sandwiches')), adjust: { fat: FAT_COOKED } },
  { id: 'bulkaZDzemem', label: say('Bułka z masłem i dżemem', 'Roll with butter and jam'), prompts: ['bread roll with butter and jam'], group: 'breakfast', portion: p(95, say('1 bułka', '1 roll')), adjust: { fat: FAT_RICH, sweet: sweet(4) } },
  { id: 'zapiekanka', label: say('Zapiekanka', 'Toasted baguette with mushrooms and cheese'), prompts: ['zapiekanka', 'toasted baguette with mushrooms, melted cheese and ketchup'], group: 'sandwich', portion: p(260, PIECE), adjust: { fat: FAT_COOKED, sauce: sauce('ketchup', 5) } },
  { id: 'kebabWBulce', label: say('Kebab w bułce', 'Kebab in pita'), prompts: ['doner kebab in pita bread', 'kebab sandwich with garlic sauce'], group: 'sandwich', portion: p(315, PIECE), adjust: { fat: FAT_RICH, sauce: sauce('garlic', 6) } },
  { id: 'kebabTortilla', label: say('Kebab w tortilli', 'Kebab wrap'), prompts: ['kebab wrap', 'durum doner wrap'], group: 'sandwich', portion: p(315, PIECE), adjust: { fat: FAT_RICH, sauce: sauce('garlic', 6) } },
  { id: 'kebabBox', label: say('Kebab na talerzu z frytkami', 'Kebab with fries'), prompts: ['kebab box with fries', 'doner meat with chips and salad'], group: 'main', portion: p(430, PLATE), adjust: { fat: FAT_RICH, sauce: sauce('garlic', 6) } },
  { id: 'knedle', label: say('Knedle ze śliwkami', 'Plum dumplings'), prompts: ['plum dumplings with buttered breadcrumbs'], group: 'dessert', portion: p(240, say('4 knedle', '4 dumplings')), adjust: { fat: FAT_COOKED, sweet: sweet(2) } },
  { id: 'langosz', label: say('Langosz', 'Lángos'), prompts: ['langos', 'fried flatbread with sour cream and cheese'], group: 'snack', portion: p(200, PIECE), adjust: { fat: FAT_FRIED } },

  // --- Italian ---
  { id: 'pizzaSalami', label: say('Pizza z salami', 'Salami pizza'), prompts: ['pepperoni pizza', 'salami pizza'], group: 'pizza', portion: p(330, HALF_PIZZA), adjust: { fat: FAT_COOKED } },
  { id: 'pizzaVege', label: say('Pizza wegetariańska', 'Vegetarian pizza'), prompts: ['vegetable pizza', 'pizza with peppers, mushrooms and olives'], group: 'pizza', portion: p(330, HALF_PIZZA), adjust: { fat: FAT_COOKED } },
  { id: 'pizzaCapricciosa', label: say('Pizza z szynką i pieczarkami', 'Ham and mushroom pizza'), prompts: ['ham and mushroom pizza', 'capricciosa pizza'], group: 'pizza', portion: p(330, HALF_PIZZA), adjust: { fat: FAT_COOKED } },
  { id: 'pizzaHawaii', label: say('Pizza hawajska', 'Hawaiian pizza'), prompts: ['hawaiian pizza', 'pizza with ham and pineapple'], group: 'pizza', portion: p(330, HALF_PIZZA), adjust: { fat: FAT_COOKED } },
  { id: 'calzone', label: say('Calzone', 'Calzone'), prompts: ['calzone', 'folded pizza turnover'], group: 'pizza', portion: p(300, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'penneArrabbiata', label: say('Penne arrabbiata', 'Penne arrabbiata'), prompts: ['penne arrabbiata', 'pasta in spicy tomato sauce'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'pastaPesto', label: say('Makaron z pesto', 'Pasta with pesto'), prompts: ['pasta with pesto', 'green basil pesto pasta'], group: 'pasta', portion: p(255, PLATE), adjust: { sauce: sauce('pesto', 6) } },
  { id: 'fettuccineAlfredo', label: say('Fettuccine Alfredo', 'Fettuccine Alfredo'), prompts: ['fettuccine alfredo', 'pasta in creamy parmesan sauce'], group: 'pasta', portion: p(320, PLATE), adjust: { sauce: sauce('cream', 15) } },
  { id: 'aglioOlio', label: say('Spaghetti aglio e olio', 'Spaghetti aglio e olio'), prompts: ['spaghetti aglio e olio', 'spaghetti with garlic and olive oil'], group: 'pasta', portion: p(245, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'tortellini', label: say('Tortellini', 'Tortellini'), prompts: ['tortellini', 'stuffed pasta rings in tomato sauce'], group: 'pasta', portion: p(300, PLATE), adjust: { fat: FAT_LIGHT } },
  { id: 'minestrone', label: say('Minestrone', 'Minestrone'), prompts: ['minestrone', 'italian vegetable soup with pasta and beans'], group: 'soup', portion: p(350, SOUP), adjust: {} },
  { id: 'arancini', label: say('Arancini', 'Arancini'), prompts: ['arancini', 'fried rice balls'], group: 'snack', portion: p(150, PIECES_FEW(2)), adjust: { fat: FAT_FRIED } },
  { id: 'focaccia', label: say('Focaccia', 'Focaccia'), prompts: ['focaccia', 'italian flatbread with olive oil and rosemary'], group: 'side', portion: p(100, SLICE), adjust: { fat: FAT_COOKED } },
  { id: 'melanzane', label: say('Bakłażan zapiekany z parmezanem', 'Eggplant parmigiana'), prompts: ['eggplant parmesan', 'baked aubergine with tomato and cheese'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'chickenParmigiana', label: say('Kurczak parmigiana', 'Chicken parmigiana'), prompts: ['chicken parmesan', 'breaded chicken with tomato sauce and mozzarella'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_RICH } },

  // --- French ---
  { id: 'croissant', label: say('Croissant', 'Croissant'), prompts: ['croissant', 'butter croissant'], group: 'breakfast', portion: p(70, PIECE), adjust: {} },
  { id: 'quiche', label: say('Quiche lotaryńska', 'Quiche Lorraine'), prompts: ['quiche', 'slice of quiche lorraine'], group: 'main', portion: p(150, SLICE), adjust: { fat: FAT_RICH } },
  { id: 'ratatouille', label: say('Ratatouille', 'Ratatouille'), prompts: ['ratatouille', 'stewed provencal vegetables'], group: 'main', portion: p(250, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'boeufBourguignon', label: say('Wołowina po burgundzku', 'Beef bourguignon'), prompts: ['beef bourguignon', 'beef stewed in red wine'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'croqueMonsieur', label: say('Croque monsieur', 'Croque monsieur'), prompts: ['croque monsieur', 'grilled ham and cheese sandwich with bechamel'], group: 'sandwich', portion: p(195, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'eclair', label: say('Ekler', 'Éclair'), prompts: ['eclair', 'chocolate eclair'], group: 'dessert', portion: p(90, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(5) } },
  { id: 'nicoise', label: say('Sałatka nicejska', 'Salade niçoise'), prompts: ['salade nicoise', 'tuna salad with egg, green beans and olives'], group: 'salad', portion: p(415, SERVING), adjust: { sauce: sauce('vinaigrette', 4) } },

  // --- Spanish ---
  { id: 'tortillaEspanola', label: say('Tortilla hiszpańska', 'Spanish omelette'), prompts: ['spanish omelette', 'tortilla espanola with potatoes'], group: 'main', portion: p(200, SLICE), adjust: { fat: FAT_RICH } },
  { id: 'gazpacho', label: say('Gazpacho', 'Gazpacho'), prompts: ['gazpacho', 'cold tomato soup'], group: 'soup', portion: p(300, BOWL), adjust: {} },
  { id: 'patatasBravas', label: say('Patatas bravas', 'Patatas bravas'), prompts: ['patatas bravas', 'fried potato cubes with spicy tomato sauce and aioli'], group: 'side', portion: p(255, SERVING), adjust: { fat: FAT_RICH, sauce: sauce('mayo', 3) } },
  { id: 'croquetas', label: say('Krokiety z szynką (croquetas)', 'Ham croquettes'), prompts: ['croquetas', 'fried ham croquettes'], group: 'snack', portion: p(120, PIECES_FEW(4)), adjust: { fat: FAT_FRIED } },

  // --- Greek and Turkish ---
  { id: 'moussaka', label: say('Musaka', 'Moussaka'), prompts: ['moussaka', 'baked aubergine and minced meat with bechamel'], group: 'main', portion: p(330, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'gyros', label: say('Gyros w picie', 'Gyro pita'), prompts: ['gyro pita', 'greek gyros wrap with tzatziki'], group: 'sandwich', portion: p(200, PIECE), adjust: { fat: FAT_COOKED, sauce: sauce('tzatziki', 7) } },
  { id: 'souvlaki', label: say('Souvlaki', 'Souvlaki'), prompts: ['souvlaki', 'grilled pork skewers with vegetables'], group: 'main', portion: p(200, say('2 szaszłyki', '2 skewers')), adjust: { fat: FAT_COOKED } },
  { id: 'tzatziki', label: say('Tzatziki', 'Tzatziki'), prompts: ['tzatziki', 'yogurt and cucumber dip'], group: 'snack', portion: p(60, SERVING), adjust: {} },
  { id: 'spanakopita', label: say('Spanakopita', 'Spanakopita'), prompts: ['spanakopita', 'greek spinach and feta pie'], group: 'snack', portion: p(150, SLICE), adjust: { fat: FAT_RICH } },
  { id: 'dolmades', label: say('Dolmades (gołąbki w liściach winogron)', 'Dolmades'), prompts: ['dolmades', 'stuffed grape leaves'], group: 'snack', portion: p(120, PIECES(6)), adjust: { fat: FAT_RICH } },
  { id: 'lahmacun', label: say('Lahmacun', 'Lahmacun'), prompts: ['lahmacun', 'turkish thin flatbread with minced meat'], group: 'pizza', portion: p(180, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'kofte', label: say('Köfte', 'Köfte'), prompts: ['kofte', 'grilled meatballs', 'turkish kofta kebab'], group: 'main', portion: p(170, PIECES_FEW(4)), adjust: { fat: FAT_RICH } },
  { id: 'menemen', label: say('Menemen', 'Menemen'), prompts: ['menemen', 'turkish scrambled eggs with tomatoes and peppers'], group: 'breakfast', portion: p(230, SERVING), adjust: { fat: FAT_RICH } },

  // --- Middle Eastern ---
  { id: 'falafelWrap', label: say('Falafel w picie', 'Falafel wrap'), prompts: ['falafel wrap', 'falafel in pita with salad'], group: 'sandwich', portion: p(215, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'shawarma', label: say('Szawarma', 'Shawarma'), prompts: ['shawarma', 'chicken shawarma wrap'], group: 'sandwich', portion: p(245, PIECE), adjust: { fat: FAT_RICH, sauce: sauce('garlic', 6) } },
  { id: 'tabbouleh', label: say('Tabbouleh', 'Tabbouleh'), prompts: ['tabbouleh', 'parsley and bulgur salad'], group: 'salad', portion: p(150, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'babaGanoush', label: say('Baba ganoush', 'Baba ganoush'), prompts: ['baba ganoush', 'smoky aubergine dip'], group: 'snack', portion: p(100, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'shakshuka', label: say('Szakszuka', 'Shakshuka'), prompts: ['shakshuka', 'eggs poached in tomato sauce in a pan'], group: 'breakfast', portion: p(340, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'mujadara', label: say('Mudżaddara (ryż z soczewicą)', 'Mujaddara'), prompts: ['mujadara', 'rice with lentils and fried onions'], group: 'rice', portion: p(300, PLATE), adjust: { fat: FAT_COOKED } },

  // --- Indian ---
  { id: 'butterChicken', label: say('Kurczak tikka masala', 'Butter chicken (tikka masala)'), prompts: ['butter chicken', 'chicken tikka masala', 'creamy orange chicken curry'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'dal', label: say('Dal (curry z soczewicy)', 'Dal'), prompts: ['dal', 'yellow lentil curry'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'chanaMasala', label: say('Chana masala (curry z ciecierzycy)', 'Chana masala'), prompts: ['chana masala', 'chickpea curry'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'biryani', label: say('Biryani z kurczakiem', 'Chicken biryani'), prompts: ['chicken biryani', 'spiced rice with chicken'], group: 'rice', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'naan', label: say('Chlebek naan', 'Naan'), prompts: ['naan bread', 'indian flatbread'], group: 'side', portion: p(90, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'palakPaneer', label: say('Palak paneer', 'Palak paneer'), prompts: ['palak paneer', 'spinach curry with paneer cheese'], group: 'main', portion: p(250, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'dosa', label: say('Dosa', 'Dosa'), prompts: ['dosa', 'south indian crepe with potato filling'], group: 'main', portion: p(200, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'pakora', label: say('Pakory', 'Pakora'), prompts: ['pakora', 'fried vegetable fritters'], group: 'snack', portion: p(100, PIECES(8)), adjust: { fat: FAT_RICH } },

  // --- Thai and Vietnamese ---
  { id: 'greenCurry', label: say('Zielone curry', 'Thai green curry'), prompts: ['thai green curry', 'chicken in green coconut curry'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'tomYum', label: say('Tom yum', 'Tom yum'), prompts: ['tom yum soup', 'thai hot and sour shrimp soup'], group: 'soup', portion: p(450, BOWL), adjust: {} },
  { id: 'papayaSalad', label: say('Sałatka z papai (som tam)', 'Papaya salad'), prompts: ['green papaya salad', 'som tam'], group: 'salad', portion: p(245, SERVING), adjust: {} },
  { id: 'satay', label: say('Satay z kurczaka', 'Chicken satay'), prompts: ['chicken satay', 'grilled chicken skewers with peanut sauce'], group: 'main', portion: p(160, say('4 szaszłyki', '4 skewers')), adjust: { sauce: sauce('peanut', 12) } },
  { id: 'mangoStickyRice', label: say('Ryż kleisty z mango', 'Mango sticky rice'), prompts: ['mango sticky rice', 'sweet coconut rice with mango'], group: 'dessert', portion: p(295, SERVING), adjust: { sweet: sweet(2) } },
  { id: 'banhMi', label: say('Banh mi', 'Bánh mì'), prompts: ['banh mi', 'vietnamese baguette sandwich'], group: 'sandwich', portion: p(210, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'summerRolls', label: say('Rolki z papieru ryżowego', 'Fresh spring rolls'), prompts: ['fresh spring rolls', 'vietnamese summer rolls in rice paper'], group: 'snack', portion: p(200, PIECES_FEW(4)), adjust: {} },

  // --- Chinese ---
  { id: 'chowMein', label: say('Makaron chow mein z kurczakiem', 'Chicken chow mein'), prompts: ['chow mein', 'stir-fried noodles with chicken and vegetables', 'lo mein'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'kungPaoChicken', label: say('Kurczak kung pao', 'Kung pao chicken'), prompts: ['kung pao chicken', 'chicken with peanuts and chilli'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'sweetSourChicken', label: say('Kurczak w sosie słodko-kwaśnym', 'Sweet and sour chicken'), prompts: ['sweet and sour chicken', 'battered chicken in red sweet and sour sauce'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_RICH, sauce: sauce('sweetSour', 10) } },
  { id: 'generalTso', label: say('Kurczak generała Tso', "General Tso's chicken"), prompts: ['general tso chicken', 'crispy chicken in sticky sauce'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'orangeChicken', label: say('Kurczak w sosie pomarańczowym', 'Orange chicken'), prompts: ['orange chicken', 'crispy chicken in orange glaze'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'wontonSoup', label: say('Zupa wonton', 'Wonton soup'), prompts: ['wonton soup', 'clear soup with wontons'], group: 'soup', portion: p(400, BOWL), adjust: {} },
  { id: 'bao', label: say('Bao (bułeczki na parze)', 'Bao buns'), prompts: ['bao buns', 'steamed buns with pork belly'], group: 'sandwich', portion: p(160, PIECES_FEW(2)), adjust: { fat: FAT_COOKED } },
  { id: 'mapoTofu', label: say('Mapo tofu', 'Mapo tofu'), prompts: ['mapo tofu', 'spicy tofu with minced pork'], group: 'main', portion: p(265, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'beefBroccoli', label: say('Wołowina z brokułami', 'Beef and broccoli'), prompts: ['beef and broccoli', 'stir-fried beef with broccoli'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'congee', label: say('Kleik ryżowy (congee)', 'Congee'), prompts: ['congee', 'rice porridge with meat'], group: 'rice', portion: p(350, BOWL), adjust: {} },

  // --- Japanese and Korean ---
  { id: 'nigiri', label: say('Nigiri z łososiem', 'Salmon nigiri'), prompts: ['salmon nigiri', 'nigiri sushi with salmon'], group: 'sushi', portion: p(180, PIECES(6)), adjust: {} },
  { id: 'californiaRoll', label: say('California roll', 'California roll'), prompts: ['california roll', 'inside-out sushi roll with crab and avocado'], group: 'sushi', portion: p(240, say('8 kawałków', '8 pieces')), adjust: {} },
  { id: 'salmonRoll', label: say('Maki z łososiem', 'Salmon maki'), prompts: ['salmon maki', 'salmon sushi roll'], group: 'sushi', portion: p(240, say('8 kawałków', '8 pieces')), adjust: {} },
  { id: 'vegetableRoll', label: say('Maki wegetariańskie', 'Vegetable maki'), prompts: ['vegetable sushi roll', 'cucumber and avocado maki'], group: 'sushi', portion: p(240, say('8 kawałków', '8 pieces')), adjust: {} },
  { id: 'tempura', label: say('Tempura', 'Tempura'), prompts: ['tempura', 'battered fried shrimp and vegetables'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_FRIED } },
  { id: 'teriyakiChicken', label: say('Kurczak teriyaki', 'Teriyaki chicken'), prompts: ['teriyaki chicken', 'glazed chicken with teriyaki sauce'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'tonkatsu', label: say('Tonkatsu', 'Tonkatsu'), prompts: ['tonkatsu', 'japanese breaded pork cutlet with shredded cabbage'], group: 'main', portion: p(220, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'katsuCurry', label: say('Katsu curry', 'Katsu curry'), prompts: ['katsu curry', 'breaded cutlet with japanese curry and rice'], group: 'rice', portion: p(440, PLATE), adjust: { fat: FAT_COOKED, sauce: sauce('curry', 14) } },
  { id: 'udon', label: say('Udon', 'Udon'), prompts: ['udon', 'thick wheat noodle soup'], group: 'soup', portion: p(520, BOWL), adjust: {} },
  { id: 'onigiri', label: say('Onigiri', 'Onigiri'), prompts: ['onigiri', 'japanese rice ball wrapped in nori'], group: 'snack', portion: p(115, PIECE), adjust: {} },
  { id: 'pokeBowl', label: say('Poke bowl', 'Poké bowl'), prompts: ['poke bowl', 'rice bowl with raw salmon and avocado'], group: 'rice', portion: p(355, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'kimchi', label: say('Kimchi', 'Kimchi'), prompts: ['kimchi', 'fermented spicy cabbage'], group: 'side', portion: p(100, SERVING), adjust: {} },
  { id: 'bulgogi', label: say('Bulgogi', 'Bulgogi'), prompts: ['bulgogi', 'korean marinated grilled beef'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'koreanFriedChicken', label: say('Kurczak po koreańsku', 'Korean fried chicken'), prompts: ['korean fried chicken', 'glazed crispy chicken pieces'], group: 'main', portion: p(250, SERVING), adjust: { fat: FAT_FRIED } },
  { id: 'tteokbokki', label: say('Tteokbokki', 'Tteokbokki'), prompts: ['tteokbokki', 'spicy korean rice cakes'], group: 'main', portion: p(250, SERVING), adjust: { fat: FAT_COOKED } },

  // --- Mexican ---
  { id: 'burrito', label: say('Burrito', 'Burrito'), prompts: ['burrito', 'large tortilla wrap with rice, beans and meat'], group: 'sandwich', portion: p(300, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'burritoBowl', label: say('Burrito bowl', 'Burrito bowl'), prompts: ['burrito bowl', 'rice bowl with chicken, beans and salsa'], group: 'rice', portion: p(400, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'enchiladas', label: say('Enchiladas', 'Enchiladas'), prompts: ['enchiladas', 'baked tortillas in red sauce with cheese'], group: 'main', portion: p(300, PIECES_FEW(2)), adjust: { fat: FAT_RICH } },
  { id: 'fajitas', label: say('Fajitas z kurczakiem', 'Chicken fajitas'), prompts: ['chicken fajitas', 'tortillas with grilled chicken and peppers'], group: 'main', portion: p(300, PIECES_FEW(2)), adjust: { fat: FAT_RICH } },
  { id: 'chiliConCarne', label: say('Chili con carne', 'Chili con carne'), prompts: ['chili con carne', 'beef and bean chili'], group: 'main', portion: p(350, BOWL), adjust: { fat: FAT_COOKED } },

  // --- American ---
  { id: 'cheeseburger', label: say('Cheeseburger', 'Cheeseburger'), prompts: ['cheeseburger', 'burger with melted cheese'], group: 'sandwich', portion: p(230, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'friedChicken', label: say('Kurczak w panierce smażony', 'Fried chicken'), prompts: ['fried chicken', 'crispy fried chicken drumsticks'], group: 'main', portion: p(250, PIECES_FEW(2)), adjust: { fat: FAT_FRIED } },
  { id: 'chickenNuggets', label: say('Nuggetsy z kurczaka', 'Chicken nuggets'), prompts: ['chicken nuggets'], group: 'main', portion: p(160, PIECES(10)), adjust: { fat: FAT_FRIED } },
  { id: 'chickenBurger', label: say('Burger z kurczakiem', 'Chicken burger'), prompts: ['chicken burger', 'fried chicken sandwich'], group: 'sandwich', portion: p(220, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'blt', label: say('Kanapka BLT', 'BLT sandwich'), prompts: ['blt sandwich', 'bacon lettuce and tomato sandwich'], group: 'sandwich', portion: p(150, SANDWICH), adjust: { fat: FAT_COOKED } },
  { id: 'phillyCheesesteak', label: say('Philly cheesesteak', 'Philly cheesesteak'), prompts: ['philly cheesesteak', 'sub roll with sliced steak and melted cheese'], group: 'sandwich', portion: p(280, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'meatloaf', label: say('Pieczeń rzymska', 'Meatloaf'), prompts: ['meatloaf', 'slice of meatloaf'], group: 'main', portion: p(200, say('2 plastry', '2 slices')), adjust: { fat: FAT_RICH } },
  { id: 'cornDog', label: say('Corn dog', 'Corn dog'), prompts: ['corn dog', 'sausage in fried cornmeal batter on a stick'], group: 'snack', portion: p(110, PIECE), adjust: { fat: FAT_FRIED } },
  { id: 'coleslaw', label: say('Coleslaw', 'Coleslaw'), prompts: ['coleslaw', 'creamy cabbage salad'], group: 'salad', portion: p(120, SERVING), adjust: { sauce: sauce('mayo', 4) } },
  { id: 'potatoSalad', label: say('Sałatka ziemniaczana', 'Potato salad'), prompts: ['potato salad', 'potato salad with mayonnaise and egg'], group: 'salad', portion: p(200, SERVING), adjust: { sauce: sauce('mayo', 5) } },
  { id: 'bakedBeans', label: say('Fasolka w sosie pomidorowym', 'Baked beans'), prompts: ['baked beans', 'beans in tomato sauce'], group: 'side', portion: p(200, SERVING), adjust: {} },
  { id: 'cinnamonRoll', label: say('Cynamonka', 'Cinnamon roll'), prompts: ['cinnamon roll', 'cinnamon bun with icing'], group: 'dessert', portion: p(100, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(6) } },
  { id: 'brownie', label: say('Brownie', 'Brownie'), prompts: ['brownie', 'chocolate brownie square'], group: 'dessert', portion: p(60, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(8) } },
  { id: 'cookie', label: say('Ciastko z kawałkami czekolady', 'Chocolate chip cookie'), prompts: ['chocolate chip cookie', 'cookies'], group: 'dessert', portion: p(50, say('1 duże ciastko', '1 large cookie')), adjust: {} },
  { id: 'muffin', label: say('Muffinka', 'Muffin'), prompts: ['muffin', 'chocolate chip muffin'], group: 'dessert', portion: p(110, PIECE), adjust: {} },
  { id: 'bagelCreamCheese', label: say('Bajgiel z serkiem', 'Bagel with cream cheese'), prompts: ['bagel with cream cheese'], group: 'breakfast', portion: p(135, PIECE), adjust: { fat: FAT_RICH } },

  // --- British ---
  { id: 'fullEnglish', label: say('Śniadanie angielskie', 'Full English breakfast'), prompts: ['full english breakfast', 'fry up with eggs, bacon, sausages and beans'], group: 'breakfast', portion: p(465, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'shepherdsPie', label: say('Zapiekanka pasterska', "Shepherd's pie"), prompts: ["shepherd's pie", 'minced meat baked under mashed potato'], group: 'main', portion: p(350, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'beansOnToast', label: say('Fasolka na tostach', 'Beans on toast'), prompts: ['beans on toast'], group: 'breakfast', portion: p(265, SERVING), adjust: { fat: FAT_LIGHT } },
  { id: 'sconeJamCream', label: say('Scone z dżemem i śmietanką', 'Scone with jam and cream'), prompts: ['scones with jam and clotted cream', 'cream tea'], group: 'dessert', portion: p(110, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(4) } },
  { id: 'bangersAndMash', label: say('Kiełbaski z puree', 'Bangers and mash'), prompts: ['bangers and mash', 'sausages with mashed potatoes and onion gravy'], group: 'main', portion: p(400, PLATE), adjust: { fat: FAT_RICH, sauce: sauce('gravy', 10) } },
  { id: 'chickenPotPie', label: say('Zapiekanka z kurczakiem w cieście (pot pie)', 'Chicken pot pie'), prompts: ['chicken pot pie', 'savoury pie with chicken in creamy sauce'], group: 'main', portion: p(250, SERVING), adjust: { fat: FAT_RICH } },

  // --- Everyday plates ---
  { id: 'owsianka', label: say('Owsianka', 'Porridge'), prompts: ['oatmeal porridge', 'bowl of porridge with milk'], group: 'breakfast', portion: p(300, BOWL), adjust: { fat: FAT_LIGHT, sweet: sweet(1.3) } },
  { id: 'owsiankaZOwocami', label: say('Owsianka z owocami', 'Porridge with fruit'), prompts: ['oatmeal with banana and blueberries', 'porridge bowl with fresh fruit'], group: 'breakfast', portion: p(400, BOWL), adjust: { fat: FAT_LIGHT, sweet: sweet(1) } },
  { id: 'jajecznica', label: say('Jajecznica', 'Scrambled eggs'), prompts: ['scrambled eggs', 'scrambled eggs on a plate'], group: 'breakfast', portion: p(165, say('z 3 jajek', 'of 3 eggs')), adjust: { fat: FAT_RICH } },
  { id: 'jajecznicaNaBoczku', label: say('Jajecznica na boczku', 'Scrambled eggs with bacon'), prompts: ['scrambled eggs with bacon'], group: 'breakfast', portion: p(185, say('z 3 jajek', 'of 3 eggs')), adjust: { fat: FAT_RICH } },
  { id: 'jajkoSadzone', label: say('Jajka sadzone', 'Fried eggs'), prompts: ['fried eggs', 'sunny side up eggs'], group: 'breakfast', portion: p(110, say('2 jajka', '2 eggs')), adjust: { fat: FAT_RICH } },
  { id: 'jajkaNaTwardo', label: say('Jajka na twardo', 'Hard-boiled eggs'), prompts: ['hard boiled eggs', 'boiled eggs cut in half'], group: 'breakfast', portion: p(100, say('2 jajka', '2 eggs')), adjust: {} },
  { id: 'jogurtZOwocami', label: say('Jogurt z owocami', 'Yoghurt with fruit'), prompts: ['yogurt with fruit', 'bowl of natural yoghurt with strawberries and banana'], group: 'breakfast', portion: p(270, BOWL), adjust: { fat: FAT_LIGHT, sweet: sweet(2, 'none') } },
  { id: 'jogurtZGranola', label: say('Jogurt z granolą', 'Yoghurt with granola'), prompts: ['yogurt with granola', 'granola bowl'], group: 'breakfast', portion: p(200, BOWL), adjust: { fat: FAT_LIGHT, sweet: sweet(2) } },
  { id: 'skyrBowl', label: say('Jogurt grecki z borówkami i orzechami', 'Greek yoghurt with blueberries and walnuts'), prompts: ['greek yogurt with blueberries and nuts'], group: 'breakfast', portion: p(230, BOWL), adjust: { fat: FAT_COOKED, sweet: sweet(2, 'none') } },
  { id: 'platkiZMlekiem', label: say('Płatki kukurydziane z mlekiem', 'Corn flakes with milk'), prompts: ['cereal with milk', 'corn flakes in a bowl of milk'], group: 'breakfast', portion: p(240, BOWL), adjust: { fat: FAT_LIGHT, sweet: sweet(2, 'none') } },
  { id: 'tostZAwokado', label: say('Tost z awokado i jajkiem', 'Avocado toast with egg'), prompts: ['avocado toast', 'toast with smashed avocado and a poached egg'], group: 'breakfast', portion: p(180, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'bagel', label: say('Bajgiel', 'Bagel'), prompts: ['bagel', 'plain bagel'], group: 'breakfast', portion: p(105, PIECE), adjust: {} },
  { id: 'kurczakZRyzem', label: say('Kurczak z ryżem i brokułami', 'Chicken with rice and broccoli'), prompts: ['chicken breast with rice and broccoli', 'meal prep box with chicken and rice'], group: 'main', portion: p(415, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'piersZKurczaka', label: say('Pierś z kurczaka pieczona', 'Roast chicken breast'), prompts: ['grilled chicken breast', 'roasted chicken breast fillet'], group: 'main', portion: p(150, say('1 filet', '1 fillet')), adjust: { fat: FAT_COOKED } },
  { id: 'udkoZKurczaka', label: say('Udko z kurczaka pieczone', 'Roast chicken leg'), prompts: ['roast chicken leg', 'baked chicken thigh and drumstick with skin'], group: 'main', portion: p(180, say('1 udko bez kości', '1 leg off the bone')), adjust: { fat: FAT_RICH } },
  { id: 'makaronZSosemPomidorowym', label: say('Makaron z sosem pomidorowym', 'Pasta with tomato sauce'), prompts: ['pasta with tomato sauce', 'spaghetti with marinara'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_LIGHT, sauce: sauce('tomato', 20) } },
  { id: 'rybaZZiemniakami', label: say('Ryba z ziemniakami i brokułami', 'Fish with potatoes and broccoli'), prompts: ['baked salmon with potatoes and broccoli', 'fish fillet with boiled potatoes'], group: 'main', portion: p(455, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'ryzZWarzywami', label: say('Ryż z warzywami', 'Rice with vegetables'), prompts: ['rice with vegetables', 'vegetable rice'], group: 'rice', portion: p(300, PLATE), adjust: { fat: FAT_LIGHT } },
  { id: 'stirFry', label: say('Kurczak z warzywami z woka', 'Chicken stir-fry'), prompts: ['chicken stir fry with vegetables', 'wok chicken with broccoli and peppers'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'wrapZKurczakiem', label: say('Wrap z kurczakiem', 'Chicken wrap'), prompts: ['chicken wrap', 'tortilla wrap with grilled chicken'], group: 'sandwich', portion: p(250, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'salatkaZKurczakiem', label: say('Sałatka z kurczakiem', 'Chicken salad'), prompts: ['chicken salad', 'green salad with grilled chicken'], group: 'salad', portion: p(275, SERVING), adjust: { sauce: sauce('vinaigrette', 4) } },
  { id: 'salatkaZielona', label: say('Sałatka zielona', 'Green salad'), prompts: ['green salad', 'mixed leaf salad with tomato and cucumber'], group: 'salad', portion: p(165, SERVING), adjust: { sauce: sauce('vinaigrette', 4) } },
  { id: 'salatkaZTunczykiem', label: say('Sałatka z tuńczykiem', 'Tuna salad'), prompts: ['tuna salad', 'salad with tuna and egg'], group: 'salad', portion: p(275, SERVING), adjust: { sauce: sauce('vinaigrette', 3) } },
  { id: 'warzywaGotowane', label: say('Warzywa gotowane', 'Boiled vegetables'), prompts: ['steamed mixed vegetables', 'boiled carrots, peas and green beans'], group: 'side', portion: p(150, SERVING), adjust: {} },
  { id: 'warzywaGrillowane', label: say('Warzywa grillowane', 'Grilled vegetables'), prompts: ['grilled vegetables', 'roasted courgette, pepper and aubergine'], group: 'side', portion: p(260, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'ryz', label: say('Ryż biały', 'White rice'), prompts: ['white rice', 'bowl of steamed rice'], group: 'side', portion: p(180, SERVING), adjust: {} },
  { id: 'makaron', label: say('Makaron bez sosu', 'Plain pasta'), prompts: ['plain cooked pasta', 'boiled spaghetti'], group: 'side', portion: p(200, SERVING), adjust: {} },
  { id: 'chleb', label: say('Chleb żytni', 'Rye bread'), prompts: ['slices of rye bread', 'bread'], group: 'side', portion: p(70, say('2 kromki', '2 slices')), adjust: {} },
  { id: 'frytkiZBatatow', label: say('Frytki z batatów', 'Sweet potato fries'), prompts: ['sweet potato fries'], group: 'side', portion: p(150, SERVING), adjust: { fat: FAT_FRIED } },
  { id: 'zupaKremZWarzyw', label: say('Zupa krem z warzyw', 'Cream of vegetable soup'), prompts: ['cream of vegetable soup', 'blended vegetable soup'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'zupaDyniowa', label: say('Zupa krem z dyni', 'Pumpkin soup'), prompts: ['pumpkin soup', 'orange cream soup'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'zupaPieczarkowa', label: say('Zupa krem z pieczarek', 'Cream of mushroom soup'), prompts: ['cream of mushroom soup'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'zupaZSoczewicy', label: say('Zupa z soczewicy', 'Lentil soup'), prompts: ['lentil soup'], group: 'soup', portion: p(350, SOUP), adjust: {} },
  { id: 'quinoa', label: say('Komosa ryżowa', 'Quinoa'), prompts: ['quinoa', 'cooked quinoa'], group: 'side', portion: p(150, SERVING), adjust: {} },
  { id: 'kuskus', label: say('Kuskus', 'Couscous'), prompts: ['couscous'], group: 'side', portion: p(150, SERVING), adjust: {} },

  // --- Desserts and sweets ---
  { id: 'ciasto', label: say('Ciasto', 'Cake'), prompts: ['slice of cake', 'layer cake'], group: 'dessert', portion: p(110, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(8) } },
  { id: 'budyn', label: say('Budyń', 'Pudding'), prompts: ['vanilla pudding', 'custard pudding in a bowl'], group: 'dessert', portion: p(200, SMALL_BOWL), adjust: { fat: FAT_LIGHT, sweet: sweet(4) } },
  { id: 'gofrZBitaSmietana', label: say('Gofr z bitą śmietaną i owocami', 'Waffle with whipped cream and fruit'), prompts: ['waffle with whipped cream and strawberries'], group: 'dessert', portion: p(180, PIECE), adjust: { sweet: sweet(4, 'none'), sauce: sauce('whippedCream', 8) } },
  { id: 'czekolada', label: say('Czekolada', 'Chocolate'), prompts: ['chocolate bar', 'pieces of milk chocolate'], group: 'snack', portion: p(50, say('½ tabliczki', '½ bar')), adjust: {} },
  { id: 'batonProteinowy', label: say('Baton proteinowy', 'Protein bar'), prompts: ['protein bar'], group: 'snack', portion: p(50, PIECE), adjust: {} },
  { id: 'sernikNaZimno', label: say('Sernik na zimno', 'No-bake cheesecake'), prompts: ['no bake cheesecake with jelly and strawberries'], group: 'dessert', portion: p(130, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(5) } },
  { id: 'lodyWloskie', label: say('Lody włoskie', 'Soft serve ice cream'), prompts: ['soft serve ice cream cone'], group: 'dessert', portion: p(150, say('1 rożek', '1 cone')), adjust: { sweet: sweet(5) } },
  { id: 'owoceZBitaSmietana', label: say('Truskawki z bitą śmietaną', 'Strawberries with whipped cream'), prompts: ['strawberries with whipped cream'], group: 'dessert', portion: p(230, BOWL), adjust: { sauce: sauce('whippedCream', 6) } },

  // --- Snacks ---
  { id: 'chipsy', label: say('Chipsy', 'Potato chips'), prompts: ['potato chips', 'crisps in a bowl'], group: 'snack', portion: p(50, SMALL_BOWL), adjust: {} },
  { id: 'orzechy', label: say('Orzechy (mieszanka)', 'Mixed nuts'), prompts: ['mixed nuts', 'handful of nuts'], group: 'snack', portion: p(30, say('1 garść', '1 handful')), adjust: {} },
  // Air-popped corn has 4 g of fat per 100 g, popped in oil or buttered 30-60 g.
  { id: 'popcorn', label: say('Popcorn', 'Popcorn'), prompts: ['popcorn'], group: 'snack', portion: p(40, BOWL), adjust: { fat: { step: 5 } } },
  { id: 'krakersy', label: say('Krakersy', 'Crackers'), prompts: ['crackers'], group: 'snack', portion: p(30, SERVING), adjust: {} },
  { id: 'hummusZWarzywami', label: say('Hummus z warzywami', 'Hummus with vegetable sticks'), prompts: ['hummus with carrot and cucumber sticks'], group: 'snack', portion: p(240, SERVING), adjust: {} },

  // --- Fruit ---
  { id: 'jablko', label: say('Jabłko', 'Apple'), prompts: ['apple', 'red apple'], group: 'fruit', portion: p(180, PIECE), adjust: {} },
  { id: 'banan', label: say('Banan', 'Banana'), prompts: ['banana'], group: 'fruit', portion: p(120, say('1 sztuka bez skórki', '1 peeled')), adjust: {} },
  { id: 'pomarancza', label: say('Pomarańcza', 'Orange'), prompts: ['orange fruit', 'peeled orange segments'], group: 'fruit', portion: p(150, say('1 sztuka bez skórki', '1 peeled')), adjust: {} },
  { id: 'mandarynki', label: say('Mandarynki', 'Mandarins'), prompts: ['mandarins', 'tangerines'], group: 'fruit', portion: p(150, PIECES_FEW(2)), adjust: {} },
  { id: 'truskawki', label: say('Truskawki', 'Strawberries'), prompts: ['strawberries'], group: 'fruit', portion: p(150, SMALL_BOWL), adjust: {} },
  { id: 'winogrona', label: say('Winogrona', 'Grapes'), prompts: ['grapes', 'bunch of grapes'], group: 'fruit', portion: p(150, say('1 kiść', '1 bunch')), adjust: {} },
  { id: 'arbuz', label: say('Arbuz', 'Watermelon'), prompts: ['watermelon slice'], group: 'fruit', portion: p(300, say('1 plaster', '1 slice')), adjust: {} },
  { id: 'gruszka', label: say('Gruszka', 'Pear'), prompts: ['pear'], group: 'fruit', portion: p(180, PIECE), adjust: {} },
  { id: 'kiwi', label: say('Kiwi', 'Kiwi'), prompts: ['kiwi fruit'], group: 'fruit', portion: p(150, PIECES_FEW(2)), adjust: {} },
  { id: 'borowki', label: say('Borówki', 'Blueberries'), prompts: ['blueberries'], group: 'fruit', portion: p(125, SMALL_BOWL), adjust: {} },
  { id: 'mango', label: say('Mango', 'Mango'), prompts: ['mango', 'sliced mango'], group: 'fruit', portion: p(200, say('½ owocu', '½ fruit')), adjust: {} },
  { id: 'sliwki', label: say('Śliwki', 'Plums'), prompts: ['plums'], group: 'fruit', portion: p(150, PIECES_FEW(3)), adjust: {} },
  { id: 'czeresnie', label: say('Czereśnie', 'Cherries'), prompts: ['sweet cherries'], group: 'fruit', portion: p(150, SMALL_BOWL), adjust: {} },
  { id: 'maliny', label: say('Maliny', 'Raspberries'), prompts: ['raspberries'], group: 'fruit', portion: p(125, SMALL_BOWL), adjust: {} },
  { id: 'salatkaOwocowa', label: say('Sałatka owocowa', 'Fruit salad'), prompts: ['fruit salad', 'bowl of mixed fresh fruit'], group: 'fruit', portion: p(200, BOWL), adjust: {} },

  // --- Drinks ---
  { id: 'kawaZMlekiem', label: say('Kawa z mlekiem (latte)', 'Latte'), prompts: ['latte', 'coffee with milk in a glass', 'caffe latte with foam'], group: 'drink', portion: ml(300, MUG), adjust: { fat: FAT_LIGHT, sweet: sweet(1.7, 'none') } },
  { id: 'cappuccino', label: say('Cappuccino', 'Cappuccino'), prompts: ['cappuccino', 'cappuccino with latte art'], group: 'drink', portion: ml(180, CUP), adjust: { fat: { step: 0.5 }, sweet: sweet(2.3, 'none') } },
  { id: 'kawaCzarna', label: say('Kawa czarna', 'Black coffee'), prompts: ['black coffee', 'cup of coffee'], group: 'drink', portion: ml(250, MUG), adjust: { sweet: sweet(1.7, 'none') } },
  { id: 'espresso', label: say('Espresso', 'Espresso'), prompts: ['espresso', 'shot of espresso'], group: 'drink', portion: ml(60, CUP), adjust: { sweet: sweet(3.5, 'none') } },
  { id: 'herbata', label: say('Herbata', 'Tea'), prompts: ['cup of tea', 'black tea'], group: 'drink', portion: ml(250, MUG), adjust: { sweet: sweet(1.7, 'none') } },
  { id: 'sokPomaranczowy', label: say('Sok pomarańczowy', 'Orange juice'), prompts: ['orange juice', 'glass of orange juice'], group: 'drink', portion: ml(250, GLASS), adjust: {} },
  { id: 'smoothie', label: say('Smoothie', 'Smoothie'), prompts: ['fruit smoothie', 'smoothie in a glass'], group: 'drink', portion: ml(330, BIG_GLASS), adjust: { sweet: sweet(2, 'none') } },
  { id: 'koktajlProteinowy', label: say('Koktajl proteinowy', 'Protein shake'), prompts: ['protein shake', 'protein smoothie in a shaker'], group: 'drink', portion: ml(430, say('1 shaker', '1 shaker')), adjust: { fat: FAT_LIGHT } },
  { id: 'mleko', label: say('Mleko', 'Milk'), prompts: ['glass of milk'], group: 'drink', portion: ml(250, GLASS), adjust: { fat: FAT_LIGHT } },
  { id: 'kefir', label: say('Kefir', 'Kefir'), prompts: ['kefir', 'glass of kefir'], group: 'drink', portion: ml(250, GLASS), adjust: {} },
  { id: 'kakao', label: say('Kakao', 'Hot chocolate'), prompts: ['hot chocolate', 'cocoa with milk'], group: 'drink', portion: ml(250, MUG), adjust: { fat: FAT_LIGHT, sweet: sweet(5) } },
  { id: 'piwo', label: say('Piwo', 'Beer'), prompts: ['beer', 'glass of lager beer'], group: 'drink', portion: ml(500, say('1 kufel', '1 pint')), adjust: {} },
  { id: 'winoCzerwone', label: say('Wino czerwone', 'Red wine'), prompts: ['glass of red wine'], group: 'drink', portion: ml(150, WINE_GLASS), adjust: {} },
  { id: 'winoBiale', label: say('Wino białe', 'White wine'), prompts: ['glass of white wine'], group: 'drink', portion: ml(150, WINE_GLASS), adjust: {} },
  { id: 'cola', label: say('Cola', 'Cola'), prompts: ['cola', 'glass of cola with ice'], group: 'drink', portion: ml(330, CAN), adjust: {} },
  { id: 'lemoniada', label: say('Lemoniada', 'Lemonade'), prompts: ['lemonade', 'glass of lemonade with mint'], group: 'drink', portion: ml(400, BIG_GLASS), adjust: { sweet: sweet(5) } },
  { id: 'milkshake', label: say('Shake mleczny', 'Milkshake'), prompts: ['milkshake', 'chocolate milkshake with a straw'], group: 'drink', portion: ml(400, MUG), adjust: { fat: FAT_COOKED, sweet: sweet(4) } },
  { id: 'bubbleTea', label: say('Bubble tea', 'Bubble tea'), prompts: ['bubble tea', 'milk tea with tapioca pearls'], group: 'drink', portion: ml(500, MUG), adjust: { sweet: sweet(1.5) } },
  { id: 'energetyk', label: say('Napój energetyczny', 'Energy drink'), prompts: ['energy drink can'], group: 'drink', portion: ml(500, CAN), adjust: {} },
];

export const DISHES: readonly Dish[] = ENTRIES.map((e) => {
  const row = DISH_ROWS[e.id];
  if (!row) throw new Error(`no data for dish ${e.id} - run scripts/food/fetch-dishes.ts`);
  return { ...e, per100: row.per100, source: row.source };
});

const BY_ID = new Map(DISHES.map((d) => [d.id, d]));
const BY_FOOD101 = new Map(DISHES.filter((d) => d.food101).map((d) => [d.food101!, d]));

export const dishById = (id: string): Dish | undefined => BY_ID.get(id);
/** The dish for a Food-101 label ("apple_pie"), as a model trained on it reports it. */
export const dishByFood101 = (label: string): Dish | undefined => BY_FOOD101.get(label);

// --- Estimate ---

export interface Choices {
  fat?: FatLevel;
  sweet?: SweetLevel;
  sauce?: SauceLevel;
}

/** Per 100 g, or for the portion in `estimate`. */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
}

export interface Estimate extends Macros {
  /** kcal; the honest range around `kcal`. */
  low: number;
  high: number;
}

/** Portions set by eye miss by about this much either way. */
export const PORTION_UNCERTAINTY = 0.15;

const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'sugars'] as const;
const zero = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, sugars: 0 });

/** The dish without its usual sauce, per 100 g: what a gram of extra sauce displaces. */
function rest(dish: Dish, s: SauceScale): Macros {
  const share = SAUCE_ORDER.indexOf(s.base ?? 'usual') * s.step;
  const sauce100 = SAUCES[s.kind].per100;
  const out = zero();
  for (const k of MACROS) out[k] = (dish.per100[k] * 100 - share * sauce100[k]) / (100 - share);
  return out;
}

/** What one step of each scale changes per 100 g of the dish. */
function oneStep(dish: Dish): { fat?: Macros; sweet?: Macros; sauce?: Macros } {
  const { fat, sweet: s, sauce: c } = dish.adjust;
  const out: { fat?: Macros; sweet?: Macros; sauce?: Macros } = {};
  if (fat) out.fat = { ...zero(), fat: fat.step, kcal: 9 * fat.step };
  if (s) out.sweet = { ...zero(), sugars: s.step, carbs: s.step, kcal: 4 * s.step };
  if (c) {
    const r = rest(dish, c);
    const sauce100 = SAUCES[c.kind].per100;
    const d = zero();
    for (const k of MACROS) d[k] = (c.step * (sauce100[k] - r[k])) / 100;
    out.sauce = d;
  }
  return out;
}

/** Steps between the catalog value and the chosen level; 0 when not answered. */
function stepsOf(dish: Dish, choices: Choices): { fat: number; sweet: number; sauce: number } {
  const { fat, sweet: s, sauce: c } = dish.adjust;
  return {
    fat: fat && choices.fat ? FAT_ORDER.indexOf(choices.fat) - FAT_ORDER.indexOf('usual') : 0,
    sweet: s && choices.sweet ? SWEET_ORDER.indexOf(choices.sweet) - SWEET_ORDER.indexOf(s.base ?? 'usual') : 0,
    sauce: c && choices.sauce ? SAUCE_ORDER.indexOf(choices.sauce) - SAUCE_ORDER.indexOf(c.base ?? 'usual') : 0,
  };
}

/** Per 100 g of the dish as the person described it. Nothing goes below 0. */
export function adjustedPer100(dish: Dish, choices: Choices = {}): Macros {
  const step = oneStep(dish);
  const steps = stepsOf(dish, choices);
  const out = zero();
  for (const k of MACROS) {
    let v = dish.per100[k];
    if (step.fat) v += steps.fat * step.fat[k];
    if (step.sweet) v += steps.sweet * step.sweet[k];
    if (step.sauce) v += steps.sauce * step.sauce[k];
    out[k] = Math.max(0, v);
  }
  return out;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Energy and macros of `grams` of the dish, with the range a photo estimate honestly has:
 * ±15 % for the portion, plus for each scale that applies half a step's energy when it was
 * answered (the truth lies between the chosen level and its neighbours) or a whole step when it
 * was not (it could be a level either way). The range is symmetric around `kcal`; `low` stops at 0.
 */
export function estimate(dish: Dish, grams: number, choices: Choices = {}): Estimate {
  const per100 = adjustedPer100(dish, choices);
  const f = Math.max(0, grams) / 100;
  const step = oneStep(dish);
  let spread = PORTION_UNCERTAINTY * per100.kcal;
  for (const scale of ['fat', 'sweet', 'sauce'] as const) {
    const s = step[scale];
    if (s) spread += Math.abs(s.kcal) * (choices[scale] ? 0.5 : 1);
  }
  const kcal = per100.kcal * f;
  const half = spread * f;
  return {
    kcal: Math.round(kcal),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
    sugars: round1(per100.sugars * f),
    low: Math.max(0, Math.round(kcal - half)),
    high: Math.round(kcal + half),
  };
}
