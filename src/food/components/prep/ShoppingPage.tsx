import { CalendarDays, Share2 } from 'lucide-react';
import { useState } from 'react';
import { text } from '../../../i18n';
import { dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { shoppingFromParams, shoppingToParams } from '../../diet/url';
import { hashWith } from '../../hash';
import { useClock, useProfile } from '../../hooks/useDiet';
import { usePrepPlans } from '../../hooks/usePrep';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber } from '../../lib/format';
import { rangeLabel } from '../../prep/format';
import { shoppingProgress } from '../../prep/meals';
import { shoppingText } from '../../prep/shopping';
import { clearBought, markBought, openPlans, planEnd, planName, shownPlan } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';
import { readSource, writeSource, type ShopSource } from '../../shop/store';
import { Loading } from '../diet/Onboarding';
import { DiaryShopping } from './DiaryShopping';
import { shoppingHref } from './links';
import { PlanSwitch } from './PlanSwitch';
import { Group, shareList } from './ShoppingRows';
import './prep.css';

const T = text({
  pl: {
    sources: 'Skąd lista',
    fromDiary: 'Z dziennika',
    fromPlan: 'Z planu',
    calendar: 'Kalendarz — zakupy, treningi, badania',
    tickFailed: 'Nie udało się zapisać odhaczenia na tym urządzeniu.',
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
  },
  en: {
    sources: 'Where the list comes from',
    fromDiary: 'From the diary',
    fromPlan: 'From the plan',
    calendar: 'Calendar — shopping, workouts, lab tests',
    tickFailed: 'Couldn’t save the tick on this device.',
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
  },
});

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

/** Kalendarz (zakupy z rytmu, treningi, badania) — osobna strona aplikacji. */
const CALENDAR_PATH = '#/kalendarz';

/**
 * Lista zakupów — z dziennika (średnia z ostatnich tygodni na dni do następnych zakupów) albo
 * z planu meal prep. Przełącznik źródeł stoi tylko wtedy, gdy jest otwarty plan; bez planu lista
 * jest z dziennika. Ostatni wybór zostaje na urządzeniu, a adres (`?z=`) go niesie.
 *
 * Lista planu działa z migawki planu: bez bazy produktów i bez zasięgu. Najpierw wizyta w sklepie
 * (dział po dziale, tak jak się idzie przez sklep), potem zamówienie przez internet, na końcu to,
 * co zwykle jest w domu.
 */
export default function ShoppingPage() {
  const [state] = useUrlState(shoppingFromParams, shoppingToParams);
  const plans = usePrepPlans();
  const profile = useProfile();
  const { date: today } = useClock();
  const [remembered] = useState(readSource);
  if (!plans || profile === undefined) return <Loading />;
  const plan = shownPlan(plans, today, state.plan);
  const hasPlan = !!plan && plan.id !== undefined;
  // Odnośnik z planu (`?plan=3`) prowadzi do listy tego planu; inaczej adres, potem pamięć urządzenia.
  const source: ShopSource = !hasPlan ? 'dziennik' : (state.source ?? (state.plan !== null ? 'plan' : (remembered ?? 'plan')));
  return (
    <>
      {hasPlan && <SourceSwitch source={source} plan={state.plan} />}
      {source === 'plan' && hasPlan ? (
        <>
          <PlanSwitch plans={openPlans(plans, today)} shown={plan} today={today} href={shoppingHref} />
          {/* Another plan, another list: ticks shown before IndexedDB answers belong to one plan. */}
          <ShoppingList key={plan.id} plan={plan as PrepPlan & { id: number }} />
        </>
      ) : (
        <DiaryShopping profile={profile} today={today} hasPlan={hasPlan} />
      )}
      <p className="wrap fd-prep-all fd-prep-calendar">
        <a href={CALENDAR_PATH}>
          <CalendarDays {...ICON} /> {T.calendar}
        </a>
      </p>
    </>
  );
}

/** „Z dziennika” / „Z planu” — odnośniki, bo każde źródło ma własny adres; wybór zostaje na urządzeniu. */
function SourceSwitch({ source, plan }: { source: ShopSource; plan: number | null }) {
  const href = (z: ShopSource) => hashWith(dietPath('shopping'), shoppingToParams({ plan: z === 'plan' ? plan : null, source: z }));
  return (
    <nav className="wrap seg fd-prep-switch" aria-label={T.sources}>
      {(['dziennik', 'plan'] as const).map((z) => (
        <a key={z} href={href(z)} aria-current={z === source ? 'page' : undefined} onClick={() => writeSource(z)}>
          {z === 'dziennik' ? T.fromDiary : T.fromPlan}
        </a>
      ))}
    </nav>
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

  const share = () => shareList(shoppingText(plan), (m) => bridge.toast(m));

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
