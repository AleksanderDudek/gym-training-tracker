import { say } from '../../../i18n';
import { BOWL, FAT_COOKED, FAT_FRIED, FAT_LIGHT, FAT_RICH, GLASS, PIECE, PLATE, SANDWICH, SERVING, SLICE, SMALL_BOWL, SOUP, ml, p, sauce, sweet, type Entry } from './kit';

/**
 * Catch-all types: what a photo shows when the catalog has no name for it — „a cream soup”,
 * „meat stew”, „a mixed dinner plate”. Values are USDA's "NFS" (not further specified) foods or a
 * typical plate composed of them, so an estimate exists for any meal. Marked `generic`: a named
 * dish that fits about as well goes first (`score.ts`). Their names end in „— inne/inna”, so the
 * screen does not pretend to know the dish.
 */
const G = { generic: true } as const;

export const ENTRIES: readonly Entry[] = [
  { id: 'genericCreamSoup', label: say('Zupa krem — inna', 'Cream soup — other'), prompts: ['a bowl of smooth cream soup', 'a pureed vegetable soup in a bowl'], group: 'soup', portion: p(300, SOUP), adjust: { fat: FAT_LIGHT }, ...G },
  { id: 'genericVegetableSoup', label: say('Zupa warzywna — inna', 'Vegetable soup — other'), prompts: ['a bowl of clear soup with vegetables', 'a broth soup with chopped vegetables'], group: 'soup', portion: p(300, SOUP), adjust: {}, ...G },
  { id: 'genericMeatSoup', label: say('Zupa z mięsem — inna', 'Soup with meat — other'), prompts: ['a bowl of soup with pieces of meat and vegetables', 'a hearty meat and vegetable soup'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT }, ...G },
  { id: 'genericStew', label: say('Gulasz, potrawka — inne', 'Stew — other'), prompts: ['a meat stew with thick sauce', 'chunks of meat stewed in gravy in a bowl'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED }, ...G },
  { id: 'genericRoastPlate', label: say('Mięso pieczone z ziemniakami i surówką — inne', 'Roast meat with potatoes and salad — other'), prompts: ['a dinner plate with roast meat, potatoes and a side salad', 'sliced roast meat with boiled potatoes and vegetables'], group: 'main', portion: p(450, PLATE), adjust: { fat: FAT_COOKED, sauce: sauce('gravy', 6) }, ...G },
  { id: 'genericGrilledMeat', label: say('Mięso z grilla — inne', 'Grilled meat — other'), prompts: ['grilled meat on a plate', 'pieces of barbecued meat with grill marks'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_RICH }, ...G },
  { id: 'genericFishPlate', label: say('Ryba z dodatkami — inna', 'Fish with sides — other'), prompts: ['a fish fillet with potatoes and vegetables on a plate', 'cooked fish served with sides'], group: 'main', portion: p(400, PLATE), adjust: { fat: FAT_COOKED }, ...G },
  { id: 'genericSeafood', label: say('Owoce morza — inne', 'Seafood — other'), prompts: ['a plate of cooked seafood', 'shrimp and shellfish on a plate'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_COOKED }, ...G },
  { id: 'genericMixedPlate', label: say('Obiad na talerzu (mięso, dodatki) — inny', 'Dinner plate (meat and sides) — other'), prompts: ['a home-cooked dinner plate with meat, a starch and vegetables', 'a lunch plate with several foods'], group: 'main', portion: p(450, PLATE), adjust: { fat: FAT_COOKED, sauce: sauce('gravy', 6) }, ...G },
  { id: 'genericPastaCream', label: say('Makaron w sosie śmietanowym — inny', 'Pasta with cream sauce — other'), prompts: ['pasta in a creamy white sauce', 'noodles with a cream sauce on a plate'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_RICH }, ...G },
  { id: 'genericPastaMeat', label: say('Makaron z mięsem i sosem — inny', 'Pasta with meat sauce — other'), prompts: ['pasta with meat and tomato sauce', 'a pasta dish with minced meat and cheese'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED }, ...G },
  { id: 'genericAsianNoodles', label: say('Makaron azjatycki z warzywami — inny', 'Asian noodles with vegetables — other'), prompts: ['stir-fried noodles with vegetables', 'a bowl of asian noodles'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED, sauce: sauce('soy', 2) }, ...G },
  { id: 'genericRiceDish', label: say('Danie z ryżem — inne', 'Rice dish — other'), prompts: ['a rice dish with meat and vegetables', 'a plate of rice mixed with chicken and vegetables'], group: 'rice', portion: p(350, PLATE), adjust: { fat: FAT_COOKED }, ...G },
  { id: 'genericCurry', label: say('Curry warzywne — inne', 'Vegetable curry — other'), prompts: ['a vegetable curry in a bowl', 'vegetables in a yellow curry sauce'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED }, ...G },
  { id: 'genericBeanStew', label: say('Danie z fasolą lub soczewicą — inne', 'Bean or lentil stew — other'), prompts: ['a bean stew in a bowl', 'cooked beans or lentils in sauce'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED }, ...G },
  { id: 'genericVegetableDish', label: say('Warzywa duszone lub smażone — inne', 'Cooked vegetables — other'), prompts: ['a plate of cooked mixed vegetables', 'sauteed vegetables in a pan'], group: 'side', portion: p(250, SERVING), adjust: { fat: FAT_COOKED }, ...G },
  { id: 'genericCasserole', label: say('Zapiekanka — inna', 'Casserole — other'), prompts: ['a baked casserole with melted cheese on top', 'a slice of oven bake in a dish'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_RICH }, ...G },
  { id: 'genericMeatSalad', label: say('Sałatka z mięsem — inna', 'Salad with meat — other'), prompts: ['a green salad topped with meat or chicken', 'a mixed salad bowl with chicken, egg and vegetables'], group: 'salad', portion: p(300, BOWL), adjust: { sauce: sauce('vinaigrette', 4) }, ...G },
  { id: 'genericSaladDressing', label: say('Sałatka warzywna z sosem — inna', 'Vegetable salad with dressing — other'), prompts: ['a mixed vegetable salad with dressing', 'chopped salad vegetables in a bowl'], group: 'salad', portion: p(250, BOWL), adjust: { sauce: sauce('vinaigrette', 4) }, ...G },
  { id: 'genericSandwich', label: say('Kanapka, bułka z dodatkami — inna', 'Sandwich — other'), prompts: ['a sandwich with filling', 'a filled bread roll cut in half'], group: 'sandwich', portion: p(200, SANDWICH), adjust: { fat: FAT_COOKED, sauce: sauce('mayo', 3) }, ...G },
  { id: 'genericWrap', label: say('Wrap, tortilla z nadzieniem — inna', 'Wrap — other'), prompts: ['a tortilla wrap with filling', 'a rolled wrap sandwich cut in half'], group: 'sandwich', portion: p(250, PIECE), adjust: { fat: FAT_COOKED, sauce: sauce('mayo', 3) }, ...G },
  { id: 'genericFriedSnack', label: say('Coś smażonego w panierce — inne', 'Fried breaded food — other'), prompts: ['deep fried breaded food', 'golden fried pieces in batter'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_FRIED }, ...G },
  { id: 'genericCake', label: say('Ciasto — inne', 'Cake — other'), prompts: ['a slice of cake', 'a piece of homemade cake on a plate'], group: 'dessert', portion: p(110, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(7) }, ...G },
  { id: 'genericCreamDessert', label: say('Ciastko z kremem — inne', 'Cream pastry — other'), prompts: ['a cream cake pastry', 'a dessert with whipped cream layers'], group: 'dessert', portion: p(120, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(6) }, ...G },
  { id: 'genericSweetPastry', label: say('Słodka bułka, drożdżówka — inna', 'Sweet pastry — other'), prompts: ['a sweet bakery pastry', 'a glazed sweet roll'], group: 'dessert', portion: p(100, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(5) }, ...G },
  { id: 'genericPudding', label: say('Deser w pucharku — inny', 'Dessert cup — other'), prompts: ['a creamy dessert in a glass cup', 'a pudding dessert in a small bowl'], group: 'dessert', portion: p(150, SMALL_BOWL), adjust: { sweet: sweet(5) }, ...G },
  { id: 'genericCookies', label: say('Ciastka, herbatniki — inne', 'Cookies — other'), prompts: ['a few cookies on a plate', 'biscuits'], group: 'snack', portion: p(40, say('3 ciastka', '3 cookies')), adjust: { fat: FAT_RICH, sweet: sweet(4) }, ...G },
  { id: 'genericSweets', label: say('Słodycze — inne', 'Sweets — other'), prompts: ['candy and sweets', 'a handful of colourful candies'], group: 'snack', portion: p(40, SERVING), adjust: {}, ...G },
  { id: 'genericSaltySnacks', label: say('Słone przekąski — inne', 'Salty snacks — other'), prompts: ['a bowl of salty snacks', 'crunchy chips and puffs'], group: 'snack', portion: p(50, SMALL_BOWL), adjust: { fat: FAT_FRIED }, ...G },
  { id: 'genericRawVegetables', label: say('Warzywa surowe — inne', 'Raw vegetables — other'), prompts: ['sliced raw vegetables', 'fresh vegetables cut on a plate'], group: 'side', portion: p(150, SERVING), adjust: {}, ...G },
  { id: 'genericSweetDrink', label: say('Napój słodzony — inny', 'Sweet drink — other'), prompts: ['a glass of a sweet soft drink', 'a fizzy drink with ice'], group: 'drink', portion: ml(330, GLASS), adjust: {}, ...G },
  { id: 'genericCocktail', label: say('Drink alkoholowy — inny', 'Cocktail — other'), prompts: ['a mixed alcoholic cocktail in a glass', 'a colourful cocktail with ice and a straw'], group: 'drink', portion: ml(200, GLASS), adjust: { sweet: sweet(2) }, ...G },
];
