import { brandLine } from '../../lib/display';
import { formatGrams, formatNumber, UNKNOWN } from '../../lib/format';
import type { Dictionaries, IndexedProduct, Product } from '../../lib/types';
import { onlineShop } from '../../online/shops';
import { PriceTag } from './PriceTag';
import { ProductImage } from './ProductImage';
import { ScoreBadge } from './ScoreBadge';
import './common.css';

interface Props {
  product: IndexedProduct;
  dict: Dictionaries;
  onOpen: (code: string) => void;
  /** Miejsce karty w konspekcie strony: h3 na liście produktów, h4 pod przepisem. */
  headingLevel?: 3 | 4;
}

/** Sklepy internetowe produktu po nazwie, bez powtórzeń: „GuiltFree, Diet-Food”. */
export function shopNames(p: Product, dict: Dictionaries): string {
  return [...new Set((p.online ?? []).map((o) => dict.stores[o.shop] ?? onlineShop(o.shop)?.name ?? o.shop))].join(', ');
}

/**
 * Karta produktu do siatki `.fd-grid`. Klikalna jest cała, ale PRZYCISKIEM jest tylko nazwa:
 * `<button>` może zawierać wyłącznie treść frazową, a przycisk owinięty wokół karty schowałby
 * nagłówek przed czytnikiem ekranu. Jego `::after` rozciąga się za to na całą kartę.
 */
export function ProductCard({ product: p, dict, onOpen, headingLevel = 3 }: Props) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const brand = brandLine(p, dict);
  const n = p.nutrition;

  return (
    <article className="fd-card">
      <ProductImage path={p.images.front} size={200} alt="" padded />
      <div className="fd-card-body">
        <Heading className="fd-card-name">
          <button type="button" className="fd-card-open" onClick={() => onOpen(p.code)}>
            {p.name}
          </button>
        </Heading>
        {(brand || p.quantity) && <p className="fd-card-meta">{[brand, p.quantity].filter(Boolean).join(' · ')}</p>}
        {p.online?.length ? (
          <p className="fd-card-online">Sklep internetowy: {shopNames(p, dict)}</p>
        ) : null}
        <p className="fd-card-kcal">
          {n.kcal === null ? UNKNOWN : formatNumber(n.kcal, 0)} <small>kcal / 100 g</small>
        </p>
        <dl className="fd-macros">
          <div className="protein">
            <dt>Białko</dt>
            <dd>{formatGrams(n.protein)}</dd>
          </div>
          <div>
            <dt>Tłuszcz</dt>
            <dd>{formatGrams(n.fat)}</dd>
          </div>
          <div>
            <dt>Węglow.</dt>
            <dd>{formatGrams(n.carbs)}</dd>
          </div>
        </dl>
        {(p.nutriscore || p.nova || p.price) && (
          <div className="fd-card-foot">
            <div className="fd-scores">
              {p.nutriscore && <ScoreBadge kind="nutriscore" value={p.nutriscore} />}
              {p.nova && <ScoreBadge kind="nova" value={p.nova} />}
            </div>
            {p.price && <PriceTag price={p.price} />}
          </div>
        )}
      </div>
    </article>
  );
}
