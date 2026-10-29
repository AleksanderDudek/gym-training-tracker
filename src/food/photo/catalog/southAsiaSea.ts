import { say } from '../../../i18n';
import { BIG_GLASS, BOWL, FAT_COOKED, FAT_FRIED, FAT_LIGHT, FAT_RICH, MUG, PIECE, PIECES, PIECES_FEW, PLATE, SERVING, SMALL_BOWL, ml, p, sauce, sweet, type Entry } from './kit';

/**
 * India and South Asia, Southeast Asia (more). The catalog already has butter chicken / tikka masala,
 * dal, chana masala, biryani, naan, palak paneer, dosa, pakora, samosa, Thai green curry, tom yum, som tam,
 * satay, mango sticky rice, bánh mì, summer rolls, pad thai, pho and congee; they are not repeated here.
 * The curries are told apart by what they look like: colour of the sauce, the main ingredient.
 */
export const ENTRIES: readonly Entry[] = [
  // --- India and South Asia ---
  { id: 'tandooriChicken', label: say('Kurczak tandoori', 'Tandoori chicken'), prompts: ['tandoori chicken', 'bright red-orange charred chicken legs on a plate with onion and lemon'], group: 'main', portion: p(220, say('2 kawałki', '2 pieces')), adjust: { fat: FAT_COOKED } },
  { id: 'roganJosh', label: say('Rogan josh', 'Rogan josh'), prompts: ['rogan josh', 'lamb curry in a deep red-brown oily gravy'], group: 'main', portion: p(280, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'vindaloo', label: say('Vindaloo', 'Vindaloo'), prompts: ['vindaloo', 'very dark red spicy pork curry with potato'], group: 'main', portion: p(280, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'korma', label: say('Korma', 'Chicken korma'), prompts: ['chicken korma', 'pale cream-coloured creamy curry with chicken and almonds'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_RICH } },
  { id: 'paneerTikka', label: say('Paneer tikka', 'Paneer tikka'), prompts: ['paneer tikka', 'grilled cheese cubes on skewers with peppers and onion'], group: 'main', portion: p(185, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'malaiKofta', label: say('Malai kofta', 'Malai kofta'), prompts: ['malai kofta', 'fried round dumplings in a creamy orange sauce'], group: 'main', portion: p(280, BOWL), adjust: { fat: FAT_RICH } },
  { id: 'alooGobi', label: say('Aloo gobi', 'Aloo gobi'), prompts: ['aloo gobi', 'dry yellow curry of potato and cauliflower florets'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'baingan', label: say('Baingan bharta', 'Baingan bharta'), prompts: ['baingan bharta', 'smoky mashed aubergine curry with tomato and onion'], group: 'main', portion: p(250, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'rajma', label: say('Rajma (curry z czerwonej fasoli)', 'Rajma'), prompts: ['rajma', 'red kidney bean curry in a thick brown-red gravy'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'dalMakhani', label: say('Dal makhani', 'Dal makhani'), prompts: ['dal makhani', 'creamy dark brown black lentil curry with a swirl of cream'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_RICH } },
  { id: 'choleBhature', label: say('Chole bhature', 'Chole bhature'), prompts: ['chole bhature', 'chickpea curry with a puffed deep-fried bread'], group: 'main', portion: p(350, PLATE), adjust: { fat: FAT_FRIED } },
  { id: 'pavBhaji', label: say('Pav bhaji', 'Pav bhaji'), prompts: ['pav bhaji', 'orange-red mashed vegetable curry with butter and two soft buns'], group: 'main', portion: p(330, PLATE), adjust: { fat: FAT_RICH } },
  { id: 'vadaPav', label: say('Vada pav', 'Vada pav'), prompts: ['vada pav', 'potato fritter in a soft bun with green chutney'], group: 'sandwich', portion: p(150, PIECE), adjust: { fat: FAT_FRIED } },
  { id: 'idliSambar', label: say('Idli z sambarem', 'Idli with sambar'), prompts: ['idli sambar', 'white steamed rice cakes with a bowl of lentil vegetable soup and coconut chutney'], group: 'main', portion: p(300, PLATE), adjust: { fat: FAT_LIGHT } },
  { id: 'uttapam', label: say('Uttapam', 'Uttapam'), prompts: ['uttapam', 'thick south indian pancake topped with onion and tomato'], group: 'main', portion: p(170, PIECE), adjust: { fat: FAT_COOKED } },
  { id: 'pulao', label: say('Pulao (ryż z warzywami)', 'Vegetable pulao'), prompts: ['vegetable pulao', 'spiced basmati rice with peas and carrot'], group: 'rice', portion: p(280, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'jeeraRice', label: say('Ryż z kminem (jeera rice)', 'Jeera rice'), prompts: ['jeera rice', 'basmati rice with cumin seeds'], group: 'side', portion: p(200, SERVING), adjust: { fat: FAT_LIGHT } },
  { id: 'roti', label: say('Roti (czapati)', 'Roti (chapati)'), prompts: ['roti', 'chapati', 'round thin whole wheat indian flatbread'], group: 'side', portion: p(80, PIECES_FEW(2)), adjust: { fat: FAT_COOKED } },
  { id: 'paratha', label: say('Paratha', 'Paratha'), prompts: ['paratha', 'flaky layered golden indian flatbread'], group: 'side', portion: p(80, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'alooParatha', label: say('Aloo paratha', 'Aloo paratha'), prompts: ['aloo paratha', 'potato stuffed indian flatbread with butter and yoghurt'], group: 'main', portion: p(130, PIECE), adjust: { fat: FAT_RICH } },
  { id: 'bhelPuri', label: say('Bhel puri', 'Bhel puri'), prompts: ['bhel puri', 'indian street snack of puffed rice, crispy noodles, onion and chutneys'], group: 'snack', portion: p(150, SERVING), adjust: {} },
  { id: 'paniPuri', label: say('Pani puri', 'Pani puri'), prompts: ['pani puri', 'small hollow crisp balls filled with potato and spiced water'], group: 'snack', portion: p(180, PIECES(6)), adjust: {} },
  { id: 'gulabJamun', label: say('Gulab jamun', 'Gulab jamun'), prompts: ['gulab jamun', 'dark brown fried milk balls soaked in syrup'], group: 'dessert', portion: p(110, PIECES_FEW(2)), adjust: { fat: FAT_RICH, sweet: sweet(8) } },
  { id: 'jalebi', label: say('Jalebi', 'Jalebi'), prompts: ['jalebi', 'bright orange crispy spirals soaked in sugar syrup'], group: 'dessert', portion: p(80, PIECES_FEW(3)), adjust: { fat: FAT_FRIED, sweet: sweet(10) } },
  { id: 'kheer', label: say('Kheer (indyjski pudding ryżowy)', 'Kheer'), prompts: ['kheer', 'indian rice pudding with almonds in a bowl'], group: 'dessert', portion: p(200, SMALL_BOWL), adjust: { fat: FAT_LIGHT, sweet: sweet(3) } },
  { id: 'mangoLassi', label: say('Lassi mango', 'Mango lassi'), prompts: ['mango lassi', 'thick yellow mango yoghurt drink in a glass'], group: 'drink', portion: ml(300, BIG_GLASS), adjust: { fat: FAT_LIGHT, sweet: sweet(2.5) } },
  { id: 'masalaChai', label: say('Masala chai', 'Masala chai'), prompts: ['masala chai', 'spiced milk tea in a small glass or clay cup'], group: 'drink', portion: ml(200, MUG), adjust: { sweet: sweet(1.7) } },
  { id: 'raita', label: say('Raita', 'Raita'), prompts: ['raita', 'white yoghurt with cucumber in a small bowl'], group: 'side', portion: p(100, SMALL_BOWL), adjust: { fat: FAT_LIGHT } },
  { id: 'keema', label: say('Keema (mielone mięso z groszkiem)', 'Keema'), prompts: ['keema', 'minced lamb curry with green peas'], group: 'main', portion: p(250, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'chicken65', label: say('Chicken 65', 'Chicken 65'), prompts: ['chicken 65', 'red-orange fried spicy chicken bites with curry leaves'], group: 'snack', portion: p(150, SERVING), adjust: { fat: FAT_FRIED } },
  { id: 'keralaFishCurry', label: say('Curry rybne z Kerali', 'Kerala fish curry'), prompts: ['kerala fish curry', 'fish pieces in a red-orange coconut curry'], group: 'main', portion: p(280, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'thali', label: say('Thali', 'Thali'), prompts: ['indian thali', 'round metal tray with rice, dal, vegetable curries, roti and yoghurt in small bowls'], group: 'main', portion: p(450, say('1 tacka thali', '1 thali')), adjust: { fat: FAT_COOKED } },
  { id: 'nihari', label: say('Nihari', 'Nihari'), prompts: ['nihari', 'slow cooked beef stew in a thin brown gravy with ginger and chilli'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_RICH } },
  { id: 'haleem', label: say('Haleem', 'Haleem'), prompts: ['haleem', 'thick porridge-like lentil and meat stew with fried onion and lemon'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'momo', label: say('Momo', 'Momo'), prompts: ['momo', 'steamed nepalese dumplings with spicy red tomato chutney'], group: 'main', portion: p(160, PIECES(8)), adjust: { fat: FAT_LIGHT } },
  { id: 'kottuRoti', label: say('Kottu roti', 'Kottu roti'), prompts: ['kottu roti', 'chopped flatbread stir-fried with egg, vegetables and meat'], group: 'main', portion: p(350, PLATE), adjust: { fat: FAT_FRIED } },

  // --- Thailand ---
  { id: 'padSeeEw', label: say('Pad see ew', 'Pad see ew'), prompts: ['pad see ew', 'wide flat rice noodles stir-fried dark brown with chicken and green broccoli'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'padKraPao', label: say('Pad kra pao (mielone mięso z bazylią)', 'Pad kra pao'), prompts: ['pad kra pao', 'minced chicken with holy basil over rice with a crispy fried egg'], group: 'rice', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'massamanCurry', label: say('Curry massaman', 'Massaman curry'), prompts: ['massaman curry', 'brown coconut curry with beef, potato and peanuts'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'redCurry', label: say('Czerwone curry', 'Thai red curry'), prompts: ['thai red curry', 'orange-red coconut curry with chicken, bamboo shoots and red pepper'], group: 'main', portion: p(300, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'panangCurry', label: say('Curry panang', 'Panang curry'), prompts: ['panang curry', 'thick dark red coconut curry with sliced beef and kaffir lime leaf'], group: 'main', portion: p(250, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'tomKhaGai', label: say('Tom kha gai', 'Tom kha gai'), prompts: ['tom kha gai', 'creamy white coconut soup with chicken, mushrooms and herbs'], group: 'soup', portion: p(400, BOWL), adjust: { fat: FAT_LIGHT } },
  { id: 'larb', label: say('Larb (sałatka z mielonego mięsa)', 'Larb'), prompts: ['larb', 'thai minced pork salad with herbs and lime on lettuce leaves'], group: 'salad', portion: p(170, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'khaoSoi', label: say('Khao soi', 'Khao soi'), prompts: ['khao soi', 'northern thai curry noodle soup with chicken leg and crispy noodles on top'], group: 'soup', portion: p(500, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'khaoManGai', label: say('Khao man gai', 'Khao man gai'), prompts: ['khao man gai', 'thai chicken and rice with cucumber and brown ginger sauce'], group: 'rice', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'pineappleFriedRice', label: say('Smażony ryż z ananasem', 'Pineapple fried rice'), prompts: ['pineapple fried rice', 'fried rice served in a halved pineapple with prawns and cashews'], group: 'rice', portion: p(330, PLATE), adjust: { fat: FAT_COOKED } },

  // --- Vietnam ---
  { id: 'bunCha', label: say('Bún chả', 'Bún chả'), prompts: ['bun cha', 'grilled pork patties in broth with a plate of rice vermicelli and fresh herbs'], group: 'pasta', portion: p(400, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'bunBoHue', label: say('Bún bò Huế', 'Bún bò Huế'), prompts: ['bun bo hue', 'spicy red beef noodle soup with thick round rice noodles and chilli oil'], group: 'soup', portion: p(600, say('1 duża miska', '1 large bowl')), adjust: { fat: FAT_LIGHT } },
  { id: 'comTam', label: say('Cơm tấm (ryż z grillowaną wieprzowiną)', 'Cơm tấm'), prompts: ['com tam', 'broken rice with grilled pork chop, fried egg and pickled vegetables'], group: 'rice', portion: p(400, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'banhXeo', label: say('Bánh xèo', 'Bánh xèo'), prompts: ['banh xeo', 'large crispy yellow vietnamese crepe folded over prawns and bean sprouts'], group: 'main', portion: p(200, PIECE), adjust: { fat: FAT_FRIED } },
  { id: 'bunThitNuong', label: say('Bún thịt nướng', 'Bún thịt nướng'), prompts: ['bun thit nuong', 'vietnamese bowl of rice vermicelli with grilled pork, lettuce, herbs and peanuts'], group: 'pasta', portion: p(420, BOWL), adjust: { fat: FAT_COOKED } },

  // --- Indonesia, Malaysia, Singapore ---
  { id: 'nasiGoreng', label: say('Nasi goreng', 'Nasi goreng'), prompts: ['nasi goreng', 'dark brown indonesian fried rice topped with a fried egg and prawn crackers'], group: 'rice', portion: p(380, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'mieGoreng', label: say('Mie goreng', 'Mie goreng'), prompts: ['mie goreng', 'dark brown indonesian fried egg noodles with vegetables and chicken'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'beefRendang', label: say('Rendang wołowy', 'Beef rendang'), prompts: ['beef rendang', 'dry dark brown spicy beef cooked in coconut, with rice on the side'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_COOKED } },
  { id: 'gadoGado', label: say('Gado-gado', 'Gado-gado'), prompts: ['gado gado', 'indonesian salad of boiled vegetables, egg and tofu with peanut sauce'], group: 'salad', portion: p(380, PLATE), adjust: { sauce: sauce('peanut', 9) } },
  { id: 'nasiLemak', label: say('Nasi lemak', 'Nasi lemak'), prompts: ['nasi lemak', 'coconut rice with egg, cucumber, peanuts, anchovies and red sambal on banana leaf'], group: 'rice', portion: p(340, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'laksa', label: say('Laksa', 'Laksa'), prompts: ['laksa', 'orange spicy coconut curry noodle soup with prawns, tofu puffs and egg'], group: 'soup', portion: p(580, say('1 duża miska', '1 large bowl')), adjust: { fat: FAT_COOKED } },
  { id: 'charKwayTeow', label: say('Char kway teow', 'Char kway teow'), prompts: ['char kway teow', 'wok-fried flat rice noodles with prawns, egg and bean sprouts'], group: 'pasta', portion: p(380, PLATE), adjust: { fat: FAT_FRIED } },
  { id: 'hainaneseChickenRice', label: say('Ryż z kurczakiem hainańskim', 'Hainanese chicken rice'), prompts: ['hainanese chicken rice', 'sliced pale poached chicken on glossy rice with cucumber and chilli sauce'], group: 'rice', portion: p(380, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'rotiCanai', label: say('Roti canai', 'Roti canai'), prompts: ['roti canai', 'flaky pan-fried flatbread served with a small bowl of curry'], group: 'main', portion: p(200, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'sotoAyam', label: say('Soto ayam', 'Soto ayam'), prompts: ['soto ayam', 'yellow turmeric chicken soup with vermicelli, egg and fried shallots'], group: 'soup', portion: p(500, BOWL), adjust: { fat: FAT_LIGHT } },
  { id: 'bakso', label: say('Bakso', 'Bakso'), prompts: ['bakso', 'indonesian meatball soup with noodles in clear broth'], group: 'soup', portion: p(500, BOWL), adjust: { fat: FAT_LIGHT } },

  // --- Philippines and Cambodia ---
  { id: 'chickenAdobo', label: say('Adobo z kurczaka z ryżem', 'Chicken adobo with rice'), prompts: ['chicken adobo', 'filipino dark soy-glazed braised chicken with white rice'], group: 'main', portion: p(380, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'sinigang', label: say('Sinigang', 'Sinigang'), prompts: ['sinigang', 'sour filipino soup with pork, radish, tomato and green leaves'], group: 'soup', portion: p(450, BOWL), adjust: { fat: FAT_LIGHT } },
  { id: 'lechon', label: say('Lechon (pieczony prosiak)', 'Lechon'), prompts: ['lechon', 'roast suckling pig with shiny crispy golden skin, chopped'], group: 'main', portion: p(140, SERVING), adjust: { fat: FAT_RICH } },
  { id: 'pancit', label: say('Pancit', 'Pancit'), prompts: ['pancit', 'filipino thin rice noodle stir-fry with chicken, cabbage, carrot and a lemon wedge'], group: 'pasta', portion: p(350, PLATE), adjust: { fat: FAT_COOKED } },
  { id: 'lumpia', label: say('Lumpia', 'Lumpia'), prompts: ['lumpia', 'thin golden crispy filipino spring rolls with sweet chilli dip'], group: 'snack', portion: p(90, PIECES(5)), adjust: { fat: FAT_FRIED } },
  { id: 'haloHalo', label: say('Halo-halo', 'Halo-halo'), prompts: ['halo halo', 'tall glass of shaved ice with colourful beans, jelly, fruit, ice cream and milk'], group: 'dessert', portion: ml(340, BIG_GLASS), adjust: { sweet: sweet(3) } },
  { id: 'thaiIcedTea', label: say('Tajska mrożona herbata', 'Thai iced tea'), prompts: ['thai iced tea', 'bright orange iced milk tea in a tall glass'], group: 'drink', portion: ml(350, BIG_GLASS), adjust: { fat: FAT_LIGHT, sweet: sweet(2) } },
  { id: 'eggCurry', label: say('Curry z jajek', 'Egg curry'), prompts: ['egg curry', 'halved boiled eggs in an orange-red onion tomato gravy'], group: 'main', portion: p(240, BOWL), adjust: { fat: FAT_COOKED } },
  { id: 'fishAmok', label: say('Amok rybny', 'Fish amok'), prompts: ['fish amok', 'cambodian soft steamed fish curry in coconut custard, served in banana leaf'], group: 'main', portion: p(220, SERVING), adjust: { fat: FAT_COOKED } },
];
