import { text } from '../../../i18n';
import { DIET_PROFILES, type DietProfile } from '../../diet/profiles';
import type { Profile } from '../../diet/types';
import { formatNumber } from '../../lib/format';
import { portionLabel } from '../../restaurants/food';
import type { Chain, MenuItem } from '../../restaurants/types';
import { FitBadge } from '../diet/SuggestionList';
import { COMMON } from '../common/text';

/** Sposób odżywiania z profilu diety albo nic, gdy profilu nie ma — wtedy bez ocen. */
export function dietOf(profile: Pick<Profile, 'dietProfile'> | null | undefined): DietProfile | null {
  return profile ? DIET_PROFILES[profile.dietProfile] : null;
}

const g = (n: number) => formatNumber(n, 0);

/** „544 kcal · B 27 · W 42 · T 29” — liczby porcji, tak jak w dzienniku. */
export function MenuNumbers({ item }: { item: MenuItem }) {
  return (
    <span className="fd-rest-nums">
      {g(item.kcal)} kcal · {COMMON.p} {g(item.protein)} · {COMMON.c} {g(item.carbs)} · {COMMON.f} {g(item.fat)}
    </span>
  );
}

interface Props {
  items: { chain: Chain; item: MenuItem }[];
  /** Pokaż sieć przy pozycji — w wynikach wyszukiwania przez wszystkie lokale. */
  showChain?: boolean;
  diet: DietProfile | null;
  onOpen: (chain: Chain, item: MenuItem) => void;
}

/**
 * Pozycje menu jako przyciski na całą szerokość: nazwa, porcja, kalorie i makro, a przy profilu
 * diety — ocena słowem („pasuje”). Stuknięcie otwiera kartę pozycji z pełną tabelą i dodaniem
 * do dziennika.
 */
export function MenuList({ items, showChain = false, diet, onOpen }: Props) {
  return (
    <ul className="fd-rest-list">
      {items.map(({ chain, item }) => (
        <li key={`${chain.id}/${item.id}`}>
          <button type="button" className="fd-rest-item" onClick={() => onOpen(chain, item)}>
            <span className="fd-rest-name">
              {item.name}
              {diet && (
                <>
                  {' '}
                  <FitBadge fit={diet.fit(item)} />
                </>
              )}
            </span>
            <span className="fd-rest-meta">
              <MenuNumbers item={item} /> · {showChain ? `${chain.name} · ` : ''}
              {portionLabel(item)}
              {item.inconsistent && (
                <span className="fd-rest-odd">
                  {text({ pl: ' · liczby sieci się nie zgadzają', en: ' · the chain’s numbers don’t add up' })}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
