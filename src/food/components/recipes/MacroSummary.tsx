import { Check, TriangleAlert } from 'lucide-react';
import { formatNumber, plural } from '../../lib/format';
import type { Macros } from '../../recipes/macros';

const g = (n: number) => `${formatNumber(n, 0)} g`;
// Zasada jest sprawdzana z dokładnością do setnych grama — w pełnych gramach mógłby wyjść remis.
const g1 = (n: number) => `${formatNumber(n, 1)} g`;

interface Props {
  /** Jedna porcja: to, co je jedna osoba. */
  serving: Macros;
  /** Na ile porcji jest przepis; linijka o tym pojawia się od dwóch. */
  servings: number;
  passes: boolean;
}

/** Skąd pochodzą kalorie porcji: białko i węglowodany po 4 kcal na gram, tłuszcz 9. */
export function energyParts(m: Macros) {
  const parts = [
    { key: 'protein', label: 'białko', kcal: m.protein * 4 },
    { key: 'carbs', label: 'węglowodany', kcal: m.carbs * 4 },
    { key: 'fat', label: 'tłuszcz', kcal: m.fat * 9 },
  ] as const;
  const sum = parts.reduce((s, p) => s + p.kcal, 0) || 1;
  return parts.map((p) => ({ ...p, share: p.kcal / sum }));
}

/** Komunikat o złamanej zasadzie — ten sam na karcie i w arkuszu zamiany. */
export const RULE_BROKEN = 'Z tym produktem białka jest mniej niż węglowodanów lub tłuszczu – zasada nie jest spełniona.';

/**
 * Jedna porcja: białko na pierwszym planie, kalorie i reszta makro obok, pasek udziału w kaloriach
 * i sama zasada wypisana liczbami. Złamana zasada to ostrzeżenie (`role="alert"`) w kolorze
 * `--warn`, z ikoną i zdaniem — kolor nigdy nie mówi tego sam.
 */
export function MacroSummary({ serving, servings, passes }: Props) {
  const parts = energyParts(serving);
  const pct = (share: number) => `${formatNumber(share * 100, 0)}%`;

  return (
    <div className="fd-rec-macro">
      <div className="fd-rec-macro-main">
        <p className="fd-rec-protein">
          {g(serving.protein)} <span>białka</span>
        </p>
        <p className="fd-rec-macro-rest">
          {formatNumber(serving.kcal, 0)} kcal · węgl. {g(serving.carbs)} · tł. {g(serving.fat)}
        </p>
      </div>
      {servings > 1 && (
        // Gramy składników niżej są na cały garnek, a te liczby — na jeden talerz.
        <p className="fd-rec-per">
          na porcję (przepis na {servings} {plural(servings, 'porcję', 'porcje', 'porcji')})
        </p>
      )}
      <div
        className="fd-rec-energy"
        role="img"
        aria-label={`Skąd pochodzą kalorie: ${parts.map((p) => `${p.label} ${pct(p.share)}`).join(', ')}`}
      >
        {parts.map((p) => (
          <span key={p.key} className={p.key} style={{ width: `${p.share * 100}%` }} />
        ))}
      </div>
      <ul className="fd-rec-energy-legend" aria-hidden="true">
        {parts.map((p) => (
          <li key={p.key} className={p.key}>
            {p.label} {pct(p.share)}
          </li>
        ))}
      </ul>
      {passes ? (
        <p className="fd-rec-rule ok">
          <Check size={16} strokeWidth={2} aria-hidden />
          <span>
            Białko {g1(serving.protein)} &gt; węglowodany {g1(serving.carbs)} i &gt; tłuszcz {g1(serving.fat)}
          </span>
        </p>
      ) : (
        <p className="fd-rec-rule bad" role="alert">
          <TriangleAlert size={20} strokeWidth={2} aria-hidden />
          <span>{RULE_BROKEN}</span>
        </p>
      )}
    </div>
  );
}
