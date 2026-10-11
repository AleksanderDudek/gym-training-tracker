import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { formatDistance } from '../../nearby/geo';
import type { LatLon, PlacedShop } from '../../nearby/types';

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
const SafeCanvas = L.Canvas.extend({
  _redraw(this: { _ctx?: CanvasRenderingContext2D }) {
    if (this._ctx) (L.Canvas.prototype as unknown as { _redraw: () => void })._redraw.call(this);
  },
}) as unknown as new () => L.Canvas;

/** Jak długo wisi podpowiedź „dwoma palcami” po próbie przesunięcia mapy jednym. */
const HINT_MS = 1600;

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

function popupFor(shop: PlacedShop, props: Props, close: () => void): HTMLElement {
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
    count > 0 ? `Przepisy z kompletem składników tutaj: ${count}` : 'Brak przepisów z kompletem składników tutaj',
    'fd-near-pop-count',
  );
  if (count > 0) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn sm fd-near-pop-btn';
    button.textContent = 'Pokaż te przepisy';
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
 * mapę, w którą się kliknęło. Z klawiatury mapa jest jednym przystankiem Tab: strzałki ją przesuwają,
 * + i − przybliżają.
 */
export function StoreMap(props: Props) {
  const { center, radius, shops, selectedChain, describedBy } = props;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ you: L.LayerGroup; shops: L.LayerGroup } | null>(null);
  const you = useRef<L.CircleMarker | null>(null);
  const colors = useRef<Palette | null>(null);
  const latest = useRef(props);
  const [twoFingers, setTwoFingers] = useState(false);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
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
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      // Tryb CORS, żeby service worker zapamiętał kafelki jako pełne odpowiedzi.
      crossOrigin: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    L.control.zoom({ zoomInTitle: 'Przybliż', zoomOutTitle: 'Oddal' }).addTo(m);
    layers.current = { you: L.layerGroup().addTo(m), shops: L.layerGroup().addTo(m) };

    const pick = (e: L.LeafletMouseEvent) => latest.current.onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    // Leaflet zamyka otwarty dymek na `preclick`, a potem i tak odpala `click` na mapie: to
    // stuknięcie znaczyło „zamknij”, a nie „tu jestem”.
    let popupOpen = false;
    let closedPopup = false;
    m.on('popupopen', (e: L.PopupEvent) => {
      popupOpen = true;
      // Leaflet nazywa × po angielsku („Close popup”).
      e.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Zamknij');
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

    // Podpowiedź przy próbie przesunięcia mapy jednym palcem; drugi palec ją chowa.
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return;
      clearTimeout(hintTimer);
      if (e.touches.length !== 1) {
        setTwoFingers(false);
        return;
      }
      setTwoFingers(true);
      hintTimer = setTimeout(() => setTwoFingers(false), HINT_MS);
    };
    el.addEventListener('touchmove', onTouchMove, { passive: true });

    // Pudełko zmienia rozmiar razem z kolumną strony; Leaflet sam słucha tylko okna.
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => m.invalidateSize()) : null;
    resize?.observe(el);

    map.current = m;
    return () => {
      clearTimeout(hintTimer);
      el.removeEventListener('touchmove', onTouchMove);
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
      .bindTooltip('Tu jesteś')
      .addTo(group);
    m.fitBounds(circle.getBounds(), { padding: [12, 12] });
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
        aria-label="Mapa sklepów w pobliżu"
        aria-describedby={describedBy}
      />
      <p className={`fd-near-map-hint${twoFingers ? ' on' : ''}`} aria-hidden="true">
        Mapę przesuwasz dwoma palcami
      </p>
    </div>
  );
}
