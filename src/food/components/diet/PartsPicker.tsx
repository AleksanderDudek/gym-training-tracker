import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { partOf, setFood, withGrams, type Food, type SetPart } from '../../diet/foods';
import { searchFoods } from '../../diet/search';
import { useRestaurants } from '../../hooks/useRestaurants';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import type { Chain } from '../../restaurants/types';
import { text } from '../../../i18n';
import { StarButton } from '../common/StarButton';
import { DT } from './dietText';
import { MacroLine } from './SuggestionList';

const T = text({
  pl: {
    addNow: 'Dodaj od razu',
    addNowFood: (name: string) => `Dodaj od razu: ${name}`,
    others: 'Pozostałe',
    results: (n: number) => `Wyników: ${n}`,
    noResults: 'Brak wyników',
    nothing: 'Nic nie pasuje – dodaj samo „Tylko kalorie”.',
    grams: 'Gramy',
    gramsOf: (name: string) => `Ile gramów: ${name}`,
    badGrams: 'Wpisz gramy przy każdej rzeczy — więcej niż 0.',
    total: 'Razem:',
    searchPlaceholder: 'Dodaj: produkt, przepis, lokal…',
    loading: 'Wczytuję bazę produktów — na razie szukam w przepisach, lokalach i Twoim jedzeniu.',
  },
  en: {
    addNow: 'Add now',
    addNowFood: (name: string) => `Add now: ${name}`,
    others: 'Others',
    results: (n: number) => `Results: ${n}`,
    noResults: 'No results',
    nothing: 'Nothing matches – add it as “Calories only”.',
    grams: 'Grams',
    gramsOf: (name: string) => `Grams: ${name}`,
    badGrams: 'Enter the grams for each thing — more than 0.',
    total: 'Total:',
    searchPlaceholder: 'Add: product, recipe, restaurant…',
    loading: 'Loading the product database — for now I’m searching recipes, restaurants and your food.',
  },
});

/**
 * Szukanie jedzenia i składanie z niego kilku części — wspólne dla „Zestawu” w „Dodaj zjedzone”
 * i dla cheat mealu z listy. Jedna wyszukiwarka wszędzie (`searchFoods`: własne zestawy i jedzenie,
 * plan, przepisy, menu lokali, produkty; ulubione na górze), części z gramaturą i suma na żywo.
 */

/** Liczba z polskim przecinkiem albo kropką; `null`, gdy pole puste albo to nie liczba. */
export function numberOrNull(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Jedzenie w wybranej gramaturze — tylko to, co ma wartości na 100 g; reszta zostaje porcją. */
export function atGrams(food: Food, grams: string): Food {
  const g = numberOrNull(grams);
  return food.per100 && g ? withGrams(food, g) : food;
}

const NO_CHAINS: Chain[] = [];

/**
 * Menu lokali do wyszukiwania. Wczytuje się z otwarciem arkusza — osobna paczka, więc dziennik
 * rysuje się bez niej; do tego czasu (i bez sieci) wyszukiwanie po prostu ich nie zna.
 */
export function useMenus(): Chain[] {
  const menus = useRestaurants();
  return menus.status === 'ready' ? menus.chains : NO_CHAINS;
}

interface ResultsProps {
  results: Food[];
  onPick: (food: Food) => void;
  /** Ulubione zapisuje się jednym stuknięciem „+” — w ilości z gwiazdki. */
  onQuickAdd?: (food: Food) => void;
}

/**
 * Lista wyników: przycisk na pozycję, z liczbami, ilością i pochodzeniem, i gwiazdka „Ulubione”.
 * Ulubione stoją na górze, pod własnym nagłówkiem.
 */
export function FoodResults({ results, onPick, onQuickAdd }: ResultsProps) {
  const favorites = results.filter((f) => f.favorite);
  const rest = results.filter((f) => !f.favorite);
  const row = (food: Food) => (
    <li key={food.key} className="fd-diet-result-row">
      <button type="button" className="fd-diet-result" onClick={() => onPick(food)}>
        <span className="fd-diet-name">{food.name}</span>
        <span className="fd-diet-meta">
          <MacroLine food={food} /> · {food.amountLabel} · {food.detail}
        </span>
      </button>
      {onQuickAdd && food.favorite && (
        <button
          type="button"
          className="fd-diet-icon-btn"
          onClick={() => onQuickAdd(food)}
          aria-label={T.addNowFood(food.name)}
          title={T.addNow}
        >
          <Plus size={20} strokeWidth={2} aria-hidden />
        </button>
      )}
      <StarButton food={food} />
    </li>
  );
  const heading = (text: string) => (
    <li key={`grupa:${text}`} className="fd-diet-group">
      {text}
    </li>
  );
  // Jedna lista z kluczami, nagłówki grup w niej: wiersz, któremu stuknięto gwiazdkę, przechodzi do
  // drugiej grupy jako ten sam element — React go przesuwa i fokus zostaje na gwiazdce.
  const rows = favorites.length
    ? [heading(DT.favorites), ...favorites.map(row), ...(rest.length ? [heading(T.others)] : []), ...rest.map(row)]
    : rest.map(row);
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {results.length ? T.results(results.length) : T.noResults}
      </p>
      <ul className="fd-diet-results">
        {rows}
        {results.length === 0 && <li className="fd-diet-empty">{T.nothing}</li>}
      </ul>
    </>
  );
}


export interface Part {
  /** Klucz wiersza: ta sama rzecz może wejść dwa razy (dwa banany w dwóch wierszach). */
  row: number;
  food: Food;
  grams: string;
}

/** Puste albo zerowe gramy nie mogą po cichu zostać całym opakowaniem — część czeka na poprawkę. */
export const badGrams = (p: Part) => p.food.per100 !== null && !numberOrNull(p.grams);

/** Części jako migawki w wybranej gramaturze. */
export const partsOf = (parts: Part[]): SetPart[] => parts.map((p) => partOf(atGrams(p.food, p.grams)));

interface PickerProps {
  parts: Part[];
  onParts: (update: (parts: Part[]) => Part[]) => void;
  pool: Food[];
  products: IndexedProduct[];
  dict: Dictionaries;
  productsLoading: boolean;
  /** Nagłówek listy części: „W zestawie”, „W cheat mealu”. */
  heading: string;
  /** Zdanie, gdy nic jeszcze nie wybrano. */
  empty: string;
  searchLabel: string;
  /** Początek etykiety przycisku usuwania: „Usuń z zestawu: Banan”. */
  removeLabel: string;
  /** Nazwa do linijki „Razem” (zestaw podpisuje się swoją nazwą). */
  totalName: string;
  /** Bez własnych zestawów w wynikach — zestaw w zestawie nie ma sensu. */
  noSets?: boolean;
  /** Ulubione i własne jedzenie widać już przed wpisaniem czegokolwiek. */
  showOwnWhenEmpty?: boolean;
}

export function PartsPicker({
  parts,
  onParts,
  pool,
  products,
  dict,
  productsLoading,
  heading,
  empty,
  searchLabel,
  removeLabel,
  totalName,
  noSets = false,
  showOwnWhenEmpty = false,
}: PickerProps) {
  const chains = useMenus();
  const [query, setQuery] = useState('');
  const rows = useRef(0);
  const typed = query.trim().length > 0;

  const results = useMemo(
    () => (typed || showOwnWhenEmpty ? searchFoods({ query, pool, chains, products, dict, noSets }) : []),
    [typed, showOwnWhenEmpty, query, pool, chains, products, dict, noSets],
  );
  const chosen = partsOf(parts);
  const anyBad = parts.some(badGrams);

  const addPart = (food: Food) => {
    rows.current += 1;
    const row = rows.current;
    onParts((list) => [...list, { row, food, grams: food.grams ? String(food.grams) : '' }]);
    setQuery('');
  };

  return (
    <>
      <p className="fd-diet-group">{heading}</p>
      {parts.length === 0 ? (
        <p className="fd-diet-hint">{empty}</p>
      ) : (
        <ul className="fd-diet-list fd-diet-parts">
          {parts.map((p) => {
            const food = atGrams(p.food, p.grams);
            return (
              <li key={p.row} className="fd-diet-part">
                <div className="fd-diet-row-main">
                  <p className="fd-diet-name">{p.food.name}</p>
                  <p className="fd-diet-meta">
                    <MacroLine food={food} />
                    {!p.food.per100 && ` · ${food.amountLabel}`}
                  </p>
                </div>
                {p.food.per100 && (
                  <label className="fld fd-diet-part-grams">
                    <span>{T.grams}</span>
                    <input
                      type="text"
                      className="num"
                      inputMode="decimal"
                      autoComplete="off"
                      value={p.grams}
                      onChange={(e) =>
                        onParts((list) => list.map((x) => (x.row === p.row ? { ...x, grams: e.target.value } : x)))
                      }
                      aria-label={T.gramsOf(p.food.name)}
                      aria-invalid={badGrams(p) || undefined}
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="fd-diet-icon-btn"
                  onClick={() => onParts((list) => list.filter((x) => x.row !== p.row))}
                  aria-label={`${removeLabel}: ${p.food.name}`}
                >
                  <Trash2 size={20} strokeWidth={2} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {anyBad && <p className="fd-diet-hint fd-diet-warn">{T.badGrams}</p>}
      {parts.length > 0 && (
        <p className="fd-diet-total" aria-live="polite">
          {T.total} <MacroLine food={setFood({ name: totalName, parts: chosen })} />
        </p>
      )}

      <input
        type="search"
        data-autofocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={T.searchPlaceholder}
        aria-label={searchLabel}
        enterKeyHint="search"
        autoComplete="off"
      />
      {productsLoading && typed && <p className="fd-diet-hint">{T.loading}</p>}
      {(typed || (showOwnWhenEmpty && results.length > 0)) && <FoodResults results={results} onPick={addPart} />}
    </>
  );
}
