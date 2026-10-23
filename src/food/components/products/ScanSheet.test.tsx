// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { db } from '../../diet/db';
import { clearAll } from '../../diet/store';
import { indexProducts } from '../../lib/search';
import type { Product } from '../../lib/types';
import { COMPARE_KEY } from '../../scan/compareStore';
import { renderWithBridge } from '../../test/bridge';
import { DATASET, makeProduct } from '../../test/fixtures';
import ProductsPage from './ProductsPage';

// Baza z próbek zamiast pobierania pliku. Aparatu w jsdom nie ma (`navigator.mediaDevices`), więc
// skaner mówi, żeby wpisać kod — i tędy, polem kodu, idą te testy.
vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

const nutrition = (kcal: number, protein: number, carbs: number, fat: number) => ({
  kcal,
  protein,
  carbs,
  fat,
  saturatedFat: null,
  sugars: null,
  fiber: null,
  salt: null,
});

const SKYR = makeProduct({
  code: '5900000000015',
  name: 'Skyr naturalny',
  brands: ['piatnica'],
  quantity: '150 g',
  nutrition: nutrition(63, 11, 4, 0),
  price: { value: 4.29, currency: 'PLN', date: '2026-10-01', store: 'Lidl', city: null, perKg: false, discounted: false, regularValue: null, count: 1 },
});
const BAR = makeProduct({ code: '5900000000022', name: 'Baton czekoladowy', quantity: '50 g', nutrition: nutrition(520, 6, 60, 28) });
const PRODUCTS: Product[] = [SKYR, BAR];
const LOADED: LoadedDataset = {
  dataset: { ...DATASET, products: PRODUCTS },
  products: indexProducts(PRODUCTS, DATASET.dictionaries.brands),
};

let offRequests: string[] = [];
let offAnswer: unknown = { status: 0, status_verbose: 'product not found' };

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '#/produkty');
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
  offRequests = [];
  offAnswer = { status: 0, status_verbose: 'product not found' };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      offRequests.push(String(url));
      return json(offAnswer);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openScanner(user: ReturnType<typeof userEvent.setup>) {
  renderWithBridge(<ProductsPage />);
  await user.click(await screen.findByRole('button', { name: 'Skanuj kod kreskowy' }));
  return screen.findByRole('dialog', { name: 'Skaner kodów' });
}

async function typeCode(user: ReturnType<typeof userEvent.setup>, sheet: HTMLElement, code: string) {
  const field = within(sheet).getByLabelText('Albo wpisz kod');
  await user.clear(field);
  await user.type(field, `${code}{Enter}`);
}

describe('Skaner kodów', () => {
  test('„Skanuj” otwiera skaner w adresie; bez aparatu każe wpisać kod; zamknięcie wraca do listy', async () => {
    const user = userEvent.setup();
    const sheet = await openScanner(user);
    expect(window.location.hash).toBe('#/produkty?skan=1');
    expect(within(sheet).getByText('Ta przeglądarka nie daje dostępu do aparatu. Wpisz kod niżej.')).toBeInTheDocument();
    expect(within(sheet).getByText(/Zeskanuj pierwszy produkt/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Skaner kodów' })).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/produkty');
  });

  test('kod z bazy: makro od razu — na 100 g i na opakowanie, ocena, dziś — i produkt w porównaniu', async () => {
    const user = userEvent.setup();
    const sheet = await openScanner(user);
    await typeCode(user, sheet, '5900000000015');
    const card = await within(sheet).findByRole('article', { name: 'Skyr naturalny' });
    const rows = within(card).getAllByRole('row').map((r) => r.textContent);
    expect(rows[1]).toBe('w 100 g631140');
    expect(rows[2]).toBe('opak. 150 g9516,560');
    expect(within(card).getByText('Piątnica · 150 g')).toBeInTheDocument();
    expect(within(card).getByText(/Na dziś: mieści się — zostało \d/)).toBeInTheDocument();
    // Bez profilu: dieta zbilansowana, a skyr ma dobre proporcje.
    expect(within(card).getByText('pasuje')).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: 'Porównanie (1)' })).toBeInTheDocument();
    expect(within(sheet).getByText('Zeskanuj kolejny produkt, żeby porównać.')).toBeInTheDocument();
    expect(within(sheet).getByText(/^Zniknie samo o \d{1,2}:\d{2} — godzinę po ostatnim skanie\.$/)).toBeInTheDocument();
    // Z bazy aplikacji: nic nie poszło do Open Food Facts.
    expect(offRequests).toEqual([]);
  });

  test('dwa produkty: najlepszy na cel nazwany i dlaczego, pierwszy na liście; jeden do usunięcia, wszystko z „Cofnij”', async () => {
    const user = userEvent.setup();
    const sheet = await openScanner(user);
    await typeCode(user, sheet, '5900000000022');
    await within(sheet).findByRole('article', { name: 'Baton czekoladowy' });
    await typeCode(user, sheet, '5900000000015');
    const skyr = await within(sheet).findByRole('article', { name: 'Skyr naturalny' });
    // Werdykt od razu w karcie wyniku, bez przewijania do listy.
    expect(within(skyr).getByText('Najlepszy na Twój cel z 2 zeskanowanych.')).toBeInTheDocument();
    await typeCode(user, sheet, '5900000000022');
    const bar = await within(sheet).findByRole('article', { name: 'Baton czekoladowy' });
    expect(
      within(bar).getByText('2. z 2 na Twój cel — najlepszy jest Skyr naturalny (17,5 g białka na 100 kcal).'),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText('Na Twój cel (Zbilansowana) najlepszy: Skyr naturalny — 17,5 g białka na 100 kcal.'),
    ).toBeInTheDocument();
    const list = within(sheet).getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/Skyr naturalny\s*najlepszy/);
    expect(items[0]).toHaveTextContent('2,60 zł za 10 g białka');
    expect(items[1]).toHaveTextContent('Baton czekoladowy');

    await user.click(within(sheet).getByRole('button', { name: 'Usuń z porównania: Baton czekoladowy' }));
    expect(within(sheet).getByRole('heading', { name: 'Porównanie (1)' })).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Wyczyść porównanie' }));
    expect(within(sheet).getByText(/Porównanie wyczyszczone\./)).toBeInTheDocument();
    expect(window.localStorage.getItem(COMPARE_KEY)).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Cofnij' }));
    expect(within(sheet).getByRole('heading', { name: 'Porównanie (1)' })).toBeInTheDocument();
  }, 15_000);

  test('kodu spoza bazy szuka w Open Food Facts: znaleziony trafia do wyniku i porównania z podpisem źródła', async () => {
    offAnswer = {
      status: 1,
      product: {
        code: '4006381333931',
        product_name: 'Protein Pudding',
        brands: 'Ehrmann',
        quantity: '200 g',
        nutriments: { 'energy-kcal_100g': 76, proteins_100g: 10, carbohydrates_100g: 7.1, fat_100g: 0.9 },
      },
    };
    const user = userEvent.setup();
    const sheet = await openScanner(user);
    await typeCode(user, sheet, '4006381333931');
    const card = await within(sheet).findByRole('article', { name: 'Protein Pudding' });
    expect(within(card).getByText('Ehrmann · 200 g · z Open Food Facts')).toBeInTheDocument();
    expect(offRequests[0]).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/4006381333931\?fields=/);
    expect(within(sheet).getByRole('heading', { name: 'Porównanie (1)' })).toBeInTheDocument();
  });

  test('nieznany kod, kod sklepowy i błąd w cyfrach mówią, co dalej', async () => {
    const user = userEvent.setup();
    const sheet = await openScanner(user);
    await typeCode(user, sheet, '5901234123457');
    expect(await within(sheet).findByText('Nie znam produktu o kodzie 5901234123457.')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /Dodaj go do Open Food Facts/ })).toHaveAttribute(
      'href',
      'https://world.openfoodfacts.org/product/5901234123457',
    );
    await typeCode(user, sheet, '2000000000008');
    expect(await within(sheet).findByText(/to kod sklepowy: towar ważony albo pakowany w sklepie/)).toBeInTheDocument();
    await typeCode(user, sheet, '5901234123458');
    expect(await within(sheet).findByText('Sprawdź cyfry — ostatnia się nie zgadza.')).toBeInTheDocument();
    // Kod sklepowy nie idzie nigdzie: w żadnej bazie go nie ma.
    expect(offRequests.some((u) => u.includes('2000000000008'))).toBe(false);
  });

  test('„Zjadłem 150 g” zapisuje opakowanie w dzisiejszym dzienniku', async () => {
    const user = userEvent.setup();
    const sheet = await openScanner(user);
    await typeCode(user, sheet, '5900000000015');
    const card = await within(sheet).findByRole('article', { name: 'Skyr naturalny' });
    await user.click(within(card).getByRole('button', { name: /Zjadłem 150 g/ }));
    expect(await within(card).findByText('Zapisane w dzienniku: Skyr naturalny · 95 kcal.')).toBeInTheDocument();
    const entries = await db.entries.toArray();
    expect(entries).toEqual([expect.objectContaining({ name: 'Skyr naturalny', amountLabel: '150 g', kcal: 95, key: 'product:5900000000015' })]);
  });

  test('porównanie sprzed ponad godziny znika samo; świeże czeka na pasku pod wyszukiwarką', async () => {
    const item = (code: string, name: string, touchedAgo: number) =>
      JSON.stringify({
        touchedAt: Date.now() - touchedAgo,
        items: [{ code, name, brand: null, quantity: null, image: null, nutriscore: null, per100: nutrition(63, 11, 4, 0), price: null, source: 'base', addedAt: 0 }],
      });
    window.localStorage.setItem(COMPARE_KEY, item('5900000000015', 'Skyr naturalny', 61 * 60_000));
    const user = userEvent.setup();
    const { unmount } = renderWithBridge(<ProductsPage />);
    await screen.findByRole('button', { name: 'Skanuj kod kreskowy' });
    expect(screen.queryByRole('button', { name: /Porównanie \(/ })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(COMPARE_KEY)).toBeNull();
    unmount();

    window.localStorage.setItem(COMPARE_KEY, item('5900000000015', 'Skyr naturalny', 5 * 60_000));
    renderWithBridge(<ProductsPage />);
    const bar = await screen.findByRole('button', { name: /Porównanie \(1\)/ });
    expect(bar).toHaveTextContent(/zniknie o \d{1,2}:\d{2}/);
    await user.click(bar);
    const sheet = await screen.findByRole('dialog', { name: 'Skaner kodów' });
    expect(window.location.hash).toBe('#/produkty?skan=lista');
    // Z listy porównania aparat czeka na stuknięcie.
    expect(within(sheet).getByRole('button', { name: 'Skanuj aparatem' })).toBeInTheDocument();
  });

  test('„Porównaj” w karcie produktu dodaje go do porównania, a „Pokaż porównanie” otwiera listę', async () => {
    const user = userEvent.setup();
    renderWithBridge(<ProductsPage />);
    const list = await screen.findByRole('list', { name: 'Lista produktów' });
    await user.click(within(list).getByRole('button', { name: /Skyr naturalny/ }));
    const card = await screen.findByRole('dialog', { name: 'Skyr naturalny' });
    const toggle = within(card).getByRole('button', { name: 'Porównaj: Skyr naturalny' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(card).getByRole('button', { name: /Pokaż porównanie \(1\)/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Skaner kodów' });
    expect(within(sheet).getByRole('heading', { name: 'Porównanie (1)' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Skyr naturalny' })).not.toBeInTheDocument());
  });
});
