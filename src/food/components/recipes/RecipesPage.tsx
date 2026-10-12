import { useCallback, useMemo } from 'react';
import { EmptyState } from '../../../components/ui';
import { useDataset } from '../../hooks/useDataset';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber, plural } from '../../lib/format';
import type { Dataset, IndexedProduct } from '../../lib/types';
import { GOTOWIEC_MIN_PROTEIN, KIND_LABELS, RECIPES, type Recipe, type RecipeKind } from '../../recipes/catalog';
import { readyProducts } from '../../recipes/ready';
import { bestVariant, needsStore, recipeIndex, resolveRecipe, type Candidates } from '../../recipes/resolve';
import { byTime, TIER_LABELS, tierOf, type TimeTier } from '../../recipes/tiers';
import { recipesFromParams, recipesToParams } from '../../recipes/url';
import { DataFooter } from '../common/DataFooter';
import { ProductDetail } from '../common/ProductDetail';
import { StatusScreen } from '../common/StatusScreen';
import { ChipRow } from './ChipRow';
import { ReadyProducts } from './ReadyProducts';
import { RecipeCard } from './RecipeCard';
import { TierIcon } from './TierBadge';
import './recipes.css';

/**
 * Sklep dostaje własny żeton, gdy da się w nim kupić w całości co najmniej tyle przepisów, które
 * sklepu potrzebują. Dwa wpuszczały sklep osiedlowy (Żabkę) tylko dzięki założeniu „podstawy są
 * wszędzie”, które właśnie tam jest najsłabsze.
 */
const MIN_STORE_RECIPES = 3;

function shownIn(recipe: Recipe, candidates: Candidates, store: string | null, ranking: string[]): boolean {
  if (!store) return bestVariant(recipe, candidates, ranking) !== null;
  const r = resolveRecipe(recipe, candidates, store);
  return r.available && r.passes;
}

const TIERS = Object.keys(TIER_LABELS) as TimeTier[];
const KINDS = Object.keys(KIND_LABELS) as RecipeKind[];

/**
 * Przepisy białkowe: w każdej porcji więcej białka niż węglowodanów i więcej niż tłuszczu,
 * liczone z prawdziwych produktów sklepu. Filtry czasu, rodzaju i sklepu stoją w zapytaniu hasha
 * (`#/przepisy?czas=szybkie&sklep=lidl`), otwarty produkt też (`p=`), więc Wstecz go zamyka.
 */
export default function RecipesPage() {
  const data = useDataset();
  if (data.status === 'loading') return <StatusScreen kind="loading" />;
  if (data.status === 'error') return <StatusScreen kind="error" message={data.message} onRetry={data.retry} />;
  return <Recipes dataset={data.dataset} products={data.products} />;
}

function Recipes({ dataset, products }: { dataset: Dataset; products: IndexedProduct[] }) {
  const [state, update, closeEntry] = useUrlState(recipesFromParams, recipesToParams);
  const dict = dataset.dictionaries;
  const storeName = (key: string) => dict.stores[key] ?? key;

  const { candidates, ranking } = recipeIndex(products);
  const storeChips = useMemo(
    () =>
      ranking
        .map((store) => ({
          store,
          count: RECIPES.filter((r) => shownIn(r, candidates, store, ranking)).length,
          needing: RECIPES.filter((r) => needsStore(r) && shownIn(r, candidates, store, ranking)).length,
        }))
        .filter((s) => s.needing >= MIN_STORE_RECIPES),
    [ranking, candidates],
  );
  // Sklep z linku, w którym nic tu nie ma, jest pomijany — zamiast pustej strony.
  const store = storeChips.some((s) => s.store === state.store) ? state.store : null;

  const recipes = useMemo(
    () =>
      RECIPES.filter(
        (r) =>
          (!state.kind || r.kind === state.kind) &&
          (!state.tier || tierOf(r.minutes) === state.tier) &&
          shownIn(r, candidates, store, ranking),
      ).sort(byTime),
    [state.kind, state.tier, candidates, store, ranking],
  );
  const ready = useMemo(() => readyProducts(products, store), [products, store]);

  const byCode = useMemo(() => new Map(products.map((p) => [p.code, p])), [products]);
  const openProduct = state.product ? byCode.get(state.product) : undefined;
  // Otwarcie dodaje wpis historii — Wstecz zamyka kartę produktu, zamiast wychodzić z Przepisów.
  const open = useCallback((code: string) => update({ product: code }, { push: true }), [update]);
  const filtered = state.kind !== null || state.tier !== null || store !== null;

  return (
    <>
      <div className="wrap">
        <p className="lead">
          Zasada: w każdej porcji jest <strong>więcej białka niż węglowodanów i więcej białka niż tłuszczu</strong>.
          Liczę ją z prawdziwych produktów ze sklepu, który widzisz na karcie. Na początku gotowce: kupujesz i jesz bez
          gotowania i bez naczyń, a ich zasada to <strong>co najmniej {GOTOWIEC_MIN_PROTEIN} g białka w zestawie</strong>.
          Dalej szybkie (do 7 minut, z błyskawicą), potem dania na chwilę dłużej i obiady do zrobienia w domu, często
          na kilka porcji.
          {store
            ? ` Wszystko poniżej kupisz w sklepie ${storeName(store)}.`
            : ' Każdy przepis pokazuje sklep, w którym kupisz wszystkie składniki naraz.'}
        </p>
      </div>

      <div className="grp fd-rec-filters">
        <ChipRow<TimeTier>
          label="Czas"
          value={state.tier}
          onChange={(tier) => update({ tier })}
          options={[
            { key: null, label: 'Wszystkie' },
            ...TIERS.map((tier) => ({
              key: tier,
              label: (
                <span className="fd-rec-chip-in">
                  <TierIcon tier={tier} />
                  {TIER_LABELS[tier]}
                </span>
              ),
            })),
          ]}
        />
        <ChipRow<RecipeKind>
          label="Rodzaj"
          value={state.kind}
          onChange={(kind) => update({ kind })}
          options={[{ key: null, label: 'Wszystkie' }, ...KINDS.map((kind) => ({ key: kind, label: KIND_LABELS[kind] }))]}
        />
        <ChipRow<string>
          label="Sklep"
          value={store}
          onChange={(next) => update({ store: next })}
          options={[
            { key: null, label: 'Wszystkie' },
            ...storeChips.map((s) => ({
              key: s.store,
              label: (
                <>
                  {storeName(s.store)} <span className="fd-rec-chip-n">({formatNumber(s.count, 0)})</span>
                </>
              ),
            })),
          ]}
        />
      </div>

      <section className="fd-rec-section" aria-labelledby="fd-rec-title">
        <div className="wrap fd-rec-head">
          <h2 id="fd-rec-title">Przepisy białkowe</h2>
          <p className="fd-rec-count" aria-live="polite">
            {recipes.length > 0
              ? `${formatNumber(recipes.length, 0)} ${plural(recipes.length, 'przepis', 'przepisy', 'przepisów')}${
                  state.tier ? '' : ', najpierw szybkie'
                }`
              : 'Brak przepisów'}
          </p>
        </div>
        {recipes.length === 0 ? (
          <div className="wrap">
            <EmptyState
              title="Brak przepisów z tymi filtrami w tym sklepie."
              text="Zmień czas, rodzaj albo sklep."
              action={
                filtered && (
                  <button type="button" className="btn sm" onClick={() => update({ kind: null, tier: null, store: null })}>
                    Wyczyść filtry
                  </button>
                )
              }
            />
          </div>
        ) : (
          <ul className="fd-rec-list">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard
                  // Nowy sklep strony zaczyna kartę od nowa: jej zamiany należały do poprzedniego.
                  key={store ?? 'any'}
                  recipe={recipe}
                  candidates={candidates}
                  ranking={ranking}
                  pageStore={store}
                  dict={dict}
                  onOpenProduct={open}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="wrap fd-rec-ready" aria-labelledby="fd-rec-ready-heading">
        <h2 id="fd-rec-ready-heading">Gotowe produkty białkowe</h2>
        <p className="hint">
          Bez przygotowania: produkty, które same spełniają zasadę (na 100 g), od najwięcej białka na kalorię.
        </p>
        <ReadyProducts groups={ready} dict={dict} onOpen={open} />
      </section>

      <DataFooter dataset={dataset} />

      {openProduct && (
        <ProductDetail key={openProduct.code} product={openProduct} dict={dict} onClose={() => closeEntry({ product: null })} />
      )}
    </>
  );
}
