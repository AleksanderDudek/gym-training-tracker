import { ExternalLink } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { text } from '../../../i18n';
import { brandLine, names } from '../../lib/display';
import { formatDate, formatGrams, formatKcal, formatPrice } from '../../lib/format';
import { NUTRIENT_LABELS, PALM_OIL_LABELS, TRI_LABELS } from '../../lib/labels';
import { NUTRIENTS, type Dictionaries, type Product } from '../../lib/types';
import { onlineShop } from '../../online/shops';
import { PriceTag } from './PriceTag';
import { ProductImage } from './ProductImage';
import { ScoreBadge } from './ScoreBadge';
import { productFood } from '../../diet/foods';
import { CompareToggle } from './CompareToggle';
import { Sheet } from './Sheet';
import { StarButton } from './StarButton';
import { COMMON } from './text';
import './common.css';

const T = text({
  pl: {
    images: { front: 'Opakowanie', ingredients: 'Skład', nutrition: 'Wartości odżywcze' },
    vegan: (v: string) => `wegańskie: ${v}`,
    vegetarian: (v: string) => `wegetariańskie: ${v}`,
    photos: 'Zdjęcia',
    unknownShop: 'Sklep nieznany',
    promo: ' · promocja',
    latest: (n: number) => `Najnowsza z ${n} zgłoszonych cen.`,
    buyOnline: 'Kup w sklepie internetowym',
    producer: ' · strona producenta, kupisz w sklepach internetowych',
    checked: (date: string) => ` · sprawdzone ${date}`,
    onlineNote: 'Ceny i dostępność ze strony sklepu w dniu sprawdzenia — w sklepie mogą być inne.',
    chainPage: 'Karta produktu w sieci',
    chainNote: ' · skład, alergeny i dostępność w halach',
    about: 'Opis',
    category: (name: string) => `Kategoria: ${name}`,
    per100: 'Wartości odżywcze w 100 g',
    serving: (size: string) => `Porcja: ${size}`,
    mismatch:
      'Na stronie sklepu energia nie zgadza się z białkiem, węglowodanami i tłuszczem — zwykle przez poliole albo błonnik, czasem przez błąd. Pokazuję liczby tak, jak podaje sklep; do przepisów ten produkt nie trafia.',
    ingredients: 'Składniki',
    allergens: 'Alergeny',
    contains: (list: string) => `Zawiera: ${list}`,
    traces: (list: string) => `Może zawierać: ${list}`,
    additives: (n: number) => `Dodatki (${n})`,
    labels: 'Etykiety',
    diet: 'Dieta',
    stores: 'Sklepy',
    barcode: 'Kod kreskowy',
    off: 'Zobacz w Open Food Facts',
  },
  en: {
    images: { front: 'Pack', ingredients: 'Ingredients', nutrition: 'Nutrition facts' },
    vegan: (v: string) => `vegan: ${v}`,
    vegetarian: (v: string) => `vegetarian: ${v}`,
    photos: 'Photos',
    unknownShop: 'Unknown shop',
    promo: ' · on offer',
    latest: (n: number) => `The latest of ${n} reported prices.`,
    buyOnline: 'Buy in an online shop',
    producer: ' · producer’s site, sold in online shops',
    checked: (date: string) => ` · checked ${date}`,
    onlineNote: 'Prices and availability from the shop’s site on the day they were checked — the shop may differ.',
    chainPage: 'Product page on the chain’s site',
    chainNote: ' · ingredients, allergens and availability in stores',
    about: 'Description',
    category: (name: string) => `Category: ${name}`,
    per100: 'Nutrition facts per 100 g',
    serving: (size: string) => `Serving: ${size}`,
    mismatch:
      'On the shop’s site the energy doesn’t match the protein, carbs and fat — usually because of polyols or fibre, sometimes a mistake. The numbers are shown as the shop gives them; this product is left out of recipes.',
    ingredients: 'Ingredients',
    allergens: 'Allergens',
    contains: (list: string) => `Contains: ${list}`,
    traces: (list: string) => `May contain: ${list}`,
    additives: (n: number) => `Additives (${n})`,
    labels: 'Labels',
    diet: 'Diet',
    stores: 'Shops',
    barcode: 'Barcode',
    off: 'See it on Open Food Facts',
  },
});

interface Props {
  product: Product;
  dict: Dictionaries;
  /**
   * Zamknięcie przez użytkownika (×, Escape, tło). Strona trzymająca produkt w adresie (`p=`)
   * podaje tu `closeEntry`, więc zamknięcie cofa wpis historii, który otwarcie dodało.
   */
  onClose: () => void;
  /** „Pokaż porównanie” on a page that shows it itself; elsewhere the link goes to Produkty. */
  onShowCompare?: () => void;
}

const IMAGE_LABELS = T.images;
type ImageKind = keyof typeof IMAGE_LABELS;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fd-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Tags({ items }: { items: string[] }) {
  return (
    <ul className="fd-tags">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Karta produktu: arkusz na całą wysokość ekranu ze wszystkim, co baza o produkcie wie — zdjęcia,
 * oceny, cena, tabela wartości odżywczych, skład, alergeny, dodatki, etykiety i sklepy.
 * Montuje się otwarta; strona pokazuje ją, dopóki adres ma `p=`. Zamknięta przyciskiem Wstecz
 * (odmontowana) oddaje fokus karcie, z której ją otwarto — pilnuje tego `Sheet`.
 */
export function ProductDetail({ product: p, dict, onClose, onShowCompare }: Props) {
  const kinds = (Object.keys(IMAGE_LABELS) as ImageKind[]).filter((k) => p.images[k]);
  const [shown, setShown] = useState<ImageKind>(kinds[0] ?? 'front');

  const brand = brandLine(p, dict);
  const category = p.mainCategory ? (dict.categories[p.mainCategory] ?? p.mainCategory) : null;
  const allergens = names(dict, 'allergens', p.allergens);
  const traces = names(dict, 'allergens', p.traces);
  const diet = [
    p.vegan && T.vegan(TRI_LABELS[p.vegan]),
    p.vegetarian && T.vegetarian(TRI_LABELS[p.vegetarian]),
    p.palmOil && PALM_OIL_LABELS[p.palmOil],
  ].filter((x): x is string => !!x);
  const subtitle = [brand, p.quantity].filter(Boolean).join(' · ');
  const food = productFood(p, dict);

  return (
    <Sheet
      open
      full
      onClose={onClose}
      title={p.name}
      subtitle={subtitle || undefined}
      className="fd-detail"
      // Gwiazdka zapamiętuje produkt w jego opakowaniu; gramy zmienia się potem w „Dodaj zjedzone”.
      actions={food && <StarButton food={food} />}
    >
      <div className="fd-detail-media">
        <ProductImage path={p.images[shown]} size={400} alt={`${p.name} – ${IMAGE_LABELS[shown]}`} padded className="fd-detail-photo" />
        {kinds.length > 1 && (
          <div className="fd-thumbs" role="group" aria-label={T.photos}>
            {kinds.map((kind) => (
              <button key={kind} type="button" onClick={() => setShown(kind)} aria-pressed={shown === kind}>
                <ProductImage path={p.images[kind]} size={100} alt="" />
                {IMAGE_LABELS[kind]}
              </button>
            ))}
          </div>
        )}
        {(p.nutriscore || p.nova || p.ecoscore) && (
          <div className="fd-scores">
            {p.nutriscore && <ScoreBadge kind="nutriscore" value={p.nutriscore} size="md" />}
            {p.nova && <ScoreBadge kind="nova" value={p.nova} size="md" />}
            {p.ecoscore && <ScoreBadge kind="ecoscore" value={p.ecoscore} size="md" />}
          </div>
        )}
        {p.price && (
          <div className="fd-pricebox">
            <PriceTag price={p.price} />
            <p>
              {[p.price.store, p.price.city].filter(Boolean).join(', ') || T.unknownShop} · {formatDate(p.price.date)}
              {p.price.discounted && T.promo}
            </p>
            {p.price.count > 1 && <p>{T.latest(p.price.count)}</p>}
          </div>
        )}
      </div>

      {p.online && p.online.length > 0 && (
        <Block title={T.buyOnline}>
          <ul className="fd-offers">
            {p.online.map((o) => (
              <li key={o.url}>
                <a href={o.url} target="_blank" rel="noopener noreferrer">
                  {dict.stores[o.shop] ?? onlineShop(o.shop)?.name ?? o.shop}
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                  <span className="sr-only">{COMMON.newTab}</span>
                </a>
                <span className="soft">
                  {onlineShop(o.shop)?.kind === 'producent' && T.producer}
                  {o.price !== null && <> · {formatPrice(o.price)}</>}
                  {T.checked(formatDate(o.checked))}
                </span>
              </li>
            ))}
          </ul>
          <p className="soft small">{T.onlineNote}</p>
        </Block>
      )}

      {p.pages && p.pages.length > 0 && (
        <Block title={T.chainPage}>
          <ul className="fd-offers">
            {p.pages.map((page) => (
              <li key={page.url}>
                <a href={page.url} target="_blank" rel="noopener noreferrer">
                  {dict.stores[page.store] ?? page.store}
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                  <span className="sr-only">{COMMON.newTab}</span>
                </a>
                <span className="soft">{T.chainNote}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(p.genericName || category) && (
        <Block title={T.about}>
          {p.genericName && <p>{p.genericName}</p>}
          {category && <p className="soft">{T.category(category)}</p>}
        </Block>
      )}

      <Block title={T.per100}>
        <table className="fd-nutri">
          <tbody>
            {NUTRIENTS.map((key) => (
              <tr key={key} className={key === 'saturatedFat' || key === 'sugars' ? 'nested' : undefined}>
                <th scope="row">{NUTRIENT_LABELS[key]}</th>
                <td>{key === 'kcal' ? formatKcal(p.nutrition.kcal) : formatGrams(p.nutrition[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {p.servingSize && <p className="soft small">{T.serving(p.servingSize)}</p>}
        {p.labelMismatch && <p className="soft small">{T.mismatch}</p>}
        <CompareToggle product={p} dict={dict} onShow={onShowCompare} />
      </Block>

      {p.ingredientsText && (
        <Block title={T.ingredients}>
          <p>{p.ingredientsText}</p>
        </Block>
      )}

      {(allergens.length > 0 || traces.length > 0) && (
        <Block title={T.allergens}>
          {allergens.length > 0 && <p>{T.contains(allergens.join(', '))}</p>}
          {traces.length > 0 && <p className="soft">{T.traces(traces.join(', '))}</p>}
        </Block>
      )}

      {p.additives.length > 0 && (
        <Block title={T.additives(p.additives.length)}>
          <Tags items={names(dict, 'additives', p.additives)} />
        </Block>
      )}

      {p.labels.length > 0 && (
        <Block title={T.labels}>
          <Tags items={names(dict, 'labels', p.labels)} />
        </Block>
      )}

      {diet.length > 0 && (
        <Block title={T.diet}>
          <p>{diet.join(' · ')}</p>
        </Block>
      )}

      {p.stores.length > 0 && (
        <Block title={T.stores}>
          <p>{names(dict, 'stores', p.stores).join(', ')}</p>
        </Block>
      )}

      {/* Produkt tylko ze sklepu internetowego, bez EAN, ma kod z nazwy strony — to nie kod kreskowy. */}
      {/^\d+$/.test(p.code) && (
        <Block title={T.barcode}>
          <p className="fd-code">{p.code}</p>
        </Block>
      )}

      {!p.shopOnly && (
        <a
          className="fd-extlink"
          href={`https://pl.openfoodfacts.org/produkt/${encodeURIComponent(p.code)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {T.off} <ExternalLink size={16} strokeWidth={2} aria-hidden />
          <span className="sr-only">{COMMON.newTab}</span>
        </a>
      )}
    </Sheet>
  );
}
