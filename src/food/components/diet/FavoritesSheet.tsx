import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Favorite } from '../../diet/db';
import { favoriteFood } from '../../diet/favorites';
import type { Food } from '../../diet/foods';
import { addDays, shortDay } from '../../diet/model';
import { formatNumber } from '../../lib/format';
import { normalizeForSearch, tokenize } from '../../lib/text';
import { Sheet } from '../common/Sheet';
import { MacroLine } from './SuggestionList';

/** Od ilu ulubionych arkusz dostaje pole do zawężania listy (do ośmiu widać je wszystkie naraz). */
const FILTER_FROM = 9;

interface Props {
  open: boolean;
  date: string;
  today: string;
  /** Ulubione, najczęściej jedzone pierwsze (`useFavorites`). */
  favorites: Favorite[];
  /** Zapis na oglądany dzień — z komunikatem na dole ekranu, jak każdy zapis w dzienniku. */
  onLog: (food: Food) => Promise<unknown>;
  onClose: () => void;
}

/** Ostatni zapis w tym otwarciu arkusza i ile razy z rzędu to samo. */
interface Done {
  food: Food;
  times: number;
}

/** „na dziś”, „na wczoraj”, „na śr., 14.10” — na jaki dzień idzie zapis. */
function forDay(date: string, today: string): string {
  if (date === today) return 'na dziś';
  if (date === addDays(today, -1)) return 'na wczoraj';
  if (date === addDays(today, 1)) return 'na jutro';
  return `na ${shortDay(date)}`;
}

/**
 * „Ulubione”: pełna lista szybkiego wyboru w arkuszu od dołu, zamiast listy na stronie, która
 * spychała w dół resztę dnia. „+ Zjadłem” zapisuje jednym stuknięciem, w ilości z gwiazdki, na
 * oglądany dzień — i arkusz zostaje otwarty, bo śniadanie to zwykle dwie, trzy rzeczy naraz.
 *
 * Komunikat aplikacji na dole ekranu stoi pod arkuszem (modalny `<dialog>` jest nad wszystkim),
 * więc zapis potwierdza też pasek arkusza — region statusu, który czytnik ekranu odczyta. Lista
 * żyje tylko w otwartym arkuszu: każde otwarcie zaczyna od pustego pola i od świeżej kolejności.
 */
export function FavoritesSheet({ open, date, today, favorites, onLog, onClose }: Props) {
  const [done, setDone] = useState<Done | null>(null);
  // Nowe otwarcie — bez potwierdzenia z poprzedniego (stan poprawiany w renderze, nie w efekcie).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDone(null);
  }
  const future = date > today;

  const log = (food: Food) =>
    void onLog(food).then(() => setDone((d) => ({ food, times: d?.food.key === food.key ? d.times + 1 : 1 })));

  const status = favorites.length > 0 && (
    <p className={`fd-diet-favstatus${done ? ' fd-diet-ok' : ''}`} role="status">
      {future
        ? 'Ten dzień jeszcze nie nadszedł — zjedzone zapiszesz tego dnia.'
        : done
          ? `Zapisane ${forDay(date, today)}: ${done.food.name} · ${formatNumber(done.food.nutrients.kcal, 0)} kcal${done.times > 1 ? ` (${done.times}×)` : ''}.`
          : `„Zjadłem” zapisuje od razu ${forDay(date, today)}, w ilości z gwiazdki.`}
    </p>
  );

  return (
    <Sheet
      open={open}
      title="Ulubione"
      subtitle={favorites.length > 0 ? 'Najczęściej jedzone na górze' : undefined}
      footer={status || undefined}
      onClose={onClose}
      className="fd-diet-sheet"
    >
      {open && <FavoritesList favorites={favorites} future={future} onLog={log} />}
    </Sheet>
  );
}

function FavoritesList({
  favorites,
  future,
  onLog,
}: {
  favorites: Favorite[];
  future: boolean;
  onLog: (food: Food) => void;
}) {
  const [query, setQuery] = useState('');
  // Kolejność z chwili otwarcia. Każdy zapis podbija licznik ulubionego, a lista posortowana na żywo
  // przesuwałaby wiersze pod palcem — następne stuknięcie trafiłoby w coś innego.
  const [order] = useState(() => new Map(favorites.map((f, i) => [f.key, i])));
  const sorted = useMemo(() => {
    const at = (f: Favorite) => order.get(f.key) ?? Number.MAX_SAFE_INTEGER;
    return [...favorites].sort((a, b) => at(a) - at(b));
  }, [favorites, order]);

  if (favorites.length === 0)
    return (
      <p className="tight">
        To, co jesz najczęściej, oznacz gwiazdką — w „Dodaj zjedzone”, w produktach, w lokalach albo przy tym, co już
        zjedzone. Pojawi się tutaj do dodania jednym stuknięciem.
      </p>
    );

  const words = tokenize(query);
  const shown = words.length
    ? sorted.filter((f) => {
        const name = normalizeForSearch(f.food.name);
        return words.every((w) => name.includes(w));
      })
    : sorted;

  return (
    <div className="fd-diet-picker">
      {favorites.length >= FILTER_FROM && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj w ulubionych…"
          aria-label="Szukaj w ulubionych"
          enterKeyHint="search"
          autoComplete="off"
        />
      )}
      <ul className="fd-diet-list">
        {shown.map((f) => {
          const food = favoriteFood(f);
          return (
            <li key={f.key} className="fd-diet-sug">
              <div className="fd-diet-row">
                <div className="fd-diet-row-main">
                  <p className="fd-diet-name">{food.name}</p>
                  <p className="fd-diet-meta">
                    <MacroLine food={food} /> · {food.amountLabel || 'porcja'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn ghost sm fd-diet-act"
                  onClick={() => onLog(food)}
                  disabled={future}
                  aria-label={`Zjadłem z ulubionych: ${food.name}`}
                >
                  <Plus size={20} strokeWidth={2} aria-hidden /> Zjadłem
                </button>
              </div>
            </li>
          );
        })}
        {shown.length === 0 && <li className="fd-diet-empty">Nic z ulubionych nie pasuje do „{query.trim()}”.</li>}
      </ul>
    </div>
  );
}
