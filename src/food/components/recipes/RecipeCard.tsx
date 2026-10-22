import { ChevronRight, Clock, ExternalLink, Store, Utensils } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { pluralEn, text } from '../../../i18n';
import { plural } from '../../lib/format';
import type { Dictionaries } from '../../lib/types';
import { KIND_LABELS, servingsOf, type Recipe } from '../../recipes/catalog';
import { onlineShop, isOnlineShop } from '../../online/shops';
import { INGREDIENTS } from '../../recipes/ingredients';
import { needsStore, resolveRecipe, type Candidates, type Overrides } from '../../recipes/resolve';
import { tierOf } from '../../recipes/tiers';
import { IngredientLine } from './IngredientLine';
import { MacroSummary } from './MacroSummary';
import { SwapSheet } from './SwapSheet';
import { TierBadge } from './TierBadge';
import { COMMON } from '../common/text';
import './recipes.css';

const T = text({
  pl: {
    producer: 'producent, kupisz online',
    online: 'sklep internetowy',
    staples: (list: string, more: boolean) => ` – a ${list}${more ? ' i reszta podstaw' : ''}` + ' w dowolnym sklepie',
    anyShop: 'Składniki są w każdym sklepie',
    buyOnline: (shop: ReactNode, note: string): ReactNode => (
      <>
        Kupisz przez internet: {shop}
        {note}
      </>
    ),
    buyAll: (shop: ReactNode): ReactNode => <>Wszystko kupisz w: {shop}</>,
    buyTwo: (a: ReactNode, b: ReactNode, note: string): ReactNode => (
      <>
        Kupisz w 2 sklepach: {a} + {b}
        {note}
      </>
    ),
    shopFor: (name: string) => `Sklep dla: ${name}`,
    ingredients: 'Składniki',
    amounts: (n: number) => `Ilości na cały przepis, czyli ${n} ${plural(n, 'porcję', 'porcje', 'porcji')}.`,
    steps: 'Jak zrobić',
    quoteOpen: '„',
    quoteClose: '”',
    source: (recipe: ReactNode, license: ReactNode): ReactNode => (
      <>
        Na motywach przepisu {recipe} z Książki kucharskiej w Wikibooks (licencja {license}).
      </>
    ),
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.pl',
  },
  en: {
    producer: 'producer, buy online',
    online: 'online shop',
    staples: (list: string, more: boolean) => ` – plus ${list}${more ? ' and the other basics' : ''} from any shop`,
    anyShop: 'The ingredients are in every shop',
    buyOnline: (shop: ReactNode, note: string): ReactNode => (
      <>
        Buy online: {shop}
        {note}
      </>
    ),
    buyAll: (shop: ReactNode): ReactNode => <>Get everything at: {shop}</>,
    buyTwo: (a: ReactNode, b: ReactNode, note: string): ReactNode => (
      <>
        Buy in 2 shops: {a} + {b}
        {note}
      </>
    ),
    shopFor: (name: string) => `Shop for: ${name}`,
    ingredients: 'Ingredients',
    amounts: (n: number) => `Amounts for the whole recipe, that is ${n} ${pluralEn(n, 'serving', 'servings')}.`,
    steps: 'How to make it',
    quoteOpen: '“',
    quoteClose: '”',
    source: (recipe: ReactNode, license: ReactNode): ReactNode => (
      <>
        Based on the recipe {recipe} from the Polish Wikibooks cookbook (licence: {license}).
      </>
    ),
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
  },
});

interface Props {
  recipe: Recipe;
  candidates: Candidates;
  /**
   * Koszyki do wyboru, najwygodniejszy pierwszy: jeden sklep albo sklep i sklep internetowy
   * (`recipeBaskets`), zawężone przez stronę (filtr sklepu, grupa). Puste: przepis nie potrzebuje
   * żadnego konkretnego sklepu.
   */
  baskets: string[][];
  dict: Dictionaries;
  onOpenProduct: (code: string) => void;
  /** Jak nazwać sieć na karcie: w pobliżu „Biedronka · 350 m · Marszałkowska 10”. */
  describeStore?: (chain: string) => string;
  /** Miejsce karty w konspekcie: h3 na liście, h4 pod nagłówkiem grupy „Według sklepów”. */
  headingLevel?: 3 | 4;
}

/** „Filet z piersi kurczaka” w środku zdania: od małej litery. */
const inSentence = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);

/** Ile koszyków pokazać jako żetony — dalej są te same sklepy w innej parze. */
const MAX_BASKET_CHIPS = 8;

/** Licencja Książki kucharskiej w Wikibooks, z której pochodzą pomysły klasyków. */
const CC_BY_SA = T.licenseUrl;

/** Sklep internetowy jako odnośnik do sklepu, z dopiskiem — kolor nie mówi tego sam. */
export function OnlineShopLink({ id, dict }: { id: string; dict: Dictionaries }) {
  const shop = onlineShop(id);
  const name = dict.stores[id] ?? shop?.name ?? id;
  if (!shop) return <>{name}</>;
  return (
    <>
      <a className="fd-rec-online" href={shop.url} target="_blank" rel="noopener noreferrer">
        {name}
        <ExternalLink size={14} strokeWidth={2} aria-hidden />
        <span className="sr-only">{COMMON.newTab}</span>
      </a>{' '}
      <span className="fd-rec-online-kind">({shop.kind === 'producent' ? T.producer : T.online})</span>
    </>
  );
}

/**
 * Karta przepisu w stroju karty aplikacji: grupa czasu, rodzaj i czas, makro na porcję z zasadą,
 * koszyk sklepów z przełącznikiem, składniki z zamianą w arkuszu i kroki pod „Jak zrobić”. Wspólna
 * dla Przepisów i „W pobliżu”.
 */
export function RecipeCard({
  recipe,
  candidates,
  baskets,
  dict,
  onOpenProduct,
  describeStore,
  headingLevel = 3,
}: Props) {
  const Title = headingLevel === 4 ? 'h4' : 'h3';
  const Sub = headingLevel === 4 ? 'h5' : 'h4';
  const titleId = useId();
  const storeName = (chain: string) => dict.stores[chain] ?? onlineShop(chain)?.name ?? chain;
  const [choice, setChoice] = useState(0);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [swapId, setSwapId] = useState<string | null>(null);

  // Zmienione koszyki (inny filtr strony) przychodzą z nowym kluczem karty — wybór zaczyna się od zera.
  const basket = baskets[Math.min(choice, baskets.length - 1)] ?? null;
  // Koszyk po kluczu, nie po tożsamości: strona buduje listy koszyków od nowa przy każdym renderze.
  const key = basket ? basket.join('+') : null;
  const resolved = useMemo(
    () => resolveRecipe(recipe, candidates, key === null ? null : key.split('+'), overrides),
    [recipe, candidates, key, overrides],
  );
  const swapping = swapId ? (resolved.items.find((i) => i.def.id === swapId) ?? null) : null;

  const servings = servingsOf(recipe);
  const chooseBasket = (next: number) => {
    setChoice(next);
    // Zamiany należały do poprzedniego koszyka.
    setOverrides({});
  };
  const describe = (s: string) =>
    isOnlineShop(s) ? <OnlineShopLink id={s} dict={dict} /> : describeStore ? describeStore(s) : storeName(s);
  // Koszyk z samych sklepów internetowych nie ma półki z mlekiem: podstawy przepisu idą z dowolnego
  // sklepu — i karta mówi które, a nie „mleko, owoce” na ślepo.
  const staples = recipe.items
    .map((i) => INGREDIENTS[i.ingredient])
    .filter((d) => d.role === 'staple')
    .map((d) => d.label);
  const onlineOnly = !!basket && basket.length > 0 && basket.every(isOnlineShop);
  const staplesNote =
    onlineOnly && staples.length > 0 ? T.staples(staples.slice(0, 3).map(inSentence).join(', '), staples.length > 3) : '';

  let shopLine: ReactNode;
  if (!basket || !needsStore(recipe)) shopLine = T.anyShop;
  else if (basket.length === 1)
    shopLine = isOnlineShop(basket[0]!) ? T.buyOnline(describe(basket[0]!), staplesNote) : T.buyAll(describe(basket[0]!));
  else shopLine = T.buyTwo(describe(basket[0]!), describe(basket[1]!), staplesNote);

  return (
    <>
      <article className="fd-rec-card" aria-labelledby={titleId}>
        <div className="fd-rec-meta">
          <TierBadge tier={tierOf(recipe.minutes)} />
          <span className="fd-rec-kind">{KIND_LABELS[recipe.kind]}</span>
          <span className="fd-rec-fact">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {recipe.minutes} min
          </span>
          <span className="fd-rec-fact">
            <Utensils size={16} strokeWidth={2} aria-hidden />
            {recipe.tool}
          </span>
        </div>
        <Title id={titleId} className="fd-rec-name">
          {recipe.name}
        </Title>
        <p className="fd-rec-desc">{recipe.description}</p>

        <MacroSummary serving={resolved.perServing} servings={servings} passes={resolved.passes} kind={recipe.kind} />

        <div className="fd-rec-shop">
          <p className="fd-rec-shop-line">
            <Store size={20} strokeWidth={2} aria-hidden />
            <span>{shopLine}</span>
          </p>
          {baskets.length > 1 && (
            <div className="chips fd-rec-shop-chips" role="group" aria-label={T.shopFor(recipe.name)}>
              {baskets.slice(0, MAX_BASKET_CHIPS).map((b, i) => (
                <button key={b.join('+')} type="button" aria-pressed={b === basket} onClick={() => chooseBasket(i)}>
                  {b.map(storeName).join(' + ')}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="fd-rec-ings">
          <Sub className="fd-rec-sub">{T.ingredients}</Sub>
          {servings > 1 && <p className="fd-rec-ings-note">{T.amounts(servings)}</p>}
          <ul className="fd-rec-ing-list">
            {resolved.items.map((r) => (
              <IngredientLine
                key={r.def.id}
                resolved={r}
                basket={basket}
                dict={dict}
                onSwap={() => setSwapId(r.def.id)}
                onOpenProduct={onOpenProduct}
              />
            ))}
          </ul>
        </div>

        <details className="fd-rec-steps">
          <summary>
            {T.steps}
            <ChevronRight className="fd-rec-steps-caret" size={20} strokeWidth={2} aria-hidden />
          </summary>
          <ol>
            {recipe.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>

        {recipe.inspiredBy && (
          <p className="fd-rec-source">
            {T.source(
              <a href={recipe.inspiredBy.url} target="_blank" rel="noopener noreferrer">
                {T.quoteOpen}
                <span lang={recipe.inspiredBy.lang}>{recipe.inspiredBy.title}</span>
                {T.quoteClose}
                <span className="sr-only">{COMMON.newTab}</span>
              </a>,
              <a href={CC_BY_SA} target="_blank" rel="noopener noreferrer">
                CC BY-SA 4.0<span className="sr-only">{COMMON.newTab}</span>
              </a>,
            )}
          </p>
        )}
      </article>

      <SwapSheet
        open={swapping !== null}
        recipe={recipe}
        candidates={candidates}
        basket={basket}
        overrides={overrides}
        item={swapping}
        dict={dict}
        onPick={(code) => {
          if (swapId) setOverrides((o) => ({ ...o, [swapId]: code }));
        }}
        onClose={() => setSwapId(null)}
      />
    </>
  );
}
