// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import { normalizeChain } from '../../restaurants/normalize';
import type { ChainData, MenuItemData } from '../../restaurants/types';
import { renderWithBridge } from '../../test/bridge';
import ChainPage from './ChainPage';
import RestaurantsPage from './RestaurantsPage';

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

// Menu z próbek zamiast prawdziwych plików: testy nie zależą od tego, co sieć zmieni w tabeli.
vi.mock('../../restaurants/catalog', () => ({
  CHAINS: [
    normalizeChain(
      chain('kfc', 'KFC', 'fast-food', [
        item('Zinger', { kcal: 480, protein: 26, carbs: 45, fat: 21, grams: 200, sugars: 5, salt: 2.1 }),
        item('Strips', { category: 'kurczak', portion: '3 szt.', kcal: 290, protein: 27, carbs: 14, fat: 14 }),
        item('Frytki', { category: 'dodatek', portion: 'średnie', kcal: 330, protein: 4, carbs: 42, fat: 16 }),
        // Kalorie z tabeli sieci nie zgadzają się z makro (z makro: 328 kcal).
        item('Honey', { kcal: 509, protein: 20, carbs: 30, fat: 14 }),
      ]),
    ),
    normalizeChain(
      chain(
        'costa',
        'Costa Coffee',
        'kawiarnia',
        [
          item('Latte', { category: 'kawa', portion: 'M', kcal: 150, protein: 9, carbs: 13, fat: 7 }),
          item('Flat White', { category: 'kawa', portion: 'S', kcal: 110, protein: 6, carbs: 9, fat: 5.5 }),
        ],
        'UK',
      ),
    ),
  ],
}));

const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);

beforeEach(async () => {
  await clearAll();
  at('#/lokale');
});

describe('Lokale', () => {
  test('chains grouped by kind, with their size and a market note', async () => {
    renderWithBridge(<RestaurantsPage />);
    const fast = await screen.findByRole('region', { name: 'Fast food' });
    expect(within(fast).getByRole('link', { name: /KFC.*4 pozycje/ })).toHaveAttribute('href', '#/lokale/kfc');
    const cafes = screen.getByRole('region', { name: 'Kawiarnie' });
    expect(within(cafes).getByRole('link', { name: /Costa Coffee.*dane z menu UK/ })).toBeInTheDocument();
  });

  test('search across chains keeps the query in the address and opens a position in a sheet', async () => {
    const user = userEvent.setup();
    renderWithBridge(<RestaurantsPage />);
    await user.type(await screen.findByRole('searchbox', { name: 'Szukaj w menu lokali' }), 'kfc strips');
    const results = await screen.findByRole('region', { name: 'Wyniki' });
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(1));
    expect(window.location.hash).toBe('#/lokale?q=kfc+strips');

    await user.click(within(results).getByRole('button', { name: /Strips/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Strips' });
    expect(window.location.hash).toBe('#/lokale?q=kfc+strips&p=kfc%2Fstrips');
    expect(within(sheet).getByRole('link', { name: 'Całe menu: KFC' })).toHaveAttribute('href', '#/lokale/kfc');
  });

  test('a query that matches nothing says so', async () => {
    const user = userEvent.setup();
    renderWithBridge(<RestaurantsPage />);
    await user.type(await screen.findByRole('searchbox'), 'sushi');
    expect(await screen.findByText(/Nic nie pasuje/)).toBeInTheDocument();
  });
});

describe('menu sieci', () => {
  test('source, protein picks without sides or doubtful numbers, categories and sort in the address', async () => {
    at('#/lokale/kfc');
    const user = userEvent.setup();
    renderWithBridge(<ChainPage chainId="kfc" />);
    expect(await screen.findByRole('heading', { level: 2, name: 'KFC' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tabela KFC' })).toHaveAttribute('href', 'https://example.com/kfc.pdf');

    // Strips mają najwięcej białka na kalorię; Honey (niezgodne liczby) i frytki nie są polecane.
    const top = screen.getByRole('region', { name: 'Najwięcej białka' });
    expect(within(top).getAllByRole('button').map((b) => b.textContent)).toEqual([
      expect.stringContaining('Strips'),
      expect.stringContaining('Zinger'),
    ]);

    await user.click(screen.getByRole('button', { name: 'Kurczak' }));
    const menu = screen.getByRole('region', { name: /Kurczak/ });
    expect(within(menu).getAllByRole('button')).toHaveLength(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Kolejność' }), 'kcal');
    expect(window.location.hash).toBe('#/lokale/kfc?kat=kurczak&sort=kcal');
  });

  test('a position the chain gets wrong is marked in the list and explained in its sheet', async () => {
    at('#/lokale/kfc');
    const user = userEvent.setup();
    renderWithBridge(<ChainPage chainId="kfc" />);
    const menu = await screen.findByRole('region', { name: /Menu/ });
    const honey = within(menu).getByRole('button', { name: /Honey/ });
    expect(honey).toHaveTextContent('liczby sieci się nie zgadzają');
    await user.click(honey);
    const sheet = await screen.findByRole('dialog', { name: 'Honey' });
    expect(within(sheet).getByRole('note')).toHaveTextContent('wychodzi ok. 326 kcal');
  });

  test('the sheet shows the table per portion and per 100 g, the diet verdict, and adds to today', async () => {
    await saveProfile(completeProfile({ dietProfile: 'redukcja' }));
    at('#/lokale/kfc?p=zinger');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<ChainPage chainId="kfc" />);
    const sheet = await screen.findByRole('dialog', { name: 'Zinger' });
    const table = within(sheet).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: '100 g' })).toBeInTheDocument();
    const protein = within(table).getByRole('row', { name: /Białko/ });
    expect(protein).toHaveTextContent('26 g');
    expect(protein).toHaveTextContent('13 g');
    // Błonnika sieć nie podaje: kreska, nie zero.
    expect(within(table).getByRole('row', { name: /Błonnik/ })).toHaveTextContent('—');
    expect(await within(sheet).findByText(/Redukcja wysokobiałkowa:/)).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: /Dodaj do dziennika/ }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith(expect.stringContaining('Zinger (KFC) · 480 kcal')));
    const [entry] = await db.entries.toArray();
    expect(entry).toMatchObject({ name: 'Zinger (KFC)', kcal: 480, protein: 26, source: 'restaurant', key: 'restaurant:kfc:zinger' });
  });

  test('an unknown chain in the address leads back to all of them', async () => {
    at('#/lokale/xyz');
    renderWithBridge(<ChainPage chainId="xyz" />);
    expect(await screen.findByText('Nie ma takiego lokalu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wszystkie lokale' })).toHaveAttribute('href', '#/lokale');
  });
});
