import { pluralEn, text } from '../../../i18n';
import { formatNumber, plural } from '../../lib/format';

const T = text({
  pl: { products: (n: number) => plural(n, 'produkt', 'produkty', 'produktów') },
  en: { products: (n: number) => pluralEn(n, 'product', 'products') },
});

/** „1 produkt”, „3 produkty”, „29 412 produktów” — liczba z odmianą, w wierszu wyników i na przycisku filtrów. */
export function productsLabel(n: number): string {
  return `${formatNumber(n, 0)} ${T.products(n)}`;
}
