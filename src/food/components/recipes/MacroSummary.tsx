import { Check, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { pluralEn, text } from '../../../i18n';
import { formatNumber, plural } from '../../lib/format';
import { GOTOWIEC_MIN_PROTEIN, type RecipeKind } from '../../recipes/catalog';
import type { Macros } from '../../recipes/macros';

const g = (n: number) => `${formatNumber(n, 0)} g`;
// Zasada jest sprawdzana z dokładnością do setnych grama — w pełnych gramach mógłby wyjść remis.
const g1 = (n: number) => `${formatNumber(n, 1)} g`;

const T = text({
  pl: {
    protein: 'białko',
    carbs: 'węglowodany',
    fat: 'tłuszcz',
    gotowiecBroken: (min: number) => `Z tym produktem białka jest mniej niż ${min} g – gotowiec nie spełnia swojej zasady.`,
    broken: 'Z tym produktem białka jest mniej niż węglowodanów lub tłuszczu – zasada nie jest spełniona.',
    ofProtein: 'białka',
    rest: (kcal: string, carbs: string, fat: string) => `${kcal} kcal · węgl. ${carbs} · tł. ${fat}`,
    perServing: (n: number) => `na porcję (przepis na ${n} ${plural(n, 'porcję', 'porcje', 'porcji')})`,
    energy: (parts: string) => `Skąd pochodzą kalorie: ${parts}`,
    gotowiecOk: (protein: string, min: number) => `Białko ${protein} – co najmniej ${min} g w zestawie`,
    ok: (protein: string, carbs: string, fat: string): ReactNode => (
      <>
        Białko {protein} &gt; węglowodany {carbs} i &gt; tłuszcz {fat}
      </>
    ),
  },
  en: {
    protein: 'protein',
    carbs: 'carbs',
    fat: 'fat',
    gotowiecBroken: (min: number) => `With this product there’s less than ${min} g of protein – the grab-and-go set breaks its rule.`,
    broken: 'With this product there’s less protein than carbs or fat – the rule isn’t met.',
    ofProtein: 'protein',
    rest: (kcal: string, carbs: string, fat: string) => `${kcal} kcal · carbs ${carbs} · fat ${fat}`,
    perServing: (n: number) => `per serving (the recipe makes ${n} ${pluralEn(n, 'serving', 'servings')})`,
    energy: (parts: string) => `Where the calories come from: ${parts}`,
    gotowiecOk: (protein: string, min: number) => `Protein ${protein} – at least ${min} g in the set`,
    ok: (protein: string, carbs: string, fat: string): ReactNode => (
      <>
        Protein {protein} &gt; carbs {carbs} and &gt; fat {fat}
      </>
    ),
  },
});

interface Props {
  /** Jedna porcja: to, co je jedna osoba. */
  serving: Macros;
  /** Na ile porcji jest przepis; linijka o tym pojawia się od dwóch. */
  servings: number;
  passes: boolean;
  /** Gotowiec ma własną zasadę (próg białka), reszta — białko ponad węglowodany i tłuszcz. */
  kind: RecipeKind;
}

/** Skąd pochodzą kalorie porcji: białko i węglowodany po 4 kcal na gram, tłuszcz 9. */
export function energyParts(m: Macros) {
  const parts = [
    { key: 'protein', label: T.protein, kcal: m.protein * 4 },
    { key: 'carbs', label: T.carbs, kcal: m.carbs * 4 },
    { key: 'fat', label: T.fat, kcal: m.fat * 9 },
  ] as const;
  const sum = parts.reduce((s, p) => s + p.kcal, 0) || 1;
  return parts.map((p) => ({ ...p, share: p.kcal / sum }));
}

/** Komunikat o złamanej zasadzie — ten sam na karcie i w arkuszu zamiany. */
export function ruleBroken(kind: RecipeKind): string {
  return kind === 'gotowiec' ? T.gotowiecBroken(GOTOWIEC_MIN_PROTEIN) : T.broken;
}

/**
 * Jedna porcja: białko na pierwszym planie, kalorie i reszta makro obok, pasek udziału w kaloriach
 * i sama zasada wypisana liczbami. Złamana zasada to ostrzeżenie (`role="alert"`) w kolorze
 * `--warn`, z ikoną i zdaniem — kolor nigdy nie mówi tego sam.
 */
export function MacroSummary({ serving, servings, passes, kind }: Props) {
  const parts = energyParts(serving);
  const pct = (share: number) => `${formatNumber(share * 100, 0)}%`;

  return (
    <div className="fd-rec-macro">
      <div className="fd-rec-macro-main">
        <p className="fd-rec-protein">
          {g(serving.protein)} <span>{T.ofProtein}</span>
        </p>
        <p className="fd-rec-macro-rest">{T.rest(formatNumber(serving.kcal, 0), g(serving.carbs), g(serving.fat))}</p>
      </div>
      {servings > 1 && (
        // Gramy składników niżej są na cały garnek, a te liczby — na jeden talerz.
        <p className="fd-rec-per">{T.perServing(servings)}</p>
      )}
      <div
        className="fd-rec-energy"
        role="img"
        aria-label={T.energy(parts.map((p) => `${p.label} ${pct(p.share)}`).join(', '))}
      >
        {parts.map((p) => (
          <span key={p.key} className={`fd-rec-e-${p.key}`} style={{ width: `${p.share * 100}%` }} />
        ))}
      </div>
      <ul className="fd-rec-energy-legend" aria-hidden="true">
        {parts.map((p) => (
          <li key={p.key} className={`fd-rec-e-${p.key}`}>
            {p.label} {pct(p.share)}
          </li>
        ))}
      </ul>
      {passes ? (
        <p className="fd-rec-rule fd-rec-ok">
          <Check size={16} strokeWidth={2} aria-hidden />
          {kind === 'gotowiec' ? (
            <span>{T.gotowiecOk(g1(serving.protein), GOTOWIEC_MIN_PROTEIN)}</span>
          ) : (
            <span>{T.ok(g1(serving.protein), g1(serving.carbs), g1(serving.fat))}</span>
          )}
        </p>
      ) : (
        <p className="fd-rec-rule fd-rec-bad" role="alert">
          <TriangleAlert size={20} strokeWidth={2} aria-hidden />
          <span>{ruleBroken(kind)}</span>
        </p>
      )}
    </div>
  );
}
