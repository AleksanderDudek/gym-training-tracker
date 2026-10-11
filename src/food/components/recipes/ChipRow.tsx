import { useEffect, useRef, type ReactNode } from 'react';
import './recipes.css';

export interface ChipOption<T extends string> {
  /** `null` — pozycja „Wszystkie”, czyli brak filtra. */
  key: T | null;
  label: ReactNode;
}

interface Props<T extends string> {
  /** Nazwa grupy dla czytnika ekranu i podpis nad rzędem. */
  label: string;
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
}

/**
 * Rząd filtrów w stroju `.chips` z zakładki Treningi. Na telefonie przewija się w bok zamiast
 * zawijać: dziewięć sklepów w pięciu rzędach zepchnęłoby przepisy pod drugi ekran, a urwany
 * żeton przy krawędzi mówi, że jest ich więcej. Szerzej (od 520 px) rząd zawija się jak w aplikacji.
 */
export function ChipRow<T extends string>({ label, options, value, onChange }: Props<T>) {
  const row = useRef<HTMLDivElement>(null);

  // Wybrany żeton z adresu (np. sklep na końcu listy) ma być widać po wejściu na stronę.
  useEffect(() => {
    const box = row.current;
    const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !on || box.scrollWidth <= box.clientWidth) return;
    if (on.offsetLeft + on.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = on.offsetLeft - 14;
    // Tylko przy wejściu: później przewija ten, kto stuka.
  }, []);

  return (
    <div className="fd-rec-chiprow" role="group" aria-label={label}>
      <span className="seg-label" aria-hidden="true">
        {label}
      </span>
      <div className="chips fd-rec-chips" ref={row}>
        {options.map((o) => (
          <button key={o.key ?? ''} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
