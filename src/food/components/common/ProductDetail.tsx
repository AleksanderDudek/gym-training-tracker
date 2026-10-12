import { ExternalLink } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { brandLine, names } from '../../lib/display';
import { formatDate, formatGrams, formatKcal, formatPrice } from '../../lib/format';
import { NUTRIENT_LABELS, PALM_OIL_LABELS, TRI_LABELS } from '../../lib/labels';
import { NUTRIENTS, type Dictionaries, type Product } from '../../lib/types';
import { PriceTag } from './PriceTag';
import { ProductImage } from './ProductImage';
import { ScoreBadge } from './ScoreBadge';
import { Sheet } from './Sheet';
import './common.css';

interface Props {
  product: Product;
  dict: Dictionaries;
  /**
   * Zamknięcie przez użytkownika (×, Escape, tło). Strona trzymająca produkt w adresie (`p=`)
   * podaje tu `closeEntry`, więc zamknięcie cofa wpis historii, który otwarcie dodało.
   */
  onClose: () => void;
}

const IMAGE_LABELS = { front: 'Opakowanie', ingredients: 'Skład', nutrition: 'Wartości odżywcze' } as const;
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
export function ProductDetail({ product: p, dict, onClose }: Props) {
  const kinds = (Object.keys(IMAGE_LABELS) as ImageKind[]).filter((k) => p.images[k]);
  const [shown, setShown] = useState<ImageKind>(kinds[0] ?? 'front');

  const brand = brandLine(p, dict);
  const category = p.mainCategory ? (dict.categories[p.mainCategory] ?? p.mainCategory) : null;
  const allergens = names(dict, 'allergens', p.allergens);
  const traces = names(dict, 'allergens', p.traces);
  const diet = [
    p.vegan && `wegańskie: ${TRI_LABELS[p.vegan]}`,
    p.vegetarian && `wegetariańskie: ${TRI_LABELS[p.vegetarian]}`,
    p.palmOil && PALM_OIL_LABELS[p.palmOil],
  ].filter((x): x is string => !!x);
  const subtitle = [brand, p.quantity].filter(Boolean).join(' · ');

  return (
    <Sheet open full onClose={onClose} title={p.name} subtitle={subtitle || undefined} className="fd-detail">
      <div className="fd-detail-media">
        <ProductImage path={p.images[shown]} size={400} alt={`${p.name} – ${IMAGE_LABELS[shown]}`} padded className="fd-detail-photo" />
        {kinds.length > 1 && (
          <div className="fd-thumbs" role="group" aria-label="Zdjęcia">
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
              {[p.price.store, p.price.city].filter(Boolean).join(', ') || 'Sklep nieznany'} · {formatDate(p.price.date)}
              {p.price.discounted && ' · promocja'}
            </p>
            {p.price.count > 1 && <p>Najnowsza z {p.price.count} zgłoszonych cen.</p>}
          </div>
        )}
      </div>

      {p.online && p.online.length > 0 && (
        <Block title="Kup w sklepie internetowym">
          <ul className="fd-offers">
            {p.online.map((o) => (
              <li key={o.url}>
                <a href={o.url} target="_blank" rel="noopener noreferrer">
                  {dict.stores[o.shop] ?? o.shop}
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                  <span className="sr-only"> (otwiera się w nowej karcie)</span>
                </a>
                <span className="soft">
                  {o.price !== null && <> · {formatPrice(o.price)}</>} · sprawdzone {formatDate(o.checked)}
                </span>
              </li>
            ))}
          </ul>
          <p className="soft small">Ceny i dostępność ze strony sklepu w dniu sprawdzenia — w sklepie mogą być inne.</p>
        </Block>
      )}

      {(p.genericName || category) && (
        <Block title="Opis">
          {p.genericName && <p>{p.genericName}</p>}
          {category && <p className="soft">Kategoria: {category}</p>}
        </Block>
      )}

      <Block title="Wartości odżywcze w 100 g">
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
        {p.servingSize && <p className="soft small">Porcja: {p.servingSize}</p>}
      </Block>

      {p.ingredientsText && (
        <Block title="Składniki">
          <p>{p.ingredientsText}</p>
        </Block>
      )}

      {(allergens.length > 0 || traces.length > 0) && (
        <Block title="Alergeny">
          {allergens.length > 0 && <p>Zawiera: {allergens.join(', ')}</p>}
          {traces.length > 0 && <p className="soft">Może zawierać: {traces.join(', ')}</p>}
        </Block>
      )}

      {p.additives.length > 0 && (
        <Block title={`Dodatki (${p.additives.length})`}>
          <Tags items={names(dict, 'additives', p.additives)} />
        </Block>
      )}

      {p.labels.length > 0 && (
        <Block title="Etykiety">
          <Tags items={names(dict, 'labels', p.labels)} />
        </Block>
      )}

      {diet.length > 0 && (
        <Block title="Dieta">
          <p>{diet.join(' · ')}</p>
        </Block>
      )}

      {p.stores.length > 0 && (
        <Block title="Sklepy">
          <p>{names(dict, 'stores', p.stores).join(', ')}</p>
        </Block>
      )}

      {/* Produkt tylko ze sklepu internetowego, bez EAN, ma kod z nazwy strony — to nie kod kreskowy. */}
      {/^\d+$/.test(p.code) && (
        <Block title="Kod kreskowy">
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
          Zobacz w Open Food Facts <ExternalLink size={16} strokeWidth={2} aria-hidden />
          <span className="sr-only"> (otwiera się w nowej karcie)</span>
        </a>
      )}
    </Sheet>
  );
}
