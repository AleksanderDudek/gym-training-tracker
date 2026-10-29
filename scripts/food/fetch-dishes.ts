// Builds src/food/photo/data/dishes.json: per 100 g as served, the energy and macros of each dish in
// the photo catalog (src/food/photo/dishes.ts) and of each sauce its "Ile sosu?" scale moves.
//
// Sources, both USDA and public domain:
// - FNDDS 2021-2023 (Food and Nutrient Database for Dietary Studies, the survey foods of FoodData
//   Central, release 2024-10-31): mixed dishes as eaten in the US, with standard portions.
// - SR Legacy (April 2018): single foods, for ingredients FNDDS lacks.
// A dish is one FNDDS food when FNDDS has a fair match; otherwise it is composed here from FNDDS / SR
// ingredients by a short recipe in grams as served (cooked meat, boiled potatoes, the fat that stays
// in the dish), so no cooking yield is needed - except doughs and batters that lose water in the
// oven or the pan, which carry a `yield` (cooked weight / raw weight). Every reference names the
// start of its USDA description, so a renumbered release stops the run instead of borrowing the
// wrong food.
//
// Downloads are kept in ~/.cache/gym-tracker/fndds/ (FNDDS) and ~/.cache/gym-tracker/fdc/ (SR, shared
// with fetch-nutrients.ts) and reused; delete a file there to fetch it again. Output is sorted by
// id, so a re-run with the same downloads writes the same bytes.
// Usage: npx tsx scripts/food/fetch-dishes.ts
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { fetchWithRetry } from './http';

const OUT = 'src/food/photo/data/dishes.json';
// Where each value comes from, for the tests and for anyone checking a number; the app does not load it.
const SOURCES_OUT = 'src/food/photo/data/dish-sources.json';

const FNDDS = {
  name: 'USDA FNDDS 2021-2023 (FoodData Central survey foods, release 2024-10-31)',
  db: 'FNDDS 2021-2023',
  url: 'https://fdc.nal.usda.gov/download-datasets',
  zip: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip',
  file: 'FoodData_Central_survey_food_csv_2024-10-31.zip',
  cache: join(homedir(), '.cache/gym-tracker/fndds'),
};
const SR = {
  name: 'USDA FoodData Central, SR Legacy (April 2018)',
  db: 'SR Legacy',
  url: 'https://fdc.nal.usda.gov/download-datasets',
  zip: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  file: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  cache: join(homedir(), '.cache/gym-tracker/fdc'),
};

// --- Sources ---

import { F, I, S, food, recipe, type Db, type Ref, type Source } from './dish-sources/kit';
import { REGION_DISHES, REGION_PARTS } from './dish-sources';

/**
 * The sauces the "Ile sosu?" scale adds or takes away, per 100 g. Kebab garlic sauce is the Polish
 * yoghurt-mayonnaise one, not FNDDS's oil-based "Garlic sauce" (683 kcal).
 */
const SAUCES: Record<string, Source> = {
  tomato: food(I.tomatoSauce),
  bolognese: food(I.meatSauce),
  cream: food(I.alfredo),
  cheese: food(I.cheeseSauce),
  gravy: food(I.gravy),
  garlic: recipe('Polish kebab garlic sauce: yoghurt and mayonnaise', [[I.yogurt, 60], [I.mayo, 35], [I.garlic, 5]]),
  mayo: food(I.mayo),
  ketchup: food(I.ketchup),
  bbq: food(I.bbq),
  sweetSour: food(I.sweetSour),
  teriyaki: food(I.teriyaki),
  soy: food(I.soy),
  peanut: food(I.peanutSauce),
  curry: food(I.curry),
  vinaigrette: food(I.vinaigrette),
  oliveOil: food(I.oliveOil),
  caesar: food(I.caesarDressing),
  ranch: food(I.ranch),
  tzatziki: food(I.tzatziki),
  hollandaise: food(I.hollandaise),
  sourCream: food(I.sourCream),
  whippedCream: food(I.whippedCream),
  salsa: food(I.salsa),
  hoisin: food(I.hoisin),
  tartar: food(I.tartar),
  whiteSauce: food(I.whiteSauce),
  pesto: food(I.pesto),
};

/** Shared sub-recipes, used by id in the dishes below; not dishes themselves. */
const PARTS: Record<string, Source> = {
  // Döner meat in Poland is veal/beef or chicken; FNDDS's gyro sandwich uses lamb and beef.
  kebabMeat: recipe('kebab meat: half chicken thigh, half beef and lamb', [[I.chickenThigh, 50], [I.beefGround, 25], [I.lambGround, 25]]),
  // Surówka z białej kapusty: cabbage, carrot, oil and a pinch of sugar, no mayonnaise.
  cabbageSlaw: recipe('cabbage slaw with oil', [[I.cabbage, 100], [I.carrot, 15], [I.oil, 5], [I.sugar, 2]]),
  // Polish kaszanka is about half groats; the US blood sausage is all meat and fat.
  kaszankaSausage: recipe('kaszanka: blood sausage with buckwheat groats', [[I.bloodSausage, 50], [I.buckwheat, 50]]),
};

const DISHES: Record<string, Source> = {
  // --- Food-101 ---
  applePie: food(F(53301000, 'Pie, apple')),
  babyBackRibs: food(F(22701000, 'Pork, ribs'), 'FNDDS: roasted back ribs with 30 % barbecue sauce'),
  baklava: food(F(53441110, 'Baklava')),
  beefCarpaccio: recipe('raw tenderloin, olive oil, parmesan, rocket, lemon', [[I.rawBeefTenderloin, 80], [I.oliveOil, 10], [I.parmesan, 12], [I.arugula, 20], [I.lime, 5]]),
  beefTartare: food(F(27116400, 'Steak tartare')),
  beetSalad: recipe('beets, goat cheese, walnuts, leaves, vinaigrette', [[I.beets, 150], [I.goatCheese, 30], [I.walnuts, 10], [I.lettuce, 20], [I.vinaigrette, 20]]),
  beignets: food(F(53520510, 'Beignet')),
  // FNDDS bibimbap is mostly vegetables (76 kcal); a restaurant bowl has more rice and a fried egg.
  bibimbap: recipe('FNDDS bibimbap with more rice and a fried egg', [[I.bibimbap, 300], [I.rice, 100], [I.friedEgg, 50]]),
  breadPudding: food(F(13210110, 'Pudding, bread')),
  breakfastBurrito: food(F(34003120, 'Egg burrito, with sausage')),
  bruschetta: food(F(51136000, 'Bruschetta')),
  caesarSalad: recipe('romaine, croutons, parmesan, Caesar dressing', [[I.caesarSalad, 200], [I.caesarDressing, 30]]),
  cannoli: recipe('fried shell (fried wonton crisps stand in) with sweetened ricotta and chocolate', [[I.wontonCrisps, 30], [I.ricotta, 52], [I.powderedSugar, 13], [I.darkChocolate, 5]]),
  capreseSalad: recipe('mozzarella, tomato, olive oil', [[I.mozzarella, 100], [I.tomato, 150], [I.oliveOil, 10]]),
  carrotCake: food(F(53104260, 'Cake or cupcake, carrot')),
  ceviche: food(F(27151030, 'Ceviche')),
  cheesecake: food(F(53104500, 'Cheesecake, plain'), 'US cream-cheese cheesecake; the Polish sernik is its own entry'),
  cheesePlate: recipe('brie, gouda, blue cheese, grapes, crackers, walnuts', [[I.brie, 30], [I.gouda, 30], [I.blueCheese, 20], [I.grapes, 50], [I.crackers, 20], [I.walnuts, 10]]),
  chickenCurry: food(F(27146150, 'Chicken curry')),
  chickenQuesadilla: food(F(58104740, 'Quesadilla, chicken')),
  chickenWings: food(F(24168000, 'Chicken "wings" with hot sauce, from fast food / restaurant')),
  chocolateCake: food(F(53105270, 'Cake or cupcake, chocolate with chocolate icing, bakery')),
  chocolateMousse: food(F(13250000, 'Mousse')),
  churros: food(F(53520200, 'Churros')),
  clamChowder: food(F(28355110, 'Soup, New England clam chowder')),
  clubSandwich: food(F(27540127, 'Club sandwich or sub, restaurant')),
  crabCakes: food(F(27250040, 'Crab, cake')),
  // FNDDS "Creme brulee" is a milk custard (113 kcal); the French one is made with cream.
  cremeBrulee: recipe('cream, yolks, sugar, caramel top; baked', [[I.cream36, 250], [I.yolk, 60], [I.sugar, 60]], { yield: 0.92, compare: F(13210370, 'Creme brulee') }),
  croqueMadame: recipe('ham and cheese sandwich, fried egg, béchamel', [[I.hamCheeseSandwich, 150], [I.friedEgg, 50], [I.whiteSauce, 40]]),
  cupCakes: food(F(53100100, 'Cake or cupcake, NFS')),
  deviledEggs: food(F(32102000, 'Egg, deviled')),
  donuts: food(F(53520000, 'Doughnut, NFS')),
  dumplings: food(F(58112510, 'Wonton, dumpling or pot sticker, steamed')),
  edamame: food(I.edamame),
  eggsBenedict: food(F(32101500, 'Egg, Benedict')),
  escargots: food(F(26321110, 'Escargot')),
  // FNDDS falafel keeps all of its frying oil in the recipe (514 kcal); SR's home-made one is realistic.
  falafel: food(S(172455, 'Falafel, home-prepared')),
  filetMignon: food(F(21103180, 'Beef, steak, tenderloin')),
  fishAndChips: recipe('fried battered cod, chips, tartare sauce', [[I.friedCod, 180], [I.fries, 200], [I.tartar, 30]]),
  foieGras: food(S(171100, 'Pate de foie gras, canned (goose liver pate), smoked')),
  frenchFries: food(I.fries),
  frenchOnionSoup: food(F(75608100, 'Soup, French onion')),
  frenchToast: food(F(55301000, 'French toast, plain')),
  friedCalamari: food(F(26213140, 'Calamari, fried')),
  friedRice: food(F(58150310, 'Rice, fried, NFS')),
  frozenYogurt: food(F(11460500, 'Frozen yogurt, soft serve, vanilla')),
  garlicBread: food(F(51121025, 'Garlic bread, from fast food / restaurant')),
  gnocchi: food(F(58122220, 'Gnocchi, potato')),
  greekSalad: recipe('tomato, cucumber, pepper, onion, olives, feta, olive oil', [[I.tomato, 120], [I.cucumber, 80], [I.pepper, 40], [I.onion, 15], [I.olives, 15], [I.feta, 50], [I.oliveOil, 15]]),
  grilledCheeseSandwich: food(F(14640125, 'Grilled cheese sandwich, cheddar cheese, on white bread')),
  grilledSalmon: food(F(26137123, 'Fish, salmon, grilled')),
  guacamole: food(F(63409015, 'Guacamole with tomatoes')),
  gyoza: food(F(58111110, 'Wonton, dumpling or pot sticker, fried')),
  hamburger: food(F(27510631, 'Hamburger, on white bun, 1 medium patty')),
  hotAndSourSoup: food(F(28340750, 'Soup, hot and sour')),
  hotDog: food(F(27564000, 'Hot dog sandwich, NFS, on white bun')),
  huevosRancheros: food(F(32105180, 'Huevos rancheros')),
  hummus: food(I.hummus),
  iceCream: food(F(13110100, 'Ice cream, vanilla')),
  lasagna: food(F(58130015, 'Lasagna with meat, home recipe')),
  lobsterBisque: food(F(28355250, 'Soup, bisque')),
  lobsterRollSandwich: recipe('lobster salad in a buttered bun', [[I.lobsterSalad, 110], [I.hotDogBun, 55], [I.butter, 8]]),
  macaroniAndCheese: food(F(58145110, 'Macaroni or noodles with cheese')),
  macarons: recipe('almond meringue shells with buttercream; baked', [[I.almonds, 50], [I.powderedSugar, 150], [I.eggWhite, 55], [I.sugar, 25], [I.butter, 40]], { yield: 0.9 }),
  misoSoup: food(F(41601070, 'Soup, miso or tofu')),
  mussels: food(F(26313110, 'Mussels')),
  nachos: food(F(58104105, 'Nachos, NFS')),
  omelette: food(I.scrambled),
  onionRings: food(F(75415022, 'Fried onion rings')),
  oysters: food(F(26315100, 'Oysters, raw')),
  padThai: food(F(58137230, 'Pad Thai with chicken')),
  paella: food(F(27360090, 'Paella, NFS')),
  pancakes: food(F(55100005, 'Pancakes, NFS'), 'plain, before syrup: the sweetness scale adds it'),
  pannaCotta: recipe('cream, milk, sugar, gelatine, strawberry sauce', [[I.cream30, 250], [I.milk, 100], [I.sugar, 45], [I.gelatin, 6], [I.strawberries, 60], [I.sugar, 10]]),
  // FNDDS "Duck, Peking" is a pineapple duck stew; the Peking duck people photograph is sliced
  // skin and meat with pancakes and hoisin.
  pekingDuck: recipe('roast duck with skin, pancakes, hoisin, cucumber, scallion', [[I.duck, 100], [I.crepe, 40], [I.hoisin, 20], [I.cucumber, 20], [I.scallion, 10]], { compare: F(24302010, 'Duck, Peking') }),
  pho: food(F(28310330, 'Soup, pho, with meat')),
  pizza: food(F(58106225, 'Pizza, cheese, from restaurant or fast food, medium crust')),
  porkChop: food(F(22101010, 'Pork, chop, lean and fat eaten')),
  poutine: recipe('chips, cheese curds (fresh mozzarella stands in), beef gravy', [[I.fries, 200], [I.mozzarella, 80], [I.gravy, 120]]),
  primeRib: food(S(169500, 'Beef, rib, whole (ribs 6-12), separable lean and fat, trimmed to 1/8" fat, all grades, cooked, roasted')),
  pulledPorkSandwich: food(F(27520510, 'Barbecue pork sandwich, on white bun')),
  ramen: food(F(58407056, 'Ramen bowl with meat and egg')),
  ravioli: food(F(58131320, 'Ravioli, meat-filled, with tomato sauce or meat sauce')),
  redVelvetCake: food(F(53116520, 'Cake or cupcake, red velvet')),
  risotto: recipe('rice cooked in broth, butter, parmesan, onion, mushrooms', [[I.rice, 220], [I.butter, 12], [I.parmesan, 15], [I.oliveOil, 5], [I.onion, 20], [I.mushrooms, 50]]),
  samosa: food(F(58124500, 'Samosa')),
  sashimi: recipe('raw tuna and salmon, half and half', [[I.rawTuna, 60], [I.rawSalmon, 60]]),
  scallops: food(F(26317120, 'Scallops, baked or broiled')),
  seaweedSalad: recipe('wakame, sesame oil, sugar, soy sauce, sesame', [[I.wakame, 100], [I.sesameOil, 5], [I.sugar, 4], [I.soy, 5], [I.sesame, 3]]),
  shrimpAndGrits: recipe('cheese grits, shrimp, bacon, butter', [[I.gritsCheese, 250], [I.shrimp, 100], [I.bacon, 10], [I.butter, 5]]),
  // FNDDS's home-recipe pasta with meat sauce has 2.6 g fat; a Polish plate uses fattier mince and oil.
  spaghettiBolognese: recipe('spaghetti, meat sauce, olive oil, parmesan', [[I.pasta, 220], [I.meatSauce, 150], [I.oliveOil, 5], [I.parmesan, 5]], { compare: F(58146322, 'Pasta with tomato-based sauce and meat, home recipe') }),
  spaghettiCarbonara: recipe('spaghetti, bacon (for guanciale), egg, parmesan; no cream', [[I.pasta, 220], [I.bacon, 30], [I.egg, 50], [I.parmesan, 20]]),
  springRolls: food(F(58110130, 'Egg roll, with beef and/or pork')),
  steak: food(F(21101000, 'Beef, steak, NFS')),
  strawberryShortcake: food(F(53123070, 'Cake, strawberry shortcake')),
  sushi: food(F(58151100, 'Sushi, NFS')),
  tacos: food(F(58102000, 'Taco, NFS')),
  takoyaki: recipe('batter balls with octopus, mayonnaise and sauce; cooked in a pan', [[I.flour, 35], [I.egg, 25], [I.water, 120], [I.octopus, 25], [I.oil, 6], [I.scallion, 5], [I.mayo, 10], [I.steakSauce, 15]], { yield: 0.85 }),
  tiramisu: food(F(13252600, 'Tiramisu')),
  tunaTartare: recipe('raw tuna, avocado, soy sauce, sesame oil, sesame', [[I.rawTuna, 100], [I.avocado, 40], [I.soy, 8], [I.sesameOil, 5], [I.sesame, 2]]),
  waffles: food(I.waffle, 'plain, before toppings: the sweetness scale adds sugar or syrup'),

  // --- Polish and Central European ---
  // FNDDS "Pierogi" is a boiled potato-and-cheese dumpling - pierogi ruskie; served with fried onion.
  pierogiRuskie: recipe('FNDDS pierogi (potato and cheese) with onion fried in oil', [[I.pierogi, 240], [I.onion, 30], [I.oil, 8]]),
  pierogiMeat: recipe('boiled dough (cooked egg noodles) with pork filling and fried onion', [[I.noodles, 130], [I.porkGround, 70], [I.onion, 25], [I.oil, 9]]),
  pierogiCabbage: recipe('boiled dough with sauerkraut and mushroom filling, fried onion', [[I.noodles, 130], [I.sauerkraut, 80], [I.mushrooms, 20], [I.onion, 20], [I.oil, 8]]),
  pierogiFruit: recipe('boiled dough with blueberries, sweetened sour cream', [[I.noodles, 130], [I.blueberries, 80], [I.sugar, 8], [I.sourCream, 30], [I.sugar, 5]]),
  bigos: recipe('sauerkraut and cabbage stewed with pork, kielbasa, bacon, mushrooms, prunes', [[I.sauerkraut, 200], [I.cookedCabbage, 100], [I.porkShoulder, 60], [I.kielbasa, 50], [I.bacon, 10], [I.mushrooms, 15], [I.prunes, 10], [I.tomatoPaste, 10], [I.onion, 20], [I.oil, 5]]),
  zurek: recipe('broth soured with rye starter, white sausage, egg, potatoes, sour cream', [[I.broth, 250], [I.ryeFlour, 20], [I.whiteSausage, 50], [I.boiledEgg, 50], [I.potato, 60], [I.sourCream, 15], [I.bacon, 10]]),
  rosol: food(F(58403040, 'Soup, chicken noodle'), 'US chicken noodle soup: the same broth, noodles and carrot as Polish rosol with noodles'),
  kotletSchabowy: recipe('pounded pork loin in flour, egg and breadcrumbs, pan-fried; about 12 g of oil stays in', [[I.porkLoin, 100], [I.breadcrumbs, 15], [I.egg, 12], [I.flour, 5], [I.oil, 12]], { compare: F(22101310, 'Pork, chop, coated, lean and fat eaten') }),
  schabowyPlate: recipe('kotlet schabowy, boiled potatoes with butter and dill, cabbage slaw', [['kotletSchabowy', 150], [I.potato, 200], [I.butter, 8], ['cabbageSlaw', 100]]),
  golabki: recipe('cabbage leaves with pork and rice, tomato sauce with sour cream', [[I.cookedCabbage, 90], [I.porkGround, 45], [I.rice, 40], [I.onion, 5], [I.tomatoSauce, 60], [I.sourCream, 10]], { compare: F(27315250, 'Stuffed cabbage rolls with beef and rice') }),
  plackiZiemniaczane: food(I.potatoPancake, 'FNDDS potato pancake: grated raw potato, egg, flour, onion, fried in oil - the Polish recipe'),
  nalesnikiZSerem: recipe('crêpes with sweetened curd cheese (twarog), fried in butter', [[I.crepe, 100], [I.twarog, 80], [I.sugar, 8], [I.yolk, 5], [I.butter, 5]]),
  nalesnikiZDzemem: recipe('crêpes with jam', [[I.crepe, 100], [I.jam, 35]]),
  kopytka: recipe('potato dumplings (potato, flour, egg) with melted butter', [[I.potato, 150], [I.flour, 45], [I.egg, 15], [I.butter, 10]]),
  kluskiSlaskie: recipe('potato and potato-starch dumplings with gravy', [[I.potato, 150], [I.potatoStarch, 40], [I.egg, 10], [I.gravy, 80]]),
  barszczCzerwony: food(I.borscht, 'clear beet soup'),
  barszczZUszkami: recipe('clear borscht with mushroom uszka', [[I.borscht, 250], [I.noodles, 30], [I.mushrooms, 15], [I.onion, 5], [I.oil, 2]]),
  zupaPomidorowa: recipe('broth, tomatoes, sour cream, rice', [[I.broth, 200], [I.tinnedTomatoes, 50], [I.tomatoPaste, 15], [I.cookedCarrot, 15], [I.sourCream, 20], [I.rice, 60]]),
  ogorkowa: recipe('broth, fermented cucumbers, potatoes, carrot, sour cream', [[I.broth, 250], [I.gherkins, 60], [I.potato, 60], [I.cookedCarrot, 20], [I.sourCream, 20], [I.flour, 5], [I.butter, 3]]),
  grochowka: food(F(41602030, 'Soup, split pea, with meat')),
  krupnik: food(F(58401010, 'Soup, barley')),
  kapusniak: recipe('broth, sauerkraut, potatoes, pork, kielbasa', [[I.broth, 250], [I.sauerkraut, 80], [I.potato, 60], [I.porkShoulder, 20], [I.kielbasa, 15], [I.cookedCarrot, 15], [I.oil, 3]]),
  grzybowa: recipe('broth, mushrooms, sour cream, noodles', [[I.broth, 280], [I.mushrooms, 60], [I.sourCream, 25], [I.noodles, 40], [I.flour, 3], [I.butter, 3]]),
  zupaJarzynowa: food(F(75649110, 'Soup, vegetable')),
  chlodnik: recipe('kefir, beets, cucumber, radish, egg, dill', [[I.kefir, 200], [I.beets, 50], [I.cucumber, 40], [I.radish, 20], [I.boiledEgg, 25]]),
  zupaGulaszowa: recipe('broth, beef, potatoes, pepper, onion, tomato paste, oil', [[I.broth, 200], [I.beefStew, 50], [I.potato, 60], [I.pepper, 30], [I.onion, 20], [I.tomatoPaste, 10], [I.oil, 5]]),
  fasolkaPoBretonsku: recipe('white beans in tomato sauce with kielbasa and bacon', [[I.whiteBeans, 150], [I.kielbasa, 40], [I.bacon, 10], [I.tinnedTomatoes, 60], [I.tomatoPaste, 10], [I.onion, 20], [I.oil, 5]]),
  gulasz: recipe('pork stewed in gravy with onion', [[I.porkShoulder, 120], [I.gravy, 100], [I.onion, 20], [I.oil, 5]]),
  plackiPoWegiersku: recipe('potato pancakes with goulash and sour cream', [[I.potatoPancake, 200], ['gulasz', 200], [I.sourCream, 20]]),
  kaszanka: recipe('kaszanka fried with onion', [['kaszankaSausage', 140], [I.onion, 40], [I.oil, 8]]),
  kielbasaZGrilla: food(I.kielbasa),
  parowki: food(F(25210280, 'Hot dog, meat and poultry')),
  racuchy: recipe('yeast pancakes with apple, fried, powdered sugar', [[I.flour, 60], [I.milk, 60], [I.egg, 15], [I.sugar, 8], [I.apple, 60], [I.oil, 12], [I.powderedSugar, 5]], { yield: 0.9 }),
  leniwe: recipe('curd cheese dumplings (twarog, flour, egg) with butter, breadcrumbs and sugar', [[I.twarog, 100], [I.flour, 40], [I.egg, 25], [I.butter, 8], [I.breadcrumbs, 8], [I.sugar, 5]]),
  kotletMielony: recipe('pork mince with soaked roll, egg and onion, breaded and fried', [[I.porkGround, 80], [I.softRoll, 15], [I.egg, 10], [I.onion, 10], [I.breadcrumbs, 8], [I.oil, 8]]),
  kotletZKurczaka: food(F(24127200, 'Chicken breast, fried, coated, skin / coating eaten, from raw')),
  sznycelWiedenski: food(S(173819, 'Veal, leg (top round), separable lean and fat, cooked, pan-fried, breaded')),
  strogonow: food(F(27113100, 'Beef stroganoff')),
  mizeria: recipe('cucumber in sour cream with dill', [[I.cucumber, 150], [I.sourCream, 40], [I.sugar, 2]]),
  surowkaZKapusty: recipe('cabbage slaw: cabbage, carrot, oil', [['cabbageSlaw', 100]]),
  surowkaZMarchewki: recipe('grated carrot and apple with lemon', [[I.carrot, 120], [I.apple, 40], [I.lime, 5], [I.sugar, 3], [I.oil, 3]]),
  ziemniaki: food(F(71103000, 'Potato, boiled, from fresh, peel not eaten, NS as to fat'), 'boiled potatoes with the usual knob of butter'),
  puree: food(I.mashed),
  kaszaGryczana: food(I.buckwheat),
  salatkaJarzynowa: recipe('potatoes, carrot, peas, gherkins, egg, apple, onion, mayonnaise', [[I.potato, 80], [I.cookedCarrot, 40], [I.peas, 30], [I.gherkins, 30], [I.boiledEgg, 25], [I.apple, 15], [I.onion, 5], [I.mayo, 30]]),
  sledzWSmietanie: recipe('marinated herring in sour cream with onion and apple', [[I.marinatedHerring, 100], [I.sourCream, 60], [I.onion, 20], [I.apple, 20]]),
  makowiec: recipe('sweet yeast dough rolled with poppy-seed filling (poppy, sugar, honey, prunes, butter, walnuts)', [[I.sweetRoll, 55], [I.poppy, 25], [I.sugar, 10], [I.honey, 4], [I.prunes, 3], [I.butter, 2], [I.walnuts, 3]]),
  sernik: recipe('baked curd cheese (twarog), eggs, sugar, butter, potato starch', [[I.twarog, 250], [I.egg, 100], [I.sugar, 70], [I.butter, 40], [I.potatoStarch, 15]], { yield: 0.9, compare: F(53104500, 'Cheesecake, plain') }),
  paczek: food(F(53521140, 'Doughnut, jelly')),
  drozdzowka: food(F(53511000, 'Danish pastry, with cheese')),
  kremowka: food(F(53452420, 'Pastry, puff, custard or cream filled')),
  kanapkaZSzynka: recipe('2 slices of bread with butter, ham, cheese, tomato, lettuce', [[I.bread, 70], [I.butter, 8], [I.ham, 30], [I.gouda, 20], [I.tomato, 20], [I.lettuce, 5]]),
  kanapkaZTwarozkiem: recipe('2 slices of rye bread with curd cheese (twarog), yoghurt and chives, radish', [[I.ryeBread, 70], [I.twarog, 60], [I.yogurt, 15], [I.radish, 20]]),
  bulkaZDzemem: recipe('kaiser roll with butter and jam', [[I.roll, 60], [I.butter, 10], [I.jam, 25]]),
  zapiekanka: recipe('half a baguette with mushrooms, onion, cheese, ketchup', [[I.baguette, 120], [I.mushrooms, 60], [I.onion, 10], [I.oil, 8], [I.gouda, 40], [I.ketchup, 25]]),
  kebabWBulce: recipe('pita, kebab meat, cabbage, tomato, cucumber, onion, garlic sauce', [[I.pita, 80], ['kebabMeat', 110], [I.cabbage, 40], [I.tomato, 20], [I.cucumber, 15], [I.onion, 10], ['sauce:garlic', 40]], { compare: F(27516010, 'Gyro sandwich') }),
  kebabTortilla: recipe('flour tortilla, kebab meat, vegetables, garlic sauce', [[I.tortilla, 75], ['kebabMeat', 120], [I.cabbage, 40], [I.tomato, 25], [I.cucumber, 15], ['sauce:garlic', 40]]),
  kebabBox: recipe('kebab meat on chips with salad and garlic sauce', [['kebabMeat', 150], [I.fries, 150], [I.cabbage, 50], [I.tomato, 30], ['sauce:garlic', 50]]),
  knedle: recipe('potato dough with plums, buttered breadcrumbs and sugar', [[I.potato, 75], [I.flour, 25], [I.egg, 8], [I.plum, 30], [I.breadcrumbs, 8], [I.butter, 6], [I.sugar, 6]]),
  langosz: recipe('fried yeast flatbread with garlic, sour cream and cheese', [[I.flour, 70], [I.water, 45], [I.oil, 15], [I.garlic, 3], [I.sourCream, 30], [I.gouda, 25]], { yield: 0.9 }),

  // --- Italian ---
  pizzaSalami: food(F(58106550, 'Pizza with pepperoni, from restaurant or fast food, thin crust')),
  pizzaVege: food(F(58106325, 'Pizza, cheese, with vegetables, from restaurant or fast food, medium crust')),
  pizzaCapricciosa: food(F(58106725, 'Pizza with meat and vegetables, from restaurant or fast food, medium crust')),
  pizzaHawaii: food(F(58106755, 'Pizza with meat and fruit, medium crust')),
  calzone: food(F(58108010, 'Calzone, with meat and cheese')),
  penneArrabbiata: food(F(58146221, 'Pasta with tomato-based sauce, restaurant')),
  pastaPesto: recipe('pasta with basil pesto and parmesan', [[I.pasta, 220], [I.pesto, 30], [I.parmesan, 5]]),
  fettuccineAlfredo: recipe('pasta with Alfredo sauce', [[I.pasta, 220], [I.alfredo, 100]]),
  aglioOlio: recipe('spaghetti with olive oil, garlic, parmesan', [[I.pasta, 220], [I.oliveOil, 15], [I.garlic, 5], [I.parmesan, 5]]),
  tortellini: food(F(58134620, 'Tortellini, cheese-filled, meatless, with tomato sauce')),
  minestrone: food(F(75651000, 'Soup, minestrone')),
  arancini: food(F(58161710, 'Rice croquette')),
  focaccia: food(F(51108010, 'Focaccia, Italian, plain')),
  melanzane: food(F(75412060, 'Eggplant parmesan casserole, regular')),
  chickenParmigiana: food(F(27146300, 'Chicken or turkey parmigiana')),

  // --- French ---
  croissant: food(F(51166000, 'Croissant')),
  quiche: food(F(58125110, 'Quiche with meat, poultry or fish')),
  ratatouille: food(F(75316050, 'Ratatouille')),
  boeufBourguignon: food(F(27111200, 'Beef burgundy')),
  croqueMonsieur: recipe('ham and cheese sandwich with béchamel and grilled cheese', [[I.hamCheeseSandwich, 150], [I.whiteSauce, 30], [I.gouda, 15]]),
  eclair: food(F(53420200, 'Cream puff, eclair, custard or cream filled, iced')),
  nicoise: recipe('tuna, egg, potatoes, green beans, tomato, olives, lettuce, vinaigrette', [[I.tinnedTuna, 80], [I.boiledEgg, 50], [I.potato, 80], [I.greenBeans, 60], [I.tomato, 60], [I.olives, 15], [I.lettuce, 40], [I.vinaigrette, 30]]),

  // --- Spanish ---
  tortillaEspanola: recipe('potato and onion omelette; potatoes fried in olive oil', [[I.potato, 150], [I.egg, 100], [I.onion, 30], [I.oliveOil, 20]]),
  gazpacho: food(F(75604600, 'Soup, gazpacho')),
  patatasBravas: recipe('roast potatoes with tomato sauce and aioli', [[I.roastPotatoes, 200], [I.tomatoSauce, 40], [I.mayo, 15]]),
  croquetas: food(F(27220080, 'Ham croquette')),

  // --- Greek and Turkish ---
  moussaka: recipe('aubergine, beef mince in tomato sauce, potato, béchamel', [[I.eggplant, 120], [I.oliveOil, 8], [I.beefGround, 60], [I.tomatoSauce, 40], [I.potato, 40], [I.whiteSauce, 60]]),
  gyros: food(F(27516010, 'Gyro sandwich')),
  souvlaki: food(F(27420520, 'Pork shish kabob with vegetables, excluding potatoes')),
  tzatziki: food(I.tzatziki),
  spanakopita: food(F(58124250, 'Spanakopita')),
  dolmades: food(F(58161510, 'Grape leaves stuffed with rice')),
  lahmacun: recipe('thin flatbread with spiced mince, tomato and pepper', [[I.pita, 100], [I.lambGround, 20], [I.beefGround, 20], [I.tomatoPaste, 10], [I.pepper, 15], [I.onion, 10], [I.oliveOil, 5]]),
  kofte: food(F(27416200, 'Beef, ground, with egg and onion')),
  menemen: recipe('eggs scrambled with tomato and pepper in oil', [[I.egg, 100], [I.tomato, 80], [I.pepper, 40], [I.oil, 8]]),

  // --- Middle Eastern ---
  falafelWrap: food(F(41901030, 'Falafel sandwich')),
  shawarma: recipe('lavash with chicken, garlic sauce, gherkins and tomato', [[I.tortilla, 70], [I.chickenThigh, 100], ['sauce:garlic', 30], [I.gherkins, 20], [I.tomato, 20], [I.oil, 4]]),
  tabbouleh: food(F(58175110, 'Tabbouleh')),
  babaGanoush: recipe('roasted aubergine with tahini, olive oil, lemon, garlic', [[I.eggplant, 150], [I.tahini, 25], [I.oliveOil, 10], [I.lime, 10], [I.garlic, 3]]),
  shakshuka: recipe('eggs poached in tomato, pepper and onion', [[I.egg, 100], [I.tinnedTomatoes, 150], [I.pepper, 50], [I.onion, 30], [I.oliveOil, 10]]),
  mujadara: food(F(58160805, 'Rice, white, with lentils, fat added')),

  // --- Indian ---
  butterChicken: recipe('chicken in tomato, cream and butter sauce (tikka masala)', [[I.chickenBreast, 120], [I.tinnedTomatoes, 80], [I.cream36, 40], [I.butter, 10], [I.onion, 20], [I.oil, 5]]),
  dal: recipe('lentils with tomato, onion and ghee', [[I.lentils, 200], [I.tinnedTomatoes, 40], [I.onion, 20], [I.butter, 10], [I.water, 30]]),
  chanaMasala: recipe('chickpeas in spiced tomato and onion', [[I.chickpeas, 150], [I.tinnedTomatoes, 80], [I.onion, 30], [I.oil, 10]]),
  biryani: food(F(27243100, 'Biryani with chicken')),
  naan: food(F(51108100, 'Bread, naan')),
  palakPaneer: food(F(72125310, 'Palak Paneer')),
  dosa: food(F(58174100, 'Dosa, with filling')),
  pakora: food(F(75440400, 'Pakora')),

  // --- Thai and Vietnamese ---
  greenCurry: recipe('chicken in coconut milk with aubergine and pepper, fish sauce, sugar', [[I.chickenBreast, 100], [I.coconutMilk, 120], [I.eggplant, 40], [I.pepper, 30], [I.fishSauce, 5], [I.sugar, 3], [I.oil, 5]]),
  tomYum: recipe('hot and sour broth with prawns, mushrooms, tomato, lime', [[I.broth, 300], [I.shrimp, 50], [I.mushrooms, 40], [I.tomato, 30], [I.lime, 10], [I.fishSauce, 8], [I.sugar, 3], [I.hotSauce, 5]]),
  papayaSalad: recipe('green papaya (ripe papaya stands in), tomato, beans, peanuts, lime, fish sauce, sugar', [[I.papaya, 150], [I.tomato, 30], [I.greenBeans, 20], [I.peanuts, 10], [I.lime, 15], [I.fishSauce, 10], [I.sugar, 8]]),
  satay: recipe('grilled chicken skewers with peanut sauce', [[I.chickenBreast, 120], [I.peanutSauce, 40]]),
  mangoStickyRice: recipe('rice cooked with coconut milk, mango, coconut cream, sugar', [[I.coconutRice, 150], [I.mango, 120], [I.coconutMilk, 20], [I.sugar, 5]]),
  banhMi: recipe('baguette with roast pork, pâté, quick-marinated carrot, cucumber, mayonnaise', [[I.baguette, 80], [I.porkShoulder, 50], [I.liverPate, 15], [I.carrot, 30], [I.sugar, 3], [I.cucumber, 20], [I.mayo, 10]]),
  summerRolls: food(F(58110200, 'Roll with meat and/or shrimp, vegetables and rice paper, not fried')),

  // --- Chinese ---
  chowMein: food(F(58136160, 'Lo mein, with chicken')),
  kungPaoChicken: food(F(27445220, 'Kung pao chicken')),
  sweetSourChicken: food(F(27146100, 'Sweet and sour chicken or turkey')),
  generalTso: food(F(27445150, 'General Tso chicken')),
  orangeChicken: food(F(27146350, 'Orange chicken')),
  wontonSoup: food(F(58408010, 'Soup, wonton')),
  bao: food(F(58123110, 'Bao bun')),
  mapoTofu: recipe('tofu with pork mince in chilli broth, oil, soy sauce', [[I.tofu, 150], [I.porkGround, 40], [I.broth, 60], [I.hotSauce, 10], [I.oil, 10], [I.soy, 5]]),
  beefBroccoli: food(F(27415110, 'Beef and broccoli')),
  congee: food(F(58157300, 'Congee, with meat, poultry, and/or seafood')),

  // --- Japanese and Korean ---
  nigiri: food(F(58151420, 'Sushi, topped with salmon')),
  californiaRoll: food(F(58151180, 'Sushi roll, California')),
  salmonRoll: food(F(58151200, 'Sushi roll, salmon')),
  vegetableRoll: food(F(58151230, 'Sushi roll, vegetable')),
  tempura: recipe('prawn and vegetable tempura, half and half', [[I.friedShrimp, 50], [I.vegetableTempura, 50]]),
  teriyakiChicken: food(F(27145000, 'Chicken or turkey with teriyaki')),
  tonkatsu: recipe('breaded pork cutlet with tonkatsu sauce and cabbage', [['kotletSchabowy', 150], [I.steakSauce, 20], [I.cabbage, 50]]),
  katsuCurry: recipe('breaded pork cutlet with Japanese curry sauce and rice', [['kotletSchabowy', 120], [I.curry, 120], [I.rice, 200]]),
  udon: recipe('thick wheat noodles (cooked noodles stand in) in soy broth with scallion', [[I.noodles, 200], [I.broth, 300], [I.soy, 10], [I.sugar, 5], [I.scallion, 5]]),
  onigiri: recipe('rice ball with salmon and nori', [[I.rice, 100], [I.salmon, 15], [I.nori, 1]]),
  pokeBowl: recipe('rice, raw salmon, avocado, edamame, cucumber, soy sauce, sesame oil, spicy mayo', [[I.rice, 150], [I.rawSalmon, 80], [I.avocado, 40], [I.edamame, 30], [I.cucumber, 30], [I.soy, 10], [I.sesameOil, 5], [I.mayo, 10]]),
  kimchi: food(F(75502520, 'Kimchi')),
  bulgogi: food(F(27115000, 'Beef with soy-based sauce'), 'beef in a sweet soy sauce, as bulgogi'),
  koreanFriedChicken: food(F(24168001, 'Chicken "wings" with other sauces or seasoning, from fast food / restaurant')),
  tteokbokki: food(F(58150520, 'Dukboki or Tteokbokki, Korean')),

  // --- Mexican ---
  burrito: food(F(58102340, 'Burrito, beef, with beans and rice, cheese')),
  burritoBowl: food(F(58102760, 'Burrito bowl, chicken, with rice')),
  enchiladas: food(F(58102830, 'Enchilada, chicken')),
  fajitas: food(F(58105000, 'Fajita, chicken')),
  chiliConCarne: food(F(27111406, 'Chili with meat and beans')),

  // --- American ---
  cheeseburger: food(F(27510241, 'Cheeseburger, on white bun, 1 medium patty')),
  friedChicken: food(F(24137300, 'Chicken leg, drumstick and thigh, fried, coated, skin / coating eaten')),
  chickenNuggets: food(F(24198731, 'Chicken nuggets, from fast food')),
  chickenBurger: food(F(27540146, 'Chicken fillet sandwich, fried, from fast food')),
  blt: food(F(27520610, 'Bacon, lettuce, tomato sandwich on white')),
  phillyCheesesteak: food(F(27514030, 'Cheese steak sandwich or sub on white')),
  meatloaf: food(F(27214100, 'Meat loaf made with beef')),
  cornDog: food(F(27560300, 'Corn dog')),
  coleslaw: food(F(75141000, 'Coleslaw')),
  potatoSalad: food(F(71601010, 'Potato salad with egg, made with mayonnaise')),
  bakedBeans: food(I.bakedBeans),
  cinnamonRoll: food(F(51160110, 'Roll, sweet, cinnamon bun, frosted')),
  brownie: food(F(53204010, 'Cookie, brownie, without icing')),
  cookie: food(F(53206020, 'Cookie, chocolate chip, made from home recipe or purchased at a bakery')),
  muffin: food(F(52302500, 'Muffin, chocolate chip')),
  bagelCreamCheese: recipe('bagel with cream cheese', [[I.bagel, 105], [I.creamCheese, 30]]),

  // --- British ---
  fullEnglish: recipe('2 fried eggs, bacon, 2 sausages, beans, mushrooms, tomato, toast', [[I.friedEgg, 110], [I.bacon, 30], [I.porkSausage, 90], [I.bakedBeans, 100], [I.mushrooms, 50], [I.oil, 5], [I.tomato, 50], [I.toast, 30]]),
  shepherdsPie: food(F(27311510, "Shepherd's pie")),
  beansOnToast: recipe('baked beans on buttered toast', [[I.bakedBeans, 200], [I.toast, 60], [I.butter, 5]]),
  sconeJamCream: recipe('scone with jam and clotted cream (whipping cream stands in)', [[I.scone, 70], [I.jam, 20], [I.cream36, 20]]),
  bangersAndMash: recipe('pork sausages, mashed potatoes, onion gravy', [[I.porkSausage, 120], [I.mashed, 200], [I.gravy, 80]]),
  chickenPotPie: food(F(27347100, 'Pot pie, chicken')),

  // --- Everyday plates ---
  owsianka: recipe('oats cooked in 2 % milk with a teaspoon of honey', [[I.oats, 50], [I.milk, 250], [I.honey, 10]], { compare: F(56203066, 'Oatmeal, regular or quick, made with milk, no added fat') }),
  owsiankaZOwocami: recipe('owsianka with banana and blueberries', [['owsianka', 300], [I.banana, 60], [I.blueberries, 40]]),
  jajecznica: food(I.scrambled),
  jajecznicaNaBoczku: recipe('scrambled eggs with bacon', [[I.scrambled, 165], [I.bacon, 20]]),
  jajkoSadzone: food(I.friedEgg),
  jajkaNaTwardo: food(I.boiledEgg),
  jogurtZOwocami: recipe('natural yoghurt with strawberries and banana', [[I.yogurt, 150], [I.strawberries, 80], [I.banana, 40]]),
  jogurtZGranola: recipe('natural yoghurt with granola and honey', [[I.yogurt, 150], [I.granola, 40], [I.honey, 10]]),
  skyrBowl: recipe('greek yoghurt with blueberries and walnuts', [[I.greekYogurt, 170], [I.blueberries, 50], [I.walnuts, 10]]),
  platkiZMlekiem: recipe('corn flakes with 2 % milk', [[I.cornFlakes, 40], [I.milk, 200]]),
  tostZAwokado: recipe('toast with avocado and a poached egg', [[I.toast, 60], [I.avocado, 70], [I.boiledEgg, 50]]),
  bagel: food(I.bagel),
  kurczakZRyzem: recipe('roast chicken breast, rice, broccoli, a teaspoon of oil', [[I.chickenBreast, 130], [I.rice, 180], [I.broccoli, 100], [I.oil, 5]]),
  piersZKurczaka: food(I.chickenBreast),
  udkoZKurczaka: food(F(24132230, 'Chicken leg, drumstick and thigh, baked or broiled, skin eaten')),
  makaronZSosemPomidorowym: food(F(58146222, 'Pasta with tomato-based sauce, home recipe')),
  rybaZZiemniakami: recipe('baked salmon, boiled potatoes with butter, broccoli', [[I.salmon, 150], [I.potato, 200], [I.butter, 5], [I.broccoli, 100]]),
  ryzZWarzywami: food(F(58160720, 'Rice, white, with other vegetables, fat added')),
  stirFry: recipe('chicken stir-fried with broccoli, pepper, carrot, soy sauce', [[I.chickenBreast, 120], [I.broccoli, 80], [I.pepper, 50], [I.carrot, 30], [I.soy, 10], [I.oil, 10]]),
  wrapZKurczakiem: food(F(27540300, 'Chicken fillet wrap sandwich, grilled, from fast food')),
  salatkaZKurczakiem: recipe('mixed salad with chicken, vinaigrette', [[I.chickenGardenSalad, 250], [I.vinaigrette, 25]]),
  salatkaZielona: recipe('mixed salad with vinaigrette', [[I.mixedSalad, 150], [I.vinaigrette, 15]]),
  salatkaZTunczykiem: recipe('mixed salad with tuna, egg, vinaigrette', [[I.mixedSalad, 150], [I.tinnedTuna, 80], [I.boiledEgg, 25], [I.vinaigrette, 20]]),
  warzywaGotowane: food(F(75311012, 'Classic mixed vegetables, frozen, cooked, no added fat')),
  warzywaGrillowane: recipe('grilled courgette, pepper, aubergine with olive oil', [[I.zucchini, 100], [I.pepper, 80], [I.eggplant, 80], [I.oliveOil, 10]]),
  ryz: food(I.rice),
  makaron: food(I.pasta),
  chleb: food(I.ryeBread),
  // The NFS and frozen rows give 37 g carbs yet 192 kcal (Atwater says 244); the fresh row adds up.
  frytkiZBatatow: food(F(73410340, 'Sweet potato fries, from fresh')),
  zupaKremZWarzyw: food(F(75611010, 'Soup, cream of vegetable')),
  zupaDyniowa: food(F(73502000, 'Soup, pumpkin')),
  zupaPieczarkowa: food(F(75607060, 'Soup, cream of mushroom')),
  zupaZSoczewicy: food(F(41603010, 'Soup, lentil')),
  quinoa: food(F(56204005, 'Quinoa, no added fat')),
  kuskus: food(F(56207160, 'Couscous, plain, cooked')),

  // --- Desserts and sweets ---
  ciasto: food(F(53100100, 'Cake or cupcake, NFS')),
  budyn: food(F(13220110, 'Pudding, flavors other than chocolate, made from dry mix')),
  gofrZBitaSmietana: recipe('waffle with whipped cream and strawberries', [[I.waffle, 100], [I.whippedCream, 30], [I.strawberries, 50]]),
  czekolada: food(F(91705010, 'Chocolate candy')),
  batonProteinowy: food(F(53720100, 'Nutrition bar (Balance Original Bar)')),
  sernikNaZimno: recipe('no-bake curd cheese cake with gelatine, cream and strawberries', [[I.twarog, 250], [I.cream30, 100], [I.sugar, 60], [I.gelatin, 10], [I.strawberries, 50]]),
  lodyWloskie: food(F(13110200, 'Ice cream, soft serve, vanilla')),
  owoceZBitaSmietana: recipe('strawberries with whipped cream', [[I.strawberries, 200], [I.whippedCream, 30]]),

  // --- Snacks ---
  chipsy: food(F(71200100, 'Potato chips, plain')),
  orzechy: food(F(42110100, 'Mixed nuts, with peanuts, salted')),
  popcorn: food(F(54403001, 'Popcorn, NFS')),
  krakersy: food(I.crackers),
  hummusZWarzywami: recipe('hummus with carrot, cucumber and pepper sticks', [[I.hummus, 70], [I.carrot, 60], [I.cucumber, 60], [I.pepper, 50]]),

  // --- Fruit ---
  jablko: food(I.apple),
  banan: food(I.banana),
  pomarancza: food(F(61119010, 'Orange, raw')),
  mandarynki: food(F(61125010, 'Tangerine, raw')),
  truskawki: food(I.strawberries),
  winogrona: food(I.grapes),
  arbuz: food(F(63149010, 'Watermelon, raw')),
  gruszka: food(F(63137010, 'Pear, raw')),
  kiwi: food(F(63126500, 'Kiwi fruit, raw')),
  borowki: food(I.blueberries),
  mango: food(I.mango),
  sliwki: food(I.plum),
  czeresnie: food(F(63115010, 'Cherries, raw')),
  maliny: food(F(63219000, 'Raspberries, raw')),
  salatkaOwocowa: food(F(63311050, 'Fruit salad, fresh or raw, including citrus fruits, no dressing')),

  // --- Drinks ---
  kawaZMlekiem: food(F(92101900, 'Coffee, Latte'), 'latte without sugar: the sweetness scale adds it'),
  cappuccino: food(F(92161000, 'Coffee, Cappuccino')),
  kawaCzarna: food(F(92101000, 'Coffee, brewed')),
  espresso: food(F(92101610, 'Coffee, espresso')),
  herbata: food(F(92302000, 'Tea, hot, leaf, black')),
  sokPomaranczowy: food(F(61210000, 'Orange juice, 100%, NFS')),
  smoothie: food(F(11553110, 'Fruit smoothie, with whole fruit and dairy')),
  koktajlProteinowy: recipe('whey protein shaken with 2 % milk and a banana', [[I.whey, 30], [I.milk, 300], [I.banana, 100]]),
  mleko: food(I.milk),
  kefir: food(I.kefir),
  kakao: food(F(11512010, 'Hot chocolate / cocoa, made with whole or reduced fat (2%) milk')),
  piwo: food(F(93101000, 'Beer')),
  winoCzerwone: food(F(93401010, 'Wine, red')),
  winoBiale: food(F(93401020, 'Wine, white')),
  cola: food(F(92410310, 'Soft drink, cola')),
  lemoniada: food(F(92510955, 'Lemonade, fruit juice drink')),
  milkshake: food(F(11542100, 'Milk shake, fast food, chocolate')),
  bubbleTea: food(F(92306910, 'Tea, bubble')),
  energetyk: food(F(95310400, 'Energy drink (Monster)')),
};

// --- USDA tables ---

async function cached(src: typeof FNDDS): Promise<Uint8Array> {
  const path = join(src.cache, src.file);
  if (!existsSync(path)) {
    await mkdir(src.cache, { recursive: true });
    console.log(`downloading ${src.zip}`);
    const response = await fetchWithRetry(src.zip);
    await writeFile(path, new Uint8Array(await response.arrayBuffer()));
  }
  return new Uint8Array(await readFile(path));
}

/** One CSV record; FDC quotes every field and doubles quotes inside one. */
function fields(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = '';
      i++;
      for (;;) {
        const q = line.indexOf('"', i);
        if (q < 0) throw new Error(`unterminated quote: ${line.slice(0, 80)}`);
        value += line.slice(i, q);
        if (line[q + 1] === '"') {
          value += '"';
          i = q + 2;
        } else {
          i = q + 1;
          break;
        }
      }
      out.push(value);
      i++; // the comma
    } else {
      const c = line.indexOf(',', i);
      const end = c < 0 ? line.length : c;
      out.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return out;
}

function* rows(csv: string): Generator<string[]> {
  const lines = csv.split(/\r?\n/);
  for (let n = 1; n < lines.length; n++) if (lines[n]) yield fields(lines[n]!);
}

const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'sugars', 'fiber', 'satFat', 'alcohol'] as const;
type Key = (typeof KEYS)[number];
type Nutrients = Record<Key, number>;

/**
 * USDA nutrient numbers (`nutrient_nbr`), first one present wins. FNDDS's food_nutrient.csv gives
 * the number itself in `nutrient_id`, SR's gives the FDC nutrient id; both are mapped to numbers.
 * Energy falls back to the Atwater energies some SR rows carry instead.
 */
const NUMBERS: Record<Key, string[]> = {
  kcal: ['208', '958', '957'],
  protein: ['203'],
  carbs: ['205'],
  fat: ['204'],
  sugars: ['269', '269.3'],
  fiber: ['291'],
  satFat: ['606'],
  alcohol: ['221'],
};
const WANTED_NUMBERS = new Set(Object.values(NUMBERS).flat());

interface Table {
  description: Map<number, string>;
  nutrients: Map<number, Map<string, number>>;
}

/** Loads one FDC CSV release, keyed by FNDDS food code (FNDDS) or FDC id (SR). */
async function load(src: typeof FNDDS, wanted: Set<number>): Promise<Table> {
  const dir = src.file.replace(/\.zip$/, '');
  const names = ['food.csv', 'food_nutrient.csv', 'nutrient.csv', 'survey_fndds_food.csv'];
  const parts = unzipSync(await cached(src), { filter: (f) => names.includes(f.name.replace(`${dir}/`, '')) });
  const part = (name: string) => {
    const bytes = parts[`${dir}/${name}`];
    if (!bytes) throw new Error(`${src.file} has no ${name}`);
    return strFromU8(bytes);
  };
  // FDC id -> the key this release is looked up by.
  const keyOf = new Map<string, number>();
  if (src === FNDDS) for (const [fdc, code] of rows(part('survey_fndds_food.csv'))) keyOf.set(fdc!, Number(code));
  else for (const [fdc] of rows(part('food.csv'))) keyOf.set(fdc!, Number(fdc));

  const numberOf = new Map<string, string>();
  for (const [id, , , nbr] of rows(part('nutrient.csv'))) numberOf.set(id!, String(Number(nbr)));

  const description = new Map<number, string>();
  for (const [fdc, , text] of rows(part('food.csv'))) {
    const key = keyOf.get(fdc!);
    if (key !== undefined && wanted.has(key)) description.set(key, text!);
  }
  const nutrients = new Map<number, Map<string, number>>();
  for (const [, fdc, nutrient, amount] of rows(part('food_nutrient.csv'))) {
    const key = keyOf.get(fdc!);
    if (key === undefined || !wanted.has(key) || amount === '') continue;
    // FNDDS gives nutrient numbers (< 1000) here; SR gives FDC nutrient ids (>= 1001).
    const nbr = Number(nutrient) < 1000 ? String(Number(nutrient)) : numberOf.get(nutrient!);
    if (!nbr || !WANTED_NUMBERS.has(nbr)) continue;
    let m = nutrients.get(key);
    if (!m) nutrients.set(key, (m = new Map()));
    m.set(nbr, Number(amount));
  }
  return { description, nutrients };
}

// --- Build ---

const refsOf = (s: Source): Ref[] =>
  s.kind === 'food' ? [s.ref] : [...s.lines.flatMap(([r]) => (typeof r === 'string' ? [] : [r])), ...(s.compare ? [s.compare] : [])];
for (const [id] of Object.entries(REGION_DISHES)) if (id in DISHES) throw new Error(`${id} is in two catalog files`);
Object.assign(DISHES, REGION_DISHES);
for (const [id] of Object.entries(REGION_PARTS)) if (id in PARTS) throw new Error(`part ${id} is in two catalog files`);
Object.assign(PARTS, REGION_PARTS);
const allSources = [...Object.values(SAUCES), ...Object.values(PARTS), ...Object.values(DISHES)];
const wantedIn = (db: Db) => new Set(allSources.flatMap(refsOf).filter((r) => r.db === db).map((r) => r.id));
const tables: Record<Db, Table> = { fndds: await load(FNDDS, wantedIn('fndds')), sr: await load(SR, wantedIn('sr')) };
const DB_NAME: Record<Db, string> = { fndds: FNDDS.db, sr: SR.db };

const missing = new Set<string>();
function nutrientsOf(ref: Ref): Nutrients {
  const t = tables[ref.db];
  const text = t.description.get(ref.id);
  if (text === undefined) throw new Error(`${ref.db} ${ref.id} not found (expected "${ref.piece}")`);
  if (!text.startsWith(ref.piece)) throw new Error(`${ref.db} ${ref.id} is "${text}", expected "${ref.piece}"`);
  const m = t.nutrients.get(ref.id) ?? new Map<string, number>();
  if (!NUMBERS.kcal.some((n) => m.has(n))) throw new Error(`${ref.db} ${ref.id} has no energy`);
  const out = {} as Nutrients;
  for (const key of KEYS) {
    const nbr = NUMBERS[key].find((n) => m.has(n));
    // SR leaves some sugars and fibre blank; counted as 0 and listed in the notes. Alcohol is
    // given only where there is some.
    if (nbr === undefined && key !== 'alcohol') missing.add(`${DB_NAME[ref.db]} ${ref.id} ${text}: ${key}`);
    out[key] = nbr === undefined ? 0 : m.get(nbr)!;
  }
  return out;
}

interface RecipeLine {
  g: number;
  db: string;
  code?: number;
  description: string;
}
interface Built {
  per100: Nutrients;
  source: { db: string; code?: number; description?: string; note?: string; recipe?: RecipeLine[]; yield?: number };
}

const built = new Map<string, Built>();
const resolving = new Set<string>();
/** Builds a source by its key: a dish id, a part id or `sauce:<id>`. */
function build(key: string): Built {
  const done = built.get(key);
  if (done) return done;
  const s = key.startsWith('sauce:') ? SAUCES[key.slice(6)] : (PARTS[key] ?? DISHES[key]);
  if (!s) throw new Error(`unknown source ${key}`);
  if (resolving.has(key)) throw new Error(`recipe cycle at ${key}`);
  resolving.add(key);
  let out: Built;
  if (s.kind === 'food') {
    const description = tables[s.ref.db].description.get(s.ref.id);
    out = { per100: nutrientsOf(s.ref), source: { db: DB_NAME[s.ref.db], code: s.ref.id, description, ...(s.note ? { note: s.note } : {}) } };
  } else {
    const sum = Object.fromEntries(KEYS.map((k) => [k, 0])) as Nutrients;
    const lines: RecipeLine[] = [];
    let grams = 0;
    for (const [r, g] of s.lines) {
      if (!(g > 0)) throw new Error(`${key}: ${g} g`);
      let per100: Nutrients;
      if (typeof r === 'string') {
        per100 = build(r).per100;
        lines.push({ g, db: 'composed', description: r.startsWith('sauce:') ? `${r.slice(6)} sauce` : r });
      } else {
        per100 = nutrientsOf(r);
        lines.push({ g, db: DB_NAME[r.db], code: r.id, description: tables[r.db].description.get(r.id)! });
      }
      for (const k of KEYS) sum[k] += (per100[k] * g) / 100;
      grams += g;
    }
    const served = grams * (s.yield ?? 1);
    const per100 = Object.fromEntries(KEYS.map((k) => [k, (sum[k] * 100) / served])) as Nutrients;
    out = { per100, source: { db: 'composed', note: s.note, recipe: lines, ...(s.yield ? { yield: s.yield } : {}) } };
    if (s.compare) {
      const c = nutrientsOf(s.compare);
      console.log(`  ${key}: ${Math.round(per100.kcal)} kcal, ${per100.fat.toFixed(1)} g fat; FNDDS ${s.compare.id} "${s.compare.piece}": ${c.kcal} kcal, ${c.fat} g fat`);
    }
  }
  resolving.delete(key);
  built.set(key, out);
  return out;
}

/** kcal whole, grams to 0.1; alcohol only where there is some. */
function rounded(n: Nutrients): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of KEYS) {
    const v = k === 'kcal' ? Math.round(n[k]) : Math.round(n[k] * 10) / 10;
    if (k === 'alcohol' && v === 0) continue;
    out[k] = v;
  }
  return out;
}

for (const id of Object.keys(PARTS)) if (id in DISHES) throw new Error(`${id} is both a part and a dish`);
const entry = (key: string) => ({ per100: rounded(build(key).per100) });
const dishes = Object.fromEntries(Object.keys(DISHES).sort().map((id) => [id, entry(id)]));
const sauces = Object.fromEntries(Object.keys(SAUCES).sort().map((id) => [id, entry(`sauce:${id}`)]));
const dishSources = Object.fromEntries(Object.keys(DISHES).sort().map((id) => [id, build(id).source]));
const sauceSources = Object.fromEntries(Object.keys(SAUCES).sort().map((id) => [id, build(`sauce:${id}`).source]));

const out = {
  source: {
    name: `${FNDDS.name}; ${SR.name}`,
    url: FNDDS.url,
    license: 'CC0 1.0 / public domain',
    builtBy: 'scripts/food/fetch-dishes.ts',
  },
  units: 'per 100 g as served: kcal; protein, carbs, fat, sugars, fiber, satFat, alcohol in g',
  notes: {
    composed:
      'Recipes in grams as served (cooked state); per 100 g = the sum of the parts over the total weight, divided by `yield` where a dough or batter loses water in the oven or the pan.',
    missing: [...missing].sort(),
  },
  dishes,
  sauces,
};
await mkdir('src/food/photo/data', { recursive: true });
await writeFile(OUT, `${JSON.stringify(out, null, 1)}\n`);
await writeFile(SOURCES_OUT, `${JSON.stringify({ source: out.source, dishes: dishSources, sauces: sauceSources }, null, 1)}\n`);
const count = (db: string) => Object.values(dishSources).filter((s) => s.db === db).length;
console.log(`${OUT}: ${Object.keys(dishes).length} dishes (FNDDS ${count(FNDDS.db)}, SR ${count(SR.db)}, composed ${count('composed')}), ${Object.keys(sauces).length} sauces`);
for (const m of missing) console.log(`  missing, counted as 0: ${m}`);
