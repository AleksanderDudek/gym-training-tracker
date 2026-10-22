import { X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { text } from '../../../i18n';
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
  /**
   * Pasek pod treścią, który się nie przewija — główna akcja arkusza. Przycisk, który ma zamknąć
   * arkusz tak jak ×, woła `closest('dialog')?.close()` — wtedy `onClose` przychodzi raz, ze zdarzenia.
   */
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
 * Wspólny dla filtrów, karty produktu, ekranów przepisów i arkuszy dziennika jedzenia — jeden
 * wygląd i jedno zachowanie. Treść zostaje zamontowana także w zamkniętym arkuszu; kto chce
 * zaczynać od pustych pól przy każdym otwarciu, podaje ją jako `{open && <Treść />}`.
 *
 * Każde zamknięcie przez użytkownika idzie przez `dialog.close()`, więc `onClose` przychodzi
 * dokładnie raz, ze zdarzenia `close`. Karta produktu cofa w nim historię — drugie wywołanie
 * cofnęłoby o jeden wpis za daleko. Zamknięcie z zewnątrz (`open={false}`, odmontowanie otwartego
 * arkusza) `onClose` nie woła, a fokus i tak wraca tam, skąd arkusz otwarto.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
  footer,
  full = false,
  closeLabel = text({ pl: 'Zamknij', en: 'Close' }),
  className,
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  // Ile zamknięć jest w drodze bez udziału użytkownika (rodzic dał `open={false}`, arkusz znika ze
  // strony). Ich zdarzenia `close` nie wołają `onClose`. Licznik, nie flaga: w przeglądarce zdarzenie
  // przychodzi dopiero w kolejnym zadaniu, a StrictMode potrafi w tym czasie zamknąć i otworzyć arkusz.
  const quiet = useRef(0);
  // To, co miało fokus przed otwarciem — tam wraca po zamknięciu.
  const opener = useRef<Element | null>(null);

  /**
   * Fokus z powrotem na tym, co arkusz otworzyło. Przeglądarka robi to sama przy `close()`; tu
   * tylko wtedy, gdy fokus został w arkuszu albo spadł na `body` (starsze przeglądarki, jsdom).
   */
  const returnFocus = () => {
    const back = opener.current;
    const now = document.activeElement;
    const lost = !now || now === document.body || !!ref.current?.contains(now);
    if (lost && back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
  };

  /** Zamknięcie, którego nie zlecił użytkownik: bez `onClose`. */
  const shut = (dialog: HTMLDialogElement) => {
    quiet.current += 1;
    dialog.close();
    returnFocus();
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      // Fokus na tytule, nie na pierwszym przycisku: czytnik ekranu zaczyna od nazwy arkusza, a Tab
      // idzie dalej po kolei. Bez tego przeglądarka stawia fokus (z obwódką) na ×. Arkusz, który
      // służy do pisania (wyszukiwanie w „Dodaj zjedzone”), wskazuje pole przez `data-autofocus` —
      // Reactowe `autoFocus` działa przy montażu, kiedy dialog jest jeszcze zamknięty.
      const first = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? titleRef.current;
      first?.focus({ preventScroll: true });
    } else if (!open && dialog.open) shut(dialog);
  }, [open]);

  // Arkusz znika ze strony otwarty (karta produktu zamknięta przyciskiem Wstecz): zamknięcie jeszcze
  // przed usunięciem węzła, żeby przeglądarka oddała fokus i zdjęła blokadę tła. W fazie układu, bo
  // efekt zwykły biegnie już po odpięciu `<dialog>` od dokumentu.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) shut(dialog);
    };
  }, []);

  const close = () => ref.current?.close();
  const classes = ['fd-sheet', full && 'full', className].filter(Boolean).join(' ');

  return (
    <dialog
      ref={ref}
      className={classes}
      aria-labelledby={titleId}
      onClose={() => {
        if (quiet.current > 0) {
          quiet.current -= 1;
          return;
        }
        returnFocus();
        onClose();
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
