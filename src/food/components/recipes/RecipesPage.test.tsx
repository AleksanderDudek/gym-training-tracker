// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { indexProducts } from '../../lib/search';
import type { Dataset, Nutrition } from '../../lib/types';
import { DATASET, makeProduct } from '../../test/fixtures';
import RecipesPage from './RecipesPage';

// Baza z próbek zamiast pobierania pliku — jak w teście Produktów.
vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

function n(kcal: number, protein: number, carbs: number, fat: number, sugars: number): Nutrition {
  return { kcal, protein, carbs, fat, sugars, saturatedFat: null, fiber: null, salt: null };
}

// Dwa jogurty proteinowe w Biedronce: domyślny trzyma zasadę, drugi łamie ją po dodaniu borówek
// (16 g białka wobec 18 g węglowodanów).
const YOGURT_OK = makeProduct({
  code: 'yog-ok',
  name: 'Jogurt proteinowy naturalny',
  categories: ['en:dairies'],
  nutrition: n(64, 10, 4, 0.3, 4),
  stores: ['biedronka'],
  popularity: 10,
});
const YOGURT_WEAK = makeProduct({
  code: 'yog-weak',
  name: 'Jogurt proteinowy waniliowy',
  categories: ['en:dairies'],
  nutrition: n(70, 8, 6, 0.5, 6),
  stores: ['biedronka'],
  popularity: 1,
});
// Ten sam jogurt w Lidlu: w Biedronce nie ma go na liście zamienników.
const YOGURT_LIDL = makeProduct({
  code: 'yog-lidl',
  name: 'Jogurt proteinowy z Lidla',
  categories: ['en:dairies'],
  nutrition: n(66, 10, 4, 0.2, 4),
  stores: ['lidl'],
  popularity: 5,
});
const DATA: Dataset = { ...DATASET, products: [...DATASET.products, YOGURT_OK, YOGURT_WEAK, YOGURT_LIDL] };
const LOADED: LoadedDataset = { dataset: DATA, products: indexProducts(DATA.products, DATA.dictionaries.brands) };

function serve(loaded: LoadedDataset | null) {
  vi.mocked(loadedDataset).mockReturnValue(loaded);
  if (loaded) vi.mocked(loadDataset).mockResolvedValue(loaded);
}

function cardFor(name: string): HTMLElement {
  const card = screen.getByRole('heading', { level: 3, name }).closest('article');
  if (!card) throw new Error(`Brak karty ${name}`);
  return card;
}

const pageReady = () => screen.findByRole('heading', { level: 2, name: 'Przepisy białkowe' });

beforeEach(() => {
  window.history.replaceState(null, '', '#/przepisy');
  vi.mocked(loadDataset).mockReset();
  vi.mocked(loadedDataset).mockReset();
  serve(LOADED);
});

describe('Przepisy', () => {
  test('lista przepisów z białkiem i zasadą', async () => {
    render(<RecipesPage />);
    expect(await pageReady()).toBeInTheDocument();
    const card = cardFor('Skyr z białkiem i malinami');
    expect(within(card).getByText(/białka$/)).toBeInTheDocument();
    expect(within(card).getByText(/Białko .* > węglowodany/)).toBeInTheDocument();
  });

  test('żeton sklepu zostawia tylko to, co tam kupisz, i mówi o tym', async () => {
    const user = userEvent.setup();
    render(<RecipesPage />);
    const stores = await screen.findByRole('group', { name: 'Sklep' });
    await user.click(within(stores).getByRole('button', { name: /Biedronka/ }));
    expect(window.location.hash).toBe('#/przepisy?sklep=biedronka');
    const card = cardFor('Jogurt proteinowy z borówkami');
    expect(within(card).getByText('Wszystko kupisz w: Biedronka')).toBeInTheDocument();
  });

  test('lista zamiany to wybór sam w sobie: produkty z tego sklepu, po kolei, z zaznaczonym obecnym', async () => {
    window.history.replaceState(null, '', '#/przepisy?sklep=biedronka');
    const user = userEvent.setup();
    render(<RecipesPage />);
    await pageReady();
    await user.click(within(cardFor('Jogurt proteinowy z borówkami')).getByRole('button', { name: 'Zamień: Jogurt, skyr lub pudding proteinowy' }));
    const sheet = await screen.findByRole('dialog', { name: 'Zamień: Jogurt, skyr lub pudding proteinowy' });
    expect(within(sheet).getByText('Produkty z: Biedronka')).toBeInTheDocument();
    const options = within(sheet).getAllByRole('radio') as HTMLInputElement[];
    // Jogurt z Lidla tu nie trafia: zamiana zostaje w sklepie, w którym kupujesz resztę.
    expect(options.map((o) => o.value)).toEqual(['yog-ok', 'yog-weak']);
    expect(within(sheet).getByRole('radio', { name: /Jogurt proteinowy naturalny/ })).toBeChecked();
    // Produkt, który złamałby zasadę, jest oznaczony, zanim się go wybierze.
    expect(within(sheet).getByRole('radio', { name: /waniliowy.*łamie zasadę/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('radio', { name: /naturalny/ })).not.toHaveAccessibleName(/łamie zasadę/);
  });

  test('zamiana, która łamie zasadę, jest dozwolona, ale oznaczona na czerwono', async () => {
    window.history.replaceState(null, '', '#/przepisy?sklep=biedronka');
    const user = userEvent.setup();
    render(<RecipesPage />);
    await pageReady();
    const card = cardFor('Jogurt proteinowy z borówkami');
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Zamień: Jogurt, skyr lub pudding proteinowy' }));
    const sheet = await screen.findByRole('dialog', { name: 'Zamień: Jogurt, skyr lub pudding proteinowy' });
    await user.click(within(sheet).getByRole('radio', { name: /waniliowy/ }));
    // Arkusz od razu mówi, co wybór zrobił z porcją.
    expect(within(sheet).getByRole('status')).toHaveTextContent('zasada nie jest spełniona');
    // Karta za arkuszem już się przeliczyła.
    expect(within(card).getByRole('alert')).toHaveTextContent('zasada nie jest spełniona');

    await user.click(within(sheet).getByRole('button', { name: 'Gotowe' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Zamień/ })).not.toBeInTheDocument());
    expect(within(card).getByRole('alert')).toHaveTextContent('zasada nie jest spełniona');
    expect(within(card).getByRole('button', { name: 'Szczegóły: Jogurt proteinowy waniliowy' })).toBeInTheDocument();

    // Powrót do produktu, który trzyma zasadę, zdejmuje ostrzeżenie.
    await user.click(within(card).getByRole('button', { name: 'Zamień: Jogurt, skyr lub pudding proteinowy' }));
    const again = await screen.findByRole('dialog', { name: 'Zamień: Jogurt, skyr lub pudding proteinowy' });
    await user.click(within(again).getByRole('radio', { name: /naturalny/ }));
    expect(within(again).getByRole('status')).toHaveTextContent('zasada spełniona');
    await user.click(within(again).getByRole('button', { name: 'Zamknij zamianę' }));
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument();
  });

  test('przełącznik sklepu na karcie zmienia sklep tylko tej karty', async () => {
    const user = userEvent.setup();
    render(<RecipesPage />);
    await pageReady();
    const card = cardFor('Skyr z białkiem i malinami');
    const shops = within(card).getByRole('group', { name: 'Sklep dla: Skyr z białkiem i malinami' });
    expect(within(card).getByText('Wszystko kupisz w: Biedronka')).toBeInTheDocument();
    await user.click(within(shops).getByRole('button', { name: 'Lidl' }));
    expect(within(card).getByText('Wszystko kupisz w: Lidl')).toBeInTheDocument();
    expect(within(shops).getByRole('button', { name: 'Lidl' })).toHaveAttribute('aria-pressed', 'true');
    // Wybór na karcie nie trafia do adresu — to nie filtr strony.
    expect(window.location.hash).toBe('#/przepisy');
  });

  test('składnik otwiera kartę produktu, a Wstecz ją zamyka', async () => {
    window.history.replaceState(null, '', '#/przepisy?sklep=biedronka');
    const user = userEvent.setup();
    render(<RecipesPage />);
    await pageReady();
    await user.click(
      within(cardFor('Jogurt proteinowy z borówkami')).getByRole('button', { name: 'Szczegóły: Jogurt proteinowy naturalny' }),
    );
    expect(await screen.findByRole('dialog', { name: 'Jogurt proteinowy naturalny' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/przepisy?sklep=biedronka&p=yog-ok');

    await user.click(screen.getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(window.location.hash).toBe('#/przepisy?sklep=biedronka'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Jogurt proteinowy naturalny' })).not.toBeInTheDocument());
  });

  test('każda karta mówi, ile trwa; szybkie są oznaczone', async () => {
    render(<RecipesPage />);
    await pageReady();
    expect(within(cardFor('Białko z wodą')).getByText('Szybkie')).toBeInTheDocument();
    expect(within(cardFor('Kurczak z patelni z papryką i cukinią')).getByText('Chwilę dłużej')).toBeInTheDocument();
    const chili = cardFor('Chili z indyka');
    expect(within(chili).getByText('Dłużej, w domu')).toBeInTheDocument();
    // Gramy są na cały garnek, makro na jeden talerz — i karta to mówi.
    expect(within(chili).getByText('na porcję (przepis na 3 porcje)')).toBeInTheDocument();
    expect(within(cardFor('Białko z wodą')).queryByText(/na porcję/)).not.toBeInTheDocument();
  });

  test('klasyk podaje stronę w Wikibooks, na której motywach powstał, i jej licencję', async () => {
    render(<RecipesPage />);
    await pageReady();
    const card = cardFor('Ryba po grecku z dorszem');
    expect(within(card).getByText(/Na motywach przepisu/)).toBeInTheDocument();
    const source = within(card).getByRole('link', { name: /„Ryba po grecku”/ });
    expect(source).toHaveAttribute('href', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska/Ryba_po_grecku');
    expect(source).toHaveAttribute('target', '_blank');
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(card).getByRole('link', { name: /CC BY-SA 4\.0/ })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/deed.pl',
    );
    // Własne przepisy aplikacji nie mają źródła.
    expect(within(cardFor('Chili z indyka')).queryByText(/Na motywach/)).not.toBeInTheDocument();
  });

  test('najpierw szybkie, dalej według czasu', async () => {
    render(<RecipesPage />);
    const list = await screen.findByRole('region', { name: 'Przepisy białkowe' });
    const minutes = within(list)
      .getAllByRole('article')
      .map((card) => Number.parseInt(within(card).getByText(/^\d+ min$/).textContent ?? '', 10));
    expect(minutes.length).toBeGreaterThan(10);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(minutes[0]).toBeLessThanOrEqual(7);
  });

  test('żeton czasu zostawia jedną grupę, trafia do adresu i działa razem z rodzajem', async () => {
    const user = userEvent.setup();
    render(<RecipesPage />);
    const time = await screen.findByRole('group', { name: 'Czas' });
    await user.click(within(time).getByRole('button', { name: 'Dłużej, w domu' }));
    expect(window.location.hash).toBe('#/przepisy?czas=dluzej');
    expect(screen.getByRole('heading', { level: 3, name: 'Chili z indyka' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Białko z wodą' })).not.toBeInTheDocument();

    await user.click(within(screen.getByRole('group', { name: 'Rodzaj' })).getByRole('button', { name: 'Shake' }));
    expect(window.location.hash).toBe('#/przepisy?typ=shake&czas=dluzej');
    expect(screen.getByText('Brak przepisów z tymi filtrami w tym sklepie.')).toBeInTheDocument();

    await user.click(within(time).getByRole('button', { name: 'Szybkie' }));
    expect(window.location.hash).toBe('#/przepisy?typ=shake&czas=szybkie');
    expect(screen.getByRole('heading', { level: 3, name: 'Shake truskawkowy ze skyrem' })).toBeInTheDocument();

    await user.click(within(time).getByRole('button', { name: 'Wszystkie' }));
    expect(window.location.hash).toBe('#/przepisy?typ=shake');
  });

  test('pusty wynik daje się wyczyścić jednym przyciskiem', async () => {
    window.history.replaceState(null, '', '#/przepisy?typ=shake&czas=dluzej');
    const user = userEvent.setup();
    render(<RecipesPage />);
    expect(await screen.findByText('Brak przepisów z tymi filtrami w tym sklepie.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wyczyść filtry' }));
    expect(window.location.hash).toBe('#/przepisy');
    expect(screen.getByRole('heading', { level: 3, name: 'Białko z wodą' })).toBeInTheDocument();
  });

  test('grupa czasu z linku działa od wejścia', async () => {
    window.history.replaceState(null, '', '#/przepisy?czas=chwila');
    render(<RecipesPage />);
    await pageReady();
    expect(within(screen.getByRole('group', { name: 'Czas' })).getByRole('button', { name: 'Chwilę dłużej' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Kurczak z patelni z papryką i cukinią' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Chili z indyka' })).not.toBeInTheDocument();
  });

  test('gotowe produkty: karta otwiera produkt w tym samym adresie', async () => {
    const user = userEvent.setup();
    render(<RecipesPage />);
    const ready = await screen.findByRole('region', { name: 'Gotowe produkty białkowe' });
    const group = within(ready).getByRole('region', { name: /Skyry, jogurty i desery białkowe/ });
    await user.click(within(group).getByRole('button', { name: 'Jogurt proteinowy naturalny' }));
    expect(await screen.findByRole('dialog', { name: 'Jogurt proteinowy naturalny' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/przepisy?p=yog-ok');
  });

  test('wczytywanie i błąd bazy z ponowną próbą', async () => {
    serve(null);
    vi.mocked(loadDataset).mockRejectedValueOnce(new Error('Nie udało się pobrać danych produktów.')).mockResolvedValueOnce(LOADED);
    const user = userEvent.setup();
    render(<RecipesPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie produktów');
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać danych produktów.');
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await pageReady()).toBeInTheDocument();
  });
});
