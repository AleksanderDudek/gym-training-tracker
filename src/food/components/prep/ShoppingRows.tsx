import { Check, ExternalLink, Snowflake } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { text } from '../../../i18n';
import { formatPrice } from '../../lib/format';
import { AISLE_LABELS } from '../../prep/aisles';
import { gramsLabel, shortDate } from '../../prep/format';
import { amountText, itemName, priceSum, pricedEnough } from '../../prep/shopping';
import type { PrepShop, ShoppingItem } from '../../prep/types';
import { COMMON } from '../common/text';

const T = text({
  pl: {
    list: 'Lista zakupów',
    copied: 'Lista skopiowana — wklej ją, gdzie chcesz.',
    shareFailed: 'Nie udało się udostępnić listy.',
    sum: (price: string) => `Ok. ${price}`,
    known: (known: number, all: number) => ` (ceny znane dla ${known} z ${all} pozycji)`,
    shop: (name: string) => `Sklep ${name}`,
    about: (price: string) => ` · ok. ${price}`,
    freeze: (grams: string, date: string) => `zamroź ${grams} na ${date}`,
    page: (name: string) => `Strona produktu: ${name}`,
  },
  en: {
    list: 'Shopping list',
    copied: 'List copied — paste it wherever you like.',
    shareFailed: 'Couldn’t share the list.',
    sum: (price: string) => `About ${price}`,
    known: (known: number, all: number) => ` (prices known for ${known} of ${all} items)`,
    shop: (name: string) => `${name} website`,
    about: (price: string) => ` · about ${price}`,
    freeze: (grams: string, date: string) => `freeze ${grams} for ${date}`,
    page: (name: string) => `Product page: ${name}`,
  },
});

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

/** Lista tekstem: okno udostępniania telefonu, a bez niego schowek. */
export async function shareList(text: string, toast: (message: string) => void): Promise<void> {
  try {
    if (navigator.share) {
      await navigator.share({ title: T.list, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast(T.copied);
  } catch (e) {
    // Zamknięte okno udostępniania to nie błąd; brak schowka — tak.
    if (e instanceof DOMException && e.name === 'AbortError') return;
    toast(T.shareFailed);
  }
}

/** Jak wiersz mówi, ile wziąć, i co dopisuje pod nazwą — lista z planu i lista z dziennika różnią się tylko tym. */
export interface RowText<I extends ShoppingItem> {
  amount?: (item: I) => string;
  note?: (item: I) => string | null;
}

interface GroupProps<I extends ShoppingItem> extends RowText<I> {
  id: string;
  title: string;
  lead?: ReactNode;
  shop?: PrepShop;
  items: I[];
  bought: ReadonlySet<string>;
  onTick: (key: string, on: boolean) => void;
  /** Headings by aisle: one walk through the shop. */
  aisles?: boolean;
}

/** Grupa listy zakupów: tytuł, suma cen (gdy coś mówi), wiersze do odhaczania, dział po dziale. */
export function Group<I extends ShoppingItem>({ id, title, lead, shop, items, bought, onTick, aisles = false, amount, note }: GroupProps<I>) {
  if (!items.length) return null;
  const sum = priceSum(items);
  return (
    <section className="grp" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {lead && <p className="tight">{lead}</p>}
      {pricedEnough(sum) && (
        <p className="tight fd-prep-nums">
          {T.sum(formatPrice(sum.total))}
          {sum.unknown > 0 && T.known(sum.known, items.length)}
        </p>
      )}
      {shop?.url && (
        <p className="tight">
          <a href={shop.url} target="_blank" rel="noopener noreferrer">
            {T.shop(shop.name)}
            <ExternalLink size={14} strokeWidth={2} aria-hidden />
            <span className="sr-only">{COMMON.newTab}</span>
          </a>
        </p>
      )}
      <Rows items={items} bought={bought} onTick={onTick} aisles={aisles} amount={amount} note={note} />
    </section>
  );
}

interface RowsProps<I extends ShoppingItem> extends RowText<I> {
  items: I[];
  bought: ReadonlySet<string>;
  onTick: (key: string, on: boolean) => void;
  aisles?: boolean;
}

/** Same wiersze — także w zwiniętej grupie, która ma własny nagłówek. */
export function Rows<I extends ShoppingItem>({ items, bought, onTick, aisles = false, amount, note }: RowsProps<I>) {
  return (
    <ul className="fd-prep-list">
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {aisles && item.aisle !== items[i - 1]?.aisle && (
            <li className="fd-prep-aisle">
              <h3>{AISLE_LABELS[item.aisle]}</h3>
            </li>
          )}
          <Item item={item} done={bought.has(item.key)} onTick={onTick} amount={amount} note={note} />
        </Fragment>
      ))}
    </ul>
  );
}

interface ItemProps<I extends ShoppingItem> extends RowText<I> {
  item: I;
  done: boolean;
  onTick: (key: string, on: boolean) => void;
}

function Item<I extends ShoppingItem>({ item, done, onTick, amount = amountText, note }: ItemProps<I>) {
  const name = itemName(item);
  const extra = note?.(item);
  return (
    <li className={`fd-prep-item${done ? ' fd-prep-done' : ''}`}>
      <label>
        <input type="checkbox" checked={done} onChange={(e) => onTick(item.key, e.target.checked)} />
        <span className="fd-prep-item-main">
          <span className="fd-prep-name">
            {done && <Check size={16} strokeWidth={2} aria-hidden className="fd-prep-tick" />}
            {name}
          </span>
          <span className="fd-prep-meta">
            {amount(item)}
            {item.product && item.product.name !== item.label && ` · ${item.label}`}
            {item.product?.brand && ` · ${item.product.brand}`}
            {item.price !== null && T.about(formatPrice(item.price))}
            {extra && ` · ${extra}`}
          </span>
          {item.freeze.map((f) => (
            <span key={f.date} className="fd-prep-meta fd-prep-cold">
              <Snowflake size={14} strokeWidth={2} aria-hidden /> {T.freeze(gramsLabel(f.grams), shortDate(f.date))}
            </span>
          ))}
        </span>
      </label>
      {item.product?.url && (
        <a className="fd-prep-link" href={item.product.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink {...ICON} />
          <span className="sr-only">
            {T.page(name)}
            {COMMON.newTab}
          </span>
        </a>
      )}
    </li>
  );
}
