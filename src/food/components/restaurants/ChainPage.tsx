import { useCallback, useMemo } from 'react';
import { pluralEn, text } from '../../../i18n';
import { EmptyState } from '../../../components/ui';
import { RESTAURANTS_PATH } from '../../../routing';
import { useProfile } from '../../hooks/useDiet';
import { useRestaurants } from '../../hooks/useRestaurants';
import { useUrlState } from '../../hooks/useUrlState';
import { formatDate, formatNumber, plural } from '../../lib/format';
import { chainById } from '../../restaurants/normalize';
import { SORT_LABELS, TOP_PROTEIN_MIN, sortItems, topProtein, type MenuSort } from '../../restaurants/sort';
import { CATEGORY_LABELS, CHAIN_KIND_LABELS, MENU_CATEGORIES, type Chain, type MenuCategory } from '../../restaurants/types';
import { chainFromParams, chainToParams } from '../../restaurants/url';
import { ChipRow } from '../recipes/ChipRow';
import { MenuItemSheet } from './MenuItemSheet';
import { MenuList, dietOf } from './MenuList';
import { MenusStatus } from './RestaurantsPage';
import '../diet/diet.css';
import './restaurants.css';

const SORTS = Object.keys(SORT_LABELS) as MenuSort[];

const T = text({
  pl: {
    missing: 'Nie ma takiego lokalu',
    missingText: 'Może zniknął z listy przy ostatniej aktualizacji danych.',
    all: 'Wszystkie lokale',
    items: (n: number) => `${plural(n, 'pozycja', 'pozycje', 'pozycji')} menu`,
    count: (n: number) => plural(n, 'pozycja', 'pozycje', 'pozycji'),
    source: 'Źródło:',
    checked: (date: string) => `· sprawdzone ${date}.`,
    market: (market: string) => `Wartości z menu rynku ${market} — polska sieć ich nie publikuje, a receptury mogą się różnić.`,
    about: 'O tych danych',
    top: 'Najwięcej białka',
    topLead: (min: number) => `Co najmniej ${min} g białka w porcji i najwięcej białka na kalorię.`,
    category: 'Kategoria',
    everything: 'Wszystko',
    order: 'Kolejność',
    menu: 'Menu',
  },
  en: {
    missing: 'No such restaurant',
    missingText: 'It may have dropped off the list in the last data update.',
    all: 'All restaurants',
    items: (n: number) => `menu ${pluralEn(n, 'item', 'items')}`,
    count: (n: number) => pluralEn(n, 'item', 'items'),
    source: 'Source:',
    checked: (date: string) => `· checked ${date}.`,
    market: (market: string) => `Values from the ${market} menu — the Polish chain doesn’t publish them, and recipes may differ.`,
    about: 'About this data',
    top: 'Most protein',
    topLead: (min: number) => `At least ${min} g of protein per portion and the most protein per calorie.`,
    category: 'Category',
    everything: 'All',
    order: 'Order',
    menu: 'Menu',
  },
});

/**
 * Menu jednej sieci (`#/lokale/kfc`): skąd liczby, „Najwięcej białka”, kategorie, sortowanie
 * i karta pozycji. Kategoria, sortowanie i otwarta pozycja stoją w adresie
 * (`?kat=kurczak&sort=bialko&p=strips`).
 */
export default function ChainPage({ chainId }: { chainId: string }) {
  const data = useRestaurants();
  if (data.status !== 'ready') return <MenusStatus status={data.status} onRetry={data.retry} />;
  const chain = chainById(data.chains, chainId);
  if (!chain)
    return (
      <div className="wrap">
        <EmptyState
          title={T.missing}
          text={T.missingText}
          action={
            <a className="btn sm" href={RESTAURANTS_PATH}>
              {T.all}
            </a>
          }
        />
      </div>
    );
  return <Menu chain={chain} />;
}

function Menu({ chain }: { chain: Chain }) {
  const [state, update, closeEntry] = useUrlState(chainFromParams, chainToParams);
  const diet = dietOf(useProfile());

  const categories = useMemo(
    () => MENU_CATEGORIES.filter((k) => chain.items.some((i) => i.category === k)),
    [chain],
  );
  // Kategoria z linku, której w tej sieci nie ma, jest pomijana — zamiast pustej listy.
  const category = state.category && categories.includes(state.category) ? state.category : null;
  const items = useMemo(
    () => sortItems(category ? chain.items.filter((i) => i.category === category) : chain.items, state.sort),
    [chain, category, state.sort],
  );
  const top = useMemo(() => topProtein(chain.items), [chain]);
  const openItem = chain.items.find((i) => i.id === state.item) ?? null;
  const open = useCallback((_: Chain, item: { id: string }) => update({ item: item.id }, { push: true }), [update]);
  const withChain = (list: typeof items) => list.map((item) => ({ chain, item }));

  return (
    <>
      <div className="wrap fd-rest-head">
        <h2 className="fd-rest-title">{chain.name}</h2>
        <p className="fd-rest-meta">
          {CHAIN_KIND_LABELS[chain.kind]} · {formatNumber(chain.items.length, 0)} {T.items(chain.items.length)}
        </p>
        <p className="fd-rest-src">
          {T.source}{' '}
          <a href={chain.source.url} target="_blank" rel="noopener noreferrer">
            {chain.source.title}
          </a>{' '}
          {T.checked(formatDate(chain.source.checked))}
        </p>
        {chain.market !== 'PL' && (
          <p className="fd-rest-warn">{T.market(chain.market)}</p>
        )}
        {chain.source.note && (
          <details className="fd-rest-note">
            <summary>{T.about}</summary>
            <p>{chain.source.note}</p>
          </details>
        )}
      </div>

      {top.length > 0 && (
        <section className="grp" aria-labelledby="fd-rest-top-title">
          <h2 id="fd-rest-top-title">{T.top}</h2>
          <p className="tight">{T.topLead(TOP_PROTEIN_MIN)}</p>
          <MenuList items={withChain(top)} diet={diet} onOpen={open} />
        </section>
      )}

      <div className="grp fd-rest-filters">
        {categories.length > 1 && (
          <ChipRow<MenuCategory>
            label={T.category}
            value={category}
            onChange={(next) => update({ category: next })}
            options={[{ key: null, label: T.everything }, ...categories.map((k) => ({ key: k, label: CATEGORY_LABELS[k] }))]}
          />
        )}
        <label className="fld fd-rest-sort">
          <span>{T.order}</span>
          <select value={state.sort} onChange={(e) => update({ sort: e.target.value as MenuSort })}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grp" aria-labelledby="fd-rest-menu-title">
        <h2 id="fd-rest-menu-title">
          {category ? CATEGORY_LABELS[category] : T.menu}{' '}
          <span className="fd-rest-h-meta">
            · {formatNumber(items.length, 0)} {T.count(items.length)}
          </span>
        </h2>
        <MenuList items={withChain(items)} diet={diet} onOpen={open} />
      </section>

      <MenuItemSheet chain={chain} item={openItem} diet={diet} onClose={() => closeEntry({ item: null })} />
    </>
  );
}
