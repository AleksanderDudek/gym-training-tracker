import { F, I, S, food, recipe, type Source } from './kit';

// Poland and Central/Eastern Europe, the second batch. Values per 100 g as served; see
// `fetch-dishes.ts` for the rules (cooked weights, `yield` only for doughs and batters).

// Extra USDA foods used only here.
const spinach = F(99997210, 'Spinach, cooked, as ingredient');
const beetGreens = F(72101220, 'Beet greens, cooked');
const celery = F(99997555, 'Celery, cooked, as ingredient');
const roastPork = S(167821, 'Pork, fresh, loin, whole, separable lean and fat, cooked, roasted');
const beefRound = F(21102140, 'Beef, steak, round');
const beefSirloin = F(21102150, 'Beef, steak, sirloin, NS as to fat eaten');
const lard = F(81202000, 'Lard');
const cod = F(26109160, 'Fish, cod, steamed');
const bulgur = F(56207110, 'Bulgur, no added fat');
const millet = F(56202000, 'Millet');
const cherryFilling = F(63113030, 'Cherry pie filling');
const cranberrySauce = F(63207110, 'Cranberry sauce');
const dulceDeLeche = S(173461, 'Dulce de Leche');
const pickles = F(75503010, 'Pickles, dill');
const raisins = F(62125100, 'Raisins');

export const PARTS: Record<string, Source> = {
  // Knedlik houskový: bread-roll and flour dough, boiled, sliced. Water is the boiling water it keeps.
  bohemianDumplings: recipe('Czech bread dumpling: roll, flour, milk, egg and the water it keeps', [[I.softRoll, 40], [I.flour, 30], [I.milk, 30], [I.egg, 10], [I.water, 25]]),
  // The pork and onion filling of pelmeni, pyzy and meat crepes.
  porkFilling: recipe('pork and onion filling', [[I.porkGround, 70], [I.onion, 15], [I.oil, 4]]),
};

export const DISHES: Record<string, Source> = {
  // --- Mains and dumplings ---
  kotletDeVolaille: food(F(27146400, 'Chicken kiev'), 'FNDDS chicken Kiev: breaded breast with a butter filling; the same dish as "kotlet po kijowsku"'),
  krokietyZKapusta: recipe('crepes filled with sauerkraut and mushrooms, breaded and fried', [[I.crepe, 90], [I.sauerkraut, 80], [I.mushrooms, 25], [I.onion, 15], [I.breadcrumbs, 12], [I.egg, 8], [I.oil, 15]]),
  pyzyZMiesem: recipe('potato dumplings with pork, fried onion and bacon', [[I.potato, 140], [I.potatoStarch, 15], ['porkFilling', 90], [I.bacon, 10]]),
  kluskiKladzione: recipe('batter dumplings (cooked egg noodles stand in for the dough) with butter', [[I.noodles, 150], [I.butter, 5]]),
  lazankiZKapusta: recipe('pasta squares with cabbage, bacon, mushrooms and onion', [[I.pasta, 130], [I.cookedCabbage, 100], [I.bacon, 20], [I.mushrooms, 20], [I.onion, 15], [I.oil, 8]]),
  nalesnikiZMiesem: recipe('crepes rolled around fried pork and onion', [[I.crepe, 120], ['porkFilling', 90]]),
  nalesnikiZeSzpinakiem: recipe('crepes filled with spinach, feta and cream', [[I.crepe, 120], [spinach, 70], [I.feta, 25], [I.cream30, 15], [I.garlic, 2], [I.oil, 5]]),
  pasztet: food(I.liverPate, 'FNDDS liver pate; baked Polish pasztet is a pork and liver loaf of the same energy'),
  galaretaZNozek: recipe('pig feet set in broth with carrot and egg', [[I.broth, 60], [F(22707010, "Pork, pig's feet"), 25], [I.cookedCarrot, 10], [I.boiledEgg, 8]]),
  sledzWOleju: recipe('pickled herring in oil with raw onion', [[I.marinatedHerring, 80], [I.oil, 18], [I.onion, 30]]),
  schabPieczony: recipe('roast loin with its own juices, a little fat', [[roastPork, 100], [I.gravy, 15]]),
  karkowkaZGrilla: recipe('grilled pork neck: shoulder meat with a rub of oil and onion', [[I.porkShoulder, 100], [I.oil, 3]]),
  // The FNDDS entry is the edible meat, skin and fat; the bone is not weighed in the portion.
  golonka: food(F(22708010, 'Pork, ham hocks'), 'FNDDS ham hock, boiled or roasted meat with skin and fat'),
  pulpetyKoperkowe: recipe('pork and beef meatballs with roll, egg and onion in a dill sauce', [[I.porkGround, 50], [I.beefGround, 30], [I.softRoll, 10], [I.egg, 8], [I.onion, 10], [I.whiteSauce, 70], [I.sourCream, 10]]),
  bitkiWolowe: recipe('pounded beef round, fried, stewed in onion gravy', [[beefRound, 100], [I.onion, 30], [I.gravy, 50], [I.oil, 6]]),
  zrazyZawijane: recipe('beef round rolled around bacon, pickle and onion, in gravy', [[beefRound, 90], [I.bacon, 8], [pickles, 10], [I.onion, 8], [I.gravy, 60], [I.oil, 4]]),
  schabZeSliwka: recipe('roast loin stuffed with prunes, with gravy', [[roastPork, 110], [I.prunes, 25], [I.gravy, 40]]),
  kurczakPieczony: food(F(24102010, 'Chicken, NS as to part, baked, broiled, or roasted, skin eaten'), 'roast chicken with skin, edible meat'),
  flaki: recipe('beef tripe in a broth with carrot, celery and onion', [[F(25170110, 'Tripe'), 90], [I.broth, 130], [I.cookedCarrot, 20], [celery, 10], [I.onion, 10], [I.oil, 3]]),
  rybaPoGrecku: recipe('fried cod in a cooked vegetable and tomato paste topping', [[cod, 100], [I.cookedCarrot, 60], [I.onion, 30], [I.tomatoPaste, 25], [I.oil, 12], [I.flour, 3], [I.sugar, 2]]),
  karpSmazony: recipe('carp in egg and breadcrumbs, pan-fried', [[S(174185, 'Fish, carp, cooked, dry heat'), 150], [I.breadcrumbs, 10], [I.egg, 5], [I.flour, 5], [I.oil, 10]]),
  dorszWPanierce: food(I.friedCod, 'FNDDS fried cod, breaded'),
  makrelaWedzona: food(F(26121120, 'Fish, mackerel, baked or broiled'), 'FNDDS baked mackerel; smoked mackerel is close in fat'),
  pstragPieczony: recipe('baked trout with butter', [[F(26151120, 'Fish, trout, baked or broiled'), 100], [I.butter, 5]]),
  buraczkiZasmazane: recipe('beets cooked with roux (flour, butter), a little sugar and lemon', [[I.beets, 150], [I.flour, 5], [I.butter, 6], [I.sugar, 2], [I.lime, 2]]),
  kaszaJaglana: food(millet, 'cooked millet'),
  kaszaZSosemGrzybowym: recipe('cooked buckwheat with mushroom cream sauce', [[I.buckwheat, 150], [I.mushrooms, 50], [I.cream30, 20], [I.onion, 15], [I.butter, 5], [I.flour, 3]]),
  kluskiZMakiem: recipe('noodles with ground poppy seed, sugar, butter and raisins', [[I.noodles, 150], [I.poppy, 20], [I.sugar, 8], [I.butter, 6], [raisins, 10]]),
  // Kutia: wheat berries are not in the sources; bulgur is cracked wheat.
  kutia: recipe('wheat grains with poppy seed, honey, walnuts and raisins', [[bulgur, 120], [I.poppy, 15], [I.honey, 15], [I.walnuts, 15], [raisins, 15]]),
  leczo: recipe('peppers, courgette, tomato and onion stewed with kielbasa', [[I.pepper, 80], [I.zucchini, 60], [I.tinnedTomatoes, 70], [I.onion, 30], [I.kielbasa, 30], [I.oil, 6]]),
  kotletJajeczny: recipe('boiled eggs mashed with butter and crumbs, breaded and fried', [[I.boiledEgg, 80], [I.breadcrumbs, 20], [I.egg, 10], [I.oil, 10], [I.butter, 5]]),
  smalecZChlebem: recipe('lard with cracklings spread on rye bread', [[I.ryeBread, 70], [lard, 25], [I.bacon, 5], [I.onion, 5]]),
  ogorkiKiszone: food(I.gherkins),
  oscypekZZurawina: recipe('grilled smoked sheep cheese (Gouda stands in) with cranberry sauce', [[I.gouda, 80], [cranberrySauce, 25]]),
  tostZSzynkaISerem: recipe('toasted bread with butter, ham and Gouda', [[I.toast, 60], [I.ham, 30], [I.gouda, 30], [I.butter, 4]]),

  // --- Soups ---
  // Sorrel is not in the sources; cooked spinach is the nearest green.
  zupaSzczawiowa: recipe('broth with cooked greens (spinach for sorrel), potato, egg and sour cream', [[I.broth, 250], [spinach, 40], [I.potato, 40], [I.boiledEgg, 30], [I.sourCream, 15]]),
  botwinka: recipe('broth with young beet leaves and beets, potato, egg and sour cream', [[I.broth, 250], [beetGreens, 40], [I.beets, 40], [I.potato, 40], [I.boiledEgg, 30], [I.sourCream, 15]]),
  barszczBialy: recipe('sour rye (flour) soup with white sausage, potato, egg and sour cream', [[I.broth, 250], [I.ryeFlour, 8], [I.whiteSausage, 40], [I.potato, 50], [I.boiledEgg, 30], [I.sourCream, 15]]),
  zupaFasolowa: recipe('white bean soup with smoked bacon, potato and carrot', [[I.broth, 220], [I.whiteBeans, 70], [I.potato, 40], [I.cookedCarrot, 20], [I.bacon, 10], [I.oil, 3]]),
  zupaRybna: recipe('fish soup: cod, potato, carrot, tomato paste, a little cream', [[I.broth, 250], [cod, 70], [I.potato, 40], [I.cookedCarrot, 25], [I.tomatoPaste, 5], [I.cream30, 10]]),
  solyanka: recipe('sour-salty soup with sausage, ham, pickles, olives and sour cream', [[I.broth, 250], [I.kielbasa, 30], [I.ham, 25], [pickles, 25], [I.olives, 8], [I.tomatoPaste, 8], [I.onion, 15], [I.oil, 4], [I.sourCream, 15]]),
  borschUkrainski: recipe('beet soup with beef, cabbage, potato and sour cream', [[I.borscht, 250], [I.beefStew, 60], [I.cookedCabbage, 30], [I.potato, 40], [I.sourCream, 15]]),

  // --- Sweet things ---
  faworki: recipe('fried strips of yolk dough, dusted with icing sugar', [[I.flour, 100], [I.yolk, 25], [I.sourCream, 20], [I.oil, 28], [I.powderedSugar, 15]], { yield: 0.85 }),
  babkaDrozdzowa: recipe('yeast cake with butter, eggs and raisins; baked', [[I.flour, 100], [I.butter, 30], [I.sugar, 25], [I.egg, 25], [I.milk, 40], [raisins, 10]], { yield: 0.85 }),
  piernik: recipe('gingerbread with plum jam filling and chocolate glaze', [[F(53111000, 'Cake or cupcake, gingerbread'), 80], [I.jam, 15], [I.darkChocolate, 10]]),
  keks: food(S(174939, 'Cake, fruitcake, commercially prepared')),
  mazurek: recipe('shortcrust base with toffee (dulce de leche) filling, walnuts and raisins', [[I.flour, 50], [I.butter, 35], [I.powderedSugar, 15], [I.yolk, 10], [dulceDeLeche, 80], [I.walnuts, 10], [raisins, 10]], { yield: 0.9 }),
  placekDrozdzowy: food(F(51165000, 'Coffee cake, yeast type'), 'FNDDS yeast coffee cake, the crumb-topped yeast cake'),
  pierniczki: food(F(53223000, 'Cookie, gingersnaps'), 'hard spiced cookies; gingersnaps are the nearest'),
  trdelnik: recipe('sweet yeast dough baked on a spit, rolled in sugar and walnuts', [[I.sweetRoll, 100], [I.sugar, 12], [I.walnuts, 8]]),
  syrniki: recipe('curd cheese, egg, flour and sugar, pan-fried', [[I.twarog, 100], [I.egg, 20], [I.flour, 25], [I.sugar, 8], [I.oil, 10]]),
  palacsinta: recipe('crepes with walnut-sugar filling and chocolate', [[I.crepe, 130], [I.walnuts, 20], [I.sugar, 10], [I.darkChocolate, 15]]),
  wareniki: recipe('boiled dough with cherries in syrup, sour cream', [[I.noodles, 130], [cherryFilling, 80], [I.sugar, 5], [I.sourCream, 30]]),
  blini: recipe('small pancakes with sour cream and smoked salmon', [[F(55101000, 'Pancakes, plain'), 100], [I.sourCream, 25], [I.salmon, 20]]),
  kisiel: recipe('fruit starch jelly: strawberries, sugar, potato starch, water', [[I.strawberries, 20], [I.sugar, 10], [I.potatoStarch, 5], [I.water, 65]]),
  kompot: recipe('stewed fruit drink: apple, plum, strawberries, a little sugar, water', [[I.apple, 5], [I.plum, 4], [I.strawberries, 3], [I.sugar, 5], [I.water, 83]]),
  kwasChlebowy: recipe('bread kvass: fermented rye bread, sugar, water', [[I.ryeBread, 3], [I.sugar, 5], [I.water, 92]]),

  // --- Russian, Czech, Hungarian, Lithuanian, Ukrainian ---
  pelmeni: recipe('boiled meat dumplings with sour cream and butter', [[I.noodles, 120], ['porkFilling', 90], [I.sourCream, 25], [I.butter, 5]]),
  salo: recipe('cured pork back fat (lard stands in) on rye bread with garlic', [[I.ryeBread, 60], [lard, 35], [I.garlic, 3]]),
  svickova: recipe('beef sirloin in a cream and root-vegetable sauce, bread dumplings, cranberries, whipped cream', [[beefSirloin, 100], [I.cookedCarrot, 50], [I.cream30, 40], [I.onion, 10], [I.flour, 5], ['bohemianDumplings', 100], [cranberrySauce, 15], [I.whippedCream, 10]]),
  knedliky: recipe('sliced Czech bread dumplings', [['bohemianDumplings', 100]]),
  smazenySyr: recipe('fried breaded cheese with chips and tartare sauce', [[F(14660200, 'Mozzarella sticks, breaded, baked, or fried'), 130], [I.fries, 120], [I.tartar, 25]]),
  chickenPaprikash: recipe('chicken stewed with paprika, onion and sour cream, with nokedli dumplings', [[I.chickenThigh, 120], [I.sourCream, 40], [I.onion, 25], [I.tomato, 15], [I.oil, 5], [I.noodles, 100]]),
  porkolt: recipe('beef stew with onion, pepper and paprika, with nokedli dumplings', [[I.beefStew, 110], [I.onion, 40], [I.pepper, 20], [I.tomato, 20], [lard, 8], [I.broth, 40], [I.noodles, 100]]),
  cepelinai: recipe('potato dumplings stuffed with pork, bacon-onion sauce and sour cream', [[I.potato, 190], [I.potatoStarch, 12], [I.porkGround, 75], [I.bacon, 20], [I.onion, 15], [I.sourCream, 40]]),
};
