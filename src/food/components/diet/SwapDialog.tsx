import type { Food } from '../../diet/foods';
import { SWAP_TOLERANCE, type Suggestion } from '../../diet/suggest';
import { Sheet } from './Sheet';
import { MacroLine, SuggestionList } from './SuggestionList';

interface Props {
  /** Pozycja do zamiany; `null` — arkusz zamknięty. */
  item: Food | null;
  options: Suggestion[];
  onPick: (food: Food) => void;
  onClose: () => void;
}

/** „Zamień”: co może zastąpić pozycję planu przy podobnych kaloriach — najbliższe makro najpierw. */
export function SwapDialog({ item, options, onPick, onClose }: Props) {
  return (
    <Sheet
      open={item !== null}
      title={item ? `Zamień: ${item.name}` : ''}
      sub={
        item && (
          <>
            <MacroLine food={item} /> · zamienniki ±{Math.round(SWAP_TOLERANCE * 100)}% kalorii, najbliższe makro
            najpierw
          </>
        )
      }
      onClose={onClose}
    >
      {options.length ? (
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
          Nie ma nic o podobnej kaloryczności. Dodaj własne jedzenie („Dodaj zjedzone” → „Tylko kalorie” → zapisz) albo
          pomiń tę pozycję.
        </p>
      )}
    </Sheet>
  );
}
