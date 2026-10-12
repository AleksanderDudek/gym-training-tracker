import { ChevronRight, LoaderCircle, Search, X } from 'lucide-react';
import { useCallback, useDeferredValue, useMemo } from 'react';
import { EmptyState } from '../../../components/ui';
import { restaurantPath } from '../../../routing';
import { useProfile } from '../../hooks/useDiet';
import { useRestaurants } from '../../hooks/useRestaurants';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber, plural } from '../../lib/format';
import { searchMenus } from '../../restaurants/search';
import { CHAIN_KINDS, CHAIN_KIND_GROUPS, type Chain, type MenuItem } from '../../restaurants/types';
import { restaurantsFromParams, restaurantsToParams } from '../../restaurants/url';
import { MenuItemSheet } from './MenuItemSheet';
import { MenuList, dietOf } from './MenuList';
import '../diet/diet.css';
import './restaurants.css';

/** Wyników wyszukiwania na raz — więcej i tak nikt nie przewija; dokładniejsze słowo zawęża. */
const MAX_HITS = 60;

/** Menu lokali jeszcze się wczytuje albo nie wczytało — ten sam strój co stan bazy produktów. */
export function MenusStatus({ status, onRetry }: { status: 'loading' | 'error'; onRetry: () => void }) {
  if (status === 'loading')
    return (
      <div className="empty fd-status" role="status">
        <LoaderCircle className="fd-spin" size={20} strokeWidth={2} aria-hidden />
        Wczytywanie menu lokali…
      </div>
    );
  return (
    <div role="alert">
      <EmptyState
        title="Nie można wyświetlić menu lokali"
        text="Sprawdź połączenie i spróbuj jeszcze raz."
        action={
          <button type="button" className="btn sm" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        }
      />
    </div>
  );
}

/**
 * Lokale — podstrona Produktów: sieci gastronomiczne z wartościami odżywczymi z ich własnych
 * tabel. Wyszukiwanie idzie przez wszystkie menu naraz („big mac”, „latte grande”), lista sieci —
 * pogrupowana według rodzaju. Zapytanie i otwarta pozycja stoją w adresie (`#/lokale?q=latte&p=…`),
 * więc Wstecz zamyka kartę pozycji.
 */
export default function RestaurantsPage() {
  const data = useRestaurants();
  if (data.status !== 'ready') return <MenusStatus status={data.status} onRetry={data.retry} />;
  return <Restaurants chains={data.chains} />;
}

function Restaurants({ chains }: { chains: Chain[] }) {
  const [state, update, closeEntry] = useUrlState(restaurantsFromParams, restaurantsToParams);
  const diet = dietOf(useProfile());
  // Lista dogania pole chwilę później; dopóki nie dogoni, pokazuje poprzedni stan, a nie „Nic nie pasuje”.
  const query = useDeferredValue(state.q);
  // O jedną więcej niż pokazujemy: tylko tak wiadomo, czy za limitem coś jeszcze jest.
  const found = useMemo(() => searchMenus(chains, query, MAX_HITS + 1), [chains, query]);
  const hits = found.slice(0, MAX_HITS);

  const [openChainId, openItemId] = state.item?.split('/') ?? [];
  const openChain = chains.find((c) => c.id === openChainId) ?? null;
  const openItem = openChain?.items.find((i) => i.id === openItemId) ?? null;
  const open = useCallback(
    (chain: Chain, item: MenuItem) => update({ item: `${chain.id}/${item.id}` }, { push: true }),
    [update],
  );
  const total = chains.reduce((n, c) => n + c.items.length, 0);

  return (
    <>
      <div className="wrap fd-rest-top">
        <p className="lead">
          Kalorie i makro z oficjalnych tabel sieci — na porcję, tak jak ją podają. Menu się zmienia, więc przy każdej
          sieci stoi źródło i data sprawdzenia. Pozycję dodasz do dziennika jednym stuknięciem.
        </p>
        <div className="fd-rest-search">
          <Search size={20} strokeWidth={2} aria-hidden />
          <input
            type="search"
            value={state.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Big Mac, latte, frytki…"
            aria-label="Szukaj w menu lokali"
            enterKeyHint="search"
            autoComplete="off"
          />
          {state.q && (
            <button type="button" className="fd-rest-clear" onClick={() => update({ q: '' })} aria-label="Wyczyść wyszukiwanie">
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {query.trim() ? (
        <section className="grp" aria-labelledby="fd-rest-hits-title">
          <h2 id="fd-rest-hits-title">Wyniki</h2>
          <p className="tight" aria-live="polite">
            {hits.length === 0
              ? 'Nic nie pasuje. Spróbuj krócej: „wrap”, „latte”, „frytki”.'
              : found.length > MAX_HITS
                ? `Pierwsze ${formatNumber(MAX_HITS, 0)} pozycji — dopisz słowo, żeby zawęzić.`
                : `${formatNumber(hits.length, 0)} ${plural(hits.length, 'pozycja', 'pozycje', 'pozycji')}`}
          </p>
          <MenuList items={hits} showChain diet={diet} onOpen={open} />
        </section>
      ) : (
        CHAIN_KINDS.map((kind) => {
          const group = chains.filter((c) => c.kind === kind);
          if (!group.length) return null;
          return (
            <section key={kind} className="grp" aria-labelledby={`fd-rest-kind-${kind}`}>
              <h2 id={`fd-rest-kind-${kind}`}>{CHAIN_KIND_GROUPS[kind]}</h2>
              <ul className="fd-rest-chains">
                {group.map((c) => (
                  <li key={c.id}>
                    <a href={restaurantPath(c.id)}>
                      <span className="fd-rest-chain-main">
                        <span className="fd-rest-chain-name">{c.name}</span>
                        <span className="fd-rest-meta">
                          {formatNumber(c.items.length, 0)} {plural(c.items.length, 'pozycja', 'pozycje', 'pozycji')}
                          {c.market !== 'PL' && ` · dane z menu ${c.market}`}
                        </span>
                      </span>
                      <ChevronRight size={20} strokeWidth={2} aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {!query.trim() && (
        <p className="wrap fd-rest-foot">
          {formatNumber(chains.length, 0)} {plural(chains.length, 'sieć', 'sieci', 'sieci')} ·{' '}
          {formatNumber(total, 0)} {plural(total, 'pozycja', 'pozycje', 'pozycji')} menu. Sieci, które nie publikują
          pełnych makroskładników, tu nie ma — obiad z nich wpiszesz w dzienniku jako „Tylko kalorie”.
        </p>
      )}

      <MenuItemSheet chain={openChain} item={openItem} diet={diet} linkChain onClose={() => closeEntry({ item: null })} />
    </>
  );
}
