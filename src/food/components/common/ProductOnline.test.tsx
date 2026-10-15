// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { db } from '../../diet/db';
import { toggleTest } from '../../lib/filters';
import { indexProducts } from '../../lib/search';
import { DATASET, makeProduct } from '../../test/fixtures';
import { ProductCard } from './ProductCard';
import { ProductDetail } from './ProductDetail';

const dict = { ...DATASET.dictionaries, stores: { ...DATASET.dictionaries.stores, guiltfree: 'GuiltFree' } };

const [SYRUP] = indexProducts(
  [
    makeProduct({
      code: 'guiltfree-syrop-klonowy',
      name: 'Syrop zero klonowy',
      stores: ['guiltfree'],
      online: [{ shop: 'guiltfree', url: 'https://guiltfree.pl/products/syrop', price: 19.99, checked: '2026-10-13' }],
      shopOnly: true,
    }),
  ],
  {},
);
const [OFF_BAR] = indexProducts(
  [
    makeProduct({
      code: '5905279630123',
      name: 'Sztanga',
      stores: ['rossmann', 'fitiron'],
      online: [{ shop: 'fitiron', url: 'https://fitironsklep.pl/pl/p/sztanga/1', price: 7.4, checked: '2026-10-13' }],
    }),
  ],
  {},
);

describe('produkt ze sklepu internetowego', () => {
  test('karta mówi, w którym sklepie internetowym go kupisz', () => {
    render(<ProductCard product={SYRUP!} dict={dict} onOpen={() => {}} />);
    expect(screen.getByText('Sklep internetowy: GuiltFree')).toBeInTheDocument();
  });

  test('szczegóły: odnośnik do strony produktu z ceną i datą; bez kodu kreskowego i linku do OFF, gdy to nie produkt OFF', () => {
    render(<ProductDetail product={SYRUP!} dict={dict} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Syrop zero klonowy' });
    const link = within(dialog).getByRole('link', { name: /GuiltFree/ });
    expect(link).toHaveAttribute('href', 'https://guiltfree.pl/products/syrop');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(dialog).getByText(/19,99\s*zł · sprawdzone/)).toBeInTheDocument();
    expect(within(dialog).queryByText('Kod kreskowy')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: /Open Food Facts/ })).not.toBeInTheDocument();
  });

  test('produkt z OFF z ofertą sklepu zostaje produktem OFF — z kodem i linkiem, plus odnośnik do sklepu', () => {
    render(<ProductDetail product={OFF_BAR!} dict={dict} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Sztanga' });
    expect(within(dialog).getByText('5905279630123')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Open Food Facts/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /FitIron/ })).toHaveAttribute(
      'href',
      'https://fitironsklep.pl/pl/p/sztanga/1',
    );
  });

  test('filtr „W sklepach internetowych” bierze produkty sprzedawane w zarejestrowanym sklepie internetowym', () => {
    expect(toggleTest('online', SYRUP!)).toBe(true);
    expect(toggleTest('online', OFF_BAR!)).toBe(true);
    expect(toggleTest('online', makeProduct({ code: 'x', name: 'x', stores: ['biedronka'] }))).toBe(false);
  });

  test('gwiazdka w szczegółach dodaje produkt do ulubionych w jego opakowaniu', async () => {
    await db.favorites.clear();
    const user = userEvent.setup();
    const [SKYR] = indexProducts(
      [
        makeProduct({
          code: '777',
          name: 'Skyr',
          quantity: '150 g',
          nutrition: { kcal: 63, protein: 11, carbs: 4, fat: 0.2, sugars: 4, saturatedFat: null, fiber: null, salt: null },
        }),
      ],
      {},
    );
    render(<ProductDetail product={SKYR!} dict={dict} onClose={() => {}} />);
    const star = screen.getByRole('button', { name: 'Ulubione: Skyr' });
    await user.click(star);
    await waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'true'));
    expect(await db.favorites.get('product:777')).toMatchObject({ food: { amountLabel: '150 g', grams: 150 } });
  });

  test('produkt bez pełnych wartości nie ma gwiazdki — nie dałoby się go zapisać', () => {
    render(<ProductDetail product={OFF_BAR!} dict={dict} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /^Ulubione/ })).not.toBeInTheDocument();
  });
});
