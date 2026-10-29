import { say } from '../../../i18n';
import { BOWL, FAT_COOKED, FAT_FRIED, FAT_RICH, GLASS, PIECE, PIECES_FEW, PLATE, SERVING, SLICE, SOUP, ml, p, sauce, sweet, type Entry } from './kit';

/** Turkey, the Levant, Iran, North and Sub-Saharan Africa, the Caucasus and Central Asia. Sources: `scripts/food/dish-sources/meaCaucasus.ts`. */
export const ENTRIES: readonly Entry[] = [
  // --- Turkey ---
  { id: 'iskenderKebab', label: say('Iskender kebab', 'Iskender kebab'), prompts: ['iskender kebab', 'sliced doner meat on pieces of bread with tomato sauce, melted butter and yoghurt'], group: 'main', portion: p(380, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'adanaKebab', label: say('Kebab adana', 'Adana kebab'), prompts: ['adana kebab', 'long minced lamb kebab skewer with flatbread, grilled tomato and onion'], group: 'main', portion: p(300, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'pide', label: say('Pide (turecka łódka z mięsem lub serem)', 'Pide'), prompts: ['turkish pide', 'boat-shaped flatbread baked with minced meat or cheese filling'], group: 'pizza', portion: p(300, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'manti', label: say('Manti (tureckie pierożki z jogurtem)', 'Manti'), prompts: ['manti', 'tiny turkish meat dumplings under garlic yoghurt and red paprika butter'], group: 'main', portion: p(320, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'gozleme', label: say('Gözleme', 'Gözleme'), prompts: ['gozleme', 'thin griddled turkish flatbread folded over spinach and feta'], group: 'snack', portion: p(220, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'simit', label: say('Simit (turecki obwarzanek)', 'Simit'), prompts: ['simit', 'turkish sesame bread ring'], group: 'snack', portion: p(105, PIECE), adjust: {} },
  { id: 'kunefe', label: say('Künefe', 'Künefe'), prompts: ['kunefe', 'golden shredded pastry dessert with melted cheese and syrup, topped with pistachios'], group: 'dessert', portion: p(150, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(5) } },
  { id: 'turkishDelight', label: say('Rahat lokum', 'Turkish delight'), prompts: ['turkish delight', 'soft cubes of lokum dusted with powdered sugar'], group: 'dessert', portion: p(40, PIECES_FEW(3)), adjust: { sweet: sweet(8) } },
  { id: 'imamBayildi', label: say('Imam bayildi (bakłażan faszerowany)', 'Imam bayildi'), prompts: ['imam bayildi', 'whole eggplant halves stuffed with braised onion and tomato in olive oil'], group: 'main', portion: p(270, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'sucukEggs', label: say('Sucuk z jajkami', 'Sucuk with eggs'), prompts: ['sucuk and eggs', 'turkish spicy sausage slices fried in a pan with eggs'], group: 'breakfast', portion: p(220, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'turkishTea', label: say('Herbata po turecku', 'Turkish tea'), prompts: ['turkish tea in a tulip glass', 'small hourglass glass of dark red tea on a saucer'], group: 'drink', portion: ml(100, say('1 szklaneczka', '1 tulip glass')), adjust: { sweet: sweet(1.7, 'none') } },
  { id: 'turkishCoffee', label: say('Kawa po turecku', 'Turkish coffee'), prompts: ['turkish coffee', 'small cup of thick foamy coffee with grounds'], group: 'drink', portion: ml(60, say('1 filiżanka', '1 small cup')), adjust: { sweet: sweet(1.5) } },
  { id: 'ayran', label: say('Ayran', 'Ayran'), prompts: ['ayran', 'glass of cold salty yoghurt drink'], group: 'drink', portion: ml(250, GLASS), adjust: {} },
  { id: 'mintTea', label: say('Marokańska herbata miętowa', 'Moroccan mint tea'), prompts: ['moroccan mint tea', 'pale green tea with fresh mint leaves in a small decorated glass'], group: 'drink', portion: ml(150, say('1 szklaneczka', '1 glass')), adjust: { sweet: sweet(1.5) } },
  { id: 'halva', label: say('Chałwa sezamowa', 'Tahini halva'), prompts: ['tahini halva', 'crumbly block of sesame halva with pistachios'], group: 'dessert', portion: p(40, SLICE), adjust: { sweet: sweet(6) } },

  // --- Levant and Egypt ---
  { id: 'fattoush', label: say('Fattusz (sałatka z chrupiącym pita)', 'Fattoush'), prompts: ['fattoush', 'lebanese salad with chopped vegetables and crispy pieces of fried pita bread'], group: 'salad', portion: p(250, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'kibbeh', label: say('Kibbeh', 'Kibbeh'), prompts: ['kibbeh', 'fried torpedo-shaped bulgur croquettes filled with minced lamb'], group: 'snack', portion: p(120, PIECES_FEW(2)), adjust: { fat: FAT_FRIED } },
  { id: 'manakish', label: say("Manakish z za'atarem", "Manakish za'atar"), prompts: ['manakish', "round flatbread baked with a green za'atar and olive oil topping"], group: 'pizza', portion: p(130, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'mansaf', label: say('Mansaf', 'Mansaf'), prompts: ['mansaf', 'jordanian lamb on a flatbread and rice platter with white yoghurt sauce and almonds'], group: 'rice', portion: p(450, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'maqluba', label: say('Maqluba (ryż do góry nogami)', 'Maqluba'), prompts: ['maqluba', 'upside-down rice cake unmolded with chicken and fried eggplant and cauliflower'], group: 'rice', portion: p(400, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'labneh', label: say('Labneh', 'Labneh'), prompts: ['labneh', 'thick strained yoghurt spread swirled on a plate with olive oil and herbs'], group: 'snack', portion: p(80, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'fulMedames', label: say('Ful medames (bób po egipsku)', 'Ful medames'), prompts: ['ful medames', 'stewed fava beans with olive oil, lemon and chopped tomato in a bowl'], group: 'main', portion: p(260, BOWL), adjust: { fat: FAT_RICH } },
  { id: 'shishTawook', label: say('Szisz tawuk', 'Shish tawook'), prompts: ['shish tawook', 'grilled marinated chicken cubes on skewers with garlic sauce and pickles'], group: 'main', portion: p(210, say('2 szaszłyki', '2 skewers')), adjust: { fat: FAT_COOKED, sauce: sauce('garlic', 6) } },
  { id: 'mixedGrill', label: say('Mieszany grill arabski', 'Mixed grill plate'), prompts: ['arabic mixed grill platter', 'kofta, chicken and lamb skewers on a plate with rice, flatbread and grilled vegetables'], group: 'main', portion: p(460, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'muhammara', label: say('Muhammara', 'Muhammara'), prompts: ['muhammara', 'red roasted pepper and walnut dip with olive oil'], group: 'snack', portion: p(60, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'sabich', label: say('Sabich', 'Sabich'), prompts: ['sabich', 'pita stuffed with fried eggplant slices, boiled egg, tahini and salad'], group: 'sandwich', portion: p(300, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'koshari', label: say('Koszari', 'Koshari'), prompts: ['koshari', 'egyptian mix of rice, lentils, macaroni and chickpeas with tomato sauce and crispy fried onions'], group: 'rice', portion: p(400, BOWL), adjust: { fat: FAT_COOKED } },

  // --- Iran ---
  { id: 'cheloKoobideh', label: say('Chelo kebab koobideh', 'Chelo kebab koobideh'), prompts: ['chelo kebab koobideh', 'persian minced meat kebab skewers on saffron rice with a grilled tomato and butter'], group: 'rice', portion: p(440, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'ghormehSabzi', label: say('Ghormeh sabzi (irański gulasz ziołowy)', 'Ghormeh sabzi'), prompts: ['ghormeh sabzi', 'dark green persian herb stew with lamb and red beans next to white rice'], group: 'main', portion: p(450, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'fesenjan', label: say('Fesendżan (kurczak w orzechach i granacie)', 'Fesenjan'), prompts: ['fesenjan', 'chicken in a thick dark brown walnut and pomegranate sauce with rice'], group: 'main', portion: p(430, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'tahdig', label: say('Tahdig (chrupiący ryż)', 'Tahdig'), prompts: ['tahdig', 'golden crispy crust of persian rice cut in pieces'], group: 'side', portion: p(150, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'ashReshteh', label: say('Asz reszte (zupa z makaronem i ziołami)', 'Ash reshteh'), prompts: ['ash reshteh', 'thick green persian noodle and bean soup with white kashk swirl and fried onion'], group: 'soup', portion: p(400, SOUP), adjust: { fat: FAT_COOKED } },

  // --- North Africa ---
  { id: 'chickenTagine', label: say('Tadżin z kurczakiem', 'Chicken tagine'), prompts: ['chicken tagine', 'moroccan chicken stew with olives and preserved lemon in a conical clay pot'], group: 'main', portion: p(400, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'couscousRoyal', label: say('Kuskus królewski', 'Couscous royal'), prompts: ['couscous royal', 'mound of couscous with lamb, chicken, sausage, chickpeas and vegetables'], group: 'main', portion: p(550, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'harira', label: say('Harira', 'Harira'), prompts: ['harira', 'moroccan tomato soup with lentils, chickpeas and herbs'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_COOKED } },
  { id: 'brik', label: say('Brik (smażony pasztecik z jajkiem)', 'Brik'), prompts: ['brik', 'deep-fried triangle of thin pastry with an egg inside, tunisian'], group: 'snack', portion: p(130, PIECE), adjust: { fat: FAT_FRIED } },
  { id: 'merguez', label: say('Merguez', 'Merguez'), prompts: ['merguez', 'grilled thin red spicy lamb sausages'], group: 'main', portion: p(100, PIECES_FEW(2)), adjust: { fat: FAT_COOKED } },
  { id: 'pastilla', label: say('Pastilla (marokański pasztet w cieście)', 'Pastilla'), prompts: ['pastilla', 'round flaky moroccan pie dusted with powdered sugar and cinnamon'], group: 'main', portion: p(200, SLICE), adjust: { fat: FAT_RICH } },

  // --- Sub-Saharan Africa ---
  { id: 'jollofRice', label: say('Ryż jollof', 'Jollof rice'), prompts: ['jollof rice', 'west african orange-red spicy tomato rice'], group: 'rice', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'egusiFufu', label: say('Zupa egusi z fufu', 'Egusi soup with fufu'), prompts: ['egusi soup with fufu', 'west african thick melon seed stew with greens and meat next to a ball of pounded fufu'], group: 'main', portion: p(450, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'suya', label: say('Suya (nigeryjskie szaszłyki wołowe)', 'Suya'), prompts: ['suya', 'thinly sliced grilled beef skewers coated in spicy peanut powder with raw onion and tomato'], group: 'main', portion: p(150, say('2 szaszłyki', '2 skewers')), adjust: { fat: FAT_COOKED } },
  { id: 'injeraDoroWat', label: say('Injera z doro wat', 'Injera with doro wat'), prompts: ['injera with doro wat', 'ethiopian spongy flatbread with spicy red chicken stew and a boiled egg'], group: 'main', portion: p(400, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'bobotie', label: say('Bobotie', 'Bobotie'), prompts: ['bobotie', 'south african baked spiced mince with golden egg topping beside yellow rice'], group: 'main', portion: p(380, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'bunnyChow', label: say('Bunny chow', 'Bunny chow'), prompts: ['bunny chow', 'hollowed out quarter loaf of bread filled with curry'], group: 'main', portion: p(400, PIECE), adjust: { fat: FAT_COOKED, sauce: sauce('curry', 8) } },
  { id: 'chakalaka', label: say('Chakalaka', 'Chakalaka'), prompts: ['chakalaka', 'south african spicy vegetable and baked bean relish'], group: 'side', portion: p(150, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'mandazi', label: say('Mandazi', 'Mandazi'), prompts: ['mandazi', 'east african fried triangles of lightly sweet dough'], group: 'snack', portion: p(80, PIECES_FEW(2)), adjust: { fat: FAT_FRIED, sweet: sweet(3) } },
  { id: 'maafe', label: say('Maafe (afrykański gulasz orzechowy)', 'Maafe'), prompts: ['maafe', 'west african peanut stew with chicken served on rice'], group: 'main', portion: p(450, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'biltong', label: say('Biltong (suszona wołowina)', 'Biltong'), prompts: ['biltong', 'strips of dark dried cured south african beef'], group: 'snack', portion: p(30, say('garść', 'a handful')), adjust: {} },
  { id: 'okraStew', label: say('Gulasz z okry', 'Okra stew'), prompts: ['okra stew', 'west african slimy green okra soup with red palm oil'], group: 'main', portion: p(250, BOWL), adjust: { fat: FAT_RICH } },

  // --- Caucasus ---
  { id: 'khachapuriAdjaruli', label: say('Chaczapuri adżarskie', 'Khachapuri adjaruli'), prompts: ['khachapuri adjaruli', 'georgian boat-shaped cheese bread with a runny egg yolk and butter in the middle'], group: 'main', portion: p(300, say('½ łódki', '½ boat')), adjust: { fat: FAT_RICH } },
  { id: 'khinkali', label: say('Chinkali (gruzińskie pierogi z rosołem)', 'Khinkali'), prompts: ['khinkali', 'large georgian dumplings twisted at the top, filled with meat and broth'], group: 'main', portion: p(320, PIECES_FEW(4)), adjust: { fat: FAT_RICH } },
  { id: 'shashlik', label: say('Szaszłyk (szaszłyki z grilla)', 'Shashlik'), prompts: ['shashlik', 'large grilled chunks of marinated meat on a metal skewer with raw onion rings'], group: 'main', portion: p(220, say('2 szaszłyki', '2 skewers')), adjust: { fat: FAT_COOKED } },
  { id: 'lobio', label: say('Lobio (gruzińska fasola z orzechami)', 'Lobio'), prompts: ['lobio', 'georgian stewed kidney beans with walnuts and herbs in a clay bowl'], group: 'main', portion: p(250, BOWL), adjust: { fat: FAT_COOKED } },

  // --- Central Asia ---
  { id: 'plov', label: say('Plow uzbecki', 'Plov'), prompts: ['uzbek plov', 'oily rice pilaf with chunks of lamb, yellow carrot strips and a whole garlic head'], group: 'rice', portion: p(400, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'lagman', label: say('Lagman', 'Lagman'), prompts: ['lagman', 'central asian soup with long hand-pulled noodles, lamb and peppers'], group: 'soup', portion: p(450, SOUP), adjust: { fat: FAT_COOKED } },
  { id: 'samsa', label: say('Samsa', 'Samsa'), prompts: ['samsa', 'golden baked triangular puff pastry pies with meat filling sprinkled with sesame'], group: 'snack', portion: p(130, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'chebureki', label: say('Czebureki', 'Chebureki'), prompts: ['chebureki', 'large fried half-moon turnovers with a blistered crispy crust filled with meat'], group: 'snack', portion: p(150, PIECE), adjust: { fat: FAT_FRIED } },
];
