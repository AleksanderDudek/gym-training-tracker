import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import './common.css';

interface Props {
  /** Arkusz otwarty. `false` zamyka go z zewnątrz — bez ponownego wołania `onClose`. */
  open: boolean;
  /** Zamknięcie przez użytkownika: ×, Escape, stuknięcie w tło. Woła się raz na zamknięcie. */
  onClose: () => void;
  title: ReactNode;
  /** Druga linijka pod tytułem, mniejszym drukiem (np. marka · ilość). */
  subtitle?: ReactNode;
  /** Przyciski w nagłówku obok ×, np. „Wyczyść”. */
  actions?: ReactNode;
  /** Pasek pod treścią, który się nie przewija — główna akcja arkusza. */
  footer?: ReactNode;
  /** Na całą wysokość ekranu (karta produktu); bez tego arkusz ma wysokość treści. */
  full?: boolean;
  closeLabel?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Arkusz od dołu ekranu na natywnym `<dialog>` otwieranym przez `showModal()`: przeglądarka daje
 * pułapkę fokusu, Escape i bezczynne tło, a po zamknięciu oddaje fokus temu, co arkusz otworzyło.
 * Wspólny dla filtrów, karty produktu i ekranów przepisów — jeden wygląd i jedno zachowanie.
 *
 * Każde zamknięcie przez użytkownika idzie przez `dialog.close()`, więc `onClose` przychodzi
 * dokładnie raz, ze zdarzenia `close`. Karta produktu cofa w nim historię — drugie wywołanie
 * cofnęłoby o jeden wpis za daleko.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
  footer,
  full = false,
  closeLabel = 'Zamknij',
  className,
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  // Zamknięcie, o które poprosił rodzic (`open` → false), nie jest zamknięciem przez użytkownika.
  const wanted = useRef(open);

  useEffect(() => {
    wanted.current = open;
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Fokus na tytule, nie na pierwszym przycisku: czytnik ekranu zaczyna od nazwy arkusza, a Tab
      // idzie dalej po kolei. Bez tego przeglądarka stawia fokus (z obwódką) na ×.
      titleRef.current?.focus({ preventScroll: true });
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => ref.current?.close();
  const classes = ['fd-sheet', full && 'full', className].filter(Boolean).join(' ');

  return (
    <dialog
      ref={ref}
      className={classes}
      aria-labelledby={titleId}
      onClose={() => {
        if (wanted.current) onClose();
      }}
      // Stuknięcie poza arkusz trafia w sam `<dialog>` (jego tło), a nie w nic w środku.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="fd-sheet-head">
        <div className="fd-sheet-titles">
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          {subtitle && <p className="fd-sheet-sub">{subtitle}</p>}
        </div>
        {actions}
        <button type="button" className="fd-sheet-x" onClick={close} aria-label={closeLabel}>
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className={`fd-sheet-body${footer ? '' : ' last'}`}>{children}</div>
      {footer && <div className="fd-sheet-foot">{footer}</div>}
    </dialog>
  );
}
