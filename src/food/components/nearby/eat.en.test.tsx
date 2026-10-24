// @vitest-environment jsdom
import { vi } from 'vitest';

// This file runs in English: the language is fixed when the i18n module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { clearAll, completeProfile, logQuick, saveProfile } from '../../diet/store';
import type { RankedPlace } from '../../nearby/eat';
import type { LatLon } from '../../nearby/types';
import { renderWithBridge } from '../../test/bridge';
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
      return json(OVERPASS);
    }),
  );
  await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75 }));
  await logQuick('2026-10-22', 'Śniadanie', 600, { protein: 40, carbs: 60, fat: 20 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Eat now (English visit)', () => {
  test('the answer, the list, the filters and the place card speak English', async () => {
    const user = userEvent.setup();
    renderWithBridge(<NearbyPage />);
    const answer = await screen.findByRole('region', { name: 'For now' });
    expect(await within(answer).findByText(/^about 470 kcal and \d+ g protein for this meal — 1,400 kcal left for 3 meals\.$/)).toBeInTheDocument();
    expect(await screen.findByText('Within 1 km: 4 places with a menu, 4 with something for now, and 1 without menu data.')).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Best choices for now' });
    for (const label of ['Best', 'Most protein', 'Nearest', 'Lightest']) expect(within(section).getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /closed \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('Type an address instead of your location')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'dymek Salad Story' }));
    const card = await screen.findByRole('dialog', { name: 'Salad Story' });
    expect(within(card).getByText(/400 m · 5 min walk/)).toBeInTheDocument();
    expect(within(card).getByText('open until 21:00')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Directions/ })).toBeInTheDocument();
    expect(within(card).getByRole('heading', { name: 'What you can eat here' })).toBeInTheDocument();
    // UI text in English; dish names are the chain's own Polish menu.
    for (const polish of ['Prowadź', 'Co tu zjesz', 'Zjadłem', 'pieszo', 'otwarte']) expect(card.textContent).not.toContain(polish);
  }, 15_000);

  test('enough for today, and the answer without calorie counting, in English', async () => {
    await logQuick('2026-10-22', 'Obiad', 1390, { protein: 60, carbs: 150, fat: 40 });
    const enough = renderWithBridge(<NearbyPage />);
    const answer = await screen.findByRole('region', { name: 'For now' });
    expect(
      await within(answer).findByText(
        /^That’s enough calories for today \(1,990 of 2,000 kcal\)\. If you’d like something more, pick something light\./,
      ),
    ).toBeInTheDocument();
    enough.unmount();

    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75, hideKcal: true }));
    renderWithBridge(<NearbyPage />);
    const plain = await screen.findByRole('region', { name: 'For now' });
    expect(await within(plain).findByText(/^That’s enough for today — if you’d like something more, pick something light\./)).toBeInTheDocument();
    expect(plain).not.toHaveTextContent(/kcal|Na dziś/);
  }, 15_000);
});
