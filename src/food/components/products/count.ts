import { formatNumber, plural } from '../../lib/format';

/** „1 produkt”, „3 produkty”, „29 412 produktów” — liczba z odmianą, w wierszu wyników i na przycisku filtrów. */
export function productsLabel(n: number): string {
  return `${formatNumber(n, 0)} ${plural(n, 'produkt', 'produkty', 'produktów')}`;
}
