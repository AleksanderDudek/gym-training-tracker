// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BridgeContext } from '../../bridge';
import { MISSING_DATA_MESSAGE, loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { clearAll } from '../../diet/store';
import type { OsmState } from '../../hooks/useOsmAround';
import type { RestaurantsResult } from '../../hooks/useRestaurants';
import type { RankedPlace } from '../../nearby/eat';
import type { Element } from '../../nearby/overpass';
import type { PlacedShop } from '../../nearby/types';
import { renderWithBridge } from '../../test/bridge';
import { DATASET, INDEXED } from '../../test/fixtures';
import NearbyPage from './NearbyPage';
import { dataDate } from './nearbyText';

// Stan danych okolicy jest dany, a nie pobierany: te testy są o tym, co strona z nim mówi (uwaga
// „Na razie”, wiersz stanu i przypis pod mapą) i kiedy „Zjedz teraz” prosi o bazę produktów, a nie
// o tym, jak ten stan powstaje — to sprawdzają testy `useOsmAround`. Ponowienie to szpieg.
const osm = vi.hoisted(() => ({ state: null as unknown as OsmState, retry: vi.fn() }));
vi.mock('../../hooks/useOsmAround', () => ({ useOsmAround: () => [osm.state, osm.retry] }));

// Menu sieci prawdziwe, chyba że test każe im się dalej wczytywać albo zawieść (z ponowieniem-szpiegiem).
const menus = vi.hoisted(() => ({ status: 'ready' as 'ready' | 'loading' | 'error', retry: vi.fn() }));
vi.mock('../../hooks/useRestaurants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useRestaurants')>();
  return {
    ...actual,
    useRestaurants: (): RestaurantsResult => {
      const real = actual.useRestaurants();
      return menus.status === 'ready' ? real : { status: menus.status, retry: menus.retry };
    },
  };
});

// Ta kompilacja „ma” dane OSM: przypis niesie wtedy odnośnik do licencji ODbL.
vi.mock('virtual:osm-places', () => ({ default: { index: 'data/osm/v1/index.json' } }));

vi.mock('./PlaceMap', () => ({
  PlaceMap: (props: { places: RankedPlace[] }) => <div data-testid="pins">{props.places.map((p) => p.place.name).join(',')}</div>,
}));
vi.mock('./StoreMap', () => ({
  StoreMap: (props: { shops: PlacedShop[] }) => <div data-testid="shops">{props.shops.map((s) => s.name).join(',')}</div>,
}));

vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

const LOADED: LoadedDataset = { dataset: DATASET, products: INDEXED };
const HERE = { lat: 52.2297, lon: 21.0122 };
const DAY = 24 * 3600 * 1000;
/** Chwila danych aplikacji: późny wieczór UTC, więc jej dzień zależy od strefy urządzenia. */
const AS_OF = '2026-10-22T20:21:33Z';
const node = (id: number, metres: number, tags: Record<string, string>): Element => ({
  type: 'node',
  id,
  lat: HERE.lat + metres / 111_000,
  lon: HERE.lon,
  tags,
});

// Po jednym miejscu każdego widoku między 1200 a 1250 m: w pełnej części listy (do 1250 m), ale poza
// pełnymi 1,2 km, które podaje uwaga — nie może się w niej liczyć.
const PLACES = [
  node(10, 200, { amenity: 'fast_food', brand: "McDonald's", name: "McDonald's", opening_hours: '24/7' }),
  node(11, 400, { amenity: 'restaurant', brand: 'Salad Story', name: 'Salad Story' }),
  node(13, 100, { amenity: 'restaurant', name: 'Bar u Zdzisia', cuisine: 'polish' }),
  node(15, 1225, { amenity: 'fast_food', brand: "McDonald's", name: "McDonald's dalej", opening_hours: '24/7' }),
];
const SHOPS = [
  node(1, 300, { shop: 'supermarket', brand: 'Biedronka', name: 'Biedronka' }),
  node(2, 800, { shop: 'supermarket', brand: 'Lidl', name: 'Lidl' }),
  node(3, 100, { shop: 'convenience', name: 'Sklep u Ani' }),
  node(4, 1225, { shop: 'supermarket', brand: 'Lidl', name: 'Lidl dalej' }),
];

/** Dane aplikacji w drodze: pełne do 1250 m, reszta promienia jeszcze się wczytuje. */
function osmState(over: Partial<OsmState> = {}): OsmState {
  return {
    status: 'loading',
    items: PLACES,
    completeWithin: 1250,
    error: null,
    savedAt: null,
    since: Date.now(),
    retryAt: null,
    source: 'static',
    shown: 'static',
    coverage: 'full',
    dataAsOf: AS_OF,
    olderLeaves: false,
    ...over,
  };
}

/** Rysuje stronę jeszcze raz — z tym, co teraz zwraca `useOsmAround` (`osm.state`). */
function renderAgain(view: ReturnType<typeof renderWithBridge>) {
  view.rerender(
    <BridgeContext.Provider value={view.bridge}>
      <NearbyPage />
    </BridgeContext.Provider>,
  );
}

/** Baza produktów nie jest jeszcze wczytana, a jej pobieranie (gdy ruszy) trwa, aż test ją wpuści. */
function holdProducts(): (loaded: LoadedDataset) => void {
  let arrive!: (loaded: LoadedDataset) => void;
  vi.mocked(loadedDataset).mockReturnValue(null);
  vi.mocked(loadDataset).mockReturnValue(new Promise((resolve) => (arrive = resolve)));
  return (loaded) => arrive(loaded);
}

/** Baza produktów nie jest wczytana, a jej pobieranie zawodzi z tym komunikatem. */
function failProducts(message: string) {
  vi.mocked(loadedDataset).mockReturnValue(null);
  vi.mocked(loadDataset).mockRejectedValue(new Error(message));
}

/** `location.reload` jako szpieg (jsdom strony nie przeładowuje); reszta adresu jak była. */
function spyReload() {
  const reload = vi.fn();
  const real = window.location;
  vi.stubGlobal(
    'location',
    new Proxy(
      {},
      {
        get: (_, key) => {
          if (key === 'reload') return reload;
          const value: unknown = Reflect.get(real, key);
          return typeof value === 'function' ? value.bind(real) : value;
        },
      },
    ),
  );
  return reload;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 22, 13, 0));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '#/w-poblizu');
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockClear().mockResolvedValue(LOADED);
  osm.retry.mockClear();
  menus.status = 'ready';
  menus.retry.mockClear();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: HERE.lat, longitude: HERE.lon } } as GeolocationPosition) },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Z powrotem getter jsdom, jeśli test odciął internet.
  delete (navigator as { onLine?: boolean }).onLine;
});

/**
 * Uwaga stoi poza każdym regionem `status`: zmienia się z każdą paczką, czytnik ekranu czytałby
 * każdą. Wiersz stanu jest regionem i mówi tylko `status` (promień ma twardą spację, stąd getByText).
 */
function expectOutsideLiveRegions(note: HTMLElement, status: string) {
  expect(note.closest('[role="status"]')).toBeNull();
  expect(screen.getByText(status)).toHaveAttribute('role', 'status');
  for (const region of screen.getAllByRole('status')) expect(region).not.toHaveTextContent(/na razie/i);
}

describe('„Na razie”, póki odpowiedź przychodzi kawałkami', () => {
  test('„Zakupy i przepisy”: liczy tylko sklepy z danymi o produktach z promienia, który podaje — i tak je nazywa', async () => {
    window.history.replaceState(null, '', '#/w-poblizu?widok=sklepy&r=5000');
    osm.state = osmState({ items: SHOPS });
    renderWithBridge(<NearbyPage />);
    const note = await screen.findByText(/^Na razie:/);
    // Lidl dalej jest w pełnej części listy (na mapie też), ale nie w 1,2 km; Sklep u Ani jest w nich,
    // ale bez danych o produktach — jak w wierszu stanu, gdy lista jest pełna („2 sklepy z danymi
    // o produktach i 1 inny”).
    expect(screen.getByTestId('shops')).toHaveTextContent('Lidl dalej');
    expect(note).toHaveTextContent('Na razie: 2 sklepy z danymi o produktach w promieniu 1,2 km.');
    expectOutsideLiveRegions(note, 'Szukam sklepów w promieniu 5 km…');
  });

  test.each([
    [500, 'Na razie: 1 sklep z danymi o produktach w promieniu 500 m.'],
    [200, 'Na razie: 0 sklepów z danymi o produktach w promieniu 200 m.'],
  ])('„Zakupy i przepisy”: liczba sklepów odmieniona (pełne do %i m)', async (completeWithin, expected) => {
    window.history.replaceState(null, '', '#/w-poblizu?widok=sklepy&r=5000');
    osm.state = osmState({ items: SHOPS, completeWithin });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText(/^Na razie:/)).toHaveTextContent(expected);
  });

  test('„Zjedz teraz”: liczy tylko miejsca z menu z promienia, który podaje', async () => {
    window.history.replaceState(null, '', '#/w-poblizu?r=5000');
    osm.state = osmState();
    renderWithBridge(<NearbyPage />);
    const note = await screen.findByText(/^Na razie:/);
    expect(screen.getByTestId('pins')).toHaveTextContent("McDonald's dalej");
    // McDonald's i Salad Story; Bar u Zdzisia jest bez menu, McDonald's dalej poza 1,2 km.
    expect(note).toHaveTextContent('Na razie: 2 miejsca z menu w promieniu 1,2 km.');
    expectOutsideLiveRegions(note, 'Szukam lokali w promieniu 5 km…');
  });

  test.each(['loading', 'error'] as const)(
    '„Zjedz teraz” bez uwagi, gdy menu sieci nie ma (%s): każde miejsce wyglądałoby na takie bez menu',
    async (status) => {
      menus.status = status;
      window.history.replaceState(null, '', '#/w-poblizu?r=5000');
      osm.state = osmState();
      renderWithBridge(<NearbyPage />);
      // Wiersz stanu i uwaga liczą się w tym samym rysowaniu, od chwili, gdy jest pozycja.
      expect(await screen.findByText('Szukam lokali w promieniu 5 km…')).toBeInTheDocument();
      expect(screen.queryByText(/^Na razie:/)).toBeNull();
    },
  );

  test('„Zjedz teraz”, póki nie ma produktów sklepów (przychodzą po lokalach): uwaga liczy miejsca z menu, jakie już są', async () => {
    holdProducts();
    window.history.replaceState(null, '', '#/w-poblizu?r=5000');
    osm.state = osmState({ items: [...PLACES, ...SHOPS] });
    renderWithBridge(<NearbyPage />);
    // McDonald's i Salad Story; sklepy dojdą z produktami — „na razie” tylko rośnie, nie kłamie w dół.
    expect(await screen.findByText(/^Na razie:/)).toHaveTextContent('Na razie: 2 miejsca z menu w promieniu 1,2 km.');
    expect(loadDataset).not.toHaveBeenCalled();
  });

  test('„Zjedz teraz” z bazą produktów wczytaną wcześniej: liczy od razu i sklepy z gotowym jedzeniem', async () => {
    window.history.replaceState(null, '', '#/w-poblizu?r=5000');
    osm.state = osmState({ items: [...PLACES, ...SHOPS] });
    renderWithBridge(<NearbyPage />);
    // McDonald's, Salad Story, Biedronka i Lidl; Bar u Zdzisia i Sklep u Ani są bez danych, oba „dalej” poza 1,2 km.
    expect(await screen.findByText(/^Na razie:/)).toHaveTextContent('Na razie: 4 miejsca z menu w promieniu 1,2 km.');
    // Lokale wciąż przychodzą, więc o bazę nikt jeszcze nie prosił: wczytana wcześniej, jest od razu.
    expect(loadDataset).not.toHaveBeenCalled();
  });
});

describe('„Zjedz teraz”: baza produktów czeka na lokale', () => {
  test.each<[string, Partial<OsmState>]>([
    ['gotowe', { status: 'ready', completeWithin: 1000 }],
    ['nieudane', { status: 'error', error: 'Nie udało się pobrać danych okolicy.', items: [], completeWithin: 0 }],
  ])('nie rusza, póki lokale się wczytują, a rusza, gdy są (%s)', async (_, done) => {
    holdProducts();
    osm.state = osmState();
    const view = renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Szukam lokali w promieniu 1 km…')).toBeInTheDocument();
    // Jej 3,3 MB nie staną na wolnym łączu przed indeksem i kawałkami danych okolicy.
    expect(loadDataset).not.toHaveBeenCalled();
    osm.state = osmState(done);
    renderAgain(view);
    await waitFor(() => expect(loadDataset).toHaveBeenCalledTimes(1));
  });

  test.each<[string, Partial<OsmState>]>([
    ['za granicą', { source: 'live', shown: 'live', coverage: 'none' }],
    ['przy granicy', { source: 'mixed', shown: 'static', coverage: 'partial' }],
    ['gdy Overpass zastępuje dane aplikacji', { source: 'live', shown: 'live', coverage: 'unknown' }],
  ])('%s rusza od razu: czeka się tam na szukanie serwera map, nie na pliki aplikacji — czekanie odsunęłoby ją o całe szukanie', async (_, where) => {
    holdProducts();
    osm.state = osmState(where);
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText(/^Szukam lokali w promieniu 1 km…/)).toBeInTheDocument();
    await waitFor(() => expect(loadDataset).toHaveBeenCalledTimes(1));
  });

  test('póki produkty sklepów w drodze, wiersz stanu mówi to, zamiast liczyć sklepy jako bez menu', async () => {
    const products = holdProducts();
    osm.state = osmState({ status: 'ready', items: [...PLACES, ...SHOPS], completeWithin: 1000 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Wczytuję produkty sklepów…')).toHaveAttribute('role', 'status');
    expect(screen.queryByText(/bez danych o menu\./)).toBeNull();
    products(LOADED);
    // McDonald's, Salad Story, Biedronka i Lidl; Bar u Zdzisia i Sklep u Ani bez danych — liczby raz, już ostateczne.
    expect(
      await screen.findByText(/^W promieniu 1 km: 4 miejsca z menu, w tym \d z czymś na teraz, i 2 bez danych o menu\.$/),
    ).toHaveAttribute('role', 'status');
  });

  test('produkty sklepów się nie wczytały: wiersz stanu to mówi, a „Spróbuj ponownie” pobiera je jeszcze raz', async () => {
    const user = userEvent.setup();
    vi.mocked(loadedDataset).mockReturnValue(null);
    vi.mocked(loadDataset).mockRejectedValueOnce(new Error('Nie udało się pobrać danych produktów.'));
    osm.state = osmState({ status: 'ready', items: [...PLACES, ...SHOPS], completeWithin: 1000 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Nie udało się wczytać produktów sklepów.')).toHaveAttribute('role', 'status');
    // Sklepy nie liczą się jako bez menu, a pod listą nikt nie radzi większego promienia.
    expect(screen.queryByText(/bez danych o menu\./)).toBeNull();
    expect(screen.queryByText(/zwiększ promień/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(loadDataset).toHaveBeenCalledTimes(2));
    expect(osm.retry).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/^W promieniu 1 km: 4 miejsca z menu, w tym \d z czymś na teraz, i 2 bez danych o menu\.$/),
    ).toHaveAttribute('role', 'status');
  });

  test('bez sklepu sieci w pobliżu produkty niczego nie zmieniają: liczby od razu', async () => {
    holdProducts();
    osm.state = osmState({ status: 'ready', completeWithin: 1000 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText(/^W promieniu 1 km: 2 miejsca z menu, w tym \d z czymś na teraz, i 1 bez danych o menu\.$/)).toBeInTheDocument();
  });

  test.each([
    ['w drodze', 'Wczytuję produkty sklepów…', () => void holdProducts()],
    ['nieudane', 'Nie udało się wczytać produktów sklepów.', () => failProducts('Nie udało się pobrać danych produktów.')],
  ])('w pobliżu same sklepy, ich produkty %s: pod pustą listą nikt nie radzi większego promienia', async (_, status, products) => {
    products();
    osm.state = osmState({ status: 'ready', items: SHOPS, completeWithin: 1000 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText(status)).toHaveAttribute('role', 'status');
    expect(screen.queryByText(/zwiększ promień/i)).toBeNull();
  });

  test('…a gdy produkty są i lista jest ostateczna, a pusta (sklep bez danych), radzi', async () => {
    osm.state = osmState({ status: 'ready', items: [SHOPS[2]!], completeWithin: 1000 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Nic do pokazania — zwiększ promień albo pokaż zamknięte i lokale bez danych.')).toBeInTheDocument();
  });

  test('produkty zawiodły, a menu sieci jeszcze się wczytują: wiersz stanu mówi o menu — bez „Spróbuj ponownie”, póki nie nazwie błędu', async () => {
    menus.status = 'loading';
    failProducts('Nie udało się pobrać danych produktów (HTTP 404).');
    osm.state = osmState({ status: 'ready', items: [...PLACES, ...SHOPS], completeWithin: 1000 });
    const view = renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Wczytuję menu sieci…')).toHaveAttribute('role', 'status');
    await waitFor(() => expect(loadDataset).toHaveBeenCalled());
    await act(async () => {}); // nieudana baza już na stronie
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
    // Menu przyszły: teraz wiersz stanu nazywa błąd produktów, a przycisk jest.
    menus.status = 'ready';
    renderAgain(view);
    expect(await screen.findByText('Nie udało się wczytać produktów sklepów.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
  });

  test('wersja aplikacji bez bazy produktów: sklepy po prostu bez gotowego jedzenia — liczby od razu, bez błędu i bez „Spróbuj ponownie”', async () => {
    failProducts(MISSING_DATA_MESSAGE);
    osm.state = osmState({ status: 'ready', items: [...PLACES, ...SHOPS], completeWithin: 1000 });
    renderWithBridge(<NearbyPage />);
    // McDonald's i Salad Story z menu; Bar u Zdzisia, Biedronka, Lidl i Sklep u Ani bez danych.
    expect(
      await screen.findByText(/^W promieniu 1 km: 2 miejsca z menu, w tym \d z czymś na teraz, i 4 bez danych o menu\.$/),
    ).toHaveAttribute('role', 'status');
    expect(screen.queryByText('Nie udało się wczytać produktów sklepów.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
  });
});

describe('„Zjedz teraz”, gdy menu sieci się nie wczytały', () => {
  // Przycisk woła ponowienie menu (`useRestaurants().retry`): to próbuje na miejscu, a gdy przeglądarka
  // trzyma nieudany import (Chromium, WebKit), przeładowuje stronę — sprawdza to useRestaurants.test.
  test('wiersz stanu mówi to, zamiast radzić większy promień, a „Spróbuj ponownie” ponawia menu', async () => {
    const user = userEvent.setup();
    menus.status = 'error';
    osm.state = osmState({ status: 'ready', completeWithin: 1000 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Nie udało się wczytać menu sieci.')).toHaveAttribute('role', 'status');
    // Ani w wierszu stanu, ani pod pustą listą: bez menu sieci większy promień nic nie da.
    expect(screen.queryByText(/zwiększ promień/i)).toBeNull();
    const reload = spyReload();
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(menus.retry).toHaveBeenCalledTimes(1);
    expect(osm.retry).not.toHaveBeenCalled();
    // Sam widok nie przeładowuje: o tym decyduje ponowienie menu.
    expect(reload).not.toHaveBeenCalled();
  });

  test('zawiodły i lokale, i menu: wiersz stanu mówi o lokalach, a jeden przycisk ponawia oba', async () => {
    const user = userEvent.setup();
    menus.status = 'error';
    osm.state = osmState({ status: 'error', error: 'Nie udało się pobrać danych okolicy.', items: [], completeWithin: 0 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Nie udało się pobrać danych okolicy.')).toHaveAttribute('role', 'status');
    const retries = screen.getAllByRole('button', { name: 'Spróbuj ponownie' });
    expect(retries).toHaveLength(1);
    await user.click(retries[0]!);
    expect(osm.retry).toHaveBeenCalledTimes(1);
    expect(menus.retry).toHaveBeenCalledTimes(1);
  });
});

describe('„Zakupy i przepisy”: pod pustą listą przepisów', () => {
  const empty = () => within(screen.getByRole('region', { name: 'Przepisy z najbliższych sklepów' }));

  test('póki sklepy się wczytują: poczekać — bez rady o promieniu, której jeszcze nie ma po co dawać', async () => {
    window.history.replaceState(null, '', '#/w-poblizu?widok=sklepy');
    osm.state = osmState({ items: [], completeWithin: 0 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Tu jeszcze nic – poczekaj na sklepy.')).toBeInTheDocument();
    expect(screen.queryByText(/zwiększ promień/i)).toBeNull();
  });

  test('po błędzie: nic — mówią o nim wiersz stanu i „Spróbuj ponownie”', async () => {
    window.history.replaceState(null, '', '#/w-poblizu?widok=sklepy');
    osm.state = osmState({ status: 'error', error: 'Nie udało się pobrać danych okolicy.', items: [], completeWithin: 0 });
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText('Nie udało się pobrać danych okolicy.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
    expect(empty().queryByText(/poczekaj|zwiększ promień/i)).toBeNull();
  });

  test('lista ostateczna: większy promień', async () => {
    window.history.replaceState(null, '', '#/w-poblizu?widok=sklepy');
    osm.state = osmState({ status: 'ready', items: [], completeWithin: 1000 });
    renderWithBridge(<NearbyPage />);
    await screen.findByTestId('shops');
    expect(empty().getByText('Nic do pokazania – zwiększ promień.')).toBeInTheDocument();
    expect(screen.queryByText(/poczekaj na sklepy/)).toBeNull();
  });
});

describe('przypis pod mapą nazywa, czyje lokale i sklepy są na ekranie', () => {
  const credit = () => screen.getByText(/^Lokale i sklepy:/);

  /** `check` w obu widokach: najpierw „Zjedz teraz”, potem „Zakupy i przepisy”. */
  async function inBothViews(check: (what: string) => void) {
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    await screen.findByText(/^Lokale i sklepy:/);
    check('lokale');
    await user.click(screen.getByRole('button', { name: 'Zakupy i przepisy' }));
    await screen.findByTestId('shops');
    check('sklepy');
  }

  test.each([
    ['dane aplikacji', { source: 'static', shown: 'static', status: 'ready' }],
    ['przy granicy, póki na ekranie polska strona z danych aplikacji', { source: 'mixed', shown: 'static', coverage: 'partial' }],
  ] as const)('%s: ich data', async (_, over) => {
    osm.state = osmState({ ...over, items: [...PLACES, ...SHOPS], completeWithin: 1000 });
    // Dzień tej chwili tam, gdzie jest urządzenie: od UTC+4 to już 23 października.
    const day = dataDate(AS_OF);
    expect(day).toMatch(/^2[23] października 2026$/);
    await inBothViews(() => {
      expect(credit()).toHaveTextContent(`stan z ${day}`);
      expect(credit()).not.toHaveTextContent('Overpass');
      expect(within(credit()).getByRole('link', { name: 'licencja ODbL' })).toBeInTheDocument();
    });
  });

  test.each([
    ['za granicą', { source: 'live', coverage: 'none' }],
    ['przy granicy, gdy na ekranie cała odpowiedź Overpass', { source: 'mixed', coverage: 'partial', status: 'ready' }],
  ] as const)('%s: serwer Overpass, bez „na żywo” i bez daty danych aplikacji', async (_, over) => {
    osm.state = osmState({ ...over, shown: 'live', items: [...PLACES, ...SHOPS], completeWithin: 1000 });
    await inBothViews(() => {
      expect(credit()).toHaveTextContent('z serwera Overpass');
      expect(credit()).not.toHaveTextContent('na żywo');
      expect(credit()).not.toHaveTextContent('stan z');
      expect(within(credit()).getByRole('link', { name: 'licencja ODbL' })).toBeInTheDocument();
    });
  });

  test('przy granicy, gdy na ekranie zapisana odpowiedź Overpass: serwer Overpass, a jej wiek mówi wiersz stanu', async () => {
    osm.state = osmState({
      source: 'mixed',
      shown: 'live',
      coverage: 'partial',
      status: 'error',
      error: 'Serwer map jest przeciążony.',
      savedAt: Date.now() - 3 * DAY,
      items: [...PLACES, ...SHOPS],
      completeWithin: 1000,
    });
    await inBothViews((what) => {
      expect(credit()).toHaveTextContent('z serwera Overpass');
      expect(credit()).not.toHaveTextContent('na żywo');
      expect(credit()).not.toHaveTextContent('stan z');
      expect(screen.getByText(`Serwer map jest przeciążony. Pokazuję ${what} zapisane 3 dni temu.`)).toHaveAttribute('role', 'status');
    });
  });
});
