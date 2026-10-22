import { text } from '../../../i18n';
import type { Food } from '../../diet/foods';
import { SWAP_TOLERANCE, type Suggestion } from '../../diet/suggest';
import { Sheet } from '../common/Sheet';
import { MacroLine, SuggestionList } from './SuggestionList';

const T = text({
  pl: {
    title: (name: string) => `Zamień: ${name}`,
    subtitle: (pct: number) => ` · zamienniki ±${pct}% kalorii, najbliższe makro najpierw`,
    pick: 'Wybierz',
    none: 'Nie ma nic o podobnej kaloryczności. Dodaj własne jedzenie („Dodaj zjedzone” → „Tylko kalorie” → zapisz) albo pomiń tę pozycję.',
  },
  en: {
    title: (name: string) => `Swap: ${name}`,
    subtitle: (pct: number) => ` · swaps within ±${pct}% of the calories, closest macros first`,
    pick: 'Choose',
    none: 'Nothing has similar calories. Add your own food (“Add food” → “Calories only” → save) or skip this item.',
  },
});

interface Props {
  /** Pozycja do zamiany; `null` — arkusz zamknięty. */
  item: Food | null;
  options: Suggestion[];
  onPick: (food: Food) => void;
  onClose: () => void;
}

/**
 * „Zamień”: co może zastąpić pozycję planu przy podobnych kaloriach — najbliższe makro najpierw.
 * Wybór zamyka arkusz z zewnątrz (`item` wraca do `null`), więc `onClose` przychodzi raz: od nas,
 * a nie drugi raz ze zdarzenia `close`.
 */
export function SwapDialog({ item, options, onPick, onClose }: Props) {
  return (
    <Sheet
      open={item !== null}
      title={item ? T.title(item.name) : ''}
      subtitle={
        item && (
          <>
            <MacroLine food={item} />
            {T.subtitle(Math.round(SWAP_TOLERANCE * 100))}
          </>
        )
      }
      onClose={onClose}
      className="fd-diet-sheet"
    >
      {item &&
        (options.length ? (
          <SuggestionList
            suggestions={options}
            actionLabel={T.pick}
            onPick={(food) => {
              onPick(food);
              onClose();
            }}
          />
        ) : (
          <p className="tight">{T.none}</p>
        ))}
    </Sheet>
  );
}
