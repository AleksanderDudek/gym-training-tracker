import { F, I, S, food, recipe, type Source } from './kit';

// Italy, France, Spain, Portugal, Greece: more dishes. Same ids as src/food/photo/catalog/med.ts.
// Values per 100 g as served; recipes in grams as served (cooked meat and pasta, the fat that stays).

// Ingredients used by more than one dish here.
const romano = S(171249, 'Cheese, romano');
const gruyere = S(171242, 'Cheese, gruyere');
const provolone = S(170850, 'Cheese, provolone');
const kale = S(169238, 'Kale, cooked, boiled, drained, without salt');
const veal = F(23201010, 'Veal, chop');
const sirloin = S(169458, 'Beef, top sirloin, steak, separable lean and fat, trimmed to 0" fat, choice, cooked, broiled');
const clams = S(171975, 'Mollusks, clam, mixed species, cooked, moist heat');
const mussels = S(174217, 'Mollusks, mussel, blue, cooked, moist heat');
const redWine = S(173190, 'Alcoholic beverage, wine, table, red');
const iceCream = S(167575, 'Ice creams, vanilla');
const pastry = S(172738, 'Puff pastry, frozen, ready-to-bake, baked');
const anchovy = S(174183, 'Fish, anchovy, european, canned in oil, drained solids');
const chorizo = F(25220710, 'Chorizo');
const salami = F(25221500, 'Salami, NFS');
const poachedEgg = S(172186, 'Egg, whole, cooked, poached');
const hotSauce = S(174527, 'Sauce, ready-to-serve, pepper or hot');

/** Shared sub-recipes. */
export const PARTS: Record<string, Source> = {
  // FNDDS and SR have no prosciutto; a lean cured ham with its fat back (prosciutto crudo is ~245 kcal).
  prosciutto: recipe('cured ham: lean ham and ham fat', [
    [S(168284, 'Pork, cured, ham, whole, separable lean only, roasted'), 75],
    [S(169155, 'Pork, cured, ham, separable fat, boneless, heated'), 25],
  ]),
};

export const DISHES: Record<string, Source> = {
  // --- Italy ---
  // Pizza with no tomato, mozzarella and three more cheeses: FNDDS white pizza, thin (Italian) crust.
  pizzaQuattroFormaggi: food(F(58107205, 'White pizza, cheese, thin crust')),
  // Guanciale is cured pork jowl; bacon is the nearest food.
  spaghettiAmatriciana: recipe('spaghetti, tomato sauce, bacon, pecorino, olive oil', [[I.pasta, 220], [I.tomatoSauce, 90], [I.bacon, 25], [romano, 12], [I.oliveOil, 3]]),
  cacioEPepe: recipe('spaghetti, pecorino, butter and olive oil emulsified with pasta water', [[I.pasta, 250], [romano, 35], [I.butter, 10], [I.oliveOil, 5]]),
  spaghettiVongole: recipe('spaghetti, clams (shells off the weight), olive oil, garlic', [[I.pasta, 230], [clams, 80], [I.oliveOil, 14], [I.garlic, 4]]),
  spaghettiMeatballs: recipe('spaghetti, tomato sauce, beef meatballs, parmesan', [[I.pasta, 220], [I.tomatoSauce, 120], [I.beefGround, 70], [I.parmesan, 8], [I.oliveOil, 4]]),
  pastaAlForno: recipe('penne baked with meat sauce, mozzarella and parmesan', [[I.pasta, 150], [I.meatSauce, 110], [I.mozzarella, 50], [I.parmesan, 8]]),
  risottoMilanese: recipe('rice cooked in broth with butter, parmesan, onion; saffron adds nothing', [[I.rice, 255], [I.butter, 16], [I.parmesan, 22], [I.oliveOil, 3], [I.onion, 5]]),
  seafoodRisotto: recipe('rice with shrimp, mussels, clams, tomato, olive oil', [[I.rice, 230], [I.shrimp, 45], [mussels, 35], [clams, 20], [I.tinnedTomatoes, 10], [I.oliveOil, 8], [I.garlic, 2]]),
  // Only raw shank is in SR; veal chop (cooked) stands in for the braised meat, with its vegetable sauce.
  ossoBuco: recipe('braised veal, tomato and vegetable sauce, butter', [[veal, 170], [I.tomatoSauce, 100], [I.cookedCarrot, 40], [I.onion, 20], [I.oliveOil, 8], [I.butter, 6]]),
  saltimbocca: recipe('veal cutlet, prosciutto, butter, broth', [[veal, 140], ['prosciutto', 38], [I.butter, 14], [I.broth, 8]]),
  vitelloTonnato: recipe('roast veal, tuna and mayonnaise sauce, capers, anchovy', [[veal, 115], [I.mayo, 25], [I.tinnedTuna, 25], [I.oliveOil, 8], [I.boiledEgg, 10], [S(172238, 'Capers, canned'), 3], [anchovy, 4]]),
  polenta: recipe('cornmeal porridge with butter and parmesan', [[F(56201517, 'Cornmeal mush, fat added'), 225], [I.parmesan, 15], [I.butter, 10]]),
  porchettaSandwich: recipe('hard roll, roast pork shoulder with crackling, rocket', [[I.roll, 90], [I.porkShoulder, 110], [I.arugula, 10], [I.oliveOil, 3]]),
  // Piadina dough is flour, lard and water, griddled: a flour tortilla is the nearest.
  piadina: recipe('flatbread, prosciutto, mozzarella, rocket', [[I.tortilla, 85], ['prosciutto', 40], [I.mozzarella, 40], [I.arugula, 15], [I.oliveOil, 5]]),
  panino: recipe('ciabatta roll, ham, mozzarella, tomato, olive oil', [[I.roll, 90], [I.ham, 40], [I.mozzarella, 50], [I.tomato, 40], [I.oliveOil, 6]]),
  antipastoPlatter: recipe('salami, prosciutto, provolone, olives, peppers, artichoke, bread', [[salami, 45], ['prosciutto', 35], [provolone, 40], [I.olives, 30], [I.pepper, 25], [F(75100750, 'Artichoke'), 25], [I.baguette, 30], [I.oliveOil, 8]]),
  prosciuttoMelone: recipe('prosciutto and cantaloupe', [['prosciutto', 55], [S(169092, 'Melons, cantaloupe, raw'), 195]]),
  // SR has no burrata; mozzarella with the cream inside it.
  burrata: recipe('mozzarella and cream (burrata), tomatoes, olive oil', [[I.mozzarella, 110], [I.cream36, 25], [I.tomato, 70], [I.oliveOil, 8]]),
  frittata: recipe('eggs cooked with potato, onion and parmesan in olive oil', [[I.scrambled, 130], [I.potato, 50], [I.onion, 15], [I.parmesan, 8], [I.oliveOil, 6]]),
  pastaEFagioli: recipe('white beans, small pasta, tomato, broth, olive oil', [[I.whiteBeans, 110], [I.pasta, 60], [I.tomatoSauce, 30], [I.oliveOil, 6], [I.broth, 130], [I.cookedCarrot, 10]]),
  ribollita: recipe('stale bread, cannellini beans, black kale, tomato, broth', [[I.bread, 40], [I.whiteBeans, 90], [kale, 70], [I.tinnedTomatoes, 30], [I.cookedCarrot, 15], [I.oliveOil, 8], [I.broth, 100]]),
  affogato: recipe('vanilla ice cream with a shot of espresso', [[iceCream, 125], [S(171891, 'Beverages, coffee, brewed, espresso, restaurant-prepared'), 45]]),
  biscotti: food(F(53203500, 'Cookie, biscotti')),
  // No panettone in USDA; a yeast-raised sweet bread with fruit, FNDDS coffee cake (yeast type).
  panettone: food(F(51165000, 'Coffee cake, yeast type')),

  // --- France ---
  steakFrites: recipe('grilled sirloin, french fries, herb butter', [[sirloin, 160], [I.fries, 200], [I.butter, 8]]),
  // Wine is cooked down, so only a little of its alcohol and sugar stays in the dish.
  coqAuVin: recipe('chicken braised with bacon, mushrooms, onions, carrots, red wine', [[I.chickenThigh, 150], [I.bacon, 20], [I.mushrooms, 40], [I.onion, 25], [I.cookedCarrot, 15], [redWine, 35], [I.butter, 8], [I.flour, 4], [I.broth, 40]]),
  cassoulet: recipe('white beans, duck confit, pork sausage, pork, tomato', [[I.whiteBeans, 190], [I.duck, 70], [I.porkSausage, 55], [I.porkShoulder, 40], [I.tinnedTomatoes, 25], [I.broth, 20]]),
  bouillabaisse: recipe('fish, shrimp, mussels, potato, tomato, olive oil, fish broth', [[S(173694, 'Fish, sea bass, mixed species, cooked, dry heat'), 110], [I.shrimp, 45], [mussels, 40], [I.potato, 70], [I.tinnedTomatoes, 50], [I.oliveOil, 12], [I.onion, 15], [I.broth, 108]]),
  // The galette is a buckwheat crepe; FNDDS has only the wheat one.
  galetteBretonne: recipe('crepe with ham, gruyère, a fried egg, butter', [[I.crepe, 110], [I.ham, 40], [gruyere, 35], [I.friedEgg, 55], [I.butter, 8]]),
  tarteTatin: recipe('apples caramelised in butter and sugar under puff pastry', [[I.apple, 75], [pastry, 30], [I.butter, 10], [I.sugar, 20]]),
  profiteroles: recipe('choux puffs, vanilla ice cream, chocolate sauce', [[F(53420250, 'Cream puff, no filling or icing'), 70], [iceCream, 60], [S(168835, 'Syrups, chocolate, fudge-type'), 30]]),
  painAuChocolat: food(F(51166200, 'Croissant, chocolate')),
  duckConfit: recipe('duck leg confit with sautéed potatoes', [[I.duck, 220], [I.roastPotatoes, 80]]),
  saladeLyonnaise: recipe('lettuce, bacon lardons, poached egg, croutons, vinaigrette', [[I.lettuce, 120], [I.bacon, 30], [poachedEgg, 55], [I.baguette, 20], [I.vinaigrette, 25]]),
  gratinDauphinois: recipe('potatoes baked in cream, gruyère, butter', [[I.potato, 150], [I.cream30, 55], [gruyere, 10], [I.butter, 4]]),
  madeleines: recipe('butter sponge cakes: pound cake with extra butter', [[F(53116000, 'Cake, pound'), 85], [I.butter, 12], [I.sugar, 3]]),
  // FNDDS flan is the caramel custard; crème caramel is the same thing.
  cremeCaramel: food(F(13210350, 'Flan')),

  // --- Spain ---
  jamonPlate: recipe('cured ham with its fat, ibérico style', [
    [S(168284, 'Pork, cured, ham, whole, separable lean only, roasted'), 62],
    [S(169155, 'Pork, cured, ham, separable fat, boneless, heated'), 38],
  ]),
  pimientosPadron: recipe('small green peppers blistered in olive oil, salt', [[S(170427, 'Peppers, sweet, green, raw'), 105], [I.oliveOil, 12]]),
  gambasAlAjillo: recipe('prawns, olive oil left in the dish, garlic, chilli', [[I.shrimp, 130], [I.oliveOil, 30], [I.garlic, 8], [S(170497, 'Peppers, hot chili, green, raw'), 2]]),
  pulpoGallega: recipe('boiled octopus on boiled potatoes, olive oil, paprika', [[I.octopus, 110], [I.potato, 120], [I.oliveOil, 14]]),
  albondigas: food(F(27160100, 'Meatballs, NS as to type of meat, with sauce')),
  // Milk custard thickened with yolks and a little flour, caramelised sugar on top.
  cremaCatalana: recipe('milk, egg yolks, sugar, a little flour, burnt sugar top', [[I.milk, 100], [I.yolk, 25], [I.sugar, 18], [I.flour, 3]]),
  salmorejo: recipe('raw tomato, bread, olive oil, garlic, egg and ham on top', [[I.tomato, 200], [I.bread, 40], [I.oliveOil, 20], [I.boiledEgg, 15], [I.ham, 10], [I.garlic, 2]]),
  fabada: recipe('white beans with chorizo, blood sausage and bacon', [[I.whiteBeans, 220], [chorizo, 35], [I.bloodSausage, 35], [I.bacon, 25], [I.broth, 85]]),
  bocadilloCalamares: recipe('baguette, fried squid rings, a little mayonnaise', [[I.baguette, 110], [S(171982, 'Mollusks, squid, mixed species, cooked, fried'), 100], [I.mayo, 12]]),
  tapenadeToast: recipe('baguette slices with olive, anchovy and caper paste', [[I.baguette, 50], [I.olives, 25], [anchovy, 3], [S(172238, 'Capers, canned'), 2], [I.oliveOil, 10]]),
  panConTomate: recipe('baguette rubbed with grated tomato and olive oil', [[I.baguette, 85], [I.tomato, 35], [I.oliveOil, 10]]),
  sangria: recipe('red wine, orange juice, sugar, chopped fruit, a splash of soda', [[redWine, 150], [F(61210010, 'Orange juice, 100%,'), 45], [I.sugar, 10], [I.apple, 30], [I.water, 15]]),

  // --- Portugal ---
  pastelDeNata: recipe('puff pastry shell, egg yolk and cream custard', [[pastry, 25], [I.cream30, 10], [I.milk, 15], [I.yolk, 8], [I.sugar, 10]]),
  bacalhauBras: recipe('flaked cod, egg, fried potato sticks, onion, olives', [[S(171956, 'Fish, cod, Atlantic, cooked, dry heat'), 90], [I.fries, 70], [I.scrambled, 90], [I.onion, 25], [I.oliveOil, 12], [I.olives, 8]]),
  francesinha: recipe('bread, steak, sausage, ham, melted cheese, fried egg, tomato-beer sauce, fries', [[I.bread, 70], [sirloin, 55], [I.kielbasa, 40], [I.ham, 30], [I.gouda, 55], [I.friedEgg, 55], [I.tomatoSauce, 100], [I.butter, 5], [I.fries, 150]]),
  caldoVerde: recipe('potato purée, shredded kale, chorizo, olive oil, water', [[I.potato, 130], [kale, 45], [chorizo, 10], [I.oliveOil, 8], [I.water, 157]]),
  bifana: recipe('bread roll with pork shoulder cooked in garlic and white wine', [[I.roll, 80], [I.porkShoulder, 90], [I.oliveOil, 5], [I.garlic, 2]]),
  piriPiriChicken: recipe('grilled chicken with skin, olive oil and piri-piri sauce', [[S(171450, 'Chicken, broilers or fryers, meat and skin, cooked, roasted'), 270], [I.oliveOil, 12], [hotSauce, 15]]),

  // --- Greece ---
  pastitsio: recipe('pasta tubes, beef in tomato sauce, thick béchamel, cheese', [[I.pasta, 110], [I.beefGround, 70], [I.tomatoSauce, 40], [I.whiteSauce, 70], [romano, 10]]),
  gemista: recipe('tomatoes and peppers stuffed with rice, onion, herbs and olive oil', [[I.rice, 90], [I.tomato, 160], [I.pepper, 70], [I.oliveOil, 16], [I.onion, 14]]),
  fasolada: recipe('white beans, tomato, carrot, celery, onion, olive oil, water', [[I.whiteBeans, 130], [S(170051, 'Tomatoes, red, ripe, canned, packed in tomato juice'), 50], [I.cookedCarrot, 25], [S(169989, 'Celery, cooked, boiled, drained, without salt'), 15], [I.onion, 15], [I.oliveOil, 12], [I.water, 103]]),
  loukoumades: recipe('fried yeast dough balls with honey and walnuts', [[F(53520170, 'Doughnut holes'), 90], [I.honey, 25], [I.walnuts, 5]]),
  saganaki: recipe('hard cheese dusted with flour and fried in olive oil', [[gruyere, 75], [I.flour, 6], [I.oliveOil, 12]]),
  keftedes: recipe('beef and lamb meatballs with bread, egg, onion, fried in olive oil', [[I.beefGround, 80], [I.lambGround, 30], [I.bread, 15], [I.egg, 10], [I.onion, 10], [I.oliveOil, 12]]),
};
