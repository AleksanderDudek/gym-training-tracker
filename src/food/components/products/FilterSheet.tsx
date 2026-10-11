import type { ReactNode } from 'react';
import { Sheet } from '../common/Sheet';
import { productsLabel } from './count';

interface Props {
  open: boolean;
  /** Ile produktów zostaje przy bieżących filtrach — na przycisku w stopce. */
  resultCount: number;
  activeCount: number;
  onClear: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Filtry w arkuszu od dołu — w kolumnie telefonu nie ma miejsca na boczny panel. Każda zmiana działa
 * od razu (lista za arkuszem już się zawęża), a przycisk w stopce mówi, ile produktów zostanie,
 * i tylko zamyka arkusz. Treść montuje się dopiero po otwarciu: zamknięty arkusz nie przelicza
 * kilkunastu list przy każdej literze wpisanej w wyszukiwarkę.
 */
export function FilterSheet({ open, resultCount, activeCount, onClear, onClose, children }: Props) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtry"
      closeLabel="Zamknij filtry"
      className="fd-filter-sheet"
      actions={
        activeCount > 0 && (
          <button type="button" className="fd-sheet-clear" onClick={onClear}>
            Wyczyść ({activeCount})
          </button>
        )
      }
      footer={
        <button type="button" className="btn wide" onClick={onClose}>
          Pokaż {productsLabel(resultCount)}
        </button>
      }
    >
      {open && children}
    </Sheet>
  );
}
