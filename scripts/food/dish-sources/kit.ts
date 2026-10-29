// The building blocks of the photo catalog's USDA sources (`fetch-dishes.ts`): how a dish names its
// USDA food or composes a recipe from them, and the shared ingredients, as served. The dishes
// themselves are in `fetch-dishes.ts` (the first 351) and in one file per region here.

export type Db = 'fndds' | 'sr';
/** A USDA food: FNDDS food code or SR FDC id, and the start of its description. */
export interface Ref {
  db: Db;
  id: number;
  piece: string;
}
/** Grams as served of a USDA food, of a part below (by id) or of a sauce (`sauce:<id>`). */
export type Line = readonly [Ref | string, number];
export type Source =
  | { kind: 'food'; ref: Ref; note?: string }
  | { kind: 'recipe'; note: string; lines: Line[]; yield?: number; compare?: Ref };

export const F = (id: number, piece: string): Ref => ({ db: 'fndds', id, piece });
export const S = (id: number, piece: string): Ref => ({ db: 'sr', id, piece });
export const food = (ref: Ref, note?: string): Source => ({ kind: 'food', ref, ...(note ? { note } : {}) });
/** `compare`: an FNDDS food the run prints next to the result, as a sanity check. */
export const recipe = (note: string, lines: Line[], extra: { yield?: number; compare?: Ref } = {}): Source => ({ kind: 'recipe', note, lines, ...extra });

/** Ingredients, as served (cooked where they are eaten cooked). */
export const I = {
  // Starches
  potato: S(170440, 'Potatoes, boiled, cooked without skin, flesh, without salt'),
  rice: F(56205001, 'Rice, white, cooked, NS as to fat'),
  coconutRice: F(58161200, 'Rice, cooked with coconut milk'),
  pasta: F(56130000, 'Pasta, cooked'),
  // US "noodles" are egg noodles: the same flour-egg-water dough as pierogi and uszka.
  noodles: F(56112000, 'Noodles, cooked'),
  buckwheat: S(170686, 'Buckwheat groats, roasted, cooked'),
  gritsCheese: F(56201092, 'Grits, with cheese, fat added'),
  flour: S(169761, 'Wheat flour, white, all-purpose, unenriched'),
  ryeFlour: S(168886, 'Rye flour, medium'),
  // SR has no potato starch (mąka ziemniaczana); potato flour is the nearest, a little more protein.
  potatoStarch: S(168446, 'Potato flour'),
  oats: S(173904, 'Cereals, oats, regular and quick, not fortified, dry'),
  granola: S(171646, 'Cereals ready-to-eat, granola, homemade'),
  cornFlakes: F(57134000, 'Cereal, corn flakes, plain'),
  breadcrumbs: S(174928, 'Bread, crumbs, dry, grated, plain'),
  // Bread
  bread: F(51101000, 'Bread, white'),
  toast: F(51101010, 'Bread, white, toasted'),
  ryeBread: S(172684, 'Bread, rye'),
  roll: F(51153000, 'Roll, white, hard'),
  softRoll: F(51150000, 'Roll, white, soft'),
  hotDogBun: F(51154010, 'Roll, white, hot dog bun'),
  baguette: F(51107010, 'Bread, French or Vienna'),
  pita: F(51109100, 'Bread, pita'),
  tortilla: F(52215200, 'Tortilla, flour'),
  bagel: F(51180010, 'Bagel'),
  sweetRoll: F(51160000, 'Roll, sweet, no frosting'),
  crackers: F(54001000, 'Crackers, NFS'),
  wontonCrisps: F(54336100, 'Crackers, wonton'),
  crepe: F(55401000, 'Crepe, plain'),
  waffle: F(55200010, 'Waffle, NFS'),
  scone: F(52105100, 'Scone'),
  pierogi: F(58121610, 'Pierogi'),
  // Eggs and dairy
  egg: F(31101010, 'Egg, whole, raw'),
  boiledEgg: F(31103010, 'Egg, whole, boiled or poached'),
  friedEgg: F(31105005, 'Egg, whole, fried, NS as to fat'),
  scrambled: F(32130020, 'Egg omelet or scrambled egg, made with butter'),
  yolk: S(172184, 'Egg, yolk, raw, fresh'),
  eggWhite: S(172183, 'Egg, white, raw, fresh'),
  milk: F(11112110, 'Milk, reduced fat (2%)'),
  kefir: F(11115400, 'Kefir'),
  yogurt: F(11411100, 'Yogurt, whole milk, plain'),
  greekYogurt: S(171304, 'Yogurt, Greek, plain, whole milk'),
  cream30: S(170858, 'Cream, fluid, light whipping'),
  cream36: S(170859, 'Cream, fluid, heavy whipping'),
  sourCream: S(171257, 'Cream, sour, cultured'),
  whippedCream: S(170860, 'Cream, whipped, cream topping, pressurized'),
  // Polish twaróg is pressed curd cheese; farmer's cheese is the US food closest to it (twaróg tłusty).
  twarog: F(14201200, "Cottage cheese, farmer's"),
  ricotta: S(171248, 'Cheese, ricotta, part skim milk'),
  creamCheese: F(14301010, 'Cream cheese, regular, plain'),
  mozzarella: S(170845, 'Cheese, mozzarella, whole milk'),
  parmesan: S(170848, 'Cheese, parmesan, hard'),
  feta: F(14104400, 'Cheese, Feta'),
  gouda: F(14105010, 'Cheese, Gouda or Edam'),
  brie: F(14103020, 'Cheese, Brie'),
  blueCheese: F(14101010, 'Cheese, Blue or Roquefort'),
  goatCheese: F(14104700, 'Cheese, goat'),
  whey: S(173180, 'Beverages, Protein powder whey based'),
  // Fats, sugar
  // Polish cooking oil is rapeseed oil; canola is rapeseed.
  oil: S(172336, 'Oil, canola'),
  oliveOil: F(82104000, 'Olive oil'),
  sesameOil: F(82107000, 'Sesame oil'),
  butter: S(173430, 'Butter, without salt'),
  sugar: F(91101010, 'Sugar, white, granulated or lump'),
  powderedSugar: F(91101020, "Sugar, white, confectioner's, powdered"),
  honey: S(169640, 'Honey'),
  jam: S(169641, 'Jams and preserves'),
  darkChocolate: S(170273, 'Chocolate, dark, 70-85% cacao solids'),
  gelatin: S(169599, 'Gelatins, dry powder, unsweetened'),
  // Meat and fish, cooked
  porkLoin: S(167882, 'Pork, fresh, loin, center loin (chops), bone-in, separable lean only, cooked, pan-fried'),
  porkShoulder: S(167844, 'Pork, fresh, shoulder, whole, separable lean and fat, cooked, roasted'),
  porkGround: F(22002000, 'Pork, ground'),
  beefGround: F(21500100, 'Beef, ground'),
  lambGround: F(23132000, 'Lamb, ground'),
  beefStew: F(21410000, 'Beef, stew meat'),
  rawBeefTenderloin: S(171812, 'Beef, tenderloin, steak, separable lean only, trimmed to 1/8" fat, all grades, raw'),
  chickenBreast: F(24122131, 'Chicken breast, baked, broiled, or roasted, skin not eaten, from raw'),
  chickenThigh: F(24152231, 'Chicken thigh, baked, broiled, or roasted, skin not eaten, from raw'),
  duck: F(24301010, 'Duck, roasted, skin eaten'),
  bacon: F(22600100, 'Bacon, NS as to type of meat, cooked'),
  ham: F(25230210, 'Ham, prepackaged or deli, luncheon meat'),
  kielbasa: F(25221310, 'Polish sausage'),
  // Biała kiełbasa: fresh pork sausage, boiled; bratwurst is the same kind of sausage.
  whiteSausage: S(171620, 'Bratwurst, pork, cooked'),
  porkSausage: F(25221405, 'Pork sausage'),
  bloodSausage: S(171618, 'Blood sausage'),
  liverPate: F(25112200, 'Liver, paste or pate'),
  rawTuna: F(26153100, 'Fish, tuna, raw'),
  rawSalmon: F(26137100, 'Fish, salmon, raw'),
  salmon: F(26137120, 'Fish, salmon, baked or broiled'),
  friedCod: F(26109140, 'Fish, cod, fried'),
  tinnedTuna: F(26155110, 'Fish, tuna, canned'),
  // Śledź w occie: herring cured in sweetened vinegar.
  marinatedHerring: S(175118, 'Fish, herring, Atlantic'),
  shrimp: F(26319130, 'Shrimp, steamed or boiled'),
  octopus: S(174249, 'Mollusks, octopus, common, cooked, moist heat'),
  lobsterSalad: F(27450020, 'Lobster salad'),
  // Legumes, nuts, seeds
  tofu: S(172475, 'Tofu, raw, firm, prepared with calcium sulfate'),
  chickpeas: S(173757, 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt'),
  lentils: S(172421, 'Lentils, mature seeds, cooked, boiled, without salt'),
  whiteBeans: F(41101120, 'White beans, from dried, no added fat'),
  bakedBeans: F(41201010, 'Baked beans'),
  edamame: F(41420020, 'Edamame, cooked'),
  tahini: S(168604, 'Seeds, sesame butter, tahini'),
  sesame: S(170150, 'Seeds, sesame seeds, whole, dried'),
  walnuts: S(170187, 'Nuts, walnuts, english'),
  almonds: S(170567, 'Nuts, almonds'),
  peanuts: S(173806, 'Peanuts, all types, dry-roasted, without salt'),
  poppy: S(171330, 'Spices, poppy seed'),
  prunes: F(62122100, 'Prune, dried'),
  coconutMilk: S(170173, 'Nuts, coconut milk, canned'),
  // Vegetables, fruit
  tomato: F(74101000, 'Tomatoes, raw'),
  tinnedTomatoes: S(170051, 'Tomatoes, red, ripe, canned, packed in tomato juice'),
  tomatoPaste: S(170459, 'Tomato products, canned, paste, without salt added'),
  cucumber: F(75111000, 'Cucumber, raw'),
  onion: F(75117020, 'Onions, raw'),
  scallion: F(75117010, 'Onions, green, raw'),
  garlic: F(75111500, 'Garlic, raw'),
  pepper: F(75122200, 'Peppers, sweet, red, raw'),
  lettuce: F(75113000, 'Lettuce, raw'),
  mixedSalad: F(75143000, 'Lettuce, salad with assorted vegetables including tomatoes and/or carrots, no dressing'),
  arugula: S(169387, 'Arugula, raw'),
  carrot: F(73101010, 'Carrots, raw'),
  cookedCarrot: F(73102211, 'Carrots, fresh, cooked, no added fat'),
  cabbage: F(75103000, 'Cabbage, green, raw'),
  cookedCabbage: F(75211020, 'Cabbage, green, cooked, no added fat'),
  // The SR sauerkraut: FNDDS cooks its sauerkraut with fat.
  sauerkraut: S(169279, 'Sauerkraut, canned, solids and liquids'),
  mushrooms: F(99997515, 'Mushrooms, cooked, as ingredient'),
  beets: F(75208011, 'Beets, fresh, cooked, no added fat'),
  // Ogórki kiszone are lacto-fermented, the US dill cucumbers mostly brined; the energy is the same.
  gherkins: S(168558, 'Pickles, cucumber, dill or kosher dill'),
  peas: F(75224022, 'Green peas, frozen, cooked, no added fat'),
  greenBeans: F(75205021, 'Green beans, fresh, cooked, no added fat'),
  broccoli: F(72201211, 'Broccoli, fresh, cooked, no added fat'),
  eggplant: F(75217010, 'Eggplant, cooked, no added fat'),
  zucchini: F(75233011, 'Summer squash, yellow or green, fresh, cooked, no added fat'),
  radish: F(75125000, 'Radish'),
  olives: F(75510020, 'Olives, black'),
  avocado: F(63105010, 'Avocado, raw'),
  nori: F(75232000, 'Seaweed, dried'),
  wakame: S(170496, 'Seaweed, wakame, raw'),
  apple: F(63101000, 'Apple, raw'),
  banana: F(63107010, 'Banana, raw'),
  strawberries: F(63223020, 'Strawberries, raw'),
  blueberries: F(63203010, 'Blueberries, raw'),
  plum: F(63143010, 'Plum, raw'),
  grapes: F(63123000, 'Grapes, raw'),
  mango: F(63129010, 'Mango, raw'),
  // Green papaya is the unripe fruit; SR has only the ripe one, a little sweeter.
  papaya: S(169926, 'Papayas, raw'),
  lime: S(168156, 'Lime juice, raw'),
  // Prepared foods used as parts
  broth: F(28340120, 'Soup, broth'),
  water: S(173647, 'Beverages, water, tap, drinking'),
  fries: F(71401031, 'Potato, french fries, restaurant'),
  potatoPancake: F(71701000, 'Potato pancake'),
  mashed: F(71501000, 'Potato, mashed, NFS'),
  roastPotatoes: F(71104060, 'Potato, roasted, from fresh, peel eaten, fat added'),
  borscht: F(75601100, 'Soup, borscht'),
  bibimbap: F(58150100, 'Bibimbap, Korean'),
  caesarSalad: F(72116150, 'Caesar salad, with romaine, no dressing'),
  chickenGardenSalad: F(27446300, 'Chicken or turkey garden salad, chicken and/or turkey, tomato and/or carrots'),
  hamCheeseSandwich: F(27520220, 'Ham sandwich on white, with cheese'),
  vegetableTempura: F(75440200, 'Vegetable tempura'),
  friedShrimp: F(26319140, 'Shrimp, fried'),
  hummus: F(41205070, 'Hummus, plain'),
  // Sauces
  soy: F(41420300, 'Soy sauce'),
  fishSauce: S(174531, 'Sauce, fish, ready-to-serve'),
  hoisin: F(41420250, 'Hoisin sauce'),
  mayo: F(83107000, 'Mayonnaise, regular'),
  ketchup: F(74401010, 'Ketchup'),
  gravy: F(28500040, 'Gravy, beef'),
  tomatoSauce: F(74404010, 'Spaghetti sauce'),
  meatSauce: F(27162040, 'Spaghetti sauce with meat'),
  whiteSauce: F(13411000, 'White sauce or gravy'),
  alfredo: F(14650160, 'Alfredo sauce'),
  pesto: F(81302070, 'Pesto sauce'),
  tartar: F(81302050, 'Tartar sauce'),
  vinaigrette: F(83106000, 'Italian dressing, made with vinegar and oil'),
  caesarDressing: F(83102000, 'Caesar dressing'),
  bbq: F(74406010, 'Barbecue sauce'),
  peanutSauce: F(42204050, 'Peanut sauce'),
  curry: F(81312100, 'Curry sauce'),
  hollandaise: F(81302010, 'Hollandaise sauce'),
  tzatziki: F(11440060, 'Tzatziki dip'),
  cheeseSauce: F(14650100, 'Cheese sauce'),
  steakSauce: F(74406100, 'Steak sauce'),
  salsa: F(74402100, 'Salsa, NFS'),
  sweetSour: F(91361010, 'Sweet and sour sauce'),
  teriyaki: F(41420400, 'Teriyaki sauce'),
  ranch: F(83113500, 'Ranch dressing'),
  hotSauce: F(74403000, 'Hot Thai sauce'),
} as const;

