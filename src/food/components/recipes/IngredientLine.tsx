import { ArrowLeftRight, ExternalLink, Info } from 'lucide-react';
import { text } from '../../../i18n';
import { brandLine } from '../../lib/display';
import { formatNumber } from '../../lib/format';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { isOnlineShop, onlineShop } from '../../online/shops';
import type { Basket, ResolvedItem } from '../../recipes/resolve';
import { COMMON } from '../common/text';

const T = text({
  pl: {
    atHome: 'masz w domu',
    anyShop: 'w każdym sklepie · wartości typowe',
    otherShop: 'z innego sklepu',
    protein: (g: string) => `${g} g białka/100 g`,
    swapLabel: (name: string) => `Zamień: ${name}`,
    swap: 'Zamień',
    detailsLabel: (name: string) => `Szczegóły: ${name}`,
    details: 'Szczegóły produktu',
    producer: 'producent, kupisz online',
    online: 'sklep internetowy',
    from: (shop: string) => `z: ${shop}`,
  },
  en: {
    atHome: 'you have it at home',
    anyShop: 'in any shop · typical values',
    otherShop: 'from another shop',
    protein: (g: string) => `${g} g protein/100 g`,
    swapLabel: (name: string) => `Swap: ${name}`,
    swap: 'Swap',
    detailsLabel: (name: string) => `Details: ${name}`,
    details: 'Product details',
    producer: 'producer, buy online',
    online: 'online shop',
    from: (shop: string) => `from: ${shop}`,
  },
});

interface Props {
  resolved: ResolvedItem;
  /** Koszyk karty; null: produkty z dowolnego sklepu. */
  basket: Basket | null;
  dict: Dictionaries;
  /** Otwiera arkusz zamiany dla tego składnika. */
  onSwap: () => void;
  onOpenProduct: (code: string) => void;
}

/** Ile zamienników pokazuje arkusz — dalej są produkty, których i tak nikt nie szuka na półce. */
const MAX_OPTIONS = 25;

/** Skąd jest produkt w tej linijce, w kilku słowach — albo nic, gdy to zwykły produkt ze sklepu. */
export function sourceNote({ def, product, fromStore }: ResolvedItem, basket: Basket | null): string | null {
  if (def.role === 'pantry') return product && fromStore ? null : T.atHome;
  if (!product) return def.role === 'staple' ? T.anyShop : null;
  if (basket?.length && !fromStore) return T.otherShop;
  return null;
}

/** Strona produktu w sklepie internetowym, z którego idzie — albo strona sklepu, gdy produkt jej nie ma. */
export function offerUrl(resolved: ResolvedItem): string | null {
  const { product, shop } = resolved;
  if (!product || !shop || !isOnlineShop(shop)) return null;
  return product.online?.find((o) => o.shop === shop)?.url ?? onlineShop(shop)?.url ?? null;
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
  return T.protein(formatNumber(p.nutrition.protein ?? 0));
}

/** Składnik przepisu: ilość, produkt, który go gra, zamiana i karta produktu. */
export function IngredientLine({ resolved, basket, dict, onSwap, onOpenProduct }: Props) {
  const { item, def, product, grams, shop } = resolved;
  const note = sourceNote(resolved, basket);
  const offer = offerUrl(resolved);
  const shopName = shop ? (dict.stores[shop] ?? onlineShop(shop)?.name ?? shop) : null;
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
                aria-label={T.swapLabel(def.label)}
              >
                <ArrowLeftRight size={16} strokeWidth={2} aria-hidden />
                {T.swap}
              </button>
            )}
            <button
              type="button"
              className="fd-rec-ing-info"
              onClick={() => onOpenProduct(product.code)}
              aria-label={T.detailsLabel(product.name)}
              title={T.details}
            >
              <Info size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      )}
      {offer && shopName && (
        <span className="fd-rec-ing-note">
          {onlineShop(shop!)?.kind === 'producent' ? T.producer : T.online} ·{' '}
          <a href={offer} target="_blank" rel="noopener noreferrer">
            {shopName}
            <ExternalLink size={12} strokeWidth={2} aria-hidden />
            <span className="sr-only">{COMMON.newTab}</span>
          </a>
        </span>
      )}
      {!offer && shopName && basket && basket.length > 1 && <span className="fd-rec-ing-note">{T.from(shopName)}</span>}
      {note && <span className="fd-rec-ing-note">{note}</span>}
    </li>
  );
}
