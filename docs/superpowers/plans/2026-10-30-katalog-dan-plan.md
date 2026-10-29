# Photo catalog: from 351 dishes to ~1000 — plan

Owner's goal: "I want this model to be able to handle any picture really" → chose "Broad catalog":
~650 new dishes from cuisines worldwide plus ~40 catch-all types, measured before and after.

## How a region is added

Each region is two new files with the same ids, registered in two index files:

- `src/food/photo/catalog/<region>.ts` — `export const ENTRIES: readonly Entry[] = [ … ]`, built with
  the helpers in `src/food/photo/catalog/kit.ts` (`p`, `ml`, `PLATE`, `FAT_*`, `sweet`, `sauce`, …).
  Format: exactly like the entries in `src/food/photo/dishes.ts` (`ENTRIES`).
- `scripts/food/dish-sources/<region>.ts` — `export const DISHES: Record<string, Source> = { … }`
  (and optionally `PARTS`), built with `F`, `S`, `food`, `recipe`, `I` from
  `scripts/food/dish-sources/kit.ts`. Format: exactly like `DISHES` in `scripts/food/fetch-dishes.ts`.
- Register: `src/food/photo/catalog/index.ts` (`regions`) and `scripts/food/dish-sources/index.ts`
  (`regions`).
- Find USDA foods: `npm run food:find-usda -- <words>` (FNDDS food codes and SR ids, kcal/100 g).
- Check: `npm run food:dishes` (must finish; no `missing` lines for the new dishes' kcal/protein/
  carbs/fat), `npx vitest run src/food/photo/dishes.test.ts src/food/css.test.ts`,
  `node scripts/i18n-scan.mjs` (0), `npx tsc --noEmit -p tsconfig.node.json`, `npx tsc --noEmit`.
  `score.test.ts` fails until the embeddings are rebuilt at the end — expected.

## Regions and their dishes

Names are what to add (an English working name; pick the Polish label people in Poland use).
Skip a dish only if it duplicates one already in the catalog or another region; say so in the report.

1. **cee** — Poland and Central/Eastern Europe (more): kotlet de volaille, krokiety z kapustą
   i grzybami, pyzy z mięsem, kluski kładzione, łazanki z kapustą, naleśniki z mięsem, naleśniki ze
   szpinakiem, pasztet, galareta z nóżek, śledź w oleju z cebulą, schab pieczony, karkówka z grilla,
   golonka, pulpety w sosie koperkowym, bitki wołowe, zrazy zawijane, schab ze śliwką, kurczak pieczony
   (cały, porcja), flaki, zupa szczawiowa, botwinka, barszcz biały, zupa fasolowa, zupa rybna, ryba
   po grecku, karp smażony, dorsz w panierce, makrela wędzona, pstrąg pieczony, buraczki zasmażane,
   kasza jaglana, kasza z sosem grzybowym, kluski z makiem, kutia, leczo, kotlet jajeczny, smalec ze
   skwarkami na chlebie, ogórki kiszone, oscypek z grilla z żurawiną, tost z szynką i serem, faworki,
   babka drożdżowa, piernik, keks, mazurek, sernik na zimno exists? (check), placek drożdżowy
   z kruszonką, pierniczki, pączek z różą exists? (check), pelmeni, blini, solyanka, syrniki, borsch
   ukraiński z mięsem, salo, svíčková, knedlíky, smažený sýr, trdelník, chicken paprikash, pörkölt,
   palacsinta z nadzieniem, cepelinai, kotlet po kijowsku, wareniki z wiśniami, chaczapuri? (no —
   region 5), kwas chlebowy, kompot, kisiel.
2. **med** — Italy, France, Spain, Portugal, Greece (more): pizza margherita, pizza quattro
   formaggi, pizza capricciosa, spaghetti all'amatriciana, cacio e pepe, spaghetti alle vongole,
   spaghetti with meatballs, pasta al forno, mushroom risotto, risotto alla milanese, seafood
   risotto, osso buco, saltimbocca, vitello tonnato, polenta, porchetta sandwich, piadina, panino,
   antipasto platter, prosciutto e melone, burrata, frittata, pasta e fagioli, ribollita, affogato,
   biscotti, panettone, steak frites, coq au vin, cassoulet, bouillabaisse, galette bretonne
   (buckwheat crepe ham egg cheese), tarte tatin, profiteroles, pain au chocolat, duck confit, salade
   lyonnaise, gratin dauphinois, madeleines, crème caramel, jamón ibérico plate, pimientos de padrón,
   gambas al ajillo, pulpo a la gallega, albóndigas, crema catalana, salmorejo, fabada, bocadillo de
   calamares, pastel de nata, bacalhau à brás, francesinha, caldo verde, bifana, piri piri chicken,
   pastitsio, gemista, fasolada, loukoumades, saganaki, keftedes, seafood paella? (check vs paella),
   lasagne verdi? (no), carpaccio di pesce? (no), quiche lorraine (check vs quiche), soupe au pistou?
   (no), tapenade on toast, pan con tomate, sangria.
3. **eastAsia** — China, Japan, Korea, Taiwan (more): xiaolongbao, char siu, dan dan noodles,
   zhajiangmian, lo mein, beef chow fun, egg drop soup, hot pot, sesame chicken, cashew chicken,
   mongolian beef, twice cooked pork, crispy pork belly, salt and pepper squid, steamed fish with
   ginger and scallion, scallion pancakes, jianbing, baozi, egg tart, mooncake, stir fried bok choy,
   egg foo young, soba, yakisoba, okonomiyaki, karaage, yakitori, oyakodon, katsudon, gyudon,
   chirashi, temaki, unadon, chawanmushi, sukiyaki, shabu-shabu, mochi, dorayaki, matcha latte, bento
   box, nikujaga, tamagoyaki, japchae, kimchi jjigae, sundubu jjigae, samgyeopsal, galbi, kimbap,
   naengmyeon, jajangmyeon, haemul pajeon, bingsu, hotteok, taiwanese beef noodle soup, lu rou fan,
   taiwanese popcorn chicken, gua bao, tonkotsu ramen (check vs ramen — skip if duplicate), miso
   ramen (skip), chinese steamed buns? (= baozi), sweet and sour pork, chinese broccoli with oyster
   sauce, fried tofu.
4. **southAsiaSea** — India and South Asia, Southeast Asia (more): chicken tikka masala, tandoori
   chicken, rogan josh, vindaloo, korma, paneer tikka, malai kofta, aloo gobi, baingan bharta, rajma,
   dal makhani, chole bhature, pav bhaji, vada pav, idli with sambar, uttapam, pulao, jeera rice,
   roti, paratha, aloo paratha, bhel puri, pani puri, gulab jamun, jalebi, kheer, mango lassi, masala
   chai, raita, keema, chicken 65, kerala fish curry, thali, nihari, haleem, momo, kottu roti, pad see
   ew, pad kra pao, massaman curry, red curry, panang curry, tom kha gai, larb, khao soi, khao man
   gai, pineapple fried rice, bun cha, bun bo hue, com tam, banh xeo, bun thit nuong, nasi goreng, mie
   goreng, beef rendang, gado-gado, nasi lemak, laksa, char kway teow, hainanese chicken rice, roti
   canai, soto ayam, bakso, chicken adobo, sinigang, lechon, pancit, lumpia, halo-halo, thai iced tea,
   samosa chaat? (no), egg curry, fish amok.
5. **meaCaucasus** — Turkey, Levant, Iran, North and Sub-Saharan Africa, Caucasus, Central Asia:
   iskender kebab, adana kebab, pide, manti, börek, gözleme, simit, künefe, turkish delight, imam
   bayildi, fattoush, kibbeh, manakish za'atar, mansaf, maqluba, labneh, ful medames, shish tawook,
   mixed grill plate, muhammara, chelo kebab koobideh, ghormeh sabzi, fesenjan, tahdig, ash reshteh,
   chicken tagine, couscous royal, harira, brik, merguez, pastilla, jollof rice, egusi soup with fufu,
   suya, injera with doro wat, bobotie, bunny chow, chakalaka, mandazi, maafe, biltong, khachapuri
   adjaruli, khinkali, shashlik, lobio, plov, lagman, samsa, chebureki, sabich, ayran, turkish tea,
   mint tea, lentil soup turkish style? (check vs lentil soup), kebab plate with rice (check vs kebab
   box), hummus with meat? (no), dates with tahini? (no).
6. **americas** — USA, Canada, Mexico, Latin America and the Caribbean (more): bbq brisket, corn
   on the cob, cornbread, biscuits and gravy, chicken and waffles, fried catfish, gumbo, jambalaya,
   po' boy, reuben sandwich, pastrami sandwich, tuna melt, cobb salad, chef salad, chili dog, sloppy
   joe, tater tots, hash browns, banana split, pecan pie, pumpkin pie, key lime pie, s'mores, pot
   roast, thanksgiving turkey plate, green bean casserole, loco moco, spam musubi, nashville hot
   chicken, chicken tenders, mozzarella sticks, jalapeño poppers, chicken fried steak, veggie
   burger, turkey sandwich, pb&j sandwich, açaí bowl, smoothie bowl, overnight oats, butter tarts,
   nanaimo bar, tourtière, tacos al pastor, carnitas, birria tacos, tamales, pozole, mole poblano,
   chilaquiles, elote, tostadas, sopes, taquitos, tres leches cake, flan, horchata, mexican rice and
   refried beans, carne asada, feijoada, pão de queijo, coxinha, picanha, moqueca, brigadeiro, lomo
   saltado, ají de gallina, causa limeña, anticuchos, empanadas, asado, milanesa, choripán, alfajores,
   arepas, pabellón criollo, bandeja paisa, pupusas, gallo pinto, ropa vieja, cuban sandwich, jerk
   chicken, rice and peas, fried plantains, mofongo, arroz con pollo, sub sandwich.
7. **northWest** — Britain and Ireland, German-speaking countries, the Nordics, Benelux, the Balkans:
   sunday roast beef with yorkshire pudding, roast chicken dinner, steak and kidney pie, cornish
   pasty, sausage roll, scotch egg, ploughman's lunch, jacket potato with beans and cheese, toad in
   the hole, sticky toffee pudding, victoria sponge, eton mess, trifle, crumpets, kedgeree, haggis
   neeps and tatties, irish stew, welsh rarebit, fish pie, beef wellington, mince pies, apple crumble
   with custard, currywurst, bratwurst with sauerkraut, schweinshaxe, sauerbraten, rinderrouladen,
   käsespätzle, jägerschnitzel, maultaschen, flammkuchen, pretzel, leberkäse, kaiserschmarrn,
   apfelstrudel, sachertorte, black forest cake, germknödel, cheese fondue, raclette, rösti, zürcher
   geschnetzeltes, bircher muesli, swedish meatballs with lingonberry, gravlax, smørrebrød, salmon
   soup (lohikeitto), janssons frestelse, stoofvlees with fries, stroopwafel, bitterballen, stamppot,
   poffertjes, frikandel, kibbeling, ćevapi, pljeskavica, burek, shopska salad, banitsa, sarma? (check
   vs gołąbki), ajvar? (no), goulash with dumplings? (check region 1 knedlíky), pierogi? (no).
8. **everyday** — breakfast, bakery, sweets, snacks, drinks, fast food, single foods (more):
   muesli with milk, granola with milk, chia pudding, toast with butter, toast with jam, toast with
   peanut butter, egg sandwich, breakfast muffin sandwich, croissant with ham and cheese, crepes with
   nutella, baguette, ciabatta, slice of white bread, wholegrain bread, kaiser roll, pita bread,
   plain tortilla wrap, sourdough toast, danish pastry, puff pastry with fruit, oatmeal cookie,
   shortbread, banana bread, sponge cake, layer cake with cream (tort), birthday cake, fruit tart,
   pavlova, meringue, ice cream sundae, popsicle, sorbet, chocolate pralines, gummy candy, jelly
   dessert (galaretka), rice pudding, semolina pudding, pretzel sticks, tortilla chips with salsa,
   olives, salted peanuts, trail mix, dried fruit, rice cakes, granola bar, energy balls, beef jerky,
   sunflower seeds, dark chocolate, fruit yogurt cup, cottage cheese, fish sandwich, loaded fries,
   ice cream with candy pieces (mcflurry style), flat white, mocha, iced coffee, frappuccino, green
   tea, iced tea, apple juice, tomato juice, vegetable juice, coconut water, sports drink, mojito,
   aperol spritz, margarita, gin and tonic, piña colada, vodka shot, whisky, cider, non-alcoholic
   beer, kombucha, avocado half, carrot sticks, tomato salad, baked potato, roasted potatoes, potato
   wedges, fried tofu? (check region 3), lentils, chickpeas, tuna steak, baked cod fillet, grilled
   shrimp, roast pork tenderloin, roast beef slices, turkey breast slices, ham slices, salami, cheese
   slices, mozzarella ball, pineapple, peach, apricot, melon, grapefruit, pomegranate, figs, dates,
   papaya, lychee, dragon fruit.
9. **generic** (catch-all types; done by the main session): a cream soup, a clear soup with
   vegetables, a meat stew, roast meat with potatoes and salad, fried meat with sides, fish with
   sides, chicken with rice/groats and vegetables, pasta with tomato sauce, pasta with cream sauce,
   a rice dish, asian noodles, a curry, a salad with meat, a vegetable salad, a sandwich, a wrap,
   a burger, a pizza, pancakes, dumplings, a breaded cutlet, a casserole, a bean stew, a vegetarian
   dish with vegetables, porridge or cereal, an egg breakfast, a cake, a creamy dessert, ice cream,
   cookies, sweets, salty snacks, mixed fruit, raw vegetables, a sweet drink, a milky coffee, an
   alcoholic drink, bread, a mixed plate.

## After the regions

1. Merge the region branches into `feat/katalog-dan`, `npm run food:dishes`.
2. `npm run food:dish-embeddings` (downloads the 1.1 GB text model once).
3. Measure on Commons photos: old dishes (does the bigger catalog cost them accuracy?) and new
   ones; decide whether catch-all types need a handicap in the ranking.
4. Phone side: dish table and catalog chunk sizes; recognition time.
