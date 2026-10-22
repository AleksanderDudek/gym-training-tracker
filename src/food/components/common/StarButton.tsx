import { useLiveQuery } from 'dexie-react-hooks';
import { Star } from 'lucide-react';
import { text } from '../../../i18n';
import { db } from '../../diet/db';
import { toggleFavorite } from '../../diet/favorites';
import type { Food } from '../../diet/foods';
import './common.css';

const T = text({
  pl: { label: (name: string) => `Ulubione: ${name}`, remove: 'Usuń z ulubionych', add: 'Dodaj do ulubionych' },
  en: { label: (name: string) => `Favourite: ${name}`, remove: 'Remove from favourites', add: 'Add to favourites' },
});

/**
 * Gwiazdka „Ulubione” przy jedzeniu. Przełącznik (`aria-pressed`) ze stałą nazwą „Ulubione: …”, więc
 * czytnik ekranu mówi stan, a nie zmienia etykiety. Stan czyta sam z bazy diety — gwiazdka zapala
 * się wszędzie naraz, gdziekolwiek ją stuknąć. Zapis to migawka jedzenia (ilość i makro), żeby lista
 * szybkiego wyboru działała bez bazy produktów.
 */
export function StarButton({ food }: { food: Food }) {
  // Zanim baza odpowie: znak z listy (bez mignięcia pustej gwiazdki). Baza nie działa: gwiazdka gaśnie,
  // a szczegóły produktu czy lokalu zostają na ekranie.
  const on = useLiveQuery(
    async () => !!(await db.favorites.get(food.key).catch(() => undefined)),
    [food.key],
    food.favorite === true,
  );
  return (
    <button
      type="button"
      className="fd-star"
      aria-pressed={on}
      aria-label={T.label(food.name)}
      title={on ? T.remove : T.add}
      onClick={() => void toggleFavorite(food)}
    >
      <Star size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}
