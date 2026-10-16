# Polish classics as protein recipes — design

Date: 2026-10-16 · Status: decided autonomously on request ("Analyze current system. Use best
practices. Pick recommended. I am away from machine. Plan it out and then finish on your own").

## Request

„Inspirując się tymi przepisami: ~/Projects/przepisy-open stwórz z produktów, które mamy dostępne,
nowe przepisy. Chcę zachować filozofię związaną z albo 1 sklepem fizycznym, albo sklep fizyczny +
sklep online.”

## What exists

- **przepisy-open:** 1021 recipes (1008 Polish, 13 English) scraped from the Wikibooks cookbook
  („Książka kucharska”), CC BY-SA 4.0. One JSON line per recipe: title, url, history_url,
  ingredients, steps. The README asks for attribution when adapted recipes are published.
- **Our recipes** (`src/food/recipes/catalog.ts`): 57 recipes. Every recipe that is not a gotowiec
  passes THE RULE per serving: more protein than carbohydrate, and more protein than fat. The
  catalog test checks this on typical values, before any product is chosen. Ingredients are
  abstract (`ingredients.ts`), each with a role:
  - `store`: must be found in the chosen store;
  - `staple`: sold everywhere, so the store's product is used when known and typical values
    otherwise;
  - `pantry`: kept at home.
- **Baskets** (`baskets.ts`): a recipe is bought in one physical store, or in a physical store
  plus an online shop, or in two online shops. Never in two physical stores. A recipe with only
  staples and pantry goods needs no store at all.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| What to take | **Classic Polish dishes, reworked into protein recipes**. 16 were chosen from the Wikibooks set: gzik, leniwe, ryba po grecku, bigos, ogórkowa, potrawka, gołąbki, mielone, szaszłyki, sałatka gyros, śledzie, jajka w sosie szczypiorkowym, placki z cukinii, sernik, twaróg z awokado and racuchy | The set is mostly classic home cooking that breaks THE RULE (fat, flour, sugar). A known dish, reworked so it passes, is what the app has been missing. A copy of an existing dish would not pass |
| Rework | Skyr instead of sour cream and mayonnaise; turkey or chicken instead of pork, bacon and sausage; lean quark; less flour; a sweetener instead of sugar; meat stays in the soup. The amounts, steps and descriptions are our own | THE RULE per serving; ideas and dishes are free to use, while the Wikibooks text is under CC BY-SA |
| Attribution | `Recipe.inspiredBy {title, url}`. The card ends with „Na motywach przepisu „…” z Książki kucharskiej w Wikibooks (licencja CC BY-SA 4.0)”, with both links opening in a new tab | Honest about the source, as the dataset's README asks. Nothing is fetched from it, so only the CSP navigation list grows |
| Basket philosophy | 15 recipes can be bought in one physical store. 3 of them (ryba po grecku, bigos, gołąbki) are all staples, so „Składniki są w każdym sklepie”. Racuchy use the protein pancake mix from Myprotein, so they are bought in a physical store plus an online shop | This is exactly the rule the user asked to keep, and `food:check-recipes` shows every basket |
| New ingredients | turkey fillet, white and Peking cabbage, carrot, potato and avocado are staples with no matcher (raw produce and raw meat cannot be told apart from cold cuts or blends in the data). Sauerkraut, brined cucumbers (`brinedCucumber`, „ogórki kiszone”) and wheat flour are staples with matchers. Herring fillets are a staple with a matcher: they are in every Polish chiller, but only Selgros and Auchan have them in the data, so a `store` role would leave śledź with Selgros only. Gelatin is pantry | Same approach as the existing produce; a matcher only where names and macros can separate the plain product from salads, soups, crisps and mixes |
| Classic group | `CLASSICS` is appended to `RECIPES` after `FROM_ONLINE_SHOPS`, with its own comment on the source | Keeps the catalog readable by origin |

## Testing

- Catalog tests run on every recipe: defined ingredients, THE RULE on typical values, time,
  servings, and multi-serving recipes take more than 20 minutes.
- A test checks that every classic links an https Wikibooks cookbook page (pl or en).
- Matcher tests for herring, sauerkraut, brined cucumbers, flour and gelatin, each with the
  products that must stay out. Another test checks that turkey fillet has no matcher.
- A card test checks the source link, the licence link, the new tab, and that our own recipes
  have no source line.
- The CSP test gets the navigation hosts pl.wikibooks.org, en.wikibooks.org and
  creativecommons.org.
- `npm run food:check-recipes` checks the baskets against real data.

## Out of scope

Importing the Wikibooks dataset wholesale, showing Wikibooks text, search by dish origin, a
„Klasyki” filter chip (the kinds and time groups already cover browsing).
