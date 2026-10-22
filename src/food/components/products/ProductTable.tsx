import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { text } from '../../../i18n';
import { brandLine } from '../../lib/display';
import { formatGrams, formatNumber, UNKNOWN } from '../../lib/format';
import type { Sort, SortKey } from '../../lib/sort';
import type { Dictionaries, IndexedProduct, Nutrient } from '../../lib/types';
import { PriceTag } from '../common/PriceTag';
import { ProductImage } from '../common/ProductImage';
import { ScoreBadge } from '../common/ScoreBadge';

interface Props {
  products: IndexedProduct[];
  dict: Dictionaries;
  sort: Sort;
  onSort: (sort: Sort) => void;
  onOpen: (code: string) => void;
}

const T = text({
  pl: {
    protein: 'Białko',
    fat: 'Tłuszcz',
    carbs: 'Węglow.',
    sugars: 'Cukry',
    salt: 'Sól',
    table: 'Tabela produktów',
    name: 'Nazwa',
    price: 'Cena',
  },
  en: {
    protein: 'Protein',
    fat: 'Fat',
    carbs: 'Carbs',
    sugars: 'Sugars',
    salt: 'Salt',
    table: 'Product table',
    name: 'Name',
    price: 'Price',
  },
});

const NUTRIENT_COLUMNS: { key: Nutrient & SortKey; label: string }[] = [
  { key: 'protein', label: T.protein },
  { key: 'fat', label: T.fat },
  { key: 'carbs', label: T.carbs },
  { key: 'sugars', label: T.sugars },
  { key: 'salt', label: T.salt },
];

// Nowa kolumna zaczyna od kierunku, który częściej się przydaje.
const FIRST_DIR: Partial<Record<SortKey, 'asc' | 'desc'>> = { protein: 'desc', fiber: 'desc', popularity: 'desc' };

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (sort: Sort) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  const next: Sort = active
    ? { key: sortKey, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
    : { key: sortKey, dir: FIRST_DIR[sortKey] ?? 'asc' };
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button type="button" className={`fd-sorth${active ? ' on' : ''}`} onClick={() => onSort(next)}>
        {label}
        <Icon size={16} strokeWidth={2} aria-hidden />
      </button>
    </th>
  );
}

/**
 * Tabela do porównywania wartości: przewija się w bok wewnątrz kolumny, a nazwa produktu stoi
 * przyklejona z lewej, żeby przy przewijaniu było wiadomo, czyj to wiersz. Nagłówki sortują —
 * pierwsze stuknięcie w najprzydatniejszym kierunku, drugie odwraca.
 */
export function ProductTable({ products, dict, sort, onSort, onOpen }: Props) {
  return (
    <div className="fd-table-wrap" role="region" aria-label={T.table} tabIndex={0}>
      <table className="fd-table">
        <thead>
          <tr>
            <SortHeader label={T.name} sortKey="name" sort={sort} onSort={onSort} className="fd-col-name" />
            <SortHeader label="kcal" sortKey="kcal" sort={sort} onSort={onSort} />
            {NUTRIENT_COLUMNS.map((c) => (
              <SortHeader key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={onSort} />
            ))}
            <SortHeader label="Nutri-Score" sortKey="nutriscore" sort={sort} onSort={onSort} />
            <SortHeader label="NOVA" sortKey="nova" sort={sort} onSort={onSort} />
            <SortHeader label={T.price} sortKey="price" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.code} onClick={() => onOpen(p.code)}>
              <td className="fd-col-name">
                <div className="fd-row-name">
                  <ProductImage path={p.images.front} size={100} alt="" />
                  <div>
                    <button
                      type="button"
                      className="fd-row-open"
                      onClick={(e) => {
                        // Wiersz otwiera produkt sam; bez tego otwarcie poszłoby dwa razy.
                        e.stopPropagation();
                        onOpen(p.code);
                      }}
                    >
                      {p.name}
                    </button>
                    <span className="fd-row-meta">{[brandLine(p, dict), p.quantity].filter(Boolean).join(' · ')}</span>
                  </div>
                </div>
              </td>
              <td className="fd-num strong">{p.nutrition.kcal === null ? UNKNOWN : formatNumber(p.nutrition.kcal, 0)}</td>
              {NUTRIENT_COLUMNS.map((c) => (
                <td key={c.key} className="fd-num">
                  {formatGrams(p.nutrition[c.key])}
                </td>
              ))}
              <td>{p.nutriscore ? <ScoreBadge kind="nutriscore" value={p.nutriscore} /> : UNKNOWN}</td>
              <td>{p.nova ? <ScoreBadge kind="nova" value={p.nova} /> : UNKNOWN}</td>
              <td>{p.price ? <PriceTag price={p.price} /> : UNKNOWN}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
