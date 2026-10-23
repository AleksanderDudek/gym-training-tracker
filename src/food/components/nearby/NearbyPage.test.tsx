// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import type { LatLon, PlacedShop } from '../../nearby/types';
import { DATASET, INDEXED } from '../../test/fixtures';
import NearbyPage from './NearbyPage';

// Leaflet potrzebuje prawdziwego silnika układu; mapę zastępuje atrapa, która wypisuje, co
// dostała, i umie „kliknąć” miejsce albo wybrać sieć z dymka — jak w teście Produktów PL.
vi.mock('./StoreMap', () => ({
  StoreMap: (props: {
    shops: PlacedShop[];
    onPick: (p: LatLon) => void;
    onSelectChain: (c: string | null) => void;
    onViewChange?: (c: LatLon) => void;
  }) => (
    <div data-testid="map">
      <span>{props.shops.map((s) => s.chain).join(',')}</span>
      <button type="button" onClick={() => props.onPick({ lat: 52.2297, lon: 21.0122 })}>
        kliknij mapę
      </button>
      <button type="button" onClick={() => props.onPick({ lat: 52.2797, lon: 21.0122 })}>
        kliknij daleko
      </button>
      <button type="button" onClick={() => props.onSelectChain('lidl')}>
        dymek Lidla
      </button>
      <button type="button" onClick={() => props.onViewChange?.({ lat: 52.2297, lon: 21.0122 })}>
        przesuń mapę
      </button>
    </div>
  ),
}));

// Ponowienia bez przerw: test mówi o tym, co strona pokazuje, a nie o tym, ile czeka zajęty serwer.
vi.mock('../../nearby/live', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../nearby/live')>();
  return {
    ...actual,
    fetchOsm: (...[center, radius, options]: Parameters<typeof actual.fetchOsm>) =>
      actual.fetchOsm(center, radius, { ...options, retryDelayMs: 0 }),
  };
});

vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

const LOADED: LoadedDataset = { dataset: DATASET, products: INDEXED };

const HERE = { lat: 52.2297, lon: 21.0122 };
const OVERPASS = {
  version: 0.6,
  elements: [
    {
      type: 'node',
      id: 1,
      lat: HERE.lat + 0.0027,
      lon: HERE.lon,
      tags: { shop: 'supermarket', brand: 'Biedronka', name: 'Biedronka', 'addr:street': 'Marszałkowska', 'addr:housenumber': '10' },
    },
    { type: 'node', id: 2, lat: HERE.lat + 0.0072, lon: HERE.lon, tags: { shop: 'supermarket', brand: 'Lidl', name: 'Lidl' } },
    { type: 'node', id: 3, lat: HERE.lat + 0.0009, lon: HERE.lon, tags: { shop: 'convenience', name: 'Sklep u Ani' } },
  ],
};

let overpassCalls = 0;
let overpassFails = false;
let overpassBodies: string[] = [];
/** Gdy ustawiona, Overpass odpowiada dopiero po jej spełnieniu (powolne zapytanie o 10 km). */
let overpassGate: Promise<void> | null = null;

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

function grantLocation(granted: boolean) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) =>
        granted
          ? ok({ coords: { latitude: HERE.lat, longitude: HERE.lon } } as GeolocationPosition)
          : fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  // Te testy są o widoku „Zakupy i przepisy”; „Zjedz teraz” ma własne (EatNow.test.tsx).
  window.localStorage.setItem('produkty-pl:nearby-view', 'shops');
  window.history.replaceState(null, '', '#/w-poblizu');
  vi.mocked(loadDataset).mockReset();
  vi.mocked(loadedDataset).mockReset();
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
  overpassCalls = 0;
  overpassFails = false;
  overpassBodies = [];
  overpassGate = null;
  grantLocation(true);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      overpassCalls++;
      overpassBodies.push(String(init?.body));
      if (overpassGate) await overpassGate;
      return overpassFails ? new Response('<html>busy</html>', { status: 504 }) : json(OVERPASS);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function cardFor(name: string): HTMLElement {
  const card = screen.getByRole('heading', { level: 3, name }).closest('article');
  if (!card) throw new Error(`Brak karty ${name}`);
  return card;
}

describe('W pobliżu', () => {
  test('znajduje sklepy wokół i pokazuje przepisy z najbliższym sklepem, który ma wszystko', async () => {
    render(<NearbyPage />);
    expect(await screen.findByText(/W promieniu 1 km: 2 sklepy z danymi o produktach i 1 inny\./)).toBeInTheDocument();
    expect(
      within(cardFor('Skyr z białkiem i malinami')).getByText('Wszystko kupisz w: Biedronka · 300 m · Marszałkowska 10'),
    ).toBeInTheDocument();
    expect(within(cardFor('Białko z wodą')).getByText('Składniki są w każdym sklepie')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('biedronka,lidl');
  });

  test('mniejszy promień odrzuca dalszy sklep bez nowego pytania serwera', async () => {
    render(<NearbyPage />);
    await screen.findByText(/2 sklepy z danymi/);
    fireEvent.change(screen.getByRole('slider', { name: 'Promień' }), { target: { value: '0' } });
    expect(await screen.findByText(/W promieniu 500 m: 1 sklep z danymi/)).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent(/^biedronkakliknij/);
    expect(overpassCalls).toBe(1);
    expect(window.location.hash).toBe('#/w-poblizu?r=500');
    // Promień zostaje na tym urządzeniu na następną wizytę.
    expect(window.localStorage.getItem('produkty-pl:radius')).toBe('500');
  });

  test('przyciski przy suwaku zmieniają promień o jeden stopień', async () => {
    const user = userEvent.setup();
    render(<NearbyPage />);
    await screen.findByText(/2 sklepy z danymi/);
    await user.click(screen.getByRole('button', { name: 'Większy promień' }));
    expect(window.location.hash).toBe('#/w-poblizu?r=1500');
    expect(screen.getByRole('slider', { name: 'Promień' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/^1,5\skm$/));
    await user.click(screen.getByRole('button', { name: 'Mniejszy promień' }));
    await user.click(screen.getByRole('button', { name: 'Mniejszy promień' }));
    expect(window.location.hash).toBe('#/w-poblizu?r=500');
    // Na końcu skali przycisk jest nieczynny, ale zostaje w kolejce Tab.
    expect(screen.getByRole('button', { name: 'Mniejszy promień' })).toHaveAttribute('aria-disabled', 'true');
  }, 15_000);

  test('bez zgody na lokalizację kliknięcie w mapę ustawia miejsce', async () => {
    grantLocation(false);
    const user = userEvent.setup();
    render(<NearbyPage />);
    expect(await screen.findByText(/Brak zgody na lokalizację/)).toBeInTheDocument();
    expect(screen.getByText('Najpierw ustal, gdzie jesteś.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'kliknij mapę' }));
    expect(await screen.findByText(/2 sklepy z danymi/)).toBeInTheDocument();
  }, 15_000);

  test('„Ustaw środek mapy jako moją lokalizację” bierze środek oglądanego fragmentu', async () => {
    grantLocation(false);
    const user = userEvent.setup();
    render(<NearbyPage />);
    expect(await screen.findByText(/Brak zgody na lokalizację/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'przesuń mapę' }));
    await user.click(screen.getByRole('button', { name: 'Ustaw środek mapy jako moją lokalizację' }));
    expect(await screen.findByText(/2 sklepy z danymi/)).toBeInTheDocument();
    // Miejsce zostaje tylko na tym urządzeniu (zaokrąglone do ok. 10 m), nigdy w adresie.
    expect(JSON.parse(window.localStorage.getItem('produkty-pl:position') ?? 'null')).toEqual(HERE);
    expect(window.location.href).not.toMatch(/52\.2|21\.0/);
  });

  test('przeciążony serwer map mówi o tym i daje spróbować ponownie', async () => {
    overpassFails = true;
    const user = userEvent.setup();
    render(<NearbyPage />);
    expect(await screen.findByText(/przeciążony/, {}, { timeout: 4000 })).toBeInTheDocument();
    overpassFails = false;
    await user.click(screen.getByRole('button', { name: /Spróbuj ponownie/ }));
    expect(await screen.findByText(/2 sklepy z danymi/, {}, { timeout: 4000 })).toBeInTheDocument();
  }, 15_000);

  test('przy zajętym serwerze zostają sklepy zapisane wcześniej na tym urządzeniu — z ich wiekiem i ponowieniem', async () => {
    // Odpowiedź sprzed dwóch dni dla tego miejsca (zaokrąglony środek i margines, jak zapisuje strona).
    const twoDaysAgo = Date.now() - 2 * 24 * 3600 * 1000;
    const elements = [OVERPASS.elements[0]!];
    window.localStorage.setItem(
      'produkty-pl:osm',
      JSON.stringify([{ lat: 52.23, lon: 21.012, radius: 1250, fetchedAt: twoDaysAgo, shops: elements }]),
    );
    overpassFails = true;
    render(<NearbyPage />);
    expect(await screen.findByText(/przeciążony\. Pokazuję sklepy zapisane przedwczoraj\./, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent(/^biedronka/);
    expect(await screen.findByText(/^Ponowię sam za (30|29) s\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spróbuj ponownie/ })).toBeInTheDocument();
  }, 15_000);

  test('sklepy nie czekają na bazę produktów: zapytanie idzie od wejścia na stronę', async () => {
    vi.mocked(loadedDataset).mockReturnValue(null);
    vi.mocked(loadDataset).mockReturnValue(new Promise(() => {}));
    render(<NearbyPage />);
    await waitFor(() => expect(overpassCalls).toBe(1));
  });

  test('pełna odpowiedź zostawia sklepy z okolicy dla podpowiedzi dziennika', async () => {
    window.localStorage.setItem('produkty-pl:places', '[]');
    render(<NearbyPage />);
    await screen.findByText(/2 sklepy z danymi/);
    await waitFor(() => expect(window.localStorage.getItem('produkty-pl:shops')).not.toBeNull());
    const [entry] = JSON.parse(window.localStorage.getItem('produkty-pl:shops')!) as { shops: { chain: string }[] }[];
    expect(entry!.shops.map((s) => s.chain)).toEqual(['biedronka', 'lidl', 'sklep-u-ani']);
    // Dawna pamięć „Zjedz teraz” (inny kształt) znika przy pierwszej wizycie.
    expect(window.localStorage.getItem('produkty-pl:places')).toBeNull();
  });

  test('żeton sieci zawęża przepisy do tej sieci', async () => {
    const user = userEvent.setup();
    render(<NearbyPage />);
    const chips = await screen.findByRole('group', { name: 'Sieci w pobliżu' });
    await user.click(within(chips).getByRole('button', { name: /Lidl/ }));
    expect(window.location.hash).toBe('#/w-poblizu?sklep=lidl');
    await waitFor(() =>
      expect(within(cardFor('Skyr z białkiem i malinami')).getByText(/Wszystko kupisz w: Lidl · 800 m/)).toBeInTheDocument(),
    );
  });

  test('„Pokaż te przepisy” z dymka wybiera sieć i przenosi do listy', async () => {
    const user = userEvent.setup();
    render(<NearbyPage />);
    await screen.findByText(/2 sklepy z danymi/);
    await user.click(screen.getByRole('button', { name: 'dymek Lidla' }));
    expect(window.location.hash).toBe('#/w-poblizu?sklep=lidl');
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: /Przepisy z najbliższych sklepów/ })).toHaveFocus());
  });

  test('pozycji nigdy nie ma w adresie', async () => {
    render(<NearbyPage />);
    await screen.findByText(/2 sklepy z danymi/);
    expect(window.location.href).not.toMatch(/52\.2|21\.0/);
  });

  test('zapytanie niesie pozycję zaokrągloną do ok. 100 m, nigdy dokładną', async () => {
    render(<NearbyPage />);
    await screen.findByText(/2 sklepy z danymi/);
    const query = new URLSearchParams(overpassBodies[0]).get('data') ?? '';
    expect(query).toContain('around:1250,52.23,21.012');
    expect(query).not.toContain('52.2297');
  });

  test('zapisane miejsce jest podpisane jako zapisane, dopóki nie przyjdzie świeże', async () => {
    window.localStorage.setItem('produkty-pl:position', JSON.stringify(HERE));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: () => {} } });
    render(<NearbyPage />);
    expect(await screen.findByText(/Pokazuję ostatnio zapisane miejsce, szukam aktualnej lokalizacji/)).toBeInTheDocument();
  });

  test('po przeprowadzce sklepy ze starego miejsca znikają, gdy nowe zapytanie zawiedzie', async () => {
    const user = userEvent.setup();
    render(<NearbyPage />);
    await screen.findByText(/2 sklepy z danymi/);
    overpassFails = true;
    await user.click(screen.getByRole('button', { name: 'kliknij daleko' }));
    expect(await screen.findByText(/przeciążony/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('map').firstChild).toHaveTextContent(/^$/);
    expect(screen.queryByRole('heading', { level: 3, name: 'Skyr z białkiem i malinami' })).not.toBeInTheDocument();
  }, 15_000);

  test('większy promień zostawia to, co już znalezione, póki szersze szukanie trwa — i mówi o tym', async () => {
    render(<NearbyPage />);
    await screen.findByText(/W promieniu 1 km: 2 sklepy/);
    let release!: () => void;
    overpassGate = new Promise((resolve) => (release = resolve));
    fireEvent.change(screen.getByRole('slider', { name: 'Promień' }), { target: { value: '5' } }); // 5 km
    expect(await screen.findByText(/Szukam sklepów w promieniu 5 km/)).toBeInTheDocument();
    expect(screen.getByText(/na razie: 2 sklepy w promieniu 1/)).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent(/^biedronka,lidl/);
    expect(screen.getByRole('heading', { level: 3, name: 'Skyr z białkiem i malinami' })).toBeInTheDocument();
    release();
    expect(await screen.findByText(/W promieniu 5 km: 2 sklepy/)).toBeInTheDocument();
  }, 15_000);

  test('gotowe produkty z tych sklepów otwierają kartę produktu w adresie', async () => {
    const user = userEvent.setup();
    render(<NearbyPage />);
    const ready = await screen.findByRole('region', { name: 'Gotowe produkty białkowe w tych sklepach' });
    await user.click(within(ready).getByRole('button', { name: 'Skyr naturalny' }));
    expect(await screen.findByRole('dialog', { name: 'Skyr naturalny' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/w-poblizu?p=2');
  });

  test('uwaga o prywatności mówi, dokąd idzie pozycja i gdzie zostaje', async () => {
    render(<NearbyPage />);
    await screen.findByText(/2 sklepy z danymi/);
    const note = screen.getByText(/zaokrąglona do ok\. 100 m/);
    expect(note).toHaveTextContent('overpass-api.de');
    expect(note).toHaveTextContent('overpass.private.coffee');
    expect(note).toHaveTextContent('tile.openstreetmap.org');
    expect(note).toHaveTextContent('Pozycji nie ma w adresie strony, a ostatnie miejsce zostaje tylko na tym urządzeniu.');
  });
});
