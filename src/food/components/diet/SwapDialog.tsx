import type { Food } from '../../diet/foods';
import { SWAP_TOLERANCE, type Suggestion } from '../../diet/suggest';
import { Sheet } from '../common/Sheet';
import { MacroLine, SuggestionList } from './SuggestionList';

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
      title={item ? `Zamień: ${item.name}` : ''}
      subtitle={
        item && (
          <>
            <MacroLine food={item} /> · zamienniki ±{Math.round(SWAP_TOLERANCE * 100)}% kalorii, najbliższe makro
            najpierw
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
            actionLabel="Wybierz"
            onPick={(food) => {
              onPick(food);
              onClose();
            }}
          />
        ) : (
          <p className="tight">
            Nie ma nic o podobnej kaloryczności. Dodaj własne jedzenie („Dodaj zjedzone” → „Tylko kalorie” → zapisz)
            albo pomiń tę pozycję.
          </p>
        ))}
    </Sheet>
  );
}
