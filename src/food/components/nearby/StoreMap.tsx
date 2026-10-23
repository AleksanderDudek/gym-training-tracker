import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { text } from '../../../i18n';
import { formatDistance } from '../../nearby/geo';
import type { LatLon, PlacedShop } from '../../nearby/types';
import { MapFrame, POPUP_OPTIONS, popupKeeper, useBaseMap } from './baseMap';

export { SafeCanvas, watchOneFingerPan } from './baseMap';

const T = text({
  pl: {
    recipes: (n: number) => `Przepisy z kompletem składników tutaj: ${n}`,
    noRecipes: 'Brak przepisów z kompletem składników tutaj',
    show: 'Pokaż te przepisy',
    map: 'Mapa sklepów w pobliżu',
  },
  en: {
    recipes: (n: number) => `Recipes with every ingredient here: ${n}`,
    noRecipes: 'No recipes with every ingredient here',
    show: 'Show these recipes',
    map: 'Map of shops nearby',
  },
});

interface Props {
  center: LatLon | null;
  radius: number;
  shops: PlacedShop[];
  selectedChain: string | null;
  storeName: (chain: string) => string;
  recipeCount: (chain: string) => number;
  /** Ustawia miejsce, w którym jest użytkownik. */
  onPick: (position: LatLon) => void;
  /**
   * Czy zwykłe stuknięcie ustawia miejsce. Tylko dopóki miejsca NIE MA: potem stuknięcie zamyka
   * dymki, a przeniesienie „siebie” wymaga świadomego przytrzymania palca albo prawego kliku.
   */
  pickOnClick: boolean;
  onSelectChain: (chain: string | null) => void;
  /** Środek mapy po każdym przesunięciu i przybliżeniu — dla „Ustaw środek mapy jako moją lokalizację”. */
  onViewChange?: (center: LatLon) => void;
  /** Opis obsługi mapy (klawisze, palce) — trafia do `aria-describedby`. */
  describedBy?: string;
}

/** Treść dymka sklepu: same węzły tekstowe i przycisk „Pokaż te przepisy”, gdy sieć ma przepisy. */
export function popupFor(
  shop: PlacedShop,
  props: Pick<Props, 'storeName' | 'recipeCount' | 'onSelectChain'>,
  close: () => void,
): HTMLElement {
  // Same węzły tekstowe: nazwy sklepów pochodzą z OpenStreetMap, a tam może je wpisać każdy.
  const root = document.createElement('div');
  root.className = 'fd-near-pop';
  const line = (text: string, className = '') => {
    const p = document.createElement('p');
    p.textContent = text;
    if (className) p.className = className;
    root.appendChild(p);
  };
  const chain = shop.chain ?? '';
  line(shop.name, 'fd-near-pop-name');
  line(`${props.storeName(chain)} · ${formatDistance(shop.distance)}`);
  if (shop.address) line(shop.address);
  if (shop.openingHours) line(shop.openingHours, 'fd-near-pop-soft');
  const count = props.recipeCount(chain);
  line(
    count > 0 ? T.recipes(count) : T.noRecipes,
    'fd-near-pop-count',
  );
  if (count > 0) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn sm fd-near-pop-btn';
    button.textContent = T.show;
    button.addEventListener('click', () => {
      close();
      props.onSelectChain(shop.chain);
    });
    root.appendChild(button);
  }
  return root;
}

/** Sklepy: pomarańcz — sieć, w której kupisz komplet na przepis (tam warto iść); stal — sieć z samymi gotowymi produktami. */
export function StoreMap(props: Props) {
  const { shops, selectedChain, describedBy } = props;
  const { box, map, pins, you, colors, twoFingers } = useBaseMap(props);
  // Dymek i kolor czytają propsy z chwili rysowania albo otwarcia — liczba przepisów dochodzi później niż sklepy.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  /** Sklep z otwartym dymkiem: dymek zostaje, gdy pinezki rysują się od nowa. */
  const openId = useRef<string | null>(null);

  useEffect(() => {
    const group = pins.current;
    const c = colors.current;
    if (!group || !c) return;
    const keeper = popupKeeper(openId);
    group.clearLayers();
    for (const shop of shops) {
      const chosen = shop.chain === selectedChain;
      const dimmed = selectedChain !== null && !chosen;
      const withRecipes = latest.current.recipeCount(shop.chain ?? '') > 0;
      const pin = L.circleMarker([shop.lat, shop.lon], {
        radius: chosen ? 9 : 7,
        color: chosen ? c.ink : c.edge,
        weight: chosen ? 2.5 : 2,
        fillColor: withRecipes ? c.recipes : c.ready,
        fillOpacity: dimmed ? 0.35 : 0.95,
      })
        .bindPopup(() => popupFor(shop, latest.current, () => map.current?.closePopup()), POPUP_OPTIONS)
        .addTo(group);
      keeper.track(shop.id, pin);
    }
    // Płótno rysuje w kolejności dodania: „Ty” na wierzchu, nie pod gęstwiną sklepów w centrum miasta.
    you.current?.bringToFront();
    keeper.restore();
  }, [shops, selectedChain, pins, colors, map, you]);

  return <MapFrame boxRef={box} twoFingers={twoFingers} label={T.map} describedBy={describedBy} />;
}
