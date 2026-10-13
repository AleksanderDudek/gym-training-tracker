import { Fragment, useCallback, useMemo } from 'react';
import { EmptyState, Segmented } from '../../../components/ui';
import { useDataset } from '../../hooks/useDataset';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber, plural } from '../../lib/format';
import type { Dataset, IndexedProduct } from '../../lib/types';
import { GOTOWIEC_MIN_PROTEIN, KIND_LABELS, RECIPES, type Recipe, type RecipeKind } from '../../recipes/catalog';
import { readyProducts } from '../../recipes/ready';
import { isOnlineShop, onlineShop } from '../../online/shops';
import { basketKey, groupByBasket, recipeBaskets, within } from '../../recipes/baskets';
import { needsStore, recipeIndex, resolveRecipe, type RecipeIndex } from '../../recipes/resolve';
import { byTime, TIER_LABELS, tierOf, type TimeTier } from '../../recipes/tiers';
import { recipesFromParams, recipesToParams, type RecipesLayout } from '../../recipes/url';
import { DataFooter } from '../common/DataFooter';
import { ProductDetail } from '../common/ProductDetail';
import { StatusScreen } from '../common/StatusScreen';
import { ChipRow } from './ChipRow';
import { ReadyProducts } from './ReadyProducts';
import { OnlineShopLink, RecipeCard } from './RecipeCard';
import { TierIcon } from './TierBadge';
import './recipes.css';

/**
 * Sklep dostaje własny żeton, gdy da się w nim kupić w całości co najmniej tyle przepisów, które
 * sklepu potrzebują. Dwa wpuszczały sklep osiedlowy (Żabkę) tylko dzięki założeniu „podstawy są
 * wszędzie”, które właśnie tam jest najsłabsze.
 */
const MIN_STORE_RECIPES = 3;

/**
 * Koszyki przepisu na tej stronie: bez filtra — wszystkie najmniejsze; z filtrem sklepu — te,
 * w których ten sklep jest. Przepis z samych podstaw i spiżarni koszyka nie potrzebuje, chyba że
 * filtr wskazuje sklep stacjonarny: wtedy podstawy idą z jego półek. Sklep internetowy podstaw nie
 * sprzedaje — takiego przepisu pod jego filtrem nie ma.
 */
function basketsOn(recipe: Recipe, index: RecipeIndex, store: string | null): string[][] {
  if (!needsStore(recipe)) return store && !isOnlineShop(store) ? [[store]] : [];
  const all = recipeBaskets(recipe, index);
  return store ? all.filter((b) => b.includes(store)) : all;
}

function shownIn(recipe: Recipe, index: RecipeIndex, store: string | null): boolean {
  if (needsStore(recipe)) return basketsOn(recipe, index, store).length > 0;
  if (store && isOnlineShop(store)) return false;
  const r = resolveRecipe(recipe, index.candidates, store);
  return r.available && r.passes;
}

/** Ile zakupów to jest — słowami, pod nazwą grupy. */
function tripsLine(basket: readonly string[]): string {
  const online = basket.filter(isOnlineShop).length;
  if (basket.length === 1) return online ? 'jedno zamówienie przez internet' : 'jedna wizyta w sklepie';
  return online === 2 ? 'dwa zamówienia przez internet' : 'wizyta w sklepie i zamówienie przez internet';
}

const LAYOUTS: { key: RecipesLayout; label: string }[] = [
  { key: 'czas', label: 'Według czasu' },
  { key: 'sklepy', label: 'Według sklepów' },
];

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
  const storeName = (key: string) => dict.stores[key] ?? onlineShop(key)?.name ?? key;

  const index = recipeIndex(products);
  const { candidates, ranking, online } = index;
  // Sklep stacjonarny dostaje żeton od trzech przepisów, które go potrzebują; internetowy — od
  // jednego: jego przepisy (z jego produktami) są tylko pod nim.
  const storeChips = useMemo(
    () =>
      [...ranking, ...online]
        .map((store) => ({
          store,
          online: isOnlineShop(store),
          count: RECIPES.filter((r) => shownIn(r, index, store)).length,
          needing: RECIPES.filter((r) => needsStore(r) && shownIn(r, index, store)).length,
        }))
        .filter((s) => s.needing >= (s.online ? 1 : MIN_STORE_RECIPES)),
    [ranking, online, index],
  );
  // Sklep z linku, w którym nic tu nie ma, jest pomijany — zamiast pustej strony.
  const store = storeChips.some((s) => s.store === state.store) ? state.store : null;

  const recipes = useMemo(
    () =>
      RECIPES.filter(
        (r) =>
          (!state.kind || r.kind === state.kind) &&
          (!state.tier || tierOf(r.minutes) === state.tier) &&
          shownIn(r, index, store),
      ).sort(byTime),
    [state.kind, state.tier, index, store],
  );
  const groups = useMemo(
    () => (state.layout === 'sklepy' ? groupByBasket(recipes, (r) => basketsOn(r, index, store)) : null),
    [state.layout, recipes, index, store],
  );
  const ready = useMemo(() => readyProducts(products, store), [products, store]);

  const byCode = useMemo(() => new Map(products.map((p) => [p.code, p])), [products]);
  const openProduct = state.product ? byCode.get(state.product) : undefined;
  // Otwarcie dodaje wpis historii — Wstecz zamyka kartę produktu, zamiast wychodzić z Przepisów.
  const open = useCallback((code: string) => update({ product: code }, { push: true }), [update]);
  const filtered = state.kind !== null || state.tier !== null || store !== null;
  const onlyGotowce = state.kind === 'gotowiec';

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
            ? isOnlineShop(store)
              ? ` Poniżej przepisy z zamówieniem w ${storeName(store)} — samym albo razem z jednym sklepem.`
              : ` Poniżej to, co kupisz w sklepie ${storeName(store)} — samym albo z jednym zamówieniem przez internet.`
            : ' Każdy przepis pokazuje, gdzie kupisz wszystko naraz: w jednym sklepie, a gdy trzeba — w sklepie i sklepie internetowym. „Według sklepów” zbiera przepisy w jak najmniej zakupów.'}
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
                  {s.online ? `${storeName(s.store)} · online` : storeName(s.store)}{' '}
                  <span className="fd-rec-chip-n">({formatNumber(s.count, 0)})</span>
                </>
              ),
            })),
          ]}
        />
      </div>

      <div className="wrap fd-rec-layout">
        <span className="seg-label" id="fd-rec-layout-label">
          Układ listy
        </span>
        <Segmented<RecipesLayout>
          label="Układ listy"
          value={state.layout}
          onChange={(layout) => update({ layout })}
          options={LAYOUTS}
        />
      </div>

      <section className="fd-rec-section" aria-labelledby="fd-rec-title">
        <div className="wrap fd-rec-head">
          <h2 id="fd-rec-title">{onlyGotowce ? 'Gotowce bez naczyń' : 'Przepisy białkowe'}</h2>
          <p className="fd-rec-count" aria-live="polite">
            {recipes.length > 0
              ? `${formatNumber(recipes.length, 0)} ${
                  onlyGotowce
                    ? plural(recipes.length, 'gotowiec', 'gotowce', 'gotowców')
                    : plural(recipes.length, 'przepis', 'przepisy', 'przepisów')
                }${
                  groups
                    ? `, ${formatNumber(groups.length, 0)} ${plural(groups.length, 'plan zakupów', 'plany zakupów', 'planów zakupów')}`
                    : state.tier || onlyGotowce
                      ? ''
                      : ', najpierw szybkie'
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
        ) : groups ? (
          groups.map((group) => {
            const label = group.basket ? basketKey(group.basket) : 'wszedzie';
            return (
              <section key={label} className="fd-rec-group" aria-labelledby={`fd-rec-group-${label}`}>
                <div className="wrap fd-rec-group-head">
                  <h3 id={`fd-rec-group-${label}`}>
                    {group.basket ? (
                      group.basket.map((s, i) => (
                        <Fragment key={s}>
                          {i > 0 && ' + '}
                          {isOnlineShop(s) ? <OnlineShopLink id={s} dict={dict} /> : storeName(s)}
                        </Fragment>
                      ))
                    ) : (
                      'Składniki w każdym sklepie'
                    )}
                  </h3>
                  <p className="fd-rec-count">
                    {formatNumber(group.items.length, 0)}{' '}
                    {plural(group.items.length, 'przepis', 'przepisy', 'przepisów')}
                    {group.basket && ` · ${tripsLine(group.basket)}`}
                  </p>
                </div>
                <ul className="fd-rec-list">
                  {group.items.map((recipe) => (
                    <li key={recipe.id}>
                      <RecipeCard
                        key={`${store ?? 'any'}:${label}`}
                        recipe={recipe}
                        candidates={candidates}
                        // W grupie karta kupuje w koszyku grupy: w nim albo w jednym z jego sklepów.
                        baskets={basketsOn(recipe, index, store).filter((b) => !group.basket || within(b, group.basket))}
                        dict={dict}
                        onOpenProduct={open}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        ) : (
          <ul className="fd-rec-list">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard
                  // Nowy sklep strony zaczyna kartę od nowa: jej zamiany należały do poprzedniego.
                  key={store ?? 'any'}
                  recipe={recipe}
                  candidates={candidates}
                  baskets={basketsOn(recipe, index, store)}
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
