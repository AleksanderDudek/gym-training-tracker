// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
  /**
   * Pinezka na niby: tyle z warstwy Leafleta, ile używa `popupKeeper`. Z treścią dymek jest
   * prawdziwym węzłem w dokumencie, jak u Leafleta: treść i × w `.leaflet-popup`.
   */
  function pin(content?: () => HTMLElement) {
    const handlers = new Map<string, () => void>();
    let element: HTMLElement | undefined;
    const popup = { options: { autoPan: true }, getElement: () => element };
    const layer = {
      on: (event: string, fn: () => void) => void handlers.set(event, fn),
      getPopup: () => popup,
      // Records whether the popup was reopened with panning switched off.
      openPopup: vi.fn(() => {
        layer.pannedOnOpen = popup.options.autoPan;
        if (content) element = popupElement(content());
        handlers.get('popupopen')?.();
      }),
      pannedOnOpen: null as boolean | null,
      fire: (event: string) => handlers.get(event)?.(),
      /** `clearLayers()` przy otwartym dymku: węzeł znika z dokumentu (a z nim fokus), potem `popupclose`. */
      clear: () => {
        element?.remove();
        handlers.get('popupclose')?.();
      },
    };
    return layer as typeof layer & L.Layer;
  }

  function popupElement(content: HTMLElement): HTMLElement {
    const root = document.createElement('div');
    root.className = 'leaflet-popup';
    const close = document.createElement('a');
    close.className = 'leaflet-popup-close-button';
    close.href = '#close';
    close.setAttribute('role', 'button');
    root.append(content, close);
    document.body.append(root);
    return root;
  }

  test('otwarty dymek zostaje otwarty, gdy przyjdą nowe dane i pinezki rysują się od nowa', () => {
    const openId = { current: null as string | null };
    const first = popupKeeper(openId, null);
    const a = pin();
    const b = pin();
    first.track('a', a);
    first.track('b', b);
    first.restore();
    b.fire('popupopen');
    expect(openId.current).toBe('b');
    // Nowe rysowanie: najpierw keeper, potem clearLayers (zamyka dymek), potem nowe pinezki.
    const second = popupKeeper(openId, null);
    b.fire('popupclose');
    const a2 = pin();
    const b2 = pin();
    second.track('a', a2);
    second.track('b', b2);
    second.restore();
    expect(b2.openPopup).toHaveBeenCalledOnce();
    expect(a2.openPopup).not.toHaveBeenCalled();
    expect(openId.current).toBe('b');
    // Reopened without panning the map back to it; the popup's own setting is restored after.
    expect(b2.pannedOnOpen).toBe(false);
    expect(b2.getPopup().options.autoPan).toBe(true);
  });

  test('zamknięty przez użytkownika dymek nie wraca', () => {
    const openId = { current: null as string | null };
    const keeper = popupKeeper(openId, null);
    const a = pin();
    keeper.track('a', a);
    a.fire('popupopen');
    a.fire('popupclose');
    const next = popupKeeper(openId, null);
    const a2 = pin();
    next.track('a', a2);
    next.restore();
    expect(a2.openPopup).not.toHaveBeenCalled();
  });

  describe('fokus z klawiatury w dymku', () => {
    /** Dymek sklepu, który ma `recipes` przepisów: z „Pokaż te przepisy” albo bez. */
    const shopPopup = (recipes: number) => () =>
      popupFor(SHOP, { storeName: () => 'Biedronka', recipeCount: () => recipes, onSelectChain: vi.fn() }, vi.fn());
    /** Pudełko mapy: Leaflet daje mu `tabindex`, więc da się na nim postawić fokus. */
    let box: HTMLDivElement;

    beforeEach(() => {
      box = document.createElement('div');
      box.tabIndex = 0;
      document.body.append(box);
    });

    afterEach(() => document.body.replaceChildren());

    /** Dymek sklepu „a” otwarty, fokus na `control` w nim; zaczyna się nowe rysowanie (keeper, clearLayers). */
    function redrawWithFocusOn(control: string) {
      const openId = { current: null as string | null };
      const first = popupKeeper(openId, box);
      const a = pin(shopPopup(2));
      first.track('a', a);
      first.restore();
      a.openPopup();
      a.getPopup().getElement()?.querySelector<HTMLElement>(control)?.focus();
      expect(document.activeElement?.closest('.leaflet-popup')).not.toBeNull();
      const keeper = popupKeeper(openId, box);
      a.clear();
      return keeper;
    }

    test('wraca na tę samą kontrolkę w otwartym znów dymku', () => {
      for (const control of ['button', '.leaflet-popup-close-button']) {
        const keeper = redrawWithFocusOn(control);
        const a2 = pin(shopPopup(2));
        keeper.track('a', a2);
        keeper.restore();
        const same = a2.getPopup().getElement()?.querySelector(control);
        expect(same).toBeInstanceOf(HTMLElement);
        expect(document.activeElement).toBe(same);
      }
    });

    test('gdy tej kontrolki już nie ma (sieć straciła przepisy), na × tego dymku', () => {
      const keeper = redrawWithFocusOn('button');
      const a2 = pin(shopPopup(0));
      keeper.track('a', a2);
      keeper.restore();
      const popup = a2.getPopup().getElement();
      expect(popup?.querySelector('button')).toBeNull();
      expect(document.activeElement).toBe(popup?.querySelector('.leaflet-popup-close-button'));
    });

    test('gdy dymka nie ma jak otworzyć (jego miejsca nie ma po rysowaniu), na mapie, bez przewijania strony', () => {
      const focus = vi.spyOn(box, 'focus');
      const keeper = redrawWithFocusOn('button');
      keeper.track('b', pin(shopPopup(2)));
      keeper.restore();
      expect(document.activeElement).toBe(box);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });

    test('dymek zamknięty przez użytkownika, który jeszcze znika, nie przenosi fokusu na mapę', () => {
      const openId = { current: null as string | null };
      const first = popupKeeper(openId, box);
      const a = pin(shopPopup(2));
      first.track('a', a);
      a.openPopup();
      const button = a.getPopup().getElement()?.querySelector<HTMLElement>('button');
      button?.focus();
      // Zamknięty jego przyciskiem albo ×: `popupclose` od razu, węzeł Leaflet zdejmuje dopiero po wygaszeniu.
      a.fire('popupclose');
      const keeper = popupKeeper(openId, box);
      keeper.track('a', pin(shopPopup(2)));
      keeper.restore();
      expect(document.activeElement).toBe(button);
    });

    test('fokusu spoza dymka nie zabiera — ani do otwartego znów dymku, ani na mapę', () => {
      const outside = document.createElement('input');
      document.body.append(outside);
      const openId = { current: null as string | null };
      const first = popupKeeper(openId, box);
      const a = pin(shopPopup(2));
      first.track('a', a);
      a.openPopup();
      outside.focus();
      // Dymek otwarty znów…
      const second = popupKeeper(openId, box);
      a.clear();
      const a2 = pin(shopPopup(2));
      second.track('a', a2);
      second.restore();
      expect(a2.openPopup).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(outside);
      // …i jego miejsce znikające z mapy.
      const third = popupKeeper(openId, box);
      a2.clear();
      third.restore();
      expect(document.activeElement).toBe(outside);
    });
  });
});
