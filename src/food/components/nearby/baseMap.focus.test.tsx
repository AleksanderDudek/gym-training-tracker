// @vitest-environment jsdom
import { render } from '@testing-library/react';
import L from 'leaflet';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { RankedPlace } from '../../nearby/eat';
import type { PlacedShop } from '../../nearby/types';
import { PlaceMap } from './PlaceMap';
import { StoreMap } from './StoreMap';

// Prawdziwy Leaflet w jsdom: płótno, które przyjmuje każde wywołanie, i pudełko mapy o rozmiarze
// telefonu (jsdom nie ma układu). Mapę, którą tworzy komponent, test łapie z `L.map`.
const restore: (() => void)[] = [];
let theMap: L.Map | null = null;

beforeAll(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function () {
    const set: Record<string | symbol, unknown> = {};
    return new Proxy(set, {
      get: (target, key) => (key in target ? target[key] : () => undefined),
      set: (target, key, value) => Reflect.set(target, key, value),
    });
  } as unknown as typeof getContext;
  restore.push(() => (HTMLCanvasElement.prototype.getContext = getContext));
  for (const [prop, size] of [['clientWidth', 360], ['clientHeight', 280]] as const) {
    const own = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('fd-near-map-canvas') ? size : 0;
      },
    });
    restore.push(() => (own ? Object.defineProperty(HTMLElement.prototype, prop, own) : Reflect.deleteProperty(HTMLElement.prototype, prop)));
  }
  const map = L.map;
  (L as { map: typeof L.map }).map = (...args: Parameters<typeof L.map>) => (theMap = map(...args));
  restore.push(() => ((L as { map: typeof L.map }).map = map));
});

afterAll(() => restore.forEach((undo) => undo()));

afterEach(() => {
  theMap = null;
});

const CENTER = { lat: 52.2297, lon: 21.0122 };

/** Pinezka miejsca o tym położeniu — na płótnie, więc szukana w warstwach mapy, nie w DOM. */
function pinAt(lat: number, lon: number): L.CircleMarker {
  const found: L.CircleMarker[] = [];
  theMap?.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker && layer.getPopup() && layer.getLatLng().equals([lat, lon])) found.push(layer);
  });
  const [pin] = found;
  if (!pin) throw new Error(`Brak pinezki w ${lat},${lon}`);
  return pin;
}

const popupElement = () => document.querySelector<HTMLElement>('.leaflet-popup');
/** Pudełko mapy: kontener Leafleta, z `tabindex` od niego. */
const mapBox = () => document.querySelector<HTMLElement>('.fd-near-map-canvas');

describe('„Zjedz teraz”: fokus w dymku, gdy pinezki rysują się od nowa', () => {
  const place = (id: string, lat: number, lon: number) =>
    ({ place: { id, name: `Lokal ${id}`, lat, lon }, best: null, open: null, options: [], distance: 100, walkMin: 2, label: null }) as unknown as RankedPlace;
  const A = place('a', 52.2302, 21.0127);
  const B = place('b', 52.229, 21.011);
  const map = (places: RankedPlace[]): ReactElement => (
    <PlaceMap
      center={CENTER}
      radius={1000}
      places={places}
      top={[]}
      selected={null}
      describe={() => ({ head: '', lines: [] })}
      onOpen={() => {}}
      onPick={() => {}}
      pickOnClick={false}
    />
  );

  test('z „Karta miejsca” wraca na „Karta miejsca” otwartego znów dymku', () => {
    const view = render(map([A, B]));
    pinAt(52.2302, 21.0127).openPopup();
    const before = popupElement()?.querySelector<HTMLElement>('.fd-near-pop-btn');
    before?.focus();
    expect(document.activeElement).toBe(before);
    view.rerender(map([A, B]));
    const after = popupElement()?.querySelector('.fd-near-pop-btn');
    expect(after).not.toBe(before);
    expect(after).toHaveTextContent('Karta miejsca');
    expect(document.activeElement).toBe(after);
  });

  test('miejsce znika z mapy (zamknięte o pełnej minucie, mniejszy promień): fokus na mapie, nie na początku strony', () => {
    const view = render(map([A, B]));
    pinAt(52.2302, 21.0127).openPopup();
    popupElement()?.querySelector<HTMLElement>('.fd-near-pop-btn')?.focus();
    view.rerender(map([B]));
    expect(popupElement()).toBeNull();
    expect(mapBox()).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(mapBox());
  });

  test('fokus poza dymkiem zostaje, gdzie był', () => {
    const view = render(
      <>
        {map([A, B])}
        <button type="button">pod mapą</button>
      </>,
    );
    pinAt(52.2302, 21.0127).openPopup();
    const outside = view.getByRole('button', { name: 'pod mapą' });
    outside.focus();
    view.rerender(
      <>
        {map([B])}
        <button type="button">pod mapą</button>
      </>,
    );
    expect(document.activeElement).toBe(outside);
  });
});

describe('„Zakupy i przepisy”: fokus w dymku, gdy pinezki rysują się od nowa', () => {
  const shop = (id: string, lat: number, lon: number): PlacedShop => ({
    id,
    name: `Sklep ${id}`,
    chain: 'lidl',
    lat,
    lon,
    address: null,
    openingHours: null,
    distance: 120,
  });
  const map = (shops: PlacedShop[], recipes: number): ReactElement => (
    <StoreMap
      center={CENTER}
      radius={1000}
      shops={shops}
      selectedChain={null}
      storeName={() => 'Lidl'}
      recipeCount={() => recipes}
      onPick={() => {}}
      pickOnClick={false}
      onSelectChain={() => {}}
    />
  );

  test('„Pokaż te przepisy” znika (sieć straciła przepisy): fokus na × tego samego dymku', () => {
    const view = render(map([shop('s1', 52.2302, 21.0127)], 3));
    pinAt(52.2302, 21.0127).openPopup();
    const button = popupElement()?.querySelector<HTMLElement>('.fd-near-pop-btn');
    expect(button).toHaveTextContent('Pokaż te przepisy');
    button?.focus();
    view.rerender(map([shop('s1', 52.2302, 21.0127)], 0));
    expect(popupElement()).toHaveTextContent('Brak przepisów z kompletem składników tutaj');
    expect(popupElement()?.querySelector('.fd-near-pop-btn')).toBeNull();
    expect(document.activeElement).toBe(popupElement()?.querySelector('.leaflet-popup-close-button'));
    expect(document.activeElement).toHaveAttribute('aria-label', 'Zamknij');
  });
});
