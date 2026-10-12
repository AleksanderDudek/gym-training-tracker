import { Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Segmented } from '../../../components/ui';
import { db } from '../../diet/db';
import {
  autoSetName,
  partOf,
  setFood,
  setTotals,
  withGrams,
  type Food,
  type FoodSet,
} from '../../diet/foods';
import { searchFoods } from '../../diet/search';
import { logFood, logQuick } from '../../diet/store';
import { useRestaurants } from '../../hooks/useRestaurants';
import { formatNumber } from '../../lib/format';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import type { Chain } from '../../restaurants/types';
import { Sheet } from '../common/Sheet';
import { MacroLine } from './SuggestionList';

interface Props {
  open: boolean;
  date: string;
  pool: Food[];
  products: IndexedProduct[];
  dict: Dictionaries;
  /** Baza produktów jeszcze się wczytuje: wyszukiwanie zna na razie plan, przepisy, lokale i własne jedzenie. */
  productsLoading: boolean;
  onClose: () => void;
  /** Po zapisie: krótka wiadomość na dole ekranu (most do treningów). */
  onLogged: (text: string) => void;
}

function numberOrNull(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Jedzenie w wybranej gramaturze — tylko to, co ma wartości na 100 g; reszta zostaje porcją. */
function atGrams(food: Food, grams: string): Food {
  const g = numberOrNull(grams);
  return food.per100 && g ? withGrams(food, g) : food;
}

const NO_CHAINS: Chain[] = [];

/**
 * „Dodaj zjedzone”: szuka we wszystkim, co da się zjeść — własnych zestawach i jedzeniu, pozycjach
 * planu, przepisach, menu lokali i każdym produkcie z bazy; składa zestaw z kilku rzeczy („Banan
 * + batonik”) albo zapisuje same kalorie, jak „extra kcal” z arkusza na obiad na mieście. Wspólny
 * arkusz od dołu; treść żyje tylko w otwartym, więc zamknięcie czyści pola, a fokus po otwarciu
 * stoi w wyszukiwaniu (`data-autofocus`).
 */
export function FoodPicker({ open, onClose, ...rest }: Props) {
  return (
    <Sheet open={open} title="Dodaj zjedzone" onClose={onClose} className="fd-diet-sheet">
      {open && <PickerBody {...rest} onDone={onClose} />}
    </Sheet>
  );
}

type BodyProps = Omit<Props, 'open' | 'onClose'> & { onDone: () => void };

type Mode = 'search' | 'set' | 'quick';

const QUICK = { name: '', kcal: '', protein: '', carbs: '', fat: '', save: false };

/**
 * Menu lokali do wyszukiwania. Wczytuje się z otwarciem arkusza — osobna paczka, więc dziennik
 * rysuje się bez niej; do tego czasu (i bez sieci) wyszukiwanie po prostu ich nie zna.
 */
function useMenus(): Chain[] {
  const menus = useRestaurants();
  return menus.status === 'ready' ? menus.chains : NO_CHAINS;
}

/** Lista wyników: przycisk na pozycję, z liczbami, ilością i pochodzeniem. */
function FoodResults({ results, onPick }: { results: Food[]; onPick: (food: Food) => void }) {
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {results.length ? `Wyników: ${results.length}` : 'Brak wyników'}
      </p>
      <ul className="fd-diet-results">
        {results.map((food) => (
          <li key={food.key}>
            <button type="button" className="fd-diet-result" onClick={() => onPick(food)}>
              <span className="fd-diet-name">{food.name}</span>
              <span className="fd-diet-meta">
                <MacroLine food={food} /> · {food.amountLabel} · {food.detail}
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="fd-diet-empty">Nic nie pasuje – dodaj samo „Tylko kalorie”.</li>}
      </ul>
    </>
  );
}

function PickerBody(props: BodyProps) {
  const [mode, setMode] = useState<Mode>('search');
  return (
    <>
      <Segmented
        label="Sposób dodania"
        options={[
          { key: 'search', label: 'Szukaj' },
          { key: 'set', label: 'Zestaw' },
          { key: 'quick', label: 'Tylko kalorie' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'search' ? <SearchMode {...props} /> : mode === 'set' ? <SetBuilder {...props} /> : <QuickMode {...props} />}
    </>
  );
}

/** Zapis raz: podwójne stuknięcie nie może zapisać tego samego posiłku dwa razy. */
function useOnce(onLogged: (text: string) => void, onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const once = async (work: () => Promise<unknown>, text: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      onLogged(text);
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return { busy, once };
}

function SearchMode({ date, pool, products, dict, productsLoading, onDone, onLogged }: BodyProps) {
  const chains = useMenus();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const { busy, once } = useOnce(onLogged, onDone);

  const results = useMemo(
    () => searchFoods({ query, pool, chains, products, dict }),
    [query, pool, chains, products, dict],
  );
  const chosen = selected ? atGrams(selected, grams) : null;

  const add = () => {
    if (chosen)
      void once(
        () => logFood(date, chosen),
        `Zapisane: ${chosen.name} · ${formatNumber(chosen.nutrients.kcal, 0)} kcal.`,
      );
  };

  return (
    <div className="fd-diet-picker">
      <input
        type="search"
        data-autofocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        placeholder="Produkt, przepis, lokal, pozycja planu…"
        aria-label="Szukaj jedzenia"
        enterKeyHint="search"
        autoComplete="off"
      />
      {productsLoading && (
        <p className="fd-diet-hint">Wczytuję bazę produktów — na razie szukam w planie, przepisach, lokalach i Twoim jedzeniu.</p>
      )}
      {chosen ? (
        <div className="fd-diet-chosen">
          <p className="fd-diet-name">{chosen.name}</p>
          <p className="fd-diet-meta">{chosen.detail}</p>
          {chosen.per100 && (
            <label className="fld fd-diet-grams">
              <span>Ile gramów</span>
              <input
                type="text"
                className="num"
                inputMode="decimal"
                autoComplete="off"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
            </label>
          )}
          <p className="fd-diet-meta">
            <MacroLine food={chosen} /> · {chosen.amountLabel}
          </p>
          <div className="fd-diet-acts">
            <button type="button" className="btn" onClick={add} disabled={busy}>
              Dodaj
            </button>
            <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
              Wróć
            </button>
          </div>
        </div>
      ) : (
        <FoodResults
          results={results}
          onPick={(food) => {
            setSelected(food);
            setGrams(food.grams ? String(food.grams) : '');
          }}
        />
      )}
    </div>
  );
}

interface Part {
  /** Klucz wiersza: ta sama rzecz może wejść do zestawu dwa razy (dwa banany w dwóch wierszach). */
  row: number;
  food: Food;
  grams: string;
}

/**
 * Zestaw — kilka rzeczy zjedzonych razem („Banan + batonik”), zapisanych w dzienniku jako jedna
 * pozycja. Zaznaczone „Zapisz jako mój zestaw” zostawia go na później: wraca w wyszukiwaniu
 * i propozycjach, a usuwa się go w Profilu diety → Twoje dane. Części są kopiami (jak wpisy
 * dziennika), więc zestaw nie zmienia się razem z bazą produktów.
 */
function SetBuilder({ date, pool, products, dict, productsLoading, onDone, onLogged }: BodyProps) {
  const chains = useMenus();
  const [name, setName] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [query, setQuery] = useState('');
  const [save, setSave] = useState(true);
  const rows = useRef(0);
  const { busy, once } = useOnce(onLogged, onDone);

  const results = useMemo(
    () => (query.trim() ? searchFoods({ query, pool, chains, products, dict, noSets: true }) : []),
    [query, pool, chains, products, dict],
  );
  const chosenParts = parts.map((p) => partOf(atGrams(p.food, p.grams)));
  const finalName = name.trim() || autoSetName(chosenParts);
  const total = setTotals(chosenParts);

  const addPart = (food: Food) => {
    rows.current += 1;
    setParts((list) => [...list, { row: rows.current, food, grams: food.grams ? String(food.grams) : '' }]);
    setQuery('');
  };

  const add = () => {
    if (!chosenParts.length) return;
    const set: FoodSet = { name: finalName, parts: chosenParts };
    void once(
      () =>
        // Jedna transakcja: zestaw i wpis przychodzą razem albo wcale.
        db.transaction('rw', db.entries, db.sets, async () => {
          const id = save ? await db.sets.add(set) : undefined;
          await logFood(date, setFood(id === undefined ? set : { ...set, id }));
        }),
      `Zapisane: ${finalName} · ${formatNumber(total.kcal, 0)} kcal.${save ? ' Zestaw czeka w wyszukiwaniu.' : ''}`,
    );
  };

  return (
    <div className="fd-diet-set">
      <label className="fld">
        <span>Nazwa zestawu</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={chosenParts.length ? autoSetName(chosenParts) : 'np. Banan i batonik'}
          autoComplete="off"
        />
      </label>

      <p className="fd-diet-group">W zestawie</p>
      {parts.length === 0 ? (
        <p className="fd-diet-hint">Nic jeszcze — wyszukaj poniżej pierwszą rzecz, np. „banan”, potem „baton”.</p>
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
                    <span>Gramy</span>
                    <input
                      type="text"
                      className="num"
                      inputMode="decimal"
                      autoComplete="off"
                      value={p.grams}
                      onChange={(e) =>
                        setParts((list) => list.map((x) => (x.row === p.row ? { ...x, grams: e.target.value } : x)))
                      }
                      aria-label={`Ile gramów: ${p.food.name}`}
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="fd-diet-icon-btn"
                  onClick={() => setParts((list) => list.filter((x) => x.row !== p.row))}
                  aria-label={`Usuń z zestawu: ${p.food.name}`}
                >
                  <Trash2 size={20} strokeWidth={2} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {parts.length > 0 && (
        <p className="fd-diet-total" aria-live="polite">
          Razem: <MacroLine food={setFood({ name: finalName, parts: chosenParts })} />
        </p>
      )}

      <input
        type="search"
        data-autofocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Dodaj: produkt, przepis, lokal…"
        aria-label="Szukaj rzeczy do zestawu"
        enterKeyHint="search"
        autoComplete="off"
      />
      {productsLoading && query.trim() && (
        <p className="fd-diet-hint">Wczytuję bazę produktów — na razie szukam w przepisach, lokalach i Twoim jedzeniu.</p>
      )}
      {query.trim() && <FoodResults results={results} onPick={addPart} />}

      <label className="check-row">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
        Zapisz jako mój zestaw (pojawi się w wyszukiwaniu i propozycjach)
      </label>
      <button type="button" className="btn wide" onClick={add} disabled={busy || parts.length === 0}>
        Dodaj
      </button>
    </div>
  );
}

function QuickMode({ date, onDone, onLogged }: BodyProps) {
  const [quick, setQuick] = useState(QUICK);
  const { busy, once } = useOnce(onLogged, onDone);

  const addQuick = () => {
    const kcal = numberOrNull(quick.kcal);
    if (kcal === null) return;
    const macros = {
      protein: numberOrNull(quick.protein),
      carbs: numberOrNull(quick.carbs),
      fat: numberOrNull(quick.fat),
    };
    const name = quick.name.trim();
    void once(
      () =>
        // Jedna transakcja: posiłek i zapisane jedzenie przychodzą razem albo wcale.
        db.transaction('rw', db.entries, db.foods, async () => {
          await logQuick(date, name, kcal, macros);
          if (quick.save && name) await db.foods.add({ name, amountLabel: '1 porcja', kcal, ...macros });
        }),
      `Zapisane: ${name || 'Coś poza planem'} · ${formatNumber(kcal, 0)} kcal.`,
    );
  };

  return (
    <form
      className="fd-diet-quick"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        addQuick();
      }}
    >
      <p className="fd-diet-hint">
        Jedzenie z sieci (McDonald's, KFC, Starbucks i inne) znajdziesz w „Szukaj” — razem z makro.
      </p>
      <label className="fld">
        <span>Co to było</span>
        <input
          type="text"
          value={quick.name}
          onChange={(e) => setQuick({ ...quick, name: e.target.value })}
          placeholder="np. obiad u rodziców"
        />
      </label>
      <label className="fld">
        <span>Kalorie (kcal)</span>
        <input
          type="text"
          className="num"
          required
          inputMode="decimal"
          autoComplete="off"
          value={quick.kcal}
          onChange={(e) => setQuick({ ...quick, kcal: e.target.value })}
        />
      </label>
      <p className="fd-diet-hint">Makroskładniki – jeśli znasz:</p>
      <div className="fd-diet-grid3">
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="fld">
            <span>{{ protein: 'Białko (g)', carbs: 'Węglowodany (g)', fat: 'Tłuszcz (g)' }[k]}</span>
            <input
              type="text"
              className="num"
              inputMode="decimal"
              autoComplete="off"
              value={quick[k]}
              onChange={(e) => setQuick({ ...quick, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="check-row">
        <input type="checkbox" checked={quick.save} onChange={(e) => setQuick({ ...quick, save: e.target.checked })} />
        Zapisz jako moje jedzenie (pojawi się w wyszukiwaniu i propozycjach)
      </label>
      <button type="submit" className="btn wide" disabled={busy || numberOrNull(quick.kcal) === null}>
        Dodaj
      </button>
    </form>
  );
}
