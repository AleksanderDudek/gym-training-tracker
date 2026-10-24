import L from 'leaflet';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { text } from '../../../i18n';
import type { LatLon } from '../../nearby/types';

const T = text({
  pl: {
    zoomIn: 'Przybliż',
    zoomOut: 'Oddal',
    close: 'Zamknij',
    here: 'Tu jesteś',
    twoFingers: 'Mapę przesuwasz dwoma palcami',
  },
  en: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    close: 'Close',
    here: 'You are here',
    twoFingers: 'Move the map with two fingers',
  },
});

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

export interface Palette {
  recipes: string;
  ready: string;
  you: string;
  edge: string;
  ink: string;
  great: string;
  ok: string;
  avoid: string;
  none: string;
}

/**
 * Kolory znaczników z tokenów aplikacji. Leaflet rysuje na płótnie, które nie zna zmiennych CSS,
 * więc wartości czyta się raz, z arkusza.
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
    great: token('--ok'),
    ok: token('--c-gold'),
    avoid: token('--c-orange-ink'),
    none: token('--c-mid'),
  };
}

export interface BaseMapProps {
  center: LatLon | null;
  radius: number;
  /** Ustawia miejsce, w którym jest użytkownik. */
  onPick: (position: LatLon) => void;
  /**
   * Czy zwykłe stuknięcie ustawia miejsce. Tylko dopóki miejsca NIE MA: potem stuknięcie zamyka
   * dymki, a przeniesienie „siebie” wymaga świadomego przytrzymania palca albo prawego kliku.
   */
  pickOnClick: boolean;
  /** Środek mapy po każdym przesunięciu i przybliżeniu — dla „Ustaw środek mapy jako moją lokalizację”. */
  onViewChange?: (center: LatLon) => void;
}

export interface BaseMap {
  box: RefObject<HTMLDivElement | null>;
  map: RefObject<L.Map | null>;
  /** Warstwa znaczników miejsc — strona czyści ją i rysuje od nowa. */
  pins: RefObject<L.LayerGroup | null>;
  /** „Ty” — po narysowaniu miejsc wraca na wierzch. */
  you: RefObject<L.CircleMarker | null>;
  colors: RefObject<Palette | null>;
  reduceMotion: RefObject<boolean>;
  twoFingers: boolean;
}

/**
 * Mapa rysowana przez Leaflet na płótnie (tysiące znaczników przy 10 km w mieście zostają płynne).
 * React trzyma propsy, Leaflet — DOM w środku pudełka; strona dorysowuje swoje znaczniki do `pins`.
 *
 * Mapa nie więzi przewijania strony: na ekranie dotykowym jeden palec przewija stronę, a mapę
 * przesuwają i przybliżają dwa (próba jednym pokazuje podpowiedź); kółko myszy przybliża dopiero
 * mapę, w którą się kliknęło. Z klawiatury: sama mapa to jeden przystanek Tab (strzałki ją
 * przesuwają, + i − przybliżają), a po niej idą jeszcze przyciski przybliżania i odnośniki przypisu.
 * Z ograniczonym ruchem (`prefers-reduced-motion`) mapa nie animuje przybliżeń, przesunięć ani
 * pojawiania się kafelków.
 */
export function useBaseMap(props: BaseMapProps): BaseMap {
  const { center, radius } = props;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ you: L.LayerGroup; pins: L.LayerGroup } | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
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
      // Własne przyciski przybliżania niżej — z nazwami dla czytnika ekranu w języku aplikacji.
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
    layers.current = { you: L.layerGroup().addTo(m), pins: L.layerGroup().addTo(m) };
    pins.current = layers.current.pins;

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
      pins.current = null;
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

  return { box, map, pins, you, colors, reduceMotion, twoFingers };
}

/** Pudełko mapy z podpowiedzią „dwoma palcami”. */
export function MapFrame({
  boxRef,
  twoFingers,
  label,
  describedBy,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  twoFingers: boolean;
  label: string;
  describedBy?: string | undefined;
}) {
  return (
    <div className="fd-near-map-frame">
      <div ref={boxRef} className="fd-near-map-canvas" role="region" aria-label={label} aria-describedby={describedBy} />
      <p className={`fd-near-map-hint${twoFingers ? ' fd-near-on' : ''}`} aria-hidden="true">
        {T.twoFingers}
      </p>
    </div>
  );
}

/** Dymek węższy niż kolumna i odsunięty od przycisków przybliżania w lewym górnym rogu — inaczej na telefonie wchodziłby pod nie. */
export const POPUP_OPTIONS: L.PopupOptions = {
  maxWidth: 240,
  autoPanPaddingTopLeft: [60, 12],
  autoPanPaddingBottomRight: [12, 12],
};

const CLOSE_BUTTON = '.leaflet-popup-close-button';

/**
 * Pins are redrawn whenever more data arrives (the app's data comes in pieces, nearest first): this
 * keeps the popup the user is reading open across a redraw. Create it BEFORE `clearLayers()` (which
 * closes the popup), `track` every new pin, then `restore`. `container` is the map's box (Leaflet
 * makes it focusable): keyboard focus lands there when the popup it was in cannot come back.
 */
export function popupKeeper(openId: { current: string | null }, container: HTMLElement | null) {
  const reopen = openId.current;
  // Keyboard focus inside the open popup (its button or its ×) is put back after the redraw; focus elsewhere is left alone.
  const active = document.activeElement;
  const inPopup = active instanceof HTMLElement && active.closest('.leaflet-popup') ? active : null;
  const focus = inPopup?.matches(CLOSE_BUTTON) ? CLOSE_BUTTON : inPopup ? 'button' : null;
  const byId = new Map<string, L.Layer>();
  return {
    track(id: string, layer: L.Layer) {
      byId.set(id, layer);
      layer.on('popupopen', () => (openId.current = id));
      layer.on('popupclose', () => {
        if (openId.current === id) openId.current = null;
      });
    },
    restore() {
      const layer = reopen ? byId.get(reopen) : undefined;
      const popup = layer?.getPopup();
      if (!layer || !popup) {
        // Its place is gone from the redraw (closed at the minute tick, outside a smaller radius):
        // focus goes to the map instead of dropping to the start of the page with the removed popup.
        // A popup the user closed (still fading out) is not one to come back: its focus is left alone.
        if (reopen && focus) container?.focus({ preventScroll: true });
        return;
      }
      // Reopened where it was, without panning: the user may have moved the map since.
      const autoPan = popup.options.autoPan;
      popup.options.autoPan = false;
      layer.openPopup();
      popup.options.autoPan = autoPan;
      if (!focus) return;
      // The same control, or the × when it is gone („Pokaż te przepisy” once the shop has no recipes).
      const element = popup.getElement();
      const control = element?.querySelector<HTMLElement>(focus) ?? element?.querySelector<HTMLElement>(CLOSE_BUTTON) ?? container;
      control?.focus({ preventScroll: true });
    },
  };
}
