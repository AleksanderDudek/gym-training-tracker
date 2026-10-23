import 'leaflet/dist/leaflet.css';
import { Crosshair, LoaderCircle, LocateFixed, RefreshCw } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { pluralEn, text } from '../../../i18n';
import { useDataset } from '../../hooks/useDataset';
import { useGeolocation, type GeoState } from '../../hooks/useGeolocation';
import type { AroundState } from '../../hooks/useNearbyShops';
import { useOsmAround } from '../../hooks/useOsmAround';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber, plural } from '../../lib/format';
import type { Dataset, IndexedProduct } from '../../lib/types';
import { formatDistance } from '../../nearby/geo';
import { shopsOf, type Element } from '../../nearby/overpass';
import { DEFAULT_RADIUS, radiusLabel } from '../../nearby/radius';
import { placeShops, summarizeChains } from '../../nearby/summary';
import type { LatLon, Shop } from '../../nearby/types';
import { nearbyFromParams, nearbyToParams, type NearbyState, type NearbyView } from '../../nearby/url';
import { RECIPES } from '../../recipes/catalog';
import { chainsWithFood } from '../../recipes/chains';
import { readyProducts } from '../../recipes/ready';
import { availableStores, bestVariant, needsStore, recipeIndex } from '../../recipes/resolve';
import { DataFooter } from '../common/DataFooter';
import { ProductDetail } from '../common/ProductDetail';
import { StatusScreen } from '../common/StatusScreen';
import { ChipRow } from '../recipes/ChipRow';
import { ReadyProducts } from '../recipes/ReadyProducts';
import { RecipeCard } from '../recipes/RecipeCard';
import { Segmented } from '../../../components/ui';
import { AroundStatus } from './AroundStatus';
import { NT } from './nearbyText';
import { OsmCredit } from './OsmCredit';
import { EatNow } from './EatNow';
import { RadiusSlider } from './RadiusSlider';
import { StoreMap } from './StoreMap';
import { COMMON } from '../common/text';
import './nearby.css';

const T = text({
  pl: {
    savedLocating: 'Pokazuję ostatnio zapisane miejsce, szukam aktualnej lokalizacji…',
    savedDenied: 'Pokazuję ostatnio zapisane miejsce – brak zgody na lokalizację.',
    savedFailed: 'Pokazuję ostatnio zapisane miejsce – nie udało się ustalić aktualnej lokalizacji.',
    partial: (n: number, radius: string) => `Na razie: ${n} ${plural(n, 'sklep', 'sklepy', 'sklepów')} w promieniu ${radius}.`,
    locating: 'Szukam Twojej lokalizacji…',
    denied: 'Brak zgody na lokalizację. Kliknij na mapie miejsce, w którym jesteś.',
    failed: 'Nie udało się ustalić lokalizacji. Kliknij na mapie miejsce, w którym jesteś.',
    loading: (radius: string) => `Szukam sklepów w promieniu ${radius}…`,
    fetchFailed: 'Nie udało się pobrać sklepów.',
    what: 'sklepy',
    noneKnown: (radius: string, other: number) =>
      `W promieniu ${radius} nie ma sklepów, z których da się coś ułożyć${
        other ? ` (${plural(other, 'jest 1 inny', `są ${other} inne`, `jest ${other} innych`)})` : ''
      }. Zwiększ promień.`,
    found: (radius: string, known: number, other: number) =>
      `W promieniu ${radius}: ${known} ${plural(known, 'sklep', 'sklepy', 'sklepów')} z danymi o produktach${
        other ? ` i ${other} ${plural(other, 'inny', 'inne', 'innych')}` : ''
      }.`,
    map: 'Mapa',
    searching: 'Szukam sklepów…',
    legend: 'Legenda mapy',
    you: 'Ty',
    keyRecipes: 'sklep z kompletem na przepis',
    keyReady: 'tylko gotowe produkty',
    myLocation: 'Moja lokalizacja',
    useCentre: 'Ustaw środek mapy jako moją lokalizację',
    help: 'Albo przytrzymaj palec na mapie (prawy klik na komputerze). Na telefonie mapę przesuwasz dwoma palcami, z klawiatury strzałkami, a przybliżasz klawiszami + i −.',
    chains: 'Sieci w pobliżu',
    all: 'Wszystkie',
    recipes: 'Przepisy z najbliższych sklepów',
    emptyHere: 'Tu jeszcze nic – poczekaj na sklepy albo zwiększ promień.',
    emptyNoPlace: 'Najpierw ustal, gdzie jesteś.',
    ready: 'Gotowe produkty białkowe w tych sklepach',
    views: 'Co w pobliżu',
    eat: 'Zjedz teraz',
    shops: 'Zakupy i przepisy',
  },
  en: {
    savedLocating: 'Showing the last saved place while I look for your current location…',
    savedDenied: 'Showing the last saved place – no permission to use your location.',
    savedFailed: 'Showing the last saved place – couldn’t find your current location.',
    partial: (n: number, radius: string) => `So far: ${n} ${pluralEn(n, 'shop', 'shops')} within ${radius}.`,
    locating: 'Looking for your location…',
    denied: 'No permission to use your location. Click the place on the map where you are.',
    failed: 'Couldn’t find your location. Click the place on the map where you are.',
    loading: (radius: string) => `Looking for shops within ${radius}…`,
    fetchFailed: 'Couldn’t fetch the shops.',
    what: 'shops',
    noneKnown: (radius: string, other: number) =>
      `Within ${radius} there are no shops to make anything from${
        other ? ` (${other === 1 ? 'there’s 1 other' : `there are ${other} others`})` : ''
      }. Widen the radius.`,
    found: (radius: string, known: number, other: number) =>
      `Within ${radius}: ${known} ${pluralEn(known, 'shop', 'shops')} with product data${
        other ? ` and ${other} ${pluralEn(other, 'other', 'others')}` : ''
      }.`,
    map: 'Map',
    searching: 'Looking for shops…',
    legend: 'Map legend',
    you: 'You',
    keyRecipes: 'shop with everything for a recipe',
    keyReady: 'ready products only',
    myLocation: 'My location',
    useCentre: 'Use the map centre as my location',
    help: 'Or press and hold on the map (right-click on a computer). On a phone you move the map with two fingers, from the keyboard with the arrow keys, and zoom with the + and − keys.',
    chains: 'Chains nearby',
    all: 'All',
    recipes: 'Recipes from the nearest shops',
    emptyHere: 'Nothing here yet – wait for the shops or widen the radius.',
    emptyNoPlace: 'First set where you are.',
    ready: 'Ready protein products in these shops',
    views: 'What’s nearby',
    eat: 'Eat now',
    shops: 'Shopping & recipes',
  },
});

const RADIUS_KEY = 'produkty-pl:radius';
const VIEW_KEY = 'produkty-pl:nearby-view';

/** The view used last on this device: a link without `widok` opens it. New visitors start at „Zjedz teraz”. */
function savedView(): NearbyView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'shops' ? 'shops' : 'eat';
  } catch {
    return 'eat';
  }
}

function rememberView(view: NearbyView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Niezapamiętany: następna wizyta zacznie od „Zjedz teraz”.
  }
}

function savedRadius(): number {
  try {
    return Number(window.localStorage.getItem(RADIUS_KEY)) || DEFAULT_RADIUS;
  } catch {
    return DEFAULT_RADIUS;
  }
}

function rememberRadius(radius: number): void {
  try {
    window.localStorage.setItem(RADIUS_KEY, String(radius));
  } catch {
    // Niezapamiętany: następna wizyta zacznie od domyślnego.
  }
}

/** Skąd jest pozycja, gdy to nie świeża odpowiedź: stare miejsce nigdy nie udaje bieżącego. */
function placeNote(geo: GeoState): string | null {
  if (geo.source !== 'saved' || geo.status === 'ready') return null;
  if (geo.status === 'locating') return T.savedLocating;
  if (geo.status === 'denied') return T.savedDenied;
  return T.savedFailed;
}

type ShopsState = Omit<AroundState<Element>, 'items'> & { shops: Shop[] };

/**
 * Jak daleko lista jest pełna, póki odpowiedź przychodzi kawałkami — poza regionem `status`, bo
 * zmienia się z każdą paczką. Promień w dół do pełnych 100 m: nie obiecuje więcej, niż jest.
 */
function progressLine(geo: GeoState, shops: ShopsState, radius: number, knownCount: number): string | null {
  const sure = Math.floor(shops.completeWithin / 100) * 100;
  return geo.position && shops.status !== 'ready' && sure >= 100 && shops.completeWithin < radius
    ? T.partial(knownCount, radiusLabel(sure))
    : null;
}

/** Jedno zdanie o tym, co się dzieje, w kolejności, w jakiej użytkownik by o to pytał. */
function statusLine(geo: GeoState, shops: ShopsState, radius: number, knownCount: number, otherCount: number): string {
  if (!geo.position) {
    if (geo.status === 'locating') return T.locating;
    if (geo.status === 'denied') return T.denied;
    return T.failed;
  }
  if (shops.status === 'loading' || shops.status === 'idle') return T.loading(radiusLabel(radius));
  if (shops.status === 'error') return shops.error ?? T.fetchFailed;
  if (knownCount === 0) return T.noneKnown(radiusLabel(radius), otherCount);
  return T.found(radiusLabel(radius), knownCount, otherCount);
}

/**
 * W pobliżu: gdzie jesteś (lokalizacja przeglądarki, wpisany adres albo stuknięcie w mapę) i dwa
 * widoki z tego miejsca — „Zjedz teraz” (lokale i sklepy z tym, co pasuje do dzisiejszego celu)
 * i „Zakupy i przepisy” (sklepy spożywcze i przepisy, które zrobisz po wizycie w jednym z nich).
 * W adresie stoją widok, promień, sieć, otwarte miejsce albo produkt
 * (`#/w-poblizu?widok=sklepy&r=500&sklep=lidl&p=…`) — pozycji nie ma w nim celowo: wysłany link
 * powiedziałby odbiorcy, gdzie byłeś.
 */
export default function NearbyPage() {
  const [defaultView] = useState(savedView);
  const read = useCallback((params: URLSearchParams) => nearbyFromParams(params, savedRadius(), defaultView), [defaultView]);
  const write = useCallback((state: NearbyState) => nearbyToParams(state, defaultView), [defaultView]);
  const [state, update, closeEntry] = useUrlState<NearbyState>(read, write);
  const [geo, { locate, setManual }] = useGeolocation();
  // Jedne dane dla obu widoków, od wejścia na stronę: przełączenie widoku nie pyta drugi raz,
  // a sklepy nie czekają na bazę produktów.
  const [osm, retryOsm] = useOsmAround(geo, state.radius);
  const setRadius = (radius: number) => {
    rememberRadius(radius);
    update({ radius });
  };
  const place = { state, update, closeEntry, geo, locate, setManual, setRadius, osm, retryOsm };

  return (
    <>
      <div className="wrap fd-near-views">
        <Segmented<NearbyView>
          label={T.views}
          options={[
            { key: 'eat', label: T.eat },
            { key: 'shops', label: T.shops },
          ]}
          value={state.view}
          onChange={(view) => {
            rememberView(view);
            update({ view, place: null, product: null });
          }}
        />
      </div>
      {state.view === 'eat' ? <EatNow {...place} /> : <ShopsView {...place} />}
    </>
  );
}

type ViewProps = Parameters<typeof EatNow>[0];

/** „Zakupy i przepisy” czeka na bazę produktów: bez niej nie ma ani przepisów, ani gotowych produktów. */
function ShopsView(props: ViewProps) {
  const data = useDataset();
  if (data.status === 'loading') return <StatusScreen kind="loading" />;
  if (data.status === 'error') return <StatusScreen kind="error" message={data.message} onRetry={data.retry} />;
  return <Nearby dataset={data.dataset} products={data.products} {...props} />;
}

function Nearby({
  dataset,
  products,
  state,
  update,
  closeEntry,
  geo,
  locate,
  setManual,
  setRadius,
  osm,
  retryOsm: retry,
}: ViewProps & { dataset: Dataset; products: IndexedProduct[] }) {
  const shops = useMemo(() => shopsOf(osm.items), [osm.items]);
  const shopsState: ShopsState = { ...osm, shops };
  const dict = dataset.dictionaries;
  const { candidates } = recipeIndex(products);
  const mapHelpId = useId();
  const recipesHeading = useRef<HTMLHeadingElement>(null);

  // Tylko sieci, które coś tu dają: przepis kupiony w całości albo gotowy produkt białkowy.
  const knownChains = useMemo(() => chainsWithFood(products), [products]);
  // Tylko tak daleko, jak lista jest kompletna: szersze wyszukiwanie w toku nie może zrobić ze
  // sklepu 2 km dalej „najbliższego”.
  const placedRadius = shopsState.completeWithin;
  const placement = useMemo(
    () => (geo.position ? placeShops(shopsState.shops, geo.position, placedRadius, knownChains) : { known: [], otherCount: 0 }),
    [shopsState.shops, geo.position, placedRadius, knownChains],
  );
  const chains = useMemo(() => summarizeChains(placement.known), [placement.known]);
  const byChain = useMemo(() => new Map(chains.map((c) => [c.chain, c])), [chains]);
  // Sieć z linku, której tu już nie ma, jest pomijana.
  const store = state.store && byChain.has(state.store) ? state.store : null;
  const ranking = useMemo(() => (store ? [store] : chains.map((c) => c.chain)), [store, chains]);

  // Każdy przepis z najbliższym sklepem, który ma wszystko; najbliższe najpierw. Tu kupuje się
  // w jednym sklepie w pobliżu: koszyki karty to pojedyncze sieci — wybrana albo każda, która ma wszystko.
  const recipes = useMemo(() => {
    if (chains.length === 0) return [];
    return RECIPES.map((recipe) => ({ recipe, variant: bestVariant(recipe, candidates, ranking) }))
      .filter((r) => r.variant !== null)
      .map((r) => {
        const chain = r.variant?.store ? byChain.get(r.variant.store) : chains[0];
        const baskets = needsStore(r.recipe)
          ? availableStores(r.recipe, candidates, ranking).map((s) => [s])
          : store
            ? [[store]]
            : [];
        return { ...r, baskets, distance: chain?.nearest.distance ?? Infinity };
      })
      .sort((a, b) => a.distance - b.distance);
  }, [chains, candidates, ranking, byChain, store]);

  const recipeCount = useMemo(() => {
    const counts = new Map<string, number>();
    // Przepisy z samych podstaw nie potrzebują konkretnego sklepu; liczone dawałyby każdemu
    // sklepowi na mapie te same pięć.
    const storeRecipes = RECIPES.filter(needsStore);
    for (const c of chains) counts.set(c.chain, storeRecipes.filter((r) => bestVariant(r, candidates, [c.chain]) !== null).length);
    return counts;
  }, [chains, candidates]);

  const ready = useMemo(() => (ranking.length ? readyProducts(products, ranking) : []), [products, ranking]);

  const storeName = useCallback((chain: string) => dict.stores[chain] ?? chain, [dict.stores]);
  const describeStore = useCallback(
    (chain: string) => {
      const nearest = byChain.get(chain)?.nearest;
      if (!nearest) return storeName(chain);
      return [storeName(chain), formatDistance(nearest.distance), nearest.address].filter(Boolean).join(' · ');
    },
    [byChain, storeName],
  );

  const byCode = useMemo(() => new Map(products.map((p) => [p.code, p])), [products]);
  const openProduct = state.product ? byCode.get(state.product) : undefined;
  const open = useCallback((code: string) => update({ product: code }, { push: true }), [update]);
  const mapCenter = useRef<LatLon | null>(null);
  const note = placeNote(geo);
  // „Pokaż te przepisy” z dymka na mapie: wybór sieci i przejście do listy, która się właśnie zmieniła.
  const showChain = (chain: string | null) => {
    update({ store: chain });
    requestAnimationFrame(() => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      recipesHeading.current?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      recipesHeading.current?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      <section className="fd-near-mapsec" aria-label={T.map}>
        <div className="grp fd-near-controls">
          <RadiusSlider radius={state.radius} onChange={setRadius} />
          {note && <p className="fd-near-place-note">{note}</p>}
          <div className="fd-near-status">
            <AroundStatus
              state={{ ...shopsState, items: shopsState.shops }}
              what={T.what}
              status={statusLine(geo, shopsState, state.radius, placement.known.length, placement.otherCount)}
              progress={progressLine(geo, shopsState, state.radius, placement.known.length)}
              showServer={geo.position !== null}
            />
            {shopsState.status === 'error' && (
              <button type="button" className="btn sm ghost" onClick={retry}>
                <RefreshCw size={16} strokeWidth={2} aria-hidden />
                {COMMON.retry}
              </button>
            )}
          </div>
        </div>

        <div className="wrap">
          <div className="fd-near-map">
            {geo.position && shopsState.status === 'loading' && (
              <p className="fd-near-map-busy" aria-hidden="true">
                <LoaderCircle className="fd-spin" size={16} strokeWidth={2} aria-hidden />
                {T.searching}
              </p>
            )}
            <StoreMap
              center={geo.position}
              radius={state.radius}
              shops={placement.known}
              selectedChain={store}
              storeName={storeName}
              recipeCount={(chain) => recipeCount.get(chain) ?? 0}
              onPick={setManual}
              pickOnClick={!geo.position}
              onSelectChain={showChain}
              onViewChange={(center) => (mapCenter.current = center)}
              describedBy={mapHelpId}
            />
          </div>
          <ul className="fd-near-map-legend" aria-label={T.legend}>
            <li className="fd-near-key-you">{T.you}</li>
            <li className="fd-near-key-recipes">{T.keyRecipes}</li>
            <li className="fd-near-key-ready">{T.keyReady}</li>
          </ul>

          <div className="btnrow fd-near-map-actions">
            <button type="button" className="btn sm ghost" onClick={locate}>
              <LocateFixed size={20} strokeWidth={2} aria-hidden />
              {T.myLocation}
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => mapCenter.current && setManual(mapCenter.current)}
            >
              <Crosshair size={20} strokeWidth={2} aria-hidden />
              {T.useCentre}
            </button>
          </div>
          <p className="hint fd-near-map-help" id={mapHelpId}>
            {T.help}
          </p>
          <OsmCredit source={osm.source} dataAsOf={osm.dataAsOf} />
          <p className="fd-near-privacy">{NT.privacy}</p>
        </div>
      </section>

      {chains.length > 0 && (
        <div className="wrap fd-near-chains">
          <ChipRow<string>
            label={T.chains}
            value={store}
            onChange={(chain) => update({ store: chain })}
            options={[
              { key: null, label: T.all },
              ...chains.map((c) => ({
                key: c.chain,
                label: (
                  <>
                    {storeName(c.chain)} <span className="fd-rec-chip-n">{formatDistance(c.nearest.distance)}</span>
                    {c.count > 1 && <span className="fd-rec-chip-n"> · {c.count}</span>}
                  </>
                ),
              })),
            ]}
          />
        </div>
      )}

      <section className="fd-near-recipes" aria-labelledby="fd-near-recipes-heading">
        <div className="wrap fd-rec-head">
          <h2 id="fd-near-recipes-heading" ref={recipesHeading} tabIndex={-1}>
            {T.recipes}
            {recipes.length > 0 && <span className="fd-rec-count"> ({formatNumber(recipes.length, 0)})</span>}
          </h2>
        </div>
        {recipes.length === 0 ? (
          <div className="wrap">
            <p className="empty fd-near-empty">
              {geo.position ? T.emptyHere : T.emptyNoPlace}
            </p>
          </div>
        ) : (
          <ul className="fd-rec-list">
            {recipes.map(({ recipe, baskets }) => (
              <li key={recipe.id}>
                <RecipeCard
                  // Inny zestaw sieci zaczyna kartę od nowa: wybrany sklep i zamiany należały do poprzedniego.
                  key={ranking.join(',')}
                  recipe={recipe}
                  candidates={candidates}
                  baskets={baskets}
                  dict={dict}
                  onOpenProduct={open}
                  describeStore={describeStore}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {ready.length > 0 && (
        <section className="wrap fd-rec-ready" aria-labelledby="fd-near-ready-heading">
          <h2 id="fd-near-ready-heading">{T.ready}</h2>
          <ReadyProducts groups={ready} dict={dict} onOpen={open} />
        </section>
      )}

      <DataFooter dataset={dataset} />

      {openProduct && (
        <ProductDetail key={openProduct.code} product={openProduct} dict={dict} onClose={() => closeEntry({ product: null })} />
      )}
    </>
  );
}
