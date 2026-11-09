import { say } from '../../i18n';
import type { Recipe } from './catalog';

type Source = NonNullable<Recipe['inspiredBy']>;

/** Patryk Chmielarz's recipe page: the dish's idea came from there. */
function chmielarz(title: string, slug: string): Source {
  return { title, url: `https://dietetykchmielarz.pl/przepisy/${slug}/`, site: 'dietetykchmielarz.pl' };
}

/** Dietetyk Powszechny's recipe page: the dish's idea came from there. */
function powszechny(title: string, slug: string): Source {
  return { title, url: `https://dietetykpowszechny.pl/przepis/${slug}/`, site: 'dietetykpowszechny.pl' };
}

/**
 * Dishes from two Polish dietitians' recipe pages (2026-11-09) whose own numbers already had more
 * protein than carbohydrate and more protein than fat. The dish and its idea come from there; the
 * amounts (fitted to this app's ingredients and to THE RULE on typical values), the swaps (skyr
 * for yoghurt, cream cheese and mayonnaise, a sweetener for honey and sugar, lean quark) and every
 * word are written here. Each card links the page it started from, without a licence line: unlike
 * Wikibooks, these pages are not openly licensed, so nothing of their text is used.
 */
export const DIETITIAN_RECIPES: Recipe[] = [
  {
    id: 'pulpety-z-serkiem-wiejskim',
    name: say('Pulpety z indyka i serka wiejskiego', 'Turkey and cottage cheese meatballs'),
    kind: 'obiad',
    minutes: 40,
    servings: 3,
    tool: say('Miska i piekarnik', 'Bowl and oven'),
    description: say(
      'Serek wiejski w masie mięsnej zamiast bułki: pulpety wychodzą soczyste, a białka jest jeszcze więcej.',
      'Cottage cheese in the mince instead of bread: the meatballs stay juicy and carry even more protein.',
    ),
    inspiredBy: chmielarz('Wysokobiałkowe pulpety', 'wysokobialkowe-pulpety'),
    items: [
      { ingredient: 'turkeyMince', grams: 500, measure: say('500 g (indyk albo kurczak)', '500 g (turkey or chicken)') },
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 tub') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'spices', grams: 4, measure: say('papryka słodka, bazylia, szczypta cayenne', 'sweet paprika, basil, a pinch of cayenne') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Odsącz serek wiejski z nadmiaru śmietanki. Wymieszaj z mięsem, jajkiem i przyprawami.',
        'Drain the excess cream off the cottage cheese. Mix it with the mince, the egg and the spices.',
      ),
      say(
        'Mokrymi dłońmi uformuj kulki wielkości orzecha włoskiego i ułóż na blasze wyłożonej papierem.',
        'With wet hands, roll walnut-sized balls and set them on a lined baking tray.',
      ),
      say(
        'Piecz 20–25 minut w 190°C, aż się zrumienią. Podawaj z warzywami albo sosem pomidorowym.',
        'Bake for 20–25 minutes at 190°C until browned. Serve with vegetables or a tomato sauce.',
      ),
    ],
  },
  {
    id: 'piers-z-mozzarella-i-pomidorem',
    name: say('Pierś z kurczaka zapiekana z pomidorem i mozzarellą', 'Chicken breast baked with tomato and mozzarella'),
    kind: 'obiad',
    minutes: 30,
    tool: say('Patelnia i piekarnik', 'Frying pan and oven'),
    description: say(
      'Obsmażona pierś pod plastrami pomidora i mozzarelli light, zapieczona jak w restauracji.',
      'A seared chicken breast under slices of tomato and light mozzarella, baked restaurant-style.',
    ),
    inspiredBy: chmielarz('Pierś z kurczaka jak z restauracji', 'piers-z-kurczaka-jak-z-restauracji'),
    items: [
      { ingredient: 'chickenFillet', grams: 250, measure: say('1 duży filet', '1 large fillet') },
      { ingredient: 'tomato', grams: 100, measure: say('1 pomidor', '1 tomato') },
      { ingredient: 'mozzarellaLight', grams: 60, measure: say('pół kulki', 'half a ball') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'spices', grams: 2, measure: say('bazylia, oregano', 'basil, oregano') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Przekrój filet poziomo na dwa cienkie płaty, dopraw solą, pieprzem i ziołami.',
        'Slice the fillet horizontally into two thin pieces and season with salt, pepper and herbs.',
      ),
      say(
        'Obsmaż na oliwie po 2 minuty z każdej strony i przełóż do naczynia żaroodpornego.',
        'Sear in the oil for 2 minutes on each side and move to an ovenproof dish.',
      ),
      say(
        'Przykryj plastrami pomidora i mozzarelli i zapiekaj 12–15 minut w 200°C, aż ser się roztopi.',
        'Cover with slices of tomato and mozzarella and bake for 12–15 minutes at 200°C until the cheese melts.',
      ),
    ],
  },
  {
    id: 'pizza-na-spodzie-z-twarogu',
    name: say('Pizza na spodzie z twarogu', 'Pizza on a quark base'),
    kind: 'obiad',
    minutes: 45,
    tool: say('Miska, blacha i piekarnik', 'Bowl, baking tray and oven'),
    description: say(
      'Spód z chudego twarogu, jajek i odrobiny mąki, a na nim passata, pieczarki, papryka, wędlina drobiowa i mozzarella.',
      'A base of low-fat quark, eggs and a little flour, topped with passata, mushrooms, pepper, sliced chicken and mozzarella.',
    ),
    inspiredBy: chmielarz('Pizza na twarogowym spodzie', 'pizza-na-twarogowym-spodzie'),
    items: [
      { ingredient: 'quark', grams: 250, measure: say('1 kostka', '1 pack') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'flour', grams: 45, measure: say('3 łyżki', '3 tbsp') },
      { ingredient: 'passata', grams: 80, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'mushrooms', grams: 100, measure: say('4–5 pieczarek', '4–5 mushrooms') },
      { ingredient: 'pepper', grams: 70, measure: say('pół papryki', 'half a pepper') },
      { ingredient: 'chicken', grams: 50, measure: say('3 plastry', '3 slices') },
      { ingredient: 'mozzarellaLight', grams: 60, measure: say('pół kulki', 'half a ball') },
      { ingredient: 'spices', grams: 3, measure: say('oregano, szczypta soli', 'oregano, a pinch of salt') },
    ],
    steps: [
      say(
        'Zblenduj twaróg z jajkami, mąką i szczyptą soli na gęstą masę.',
        'Blend the quark with the eggs, the flour and a pinch of salt into a thick batter.',
      ),
      say(
        'Rozsmaruj ją cienko na blasze wyłożonej papierem i podpiecz 15 minut w 200°C.',
        'Spread it thinly on a lined baking tray and pre-bake for 15 minutes at 200°C.',
      ),
      say(
        'Posmaruj passatą, rozłóż pokrojone pieczarki, paprykę, wędlinę i mozzarellę, posyp oregano i piecz jeszcze 12–15 minut.',
        'Spread with passata, top with the sliced mushrooms, pepper, chicken and mozzarella, sprinkle with oregano and bake for another 12–15 minutes.',
      ),
    ],
  },
  {
    id: 'tortilla-z-tunczykiem-i-twarogiem',
    name: say('Tortilla z tuńczykiem i twarożkiem', 'Tortilla with tuna and quark'),
    kind: 'slone',
    minutes: 10,
    tool: say('Miska', 'Bowl'),
    description: say(
      'Pełnoziarnisty placek z pastą z tuńczyka, twarogu i skyru, chrupiącą papryką i ogórkiem.',
      'A wholemeal wrap with a spread of tuna, quark and skyr, crunchy pepper and cucumber.',
    ),
    inspiredBy: chmielarz('Tortilla z tuńczykiem', 'tortilla-z-tunczykiem'),
    items: [
      { ingredient: 'wholemealTortilla', grams: 60, measure: say('1 placek', '1 wrap') },
      { ingredient: 'tuna', grams: 100, measure: say('1 mała puszka, odsączona', '1 small tin, drained') },
      { ingredient: 'quark', grams: 100, measure: say('pół kostki', 'half a pack') },
      { ingredient: 'skyr', grams: 50, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'pepper', grams: 80, measure: say('pół papryki', 'half a pepper') },
      { ingredient: 'cucumber', grams: 50, measure: say('kawałek ogórka', 'a piece of cucumber') },
      { ingredient: 'lemon', grams: 5, measure: say('kilka kropel', 'a few drops') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Rozgnieć twaróg ze skyrem, dodaj odsączonego tuńczyka, sok z cytryny, sól i pieprz.',
        'Mash the quark with the skyr, then add the drained tuna, the lemon juice, salt and pepper.',
      ),
      say(
        'Posmaruj tortillę pastą, ułóż paski papryki i ogórka i ciasno zwiń.',
        'Spread the paste over the tortilla, lay strips of pepper and cucumber on top and roll it up tightly.',
      ),
    ],
  },
  {
    id: 'stripsy-w-platkach-kukurydzianych',
    name: say('Stripsy z kurczaka w płatkach kukurydzianych', 'Chicken strips in corn flakes'),
    kind: 'obiad',
    minutes: 35,
    servings: 3,
    tool: say('Miska i piekarnik (albo airfryer)', 'Bowl and oven (or air fryer)'),
    description: say(
      'Chrupiące paski kurczaka z piekarnika: marynata ze skyru, panierka z płatków kukurydzianych i dip ze skyru z ziołami.',
      'Crispy oven-baked chicken strips: a skyr marinade, a corn flake coating and a herby skyr dip.',
    ),
    inspiredBy: powszechny('Fit Stripsy jak z KFC', 'fit-stripsy'),
    items: [
      { ingredient: 'chickenFillet', grams: 450, measure: say('2 filety', '2 fillets') },
      { ingredient: 'skyr', grams: 225, measure: say('1 kubek i pół małego', '1½ pots') },
      { ingredient: 'cornFlakes', grams: 60, measure: say('2 garście', '2 handfuls') },
      { ingredient: 'oil', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'spices', grams: 5, measure: say('papryka słodka, czosnek granulowany', 'sweet paprika, garlic granules') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Pokrój filety w podłużne paski i wymieszaj z jedną trzecią skyru, oliwą, solą i przyprawami.',
        'Cut the fillets into long strips and mix them with a third of the skyr, the oil, salt and the spices.',
      ),
      say(
        'Pokrusz płatki w dłoniach i obtocz w nich każdy pasek, mocno dociskając.',
        'Crush the flakes in your hands and press each strip firmly into them.',
      ),
      say(
        'Piecz na blasze z papierem 15–20 minut w 200°C (albo w airfryerze 12 minut w 190°C), w połowie obróć.',
        'Bake on a lined tray for 15–20 minutes at 200°C (or 12 minutes at 190°C in an air fryer), turning halfway.',
      ),
      say(
        'Resztę skyru wymieszaj z papryką, solą i pieprzem – to dip.',
        'Mix the rest of the skyr with paprika, salt and pepper for the dip.',
      ),
    ],
  },
  {
    id: 'sernik-na-zimno-kokos-pudding',
    name: say('Sernik na zimno z kokosem i puddingiem czekoladowym', 'No-bake cheesecake with coconut and chocolate pudding'),
    kind: 'miska',
    minutes: 25,
    servings: 2,
    tool: say('Blender i 2 słoiczki', 'Blender and 2 jars'),
    description: say(
      'Kokosowa masa z twarogu i skyru na żelatynie, a na wierzchu warstwa czekoladowego puddingu proteinowego. Tężeje w lodówce.',
      'A coconut layer of quark and skyr set with gelatine, topped with chocolate protein pudding. It sets in the fridge.',
    ),
    inspiredBy: powszechny('Fit Sernik Bounty', 'jednoporcjowy-sernik-ala-bounty'),
    items: [
      { ingredient: 'quark', grams: 250, measure: say('1 kostka', '1 pack') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'gelatin', grams: 12, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'water', grams: 150, measure: say('pół szklanki gorącej', 'half a cup, hot') },
      { ingredient: 'sweetener', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'coconut', grams: 10, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'proteinYogurt', grams: 200, measure: say('1 kubek puddingu czekoladowego', '1 pot of chocolate pudding') },
    ],
    steps: [
      say(
        'Rozpuść żelatynę w gorącej wodzie i odstaw, aż przestygnie.',
        'Dissolve the gelatine in the hot water and leave it to cool a little.',
      ),
      say(
        'Zblenduj twaróg ze skyrem i słodzikiem, cienkim strumieniem wlej żelatynę, a na koniec wmieszaj większość wiórków.',
        'Blend the quark with the skyr and sweetener, pour in the gelatine in a thin stream, then stir in most of the coconut.',
      ),
      say(
        'Przelej do słoiczków i schłódź, aż stężeje (ok. 2 godzin). Na wierzch nałóż pudding i posyp resztą wiórków.',
        'Pour into the jars and chill until set (about 2 hours). Top with the pudding and the rest of the coconut.',
      ),
    ],
  },
  {
    id: 'zelki-kefirowe-z-malinami',
    name: say('Żelki z kefiru i malin', 'Kefir and raspberry gummies'),
    kind: 'miska',
    minutes: 25,
    servings: 4,
    tool: say('Garnek i foremka', 'Pot and mould'),
    description: say(
      'Domowe żelki na żelatynie: maliny zmiksowane z kefirem, bez cukru. Kroi się je w kostkę jak cukierki.',
      'Homemade gelatine gummies: raspberries blended with kefir, no sugar. Cut into cubes like sweets.',
    ),
    inspiredBy: chmielarz('Fit zdrowe żelki', 'fit-zdrowe-zelki'),
    items: [
      { ingredient: 'kefir', grams: 400, measure: say('1 butelka', '1 bottle') },
      { ingredient: 'raspberries', grams: 200, measure: say('1 szklanka', '1 cup') },
      { ingredient: 'gelatin', grams: 40, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'sweetener', grams: 10, measure: say('1 łyżka', '1 tbsp') },
    ],
    steps: [
      say(
        'Podgrzej maliny w garnku, aż się rozpadną, i zmiksuj na gładko.',
        'Warm the raspberries in a pot until they fall apart, then blend until smooth.',
      ),
      say(
        'Wsyp żelatynę do ciepłego musu (nie gotuj) i mieszaj, aż się rozpuści. Dodaj słodzik i wmieszaj kefir.',
        'Stir the gelatine into the warm purée (do not boil) until it dissolves. Add the sweetener and stir in the kefir.',
      ),
      say(
        'Przelej do foremki i schłódź 2–3 godziny. Pokrój w kostkę.',
        'Pour into the mould and chill for 2–3 hours. Cut into cubes.',
      ),
    ],
  },
  {
    id: 'wrap-ze-szpinaku-i-serka',
    name: say('Wrap ze szpinaku i serka wiejskiego', 'Spinach and cottage cheese wrap'),
    kind: 'slone',
    minutes: 30,
    tool: say('Blender i piekarnik', 'Blender and oven'),
    description: say(
      'Placek pieczony ze szpinaku, serka wiejskiego i jajek, zwinięty z mozzarellą, wędliną drobiową i papryką.',
      'A baked sheet of spinach, cottage cheese and eggs, rolled up with mozzarella, sliced chicken and pepper.',
    ),
    inspiredBy: chmielarz('Szpinakowy wysokobiałkowy wrap', 'szpinakowy-wysokobialkowy-wrap'),
    items: [
      { ingredient: 'spinach', grams: 100, measure: say('2 garście', '2 handfuls') },
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 tub') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'mozzarellaLight', grams: 40, measure: say('kilka plastrów', 'a few slices') },
      { ingredient: 'chicken', grams: 40, measure: say('2–3 plastry', '2–3 slices') },
      { ingredient: 'pepper', grams: 50, measure: say('ćwiartka papryki', 'a quarter of a pepper') },
      { ingredient: 'saltPepper', grams: 1, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Zblenduj szpinak z odsączonym serkiem, jajkami, solą i pieprzem.',
        'Blend the spinach with the drained cottage cheese, the eggs, salt and pepper.',
      ),
      say(
        'Wylej cienko na blachę wyłożoną papierem i piecz 18–20 minut w 180°C, aż się zetnie.',
        'Pour thinly onto a lined baking tray and bake for 18–20 minutes at 180°C until set.',
      ),
      say(
        'Przestudzony placek obłóż mozzarellą, wędliną i paskami papryki, zwiń ciasno i pokrój na pół.',
        'Once it has cooled a little, top with the mozzarella, chicken and pepper strips, roll up tightly and cut in half.',
      ),
    ],
  },
  {
    id: 'deser-z-serka-z-kakao',
    name: say('Kakaowy deser z serka wiejskiego z orzechami', 'Cocoa cottage cheese dessert with walnuts'),
    kind: 'miska',
    minutes: 5,
    tool: say('Blender', 'Blender'),
    description: say(
      'Serek wiejski zmiksowany z kakao i białkiem na gęsty krem, posypany orzechami włoskimi.',
      'Cottage cheese blended with cocoa and protein powder into a thick cream, topped with walnuts.',
    ),
    inspiredBy: chmielarz('Wysokobiałkowy deser z serka wiejskiego i kakao', 'wysokobialkowy-deser-z-serka-wiejskiego-i-kakao'),
    items: [
      { ingredient: 'cottage', grams: 300, measure: say('1,5 opakowania', '1½ tubs') },
      { ingredient: 'cocoa', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'whey', grams: 30, measure: say('1 miarka', '1 scoop') },
      { ingredient: 'nuts', grams: 10, measure: say('2 połówki', '2 halves') },
      { ingredient: 'sweetener', grams: 5, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Zblenduj serek wiejski z kakao, białkiem i słodzikiem na gładki krem.',
        'Blend the cottage cheese with the cocoa, protein powder and sweetener into a smooth cream.',
      ),
      say('Przełóż do miseczki i posyp posiekanymi orzechami.', 'Spoon into a bowl and sprinkle with the chopped walnuts.'),
    ],
  },
  {
    id: 'rolada-z-drobiu-z-mozzarella',
    name: say('Rolada z mielonego drobiu z mozzarellą i pomidorami', 'Minced poultry roll with mozzarella and tomatoes'),
    kind: 'obiad',
    minutes: 60,
    servings: 3,
    tool: say('Papier do pieczenia i piekarnik', 'Baking paper and oven'),
    description: say(
      'Płat mielonego indyka posmarowany skyrem, zwinięty z wędliną, mozzarellą, pomidorem i czerwoną cebulą. Kroi się w plastry, na ciepło i na zimno.',
      'A sheet of minced turkey spread with skyr and rolled up with sliced chicken, mozzarella, tomato and red onion. Slice it warm or cold.',
    ),
    inspiredBy: chmielarz('Rolada białkowa', 'rolada-bialkowa'),
    items: [
      { ingredient: 'turkeyMince', grams: 500, measure: say('500 g (indyk albo kurczak)', '500 g (turkey or chicken)') },
      { ingredient: 'skyr', grams: 100, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'chicken', grams: 60, measure: say('4 plastry', '4 slices') },
      { ingredient: 'mozzarellaLight', grams: 80, measure: say('2/3 kulki', '2/3 of a ball') },
      { ingredient: 'tomato', grams: 150, measure: say('garść koktajlowych', 'a handful of cherry tomatoes') },
      { ingredient: 'onion', grams: 50, measure: say('pół czerwonej cebuli', 'half a red onion') },
      { ingredient: 'spices', grams: 4, measure: say('papryka słodka, czosnek, zioła', 'sweet paprika, garlic, herbs') },
      { ingredient: 'saltPepper', grams: 2, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Dopraw mięso solą, pieprzem i przyprawami i rozpłaszcz na papierze w prostokąt grubości ok. 1 cm.',
        'Season the mince with salt, pepper and the spices and press it out on baking paper into a rectangle about 1 cm thick.',
      ),
      say(
        'Posmaruj skyrem, ułóż wędlinę, plastry mozzarelli, pokrojone pomidorki i cebulę, zostawiając wolny brzeg.',
        'Spread with skyr and lay on the chicken slices, mozzarella, sliced tomatoes and onion, leaving a clear edge.',
      ),
      say(
        'Zwiń ciasno z pomocą papieru, zawiń końce i piecz 35–40 minut w 190°C. Odczekaj 10 minut przed krojeniem.',
        'Roll it up tightly using the paper, twist the ends and bake for 35–40 minutes at 190°C. Rest for 10 minutes before slicing.',
      ),
    ],
  },
  {
    id: 'buleczki-twarogowe-z-borowkami',
    name: say('Bułeczki twarogowe z borówkami', 'Quark buns with blueberries'),
    kind: 'miska',
    minutes: 35,
    servings: 2,
    tool: say('Miska i piekarnik', 'Bowl and oven'),
    description: say(
      'Miękkie bułeczki z twarogu z białkiem w proszku i garścią borówek – na śniadanie albo do pudełka.',
      'Soft buns of quark and protein powder with a handful of blueberries – for breakfast or the lunchbox.',
    ),
    inspiredBy: chmielarz('Wysokobiałkowe bułeczki z borówkami', 'wysokobialkowe-buleczki-z-borowkami'),
    items: [
      { ingredient: 'quark', grams: 250, measure: say('1 kostka', '1 pack') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'whey', grams: 30, measure: say('1 miarka', '1 scoop') },
      { ingredient: 'flour', grams: 30, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'potatoStarch', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'blueberries', grams: 60, measure: say('garść', 'a handful') },
      { ingredient: 'sweetener', grams: 10, measure: say('1 łyżka', '1 tbsp') },
    ],
    steps: [
      say(
        'Rozgnieć twaróg z jajkami, białkiem, mąką, skrobią, słodzikiem i szczyptą proszku do pieczenia.',
        'Mash the quark with the eggs, protein powder, flour, starch, sweetener and a pinch of baking powder.',
      ),
      say(
        'Delikatnie wmieszaj borówki i nakładaj łyżką 6 kopczyków na blachę z papierem.',
        'Gently fold in the blueberries and spoon 6 mounds onto a lined baking tray.',
      ),
      say('Piecz 20–25 minut w 180°C, aż się zrumienią.', 'Bake for 20–25 minutes at 180°C until golden.'),
    ],
  },
  {
    id: 'pizza-na-spodzie-z-kalafiora',
    name: say('Pizza na spodzie z kalafiora', 'Pizza on a cauliflower base'),
    kind: 'obiad',
    minutes: 60,
    tool: say('Blender, ściereczka i piekarnik', 'Blender, tea towel and oven'),
    description: say(
      'Spód bez mąki – kalafior, serek wiejski i jajka – a na nim passata, papryka, wędlina drobiowa i mozzarella.',
      'A flourless base – cauliflower, cottage cheese and eggs – topped with passata, pepper, sliced chicken and mozzarella.',
    ),
    inspiredBy: chmielarz('Wysokobiałkowy keto spód do pizzy', 'wysokobialkowy-keto-spod-do-pizzy'),
    items: [
      { ingredient: 'cauliflower', grams: 600, measure: say('1 mały kalafior', '1 small cauliflower') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 tub') },
      { ingredient: 'passata', grams: 100, measure: say('5 łyżek', '5 tbsp') },
      { ingredient: 'pepper', grams: 80, measure: say('pół papryki', 'half a pepper') },
      { ingredient: 'chicken', grams: 80, measure: say('5 plastrów', '5 slices') },
      { ingredient: 'mozzarellaLight', grams: 80, measure: say('2/3 kulki', '2/3 of a ball') },
      { ingredient: 'spices', grams: 3, measure: say('oregano, sól', 'oregano, salt') },
    ],
    steps: [
      say(
        'Zmiel kalafior na drobną kaszkę, zalej wrzątkiem na 5 minut, odcedź i mocno odciśnij w ściereczce.',
        'Blitz the cauliflower into fine crumbs, cover with boiling water for 5 minutes, drain and squeeze hard in a tea towel.',
      ),
      say(
        'Wymieszaj z jajkami, odsączonym serkiem i solą, rozłóż na papierze w okrągły placek i piecz 25 minut w 200°C.',
        'Mix with the eggs, the drained cottage cheese and salt, spread into a round on baking paper and bake for 25 minutes at 200°C.',
      ),
      say(
        'Posmaruj passatą, rozłóż paprykę, wędlinę i mozzarellę, posyp oregano i piecz jeszcze 10–12 minut.',
        'Spread with passata, add the pepper, chicken and mozzarella, sprinkle with oregano and bake for 10–12 more minutes.',
      ),
    ],
  },
  {
    id: 'pizza-na-spodzie-ze-skyru',
    name: say('Pizza na spodzie ze skyru', 'Pizza on a skyr base'),
    kind: 'obiad',
    minutes: 35,
    tool: say('Miska i piekarnik', 'Bowl and oven'),
    description: say(
      'Ciasto z dwóch składników – skyru i mąki – bez drożdży i czekania, z wędliną drobiową, pomidorami i mozzarellą.',
      'A two-ingredient dough – skyr and flour – with no yeast and no waiting, topped with sliced chicken, tomatoes and mozzarella.',
    ),
    inspiredBy: chmielarz('Pizza ze skyra na mące orkiszowej', 'pizza-ze-skyra-na-mace-orkiszowej'),
    items: [
      { ingredient: 'skyr', grams: 200, measure: say('1 kubek i 1/3', '1⅓ pots') },
      { ingredient: 'flour', grams: 70, measure: say('pół szklanki (może być orkiszowa)', 'half a cup (spelt works too)') },
      { ingredient: 'passata', grams: 80, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'chicken', grams: 100, measure: say('6 plastrów', '6 slices') },
      { ingredient: 'mozzarellaLight', grams: 125, measure: say('1 kulka', '1 ball') },
      { ingredient: 'tomato', grams: 100, measure: say('garść koktajlowych', 'a handful of cherry tomatoes') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'spices', grams: 3, measure: say('bazylia, sól, szczypta proszku do pieczenia', 'basil, salt, a pinch of baking powder') },
    ],
    steps: [
      say(
        'Zagnieć skyr z mąką, oliwą, solą i proszkiem do pieczenia. Jeśli się klei, dosyp łyżkę mąki.',
        'Knead the skyr with the flour, oil, salt and baking powder. If it is sticky, add a spoonful of flour.',
      ),
      say(
        'Rozwałkuj cienko na papierze i podpiecz 8 minut w 220°C.',
        'Roll out thinly on baking paper and pre-bake for 8 minutes at 220°C.',
      ),
      say(
        'Posmaruj passatą, rozłóż wędlinę, przekrojone pomidorki i mozzarellę, posyp bazylią i piecz jeszcze 10 minut.',
        'Spread with passata, add the chicken, halved tomatoes and mozzarella, sprinkle with basil and bake for another 10 minutes.',
      ),
    ],
  },
  {
    id: 'placuszki-szpinakowo-bananowe',
    name: say('Placuszki szpinakowo-bananowe z białkiem', 'Spinach and banana protein pancakes'),
    kind: 'miska',
    minutes: 15,
    tool: say('Blender i patelnia', 'Blender and frying pan'),
    description: say(
      'Zielone placuszki bez mąki: banan, szpinak, jajka i białko w proszku. Szpinaku prawie nie czuć.',
      'Green pancakes with no flour: banana, spinach, eggs and protein powder. You can hardly taste the spinach.',
    ),
    inspiredBy: chmielarz('Szpinakowe białkowe placuszki', 'szpinakowe-bialkowe-placuszki'),
    items: [
      { ingredient: 'banana', grams: 120, measure: say('1 banan', '1 banana') },
      { ingredient: 'spinach', grams: 50, measure: say('garść', 'a handful') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'milk', grams: 100, measure: say('pół szklanki', 'half a cup') },
      { ingredient: 'whey', grams: 40, measure: say('1 duża miarka', '1 large scoop') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
    ],
    steps: [
      say(
        'Zblenduj banana, szpinak, jajka, mleko i białko na gładkie ciasto.',
        'Blend the banana, spinach, eggs, milk and protein powder into a smooth batter.',
      ),
      say(
        'Smaż małe placuszki na lekko natłuszczonej patelni, po 1–2 minuty z każdej strony, na średnim ogniu.',
        'Fry small pancakes in a lightly oiled pan for 1–2 minutes on each side over a medium heat.',
      ),
    ],
  },
  {
    id: 'makaron-jednogarnkowy-z-indykiem',
    name: say('Makaron jednogarnkowy z indykiem i pomidorami', 'One-pot pasta with turkey and tomatoes'),
    kind: 'obiad',
    minutes: 30,
    servings: 2,
    tool: say('Duża patelnia albo garnek', 'Large frying pan or pot'),
    description: say(
      'Mielony indyk, pomidory, papryka i pełnoziarnisty makaron gotowane razem w jednym garnku, z parmezanem na wierzchu.',
      'Minced turkey, tomatoes, pepper and wholemeal pasta cooked together in one pot, finished with parmesan.',
    ),
    inspiredBy: chmielarz('Makaron jednogarnkowy z mięsem mielonym', 'makaron-jednogarnkowy-z-miesem-mielonym'),
    items: [
      { ingredient: 'turkeyMince', grams: 350, measure: say('350 g', '350 g') },
      { ingredient: 'wholemealPasta', grams: 100, measure: say('1 szklanka penne', '1 cup of penne') },
      { ingredient: 'cannedTomatoes', grams: 400, measure: say('1 puszka', '1 tin') },
      { ingredient: 'pepper', grams: 120, measure: say('1 mała papryka', '1 small pepper') },
      { ingredient: 'onion', grams: 70, measure: say('1 mała cebula', '1 small onion') },
      { ingredient: 'water', grams: 250, measure: say('1 szklanka (albo bulion)', '1 cup (or stock)') },
      { ingredient: 'oil', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'parmesan', grams: 30, measure: say('2 łyżki tartego', '2 tbsp grated') },
      { ingredient: 'spices', grams: 4, measure: say('oregano, papryka, sól', 'oregano, paprika, salt') },
    ],
    steps: [
      say(
        'Zeszklij cebulę na oleju, dodaj mięso i smaż, aż się zrumieni. Dodaj pokrojoną paprykę i przyprawy.',
        'Soften the onion in the oil, add the mince and fry until browned. Add the chopped pepper and the spices.',
      ),
      say(
        'Wsyp suchy makaron, wlej pomidory i wodę, zamieszaj i gotuj pod przykryciem 12–14 minut, mieszając co jakiś czas.',
        'Add the dry pasta, pour in the tomatoes and water, stir and simmer covered for 12–14 minutes, stirring now and then.',
      ),
      say('Podawaj posypany parmezanem.', 'Serve sprinkled with parmesan.'),
    ],
  },
  {
    id: 'owsianka-pieczona-z-malinami',
    name: say('Pieczona owsianka białkowa z malinami', 'Baked protein oats with raspberries'),
    kind: 'miska',
    minutes: 30,
    tool: say('Naczynie żaroodporne i piekarnik', 'Ovenproof dish and oven'),
    description: say(
      'Owsianka zapiekana z jajkiem, skyrem i białkiem jak ciasto, z warstwą malin w środku.',
      'Oats baked with egg, skyr and protein powder like a cake, with a layer of raspberries inside.',
    ),
    inspiredBy: chmielarz('Wysokobiałkowa owsianka na słodko z malinami', 'wysokobialkowa-owsianka-na-slodko-z-malinami'),
    items: [
      { ingredient: 'oats', grams: 40, measure: say('4 łyżki', '4 tbsp') },
      { ingredient: 'whey', grams: 30, measure: say('1 miarka', '1 scoop') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'skyr', grams: 100, measure: say('pół kubka', 'half a pot') },
      { ingredient: 'milk', grams: 100, measure: say('pół szklanki', 'half a cup') },
      { ingredient: 'raspberries', grams: 150, measure: say('1 szklanka', '1 cup') },
      { ingredient: 'cinnamon', grams: 1, measure: say('szczypta', 'a pinch') },
    ],
    steps: [
      say(
        'Wymieszaj płatki, białko, jajko, mleko, cynamon i szczyptę proszku do pieczenia.',
        'Mix the oats, protein powder, egg, milk, cinnamon and a pinch of baking powder.',
      ),
      say(
        'Przełóż połowę do naczynia, rozłóż maliny, przykryj resztą i piecz 20 minut w 180°C.',
        'Spread half into the dish, add the raspberries, cover with the rest and bake for 20 minutes at 180°C.',
      ),
      say('Podawaj ciepłą, z łyżką skyru na wierzchu.', 'Serve warm with a dollop of skyr on top.'),
    ],
  },
  {
    id: 'kurczak-z-brukselka-w-parmezanie',
    name: say('Kurczak z ziemniakami i brukselką w parmezanie', 'Chicken with potatoes and parmesan Brussels sprouts'),
    kind: 'obiad',
    minutes: 40,
    tool: say('Blacha i piekarnik (albo grill)', 'Baking tray and oven (or grill)'),
    description: say(
      'Pierś z czosnkiem i ziołami, pieczone ziemniaki z koperkiem i brukselka zapieczona z parmezanem – cały obiad z jednej blachy.',
      'Chicken breast with garlic and herbs, roast potatoes with dill and Brussels sprouts baked with parmesan – a whole dinner from one tray.',
    ),
    inspiredBy: chmielarz(
      'Grillowany kurczak z ziemniakami i brukselką w parmezanie',
      'grillowany-kurczak-z-ziemniakami-i-brukselka-w-parmezanie',
    ),
    items: [
      { ingredient: 'chickenFillet', grams: 200, measure: say('1 filet', '1 fillet') },
      { ingredient: 'potato', grams: 180, measure: say('2 ziemniaki', '2 potatoes') },
      { ingredient: 'brusselsSprouts', grams: 160, measure: say('garść', 'a handful') },
      { ingredient: 'parmesan', grams: 15, measure: say('1 łyżka tartego', '1 tbsp grated') },
      { ingredient: 'oil', grams: 8, measure: say('2 łyżeczki', '2 tsp') },
      { ingredient: 'garlic', grams: 5, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'spices', grams: 2, measure: say('zioła prowansalskie, sól', 'herbes de Provence, salt') },
      { ingredient: 'dill', grams: 5, measure: say('kilka gałązek', 'a few sprigs') },
    ],
    steps: [
      say(
        'Pokrój ziemniaki w ćwiartki, a brukselkę na połówki. Wymieszaj z połową oliwy i solą i piecz 15 minut w 210°C.',
        'Quarter the potatoes and halve the sprouts. Toss with half the oil and salt and roast for 15 minutes at 210°C.',
      ),
      say(
        'Natrzyj kurczaka resztą oliwy, czosnkiem i ziołami, połóż na blasze i piecz razem jeszcze 18–20 minut.',
        'Rub the chicken with the rest of the oil, the garlic and herbs, add it to the tray and roast everything for another 18–20 minutes.',
      ),
      say(
        'Na ostatnie 5 minut posyp brukselkę parmezanem. Ziemniaki posyp koperkiem.',
        'Sprinkle the sprouts with parmesan for the last 5 minutes. Scatter the dill over the potatoes.',
      ),
    ],
  },
  {
    id: 'serniczek-z-serka-z-borowkami',
    name: say('Serniczek z serka wiejskiego z borówkami', 'Cottage cheese mini cheesecake with blueberries'),
    kind: 'miska',
    minutes: 30,
    tool: say('Blender, kokilka i piekarnik', 'Blender, ramekin and oven'),
    description: say(
      'Jedna porcja sernika bez spodu, z samego serka wiejskiego i jajka, upieczona z borówkami.',
      'A single crustless cheesecake made from just cottage cheese and an egg, baked with blueberries.',
    ),
    inspiredBy: chmielarz('Domowy wysokobiałkowy serniczek', 'domowy-wysokobialkowy-serniczek'),
    items: [
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 tub') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'blueberries', grams: 100, measure: say('pół szklanki', 'half a cup') },
      { ingredient: 'sweetener', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
    ],
    steps: [
      say(
        'Zblenduj odsączony serek z jajkiem, słodzikiem i szczyptą proszku do pieczenia na gładką masę.',
        'Blend the drained cottage cheese with the egg, sweetener and a pinch of baking powder until smooth.',
      ),
      say(
        'Przelej do kokilki, rozłóż borówki i piecz 20–25 minut w 170°C. Najlepszy schłodzony.',
        'Pour into the ramekin, scatter the blueberries over and bake for 20–25 minutes at 170°C. Best served chilled.',
      ),
    ],
  },
  {
    id: 'zupa-gulaszowa-z-wolowina',
    name: say('Zupa gulaszowa z wołowiną', 'Beef goulash soup'),
    kind: 'obiad',
    minutes: 90,
    servings: 2,
    tool: say('Garnek z grubym dnem', 'Heavy-based pot'),
    description: say(
      'Rozgrzewająca zupa z chudą wołowiną, papryką i ziemniakami, na słodkiej papryce, kminku i odrobinie chili.',
      'A warming soup of lean beef, peppers and potatoes, with sweet paprika, caraway and a little chilli.',
    ),
    inspiredBy: chmielarz('Zupa gulaszowa', 'zupa-gulaszowa'),
    items: [
      { ingredient: 'leanBeef', grams: 400, measure: say('400 g, np. udziec', '400 g, e.g. topside') },
      { ingredient: 'onion', grams: 100, measure: say('1 cebula', '1 onion') },
      { ingredient: 'garlic', grams: 10, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'pepper', grams: 240, measure: say('2 papryki', '2 peppers') },
      { ingredient: 'potato', grams: 350, measure: say('3 ziemniaki', '3 potatoes') },
      { ingredient: 'passata', grams: 100, measure: say('5 łyżek', '5 tbsp') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      {
        ingredient: 'spices',
        grams: 6,
        measure: say('papryka słodka, kminek, imbir, chili', 'sweet paprika, caraway, ginger, chilli'),
      },
      { ingredient: 'water', grams: 1000, measure: say('1 litr', '1 litre') },
    ],
    steps: [
      say(
        'Pokrój wołowinę w małą kostkę i obsmaż na oleju. Dodaj cebulę, czosnek i przyprawy i smaż jeszcze minutę.',
        'Cut the beef into small cubes and brown in the oil. Add the onion, garlic and spices and fry for another minute.',
      ),
      say(
        'Zalej wodą i gotuj pod przykryciem 50 minut, aż mięso zmięknie.',
        'Add the water and simmer covered for 50 minutes until the meat is tender.',
      ),
      say(
        'Dodaj pokrojone ziemniaki, paprykę i passatę i gotuj jeszcze 20 minut. Dopraw solą i pieprzem.',
        'Add the diced potatoes, peppers and passata and simmer for another 20 minutes. Season with salt and pepper.',
      ),
    ],
  },
  {
    id: 'jajecznica-z-serkiem-wiejskim',
    name: say('Jajecznica z serkiem wiejskim i pomidorkami', 'Scrambled eggs with cottage cheese and tomatoes'),
    kind: 'slone',
    minutes: 10,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Serek wiejski wmieszany w jajecznicę pod koniec smażenia: kremowa, z dwa razy większą porcją białka. Z pomidorkami i kromką pieczywa.',
      'Cottage cheese stirred into scrambled eggs at the end: creamy, with twice the protein. With tomatoes and a slice of bread.',
    ),
    inspiredBy: chmielarz('Jajecznica z serkiem wiejskim', 'jajecznica-z-serkiem-wiejskim'),
    items: [
      { ingredient: 'egg', grams: 150, measure: say('3 jajka', '3 eggs') },
      { ingredient: 'cottage', grams: 150, measure: say('3/4 opakowania', '3/4 of a tub') },
      { ingredient: 'tomato', grams: 100, measure: say('garść koktajlowych', 'a handful of cherry tomatoes') },
      { ingredient: 'roll', grams: 40, measure: say('1 kromka żytniego albo pół bułki', '1 slice of rye or half a roll') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'chives', grams: 5, measure: say('kilka źdźbeł', 'a few stems') },
    ],
    steps: [
      say(
        'Roztrzep jajka z solą i pieprzem i wlej na rozgrzaną, natłuszczoną patelnię.',
        'Beat the eggs with salt and pepper and pour into a hot, oiled pan.',
      ),
      say(
        'Mieszaj na małym ogniu, a gdy jajka zaczną się ścinać, dodaj serek i podgrzewaj jeszcze chwilę.',
        'Stir over a low heat and, as the eggs begin to set, add the cottage cheese and warm through.',
      ),
      say(
        'Posyp szczypiorkiem, podawaj z pomidorkami i pieczywem.',
        'Sprinkle with chives and serve with the tomatoes and bread.',
      ),
    ],
  },
  {
    id: 'placuszki-z-serka-z-mozzarella',
    name: say('Wytrawne placuszki z serka wiejskiego z mozzarellą', 'Savoury cottage cheese pancakes with mozzarella'),
    kind: 'slone',
    minutes: 20,
    tool: say('Miska i patelnia', 'Bowl and frying pan'),
    description: say(
      'Placuszki z serka wiejskiego z roztopioną mozzarellą w środku, podane z pomidorem i ogórkiem.',
      'Cottage cheese pancakes with melted mozzarella inside, served with tomato and cucumber.',
    ),
    inspiredBy: chmielarz('Wysokobiałkowe placuszki z serka wiejskiego', 'wysokobialkowe-placuszki-z-serka-wiejskiego'),
    items: [
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 tub') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'flour', grams: 40, measure: say('3 łyżki', '3 tbsp') },
      { ingredient: 'mozzarellaLight', grams: 60, measure: say('pół kulki', 'half a ball') },
      { ingredient: 'tomato', grams: 80, measure: say('1 mały pomidor', '1 small tomato') },
      { ingredient: 'cucumber', grams: 60, measure: say('kawałek ogórka', 'a piece of cucumber') },
      { ingredient: 'spices', grams: 1, measure: say('bazylia, sól, pieprz', 'basil, salt, pepper') },
    ],
    steps: [
      say(
        'Wymieszaj odsączony serek z jajkiem, mąką, przyprawami i szczyptą proszku do pieczenia. Dodaj pokrojoną w kostkę mozzarellę.',
        'Mix the drained cottage cheese with the egg, flour, spices and a pinch of baking powder. Add the diced mozzarella.',
      ),
      say(
        'Smaż łyżką małe placuszki na suchej albo lekko natłuszczonej patelni, po 2–3 minuty z każdej strony.',
        'Fry spoonfuls as small pancakes in a dry or lightly oiled pan for 2–3 minutes on each side.',
      ),
      say('Podawaj z pomidorem i ogórkiem.', 'Serve with the tomato and cucumber.'),
    ],
  },
  {
    id: 'wrap-grecki-z-kurczakiem',
    name: say('Grecki wrap z kurczakiem i fetą', 'Greek wrap with chicken and feta'),
    kind: 'slone',
    minutes: 20,
    tool: say('Patelnia', 'Frying pan'),
    description: say(
      'Pełnoziarnista tortilla z kurczakiem z oregano, fetą, sosem ze skyru, pomidorem i papryką.',
      'A wholemeal tortilla with oregano chicken, feta, a skyr sauce, tomato and pepper.',
    ),
    inspiredBy: chmielarz('Grecki wrap', 'grecki-wrap'),
    items: [
      { ingredient: 'wholemealTortilla', grams: 60, measure: say('1 placek', '1 wrap') },
      { ingredient: 'chickenFillet', grams: 150, measure: say('mały filet', 'a small fillet') },
      { ingredient: 'feta', grams: 30, measure: say('plaster', 'a slice') },
      { ingredient: 'skyr', grams: 40, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'tomato', grams: 80, measure: say('1 mały pomidor', '1 small tomato') },
      { ingredient: 'pepper', grams: 70, measure: say('pół papryki', 'half a pepper') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'spices', grams: 1, measure: say('oregano, sól, pieprz', 'oregano, salt, pepper') },
    ],
    steps: [
      say(
        'Pokrój kurczaka w paski, dopraw oregano, solą i pieprzem i usmaż na oliwie, 6–7 minut.',
        'Cut the chicken into strips, season with oregano, salt and pepper and fry in the oil for 6–7 minutes.',
      ),
      say(
        'Posmaruj tortillę skyrem, ułóż kurczaka, pokruszoną fetę, pomidora i paprykę, zwiń i przekrój.',
        'Spread the tortilla with skyr, add the chicken, crumbled feta, tomato and pepper, roll up and cut in half.',
      ),
    ],
  },
  {
    id: 'salatka-grecka-z-kurczakiem',
    name: say('Sałatka grecka z kurczakiem', 'Greek salad with chicken'),
    kind: 'slone',
    minutes: 20,
    tool: say('Patelnia i miska', 'Frying pan and bowl'),
    description: say(
      'Klasyczna sałatka z pomidorem, ogórkiem, papryką i fetą, z ciepłym kurczakiem z patelni.',
      'The classic salad of tomato, cucumber, pepper and feta, with warm pan-fried chicken.',
    ),
    inspiredBy: chmielarz('Sałatka grecka z kurczakiem', 'salatka-grecka-z-kurczakiem'),
    items: [
      { ingredient: 'chickenFillet', grams: 160, measure: say('mały filet', 'a small fillet') },
      { ingredient: 'feta', grams: 40, measure: say('plaster', 'a slice') },
      { ingredient: 'tomato', grams: 160, measure: say('1 duży pomidor', '1 large tomato') },
      { ingredient: 'cucumber', grams: 100, measure: say('pół ogórka', 'half a cucumber') },
      { ingredient: 'pepper', grams: 70, measure: say('pół papryki', 'half a pepper') },
      { ingredient: 'onion', grams: 20, measure: say('kilka piórek czerwonej', 'a few slices of red onion') },
      { ingredient: 'oil', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'spices', grams: 1, measure: say('oregano, sól, pieprz', 'oregano, salt, pepper') },
    ],
    steps: [
      say(
        'Usmaż kurczaka na połowie oliwy z solą i oregano, 5–6 minut z każdej strony, i pokrój w paski.',
        'Fry the chicken in half the oil with salt and oregano, 5–6 minutes on each side, and slice into strips.',
      ),
      say(
        'Pokrój warzywa w dużą kostkę, dodaj fetę, resztę oliwy i oregano, wymieszaj i połóż na wierzchu kurczaka.',
        'Cut the vegetables into large chunks, add the feta, the rest of the oil and the oregano, toss, and top with the chicken.',
      ),
    ],
  },
  {
    id: 'pasztet-drobiowy-z-watrobka',
    name: say('Pasztet drobiowy z wątróbką', 'Chicken and liver pâté loaf'),
    kind: 'slone',
    minutes: 100,
    servings: 8,
    tool: say('Blender, keksówka i piekarnik', 'Blender, loaf tin and oven'),
    description: say(
      'Domowy pasztet do kanapek z piersi kurczaka i wątróbki z marchewką, bez boczku i smalcu. Pieczony w keksówce, kroi się na zimno.',
      'A homemade sandwich pâté of chicken breast and livers with carrot, with no bacon or lard. Baked in a loaf tin and sliced cold.',
    ),
    inspiredBy: powszechny('Domowy pasztet', 'domowy-pasztet'),
    items: [
      { ingredient: 'chickenFillet', grams: 500, measure: say('2 duże filety', '2 large fillets') },
      { ingredient: 'chickenLiver', grams: 250, measure: say('250 g', '250 g') },
      { ingredient: 'carrot', grams: 150, measure: say('2 marchewki', '2 carrots') },
      { ingredient: 'onion', grams: 100, measure: say('1 cebula', '1 onion') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'roll', grams: 25, measure: say('pół kajzerki, namoczonej', 'half a roll, soaked') },
      { ingredient: 'oil', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      {
        ingredient: 'spices',
        grams: 6,
        measure: say('majeranek, gałka muszkatołowa, ziele angielskie', 'marjoram, nutmeg, allspice'),
      },
      { ingredient: 'saltPepper', grams: 4, measure: say('do smaku', 'to taste') },
    ],
    steps: [
      say(
        'Zeszklij cebulę na oleju, dodaj oczyszczoną wątróbkę i smaż 3–4 minuty. Marchew zetrzyj na drobnych oczkach.',
        'Soften the onion in the oil, add the trimmed livers and fry for 3–4 minutes. Finely grate the carrots.',
      ),
      say(
        'Zmiel albo zblenduj surowe filety z wątróbką, cebulą, marchwią, odciśniętą bułką, jajkami i przyprawami na gładką masę.',
        'Mince or blend the raw fillets with the livers, onion, carrot, squeezed-out roll, eggs and spices into a smooth paste.',
      ),
      say(
        'Przełóż do keksówki wyłożonej papierem i piecz 70 minut w 170°C. Wystudź i schłódź przed krojeniem.',
        'Spoon into a lined loaf tin and bake for 70 minutes at 170°C. Cool and chill before slicing.',
      ),
    ],
  },
  {
    id: 'zapiekanka-z-serka-wiejskiego',
    name: say('Zapiekanka z serka wiejskiego z warzywami', 'Cottage cheese and vegetable bake'),
    kind: 'slone',
    minutes: 30,
    tool: say('Naczynie żaroodporne i piekarnik', 'Ovenproof dish and oven'),
    description: say(
      'Serek wiejski z jajkami, pomidorkami, papryką i wędliną drobiową zapiekany pod mozzarellą – jak omlet, tylko bez pilnowania.',
      'Cottage cheese with eggs, cherry tomatoes, pepper and sliced chicken baked under mozzarella – like an omelette, with no watching.',
    ),
    inspiredBy: powszechny('Wysokobiałkowa zapiekanka z serka wiejskiego', 'wysokobialkowa-zapiekanka-z-serka-wiejskiego'),
    items: [
      { ingredient: 'cottage', grams: 200, measure: say('1 opakowanie', '1 tub') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'tomato', grams: 100, measure: say('garść koktajlowych', 'a handful of cherry tomatoes') },
      { ingredient: 'pepper', grams: 40, measure: say('ćwiartka papryki', 'a quarter of a pepper') },
      { ingredient: 'onion', grams: 25, measure: say('ćwiartka czerwonej cebuli', 'a quarter of a red onion') },
      { ingredient: 'chicken', grams: 30, measure: say('2 plastry', '2 slices') },
      { ingredient: 'mozzarellaLight', grams: 20, measure: say('garść tartej', 'a handful, grated') },
      { ingredient: 'chives', grams: 5, measure: say('kilka źdźbeł', 'a few stems') },
    ],
    steps: [
      say(
        'Pokrój warzywa i wędlinę. Wymieszaj z serkiem, jajkami, solą, pieprzem i papryką słodką.',
        'Chop the vegetables and the chicken. Mix with the cottage cheese, eggs, salt, pepper and sweet paprika.',
      ),
      say(
        'Przełóż do naczynia, posyp mozzarellą i piecz 20–25 minut w 200°C. Posyp szczypiorkiem.',
        'Tip into the dish, sprinkle with the mozzarella and bake for 20–25 minutes at 200°C. Scatter with chives.',
      ),
    ],
  },
  {
    id: 'placki-czekoladowe-z-twarogu',
    name: say('Placki czekoladowe z twarogu ze skyrem i malinami', 'Chocolate quark pancakes with skyr and raspberries'),
    kind: 'miska',
    minutes: 20,
    tool: say('Blender i patelnia', 'Blender and frying pan'),
    description: say(
      'Kakaowe placuszki z twarogu, smażone na małym ogniu, podane z kubkiem skyru i malinami.',
      'Cocoa quark pancakes fried over a low heat, served with a pot of skyr and raspberries.',
    ),
    inspiredBy: powszechny('Placki czekoladowe z jogurtem i owocami', 'placki-czekoladowe'),
    items: [
      { ingredient: 'quark', grams: 125, measure: say('pół kostki', 'half a pack') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'flour', grams: 35, measure: say('2 łyżki (może być orkiszowa)', '2 tbsp (spelt works too)') },
      { ingredient: 'cocoa', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'milk', grams: 25, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'sweetener', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'oil', grams: 3, measure: say('do natłuszczenia', 'to grease the pan') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'raspberries', grams: 60, measure: say('garść', 'a handful') },
    ],
    steps: [
      say(
        'Zblenduj twaróg z jajkiem, mąką, kakao, mlekiem i słodzikiem na gładkie ciasto.',
        'Blend the quark with the egg, flour, cocoa, milk and sweetener into a smooth batter.',
      ),
      say(
        'Smaż małe placki na lekko natłuszczonej patelni, na małym ogniu, po 2–3 minuty z każdej strony, aż środek się zetnie.',
        'Fry small pancakes in a lightly oiled pan over a low heat, 2–3 minutes on each side, until set in the middle.',
      ),
      say('Podawaj ze skyrem i malinami.', 'Serve with the skyr and raspberries.'),
    ],
  },
  {
    id: 'kotleciki-siekane-z-kurczaka',
    name: say('Siekane kotleciki z kurczaka z cukinią', 'Chopped chicken patties with courgette'),
    kind: 'obiad',
    minutes: 30,
    servings: 2,
    tool: say('Deska, miska i patelnia', 'Chopping board, bowl and frying pan'),
    description: say(
      'Drobno siekana pierś z cukinią i papryką, związana jajkiem – soczyste kotleciki bez mielenia.',
      'Finely chopped chicken breast with courgette and pepper, bound with egg – juicy patties with no mincer.',
    ),
    inspiredBy: powszechny('Siekane kotleciki', 'siekane-kotleciki'),
    items: [
      { ingredient: 'chickenFillet', grams: 300, measure: say('1 duży filet', '1 large fillet') },
      { ingredient: 'zucchini', grams: 100, measure: say('pół małej cukinii', 'half a small courgette') },
      { ingredient: 'pepper', grams: 60, measure: say('pół papryki', 'half a pepper') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'flour', grams: 35, measure: say('2 łyżki', '2 tbsp') },
      { ingredient: 'oil', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'spices', grams: 3, measure: say('papryka, czosnek, curry, sól', 'paprika, garlic, curry, salt') },
    ],
    steps: [
      say(
        'Posiekaj mięso i paprykę w drobną kostkę. Cukinię zetrzyj i mocno odciśnij z soku.',
        'Finely dice the chicken and the pepper. Grate the courgette and squeeze out the juice.',
      ),
      say(
        'Wymieszaj wszystko z jajkiem, mąką i przyprawami.',
        'Mix everything with the egg, flour and spices.',
      ),
      say(
        'Nakładaj łyżką na rozgrzany olej i smaż kotleciki po 3–4 minuty z każdej strony.',
        'Spoon onto the hot oil and fry the patties for 3–4 minutes on each side.',
      ),
    ],
  },
  {
    id: 'stek-z-chimichurri',
    name: say('Stek wołowy z sosem chimichurri i sałatką', 'Beef steak with chimichurri and salad'),
    kind: 'obiad',
    minutes: 20,
    tool: say('Patelnia grillowa', 'Griddle pan'),
    description: say(
      'Chudy stek z patelni z ostrym ziołowym sosem z natki, czosnku i cytryny oraz sałatką z pomidora i ogórka.',
      'A lean pan-fried steak with a sharp herb sauce of parsley, garlic and lemon, and a tomato and cucumber salad.',
    ),
    inspiredBy: powszechny('Stek z sosem chimichurri i sałatką', 'stek-z-sosem-chimichurri-i-salatka'),
    items: [
      { ingredient: 'leanBeef', grams: 200, measure: say('1 stek, np. z polędwicy', '1 steak, e.g. tenderloin') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'tomato', grams: 80, measure: say('garść koktajlowych', 'a handful of cherry tomatoes') },
      { ingredient: 'cucumber', grams: 60, measure: say('kawałek ogórka', 'a piece of cucumber') },
      { ingredient: 'onion', grams: 15, measure: say('kawałek cebuli', 'a piece of onion') },
      { ingredient: 'garlic', grams: 4, measure: say('1 ząbek', '1 clove') },
      { ingredient: 'lemon', grams: 10, measure: say('sok z ćwiartki', 'juice of a quarter') },
      { ingredient: 'spices', grams: 2, measure: say('pęczek natki, płatki chili, sól', 'a bunch of parsley, chilli flakes, salt') },
    ],
    steps: [
      say(
        'Posiekaj natkę i czosnek, wymieszaj z 2/3 oliwy, sokiem z cytryny, chili i solą – to chimichurri.',
        'Chop the parsley and garlic and mix with two thirds of the oil, the lemon juice, chilli and salt – that is the chimichurri.',
      ),
      say(
        'Stek w temperaturze pokojowej natrzyj resztą oliwy i smaż na mocno rozgrzanej patelni po 2–4 minuty z każdej strony. Odpocznij 5 minut.',
        'Rub the room-temperature steak with the rest of the oil and sear in a very hot pan for 2–4 minutes on each side. Rest for 5 minutes.',
      ),
      say(
        'Pokrój pomidorki, ogórek i cebulę na sałatkę. Podawaj stek polany sosem.',
        'Slice the tomatoes, cucumber and onion for the salad. Serve the steak with the sauce over it.',
      ),
    ],
  },
  {
    id: 'paluszki-rybne-domowe',
    name: say('Domowe paluszki rybne z dipem ze skyru', 'Homemade fish fingers with a skyr dip'),
    kind: 'obiad',
    minutes: 35,
    servings: 2,
    tool: say('Blacha i piekarnik', 'Baking tray and oven'),
    description: say(
      'Dorsz albo mintaj w chrupiącej panierce z płatków kukurydzianych, pieczony zamiast smażony, z koperkowym dipem.',
      'Cod or pollock in a crunchy corn flake coating, baked rather than fried, with a dill dip.',
    ),
    inspiredBy: powszechny('Domowe paluszki rybne', 'domowe-paluszki-rybne'),
    items: [
      { ingredient: 'whiteFish', grams: 450, measure: say('450 g filetów', '450 g of fillets') },
      { ingredient: 'cornFlakes', grams: 50, measure: say('2 garście', '2 handfuls') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'skyr', grams: 150, measure: say('1 mały kubek', '1 small pot') },
      { ingredient: 'dill', grams: 5, measure: say('kilka gałązek', 'a few sprigs') },
      { ingredient: 'spices', grams: 3, measure: say('papryka, curry, czosnek, sól', 'paprika, curry, garlic, salt') },
    ],
    steps: [
      say(
        'Pokrusz płatki z przyprawami. Pokrój rybę w paski, obtocz w roztrzepanym jajku, a potem w płatkach.',
        'Crush the flakes with the spices. Cut the fish into strips, dip in the beaten egg and then in the flakes.',
      ),
      say(
        'Ułóż na blasze z papierem, skrop olejem i piecz 15–18 minut w 200°C.',
        'Lay on a lined tray, drizzle with the oil and bake for 15–18 minutes at 200°C.',
      ),
      say('Skyr wymieszaj z koperkiem, solą i czosnkiem.', 'Mix the skyr with the dill, salt and garlic.'),
    ],
  },
  {
    id: 'muffiny-jajeczne-z-warzywami',
    name: say('Muffiny jajeczne z warzywami i mozzarellą', 'Egg muffins with vegetables and mozzarella'),
    kind: 'slone',
    minutes: 35,
    servings: 4,
    tool: say('Forma do muffinek i piekarnik', 'Muffin tin and oven'),
    description: say(
      'Osiem jajek, szpinak, cukinia, papryka i mozzarella upieczone w foremkach – śniadanie na kilka dni.',
      'Eight eggs, spinach, courgette, pepper and mozzarella baked in muffin cups – breakfast for several days.',
    ),
    inspiredBy: powszechny('Muffiny jajeczne z warzywami', 'muffiny-jajeczne-z-warzywami'),
    items: [
      { ingredient: 'egg', grams: 400, measure: say('8 jajek', '8 eggs') },
      { ingredient: 'spinach', grams: 50, measure: say('garść', 'a handful') },
      { ingredient: 'zucchini', grams: 150, measure: say('pół cukinii', 'half a courgette') },
      { ingredient: 'mozzarellaLight', grams: 70, measure: say('pół kulki', 'half a ball') },
      { ingredient: 'pepper', grams: 80, measure: say('pół papryki', 'half a pepper') },
      { ingredient: 'chives', grams: 10, measure: say('pęczek', 'a bunch') },
      { ingredient: 'saltPepper', grams: 2, measure: say('sól, pieprz, czosnek granulowany', 'salt, pepper, garlic granules') },
    ],
    steps: [
      say(
        'Zetrzyj cukinię i odciśnij, paprykę pokrój w kostkę, szpinak i szczypiorek posiekaj, mozzarellę pokrój.',
        'Grate and squeeze the courgette, dice the pepper, chop the spinach and chives, and dice the mozzarella.',
      ),
      say(
        'Roztrzep jajka z przyprawami, wymieszaj z warzywami i serem i rozlej do 10 natłuszczonych foremek.',
        'Beat the eggs with the seasoning, stir in the vegetables and cheese and pour into 10 greased cups.',
      ),
      say(
        'Piecz 20–22 minuty w 180°C. W lodówce wytrzymają 3–4 dni.',
        'Bake for 20–22 minutes at 180°C. They keep for 3–4 days in the fridge.',
      ),
    ],
  },
  {
    id: 'omlet-ze-szparagami',
    name: say('Omlet ze szparagami, pomidorkami i mozzarellą', 'Asparagus omelette with cherry tomatoes and mozzarella'),
    kind: 'slone',
    minutes: 15,
    tool: say('Patelnia z pokrywką', 'Frying pan with a lid'),
    description: say(
      'Wiosenny omlet: podsmażone zielone szparagi, pomidorki i mozzarella, ścięte pod przykryciem. Dodatkowe białka jaj dokładają białka.',
      'A spring omelette: sautéed green asparagus, cherry tomatoes and mozzarella, set under a lid. Extra egg whites add protein.',
    ),
    inspiredBy: powszechny('Omlet ze szparagami', 'omlet-ze-szparagami'),
    items: [
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'eggWhites', grams: 60, measure: say('białka z 2 jajek', 'whites of 2 eggs') },
      { ingredient: 'asparagus', grams: 150, measure: say('8–10 szparagów', '8–10 spears') },
      { ingredient: 'tomato', grams: 60, measure: say('6 pomidorków', '6 cherry tomatoes') },
      { ingredient: 'mozzarellaLight', grams: 60, measure: say('pół kulki', 'half a ball') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'chives', grams: 5, measure: say('kilka źdźbeł', 'a few stems') },
    ],
    steps: [
      say(
        'Odłam twarde końce szparagów, pokrój je i podsmaż na oleju z solą 3–4 minuty.',
        'Snap off the woody ends of the asparagus, cut it up and sauté in the oil with salt for 3–4 minutes.',
      ),
      say(
        'Wlej roztrzepane jajka z białkami, rozłóż przekrojone pomidorki i mozzarellę.',
        'Pour in the eggs beaten with the whites and scatter over the halved tomatoes and the mozzarella.',
      ),
      say(
        'Smaż pod przykryciem na małym ogniu, aż wierzch się zetnie, bez obracania. Posyp szczypiorkiem.',
        'Cook covered over a low heat until the top sets, without turning. Sprinkle with chives.',
      ),
    ],
  },
  {
    id: 'omlet-czekoladowy-z-puddingiem',
    name: say('Omlet czekoladowy z puddingiem proteinowym', 'Chocolate omelette with protein pudding'),
    kind: 'miska',
    minutes: 15,
    tool: say('Miska i patelnia z pokrywką', 'Bowl and frying pan with a lid'),
    description: say(
      'Kakaowy omlet przełożony czekoladowym puddingiem proteinowym i posypany orzechami – deser na śniadanie.',
      'A cocoa omelette folded over chocolate protein pudding and sprinkled with nuts – dessert for breakfast.',
    ),
    inspiredBy: powszechny('Omlet Ferrero Rocher', 'omlet-ferrero-rocher'),
    items: [
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'flour', grams: 20, measure: say('1 czubata łyżka', '1 heaped tbsp') },
      { ingredient: 'cocoa', grams: 15, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'proteinYogurt', grams: 200, measure: say('1 kubek puddingu czekoladowego', '1 pot of chocolate pudding') },
      { ingredient: 'oil', grams: 3, measure: say('do natłuszczenia', 'to grease the pan') },
      { ingredient: 'nuts', grams: 5, measure: say('kilka orzechów, posiekanych', 'a few nuts, chopped') },
    ],
    steps: [
      say(
        'Zmiksuj jajka z mąką, kakao, szczyptą proszku do pieczenia i połową puddingu.',
        'Whisk the eggs with the flour, cocoa, a pinch of baking powder and half the pudding.',
      ),
      say(
        'Wylej na natłuszczoną patelnię i smaż pod przykryciem na małym ogniu, potem obróć na chwilę.',
        'Pour into the greased pan and cook covered over a low heat, then flip briefly.',
      ),
      say(
        'Posmaruj resztą puddingu, złóż na pół i posyp orzechami.',
        'Spread with the rest of the pudding, fold in half and sprinkle with the nuts.',
      ),
    ],
  },
  {
    id: 'indyk-z-batatami-w-pomidorach',
    name: say('Jednogarnkowy indyk z batatami w pomidorach', 'One-pot turkey with sweet potatoes in tomatoes'),
    kind: 'obiad',
    minutes: 40,
    servings: 2,
    tool: say('Duża patelnia z pokrywką', 'Large frying pan with a lid'),
    description: say(
      'Mielony indyk duszony z batatami, papryką i pomidorami, z mozzarellą roztopioną na wierzchu i limonką.',
      'Minced turkey braised with sweet potatoes, peppers and tomatoes, with mozzarella melted on top and a squeeze of lime.',
    ),
    inspiredBy: powszechny('Jednogarnkowy kurczak z batatami w pomidorach', 'jednogarnkowy-kurczak-z-batatami-w-pomidorach'),
    items: [
      { ingredient: 'turkeyMince', grams: 350, measure: say('350 g', '350 g') },
      { ingredient: 'sweetPotato', grams: 200, measure: say('1 mały batat', '1 small sweet potato') },
      { ingredient: 'cannedTomatoes', grams: 400, measure: say('1 puszka', '1 tin') },
      { ingredient: 'onion', grams: 80, measure: say('1 czerwona cebula', '1 red onion') },
      { ingredient: 'pepper', grams: 150, measure: say('1 papryka', '1 pepper') },
      { ingredient: 'garlic', grams: 8, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'oil', grams: 15, measure: say('1,5 łyżki', '1.5 tbsp') },
      { ingredient: 'mozzarellaLight', grams: 60, measure: say('pół kulki', 'half a ball') },
      { ingredient: 'spices', grams: 4, measure: say('papryka, oregano, tymianek, chili', 'paprika, oregano, thyme, chilli') },
      { ingredient: 'lemon', grams: 10, measure: say('limonka do podania', 'lime to serve') },
    ],
    steps: [
      say(
        'Podsmaż cebulę, paprykę i czosnek na oliwie, dodaj mięso i przyprawy i smaż, aż się zrumieni.',
        'Fry the onion, pepper and garlic in the oil, add the mince and spices and cook until browned.',
      ),
      say(
        'Dodaj batata w kostce i pomidory, przykryj i duś 20 minut, aż batat zmięknie.',
        'Add the diced sweet potato and the tomatoes, cover and simmer for 20 minutes until the sweet potato is soft.',
      ),
      say(
        'Rozłóż mozzarellę, przykryj na 2–3 minuty, żeby się roztopiła. Podawaj z limonką.',
        'Lay the mozzarella on top and cover for 2–3 minutes to melt. Serve with lime.',
      ),
    ],
  },
  {
    id: 'kotleciki-z-lososia',
    name: say('Kotleciki z łososia z papryką i koperkiem', 'Salmon patties with pepper and dill'),
    kind: 'obiad',
    minutes: 25,
    servings: 2,
    tool: say('Blender i patelnia', 'Blender and frying pan'),
    description: say(
      'Świeży łosoś krótko zmiksowany z koperkiem i czosnkiem, z chrupiącą papryką – kotleciki gotowe w kwadrans.',
      'Fresh salmon pulsed with dill and garlic, with crunchy pepper – patties ready in a quarter of an hour.',
    ),
    inspiredBy: powszechny('Kotleciki z łososiem i papryką', 'kotleciki-z-lososiem-i-papryka'),
    items: [
      { ingredient: 'salmonFillet', grams: 350, measure: say('350 g bez skóry', '350 g, skinned') },
      { ingredient: 'pepper', grams: 120, measure: say('1 mała papryka', '1 small pepper') },
      { ingredient: 'egg', grams: 50, measure: say('1 jajko', '1 egg') },
      { ingredient: 'dill', grams: 10, measure: say('pęczek', 'a bunch') },
      { ingredient: 'garlic', grams: 6, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'oil', grams: 10, measure: say('1 łyżka', '1 tbsp') },
    ],
    steps: [
      say(
        'Zmiksuj krótko pokrojonego łososia z jajkiem, koperkiem, czosnkiem, solą i pieprzem – zostaw kawałki.',
        'Pulse the chopped salmon briefly with the egg, dill, garlic, salt and pepper – keep some texture.',
      ),
      say(
        'Wmieszaj drobno pokrojoną paprykę i uformuj 6 płaskich kotlecików.',
        'Stir in the finely diced pepper and shape 6 flat patties.',
      ),
      say(
        'Smaż na rozgrzanym oleju po 3 minuty z każdej strony.',
        'Fry in the hot oil for 3 minutes on each side.',
      ),
    ],
  },
  {
    id: 'szakszuka',
    name: say('Szakszuka – jajka w pomidorach', 'Shakshuka – eggs in tomatoes'),
    kind: 'slone',
    minutes: 25,
    servings: 2,
    tool: say('Patelnia z pokrywką', 'Frying pan with a lid'),
    description: say(
      'Pięć jajek ściętych w gęstym sosie z pomidorów, cebuli i czosnku. Z jednej patelni, na śniadanie albo kolację.',
      'Five eggs set in a thick sauce of tomatoes, onion and garlic. One pan, for breakfast or supper.',
    ),
    inspiredBy: powszechny('Szakszuka fit', 'szakszuka-czyli-jajka-w-pomidorach'),
    items: [
      { ingredient: 'egg', grams: 250, measure: say('5 jajek', '5 eggs') },
      { ingredient: 'cannedTomatoes', grams: 400, measure: say('1 puszka', '1 tin') },
      { ingredient: 'onion', grams: 60, measure: say('1 mała cebula', '1 small onion') },
      { ingredient: 'garlic', grams: 6, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'oil', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
      { ingredient: 'chives', grams: 5, measure: say('szczypiorek albo bazylia', 'chives or basil') },
      { ingredient: 'spices', grams: 2, measure: say('sól, pieprz, ostra papryka', 'salt, pepper, hot paprika') },
    ],
    steps: [
      say(
        'Zeszklij cebulę i czosnek na oleju, wlej pomidory, dopraw i gotuj 8–10 minut, aż sos zgęstnieje.',
        'Soften the onion and garlic in the oil, add the tomatoes, season and simmer for 8–10 minutes until the sauce thickens.',
      ),
      say(
        'Zrób w sosie 5 dołków, wbij w nie jajka i gotuj pod przykryciem 5–7 minut, aż białka się zetną.',
        'Make 5 hollows in the sauce, crack the eggs into them and cook covered for 5–7 minutes until the whites set.',
      ),
      say('Posyp ziołami.', 'Scatter with herbs.'),
    ],
  },
  {
    id: 'lodeczki-z-lososiem',
    name: say('Łódeczki z łososiem i warzywami', 'Salmon parcels with vegetables'),
    kind: 'obiad',
    minutes: 40,
    servings: 2,
    tool: say('Papier do pieczenia i piekarnik', 'Baking paper and oven'),
    description: say(
      'Łosoś w musztardowo-cytrynowej marynacie upieczony na cukinii, pieczarkach i papryce w łódeczkach z papieru.',
      'Salmon in a mustard and lemon marinade, baked on courgette, mushrooms and pepper in baking paper boats.',
    ),
    inspiredBy: powszechny('Łódeczki z łososiem i warzywami', 'lodeczki-z-lososiem-i-warzywami'),
    items: [
      { ingredient: 'salmonFillet', grams: 350, measure: say('2 kawałki', '2 pieces') },
      { ingredient: 'zucchini', grams: 200, measure: say('1 mała cukinia', '1 small courgette') },
      { ingredient: 'mushrooms', grams: 150, measure: say('6 pieczarek', '6 mushrooms') },
      { ingredient: 'pepper', grams: 100, measure: say('pół dużej papryki', 'half a large pepper') },
      { ingredient: 'oil', grams: 10, measure: say('1 łyżka', '1 tbsp') },
      { ingredient: 'lemon', grams: 10, measure: say('sok z ćwiartki', 'juice of a quarter') },
      { ingredient: 'garlic', grams: 6, measure: say('2 ząbki', '2 cloves') },
      { ingredient: 'spices', grams: 3, measure: say('łyżeczka musztardy, sól, pieprz', 'a teaspoon of mustard, salt, pepper') },
    ],
    steps: [
      say(
        'Uformuj z papieru dwie łódeczki, rozłóż w nich pokrojone warzywa, skrop połową oliwy i dopraw.',
        'Fold two boats out of baking paper, fill them with the sliced vegetables, drizzle with half the oil and season.',
      ),
      say(
        'Wymieszaj resztę oliwy z musztardą, cytryną i czosnkiem, posmaruj łososia i połóż na warzywach.',
        'Mix the rest of the oil with the mustard, lemon and garlic, brush it over the salmon and lay it on the vegetables.',
      ),
      say('Piecz 22–25 minut w 190°C.', 'Bake for 22–25 minutes at 190°C.'),
    ],
  },
  {
    id: 'tacos-z-serka-wiejskiego',
    name: say('Tacos z serka wiejskiego z jajecznicą i awokado', 'Cottage cheese tacos with scrambled eggs and avocado'),
    kind: 'slone',
    minutes: 25,
    tool: say('Blender, blacha i patelnia', 'Blender, baking tray and frying pan'),
    description: say(
      'Placki upieczone z samego serka wiejskiego i białka jajka zamiast tortilli, z jajecznicą, awokado i pomidorem.',
      'Shells baked from nothing but cottage cheese and egg white instead of tortillas, filled with scrambled egg, avocado and tomato.',
    ),
    inspiredBy: powszechny('Tacos z serka wiejskiego z jajecznicą', 'tacos-z-serka-wiejskiego-z-jajecznica'),
    items: [
      { ingredient: 'cottage', grams: 150, measure: say('3/4 opakowania', '3/4 of a tub') },
      { ingredient: 'eggWhites', grams: 30, measure: say('białko z 1 jajka', 'white of 1 egg') },
      { ingredient: 'egg', grams: 100, measure: say('2 jajka', '2 eggs') },
      { ingredient: 'tomato', grams: 70, measure: say('1 mały pomidor', '1 small tomato') },
      { ingredient: 'avocado', grams: 50, measure: say('ćwiartka', 'a quarter') },
      { ingredient: 'lemon', grams: 5, measure: say('kilka kropel', 'a few drops') },
      { ingredient: 'oil', grams: 3, measure: say('do posmarowania papieru', 'to brush the paper') },
    ],
    steps: [
      say(
        'Zblenduj serek z białkiem, solą i pieprzem. Wylej na natłuszczony papier 3 cienkie placki i piecz 15 minut w 180°C.',
        'Blend the cottage cheese with the egg white, salt and pepper. Spread 3 thin rounds on oiled baking paper and bake for 15 minutes at 180°C.',
      ),
      say(
        'Rozgnieć awokado z sokiem z cytryny, pokrój pomidora, usmaż jajecznicę.',
        'Mash the avocado with the lemon juice, dice the tomato and scramble the eggs.',
      ),
      say(
        'Na lekko przestudzone placki nałóż awokado, jajecznicę i pomidora, złóż jak tacos.',
        'Top the slightly cooled shells with the avocado, eggs and tomato and fold like tacos.',
      ),
    ],
  },
  {
    id: 'lody-z-serka-wiejskiego-z-bananem',
    name: say('Lody z serka wiejskiego z bananem i kakao', 'Cottage cheese ice cream with banana and cocoa'),
    kind: 'miska',
    minutes: 25,
    servings: 2,
    tool: say('Blender i pojemnik do zamrażarki', 'Blender and freezer box'),
    description: say(
      'Serek wiejski zmiksowany z bananem na gęste lody, posypane kakao i orzechami. Słodzi je sam banan. Mrożą się 2–3 godziny.',
      'Cottage cheese blended with banana into a thick ice cream, dusted with cocoa and nuts. The banana is the only sweetener. Freeze for 2–3 hours.',
    ),
    inspiredBy: powszechny('Wysokobiałkowe lody z serka wiejskiego', 'wysokobialkowe-lody-z-serka-wiejskiego'),
    items: [
      { ingredient: 'cottage', grams: 400, measure: say('2 opakowania', '2 tubs') },
      { ingredient: 'banana', grams: 120, measure: say('1 dojrzały banan', '1 ripe banana') },
      { ingredient: 'nuts', grams: 15, measure: say('3 połówki', '3 halves') },
      { ingredient: 'cocoa', grams: 5, measure: say('1 łyżeczka', '1 tsp') },
    ],
    steps: [
      say(
        'Zblenduj serek z bananem na gładki krem i przełóż do pojemnika.',
        'Blend the cottage cheese with the banana until smooth and tip into the box.',
      ),
      say(
        'Mroź 2–3 godziny, mieszając co 45 minut, żeby nie zrobiły się kryształki.',
        'Freeze for 2–3 hours, stirring every 45 minutes so no ice crystals form.',
      ),
      say(
        'Przed podaniem odczekaj 10 minut, nałóż gałki i posyp kakao i posiekanymi orzechami.',
        'Leave for 10 minutes before serving, then scoop and sprinkle with cocoa and chopped nuts.',
      ),
    ],
  },
];
