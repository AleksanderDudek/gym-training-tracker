// Region "everyday": breakfast, bakery, sweets, snacks, drinks (also alcohol), fast food, single
// foods and fruit. Values per 100 g (100 ml) as served; see the header of ../fetch-dishes.ts.
import { F, I, S, food, recipe, type Source } from './kit';

const raisins = F(62125100, 'Raisins');
const driedApricot = F(62104100, 'Apricot, dried');
const driedFig = F(62113100, 'Fig, dried');
const medjoolDates = S(168191, 'Dates, medjool');
const peanutButter = F(42202000, 'Peanut butter');
const chia = F(43108010, 'Chia seeds');
const hazelnutSpread = F(91304090, 'Chocolate hazelnut spread');
const sponge = F(53118100, 'Cake, sponge');
const sparkling = F(93401005, 'Wine, sparkling');
const liqueur = F(93201000, 'Liqueur');

export const DISHES: Record<string, Source> = {
  // --- Breakfast and bread ---
  // Muesli: oats, raisins and almonds in 170 g of 2 % milk.
  muesliWithMilk: recipe('oats, raisins, almonds, 2 % milk', [[I.oats, 30], [raisins, 12], [I.almonds, 6], [I.milk, 170]]),
  granolaWithMilk: recipe('homemade-style granola in 2 % milk', [[I.granola, 50], [I.milk, 170]]),
  chiaPudding: recipe('chia soaked in milk, honey, blueberries', [[chia, 25], [I.milk, 130], [I.honey, 8], [I.blueberries, 30]]),
  toastWithButter: recipe('2 toasted slices, butter', [[I.toast, 50], [I.butter, 8]]),
  toastWithJam: recipe('2 toasted slices, butter, jam', [[I.toast, 50], [I.butter, 5], [I.jam, 25]]),
  toastWithPeanutButter: recipe('2 toasted slices, peanut butter', [[I.toast, 50], [peanutButter, 30]]),
  eggSandwich: food(F(34001100, 'Egg sandwich on white bread')),
  breakfastMuffinSandwich: food(F(34001320, 'Egg sandwich on English muffin, with bacon'), 'FNDDS: egg, bacon and cheese on a toasted English muffin'),
  croissantHamCheese: recipe('croissant, ham, Gouda', [[F(51166000, 'Croissant'), 65], [I.ham, 35], [I.gouda, 20]]),
  crepesNutella: recipe('2 crêpes spread with chocolate-hazelnut cream', [[I.crepe, 100], [hazelnutSpread, 30]]),
  baguette: food(I.baguette),
  // No ciabatta in USDA; Italian bread (white, crusty, a little oil) is the nearest.
  ciabatta: food(S(174913, 'Bread, Italian')),
  whiteBread: food(I.bread),
  wholegrainBread: food(F(51300110, 'Bread, whole wheat')),
  kajzerka: food(S(175031, 'Rolls, hard (includes kaiser)')),
  pitaBread: food(I.pita),
  tortillaWrap: food(I.tortilla),
  sourdoughToast: food(S(174911, 'Bread, french or vienna, toasted (includes sourdough)')),
  semolinaPudding: recipe('semolina boiled in whole-ish milk (2 %), sugar', [[I.milk, 220], [S(168933, 'Semolina, unenriched'), 22], [I.sugar, 10]]),
  // --- Bakery and cakes ---
  danishPastry: food(F(53510100, 'Danish pastry, with fruit')),
  puffPastryFruit: food(F(53452100, 'Pastry, fruit-filled')),
  oatmealCookies: food(F(53233000, 'Cookie, oatmeal')),
  shortbread: food(F(53239000, 'Cookie, shortbread')),
  bananaBread: food(S(174906, 'Bread, banana, prepared from recipe, made with margarine')),
  spongeCake: food(sponge),
  creamLayerCake: recipe('sponge layers, whipped cream, a little jam', [[sponge, 70], [I.whippedCream, 50], [I.jam, 10]]),
  birthdayCake: food(F(53120270, 'Cake or cupcake, white with white icing, bakery')),
  // FNDDS has one "Tart, all types": a pastry shell with a fruit or custard filling.
  fruitTart: food(F(53300200, 'Tart, all types')),
  pavlova: recipe('meringue shell, whipped cream, strawberries', [[F(32401000, 'Meringues'), 50], [I.cream36, 45], [I.strawberries, 55]]),
  meringue: food(F(32401000, 'Meringues')),
  // --- Sweets ---
  iceCreamSundae: food(F(13121000, 'Ice cream sundae, NFS')),
  popsicle: food(F(91611000, 'Popsicle')),
  sorbet: food(F(63430150, 'Sorbet')),
  chocolatePralines: food(F(91705010, 'Chocolate candy')),
  gummyCandy: food(F(91745010, 'Candy, gummy')),
  jellyDessert: food(F(91501020, 'Gelatin dessert with fruit')),
  ricePudding: food(F(13210410, 'Pudding, rice')),
  darkChocolate: food(I.darkChocolate),
  // McFlurry is the one fast-food soft-serve-with-biscuit dessert USDA lists.
  iceCreamWithCookies: food(S(173304, "McDONALD'S, McFLURRY with OREO cookies")),
  // --- Snacks ---
  pretzelSticks: food(F(54408015, 'Pretzels, hard, NFS')),
  tortillaChipsSalsa: recipe('tortilla chips with a bowl of salsa', [[F(54401075, 'Tortilla chips, plain'), 40], [I.salsa, 70]]),
  greenOlives: food(F(75510010, 'Olives, green')),
  saltedPeanuts: food(F(42111200, 'Peanuts, dry roasted, salted')),
  trailMix: food(F(42501000, 'Trail mix with nuts and fruit')),
  driedFruitMix: recipe('dried apricots, prunes, raisins and figs', [[driedApricot, 30], [I.prunes, 25], [raisins, 20], [driedFig, 15]]),
  riceCakes: food(F(54318500, 'Rice cake')),
  granolaBar: food(F(53712100, 'Cereal or Granola bar, NFS')),
  energyBalls: recipe('dates, oats, almonds, peanut butter rolled into balls', [[medjoolDates, 45], [I.oats, 20], [I.almonds, 20], [peanutButter, 15]]),
  beefJerky: food(F(21602100, 'Beef jerky')),
  sunflowerSeeds: food(F(43102000, 'Sunflower seeds, plain, unsalted')),
  fruitYogurtCup: food(F(11431000, 'Yogurt, whole milk, fruit')),
  cottageCheese: food(F(14201010, 'Cheese, cottage, creamed, large or small curd')),
  // --- Fast food ---
  fishSandwich: food(F(27550400, 'Fish sandwich, fried, on white bun')),
  loadedFries: recipe('fries with cheese sauce, bacon and spring onion', [[I.fries, 180], [I.cheeseSauce, 50], [I.bacon, 12], [I.scallion, 5]]),
  // --- Drinks ---
  // Flat white: a double espresso with 130 ml of steamed 2 % milk, no foam to speak of.
  flatWhite: recipe('espresso, steamed 2 % milk', [[F(92101610, 'Coffee, espresso'), 40], [I.milk, 130]]),
  mocha: food(F(92101950, 'Coffee, Cafe Mocha')),
  icedCoffee: food(F(92102500, 'Coffee, Iced Latte')),
  frappe: food(F(92101920, 'Frozen coffee drink')),
  greenTea: food(F(92303010, 'Tea, hot, leaf, green')),
  icedTea: food(F(92309000, 'Tea, iced, bottled, black')),
  appleJuice: food(F(64104010, 'Apple juice, 100%')),
  tomatoJuice: food(F(74301100, 'Tomato juice, 100%')),
  vegetableJuice: food(F(75132000, 'Mixed vegetable juice')),
  coconutWater: food(F(42403010, 'Coconut water, unsweetened')),
  sportsDrink: food(F(95321000, 'Sports drink, NFS')),
  mojito: food(F(93301125, 'Mojito')),
  // USDA has no Aperol; a liqueur stands in (about 11 % vs 20 % alcohol, so only a splash of it).
  aperolSpritz: recipe('prosecco, a bitter orange liqueur, soda, orange slice', [[sparkling, 90], [liqueur, 22], [S(173647, 'Beverages, water, tap, drinking'), 60], [F(61119010, 'Orange, raw'), 10]]),
  margarita: food(F(93301100, 'Margarita')),
  ginAndTonic: food(F(93301060, 'Gin and tonic')),
  pinaColada: food(F(93301200, 'Pina Colada')),
  vodkaShot: food(F(93505000, 'Vodka')),
  whisky: food(F(93502000, 'Whiskey')),
  cider: food(F(93106500, 'Hard cider')),
  nonAlcoholicBeer: food(F(92803000, 'Beer, nonalcoholic')),
  kombucha: food(F(92306920, 'Tea, kombucha')),
  sparklingWine: food(sparkling),
  // --- Single foods ---
  avocadoHalf: food(I.avocado),
  carrotSticks: food(F(73101010, 'Carrots, raw')),
  tomatoSalad: recipe('tomatoes, onion, a little oil', [[I.tomato, 190], [I.onion, 20], [I.oil, 8]]),
  bakedPotato: food(F(71508001, 'Potato, baked, peel eaten')),
  roastedPotatoes: food(I.roastPotatoes),
  // Thick oven-baked potato wedges: FNDDS steak fries, heated in the oven.
  potatoWedges: food(S(168445, 'Potatoes, french fried, steak fries, salt added in processing, frozen, oven-heated')),
  lentils: food(F(41305000, 'Lentils, from dried, no added fat')),
  chickpeas: food(F(41302020, 'Chickpeas, from dried, no added fat')),
  tunaSteak: food(F(26153120, 'Fish, tuna, cooked')),
  bakedCod: food(F(26109120, 'Fish, cod, baked or broiled')),
  grilledShrimp: food(F(26319123, 'Shrimp, grilled')),
  roastPorkTenderloin: food(S(168250, 'Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted')),
  roastBeefSlices: food(F(21401000, 'Beef, roast')),
  turkeyBreastSlices: food(S(172941, 'Turkey breast, sliced, prepackaged')),
  hamSlices: food(I.ham),
  salami: food(F(25221500, 'Salami, NFS')),
  cheeseSlices: food(I.gouda),
  mozzarellaBall: food(I.mozzarella),
  // --- Fruit ---
  pineapple: food(F(63141010, 'Pineapple, raw')),
  peach: food(F(63135010, 'Peach, raw')),
  apricots: food(F(63103010, 'Apricot, raw')),
  melon: food(F(63109010, 'Cantaloupe, raw')),
  grapefruit: food(F(61101010, 'Grapefruit, raw')),
  pomegranate: food(F(63145010, 'Pomegranate, raw')),
  figs: food(S(173021, 'Figs, raw')),
  dates: food(medjoolDates),
  papaya: food(F(63133010, 'Papaya, raw')),
  lychee: food(F(63126510, 'Lychee')),
  dragonFruit: food(F(63116010, 'Dragon fruit')),
};
