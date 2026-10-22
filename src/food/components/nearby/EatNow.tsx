import { ChevronRight, Crosshair, LoaderCircle, LocateFixed, RefreshCw } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { pluralEn, text } from '../../../i18n';
import { productFood, type Food } from '../../diet/foods';
import type { Context } from '../../diet/suggest';
import { useFavorites } from '../../hooks/useDiet';
import { useDataset } from '../../hooks/useDataset';
import { useEatNow } from '../../hooks/useEatNow';
import type { GeoState } from '../../hooks/useGeolocation';
import { useNearbyPlaces } from '../../hooks/useNearbyShops';
import { useRestaurants } from '../../hooks/useRestaurants';
import { formatNumber, plural } from '../../lib/format';
import { storeKey } from '../../lib/stores';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { dishName, picks, placeFoods, rankPlaces, type EatPick, type RankedPlace, type SortKey } from '../../nearby/eat';
import { openState } from '../../nearby/hours';
import { mapsPlatform } from '../../nearby/navigate';
import type { Place } from '../../nearby/places';
import { radiusLabel } from '../../nearby/radius';
import type { LatLon } from '../../nearby/types';
import type { NearbyState } from '../../nearby/url';
import { isOnlineShop } from '../../online/shops';
import { brandIndex } from '../../restaurants/brands';
import type { Chain } from '../../restaurants/types';
import { readyProducts } from '../../recipes/ready';
import { dietPath } from '../../../routing';
import { COMMON } from '../common/text';
import { FIT_LABEL, FitBadge, MacroLine } from '../diet/SuggestionList';
import { ChipRow } from '../recipes/ChipRow';
import { AddressSearch } from './AddressSearch';
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
    menus: 'Wczytuję menu sieci…',
    fetchFailed: 'Nie udało się pobrać lokali.',
    found: (radius: string, known: number, fitting: number, other: number) =>
      `W promieniu ${radius}: ${known} ${plural(known, 'miejsce', 'miejsca', 'miejsc')} z menu, w tym ${fitting} z czymś na teraz` +
      (other ? `, i ${other} bez danych o menu.` : '.'),
    noneKnown: (radius: string) => `W promieniu ${radius} nie znam menu żadnego lokalu. Zwiększ promień albo pokaż lokale bez danych.`,
    answerHead: 'Na teraz',
    counting: 'Liczę, co zostało z dzisiejszego celu…',
    budget: (kcal: string, protein: string, left: string, meals: number) =>
      `ok. ${kcal} kcal i ${protein} g białka na ten posiłek — zostało ${left} kcal na ${meals} ${plural(meals, 'posiłek', 'posiłki', 'posiłków')}.`,
    done: (eaten: string, goal: string) =>
      `Dzisiejszy cel już osiągnięty (${eaten} z ${goal} kcal). Jeśli jesteś głodny, wybierz coś lekkiego.`,
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
    privacy:
      'Twoja pozycja, zaokrąglona do ok. 100 m, trafia do serwera Overpass z danymi OpenStreetMap (overpass-api.de, zapasowo overpass.private.coffee), a oglądany fragment mapy do tile.openstreetmap.org. Pozycji nie ma w adresie strony, a ostatnie miejsce zostaje tylko na tym urządzeniu.',
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
    menus: 'Loading the chains’ menus…',
    fetchFailed: 'Couldn’t fetch the places.',
    found: (radius: string, known: number, fitting: number, other: number) =>
      `Within ${radius}: ${known} ${pluralEn(known, 'place', 'places')} with a menu, ${fitting} with something for now` +
      (other ? `, and ${other} without menu data.` : '.'),
    noneKnown: (radius: string) => `Within ${radius} I don’t know any place’s menu. Widen the radius or show places without data.`,
    answerHead: 'For now',
    counting: 'Working out what’s left of today’s goal…',
    budget: (kcal: string, protein: string, left: string, meals: number) =>
      `about ${kcal} kcal and ${protein} g protein for this meal — ${left} kcal left for ${meals} ${pluralEn(meals, 'meal', 'meals')}.`,
    done: (eaten: string, goal: string) => `Today’s goal is reached (${eaten} of ${goal} kcal). If you’re hungry, pick something light.`,
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
    privacy:
      'Your position, rounded to about 100 m, goes to the Overpass server with OpenStreetMap data (overpass-api.de, with overpass.private.coffee as a backup), and the part of the map you’re viewing goes to tile.openstreetmap.org. Your position isn’t in the page address, and the last place stays only on this device.',
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
}

const kcal = (n: number) => formatNumber(Math.round(n / 10) * 10, 0);

/**
 * „Zjedz teraz”: where and what to eat around here that fits what is left of today. The answer
 * first (what this meal should be, and the best pick), the map with the places coloured by fit,
 * the three best choices under it (sortable), and a card per place with directions and the full
 * list. Everything follows the diary: the day's goal, what is eaten, a planned cheat meal.
 */
export function EatNow({ state, update, closeEntry, geo, locate, setManual, setRadius }: Props) {
  const eat = useEatNow();
  const [placesState, retry] = useNearbyPlaces(geo.position, state.radius);
  const menus = useRestaurants();
  const chains = menus.status === 'ready' ? menus.chains : NO_CHAINS;
  const data = useDataset();
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
      return { ...found, foods: found.foods.map((f) => (starred.has(f.key) ? { ...f, favorite: true as const } : f)) };
    },
    [menuOf, readyFor, dict, starred],
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
  const top = rows.slice(0, TOP).map((r) => r.place.place.id);
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

  const status = (() => {
    if (!geo.position) return geo.status === 'locating' ? T.locating : geo.status === 'denied' ? T.denied : T.failed;
    if (placesState.status === 'loading' || placesState.status === 'idle') return T.loading(radiusLabel(state.radius));
    if (placesState.status === 'error') return placesState.error ?? T.fetchFailed;
    if (menus.status === 'loading') return T.menus;
    if (known === 0) return T.noneKnown(radiusLabel(state.radius));
    return T.found(radiusLabel(state.radius), known, fitting, ranked.length - known);
  })();
  const note = geo.source === 'saved' && geo.status === 'locating' ? T.savedLocating : null;
  const over = needs.remaining.kcal <= 50;

  return (
    <>
      <section className="fd-near-mapsec" aria-label={T.mapTitle}>
        <div className="grp fd-near-controls">
          <RadiusSlider radius={state.radius} onChange={setRadius} />
          <AddressSearch onPick={setManual} />
          {note && <p className="fd-near-place-note">{note}</p>}
          <div className="fd-near-status">
            <p role="status">{status}</p>
            {placesState.status === 'error' && (
              <button type="button" className="btn sm ghost" onClick={retry}>
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
              {T.done(formatNumber(Math.round(eat.eaten.kcal), 0), formatNumber(Math.round(needs.targets.kcal), 0))}{' '}
              {state.sort !== 'light' && (
                <button type="button" className="btn ghost sm" onClick={() => update({ sort: 'light' })}>
                  {T.showLight}
                </button>
              )}
            </p>
          ) : (
            <p className="tight">
              {T.budget(kcal(needs.meal.kcal), formatNumber(Math.round(needs.meal.protein), 0), kcal(needs.remaining.kcal), needs.mealsLeft)}
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
          <p className="fd-near-privacy">{T.privacy}</p>
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
            geo.position && placesState.status === 'ready' && <p className="empty fd-near-empty">{T.empty}</p>
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
