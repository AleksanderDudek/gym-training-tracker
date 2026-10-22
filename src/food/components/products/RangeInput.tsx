import { X } from 'lucide-react';
import { text } from '../../../i18n';
import { useDebouncedDraft } from '../../hooks/useDebouncedDraft';
import type { Range } from '../../lib/filters';

const T = text({
  pl: {
    /** Separator dziesiętny w polu. */
    comma: ',',
    from: 'od',
    to: 'do',
    fromLabel: (label: string) => `${label} od`,
    toLabel: (label: string) => `${label} do`,
    clear: (label: string) => `Wyczyść: ${label}`,
  },
  en: {
    comma: '.',
    from: 'from',
    to: 'to',
    fromLabel: (label: string) => `${label} from`,
    toLabel: (label: string) => `${label} to`,
    clear: (label: string) => `Clear: ${label}`,
  },
});

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
const toDraft = (n: number | null) => (n === null ? '' : String(n).replace('.', T.comma));

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
          placeholder={T.from}
          aria-label={T.fromLabel(label)}
        />
        <span aria-hidden>–</span>
        <input
          type="text"
          className="num"
          inputMode="decimal"
          value={maxDraft}
          onChange={(e) => setMaxDraft(e.target.value)}
          onBlur={flushMax}
          placeholder={T.to}
          aria-label={T.toLabel(label)}
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
            aria-label={T.clear(label)}
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
