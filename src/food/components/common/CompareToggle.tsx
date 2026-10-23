import { Check, ChevronRight, Scale } from 'lucide-react';
import { text } from '../../../i18n';
import { PRODUCTS_PATH } from '../../../routing';
import { compare, useCompare } from '../../hooks/useCompare';
import type { Dictionaries, Product } from '../../lib/types';
import { itemFromProduct } from '../../scan/compare';
import './common.css';

const T = text({
  pl: {
    compare: 'Porównaj',
    label: (name: string) => `Porównaj: ${name}`,
    show: (n: number) => `Pokaż porównanie (${n})`,
  },
  en: {
    compare: 'Compare',
    label: (name: string) => `Compare: ${name}`,
    show: (n: number) => `Show the comparison (${n})`,
  },
});

interface Props {
  product: Product;
  dict: Dictionaries;
  /** The page shows the comparison itself (Produkty); elsewhere a link leads there. */
  onShow?: () => void;
}

/**
 * „Porównaj” on a product card: the same comparison the scanner fills, for a product found by its
 * name. A switch with a fixed name (`aria-pressed`), so a screen reader says the state; the link
 * to the comparison appears once there is something in it.
 */
export function CompareToggle({ product, dict, onShow }: Props) {
  const { items } = useCompare();
  const on = items.some((i) => i.code === product.code);
  return (
    <div className="fd-cmp">
      <button
        type="button"
        className="btn ghost sm"
        aria-pressed={on}
        aria-label={T.label(product.name)}
        onClick={() => (on ? compare.remove(product.code) : compare.add(itemFromProduct(product, dict, Date.now())))}
      >
        {on ? <Check size={18} strokeWidth={2} aria-hidden /> : <Scale size={18} strokeWidth={2} aria-hidden />}
        {T.compare}
      </button>
      {items.length > 0 &&
        (onShow ? (
          <button type="button" className="btn ghost sm" onClick={onShow}>
            {T.show(items.length)} <ChevronRight size={16} strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <a className="btn ghost sm" href={`${PRODUCTS_PATH}?skan=lista`}>
            {T.show(items.length)} <ChevronRight size={16} strokeWidth={2} aria-hidden />
          </a>
        ))}
    </div>
  );
}
