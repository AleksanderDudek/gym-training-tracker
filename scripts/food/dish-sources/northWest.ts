import { F, I, S, food, recipe, type Source } from './kit';

// Britain and Ireland, German-speaking countries, the Nordics, Benelux, the Balkans.

// Ingredients used only here.
const R = {
  beefRoast: F(21401000, 'Beef, roast'),
  potRoast: S(168667, 'Beef, chuck, arm pot roast, separable lean and fat, trimmed to 1/8" fat, all grades, cooked, braised'),
  topRound: S(168709, 'Beef, round, top round, separable lean and fat, trimmed to 1/8" fat, choice, cooked, braised'),
  lamb: S(172509, 'Lamb, cubed for stew or kabob (leg and shoulder), separable lean only, trimmed to 1/4" fat, cooked, braised'),
  hamHock: F(22708010, 'Pork, ham hocks'),
  veal: F(23201010, 'Veal, chop'),
  chickenLeg: F(24132230, 'Chicken leg, drumstick and thigh, baked or broiled, skin eaten'),
  cod: F(26109120, 'Fish, cod, baked or broiled'),
  smokedFish: F(26100190, 'Fish, smoked'),
  anchovy: F(26101110, 'Fish, anchovy'),
  bratwurst: F(25220350, 'Bratwurst'),
  bologna: F(25220410, 'Bologna'),
  hotDog: F(25210280, 'Hot dog, meat and poultry'),
  puff: F(53452400, 'Pastry, puff'),
  // A shortcrust stands in as the baked refrigerated pie crust.
  crust: S(167930, 'Pie crust, refrigerated, regular, baked'),
  popover: F(52311010, 'Popover'),
  bakedPotato: F(71508001, 'Potato, baked, peel eaten'),
  hashBrown: F(71405010, 'Potato, hash brown, from fresh'),
  cheddar: F(14104100, 'Cheese, Cheddar'),
  gruyere: F(14105200, 'Cheese, Gruyere'),
  raisins: F(62125100, 'Raisins'),
  dates: S(168191, 'Dates, medjool'),
  custard: F(13210300, 'Custard'),
  sponge: F(53118100, 'Cake, sponge'),
  meringue: F(32401000, 'Meringues'),
  muffin: S(173238, 'English muffins, plain, unenriched, without calcium propionate'),
  kale: F(72119211, 'Kale, fresh, cooked, no added fat'),
  redCabbage: F(75212020, 'Cabbage, red, cooked'),
  rutabaga: F(75228020, 'Rutabaga, cooked'),
  leek: F(75218400, 'Leeks'),
  spinach: F(72125211, 'Spinach, fresh, cooked, no added fat'),
  cranberry: F(63207110, 'Cranberry sauce'),
  // Branston-style sweet relish for the cheese plate.
  relish: S(168561, 'Pickle relish, sweet'),
  mustard: F(75506010, 'Mustard'),
  pancake: F(55100005, 'Pancakes, NFS'),
  caneSyrup: S(167743, 'Syrup, Cane'),
};

/** Shared sub-recipes, used by id in the dishes below. */
export const PARTS: Record<string, Source> = {
  // Haggis: sheep's offal, suet, oatmeal and onion; lamb mince and butter stand in for offal and suet.
  haggis: recipe('lamb mince, oatmeal, onion, butter for the suet, a little stock', [[I.lambGround, 40], [I.oats, 25], [I.onion, 15], [I.butter, 10], [I.broth, 20]]),
};

export const DISHES: Record<string, Source> = {
  // --- British and Irish ---
  sundayRoast: recipe('roast beef, roast potatoes, Yorkshire pudding, carrots, broccoli, gravy', [[R.beefRoast, 100], [I.roastPotatoes, 150], [R.popover, 45], [I.cookedCarrot, 50], [I.broccoli, 50], [I.gravy, 70]]),
  roastChickenDinner: recipe('roast chicken leg with skin, roast potatoes, carrots, peas, gravy', [[R.chickenLeg, 140], [I.roastPotatoes, 150], [I.cookedCarrot, 50], [I.peas, 50], [I.gravy, 70]]),
  steakKidneyPie: recipe('puff pastry lid with stewed beef in gravy, onion and mushrooms (no kidney in FNDDS; beef stands in)', [[R.puff, 60], [I.beefStew, 90], [I.gravy, 60], [I.onion, 15], [I.mushrooms, 15]]),
  cornishPasty: recipe('shortcrust pastry with beef, potato, swede and onion; baked', [[R.crust, 65], [I.beefStew, 55], [I.potato, 45], [R.rutabaga, 20], [I.onion, 15]]),
  sausageRoll: recipe('puff pastry around pork sausage meat', [[R.puff, 40], [I.porkSausage, 60]]),
  scotchEgg: recipe('boiled egg in sausage meat and breadcrumbs, deep-fried', [[I.boiledEgg, 55], [I.porkSausage, 55], [I.breadcrumbs, 12], [I.oil, 9]]),
  ploughmans: recipe('crusty bread, butter, cheddar, ham, relish, apple, salad', [[I.baguette, 70], [I.butter, 8], [R.cheddar, 45], [I.ham, 40], [R.relish, 25], [I.apple, 45], [I.lettuce, 10], [I.tomato, 30], [I.gherkins, 15]]),
  jacketPotatoBeansCheese: recipe('baked potato with baked beans, grated cheddar and butter', [[R.bakedPotato, 250], [I.bakedBeans, 120], [R.cheddar, 35], [I.butter, 8]]),
  toadInTheHole: recipe('pork sausages baked in Yorkshire pudding batter, onion gravy', [[I.porkSausage, 120], [R.popover, 140], [I.gravy, 100], [I.onion, 20]]),
  stickyToffeePudding: recipe('date sponge with butter, sugar and cream toffee sauce', [[R.sponge, 70], [R.dates, 25], [I.butter, 12], [I.sugar, 20], [I.cream36, 25]]),
  victoriaSponge: recipe('two sponges with jam and buttercream, dusted with sugar', [[R.sponge, 90], [I.butter, 20], [I.powderedSugar, 25], [I.jam, 25]]),
  etonMess: recipe('crushed meringue, whipped cream and strawberries', [[R.meringue, 25], [I.cream36, 50], [I.cream30, 10], [I.strawberries, 100]]),
  trifle: food(F(13252590, 'Trifle'), 'sponge, jelly, fruit, custard and cream'),
  crumpets: recipe('two crumpets (English muffin stands in) with butter', [[R.muffin, 110], [I.butter, 12]]),
  kedgeree: recipe('rice with smoked haddock, boiled egg, peas, butter and cream', [[I.rice, 150], [R.smokedFish, 70], [I.boiledEgg, 50], [I.peas, 20], [I.butter, 8], [I.cream30, 15], [I.onion, 15]]),
  haggisNeepsTatties: recipe('haggis, mashed swede, mashed potato', [['haggis', 120], [R.rutabaga, 100], [I.mashed, 150]]),
  irishStew: recipe('lamb, potatoes, carrot, onion in thin broth', [[R.lamb, 70], [I.lambGround, 20], [I.potato, 130], [I.cookedCarrot, 40], [I.onion, 25], [I.broth, 100]]),
  welshRarebit: recipe('cheese sauce on buttered toast', [[I.toast, 70], [F(14630300, 'Welsh rarebit'), 90]]),
  fishPie: recipe('white fish, egg and peas in white sauce under mashed potato with cheddar', [[R.cod, 90], [I.whiteSauce, 90], [I.boiledEgg, 20], [I.peas, 20], [I.mashed, 170], [R.cheddar, 10]]),
  beefWellington: food(F(27214300, 'Beef wellington'), 'fillet with pate in pastry'),
  mincePies: recipe('two small shortcrust pies of mincemeat (raisins, sugar, apple, butter)', [[R.crust, 60], [R.raisins, 40], [I.sugar, 15], [I.apple, 15], [I.butter, 8]]),
  appleCrumbleCustard: recipe('apple crumble with custard', [[F(53415100, 'Crisp, apple'), 170], [R.custard, 80]]),

  // --- German-speaking countries ---
  currywurst: recipe('sliced bratwurst in curry ketchup with a bread roll', [[R.bratwurst, 150], [I.ketchup, 55], [I.curry, 10], [I.roll, 50]]),
  bratwurstSauerkraut: recipe('grilled bratwurst with sauerkraut, mustard and a roll', [[R.bratwurst, 150], [I.sauerkraut, 120], [R.mustard, 8], [I.roll, 55]]),
  // Hock skin and meat; the bone is not counted in the portion.
  schweinshaxe: recipe('roast pork knuckle with sauerkraut, boiled potatoes, gravy', [[R.hamHock, 220], [I.sauerkraut, 100], [I.potato, 120], [I.gravy, 40]]),
  sauerbraten: recipe('marinated pot roast in sweet-sour gravy with raisins, red cabbage, potato dumpling', [[R.potRoast, 120], [I.gravy, 70], [R.raisins, 5], [I.sugar, 3], [R.redCabbage, 90], [I.potato, 100], [I.potatoStarch, 15]]),
  rinderrouladen: recipe('braised beef roll with bacon, onion and gherkin, gravy, red cabbage, potatoes', [[R.topRound, 110], [I.bacon, 15], [I.onion, 15], [I.gherkins, 15], [R.mustard, 5], [I.gravy, 80], [R.redCabbage, 80], [I.potato, 120]]),
  kasespatzle: recipe('egg noodles with melted cheese and fried onion', [[I.noodles, 200], [R.gruyere, 55], [I.onion, 30], [I.oil, 6], [I.butter, 8]]),
  jagerschnitzel: recipe('breaded pork cutlet in mushroom cream sauce with spaetzle', [[I.porkLoin, 90], [I.breadcrumbs, 13], [I.egg, 10], [I.flour, 4], [I.oil, 11], [I.mushrooms, 70], [I.cream30, 20], [I.gravy, 40], [I.noodles, 110]]),
  maultaschen: recipe('pasta pockets with pork, spinach and breadcrumb filling in broth', [[I.noodles, 100], [I.porkGround, 35], [R.spinach, 25], [I.breadcrumbs, 8], [I.egg, 8], [I.onion, 8], [I.broth, 160]]),
  flammkuchen: recipe('thin dough with sour cream, bacon and onion, baked', [[I.pita, 90], [I.sourCream, 70], [I.bacon, 25], [I.onion, 40]]),
  pretzel: food(F(54408415, 'Pretzels, soft, ready-to-eat, salted, no butter'), 'a Bavarian lye pretzel is the same soft salted dough'),
  leberkase: recipe('Leberkaese slice (bologna stands in) in a roll with sweet mustard', [[R.bologna, 110], [I.roll, 50], [R.mustard, 8]]),
  kaiserschmarrn: recipe('torn pancake with raisins, butter, powdered sugar and plum compote', [[R.pancake, 160], [I.butter, 8], [R.raisins, 12], [I.powderedSugar, 12], [I.plum, 30], [I.sugar, 5]]),
  apfelstrudel: food(F(53440000, 'Strudel, apple')),
  sachertorte: recipe('chocolate cake with apricot jam, with whipped cream', [[F(53105270, 'Cake or cupcake, chocolate with chocolate icing, bakery'), 110], [I.jam, 10], [I.whippedCream, 30]]),
  blackForestCake: food(F(53102800, 'Cake or cupcake, Black Forest')),
  germknodel: recipe('steamed yeast dumpling (white bread stands in) with plum jam, melted butter, poppy seeds and sugar', [[I.bread, 90], [I.jam, 40], [I.butter, 10], [I.poppy, 8], [I.powderedSugar, 10]]),
  cheeseFondue: recipe('melted cheese fondue with bread cubes', [[F(14630100, 'Cheese fondue'), 140], [I.baguette, 70]]),
  raclette: recipe('boiled potatoes with melted raclette cheese, gherkins and ham', [[I.potato, 200], [R.gruyere, 80], [I.gherkins, 30], [I.ham, 30]]),
  rosti: food(R.hashBrown, 'grated potato fried in butter'),
  zurichGeschnetzeltes: recipe('sliced veal in cream and mushroom sauce with rösti', [[R.veal, 110], [I.cream36, 45], [I.mushrooms, 50], [I.onion, 15], [I.butter, 8], [R.hashBrown, 150]]),
  bircherMuesli: recipe('oats soaked in yoghurt and milk with grated apple, honey and walnuts', [[I.oats, 35], [I.yogurt, 100], [I.milk, 50], [I.apple, 60], [I.honey, 8], [I.walnuts, 8]]),

  // --- Nordic ---
  swedishMeatballs: recipe('meatballs in cream gravy with mashed potatoes, lingonberry (cranberry) sauce and cucumber slices', [[F(27113300, 'Swedish meatballs with cream or white sauce'), 150], [I.mashed, 150], [R.cranberry, 25], [I.gherkins, 15]]),
  gravlax: recipe('cured raw salmon (sugar, salt, dill) with mustard sauce, rye bread and cucumber', [[I.rawSalmon, 80], [I.sugar, 2], [I.mayo, 8], [R.mustard, 4], [I.ryeBread, 40], [I.cucumber, 15]]),
  smorrebrod: recipe('two open rye sandwiches with butter, prawns, egg, mayonnaise and salad', [[I.ryeBread, 70], [I.butter, 10], [I.shrimp, 40], [I.boiledEgg, 40], [I.mayo, 15], [I.lettuce, 10], [I.cucumber, 15]]),
  lohikeitto: recipe('salmon soup with potatoes, carrot, leek and cream', [[I.broth, 200], [I.cream30, 35], [I.potato, 70], [I.salmon, 60], [I.cookedCarrot, 25], [R.leek, 25], [I.butter, 3]]),
  janssonsFrestelse: recipe('potatoes baked with onion, anchovies and cream under breadcrumbs', [[I.potato, 200], [I.onion, 40], [R.anchovy, 25], [I.cream36, 80], [I.breadcrumbs, 8], [I.butter, 8]]),

  // --- Benelux ---
  stoofvlees: recipe('beef stewed in beer and onion gravy with mustard bread, and chips', [[I.beefStew, 130], [I.onion, 50], [I.gravy, 70], [I.bread, 10], [R.mustard, 3], [I.fries, 150]]),
  stroopwafel: recipe('two thin waffles with caramel syrup; baked', [[I.flour, 28], [I.butter, 14], [I.sugar, 8], [R.caneSyrup, 14], [I.egg, 2]], { yield: 0.9 }),
  bitterballen: recipe('beef ragout in a crumb coat, deep-fried', [[I.whiteSauce, 60], [I.beefStew, 25], [I.breadcrumbs, 12], [I.egg, 5], [I.oil, 10]]),
  stamppot: recipe('mashed potato with kale, smoked sausage and gravy', [[I.mashed, 180], [R.kale, 120], [I.kielbasa, 80], [I.gravy, 40]]),
  poffertjes: recipe('mini pancakes with butter and powdered sugar', [[R.pancake, 100], [I.butter, 10], [I.powderedSugar, 12]]),
  frikandel: recipe('deep-fried minced meat sausage with mayonnaise, ketchup and onion', [[R.hotDog, 90], [I.oil, 5], [I.mayo, 15], [I.ketchup, 10], [I.onion, 10]]),
  kibbeling: recipe('battered fried cod pieces with tartare sauce', [[I.friedCod, 160], [I.tartar, 30]]),

  // --- Balkans ---
  cevapi: recipe('grilled minced beef and pork fingers in flatbread with raw onion and kajmak (cream cheese stands in)', [[I.beefGround, 70], [I.porkGround, 30], [I.pita, 110], [I.onion, 30], [I.creamCheese, 15]]),
  pljeskavica: recipe('large grilled beef and pork patty in flatbread with onion, tomato and ajvar', [[I.beefGround, 90], [I.porkGround, 50], [I.pita, 100], [I.onion, 30], [I.tomato, 20], [I.pepper, 10], [I.tomatoPaste, 5]]),
  burek: food(F(58124230, 'Pastry, meat / poultry-filled'), 'filo pie with minced meat; FNDDS pastry with meat filling'),
  shopskaSalad: recipe('tomato, cucumber, pepper and onion with grated sirene (feta) and oil', [[I.tomato, 150], [I.cucumber, 100], [I.pepper, 40], [I.onion, 20], [I.feta, 50], [I.oil, 8]]),
  banitsa: food(F(58124220, 'Pastry, egg and cheese filled'), 'filo layered with eggs and sirene'),
};
