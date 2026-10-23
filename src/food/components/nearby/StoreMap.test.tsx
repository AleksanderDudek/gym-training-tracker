// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import type { PlacedShop } from '../../nearby/types';
import type L from 'leaflet';
import { popupKeeper } from './baseMap';
import { popupFor, SafeCanvas, watchOneFingerPan } from './StoreMap';

const SHOP: PlacedShop = {
  id: 'node/1',
  name: 'Biedronka',
  chain: 'biedronka',
  lat: 52.23,
  lon: 21.01,
  address: 'Marszałkowska 10',
  openingHours: 'Mo-Sa 06:00-23:00',
  distance: 300,
};

function popup(shop: PlacedShop, recipes: number) {
  const onSelectChain = vi.fn();
  const close = vi.fn();
  const el = popupFor(shop, { storeName: () => 'Biedronka', recipeCount: () => recipes, onSelectChain }, close);
  return { el, onSelectChain, close };
}

/** Zdarzenie dotyku z podanymi palcami — jsdom nie ma konstruktora `Touch`, więc lista jest udawana. */
function touch(type: string, points: [number, number][]): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'touches', { value: points.map(([clientX, clientY]) => ({ clientX, clientY })) });
  return event;
}

describe('dymek sklepu', () => {
  test('nazwa z OpenStreetMap zostaje tekstem, nawet gdy wygląda jak HTML', () => {
    const { el } = popup({ ...SHOP, name: '<b>Sklep</b><img src=x onerror=alert(1)>' }, 2);
    expect(el.querySelector('b, img')).toBeNull();
    expect(el.textContent).toContain('<b>Sklep</b><img src=x onerror=alert(1)>');
    expect(el.textContent).toMatch(/Biedronka · 300\sm/);
    expect(el.textContent).toContain('Marszałkowska 10');
    expect(el.textContent).toContain('Przepisy z kompletem składników tutaj: 2');
  });

  test('„Pokaż te przepisy” zamyka dymek i wybiera sieć', () => {
    const { el, onSelectChain, close } = popup(SHOP, 2);
    const button = el.querySelector('button');
    expect(button).toHaveTextContent('Pokaż te przepisy');
    button?.click();
    expect(close).toHaveBeenCalledOnce();
    expect(onSelectChain).toHaveBeenCalledWith('biedronka');
  });

  test('sieć bez przepisów: zdanie zamiast przycisku', () => {
    const { el } = popup(SHOP, 0);
    expect(el.querySelector('button')).toBeNull();
    expect(el.textContent).toContain('Brak przepisów z kompletem składników tutaj');
  });
});

describe('płótno mapy', () => {
  test('spóźniona klatka po zdjęciu mapy nie sięga do usuniętego płótna', () => {
    const canvas = new SafeCanvas() as unknown as { _redraw: () => void; _ctx?: unknown };
    expect(canvas._ctx).toBeUndefined();
    expect(() => canvas._redraw()).not.toThrow();
  });
});

describe('podpowiedź „dwoma palcami”', () => {
  test('zapala się dopiero po przesunięciu jednego palca o kilka pikseli i gaśnie sama', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    const onHint = vi.fn();
    const stop = watchOneFingerPan(el, onHint, 1000);
    el.dispatchEvent(touch('touchstart', [[100, 100]]));
    el.dispatchEvent(touch('touchmove', [[103, 104]]));
    expect(onHint).not.toHaveBeenCalled();
    el.dispatchEvent(touch('touchmove', [[100, 120]]));
    expect(onHint).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(1000);
    expect(onHint).toHaveBeenLastCalledWith(false);
    stop();
    vi.useRealTimers();
  });

  test('palec, który zostaje po szczypnięciu, jej nie zapala', () => {
    const el = document.createElement('div');
    const onHint = vi.fn();
    const stop = watchOneFingerPan(el, onHint);
    el.dispatchEvent(touch('touchstart', [[100, 100]]));
    el.dispatchEvent(touch('touchstart', [[100, 100], [200, 200]]));
    el.dispatchEvent(touch('touchmove', [[80, 80], [220, 220]]));
    // Jeden palec podniesiony, drugi jedzie dalej — to wciąż koniec szczypnięcia.
    el.dispatchEvent(touch('touchend', [[60, 60]]));
    el.dispatchEvent(touch('touchmove', [[20, 20]]));
    expect(onHint).not.toHaveBeenCalledWith(true);
    // Po podniesieniu wszystkich palców nowy gest jednym palcem znów się liczy.
    el.dispatchEvent(touch('touchend', []));
    el.dispatchEvent(touch('touchstart', [[100, 100]]));
    el.dispatchEvent(touch('touchmove', [[100, 140]]));
    expect(onHint).toHaveBeenLastCalledWith(true);
    stop();
  });
});

describe('dymek przy rysowaniu pinezek od nowa', () => {
  /** Pinezka na niby: tyle z warstwy Leafleta, ile używa `popupKeeper`. */
  function pin() {
    const handlers = new Map<string, () => void>();
    const layer = {
      on: (event: string, fn: () => void) => void handlers.set(event, fn),
      openPopup: vi.fn(() => handlers.get('popupopen')?.()),
      fire: (event: string) => handlers.get(event)?.(),
    };
    return layer as typeof layer & L.Layer;
  }

  test('otwarty dymek zostaje otwarty, gdy przyjdą nowe dane i pinezki rysują się od nowa', () => {
    const openId = { current: null as string | null };
    const first = popupKeeper(openId);
    const a = pin();
    const b = pin();
    first.track('a', a);
    first.track('b', b);
    first.restore();
    b.fire('popupopen');
    expect(openId.current).toBe('b');
    // Nowe rysowanie: najpierw keeper, potem clearLayers (zamyka dymek), potem nowe pinezki.
    const second = popupKeeper(openId);
    b.fire('popupclose');
    const a2 = pin();
    const b2 = pin();
    second.track('a', a2);
    second.track('b', b2);
    second.restore();
    expect(b2.openPopup).toHaveBeenCalledOnce();
    expect(a2.openPopup).not.toHaveBeenCalled();
    expect(openId.current).toBe('b');
  });

  test('zamknięty przez użytkownika dymek nie wraca', () => {
    const openId = { current: null as string | null };
    const keeper = popupKeeper(openId);
    const a = pin();
    keeper.track('a', a);
    a.fire('popupopen');
    a.fire('popupclose');
    const next = popupKeeper(openId);
    const a2 = pin();
    next.track('a', a2);
    next.restore();
    expect(a2.openPopup).not.toHaveBeenCalled();
  });
});
