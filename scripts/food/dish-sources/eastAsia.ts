// East Asia (China, Japan, Korea, Taiwan): the USDA sources of this region's dishes in the photo
// catalog (src/food/photo/catalog/eastAsia.ts), under the same ids. Rules as in fetch-dishes.ts:
// values per 100 g as served, cooked weights, `yield` only for doughs and batters.
import { F, I, S, food, recipe, type Source } from './kit';

// Ingredients used by more than one dish here.
const sirloin = F(21102150, 'Beef, steak, sirloin, NS as to fat eaten');
const chuck = F(21101140, 'Beef, steak, chuck');
const shortRibs = F(21304200, 'Beef, shortribs');
const porkBelly = S(167812, 'Pork, fresh, belly, raw');
const friedThigh = F(24157300, 'Chicken thigh, fried, coated, skin / coating eaten, from raw');
const cellophane = F(56116990, 'Long rice noodles, made from mung beans, cooked');
const soba = S(168907, 'Noodles, japanese, soba, cooked');
const bokChoy = S(170391, 'Cabbage, chinese (pak-choi), cooked, boiled, drained, without salt');
const napa = S(168572, 'Cabbage, napa, cooked');
const shiitake = S(168437, 'Mushrooms, shiitake, cooked, without salt');
const spinach = F(72125211, 'Spinach, fresh, cooked, no added fat');
const cornstarch = S(169698, 'Cornstarch');
const redBeanPaste = F(91407150, 'Bean paste, sweetened');
const sprouts = F(75207021, 'Bean sprouts, cooked');
const cookedOnion = F(75221011, 'Onions, cooked, no added fat');
const greenPepper = F(75226020, 'Peppers, green, cooked');
const kimchi = F(75502520, 'Kimchi');
const vinegar = F(64401000, 'Vinegar');
const oyster = F(28520100, 'Oyster sauce');
const silkenTofu = S(172461, 'MORI-NU, Tofu, silken, firm');
const condensed = S(171275, 'Milk, canned, condensed, sweetened');
const sticky = S(168883, 'Rice, white, glutinous, unenriched, uncooked');
const rawSquid = S(174223, 'Mollusks, squid, mixed species, raw');
const rawYellowtail = S(175163, 'Fish, yellowtail, mixed species, raw');
const roe = S(175132, 'Fish, roe, mixed species, raw');

export const DISHES: Record<string, Source> = {
  // --- China ---
  xiaolongbao: recipe('soup dumplings: thin wheat wrapper, pork filling with aspic broth, sesame oil', [[I.flour, 25], [I.water, 14], [I.porkGround, 45], [I.broth, 15], [I.sesameOil, 2], [I.soy, 2]]),
  charSiu: recipe('barbecued pork shoulder glazed with honey, sugar, hoisin and soy', [[I.porkShoulder, 85], [I.sugar, 7], [I.honey, 5], [I.hoisin, 5], [I.soy, 3]]),
  danDanNoodles: recipe('wheat noodles, spiced pork mince, sesame paste, chilli oil, soy, peanuts, bok choy, a little broth', [[I.noodles, 150], [I.porkGround, 40], [I.tahini, 12], [I.oil, 8], [I.soy, 8], [I.broth, 40], [I.peanuts, 8], [I.scallion, 4], [bokChoy, 20]]),
  zhajiangmian: recipe('wheat noodles with fried pork and fermented bean sauce (hoisin stands in), cucumber and bean sprouts', [[I.noodles, 200], [I.porkGround, 60], [I.hoisin, 20], [I.oil, 8], [I.cucumber, 30], [sprouts, 20], [I.soy, 5]]),
  beefChowFun: recipe('FNDDS chow fun noodles with extra sliced beef and wok oil', [[F(58135110, 'Chow fun noodles with meat and vegetables'), 200], [sirloin, 40], [I.oil, 6]]),
  eggDropSoup: food(F(32300100, 'Soup, egg drop')),
  hotPot: recipe('broth with sliced beef, tofu, napa cabbage, shiitake, glass noodles, sesame dip', [[I.broth, 280], [sirloin, 70], [I.tofu, 50], [napa, 70], [shiitake, 30], [cellophane, 60], [I.tahini, 10], [I.soy, 10]]),
  sesameChicken: food(F(27146360, 'Sesame chicken')),
  cashewChicken: recipe('stir-fried chicken breast with cashews, pepper, onion, soy-hoisin sauce', [[I.chickenBreast, 120], [F(42104100, 'Cashews, salted'), 25], [greenPepper, 30], [cookedOnion, 20], [I.oil, 8], [I.soy, 8], [I.hoisin, 8], [cornstarch, 3]]),
  mongolianBeef: recipe('sliced beef with scallion in a sweet soy sauce', [[sirloin, 130], [I.scallion, 25], [I.oil, 10], [I.sugar, 8], [I.soy, 10], [cornstarch, 4], [I.hoisin, 5]]),
  // Pork belly is simmered and then fried: the raw belly stands in (it renders part of its fat in the pan).
  twiceCookedPork: recipe('pork belly slices stir-fried with green pepper, onion and chilli bean sauce', [[porkBelly, 70], [greenPepper, 40], [cookedOnion, 20], [I.oil, 6], [I.hotSauce, 8], [I.soy, 5], [I.hoisin, 5]]),
  // Siu yuk: roast belly with crackling; the raw belly is the nearest SR food (roasting loses water and some fat, so a little low).
  crispyPorkBelly: recipe('roast pork belly with crackling', [[porkBelly, 100]]),
  saltPepperSquid: recipe('fried squid with chilli, scallion and salt', [[S(171982, 'Mollusks, squid, mixed species, cooked, fried'), 150], [I.oil, 8], [I.scallion, 8], [F(75226111, 'Peppers, hot, cooked'), 5]]),
  steamedFishGingerScallion: recipe('steamed fish with hot oil, soy and scallion (the ginger is a few grams, left out)', [[F(26107160, 'Fish, catfish, steamed'), 150], [I.scallion, 12], [I.oil, 8], [I.soy, 12]]),
  scallionPancake: recipe('layered flour dough with scallion, pan-fried in oil', [[I.flour, 60], [I.water, 40], [I.oil, 14], [I.scallion, 12]], { yield: 0.85 }),
  jianbing: recipe('wheat-mung crepe with egg, hoisin, scallion and a crisp wonton cracker', [[I.crepe, 80], [I.friedEgg, 50], [I.wontonCrisps, 20], [I.hoisin, 10], [I.scallion, 5]]),
  baozi: recipe('steamed wheat bun filled with pork and cabbage', [[I.flour, 50], [I.water, 28], [I.porkGround, 40], [napa, 15], [I.soy, 2], [I.sesameOil, 2]]),
  eggTart: recipe('baked pastry shell with egg custard', [[S(167930, 'Pie crust, refrigerated, regular, baked'), 40], [S(169595, 'Desserts, egg custard, baked, prepared-from-recipe'), 60]]),
  // FNDDS has the exact food: bean paste and salted egg yolk in a baked pastry.
  mooncake: food(F(53452130, 'Pastry, made with bean paste and salted egg yolk filling, baked')),
  stirFriedBokChoy: recipe('bok choy stir-fried with garlic', [[bokChoy, 150], [I.oil, 8], [I.garlic, 4], [I.soy, 3]]),
  eggFooYoung: recipe('Chinese omelette with chicken and vegetables, brown gravy on top', [[F(32105210, 'Chicken egg foo yung'), 150], [I.gravy, 40]]),
  sweetSourPork: food(F(27120060, 'Sweet and sour pork')),
  chineseBroccoliOyster: recipe('blanched Chinese broccoli (broccoli stands in) with oyster sauce, garlic and oil', [[I.broccoli, 150], [oyster, 12], [I.oil, 6], [I.garlic, 3]]),
  friedTofu: recipe('deep-fried tofu with soy sauce and scallion', [[S(172451, 'Tofu, fried'), 120], [I.soy, 8], [I.scallion, 5]]),

  // --- Japan ---
  soba: recipe('cold buckwheat noodles with dipping broth (tsuyu), nori and scallion', [[soba, 200], [I.broth, 70], [I.soy, 20], [I.sugar, 6], [I.nori, 1], [I.scallion, 5]]),
  yakisoba: recipe('fried wheat noodles with pork, cabbage, carrot and sauce', [[I.noodles, 200], [I.cookedCabbage, 60], [I.porkLoin, 30], [I.cookedCarrot, 15], [cookedOnion, 20], [I.oil, 10], [I.steakSauce, 20]]),
  // Raw batter weights: the pancake loses a little water on the griddle.
  okonomiyaki: recipe('cabbage pancake with bacon, topped with mayonnaise and sauce', [[I.flour, 50], [I.water, 60], [I.egg, 50], [I.cabbage, 120], [I.bacon, 25], [I.oil, 8], [I.mayo, 12], [I.steakSauce, 20]], { yield: 0.85 }),
  // Boneless thigh in a starch coating; the FNDDS fried-coated thigh is the same kind of food.
  karaage: food(friedThigh, 'boneless chicken in a thin starch coating, deep-fried'),
  yakitori: recipe('grilled chicken thigh and scallion skewers with teriyaki glaze', [[I.chickenThigh, 100], [I.teriyaki, 20], [I.scallion, 10], [I.oil, 3]]),
  oyakodon: recipe('rice topped with chicken and soft egg simmered in dashi and soy', [[I.rice, 250], [I.chickenThigh, 80], [I.scrambled, 60], [cookedOnion, 40], [I.broth, 60], [I.soy, 10], [I.sugar, 5]]),
  katsudon: recipe('rice topped with a breaded pork cutlet and egg simmered in dashi', [[I.rice, 250], ['kotletSchabowy', 120], [I.scrambled, 55], [cookedOnion, 40], [I.broth, 50], [I.soy, 10], [I.sugar, 5]]),
  gyudon: recipe('rice topped with beef and onion simmered in sweet soy', [[I.rice, 250], [chuck, 100], [cookedOnion, 80], [I.broth, 60], [I.soy, 12], [I.sugar, 8]]),
  chirashi: recipe('vinegared rice with raw salmon, tuna, yellowtail, shrimp, egg, cucumber and roe', [[I.rice, 250], [I.sugar, 6], [vinegar, 5], [I.rawSalmon, 50], [I.rawTuna, 50], [rawYellowtail, 30], [I.shrimp, 20], [I.scrambled, 25], [I.cucumber, 20], [roe, 10], [I.nori, 1], [I.soy, 8]]),
  temaki: recipe('hand-rolled nori cones with rice, raw salmon, avocado and cucumber', [[I.rice, 100], [I.nori, 2], [I.rawSalmon, 40], [I.avocado, 20], [I.cucumber, 20], [I.soy, 4]]),
  unadon: recipe('rice topped with grilled eel in sweet soy glaze', [[I.rice, 250], [F(26113110, 'Fish, eel'), 120], [I.teriyaki, 25], [I.sesame, 1]]),
  // Egg to dashi about 1:2; the steamed custard sets with little else in it.
  chawanmushi: recipe('steamed egg custard in dashi with shrimp, chicken and shiitake', [[I.egg, 70], [I.broth, 150], [I.soy, 3], [I.shrimp, 10], [I.chickenBreast, 10], [shiitake, 8]]),
  sukiyaki: recipe('beef, tofu, napa cabbage, shiitake and glass noodles simmered in sweet soy broth, with raw egg to dip', [[sirloin, 100], [I.tofu, 60], [napa, 70], [shiitake, 30], [cookedOnion, 30], [cellophane, 60], [I.broth, 150], [I.soy, 20], [I.sugar, 10], [I.egg, 50]]),
  shabuShabu: recipe('thin beef slices swished in broth with napa cabbage, tofu, shiitake, carrot and glass noodles, sesame dip', [[sirloin, 90], [napa, 90], [I.tofu, 50], [shiitake, 30], [cellophane, 60], [I.cookedCarrot, 20], [I.broth, 250], [I.tahini, 12], [I.soy, 10]]),
  // Daifuku: glutinous rice paste with sweet red bean filling. Raw glutinous rice and water stand for the pounded rice.
  mochi: recipe('pounded glutinous rice with sweet red bean filling', [[sticky, 40], [I.water, 20], [I.sugar, 8], [cornstarch, 3], [redBeanPaste, 30]]),
  dorayaki: recipe('two small pancakes with sweet red bean paste', [[F(55101000, 'Pancakes, plain'), 80], [redBeanPaste, 50]]),
  // Matcha powder is not in USDA; 2 g of it is about 6 kcal, so brewed green tea stands in.
  matchaLatte: recipe('milk with matcha and sugar', [[I.milk, 230], [S(171917, 'Beverages, tea, green, brewed, regular'), 40], [I.sugar, 12]]),
  bentoBox: recipe('rice with karaage, rolled omelette, broccoli and carrot', [[I.rice, 150], [friedThigh, 70], [I.scrambled, 40], [I.broccoli, 40], [I.cookedCarrot, 20], [I.nori, 1]]),
  nikujaga: recipe('beef and potato stew in sweet soy with onion and carrot', [[I.potato, 150], [chuck, 60], [cookedOnion, 50], [I.cookedCarrot, 30], [I.broth, 100], [I.soy, 12], [I.sugar, 8]]),
  tamagoyaki: recipe('rolled sweet omelette cooked in a square pan', [[I.egg, 110], [I.sugar, 5], [I.oil, 5], [I.broth, 15], [I.soy, 2]]),

  // --- Korea ---
  japchae: recipe('sweet potato glass noodles stir-fried with beef, spinach, carrot, onion and shiitake in sesame oil and soy', [[cellophane, 180], [sirloin, 25], [spinach, 30], [I.cookedCarrot, 20], [cookedOnion, 20], [shiitake, 15], [I.sesameOil, 6], [I.soy, 12], [I.sugar, 6], [I.oil, 5], [I.sesame, 2]]),
  kimchiJjigae: recipe('kimchi stew with pork, tofu and onion', [[kimchi, 120], [I.porkShoulder, 40], [I.tofu, 60], [I.broth, 250], [I.oil, 6], [cookedOnion, 20], [I.scallion, 5]]),
  sundubuJjigae: recipe('soft tofu stew with shrimp, pork, egg and kimchi in chilli broth', [[silkenTofu, 150], [I.broth, 150], [I.shrimp, 30], [I.porkGround, 20], [I.egg, 50], [kimchi, 30], [I.oil, 8], [I.scallion, 5], [I.soy, 5]]),
  // Grilled belly renders fat, so shoulder dilutes the raw belly; wrapped in lettuce with ssamjang (miso paste).
  samgyeopsal: recipe('grilled pork belly with lettuce and miso-chilli dip', [[porkBelly, 70], [I.porkShoulder, 30], [I.lettuce, 40], [S(172442, 'Miso'), 8], [I.garlic, 5]]),
  galbi: recipe('grilled marinated beef short ribs', [[shortRibs, 130], [I.soy, 10], [I.sugar, 8], [I.sesameOil, 3]]),
  kimbap: recipe('rice and vegetable rolls in nori with egg and ham', [[I.rice, 90], [I.nori, 4], [I.scrambled, 25], [I.cookedCarrot, 15], [spinach, 15], [I.ham, 15], [S(168451, 'Radishes, oriental, raw'), 10], [I.sesameOil, 3]]),
  // Soba stands in for the buckwheat-starch noodles of naengmyeon, in an ice-cold beef broth.
  naengmyeon: recipe('cold buckwheat-starch noodles in chilled beef broth with beef, egg and cucumber', [[soba, 180], [I.broth, 250], [vinegar, 8], [I.sugar, 6], [sirloin, 30], [I.boiledEgg, 30], [I.cucumber, 25]]),
  jajangmyeon: recipe('wheat noodles in black bean sauce with pork, onion and zucchini', [[I.noodles, 220], [I.porkShoulder, 40], [cookedOnion, 60], [I.zucchini, 40], [I.hoisin, 25], [I.oil, 12], [cornstarch, 4], [I.water, 60], [I.cucumber, 15]]),
  haemulPajeon: recipe('scallion pancake with shrimp and squid, soy dip', [[I.flour, 45], [I.egg, 40], [I.water, 70], [I.scallion, 60], [I.shrimp, 30], [rawSquid, 25], [I.oil, 15], [I.soy, 6]], { yield: 0.85 }),
  bingsu: recipe('shaved milk ice with sweet red beans, condensed milk and ice cream', [[I.water, 120], [condensed, 25], [redBeanPaste, 40], [F(13110100, 'Ice cream, vanilla'), 30]]),
  hotteok: recipe('yeast pancake filled with brown sugar and walnuts, pan-fried', [[I.flour, 55], [I.water, 38], [I.sugar, 12], [I.walnuts, 6], [I.oil, 6]], { yield: 0.9 }),

  // --- Taiwan ---
  taiwaneseBeefNoodleSoup: recipe('wheat noodles in spiced braised-beef broth with beef, bok choy and scallion', [[I.noodles, 180], [I.beefStew, 70], [I.broth, 330], [bokChoy, 40], [I.scallion, 5], [I.oil, 5], [I.soy, 8]]),
  luRouFan: recipe('rice with soy-braised minced pork belly and a halved egg', [[I.rice, 200], [porkBelly, 60], [I.soy, 15], [I.sugar, 6], [I.boiledEgg, 40]]),
  popcornChicken: food(F(24198731, 'Chicken nuggets, from fast food'), 'bite-size chicken in a starch coating, deep-fried'),
  guaBao: recipe('steamed bun folded around braised pork belly, salted mustard greens and crushed peanuts', [[F(58123110, 'Bao bun'), 50], [porkBelly, 55], [I.sugar, 4], [I.soy, 5], [I.peanuts, 5], [S(169891, 'Cabbage, mustard, salted'), 10]]),
};
