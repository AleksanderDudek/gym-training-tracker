import { ChevronRight, LayoutGrid, Scale, Table2, UtensilsCrossed } from 'lucide-react';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { LOCALE, text } from '../../../i18n';
import { EmptyState, Segmented } from '../../../components/ui';
import { RESTAURANTS_PATH } from '../../../routing';
import { useCompare } from '../../hooks/useCompare';
import { useDataset } from '../../hooks/useDataset';
import { useViewState } from '../../hooks/useViewState';
import { browse } from '../../lib/browse';
import { allergenOptions } from '../../lib/display';
import { EMPTY_FILTERS, countActiveFilters, type Filters } from '../../lib/filters';
import { formatNumber } from '../../lib/format';
import { sortProducts } from '../../lib/sort';
import type { Dataset, IndexedProduct } from '../../lib/types';
import type { View } from '../../lib/url-state';
import { DataFooter } from '../common/DataFooter';
import { ProductCard } from '../common/ProductCard';
import { ProductDetail } from '../common/ProductDetail';
import { StatusScreen } from '../common/StatusScreen';
import { ActiveFilters } from './ActiveFilters';
import { productsLabel } from './count';
import { FilterPanel } from './FilterPanel';
import { FilterSheet } from './FilterSheet';
import { Pagination } from './Pagination';
import { ProductTable } from './ProductTable';
import { ScanSheet } from './ScanSheet';
import { Toolbar } from './Toolbar';
import './products.css';

/** Produktów na stronie — jak w Produktach PL. */
const PAGE_SIZE = 48;

const T = text({
  pl: {
    cards: 'Karty',
    table: 'Tabela',
    eatOut: 'Lokale i sieci gastronomiczne',
    eatOutNote: "McDonald's, KFC, Starbucks, Pizza Hut i inne — kalorie i makro z ich własnych tabel",
    heading: 'Produkty',
    found: 'Znaleziono',
    page: (page: string, count: string) => ` · strona ${page} z ${count}`,
    view: 'Widok',
    empty: 'Brak produktów dla tych filtrów.',
    clear: 'Wyczyść filtry',
    list: 'Lista produktów',
    compare: (n: number) => `Porównanie (${n})`,
    expires: (time: string) => `zniknie o ${time}`,
  },
  en: {
    cards: 'Cards',
    table: 'Table',
    eatOut: 'Restaurants and food chains',
    eatOutNote: "McDonald's, KFC, Starbucks, Pizza Hut and more — calories and macros from their own tables",
    heading: 'Products',
    found: 'Found',
    page: (page: string, count: string) => ` · page ${page} of ${count}`,
    view: 'View',
    empty: 'No products match these filters.',
    clear: 'Clear filters',
    list: 'Product list',
    compare: (n: number) => `Comparison (${n})`,
    expires: (time: string) => `clears at ${time}`,
  },
});

const TIME = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });

const VIEWS: { key: View; label: string; Icon: typeof LayoutGrid }[] = [
  { key: 'cards', label: T.cards, Icon: LayoutGrid },
  { key: 'table', label: T.table, Icon: Table2 },
];

/**
 * Wejście do Lokali: jedzenie z sieci gastronomicznych to też „produkty”, tylko z innej półki —
 * dlatego podstrona Produktów, a nie piąta sekcja (pięć pozycji nie mieści się na ekranie 320 px).
 */
export function EatOutLink() {
  return (
    <a className="fd-prod-eatout" href={RESTAURANTS_PATH}>
      <UtensilsCrossed size={20} strokeWidth={2} aria-hidden />
      <span className="fd-prod-eatout-text">
        <b>{T.eatOut}</b>
        <span>{T.eatOutNote}</span>
      </span>
      <ChevronRight size={20} strokeWidth={2} aria-hidden />
    </a>
  );
}

/** Pasek pod wyszukiwarką, gdy w porównaniu coś jest: wraca do listy bez włączania aparatu. */
function CompareBar({ onOpen }: { onOpen: () => void }) {
  const { items, expiresAt } = useCompare();
  if (items.length === 0) return null;
  return (
    <button type="button" className="fd-prod-compare" onClick={onOpen}>
      <Scale size={20} strokeWidth={2} aria-hidden />
      <span className="fd-prod-compare-text">
        <b>{T.compare(items.length)}</b>
        {expiresAt !== null && <span>{T.expires(TIME.format(expiresAt))}</span>}
      </span>
      <ChevronRight size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}

/**
 * Produkty — przeglądarka bazy Open Food Facts: wyszukiwanie (także kodem kreskowym ze skanera),
 * sortowanie, filtry w arkuszu, karty albo tabela, strony po 48 i karta produktu. Cały stan strony
 * (filtry, sortowanie, widok, strona, otwarty produkt, skaner) stoi w zapytaniu hasha
 * (`#/produkty?q=skyr&ns=a&p=590…`, `?skan=1`), więc odświeżenie albo wysłany link pokazuje
 * dokładnie to samo.
 */
export default function ProductsPage() {
  const data = useDataset();
  if (data.status === 'loading') return <StatusScreen kind="loading" />;
  if (data.status === 'error') return <StatusScreen kind="error" message={data.message} onRetry={data.retry} />;
  return <Browser dataset={data.dataset} products={data.products} />;
}

function Browser({ dataset, products }: { dataset: Dataset; products: IndexedProduct[] }) {
  const [state, update, closeProduct, closeScan] = useViewState();
  const [sheetOpen, setSheetOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const dict = dataset.dictionaries;

  // Filtrowanie 29 tysięcy produktów trwa dziesiątki milisekund. Odroczona wartość trzyma pola
  // w gotowości do pisania, a lista dogania je chwilę później — do tego czasu jest przygaszona.
  const filters = useDeferredValue(state.filters);
  const sort = useDeferredValue(state.sort);
  const { results, facets } = useMemo(() => browse(products, filters), [products, filters]);
  const sorted = useMemo(() => sortProducts(results, sort), [results, sort]);
  const stale = filters !== state.filters || sort !== state.sort;

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(state.page, pageCount);
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const byCode = useMemo(() => new Map(products.map((p) => [p.code, p])), [products]);
  const openProduct = state.product ? byCode.get(state.product) : undefined;
  const allergens = useMemo(() => allergenOptions(products), [products]);

  const setFilters = (next: Filters) => update({ filters: next });
  // Otwarcie dodaje wpis historii — Wstecz zamyka kartę produktu, zamiast wychodzić z Produktów.
  const open = (code: string) => update({ product: code }, { push: true });
  const goToPage = (next: number) => {
    update({ page: next });
    // Na początek listy, nie strony: wyszukiwarka i filtry zostają tuż nad nią, pod paskiem aplikacji.
    top.current?.scrollIntoView?.({ block: 'start' });
  };
  const activeCount = countActiveFilters(state.filters);

  return (
    <>
      <div className="wrap fd-products">
        <h2 className="sr-only">{T.heading}</h2>
        <EatOutLink />
        <Toolbar
          query={state.filters.q}
          onQuery={(q) => update((s) => ({ filters: { ...s.filters, q } }))}
          sort={state.sort}
          onSort={(next) => update({ sort: next })}
          activeFilters={activeCount}
          onOpenFilters={() => setSheetOpen(true)}
          onScan={() => update({ scan: 'camera' }, { push: true })}
        />
        {!state.scan && <CompareBar onOpen={() => update({ scan: 'list' }, { push: true })} />}

        <div className="fd-found-row" ref={top}>
          <p className="fd-found" aria-live="polite">
            {T.found} <strong>{productsLabel(sorted.length)}</strong>
            {pageCount > 1 && (
              <span className="fd-found-page">{T.page(formatNumber(page, 0), formatNumber(pageCount, 0))}</span>
            )}
          </p>
          <Segmented<View>
            label={T.view}
            value={state.view}
            onChange={(view) => update({ view })}
            options={VIEWS.map(({ key, label, Icon }) => ({
              key,
              label: (
                <>
                  <Icon size={20} strokeWidth={2} aria-hidden />
                  <span className="fd-view-label">{label}</span>
                </>
              ),
            }))}
          />
        </div>
        <ActiveFilters filters={state.filters} dict={dict} onChange={setFilters} />
      </div>

      <div className={`wrap fd-results${stale ? ' fd-prod-stale' : ''}`} aria-busy={stale || undefined}>
        {sorted.length === 0 ? (
          <EmptyState
            title={T.empty}
            action={
              <button type="button" className="btn sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                {T.clear}
              </button>
            }
          />
        ) : state.view === 'table' ? (
          <ProductTable products={pageItems} dict={dict} sort={state.sort} onSort={(next) => update({ sort: next })} onOpen={open} />
        ) : (
          <ul className="fd-grid" aria-label={T.list}>
            {pageItems.map((p) => (
              <li key={p.code}>
                <ProductCard product={p} dict={dict} onOpen={open} />
              </li>
            ))}
          </ul>
        )}

        <Pagination page={page} pageCount={pageCount} onPage={goToPage} />
      </div>

      <DataFooter dataset={dataset} />

      <FilterSheet
        open={sheetOpen}
        resultCount={sorted.length}
        activeCount={activeCount}
        onClear={() => setFilters(EMPTY_FILTERS)}
        onClose={() => setSheetOpen(false)}
      >
        <FilterPanel filters={state.filters} facets={facets} dict={dict} allergenOptions={allergens} onChange={setFilters} />
      </FilterSheet>

      {state.scan && (
        <ScanSheet
          products={products}
          dict={dict}
          camera={state.scan === 'camera'}
          covered={openProduct !== undefined}
          onOpenProduct={open}
          onClose={closeScan}
        />
      )}

      {openProduct && (
        <ProductDetail
          key={openProduct.code}
          product={openProduct}
          dict={dict}
          onClose={closeProduct}
          // Nad skanerem porównanie leży tuż pod kartą; nad listą zastępuje kartę we wpisie historii
          // (Wstecz wraca do listy).
          onShowCompare={state.scan ? closeProduct : () => update({ product: null, scan: 'list' })}
        />
      )}
    </>
  );
}
