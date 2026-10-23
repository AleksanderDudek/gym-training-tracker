import { ScanBarcode, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '../../../components/ui';
import { db } from '../../diet/db';
import { autoSetName, productFood, setFood, setTotals, type Food, type FoodSet } from '../../diet/foods';
import { searchFoods } from '../../diet/search';
import { logFood, logQuick } from '../../diet/store';
import { useCodeLookup, type Lookup } from '../../hooks/useCodeLookup';
import { text } from '../../../i18n';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { scanFood } from '../../scan/compare';
import { BarcodeCamera } from '../common/BarcodeCamera';
import { CodeEntry } from '../common/CodeEntry';
import { Sheet } from '../common/Sheet';
import { StarButton } from '../common/StarButton';
import { DT } from './dietText';
import { FoodResults, PartsPicker, atGrams, badGrams, numberOrNull, partsOf, useMenus, type Part } from './PartsPicker';
import { MacroLine } from './SuggestionList';

const T = text({
  pl: {
    how: 'Sposób dodania',
    search: 'Szukaj',
    set: 'Zestaw',
    quick: 'Tylko kalorie',
    searchPlaceholder: 'Produkt, przepis, lokal, pozycja planu…',
    searchLabel: 'Szukaj jedzenia',
    loading: 'Wczytuję bazę produktów — na razie szukam w planie, przepisach, lokalach i Twoim jedzeniu.',
    grams: 'Ile gramów',
    add: 'Dodaj',
    back: 'Wróć',
    setWaits: ' Zestaw czeka w wyszukiwaniu.',
    setName: 'Nazwa zestawu',
    setPlaceholder: 'np. Banan i batonik',
    inSet: 'W zestawie',
    setEmpty: 'Nic jeszcze — wyszukaj poniżej pierwszą rzecz, np. „banan”, potem „baton”.',
    setSearch: 'Szukaj rzeczy do zestawu',
    setRemove: 'Usuń z zestawu',
    saveSet: 'Zapisz jako mój zestaw (pojawi się w wyszukiwaniu i propozycjach)',
    /** The amount of a food of the user's own, saved with it. */
    portion: '1 porcja',
    /** The name of a calories-only entry without one; `logQuick` saves the same. */
    offPlan: 'Coś poza planem',
    chains: 'Jedzenie z sieci (McDonald\'s, KFC, Starbucks i inne) znajdziesz w „Szukaj” — razem z makro.',
    what: 'Co to było',
    whatPlaceholder: 'np. obiad u rodziców',
    macrosHint: 'Makroskładniki – jeśli znasz:',
    saveFood: 'Zapisz jako moje jedzenie (pojawi się w wyszukiwaniu i propozycjach)',
    scan: 'Skanuj kod kreskowy',
    scanClose: 'Zamknij skaner',
    scanSearching: (code: string) => `Szukam kodu ${code} w Open Food Facts…`,
    scanUnknown: (code: string) => `Nie znam produktu o kodzie ${code} — wyszukaj go po nazwie albo dodaj same kalorie.`,
    scanInStore: (code: string) => `${code} to kod sklepowy (towar ważony w sklepie) — wyszukaj produkt po nazwie.`,
    scanFailed: (code: string) => `Kodu ${code} nie ma w bazie aplikacji, a Open Food Facts teraz nie odpowiada.`,
    scanPartial: (name: string) => `${name}: etykieta nie podaje wszystkich makroskładników — dodaj go jako „Tylko kalorie”.`,
  },
  en: {
    how: 'How to add',
    search: 'Search',
    set: 'Set',
    quick: 'Calories only',
    searchPlaceholder: 'Product, recipe, restaurant, plan item…',
    searchLabel: 'Search food',
    loading: 'Loading the product database — for now I’m searching the plan, recipes, restaurants and your food.',
    grams: 'Grams',
    add: 'Add',
    back: 'Back',
    setWaits: ' The set is waiting for you in search.',
    setName: 'Set name',
    setPlaceholder: 'e.g. Banana and a bar',
    inSet: 'In the set',
    setEmpty: 'Nothing yet — search below for the first thing, e.g. “banana”, then “bar”.',
    setSearch: 'Search for things to add to the set',
    setRemove: 'Remove from the set',
    saveSet: 'Save as my set (it will show up in search and suggestions)',
    portion: '1 serving',
    offPlan: 'Something off-plan',
    chains: 'Food from chains (McDonald’s, KFC, Starbucks and more) is in “Search” — with its macros.',
    what: 'What was it',
    whatPlaceholder: 'e.g. lunch at your parents’',
    macrosHint: 'Macros – if you know them:',
    saveFood: 'Save as my food (it will show up in search and suggestions)',
    scan: 'Scan a barcode',
    scanClose: 'Close the scanner',
    scanSearching: (code: string) => `Looking for code ${code} on Open Food Facts…`,
    scanUnknown: (code: string) => `I don’t know the product with code ${code} — search for it by name or add just the calories.`,
    scanInStore: (code: string) => `${code} is a shop’s own code (goods weighed in the shop) — search for the product by name.`,
    scanFailed: (code: string) => `Code ${code} isn’t in the app’s database, and Open Food Facts isn’t answering right now.`,
    scanPartial: (name: string) => `${name}: the label doesn’t give all the macros — add it as “Calories only”.`,
  },
});

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

/**
 * „Dodaj zjedzone”: szuka we wszystkim, co da się zjeść — własnych zestawach i jedzeniu, pozycjach
 * planu, przepisach, menu lokali i każdym produkcie z bazy; składa zestaw z kilku rzeczy („Banan
 * + batonik”) albo zapisuje same kalorie, jak „extra kcal” z arkusza na obiad na mieście. Wspólny
 * arkusz od dołu; treść żyje tylko w otwartym, więc zamknięcie czyści pola, a fokus po otwarciu
 * stoi w wyszukiwaniu (`data-autofocus`).
 */
export function FoodPicker({ open, onClose, ...rest }: Props) {
  return (
    <Sheet open={open} title={DT.addEaten} onClose={onClose} className="fd-diet-sheet">
      {open && <PickerBody {...rest} onDone={onClose} />}
    </Sheet>
  );
}

type BodyProps = Omit<Props, 'open' | 'onClose'> & { onDone: () => void };

type Mode = 'search' | 'set' | 'quick';

const QUICK = { name: '', kcal: '', protein: '', carbs: '', fat: '', save: false };

function PickerBody(props: BodyProps) {
  const [mode, setMode] = useState<Mode>('search');
  return (
    <>
      <Segmented
        label={T.how}
        options={[
          { key: 'search', label: T.search },
          { key: 'set', label: T.set },
          { key: 'quick', label: T.quick },
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
  const [scanning, setScanning] = useState(false);
  const [lookup, look] = useCodeLookup(products, dict);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const { busy, once } = useOnce(onLogged, onDone);

  const pick = (food: Food) => {
    setSelected(food);
    setGrams(food.grams ? String(food.grams) : '');
  };

  // Kod spod kresek zamiast nazwy: znaleziony produkt od razu czeka na gramy, jak wybrany z listy.
  const onCode = async (code: string) => {
    const result = await look(code);
    if (result.status !== 'found') return;
    const food = result.product ? productFood(result.product, dict) : scanFood(result.item);
    if (!food) {
      setScanNote(T.scanPartial(result.item.name));
      return;
    }
    setScanning(false);
    setScanNote(null);
    pick(food);
  };

  const results = useMemo(
    () => searchFoods({ query, pool, chains, products, dict }),
    [query, pool, chains, products, dict],
  );
  const chosen = selected ? atGrams(selected, grams) : null;

  const log = (food: Food) =>
    void once(() => logFood(date, food), DT.saved(food.name, food.nutrients.kcal));
  const add = () => {
    if (chosen) log(chosen);
  };

  return (
    <div className="fd-diet-picker">
      <div className="fd-diet-search-row">
        <input
          type="search"
          data-autofocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder={T.searchPlaceholder}
          aria-label={T.searchLabel}
          enterKeyHint="search"
          autoComplete="off"
        />
        <button
          type="button"
          className="btn ghost fd-diet-scan-btn"
          aria-label={scanning ? T.scanClose : T.scan}
          title={scanning ? T.scanClose : T.scan}
          aria-expanded={scanning}
          onClick={() => {
            setScanning((on) => !on);
            setScanNote(null);
          }}
        >
          {scanning ? <X size={22} strokeWidth={2} aria-hidden /> : <ScanBarcode size={22} strokeWidth={2} aria-hidden />}
        </button>
      </div>
      {scanning && (
        <div className="fd-diet-scan">
          <BarcodeCamera onCode={(code) => void onCode(code)} />
          <CodeEntry onCode={(code) => void onCode(code)} />
          <ScanMessage lookup={lookup} note={scanNote} />
        </div>
      )}
      {productsLoading && <p className="fd-diet-hint">{T.loading}</p>}
      {chosen ? (
        <div className="fd-diet-chosen">
          <div className="fd-diet-chosen-head">
            <p className="fd-diet-name">{chosen.name}</p>
            {/* Gwiazdka zapamiętuje jedzenie w ilości, którą tu widać. */}
            <StarButton food={chosen} />
          </div>
          <p className="fd-diet-meta">{chosen.detail}</p>
          {chosen.per100 && (
            <label className="fld fd-diet-grams">
              <span>{T.grams}</span>
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
              {T.add}
            </button>
            <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
              {T.back}
            </button>
          </div>
        </div>
      ) : (
        <FoodResults results={results} onPick={pick} onQuickAdd={log} />
      )}
    </div>
  );
}

/** What the scan found when it is not a product to log: unknown, a shop's own code, no answer. */
function ScanMessage({ lookup, note }: { lookup: Lookup; note: string | null }) {
  const message =
    note ??
    (lookup.status === 'searching'
      ? T.scanSearching(lookup.code)
      : lookup.status === 'unknown'
        ? lookup.inStore
          ? T.scanInStore(lookup.code)
          : T.scanUnknown(lookup.code)
        : lookup.status === 'failed'
          ? T.scanFailed(lookup.code)
          : null);
  return (
    <p className="fd-diet-hint" role="status">
      {message}
    </p>
  );
}

/**
 * Zestaw — kilka rzeczy zjedzonych razem („Banan + batonik”), zapisanych w dzienniku jako jedna
 * pozycja. Zaznaczone „Zapisz jako mój zestaw” zostawia go na później: wraca w wyszukiwaniu
 * i propozycjach, a usuwa się go w Profilu diety → Twoje dane. Części są kopiami (jak wpisy
 * dziennika), więc zestaw nie zmienia się razem z bazą produktów.
 */
function SetBuilder({ date, pool, products, dict, productsLoading, onDone, onLogged }: BodyProps) {
  const [name, setName] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [save, setSave] = useState(true);
  const { busy, once } = useOnce(onLogged, onDone);

  const chosenParts = partsOf(parts);
  const anyBad = parts.some(badGrams);
  const finalName = name.trim() || autoSetName(chosenParts);
  const total = setTotals(chosenParts);

  const add = () => {
    if (!chosenParts.length || anyBad) return;
    const set: FoodSet = { name: finalName, parts: chosenParts };
    void once(
      () =>
        // Jedna transakcja: zestaw i wpis przychodzą razem albo wcale.
        db.transaction('rw', [db.entries, db.sets, db.favorites], async () => {
          const id = save ? await db.sets.add(set) : undefined;
          await logFood(date, setFood(id === undefined ? set : { ...set, id }));
        }),
      `${DT.saved(finalName, total.kcal)}${save ? T.setWaits : ''}`,
    );
  };

  return (
    <div className="fd-diet-set">
      <label className="fld">
        <span>{T.setName}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={chosenParts.length ? autoSetName(chosenParts) : T.setPlaceholder}
          autoComplete="off"
        />
      </label>

      <PartsPicker
        parts={parts}
        onParts={setParts}
        pool={pool}
        products={products}
        dict={dict}
        productsLoading={productsLoading}
        heading={T.inSet}
        empty={T.setEmpty}
        searchLabel={T.setSearch}
        removeLabel={T.setRemove}
        totalName={finalName}
        noSets
      />

      <label className="check-row">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
        {T.saveSet}
      </label>
      <button type="button" className="btn wide" onClick={add} disabled={busy || parts.length === 0 || anyBad}>
        {T.add}
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
          if (quick.save && name) await db.foods.add({ name, amountLabel: T.portion, kcal, ...macros });
        }),
      DT.saved(name || T.offPlan, kcal),
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
      <p className="fd-diet-hint">{T.chains}</p>
      <label className="fld">
        <span>{T.what}</span>
        <input
          type="text"
          value={quick.name}
          onChange={(e) => setQuick({ ...quick, name: e.target.value })}
          placeholder={T.whatPlaceholder}
        />
      </label>
      <label className="fld">
        <span>{DT.kcalField}</span>
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
      <p className="fd-diet-hint">{T.macrosHint}</p>
      <div className="fd-diet-grid3">
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="fld">
            <span>{{ protein: DT.proteinG, carbs: DT.carbsG, fat: DT.fatG }[k]}</span>
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
        {T.saveFood}
      </label>
      <button type="submit" className="btn wide" disabled={busy || numberOrNull(quick.kcal) === null}>
        {T.add}
      </button>
    </form>
  );
}
