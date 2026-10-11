import { X } from 'lucide-react';
import { useDebouncedDraft } from '../../hooks/useDebouncedDraft';
import type { Range } from '../../lib/filters';

interface Props {
  label: string;
  unit: string;
  /** Krok z `RANGE_LABELS`; pole tekstowe go nie używa, zostaje dla zgodności z Produktami PL. */
  step: number;
  range: Range | undefined;
  onChange: (range: Range | undefined) => void;
}

/** „10,5” i „10.5” to dziesięć i pół; cokolwiek innego znaczy „bez granicy”. */
function parse(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const sameNumber = (draft: string, committed: string) => parse(draft) === parse(committed);

/** Liczba z adresu (`10.5`) w polu po polsku: `10,5`. Bez grupowania tysięcy — `parse` go nie czyta. */
const toDraft = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

/**
 * Zakres „od – do” dla jednej wartości (kalorie, białko, cena…). Pola tekstowe z klawiaturą
 * dziesiętną zamiast `type="number"`: przecinek jest polskim separatorem, a pole liczbowe
 * w części przeglądarek go odrzuca. Wpis trafia do filtrów po chwili przerwy albo przy wyjściu z pola.
 */
export function RangeInput({ label, unit, range, onChange }: Props) {
  const min = range?.min ?? null;
  const max = range?.max ?? null;

  const commit = (nextMin: number | null, nextMax: number | null) =>
    onChange(nextMin === null && nextMax === null ? undefined : { min: nextMin, max: nextMax });

  const [minDraft, setMinDraft, flushMin] = useDebouncedDraft(
    toDraft(min),
    (d) => commit(parse(d), max),
    sameNumber,
  );
  const [maxDraft, setMaxDraft, flushMax] = useDebouncedDraft(
    toDraft(max),
    (d) => commit(min, parse(d)),
    sameNumber,
  );

  return (
    <fieldset className="fd-range">
      <legend>
        {label}
        {unit && <span> ({unit})</span>}
      </legend>
      <div className="fd-range-row">
        <input
          type="text"
          className="num"
          inputMode="decimal"
          value={minDraft}
          onChange={(e) => setMinDraft(e.target.value)}
          onBlur={flushMin}
          placeholder="od"
          aria-label={`${label} od`}
        />
        <span aria-hidden>–</span>
        <input
          type="text"
          className="num"
          inputMode="decimal"
          value={maxDraft}
          onChange={(e) => setMaxDraft(e.target.value)}
          onBlur={flushMax}
          placeholder="do"
          aria-label={`${label} do`}
        />
        {range ? (
          <button
            type="button"
            className="fd-range-x"
            onClick={() => {
              setMinDraft('');
              setMaxDraft('');
              onChange(undefined);
            }}
            aria-label={`Wyczyść: ${label}`}
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <span />
        )}
      </div>
    </fieldset>
  );
}
