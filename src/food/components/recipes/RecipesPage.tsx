import { Fragment, useCallback, useMemo, type ReactNode } from 'react';
import { pluralEn, text } from '../../../i18n';
import { EmptyState, Segmented } from '../../../components/ui';
import { useDataset } from '../../hooks/useDataset';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber, plural } from '../../lib/format';
import type { Dataset, IndexedProduct } from '../../lib/types';
import { GOTOWIEC_MIN_PROTEIN, KIND_LABELS, RECIPES, type Recipe, type RecipeKind } from '../../recipes/catalog';
import { readyProducts } from '../../recipes/ready';
import { isOnlineShop, onlineShop } from '../../online/shops';
import { basketKey, groupByBasket, recipeBaskets, within } from '../../recipes/baskets';
import { INGREDIENTS } from '../../recipes/ingredients';
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

const T = text({
  pl: {
    oneOrder: 'jedno zamówienie przez internet',
    oneVisit: 'jedna wizyta w sklepie',
    twoOrders: 'dwa zamówienia przez internet',
    visitAndOrder: 'wizyta w sklepie i zamówienie przez internet',
    withStaples: (trips: string) => `${trips} + podstawy z dowolnego sklepu`,
    byTime: 'Według czasu',
    byShop: 'Według sklepów',
    lead: (min: number): ReactNode => (
      <>
        Zasada: w każdej porcji jest <strong>więcej białka niż węglowodanów i więcej białka niż tłuszczu</strong>.
        Liczę ją z prawdziwych produktów ze sklepu, który widzisz na karcie. Na początku gotowce: kupujesz i jesz bez
        gotowania i bez naczyń, a ich zasada to <strong>co najmniej {min} g białka w zestawie</strong>. Dalej szybkie
        (do 7 minut, z błyskawicą), potem dania na chwilę dłużej i obiady do zrobienia w domu, często na kilka porcji.
      </>
    ),
    leadOnline: (shop: string) => ` Poniżej przepisy z zamówieniem w ${shop} — samym albo razem z jednym sklepem.`,
    leadStore: (shop: string) => ` Poniżej to, co kupisz w sklepie ${shop} — samym albo z jednym zamówieniem przez internet.`,
    leadAll:
      ' Każdy przepis pokazuje, gdzie kupisz wszystko naraz: w jednym sklepie, a gdy trzeba — w sklepie' +
      ' i sklepie internetowym. „Według sklepów” zbiera przepisy w jak najmniej zakupów.',
    time: 'Czas',
    kind: 'Rodzaj',
    shop: 'Sklep',
    all: 'Wszystkie',
    layout: 'Układ listy',
    gotowceTitle: 'Gotowce bez naczyń',
    title: 'Przepisy białkowe',
    gotowce: (n: number) => plural(n, 'gotowiec', 'gotowce', 'gotowców'),
    recipes: (n: number) => plural(n, 'przepis', 'przepisy', 'przepisów'),
    plans: (n: number) => plural(n, 'plan zakupów', 'plany zakupów', 'planów zakupów'),
    quickFirst: ', najpierw szybkie',
    none: 'Brak przepisów',
    emptyTitle: 'Brak przepisów z tymi filtrami w tym sklepie.',
    emptyText: 'Zmień czas, rodzaj albo sklep.',
    clear: 'Wyczyść filtry',
    everywhere: 'Składniki w każdym sklepie',
    ready: 'Gotowe produkty białkowe',
    readyHint: 'Bez przygotowania: produkty, które same spełniają zasadę (na 100 g), od najwięcej białka na kalorię.',
  },
  en: {
    oneOrder: 'one online order',
    oneVisit: 'one shop visit',
    twoOrders: 'two online orders',
    visitAndOrder: 'a shop visit and an online order',
    withStaples: (trips: string) => `${trips} + basics from any shop`,
    byTime: 'By time',
    byShop: 'By shop',
    lead: (min: number): ReactNode => (
      <>
        The rule: every serving has <strong>more protein than carbs and more protein than fat</strong>. I check it
        with real products from the shop you see on the card. First come grab-and-go sets: you buy them and eat with no
        cooking and no dishes, and their rule is <strong>at least {min} g of protein per set</strong>. Then the quick
        ones (up to 7 minutes, with a lightning bolt), then dishes that take a little longer and lunches to make at
        home, often for several servings.
      </>
    ),
    leadOnline: (shop: string) => ` Below are recipes with an order from ${shop} — on its own or together with one shop.`,
    leadStore: (shop: string) => ` Below is what you can buy at ${shop} — on its own or with one online order.`,
    leadAll:
      ' Every recipe shows where you can buy everything at once: in one shop or, when needed, in a shop and an online' +
      ' shop. “By shop” groups the recipes into as few shopping trips as possible.',
    time: 'Time',
    kind: 'Type',
    shop: 'Shop',
    all: 'All',
    layout: 'List layout',
    gotowceTitle: 'Grab-and-go, no dishes',
    title: 'Protein recipes',
    gotowce: (n: number) => pluralEn(n, 'grab-and-go set', 'grab-and-go sets'),
    recipes: (n: number) => pluralEn(n, 'recipe', 'recipes'),
    plans: (n: number) => pluralEn(n, 'shopping plan', 'shopping plans'),
    quickFirst: ', quick ones first',
    none: 'No recipes',
    emptyTitle: 'No recipes with these filters in this shop.',
    emptyText: 'Change the time, type or shop.',
    clear: 'Clear filters',
    everywhere: 'Ingredients in every shop',
    ready: 'Ready protein products',
    readyHint: 'No preparation: products that meet the rule on their own (per 100 g), most protein per calorie first.',
  },
});

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

/**
 * Ile zakupów to jest — słowami, pod nazwą grupy. Grupa z samych sklepów internetowych, której
 * przepisy mają podstawy (mięso, warzywa, nabiał z każdego sklepu), mówi też o nich.
 */
function tripsLine(basket: readonly string[], recipes: Recipe[]): string {
  const online = basket.filter(isOnlineShop).length;
  const trips = basket.length === 1 ? (online ? T.oneOrder : T.oneVisit) : online === 2 ? T.twoOrders : T.visitAndOrder;
  const staples = recipes.some((r) => r.items.some((i) => INGREDIENTS[i.ingredient].role === 'staple'));
  return online === basket.length && staples ? T.withStaples(trips) : trips;
}

const LAYOUTS: { key: RecipesLayout; label: string }[] = [
  { key: 'czas', label: T.byTime },
  { key: 'sklepy', label: T.byShop },
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
          {T.lead(GOTOWIEC_MIN_PROTEIN)}
          {store ? (isOnlineShop(store) ? T.leadOnline(storeName(store)) : T.leadStore(storeName(store))) : T.leadAll}
        </p>
      </div>

      <div className="grp fd-rec-filters">
        <ChipRow<TimeTier>
          label={T.time}
          value={state.tier}
          onChange={(tier) => update({ tier })}
          options={[
            { key: null, label: T.all },
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
          label={T.kind}
          value={state.kind}
          onChange={(kind) => update({ kind })}
          options={[{ key: null, label: T.all }, ...KINDS.map((kind) => ({ key: kind, label: KIND_LABELS[kind] }))]}
        />
        <ChipRow<string>
          label={T.shop}
          value={store}
          onChange={(next) => update({ store: next })}
          options={[
            { key: null, label: T.all },
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
          {T.layout}
        </span>
        <Segmented<RecipesLayout>
          label={T.layout}
          value={state.layout}
          onChange={(layout) => update({ layout })}
          options={LAYOUTS}
        />
      </div>

      <section className="fd-rec-section" aria-labelledby="fd-rec-title">
        <div className="wrap fd-rec-head">
          <h2 id="fd-rec-title">{onlyGotowce ? T.gotowceTitle : T.title}</h2>
          <p className="fd-rec-count" aria-live="polite">
            {recipes.length > 0
              ? `${formatNumber(recipes.length, 0)} ${onlyGotowce ? T.gotowce(recipes.length) : T.recipes(recipes.length)}${
                  groups
                    ? `, ${formatNumber(groups.length, 0)} ` + T.plans(groups.length)
                    : state.tier || onlyGotowce
                      ? ''
                      : T.quickFirst
                }`
              : T.none}
          </p>
        </div>
        {recipes.length === 0 ? (
          <div className="wrap">
            <EmptyState
              title={T.emptyTitle}
              text={T.emptyText}
              action={
                filtered && (
                  <button type="button" className="btn sm" onClick={() => update({ kind: null, tier: null, store: null })}>
                    {T.clear}
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
                      T.everywhere
                    )}
                  </h3>
                  <p className="fd-rec-count">
                    {formatNumber(group.items.length, 0)} {T.recipes(group.items.length)}
                    {group.basket && ` · ${tripsLine(group.basket, group.items)}`}
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
                        headingLevel={4}
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
        <h2 id="fd-rec-ready-heading">{T.ready}</h2>
        <p className="hint">{T.readyHint}</p>
        <ReadyProducts groups={ready} dict={dict} onOpen={open} />
      </section>

      <DataFooter dataset={dataset} />

      {openProduct && (
        <ProductDetail key={openProduct.code} product={openProduct} dict={dict} onClose={() => closeEntry({ product: null })} />
      )}
    </>
  );
}
