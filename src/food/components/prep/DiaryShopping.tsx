import { Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { text } from '../../../i18n';
import { EmptyState } from '../../../components/ui';
import { FOOD_PATH, dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import type { ProfileRow } from '../../diet/db';
import { addDays } from '../../diet/model';
import { useHistory, useSets } from '../../hooks/useDiet';
import { useDataset } from '../../hooks/useDataset';
import { formatNumber, plural } from '../../lib/format';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { rangeLabel, shortDate } from '../../prep/format';
import { recipeIndex } from '../../recipes/resolve';
import { WINDOW_DAYS, historyAmount, historyList, historyText, MIN_LOGGED_DAYS, type HistoryItem, type HistoryList } from '../../shop/history';
import { DEFAULT_RHYTHM } from '../../shop/rhythm';
import { readTicks, writeTicks } from '../../shop/store';
import { Loading, Onboarding } from '../diet/Onboarding';
import { RhythmCard } from './RhythmCard';
import { Group, Rows, shareList } from './ShoppingRows';

const T = text({
  pl: {
    what: 'Lista zakupów z dziennika',
    tag: 'Z dziennika',
    title: (date: string) => `Zakupy: ${date}`,
    basis: (days: number, range: string, logged: number) =>
      `Jedzenie na ${days} ${plural(days, 'dzień', 'dni', 'dni')} (${range}): średnia z ${logged} zapisanych dni z ostatnich 4 tygodni.`,
    bought: (done: string, total: string) => `Kupione ${done} z ${total}`,
    all: ' — wszystko w koszyku.',
    share: 'Udostępnij listę',
    untick: 'Odznacz wszystko',
    loadingBase: 'Wczytuję bazę produktów — opakowania i ceny za chwilę.',
    list: 'Do kupienia',
    eaten: (days: number, logged: number) => `jedzone w ${days} z ${logged} dni`,
    sometimes: (n: number) => `Czasem (${n})`,
    sometimesLead: 'Zjedzone tylko jednego dnia z czterech tygodni — dopisz do koszyka, jeśli masz ochotę.',
    home: 'Sprawdź w domu',
    homeLead: 'Zwykle stoi w szafce: zajrzyj przed wyjściem, kup, czego brakuje.',
    foot: 'To średnia z dziennika, nie zapas w domu — zajrzyj do lodówki, zanim wyjdziesz.',
    skipped: (n: number) =>
      ` Bez ${n} ${plural(n, 'wpisu', 'wpisów', 'wpisów')} z lokali, zdjęć, planu i szybkich wpisów — z nich nie wiem, co kupić.`,
    prices: ' Ceny orientacyjne: z Open Prices, Selgrosa i stron sklepów internetowych.',
    tickFailed: 'Nie udało się zapisać odhaczenia na tym urządzeniu.',
    fewTitle: 'Za mało zapisów na listę',
    fewText: (logged: number) =>
      `Lista liczy się ze średniej z zapisanych dni. W ostatnich 4 tygodniach ${logged === 1 ? 'jest' : 'są'} ${logged} z co najmniej ${MIN_LOGGED_DAYS} — zapisuj jedzenie z kilku dni, a lista policzy się sama.`,
    openDiary: 'Otwórz dziennik',
    noneTitle: 'Z dziennika nie ma czego kupić',
    noneText: 'Zapisane jedzenie to lokale, dania ze zdjęcia, pozycje planu albo szybkie wpisy — z nich nie wiem, co kupić.',
    planLead: 'Wolisz listę z gotowego planu posiłków?',
    makePlan: 'Ułóż plan',
  },
  en: {
    what: 'Shopping list from the diary',
    tag: 'From the diary',
    title: (date: string) => `Shopping: ${date}`,
    basis: (days: number, range: string, logged: number) =>
      `Food for ${days} ${days === 1 ? 'day' : 'days'} (${range}): the average of ${logged} logged days from the last 4 weeks.`,
    bought: (done: string, total: string) => `Bought ${done} of ${total}`,
    all: ' — everything’s in the basket.',
    share: 'Share list',
    untick: 'Untick all',
    loadingBase: 'Loading the product base — packs and prices in a moment.',
    list: 'To buy',
    eaten: (days: number, logged: number) => `eaten on ${days} of ${logged} days`,
    sometimes: (n: number) => `Sometimes (${n})`,
    sometimesLead: 'Eaten on only one day in four weeks — add it to the basket if you feel like it.',
    home: 'Check at home',
    homeLead: 'Usually in the cupboard: take a look before you go and buy what’s missing.',
    foot: 'This is the diary’s average, not what’s at home — check the fridge before you go.',
    skipped: (n: number) =>
      ` Leaves out ${n} ${n === 1 ? 'entry' : 'entries'} from restaurants, photos, the plan and quick entries — they don’t say what to buy.`,
    prices: ' Prices are approximate: from Open Prices, Selgros and online shops’ sites.',
    tickFailed: 'Couldn’t save the tick on this device.',
    fewTitle: 'Not enough logged for a list',
    fewText: (logged: number) =>
      `The list is the average of logged days. The last 4 weeks have ${logged} of at least ${MIN_LOGGED_DAYS} — log your food for a few days and the list works itself out.`,
    openDiary: 'Open the diary',
    noneTitle: 'Nothing in the diary to buy',
    noneText: 'What you logged is restaurants, photo dishes, plan items or quick entries — they don’t say what to buy.',
    planLead: 'Prefer a list from a ready meal plan?',
    makePlan: 'Make a plan',
  },
});

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

// Stałe, a nie nowe tablice co render: `recipeIndex` pamięta wynik po tożsamości listy.
const NO_PRODUCTS: IndexedProduct[] = [];
const NO_DICT: Dictionaries = { categories: {}, labels: {}, allergens: {}, additives: {}, brands: {}, stores: {} };

interface Props {
  profile: ProfileRow | null;
  today: string;
  /** Jest otwarty plan: zaproszenie do planu niepotrzebne. */
  hasPlan: boolean;
}

/**
 * Lista zakupów z dziennika: co zwykle jesz (średnia z zapisanych dni z czterech tygodni) razy dni
 * do następnych zakupów (rytm z profilu diety). Bez profilu nie ma dziennika, więc zaproszenie do
 * profilu, jak w samym dzienniku.
 */
export function DiaryShopping({ profile, today, hasPlan }: Props) {
  if (!profile) return <Onboarding what={T.what} />;
  return <FromDiary profile={profile} today={today} hasPlan={hasPlan} />;
}

function FromDiary({ profile, today, hasPlan }: Props & { profile: ProfileRow }) {
  const history = useHistory(addDays(today, -WINDOW_DAYS));
  const sets = useSets();
  // Lista liczy się od razu; baza produktów dokłada opakowania i ceny, gdy się wczyta.
  const data = useDataset();
  const products = data.status === 'ready' ? data.products : NO_PRODUCTS;
  const dict = data.status === 'ready' ? data.dataset.dictionaries : NO_DICT;
  const { candidates } = recipeIndex(products);
  const byCode = useMemo(() => new Map(products.map((p) => [p.code, p])), [products]);
  const setsById = useMemo(() => new Map((sets ?? []).map((s) => [s.id, s])), [sets]);
  const saved = profile.shopping ?? null;
  const rhythmKey = JSON.stringify(saved ?? DEFAULT_RHYTHM);
  const store = profile.preferredStore;

  const list = useMemo(() => {
    if (!history || !sets) return null;
    return historyList({
      entries: history.entries,
      sets: setsById,
      today,
      rhythm: JSON.parse(rhythmKey),
      product: (code) => byCode.get(code),
      basket: store ? [store] : [],
      candidates,
      dict,
    });
  }, [history, sets, setsById, today, rhythmKey, byCode, store, candidates, dict]);

  if (!list) return <Loading />;
  const nothing = list.enough && !list.main.length && !list.sometimes.length && !list.home.length;
  return (
    <>
      <RhythmCard saved={saved} rhythm={saved ?? DEFAULT_RHYTHM} today={today} />
      {!list.enough ? (
        <div className="wrap">
          <EmptyState
            title={T.fewTitle}
            text={T.fewText(list.logged)}
            action={
              <a className="btn sm" href={FOOD_PATH}>
                {T.openDiary}
              </a>
            }
          />
        </div>
      ) : nothing ? (
        <div className="wrap">
          <EmptyState title={T.noneTitle} text={T.noneText} />
        </div>
      ) : (
        // Nowe zakupy, nowa lista: odhaczenia należą do jednego dnia zakupów.
        <DiaryList key={list.period.shop} list={list} loading={data.status === 'loading'} />
      )}
      {!hasPlan && (
        <p className="wrap fd-prep-soft fd-prep-foot fd-prep-toplan">
          {T.planLead} <a href={dietPath('plan')}>{T.makePlan}</a>
        </p>
      )}
    </>
  );
}

function DiaryList({ list, loading }: { list: HistoryList; loading: boolean }) {
  const bridge = useBridge();
  const shop = list.period.shop;
  const [bought, setBought] = useState<ReadonlySet<string>>(() => new Set(readTicks(shop)));
  const save = (next: Set<string>) => {
    setBought(next);
    if (!writeTicks(shop, [...next])) bridge.toast(T.tickFailed);
  };
  const tick = (key: string, on: boolean) => {
    const next = new Set(bought);
    if (on) next.add(key);
    else next.delete(key);
    save(next);
  };
  const done = list.main.filter((i) => bought.has(i.key)).length;
  const total = list.main.length;
  const eaten = (i: HistoryItem) => T.eaten(i.days, list.logged);
  const priced = [...list.main, ...list.sometimes].some((i) => i.price !== null);

  return (
    <>
      <div className="grp fd-prep-head">
        <div className="today-tag light">{T.tag}</div>
        <h2 className="today-name">{T.title(shortDate(shop))}</h2>
        <p className="tight">{T.basis(list.period.days, rangeLabel(shop, list.period.until), list.logged)}</p>
        {total > 0 && (
          <>
            <p className="tight" aria-live="polite">
              {T.bought(formatNumber(done, 0), formatNumber(total, 0))}
              {done === total && T.all}
            </p>
            <div className="fd-prep-progress" aria-hidden>
              <i style={{ width: `${(done / total) * 100}%` }} />
            </div>
          </>
        )}
        {loading && <p className="tight fd-prep-soft">{T.loadingBase}</p>}
        <div className="fd-prep-actions">
          <button type="button" className="btn ghost sm" onClick={() => void shareList(historyText(list, bought), (m) => bridge.toast(m))}>
            <Share2 {...ICON} /> {T.share}
          </button>
          {bought.size > 0 && (
            <button type="button" className="btn ghost sm" onClick={() => save(new Set())}>
              {T.untick}
            </button>
          )}
        </div>
      </div>

      <Group id="fd-prep-diary" title={T.list} items={list.main} bought={bought} onTick={tick} aisles amount={historyAmount} note={eaten} />
      {list.sometimes.length > 0 && (
        <section className="grp fd-prep-sometimes" aria-labelledby="fd-prep-sometimes">
          <details>
            <summary>
              <h2 id="fd-prep-sometimes">{T.sometimes(list.sometimes.length)}</h2>
            </summary>
            <p className="tight">{T.sometimesLead}</p>
            <Rows items={list.sometimes} bought={bought} onTick={tick} amount={historyAmount} />
          </details>
        </section>
      )}
      <Group id="fd-prep-diary-home" title={T.home} lead={T.homeLead} items={list.home} bought={bought} onTick={tick} amount={historyAmount} />
      <p className="wrap fd-prep-soft fd-prep-foot">
        {T.foot}
        {list.skipped > 0 && T.skipped(list.skipped)}
        {priced && T.prices}
      </p>
    </>
  );
}
