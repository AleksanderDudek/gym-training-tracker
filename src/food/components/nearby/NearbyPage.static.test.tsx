// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { clearAll } from '../../diet/store';
import type { RankedPlace } from '../../nearby/eat';
import type { LatLon, PlacedShop } from '../../nearby/types';
import { renderWithBridge } from '../../test/bridge';
import { DATASET, INDEXED } from '../../test/fixtures';
import { boxCoverage, osmResponse, osmRow, osmTestData, type OsmTestData } from '../../test/osm';
import NearbyPage from './NearbyPage';

// Ta kompilacja „ma” dane OSM — pod Vitestem domyślnie ich nie ma, żeby reszta testów sprawdzała Overpass.
vi.mock('virtual:osm-places', () => ({ default: { index: 'data/osm/v1/index.json' } }));

vi.mock('./PlaceMap', () => ({
  PlaceMap: (props: { places: RankedPlace[] }) => <div data-testid="pins">{props.places.map((p) => p.place.name).join(',')}</div>,
}));
vi.mock('./StoreMap', () => ({
  StoreMap: (props: { shops: PlacedShop[] }) => <div data-testid="shops">{props.shops.map((s) => s.chain).join(',')}</div>,
}));

vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

// Ponowienia bez przerw, gdyby Overpass był potrzebny.
vi.mock('../../nearby/live', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../nearby/live')>();
  return {
    ...actual,
    fetchOsm: (...[center, radius, options]: Parameters<typeof actual.fetchOsm>) =>
      actual.fetchOsm(center, radius, { ...options, retryDelayMs: 0 }),
  };
});

const LOADED: LoadedDataset = { dataset: DATASET, products: INDEXED };
const HERE = { lat: 52.2297, lon: 21.0122 };
const north = (m: number) => HERE.lat + m / 111_000;
/** Polska w teście: prostokąt wokół Warszawy (granica ~2 km na północ od pozycji „przy granicy”). */
const POLAND = boxCoverage(51.5, 20, 52.6, 22);
const BERLIN = { lat: 52.52, lon: 13.405 };
const AT_BORDER = { lat: 52.59, lon: 21.0122 };

const ROWS = [
  osmRow('n10', north(200), HERE.lon, { amenity: 'fast_food', brand: "McDonald's", name: "McDonald's", opening_hours: '24/7' }),
  osmRow('n11', north(400), HERE.lon, { amenity: 'restaurant', brand: 'Salad Story', name: 'Salad Story', opening_hours: 'Mo-Su 10:00-21:00' }),
  osmRow('n12', north(150), HERE.lon, { shop: 'convenience', brand: 'Żabka', name: 'Żabka', opening_hours: 'Mo-Sa 06:00-23:00' }),
  osmRow('n13', north(100), HERE.lon, { amenity: 'restaurant', name: 'Bar u Zdzisia', cuisine: 'polish' }),
  osmRow('n1', HERE.lat + 0.0027, HERE.lon, { shop: 'supermarket', brand: 'Biedronka', name: 'Biedronka', 'addr:street': 'Marszałkowska', 'addr:housenumber': '10' }),
  osmRow('n2', HERE.lat + 0.0072, HERE.lon, { shop: 'supermarket', brand: 'Lidl', name: 'Lidl' }),
  osmRow('n20', AT_BORDER.lat - 0.002, AT_BORDER.lon, { amenity: 'fast_food', brand: "McDonald's", name: "McDonald's Polska strona" }),
];
const OVERPASS_BERLIN = {
  elements: [{ type: 'node', id: 99, lat: BERLIN.lat + 0.002, lon: BERLIN.lon, tags: { amenity: 'fast_food', brand: "McDonald's", name: "McDonald's Berlin" } }],
};
/** Odpowiedź dla koła przy granicy: lokal ~0,9 km na północ, za zasięgiem danych aplikacji. */
const OVERPASS_BORDER = {
  elements: [{ type: 'node', id: 98, lat: AT_BORDER.lat + 0.008, lon: AT_BORDER.lon, tags: { amenity: 'fast_food', brand: "McDonald's", name: "McDonald's z Overpass" } }],
};

let data: OsmTestData;
let requests: string[];
let overpassAnswer: object;
/** Gdy ustawiona, Overpass odpowiada dopiero po jej spełnieniu. */
let overpassGate: Promise<void> | null;

function placeAt(position: LatLon) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: position.lat, longitude: position.lon } } as GeolocationPosition) },
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 22, 13, 0));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '#/w-poblizu');
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
  data = osmTestData(ROWS, POLAND, 3);
  requests = [];
  overpassAnswer = OVERPASS_BERLIN;
  overpassGate = null;
  placeAt(HERE);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(String(url));
      if (String(url).includes('overpass')) {
        if (overpassGate) await overpassGate;
        return new Response(JSON.stringify(overpassAnswer), { headers: { 'content-type': 'application/json' } });
      }
      return osmResponse(data, String(url)) ?? new Response('?', { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const overpassAsked = () => requests.filter((u) => u.includes('overpass')).length;

describe('„W pobliżu” z danych OSM dołączonych do aplikacji', () => {
  test('w Polsce oba widoki z danych aplikacji, bez jednego zapytania do Overpass; data danych w stopce', async () => {
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    expect(await screen.findByText(/W promieniu 1 km: \d+ (miejsce|miejsca|miejsc) z menu/)).toBeInTheDocument();
    expect(screen.getByTestId('pins')).toHaveTextContent("McDonald's");
    expect(screen.getByText(/Lokale i sklepy:/)).toHaveTextContent('stan z 22 października 2026');
    expect(screen.getByRole('link', { name: '© autorzy OpenStreetMap' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    expect(screen.getByRole('link', { name: 'licencja ODbL' })).toHaveAttribute('href', expect.stringMatching(/data\/osm\/v1\/LICENSE\.txt$/));
    await user.click(screen.getByRole('button', { name: 'Zakupy i przepisy' }));
    expect(await screen.findByText(/W promieniu 1 km: 2 sklepy z danymi/)).toBeInTheDocument();
    expect(screen.getByTestId('shops')).toHaveTextContent('biedronka,lidl');
    expect(overpassAsked()).toBe(0);
    // Pliki z mapy: tylko te wokół pozycji, a pozycja — zaokrąglona — nie stoi w żadnym adresie.
    expect(requests.every((u) => !/52\.2297|21\.0122/.test(u))).toBe(true);
  }, 15_000);

  test('za granicą pyta Overpass jednym zapytaniem dla obu widoków i mówi, skąd dane', async () => {
    placeAt(BERLIN);
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    await waitFor(() => expect(overpassAsked()).toBe(1));
    const credit = await screen.findByText(/Lokale i sklepy:/);
    expect(credit).toHaveTextContent('z serwera Overpass');
    // Bez „na żywo”: na ekranie bywa też odpowiedź zapisana dni temu (jej wiek mówi wiersz stanu).
    expect(credit).not.toHaveTextContent('na żywo');
    expect(credit).not.toHaveTextContent('stan z');
    await waitFor(() => expect(screen.getByTestId('pins')).toHaveTextContent("McDonald's Berlin"));
    await user.click(screen.getByRole('button', { name: 'Zakupy i przepisy' }));
    await screen.findByTestId('shops');
    expect(overpassAsked()).toBe(1);
  }, 15_000);

  test('przy granicy: polska strona od razu z danych aplikacji, reszta koła z Overpass — przypis mówi, czyje lokale widać', async () => {
    placeAt(AT_BORDER);
    overpassAnswer = OVERPASS_BORDER;
    let release!: () => void;
    overpassGate = new Promise((resolve) => (release = resolve));
    renderWithBridge(<NearbyPage />);
    await waitFor(() => expect(overpassAsked()).toBe(1));
    await waitFor(() => expect(screen.getByTestId('pins')).toHaveTextContent("McDonald's Polska strona"));
    const credit = screen.getByText(/Lokale i sklepy:/);
    expect(credit).toHaveTextContent('stan z 22 października 2026');
    expect(credit).not.toHaveTextContent('Overpass');
    expect(within(credit).getByRole('link', { name: 'licencja ODbL' })).toBeInTheDocument();
    // Odpowiedź Overpass zastępuje polską stronę: data danych aplikacji już do niczego na ekranie nie pasuje.
    release();
    await waitFor(() => expect(screen.getByTestId('pins')).toHaveTextContent("McDonald's z Overpass"));
    expect(credit).toHaveTextContent('z serwera Overpass');
    expect(credit).not.toHaveTextContent('stan z');
    expect(within(credit).getByRole('link', { name: 'licencja ODbL' })).toBeInTheDocument();
  }, 15_000);
});
