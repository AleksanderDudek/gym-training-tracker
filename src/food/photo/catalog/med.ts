import { say } from '../../../i18n';
import { FAT_COOKED, FAT_FRIED, FAT_LIGHT, FAT_RICH, GLASS, PIECE, PIECES, PIECES_FEW, PLATE, SANDWICH, SERVING, SLICE, SOUP, ml, p, sauce, sweet, type Entry } from './kit';

/** Italy, France, Spain, Portugal, Greece: more dishes. Sources in `scripts/food/dish-sources/med.ts`. */
export const ENTRIES: readonly Entry[] = [
  // --- Italy ---
  { id: 'pizzaQuattroFormaggi', label: say('Pizza cztery sery', 'Four cheese pizza'), prompts: ['four cheese pizza', 'white pizza with melted mozzarella, gorgonzola and parmesan, no tomato sauce'], group: 'pizza', portion: p(330, say('½ pizzy 32 cm', '½ of a 32 cm pizza')), adjust: { fat: FAT_COOKED } },
  { id: 'spaghettiAmatriciana', label: say('Spaghetti all’amatriciana', 'Spaghetti all’amatriciana'), prompts: ['spaghetti all amatriciana', 'spaghetti in red tomato sauce with pieces of guanciale and grated pecorino'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED, sauce: sauce('tomato', 15) } },
  { id: 'cacioEPepe', label: say('Cacio e pepe', 'Cacio e pepe'), prompts: ['cacio e pepe', 'spaghetti in a creamy pale cheese sauce with black pepper'], group: 'pasta', portion: p(300, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'spaghettiVongole', label: say('Spaghetti alle vongole', 'Spaghetti with clams'), prompts: ['spaghetti alle vongole', 'spaghetti with clams in their shells, garlic and parsley'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'spaghettiMeatballs', label: say('Spaghetti z klopsikami', 'Spaghetti and meatballs'), prompts: ['spaghetti and meatballs', 'spaghetti with large meatballs in tomato sauce'], group: 'pasta', portion: p(420, PLATE), adjust: { fat: FAT_COOKED, sauce: sauce('tomato', 15) } },
  { id: 'pastaAlForno', label: say('Pasta al forno', 'Baked pasta'), prompts: ['pasta al forno', 'baked penne with meat sauce and a browned melted cheese top in a dish'], group: 'pasta', portion: p(320, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'risottoMilanese', label: say('Risotto alla milanese', 'Saffron risotto'), prompts: ['risotto alla milanese', 'yellow saffron risotto with parmesan'], group: 'rice', portion: p(300, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'seafoodRisotto', label: say('Risotto z owocami morza', 'Seafood risotto'), prompts: ['seafood risotto', 'risotto with shrimp, mussels and clams'], group: 'rice', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'ossoBuco', label: say('Osso buco', 'Osso buco'), prompts: ['osso buco', 'braised veal shank with bone marrow in a vegetable and tomato sauce'], group: 'main', portion: p(350, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'saltimbocca', label: say('Saltimbocca alla romana', 'Saltimbocca'), prompts: ['saltimbocca', 'veal cutlets topped with prosciutto and sage leaves in a pan sauce'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'vitelloTonnato', label: say('Vitello tonnato', 'Vitello tonnato'), prompts: ['vitello tonnato', 'cold sliced veal covered with creamy tuna sauce and capers'], group: 'main', portion: p(180, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'polenta', label: say('Polenta', 'Polenta'), prompts: ['creamy polenta', 'soft yellow cornmeal polenta with butter and parmesan'], group: 'side', portion: p(250, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'porchettaSandwich', label: say('Kanapka z porchettą', 'Porchetta sandwich'), prompts: ['porchetta sandwich', 'bread roll filled with sliced roast pork with crackling'], group: 'sandwich', portion: p(220, SANDWICH), adjust: { fat: FAT_COOKED } },
  { id: 'piadina', label: say('Piadina', 'Piadina'), prompts: ['piadina', 'folded italian flatbread with prosciutto, cheese and rocket'], group: 'sandwich', portion: p(200, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'panino', label: say('Panino z szynką i mozzarellą', 'Panino with ham and mozzarella'), prompts: ['panino', 'ciabatta sandwich with ham, mozzarella and tomato'], group: 'sandwich', portion: p(210, SANDWICH), adjust: { fat: FAT_COOKED } },
  { id: 'antipastoPlatter', label: say('Antipasto – deska wędlin i serów', 'Antipasto platter'), prompts: ['antipasto platter', 'board of cured meats, salami, cheese, olives and marinated vegetables'], group: 'snack', portion: p(220, say('1 deska', '1 board')), adjust: { fat: FAT_LIGHT } },
  { id: 'prosciuttoMelone', label: say('Prosciutto z melonem', 'Prosciutto and melon'), prompts: ['prosciutto e melone', 'thin slices of cured ham draped over cantaloupe melon wedges'], group: 'snack', portion: p(250, PLATE), adjust: {} },
  { id: 'burrata', label: say('Burrata z pomidorami', 'Burrata with tomatoes'), prompts: ['burrata', 'a ball of creamy white burrata cheese with tomatoes, basil and olive oil'], group: 'salad', portion: p(220, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'frittata', label: say('Frittata', 'Frittata'), prompts: ['frittata', 'thick baked italian omelette with potatoes and vegetables, cut into wedges'], group: 'breakfast', portion: p(200, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'pastaEFagioli', label: say('Pasta e fagioli', 'Pasta and bean soup'), prompts: ['pasta e fagioli', 'thick italian soup with beans and small pasta in tomato broth'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'ribollita', label: say('Ribollita', 'Ribollita'), prompts: ['ribollita', 'thick tuscan bread soup with cannellini beans and black kale'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'affogato', label: say('Affogato', 'Affogato'), prompts: ['affogato', 'scoop of vanilla ice cream with espresso poured over it in a glass'], group: 'dessert', portion: p(170, say('1 szklaneczka', '1 glass')), adjust: { sweet: sweet(4) } },
  { id: 'biscotti', label: say('Biscotti (cantuccini)', 'Biscotti'), prompts: ['biscotti', 'hard twice-baked almond cookies'], group: 'dessert', portion: p(40, PIECES_FEW(2)), adjust: { sweet: sweet(5) } },
  { id: 'panettone', label: say('Panettone', 'Panettone'), prompts: ['panettone', 'slice of tall italian christmas bread with candied fruit and raisins'], group: 'dessert', portion: p(90, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(5) } },

  // --- France ---
  { id: 'steakFrites', label: say('Stek z frytkami', 'Steak frites'), prompts: ['steak frites', 'grilled sirloin steak with a pile of french fries'], group: 'main', portion: p(380, PLATE), adjust: { fat: FAT_FRIED } },
  { id: 'coqAuVin', label: say('Coq au vin', 'Coq au vin'), prompts: ['coq au vin', 'chicken braised in dark red wine sauce with mushrooms, bacon and pearl onions'], group: 'main', portion: p(350, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'cassoulet', label: say('Cassoulet', 'Cassoulet'), prompts: ['cassoulet', 'baked white beans with duck confit, pork sausage and a browned crust'], group: 'main', portion: p(400, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'bouillabaisse', label: say('Bouillabaisse', 'Bouillabaisse'), prompts: ['bouillabaisse', 'orange saffron fish stew with chunks of fish, mussels and shrimp'], group: 'soup', portion: p(450, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'galetteBretonne', label: say('Galette bretońska', 'Breton galette'), prompts: ['galette bretonne', 'square folded buckwheat crepe with ham, melted cheese and a fried egg in the middle'], group: 'main', portion: p(250, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'tarteTatin', label: say('Tarte tatin', 'Tarte tatin'), prompts: ['tarte tatin', 'upside-down caramelised apple tart, slice'], group: 'dessert', portion: p(130, SLICE), adjust: { fat: FAT_RICH, sweet: sweet(5) } },
  { id: 'profiteroles', label: say('Profiterole', 'Profiteroles'), prompts: ['profiteroles', 'choux puffs filled with cream or ice cream under chocolate sauce'], group: 'dessert', portion: p(160, PIECES(4)), adjust: { fat: FAT_RICH, sweet: sweet(5) } },
  { id: 'painAuChocolat', label: say('Pain au chocolat', 'Pain au chocolat'), prompts: ['pain au chocolat', 'rectangular flaky croissant pastry with chocolate inside'], group: 'dessert', portion: p(70, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(4) } },
  { id: 'duckConfit', label: say('Confit z kaczki', 'Duck confit'), prompts: ['duck confit', 'crispy-skinned duck leg confit with potatoes'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'saladeLyonnaise', label: say('Sałatka lyońska', 'Lyonnaise salad'), prompts: ['salade lyonnaise', 'frisee lettuce salad with bacon lardons, croutons and a poached egg'], group: 'salad', portion: p(250, PLATE), adjust: { fat: FAT_COOKED, sauce: sauce('vinaigrette', 4) } },
  { id: 'gratinDauphinois', label: say('Gratin dauphinois', 'Potato gratin'), prompts: ['gratin dauphinois', 'sliced potatoes baked in cream with a golden cheese top'], group: 'side', portion: p(220, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'madeleines', label: say('Magdalenki', 'Madeleines'), prompts: ['madeleines', 'small shell-shaped sponge cakes dusted with sugar'], group: 'dessert', portion: p(50, PIECES_FEW(2)), adjust: { sweet: sweet(5) } },
  { id: 'cremeCaramel', label: say('Crème caramel', 'Crème caramel'), prompts: ['creme caramel', 'custard flan turned out with dark caramel sauce on top'], group: 'dessert', portion: p(130, SERVING), adjust: { fat: FAT_RICH, sweet: sweet(5) } },

  // --- Spain ---
  { id: 'jamonPlate', label: say('Jamón ibérico (deska)', 'Iberico ham plate'), prompts: ['jamon iberico', 'plate of thin slices of dark red cured spanish ham'], group: 'snack', portion: p(80, PLATE), adjust: {} },
  { id: 'pimientosPadron', label: say('Pimientos de Padrón', 'Padron peppers'), prompts: ['pimientos de padron', 'small blistered green peppers sprinkled with coarse salt'], group: 'snack', portion: p(120, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'gambasAlAjillo', label: say('Gambas al ajillo', 'Garlic prawns'), prompts: ['gambas al ajillo', 'sizzling prawns in olive oil with garlic and chilli in a clay dish'], group: 'main', portion: p(180, say('1 naczynie', '1 dish')), adjust: { fat: FAT_COOKED } },
  { id: 'pulpoGallega', label: say('Pulpo a la gallega', 'Galician octopus'), prompts: ['pulpo a la gallega', 'sliced octopus on boiled potatoes with paprika and olive oil on a wooden plate'], group: 'main', portion: p(250, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'albondigas', label: say('Albóndigas', 'Spanish meatballs'), prompts: ['albondigas', 'spanish meatballs in tomato sauce in a clay dish'], group: 'main', portion: p(250, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'cremaCatalana', label: say('Crema catalana', 'Crema catalana'), prompts: ['crema catalana', 'cold custard in a shallow clay dish with a burnt sugar top'], group: 'dessert', portion: p(130, SERVING), adjust: { fat: FAT_RICH, sweet: sweet(5) } },
  { id: 'salmorejo', label: say('Salmorejo', 'Salmorejo'), prompts: ['salmorejo', 'thick cold pink tomato cream soup topped with ham and chopped egg'], group: 'soup', portion: p(300, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'fabada', label: say('Fabada asturiana', 'Fabada'), prompts: ['fabada asturiana', 'white bean stew with chorizo, blood sausage and pork'], group: 'main', portion: p(400, SOUP), adjust: { fat: FAT_RICH } },
  { id: 'bocadilloCalamares', label: say('Bocadillo de calamares', 'Calamari sandwich'), prompts: ['bocadillo de calamares', 'baguette filled with fried squid rings'], group: 'sandwich', portion: p(230, SANDWICH), adjust: { fat: FAT_FRIED } },
  { id: 'tapenadeToast', label: say('Grzanki z tapenadą', 'Tapenade toast'), prompts: ['tapenade crostini', 'toasted baguette slices spread with dark olive tapenade'], group: 'snack', portion: p(90, PIECES(3)), adjust: { fat: FAT_COOKED } },
  { id: 'panConTomate', label: say('Pan con tomate', 'Pan con tomate'), prompts: ['pan con tomate', 'toasted bread rubbed with red tomato and olive oil'], group: 'snack', portion: p(130, PIECES_FEW(2)), adjust: { fat: FAT_COOKED } },
  { id: 'sangria', label: say('Sangria', 'Sangria'), prompts: ['sangria', 'jug or glass of red wine punch with orange slices and fruit'], group: 'drink', portion: ml(250, GLASS), adjust: { sweet: sweet(2) } },

  // --- Portugal ---
  { id: 'pastelDeNata', label: say('Pastel de nata', 'Pastel de nata'), prompts: ['pastel de nata', 'small portuguese custard tart with a blistered top'], group: 'dessert', portion: p(65, PIECE), adjust: { fat: FAT_RICH, sweet: sweet(4) } },
  { id: 'bacalhauBras', label: say('Bacalhau à Brás', 'Bacalhau à Brás'), prompts: ['bacalhau a bras', 'shredded salt cod scrambled with egg, thin fried potato sticks and black olives'], group: 'main', portion: p(300, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'francesinha', label: say('Francesinha', 'Francesinha'), prompts: ['francesinha', 'sandwich with steak and sausage covered in melted cheese, a fried egg and orange sauce, with fries'], group: 'sandwich', portion: p(550, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'caldoVerde', label: say('Caldo verde', 'Caldo verde'), prompts: ['caldo verde', 'green kale and potato soup with slices of chorizo'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'bifana', label: say('Bifana', 'Bifana'), prompts: ['bifana', 'portuguese bread roll with thin garlic-marinated pork slices'], group: 'sandwich', portion: p(190, SANDWICH), adjust: { fat: FAT_COOKED } },
  { id: 'piriPiriChicken', label: say('Kurczak piri-piri', 'Piri-piri chicken'), prompts: ['piri piri chicken', 'charcoal grilled half chicken glazed in red chilli sauce'], group: 'main', portion: p(300, SERVING), adjust: { fat: FAT_COOKED } },

  // --- Greece ---
  { id: 'pastitsio', label: say('Pastitsio', 'Pastitsio'), prompts: ['pastitsio', 'baked greek pasta tubes with minced meat and thick bechamel top, square slice'], group: 'pasta', portion: p(300, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'gemista', label: say('Gemista', 'Gemista'), prompts: ['gemista', 'baked tomatoes and peppers stuffed with rice and herbs'], group: 'main', portion: p(350, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'fasolada', label: say('Fasolada', 'Fasolada'), prompts: ['fasolada', 'greek white bean soup with tomato, carrot and olive oil'], group: 'soup', portion: p(350, SOUP), adjust: { fat: FAT_LIGHT } },
  { id: 'loukoumades', label: say('Loukoumades', 'Loukoumades'), prompts: ['loukoumades', 'small round fried dough balls drizzled with honey and cinnamon'], group: 'dessert', portion: p(120, PIECES(6)), adjust: { fat: FAT_FRIED, sweet: sweet(5) } },
  { id: 'saganaki', label: say('Saganaki', 'Saganaki'), prompts: ['saganaki', 'golden pan-fried slab of greek cheese with lemon'], group: 'snack', portion: p(100, SERVING), adjust: { fat: FAT_FRIED } },
  { id: 'keftedes', label: say('Keftedes', 'Greek meatballs'), prompts: ['keftedes', 'small fried greek meatballs with herbs and tzatziki'], group: 'main', portion: p(180, PIECES(6)), adjust: { fat: FAT_COOKED } },
];
