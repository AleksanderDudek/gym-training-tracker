// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { toggleTest } from '../../lib/filters';
import { indexProducts } from '../../lib/search';
import { DATASET, makeProduct } from '../../test/fixtures';
import { DataFooter } from './DataFooter';
import { ProductDetail } from './ProductDetail';

const dict = { ...DATASET.dictionaries, stores: { ...DATASET.dictionaries.stores, selgros: 'Selgros' } };
const PAGE = 'https://www.selgros.pl/znajdz-produkt/product/339221';

const [FROM_CHAIN] = indexProducts(
  [
    makeProduct({
      code: '5902899143835',
      name: 'Almette śmietankowy bez laktozy',
      stores: ['selgros'],
      pages: [{ store: 'selgros', url: PAGE }],
      price: { value: 5.19, currency: 'PLN', date: '2026-10-16', store: 'Selgros', city: 'Kraków', perKg: false, discounted: false, regularValue: null, count: 1 },
      shopOnly: true,
    }),
  ],
  {},
);
const [OFF_TOO] = indexProducts(
  [
    makeProduct({
      code: '5900512320019',
      name: 'Skyr naturalny',
      stores: ['biedronka', 'selgros'],
      pages: [{ store: 'selgros', url: 'https://www.selgros.pl/znajdz-produkt/product/1' }],
    }),
  ],
  {},
);

describe('produkt z sieci z własnymi danymi (Selgros)', () => {
  test('szczegóły: kod kreskowy, cena z hali i odnośnik do karty produktu w sieci; bez linku do OFF', () => {
    render(<ProductDetail product={FROM_CHAIN!} dict={dict} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Almette śmietankowy bez laktozy' });
    expect(within(dialog).getByText('Karta produktu w sieci')).toBeInTheDocument();
    const link = within(dialog).getByRole('link', { name: /^Selgros/ });
    expect(link).toHaveAttribute('href', PAGE);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(dialog).getByText('5902899143835')).toBeInTheDocument();
    expect(within(dialog).getByText(/Selgros, Kraków/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: /Open Food Facts/ })).not.toBeInTheDocument();
  });

  test('produkt z OFF sprzedawany też w Selgrosie zostaje produktem OFF — z linkiem do OFF i do karty w sieci', () => {
    render(<ProductDetail product={OFF_TOO!} dict={dict} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Skyr naturalny' });
    expect(within(dialog).getByRole('link', { name: /Open Food Facts/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /^Selgros/ })).toHaveAttribute(
      'href',
      'https://www.selgros.pl/znajdz-produkt/product/1',
    );
  });

  test('sieć to sklep stacjonarny: nie wpada do filtra „W sklepach internetowych”', () => {
    expect(toggleTest('online', FROM_CHAIN!)).toBe(false);
  });

  test('stopka podaje źródło danych sieci', () => {
    render(<DataFooter />);
    expect(screen.getByText(/Produkty sieci Selgros: nazwy, EAN, wartości odżywcze, alergeny i ceny/)).toBeInTheDocument();
  });
});
