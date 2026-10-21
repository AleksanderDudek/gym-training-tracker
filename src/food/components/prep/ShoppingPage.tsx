import { Check, ExternalLink, Share2, Snowflake } from 'lucide-react';
import { Fragment, useState } from 'react';
import { EmptyState } from '../../../components/ui';
import { dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { shoppingFromParams, shoppingToParams } from '../../diet/url';
import { useClock } from '../../hooks/useDiet';
import { usePrepPlans } from '../../hooks/usePrep';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber, formatPrice } from '../../lib/format';
import { AISLE_LABELS } from '../../prep/aisles';
import { gramsLabel, rangeLabel, shortDate } from '../../prep/format';
import { shoppingProgress } from '../../prep/meals';
import { amountText, itemName, priceSum, pricedEnough, shoppingText } from '../../prep/shopping';
import { clearBought, markBought, openPlans, planEnd, planName, shownPlan } from '../../prep/store';
import type { PrepPlan, PrepShop, ShoppingItem } from '../../prep/types';
import { Loading } from '../diet/Onboarding';
import { shoppingHref } from './links';
import { PlanSwitch } from './PlanSwitch';
import './prep.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

/**
 * Lista zakupów planu — do odhaczania w sklepie. Działa z migawki planu: bez bazy produktów
 * i bez zasięgu. Najpierw wizyta w sklepie (dział po dziale, tak jak się idzie przez sklep),
 * potem zamówienie przez internet, na końcu to, co zwykle jest w domu.
 */
export default function ShoppingPage() {
  const [state] = useUrlState(shoppingFromParams, shoppingToParams);
  const plans = usePrepPlans();
  const { date: today } = useClock();
  if (!plans) return <Loading />;
  const plan = shownPlan(plans, today, state.plan);
  if (!plan || plan.id === undefined)
    return (
      <div className="wrap">
        <EmptyState
          title="Nie masz planu z listą zakupów."
          text="Ułóż plan na kolejne dni — lista zakupów powstanie razem z nim."
          action={
            <a className="btn sm" href={dietPath('plan')}>
              Ułóż plan
            </a>
          }
        />
      </div>
    );
  return (
    <>
      <PlanSwitch plans={openPlans(plans, today)} shown={plan} today={today} href={shoppingHref} />
      {/* Another plan, another list: ticks shown before IndexedDB answers belong to one plan. */}
      <ShoppingList key={plan.id} plan={plan as PrepPlan & { id: number }} />
    </>
  );
}

function ShoppingList({ plan }: { plan: PrepPlan & { id: number } }) {
  const bridge = useBridge();
  // What the checkboxes show at once, before IndexedDB answers: a tick in a shop must not flicker.
  // A tick the stored plan already agrees with is dropped, so a change from another tab shows too.
  const [ticks, setTicks] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [stored, setStored] = useState(plan.bought);
  if (stored !== plan.bought) {
    setStored(plan.bought);
    setTicks((m) => new Map([...m].filter(([k, on]) => plan.bought.includes(k) !== on)));
  }
  const physical = plan.shops.find((s) => !s.online);
  const visit = plan.shopping.filter((i) => i.group === 'visit');
  const home = plan.shopping.filter((i) => i.group === 'home');
  const bought = new Set(plan.shopping.map((i) => i.key).filter((k) => ticks.get(k) ?? plan.bought.includes(k)));
  const failed = () => {
    setTicks(new Map());
    bridge.toast('Nie udało się zapisać odhaczenia na tym urządzeniu.');
  };
  const tick = (key: string, on: boolean) => {
    setTicks((m) => new Map(m).set(key, on));
    markBought(plan.id, key, on).catch(failed);
  };
  const untickAll = () => {
    setTicks(new Map(plan.shopping.map((i) => [i.key, false])));
    clearBought(plan.id).catch(failed);
  };
  const { done, total } = shoppingProgress(plan, bought);

  const share = async () => {
    const text = shoppingText(plan);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Lista zakupów', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      bridge.toast('Lista skopiowana — wklej ją, gdzie chcesz.');
    } catch (e) {
      // Zamknięte okno udostępniania to nie błąd; brak schowka — tak.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      bridge.toast('Nie udało się udostępnić listy.');
    }
  };

  return (
    <>
      <div className="grp fd-prep-head">
        <div className="today-tag light">{planName(plan)}</div>
        <h2 className="today-name">Zakupy na {rangeLabel(plan.settings.start, planEnd(plan))}</h2>
        <p className="tight" aria-live="polite">
          Kupione {formatNumber(done, 0)} z {formatNumber(total, 0)}
          {done === total && total > 0 && ' — wszystko w koszyku.'}
        </p>
        <div className="fd-prep-progress" aria-hidden>
          <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <div className="fd-prep-actions">
          <button type="button" className="btn ghost sm" onClick={() => void share()}>
            <Share2 {...ICON} /> Udostępnij listę
          </button>
          {bought.size > 0 && (
            <button type="button" className="btn ghost sm" onClick={untickAll}>
              Odznacz wszystko
            </button>
          )}
        </div>
      </div>

      {physical && visit.length > 0 && (
        <Group
          id="fd-prep-visit"
          title={`${physical.name} — wizyta w sklepie`}
          items={visit}
          bought={bought}
          onTick={tick}
          aisles
        />
      )}
      {plan.shops
        .filter((s) => s.online)
        .map((s) => (
          <Group
            key={s.key}
            id={`fd-prep-order-${s.key}`}
            title={`${s.name} — zamówienie przez internet`}
            shop={s}
            items={plan.shopping.filter((i) => i.group === 'order' && i.shop === s.key)}
            bought={bought}
            onTick={tick}
          />
        ))}
      {home.length > 0 && (
        <Group
          id="fd-prep-home"
          title="Sprawdź w domu"
          lead="Zwykle stoi w szafce: zajrzyj przed wyjściem, kup, czego brakuje."
          items={home}
          bought={bought}
          onTick={tick}
        />
      )}
      <p className="wrap fd-prep-soft fd-prep-foot">
        Ceny orientacyjne: z Open Prices, Selgrosa i stron sklepów internetowych, z datą sprawdzenia przy produkcie. Ilości
        są na cały plan; ostatnie opakowanie może zostać na następny.
      </p>
    </>
  );
}

interface GroupProps {
  id: string;
  title: string;
  lead?: string;
  shop?: PrepShop;
  items: ShoppingItem[];
  bought: Set<string>;
  onTick: (key: string, on: boolean) => void;
  /** Headings by aisle: one walk through the shop. */
  aisles?: boolean;
}

function Group({ id, title, lead, shop, items, bought, onTick, aisles = false }: GroupProps) {
  if (!items.length) return null;
  const sum = priceSum(items);
  return (
    <section className="grp" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {lead && <p className="tight">{lead}</p>}
      {pricedEnough(sum) && (
        <p className="tight fd-prep-nums">
          Ok. {formatPrice(sum.total)}
          {sum.unknown > 0 && ` (ceny znane dla ${sum.known} z ${items.length} pozycji)`}
        </p>
      )}
      {shop?.url && (
        <p className="tight">
          <a href={shop.url} target="_blank" rel="noopener noreferrer">
            Sklep {shop.name}
            <ExternalLink size={14} strokeWidth={2} aria-hidden />
            <span className="sr-only"> (otwiera się w nowej karcie)</span>
          </a>
        </p>
      )}
      <ul className="fd-prep-list">
        {items.map((item, i) => (
          <Fragment key={item.key}>
            {aisles && item.aisle !== items[i - 1]?.aisle && (
              <li className="fd-prep-aisle">
                <h3>{AISLE_LABELS[item.aisle]}</h3>
              </li>
            )}
            <Item item={item} done={bought.has(item.key)} onTick={onTick} />
          </Fragment>
        ))}
      </ul>
    </section>
  );
}

function Item({ item, done, onTick }: { item: ShoppingItem; done: boolean; onTick: (key: string, on: boolean) => void }) {
  const name = itemName(item);
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
            {amountText(item)}
            {item.product && item.product.name !== item.label && ` · ${item.label}`}
            {item.product?.brand && ` · ${item.product.brand}`}
            {item.price !== null && ` · ok. ${formatPrice(item.price)}`}
          </span>
          {item.freeze.map((f) => (
            <span key={f.date} className="fd-prep-meta fd-prep-cold">
              <Snowflake size={14} strokeWidth={2} aria-hidden /> zamroź {gramsLabel(f.grams)} na {shortDate(f.date)}
            </span>
          ))}
        </span>
      </label>
      {item.product?.url && (
        <a className="fd-prep-link" href={item.product.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink {...ICON} />
          <span className="sr-only">Strona produktu: {name} (otwiera się w nowej karcie)</span>
        </a>
      )}
    </li>
  );
}
