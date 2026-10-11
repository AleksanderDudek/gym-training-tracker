import { useMemo, useState } from 'react';
import { Segmented } from '../../../components/ui';
import { db } from '../../diet/db';
import { productFood, withGrams, type Food } from '../../diet/foods';
import { logFood, logQuick } from '../../diet/store';
import { formatNumber } from '../../lib/format';
import { matchesQuery } from '../../lib/search';
import { normalizeForSearch, tokenize } from '../../lib/text';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { Sheet } from './Sheet';
import { MacroLine } from './SuggestionList';

interface Props {
  open: boolean;
  date: string;
  pool: Food[];
  products: IndexedProduct[];
  dict: Dictionaries;
  /** Baza produktów jeszcze się wczytuje: wyszukiwanie zna na razie plan, przepisy i własne jedzenie. */
  productsLoading: boolean;
  onClose: () => void;
  /** Po zapisie: krótka wiadomość na dole ekranu (most do treningów). */
  onLogged: (text: string) => void;
}

const MAX_RESULTS = 30;

function numberOrNull(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * „Dodaj zjedzone”: szuka we wszystkim, co da się zjeść — pozycjach planu, własnym jedzeniu,
 * przepisach i każdym produkcie z bazy — albo zapisuje same kalorie, jak „extra kcal” z arkusza
 * na obiad na mieście. Arkusz od dołu; zamknięcie czyści pola (treść żyje tylko w otwartym).
 */
export function FoodPicker({ open, onClose, ...rest }: Props) {
  return (
    <Sheet open={open} title="Dodaj zjedzone" onClose={onClose}>
      <PickerBody {...rest} onDone={onClose} />
    </Sheet>
  );
}

type BodyProps = Omit<Props, 'open' | 'onClose'> & { onDone: () => void };

const QUICK = { name: '', kcal: '', protein: '', carbs: '', fat: '', save: false };

function PickerBody({ date, pool, products, dict, productsLoading, onDone, onLogged }: BodyProps) {
  const [tab, setTab] = useState<'search' | 'quick'>('search');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [quick, setQuick] = useState(QUICK);
  // Podwójne stuknięcie nie może zapisać tego samego posiłku dwa razy.
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => {
    const tokens = tokenize(query);
    const ownFirst = pool.filter((f) => f.source !== 'product');
    if (!tokens.length) return ownFirst.slice(0, MAX_RESULTS);
    const fromPool = ownFirst.filter((f) => matchesQuery(normalizeForSearch(f.name), tokens));
    const fromProducts: Food[] = [];
    for (const p of products) {
      if (fromProducts.length >= MAX_RESULTS) break;
      if (!matchesQuery(p.searchText, tokens)) continue;
      const food = productFood(p, dict);
      if (food) fromProducts.push(food);
    }
    return [...fromPool, ...fromProducts].slice(0, MAX_RESULTS);
  }, [query, pool, products, dict]);

  const typedGrams = numberOrNull(grams);
  const chosen = selected && selected.per100 && typedGrams ? withGrams(selected, typedGrams) : selected;

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

  const add = () => {
    if (chosen)
      void once(
        () => logFood(date, chosen),
        `Zapisane: ${chosen.name} · ${formatNumber(chosen.nutrients.kcal, 0)} kcal.`,
      );
  };

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
    <>
      <Segmented
        label="Sposób dodania"
        options={[
          { key: 'search', label: 'Szukaj' },
          { key: 'quick', label: 'Tylko kalorie' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'search' ? (
        <div className="fd-picker">
          <input
            type="search"
            data-autofocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Produkt, przepis, pozycja planu…"
            aria-label="Szukaj jedzenia"
            enterKeyHint="search"
            autoComplete="off"
          />
          {productsLoading && (
            <p className="fd-hint">Wczytuję bazę produktów — na razie szukam w planie, przepisach i Twoim jedzeniu.</p>
          )}
          {chosen ? (
            <div className="fd-chosen">
              <p className="fd-name">{chosen.name}</p>
              <p className="fd-meta">{chosen.detail}</p>
              {chosen.per100 && (
                <label className="fld fd-grams">
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
              <p className="fd-meta">
                <MacroLine food={chosen} /> · {chosen.amountLabel}
              </p>
              <div className="fd-acts">
                <button type="button" className="btn" onClick={add} disabled={busy}>
                  Dodaj
                </button>
                <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
                  Wróć
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {results.length ? `Wyników: ${results.length}` : 'Brak wyników'}
              </p>
              <ul className="fd-results">
                {results.map((food) => (
                  <li key={food.key}>
                    <button
                      type="button"
                      className="fd-result"
                      onClick={() => {
                        setSelected(food);
                        setGrams(food.grams ? String(food.grams) : '');
                      }}
                    >
                      <span className="fd-name">{food.name}</span>
                      <span className="fd-meta">
                        <MacroLine food={food} /> · {food.amountLabel} · {food.detail}
                      </span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && <li className="fd-empty">Nic nie pasuje – dodaj samo „Tylko kalorie”.</li>}
              </ul>
            </>
          )}
        </div>
      ) : (
        <form
          className="fd-quick"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            addQuick();
          }}
        >
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
          <p className="fd-hint">Makroskładniki – jeśli znasz:</p>
          <div className="fd-grid3">
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
            <input
              type="checkbox"
              checked={quick.save}
              onChange={(e) => setQuick({ ...quick, save: e.target.checked })}
            />
            Zapisz jako moje jedzenie (pojawi się w wyszukiwaniu i propozycjach)
          </label>
          <button type="submit" className="btn wide" disabled={busy || numberOrNull(quick.kcal) === null}>
            Dodaj
          </button>
        </form>
      )}
    </>
  );
}
