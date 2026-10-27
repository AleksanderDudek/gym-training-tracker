import { say } from '../../i18n';

/**
 * The foods a lab focus can recommend: eaten in Poland, rich in something a result can ask for
 * (iron, B12, folate, vitamin D, omega-3, fibre...). Values per 100 g are in `data/nutrients.json`,
 * built from USDA FoodData Central by `scripts/food/fetch-nutrients.ts`; `fdc` is the source row.
 *
 * Choices behind the rows:
 * - Unfortified items only. US milk, flour, rice and cereals are fortified (vitamin D, A, iron,
 *   folic acid); Polish ones are not, so the "without added vitamin A and D" and "unenriched"
 *   rows are used, and US breakfast cereals not at all.
 * - The state is the one a Polish recipe weighs: meat and fish raw, grains and dry legumes dry,
 *   tinned food drained. The label says so and the portion is in that state.
 * - `ingredient` lets a recipe ingredient borrow this food's micronutrients. One food per
 *   ingredient, and only where the composition is a fair stand-in.
 */

export type FoodGroup =
  | 'fish'
  | 'meat'
  | 'organ'
  | 'poultry'
  | 'eggs'
  | 'dairy'
  | 'legumes'
  | 'grains'
  | 'nuts'
  | 'vegetables'
  | 'fruit'
  | 'fats'
  | 'other';

export interface LabFood {
  /** camelCase English, the key of the food's row in `data/nutrients.json`. */
  id: string;
  /** USDA FoodData Central id (SR Legacy). */
  fdc: number;
  label: string;
  group: FoodGroup;
  /** A usual household portion, in the state the label names. */
  portion: { g: number; label: string };
  /** Liver, heart: rich, but limited for high uric acid and in pregnancy (vitamin A). */
  organ?: true;
  /** Meat, fish, poultry: part of the iron is haem, absorbed several times better. */
  heme?: true;
  /** Recipe ingredient ids (`recipes/ingredients.ts`) this food stands in for. */
  ingredient?: string[];
}

/** A portion: its household name (`say`) with the grams after it, „1 filet (150 g)”. */
const p = (g: number, label: string) => ({ g, label: `${label} (${g} g)` });

export const LAB_FOODS: readonly LabFood[] = [
  // Fish: raw fillets unless tinned. Salted or matjes herring has the raw fish's vitamins but
  // several times its sodium.
  { id: 'herring', fdc: 175116, label: say('Śledź atlantycki (filet)', 'Atlantic herring (fillet)'), group: 'fish', portion: p(100, say('2 filety', '2 fillets')), heme: true, ingredient: ['herring'] },
  // The US row is cured in sweetened vinegar, like śledź w occie.
  { id: 'herringMarinated', fdc: 175118, label: say('Śledź marynowany (w occie)', 'Marinated herring (in vinegar)'), group: 'fish', portion: p(100, say('2 filety', '2 fillets')), heme: true },
  { id: 'mackerel', fdc: 175119, label: say('Makrela atlantycka (filet)', 'Atlantic mackerel (fillet)'), group: 'fish', portion: p(120, say('1 filet', '1 fillet')), heme: true },
  { id: 'sardines', fdc: 175139, label: say('Sardynki w oleju (z puszki, odsączone)', 'Sardines in oil (tinned, drained)'), group: 'fish', portion: p(90, say('1 puszka', '1 tin')), heme: true },
  // Polish shops sell farmed Atlantic salmon, which differs from wild in fat and omega-3.
  { id: 'salmon', fdc: 175167, label: say('Łosoś hodowlany (filet surowy)', 'Farmed salmon (raw fillet)'), group: 'fish', portion: p(150, say('1 filet', '1 fillet')), heme: true, ingredient: ['salmonFillet'] },
  // SR has smoked chinook only; Polish smoked salmon is farmed Atlantic, a little fattier.
  { id: 'smokedSalmon', fdc: 173687, label: say('Łosoś wędzony', 'Smoked salmon'), group: 'fish', portion: p(50, say('3 plastry', '3 slices')), heme: true, ingredient: ['smokedSalmon'] },
  { id: 'tuna', fdc: 173709, label: say('Tuńczyk w sosie własnym (odsączony)', 'Tuna in brine (drained)'), group: 'fish', portion: p(120, say('1 puszka', '1 tin')), heme: true, ingredient: ['tuna'] },
  { id: 'cod', fdc: 171955, label: say('Dorsz (filet surowy)', 'Cod (raw fillet)'), group: 'fish', portion: p(150, say('1 filet', '1 fillet')), heme: true, ingredient: ['whiteFish'] },
  // The complete SR row is the one with moisture-retaining phosphates, as frozen Polish fillets often
  // have; they add sodium.
  { id: 'pollock', fdc: 175130, label: say('Mintaj (filet surowy)', 'Alaska pollock (raw fillet)'), group: 'fish', portion: p(150, say('1 filet', '1 fillet')), heme: true },
  { id: 'trout', fdc: 173717, label: say('Pstrąg tęczowy (filet surowy)', 'Rainbow trout (raw fillet)'), group: 'fish', portion: p(150, say('1 filet', '1 fillet')), heme: true },
  { id: 'carp', fdc: 171952, label: say('Karp (filet surowy)', 'Carp (raw fillet)'), group: 'fish', portion: p(150, say('1 dzwonko', '1 steak')), heme: true },
  { id: 'shrimp', fdc: 174210, label: say('Krewetki (surowe, obrane)', 'Prawns (raw, peeled)'), group: 'fish', portion: p(100, say('porcja', 'portion')), heme: true, ingredient: ['shrimp'] },

  // Organ meat: the richest iron, B12 and vitamin A; raw weights.
  { id: 'chickenLiver', fdc: 171060, label: say('Wątróbka drobiowa (surowa)', 'Chicken liver (raw)'), group: 'organ', portion: p(100, say('porcja', 'portion')), organ: true, heme: true },
  { id: 'porkLiver', fdc: 167862, label: say('Wątróbka wieprzowa (surowa)', 'Pork liver (raw)'), group: 'organ', portion: p(100, say('porcja', 'portion')), organ: true, heme: true },
  { id: 'beefLiver', fdc: 169451, label: say('Wątróbka wołowa (surowa)', 'Beef liver (raw)'), group: 'organ', portion: p(100, say('porcja', 'portion')), organ: true, heme: true },
  { id: 'chickenHearts', fdc: 171458, label: say('Serca drobiowe (surowe)', 'Chicken hearts (raw)'), group: 'organ', portion: p(100, say('porcja', 'portion')), organ: true, heme: true },

  // Meat, raw.
  { id: 'beef', fdc: 171757, label: say('Wołowina chuda, udziec (surowa)', 'Lean beef, topside (raw)'), group: 'meat', portion: p(150, say('1 stek', '1 steak')), heme: true, ingredient: ['leanBeef'] },
  { id: 'beefMince', fdc: 174030, label: say('Wołowina mielona, 10% tłuszczu (surowa)', 'Beef mince, 10% fat (raw)'), group: 'meat', portion: p(125, say('porcja', 'portion')), heme: true },
  { id: 'porkLoin', fdc: 168230, label: say('Schab wieprzowy (surowy)', 'Pork loin (raw)'), group: 'meat', portion: p(150, say('1 kotlet', '1 chop')), heme: true },
  { id: 'porkTenderloin', fdc: 168249, label: say('Polędwiczka wieprzowa (surowa)', 'Pork tenderloin (raw)'), group: 'meat', portion: p(150, say('porcja', 'portion')), heme: true },
  { id: 'porkShoulder', fdc: 167843, label: say('Łopatka wieprzowa (surowa)', 'Pork shoulder (raw)'), group: 'meat', portion: p(150, say('porcja', 'portion')), heme: true },

  // Poultry, raw.
  { id: 'chickenBreast', fdc: 171077, label: say('Pierś z kurczaka (surowa)', 'Chicken breast (raw)'), group: 'poultry', portion: p(150, say('1 filet', '1 fillet')), heme: true, ingredient: ['chickenFillet'] },
  { id: 'chickenThigh', fdc: 173627, label: say('Udko z kurczaka bez skóry (surowe)', 'Chicken thigh, skinless (raw)'), group: 'poultry', portion: p(120, say('2 udka bez kości', '2 boneless thighs')), heme: true },
  { id: 'turkeyBreast', fdc: 171098, label: say('Pierś z indyka (surowa)', 'Turkey breast (raw)'), group: 'poultry', portion: p(150, say('porcja', 'portion')), heme: true, ingredient: ['turkeyFillet'] },
  { id: 'turkeyMince', fdc: 172850, label: say('Indyk mielony (surowy)', 'Turkey mince (raw)'), group: 'poultry', portion: p(125, say('porcja', 'portion')), heme: true, ingredient: ['turkeyMince'] },
  // Sliced deli breast carries added salt (and in the US phosphates), like Polish wędlina.
  { id: 'chickenSliced', fdc: 172963, label: say('Pierś z kurczaka w plastrach (wędlina)', 'Sliced chicken breast (deli)'), group: 'poultry', portion: p(30, say('3 plastry', '3 slices')), heme: true, ingredient: ['chicken'] },

  // Eggs, raw weights without the shell.
  { id: 'egg', fdc: 171287, label: say('Jajko kurze', 'Hen egg'), group: 'eggs', portion: p(50, say('1 jajko', '1 egg')), ingredient: ['egg'] },
  { id: 'eggWhite', fdc: 172183, label: say('Białko jaja', 'Egg white'), group: 'eggs', portion: p(33, say('1 białko', '1 white')), ingredient: ['eggWhites'] },
  { id: 'eggYolk', fdc: 172184, label: say('Żółtko jaja', 'Egg yolk'), group: 'eggs', portion: p(17, say('1 żółtko', '1 yolk')) },

  // Dairy. Milks "without added vitamin A and vitamin D", as Polish milk is.
  { id: 'milk', fdc: 172205, label: say('Mleko 2%', 'Milk, 2% fat'), group: 'dairy', portion: p(250, say('1 szklanka', '1 glass')), ingredient: ['milk'] },
  { id: 'milkWhole', fdc: 172217, label: say('Mleko 3,2%', 'Whole milk, 3.2% fat'), group: 'dairy', portion: p(250, say('1 szklanka', '1 glass')) },
  // US kefir is fortified with vitamins A and D; cultured reduced-fat milk is the same drink without.
  { id: 'kefir', fdc: 167697, label: say('Kefir naturalny', 'Plain kefir'), group: 'dairy', portion: p(250, say('1 kubek', '1 cup')), ingredient: ['kefir'] },
  { id: 'buttermilk', fdc: 170874, label: say('Maślanka naturalna', 'Plain buttermilk'), group: 'dairy', portion: p(250, say('1 szklanka', '1 glass')) },
  { id: 'yogurt', fdc: 171284, label: say('Jogurt naturalny (ok. 3% tłuszczu)', 'Plain yoghurt (about 3% fat)'), group: 'dairy', portion: p(150, say('1 kubek', '1 pot')) },
  // Skyr is not in SR; plain nonfat Greek yoghurt is the closest strained, fat-free dairy. Drinking
  // skyr and dairy protein drinks are the same strained milk proteins, thinner.
  { id: 'skyr', fdc: 170894, label: say('Skyr naturalny', 'Plain skyr'), group: 'dairy', portion: p(150, say('1 kubek', '1 pot')), ingredient: ['skyr', 'proteinYogurt', 'proteinDrink'] },
  // SR has no quark; dry-curd (uncreamed) cottage cheese is the same acid-set skimmed curd, a
  // little wetter (about 10 g of protein per 100 g against twaróg's 18-20).
  { id: 'quark', fdc: 172181, label: say('Twaróg chudy', 'Low-fat quark'), group: 'dairy', portion: p(100, say('¼ kostki', '¼ block')), ingredient: ['quark'] },
  { id: 'cottage', fdc: 172179, label: say('Serek wiejski', 'Cottage cheese'), group: 'dairy', portion: p(150, say('¾ opakowania', '¾ tub')), ingredient: ['cottage'] },
  { id: 'gouda', fdc: 171241, label: say('Ser żółty (gouda)', 'Gouda cheese'), group: 'dairy', portion: p(30, say('2 plastry', '2 slices')) },
  { id: 'swissCheese', fdc: 171251, label: say('Ser ementaler', 'Emmental cheese'), group: 'dairy', portion: p(30, say('2 plastry', '2 slices')) },
  { id: 'feta', fdc: 173420, label: say('Ser feta', 'Feta cheese'), group: 'dairy', portion: p(50, say('porcja', 'portion')) },
  { id: 'parmesan', fdc: 171247, label: say('Parmezan (tarty)', 'Parmesan (grated)'), group: 'dairy', portion: p(15, say('2 łyżki', '2 tablespoons')), ingredient: ['parmesan'] },

  // Legumes: dry unless tinned; dry ones roughly triple in weight when cooked.
  // Lentil pasta is milled red lentils, so the dry lentils stand in for it.
  { id: 'lentilsRed', fdc: 174284, label: say('Soczewica czerwona (sucha)', 'Red lentils (dry)'), group: 'legumes', portion: p(60, say('porcja', 'portion')), ingredient: ['lentilPasta'] },
  { id: 'lentils', fdc: 172420, label: say('Soczewica zielona lub brązowa (sucha)', 'Green or brown lentils (dry)'), group: 'legumes', portion: p(60, say('porcja', 'portion')) },
  { id: 'chickpeas', fdc: 173800, label: say('Ciecierzyca z puszki (odsączona)', 'Tinned chickpeas (drained)'), group: 'legumes', portion: p(120, say('½ puszki', '½ tin')) },
  { id: 'kidneyBeans', fdc: 174285, label: say('Fasola czerwona z puszki (odsączona)', 'Tinned red kidney beans (drained)'), group: 'legumes', portion: p(120, say('½ puszki', '½ tin')), ingredient: ['beans'] },
  { id: 'whiteBeans', fdc: 175202, label: say('Fasola biała (sucha)', 'White beans (dry)'), group: 'legumes', portion: p(60, say('porcja', 'portion')) },
  { id: 'splitPeas', fdc: 172428, label: say('Groch łuskany (suchy)', 'Split peas (dry)'), group: 'legumes', portion: p(60, say('porcja', 'portion')) },
  { id: 'greenPeas', fdc: 170016, label: say('Groszek zielony (mrożony)', 'Green peas (frozen)'), group: 'legumes', portion: p(100, say('porcja', 'portion')) },
  { id: 'soybeans', fdc: 174270, label: say('Soja (sucha)', 'Soybeans (dry)'), group: 'legumes', portion: p(50, say('porcja', 'portion')) },
  // Set with calcium sulphate and nigari, like most Polish tofu; calcium depends on the coagulant.
  { id: 'tofu', fdc: 172448, label: say('Tofu naturalne', 'Plain tofu'), group: 'legumes', portion: p(100, say('½ kostki', '½ block')) },

  // Grains, dry.
  { id: 'oats', fdc: 173904, label: say('Płatki owsiane (suche)', 'Rolled oats (dry)'), group: 'grains', portion: p(50, say('5 łyżek', '5 tablespoons')), ingredient: ['oats'] },
  { id: 'oatBran', fdc: 168872, label: say('Otręby owsiane', 'Oat bran'), group: 'grains', portion: p(20, say('2 łyżki', '2 tablespoons')) },
  { id: 'buckwheat', fdc: 170685, label: say('Kasza gryczana prażona (sucha)', 'Roasted buckwheat groats (dry)'), group: 'grains', portion: p(60, say('porcja', 'portion')) },
  { id: 'millet', fdc: 169702, label: say('Kasza jaglana (sucha)', 'Millet groats (dry)'), group: 'grains', portion: p(60, say('porcja', 'portion')) },
  { id: 'barley', fdc: 170284, label: say('Kasza pęczak (sucha)', 'Pearl barley (dry)'), group: 'grains', portion: p(60, say('porcja', 'portion')) },
  { id: 'quinoa', fdc: 168874, label: say('Komosa ryżowa (sucha)', 'Quinoa (dry)'), group: 'grains', portion: p(60, say('porcja', 'portion')) },
  { id: 'brownRice', fdc: 169703, label: say('Ryż brązowy (suchy)', 'Brown rice (dry)'), group: 'grains', portion: p(60, say('porcja', 'portion')) },
  { id: 'whiteRice', fdc: 169756, label: say('Ryż biały (suchy)', 'White rice (dry)'), group: 'grains', portion: p(60, say('porcja', 'portion')), ingredient: ['rice'] },
  // Whole grain: US whole-wheat pasta is not enriched.
  { id: 'wholeWheatPasta', fdc: 169738, label: say('Makaron pełnoziarnisty (suchy)', 'Wholewheat pasta (dry)'), group: 'grains', portion: p(80, say('porcja', 'portion')) },
  // Every US rye bread is made with enriched wheat flour (iron, folic acid); the unfortified
  // wholemeal loaf is wheat. Unfortified whole rye is the crispbread below.
  { id: 'wholemealBread', fdc: 172688, label: say('Chleb pełnoziarnisty', 'Wholemeal bread'), group: 'grains', portion: p(40, say('1 kromka', '1 slice')) },
  { id: 'wholemealRoll', fdc: 172794, label: say('Bułka grahamka', 'Wholemeal roll'), group: 'grains', portion: p(60, say('1 bułka', '1 roll')), ingredient: ['roll'] },
  { id: 'flour', fdc: 169761, label: say('Mąka pszenna', 'Wheat flour'), group: 'grains', portion: p(20, say('2 łyżki', '2 tablespoons')), ingredient: ['flour'] },
  { id: 'riceCakes', fdc: 170250, label: say('Wafle ryżowe naturalne', 'Plain rice cakes'), group: 'grains', portion: p(20, say('2 wafle', '2 cakes')), ingredient: ['riceCakes'] },
  { id: 'crispbread', fdc: 172744, label: say('Pieczywo chrupkie żytnie razowe', 'Wholemeal rye crispbread'), group: 'grains', portion: p(20, say('2 kromki', '2 slices')), ingredient: ['crispbread'] },

  // Nuts and seeds, shelled.
  { id: 'pumpkinSeeds', fdc: 170556, label: say('Pestki dyni', 'Pumpkin seeds'), group: 'nuts', portion: p(30, say('garść', 'handful')) },
  { id: 'sunflowerSeeds', fdc: 170562, label: say('Słonecznik łuskany', 'Sunflower seeds'), group: 'nuts', portion: p(20, say('2 łyżki', '2 tablespoons')) },
  { id: 'flaxseed', fdc: 169414, label: say('Siemię lniane', 'Flaxseed'), group: 'nuts', portion: p(10, say('1 łyżka', '1 tablespoon')) },
  { id: 'chia', fdc: 170554, label: say('Nasiona chia', 'Chia seeds'), group: 'nuts', portion: p(12, say('1 łyżka', '1 tablespoon')) },
  { id: 'sesame', fdc: 170150, label: say('Sezam', 'Sesame seeds'), group: 'nuts', portion: p(10, say('1 łyżka', '1 tablespoon')) },
  { id: 'walnuts', fdc: 170187, label: say('Orzechy włoskie', 'Walnuts'), group: 'nuts', portion: p(30, say('garść', 'handful')), ingredient: ['nuts'] },
  { id: 'almonds', fdc: 170567, label: say('Migdały', 'Almonds'), group: 'nuts', portion: p(30, say('garść', 'handful')) },
  { id: 'hazelnuts', fdc: 170581, label: say('Orzechy laskowe', 'Hazelnuts'), group: 'nuts', portion: p(30, say('garść', 'handful')) },
  // About 2 nuts are a day's selenium; more than a few a day passes the upper limit.
  { id: 'brazilNuts', fdc: 170569, label: say('Orzechy brazylijskie', 'Brazil nuts'), group: 'nuts', portion: p(10, say('2 orzechy', '2 nuts')) },
  { id: 'cashews', fdc: 170162, label: say('Orzechy nerkowca', 'Cashews'), group: 'nuts', portion: p(30, say('garść', 'handful')) },
  { id: 'peanutButter', fdc: 172470, label: say('Masło orzechowe (bez soli)', 'Peanut butter (unsalted)'), group: 'nuts', portion: p(15, say('1 łyżka', '1 tablespoon')) },
  // Peanut butter powder is defatted peanut flour.
  { id: 'peanutFlour', fdc: 174267, label: say('Masło orzechowe w proszku', 'Peanut butter powder'), group: 'nuts', portion: p(15, say('2 łyżki', '2 tablespoons')), ingredient: ['peanutPowder'] },

  // Vegetables, raw unless the label says otherwise.
  { id: 'spinach', fdc: 168462, label: say('Szpinak', 'Spinach'), group: 'vegetables', portion: p(100, say('porcja', 'portion')), ingredient: ['spinach'] },
  { id: 'kale', fdc: 168421, label: say('Jarmuż', 'Kale'), group: 'vegetables', portion: p(50, say('2 garście', '2 handfuls')) },
  { id: 'broccoli', fdc: 170379, label: say('Brokuł', 'Broccoli'), group: 'vegetables', portion: p(150, say('porcja', 'portion')), ingredient: ['broccoli'] },
  { id: 'cauliflower', fdc: 169986, label: say('Kalafior', 'Cauliflower'), group: 'vegetables', portion: p(150, say('porcja', 'portion')) },
  { id: 'brusselsSprouts', fdc: 170383, label: say('Brukselka', 'Brussels sprouts'), group: 'vegetables', portion: p(100, say('porcja', 'portion')) },
  { id: 'whiteCabbage', fdc: 169975, label: say('Kapusta biała', 'White cabbage'), group: 'vegetables', portion: p(100, say('porcja', 'portion')), ingredient: ['whiteCabbage'] },
  { id: 'redCabbage', fdc: 169977, label: say('Kapusta czerwona', 'Red cabbage'), group: 'vegetables', portion: p(100, say('porcja', 'portion')) },
  { id: 'chineseCabbage', fdc: 169979, label: say('Kapusta pekińska', 'Chinese leaf'), group: 'vegetables', portion: p(100, say('porcja', 'portion')), ingredient: ['pekingCabbage'] },
  // US tinned sauerkraut: pasteurised, some vitamin C lost, salty like the Polish one.
  { id: 'sauerkraut', fdc: 169279, label: say('Kapusta kiszona', 'Sauerkraut'), group: 'vegetables', portion: p(100, say('porcja', 'portion')), ingredient: ['sauerkraut'] },
  // The US "sour" gherkins are brine-fermented, as ogórki kiszone are; "dill" ones are often vinegar.
  { id: 'fermentedCucumber', fdc: 169379, label: say('Ogórki kiszone', 'Fermented gherkins'), group: 'vegetables', portion: p(70, say('1 ogórek', '1 gherkin')), ingredient: ['brinedCucumber'] },
  { id: 'beetroot', fdc: 169145, label: say('Burak ćwikłowy', 'Beetroot'), group: 'vegetables', portion: p(100, say('1 burak', '1 beetroot')) },
  { id: 'carrot', fdc: 170393, label: say('Marchew', 'Carrot'), group: 'vegetables', portion: p(80, say('1 marchewka', '1 carrot')), ingredient: ['carrot'] },
  { id: 'pumpkin', fdc: 168448, label: say('Dynia', 'Pumpkin'), group: 'vegetables', portion: p(150, say('porcja', 'portion')) },
  { id: 'tomato', fdc: 170457, label: say('Pomidor', 'Tomato'), group: 'vegetables', portion: p(120, say('1 pomidor', '1 tomato')), ingredient: ['tomato'] },
  { id: 'passata', fdc: 170460, label: say('Passata pomidorowa', 'Tomato passata'), group: 'vegetables', portion: p(125, say('½ szklanki', '½ cup')), ingredient: ['passata'] },
  { id: 'cannedTomatoes', fdc: 170051, label: say('Pomidory krojone z puszki', 'Tinned chopped tomatoes'), group: 'vegetables', portion: p(200, say('½ puszki', '½ tin')), ingredient: ['cannedTomatoes'] },
  { id: 'redPepper', fdc: 170108, label: say('Papryka czerwona', 'Red pepper'), group: 'vegetables', portion: p(80, say('½ papryki', '½ pepper')), ingredient: ['pepper'] },
  { id: 'cucumber', fdc: 168409, label: say('Ogórek (ze skórką)', 'Cucumber (with peel)'), group: 'vegetables', portion: p(100, say('½ ogórka', '½ cucumber')), ingredient: ['cucumber'] },
  { id: 'zucchini', fdc: 169291, label: say('Cukinia', 'Courgette'), group: 'vegetables', portion: p(150, say('½ cukinii', '½ courgette')), ingredient: ['zucchini'] },
  { id: 'radish', fdc: 169276, label: say('Rzodkiewka', 'Radishes'), group: 'vegetables', portion: p(50, say('5 rzodkiewek', '5 radishes')), ingredient: ['radish'] },
  { id: 'greenBeans', fdc: 169961, label: say('Fasolka szparagowa', 'Green beans'), group: 'vegetables', portion: p(100, say('porcja', 'portion')) },
  { id: 'leek', fdc: 169246, label: say('Por', 'Leek'), group: 'vegetables', portion: p(50, say('½ pora', '½ leek')) },
  { id: 'onion', fdc: 170000, label: say('Cebula', 'Onion'), group: 'vegetables', portion: p(50, say('½ cebuli', '½ onion')), ingredient: ['onion'] },
  { id: 'garlic', fdc: 169230, label: say('Czosnek', 'Garlic'), group: 'vegetables', portion: p(5, say('1 ząbek', '1 clove')), ingredient: ['garlic'] },
  { id: 'parsley', fdc: 170416, label: say('Natka pietruszki', 'Parsley leaves'), group: 'vegetables', portion: p(10, say('2 łyżki', '2 tablespoons')) },
  { id: 'dill', fdc: 172233, label: say('Koperek', 'Dill'), group: 'vegetables', portion: p(5, say('1 łyżka', '1 tablespoon')), ingredient: ['dill'] },
  { id: 'chives', fdc: 169994, label: say('Szczypiorek', 'Chives'), group: 'vegetables', portion: p(5, say('1 łyżka', '1 tablespoon')), ingredient: ['chives'] },
  // Flesh and skin: SR has no raw peeled potato.
  { id: 'potato', fdc: 170026, label: say('Ziemniaki (surowe)', 'Potatoes (raw)'), group: 'vegetables', portion: p(200, say('2 ziemniaki', '2 potatoes')), ingredient: ['potato'] },
  { id: 'mushrooms', fdc: 169251, label: say('Pieczarki', 'White mushrooms'), group: 'vegetables', portion: p(100, say('porcja', 'portion')), ingredient: ['mushrooms'] },
  { id: 'chanterelles', fdc: 168422, label: say('Kurki', 'Chanterelles'), group: 'vegetables', portion: p(100, say('porcja', 'portion')) },

  // Fruit, raw edible part.
  { id: 'blackcurrant', fdc: 173963, label: say('Czarna porzeczka', 'Blackcurrants'), group: 'fruit', portion: p(50, say('garść', 'handful')) },
  { id: 'orange', fdc: 169097, label: say('Pomarańcza', 'Orange'), group: 'fruit', portion: p(150, say('1 pomarańcza', '1 orange')) },
  { id: 'lemonJuice', fdc: 167747, label: say('Sok z cytryny', 'Lemon juice'), group: 'fruit', portion: p(15, say('1 łyżka', '1 tablespoon')), ingredient: ['lemon'] },
  { id: 'kiwi', fdc: 168153, label: say('Kiwi', 'Kiwi fruit'), group: 'fruit', portion: p(75, say('1 owoc', '1 fruit')) },
  { id: 'strawberries', fdc: 167762, label: say('Truskawki', 'Strawberries'), group: 'fruit', portion: p(150, say('miseczka', 'bowl')), ingredient: ['strawberries'] },
  { id: 'raspberries', fdc: 167755, label: say('Maliny', 'Raspberries'), group: 'fruit', portion: p(100, say('garść', 'handful')), ingredient: ['raspberries'] },
  { id: 'blueberries', fdc: 171711, label: say('Borówki amerykańskie', 'Blueberries'), group: 'fruit', portion: p(100, say('garść', 'handful')), ingredient: ['blueberries'] },
  { id: 'sourCherries', fdc: 173954, label: say('Wiśnie', 'Sour cherries'), group: 'fruit', portion: p(100, say('garść', 'handful')) },
  { id: 'banana', fdc: 173944, label: say('Banan', 'Banana'), group: 'fruit', portion: p(120, say('1 banan', '1 banana')), ingredient: ['banana'] },
  { id: 'apple', fdc: 171688, label: say('Jabłko (ze skórką)', 'Apple (with peel)'), group: 'fruit', portion: p(150, say('1 jabłko', '1 apple')), ingredient: ['apple'] },
  { id: 'pear', fdc: 169118, label: say('Gruszka', 'Pear'), group: 'fruit', portion: p(150, say('1 gruszka', '1 pear')) },
  { id: 'avocado', fdc: 171705, label: say('Awokado', 'Avocado'), group: 'fruit', portion: p(70, say('½ awokado', '½ avocado')), ingredient: ['avocado'] },
  { id: 'driedApricots', fdc: 173941, label: say('Morele suszone', 'Dried apricots'), group: 'fruit', portion: p(40, say('5 sztuk', '5 pieces')) },
  { id: 'prunes', fdc: 168162, label: say('Śliwki suszone', 'Prunes'), group: 'fruit', portion: p(40, say('5 sztuk', '5 pieces')) },

  // Fats.
  { id: 'rapeseedOil', fdc: 172336, label: say('Olej rzepakowy', 'Rapeseed oil'), group: 'fats', portion: p(10, say('1 łyżka', '1 tablespoon')), ingredient: ['oil'] },
  { id: 'oliveOil', fdc: 171413, label: say('Oliwa z oliwek', 'Olive oil'), group: 'fats', portion: p(10, say('1 łyżka', '1 tablespoon')) },
  { id: 'linseedOil', fdc: 167702, label: say('Olej lniany', 'Linseed oil'), group: 'fats', portion: p(10, say('1 łyżka', '1 tablespoon')) },
  { id: 'butter', fdc: 173430, label: say('Masło', 'Butter'), group: 'fats', portion: p(5, say('1 łyżeczka', '1 teaspoon')) },

  // Other.
  { id: 'darkChocolate', fdc: 170273, label: say('Czekolada gorzka (70–85% kakao)', 'Dark chocolate (70–85% cocoa)'), group: 'other', portion: p(20, say('4 kostki', '4 squares')) },
  { id: 'cocoa', fdc: 169593, label: say('Kakao naturalne', 'Cocoa powder'), group: 'other', portion: p(5, say('1 łyżeczka', '1 teaspoon')), ingredient: ['cocoa'] },
  { id: 'cinnamon', fdc: 171320, label: say('Cynamon', 'Cinnamon'), group: 'other', portion: p(3, say('1 łyżeczka', '1 teaspoon')), ingredient: ['cinnamon'] },
  { id: 'curry', fdc: 170924, label: say('Curry w proszku', 'Curry powder'), group: 'other', portion: p(3, say('1 łyżeczka', '1 teaspoon')), ingredient: ['curry'] },
  // The recipes' spice mix is mostly paprika.
  { id: 'paprika', fdc: 171329, label: say('Papryka słodka mielona', 'Ground paprika'), group: 'other', portion: p(3, say('1 łyżeczka', '1 teaspoon')), ingredient: ['spices'] },
  { id: 'gelatin', fdc: 169599, label: say('Żelatyna', 'Gelatine'), group: 'other', portion: p(10, say('1 łyżka', '1 tablespoon')), ingredient: ['gelatin'] },
  { id: 'espresso', fdc: 171891, label: say('Kawa espresso', 'Espresso'), group: 'other', portion: p(30, say('1 filiżanka', '1 cup')), ingredient: ['coffee'] },
  // A generic whey-based powder; branded ones may add vitamins and minerals.
  { id: 'wheyProtein', fdc: 173180, label: say('Białko serwatkowe w proszku', 'Whey protein powder'), group: 'other', portion: p(30, say('1 miarka', '1 scoop')), ingredient: ['whey'] },
  // SR has no potato starch; cornstarch is the same near-pure starch.
  { id: 'potatoStarch', fdc: 169698, label: say('Mąka ziemniaczana', 'Potato starch'), group: 'other', portion: p(10, say('1 łyżka', '1 tablespoon')), ingredient: ['potatoStarch'] },
];
