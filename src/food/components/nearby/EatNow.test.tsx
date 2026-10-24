// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { db } from '../../diet/db';
import { clearAll, completeProfile, logQuick, saveProfile } from '../../diet/store';
import type { RankedPlace } from '../../nearby/eat';
import type { LatLon } from '../../nearby/types';
import { renderWithBridge, testBridge, testMove } from '../../test/bridge';
import { DATASET, INDEXED } from '../../test/fixtures';
import NearbyPage from './NearbyPage';

// Leaflet potrzebuje prawdziwego układu; mapę zastępuje atrapa, która wypisuje pinezki (z numerami
// pierwszej trójki) i umie otworzyć kartę miejsca jak przycisk w dymku.
vi.mock('./PlaceMap', () => ({
  PlaceMap: (props: { places: RankedPlace[]; top: string[]; onOpen: (id: string) => void; onPick: (p: LatLon) => void }) => (
    <div data-testid="map">
      <span data-testid="pins">{props.places.map((p) => p.place.name).join(',')}</span>
      <span data-testid="top">{props.top.join(',')}</span>
      {props.places.map((p) => (
        <button key={p.place.id} type="button" onClick={() => props.onOpen(p.place.id)}>
          dymek {p.place.name}
        </button>
      ))}
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

// „Zakupy i przepisy” w teście przełączania: mapa sklepów też bez Leafleta.
vi.mock('./StoreMap', () => ({ StoreMap: () => <div data-testid="store-map" /> }));

vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

const LOADED: LoadedDataset = { dataset: DATASET, products: INDEXED };
const HERE = { lat: 52.2297, lon: 21.0122 };
const north = (m: number) => HERE.lat + m / 111_000;

/** 2026-10-22 13:00, czwartek: KFC (10–11) już zamknięte, reszta otwarta. */
const OVERPASS = {
  version: 0.6,
  elements: [
    { type: 'node', id: 10, lat: north(200), lon: HERE.lon, tags: { amenity: 'fast_food', brand: "McDonald's", name: "McDonald's", opening_hours: '24/7' } },
    { type: 'node', id: 11, lat: north(400), lon: HERE.lon, tags: { amenity: 'restaurant', brand: 'Salad Story', name: 'Salad Story', 'addr:street': 'Złota', 'addr:housenumber': '59', opening_hours: 'Mo-Su 10:00-21:00' } },
    { type: 'node', id: 12, lat: north(150), lon: HERE.lon, tags: { shop: 'convenience', brand: 'Żabka', name: 'Żabka', opening_hours: 'Mo-Sa 06:00-23:00' } },
    { type: 'node', id: 13, lat: north(100), lon: HERE.lon, tags: { amenity: 'restaurant', name: 'Bar u Zdzisia', cuisine: 'polish' } },
    { type: 'node', id: 14, lat: north(300), lon: HERE.lon, tags: { amenity: 'fast_food', brand: 'KFC', name: 'KFC', opening_hours: 'Mo-Su 10:00-11:00' } },
  ],
};

let requests: string[] = [];
let overpassBusy = false;

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 22, 13, 0));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '#/w-poblizu');
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
  requests = [];
  overpassBusy = false;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: HERE.lat, longitude: HERE.lon } } as GeolocationPosition) },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(String(url));
      if (String(url).includes('nominatim'))
        return json([{ lat: '54.3485', lon: '18.6533', display_name: 'Długa, Główne Miasto, Gdańsk, pomorskie, Polska' }]);
      return overpassBusy ? new Response('at capacity', { status: 502 }) : json(OVERPASS);
    }),
  );
  await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75 }));
  await logQuick('2026-10-22', 'Śniadanie', 600, { protein: 40, carbs: 60, fat: 20 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Zjedz teraz', () => {
  test('the answer first: what this meal should be and the best pick; closed and unknown places hidden', async () => {
    renderWithBridge(<NearbyPage />);
    const answer = await screen.findByRole('region', { name: 'Na teraz' });
    // 2000 − 600 = 1400 kcal left; at 13:00 three meals are ahead.
    expect(await within(answer).findByText(/ok\. 470 kcal i \d+ g białka na ten posiłek — zostało 1400 kcal na 3 posiłki\./)).toBeInTheDocument();
    await waitFor(() => expect(within(answer).getByRole('button', { name: /Najlepiej:/ })).toBeInTheDocument());
    // KFC has a menu but is closed now: counted, not shown.
    expect(await screen.findByText('W promieniu 1 km: 4 miejsca z menu, w tym 4 z czymś na teraz, i 1 bez danych o menu.')).toBeInTheDocument();
    const pins = screen.getByTestId('pins').textContent ?? '';
    expect(pins).toContain("McDonald's");
    expect(pins).toContain('Salad Story');
    expect(pins).not.toContain('KFC');
    expect(pins).not.toContain('Bar u Zdzisia');
    expect(screen.getByRole('button', { name: /zamknięte \(1\)/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /bez danych o menu \(1\)/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('15 000 steps and a long ride leave the budget as it is: activity never changes the target', async () => {
    const bridge = testBridge({
      stepsOn: () => 15_000,
      moveOn: () => testMove({ outings: 1 }),
    });
    renderWithBridge(<NearbyPage />, bridge);
    const answer = await screen.findByRole('region', { name: 'Na teraz' });
    // The same answer as without any activity: 2000 − 600 = 1400 left for three meals.
    expect(
      await within(answer).findByText('ok. 470 kcal i 37 g białka na ten posiłek — zostało 1400 kcal na 3 posiłki.'),
    ).toBeInTheDocument();
  });

  test('within 100 kcal of the target the day is enough already; without calorie counting the answer is protein only', async () => {
    await logQuick('2026-10-22', 'Obiad', 1390, { protein: 60, carbs: 150, fat: 40 });
    const enough = renderWithBridge(<NearbyPage />);
    const answer = await screen.findByRole('region', { name: 'Na teraz' });
    expect(
      await within(answer).findByText(
        /^Na dziś kalorii już wystarczy \(1990 z 2000 kcal\)\. Jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego\./,
      ),
    ).toBeInTheDocument();
    expect(within(answer).getByRole('button', { name: 'Pokaż najlżejsze' })).toBeInTheDocument();
    expect(answer).not.toHaveTextContent(/głodny|osiągnięty/);
    enough.unmount();

    await db.entries.clear();
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75, hideKcal: true }));
    // 45 g of protein eaten of 150: 105 g for the three meals ahead.
    await logQuick('2026-10-22', 'Śniadanie', 600, { protein: 45, carbs: 60, fat: 20 });
    renderWithBridge(<NearbyPage />);
    const plain = await screen.findByRole('region', { name: 'Na teraz' });
    expect(await within(plain).findByText('Na ten posiłek: coś z ok. 35 g białka.')).toBeInTheDocument();
    expect(plain).not.toHaveTextContent(/kcal/);
  }, 15_000);

  test('the three best under the map, numbered like the pins; sorting by protein is kept in the address', async () => {
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    const section = await screen.findByRole('region', { name: 'Najlepsze wybory na teraz' });
    await waitFor(() => expect(within(section).getAllByRole('listitem').length).toBeGreaterThan(0));
    expect(within(section).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
    expect(screen.getByTestId('top').textContent?.split(',').length).toBe(within(section).getAllByRole('listitem').length);
    await user.click(within(section).getByRole('button', { name: 'Najwięcej białka' }));
    expect(window.location.hash).toContain('sort=bialko');
  }, 15_000);

  test('the place card: where, open until, directions in the maps app, everything that fits and „Zjadłem”', async () => {
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    await user.click(await screen.findByRole('button', { name: 'dymek Salad Story' }));
    expect(window.location.hash).toContain('miejsce=node%2F11');
    const card = await screen.findByRole('dialog', { name: 'Salad Story' });
    expect(within(card).getByText(/Złota 59 · 400 m · 5 min pieszo/)).toBeInTheDocument();
    expect(within(card).getByText('otwarte do 21:00')).toBeInTheDocument();
    const go = within(card).getByRole('link', { name: /Prowadź/ });
    expect(go).toHaveAttribute('href', expect.stringMatching(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=52\.23330\d,21\.012200&travelmode=walking$/));
    expect(within(card).getByRole('heading', { name: 'Co tu zjesz' })).toBeInTheDocument();
    const eat = within(card).getAllByRole('button', { name: /^Zjadłem: / })[0]!;
    await user.click(eat);
    expect(await within(card).findByText(/^Zapisane w dzienniku: /)).toBeInTheDocument();
    expect(await db.entries.where('date').equals('2026-10-22').count()).toBe(2);
    expect(within(card).getByText(/Wartości z tabeli sieci Salad Story/)).toBeInTheDocument();
  }, 15_000);

  test('a place without menu data says so and still gives directions', async () => {
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    await user.click(await screen.findByRole('button', { name: /bez danych o menu \(1\)/ }));
    await user.click(await screen.findByRole('button', { name: 'dymek Bar u Zdzisia' }));
    const card = await screen.findByRole('dialog', { name: 'Bar u Zdzisia' });
    expect(within(card).getByText('Nie znam menu tego miejsca.')).toBeInTheDocument();
    expect(within(card).getByText('Kuchnia według OpenStreetMap: polish.')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Prowadź/ })).toBeInTheDocument();
  }, 15_000);

  test('a busy map server: places saved on this device two days ago stay on the map, with their age', async () => {
    window.localStorage.setItem(
      'produkty-pl:osm',
      JSON.stringify([{ lat: 52.23, lon: 21.012, radius: 1250, fetchedAt: Date.now() - 2 * 24 * 3600 * 1000, shops: OVERPASS.elements }]),
    );
    overpassBusy = true;
    renderWithBridge(<NearbyPage />);
    expect(
      await screen.findByText(/przeciążony\. Pokazuję lokale zapisane przedwczoraj\./, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('pins')).toHaveTextContent("McDonald's");
    // The answer is still worked out from them: the best pick is there.
    expect(within(screen.getByRole('region', { name: 'Na teraz' })).getByRole('button', { name: /Najlepiej:/ })).toBeInTheDocument();
    expect(await screen.findByText(/^Ponowię sam za \d+ s\.$/)).toBeInTheDocument();
  }, 15_000);

  test('switching to „Zakupy i przepisy” asks nothing new: both views share one answer', async () => {
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    await screen.findByText(/W promieniu 1 km: 4 miejsca z menu/);
    const asked = requests.filter((u) => u.includes('overpass')).length;
    expect(asked).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Zakupy i przepisy' }));
    expect(await screen.findByTestId('store-map')).toBeInTheDocument();
    expect(await screen.findByText(/W promieniu 1 km/)).toBeInTheDocument();
    expect(requests.filter((u) => u.includes('overpass')).length).toBe(asked);
  }, 15_000);

  test('a typed address becomes the position after the search is sent, never while typing', async () => {
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    await screen.findByText(/W promieniu 1 km/);
    await user.click(screen.getByText('Wpisz adres zamiast lokalizacji'));
    await user.type(screen.getByLabelText('Adres albo miejsce'), 'Długa Gdańsk');
    expect(requests.some((u) => u.includes('nominatim'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Szukaj' }));
    await user.click(await screen.findByRole('button', { name: 'Długa, Główne Miasto, Gdańsk' }));
    await waitFor(() => expect(requests.filter((u) => u.includes('overpass')).length).toBeGreaterThan(1));
    expect(window.location.hash).not.toMatch(/54\.3|18\.6/);
  }, 15_000);
});
