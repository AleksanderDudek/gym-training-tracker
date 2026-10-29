import { F, I, food, recipe, type Source } from './kit';

/**
 * Catch-all types of the photo catalog (`src/food/photo/catalog/generic.ts`): USDA's "NFS" foods
 * where they exist, otherwise a typical plate of them.
 */
export const DISHES: Record<string, Source> = {
  genericCreamSoup: food(F(75611010, 'Soup, cream of vegetable')),
  genericVegetableSoup: food(F(75649110, 'Soup, vegetable')),
  genericMeatSoup: food(F(75656060, 'Soup, vegetable, with meat')),
  genericStew: food(F(27360000, 'Stew, NFS')),
  genericRoastPlate: recipe('roast pork, boiled potatoes, cabbage slaw', [[I.porkLoin, 130], [I.potato, 200], ['cabbageSlaw', 100]]),
  genericGrilledMeat: recipe('grilled pork shoulder and chicken thigh', [[I.porkShoulder, 100], [I.chickenThigh, 100]]),
  genericFishPlate: recipe('fish, boiled potatoes, mixed vegetables', [[F(26100110, 'Fish, NFS'), 150], [I.potato, 150], [F(75311020, 'Classic mixed vegetables, NS as to form, cooked'), 100]]),
  genericSeafood: food(F(26300000, 'Shellfish, NFS')),
  genericMixedPlate: recipe('meat in gravy, mashed potatoes, mixed vegetables', [[I.beefStew, 130], [I.gravy, 50], [I.mashed, 170], [F(75311020, 'Classic mixed vegetables, NS as to form, cooked'), 100]]),
  genericPastaCream: food(F(58146382, 'Pasta with cream sauce, home recipe')),
  genericPastaMeat: food(F(58146120, 'Pasta with tomato-based sauce, cheese and meat')),
  genericAsianNoodles: food(F(58136120, 'Lo mein, meatless')),
  genericRiceDish: food(F(58155410, 'Soupy rice with chicken, Puerto Rican style'), 'FNDDS has no plain "rice with chicken and vegetables"; this one is close in energy'),
  genericCurry: food(F(75440600, 'Vegetable curry')),
  genericBeanStew: food(F(41311020, 'Sambar, vegetable stew'), 'lentil and vegetable stew'),
  genericVegetableDish: food(F(75311027, 'Classic mixed vegetables, frozen, cooked with oil')),
  genericCasserole: food(F(77316600, 'Eggplant and meat casserole')),
  genericMeatSalad: recipe('mixed salad with chicken breast and egg', [[F(75143000, 'Lettuce, salad with assorted vegetables including tomatoes and/or carrots, no dressing'), 200], [I.chickenBreast, 70], [I.boiledEgg, 30]]),
  genericSaladDressing: recipe('mixed salad with vinaigrette', [[F(75143000, 'Lettuce, salad with assorted vegetables including tomatoes and/or carrots, no dressing'), 220], [I.vinaigrette, 20]]),
  genericSandwich: food(F(27500050, 'Sandwich, NFS')),
  genericWrap: food(F(27500300, 'Sandwich wrap, NFS')),
  genericFriedSnack: food(F(24198677, 'Chicken fillet, breaded')),
  genericCake: food(F(53100100, 'Cake or cupcake, NFS')),
  genericCreamDessert: food(F(53106500, 'Cake, cream')),
  genericSweetPastry: food(I.sweetRoll),
  genericPudding: food(F(13210410, 'Pudding, rice'), 'a milk pudding; vanilla and chocolate puddings are close'),
  genericCookies: food(F(53201000, 'Cookie, NFS')),
  genericSweets: food(F(91700010, 'Candy, NFS')),
  genericSaltySnacks: food(F(54401055, 'Cheese flavored corn snacks')),
  genericRawVegetables: food(F(75143050, 'Lettuce, salad with assorted vegetables excluding tomatoes and carrots, no dressing'), 'raw mixed vegetables, no dressing'),
  genericSweetDrink: food(F(92400000, 'Soft drink, NFS')),
  genericCocktail: food(F(93301000, 'Cocktail, NFS')),
};
