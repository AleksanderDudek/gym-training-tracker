import { ArrowLeftRight, Info } from 'lucide-react';
import { brandLine } from '../../lib/display';
import { formatNumber } from '../../lib/format';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import type { ResolvedItem } from '../../recipes/resolve';

interface Props {
  resolved: ResolvedItem;
  store: string | null;
  dict: Dictionaries;
  /** Otwiera arkusz zamiany dla tego składnika. */
  onSwap: () => void;
  onOpenProduct: (code: string) => void;
}

/** Ile zamienników pokazuje arkusz — dalej są produkty, których i tak nikt nie szuka na półce. */
const MAX_OPTIONS = 25;

/** Skąd jest produkt w tej linijce, w kilku słowach — albo nic, gdy to zwykły produkt ze sklepu. */
export function sourceNote({ def, product, fromStore }: ResolvedItem, store: string | null): string | null {
  if (def.role === 'pantry') return product && fromStore ? null : 'masz w domu';
  if (!product) return def.role === 'staple' ? 'w każdym sklepie · wartości typowe' : null;
  if (store && !fromStore) return 'z innego sklepu';
  return null;
}

/**
 * Lista do zamiany: stała kolejność (najpopularniejsze najpierw) i zawsze z wybranym produktem,
 * więc wybór jest jedną z pozycji, a strzałki idą po liście po kolei, zamiast przeskakiwać.
 */
export function swapOptions({ alternatives, product }: ResolvedItem): IndexedProduct[] {
  const options = alternatives.slice(0, MAX_OPTIONS);
  if (product && !options.includes(product)) options.push(product);
  return options;
}

export function proteinLine(p: IndexedProduct): string {
  return `${formatNumber(p.nutrition.protein ?? 0)} g białka/100 g`;
}

/** Składnik przepisu: ilość, produkt, który go gra, zamiana i karta produktu. */
export function IngredientLine({ resolved, store, dict, onSwap, onOpenProduct }: Props) {
  const { item, def, product, grams } = resolved;
  const note = sourceNote(resolved, store);
  const canSwap = swapOptions(resolved).length > 1;
  const brand = product ? brandLine(product, dict) : '';

  return (
    <li className="fd-rec-ing">
      <div className="fd-rec-ing-head">
        <span className="fd-rec-ing-name">{def.label}</span>
        <span className="fd-rec-ing-amt">
          {item.measure ? `${item.measure} · ` : ''}
          {formatNumber(grams, 0)}&nbsp;g
        </span>
      </div>
      {product && (
        <div className="fd-rec-ing-prod">
          <p className="fd-rec-ing-pick">
            <span className="fd-rec-ing-pname">{product.name}</span>
            {brand && <span className="fd-rec-ing-brand"> · {brand}</span>}
            <span className="fd-rec-ing-protein"> – {proteinLine(product)}</span>
          </p>
          <div className="fd-rec-ing-actions">
            {canSwap && (
              <button
                type="button"
                className="fd-rec-ing-swap"
                onClick={onSwap}
                aria-haspopup="dialog"
                aria-label={`Zamień: ${def.label}`}
              >
                <ArrowLeftRight size={16} strokeWidth={2} aria-hidden />
                Zamień
              </button>
            )}
            <button
              type="button"
              className="fd-rec-ing-info"
              onClick={() => onOpenProduct(product.code)}
              aria-label={`Szczegóły: ${product.name}`}
              title="Szczegóły produktu"
            >
              <Info size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      )}
      {note && <span className="fd-rec-ing-note">{note}</span>}
    </li>
  );
}
