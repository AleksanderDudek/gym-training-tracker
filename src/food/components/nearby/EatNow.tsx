import { ChevronRight, Crosshair, LoaderCircle, LocateFixed, RefreshCw } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { pluralEn, text } from '../../../i18n';
import { MISSING_DATA_MESSAGE } from '../../data';
import { productFood, type Food } from '../../diet/foods';
import type { Context } from '../../diet/suggest';
import { BAND } from '../../diet/target';
import { useFavorites } from '../../hooks/useDiet';
import { useDataset } from '../../hooks/useDataset';
import { useEatNow } from '../../hooks/useEatNow';
import type { GeoState } from '../../hooks/useGeolocation';
import type { OsmState } from '../../hooks/useOsmAround';
import { useRestaurants } from '../../hooks/useRestaurants';
import { formatNumber, plural } from '../../lib/format';
import { storeKey } from '../../lib/stores';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { dishName, picks, placeFoods, rankPlaces, type EatPick, type RankedPlace, type SortKey } from '../../nearby/eat';
import { openState } from '../../nearby/hours';
import { mapsPlatform } from '../../nearby/navigate';
import { placesOf, type Place } from '../../nearby/places';
import { radiusLabel } from '../../nearby/radius';
import type { LatLon } from '../../nearby/types';
import type { NearbyState } from '../../nearby/url';
import { isOnlineShop } from '../../online/shops';
import { brandIndex } from '../../restaurants/brands';
import { UNPUBLISHED } from '../../restaurants/unpublished';
import type { Chain } from '../../restaurants/types';
import { readyProducts } from '../../recipes/ready';
import { dietPath } from '../../../routing';
import { COMMON } from '../common/text';
import { FIT_LABEL, FitBadge, MacroLine } from '../diet/SuggestionList';
import { ChipRow } from '../recipes/ChipRow';
import { AddressSearch } from './AddressSearch';
import { AroundStatus } from './AroundStatus';
import { NT } from './nearbyText';
import { OsmCredit } from './OsmCredit';
import { distanceText, openText } from './eatText';
import { PlaceMap } from './PlaceMap';
import { PlaceSheet } from './PlaceSheet';
import { RadiusSlider } from './RadiusSlider';
// Ocena dopasowania, makro i wiersze dań mają swoje style w dzienniku — ta strona bywa pierwszą w Jedzeniu.
import '../diet/diet.css';

const T = text({
  pl: {
    locating: 'Szukam Twojej lokalizacji…',
    denied: 'Brak zgody na lokalizację. Wpisz adres albo kliknij na mapie miejsce, w którym jesteś.',
    failed: 'Nie udało się ustalić lokalizacji. Wpisz adres albo kliknij na mapie miejsce, w którym jesteś.',
    savedLocating: 'Pokazuję ostatnio zapisane miejsce, szukam aktualnej lokalizacji…',
    loading: (radius: string) => `Szukam lokali w promieniu ${radius}…`,
    partial: (n: number, radius: string) => `Na razie: ${n} ${plural(n, 'miejsce', 'miejsca', 'miejsc')} z menu w promieniu ${radius}.`,
    menus: 'Wczytuję menu sieci…',
    menusFailed: 'Nie udało się wczytać menu sieci.',
    products: 'Wczytuję produkty sklepów…',
    productsFailed: 'Nie udało się wczytać produktów sklepów.',
    fetchFailed: 'Nie udało się pobrać lokali.',
    what: 'lokale',
    found: (radius: string, known: number, fitting: number, other: number) =>
      `W promieniu ${radius}: ${known} ${plural(known, 'miejsce', 'miejsca', 'miejsc')} z menu, w tym ${fitting} z czymś na teraz` +
      (other ? `, i ${other} bez danych o menu.` : '.'),
    noneKnown: (radius: string) => `W promieniu ${radius} nie znam menu żadnego lokalu. Zwiększ promień albo pokaż lokale bez danych.`,
    answerHead: 'Na teraz',
    counting: 'Liczę, co zostało z dzisiejszego celu…',
    budget: (kcal: string, protein: string, left: string, meals: number) =>
      `ok. ${kcal} kcal i ${protein} g białka na ten posiłek — zostało ${left} kcal na ${meals} ${plural(meals, 'posiłek', 'posiłki', 'posiłków')}.`,
    done: (eaten: string, goal: string) =>
      `Na dziś kalorii już wystarczy (${eaten} z ${goal} kcal). Jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego.`,
    budgetPlain: (protein: string) => `Na ten posiłek: coś z ok. ${protein} g białka.`,
    donePlain: 'Na dziś wystarczy — jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego.',
    showLight: 'Pokaż najlżejsze',
    noProfile: 'Bez profilu diety oceniam dla przeciętnego dnia: 2000 kcal, dieta zbilansowana.',
    setProfile: 'Ustaw profil diety',
    bestIs: 'Najlepiej:',
    nothingYet: 'Gdy znajdę lokale, tu będzie najlepszy wybór.',
    mapTitle: 'Mapa',
    searching: 'Szukam lokali…',
    legend: 'Legenda mapy',
    you: 'Ty',
    great: 'świetnie pasuje',
    ok: 'pasuje',
    avoid: 'lepiej nie teraz',
    none: 'bez danych o menu',
    numbered: 'numer — miejsce z listy',
    myLocation: 'Moja lokalizacja',
    useCentre: 'Ustaw środek mapy jako moją lokalizację',
    help: 'Albo przytrzymaj palec na mapie (prawy klik na komputerze). Na telefonie mapę przesuwasz dwoma palcami, z klawiatury strzałkami, a przybliżasz klawiszami + i −.',
    filters: 'Pokaż też',
    closed: (n: number) => `zamknięte (${n})`,
    unknown: (n: number) => `bez danych o menu (${n})`,
    listTitle: 'Najlepsze wybory na teraz',
    sort: 'Sortuj',
    sorts: { best: 'Najlepsze', protein: 'Najwięcej białka', near: 'Najbliżej', light: 'Najlżejsze' } as Record<SortKey, string>,
    empty: 'Nic do pokazania — zwiększ promień albo pokaż zamknięte i lokale bez danych.',
    more: (n: number) => `Pokaż więcej (${n})`,
    less: 'Pokaż mniej',
  },
  en: {
    locating: 'Looking for your location…',
    denied: 'No permission to use your location. Type an address or click the place on the map where you are.',
    failed: 'Couldn’t find your location. Type an address or click the place on the map where you are.',
    savedLocating: 'Showing the last saved place while I look for your current location…',
    loading: (radius: string) => `Looking for places within ${radius}…`,
    partial: (n: number, radius: string) => `So far: ${n} ${pluralEn(n, 'place', 'places')} with a menu within ${radius}.`,
    menus: 'Loading the chains’ menus…',
    menusFailed: 'Couldn’t load the chains’ menus.',
    products: 'Loading the shops’ products…',
    productsFailed: 'Couldn’t load the shops’ products.',
    fetchFailed: 'Couldn’t fetch the places.',
    what: 'places',
    found: (radius: string, known: number, fitting: number, other: number) =>
      `Within ${radius}: ${known} ${pluralEn(known, 'place', 'places')} with a menu, ${fitting} with something for now` +
      (other ? `, and ${other} without menu data.` : '.'),
    noneKnown: (radius: string) => `Within ${radius} I don’t know any place’s menu. Widen the radius or show places without data.`,
    answerHead: 'For now',
    counting: 'Working out what’s left of today’s goal…',
    budget: (kcal: string, protein: string, left: string, meals: number) =>
      `about ${kcal} kcal and ${protein} g protein for this meal — ${left} kcal left for ${meals} ${pluralEn(meals, 'meal', 'meals')}.`,
    done: (eaten: string, goal: string) =>
      `That’s enough calories for today (${eaten} of ${goal} kcal). If you’d like something more, pick something light.`,
    budgetPlain: (protein: string) => `For this meal: something with about ${protein} g protein.`,
    donePlain: 'That’s enough for today — if you’d like something more, pick something light.',
    showLight: 'Show the lightest',
    noProfile: 'Without a diet profile I rate for an average day: 2,000 kcal, a balanced diet.',
    setProfile: 'Set up your diet profile',
    bestIs: 'Best:',
    nothingYet: 'Once I find places, the best choice will be here.',
    mapTitle: 'Map',
    searching: 'Looking for places…',
    legend: 'Map legend',
    you: 'You',
    great: 'fits great',
    ok: 'fits',
    avoid: 'better not now',
    none: 'no menu data',
    numbered: 'number — a place from the list',
    myLocation: 'My location',
    useCentre: 'Use the map centre as my location',
    help: 'Or press and hold on the map (right-click on a computer). On a phone you move the map with two fingers, from the keyboard with the arrow keys, and zoom with the + and − keys.',
    filters: 'Also show',
    closed: (n: number) => `closed (${n})`,
    unknown: (n: number) => `no menu data (${n})`,
    listTitle: 'Best choices for now',
    sort: 'Sort',
    sorts: { best: 'Best', protein: 'Most protein', near: 'Nearest', light: 'Lightest' } as Record<SortKey, string>,
    empty: 'Nothing to show — widen the radius or show closed places and places without data.',
    more: (n: number) => `Show more (${n})`,
    less: 'Show less',
  },
});

const isClosed = (r: RankedPlace) => r.open !== null && !r.open.open;

/** Rows under the map before „Pokaż więcej”: the three the user asked for. */
const TOP = 3;
/** Ready products per group offered in a shop: a choice, not the whole shelf. */
const PER_GROUP = 6;

const NO_CHAINS: Chain[] = [];
const NO_PRODUCTS: IndexedProduct[] = [];
const NO_DICT: Dictionaries = { categories: {}, labels: {}, allergens: {}, additives: {}, brands: {}, stores: {} };
const SORTS: SortKey[] = ['best', 'protein', 'near', 'light'];

interface Props {
  state: NearbyState;
  update: (changes: Partial<NearbyState>, options?: { push?: boolean }) => void;
  closeEntry: (fallback: Partial<NearbyState>) => void;
  geo: GeoState;
  locate: () => void;
  setManual: (position: LatLon) => void;
  setRadius: (radius: number) => void;
  /** The page's data for both views (`useOsmAround`). */
  osm: OsmState;
  retryOsm: () => void;
}

const kcal = (n: number) => formatNumber(Math.round(n / 10) * 10, 0);

/**
 * „Zjedz teraz”: where and what to eat around here that fits what is left of today. The answer
 * first (what this meal should be, and the best pick), the map with the places coloured by fit,
 * the three best choices under it (sortable), and a card per place with directions and the full
 * list. Everything follows the diary: the day's target, what is eaten, a planned bigger meal; without
 * calorie counting the answer speaks in protein only.
 */
export function EatNow({ state, update, closeEntry, geo, locate, setManual, setRadius, osm, retryOsm: retry }: Props) {
  const eat = useEatNow();
  const places = useMemo(() => placesOf(osm.items), [osm.items]);
  const placesState = { ...osm, items: places };
  const menus = useRestaurants();
  const chains = menus.status === 'ready' ? menus.chains : NO_CHAINS;
  // The products only add the shops' ready food here, so they wait while the app's own files for the
  // places are on their way: on a slow link their 3.3 MB went first and the 9 kB index and the nearest
  // leaves queued behind them. Abroad, at the border (its few Polish leaves land in a second or two)
  // and while Overpass stands in, the wait is for Overpass's search — minutes, with its pauses — not
  // for the app's files: waiting would only put them a whole search later. Already loaded (another
  // food screen, the other view), they are there at once.
  const ownOnWay = osm.source === 'static' && (osm.status === 'loading' || osm.status === 'idle');
  const data = useDataset(!ownOnWay);
  const products = data.status === 'ready' ? data.products : NO_PRODUCTS;
  const dict = data.status === 'ready' ? data.dataset.dictionaries : NO_DICT;
  const favorites = useFavorites();
  const [expanded, setExpanded] = useState(false);
  const mapCenter = useRef<LatLon | null>(null);
  const mapHelpId = useId();
  const now = useMemo(() => new Date(eat.nowMs), [eat.nowMs]);
  const platform = useMemo(
    () => mapsPlatform(globalThis.navigator?.userAgent ?? '', globalThis.navigator?.maxTouchPoints ?? 0),
    [],
  );

  const menuOf = useMemo(() => brandIndex(chains), [chains]);
  const unpublishedOf = useMemo(() => brandIndex(UNPUBLISHED), []);
  // One shop chain's ready products are worked out once, however many of its shops are around.
  const readyByShop = useMemo(() => {
    const byShop = new Map<string, Food[]>();
    for (const shop of new Set(placesState.items.map((p) => p.shop).filter((s): s is string => s !== null))) {
      byShop.set(
        shop,
        readyProducts(products, shop)
          // „Teraz” nie czeka na kuriera: produkt tylko ze sklepu internetowego tu nie trafia.
          .flatMap((g) => g.items.filter((p) => !(p.stores.length && p.stores.every(isOnlineShop))).slice(0, PER_GROUP))
          .map((p) => productFood(p, dict))
          .filter((f): f is Food => f !== null),
      );
    }
    return byShop;
  }, [placesState.items, products, dict]);
  const readyFor = useCallback((shop: string) => readyByShop.get(shop) ?? [], [readyByShop]);
  const starred = useMemo(() => new Set((favorites ?? []).map((f) => f.key)), [favorites]);
  const foodsOf = useCallback(
    (place: Place) => {
      const found = placeFoods(place, menuOf, readyFor, (shop) => dict.stores[shop] ?? storeKey(place.brand)?.label ?? place.name);
      return {
        ...found,
        // A chain known to publish no nutrition still has a name to show.
        label: found.label ?? unpublishedOf(place.brand)?.name ?? null,
        foods: found.foods.map((f) => (starred.has(f.key) ? { ...f, favorite: true as const } : f)),
      };
    },
    [menuOf, unpublishedOf, readyFor, dict, starred],
  );

  const { needs } = eat;
  const ctx: Context = useMemo(
    () => ({
      remaining: needs.remaining,
      targets: needs.targets,
      profile: needs.profile,
      mealsLeft: needs.mealsLeft,
      nearby: [],
      storeName: (chain) => dict.stores[chain] ?? chain,
    }),
    [needs, dict],
  );

  // Only as far as the answer is complete: a wider search in progress must not make a place 2 km
  // away "the nearest".
  const within = placesState.completeWithin;
  const ranked = useMemo(
    () =>
      geo.position && within > 0
        ? rankPlaces({
            places: placesState.items,
            center: geo.position,
            radius: within,
            foodsOf,
            ctx,
            mealKcal: needs.meal.kcal,
            openOf: (p) => openState(p.openingHours, now),
          })
        : [],
    [geo.position, within, placesState.items, foodsOf, ctx, needs.meal.kcal, now],
  );
  const visible = useMemo(
    () => ranked.filter((r) => (state.unknown || r.best) && (state.closed || !isClosed(r))),
    [ranked, state.unknown, state.closed],
  );
  const hiddenClosed = ranked.filter((r) => isClosed(r) && (state.unknown || r.best)).length;
  const hiddenUnknown = ranked.filter((r) => !r.best && (state.closed || !isClosed(r))).length;
  const rows = useMemo(() => picks(visible, state.sort, ctx, needs.meal.kcal), [visible, state.sort, ctx, needs.meal.kcal]);
  // The same array while the rows are the same: the map rebuilds its pins whenever it changes.
  const top = useMemo(() => rows.slice(0, TOP).map((r) => r.place.place.id), [rows]);
  const bestPick: EatPick | undefined = state.sort === 'best' ? rows[0] : picks(visible, 'best', ctx, needs.meal.kcal)[0];
  const shown = expanded ? rows : rows.slice(0, TOP);
  const selected = state.place ? ranked.find((r) => r.place.id === state.place) : undefined;
  const known = ranked.filter((r) => r.best).length;
  const fitting = ranked.filter((r) => r.best && r.best.fit.level !== 'avoid').length;

  const openPlace = (id: string) => update({ place: id }, { push: true });
  const describe = (r: RankedPlace) => ({
    head: [r.label !== r.place.name ? r.label : null, distanceText(r.distance, r.walkMin)].filter(Boolean).join(' · '),
    lines: [
      ...[openText(r.open, now)].filter((x): x is string => x !== null),
      ...r.options
        .slice(0, 2)
        .map((s) => `${dishName(s.food)} · ${formatNumber(s.food.nutrients.kcal, 0)} kcal · ${FIT_LABEL[s.fit.level]}`),
    ],
  });

  // A shop's ready food comes with the products: until they are in, every Żabka and Biedronka around
  // would count as a place without menu data. Without a chain's shop around they change no count.
  const shopsAround = ranked.some((r) => r.place.shop !== null);
  // A build without the products file: nothing to wait for and nothing another try could bring — the
  // shops simply have no ready food here, and the counts are final without it.
  const noProducts = data.status === 'error' && data.message === MISSING_DATA_MESSAGE;
  const shopsWait = data.status === 'loading' && shopsAround;
  const productsFailed = data.status === 'error' && !noProducts && shopsAround;
  // Everything that gives a place its menu is here: what is counted (or found missing) is final.
  const settled = menus.status === 'ready' && !shopsWait && !productsFailed;
  // Counts only once they are final, before then what is still loading — said once, not numbers
  // that change by themselves after the page looks finished (the status line is read out).
  const status = (() => {
    if (!geo.position) return geo.status === 'locating' ? T.locating : geo.status === 'denied' ? T.denied : T.failed;
    if (placesState.status === 'loading' || placesState.status === 'idle') return T.loading(radiusLabel(state.radius));
    if (placesState.status === 'error') return placesState.error ?? T.fetchFailed;
    if (menus.status === 'loading') return T.menus;
    // Without the menus every place looks menu-less: a wider radius would not help, another try may.
    if (menus.status === 'error') return T.menusFailed;
    if (shopsWait) return T.products;
    // The shops would all count as without menu data, and the button may bring their products.
    if (productsFailed) return T.productsFailed;
    if (known === 0) return T.noneKnown(radiusLabel(state.radius));
    return T.found(radiusLabel(state.radius), known, fitting, ranked.length - known);
  })();
  // „Spróbuj ponownie” whenever the status line says something failed — the places, or the menus or
  // the shops' products with the places in (not while it still says the menus load) — and it tries
  // again whatever failed.
  const extrasFailed =
    geo.position !== null && placesState.status === 'ready' && (menus.status === 'error' || (menus.status === 'ready' && productsFailed));
  const retryFailed = () => {
    // The menus' own retry tries in place and reloads the page when the browser keeps the failed
    // import (Chromium, WebKit) — the view is in the address, a hand-picked place in the tab.
    if (placesState.status === 'error') retry();
    if (menus.status === 'error') menus.retry();
    if (data.status === 'error' && !noProducts) data.retry();
  };
  // The app's data arrives in pieces, nearest first: what is complete so far is said, not hidden —
  // counted only once the chains' menus are here (while they load, or when they failed, every place
  // looks menu-less), and only out to the radius the note names. The shops' products come after the
  // places, so while the note shows a shop has no menu yet: the count is of the places with one so
  // far — it only grows, as „na razie” says.
  const sure = Math.floor(within / 100) * 100;
  const progress =
    geo.position && placesState.status !== 'ready' && sure >= 100 && within < state.radius && menus.status === 'ready'
      ? T.partial(ranked.filter((r) => r.best && r.distance <= sure).length, radiusLabel(sure))
      : null;
  const note = geo.source === 'saved' && geo.status === 'locating' ? T.savedLocating : null;
  // Within the ±100 kcal band the day is at its target: what is left is no meal's worth.
  const over = needs.remaining.kcal <= BAND;
  const protein = formatNumber(Math.round(needs.meal.protein), 0);

  return (
    <>
      <section className="fd-near-mapsec" aria-label={T.mapTitle}>
        <div className="grp fd-near-controls">
          <RadiusSlider radius={state.radius} onChange={setRadius} />
          <AddressSearch onPick={setManual} />
          {note && <p className="fd-near-place-note">{note}</p>}
          <div className="fd-near-status">
            <AroundStatus state={placesState} what={T.what} status={status} showServer={geo.position !== null} progress={progress} />
            {(placesState.status === 'error' || extrasFailed) && (
              <button type="button" className="btn sm ghost" onClick={retryFailed}>
                <RefreshCw size={16} strokeWidth={2} aria-hidden />
                {COMMON.retry}
              </button>
            )}
          </div>
        </div>

        <section className="grp fd-near-answer" aria-labelledby="fd-near-answer-h">
          <h2 id="fd-near-answer-h">{T.answerHead}</h2>
          {eat.loading ? (
            <p className="tight fd-near-soft">{T.counting}</p>
          ) : over ? (
            <p className="tight">
              {eat.hidesKcal
                ? T.donePlain
                : T.done(formatNumber(Math.round(eat.eaten.kcal), 0), formatNumber(Math.round(needs.targets.kcal), 0))}{' '}
              {state.sort !== 'light' && (
                <button type="button" className="btn ghost sm" onClick={() => update({ sort: 'light' })}>
                  {T.showLight}
                </button>
              )}
            </p>
          ) : (
            <p className="tight">
              {eat.hidesKcal
                ? T.budgetPlain(protein)
                : T.budget(kcal(needs.meal.kcal), protein, kcal(needs.remaining.kcal), needs.mealsLeft)}
            </p>
          )}
          {!eat.profile && (
            <p className="tight fd-near-soft">
              {T.noProfile} <a href={dietPath('profile')}>{T.setProfile}</a>
            </p>
          )}
          {bestPick ? (
            <button type="button" className="fd-near-best" onClick={() => openPlace(bestPick.place.place.id)}>
              <span className="fd-near-best-k">{T.bestIs}</span>{' '}
              <b>{dishName(bestPick.dish.food)}</b>
              <span className="fd-near-best-fit">
                <FitBadge fit={bestPick.dish.fit} />
              </span>
              <span className="fd-near-best-where">
                {[
                  bestPick.dish.food.amountLabel,
                  bestPick.place.label ?? bestPick.place.place.name,
                  distanceText(bestPick.place.distance, bestPick.place.walkMin),
                ].join(' · ')}
              </span>
              <ChevronRight className="fd-near-best-go" size={20} strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <p className="tight fd-near-soft">{T.nothingYet}</p>
          )}
        </section>

        <div className="wrap">
          <div className="fd-near-map">
            {geo.position && placesState.status === 'loading' && (
              <p className="fd-near-map-busy" aria-hidden="true">
                <LoaderCircle className="fd-spin" size={16} strokeWidth={2} aria-hidden />
                {T.searching}
              </p>
            )}
            <PlaceMap
              center={geo.position}
              radius={state.radius}
              places={visible}
              top={top}
              selected={state.place}
              describe={describe}
              onOpen={openPlace}
              onPick={setManual}
              pickOnClick={!geo.position}
              onViewChange={(c) => (mapCenter.current = c)}
              describedBy={mapHelpId}
            />
          </div>
          <ul className="fd-near-map-legend" aria-label={T.legend}>
            <li className="fd-near-key-you">{T.you}</li>
            <li className="fd-near-key-great">{T.great}</li>
            <li className="fd-near-key-ok">{T.ok}</li>
            <li className="fd-near-key-avoid">{T.avoid}</li>
            {state.unknown && <li className="fd-near-key-none">{T.none}</li>}
            <li className="fd-near-key-num">{T.numbered}</li>
          </ul>
          <div className="btnrow fd-near-map-actions">
            <button type="button" className="btn sm ghost" onClick={locate}>
              <LocateFixed size={20} strokeWidth={2} aria-hidden />
              {T.myLocation}
            </button>
            <button type="button" className="btn sm ghost" onClick={() => mapCenter.current && setManual(mapCenter.current)}>
              <Crosshair size={20} strokeWidth={2} aria-hidden />
              {T.useCentre}
            </button>
          </div>
          <p className="hint fd-near-map-help" id={mapHelpId}>
            {T.help}
          </p>
          <OsmCredit shown={osm.shown} dataAsOf={osm.dataAsOf} />
          <p className="fd-near-privacy">{NT.privacy}</p>
        </div>
      </section>

      <section className="fd-near-picks" aria-labelledby="fd-near-picks-h">
        <div className="wrap">
          <h2 id="fd-near-picks-h">{T.listTitle}</h2>
          <ChipRow<SortKey>
            label={T.sort}
            value={state.sort}
            onChange={(sort) => sort && update({ sort })}
            options={SORTS.map((key) => ({ key, label: T.sorts[key] }))}
          />
          {(hiddenClosed > 0 || hiddenUnknown > 0 || state.closed || state.unknown) && (
            <div className="fd-near-filters" role="group" aria-label={T.filters}>
              <span className="seg-label" aria-hidden="true">
                {T.filters}
              </span>
              <div className="chips">
                <button type="button" aria-pressed={state.closed} onClick={() => update({ closed: !state.closed })}>
                  {T.closed(hiddenClosed || ranked.filter(isClosed).length)}
                </button>
                <button type="button" aria-pressed={state.unknown} onClick={() => update({ unknown: !state.unknown })}>
                  {T.unknown(hiddenUnknown || ranked.filter((r) => !r.best).length)}
                </button>
              </div>
            </div>
          )}
          {rows.length === 0 ? (
            // „Widen the radius” only for a final list: not while the menus or the products load, nor
            // after they failed (the status line says so and offers another try).
            geo.position && placesState.status === 'ready' && settled && <p className="empty fd-near-empty">{T.empty}</p>
          ) : (
            <ol className="fd-near-pick-list">
              {shown.map((row, i) => (
                <PickRow key={row.place.place.id} n={i + 1} row={row} now={now} onOpen={openPlace} />
              ))}
            </ol>
          )}
          {rows.length > TOP && (
            <button type="button" className="btn ghost sm" onClick={() => setExpanded((e) => !e)}>
              {expanded ? T.less : T.more(rows.length - TOP)}
            </button>
          )}
        </div>
      </section>

      {selected && (
        <PlaceSheet
          key={selected.place.id}
          place={selected}
          menu={foodsOf(selected.place).menu}
          unpublished={unpublishedOf(selected.place.brand)}
          ctx={ctx}
          mealKcal={needs.meal.kcal}
          today={eat.today}
          now={now}
          platform={platform}
          onClose={() => closeEntry({ place: null })}
        />
      )}
    </>
  );
}

/** A row of the list: the dish that answers the sort, where it is, its numbers and why. */
function PickRow({ n, row, now, onOpen }: { n: number; row: EatPick; now: Date; onOpen: (id: string) => void }) {
  const { place, dish } = row;
  const open = openText(place.open, now);
  return (
    <li>
      <button type="button" className="fd-near-pick" onClick={() => onOpen(place.place.id)}>
        <span className={`fd-near-pick-n fd-near-pin-${n <= TOP ? dish.fit.level : 'none'}`} aria-hidden="true">
          {n}
        </span>
        <span className="fd-near-pick-main">
          <span className="fd-near-pick-dish">
            {dishName(dish.food)} <FitBadge fit={dish.fit} />
          </span>
          <span className="fd-near-pick-where">
            {[place.label ?? place.place.name, distanceText(place.distance, place.walkMin), open].filter(Boolean).join(' · ')}
          </span>
          <span className="fd-near-pick-nums">
            <MacroLine food={dish.food} /> · {dish.food.amountLabel}
          </span>
          {dish.reasons[0] && <span className="fd-near-pick-why">{dish.reasons[0]}</span>}
        </span>
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}
