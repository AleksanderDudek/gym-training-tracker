import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { text } from '../../../i18n';
import { digitsOf } from '../../scan/barcode';
import './common.css';

const T = text({
  pl: {
    label: 'Albo wpisz kod',
    find: 'Szukaj kodu',
    short: 'Kod kreskowy ma 8 albo 13 cyfr (spod kresek).',
  },
  en: {
    label: 'Or type the code',
    find: 'Find the code',
    short: 'A barcode has 8 or 13 digits (under the bars).',
  },
});

/**
 * The barcode typed by hand: when the camera is refused, missing, or the code is creased. Digits
 * only, whatever the spaces; anything shorter than an EAN-8 is not sent.
 */
export function CodeEntry({ onCode }: { onCode: (code: string) => void }) {
  const [value, setValue] = useState('');
  const [short, setShort] = useState(false);
  const hintId = useId();
  return (
    <form
      className="fd-code-entry"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const code = digitsOf(value);
        setShort(code.length < 8);
        if (code.length >= 8) onCode(code);
      }}
    >
      <label className="fld">
        <span>{T.label}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          maxLength={24}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={short ? hintId : undefined}
          aria-invalid={short || undefined}
        />
      </label>
      <button type="submit" className="btn ghost" aria-label={T.find} title={T.find}>
        <Search size={20} strokeWidth={2} aria-hidden />
      </button>
      {short && (
        <p className="hint fd-code-hint" id={hintId}>
          {T.short}
        </p>
      )}
    </form>
  );
}
