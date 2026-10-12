import { ChevronRight, Clock, Store, Utensils } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { plural } from '../../lib/format';
import type { Dictionaries } from '../../lib/types';
import { KIND_LABELS, servingsOf, type Recipe } from '../../recipes/catalog';
import {
  availableStores,
  bestVariant,
  needsStore,
  resolveRecipe,
  type Candidates,
  type Overrides,
} from '../../recipes/resolve';
import { tierOf } from '../../recipes/tiers';
import { IngredientLine } from './IngredientLine';
import { MacroSummary } from './MacroSummary';
import { SwapSheet } from './SwapSheet';
import { TierBadge } from './TierBadge';
import './recipes.css';

interface Props {
  recipe: Recipe;
  candidates: Candidates;
  ranking: string[];
  /** Filtr sklepu strony; bez niego każdy przepis stoi w swoim najlepszym sklepie. */
  pageStore: string | null;
  dict: Dictionaries;
  onOpenProduct: (code: string) => void;
  /** Jak nazwać sieć na karcie: w pobliżu „Biedronka · 350 m · Marszałkowska 10”. */
  describeStore?: (chain: string) => string;
}

/**
 * Karta przepisu w stroju karty aplikacji: grupa czasu, rodzaj i czas, makro na porcję z zasadą,
 * sklep z przełącznikiem, składniki z zamianą w arkuszu i kroki pod „Jak zrobić”. Wspólna dla
 * Przepisów i „W pobliżu”.
 */
export function RecipeCard({ recipe, candidates, ranking, pageStore, dict, onOpenProduct, describeStore }: Props) {
  const titleId = useId();
  const storeName = (chain: string) => dict.stores[chain] ?? chain;
  // Własny wybór sklepu na karcie — liczy się tylko, dopóki strona nie ma filtra sklepu.
  const [cardStore, setCardStore] = useState<string | null | undefined>(undefined);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [swapId, setSwapId] = useState<string | null>(null);

  const stores = useMemo(() => availableStores(recipe, candidates, ranking), [recipe, candidates, ranking]);
  // Domyślny sklep liczony BEZ zamian użytkownika: zamiana, która łamie zasadę, ma być pokazana
  // jako złamana, a nie po cichu przeniesiona do innego sklepu.
  const defaultStore = useMemo(() => bestVariant(recipe, candidates, ranking)?.store ?? null, [recipe, candidates, ranking]);
  const store = pageStore ?? cardStore ?? defaultStore;
  const resolved = useMemo(
    () => resolveRecipe(recipe, candidates, store, overrides),
    [recipe, candidates, store, overrides],
  );
  const swapping = swapId ? (resolved.items.find((i) => i.def.id === swapId) ?? null) : null;

  const servings = servingsOf(recipe);
  const chooseStore = (next: string) => {
    setCardStore(next);
    // Zamiany należały do poprzedniego sklepu.
    setOverrides({});
  };

  // Przepis, który potrzebuje sklepu, jest pokazywany tylko z takim, który ma wszystko
  // (bestVariant nie miesza sklepów), więc `store` jest wtedy zawsze ustawiony.
  const shopLine =
    needsStore(recipe) && store
      ? `Wszystko kupisz w: ${describeStore ? describeStore(store) : storeName(store)}`
      : 'Składniki są w każdym sklepie';

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
          {needsStore(recipe) && !pageStore && stores.length > 1 && (
            <div className="chips fd-rec-shop-chips" role="group" aria-label={`Sklep dla: ${recipe.name}`}>
              {stores.map((s) => (
                <button key={s} type="button" aria-pressed={s === store} onClick={() => chooseStore(s)}>
                  {storeName(s)}
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
                store={store}
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
        store={store}
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
