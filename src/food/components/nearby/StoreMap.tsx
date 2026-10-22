import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { text } from '../../../i18n';
import { formatDistance } from '../../nearby/geo';
import type { LatLon, PlacedShop } from '../../nearby/types';

const T = text({
  pl: {
    recipes: (n: number) => `Przepisy z kompletem składników tutaj: ${n}`,
    noRecipes: 'Brak przepisów z kompletem składników tutaj',
    show: 'Pokaż te przepisy',
    zoomIn: 'Przybliż',
    zoomOut: 'Oddal',
    close: 'Zamknij',
    here: 'Tu jesteś',
    map: 'Mapa sklepów w pobliżu',
    twoFingers: 'Mapę przesuwasz dwoma palcami',
  },
  en: {
    recipes: (n: number) => `Recipes with every ingredient here: ${n}`,
    noRecipes: 'No recipes with every ingredient here',
    show: 'Show these recipes',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    close: 'Close',
    here: 'You are here',
    map: 'Map of shops nearby',
    twoFingers: 'Move the map with two fingers',
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

/** Mniej więcej środek Polski, zanim wiadomo, gdzie jest użytkownik. */
const POLAND: L.LatLngExpression = [52.07, 19.48];

/**
 * Płótno Leafleta, które nie rysuje po zdjęciu mapy. Leaflet zamawia przerysowanie na następną
 * klatkę, a gdy w międzyczasie przerysuje płótno od razu (przy ustawieniu widoku), zapomina
 * o zamówionej klatce — `remove()` jej już nie odwoła i spóźniona klatka sięga do usuniętego
 * płótna (`clearRect` na `undefined`). Zdarza się, gdy mapa znika w klatce, w której powstała:
 * szybkie przejście do innej sekcji, a w trybie deweloperskim zawsze (StrictMode montuje dwa razy).
 */
export const SafeCanvas = L.Canvas.extend({
  _redraw(this: { _ctx?: CanvasRenderingContext2D }) {
    if (this._ctx) (L.Canvas.prototype as unknown as { _redraw: () => void })._redraw.call(this);
  },
}) as unknown as new () => L.Canvas;

/** Jak długo wisi podpowiedź „dwoma palcami” po próbie przesunięcia mapy jednym. */
const HINT_MS = 1600;
/** Ile pikseli musi przejechać jeden palec, zanim to jest „przesuwanie”, a nie drgnięcie przy stuknięciu. */
const HINT_MOVE_PX = 10;

/**
 * Pilnuje próby przesunięcia mapy JEDNYM palcem i woła `onHint(true)`, a po chwili `onHint(false)`.
 * Gest dwoma palcami ustawia flagę `multi` aż do podniesienia wszystkich palców: palec, który
 * zostaje na ekranie po szczypnięciu, albo drugi, który dopiero ląduje, nie zapala podpowiedzi.
 * Zapala ją dopiero ruch o co najmniej 10 px. Zwraca funkcję, która odpina nasłuch.
 */
export function watchOneFingerPan(el: HTMLElement, onHint: (on: boolean) => void, hideAfterMs = HINT_MS): () => void {
  let multi = false;
  let start: { x: number; y: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hide = () => {
    clearTimeout(timer);
    onHint(false);
  };
  const onStart = (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      multi = true;
      start = null;
      hide();
      return;
    }
    const t = e.touches[0];
    start = !multi && t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (multi || e.touches.length !== 1 || !start || !t) return;
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) < HINT_MOVE_PX) return;
    clearTimeout(timer);
    onHint(true);
    timer = setTimeout(() => onHint(false), hideAfterMs);
  };
  const onEnd = (e: TouchEvent) => {
    if (e.touches.length > 0) return;
    multi = false;
    start = null;
  };
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });
  el.addEventListener('touchcancel', onEnd, { passive: true });
  return () => {
    clearTimeout(timer);
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onEnd);
  };
}

interface Palette {
  recipes: string;
  ready: string;
  you: string;
  edge: string;
  ink: string;
}

/**
 * Kolory znaczników z tokenów aplikacji. Leaflet rysuje na płótnie, które nie zna zmiennych CSS,
 * więc wartości czyta się raz, z arkusza. Pomarańcz — sieć, w której kupisz komplet na przepis
 * (tam warto iść); stal — sieć z samymi gotowymi produktami; błękit — Ty.
 */
function palette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const token = (name: string) => css.getPropertyValue(name).trim() || 'black';
  return {
    recipes: token('--c-orange'),
    ready: token('--steel'),
    you: token('--c-blue-ink'),
    edge: token('--surface'),
    ink: token('--ink'),
  };
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

/**
 * Mapa rysowana przez Leaflet na płótnie (tysiące znaczników przy 10 km w mieście zostają płynne).
 * React trzyma propsy, Leaflet — DOM w środku pudełka.
 *
 * Mapa nie więzi przewijania strony: na ekranie dotykowym jeden palec przewija stronę, a mapę
 * przesuwają i przybliżają dwa (próba jednym pokazuje podpowiedź); kółko myszy przybliża dopiero
 * mapę, w którą się kliknęło. Z klawiatury: sama mapa to jeden przystanek Tab (strzałki ją
 * przesuwają, + i − przybliżają), a po niej idą jeszcze przyciski przybliżania i odnośniki przypisu.
 * Z ograniczonym ruchem (`prefers-reduced-motion`) mapa nie animuje przybliżeń, przesunięć ani
 * pojawiania się kafelków.
 */
export function StoreMap(props: Props) {
  const { center, radius, shops, selectedChain, describedBy } = props;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ you: L.LayerGroup; shops: L.LayerGroup } | null>(null);
  const you = useRef<L.CircleMarker | null>(null);
  const colors = useRef<Palette | null>(null);
  const reduceMotion = useRef(false);
  const latest = useRef(props);
  const [twoFingers, setTwoFingers] = useState(false);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const media = (query: string) => window.matchMedia?.(query).matches ?? false;
    // Tryb dotykowy tylko tam, gdzie dotyk jest JEDYNYM wskaźnikiem. Laptop z ekranem dotykowym
    // i gładzikiem (hover: hover) dostaje mapę jak na komputerze — tam jeden palec na ekranie
    // przesuwa mapę zamiast strony; przeglądarka nie mówi, którym wskaźnikiem ktoś akurat sięga.
    const touch = media('(hover: none) and (pointer: coarse)');
    const reduce = media('(prefers-reduced-motion: reduce)');
    reduceMotion.current = reduce;
    colors.current = palette(el);
    const m = L.map(el, {
      preferCanvas: true,
      renderer: new SafeCanvas(),
      // Własne przyciski przybliżania niżej — z polskimi nazwami dla czytnika ekranu.
      zoomControl: false,
      // Dotyk: jeden palec przewija stronę (Leaflet zostawia wtedy `touch-action: pan-x pan-y`),
      // a szczypanie dwoma palcami przesuwa i przybliża mapę.
      dragging: !touch,
      // Kółko myszy tylko po kliknięciu w mapę — inaczej przewijana strona utknęłaby na niej.
      scrollWheelZoom: false,
      zoomAnimation: !reduce,
      fadeAnimation: !reduce,
      markerZoomAnimation: !reduce,
      inertia: !reduce,
    });
    if (reduce) {
      // Przesunięcia (strzałki, dopasowanie dymka) Leaflet animuje zawsze, chyba że wywołanie powie inaczej.
      const panBy = m.panBy.bind(m);
      m.panBy = (offset, options) => panBy(offset, { ...options, animate: false });
    }
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      // Tryb CORS, żeby service worker zapamiętał kafelki jako pełne odpowiedzi.
      crossOrigin: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    L.control.zoom({ zoomInTitle: T.zoomIn, zoomOutTitle: T.zoomOut }).addTo(m);
    layers.current = { you: L.layerGroup().addTo(m), shops: L.layerGroup().addTo(m) };

    const pick = (e: L.LeafletMouseEvent) => latest.current.onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    // Leaflet zamyka otwarty dymek na `preclick`, a potem i tak odpala `click` na mapie: to
    // stuknięcie znaczyło „zamknij”, a nie „tu jestem”.
    let popupOpen = false;
    let closedPopup = false;
    m.on('popupopen', (e: L.PopupEvent) => {
      popupOpen = true;
      // Leaflet nazywa × po angielsku („Close popup”).
      e.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', T.close);
    });
    m.on('popupclose', () => (popupOpen = false));
    m.on('preclick', () => (closedPopup = popupOpen));
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (latest.current.pickOnClick && !closedPopup) pick(e);
    });
    // Przytrzymanie palca na telefonie (Leaflet albo przeglądarka zgłasza `contextmenu`), prawy klik na komputerze.
    m.on('contextmenu', pick);
    m.on('focus click', () => m.scrollWheelZoom.enable());
    m.on('blur mouseout', () => m.scrollWheelZoom.disable());
    const reportCenter = () => {
      const c = m.getCenter();
      latest.current.onViewChange?.({ lat: c.lat, lon: c.lng });
    };
    m.on('moveend', reportCenter);
    m.setView(POLAND, 6);
    reportCenter();

    // Podpowiedź przy próbie przesunięcia mapy jednym palcem — tylko tam, gdzie jeden palec jej nie przesuwa.
    const unwatch = touch ? watchOneFingerPan(el, setTwoFingers) : () => {};

    // Pudełko zmienia rozmiar razem z kolumną strony; Leaflet sam słucha tylko okna.
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => m.invalidateSize()) : null;
    resize?.observe(el);

    map.current = m;
    return () => {
      unwatch();
      resize?.disconnect();
      m.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layers.current?.you;
    const c = colors.current;
    if (!m || !group || !c) return;
    group.clearLayers();
    you.current = null;
    if (!center) return;
    const at: L.LatLngExpression = [center.lat, center.lon];
    const circle = L.circle(at, { radius, color: c.you, weight: 1.5, fillOpacity: 0.06, interactive: false }).addTo(group);
    you.current = L.circleMarker(at, { radius: 8, color: c.edge, weight: 3, fillColor: c.you, fillOpacity: 1 })
      .bindTooltip(T.here)
      .addTo(group);
    m.fitBounds(circle.getBounds(), { padding: [12, 12], animate: !reduceMotion.current });
  }, [center, radius]);

  useEffect(() => {
    const group = layers.current?.shops;
    const c = colors.current;
    if (!group || !c) return;
    group.clearLayers();
    for (const shop of shops) {
      const chosen = shop.chain === selectedChain;
      const dimmed = selectedChain !== null && !chosen;
      const withRecipes = latest.current.recipeCount(shop.chain ?? '') > 0;
      L.circleMarker([shop.lat, shop.lon], {
        radius: chosen ? 9 : 7,
        color: chosen ? c.ink : c.edge,
        weight: chosen ? 2.5 : 2,
        fillColor: withRecipes ? c.recipes : c.ready,
        fillOpacity: dimmed ? 0.35 : 0.95,
      })
        // Dymek węższy niż kolumna i odsunięty od przycisków przybliżania w lewym górnym rogu —
        // inaczej na telefonie wchodziłby pod nie.
        .bindPopup(() => popupFor(shop, latest.current, () => map.current?.closePopup()), {
          maxWidth: 240,
          autoPanPaddingTopLeft: [60, 12],
          autoPanPaddingBottomRight: [12, 12],
        })
        .addTo(group);
    }
    // Płótno rysuje w kolejności dodania: „Ty” na wierzchu, nie pod gęstwiną sklepów w centrum miasta.
    you.current?.bringToFront();
  }, [shops, selectedChain]);

  return (
    <div className="fd-near-map-frame">
      <div
        ref={box}
        className="fd-near-map-canvas"
        role="region"
        aria-label={T.map}
        aria-describedby={describedBy}
      />
      <p className={`fd-near-map-hint${twoFingers ? ' fd-near-on' : ''}`} aria-hidden="true">
        {T.twoFingers}
      </p>
    </div>
  );
}
