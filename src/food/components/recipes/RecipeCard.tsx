import { ChevronRight, Clock, ExternalLink, Store, Utensils } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
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
import './recipes.css';

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
}

/** Ile koszyków pokazać jako żetony — dalej są te same sklepy w innej parze. */
const MAX_BASKET_CHIPS = 8;

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
        <span className="sr-only"> (otwiera się w nowej karcie)</span>
      </a>{' '}
      <span className="fd-rec-online-kind">({shop.kind === 'producent' ? 'producent, kupisz online' : 'sklep internetowy'})</span>
    </>
  );
}

/**
 * Karta przepisu w stroju karty aplikacji: grupa czasu, rodzaj i czas, makro na porcję z zasadą,
 * koszyk sklepów z przełącznikiem, składniki z zamianą w arkuszu i kroki pod „Jak zrobić”. Wspólna
 * dla Przepisów i „W pobliżu”.
 */
export function RecipeCard({ recipe, candidates, baskets, dict, onOpenProduct, describeStore }: Props) {
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
  const hasStaples = recipe.items.some((i) => INGREDIENTS[i.ingredient].role === 'staple');

  let shopLine: ReactNode;
  if (!basket || !needsStore(recipe)) shopLine = 'Składniki są w każdym sklepie';
  else if (basket.length === 1)
    shopLine = isOnlineShop(basket[0]!) ? (
      <>
        Wszystko kupisz przez internet: {describe(basket[0]!)}
        {hasStaples && ' – a podstawy (mleko, owoce, warzywa) w każdym sklepie'}
      </>
    ) : (
      <>Wszystko kupisz w: {describe(basket[0]!)}</>
    );
  else
    shopLine = (
      <>
        Kupisz w 2 sklepach: {describe(basket[0]!)} + {describe(basket[1]!)}
      </>
    );

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
        <h3 id={titleId} className="fd-rec-name">
          {recipe.name}
        </h3>
        <p className="fd-rec-desc">{recipe.description}</p>

        <MacroSummary serving={resolved.perServing} servings={servings} passes={resolved.passes} kind={recipe.kind} />

        <div className="fd-rec-shop">
          <p className="fd-rec-shop-line">
            <Store size={20} strokeWidth={2} aria-hidden />
            <span>{shopLine}</span>
          </p>
          {baskets.length > 1 && (
            <div className="chips fd-rec-shop-chips" role="group" aria-label={`Sklep dla: ${recipe.name}`}>
              {baskets.slice(0, MAX_BASKET_CHIPS).map((b, i) => (
                <button key={b.join('+')} type="button" aria-pressed={b === basket} onClick={() => chooseBasket(i)}>
                  {b.map(storeName).join(' + ')}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="fd-rec-ings">
          <h4 className="fd-rec-sub">Składniki</h4>
          {servings > 1 && (
            <p className="fd-rec-ings-note">
              Ilości na cały przepis, czyli {servings} {plural(servings, 'porcję', 'porcje', 'porcji')}.
            </p>
          )}
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
            Jak zrobić
            <ChevronRight className="fd-rec-steps-caret" size={20} strokeWidth={2} aria-hidden />
          </summary>
          <ol>
            {recipe.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
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
