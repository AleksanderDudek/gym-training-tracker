import { Check, ExternalLink, Share2, Snowflake } from 'lucide-react';
import { Fragment, useState } from 'react';
import { text } from '../../../i18n';
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
import { COMMON } from '../common/text';
import './prep.css';

const T = text({
  pl: {
    noPlan: 'Nie masz planu z listą zakupów.',
    noPlanText: 'Ułóż plan na kolejne dni — lista zakupów powstanie razem z nim.',
    make: 'Ułóż plan',
    tickFailed: 'Nie udało się zapisać odhaczenia na tym urządzeniu.',
    list: 'Lista zakupów',
    copied: 'Lista skopiowana — wklej ją, gdzie chcesz.',
    shareFailed: 'Nie udało się udostępnić listy.',
    title: (range: string) => `Zakupy na ${range}`,
    bought: (done: string, total: string) => `Kupione ${done} z ${total}`,
    all: ' — wszystko w koszyku.',
    share: 'Udostępnij listę',
    untick: 'Odznacz wszystko',
    visit: (shop: string) => `${shop} — wizyta w sklepie`,
    order: (shop: string) => `${shop} — zamówienie przez internet`,
    home: 'Sprawdź w domu',
    homeLead: 'Zwykle stoi w szafce: zajrzyj przed wyjściem, kup, czego brakuje.',
    foot: 'Ceny orientacyjne: z Open Prices, Selgrosa i stron sklepów internetowych, z datą sprawdzenia przy produkcie. Ilości są na cały plan; ostatnie opakowanie może zostać na następny.',
    sum: (price: string) => `Ok. ${price}`,
    known: (known: number, all: number) => ` (ceny znane dla ${known} z ${all} pozycji)`,
    shop: (name: string) => `Sklep ${name}`,
    about: (price: string) => ` · ok. ${price}`,
    freeze: (grams: string, date: string) => `zamroź ${grams} na ${date}`,
    page: (name: string) => `Strona produktu: ${name}`,
  },
  en: {
    noPlan: 'You have no plan with a shopping list.',
    noPlanText: 'Make a plan for the coming days — the shopping list comes with it.',
    make: 'Make a plan',
    tickFailed: 'Couldn’t save the tick on this device.',
    list: 'Shopping list',
    copied: 'List copied — paste it wherever you like.',
    shareFailed: 'Couldn’t share the list.',
    title: (range: string) => `Shopping for ${range}`,
    bought: (done: string, total: string) => `Bought ${done} of ${total}`,
    all: ' — everything’s in the basket.',
    share: 'Share list',
    untick: 'Untick all',
    visit: (shop: string) => `${shop} — shop visit`,
    order: (shop: string) => `${shop} — online order`,
    home: 'Check at home',
    homeLead: 'Usually in the cupboard: take a look before you go and buy what’s missing.',
    foot: 'Prices are approximate: from Open Prices, Selgros and online shops’ sites, with the date they were checked next to the product. Amounts cover the whole plan; the last pack may be left for the next one.',
    sum: (price: string) => `About ${price}`,
    known: (known: number, all: number) => ` (prices known for ${known} of ${all} items)`,
    shop: (name: string) => `${name} website`,
    about: (price: string) => ` · about ${price}`,
    freeze: (grams: string, date: string) => `freeze ${grams} for ${date}`,
    page: (name: string) => `Product page: ${name}`,
  },
});

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
          title={T.noPlan}
          text={T.noPlanText}
          action={
            <a className="btn sm" href={dietPath('plan')}>
              {T.make}
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
    bridge.toast(T.tickFailed);
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
        await navigator.share({ title: T.list, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      bridge.toast(T.copied);
    } catch (e) {
      // Zamknięte okno udostępniania to nie błąd; brak schowka — tak.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      bridge.toast(T.shareFailed);
    }
  };

  return (
    <>
      <div className="grp fd-prep-head">
        <div className="today-tag light">{planName(plan)}</div>
        <h2 className="today-name">{T.title(rangeLabel(plan.settings.start, planEnd(plan)))}</h2>
        <p className="tight" aria-live="polite">
          {T.bought(formatNumber(done, 0), formatNumber(total, 0))}
          {done === total && total > 0 && T.all}
        </p>
        <div className="fd-prep-progress" aria-hidden>
          <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <div className="fd-prep-actions">
          <button type="button" className="btn ghost sm" onClick={() => void share()}>
            <Share2 {...ICON} /> {T.share}
          </button>
          {bought.size > 0 && (
            <button type="button" className="btn ghost sm" onClick={untickAll}>
              {T.untick}
            </button>
          )}
        </div>
      </div>

      {physical && visit.length > 0 && (
        <Group
          id="fd-prep-visit"
          title={T.visit(physical.name)}
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
            title={T.order(s.name)}
            shop={s}
            items={plan.shopping.filter((i) => i.group === 'order' && i.shop === s.key)}
            bought={bought}
            onTick={tick}
          />
        ))}
      {home.length > 0 && (
        <Group
          id="fd-prep-home"
          title={T.home}
          lead={T.homeLead}
          items={home}
          bought={bought}
          onTick={tick}
        />
      )}
      <p className="wrap fd-prep-soft fd-prep-foot">{T.foot}</p>
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
            {item.price !== null && T.about(formatPrice(item.price))}
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
