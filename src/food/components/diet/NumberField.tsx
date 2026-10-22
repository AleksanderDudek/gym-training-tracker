import { useId, useState } from 'react';
import { LANG, text } from '../../../i18n';

const T = text({
  pl: {
    range: (min: number, max: number) => `Wpisz liczbę od ${min} do ${max}.`,
    number: 'Wpisz liczbę.',
  },
  en: {
    range: (min: number, max: number) => `Enter a number from ${min} to ${max}.`,
    number: 'Enter a number.',
  },
});

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Jednostka w polu, po prawej: „kg”, „kcal”. */
  suffix?: string;
  min?: number;
  max?: number;
  integer?: boolean;
}

/** Liczba z polskim przecinkiem albo kropką; `null`, gdy tekst nie jest liczbą. */
function parse(text: string, integer: boolean): number | null {
  const n = Number(text.replace(',', '.').trim());
  if (!text.trim() || !Number.isFinite(n)) return null;
  return integer ? Math.round(n) : n;
}

/** Liczba tak, jak się ją pisze po polsku: 105,5. */
const shown = (value: number): string => (LANG === 'pl' ? String(value).replace('.', ',') : String(value));

/**
 * Liczba wpisywana po polsku („105,5”) bez walki pola z pisaniem: pole trzyma własny tekst
 * i zgłasza liczbę dopiero wtedy, gdy tekst nią jest. Wartość ustawiona z zewnątrz (przycisk
 * tempa) podmienia tekst, chyba że tekst już tę wartość znaczy. Wygląd i rozmiar jak pola
 * w treningach: etykieta nad polem, 17 px (iPhone nie przybliża strony), jednostka w polu.
 */
export function NumberField({ label, value, onChange, suffix, min, max, integer = false }: Props) {
  const id = useId();
  const [text, setText] = useState(shown(value));
  const [known, setKnown] = useState(value);
  if (value !== known) {
    setKnown(value);
    if (parse(text, integer) !== value) setText(shown(value));
  }
  const parsed = parse(text, integer);
  const invalid = parsed === null || (min !== undefined && parsed < min) || (max !== undefined && parsed > max);
  const hint = min !== undefined && max !== undefined ? T.range(min, max) : T.number;
  const described = [suffix ? `${id}-unit` : null, invalid ? `${id}-error` : null].filter(Boolean).join(' ');

  return (
    <div className="fd-diet-num">
      <label htmlFor={id}>{label}</label>
      <div className="fd-diet-num-box">
        <input
          id={id}
          type="text"
          className="num"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={described || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const n = parse(e.target.value, integer);
            if (n !== null && (min === undefined || n >= min) && (max === undefined || n <= max)) {
              setKnown(n);
              onChange(n);
            }
          }}
        />
        {suffix && (
          <span className="fd-diet-unit" id={`${id}-unit`}>
            {suffix}
          </span>
        )}
      </div>
      {invalid && (
        <p className="fd-diet-err" id={`${id}-error`}>
          {hint}
        </p>
      )}
    </div>
  );
}
