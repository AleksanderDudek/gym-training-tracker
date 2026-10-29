import { F, I, food, recipe, type Source } from './kit';

// The Americas: USA, Canada, Mexico, Latin America and the Caribbean. FNDDS is US survey food, so
// the US and Mexican dishes are mostly one FNDDS food; the South American ones are composed from
// grams as served. Cooked weights throughout; a dough that loses water on the griddle carries a `yield`.

const cornTortilla = F(52215100, 'Tortilla, corn');
const refriedBeans = F(41205010, 'Refried beans');
const blackBeans = F(41102010, 'Black beans, from dried, fat added');
const cheddar = F(14104100, 'Cheese, Cheddar');
const queso = F(14133000, 'Queso Fresco');
const asadero = F(14131500, 'Queso Asadero');
const cilantro = F(75109550, 'Cilantro, raw');
const friedChickenPiece = F(24107070, 'Chicken, NS as to part, fried, coated, skin / coating eaten');
const brisket = F(21417100, 'Beef, brisket');
const plantainFried = F(71900200, 'Plantain, cooked with oil');
const flank = F(21101160, 'Beef, steak, flank');
const steak = F(21101000, 'Beef, steak, NFS');
const graham = F(54102010, 'Graham crackers');
const marshmallow = F(91723000, 'Candy, marshmallow');
const condensed = F(11220000, 'Milk, condensed, sweetened');
const dulce = F(13252200, 'Dulce de leche');
const cocoa = F(11830150, 'Cocoa powder, not reconstituted');
const tunaSalad = F(27450060, 'Tuna salad, made with mayonnaise');
const guac = F(63409010, 'Guacamole, NFS');
const chia = F(43108010, 'Chia seeds');
const brownSugar = F(91102010, 'Sugar, brown');
const coconut = F(42106020, 'Coconut, packaged');
const pork = F(22002000, 'Pork, ground');
const spanishRice = F(58163430, 'Spanish rice, NS as to fat');
const kidney = F(41106010, 'Kidney beans, from dried, fat added');
const rinds = F(22709010, 'Pork skin rinds');
const pineapple = F(63141010, 'Pineapple, raw');
const freshCorn = F(75216111, 'Corn, fresh, cooked, no added fat');
const thigh = F(24152300, 'Chicken thigh, rotisserie, skin eaten');

export const DISHES: Record<string, Source> = {
  // --- USA, Canada ---
  // Sliced smoked brisket with a little sauce; FNDDS brisket is braised, the lean/fat mix of a plate.
  bbqBrisket: recipe('sliced brisket with barbecue sauce', [[brisket, 160], [I.bbq, 20]]),
  cornOnTheCob: food(F(75216135, 'Corn, fresh, cooked with butter or margarine'), 'kernels only; the cob is not counted in the portion'),
  cornbread: food(F(52202060, 'Cornbread, made from home recipe')),
  biscuitsAndGravy: food(F(58128000, 'Biscuit with gravy')),
  // Syrup stands in as honey (SR maple syrup is not among the shared ingredients).
  chickenAndWaffles: recipe('fried chicken, a waffle, butter and syrup', [[friedChickenPiece, 150], [F(55201000, 'Waffle, plain'), 100], [I.butter, 5], [I.honey, 20]]),
  friedCatfish: food(F(26107140, 'Fish, catfish, fried')),
  gumbo: food(F(27363000, 'Gumbo with rice')),
  jambalaya: food(F(27363100, 'Jambalaya with meat and rice')),
  poBoy: recipe('fried shrimp in a baguette with lettuce, tomato, remoulade', [[I.friedShrimp, 100], [I.baguette, 100], [I.lettuce, 15], [I.tomato, 25], [I.mayo, 15]]),
  reubenSandwich: food(F(27510950, 'Reuben sandwich')),
  pastramiSandwich: recipe('rye bread, pastrami, Swiss cheese, mustard, gherkin', [[I.ryeBread, 80], [F(25221215, 'Pastrami, NFS'), 120], [F(14109010, 'Cheese, Swiss'), 25], [F(75506010, 'Mustard'), 8], [I.gherkins, 20]]),
  tunaMelt: recipe('toast, tuna salad, melted cheddar', [[I.toast, 70], [tunaSalad, 100], [cheddar, 35], [I.butter, 5]]),
  // FNDDS Cobb salad has the chicken, bacon and egg; the ranch is the restaurant dressing.
  cobbSalad: recipe('Cobb salad without dressing, plus ranch', [[F(75148010, 'Cobb salad, no dressing'), 250], [I.ranch, 35]]),
  chefSalad: recipe('lettuce and vegetables, ham, chicken, cheddar, egg, ranch', [[I.mixedSalad, 160], [I.ham, 35], [I.chickenBreast, 35], [cheddar, 20], [I.boiledEgg, 40], [I.ranch, 30]]),
  chiliDog: recipe('FNDDS chili hot dog without the bun, in a bun', [[F(27120210, 'Chili hot dog, no bun'), 140], [I.hotDogBun, 55]]),
  sloppyJoe: food(F(27510100, 'Sloppy joe sandwich, on white bun')),
  // Tater tots are shredded, fried potato: the ready-to-heat hash brown is the nearest FNDDS food.
  taterTots: food(F(71405040, 'Potato, hash brown, ready-to-heat')),
  hashBrowns: food(F(71404000, 'Potato, hash brown, NFS')),
  bananaSplit: food(F(13121120, 'Banana split')),
  pecanPie: food(F(53385000, 'Pie, pecan')),
  pumpkinPie: food(F(53347000, 'Pie, pumpkin')),
  keyLimePie: food(F(53305800, 'Pie, key lime')),
  smores: recipe('graham crackers, toasted marshmallow, chocolate', [[graham, 22], [marshmallow, 20], [I.darkChocolate, 12]]),
  potRoast: recipe('pot roast with carrots, potatoes and gravy', [[F(21407000, 'Beef, pot roast'), 150], [I.cookedCarrot, 60], [I.potato, 80], [I.gravy, 40]]),
  thanksgivingPlate: recipe('roast turkey, stuffing, mashed potatoes, gravy, cranberry sauce, green beans', [[F(24201330, 'Turkey, light and dark meat, roasted, skin eaten'), 120], [F(51182010, 'Bread stuffing'), 80], [I.mashed, 100], [I.gravy, 40], [F(63207110, 'Cranberry sauce'), 30], [I.greenBeans, 50]]),
  greenBeanCasserole: food(F(75403020, 'Green bean casserole')),
  locoMoco: recipe('rice, beef patty, fried egg, brown gravy', [[I.rice, 150], [I.beefGround, 120], [I.friedEgg, 50], [I.gravy, 80]]),
  spamMusubi: recipe('rice and fried Spam wrapped in nori', [[I.rice, 100], [F(25230530, 'Spam'), 40], [I.nori, 2], [I.soy, 3]]),
  // Nashville hot: fried chicken brushed with spiced hot oil, on white bread with gherkin slices.
  nashvilleHotChicken: recipe('fried chicken, hot oil, white bread, gherkins', [[friedChickenPiece, 170], [I.oil, 10], [I.bread, 25], [I.gherkins, 15]]),
  chickenTenders: food(F(24198741, 'Chicken tenders or strips, breaded, from fast food')),
  mozzarellaSticks: food(F(14660200, 'Mozzarella sticks, breaded, baked, or fried')),
  jalapenoPoppers: food(F(75410550, 'Stuffed jalapeno pepper')),
  chickenFriedSteak: recipe('breaded fried steak with cream gravy', [[F(21104110, 'Beef, steak, country fried'), 170], [F(27120120, 'Sausage gravy'), 90]]),
  veggieBurger: food(F(41901010, 'Veggie burger, on bun')),
  turkeySandwich: food(F(27540020, 'Turkey sandwich on white, with cheese')),
  pbjSandwich: food(F(42302015, 'Peanut butter and jelly sandwich, with regular peanut butter')),
  // Açaí pulp is not in the data; blueberries and banana are the nearest bowl base.
  acaiBowl: recipe('blended blueberries and banana as the açaí base, granola, strawberries, honey', [[I.blueberries, 120], [I.banana, 100], [I.granola, 35], [I.strawberries, 45], [I.honey, 10], [chia, 5]]),
  smoothieBowl: recipe('blended banana and strawberries with yoghurt, granola, chia, coconut', [[I.banana, 130], [I.strawberries, 90], [I.yogurt, 70], [I.granola, 30], [chia, 8], [coconut, 5]]),
  overnightOats: recipe('oats soaked in milk and yoghurt, berries, chia, honey', [[I.oats, 35], [I.milk, 130], [I.yogurt, 50], [I.blueberries, 45], [chia, 5], [I.honey, 8]]),
  butterTarts: recipe('pastry shell with butter, sugar, egg and syrup filling', [[I.flour, 20], [I.butter, 22], [brownSugar, 30], [I.egg, 10], [I.honey, 12]]),
  nanaimoBar: recipe('crumb base, custard butter icing, chocolate top', [[graham, 25], [I.butter, 25], [I.powderedSugar, 30], [coconut, 8], [I.darkChocolate, 17], [I.almonds, 5], [I.milk, 5]]),
  // The Québec meat pie: pork, potato and onion in a short crust.
  tourtiere: recipe('short crust with spiced pork, potato and onion', [[I.flour, 35], [I.butter, 20], [pork, 85], [I.potato, 35], [I.onion, 10]]),

  // --- Mexico ---
  tacosAlPastor: recipe('corn tortillas, spit-roast pork, pineapple, onion, cilantro, salsa', [[cornTortilla, 55], [I.porkShoulder, 70], [pineapple, 15], [I.onion, 12], [cilantro, 3], [I.salsa, 15]]),
  carnitas: recipe('braised pork with corn tortillas, onion, cilantro, salsa', [[F(22002050, 'Pork, carnitas'), 120], [cornTortilla, 50], [I.onion, 10], [cilantro, 3], [I.salsa, 20]]),
  birriaTacos: recipe('corn tortillas fried in the stew fat with braised beef and cheese, a cup of consommé', [[cornTortilla, 50], [I.beefStew, 80], [asadero, 25], [I.oil, 6], [I.broth, 40]]),
  tamales: food(F(58103125, 'Tamale, pork')),
  // FNDDS pozole is a thin broth; the bowl here has the pork and the hominy.
  pozole: recipe('hominy, pork, broth, cabbage, radish', [[F(75217520, 'Hominy, cooked'), 120], [I.porkShoulder, 50], [I.broth, 180], [I.cabbage, 20], [I.radish, 10]]),
  molePoblano: food(F(27146160, 'Chicken with mole sauce')),
  chilaquiles: food(F(58100360, 'Chilaquiles')),
  elote: recipe('corn with mayonnaise, cotija cheese and lime', [[freshCorn, 120], [I.mayo, 12], [F(14134000, 'Queso cotija'), 10], [I.lime, 3]]),
  tostadas: recipe('fried corn tostadas with refried beans, chicken, lettuce, tomato, cheese, cream', [[cornTortilla, 40], [I.oil, 6], [refriedBeans, 50], [I.chickenBreast, 50], [I.lettuce, 20], [I.tomato, 20], [queso, 12], [I.sourCream, 12]]),
  sopes: recipe('thick masa shells with refried beans, chicken, lettuce, cheese, salsa and cream', [[F(52208760, 'Gordita/sope shell, plain, no filling'), 70], [refriedBeans, 40], [I.chickenBreast, 40], [I.lettuce, 15], [queso, 12], [I.salsa, 15], [I.sourCream, 10]]),
  taquitos: food(F(58104835, 'Taquito, chicken')),
  // Soaked sponge: flour, egg, sugar, three milks, whipped cream.
  tresLechesCake: recipe('sponge soaked in condensed milk, milk and cream, with whipped cream', [[I.flour, 25], [I.egg, 30], [I.sugar, 25], [condensed, 35], [I.milk, 40], [I.cream36, 25], [I.whippedCream, 20]]),
  flan: food(F(13210350, 'Flan')),
  horchata: food(F(92610030, 'Horchata, made with milk')),
  mexicanRiceAndBeans: recipe('Spanish rice with refried beans', [[spanishRice, 150], [refriedBeans, 120]]),
  carneAsada: recipe('grilled flank steak with guacamole, salsa, onion and corn tortillas', [[flank, 150], [guac, 40], [I.salsa, 25], [I.onion, 20], [cornTortilla, 40]]),

  // --- Brazil ---
  feijoada: recipe('black beans stewed with pork and sausage, with rice', [[blackBeans, 150], [I.porkShoulder, 45], [I.kielbasa, 35], [I.bacon, 10], [I.rice, 100]]),
  // Pão de queijo is a cassava-starch and cheese ball; potato flour stands in for the starch.
  paoDeQueijo: recipe('starch dough with cheese, milk, egg, oil; baked', [[I.potatoStarch, 35], [asadero, 35], [I.milk, 25], [I.egg, 15], [I.oil, 8]], { yield: 0.85 }),
  coxinha: recipe('fried dough teardrop with shredded chicken and cream cheese', [[I.flour, 28], [I.water, 30], [I.chickenBreast, 40], [I.creamCheese, 12], [I.breadcrumbs, 10], [I.oil, 9], [I.onion, 5]]),
  // Rump cap is grilled with its fat: steak with a little extra fat.
  picanha: recipe('grilled rump cap with its fat and coarse salt', [[steak, 190], [I.butter, 5]]),
  moqueca: recipe('white fish stewed in coconut milk with tomato, peppers, onion, palm oil', [[F(26158110, 'Fish, white, mixed species, baked or broiled'), 140], [I.coconutMilk, 80], [I.tomato, 50], [I.pepper, 30], [I.onion, 25], [I.oil, 8]]),
  brigadeiro: recipe('condensed milk cooked with cocoa and butter, rolled in sprinkles', [[condensed, 60], [cocoa, 6], [I.butter, 6], [I.sugar, 8]]),

  // --- Andes, Rio de la Plata ---
  lomoSaltado: recipe('stir-fried beef with onion, tomato and soy, with fries and rice', [[F(21103180, 'Beef, steak, tenderloin'), 100], [I.onion, 50], [I.tomato, 50], [I.soy, 10], [I.oil, 8], [I.fries, 100], [I.rice, 130]]),
  ajiDeGallina: recipe('shredded chicken in a creamy yellow-pepper walnut sauce with potatoes, rice and egg', [[I.chickenBreast, 100], [I.walnuts, 10], [I.parmesan, 8], [I.oil, 10], [I.milk, 40], [I.potato, 80], [I.rice, 100], [I.boiledEgg, 30], [I.olives, 5]]),
  causaLimena: recipe('yellow potato mashed with oil and lime, layered with tuna salad and avocado', [[I.potato, 160], [I.oil, 8], [I.lime, 5], [tunaSalad, 60], [I.avocado, 30], [I.boiledEgg, 20]]),
  // Beef heart skewers with potato and corn.
  anticuchos: recipe('grilled beef heart skewers with potato and corn', [[F(25120000, 'Heart'), 120], [I.potato, 70], [freshCorn, 50], [I.oil, 5]]),
  empanadas: food(F(58116117, 'Empanada, beef')),
  asado: recipe('grilled steak, sausage, blood sausage and a little salsa criolla', [[steak, 120], [I.porkSausage, 80], [I.bloodSausage, 40], [I.tomato, 15], [I.onion, 8], [I.pepper, 7]]),
  // No FNDDS breaded beef cutlet: cubed steak is breaded and pan-fried.
  milanesa: recipe('beef cutlet coated in egg and breadcrumbs, pan-fried', [[F(21101150, 'Beef, steak, cube'), 140], [I.egg, 15], [I.breadcrumbs, 20], [I.oil, 14]]),
  choripan: recipe('grilled pork sausage in a baguette with chimichurri', [[I.baguette, 80], [I.porkSausage, 110], [I.oliveOil, 5], [I.tomato, 20]]),
  alfajores: recipe('two crumbly butter cookies with dulce de leche, coconut-rolled edge', [[I.flour, 20], [I.potatoStarch, 15], [I.butter, 15], [I.sugar, 8], [dulce, 25], [coconut, 3], [I.yolk, 5]]),

  // --- Colombia, Venezuela, Central America ---
  // Griddled masa arepa with melted cheese (arepa de queso); cooked masa is porridge, so the dough loses water.
  arepas: recipe('griddled corn masa arepa with cheese', [[F(56201600, 'Masa harina, cooked'), 120], [asadero, 30], [I.oil, 4]], { yield: 0.8 }),
  pabellonCriollo: recipe('shredded beef, black beans, rice and fried plantain', [[I.beefStew, 100], [I.tomatoSauce, 20], [blackBeans, 90], [I.rice, 110], [plantainFried, 70]]),
  bandejaPaisa: recipe('beans, rice, ground beef, fried pork belly, chorizo, fried egg, plantain, avocado', [[F(41104010, 'Pinto beans, from dried, fat added'), 100], [I.rice, 110], [I.beefGround, 60], [rinds, 25], [F(25220710, 'Chorizo'), 40], [I.friedEgg, 50], [plantainFried, 50], [I.avocado, 40]]),
  pupusas: food(F(58105120, 'Pupusa, meat, with beans')),
  galloPinto: recipe('rice and black beans fried with onion and pepper', [[I.rice, 140], [blackBeans, 90], [I.onion, 10], [I.pepper, 8], [I.oil, 5]]),

  // --- Caribbean ---
  ropaVieja: recipe('shredded flank in a tomato and pepper sauce', [[flank, 130], [I.tinnedTomatoes, 50], [I.pepper, 30], [I.onion, 25], [I.oil, 8], [I.olives, 5]]),
  cubanSandwich: food(F(27520410, 'Cuban sandwich')),
  jerkChicken: recipe('chicken thigh grilled with jerk spices, skin on', [[thigh, 200], [I.oil, 4]]),
  // Rice and peas: kidney beans and rice cooked in coconut milk.
  riceAndPeas: recipe('rice and kidney beans cooked in coconut milk', [[I.rice, 120], [kidney, 50], [I.coconutMilk, 30], [I.scallion, 3]]),
  friedPlantains: food(plantainFried),
  mofongo: recipe('mashed fried green plantain with pork crackling, garlic and olive oil', [[plantainFried, 150], [rinds, 20], [I.garlic, 4], [I.oliveOil, 6]]),
  arrozConPollo: recipe('yellow rice cooked with chicken, peas, pepper and tomato', [[F(56205170, 'Yellow rice, cooked, fat added'), 150], [thigh, 90], [I.peas, 20], [I.pepper, 20], [I.tinnedTomatoes, 15]]),
  subSandwich: recipe('submarine roll with ham, provolone, lettuce, tomato, mayonnaise and Italian dressing', [[F(51157000, 'Roll, white, hoagie, submarine'), 100], [I.ham, 50], [F(14108400, 'Cheese, Provolone'), 30], [I.lettuce, 25], [I.tomato, 30], [I.mayo, 12], [I.vinaigrette, 8]]),
};
