// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadDataset, loadedDataset, MISSING_DATA_MESSAGE, type LoadedDataset } from '../../data';
import { browse } from '../../lib/browse';
import { indexProducts } from '../../lib/search';
import { DATASET, INDEXED, makeProduct } from '../../test/fixtures';
import { pageNumbers } from './Pagination';
import ProductsPage from './ProductsPage';

// Baza z próbek zamiast pobierania pliku — tak jak test `useDataset`. Komunikat o brakującej bazie
// zostaje prawdziwy, bo ekran błędu porównuje się z nim.
vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

// Prawdziwe filtrowanie, tylko policzalne: zamknięcie karty produktu nie może go uruchomić od nowa.
vi.mock('../../lib/browse', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/browse')>();
  return { ...real, browse: vi.fn(real.browse) };
});

const LOADED: LoadedDataset = { dataset: DATASET, products: INDEXED };

function serve(loaded: LoadedDataset) {
  vi.mocked(loadedDataset).mockReturnValue(loaded);
  vi.mocked(loadDataset).mockResolvedValue(loaded);
}

/** Wiersz „Znaleziono …”. */
const found = () => screen.getByText(/Znaleziono/);

/** Jedna sekcja arkusza filtrów (`<details>` z nagłówkiem w `<summary>`). */
function section(sheet: HTMLElement, title: string) {
  const details = within(sheet).getByText(title, { selector: 'summary' }).closest('details');
  if (!details) throw new Error(`Brak sekcji ${title}`);
  return within(details);
}

async function cardNames(): Promise<string[]> {
  const list = await screen.findByRole('list', { name: 'Lista produktów' });
  return within(list)
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent ?? '');
}

beforeEach(() => {
  window.history.replaceState(null, '', '#/produkty');
  vi.mocked(loadDataset).mockReset();
  vi.mocked(loadedDataset).mockReset();
  serve(LOADED);
});

describe('Produkty', () => {
  test('po wczytaniu bazy pokazuje każdy produkt raz', async () => {
    render(<ProductsPage />);
    expect(await screen.findByText(/Znaleziono/)).toHaveTextContent('Znaleziono 6 produktów');
    expect(await cardNames()).toHaveLength(6);
  });

  test('wyszukiwanie zawęża listę bez względu na polskie znaki i trafia do adresu', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.type(await screen.findByPlaceholderText('Nazwa, marka lub kod kreskowy'), 'zolty');
    await waitFor(() => expect(found()).toHaveTextContent('Znaleziono 1 produkt'));
    expect(await cardNames()).toEqual(['Żółty ser Gouda']);
    expect(window.location.hash).toBe('#/produkty?q=zolty');
  });

  test('Nutri-Score z arkusza filtrów zawęża listę, trafia do adresu i daje się zdjąć żetonem', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Filtry' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtry' });
    await user.click(within(sheet).getByTitle('Nutri-Score A'));
    await waitFor(() => expect(found()).toHaveTextContent('Znaleziono 2 produkty'));
    expect(window.location.hash).toBe('#/produkty?ns=a');
    expect(within(sheet).getByTitle('Nutri-Score A')).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(sheet).getByRole('button', { name: 'Pokaż 2 produkty' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filtry' })).not.toBeInTheDocument());
    expect((await cardNames()).sort()).toEqual(['Skyr naturalny', 'Tofu naturalne']);
    // Przycisk filtrów mówi, ile ich działa.
    expect(screen.getByRole('button', { name: /^Filtry/ })).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Usuń filtr: Nutri-Score A' }));
    await waitFor(() => expect(found()).toHaveTextContent('Znaleziono 6 produktów'));
    expect(window.location.hash).toBe('#/produkty');
  });

  test('przycisk w stopce arkusza liczy produkty po każdej zmianie, a „Wyczyść” zdejmuje wszystko', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Filtry' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtry' });
    expect(within(sheet).getByRole('button', { name: 'Pokaż 6 produktów' })).toBeInTheDocument();

    await user.click(section(sheet, 'Dieta').getByRole('checkbox', { name: /Wegańskie/ }));
    expect(await within(sheet).findByRole('button', { name: 'Pokaż 3 produkty' })).toBeInTheDocument();
    // Arkusz jest modalny: wynik ogłasza jego własny region, nie wiersz „Znaleziono” za nim.
    expect(within(sheet).getByRole('status')).toHaveTextContent('Wynik: 3 produkty');
    await user.click(within(sheet).getByRole('checkbox', { name: /Ze zdjęciem/ }));
    expect(await within(sheet).findByRole('button', { name: 'Pokaż 2 produkty' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/produkty?only=vegan%2ChasImage');

    await user.click(within(sheet).getByRole('button', { name: 'Wyczyść (2)' }));
    expect(await within(sheet).findByRole('button', { name: 'Pokaż 6 produktów' })).toBeInTheDocument();
    expect(section(sheet, 'Dieta').getByRole('checkbox', { name: /Wegańskie/ })).not.toBeChecked();
    expect(window.location.hash).toBe('#/produkty');

    await user.click(within(sheet).getByRole('button', { name: 'Zamknij filtry' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filtry' })).not.toBeInTheDocument());
  });

  test('zakres wartości odżywczych z przecinkiem dziesiętnym filtruje po chwili', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Filtry' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtry' });
    await user.type(within(sheet).getByRole('textbox', { name: 'Białko od' }), '10,5');
    await waitFor(() => expect(found()).toHaveTextContent('Znaleziono 3 produkty'));
    expect(window.location.hash).toBe('#/produkty?protein=10.5-');
    // Między liczbą a jednostką twarda spacja — `g` nie zawinie się sama do następnej linii.
    expect(screen.getByRole('button', { name: /^Usuń filtr: Białko: od 10,5\sg$/ })).toBeInTheDocument();
  });

  test('zakres z adresu stoi w polu z przecinkiem dziesiętnym', async () => {
    window.history.replaceState(null, '', '#/produkty?protein=10.5-');
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: /^Filtry/ }));
    const sheet = screen.getByRole('dialog', { name: 'Filtry' });
    expect(within(sheet).getByRole('textbox', { name: 'Białko od' })).toHaveValue('10,5');
    expect(found()).toHaveTextContent('Znaleziono 3 produkty');
  });

  test('„Pokaż” tuż po wpisaniu zakresu zamyka arkusz z zapisaną wartością', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Filtry' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtry' });
    await user.type(within(sheet).getByRole('textbox', { name: 'Kalorie do' }), '100');
    // Bez przerwy: stuknięcie trafia w okno 250 ms, zanim szkic zapisze się sam.
    await user.click(within(sheet).getByRole('button', { name: /^Pokaż/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filtry' })).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/produkty?kcal=-100');
    await waitFor(() => expect(found()).toHaveTextContent('Znaleziono 2 produkty'));
  });

  test('panel filtrów zostaje między otwarciami: rozwinięta sekcja dalej jest rozwinięta', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Filtry' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtry' });
    const eco = within(sheet).getByText('Eco-Score', { selector: 'summary' });
    expect(eco.closest('details')).not.toHaveAttribute('open');
    await user.click(eco);
    expect(eco.closest('details')).toHaveAttribute('open');
    await user.click(within(sheet).getByRole('button', { name: 'Zamknij filtry' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filtry' })).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Filtry' }));
    const again = screen.getByRole('dialog', { name: 'Filtry' });
    expect(within(again).getByText('Eco-Score', { selector: 'summary' }).closest('details')).toHaveAttribute('open');
  });

  test('zamknięcie karty produktu nie przelicza listy: filtry zostają tym samym stanem', async () => {
    window.history.replaceState(null, '', '#/produkty?ns=a');
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Skyr naturalny' }));
    await screen.findByRole('dialog', { name: 'Skyr naturalny' });
    const runs = vi.mocked(browse).mock.calls.length;
    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Skyr naturalny' })).not.toBeInTheDocument());
    // Nowy, równy obiekt filtrów przefiltrowałby całą bazę jeszcze raz, a do tego czasu przygasił listę.
    expect(vi.mocked(browse).mock.calls.length).toBe(runs);
    expect(document.querySelector('.fd-results')).not.toHaveClass('fd-prod-stale');
  });

  test('stan z adresu wraca po wczytaniu strony', async () => {
    window.history.replaceState(null, '', '#/produkty?only=vegan&sort=kcal-asc');
    render(<ProductsPage />);
    await waitFor(() => expect(found()).toHaveTextContent('Znaleziono 3 produkty'));
    expect(await cardNames()).toEqual(['Pepsi', 'Tofu naturalne', 'Musli owocowe']);
    expect(screen.getByRole('combobox', { name: 'Sortowanie' })).toHaveValue('kcal-asc');
  });

  test('widok tabeli pokazuje tabelę, a nagłówek sortuje', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: 'Tabela' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(7); // nagłówek + 6
    expect(window.location.hash).toBe('#/produkty?view=table');

    // Białko zaczyna od najwięcej; drugie stuknięcie odwraca kierunek.
    await user.click(screen.getByRole('button', { name: 'Białko' }));
    await waitFor(() => expect(window.location.hash).toBe('#/produkty?sort=protein-desc&view=table'));
    await waitFor(() => expect(screen.getAllByRole('row')[1]).toHaveTextContent('Żółty ser Gouda'));
    expect(screen.getByRole('columnheader', { name: /Białko/ })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Białko' }));
    await waitFor(() => expect(window.location.hash).toBe('#/produkty?sort=protein-asc&view=table'));
    // Kierunku spoza gotowych pozycji lista sortowania nie zgubi.
    expect(screen.getByRole('combobox', { name: 'Sortowanie' })).toHaveDisplayValue('Własne (z tabeli)');
  });

  test('karta otwiera produkt, a zamknięcie wraca do listy', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.click(await screen.findByRole('button', { name: /Skyr naturalny/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Skyr naturalny' });
    expect(within(dialog).getByText('Piątnica · 150 g')).toBeInTheDocument();
    expect(within(dialog).getByText('Bez dodatku cukru')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/produkty?p=2');

    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Skyr naturalny' })).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/produkty');
  });

  test('karta produktu pokazuje wszystko, co baza wie: wartości, oceny, alergeny, cenę i odnośnik', async () => {
    window.history.replaceState(null, '', '#/produkty?p=1');
    render(<ProductsPage />);
    const dialog = await screen.findByRole('dialog', { name: 'Żółty ser Gouda' });
    const row = (name: string) => within(dialog).getByRole('rowheader', { name }).closest('tr');
    expect(row('Energia')).toHaveTextContent('350 kcal');
    expect(row('Białko')).toHaveTextContent('25 g');
    expect(row('w tym kwasy tłuszczowe nasycone')).toHaveTextContent('–');
    expect(within(dialog).getByRole('img', { name: 'Nutri-Score D' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: /^NOVA 3/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Eco-Score D' })).toBeInTheDocument();
    expect(within(dialog).getByText('Zawiera: Mleko')).toBeInTheDocument();
    expect(within(dialog).getByText('E160b - Annato')).toBeInTheDocument();
    expect(within(dialog).getByText('Biedronka')).toBeInTheDocument();
    expect(within(dialog).getByText(/Lidl, Warszawa · 1 paź 2026/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Zobacz w Open Food Facts/ })).toHaveAttribute(
      'href',
      'https://pl.openfoodfacts.org/produkt/1',
    );
  });

  test('karta otwarta prosto z linku zamyka się na miejscu, bez wychodzenia ze strony', async () => {
    window.history.replaceState(null, '', '#/produkty?q=musli&p=3');
    const user = userEvent.setup();
    render(<ProductsPage />);
    const dialog = await screen.findByRole('dialog', { name: 'Musli owocowe' });
    expect(within(dialog).getByText('Może zawierać: Orzechy')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Musli owocowe' })).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/produkty?q=musli');
  });

  test('wyszukiwanie wpisane tuż przed otwarciem produktu nie ginie', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    await user.type(await screen.findByRole('searchbox', { name: 'Szukaj produktu' }), 'skyr');
    // Bez przerwy: stuknięcie trafia w okno 250 ms, zanim szkic zapisze się sam.
    await user.click(screen.getByRole('button', { name: 'Skyr naturalny' }));
    expect(window.location.hash).toBe('#/produkty?q=skyr&p=2');
    const dialog = await screen.findByRole('dialog', { name: 'Skyr naturalny' });
    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(window.location.hash).toBe('#/produkty?q=skyr'));
    expect(screen.getByRole('searchbox', { name: 'Szukaj produktu' })).toHaveValue('skyr');
  });

  test('Wstecz zamyka kartę produktu i oddaje fokus jego karcie na liście', async () => {
    const user = userEvent.setup();
    render(<ProductsPage />);
    const card = await screen.findByRole('button', { name: 'Pepsi' });
    await user.click(card);
    await screen.findByRole('dialog', { name: 'Pepsi' });
    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pepsi' })).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/produkty');
    expect(card).toHaveFocus();
  });

  test('nazwa produktu jest nagłówkiem karty i nazwą jej przycisku', async () => {
    render(<ProductsPage />);
    const heading = await screen.findByRole('heading', { level: 3, name: 'Tofu naturalne' });
    expect(within(heading).getByRole('button', { name: 'Tofu naturalne' })).toBeInTheDocument();
  });

  test('pusty wynik ma wyjście: „Wyczyść filtry”', async () => {
    window.history.replaceState(null, '', '#/produkty?q=kawior');
    const user = userEvent.setup();
    render(<ProductsPage />);
    expect(await screen.findByText('Brak produktów dla tych filtrów.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wyczyść filtry' }));
    await waitFor(() => expect(found()).toHaveTextContent('Znaleziono 6 produktów'));
    expect(screen.getByRole('searchbox', { name: 'Szukaj produktu' })).toHaveValue('');
  });

  test('„Wyczyść wszystko” przy żetonach zdejmuje wszystkie filtry naraz', async () => {
    window.history.replaceState(null, '', '#/produkty?only=vegan&ns=a&q=tofu');
    const user = userEvent.setup();
    render(<ProductsPage />);
    const chips = await screen.findByRole('list', { name: 'Aktywne filtry' });
    expect(within(chips).getAllByRole('button', { name: /^Usuń filtr/ })).toHaveLength(3);
    await user.click(within(chips).getByRole('button', { name: 'Wyczyść wszystko' }));
    await waitFor(() => expect(found()).toHaveTextContent('Znaleziono 6 produktów'));
    expect(screen.queryByRole('list', { name: 'Aktywne filtry' })).not.toBeInTheDocument();
  });

  test('strony po 48 produktów: przejście zapisuje stronę w adresie, a zmiana filtrów wraca na pierwszą', async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      makeProduct({ code: String(1000 + i), name: `Produkt ${i + 1}`, popularity: 1000 - i }),
    );
    serve({ dataset: { ...DATASET, products: many }, products: indexProducts(many, {}) });
    const user = userEvent.setup();
    render(<ProductsPage />);
    expect(await screen.findByText(/Znaleziono/)).toHaveTextContent('Znaleziono 60 produktów · strona 1 z 2');
    expect(await cardNames()).toHaveLength(48);

    await user.click(screen.getByRole('button', { name: 'Następna strona' }));
    await waitFor(() => expect(found()).toHaveTextContent('strona 2 z 2'));
    expect(await cardNames()).toHaveLength(12);
    expect(window.location.hash).toBe('#/produkty?page=2');
    expect(screen.getByRole('button', { name: 'Strona 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Następna strona' })).toBeDisabled();

    await user.type(screen.getByRole('searchbox', { name: 'Szukaj produktu' }), 'produkt{Enter}');
    await waitFor(() => expect(window.location.hash).toBe('#/produkty?q=produkt'));
    expect(found()).toHaveTextContent('strona 1 z 2');
  });

  test('brak bazy w tej wersji: komunikat bez ponownej próby, która nic by nie dała', async () => {
    vi.mocked(loadedDataset).mockReturnValue(null);
    vi.mocked(loadDataset).mockRejectedValue(new Error(MISSING_DATA_MESSAGE));
    render(<ProductsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(MISSING_DATA_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
  });

  test('błąd sieci: „Spróbuj ponownie” pobiera bazę jeszcze raz', async () => {
    vi.mocked(loadedDataset).mockReturnValue(null);
    vi.mocked(loadDataset)
      .mockRejectedValueOnce(new Error('Nie udało się pobrać danych produktów. Sprawdź połączenie z internetem.'))
      .mockResolvedValue(LOADED);
    const user = userEvent.setup();
    render(<ProductsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie produktów…');
    expect(await screen.findByRole('alert')).toHaveTextContent('Sprawdź połączenie z internetem.');
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByText(/Znaleziono/)).toHaveTextContent('Znaleziono 6 produktów');
  });

  test('stopka podaje źródła, licencje i datę bazy', async () => {
    render(<ProductsPage />);
    const footer = await screen.findByRole('contentinfo');
    expect(footer).toHaveTextContent('licencja ODbL');
    expect(footer).toHaveTextContent('CC BY-SA');
    expect(footer).toHaveTextContent('Dane przygotowane 10 paź 2026, ceny pobrane 10 paź 2026.');
    expect(within(footer).getByRole('link', { name: 'Open Food Facts' })).toHaveAttribute('href', 'https://world.openfoodfacts.org');
    expect(within(footer).getByRole('link', { name: 'Open Prices' })).toHaveAttribute('href', 'https://prices.openfoodfacts.org');
  });
});

describe('pageNumbers', () => {
  test('pierwsza, ostatnia i sąsiedzi bieżącej, z przerwami', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(5, 20)).toEqual([1, 'gap', 3, 4, 5, 6, 7, 'gap', 20]);
    expect(pageNumbers(5, 20, 1)).toEqual([1, 'gap', 4, 5, 6, 'gap', 20]);
    expect(pageNumbers(2, 20, 0)).toEqual([1, 2, 'gap', 20]);
    expect(pageNumbers(20, 20, 0)).toEqual([1, 'gap', 20]);
  });
});
