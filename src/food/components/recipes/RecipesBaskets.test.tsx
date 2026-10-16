// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadDataset, loadedDataset, type LoadedDataset } from '../../data';
import { indexProducts } from '../../lib/search';
import type { Dataset, Nutrition } from '../../lib/types';
import { DATASET, makeProduct } from '../../test/fixtures';
import RecipesPage from './RecipesPage';

vi.mock('../../data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data')>()),
  loadDataset: vi.fn(),
  loadedDataset: vi.fn(),
}));

function n(kcal: number, protein: number, carbs: number, fat: number, sugars = 1): Nutrition {
  return { kcal, protein, carbs, fat, sugars, saturatedFat: null, fiber: null, salt: null };
}

// Pizza keto: spód z BeKeto, pepperoni z Bezmięsnego — dwa sklepy internetowe. Kabanosy z serkiem:
// serek z Biedronki, kabanosy z Bezmięsnego — sklep i zamówienie.
const BASE = makeProduct({
  code: 'base',
  name: 'Włoski Keto Spód do Pizzy',
  quantity: '100 g',
  nutrition: n(250, 15, 10, 10),
  stores: ['beketo'],
  online: [{ shop: 'beketo', url: 'https://beketo.pl/produkt/spod', price: 18.99, checked: '2026-10-13' }],
});
const PEPPERONI = makeProduct({
  code: 'pep',
  name: 'Bezmięsne Pepperoni',
  categories: ['en:plant-based-foods', 'en:meat-analogues'],
  nutrition: n(222, 32.4, 10, 5.2),
  stores: ['bezmiesny'],
  online: [
    { shop: 'bezmiesny', url: 'https://bezmiesnymiesny.pl/pl/p/pepperoni/1', price: 9.99, checked: '2026-10-13' },
  ],
});
const COTTAGE = makeProduct({
  code: 'cot',
  name: 'Serek wiejski',
  categories: ['en:cottage-cheeses'],
  nutrition: n(97, 11, 2, 5, 2),
  stores: ['biedronka'],
  popularity: 5,
});
// Racuchy: skyr z Biedronki (próbki), mieszanka na białkowe naleśniki z Myproteinu.
const PANCAKE_MIX = makeProduct({
  code: 'mix',
  name: 'Mieszanka na Białkowe Naleśniki',
  nutrition: n(380, 50, 30, 6),
  stores: ['myprotein'],
  online: [{ shop: 'myprotein', url: 'https://www.myprotein.pl/p/mix/1', price: 59.99, checked: '2026-10-14' }],
});
const DATA: Dataset = { ...DATASET, products: [...DATASET.products, BASE, PEPPERONI, COTTAGE, PANCAKE_MIX] };
const LOADED: LoadedDataset = { dataset: DATA, products: indexProducts(DATA.products, DATA.dictionaries.brands) };

function cardFor(name: string): HTMLElement {
  const card = screen.getByRole('heading', { name }).closest('article');
  if (!card) throw new Error(`Brak karty ${name}`);
  return card;
}

beforeEach(() => {
  window.history.replaceState(null, '', '#/przepisy');
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
});

describe('Przepisy z produktami sklepów internetowych', () => {
  test('karta mówi, w których dwóch sklepach kupisz wszystko, z odnośnikami do sklepów internetowych', async () => {
    render(<RecipesPage />);
    await screen.findByRole('heading', { level: 2, name: 'Przepisy białkowe' });
    const pizza = cardFor('Pizza na keto spodzie z roślinnym pepperoni');
    expect(within(pizza).getByText(/Kupisz w 2 sklepach:/)).toBeInTheDocument();
    // Linia sklepów prowadzi do sklepów, linijka składnika — do strony produktu w sklepie.
    const hrefs = within(pizza)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        'https://beketo.pl',
        'https://bezmiesnymiesny.pl',
        'https://beketo.pl/produkt/spod',
        'https://bezmiesnymiesny.pl/pl/p/pepperoni/1',
      ]),
    );
    for (const link of within(pizza).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(within(pizza).getAllByText('(sklep internetowy)')).toHaveLength(2);

    // Bez sklepu stacjonarnego w koszyku karta mówi, które podstawy kupić gdziekolwiek.
    expect(
      within(pizza).getByText(/passata pomidorowa, parmezan lub grana padano w dowolnym sklepie/),
    ).toBeInTheDocument();

    const kabanosy = cardFor('Roślinne kabanosy i serek wiejski');
    expect(within(kabanosy).getByText(/Kupisz w 2 sklepach: Biedronka \+/)).toBeInTheDocument();
  });

  test('klasyk z produktem ze sklepu internetowego: sklep i zamówienie, a angielski tytuł źródła po angielsku', async () => {
    render(<RecipesPage />);
    await screen.findByRole('heading', { level: 2, name: 'Przepisy białkowe' });
    const racuchy = cardFor('Białkowe racuchy z jabłkami');
    expect(within(racuchy).getByText(/Kupisz w 2 sklepach: Biedronka \+/)).toBeInTheDocument();
    expect(within(racuchy).getByText('(sklep internetowy)')).toBeInTheDocument();
    expect(within(racuchy).getByText('Racuszki (Polish Pancakes)')).toHaveAttribute('lang', 'en');
    expect(within(racuchy).getByRole('link', { name: /Racuszki/ })).toHaveAttribute(
      'href',
      'https://en.wikibooks.org/wiki/Cookbook:Racuszki_(Polish_Pancakes)',
    );
  });

  test('„Według sklepów” zbiera przepisy w plany zakupów, a układ stoi w adresie', async () => {
    const user = userEvent.setup();
    render(<RecipesPage />);
    await screen.findByRole('heading', { level: 2, name: 'Przepisy białkowe' });
    await user.click(screen.getByRole('button', { name: 'Według sklepów' }));
    expect(window.location.hash).toBe('#/przepisy?uklad=sklepy');

    const groups = screen.getAllByRole('heading', { level: 3 }).filter((h) => h.closest('.fd-rec-group-head'));
    // Przepisy w grupie są o poziom niżej niż nazwa grupy.
    expect(
      screen.getByRole('heading', { level: 4, name: 'Pizza na keto spodzie z roślinnym pepperoni' }),
    ).toBeInTheDocument();
    const names = groups.map((h) => h.textContent);
    expect(names.some((t) => /BeKeto.*\+.*Bezmięsny Mięsny/.test(t ?? ''))).toBe(true);
    expect(names.at(-1)).toBe('Składniki w każdym sklepie');
    expect(screen.getByText(/dwa zamówienia przez internet \+ podstawy z dowolnego sklepu/)).toBeInTheDocument();
  });

  test('żeton sklepu internetowego zostawia przepisy z jego produktami', async () => {
    const user = userEvent.setup();
    render(<RecipesPage />);
    const stores = await screen.findByRole('group', { name: 'Sklep' });
    await user.click(within(stores).getByRole('button', { name: /BeKeto · online/ }));
    expect(window.location.hash).toBe('#/przepisy?sklep=beketo');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Pizza na keto spodzie z roślinnym pepperoni' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Roślinne kabanosy i serek wiejski' }),
    ).not.toBeInTheDocument();
  });
});
