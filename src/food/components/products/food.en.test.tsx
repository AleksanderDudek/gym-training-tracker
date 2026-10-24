// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { activeFilterChips } from '../../lib/active-filters';
import { EMPTY_FILTERS } from '../../lib/filters';
import { indexProducts } from '../../lib/search';
import { formatDate, formatPrice } from '../../lib/format';
import { NOVA_LABELS, NUTRIENT_LABELS, PALM_OIL_LABELS, SORT_OPTIONS, TOGGLE_LABELS, TRI_LABELS } from '../../lib/labels';
import { OverpassUnavailable } from '../../nearby/overpass';
import { normalizeChain } from '../../restaurants/normalize';
import { SORT_LABELS as MENU_SORT_LABELS } from '../../restaurants/sort';
import { CATEGORY_LABELS, CHAIN_KIND_GROUPS, CHAIN_KIND_LABELS, type ChainData, type MenuItemData } from '../../restaurants/types';
import { DATASET, INDEXED, makeProduct } from '../../test/fixtures';
import { renderWithBridge } from '../../test/bridge';
import { RadiusSlider } from '../nearby/RadiusSlider';
import { popupFor } from '../nearby/StoreMap';
import RecipesPage from '../recipes/RecipesPage';
import ChainPage from '../restaurants/ChainPage';
import RestaurantsPage from '../restaurants/RestaurantsPage';
import ProductsPage from './ProductsPage';

vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

const item = (name: string, over: Partial<MenuItemData> = {}): MenuItemData => ({
  name,
  category: 'burger',
  portion: '1 szt.',
  grams: null,
  kcal: 250,
  protein: 13,
  carbs: 30,
  fat: 9,
  sugars: null,
  fiber: null,
  saturatedFat: null,
  salt: null,
  ...over,
});

const chain = (id: string, name: string, kind: ChainData['kind'], items: MenuItemData[], market = 'PL'): ChainData => ({
  id,
  name,
  kind,
  market,
  source: { url: `https://example.com/${id}.pdf`, title: `Tabela ${name}`, checked: '2026-10-12' },
  items,
});

vi.mock('../../restaurants/catalog', () => ({
  CHAINS: [
    normalizeChain(
      chain('kfc', 'KFC', 'fast-food', [
        item('Zinger', { kcal: 480, protein: 26, carbs: 45, fat: 21, grams: 200, sugars: 5, salt: 2.1 }),
        item('Strips', { category: 'kurczak', portion: '3 szt.', kcal: 290, protein: 27, carbs: 14, fat: 14 }),
        item('Frytki', { category: 'dodatek', portion: 'średnie', kcal: 330, protein: 4, carbs: 42, fat: 16 }),
      ]),
    ),
    normalizeChain(chain('costa', 'Costa Coffee', 'kawiarnia', [item('Latte', { category: 'kawa', portion: 'M' })], 'UK')),
  ],
}));

const POLISH = /[ąćęłńóśźż]/i;
const LOADED: LoadedDataset = { dataset: DATASET, products: INDEXED };
const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);

beforeEach(() => {
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
});

/** None of these Polish catalog texts is on the page. */
function absent(...texts: (string | RegExp)[]) {
  for (const t of texts) expect(screen.queryByText(t)).not.toBeInTheDocument();
}

describe('Products in English', () => {
  test('the list, the toolbar, the filters and a product', async () => {
    at('#/produkty');
    const user = userEvent.setup();
    render(<ProductsPage />);
    expect(await screen.findByText(/^Found/)).toHaveTextContent('Found 6 products');
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveAttribute('placeholder', 'Name, brand or barcode');
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveDisplayValue('Most popular');
    expect(screen.getByText('Restaurants and food chains')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Product list' })).toBeInTheDocument();
    absent(/Znaleziono/, 'Filtry', 'Lokale i sieci gastronomiczne', 'Karty', 'Tabela');

    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    for (const title of ['Show only', 'Diet', 'Nutrition facts per 100 g', 'Price', 'Category', 'Brand', 'Shop', 'Allergen-free'])
      expect(within(sheet).getByText(title, { selector: 'summary' })).toBeInTheDocument();
    expect(within(sheet).getByText('With a photo')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /^Show 6 products$/ })).toBeInTheDocument();
    expect(within(sheet).queryByText(/Pokaż|Wartości odżywcze|Bez alergenów/)).not.toBeInTheDocument();
    await user.click(within(sheet).getByLabelText(/With a photo/));
    await user.click(within(sheet).getByRole('button', { name: 'Close filters' }));

    expect(await screen.findByRole('list', { name: 'Active filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter: With a photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Żółty ser Gouda' })[0]!);
    const detail = await screen.findByRole('dialog', { name: 'Żółty ser Gouda' });
    expect(within(detail).getByRole('heading', { name: 'Nutrition facts per 100 g' })).toBeInTheDocument();
    expect(within(detail).getByRole('rowheader', { name: 'Energy' })).toBeInTheDocument();
    // Allergen names come from the product data's own dictionary.
    expect(within(detail).getByText('Contains: Mleko')).toBeInTheDocument();
    expect(within(detail).getByText(/See it on Open Food Facts/)).toBeInTheDocument();
    expect(within(detail).queryByText(/Wartości odżywcze|Zawiera|Zobacz w Open Food Facts|Alergeny/)).not.toBeInTheDocument();
  });
});

describe('Barcode scanner in English', () => {
  test('the scanner, a typed code, the result and the comparison speak English', async () => {
    const skyr = makeProduct({
      code: '5900000000015',
      name: 'Skyr',
      quantity: '150 g',
      nutrition: { kcal: 63, protein: 11, carbs: 4, fat: 0, saturatedFat: null, sugars: null, fiber: null, salt: null },
    });
    const loaded: LoadedDataset = { dataset: { ...DATASET, products: [skyr] }, products: indexProducts([skyr], DATASET.dictionaries.brands) };
    vi.mocked(loadedDataset).mockReturnValue(loaded);
    vi.mocked(loadDataset).mockResolvedValue(loaded);
    window.localStorage.clear();
    at('#/produkty');
    const user = userEvent.setup();
    renderWithBridge(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Scan a barcode' }));
    const sheet = await screen.findByRole('dialog', { name: 'Barcode scanner' });
    expect(within(sheet).getByText('This browser doesn’t give access to the camera. Type the code below.')).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText('Or type the code'), '5900000000015{Enter}');
    const card = await within(sheet).findByRole('article', { name: 'Skyr' });
    expect(within(card).getByRole('rowheader', { name: 'per 100 g' })).toBeInTheDocument();
    expect(within(card).getByRole('rowheader', { name: 'pack 150 g' })).toBeInTheDocument();
    expect(within(card).getByText(/^For today: it fits — about [\d,]+ kcal left\.$/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /I ate 150 g/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: 'Comparison (1)' })).toBeInTheDocument();
    expect(within(sheet).getByText('Scan another product to compare.')).toBeInTheDocument();
    expect(within(sheet).getByText(/^It clears itself at .+ — an hour after the last scan\.$/)).toBeInTheDocument();
    expect(sheet.textContent).not.toMatch(POLISH);
  });
});

describe('Recipes in English', () => {
  test('the rule, the filters and the cards speak English', async () => {
    at('#/przepisy');
    render(<RecipesPage />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Protein recipes' })).toBeInTheDocument();
    expect(screen.getByText(/^The rule: every serving has/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Time' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Shop' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'All' }).length).toBeGreaterThan(0);
    expect(within(screen.getByRole('group', { name: 'List layout' })).getByRole('button', { name: 'By time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Ready protein products' })).toBeInTheDocument();
    expect(screen.getAllByText('How to make it').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('heading', { name: 'Ingredients' }).length).toBeGreaterThan(0);
    absent('Przepisy białkowe', 'Według czasu', 'Według sklepów', 'Wszystkie', 'Jak zrobić', 'Składniki', /^Zasada:/, 'Gotowe produkty białkowe');
  });
});

describe('Restaurants in English', () => {
  test('the chain list, the search and a menu', async () => {
    at('#/lokale');
    const user = userEvent.setup();
    const { unmount } = renderWithBridge(<RestaurantsPage />);
    const fast = await screen.findByRole('region', { name: 'Fast food' });
    expect(within(fast).getByRole('link', { name: /KFC.*3 items/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cafés' })).toHaveTextContent('data from the UK menu');
    const search = screen.getByRole('searchbox', { name: 'Search restaurant menus' });
    expect(search).toHaveAttribute('placeholder', 'Big Mac, latte, fries…');
    absent('Kawiarnie', /pozycj/, /Wczytywanie/);
    // A Polish menu item is found by its category in English too.
    await user.type(search, 'fries');
    const results = await screen.findByRole('region', { name: 'Results' });
    expect(within(results).getByRole('button', { name: /Frytki/ })).toBeInTheDocument();
    unmount();

    at('#/lokale/kfc');
    renderWithBridge(<ChainPage chainId="kfc" />);
    expect(await screen.findByRole('heading', { level: 2, name: 'KFC' })).toBeInTheDocument();
    expect(screen.getByText(/Fast food · 3 menu items/)).toBeInTheDocument();
    expect(screen.getByText(/^Source:/)).toHaveTextContent('Source: Tabela KFC · checked 12 Oct 2026.');
    expect(screen.getByRole('heading', { name: 'Most protein' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Order' })).toHaveDisplayValue('As on the menu');
    absent('Najwięcej białka', /Źródło/, 'Kolejność', 'Wszystko');
  });
});

describe('Nearby in English', () => {
  test('the radius and a shop on the map', () => {
    render(<RadiusSlider radius={1500} onChange={() => {}} />);
    expect(screen.getByText('Radius')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Radius' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/^1\.5\skm$/));
    expect(screen.getByRole('button', { name: 'Smaller radius' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Larger radius' })).toBeInTheDocument();

    const shop = { id: 'node/1', name: 'Biedronka', chain: 'biedronka', lat: 52.23, lon: 21.01, address: null, openingHours: null, distance: 1234 };
    const props = { storeName: () => 'Biedronka', onSelectChain: () => {} };
    const some = popupFor(shop, { ...props, recipeCount: () => 3 }, () => {});
    expect(some).toHaveTextContent(/Biedronka · 1\.2\skm/);
    expect(some).toHaveTextContent('Recipes with every ingredient here: 3');
    expect(some.querySelector('button')).toHaveTextContent('Show these recipes');
    expect(popupFor(shop, { ...props, recipeCount: () => 0 }, () => {})).toHaveTextContent('No recipes with every ingredient here');
    expect(some.textContent).not.toMatch(POLISH);
  });
});

describe('labels and messages in English', () => {
  test('product facets, sorting, menus and errors have no Polish letters', () => {
    const texts = [
      ...Object.values(TOGGLE_LABELS),
      ...Object.values(NUTRIENT_LABELS),
      ...Object.values(NOVA_LABELS),
      ...Object.values(TRI_LABELS),
      ...Object.values(PALM_OIL_LABELS),
      ...SORT_OPTIONS.map((o) => o.label),
      ...Object.values(CATEGORY_LABELS),
      ...Object.values(CHAIN_KIND_LABELS),
      ...Object.values(CHAIN_KIND_GROUPS),
      ...Object.values(MENU_SORT_LABELS),
      new OverpassUnavailable().message,
      ...activeFilterChips(
        { ...EMPTY_FILTERS, q: 'skyr', toggles: ['vegan'], ranges: { price: { min: 5, max: null } }, stores: ['lidl'] },
        DATASET.dictionaries,
      ).map((c) => c.label),
    ];
    for (const t of texts) expect(t).not.toMatch(POLISH);
    expect(SORT_OPTIONS[1]!.label).toBe('Name A–Z');
    expect(formatPrice(12.5)).toMatch(/^PLN\s12\.50$/);
    expect(formatDate('2026-10-08')).toBe('8 Oct 2026');
  });
});
