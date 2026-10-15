import { useLiveQuery } from 'dexie-react-hooks';
import { Star } from 'lucide-react';
import { db } from '../../diet/db';
import { toggleFavorite } from '../../diet/favorites';
import type { Food } from '../../diet/foods';
import './common.css';

/**
 * Gwiazdka „Ulubione” przy jedzeniu. Przełącznik (`aria-pressed`) ze stałą nazwą „Ulubione: …”, więc
 * czytnik ekranu mówi stan, a nie zmienia etykiety. Stan czyta sam z bazy diety — gwiazdka zapala
 * się wszędzie naraz, gdziekolwiek ją stuknąć. Zapis to migawka jedzenia (ilość i makro), żeby lista
 * szybkiego wyboru działała bez bazy produktów.
 */
export function StarButton({ food }: { food: Food }) {
  const on = useLiveQuery(async () => !!(await db.favorites.get(food.key)), [food.key]) ?? false;
  return (
    <button
      type="button"
      className="fd-star"
      aria-pressed={on}
      aria-label={`Ulubione: ${food.name}`}
      title={on ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
      onClick={() => void toggleFavorite(food)}
    >
      <Star size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}
