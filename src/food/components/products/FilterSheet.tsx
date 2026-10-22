import type { ReactNode } from 'react';
import { text } from '../../../i18n';
import { Sheet } from '../common/Sheet';
import { productsLabel } from './count';

const T = text({
  pl: {
    title: 'Filtry',
    close: 'Zamknij filtry',
    clear: (n: number) => `Wyczyść (${n})`,
    result: (count: string) => `Wynik: ${count}`,
    show: (count: string) => `Pokaż ${count}`,
  },
  en: {
    title: 'Filters',
    close: 'Close filters',
    clear: (n: number) => `Clear (${n})`,
    result: (count: string) => `Result: ${count}`,
    show: (count: string) => `Show ${count}`,
  },
});

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
 * i tylko zamyka arkusz. Panel zostaje zamontowany między otwarciami, jak szuflada Produktów PL:
 * rozwinięte sekcje, szukanie w liście marek i „Pokaż więcej” czekają na następne otwarcie.
 */
export function FilterSheet({ open, resultCount, activeCount, onClear, onClose, children }: Props) {
  const count = productsLabel(resultCount);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={T.title}
      closeLabel={T.close}
      className="fd-filter-sheet"
      actions={
        activeCount > 0 && (
          <button type="button" className="fd-sheet-clear" onClick={onClear}>
            {T.clear(activeCount)}
          </button>
        )
      }
      footer={
        <>
          {/* Arkusz jest modalny, więc wiersz „Znaleziono …” na stronie za nim milczy. Liczbę po
              każdej zmianie filtra czytnik ekranu słyszy stąd. */}
          <p className="sr-only" role="status">
            {T.result(count)}
          </p>
          {/* Zamyka przez `dialog.close()`, jak ×: jedno `onClose`, a pole zakresu wpisane przed chwilą
              zdążyło już oddać fokus i zapisać wartość. */}
          <button type="button" className="btn wide" onClick={(e) => e.currentTarget.closest('dialog')?.close()}>
            {T.show(count)}
          </button>
        </>
      }
    >
      {children}
    </Sheet>
  );
}
