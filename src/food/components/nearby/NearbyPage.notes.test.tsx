// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { clearAll } from '../../diet/store';
import type { OsmState } from '../../hooks/useOsmAround';
import type { RestaurantsResult } from '../../hooks/useRestaurants';
import type { RankedPlace } from '../../nearby/eat';
import type { Element } from '../../nearby/overpass';
import type { PlacedShop } from '../../nearby/types';
import { renderWithBridge } from '../../test/bridge';
import { DATASET, INDEXED } from '../../test/fixtures';
import NearbyPage from './NearbyPage';

// Stan danych okolicy jest dany, a nie pobierany: te testy są o tym, co strona z nim mówi (uwaga
// „Na razie” i przypis pod mapą), a nie o tym, jak powstaje — to sprawdzają testy `useOsmAround`.
const osm = vi.hoisted(() => ({ state: null as unknown as OsmState }));
vi.mock('../../hooks/useOsmAround', () => ({ useOsmAround: () => [osm.state, () => {}] }));

// Menu sieci prawdziwe, chyba że test każe im się dalej wczytywać albo zawieść.
const menus = vi.hoisted(() => ({ status: 'ready' as 'ready' | 'loading' | 'error' }));
vi.mock('../../hooks/useRestaurants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useRestaurants')>();
  return {
    ...actual,
    useRestaurants: (): RestaurantsResult => {
      const real = actual.useRestaurants();
      return menus.status === 'ready' ? real : { status: menus.status, retry: real.retry };
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
    dataAsOf: '2026-10-22T20:21:33Z',
    olderLeaves: false,
    ...over,
  };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 22, 13, 0));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '#/w-poblizu');
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
  menus.status = 'ready';
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: HERE.lat, longitude: HERE.lon } } as GeolocationPosition) },
  });
});

afterEach(() => {
  vi.useRealTimers();
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
  test('„Zakupy i przepisy”: liczy tylko sklepy z promienia, który podaje', async () => {
    window.history.replaceState(null, '', '#/w-poblizu?widok=sklepy&r=5000');
    osm.state = osmState({ items: SHOPS });
    renderWithBridge(<NearbyPage />);
    const note = await screen.findByText(/^Na razie:/);
    // Lidl dalej jest w pełnej części listy (na mapie też), ale nie w 1,2 km.
    expect(screen.getByTestId('shops')).toHaveTextContent('Lidl dalej');
    expect(note).toHaveTextContent('Na razie: 2 sklepy w promieniu 1,2 km.');
    expectOutsideLiveRegions(note, 'Szukam sklepów w promieniu 5 km…');
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
    await inBothViews(() => {
      expect(credit()).toHaveTextContent('stan z 22 października 2026');
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
