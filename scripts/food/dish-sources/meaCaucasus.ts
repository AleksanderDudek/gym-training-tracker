// USDA sources of the meaCaucasus region (Turkey, the Levant, Iran, Africa, the Caucasus, Central
// Asia): the same ids as `src/food/photo/catalog/meaCaucasus.ts`. FNDDS has almost none of these
// dishes, so most are short recipes in grams as served from FNDDS / SR ingredients.
import { F, I, S, food, recipe, type Source } from './kit';

// Ingredients this region needs beyond the shared ones.
const lamb = S(174383, 'Lamb, shoulder, arm, separable lean and fat, trimmed to 1/8" fat, choice, roasted');
const beefRoast = F(21401000, 'Beef, roast');
const beefSteak = F(21101000, 'Beef, steak, NFS');
const beefSausage = F(25220105, 'Beef sausage');
const chickenSkin = F(24152230, 'Chicken thigh, baked, broiled, or roasted, skin eaten, from raw');
const drumstick = F(24143220, 'Chicken drumstick, stewed, skin not eaten');
const bulgur = F(56207110, 'Bulgur, no added fat');
const couscous = F(56207160, 'Couscous, plain, cooked');
const yellowRice = F(56205170, 'Yellow rice, cooked, fat added');
const fava = S(173753, 'Broadbeans (fava beans), mature seeds, cooked, boiled, without salt');
const kidneyBeans = F(41106010, 'Kidney beans, from dried, fat added');
const cookedSpinach = F(72125211, 'Spinach, fresh, cooked, no added fat');
const cookedOnion = F(75221021, 'Onions, cooked, fat added');
const cookedEggplant = F(75217020, 'Eggplant, cooked, fat added');
const friedEggplant = F(75412010, 'Fried eggplant');
const cookedCauliflower = F(75214020, 'Cauliflower, NS as to form, cooked');
const okra = F(75220011, 'Okra, fresh, cooked, no added fat');
const fufu = F(71970200, 'Fufu');
const injera = F(51807000, 'Injera');
const phyllo = S(172791, 'Phyllo dough');
const puffPastry = F(53452400, 'Pastry, puff');
const cornstarch = S(169698, 'Cornstarch');
const pistachio = S(170184, 'Nuts, pistachio nuts, raw');
const pumpkinSeeds = S(170556, 'Seeds, pumpkin and squash seed kernels, dried');
const palmOil = S(171015, 'Oil, palm');
const peanutButter = F(42202000, 'Peanut butter');
const raisins = F(62125100, 'Raisins');
const lemonJuice = F(61204010, 'Lemon juice, 100%, freshly squeezed');
const pomegranateJuice = F(64126000, 'Pomegranate juice, 100%');
const parsley = F(75119000, 'Parsley, raw');
const spearmint = S(173475, 'Spearmint, fresh');
const blackTea = F(92302000, 'Tea, hot, leaf, black');
const greenTea = F(92303010, 'Tea, hot, leaf, green');
const cookedLentils = S(172421, 'Lentils, mature seeds, cooked, boiled, without salt');

export const DISHES: Record<string, Source> = {
  // --- Turkey ---
  // Sliced döner on pieces of pide bread, tomato sauce, melted butter and yoghurt.
  iskenderKebab: recipe('döner meat on pita pieces with tomato sauce, melted butter, yoghurt', [[beefRoast, 90], [I.lambGround, 50], [I.pita, 80], [I.tomatoSauce, 80], [I.butter, 15], [I.yogurt, 60]]),
  adanaKebab: recipe('minced lamb and beef kebab with flatbread, grilled tomato and onion', [[I.lambGround, 100], [I.beefGround, 80], [I.pita, 50], [I.tomato, 40], [I.onion, 30]]),
  pide: recipe('boat-shaped flatbread with minced beef and cheese', [[I.pita, 150], [I.beefGround, 60], [I.mozzarella, 40], [I.tomato, 20], [I.butter, 5]]),
  // Dumplings with spiced mince under garlic yoghurt and paprika butter.
  manti: recipe('small meat dumplings with garlic yoghurt and paprika butter', [[I.pasta, 150], [I.beefGround, 60], [I.yogurt, 100], [I.butter, 10], [I.garlic, 3]]),
  gozleme: recipe('griddled flatbread filled with spinach and feta', [[I.tortilla, 100], [cookedSpinach, 80], [I.feta, 50], [I.oil, 8], [I.onion, 10]]),
  simit: recipe('ring of white bread dough coated with sesame seeds and molasses', [[I.baguette, 90], [I.sesame, 12], [I.honey, 3]]),
  // Kadayif (shredded phyllo stands in) around unsalted cheese, baked in butter and soaked in syrup.
  kunefe: recipe('shredded phyllo with melting cheese, butter and sugar syrup; baked', [[phyllo, 50], [I.mozzarella, 70], [I.butter, 25], [I.sugar, 40], [I.water, 20]], { yield: 0.9 }),
  // Lokum is starch gel and sugar, about 10 % water left in it.
  turkishDelight: recipe('sugar and cornstarch gel with a few pistachios', [[I.sugar, 85], [cornstarch, 12], [pistachio, 3], [I.water, 15]]),
  imamBayildi: recipe('eggplant halves braised in olive oil with onion, tomato and garlic', [[cookedEggplant, 150], [cookedOnion, 50], [I.tomato, 50], [I.oliveOil, 20], [I.garlic, 3]]),
  sucukEggs: recipe('beef sausage (sucuk) fried with two fried eggs', [[beefSausage, 80], [I.friedEgg, 110], [I.tomato, 20], [I.oil, 3]]),
  turkishTea: food(blackTea, 'unsweetened; the sweetness scale adds the sugar cubes'),
  turkishCoffee: food(F(92101600, 'Coffee, Turkish'), 'FNDDS Turkish coffee is already sweetened'),
  ayran: recipe('yoghurt thinned with water and a pinch of salt', [[I.yogurt, 50], [I.water, 50]]),
  mintTea: recipe('green tea with fresh mint and plenty of sugar', [[greenTea, 190], [I.sugar, 14], [spearmint, 3]]),
  halva: recipe('tahini and sugar halva with pistachios', [[I.tahini, 50], [I.sugar, 45], [pistachio, 5]]),

  // --- Levant and Egypt ---
  fattoush: recipe('lettuce, tomato, cucumber, radish, fried pita, olive oil, lemon', [[I.lettuce, 80], [I.tomato, 60], [I.cucumber, 50], [I.radish, 15], [I.scallion, 10], [I.pita, 25], [I.oil, 8], [I.oliveOil, 12], [lemonJuice, 5]]),
  kibbeh: recipe('fried bulgur shell filled with spiced lamb and onion', [[I.lambGround, 60], [bulgur, 40], [I.onion, 15], [I.oil, 12]]),
  manakish: recipe('round flatbread baked with olive oil and za\'atar (thyme and sesame)', [[I.pita, 110], [I.oliveOil, 15], [I.sesame, 5]]),
  mansaf: recipe('lamb in a hot yoghurt sauce on rice with almonds', [[lamb, 120], [I.rice, 200], [I.yogurt, 100], [I.almonds, 10], [I.butter, 8]]),
  maqluba: recipe('upside-down rice with chicken, fried eggplant and cauliflower', [[I.rice, 200], [chickenSkin, 100], [friedEggplant, 50], [cookedCauliflower, 40], [I.tomato, 30], [I.oil, 10]]),
  // Strained yoghurt is thicker than Greek yoghurt; a little cream cheese stands in for the extra solids.
  labneh: recipe('thick strained yoghurt with a pool of olive oil', [[I.greekYogurt, 70], [I.creamCheese, 20], [I.oliveOil, 10]]),
  fulMedames: recipe('stewed fava beans with olive oil, lemon, garlic and tomato', [[fava, 220], [I.oliveOil, 12], [lemonJuice, 8], [I.tomato, 20], [I.garlic, 3]]),
  shishTawook: recipe('yoghurt-marinated chicken skewers with garlic sauce and pickles', [[I.chickenBreast, 120], [I.chickenThigh, 50], [I.yogurt, 15], [I.oliveOil, 8], [I.garlic, 3], [I.gherkins, 15]]),
  mixedGrill: recipe('kofta, chicken and lamb skewers with rice, pita and grilled vegetables', [[I.lambGround, 80], [I.chickenThigh, 80], [lamb, 70], [I.rice, 100], [I.pita, 40], [I.tomato, 40], [I.pepper, 30], [I.onion, 20]]),
  muhammara: recipe('roasted red pepper and walnut dip with breadcrumbs and olive oil', [[I.pepper, 50], [I.walnuts, 25], [I.breadcrumbs, 10], [I.oliveOil, 15], [I.tomatoPaste, 5]]),
  sabich: recipe('pita with fried eggplant, boiled egg, hummus, tahini and salad', [[I.pita, 90], [friedEggplant, 70], [I.boiledEgg, 50], [I.hummus, 30], [I.tahini, 10], [I.tomato, 30], [I.cucumber, 30]]),
  // Koshari: rice, lentils, macaroni and chickpeas under tomato sauce and fried onion.
  koshari: recipe('rice, lentils, macaroni, chickpeas, tomato sauce, fried onion', [[I.rice, 100], [cookedLentils, 60], [I.pasta, 80], [I.chickpeas, 40], [I.tomatoSauce, 70], [I.onion, 20], [I.oil, 12]]),

  // --- Iran ---
  cheloKoobideh: recipe('two minced lamb and beef skewers on saffron rice with butter and grilled tomato', [[I.lambGround, 70], [I.beefGround, 70], [I.onion, 20], [I.rice, 250], [I.butter, 12], [I.tomato, 40]]),
  ghormehSabzi: recipe('herb stew with lamb and kidney beans, served on rice', [[lamb, 60], [kidneyBeans, 50], [cookedSpinach, 70], [cookedOnion, 30], [I.oil, 10], [I.broth, 80], [I.rice, 180]]),
  fesenjan: recipe('chicken in walnut and pomegranate sauce with rice', [[I.chickenThigh, 120], [I.walnuts, 40], [pomegranateJuice, 60], [cookedOnion, 30], [I.oil, 5], [I.rice, 180]]),
  tahdig: recipe('crisp golden rice crust fried in oil with yoghurt and egg yolk', [[I.rice, 120], [I.oil, 12], [I.yogurt, 15], [I.yolk, 5]]),
  ashReshteh: recipe('noodle soup with beans, lentils, spinach and herbs, topped with kashk and fried onion', [[I.broth, 150], [I.noodles, 60], [I.whiteBeans, 40], [I.chickpeas, 20], [cookedLentils, 20], [cookedSpinach, 50], [I.yogurt, 15], [I.oil, 6], [I.onion, 20]]),

  // --- North Africa ---
  chickenTagine: recipe('chicken stewed with onion, potato, carrot, olives and preserved lemon', [[chickenSkin, 150], [cookedOnion, 50], [I.olives, 15], [lemonJuice, 5], [I.cookedCarrot, 40], [I.potato, 60], [I.oliveOil, 12], [I.broth, 60]]),
  couscousRoyal: recipe('couscous with lamb, chicken, merguez, chickpeas and vegetable broth', [[couscous, 200], [lamb, 70], [chickenSkin, 70], [beefSausage, 50], [I.chickpeas, 40], [I.cookedCarrot, 40], [I.zucchini, 40], [I.broth, 60]]),
  harira: recipe('tomato soup with lentils, chickpeas, a little lamb and thin pasta', [[I.tinnedTomatoes, 80], [cookedLentils, 40], [I.chickpeas, 30], [I.broth, 200], [lamb, 20], [I.pasta, 20], [I.onion, 15], [I.oil, 4], [I.flour, 5]]),
  // Brik: fried phyllo triangle around a soft egg and tuna.
  brik: recipe('phyllo pocket with a whole egg and tuna, deep-fried', [[phyllo, 35], [I.egg, 50], [I.tinnedTuna, 30], [parsley, 10], [I.oil, 20]], { yield: 0.9 }),
  merguez: recipe('spicy lamb and beef sausages, grilled', [[I.lambGround, 60], [beefSausage, 40]]),
  pastilla: recipe('layered phyllo pie with spiced chicken, egg and almonds, dusted with cinnamon sugar; baked', [[phyllo, 70], [I.chickenThigh, 80], [I.boiledEgg, 30], [I.almonds, 20], [I.butter, 15], [I.powderedSugar, 10], [cookedOnion, 20]], { yield: 0.9 }),

  // --- Sub-Saharan Africa ---
  jollofRice: recipe('rice cooked in a tomato, pepper and onion sauce with oil', [[I.rice, 230], [I.tinnedTomatoes, 60], [cookedOnion, 30], [I.oil, 15], [I.pepper, 20]]),
  // Egusi: ground melon seeds (pumpkin seeds stand in), leaves, palm oil and meat.
  egusiFufu: recipe('egusi soup with beef and greens, with a ball of fufu', [[fufu, 200], [pumpkinSeeds, 30], [cookedSpinach, 60], [I.beefStew, 50], [palmOil, 18], [I.tomato, 20], [I.broth, 60]]),
  suya: recipe('grilled beef skewers in a peanut-spice rub with onion and tomato', [[beefSteak, 110], [I.peanuts, 14], [I.oil, 8], [I.onion, 25], [I.tomato, 20]]),
  injeraDoroWat: recipe('injera with a spicy chicken stew, a boiled egg and onion', [[injera, 150], [drumstick, 120], [I.boiledEgg, 50], [cookedOnion, 80], [I.butter, 15], [I.tomatoPaste, 5], [I.broth, 40]]),
  bobotie: recipe('spiced minced beef baked under an egg custard, with yellow rice', [[I.beefGround, 130], [I.milk, 50], [I.egg, 40], [I.bread, 20], [cookedOnion, 30], [raisins, 12], [yellowRice, 120]]),
  bunnyChow: recipe('a quarter loaf of white bread hollowed and filled with chicken curry', [[I.bread, 150], [F(27146150, 'Chicken curry'), 250]]),
  chakalaka: recipe('spicy relish of baked beans, peppers, carrot, tomato and onion', [[I.bakedBeans, 80], [I.pepper, 40], [I.cookedCarrot, 30], [I.tinnedTomatoes, 40], [cookedOnion, 30], [I.oil, 6]]),
  mandazi: recipe('fried coconut-milk dough triangles with cardamom', [[I.flour, 100], [I.sugar, 15], [I.coconutMilk, 40], [I.egg, 15], [I.oil, 18]], { yield: 0.85 }),
  maafe: recipe('peanut stew with chicken, tomato, carrot and onion on rice', [[I.chickenThigh, 100], [peanutButter, 35], [I.tomatoPaste, 15], [cookedOnion, 40], [I.cookedCarrot, 30], [I.broth, 100], [I.rice, 150], [I.oil, 5]]),
  // Biltong: air-dried lean beef; about a third of the raw weight is left.
  // Biltong is cut from silverside or eye of round, leaner than tenderloin: about 55 g protein and
  // under 10 g fat per 100 g once dried.
  biltong: recipe('lean raw beef (eye of round) dried to about 38 % of its weight', [[S(174049, 'Beef, round, eye of round, roast, separable lean only'), 100]], { yield: 0.38 }),
  okraStew: recipe('okra stewed with tomato, onion and palm oil', [[okra, 150], [I.tinnedTomatoes, 60], [cookedOnion, 40], [palmOil, 10]]),

  // --- Caucasus ---
  khachapuriAdjaruli: recipe('boat of cheese bread filled with melted cheese, a raw yolk and butter', [[I.bread, 160], [I.mozzarella, 120], [I.feta, 40], [I.yolk, 20], [I.butter, 15]]),
  khinkali: recipe('large pleated dumplings of spiced beef and pork with broth inside', [[I.pasta, 130], [I.beefGround, 55], [I.porkGround, 45], [I.broth, 20]]),
  shashlik: recipe('marinated pork and lamb skewers with raw onion', [[I.porkShoulder, 130], [lamb, 50], [I.onion, 40], [I.oil, 5]]),
  lobio: recipe('stewed kidney beans with walnuts, onion, garlic and herbs', [[kidneyBeans, 180], [I.walnuts, 15], [cookedOnion, 30], [I.oil, 8], [I.garlic, 3]]),

  // --- Central Asia ---
  plov: recipe('rice cooked with lamb, carrot, onion and plenty of oil, with chickpeas and raisins', [[I.rice, 220], [lamb, 70], [I.cookedCarrot, 50], [cookedOnion, 30], [I.oil, 18], [I.chickpeas, 20], [raisins, 10]]),
  lagman: recipe('hand-pulled noodles in a lamb and vegetable broth', [[I.pasta, 150], [lamb, 50], [I.pepper, 25], [I.tomato, 30], [I.onion, 25], [I.potato, 40], [I.broth, 150], [I.oil, 8]]),
  samsa: recipe('baked puff pastry triangle with minced lamb and onion', [[puffPastry, 85], [I.lambGround, 55], [I.onion, 35]]),
  chebureki: recipe('fried half-moon of thin dough with minced beef and onion', [[I.tortilla, 100], [I.beefGround, 70], [I.onion, 20], [I.oil, 15]]),
};
