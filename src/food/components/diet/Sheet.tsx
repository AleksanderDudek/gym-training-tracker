import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: ReactNode;
  /** Linijka pod tytułem: czego dotyczy arkusz. */
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Arkusz od dołu ekranu na natywnym `<dialog>`: `showModal()` daje pułapkę fokusu, Escape
 * i wyłączenie reszty strony (także dolnego paska) bez własnego kodu. Treść żyje tylko, gdy
 * arkusz jest otwarty — zamknięcie czyści wpisane pola, a następne otwarcie zaczyna od nowa.
 * Po otwarciu fokus dostaje element z `data-autofocus` (np. pole wyszukiwania); React-owe
 * `autoFocus` działa przy montażu, kiedy dialog jest jeszcze zamknięty.
 */
export function Sheet({ open, title, sub, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="fd-dsheet"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      // Stuknięcie w przyciemnione tło (poza arkuszem) zamyka, jak w arkuszach systemowych.
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      {open && (
        <>
          <div className="fd-dsheet-head">
            <div className="fd-dsheet-titles">
              <h2 id={`${id}-title`}>{title}</h2>
              {sub && <p>{sub}</p>}
            </div>
            <button type="button" className="fd-icon-btn" aria-label="Zamknij" onClick={() => ref.current?.close()}>
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div className="fd-dsheet-body">{children}</div>
        </>
      )}
    </dialog>
  );
}
