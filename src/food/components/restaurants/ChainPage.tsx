import { useCallback, useMemo } from 'react';
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
          title="Nie ma takiego lokalu"
          text="Może zniknął z listy przy ostatniej aktualizacji danych."
          action={
            <a className="btn sm" href={RESTAURANTS_PATH}>
              Wszystkie lokale
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
          {CHAIN_KIND_LABELS[chain.kind]} · {formatNumber(chain.items.length, 0)}{' '}
          {plural(chain.items.length, 'pozycja', 'pozycje', 'pozycji')} menu
        </p>
        <p className="fd-rest-src">
          Źródło:{' '}
          <a href={chain.source.url} target="_blank" rel="noopener noreferrer">
            {chain.source.title}
          </a>{' '}
          · sprawdzone {formatDate(chain.source.checked)}.
        </p>
        {chain.market !== 'PL' && (
          <p className="fd-rest-warn">
            Wartości z menu rynku {chain.market} — polska sieć ich nie publikuje, a receptury mogą się różnić.
          </p>
        )}
        {chain.source.note && (
          <details className="fd-rest-note">
            <summary>O tych danych</summary>
            <p>{chain.source.note}</p>
          </details>
        )}
      </div>

      {top.length > 0 && (
        <section className="grp" aria-labelledby="fd-rest-top-title">
          <h2 id="fd-rest-top-title">Najwięcej białka</h2>
          <p className="tight">
            Co najmniej {TOP_PROTEIN_MIN} g białka w porcji i najwięcej białka na kalorię.
          </p>
          <MenuList items={withChain(top)} diet={diet} onOpen={open} />
        </section>
      )}

      <div className="grp fd-rest-filters">
        {categories.length > 1 && (
          <ChipRow<MenuCategory>
            label="Kategoria"
            value={category}
            onChange={(next) => update({ category: next })}
            options={[{ key: null, label: 'Wszystko' }, ...categories.map((k) => ({ key: k, label: CATEGORY_LABELS[k] }))]}
          />
        )}
        <label className="fld fd-rest-sort">
          <span>Kolejność</span>
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
          {category ? CATEGORY_LABELS[category] : 'Menu'}{' '}
          <span className="fd-rest-h-meta">
            · {formatNumber(items.length, 0)} {plural(items.length, 'pozycja', 'pozycje', 'pozycji')}
          </span>
        </h2>
        <MenuList items={withChain(items)} diet={diet} onOpen={open} />
      </section>

      <MenuItemSheet chain={chain} item={openItem} diet={diet} onClose={() => closeEntry({ item: null })} />
    </>
  );
}
