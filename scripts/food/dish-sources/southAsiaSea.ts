// USDA sources for the southAsiaSea region of the photo catalog (src/food/photo/catalog/southAsiaSea.ts):
// India and South Asia, Southeast Asia. Same rules as fetch-dishes.ts: per 100 g as served, grams as
// served in recipes, `yield` only for doughs and batters, description prefix must match.
import { F, I, S, food, recipe, type Source } from './kit';

// Ingredients used by several dishes here and not in the shared `I`.
const R = {
  riceNoodles: F(56117090, 'Rice noodles, cooked'),
  riceFlour: S(169714, 'Rice flour, white, unenriched'),
  chickpeaFlour: S(174288, 'Chickpea flour (besan)'),
  kidneyBeans: F(41106020, 'Kidney beans, from dried, no added fat'),
  lambStew: S(172509, 'Lamb, cubed for stew or kabob (leg and shoulder), separable lean only, trimmed to 1/4" fat, cooked, braised'),
  paneer: F(14110050, 'Cheese, paneer'),
  condensed: F(11220000, 'Milk, condensed, sweetened'),
  wholeMilk: F(11111000, 'Milk, whole'),
  porkBelly: F(22708020, 'Pork, belly'),
  groundChicken: F(24198720, 'Chicken, ground'),
  tilapia: F(26158010, 'Fish, tilapia, baked or broiled'),
  beanSprouts: F(75101000, 'Bean sprouts, raw'),
  cauliflower: F(99997535, 'Cauliflower, cooked, as ingredient'),
  spinach: F(72125211, 'Spinach, fresh, cooked, no added fat'),
  pineapple: F(63141010, 'Pineapple, raw'),
  brisket: F(21417100, 'Beef, brisket'),
  friedRice: F(58150310, 'Rice, fried, NFS'),
  roti: F(51300175, 'Bread, chappatti or roti'),
  paratha: F(51300185, 'Bread, paratha'),
  puri: F(51300180, 'Bread, puri'),
  idli: F(55702000, 'Idli'),
  lentilCurry: F(41311030, 'Lentil curry'),
  vegCurry: F(75440600, 'Vegetable curry'),
  puffedRice: S(173912, 'Cereals ready-to-eat, rice, puffed, fortified'),
  bambooShoots: F(75203028, 'Bamboo shoots, cooked'),
  iceCream: F(13110100, 'Ice cream, vanilla'),
};

export const DISHES: Record<string, Source> = {
  // --- India and South Asia ---
  // Tandoori is skinless chicken marinated in spiced yoghurt, roasted hot; a little ghee on the grill.
  tandooriChicken: recipe('skinless thigh roasted with a yoghurt marinade', [[I.chickenThigh, 190], [I.yogurt, 20], [I.oil, 5]]),
  roganJosh: recipe('braised lamb in tomato, onion and yoghurt gravy with oil', [[R.lambStew, 105], [I.tinnedTomatoes, 55], [I.yogurt, 25], [I.onion, 30], [I.oil, 10], [I.water, 30]]),
  // Goan vindaloo is pork (not lamb) in a vinegary red gravy.
  vindaloo: recipe('pork shoulder braised in a tomato-onion vinegar gravy', [[I.porkShoulder, 110], [I.tinnedTomatoes, 40], [I.onion, 40], [I.oil, 8], [I.water, 40]]),
  korma: recipe('chicken in a cream, yoghurt and ground almond sauce', [[I.chickenBreast, 100], [I.cream36, 35], [I.yogurt, 30], [I.almonds, 15], [I.onion, 30], [I.oil, 8], [I.water, 40]]),
  paneerTikka: recipe('grilled paneer cubes with pepper and onion, yoghurt marinade', [[R.paneer, 120], [I.pepper, 35], [I.onion, 30], [I.yogurt, 15], [I.oil, 8]]),
  malaiKofta: recipe('fried paneer-potato dumplings in a cream, tomato and almond gravy', [[R.paneer, 40], [I.potato, 30], [I.flour, 6], [I.oil, 10], [I.cream36, 25], [I.tinnedTomatoes, 60], [I.onion, 30], [I.butter, 8], [I.almonds, 10], [I.water, 40]]),
  alooGobi: recipe('potato and cauliflower dry-cooked with onion, tomato and oil', [[I.potato, 120], [R.cauliflower, 120], [I.onion, 25], [I.tomato, 30], [I.oil, 12]]),
  baingan: recipe('roasted aubergine mashed with onion, tomato and oil', [[I.eggplant, 200], [I.onion, 35], [I.tomato, 40], [I.oil, 12], [I.garlic, 3]]),
  rajma: recipe('kidney beans in a tomato-onion gravy with ghee', [[R.kidneyBeans, 180], [I.tinnedTomatoes, 70], [I.onion, 35], [I.oil, 8], [I.butter, 5], [I.water, 20]]),
  dalMakhani: recipe('black lentils and kidney beans simmered with butter, cream and tomato', [[I.lentils, 150], [R.kidneyBeans, 30], [I.tinnedTomatoes, 40], [I.butter, 15], [I.cream36, 20], [I.water, 30]]),
  // A bhatura is a leavened, deep-fried bread; the FNDDS puri (also deep-fried wheat dough) stands in.
  choleBhature: recipe('chickpea curry with a deep-fried bhatura', [[I.chickpeas, 150], [I.tomato, 60], [I.onion, 30], [I.oil, 10], [R.puri, 100]]),
  pavBhaji: recipe('buttery mashed vegetable curry with two soft rolls', [[I.potato, 80], [R.cauliflower, 40], [I.peas, 30], [I.tomato, 50], [I.onion, 25], [I.butter, 20], [I.softRoll, 80]]),
  vadaPav: recipe('spiced potato fritter in chickpea batter, in a soft roll with garlic chutney', [[I.potato, 70], [R.chickpeaFlour, 15], [I.oil, 12], [I.softRoll, 60], [I.garlic, 2]]),
  idliSambar: recipe('steamed rice-lentil cakes with sambar (lentils and vegetables)', [[R.idli, 120], [I.lentils, 90], [I.zucchini, 30], [I.tinnedTomatoes, 30], [I.water, 40], [I.oil, 3]]),
  // The uttapam batter is the idli batter, griddled with a topping.
  uttapam: recipe('thick idli-batter pancake with onion and tomato topping, griddled in oil', [[R.idli, 110], [I.onion, 30], [I.tomato, 25], [I.oil, 8]]),
  pulao: recipe('rice cooked with peas, carrot, onion and oil', [[I.rice, 190], [I.peas, 25], [I.carrot, 20], [I.onion, 20], [I.oil, 8]]),
  jeeraRice: recipe('steamed rice tempered with cumin in ghee', [[I.rice, 200], [I.butter, 6]]),
  roti: food(R.roti, 'FNDDS chapati; a roti is the same unleavened whole-wheat flatbread'),
  paratha: food(R.paratha),
  alooParatha: recipe('paratha stuffed with spiced mashed potato, brushed with ghee', [[R.paratha, 70], [I.potato, 45], [I.butter, 4]]),
  bhelPuri: recipe('puffed rice with sev, potato, onion, tomato, peanuts and sweet-tamarind chutney', [[R.puffedRice, 25], [R.chickpeaFlour, 10], [I.oil, 5], [I.potato, 30], [I.onion, 15], [I.tomato, 30], [I.peanuts, 6], [I.sugar, 6], [I.water, 15]]),
  paniPuri: recipe('six crisp puris with potato-chickpea filling and spiced water', [[R.puri, 30], [I.potato, 40], [I.chickpeas, 30], [I.water, 80], [I.sugar, 3]]),
  gulabJamun: recipe('fried milk-solid balls soaked in sugar syrup', [[R.condensed, 25], [I.flour, 14], [I.oil, 8], [I.sugar, 28], [I.water, 35]]),
  jalebi: recipe('deep-fried batter spirals soaked in sugar syrup', [[I.flour, 38], [I.oil, 14], [I.sugar, 40], [I.water, 18]]),
  kheer: recipe('rice simmered in sweetened milk with almonds', [[I.rice, 40], [R.wholeMilk, 150], [I.sugar, 12], [I.almonds, 4]]),
  mangoLassi: recipe('yoghurt, milk, mango pulp and sugar', [[I.yogurt, 120], [R.wholeMilk, 40], [I.mango, 70], [I.sugar, 12], [I.water, 20]]),
  masalaChai: recipe('black tea brewed in milk and water, with sugar', [[I.water, 120], [I.milk, 80], [I.sugar, 8]]),
  raita: recipe('yoghurt with cucumber and a little onion', [[I.yogurt, 100], [I.cucumber, 35], [I.onion, 5]]),
  keema: recipe('minced lamb cooked with peas, tomato and onion', [[I.lambGround, 100], [I.peas, 30], [I.tinnedTomatoes, 40], [I.onion, 30], [I.oil, 6], [I.water, 30]]),
  chicken65: recipe('chicken pieces in a spiced batter, deep-fried', [[I.chickenBreast, 120], [I.flour, 12], [I.oil, 14], [I.yogurt, 6]]),
  keralaFishCurry: recipe('fish simmered in a coconut milk and tomato gravy', [[R.tilapia, 120], [I.coconutMilk, 70], [I.tomato, 30], [I.onion, 20], [I.oil, 5], [I.water, 20]]),
  thali: recipe('rice, dal, vegetable curry, roti, yoghurt and a small salad', [[I.rice, 120], [R.lentilCurry, 90], [R.vegCurry, 90], [R.roti, 45], [I.yogurt, 40], [I.cucumber, 20], [I.onion, 10]]),
  // Nihari: beef slow-cooked until it falls apart, in a thin gravy thickened with flour and finished with ghee.
  nihari: recipe('braised beef in a flour-thickened gravy with ghee', [[I.beefStew, 130], [I.flour, 6], [I.butter, 10], [I.onion, 20], [I.water, 90]]),
  haleem: recipe('slow-cooked porridge of lentils, rice and shredded beef finished with oil', [[I.lentils, 90], [I.rice, 40], [I.beefStew, 60], [I.oil, 10], [I.onion, 10], [I.water, 40]]),
  momo: food(F(58112510, 'Wonton, dumpling or pot sticker, steamed'), 'steamed meat dumplings; the Nepali momo has the same wrapper and a pork, chicken or buffalo filling'),
  kottuRoti: recipe('shredded roti stir-fried with egg, chicken and vegetables', [[R.roti, 120], [I.egg, 40], [I.chickenThigh, 50], [I.cookedCabbage, 40], [I.carrot, 15], [I.onion, 15], [I.oil, 12]]),

  // --- Thailand ---
  padSeeEw: recipe('wide rice noodles stir-fried with chicken, egg, kai-lan (broccoli), dark soy and oil', [[R.riceNoodles, 200], [I.chickenThigh, 60], [I.egg, 30], [I.broccoli, 50], [I.soy, 12], [I.oil, 12], [I.sugar, 4]]),
  padKraPao: recipe('minced chicken with basil and chilli over rice, with a fried egg', [[I.rice, 150], [R.groundChicken, 80], [I.friedEgg, 50], [I.greenBeans, 20], [I.oil, 8], [I.soy, 6], [I.fishSauce, 3]]),
  massamanCurry: recipe('beef and potato in a coconut milk curry with peanuts', [[I.beefStew, 90], [I.potato, 60], [I.coconutMilk, 100], [I.onion, 20], [I.peanuts, 10], [I.sugar, 3], [I.oil, 3]]),
  redCurry: recipe('chicken in red coconut curry with bamboo shoots and pepper', [[I.chickenBreast, 90], [I.coconutMilk, 110], [R.bambooShoots, 40], [I.pepper, 30], [I.fishSauce, 5], [I.sugar, 3]]),
  panangCurry: recipe('beef in a thick red coconut curry with ground peanuts', [[I.beefStew, 90], [I.coconutMilk, 80], [I.peanuts, 15], [I.greenBeans, 20], [I.sugar, 3], [I.fishSauce, 4], [I.oil, 3]]),
  tomKhaGai: recipe('coconut chicken soup with mushrooms, lime and fish sauce', [[I.broth, 240], [I.coconutMilk, 80], [I.chickenBreast, 50], [I.mushrooms, 40], [I.lime, 8], [I.fishSauce, 6]]),
  larb: recipe('minced pork salad with shallot, lime, fish sauce, herbs and lettuce', [[I.porkGround, 100], [I.onion, 15], [I.scallion, 5], [I.lime, 8], [I.fishSauce, 6], [I.lettuce, 30]]),
  khaoSoi: recipe('egg noodles in a coconut curry broth with chicken, crisp noodles on top', [[I.noodles, 150], [I.coconutMilk, 110], [I.chickenThigh, 80], [I.broth, 150], [I.oil, 5], [I.wontonCrisps, 10]]),
  khaoManGai: recipe('rice cooked in chicken fat, poached chicken thigh, cucumber', [[I.rice, 200], [I.chickenThigh, 100], [I.oil, 6], [I.cucumber, 30], [I.soy, 5]]),
  pineappleFriedRice: recipe('fried rice with pineapple, prawns, egg and cashews', [[R.friedRice, 200], [R.pineapple, 60], [I.shrimp, 40], [I.peanuts, 8], [I.egg, 20]]),

  // --- Vietnam ---
  bunCha: recipe('grilled pork patties and rice vermicelli with herbs in a sweet fish-sauce broth', [[R.riceNoodles, 150], [I.porkGround, 90], [I.sugar, 8], [I.fishSauce, 10], [I.lettuce, 30], [I.carrot, 15], [I.water, 100]]),
  bunBoHue: recipe('spicy lemongrass beef noodle soup with rice noodles, brisket and chilli oil', [[R.riceNoodles, 170], [R.brisket, 60], [I.broth, 340], [I.onion, 15], [R.beanSprouts, 20], [I.oil, 5]]),
  comTam: recipe('broken rice with grilled pork chop, fried egg and pickled vegetables', [[I.rice, 180], [I.porkLoin, 90], [I.friedEgg, 45], [I.cucumber, 30], [I.tomato, 20], [I.fishSauce, 8], [I.oil, 5]]),
  banhXeo: recipe('crisp rice-flour and coconut crepe filled with pork belly, prawns and bean sprouts', [[R.riceFlour, 25], [I.water, 30], [I.coconutMilk, 15], [I.oil, 15], [R.porkBelly, 30], [I.shrimp, 30], [R.beanSprouts, 40]]),
  bunThitNuong: recipe('rice vermicelli bowl with grilled pork, lettuce, carrot, peanuts and nuoc cham', [[R.riceNoodles, 150], [I.porkShoulder, 80], [I.lettuce, 40], [I.carrot, 20], [I.peanuts, 8], [I.fishSauce, 8], [I.sugar, 8], [I.water, 60]]),

  // --- Indonesia, Malaysia, Singapore ---
  nasiGoreng: recipe('fried rice with sweet soy, chicken and a fried egg', [[R.friedRice, 250], [I.friedEgg, 50], [I.chickenThigh, 40], [I.soy, 8], [I.sugar, 5]]),
  mieGoreng: recipe('egg noodles stir-fried with chicken, egg, cabbage and sweet soy', [[I.noodles, 200], [I.chickenThigh, 40], [I.egg, 30], [I.cookedCabbage, 40], [I.soy, 12], [I.sugar, 5], [I.oil, 12]]),
  // Rendang is cooked until the coconut milk is gone and the beef fries in its own oil: dry and dark.
  beefRendang: recipe('beef reduced in coconut milk until dry', [[I.beefStew, 140], [I.coconutMilk, 45], [I.onion, 15]]),
  gadoGado: recipe('boiled vegetables, potato, tofu and egg with peanut sauce', [[I.potato, 80], [I.greenBeans, 60], [R.beanSprouts, 30], [I.tofu, 60], [I.boiledEgg, 50], [I.cucumber, 30], [I.peanutSauce, 70]]),
  nasiLemak: recipe('coconut rice with fried anchovies and peanuts, egg, cucumber and sambal', [[I.coconutRice, 220], [I.boiledEgg, 50], [I.friedCod, 15], [I.peanuts, 12], [I.cucumber, 25], [I.tomatoPaste, 8], [I.oil, 6], [I.sugar, 3]]),
  laksa: recipe('rice noodles in a spicy coconut curry broth with prawns, tofu, egg and sprouts', [[R.riceNoodles, 150], [I.coconutMilk, 70], [I.broth, 250], [I.shrimp, 40], [I.tofu, 20], [I.boiledEgg, 25], [R.beanSprouts, 25], [I.oil, 8]]),
  charKwayTeow: recipe('flat rice noodles wok-fried in lard with prawns, egg, sausage and bean sprouts', [[R.riceNoodles, 220], [I.shrimp, 50], [I.egg, 40], [R.beanSprouts, 40], [I.porkSausage, 15], [I.oil, 20], [I.soy, 10]]),
  hainaneseChickenRice: recipe('poached chicken thigh with skin fat on rice cooked in the broth, cucumber', [[I.rice, 220], [I.chickenThigh, 120], [I.oil, 8], [I.cucumber, 30]]),
  rotiCanai: recipe('flaky pan-fried flatbread with lentil curry', [[R.paratha, 120], [R.lentilCurry, 80]]),
  sotoAyam: recipe('turmeric chicken soup with vermicelli, egg and bean sprouts', [[I.broth, 350], [I.chickenBreast, 60], [R.riceNoodles, 40], [I.boiledEgg, 30], [R.beanSprouts, 20], [I.oil, 3]]),
  bakso: recipe('beef meatball soup with rice noodles, sprouts and broth', [[I.beefGround, 90], [I.flour, 15], [I.broth, 300], [R.riceNoodles, 60], [R.beanSprouts, 20]]),

  // --- Philippines and Cambodia ---
  // FNDDS Filipino adobo comes with rice, as it is eaten.
  chickenAdobo: food(F(58150530, 'Adobo, with rice'), 'chicken or pork braised in soy sauce and vinegar, served with rice'),
  sinigang: recipe('sour tamarind soup with pork, radish, tomato, beans and greens', [[I.broth, 250], [I.porkShoulder, 80], [I.tomato, 40], [I.radish, 30], [I.greenBeans, 30], [R.spinach, 30], [I.onion, 10]]),
  lechon: recipe('roast suckling pig: meat with crackling skin and fat', [[I.porkShoulder, 100], [R.porkBelly, 40]]),
  pancit: recipe('thin rice noodles stir-fried with chicken, prawns, cabbage and carrot', [[R.riceNoodles, 200], [I.chickenBreast, 50], [I.shrimp, 20], [I.cookedCabbage, 40], [I.carrot, 25], [I.soy, 10], [I.oil, 10]]),
  lumpia: food(F(58110130, 'Egg roll, with beef and/or pork'), 'lumpia shanghai are thin deep-fried pork rolls, close to the FNDDS egg roll'),
  haloHalo: recipe('shaved ice with milk, ice cream, sweet beans, banana and jackfruit', [[I.water, 145], [R.wholeMilk, 50], [R.condensed, 25], [R.iceCream, 40], [I.banana, 20], [R.kidneyBeans, 20], [I.sugar, 10]]),
  thaiIcedTea: recipe('strong tea with sugar, condensed milk and milk over ice', [[I.water, 250], [R.condensed, 25], [I.sugar, 15], [R.wholeMilk, 40]]),
  eggCurry: recipe('boiled eggs in an onion-tomato gravy with oil', [[I.boiledEgg, 100], [I.tinnedTomatoes, 60], [I.onion, 40], [I.oil, 10], [I.water, 30]]),
  fishAmok: recipe('steamed fish in a coconut milk and egg custard', [[R.tilapia, 100], [I.coconutMilk, 80], [I.egg, 25], [I.fishSauce, 4], [I.greenBeans, 10]]),
};
