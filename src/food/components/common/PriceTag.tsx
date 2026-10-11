import { formatPrice } from '../../lib/format';
import type { Price } from '../../lib/types';
import './common.css';

/**
 * Cena z Open Prices: kwota, „/kg” przy cenie za kilogram i przekreślona cena regularna przy
 * promocji. Promocję niesie też słowo dla czytnika ekranu — sam kolor i przekreślenie by nie wystarczyły.
 */
export function PriceTag({ price, className = '' }: { price: Price; className?: string }) {
  return (
    <span className={`fd-price${price.discounted ? ' promo' : ''}${className ? ` ${className}` : ''}`}>
      <b>{formatPrice(price.value)}</b>
      {price.perKg && <small>/kg</small>}
      {price.regularValue !== null && (
        <>
          <span className="sr-only">, przed obniżką</span>
          <s>{formatPrice(price.regularValue)}</s>
        </>
      )}
    </span>
  );
}
