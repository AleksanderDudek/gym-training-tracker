import 'leaflet/dist/leaflet.css';
import { Crosshair, LoaderCircle, LocateFixed, RefreshCw } from 'lucide-react';
import { useCallback, useId, useMemo, useRef } from 'react';
import { useDataset } from '../../hooks/useDataset';
import { useGeolocation, type GeoState } from '../../hooks/useGeolocation';
import { useNearbyShops, type ShopsState } from '../../hooks/useNearbyShops';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber, plural } from '../../lib/format';
import type { Dataset, IndexedProduct } from '../../lib/types';
import { formatDistance } from '../../nearby/geo';
import { DEFAULT_RADIUS, radiusLabel } from '../../nearby/radius';
import { placeShops, summarizeChains } from '../../nearby/summary';
import type { LatLon } from '../../nearby/types';
import { nearbyFromParams, nearbyToParams, type NearbyState } from '../../nearby/url';
import { RECIPES } from '../../recipes/catalog';
import { chainsWithFood } from '../../recipes/chains';
import { readyProducts } from '../../recipes/ready';
import { bestVariant, needsStore, recipeIndex } from '../../recipes/resolve';
import { DataFooter } from '../common/DataFooter';
import { ProductDetail } from '../common/ProductDetail';
import { StatusScreen } from '../common/StatusScreen';
import { ChipRow } from '../recipes/ChipRow';
import { ReadyProducts } from '../recipes/ReadyProducts';
import { RecipeCard } from '../recipes/RecipeCard';
import { RadiusSlider } from './RadiusSlider';
import { StoreMap } from './StoreMap';
import './nearby.css';

const RADIUS_KEY = 'produkty-pl:radius';

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
  if (geo.status === 'locating') return 'Pokazuję ostatnio zapisane miejsce, szukam aktualnej lokalizacji…';
  if (geo.status === 'denied') return 'Pokazuję ostatnio zapisane miejsce – brak zgody na lokalizację.';
  return 'Pokazuję ostatnio zapisane miejsce – nie udało się ustalić aktualnej lokalizacji.';
}

/** Jedno zdanie o tym, co się dzieje, w kolejności, w jakiej użytkownik by o to pytał. */
function statusLine(geo: GeoState, shops: ShopsState, radius: number, knownCount: number, otherCount: number): string {
  const partial =
    shops.completeWithin > 0 && shops.completeWithin < radius
      ? ` (na razie: ${knownCount} ${plural(knownCount, 'sklep', 'sklepy', 'sklepów')} w promieniu ${radiusLabel(Math.round(shops.completeWithin / 100) * 100)})`
      : '';
  if (!geo.position) {
    if (geo.status === 'locating') return 'Szukam Twojej lokalizacji…';
    if (geo.status === 'denied') return 'Brak zgody na lokalizację. Kliknij na mapie miejsce, w którym jesteś.';
    return 'Nie udało się ustalić lokalizacji. Kliknij na mapie miejsce, w którym jesteś.';
  }
  if (shops.status === 'loading' || shops.status === 'idle') return `Szukam sklepów w promieniu ${radiusLabel(radius)}…${partial}`;
  if (shops.status === 'error') return `${shops.error ?? 'Nie udało się pobrać sklepów.'}${partial}`;
  if (knownCount === 0) {
    return `W promieniu ${radiusLabel(radius)} nie ma sklepów, z których da się coś ułożyć${
      otherCount ? ` (${plural(otherCount, 'jest 1 inny', `są ${otherCount} inne`, `jest ${otherCount} innych`)})` : ''
    }. Zwiększ promień.`;
  }
  return `W promieniu ${radiusLabel(radius)}: ${knownCount} ${plural(knownCount, 'sklep', 'sklepy', 'sklepów')} z danymi o produktach${
    otherCount ? ` i ${otherCount} ${plural(otherCount, 'inny', 'inne', 'innych')}` : ''
  }.`;
}

/**
 * W pobliżu: gdzie jesteś (lokalizacja przeglądarki albo stuknięcie w mapę), sklepy spożywcze
 * z OpenStreetMap w wybranym promieniu i przepisy, które zrobisz po wizycie w jednym z nich.
 * W adresie stoją tylko promień, sieć i otwarty produkt (`#/w-poblizu?r=500&sklep=lidl&p=…`) —
 * pozycji nie ma w nim celowo: wysłany link powiedziałby odbiorcy, gdzie byłeś.
 */
export default function NearbyPage() {
  const data = useDataset();
  if (data.status === 'loading') return <StatusScreen kind="loading" />;
  if (data.status === 'error') return <StatusScreen kind="error" message={data.message} onRetry={data.retry} />;
  return <Nearby dataset={data.dataset} products={data.products} />;
}

function Nearby({ dataset, products }: { dataset: Dataset; products: IndexedProduct[] }) {
  const read = useCallback((params: URLSearchParams) => nearbyFromParams(params, savedRadius()), []);
  const [state, update, closeEntry] = useUrlState<NearbyState>(read, nearbyToParams);
  const [geo, { locate, setManual }] = useGeolocation();
  const [shopsState, retry] = useNearbyShops(geo.position, state.radius);
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

  // Każdy przepis z najbliższym sklepem, który ma wszystko; najbliższe najpierw.
  const recipes = useMemo(() => {
    if (chains.length === 0) return [];
    return RECIPES.map((recipe) => ({ recipe, variant: bestVariant(recipe, candidates, ranking) }))
      .filter((r) => r.variant !== null)
      .map((r) => {
        const chain = r.variant?.store ? byChain.get(r.variant.store) : chains[0];
        return { ...r, distance: chain?.nearest.distance ?? Infinity };
      })
      .sort((a, b) => a.distance - b.distance);
  }, [chains, candidates, ranking, byChain]);

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
  const setRadius = (radius: number) => {
    rememberRadius(radius);
    update({ radius });
  };
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
      <section className="fd-near-mapsec" aria-label="Mapa">
        <div className="grp fd-near-controls">
          <RadiusSlider radius={state.radius} onChange={setRadius} />
          {note && <p className="fd-near-place-note">{note}</p>}
          <div className="fd-near-status">
            <p role="status">
              {statusLine(geo, shopsState, state.radius, placement.known.length, placement.otherCount)}
            </p>
            {shopsState.status === 'error' && (
              <button type="button" className="btn sm ghost" onClick={retry}>
                <RefreshCw size={16} strokeWidth={2} aria-hidden />
                Spróbuj ponownie
              </button>
            )}
          </div>
        </div>

        <div className="wrap">
          <div className="fd-near-map">
            {geo.position && shopsState.status === 'loading' && (
              <p className="fd-near-map-busy" aria-hidden="true">
                <LoaderCircle className="fd-spin" size={16} strokeWidth={2} aria-hidden />
                Szukam sklepów…
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
          <ul className="fd-near-map-legend" aria-label="Legenda mapy">
            <li className="fd-near-key-you">Ty</li>
            <li className="fd-near-key-recipes">sklep z kompletem na przepis</li>
            <li className="fd-near-key-ready">tylko gotowe produkty</li>
          </ul>

          <div className="btnrow fd-near-map-actions">
            <button type="button" className="btn sm ghost" onClick={locate}>
              <LocateFixed size={20} strokeWidth={2} aria-hidden />
              Moja lokalizacja
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => mapCenter.current && setManual(mapCenter.current)}
            >
              <Crosshair size={20} strokeWidth={2} aria-hidden />
              Ustaw środek mapy jako moją lokalizację
            </button>
          </div>
          <p className="hint fd-near-map-help" id={mapHelpId}>
            Albo przytrzymaj palec na mapie (prawy klik na komputerze). Na telefonie mapę przesuwasz dwoma palcami,
            z klawiatury strzałkami, a przybliżasz klawiszami + i −.
          </p>
          <p className="fd-near-privacy">
            Twoja pozycja, zaokrąglona do ok. 100 m, trafia do serwera Overpass z danymi OpenStreetMap (overpass-api.de,
            zapasowo overpass.private.coffee), a oglądany fragment mapy do tile.openstreetmap.org. Pozycji nie ma
            w adresie strony, a ostatnie miejsce zostaje tylko na tym urządzeniu.
          </p>
        </div>
      </section>

      {chains.length > 0 && (
        <div className="wrap fd-near-chains">
          <ChipRow<string>
            label="Sieci w pobliżu"
            value={store}
            onChange={(chain) => update({ store: chain })}
            options={[
              { key: null, label: 'Wszystkie' },
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
            Przepisy z najbliższych sklepów
            {recipes.length > 0 && <span className="fd-rec-count"> ({formatNumber(recipes.length, 0)})</span>}
          </h2>
        </div>
        {recipes.length === 0 ? (
          <div className="wrap">
            <p className="empty fd-near-empty">
              {geo.position ? 'Tu jeszcze nic – poczekaj na sklepy albo zwiększ promień.' : 'Najpierw ustal, gdzie jesteś.'}
            </p>
          </div>
        ) : (
          <ul className="fd-rec-list">
            {recipes.map(({ recipe }) => (
              <li key={recipe.id}>
                <RecipeCard
                  // Inny zestaw sieci zaczyna kartę od nowa: wybrany sklep i zamiany należały do poprzedniego.
                  key={ranking.join(',')}
                  recipe={recipe}
                  candidates={candidates}
                  ranking={ranking}
                  pageStore={store}
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
          <h2 id="fd-near-ready-heading">Gotowe produkty białkowe w tych sklepach</h2>
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
